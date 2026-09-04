"""End-to-end tests for the DP-owned Admin Access + Tickets + Logs API.

Covers:
- Admin bootstrap/invite: single-use setup token (hashed, expiring, one-time)
- DP admin login (JWT), wrong password/disabled/revoked all rejected
- Role isolation: DP ADMIN cannot manage admins (403), DP OWNER can
- Immediate revocation: disabling/revoking an admin invalidates their still-valid JWT
- DP admin API always requires BOTH the HMAC service layer AND a valid DP admin JWT
- Tickets: list/filter/paginate across ad_enquiries/reports/dp_tickets, resolve reuses
  existing enquiry moderation/workflow logic, notes + resolutions are audited
- Logs: DP admin/ticket/service-auth-failure events are recorded, sensitive fields
  (passwords, setup tokens, JWTs, HMAC secrets) are never present in any response
"""
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

# Synthetic test-fixture DP OWNER — deliberately NOT the real production owner
# (gordon@intiesltd.com). Automated tests must never know/hardcode a real human's
# password; this account exists solely for pytest.
OWNER_EMAIL = "dp_test_owner@example.com"
OWNER_PASSWORD = "DpTestFixtureOwner_2026!"


def _sign(method, path, query=None, body=b"", ts=None, nonce=None, key_id=None):
    ts = ts or str(int(time.time()))
    nonce = nonce or secrets.token_hex(16)
    q = urlencode(sorted(query.items())) if query else ""
    target = f"{path}?{q}" if q else path
    body_hash = hashlib.sha256(body or b"").hexdigest()
    canonical = f"{method}\n{target}\n{body_hash}\n{ts}\n{nonce}"
    sig = hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
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


_owner_token_cache = {}


