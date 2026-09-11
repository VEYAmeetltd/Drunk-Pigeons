"""One-time-ever, fully internal DP backend STARTUP migration: empties the
pre-release Drunk Pigeons leaderboard of leftover synthetic automated-test
data before public launch (explicitly authorised — see PRD.md Update 83).

Runs automatically from server.py's startup hook. No public endpoint, no
dependency on admin login/JWT/TOTP/HMAC/a browser request/Mongo Compass —
purely an internal DB call made by the backend process itself.

Reuses the EXACT SAME deletion logic as the owner-triggered manual reset
(leaderboard_reset.reset_leaderboard_data) — this module only adds the
one-time-ever / concurrency / resume / logging wiring around it. Never
duplicates the delete_many/collection-list logic.

State lives ENTIRELY inside ONE service_nonces document, keyed by
(key_id="migration", nonce=MIGRATION_ID) — reusing that collection's existing
unique index ([("key_id",1),("nonce",1)], see server.py startup) for the
atomic first-claim, exactly like the HMAC replay-protection nonces already
stored there. Never touches any other service_nonces document.

IMPORTANT: this marker deliberately NEVER sets a `createdAt` field. service_
nonces has an existing TTL index on `createdAt` (expireAfterSeconds=600) for
HMAC replay nonces — a Mongo TTL index only expires documents that actually
HAVE the indexed field, so using started_at/last_attempt_at/completed_at
instead (never createdAt) keeps this marker permanent, which "completed is
skipped forever" requires. Do not rename these fields to createdAt.
"""
import logging
from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from leaderboard_reset import reset_leaderboard_data

logger = logging.getLogger("dp.migration")

MIGRATION_ID = "dp-prelaunch-leaderboard-reset-2026-09-11-v1"
_KEY = {"key_id": "migration", "nonce": MIGRATION_ID}


async def run_prelaunch_leaderboard_reset_migration(db):
    """Safe to call on every backend startup, including concurrently from
    more than one process starting at once. No-ops instantly once the
    migration has ever completed. Never raises out of this function — any
    failure is logged and left in a resumable state (or, for a failure before
    a state could even be written, simply logged) so the app always starts
    cleanly and the NEXT restart retries automatically."""
    try:
        await _run(db)
    except Exception as e:
        logger.error("dp_migration_unexpected_error migration_id=%s error_type=%s",
                      MIGRATION_ID, type(e).__name__)


async def _run(db):
    """Claim step is a SINGLE atomic find_one_and_update (upsert) guarded by
    status != "completed" AND executing != True — Mongo linearizes concurrent
    writes to one document, so out of any number of simultaneous callers,
    exactly one gets back a non-None claim (whether this is the very first
    attempt ever, or a resume of a previously-crashed one); every other
    caller gets None back immediately and returns without touching anything.
    This is stronger than a plain insert-then-read check, which only
    guarantees exclusivity for the very first-ever attempt, not for resumes."""
    now = datetime.now(timezone.utc)
    try:
        claim = await db.service_nonces.find_one_and_update(
            {**_KEY, "status": {"$ne": "completed"}, "executing": {"$ne": True}},
            {
                "$set": {"executing": True, "status": "in_progress", "last_attempt_at": now},
                "$setOnInsert": {**_KEY, "migration_id": MIGRATION_ID, "started_at": now, "deleted": {}},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # Lost a genuine upsert race to another concurrent process — exactly
        # the "concurrent process starts cannot execute it twice" case.
        claim = None
    if claim is None:
        existing = await db.service_nonces.find_one(_KEY)
        status = existing.get("status") if existing else "unknown"
        logger.info("dp_migration_skip_or_busy migration_id=%s status=%s", MIGRATION_ID, status)
        return
    if claim.get("status") != "in_progress":
        # Belt-and-braces: should be unreachable given the filter above.
        return
    logger.info("dp_migration_claimed migration_id=%s", MIGRATION_ID)

    try:
        deleted, total = await reset_leaderboard_data(
            db, actor=f"system:migration:{MIGRATION_ID}",
            extra_detail={"migration_id": MIGRATION_ID},
        )
    except Exception as e:
        await db.service_nonces.update_one(
            _KEY,
            {"$set": {"status": "failed", "executing": False, "last_attempt_at": datetime.now(timezone.utc),
                      "error": f"{type(e).__name__}: {str(e)[:200]}"}},
        )
        logger.error("dp_migration_failed migration_id=%s error_type=%s", MIGRATION_ID, type(e).__name__)
        return

    await db.service_nonces.update_one(
        _KEY,
        {"$set": {"status": "completed", "executing": False, "completed_at": datetime.now(timezone.utc),
                  "deleted": deleted, "total_deleted": total}},
    )
    logger.info("dp_migration_completed migration_id=%s deleted=%s total_deleted=%s",
                MIGRATION_ID, deleted, total)
