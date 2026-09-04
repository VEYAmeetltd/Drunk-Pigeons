"""End-to-end tests for the INTIES server-to-server integration API and public advertising flow.

Covers:
- HMAC signing: happy path (whoami), missing headers, tampered signature, stale timestamp, replay
- Public /api/advertise/submit + /api/advertise/packages
- Service enquiry list/detail/pagination/filter
- Workflow status transitions (valid + invalid)
- Moderation actions (clear / spam / explicit_abuse / suspected_illegal)
- Artwork streaming + 403 after suspected_illegal
- Audit trail
- No admin route/leak (frontend/backend)
"""
import hashlib
import hmac
import io
import json
import os
import secrets
import time
from urllib.parse import urlencode

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

# Read service creds from backend .env
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


def _sign(method, path, query=None, body=b"", ts=None, nonce=None):
    ts = ts or str(int(time.time()))
    nonce = nonce or secrets.token_hex(16)
    q = urlencode(sorted(query.items())) if query else ""
    target = f"{path}?{q}" if q else path
    body_hash = hashlib.sha256(body or b"").hexdigest()
    canonical = f"{method}\n{target}\n{body_hash}\n{ts}\n{nonce}"
    sig = hmac.new(SECRET.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return {
        "X-Service-Key": KEY_ID,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
        "X-Signature": sig,
    }


def signed_request(method, path, query=None, json_body=None):
    body = json.dumps(json_body).encode() if json_body is not None else b""
    headers = _sign(method, path, query=query, body=body)
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    url = BASE_URL + path
    return requests.request(method, url, headers=headers, params=query,
                            data=body if json_body is not None else None, timeout=20)


# ---------- 1x1 PNG for artwork upload ----------
PNG_1x1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a73"
    "0000001649444154789c63fccfc0c0c0c0c0c4c0c0c0c0c000000d1d01036ac29be90000000049454e44ae426082"
)


# ============ SANITY ============

class TestSanity:
    def test_backend_url_configured(self):
        assert BASE_URL, "REACT_APP_BACKEND_URL not set"

    def test_service_creds_present(self):
        assert KEY_ID and SECRET, "Service creds missing in /app/backend/.env"

    def test_health_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        # root /api/ may or may not exist; just check backend reachable via a public route
        r2 = requests.get(f"{BASE_URL}/api/advertise/packages", timeout=10)
        assert r2.status_code == 200


# ============ PUBLIC ADVERTISE FLOW (regression) ============

class TestPublicAdvertise:
    def test_packages_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/advertise/packages", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "packages" in data
        assert isinstance(data["packages"], list) and len(data["packages"]) > 0
        assert "termsVersion" in data

    def test_no_admin_login_endpoint(self):
        # legacy admin login endpoints should not exist
        for path in ["/api/admin/login", "/api/advertise/admin/login", "/api/admin/session"]:
            r = requests.post(f"{BASE_URL}{path}",
                              json={"username": "x", "password": "x"}, timeout=10)
            assert r.status_code in (404, 405), f"Admin route {path} still exists: {r.status_code}"

    def test_submit_enquiry_happy_path(self, submitted_enquiry_id):
        assert submitted_enquiry_id


@pytest.fixture(scope="module")
def submitted_enquiry_id():
    # Submit a real enquiry to be reused across service tests
    files = {"artwork": ("test.png", PNG_1x1, "image/png")}
    pkg_r = requests.get(f"{BASE_URL}/api/advertise/packages", timeout=10)
    pkg = pkg_r.json()["packages"][0]["id"]
    data = {
        "name": "TEST_Pigeon",
        "email": "test_pigeon@example.com",
        "package": pkg,
        "acceptTerms": "true",
        "business": "TEST_Biz",
        "message": "TEST_msg",
    }
    r = requests.post(f"{BASE_URL}/api/advertise/submit", data=data, files=files, timeout=30)
    assert r.status_code == 200, f"submit failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("ok") is True
    assert "id" in body
    # 'status' field should not be surfaced (only ok/id/email_notification_status)
    assert "status" not in body or body.get("status") is None
    return body["id"]


# ============ HMAC AUTH ============

class TestHmacAuth:
    def test_whoami_signed_ok(self):
        r = signed_request("GET", "/api/service/advertising/whoami")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_no_headers_401(self):
        r = requests.get(f"{BASE_URL}/api/service/advertising/whoami", timeout=10)
        assert r.status_code == 401

    def test_missing_nonce_401(self):
        h = _sign("GET", "/api/service/advertising/whoami")
        del h["X-Nonce"]
        r = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h, timeout=10)
        assert r.status_code == 401

    def test_bad_signature_401(self):
        h = _sign("GET", "/api/service/advertising/whoami")
        h["X-Signature"] = "0" * 64
        r = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h, timeout=10)
        assert r.status_code == 401

    def test_stale_timestamp_401(self):
        old_ts = str(int(time.time()) - 900)
        h = _sign("GET", "/api/service/advertising/whoami", ts=old_ts)
        r = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h, timeout=10)
        assert r.status_code == 401

    def test_replay_rejected(self):
        h = _sign("GET", "/api/service/advertising/whoami")
        r1 = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h, timeout=10)
        assert r1.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/service/advertising/whoami", headers=h, timeout=10)
        assert r2.status_code == 401  # replay


# ============ LIST / DETAIL / FILTER ============

class TestListDetail:
    def test_list_enquiries(self, submitted_enquiry_id):
        r = signed_request("GET", "/api/service/advertising/enquiries", query={"limit": "10", "offset": "0"})
        assert r.status_code == 200
        data = r.json()
        assert "enquiries" in data
        assert "total" in data
        assert data["limit"] == 10
        assert data["offset"] == 0
        assert any(e["id"] == submitted_enquiry_id for e in data["enquiries"])

    def test_list_filter_workflow_status(self):
        r = signed_request("GET", "/api/service/advertising/enquiries",
                           query={"workflow_status": "pending", "limit": "5"})
        assert r.status_code == 200
        for e in r.json()["enquiries"]:
            assert e["workflow_status"] == "pending"

    def test_list_invalid_filter_422(self):
        r = signed_request("GET", "/api/service/advertising/enquiries",
                           query={"workflow_status": "bogus"})
        assert r.status_code == 422

    def test_detail_no_storage_path_leak(self, submitted_enquiry_id):
        r = signed_request("GET", f"/api/service/advertising/enquiries/{submitted_enquiry_id}")
        assert r.status_code == 200
        enq = r.json()["enquiry"]
        # Must NOT leak internal storage paths
        raw = json.dumps(enq)
        assert "artwork_storage_path" not in raw
        assert "storage_path" not in raw
        # Required fields
        for k in ("workflow_status", "moderation_status", "artwork_restricted",
                  "rejection_reason", "moderated_at", "moderated_by", "escalation_reference"):
            assert k in enq, f"missing field {k}"


# ============ WORKFLOW STATUS TRANSITIONS ============

class TestWorkflow:
    def test_invalid_transition_409(self, submitted_enquiry_id):
        # pending -> paid is illegal
        r = signed_request("POST", f"/api/service/advertising/enquiries/{submitted_enquiry_id}/status",
                           json_body={"status": "paid", "note": "illegal jump"})
        assert r.status_code == 409

    def test_valid_transitions(self):
        # Create a fresh enquiry for a clean workflow walk
        files = {"artwork": ("t.png", PNG_1x1, "image/png")}
        pkg = requests.get(f"{BASE_URL}/api/advertise/packages").json()["packages"][0]["id"]
        r = requests.post(f"{BASE_URL}/api/advertise/submit", files=files,
                          data={"name": "TEST_Flow", "email": "flow@ex.com",
                                "package": pkg, "acceptTerms": "true"}, timeout=30)
        assert r.status_code == 200
        eid = r.json()["id"]
        for step in ["approved", "payment_sent", "paid", "scheduled", "completed"]:
            rr = signed_request("POST", f"/api/service/advertising/enquiries/{eid}/status",
                                json_body={"status": step})
            assert rr.status_code == 200, f"transition to {step} failed: {rr.status_code} {rr.text}"
            assert rr.json()["workflow_status"] == step
        # After completed, further transition rejected
        rr = signed_request("POST", f"/api/service/advertising/enquiries/{eid}/status",
                            json_body={"status": "approved"})
        assert rr.status_code == 409


# ============ MODERATION ============

@pytest.fixture
def fresh_enquiry():
    files = {"artwork": ("t.png", PNG_1x1, "image/png")}
    pkg = requests.get(f"{BASE_URL}/api/advertise/packages").json()["packages"][0]["id"]
    r = requests.post(f"{BASE_URL}/api/advertise/submit", files=files,
                      data={"name": "TEST_M", "email": "mod@ex.com", "package": pkg,
                            "acceptTerms": "true"}, timeout=30)
    assert r.status_code == 200
    return r.json()["id"]


class TestModeration:
    def test_moderate_clear_only_changes_moderation(self, fresh_enquiry):
        r = signed_request("POST", f"/api/service/advertising/enquiries/{fresh_enquiry}/moderate",
                           json_body={"action": "clear", "note": "looks fine"})
        assert r.status_code == 200
        data = r.json()
        assert data["moderation_status"] == "cleared"
        # workflow_status must NOT be forced to rejected
        assert data["workflow_status"] != "rejected"

    def test_moderate_spam_forces_rejected(self, fresh_enquiry):
        r = signed_request("POST", f"/api/service/advertising/enquiries/{fresh_enquiry}/moderate",
                           json_body={"action": "spam", "note": "spam"})
        assert r.status_code == 200
        d = r.json()
        assert d["moderation_status"] == "spam"
        assert d["workflow_status"] == "rejected"

    def test_moderate_suspected_illegal_restricts_artwork(self, fresh_enquiry):
        r = signed_request("POST", f"/api/service/advertising/enquiries/{fresh_enquiry}/moderate",
                           json_body={"action": "suspected_illegal", "note": "illegal"})
        assert r.status_code == 200
        d = r.json()
        assert d["moderation_status"] == "suspected_illegal"
        assert d["workflow_status"] == "rejected"
        assert d["artwork_restricted"] is True
        assert d["escalation_reference"]
        # subsequent artwork fetch must be 403
        rr = signed_request("GET", f"/api/service/advertising/enquiries/{fresh_enquiry}/artwork")
        assert rr.status_code == 403

    def test_moderate_invalid_action_422(self, fresh_enquiry):
        r = signed_request("POST", f"/api/service/advertising/enquiries/{fresh_enquiry}/moderate",
                           json_body={"action": "bogus"})
        assert r.status_code == 422


# ============ ARTWORK ============

class TestArtwork:
    def test_artwork_stream_ok(self, submitted_enquiry_id):
        r = signed_request("GET", f"/api/service/advertising/enquiries/{submitted_enquiry_id}/artwork")
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("image/")
        assert "Content-Disposition" in r.headers
        assert len(r.content) > 0


# ============ AUDIT ============

class TestAudit:
    def test_audit_trail_has_entries(self, submitted_enquiry_id):
        # Perform a moderate:clear so we know there's at least one audit
        signed_request("POST", f"/api/service/advertising/enquiries/{submitted_enquiry_id}/moderate",
                       json_body={"action": "clear", "note": "audit test"})
        r = signed_request("GET", f"/api/service/advertising/enquiries/{submitted_enquiry_id}/audit")
        assert r.status_code == 200
        items = r.json()["audit"]
        assert isinstance(items, list) and len(items) >= 1
        e = items[0]
        for k in ("actor", "action", "from_workflow_status", "to_workflow_status",
                  "from_moderation_status", "to_moderation_status", "at"):
            assert k in e


# ============ RATE LIMIT ============

class TestRateLimit:
    def test_rate_limit_triggers(self):
        # Fire 130 signed whoami requests quickly; expect at least one 429.
        seen_429 = False
        for _ in range(140):
            r = signed_request("GET", "/api/service/advertising/whoami")
            if r.status_code == 429:
                seen_429 = True
                break
        assert seen_429, "Rate limit never triggered within 140 signed requests"
