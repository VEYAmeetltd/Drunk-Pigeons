"""DP Tickets — one consistent admin-facing read/action interface layered over
EXISTING DP business collections. Never duplicates data: every ticket maps back to
exactly one source-of-truth document, and any resolution goes through the SAME
domain logic those collections already use elsewhere (service_advertising's
_set_status_impl / _moderate_impl for enquiries; direct field updates for the other
two sources, which had no prior admin-facing logic to reuse).

Sources:
  ad_enquiry  -> existing `ad_enquiries` collection (advertising_enquiry /
                 artwork_review / payment_admin categories, derived from its own
                 workflow_status / moderation_status — no new fields added).
  report      -> existing `reports` collection (leaderboard_moderation category).
                 Adds only resolved / resolved_by / resolved_at / resolution_note.
  dp_ticket   -> NEW minimal collection, only for categories with no existing DP
                 business record (player_support, operational_incident).
"""
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from bson import ObjectId

from advertising import public_enquiry
from service_advertising import _set_status_impl, _moderate_impl, MODERATE_ACTIONS
from admin_events import log_event

DP_TICKET_CATEGORIES = {"player_support", "operational_incident"}
SOURCES = ("ad_enquiry", "report", "dp_ticket")


def _enquiry_category(doc):
    if doc.get("moderation_status") == "unreviewed":
        return "artwork_review"
    if doc.get("workflow_status") in ("payment_sent", "paid", "scheduled"):
        return "payment_admin"
    return "advertising_enquiry"


def _enquiry_status(doc):
    if doc.get("workflow_status") in ("rejected", "completed"):
        return "resolved"
    if doc.get("moderation_status") not in (None, "unreviewed"):
        return "resolved"
    return "open"


def _norm_enquiry(doc):
    return {
        "ticket_id": f"ad_enquiry:{doc['id']}", "source": "ad_enquiry",
        "category": _enquiry_category(doc), "status": _enquiry_status(doc),
        "subject": f"{doc.get('name', '')} — {doc.get('packageLabel', '')}",
        "summary": (doc.get("message") or "")[:160],
        "created_at": doc.get("created_at"), "updated_at": doc.get("updated_at") or doc.get("created_at"),
    }


def _parse_dt(v):
    if v is None or hasattr(v, "isoformat"):
        return v
    try:
        return datetime.fromisoformat(str(v))
    except ValueError:
        return None


def _norm_report(doc):
    created = _parse_dt(doc.get("reportedAt"))
    updated = _parse_dt(doc.get("resolved_at")) or created
    return {
        "ticket_id": f"report:{doc['_id']}", "source": "report",
        "category": "leaderboard_moderation", "status": "resolved" if doc.get("resolved") else "open",
        "subject": f"Reported nickname: {doc.get('nickname', '')}",
        "summary": (doc.get("reason") or "")[:160],
        "created_at": created, "updated_at": updated,
    }


def _norm_dp_ticket(doc):
    return {
        "ticket_id": f"dp_ticket:{doc['id']}", "source": "dp_ticket",
        "category": doc.get("category"), "status": doc.get("status", "open"),
        "subject": doc.get("subject", ""), "summary": (doc.get("description") or "")[:160],
        "created_at": doc.get("created_at"), "updated_at": doc.get("updated_at") or doc.get("created_at"),
    }


def _iso(item):
    out = dict(item)
    for k in ("created_at", "updated_at"):
        v = out.get(k)
        out[k] = v.isoformat() if hasattr(v, "isoformat") else v
    return out


def _sort_key(v):
    if v is None:
        return datetime.min
    return v.replace(tzinfo=None) if getattr(v, "tzinfo", None) is not None else v


