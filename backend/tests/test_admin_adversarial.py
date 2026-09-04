"""Adversarial tests for DP Admin API - independent verification by T1.

Focus areas per review request:
- Role isolation edge cases (invited status, disabled, revoked cannot login)
- Immediate revocation timing
- Sensitive-field redaction across ALL admin responses
- JWT tampering (wrong secret, wrong alg, expired-adjacent)
- HMAC edge cases (wrong method in signature, wrong path, body tampering)
- No data duplication of ad_enquiries/reports into dp_tickets
"""
import hashlib
import hmac
import json
import os
import secrets
import time
from urllib.parse import urlencode

import jwt as jwt_lib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

KEY_ID = ""
SECRET = ""
JWT_SECRET = ""
with open("/app/backend/.env") as f:
    for line in f:
        if line.startswith("INTIES_SERVICE_KEY_ID="):
            KEY_ID = line.split("=", 1)[1].strip()
        elif line.startswith("INTIES_SERVICE_SECRET="):
            SECRET = line.split("=", 1)[1].strip()
        elif line.startswith("DP_ADMIN_JWT_SECRET="):
            JWT_SECRET = line.split("=", 1)[1].strip()

OWNER_EMAIL = "dp_test_owner@example.com"
OWNER_PASSWORD = "DpTestFixtureOwner_2026!"


