"""Advertising enquiry submission + private artwork storage.

Security posture (see product spec):
- Artwork is stored PRIVATELY on the backend under a cryptographically-random filename.
  It is only retrievable through the protected server-to-server integration API
  (see service_advertising.py). The filesystem path / storage name / a public URL are
  never exposed, and directory listing is not possible.
- Uploads are validated by real MIME + magic-byte signature (not the filename), capped at
  10MB, restricted to png/jpeg/webp/pdf, stored as untrusted/quarantined content. Accepted
  raster images are re-encoded server-side (strips metadata / active content); PDFs are only
  ever served as downloadable attachments, never executed or embedded.
- There is no human-facing admin login in this service. All enquiry review/moderation
  happens through the authenticated backend-to-backend integration API consumed by the
  INTIES Admin Dashboard (service_advertising.py), never exposed to ordinary users.
"""
import os
import re
import io
import secrets
import time
from datetime import datetime, timezone

import requests
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse

try:
    from PIL import Image
    _PIL = True
except Exception:  # pragma: no cover
    _PIL = False

router = APIRouter(prefix="/api")

# ---- private object storage (Emergent) — access ONLY via the protected integration API ----
APP_NAME = "drunk-pigeons"
_STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = _STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key = None

def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def put_object(path, data, content_type):
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

MAX_BYTES = 10 * 1024 * 1024  # 10MB
TERMS_VERSION = "1.0"

# Single source of truth for advertising packages (id -> spec).
PACKAGES = {
    "test-flight": {"id": "test-flight", "name": "TEST FLIGHT", "scope": "One map", "days": 7, "price": "£25"},
    "city-run": {"id": "city-run", "name": "CITY RUN", "scope": "All maps", "days": 14, "price": "£50"},
    "full-pigeon": {"id": "full-pigeon", "name": "FULL PIGEON", "scope": "All maps", "days": 30, "price": "£90"},
    "exclusive-14": {"id": "exclusive-14", "name": "EXCLUSIVE PIGEON", "scope": "Exclusive paid sponsor across all maps", "days": 14, "price": "£250"},
    "exclusive-30": {"id": "exclusive-30", "name": "EXCLUSIVE PIGEON", "scope": "Exclusive paid sponsor across all maps", "days": 30, "price": "£500"},
}
PACKAGE_ORDER = ["test-flight", "city-run", "full-pigeon", "exclusive-14", "exclusive-30"]

# Two independent state fields (see service_advertising.py for the moderation API):
#  workflow_status  — campaign lifecycle progression.
#  moderation_status — WHY an enquiry was rejected, if it was (kept separate so campaign
#                       progression never gets tangled up with moderation reasoning).
WORKFLOW_STATUSES = ["pending", "approved", "rejected", "payment_sent", "paid", "scheduled", "completed"]
MODERATION_STATUSES = ["unreviewed", "cleared", "spam", "explicit_abuse", "suspected_illegal"]
# Legal server-side workflow transitions. Enforced by service_advertising.set_status;
# the moderation endpoint may force straight to "rejected" from any non-terminal state.
WORKFLOW_TRANSITIONS = {
    "pending": {"approved", "rejected"},
    "approved": {"payment_sent", "rejected"},
    "payment_sent": {"paid", "rejected"},
    "paid": {"scheduled"},
    "scheduled": {"completed"},
    "rejected": set(),
    "completed": set(),
}

