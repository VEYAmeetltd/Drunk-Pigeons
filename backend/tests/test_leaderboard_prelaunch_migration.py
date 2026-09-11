"""Isolated unit tests for the internal, one-time-ever DP backend startup
migration (leaderboard_prelaunch_migration.py). These call the async migration
function DIRECTLY (never via HTTP, never via admin login/JWT/HMAC) against a
throwaway MongoDB database created and dropped by this test file itself —
using the SAME local MONGO_URL already configured in backend/.env for this
preview environment (confirmed elsewhere in this repo to be a fully separate,
unreachable-from-production local mongod instance). This NEVER touches the
production URL/database, and never touches the shared `drunk_pigeons` preview
database other test files use — every test here gets its own fresh, isolated
database name.
"""
import asyncio
import secrets
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
from leaderboard_prelaunch_migration import MIGRATION_ID, run_prelaunch_leaderboard_reset_migration  # noqa: E402
from leaderboard_reset import TARGET_COLLECTIONS  # noqa: E402

MONGO_URL = ""
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("MONGO_URL="):
                MONGO_URL = line.split("=", 1)[1].strip()
                break
except Exception:
    pass

PROTECTED_COLLECTIONS = [
    "acceptances", "ad_admin_audit", "ad_enquiries", "admin_sessions",
    "dp_admin_setup_tokens", "dp_admins", "dp_tickets",
]


def fresh_db():
    """A brand-new, uniquely-named throwaway database for exactly one test."""
    name = f"dp_migration_test_{secrets.token_hex(8)}"
    client = AsyncIOMotorClient(MONGO_URL)
    return client, client[name]


async def _seed_and_snapshot(db):
    # Mirrors server.py's real startup index creation for this collection —
    # the migration's atomic claim relies on this unique index existing.
    await db.service_nonces.create_index([("key_id", 1), ("nonce", 1)], unique=True)
    marker = secrets.token_hex(6)
    for name in TARGET_COLLECTIONS:
        await db[name].insert_one({"id": f"fixture_{marker}_{name}", "_test_fixture": True})
    for name in PROTECTED_COLLECTIONS:
        await db[name].insert_one({"id": f"fixture_{marker}_{name}", "_test_fixture": True})
    # An UNRELATED, real-shaped HMAC replay nonce — must survive untouched.
    await db.service_nonces.insert_one({
        "key_id": "some-other-service-key", "nonce": secrets.token_hex(16),
        "createdAt": datetime.now(timezone.utc),
    })
    # A couple of real indexes, to prove delete_many never drops them.
    await db.runs.create_index("runId", unique=True)
    await db.players.create_index("playerId", unique=True)
    before_protected = {name: await db[name].find({}).to_list(length=100) for name in PROTECTED_COLLECTIONS}
    before_nonce = await db.service_nonces.find_one({"key_id": "some-other-service-key"})
    return before_protected, before_nonce


def test_first_run_deletes_only_five_collections_and_completes():
    async def go():
        client, db = fresh_db()
        try:
            before_protected, before_nonce = await _seed_and_snapshot(db)

            await run_prelaunch_leaderboard_reset_migration(db)

            # 1) Exactly the 5 approved collections are emptied.
            existing = await db.list_collection_names()
            for name in TARGET_COLLECTIONS:
                assert name in existing, f"{name} was dropped, must only be emptied"
                assert await db[name].count_documents({}) == 0

            # 2) Indexes on those collections survive (never dropped).
            run_ixs = await db.runs.index_information()
            player_ixs = await db.players.index_information()
            assert any(ix["key"] == [("runId", 1)] for ix in run_ixs.values())
            assert any(ix["key"] == [("playerId", 1)] for ix in player_ixs.values())

            # 3) Protected collections are byte-for-byte unchanged.
            for name in PROTECTED_COLLECTIONS:
                after = await db[name].find({}).to_list(length=100)
                assert after == before_protected[name], f"{name} was modified"

            # 4) The unrelated pre-existing nonce document is untouched.
            after_nonce = await db.service_nonces.find_one({"key_id": "some-other-service-key"})
            assert after_nonce == before_nonce

            # 5) Migration marker: completed, permanent (no createdAt -> TTL-exempt), correct counts.
            marker = await db.service_nonces.find_one({"key_id": "migration", "nonce": MIGRATION_ID})
            assert marker is not None
            assert marker["status"] == "completed"
            assert "createdAt" not in marker
            assert marker["deleted"] == {name: 1 for name in TARGET_COLLECTIONS}
            assert marker["total_deleted"] == 5

            # 6) One existing DP audit event, counts + migration_id only.
            events = await db.dp_events.find({"event_type": "dp_leaderboard_reset"}).to_list(length=10)
            assert len(events) == 1
            assert events[0]["detail"]["migration_id"] == MIGRATION_ID
            assert events[0]["detail"]["deleted"] == marker["deleted"]
            assert events[0]["detail"]["total_deleted"] == 5
        finally:
            await client.drop_database(db.name)
    asyncio.run(go())