def owner_token():
    if "tok" in _owner_token_cache:
        return _owner_token_cache["tok"]
    r = signed("POST", "/api/service/admin/login", json_body={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    _owner_token_cache["tok"] = r.json()["token"]
    return _owner_token_cache["tok"]


class TestSanity:
    def test_backend_reachable(self):
        assert BASE_URL
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200


class TestAdminLogin:
    def test_owner_login_ok(self):
        r = signed("POST", "/api/service/admin/login", json_body={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and d["admin"]["role"] == "owner" and d["admin"]["status"] == "active"
        # never return sensitive fields
        raw = json.dumps(d)
        for bad in ("password", "password_hash", "setup_token", "INTIES_SERVICE_SECRET"):
            assert bad not in raw

    def test_wrong_password_401(self):
        r = signed("POST", "/api/service/admin/login", json_body={"email": OWNER_EMAIL, "password": "wrong-password"})
        assert r.status_code == 401

    def test_login_without_hmac_401(self):
        r = requests.post(f"{BASE_URL}/api/service/admin/login",
                           json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, timeout=10)
        assert r.status_code == 401

    def test_me_requires_both_hmac_and_jwt(self):
        tok = owner_token()
        # HMAC only, no bearer -> 401
        r = signed("GET", "/api/service/admin/me")
        assert r.status_code == 401
        # Bearer only, no HMAC -> 401
        r2 = requests.get(f"{BASE_URL}/api/service/admin/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r2.status_code == 401
        # Both -> 200
        r3 = signed("GET", "/api/service/admin/me", bearer=tok)
        assert r3.status_code == 200
        assert r3.json()["admin"]["email"] == OWNER_EMAIL


class TestAdminManagementAndIsolation:
    def test_owner_can_invite_admin_and_admin_cannot_manage_admins(self):
        owner_tok = owner_token()
        email = f"testadmin_{secrets.token_hex(4)}@intiesltd.com"
        r = signed("POST", "/api/service/admin/admins", json_body={"email": email, "role": "admin"}, bearer=owner_tok)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and d["setup_token"]
        setup_token = d["setup_token"]
        admin_id = d["admin_id"]

        # complete setup (public, token-gated, no HMAC needed)
        sr = requests.post(f"{BASE_URL}/api/admin/setup-password",
                            json={"token": setup_token, "password": "SomeStrongPassword123"}, timeout=10)
        assert sr.status_code == 200

        # re-using the same setup token must fail (single-use)
        sr2 = requests.post(f"{BASE_URL}/api/admin/setup-password",
                             json={"token": setup_token, "password": "AnotherPassword456"}, timeout=10)
        assert sr2.status_code == 400

        admin_tok_r = signed("POST", "/api/service/admin/login",
                              json_body={"email": email, "password": "SomeStrongPassword123"})
        assert admin_tok_r.status_code == 200
        admin_tok = admin_tok_r.json()["token"]
        assert admin_tok_r.json()["admin"]["role"] == "admin"

        # DP ADMIN can list tickets/logs (read access)
        assert signed("GET", "/api/service/admin/tickets", bearer=admin_tok).status_code == 200
        assert signed("GET", "/api/service/admin/logs", bearer=admin_tok).status_code == 200

        # DP ADMIN CANNOT manage other admins
        r2 = signed("POST", "/api/service/admin/admins",
                    json_body={"email": f"x_{secrets.token_hex(3)}@intiesltd.com", "role": "admin"}, bearer=admin_tok)
        assert r2.status_code == 403
        r3 = signed("PATCH", f"/api/service/admin/admins/{admin_id}", json_body={"status": "disabled"}, bearer=admin_tok)
        assert r3.status_code == 403
        r4 = signed("DELETE", f"/api/service/admin/admins/{admin_id}", bearer=admin_tok)
        assert r4.status_code == 403

        # OWNER disables the admin -> its still-unexpired JWT is rejected immediately
        dis = signed("PATCH", f"/api/service/admin/admins/{admin_id}", json_body={"status": "disabled"}, bearer=owner_tok)
        assert dis.status_code == 200
        after = signed("GET", "/api/service/admin/me", bearer=admin_tok)
        assert after.status_code == 401

        # OWNER re-enables, then permanently revokes -> re-enabling after revoke is rejected
        signed("PATCH", f"/api/service/admin/admins/{admin_id}", json_body={"status": "active"}, bearer=owner_tok)
        rv = signed("DELETE", f"/api/service/admin/admins/{admin_id}", bearer=owner_tok)
        assert rv.status_code == 200
        reactivate = signed("PATCH", f"/api/service/admin/admins/{admin_id}", json_body={"status": "active"}, bearer=owner_tok)
        assert reactivate.status_code == 409

    def test_owner_cannot_revoke_self(self):
        owner_tok = owner_token()
        me = signed("GET", "/api/service/admin/me", bearer=owner_tok).json()["admin"]
        r = signed("DELETE", f"/api/service/admin/admins/{me['id']}", bearer=owner_tok)
        assert r.status_code == 409


class TestServiceAuthFailuresLogged:
    def test_failures_rejected_and_logged(self):
        owner_tok = owner_token()
        # missing credentials
        assert requests.get(f"{BASE_URL}/api/service/advertising/whoami", timeout=10).status_code == 401
        # unknown key
        assert signed("GET", "/api/service/advertising/whoami", key_id="totally-bogus").status_code == 401
        # bad signature
        h = _sign("GET", "/api/service/advertising/whoami")
        h["X-Signature"] = "0" * 64
        assert requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h, timeout=10).status_code == 401
        # stale timestamp
        old_ts = str(int(time.time()) - 9000)
        h2 = _sign("GET", "/api/service/advertising/whoami", ts=old_ts)
        assert requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h2, timeout=10).status_code == 401
        # replay
        h3 = _sign("GET", "/api/service/advertising/whoami")
        r1 = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h3, timeout=10)
        assert r1.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h3, timeout=10)
        assert r2.status_code == 401

        logs = signed("GET", "/api/service/admin/logs", query={"event_type": "service_auth_failure", "page_size": "50"},
                       bearer=owner_tok)
        assert logs.status_code == 200
        reasons = {e["detail"].get("reason") for e in logs.json()["logs"]}
        assert {"missing_credentials", "unknown_key", "bad_signature", "stale_timestamp", "replayed_nonce"} <= reasons
        # never any secret material in the log payload
        raw = json.dumps(logs.json())
        assert SECRET not in raw
        assert "X-Signature" not in raw


class TestTicketsAndLogs:
    def test_create_and_resolve_dp_ticket(self):
        owner_tok = owner_token()
        cr = signed("POST", "/api/service/admin/tickets",
                    json_body={"category": "operational_incident", "subject": "TEST_incident",
                               "description": "TEST description"}, bearer=owner_tok)
        assert cr.status_code == 200
        tid = cr.json()["ticket_id"]
        assert tid.startswith("dp_ticket:")

        lst = signed("GET", "/api/service/admin/tickets", query={"category": "operational_incident"}, bearer=owner_tok)
        assert lst.status_code == 200
        assert any(t["ticket_id"] == tid for t in lst.json()["tickets"])

        note = signed("POST", f"/api/service/admin/tickets/{tid}/note", json_body={"note": "TEST note"}, bearer=owner_tok)
        assert note.status_code == 200

        res = signed("POST", f"/api/service/admin/tickets/{tid}/resolve",
                     json_body={"resolution_reason": "TEST resolved"}, bearer=owner_tok)
        assert res.status_code == 200

        detail = signed("GET", f"/api/service/admin/tickets/{tid}", bearer=owner_tok)
        assert detail.status_code == 200
        d = detail.json()
        assert d["detail"]["status"] == "resolved"
        event_types = {e["event_type"] for e in d["events"]}
        assert {"ticket_created", "ticket_note", "ticket_resolved"} <= event_types

    def test_invalid_category_rejected(self):
        owner_tok = owner_token()
        r = signed("POST", "/api/service/admin/tickets",
                   json_body={"category": "not_a_real_category", "subject": "x"}, bearer=owner_tok)
        assert r.status_code == 422

    def test_report_ticket_resolve_extends_existing_collection_only(self):
        owner_tok = owner_token()
        # create a report via the PUBLIC leaderboard report endpoint (existing collection)
        reporter_id = "p" + secrets.token_hex(16)
        nickname = "TEST_TicketReport"
        rr = requests.post(f"{BASE_URL}/api/leaderboard/report",
                            json={"reporterId": reporter_id, "nickname": nickname, "reason": "TEST"}, timeout=10)
        assert rr.status_code == 200

        lst = signed("GET", "/api/service/admin/tickets", query={"category": "leaderboard_moderation", "page_size": "100"},
                     bearer=owner_tok)
        assert lst.status_code == 200
        match = [t for t in lst.json()["tickets"] if nickname in t["subject"]]
        assert match, "reported nickname did not surface as a leaderboard_moderation ticket"
        tid = match[0]["ticket_id"]
        assert tid.startswith("report:")

        res = signed("POST", f"/api/service/admin/tickets/{tid}/resolve",
                     json_body={"resolution_reason": "TEST no action needed"}, bearer=owner_tok)
        assert res.status_code == 200

    def test_no_intended_dp_ticket_duplication_of_ad_enquiries(self):
        owner_tok = owner_token()
        # dp_tickets collection must never contain ad_enquiry-sourced categories
        lst = signed("GET", "/api/service/admin/tickets",
                     query={"category": "advertising_enquiry", "page_size": "200"}, bearer=owner_tok)
        for t in lst.json()["tickets"]:
            assert t["source"] == "ad_enquiry"
