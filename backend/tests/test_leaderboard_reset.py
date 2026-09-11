"""Focused tests for the owner-only, one-time-ever pre-release leaderboard
reset operation: POST /api/service/admin/ops/leaderboard-reset.

Runs entirely against THIS environment's own isolated preview database (read
from backend/.env MONGO_URL/DB_NAME) — the exact same database every other
backend test file in this repo already writes synthetic fixtures into. NEVER
runs against the production URL/database (which is a fully separate
container/DB — see PRD.md — and not reachable from here at all).
"""
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import jwt
import pytest
import requests
from pymongo import MongoClient

sys.path.insert(0, "/app/backend")
from admin_auth import JWT_ALG  # noqa: E402
from leaderboard_reset import CONFIRM_TEXT, OP_NAME, TARGET_COLLECTIONS  # noqa: E402

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
MONGO_URL = ""
DB_NAME = ""
JWT_SECRET = ""
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("INTIES_SERVICE_KEY_ID="):
                KEY_ID = line.split("=", 1)[1].strip()
            elif line.startswith("INTIES_SERVICE_SECRET="):
                SECRET = line.split("=", 1)[1].strip()
            elif line.startswith("MONGO_URL="):
                MONGO_URL = line.split("=", 1)[1].strip()
            elif line.startswith("DB_NAME="):
                DB_NAME = line.split("=", 1)[1].strip()
            elif line.startswith("DP_ADMIN_JWT_SECRET="):
                JWT_SECRET = line.split("=", 1)[1].strip()
except Exception:
    pass

OWNER_EMAIL = "dp_test_owner@example.com"
OWNER_PASSWORD = "DpTestFixtureOwner_2026!"
ENDPOINT = "/api/service/admin/ops/leaderboard-reset"

# Collections the reset must NEVER touch. dp_events/service_nonces are handled
# separately (see below) because a signed HTTP call inherently appends to
# them itself — that's the pre-existing auth/audit layer, not this operation.
PROTECTED_STRICT = [
    "acceptances", "dp_admins", "dp_admin_setup_tokens",
    "admin_sessions", "ad_admin_audit", "ad_enquiries", "dp_tickets",
]


def mongo_db():
    return MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)[DB_NAME]


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


_owner_token_cache = {}


