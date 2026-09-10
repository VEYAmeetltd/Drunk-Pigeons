"""Focused regression tests for the DP admin activation -> login pipeline.

Added after diagnosing an owner-login incident (2026-09-10) that turned out to
be a preview-vs-deployed database sync gap, NOT a code defect. These tests
pin down the exact behaviour that was inspected during that diagnosis so any
future regression in the SAME code path is caught immediately:
  - an invited admin cannot log in before activation (generic 401, no state leak)
  - a valid single-use setup token activates the account and login then succeeds
  - the SAME setup token can never be reused (guards the setup-password
    endpoint's atomic find_one_and_update fix — a prior version had a TOCTOU
    race where two concurrent requests with one token could both succeed)
  - concurrent acceptance of one token produces exactly one success
  - email lookup is case-insensitive/normalized on login
  - a wrong password never mutates account state
All accounts here are synthetic (`dp_test_recover_reg_*@example.com`), never
the real production owner. No password is ever logged/printed.
"""
import concurrent.futures
import hashlib
import hmac
import json
import os
import secrets
import time
from urllib.parse import urlencode

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

KEY_ID = ""
SECRET = ""
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("INTIES_SERVICE_KEY_ID="):
                KEY_ID = line.split("=", 1)[1].strip()
            elif line.startswith("INTIES_SERVICE_SECRET="):
                SECRET = line.split("=", 1)[1].strip()
except Exception:
    pass

OWNER_EMAIL = "dp_test_owner@example.com"
OWNER_PASSWORD = "DpTestFixtureOwner_2026!"


def _sign(method, path, query=None, body=b"", ts=None, nonce=None):
    ts = ts or str(int(time.time()))
    nonce = nonce or secrets.token_hex(16)
    q = urlencode(sorted(query.items())) if query else ""
    target = f"{path}?{q}" if q else path
    body_hash = hashlib.sha256(body or b"").hexdigest()
    canonical = f"{method}\n{target}\n{body_hash}\n{ts}\n{nonce}"
    sig = hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return {"X-Service-Key": KEY_ID, "X-Timestamp": ts, "X-Nonce": nonce, "X-Signature": sig}


def signed(method, path, query=None, json_body=None, bearer=None, **kw):
    body = json.dumps(json_body).encode() if json_body is not None else b""
    headers = _sign(method, path, query=query, body=body, **kw)
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    return requests.request(method, BASE_URL + path, headers=headers, params=query,
                             data=body if json_body is not None else None, timeout=20)


def owner_token():
    r = signed("POST", "/api/service/admin/login", json_body={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def invite(email, role="admin"):
    r = signed("POST", "/api/service/admin/admins", json_body={"email": email, "role": role}, bearer=owner_token())
    assert r.status_code == 200, r.text
    return r.json()["setup_token"]


class TestActivationLoginPipeline:
    def test_invited_admin_cannot_login_before_activation(self):
        email = f"dp_test_recover_reg_pre_{secrets.token_hex(4)}@example.com"
        invite(email)
        r = signed("POST", "/api/service/admin/login", json_body={"email": email, "password": "WhateverPassword123"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email or password."

    def test_activation_then_login_succeeds_with_matching_role(self):
        email = f"dp_test_recover_reg_ok_{secrets.token_hex(4)}@example.com"
        token = invite(email, role="admin")
        pw = f"RegressionPass_{secrets.token_hex(6)}!"

        r = requests.post(f"{BASE_URL}/api/admin/setup-password", json={"token": token, "password": pw}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True, "email": email}

        r2 = signed("POST", "/api/service/admin/login", json_body={"email": email, "password": pw})
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["ok"] is True
        assert d["admin"]["role"] == "admin"
        assert d["admin"]["status"] == "active"

    def test_setup_token_cannot_be_reused(self):
        email = f"dp_test_recover_reg_reuse_{secrets.token_hex(4)}@example.com"
        token = invite(email)
        pw = f"RegressionPass_{secrets.token_hex(6)}!"

        r1 = requests.post(f"{BASE_URL}/api/admin/setup-password", json={"token": token, "password": pw}, timeout=15)
        assert r1.status_code == 200

        r2 = requests.post(f"{BASE_URL}/api/admin/setup-password",
                            json={"token": token, "password": "SomeOtherPassword123!"}, timeout=15)
        assert r2.status_code == 400
        assert r2.json()["detail"] == "Invalid or expired setup link."

    def test_concurrent_acceptance_produces_exactly_one_success(self):
        email = f"dp_test_recover_reg_race_{secrets.token_hex(4)}@example.com"
        token = invite(email)

        def attempt(i):
            return requests.post(
                f"{BASE_URL}/api/admin/setup-password",
                json={"token": token, "password": f"RaceAttemptPass_{i}!!"},
                timeout=15,
            ).status_code

        # Small N: this endpoint has its own (pre-existing, unrelated) per-IP
        # rate limit of 10 setup-password calls/hour — keep total calls across
        # this whole test file comfortably under that budget.
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            statuses = list(pool.map(attempt, range(3)))

        assert statuses.count(200) == 1, f"expected exactly one 200, got {statuses}"
        assert statuses.count(400) == 2, f"expected exactly two 400s, got {statuses}"

    def test_login_email_is_case_and_whitespace_normalized(self):
        email = f"dp_test_recover_reg_case_{secrets.token_hex(4)}@example.com"
        token = invite(email)
        pw = f"RegressionPass_{secrets.token_hex(6)}!"
        r = requests.post(f"{BASE_URL}/api/admin/setup-password", json={"token": token, "password": pw}, timeout=15)
        assert r.status_code == 200

        mixed_case = "  " + email.upper() + "  "
        r2 = signed("POST", "/api/service/admin/login", json_body={"email": mixed_case, "password": pw})
        assert r2.status_code == 200, r2.text

    def test_wrong_password_never_mutates_state(self):
        email = f"dp_test_recover_reg_wrong_{secrets.token_hex(4)}@example.com"
        token = invite(email)
        pw = f"RegressionPass_{secrets.token_hex(6)}!"
        r = requests.post(f"{BASE_URL}/api/admin/setup-password", json={"token": token, "password": pw}, timeout=15)
        assert r.status_code == 200

        for _ in range(3):
            r_bad = signed("POST", "/api/service/admin/login", json_body={"email": email, "password": "NopeNotThisOne123"})
            assert r_bad.status_code == 401

        r_good = signed("POST", "/api/service/admin/login", json_body={"email": email, "password": pw})
        assert r_good.status_code == 200, r_good.text

    def test_no_sensitive_fields_in_any_response(self):
        email = f"dp_test_recover_reg_secrets_{secrets.token_hex(4)}@example.com"
        token = invite(email)
        pw = f"RegressionPass_{secrets.token_hex(6)}!"
        r = requests.post(f"{BASE_URL}/api/admin/setup-password", json={"token": token, "password": pw}, timeout=15)
        r2 = signed("POST", "/api/service/admin/login", json_body={"email": email, "password": pw})
        for resp in (r, r2):
            raw = json.dumps(resp.json())
            for bad in ("password_hash", "token_hash", "INTIES_SERVICE_SECRET", "DP_ADMIN_JWT_SECRET"):
                assert bad not in raw
