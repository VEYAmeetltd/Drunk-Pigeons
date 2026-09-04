"""DP-owned admin identity: bcrypt password hashing + short-lived JWT sessions.

Completely separate from:
  - the INTIES service-to-service HMAC credential (service_auth.py) — that proves
    "this call came from the trusted INTIES backend", not WHICH DP admin it's for;
  - any INTIES account/permission system — INTIES permissions never grant DP
    permissions, and vice versa (see docs/INTIES_DRUNK_PIGEONS_INTEGRATION_CONTRACT.md).

Roles: 'admin' (tickets/logs/moderation) and 'owner' (all of that + manage DP admins).

Every authenticated request re-loads the admin record from MongoDB and re-checks
status == 'active' (see require_dp_admin) — a valid JWT signature/expiry is never
sufficient on its own, so disabling/revoking an admin takes effect immediately even
if their token has not expired yet.

No admin (including the initial DP OWNER) is ever given a default/shared password.
New admins are INVITED: a single-use setup token is generated, only its SHA-256 hash
is stored, and it expires after SETUP_TOKEN_TTL_H hours. The plaintext token is never
logged and never written to the dp_events audit trail — it is returned exactly once
(bootstrap: printed to the backend startup console for manual dev retrieval; for
admins added later, returned once in the OWNER's own add-admin API response).
"""
import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Request, HTTPException, Header, APIRouter

from admin_events import log_event
from advertising import rate_limit, client_ip

JWT_ALG = "HS256"
JWT_TTL_MIN = 30
SETUP_TOKEN_TTL_H = 24
ROLE_RANK = {"admin": 1, "owner": 2}
VALID_ROLES = set(ROLE_RANK)

router = APIRouter(prefix="/api/admin", tags=["dp-admin-bootstrap"])


def _jwt_secret():
    secret = os.environ.get("DP_ADMIN_JWT_SECRET", "")
    if not secret:
        raise RuntimeError("DP_ADMIN_JWT_SECRET not configured")
    return secret


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_admin_token(admin_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id, "role": role,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(minutes=JWT_TTL_MIN),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALG)


def decode_admin_token(token: str):
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None


def public_admin(doc):
    return {
        "id": doc["id"], "email": doc["email"], "role": doc["role"], "status": doc["status"],
        "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        "created_by": doc.get("created_by"),
        "revoked_at": doc.get("revoked_at").isoformat() if doc.get("revoked_at") else None,
        "revoked_by": doc.get("revoked_by"),
    }


async def invite_admin(db, email, role, created_by):
    """Create an 'invited' DP admin + single-use setup token. Returns
    ((admin_id, plaintext_token), None) on success, or (None, 'exists'/'invalid_role')."""
    if role not in VALID_ROLES:
        return None, "invalid_role"
    email = (email or "").strip().lower()
    if await db.dp_admins.find_one({"email": email}):
        return None, "exists"
    now = datetime.now(timezone.utc)
    admin_id = secrets.token_hex(12)
    await db.dp_admins.insert_one({
        "id": admin_id, "email": email, "role": role, "status": "invited",
        "password_hash": None, "created_at": now, "created_by": created_by,
        "revoked_at": None, "revoked_by": None,
    })
    token = secrets.token_urlsafe(32)
    await db.dp_admin_setup_tokens.insert_one({
        "token_hash": hash_token(token), "admin_id": admin_id,
        "created_at": now, "expires_at": now + timedelta(hours=SETUP_TOKEN_TTL_H),
        "used": False,
    })
    await log_event(db, "dp_admin_invited", actor=created_by, target=admin_id,
                     detail={"email": email, "role": role})
    return (admin_id, token), None