def owner_token():
    if "tok" not in _owner_token_cache:
        r = signed("POST", "/api/service/admin/login", json_body={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200, r.text
        _owner_token_cache["tok"] = r.json()["token"]
    return _owner_token_cache["tok"]


def owner_admin_id():
    doc = mongo_db().dp_admins.find_one({"email": OWNER_EMAIL})
    assert doc, "fixture owner missing — run test_admin_flow.py bootstrap first"
    return doc["id"]


def craft_jwt(admin_id, role, age_seconds):
    """Builds a token with the exact same shape create_admin_token() produces,
    but with a controllable `iat` — used ONLY to prove the freshness gate
    rejects an old-but-otherwise-valid token, without waiting for real time."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id, "role": role,
        "iat": int((now - timedelta(seconds=age_seconds)).timestamp()),
        "exp": now + timedelta(minutes=30),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def invite(email, role="admin"):
    r = signed("POST", "/api/service/admin/admins", json_body={"email": email, "role": role}, bearer=owner_token())
    assert r.status_code == 200, r.text
    return r.json()["setup_token"]


@pytest.fixture(scope="module", autouse=True)
def _clean_lock_before_module():
    """Ensures this test file is independently re-runnable against this
    isolated test DB (deletes only OUR OWN control-plane lock doc, never any
    of the 5 target/9 protected collections)."""
    mongo_db().dp_admin_ops_locks.delete_many({"op_name": OP_NAME})
    yield


class TestAuthAndConfirmationGates:
    def test_missing_jwt_returns_401(self):
        r = signed("POST", ENDPOINT, json_body={"confirm": CONFIRM_TEXT})
        assert r.status_code == 401

    def test_non_owner_admin_returns_403(self):
        email = f"dp_test_reset_nonowner_{secrets.token_hex(4)}@example.com"
        token = invite(email, role="admin")
        pw = f"ResetTestPass_{secrets.token_hex(6)}!"
        r = requests.post(f"{BASE_URL}/api/admin/setup-password", json={"token": token, "password": pw}, timeout=15)
        assert r.status_code == 200, r.text
        r2 = signed("POST", "/api/service/admin/login", json_body={"email": email, "password": pw})
        assert r2.status_code == 200, r2.text
        r3 = signed("POST", ENDPOINT, json_body={"confirm": CONFIRM_TEXT}, bearer=r2.json()["token"])
        assert r3.status_code == 403

    def test_stale_owner_jwt_rejected_401(self):
        """A JWT issued 400s ago (>5min) — otherwise perfectly valid owner
        role/status — must be rejected as not "recently reauthenticated"."""
        stale = craft_jwt(owner_admin_id(), "owner", age_seconds=400)
        r = signed("POST", ENDPOINT, json_body={"confirm": CONFIRM_TEXT}, bearer=stale)
        assert r.status_code == 401

    def test_missing_confirmation_rejected_400(self):
        r = signed("POST", ENDPOINT, json_body={}, bearer=owner_token())
        assert r.status_code == 400

    def test_wrong_confirmation_rejected_400(self):
        r = signed("POST", ENDPOINT, json_body={"confirm": "reset drunk pigeons leaderboard"}, bearer=owner_token())
        assert r.status_code == 400

    def test_rejected_calls_never_consume_the_one_time_lock(self):
        """None of the above failing calls should have claimed the lock —
        confirmed by the lock collection still being empty for this op_name."""
        assert mongo_db().dp_admin_ops_locks.count_documents({"op_name": OP_NAME}) == 0


class TestSuccessfulResetAndOneTimeGuarantee:
    def test_full_reset_flow_and_repeat_rejection(self):
        db = mongo_db()
        marker = secrets.token_hex(6)

        # Seed one synthetic fixture doc into each of the 5 target collections.
        for name in TARGET_COLLECTIONS:
            db[name].insert_one({"id": f"reset_test_{marker}_{name}", "_reset_test_fixture": True})

        before_strict = {name: list(db[name].find({})) for name in PROTECTED_STRICT}
        before_events = list(db.dp_events.find({}))
        before_nonces_count = db.service_nonces.count_documents({})

        r = signed("POST", ENDPOINT, json_body={"confirm": CONFIRM_TEXT}, bearer=owner_token())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert set(body["deleted"].keys()) == set(TARGET_COLLECTIONS)
        assert body["total_deleted"] == sum(body["deleted"].values())
        for name in TARGET_COLLECTIONS:
            assert body["deleted"][name] >= 1, f"{name} fixture doc was not counted"
        raw = json.dumps(body)
        for bad in ("password", "password_hash", SECRET):
            assert bad not in raw

        # 1) Target collections are EMPTY but still exist, with indexes intact.
        existing = db.list_collection_names()
        for name in TARGET_COLLECTIONS:
            assert name in existing, f"{name} collection was dropped — must only be emptied"
            assert db[name].count_documents({}) == 0
        assert any(ix["key"] == {"runId": 1} for ix in db.runs.list_indexes())
        assert any(ix["key"] == {"playerId": 1} for ix in db.players.list_indexes())

        # 2) Strictly-protected collections are byte-for-byte/doc-for-doc unchanged.
        after_strict = {name: list(db[name].find({})) for name in PROTECTED_STRICT}
        for name in PROTECTED_STRICT:
            assert before_strict[name] == after_strict[name], f"{name} was modified by the reset"

        # 3) dp_events: every pre-existing doc is untouched, exactly one new
        # audit event was appended, with counts only (never secrets/full docs).
        after_events = list(db.dp_events.find({}))
        before_ids = {e["id"] for e in before_events}
        after_ids = {e["id"] for e in after_events}
        assert before_ids.issubset(after_ids)
        new_ids = after_ids - before_ids
        assert len(new_ids) == 1
        new_event = next(e for e in after_events if e["id"] in new_ids)
        assert new_event["event_type"] == "dp_leaderboard_reset"
        assert new_event["detail"]["deleted"] == body["deleted"]
        assert new_event["detail"]["total_deleted"] == body["total_deleted"]
        ev_raw = json.dumps(new_event, default=str)
        for bad in ("password", "password_hash", SECRET):
            assert bad not in ev_raw

        # 4) service_nonces only grew by the single request this test itself
        # made (the pre-existing auth/replay layer, not this operation).
        assert db.service_nonces.count_documents({}) == before_nonces_count + 1

        # 5) One-use marker is set; a second call is rejected outright.
        r2 = signed("POST", ENDPOINT, json_body={"confirm": CONFIRM_TEXT}, bearer=owner_token())
        assert r2.status_code == 409, r2.text
        assert db.dp_admin_ops_locks.count_documents({"op_name": OP_NAME}) == 1
