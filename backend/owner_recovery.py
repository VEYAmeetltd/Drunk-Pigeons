"""One-off DP admin credential-recovery helper.

Reuses the EXACT same single-use hashed-token invitation system as
admin_auth.invite_admin() (same token generation, same hash_token(), same
dp_admin_setup_tokens collection, same SETUP_TOKEN_TTL_H expiry) — the only
difference is this targets an EXISTING admin record instead of creating a new
one, for an authorized account-recovery request.

Deliberately NOT exposed as a public HTTP endpoint: no unauthenticated caller
can prove "I am allowed to reissue THIS owner's setup link" without already
being logged in as that owner, so this is run as a one-off maintenance
operation with direct DB access — the same trust model as seed_dp_owner()'s
startup bootstrap.
"""
import secrets
from datetime import datetime, timezone, timedelta

from admin_auth import hash_token, SETUP_TOKEN_TTL_H
from admin_events import log_event


async def reissue_setup_token(db, email: str, actor: str):
    """Invalidate every pending setup token for this admin, then issue ONE
    fresh single-use token. Returns (admin_id, plaintext_token, expires_at) on
    success, or (None, None, None) if no admin exists with this email. Never
    logs the plaintext token — callers must hand it straight to a real
    delivery channel and must not print/persist it themselves."""
    email = (email or "").strip().lower()
    admin = await db.dp_admins.find_one({"email": email})
    if not admin:
        return None, None, None

    now = datetime.now(timezone.utc)
    invalidated = await db.dp_admin_setup_tokens.update_many(
        {"admin_id": admin["id"], "used": False},
        {"$set": {"used": True, "invalidated_at": now, "invalidated_by": actor}},
    )

    # Revoke any still-live session via the existing status-based mechanism —
    # require_dp_admin() re-checks status == 'active' on every request, so
    # flipping this back to 'invited' invalidates any outstanding JWT
    # immediately even if it hasn't expired yet. Never sets/knows a password.
    await db.dp_admins.update_one(
        {"id": admin["id"]},
        {"$set": {"status": "invited", "password_hash": None}},
    )

    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=SETUP_TOKEN_TTL_H)
    await db.dp_admin_setup_tokens.insert_one({
        "token_hash": hash_token(token), "admin_id": admin["id"],
        "created_at": now, "expires_at": expires_at, "used": False,
    })
    await log_event(
        db, "dp_admin_recovery_issued", actor=actor, target=admin["id"],
        detail={"email": email, "role": admin["role"], "invalidated_prior_tokens": invalidated.modified_count},
    )
    return admin["id"], token, expires_at