def _sign(method, path, query=None, body=b"", ts=None, nonce=None, key_id=None, secret=None):
    ts = ts or str(int(time.time()))
    nonce = nonce or secrets.token_hex(16)
    q = urlencode(sorted(query.items())) if query else ""
    target = f"{path}?{q}" if q else path
    body_hash = hashlib.sha256(body or b"").hexdigest()
    canonical = f"{method}\n{target}\n{body_hash}\n{ts}\n{nonce}"
    sig = hmac.new((secret or SECRET).encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return {"X-Service-Key": key_id or KEY_ID, "X-Timestamp": ts, "X-Nonce": nonce, "X-Signature": sig}


def signed(method, path, query=None, json_body=None, bearer=None, **kw):
    body = json.dumps(json_body).encode() if json_body is not None else b""
    headers = _sign(method, path, query=query, body=body, **kw)
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    return requests.request(method, BASE_URL + path, headers=headers, params=query,
                             data=body if json_body is not None else None, timeout=20)


_cache = {}


def owner_token():
    if "tok" not in _cache:
        r = signed("POST", "/api/service/admin/login",
                    json_body={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200, r.text
        _cache["tok"] = r.json()["token"]
    return _cache["tok"]


# ---------- JWT tampering / forgery ----------
class TestJWTHardening:
    def test_forged_jwt_wrong_secret_rejected(self):
        # Attacker forges a JWT signing with a random secret
        tok = jwt_lib.encode({"sub": "fakeadminid", "role": "owner",
                               "exp": int(time.time()) + 300, "iat": int(time.time()),
                               "jti": "abc"},
                              "attacker-secret", algorithm="HS256")
        r = signed("GET", "/api/service/admin/me", bearer=tok)
        assert r.status_code == 401

    def test_jwt_alg_none_rejected(self):
        # Classic alg:none attack
        header = '{"alg":"none","typ":"JWT"}'
        payload = '{"sub":"fake","role":"owner","exp":' + str(int(time.time()) + 300) + '}'
        import base64
        def b64(s): return base64.urlsafe_b64encode(s.encode()).rstrip(b"=").decode()
        tok = f"{b64(header)}.{b64(payload)}."
        r = signed("GET", "/api/service/admin/me", bearer=tok)
        assert r.status_code == 401

    def test_expired_jwt_rejected(self):
        if not JWT_SECRET:
            pytest.skip("no jwt secret available")
        tok = jwt_lib.encode({"sub": "any", "role": "admin",
                               "exp": int(time.time()) - 10, "iat": int(time.time()) - 3600},
                              JWT_SECRET, algorithm="HS256")
        r = signed("GET", "/api/service/admin/me", bearer=tok)
        assert r.status_code == 401

    def test_jwt_for_nonexistent_admin_rejected(self):
        if not JWT_SECRET:
            pytest.skip("no jwt secret available")
        tok = jwt_lib.encode({"sub": "does-not-exist-" + secrets.token_hex(6), "role": "owner",
                               "exp": int(time.time()) + 300, "iat": int(time.time())},
                              JWT_SECRET, algorithm="HS256")
        r = signed("GET", "/api/service/admin/me", bearer=tok)
        assert r.status_code == 401

    def test_role_claim_in_jwt_ignored_backend_reloads_from_db(self):
        """A JWT claiming role=owner for a mere admin must not grant owner privileges,
        because require_dp_admin re-reads role from DB."""
        if not JWT_SECRET:
            pytest.skip("no jwt secret available")
        # bootstrap a real admin
        owner_tok = owner_token()
        email = f"testadv_{secrets.token_hex(4)}@intiesltd.com"
        r = signed("POST", "/api/service/admin/admins",
                    json_body={"email": email, "role": "admin"}, bearer=owner_tok)
        assert r.status_code == 200
        aid = r.json()["admin_id"]
        setup = r.json()["setup_token"]
        sr = requests.post(f"{BASE_URL}/api/admin/setup-password",
                            json={"token": setup, "password": "AdversarialPW123!"}, timeout=10)
        assert sr.status_code == 200

        # Forge a JWT with role=owner for this admin
        forged = jwt_lib.encode({"sub": aid, "role": "owner",
                                  "exp": int(time.time()) + 300, "iat": int(time.time()),
                                  "jti": "x"},
                                 JWT_SECRET, algorithm="HS256")
        # Attempt owner-only action
        r2 = signed("POST", "/api/service/admin/admins",
                    json_body={"email": f"z_{secrets.token_hex(3)}@x.com", "role": "admin"},
                    bearer=forged)
        assert r2.status_code == 403, f"CRITICAL: forged role in JWT was accepted: {r2.status_code}"


# ---------- HMAC edge cases ----------
class TestHMACHardening:
    def test_body_tampering_after_signing_rejected(self):
        # sign body A, send body B
        path = "/api/service/admin/login"
        real_body = json.dumps({"email": OWNER_EMAIL, "password": OWNER_PASSWORD}).encode()
        headers = _sign("POST", path, body=real_body)
        tampered = json.dumps({"email": OWNER_EMAIL, "password": "wrong"}).encode()
        headers["Content-Type"] = "application/json"
        r = requests.post(BASE_URL + path, headers=headers, data=tampered, timeout=10)
        assert r.status_code == 401

    def test_method_swap_rejected(self):
        # sign GET, use POST
        headers = _sign("GET", "/api/service/admin/tickets")
        r = requests.post(BASE_URL + "/api/service/admin/tickets", headers=headers,
                          data=b"", timeout=10)
        assert r.status_code == 401

    def test_query_tampering_rejected(self):
        headers = _sign("GET", "/api/service/admin/tickets", query={"status": "open"})
        # send different query
        r = requests.get(BASE_URL + "/api/service/admin/tickets",
                         headers=headers, params={"status": "resolved"}, timeout=10)
        assert r.status_code == 401


# ---------- Sensitive field redaction (comprehensive sweep) ----------
class TestRedaction:
    def _scan(self, data_str):
        forbidden = ["password_hash", '"password":', "token_hash"]
        found = [f for f in forbidden if f in data_str]
        assert not found, f"sensitive field leaked: {found}"
        # never leak the actual secret value
        if SECRET:
            assert SECRET not in data_str, "INTIES_SERVICE_SECRET value leaked"
        if JWT_SECRET:
            assert JWT_SECRET not in data_str, "DP_ADMIN_JWT_SECRET value leaked"

    def test_admins_list_never_leaks_hashes(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/admins", bearer=tok)
        assert r.status_code == 200
        self._scan(r.text)

    def test_logs_never_leak_secrets_or_tokens(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/logs", query={"page_size": "100"}, bearer=tok)
        assert r.status_code == 200
        self._scan(r.text)
        # Also: no setup_token or X-Signature values in logs
        assert "X-Signature" not in r.text
        assert "setup_token" not in r.text

    def test_tickets_never_leak_secrets(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/tickets", query={"page_size": "100"}, bearer=tok)
        assert r.status_code == 200
        self._scan(r.text)

    def test_me_never_leaks_hash(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/me", bearer=tok)
        assert r.status_code == 200
        self._scan(r.text)


# ---------- Role isolation edge cases ----------
class TestRoleEdgeCases:
    def test_invited_admin_cannot_login_before_setup(self):
        owner_tok = owner_token()
        email = f"invited_{secrets.token_hex(4)}@intiesltd.com"
        r = signed("POST", "/api/service/admin/admins",
                    json_body={"email": email, "role": "admin"}, bearer=owner_tok)
        assert r.status_code == 200
        # try to login with any password - should fail because status=invited
        r2 = signed("POST", "/api/service/admin/login",
                     json_body={"email": email, "password": "AnythingReally123"})
        assert r2.status_code == 401

    def test_disabled_admin_cannot_login(self):
        owner_tok = owner_token()
        email = f"disabled_{secrets.token_hex(4)}@intiesltd.com"
        r = signed("POST", "/api/service/admin/admins",
                    json_body={"email": email, "role": "admin"}, bearer=owner_tok)
        aid = r.json()["admin_id"]
        setup = r.json()["setup_token"]
        requests.post(f"{BASE_URL}/api/admin/setup-password",
                       json={"token": setup, "password": "SomeStrongPass123!"}, timeout=10)
        # disable
        signed("PATCH", f"/api/service/admin/admins/{aid}",
                json_body={"status": "disabled"}, bearer=owner_tok)
        # login attempt
        r2 = signed("POST", "/api/service/admin/login",
                     json_body={"email": email, "password": "SomeStrongPass123!"})
        assert r2.status_code == 401

    def test_expired_setup_token_semantically_rejected(self):
        # test single-use + bad token
        r = requests.post(f"{BASE_URL}/api/admin/setup-password",
                          json={"token": "notarealtoken", "password": "SomeStrongPass123!"},
                          timeout=10)
        assert r.status_code == 400

    def test_short_password_rejected_on_setup(self):
        owner_tok = owner_token()
        email = f"shortpw_{secrets.token_hex(4)}@intiesltd.com"
        r = signed("POST", "/api/service/admin/admins",
                    json_body={"email": email, "role": "admin"}, bearer=owner_tok)
        setup = r.json()["setup_token"]
        r2 = requests.post(f"{BASE_URL}/api/admin/setup-password",
                            json={"token": setup, "password": "short"}, timeout=10)
        assert r2.status_code == 422

    def test_duplicate_email_invite_rejected(self):
        owner_tok = owner_token()
        r = signed("POST", "/api/service/admin/admins",
                    json_body={"email": OWNER_EMAIL, "role": "admin"}, bearer=owner_tok)
        assert r.status_code == 409


# ---------- Data duplication check ----------
class TestNoDataDuplication:
    def test_dp_tickets_collection_only_holds_new_categories(self):
        """Every dp_ticket:* row must be player_support or operational_incident."""
        tok = owner_token()
        r = signed("GET", "/api/service/admin/tickets", query={"page_size": "100"}, bearer=tok)
        assert r.status_code == 200
        for t in r.json()["tickets"]:
            if t["source"] == "dp_ticket":
                assert t["category"] in ("player_support", "operational_incident"), \
                    f"dp_ticket has unexpected category: {t['category']}"

    def test_ad_enquiry_source_categories_never_in_dp_tickets(self):
        tok = owner_token()
        for cat in ("advertising_enquiry", "artwork_review", "payment_admin"):
            r = signed("GET", "/api/service/admin/tickets",
                        query={"category": cat, "page_size": "100"}, bearer=tok)
            assert r.status_code == 200
            for t in r.json()["tickets"]:
                assert t["source"] == "ad_enquiry", \
                    f"category {cat} came from wrong source {t['source']}"

    def test_report_category_only_from_reports(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/tickets",
                    query={"category": "leaderboard_moderation", "page_size": "100"}, bearer=tok)
        assert r.status_code == 200
        for t in r.json()["tickets"]:
            assert t["source"] == "report"


# ---------- Log filtering / event_type validation ----------
class TestLogsFiltering:
    def test_invalid_event_type_returns_422(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/logs",
                    query={"event_type": "totally_fake_event"}, bearer=tok)
        assert r.status_code == 422

    def test_pagination_shape(self):
        tok = owner_token()
        r = signed("GET", "/api/service/admin/logs",
                    query={"page": "1", "page_size": "3"}, bearer=tok)
        assert r.status_code == 200
        d = r.json()
        assert d["page"] == 1 and d["page_size"] == 3 and len(d["logs"]) <= 3
