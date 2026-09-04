"""Protected server-to-server integration API for the INTIES Admin Dashboard.

Every route in this router requires `require_service_auth` (API key id + HMAC-SHA256
request signature + timestamp + nonce replay protection — see service_auth.py). There
is no human-facing login here and no browser ever talks to this router directly; it is
called ONLY by the INTIES backend. See
/app/docs/INTIES_DRUNK_PIGEONS_INTEGRATION_CONTRACT.md for the full contract.

Never returns: artwork_storage_path, internal object-storage keys/paths, or a public
artwork URL. Artwork is streamed through /enquiries/{id}/artwork with safe headers.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
import io

from advertising import (
    PACKAGES, WORKFLOW_STATUSES, MODERATION_STATUSES, WORKFLOW_TRANSITIONS,
    _SIG, get_object, public_enquiry,
)
from service_auth import require_service_auth

router = APIRouter(prefix="/api/service/advertising", tags=["integration"])

MODERATE_ACTIONS = {"clear", "spam", "explicit_abuse", "suspected_illegal"}
# action -> (moderation_status, forces workflow_status to "rejected"?)
_MODERATE_EFFECT = {
    "clear": ("cleared", False),
    "spam": ("spam", True),
    "explicit_abuse": ("explicit_abuse", True),
    "suspected_illegal": ("suspected_illegal", True),
}

AUDIT_LIMIT_DEFAULT = 200
LIST_LIMIT_DEFAULT = 50
LIST_LIMIT_MAX = 200


async def _audit(db, enquiry_id, actor, ip, action, before, after, note):
    await db.ad_admin_audit.insert_one({
        "id": secrets.token_hex(12),
        "enquiry_id": enquiry_id,
        "actor": actor,
        "action": action,
        "from_workflow_status": before.get("workflow_status"),
        "to_workflow_status": after.get("workflow_status"),
        "from_moderation_status": before.get("moderation_status"),
        "to_moderation_status": after.get("moderation_status"),
        "note": note,
        "ip": ip,
        "at": datetime.now(timezone.utc),
    })


def _audit_public(doc):
    return {
        "id": doc["id"],
        "enquiry_id": doc["enquiry_id"],
        "actor": doc.get("actor"),
        "action": doc.get("action"),
        "from_workflow_status": doc.get("from_workflow_status"),
        "to_workflow_status": doc.get("to_workflow_status"),
        "from_moderation_status": doc.get("from_moderation_status"),
        "to_moderation_status": doc.get("to_moderation_status"),
        "note": doc.get("note"),
        "at": doc.get("at").isoformat() if doc.get("at") else None,
    }


@router.get("/whoami")
async def whoami(auth=Depends(require_service_auth)):
    """Connectivity/credential check — confirms the signed request was accepted."""
    return {"ok": True, "key_id": auth["key_id"]}


@router.get("/enquiries")
async def list_enquiries(
    request: Request,
    workflow_status: str | None = None,
    moderation_status: str | None = None,
    package: str | None = None,
    limit: int = LIST_LIMIT_DEFAULT,
    offset: int = 0,
    auth=Depends(require_service_auth),
):
    if workflow_status is not None and workflow_status not in WORKFLOW_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid workflow_status")
    if moderation_status is not None and moderation_status not in MODERATION_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid moderation_status")
    if package is not None and package not in PACKAGES:
        raise HTTPException(status_code=422, detail="Invalid package")
    limit = max(1, min(LIST_LIMIT_MAX, limit))
    offset = max(0, offset)

    query = {}
    if workflow_status:
        query["workflow_status"] = workflow_status
    if moderation_status:
        query["moderation_status"] = moderation_status
    if package:
        query["package"] = package

    db = request.app.state.db
    total = await db.ad_enquiries.count_documents(query)
    cur = db.ad_enquiries.find(query).sort("created_at", -1).skip(offset).limit(limit)
    items = [public_enquiry(d) async for d in cur]
    return {
        "ok": True, "enquiries": items, "total": total, "limit": limit, "offset": offset,
        "workflow_statuses": WORKFLOW_STATUSES, "moderation_statuses": MODERATION_STATUSES,
    }


@router.get("/enquiries/{eid}")
async def get_enquiry(eid: str, request: Request, auth=Depends(require_service_auth)):
    doc = await request.app.state.db.ad_enquiries.find_one({"id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "enquiry": public_enquiry(doc)}


@router.get("/enquiries/{eid}/artwork")
async def get_artwork(eid: str, request: Request, auth=Depends(require_service_auth)):
    doc = await request.app.state.db.ad_enquiries.find_one({"id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc.get("artwork_restricted"):
        raise HTTPException(status_code=403, detail="Artwork access restricted pending disposal instructions")
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


async def _set_status_impl(db, eid, status, note, moderated_by, ip):
    """Reused by both the /status route below and the DP Tickets resolve action
    (admin_tickets.py) — one workflow-transition implementation, never duplicated."""
    if status not in WORKFLOW_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    doc = await db.ad_enquiries.find_one({"id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    current = doc.get("workflow_status", "pending")
    if status not in WORKFLOW_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Cannot transition from '{current}' to '{status}'")

    now = datetime.now(timezone.utc)
    await db.ad_enquiries.update_one(
        {"id": eid},
        {"$set": {"workflow_status": status, "moderated_at": now, "moderated_by": moderated_by, "updated_at": now}},
    )
    after = {**doc, "workflow_status": status}
    await _audit(db, eid, moderated_by, ip, "status_change", doc, after, note)
    return {"ok": True, "workflow_status": status}


@router.post("/enquiries/{eid}/status")
async def set_status(eid: str, request: Request, auth=Depends(require_service_auth)):
    body = await request.json()
    status = str(body.get("status", ""))
    note = body.get("note")
    moderated_by = str(body.get("moderated_by") or f"service:{auth['key_id']}")[:120]
    return await _set_status_impl(request.app.state.db, eid, status, note, moderated_by, auth["ip"])


async def _moderate_impl(db, eid, action, note, moderated_by, ip, escalation_reference=None):
    """Reused by both the /moderate route below and the DP Tickets resolve action
    (admin_tickets.py) — one moderation implementation, never duplicated."""
    if action not in MODERATE_ACTIONS:
        raise HTTPException(status_code=422, detail="Invalid action")
    doc = await db.ad_enquiries.find_one({"id": eid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc.get("workflow_status") in ("completed",):
        raise HTTPException(status_code=409, detail="Cannot moderate a completed enquiry")

    mod_status, force_rejected = _MODERATE_EFFECT[action]
    now = datetime.now(timezone.utc)
    updates = {
        "moderation_status": mod_status,
        "moderated_at": now,
        "moderated_by": moderated_by,
        "updated_at": now,
    }
    if note is not None:
        updates["rejection_reason"] = str(note)[:500]
    if force_rejected:
        updates["workflow_status"] = "rejected"
    if action == "suspected_illegal":
        updates["artwork_restricted"] = True
        updates["escalation_reference"] = str(escalation_reference)[:120] if escalation_reference else f"DP-ESC-{secrets.token_hex(6)}"

    await db.ad_enquiries.update_one({"id": eid}, {"$set": updates})
    after = {**doc, **updates}
    await _audit(db, eid, moderated_by, ip, f"moderate:{action}", doc, after, note)
    return {"ok": True, "workflow_status": after.get("workflow_status"), "moderation_status": mod_status,
            "artwork_restricted": after.get("artwork_restricted", False),
            "escalation_reference": after.get("escalation_reference")}


@router.post("/enquiries/{eid}/moderate")
async def moderate(eid: str, request: Request, auth=Depends(require_service_auth)):
    body = await request.json()
    action = str(body.get("action", ""))
    note = body.get("note")
    moderated_by = str(body.get("moderated_by") or f"service:{auth['key_id']}")[:120]
    escalation_reference = body.get("escalation_reference")
    return await _moderate_impl(request.app.state.db, eid, action, note, moderated_by, auth["ip"], escalation_reference)


@router.get("/enquiries/{eid}/audit")
async def get_audit(eid: str, request: Request, limit: int = AUDIT_LIMIT_DEFAULT, auth=Depends(require_service_auth)):
    db = request.app.state.db
    exists = await db.ad_enquiries.find_one({"id": eid}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Not found")
    limit = max(1, min(AUDIT_LIMIT_DEFAULT, limit))
    cur = db.ad_admin_audit.find({"enquiry_id": eid}).sort("at", -1).limit(limit)
    items = [_audit_public(d) async for d in cur]
    return {"ok": True, "audit": items}