def test_second_run_is_permanently_skipped_no_reexecution():
    async def go():
        client, db = fresh_db()
        try:
            await _seed_and_snapshot(db)
            await run_prelaunch_leaderboard_reset_migration(db)
            marker_after_first = await db.service_nonces.find_one({"key_id": "migration", "nonce": MIGRATION_ID})

            # Re-seed the 5 target collections (as if new real data arrived) —
            # a completed migration must NEVER re-run, no matter what.
            for name in TARGET_COLLECTIONS:
                await db[name].insert_one({"id": "should_survive", "_test_fixture": True})

            await run_prelaunch_leaderboard_reset_migration(db)

            for name in TARGET_COLLECTIONS:
                assert await db[name].count_documents({}) == 1, f"{name} was touched by a second, skipped run"
            events = await db.dp_events.find({"event_type": "dp_leaderboard_reset"}).to_list(length=10)
            assert len(events) == 1, "a completed migration must never write a second audit event"
            marker_after_second = await db.service_nonces.find_one({"key_id": "migration", "nonce": MIGRATION_ID})
            assert marker_after_second == marker_after_first
        finally:
            await client.drop_database(db.name)
    asyncio.run(go())


def test_concurrent_startup_attempts_execute_exactly_once():
    async def go():
        client, db = fresh_db()
        try:
            await _seed_and_snapshot(db)

            # Simulate several process starts racing to run the migration at
            # (nearly) the same time.
            await asyncio.gather(*(run_prelaunch_leaderboard_reset_migration(db) for _ in range(5)))

            events = await db.dp_events.find({"event_type": "dp_leaderboard_reset"}).to_list(length=10)
            assert len(events) == 1, "concurrent startups must execute the deletion exactly once"
            marker = await db.service_nonces.find_one({"key_id": "migration", "nonce": MIGRATION_ID})
            assert marker["status"] == "completed"
            assert marker["total_deleted"] == 5
            for name in TARGET_COLLECTIONS:
                assert await db[name].count_documents({}) == 0
        finally:
            await client.drop_database(db.name)
    asyncio.run(go())


def test_partial_failure_leaves_resumable_state_and_next_call_completes():
    async def go():
        client, db = fresh_db()
        try:
            await _seed_and_snapshot(db)

            with patch("leaderboard_prelaunch_migration.reset_leaderboard_data",
                       new=AsyncMock(side_effect=RuntimeError("simulated mid-run failure"))):
                await run_prelaunch_leaderboard_reset_migration(db)

            # Left resumable: not completed, sanitized error only, nothing deleted yet.
            marker = await db.service_nonces.find_one({"key_id": "migration", "nonce": MIGRATION_ID})
            assert marker["status"] == "failed"
            assert "RuntimeError" in marker["error"]
            assert "simulated mid-run failure" in marker["error"]
            events = await db.dp_events.find({"event_type": "dp_leaderboard_reset"}).to_list(length=10)
            assert len(events) == 0, "must not be marked/audited as done until all 5 deletes succeed"
            for name in TARGET_COLLECTIONS:
                assert await db[name].count_documents({}) == 1, "a failed attempt must not have deleted anything"

            # Next call (no mock): resumes and completes normally — proving
            # the idempotent delete_many-based resume is safe.
            await run_prelaunch_leaderboard_reset_migration(db)
            marker2 = await db.service_nonces.find_one({"key_id": "migration", "nonce": MIGRATION_ID})
            assert marker2["status"] == "completed"
            assert marker2["total_deleted"] == 5
            for name in TARGET_COLLECTIONS:
                assert await db[name].count_documents({}) == 0
            events2 = await db.dp_events.find({"event_type": "dp_leaderboard_reset"}).to_list(length=10)
            assert len(events2) == 1
        finally:
            await client.drop_database(db.name)
    asyncio.run(go())


def test_never_crashes_even_on_totally_unexpected_error():
    """The migration must never raise out and take down backend startup."""
    async def go():
        client, db = fresh_db()
        try:
            with patch("leaderboard_prelaunch_migration._run", new=AsyncMock(side_effect=Exception("boom"))):
                await run_prelaunch_leaderboard_reset_migration(db)  # must not raise
        finally:
            await client.drop_database(db.name)
    asyncio.run(go())