async def seed_dp_owner(db, email: str):
    """Idempotent — only ever fires the very first time (no dp_admins doc exists yet)."""
    if not email:
        return
    if await db.dp_admins.find_one({}):
        return
    result, err = await invite_admin(db, email, "owner", created_by="bootstrap")
    if err:
        return
    admin_id, token = result
    # ONE-TIME dev-bootstrap console exposure only — never repeated, never persisted in
    # plaintext, never part of the structured dp_events audit trail (that entry has no
    # token; see invite_admin's log_event call above).
    print("=" * 72)
    print(f"[DP ADMIN BOOTSTRAP] one-time setup token for DP OWNER {email}:")
    print(token)
    print(f"Expires in {SETUP_TOKEN_TTL_H}h. Complete setup with:")
    print(f'  POST /api/admin/setup-password  {{"token": "{token}", "password": "<new password>"}}')
    print("=" * 72)


async def do_login(db, request: Request, email: str, password: str):
    ip = client_ip(request)
    email = (email or "").strip().lower()
    if not rate_limit(f"admlogin:{ip}:{email}", limit=8, window_s=900):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    admin = await db.dp_admins.find_one({"email": email})
    if not admin or admin.get("status") != "active" or not verify_password(password, admin.get("password_hash")):
        await log_event(db, "dp_admin_login_failed", actor=(f"admin:{admin['id']}" if admin else "anonymous"),
                         detail={"email": email}, ip=ip)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_admin_token(admin["id"], admin["role"])
    await log_event(db, "dp_admin_login_success", actor=f"admin:{admin['id']}", ip=ip)
    return {"ok": True, "token": token, "expires_in_minutes": JWT_TTL_MIN, "admin": public_admin(admin)}


def require_dp_admin(min_role: str = "admin"):
    async def _dep(request: Request, authorization: str | None = Header(default=None)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        payload = decode_admin_token(authorization[7:])
        if not payload:
            raise HTTPException(status_code=401, detail="Not authenticated")
        db = request.app.state.db
        admin = await db.dp_admins.find_one({"id": payload.get("sub")})
        if not admin or admin.get("status") != "active":
            raise HTTPException(status_code=401, detail="Not authenticated")
        if ROLE_RANK.get(admin["role"], 0) < ROLE_RANK.get(min_role, 99):
            raise HTTPException(status_code=403, detail="Insufficient role")
        return admin
    return _dep


# ---------------- public, token-gated bootstrap endpoint ----------------
# Not behind the HMAC service-to-service layer: this is the one deliberate manual
# dev-bootstrap path (per product decision) for completing initial/invited setup
# before the INTIES Admin Dashboard integration exists. Security comes entirely from
# the single-use, hashed-at-rest, short-lived, cryptographically random token — the
# same trust model as a standard emailed password-reset link.

@router.post("/setup-password")
async def setup_password(request: Request):
    body = await request.json()
    token = str(body.get("token", ""))
    password = str(body.get("password", ""))
    ip = client_ip(request)
    if not rate_limit(f"admsetup:{ip}", limit=10, window_s=3600):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    if not token or len(token) > 200:
        raise HTTPException(status_code=400, detail="Invalid or expired setup link.")
    if not password or len(password) < 12 or len(password) > 200:
        raise HTTPException(status_code=422, detail="Password must be at least 12 characters.")

    db = request.app.state.db
    now = datetime.now(timezone.utc)
    row = await db.dp_admin_setup_tokens.find_one({"token_hash": hash_token(token)})
    expires_at = row["expires_at"].replace(tzinfo=timezone.utc) if row and row.get("expires_at") else None
    if not row or row.get("used") or not expires_at or expires_at < now:
        await log_event(db, "dp_admin_setup_failed", actor="anonymous", ip=ip)
        raise HTTPException(status_code=400, detail="Invalid or expired setup link.")
    admin = await db.dp_admins.find_one({"id": row["admin_id"]})
    if not admin:
        raise HTTPException(status_code=400, detail="Invalid or expired setup link.")

    await db.dp_admins.update_one(
        {"id": admin["id"]},
        {"$set": {"password_hash": hash_password(password), "status": "active"}},
    )
    await db.dp_admin_setup_tokens.update_one({"_id": row["_id"]}, {"$set": {"used": True}})
    await log_event(db, "dp_admin_setup_completed", actor=f"admin:{admin['id']}", target=admin["id"], ip=ip)
    return {"ok": True, "email": admin["email"]}
