"""DP-owned structured admin/operational event log (`dp_events`).

Append-only, DP-only. Every write here MUST already be redacted of secrets /
passwords / tokens / API keys by its caller — this module does not scrub, it
trusts its (small, reviewed) set of internal call sites. Never store: passwords,
setup tokens, JWTs, HMAC signatures/secrets, payment data.
"""
import secrets
from datetime import datetime, timezone

EVENT_TYPES = {
    "dp_admin_invited", "dp_admin_setup_completed", "dp_admin_setup_failed",
    "dp_admin_enabled", "dp_admin_disabled", "dp_admin_revoked",
    "dp_admin_login_success", "dp_admin_login_failed",
    "ticket_created", "ticket_resolved", "ticket_note",
    "service_auth_failure",
}


async def log_event(db, event_type, actor=None, target=None, detail=None, ip=None):
    if event_type not in EVENT_TYPES:
        event_type = "unknown"
    await db.dp_events.insert_one({
        "id": secrets.token_hex(12),
        "event_type": event_type,
        "actor": actor,      # e.g. "admin:<id>", "service:<key_id>", "bootstrap", "anonymous"
        "target": target,    # e.g. "ad_enquiry:<id>", "report:<id>", "dp_ticket:<id>", admin id
        "detail": detail or {},
        "ip": ip,
        "at": datetime.now(timezone.utc),
    })


def public_event(doc):
    return {
        "id": doc["id"],
        "event_type": doc.get("event_type"),
        "actor": doc.get("actor"),
        "target": doc.get("target"),
        "detail": doc.get("detail", {}),
        "ip": doc.get("ip"),
        "at": doc.get("at").isoformat() if doc.get("at") else None,
    }