async def list_tickets(db, category=None, status=None, page=1, page_size=25):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    items = []
    async for d in db.ad_enquiries.find({}).sort("created_at", -1).limit(300):
        items.append(_norm_enquiry(d))
    async for d in db.reports.find({}).sort("reportedAt", -1).limit(300):
        items.append(_norm_report(d))
    async for d in db.dp_tickets.find({}).sort("created_at", -1).limit(300):
        items.append(_norm_dp_ticket(d))
    if category:
        items = [i for i in items if i["category"] == category]
    if status:
        items = [i for i in items if i["status"] == status]
    items.sort(key=lambda i: _sort_key(i["created_at"]), reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    page_items = [_iso(i) for i in items[start:start + page_size]]
    return {"ok": True, "tickets": page_items, "total": total, "page": page, "page_size": page_size}


def _split(ticket_id):
    if ":" not in ticket_id:
        raise HTTPException(status_code=422, detail="Invalid ticket_id")
    source, raw_id = ticket_id.split(":", 1)
    if source not in SOURCES:
        raise HTTPException(status_code=422, detail="Invalid ticket source")
    return source, raw_id


async def _ticket_events(db, ticket_id, limit=100):
    cur = db.dp_events.find({"target": ticket_id}).sort("at", -1).limit(limit)
    out = []
    async for d in cur:
        out.append({
            "event_type": d.get("event_type"), "actor": d.get("actor"),
            "detail": d.get("detail", {}), "at": d.get("at").isoformat() if d.get("at") else None,
        })
    return out


async def get_ticket(db, ticket_id):
    source, raw_id = _split(ticket_id)
    if source == "ad_enquiry":
        doc = await db.ad_enquiries.find_one({"id": raw_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        detail = {"enquiry": public_enquiry(doc), "category": _enquiry_category(doc), "status": _enquiry_status(doc)}
    elif source == "report":
        try:
            doc = await db.reports.find_one({"_id": ObjectId(raw_id)})
        except Exception:
            doc = None
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        detail = {
            "nickname": doc.get("nickname"), "reason": doc.get("reason"),
            "reportedAt": doc.get("reportedAt"), "resolved": bool(doc.get("resolved")),
            "resolved_by": doc.get("resolved_by"),
            "resolved_at": doc.get("resolved_at").isoformat() if hasattr(doc.get("resolved_at"), "isoformat") else doc.get("resolved_at"),
            "resolution_note": doc.get("resolution_note"),
        }
    else:
        doc = await db.dp_tickets.find_one({"id": raw_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        doc.pop("_id", None)
        detail = _iso(doc)
    events = await _ticket_events(db, f"{source}:{raw_id}")
    return {"ok": True, "ticket_id": f"{source}:{raw_id}", "source": source, "detail": detail, "events": events}


async def resolve_ticket(db, ticket_id, body, actor, ip):
    source, raw_id = _split(ticket_id)
    resolution_reason = str(body.get("resolution_reason", "") or "")[:500]
    now = datetime.now(timezone.utc)

    if source == "ad_enquiry":
        doc = await db.ad_enquiries.find_one({"id": raw_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        category = _enquiry_category(doc)
        if category == "artwork_review":
            action = str(body.get("action", ""))
            if action not in MODERATE_ACTIONS:
                raise HTTPException(status_code=422, detail="action required: one of " + ", ".join(sorted(MODERATE_ACTIONS)))
            result = await _moderate_impl(db, raw_id, action, resolution_reason or None, actor, ip)
        else:
            status_target = str(body.get("status", ""))
            result = await _set_status_impl(db, raw_id, status_target, resolution_reason or None, actor, ip)
    elif source == "report":
        try:
            oid = ObjectId(raw_id)
        except Exception:
            raise HTTPException(status_code=404, detail="Not found")
        res = await db.reports.update_one(
            {"_id": oid},
            {"$set": {"resolved": True, "resolved_by": actor, "resolved_at": now,
                      "resolution_note": resolution_reason}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        result = {"ok": True, "resolved": True}
    else:
        doc = await db.dp_tickets.find_one({"id": raw_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Not found")
        await db.dp_tickets.update_one(
            {"id": raw_id},
            {"$set": {"status": "resolved", "resolution_reason": resolution_reason,
                      "resolved_by": actor, "resolved_at": now, "updated_at": now}},
        )
        result = {"ok": True, "status": "resolved"}

    await log_event(db, "ticket_resolved", actor=actor, target=f"{source}:{raw_id}",
                     detail={"resolution_reason": resolution_reason}, ip=ip)
    return result


async def add_note(db, ticket_id, note, actor, ip):
    source, raw_id = _split(ticket_id)
    exists = None
    if source == "ad_enquiry":
        exists = await db.ad_enquiries.find_one({"id": raw_id}, {"_id": 1})
    elif source == "report":
        try:
            exists = await db.reports.find_one({"_id": ObjectId(raw_id)}, {"_id": 1})
        except Exception:
            exists = None
    else:
        exists = await db.dp_tickets.find_one({"id": raw_id}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Not found")
    await log_event(db, "ticket_note", actor=actor, target=f"{source}:{raw_id}",
                     detail={"note": str(note)[:1000]}, ip=ip)
    return {"ok": True}


async def create_dp_ticket(db, category, subject, description, actor, ip):
    if category not in DP_TICKET_CATEGORIES:
        raise HTTPException(status_code=422, detail="category must be one of " + ", ".join(sorted(DP_TICKET_CATEGORIES)))
    subject = str(subject or "")[:200]
    if not subject:
        raise HTTPException(status_code=422, detail="subject is required")
    now = datetime.now(timezone.utc)
    tid = secrets.token_hex(12)
    await db.dp_tickets.insert_one({
        "id": tid, "category": category, "subject": subject,
        "description": str(description or "")[:2000], "status": "open",
        "created_at": now, "updated_at": now, "created_by": actor,
        "resolution_reason": None, "resolved_by": None, "resolved_at": None,
    })
    await log_event(db, "ticket_created", actor=actor, target=f"dp_ticket:{tid}",
                     detail={"category": category, "subject": subject}, ip=ip)
    return {"ok": True, "ticket_id": f"dp_ticket:{tid}"}
