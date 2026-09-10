"""Protected DP Admin API — server-to-server ONLY.

  INTIES ADMIN BROWSER -> INTIES SERVER/BACKEND -> signed service request -> HERE

Every route requires `require_service_auth` (API key + HMAC-SHA256 + timestamp +
nonce — see service_auth.py) — this proves the CALLER is the trusted INTIES
backend. Admin-identity routes ALSO require a valid DP admin JWT (`require_dp_admin`
— see admin_auth.py), re-validated against the DP database on every single call —
this proves WHICH DP admin the call is acting for, and makes disable/revoke
immediate. The two layers are independent and both are enforced everywhere except
/login itself (which is how a JWT is obtained in the first place).

DP remains the sole source of truth for DP admins/roles/tickets/logs/authorization.
Never returns: password hashes, setup tokens, JWTs other than on /login, HMAC
secrets, artwork storage paths. See
/app/docs/INTIES_DRUNK_PIGEONS_INTEGRATION_CONTRACT.md for the full contract.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Depends

from service_auth import require_service_auth
from admin_auth import do_login, public_admin, invite_admin, require_dp_admin, VALID_ROLES
from admin_events import log_event, public_event, EVENT_TYPES
from admin_tickets import list_tickets, get_ticket, resolve_ticket, add_note, create_dp_ticket

router = APIRouter(prefix="/api/service/admin", tags=["dp-admin"])

LOG_PAGE_MAX = 100

# ---------------- admin auth ----------------

@router.post("/login")
async def dp_admin_login(request: Request, auth=Depends(require_service_auth)):
    body = await request.json()
    return await do_login(request.app.state.db, request, str(body.get("email", "")), str(body.get("password", "")))


@router.get("/me")
async def dp_admin_me(admin=Depends(require_dp_admin()), _auth=Depends(require_service_auth)):
    return {"ok": True, "admin": public_admin(admin)}

# ---------------- admin management (list: any active admin; mutate: OWNER only) ----------------

@router.get("/admins")
async def list_admins(request: Request, admin=Depends(require_dp_admin()), _auth=Depends(require_service_auth)):
    cur = request.app.state.db.dp_admins.find({}).sort("created_at", -1)
    items = [public_admin(d) async for d in cur]
    return {"ok": True, "admins": items}


@router.post("/admins")
async def add_admin(request: Request, admin=Depends(require_dp_admin("owner")), _auth=Depends(require_service_auth)):
    body = await request.json()
    email = str(body.get("email", "")).strip().lower()
    role = str(body.get("role", "admin"))
    if role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail="role must be 'admin' or 'owner'")
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Invalid email")
    result, err = await invite_admin(request.app.state.db, email, role, created_by=f"admin:{admin['id']}")
    if err == "exists":
        raise HTTPException(status_code=409, detail="An admin with this email already exists")
    admin_id, token = result
    return {
        "ok": True, "admin_id": admin_id, "setup_token": token,
        "note": ("DEV MODE: no email provider is wired yet, so the single-use setup token "
                 "is returned directly here. Deliver it to the new admin via a secure channel "
                 "— it expires in 24h and can only be used once."),
    }


@router.patch("/admins/{admin_id}")
async def set_admin_status(admin_id: str, request: Request, admin=Depends(require_dp_admin("owner")),
                            _auth=Depends(require_service_auth)):
    body = await request.json()
    status_val = str(body.get("status", ""))
    if status_val not in ("active", "disabled"):
        raise HTTPException(status_code=422, detail="status must be 'active' or 'disabled'")
    db = request.app.state.db
    target = await db.dp_admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Not found")
    if target.get("status") == "invited" and status_val == "active":
        raise HTTPException(status_code=409, detail="This admin has not completed setup yet")
    if target.get("status") == "revoked":
        raise HTTPException(status_code=409, detail="This admin has been permanently revoked")
    await db.dp_admins.update_one({"id": admin_id}, {"$set": {"status": status_val}})
    await log_event(db, "dp_admin_enabled" if status_val == "active" else "dp_admin_disabled",
                     actor=f"admin:{admin['id']}", target=admin_id)
    return {"ok": True, "status": status_val}


@router.delete("/admins/{admin_id}")
async def revoke_admin(admin_id: str, request: Request, admin=Depends(require_dp_admin("owner")),
                        _auth=Depends(require_service_auth)):
    db = request.app.state.db
    target = await db.dp_admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Not found")
    if admin_id == admin["id"]:
        raise HTTPException(status_code=409, detail="Cannot revoke your own access")
    now = datetime.now(timezone.utc)
    await db.dp_admins.update_one(
        {"id": admin_id},
        {"$set": {"status": "revoked", "revoked_at": now, "revoked_by": f"admin:{admin['id']}"}},
    )
    await log_event(db, "dp_admin_revoked", actor=f"admin:{admin['id']}", target=admin_id)
    return {"ok": True, "status": "revoked"}


@router.post("/admins/{admin_id}/reissue-setup")
async def reissue_admin_setup(admin_id: str, request: Request, admin=Depends(require_dp_admin("owner")),
                               _auth=Depends(require_service_auth)):
    """OWNER-only account-recovery action for an EXISTING admin/owner (lost/expired
    setup link, forgotten access before ever completing setup, etc). Invalidates
    every pending token + any live session for the target, issues one fresh
    single-use token, and emails the setup link via Resend — the plaintext token
    NEVER leaves this process: it is not returned in this response, not logged.
    The link's host is derived from THIS request so it always points at whichever
    environment actually served the call (never a hardcoded/stale base URL)."""
    db = request.app.state.db
    target = await db.dp_admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Not found")

    from owner_recovery import reissue_setup_token
    import email_service

    # Fail closed BEFORE generating/invalidating any token if email delivery
    # isn't configured on THIS running environment — never leave a fresh
    # single-use credential undeliverable, and never silently invalidate the
    # target's existing tokens for nothing.
    missing = []
    if not email_service.resend.api_key:
        missing.append("RESEND_API_KEY")
    if not email_service.FROM_EMAIL:
        missing.append("RESEND_FROM_EMAIL")
    if missing:
        raise HTTPException(status_code=503, detail=f"Email delivery not configured: missing {', '.join(missing)}")

    _, token, expires_at = await reissue_setup_token(db, target["email"], actor=f"admin:{admin['id']}")
    if not token:
        raise HTTPException(status_code=404, detail="Not found")

    link = f"{str(request.base_url).rstrip('/')}/api/admin/setup?token={token}"
    html = (
        "<div style=\"font-family:sans-serif;max-width:480px;margin:0 auto;\">"
        "<h2 style=\"color:#3a0620;\">Drunk Pigeons \u2014 account access</h2>"
        "<p>An owner-approved request was made to (re)issue your Drunk Pigeons admin setup link.</p>"
        f"<p><a href=\"{link}\" style=\"background:#ff5fa2;color:#3a0620;padding:12px 22px;"
        "border-radius:24px;text-decoration:none;font-weight:bold;\">Set your password</a></p>"
        f"<p>This link is single-use and expires in 24 hours (by {expires_at.strftime('%Y-%m-%d %H:%M UTC')}).</p>"
        "<p>If you didn't expect this, contact support@intiesltd.com immediately.</p></div>"
    )
    result = await email_service.send_email(target["email"], "Drunk Pigeons — Set up your admin access", html)
    await log_event(
        db, "dp_admin_recovery_email_sent" if result.get("ok") else "dp_admin_recovery_email_failed",
        actor=f"admin:{admin['id']}", target=admin_id,
        detail={"email": target["email"], "provider": "resend", "ok": result.get("ok")},
    )
    return {"ok": bool(result.get("ok")), "email": target["email"], "expires_at": expires_at.isoformat()}

# ---------------- tickets ----------------

@router.get("/tickets")
async def tickets_list(request: Request, category: str | None = None, status: str | None = None,
                        page: int = 1, page_size: int = 25,
                        admin=Depends(require_dp_admin()), _auth=Depends(require_service_auth)):
    return await list_tickets(request.app.state.db, category, status, page, page_size)


@router.post("/tickets")
async def tickets_create(request: Request, admin=Depends(require_dp_admin()), _auth=Depends(require_service_auth)):
    body = await request.json()
    return await create_dp_ticket(request.app.state.db, body.get("category"), body.get("subject"),
                                   body.get("description"), f"admin:{admin['id']}", _auth["ip"])


@router.get("/tickets/{ticket_id}")
async def tickets_detail(ticket_id: str, request: Request, admin=Depends(require_dp_admin()),
                          _auth=Depends(require_service_auth)):
    return await get_ticket(request.app.state.db, ticket_id)


@router.post("/tickets/{ticket_id}/resolve")
async def tickets_resolve(ticket_id: str, request: Request, admin=Depends(require_dp_admin()),
                           _auth=Depends(require_service_auth)):
    body = await request.json()
    return await resolve_ticket(request.app.state.db, ticket_id, body, f"admin:{admin['id']}", _auth["ip"])


@router.post("/tickets/{ticket_id}/note")
async def tickets_note(ticket_id: str, request: Request, admin=Depends(require_dp_admin()),
                        _auth=Depends(require_service_auth)):
    body = await request.json()
    note = str(body.get("note", ""))
    if not note.strip():
        raise HTTPException(status_code=422, detail="note is required")
    return await add_note(request.app.state.db, ticket_id, note, f"admin:{admin['id']}", _auth["ip"])

# ---------------- logs ----------------

@router.get("/logs")
async def list_logs(request: Request, event_type: str | None = None, page: int = 1, page_size: int = 50,
                     admin=Depends(require_dp_admin()), _auth=Depends(require_service_auth)):
    if event_type is not None and event_type not in EVENT_TYPES:
        raise HTTPException(status_code=422, detail="Invalid event_type")
    db = request.app.state.db
    page = max(1, page)
    page_size = max(1, min(LOG_PAGE_MAX, page_size))
    q = {"event_type": event_type} if event_type else {}
    total = await db.dp_events.count_documents(q)
    cur = db.dp_events.find(q).sort("at", -1).skip((page - 1) * page_size).limit(page_size)
    items = [public_event(d) async for d in cur]
    return {"ok": True, "logs": items, "total": total, "page": page, "page_size": page_size,
            "event_types": sorted(EVENT_TYPES)}
