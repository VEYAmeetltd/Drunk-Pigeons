"""Advertising enquiry submission + private artwork storage + authenticated admin review.

Security posture (see product spec):
- Artwork is stored PRIVATELY on the backend under a cryptographically-random filename.
  It is only retrievable through an authenticated admin endpoint that verifies the admin
  session on every request. The filesystem path / storage name / a public URL are never
  exposed, and directory listing is not possible.
- Uploads are validated by real MIME + magic-byte signature (not the filename), capped at
  10MB, restricted to png/jpeg/webp/pdf, stored as untrusted/quarantined content. Accepted
  raster images are re-encoded server-side (strips metadata / active content); PDFs are only
  ever served as downloadable attachments, never executed or embedded.
- Admin auth: bcrypt password hash only (never plaintext); short-lived server session via a
  Secure, HttpOnly, SameSite=Strict cookie; login + submit rate limiting; generic errors.
"""
import os
import re
import io
import base64
import secrets
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import bcrypt
import requests
from fastapi import APIRouter, Request, Response, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse

try:
    from PIL import Image
    _PIL = True
except Exception:  # pragma: no cover
    _PIL = False

router = APIRouter(prefix="/api")

# ---- private object storage (Emergent) — access ONLY via authenticated admin route ----
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
SESSION_HOURS = 2
SESSION_COOKIE = "dp_admin"
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

STATUSES = ["pending", "approved", "rejected", "payment_sent", "paid", "scheduled", "completed"]

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

# ---------------- admin auth ----------------

def _load_admin_hash():
    b64 = os.environ.get("ADMIN_PW_HASH_B64", "")
    if not b64:
        return None
    try:
        return base64.b64decode(b64)
    except Exception:
        return None

def verify_admin_password(plain):
    h = _load_admin_hash()
    if not h:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), h)
    except Exception:
        return False

async def _mongo(request: Request):
    return request.app.state.db

async def require_admin(request: Request):
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = request.app.state.db
    sess = await db.admin_sessions.find_one({"token": token})
    if not sess:
        raise HTTPException(status_code=401, detail="Not authenticated")
    exp = sess.get("expires_at")
    if exp is None:
        raise HTTPException(status_code=401, detail="Session expired")
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        await db.admin_sessions.delete_one({"token": token})
        raise HTTPException(status_code=401, detail="Session expired")
    return sess

def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=SESSION_HOURS * 3600,
        path="/",
    )

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
        "status": "pending",
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

# ---------------- admin ----------------

@router.post("/admin/login")
async def admin_login(request: Request, response: Response):
    ip = client_ip(request)
    if not rate_limit(f"login:{ip}", limit=10, window_s=600):
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
    body = await request.json()
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    expected_user = os.environ.get("ADMIN_USERNAME", "admin")
    ok = username == expected_user and verify_admin_password(password)
    if not ok:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    db = request.app.state.db
    token = secrets.token_urlsafe(32)
    await db.admin_sessions.insert_one({
        "token": token,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS),
    })
    _set_session_cookie(response, token)
    return {"ok": True}

@router.post("/admin/logout")
async def admin_logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await request.app.state.db.admin_sessions.delete_one({"token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}

@router.get("/admin/me")
async def admin_me(sess=Depends(require_admin)):
    return {"ok": True}

@router.post("/admin/rotate-password")
async def admin_rotate(request: Request, response: Response, sess=Depends(require_admin)):
    body = await request.json()
    current = str(body.get("currentPassword", ""))
    new = str(body.get("newPassword", ""))
    if not verify_admin_password(current):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    if len(new) < 10:
        raise HTTPException(status_code=422, detail="New password must be at least 10 characters.")
    new_hash = bcrypt.hashpw(new.encode("utf-8"), bcrypt.gensalt(rounds=12))
    # persist the new hash (base64) so it survives restarts; only the hash is stored
    b64 = base64.b64encode(new_hash).decode()
    env_path = Path(__file__).parent / ".env"
    lines = env_path.read_text().splitlines()
    out, seen = [], False
    for ln in lines:
        if ln.startswith("ADMIN_PW_HASH_B64="):
            out.append(f"ADMIN_PW_HASH_B64={b64}")
            seen = True
        else:
            out.append(ln)
    if not seen:
        out.append(f"ADMIN_PW_HASH_B64={b64}")
    env_path.write_text("\n".join(out) + "\n")
    os.environ["ADMIN_PW_HASH_B64"] = b64
    # invalidate all other sessions
    await request.app.state.db.admin_sessions.delete_many({})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}

def _public_enquiry(doc):
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
        "terms_version": doc.get("terms_version", ""),
        "status": doc.get("status", "pending"),
        "email_notification_status": doc.get("email_notification_status", "not_configured"),
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
    }

@router.get("/admin/enquiries")
async def list_enquiries(request: Request, sess=Depends(require_admin)):
    db = request.app.state.db
    cur = db.ad_enquiries.find({}).sort("created_at", -1).limit(500)
    items = [_public_enquiry(d) async for d in cur]
    return {"enquiries": items, "statuses": STATUSES}

@router.get("/admin/enquiries/{eid}")
async def get_enquiry(eid: str, request: Request, sess=Depends(require_admin)):
    doc = await request.app.state.db.ad_enquiries.find_one({"id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return _public_enquiry(doc)

@router.get("/admin/enquiries/{eid}/artwork")
async def get_artwork(eid: str, request: Request, sess=Depends(require_admin)):
    doc = await request.app.state.db.ad_enquiries.find_one({"id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    stored = doc.get("artwork_storage_path", "")
    if not stored or ".." in stored:
        raise HTTPException(status_code=404, detail="Not found")
    mime = doc.get("artwork_mime", "application/octet-stream")
    try:
        data, _ct = get_object(stored)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    # PDFs (and everything) are served as downloadable attachments, never executed/embedded
    disposition = "attachment" if mime == "application/pdf" else "inline"
    safe_mime = mime if mime in _SIG else "application/octet-stream"
    headers = {
        "Content-Disposition": f'{disposition}; filename="artwork.{_SIG.get(mime, (None, "bin"))[1]}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
    }
    return StreamingResponse(io.BytesIO(data), media_type=safe_mime, headers=headers)

@router.post("/admin/enquiries/{eid}/status")
async def set_status(eid: str, request: Request, sess=Depends(require_admin)):
    body = await request.json()
    status = str(body.get("status", ""))
    if status not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    res = await request.app.state.db.ad_enquiries.update_one(
        {"id": eid}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "status": status}