# accepted type -> (list of magic-byte checks, canonical extension)
_SIG = {
    "image/png": (lambda b: b[:8] == b"\x89PNG\r\n\x1a\n", "png"),
    "image/jpeg": (lambda b: b[:3] == b"\xff\xd8\xff", "jpg"),
    "image/webp": (lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP", "webp"),
    "application/pdf": (lambda b: b[:5] == b"%PDF-", "pdf"),
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ---------------- text sanitising ----------------

def sanitize(text, maxlen):
    if not text:
        return ""
    t = str(text).replace("\x00", "")
    t = "".join(ch for ch in t if ch == "\n" or ch == "\t" or ord(ch) >= 32)
    t = t.strip()
    return t[:maxlen]

# ---------------- lightweight in-memory rate limiter ----------------
_hits = {}

def rate_limit(key, limit, window_s):
    now = time.time()
    bucket = _hits.setdefault(key, [])
    cutoff = now - window_s
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True

def client_ip(request: Request):
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

# ---------------- public: packages ----------------

@router.get("/advertise/packages")
async def get_packages():
    return {"packages": [PACKAGES[p] for p in PACKAGE_ORDER], "termsVersion": TERMS_VERSION}

# ---------------- public: submit enquiry ----------------

@router.post("/advertise/submit")
async def submit_enquiry(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    package: str = Form(...),
    acceptTerms: str = Form(...),
    business: str = Form(""),
    message: str = Form(""),
    artwork: UploadFile = File(...),
):
    ip = client_ip(request)
    if not rate_limit(f"submit:{ip}", limit=8, window_s=3600):
        raise HTTPException(status_code=429, detail="Too many enquiries from this connection. Please try again later.")

    name = sanitize(name, 120)
    email = sanitize(email, 200).lower()
    business = sanitize(business, 160)
    message = sanitize(message, 2000)

    if not name:
        raise HTTPException(status_code=422, detail="Name is required.")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="That email doesn't look ready for take-off.")
    if package not in PACKAGES:
        raise HTTPException(status_code=422, detail="Choose where your advert should fly.")
    if str(acceptTerms).lower() not in ("1", "true", "yes", "on"):
        raise HTTPException(status_code=422, detail="Please accept the Advertising Booking Terms.")

    # read at most MAX_BYTES + 1 to detect oversize without buffering unbounded memory
    raw = await artwork.read(MAX_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=422, detail="Your pigeon needs some artwork.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="That file is carrying too much baggage. Maximum size: 10MB.")

    # validate by magic bytes; the declared content-type must also be allowed and must match
    declared = (artwork.content_type or "").split(";")[0].strip().lower()
    detected = None
    for mime, (check, _ext) in _SIG.items():
        if check(raw):
            detected = mime
            break
    if detected is None or (declared and declared in _SIG and declared != detected):
        raise HTTPException(status_code=415, detail="This pigeon only carries PNG, JPG, WEBP or PDF files.")

    ext = _SIG[detected][1]
    stored_key = f"{APP_NAME}/ad-artwork/{secrets.token_hex(20)}.{ext}"

    stored_bytes = raw
    final_mime = detected
    # re-encode raster images to strip metadata / neutralise embedded active content
    if detected in ("image/png", "image/jpeg", "image/webp") and _PIL:
        try:
            img = Image.open(io.BytesIO(raw))
            img.load()
            out = io.BytesIO()
            if detected == "image/png":
                img.convert("RGBA").save(out, format="PNG")
            elif detected == "image/webp":
                img.save(out, format="WEBP")
            else:
                img.convert("RGB").save(out, format="JPEG", quality=90)
            stored_bytes = out.getvalue()
        except Exception:
            raise HTTPException(status_code=415, detail="This pigeon only carries PNG, JPG, WEBP or PDF files.")

    # store privately in object storage (never a public URL); DB keeps only the key
    try:
        result = put_object(stored_key, stored_bytes, final_mime)
        stored_key = result.get("path", stored_key)
    except Exception:
        raise HTTPException(status_code=502, detail="That pigeon didn't make it. Your enquiry has not been submitted — please try again.")

    db = request.app.state.db
    now = datetime.now(timezone.utc)
    doc = {
        "id": secrets.token_hex(12),
        "name": name,
        "email": email,
        "business": business,
        "package": package,
        "packageLabel": f"{PACKAGES[package]['name']} · {PACKAGES[package]['scope']} · {PACKAGES[package]['days']} days · {PACKAGES[package]['price']}",
        "message": message,
        "artwork_storage_path": stored_key,   # internal object key, never returned to clients
        "artwork_original_name": sanitize(artwork.filename, 200),
        "artwork_mime": final_mime,
        "artwork_size": len(stored_bytes),
        "terms_version": TERMS_VERSION,
        "terms_accepted_at": now,
        "workflow_status": "pending",
        "moderation_status": "unreviewed",
        "rejection_reason": None,
        "moderated_at": None,
        "moderated_by": None,
        "escalation_reference": None,
        "artwork_restricted": False,
        "artwork_deleted_at": None,
        "email_notification_status": "not_configured",
        "created_at": now,
        "ip": ip,
    }
    await db.ad_enquiries.insert_one(doc)

    # isolated notification hook — real email (Resend) can be wired here later without
    # changing this flow. It must never expose a public artwork URL.
    try:
        from notify import notify_enquiry  # local, optional
        notify_enquiry(doc)
    except Exception:
        pass

    return {"ok": True, "id": doc["id"], "email_notification_status": doc["email_notification_status"]}

# ---------------- shared serialisation (used by the protected integration API too) ----------------

def public_enquiry(doc):
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc["email"],
        "business": doc.get("business", ""),
        "package": doc["package"],
        "packageLabel": doc.get("packageLabel", ""),
        "message": doc.get("message", ""),
        "artwork_original_name": doc.get("artwork_original_name", ""),
        "artwork_mime": doc.get("artwork_mime", ""),
        "artwork_size": doc.get("artwork_size", 0),
        "artwork_restricted": bool(doc.get("artwork_restricted", False)),
        "terms_version": doc.get("terms_version", ""),
        "workflow_status": doc.get("workflow_status", "pending"),
        "moderation_status": doc.get("moderation_status", "unreviewed"),
        "rejection_reason": doc.get("rejection_reason"),
        "moderated_at": doc.get("moderated_at").isoformat() if doc.get("moderated_at") else None,
        "moderated_by": doc.get("moderated_by"),
        "escalation_reference": doc.get("escalation_reference"),
        "email_notification_status": doc.get("email_notification_status", "not_configured"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }

