"""One-time, pre-release production leaderboard reset — owner-only, deliberately
narrow: empties ONLY the 5 listed collections (delete_many, never drop the
collection or its indexes) and can succeed at most once ever, enforced by an
atomic DB-level one-use marker (see claim_one_time_lock). Every other
collection (acceptances, dp_events, dp_admins, dp_admin_setup_tokens,
admin_sessions, ad_admin_audit, ad_enquiries, dp_tickets, service_nonces, ...)
is never touched by this module.
"""
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError

from admin_events import log_event

CONFIRM_TEXT = "RESET DRUNK PIGEONS LEADERBOARD"
OP_NAME = "leaderboard_reset_prelaunch"
# Exact required order.
TARGET_COLLECTIONS = ["reports", "flagged", "mod_attempts", "runs", "players"]


async def claim_one_time_lock(db, op_name: str = OP_NAME) -> bool:
    """Atomic one-use marker: the first caller to reach Mongo gets True, every
    later caller (even microseconds later, even after a crash mid-reset) gets
    False forever — enforced by a unique index on op_name (server.py startup),
    not by an application-level read-then-write race."""
    try:
        await db.dp_admin_ops_locks.insert_one({
            "op_name": op_name,
            "used_at": datetime.now(timezone.utc),
        })
        return True
    except DuplicateKeyError:
        return False


async def reset_leaderboard_data(db, actor: str):
    """Deletes ALL documents (delete_many({}) — never the collection/indexes)
    from ONLY the 5 target collections, in order, then writes one audit event
    containing counts only (never full documents, never secrets). Caller must
    already have verified owner role, recent reauthentication, the exact
    confirmation text, and the one-time lock BEFORE calling this."""
    deleted = {}
    for name in TARGET_COLLECTIONS:
        result = await db[name].delete_many({})
        deleted[name] = result.deleted_count
    total = sum(deleted.values())
    await log_event(
        db, "dp_leaderboard_reset", actor=actor,
        detail={"deleted": deleted, "total_deleted": total},
    )
    return deleted, total
