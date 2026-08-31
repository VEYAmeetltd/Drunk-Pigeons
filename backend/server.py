import os
import re
import math
import time
from datetime import datetime, timezone
from collections import defaultdict, deque
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from moderation import is_allowed as moderation_ok, DATASET_VERSION as MOD_VERSION

load_dotenv(Path(__file__).parent / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Drunk Pigeons Leaderboard")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Gameplay-derived anti-cheat constants (must mirror the client engine) ----
SPEED_MAX = 380.0            # px/sec cap
PIXELS_PER_METRE = 24.0
MAX_MPS = SPEED_MAX / PIXELS_PER_METRE          # ~15.83 m/s absolute ceiling
DIST_CAP = 100000            # technical hard cap (m)
CHIP_CAP_RATIO = 1.2         # chips per metre plausibility ceiling
FLAG_DISTANCE = 40000        # plausible-but-extreme -> flag, keep out of Top list
# Easy Mode is deliberately survivable for very long, so legit runs reach far
# higher distances than standard. Use a much higher flag ceiling so genuine Silly
# Mode scores are not hidden. (Easy is SLOWER than standard, so the speed check
# below is already a safe upper bound for it — no separate speed cap needed.)
FLAG_DISTANCE_EASY = 250000
NICK_MAX = 16

# Per-player best-distance field for each gameplay ruleset. Standard runs use the
# original 'bestDistance' (Global leaderboard); Easy Mode uses a completely
# independent 'sillyBestDistance' (Silly Mode leaderboard). Never mixed.
MODE_FIELD = {"normal": "bestDistance", "easy": "sillyBestDistance"}


def norm_mode(m):
    return "easy" if m == "easy" else "normal"


# ---- lightweight in-memory rate limiter (per playerId) ----
_rl = defaultdict(lambda: deque())
RL_WINDOW = 60.0
RL_MAX = 20


def rate_limited(pid: str) -> bool:
    now = time.time()
    q = _rl[pid]
    while q and now - q[0] > RL_WINDOW:
        q.popleft()
    if len(q) >= RL_MAX:
        return True
    q.append(now)
    return False


# ---- per-IP rate limiter (defence against playerId rotation / anonymous floods) ----
# Generous: a whole household / mobile-network / public IP shares this budget, so
# it is set well above what many simultaneous legit players would ever produce,
# while still capping a single flooder rotating self-generated playerIds.
_rl_ip = defaultdict(lambda: deque())
RL_IP_WINDOW = 60.0
RL_IP_MAX = 240  # requests per IP per minute (register + submit combined)


def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def ip_rate_limited(ip: str) -> bool:
    now = time.time()
    q = _rl_ip[ip]
    while q and now - q[0] > RL_IP_WINDOW:
        q.popleft()
    if len(q) >= RL_IP_MAX:
        return True
    q.append(now)
    return False


def sanitize_nickname(raw: str):
    if not isinstance(raw, str):
        return None
    name = raw.strip()
    if not name or len(name) > NICK_MAX:
        return None
    if re.search(r"[<>]|https?://|www\.|&#|[\x00-\x1f\x7f]", name, re.I):
        return None
    # allow letters, numbers, spaces and a few friendly symbols only
    if not re.fullmatch(r"[A-Za-z0-9 _\-\.!]+", name):
        return None
    if len(re.findall(r"[_\-\.!]", name)) > 4:
        return None
    return name


def normalize_nickname(name):
    """Case- and space-insensitive canonical form used for global uniqueness.
    'FatPigeon', 'fat pigeon' and 'FATPIGEON' all collapse to 'fatpigeon'."""
    if not isinstance(name, str):
        return None
    n = re.sub(r"[^a-z0-9]", "", name.lower())
    return n or None


def valid_id(v: str) -> bool:
    return isinstance(v, str) and bool(re.fullmatch(r"[A-Za-z0-9_\-]{8,64}", v))


class RegisterReq(BaseModel):
    playerId: str
    nickname: str


class SubmitReq(BaseModel):
    playerId: str
    runId: str
    nickname: str | None = None
    reportedDistance: float
    runDuration: float
    reviveUsed: bool = False
    chipCount: int = 0
    mode: str = "normal"  # 'normal' (standard maps -> Global) | 'easy' (Easy Mode -> Silly)
    gameVersion: str = "1.0.0"


@app.on_event("startup")
async def _startup():
    await db.runs.create_index("runId", unique=True)
    await db.players.create_index("playerId", unique=True)
    await db.players.create_index([("bestDistance", -1)])
    await db.players.create_index([("sillyBestDistance", -1)])
    # Retention/TTL: run dedup records and flagged attempts are transient abuse-
    # control data, not the leaderboard itself, so they auto-expire to cap growth.
    # The persistent `players` collection (rankings) is never TTL'd.
    await db.runs.create_index("createdAt", expireAfterSeconds=7 * 24 * 3600)      # 7 days
    await db.flagged.create_index("createdAt", expireAfterSeconds=30 * 24 * 3600)  # 30 days
    # Global case-insensitive username uniqueness. Backfill + de-duplicate any
    # legacy collisions BEFORE creating the unique index so it cannot fail.
    await _migrate_unique_nicknames()


async def _migrate_unique_nicknames():
    seen = set()
    # Oldest first so the earliest owner of a name keeps it; later dupes get suffixed.
    cursor = db.players.find({"nickname": {"$exists": True, "$ne": None}}).sort("updatedAt", 1)
    async for p in cursor:
        nick = p.get("nickname")
        norm = normalize_nickname(nick) if nick else None
        if not norm:
            # No usable normalized form -> leave field unset so the sparse index skips it.
            if p.get("normalized_nickname") is not None:
                await db.players.update_one({"_id": p["_id"]}, {"$unset": {"normalized_nickname": ""}})
            continue
        if norm in seen:
            new_nick, new_norm = nick, norm
            while new_norm in seen:
                suffix = os.urandom(2).hex()
                new_nick = (nick[: NICK_MAX - 5] + "-" + suffix)[:NICK_MAX]
                new_norm = normalize_nickname(new_nick)
            seen.add(new_norm)
            await db.players.update_one(
                {"_id": p["_id"]},
                {"$set": {"nickname": new_nick, "normalized_nickname": new_norm}},
            )
        else:
            seen.add(norm)
            if p.get("normalized_nickname") != norm:
                await db.players.update_one({"_id": p["_id"]}, {"$set": {"normalized_nickname": norm}})
    await db.players.create_index("normalized_nickname", unique=True, sparse=True)


@app.get("/api/health")
async def health():
    return {"status": "ok", "moderation": MOD_VERSION}


@app.get("/api/leaderboard/check")
async def check_name(nickname: str = "", playerId: str | None = None):
    """Live availability check for the name picker. Read-only, never writes.
    available=True only when the (sanitized) name is valid AND not held by
    another player. A player's own current name reads as available to them."""
    name = sanitize_nickname(nickname)
    if not name:
        return {"ok": True, "available": False, "reason": "invalid"}
    norm = normalize_nickname(name)
    if not norm:
        return {"ok": True, "available": False, "reason": "invalid"}
    if not moderation_ok(name):
        return {"ok": True, "available": False, "reason": "moderation"}
    pid = playerId if (playerId and valid_id(playerId)) else None
    holder = await db.players.find_one({"normalized_nickname": norm}, {"_id": 0, "playerId": 1})
    if holder and holder.get("playerId") != pid:
        return {"ok": True, "available": False, "reason": "taken"}
    return {"ok": True, "available": True}


@app.post("/api/leaderboard/register")
async def register(req: RegisterReq, request: Request):
    if ip_rate_limited(client_ip(request)):
        return {"ok": False, "error": "rate-limited"}
    if not valid_id(req.playerId):
        return {"ok": False, "error": "bad-id"}
    name = sanitize_nickname(req.nickname)
    if not name:
        return {"ok": False, "error": "bad-name"}
    norm = normalize_nickname(name)
    if not norm:
        return {"ok": False, "error": "bad-name"}
    if not moderation_ok(name):
        # Count CONSECUTIVE content-moderation rejections for this player (atomic).
        # Not incremented by length/taken/other errors. Reset on a successful register.
        doc = await db.mod_attempts.find_one_and_update(
            {"playerId": req.playerId},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return {"ok": False, "error": "MODERATION", "attempt": int(doc.get("count", 1))}
    # Names are permanent: once a player has set one, they cannot switch to a
    # DIFFERENT name (re-saving the same identity, e.g. capitalisation, is fine).
    existing = await db.players.find_one({"playerId": req.playerId}, {"_id": 0, "normalized_nickname": 1})
    if existing and existing.get("normalized_nickname") and existing["normalized_nickname"] != norm:
        return {"ok": False, "error": "NAME_LOCKED"}
    try:
        await db.players.update_one(
            {"playerId": req.playerId},
            {"$set": {"nickname": name, "normalized_nickname": norm,
                      "updatedAt": datetime.now(timezone.utc).isoformat()},
             "$setOnInsert": {"bestDistance": 0, "status": "accepted"}},
            upsert=True,
        )
    except DuplicateKeyError:
        # Another player already holds this (normalized) name. Never leak who.
        return {"ok": False, "error": "USERNAME_TAKEN"}
    # allowed nickname registered -> reset the prohibited-name attempt counter
    await db.mod_attempts.delete_one({"playerId": req.playerId})
    return {"ok": True, "playerId": req.playerId, "nickname": name}


def classify(req: SubmitReq, mode: str):
    d = req.reportedDistance
    dur = req.runDuration
    # impossible / malformed
    if d is None or isinstance(d, bool) or not isinstance(d, (int, float)):
        return "rejected", "malformed"
    if math.isnan(d) or math.isinf(d) or d < 0:
        return "rejected", "nan-neg"
    if d > DIST_CAP:
        return "rejected", "over-cap"
    if dur is None or math.isnan(dur) or math.isinf(dur) or dur <= 0 or dur > 7200:
        return "rejected", "bad-duration"
    # distance-vs-time plausibility (with generous tolerance + startup buffer).
    # MAX_MPS is the standard ceiling; Easy Mode is slower, so this is still a
    # valid (lenient) upper bound for it.
    max_possible = dur * MAX_MPS * 1.15 + 60
    if d > max_possible:
        return "rejected", "too-fast"
    # chip sanity (secondary signal)
    if req.chipCount < 0 or req.chipCount > d * CHIP_CAP_RATIO + 30:
        return "rejected", "chips"
    # plausible but extreme -> flag (kept out of visible Top). Easy Mode tolerates
    # far larger legit distances.
    flag_at = FLAG_DISTANCE_EASY if mode == "easy" else FLAG_DISTANCE
    if d >= flag_at:
        return "flagged", "extreme"
    return "accepted", "ok"


@app.post("/api/leaderboard/submit")
async def submit(req: SubmitReq, request: Request):
    if ip_rate_limited(client_ip(request)):
        return {"ok": False, "error": "rate-limited"}
    if not valid_id(req.playerId) or not valid_id(req.runId):
        return {"ok": False, "error": "bad-id"}
    if rate_limited(req.playerId):
        return {"ok": False, "error": "rate-limited"}

    # Server decides the ruleset field from the (validated) mode. This is what
    # keeps Easy Mode runs out of the Global leaderboard: an Easy run can only
    # ever write to sillyBestDistance, never bestDistance.
    mode = norm_mode(req.mode)
    field = MODE_FIELD[mode]

    # replay protection: each runId processed once (unique index). Only a genuine
    # duplicate is treated as such — other DB errors are NOT masked.
    try:
        await db.runs.insert_one(
            {"runId": req.runId, "playerId": req.playerId, "mode": mode,
             "at": datetime.now(timezone.utc).isoformat(),
             "createdAt": datetime.now(timezone.utc)}  # BSON Date -> TTL retention
        )
    except DuplicateKeyError:
        return {"ok": False, "error": "duplicate-run"}

    status, reason = classify(req, mode)
    d = float(req.reportedDistance)

    # ensure player exists (nickname may come with submit for first-timers).
    # Enforce global case-insensitive uniqueness: if the normalized name is already
    # held by a DIFFERENT player, silently drop it so the score still records
    # (/register is the canonical place to surface USERNAME_TAKEN to the user).
    name = sanitize_nickname(req.nickname) if req.nickname else None
    if name and not moderation_ok(name):
        name = None  # moderation cannot be bypassed via direct submit
    norm = normalize_nickname(name) if name else None
    if norm:
        clash = await db.players.find_one(
            {"normalized_nickname": norm, "playerId": {"$ne": req.playerId}}, {"_id": 1}
        )
        if clash:
            name = None
            norm = None
    player = await db.players.find_one({"playerId": req.playerId})
    if not player and name:
        try:
            await db.players.insert_one(
                {"playerId": req.playerId, "nickname": name, "normalized_nickname": norm,
                 "bestDistance": 0, "sillyBestDistance": 0, "status": "accepted",
                 "updatedAt": datetime.now(timezone.utc).isoformat()}
            )
        except DuplicateKeyError:
            name = None
            norm = None

    if status != "accepted":
        # record attempt but never let it reach the visible leaderboard
        await db.flagged.insert_one(
            {"playerId": req.playerId, "runId": req.runId, "distance": d,
             "mode": mode, "status": status, "reason": reason,
             "at": datetime.now(timezone.utc).isoformat(),
             "createdAt": datetime.now(timezone.utc)}  # BSON Date -> TTL retention
        )
        cur = await db.players.find_one({"playerId": req.playerId}) or {}
        return {"ok": True, "status": status, "mode": mode,
                "bestDistance": cur.get(field, 0)}

    # atomic max update on the mode-specific field: best never decreases
    set_fields = {"updatedAt": datetime.now(timezone.utc).isoformat()}
    if name:
        set_fields["nickname"] = name
        set_fields["normalized_nickname"] = norm
    try:
        await db.players.update_one(
            {"playerId": req.playerId},
            [{"$set": {
                **set_fields,
                field: {"$max": [{"$ifNull": ["$" + field, 0]}, d]},
            }}],
            upsert=True,
        )
    except DuplicateKeyError:
        # Rare race: name got claimed between the check above and this write.
        # Drop the name and record the score anyway — never lose a legit run.
        set_fields.pop("nickname", None)
        set_fields.pop("normalized_nickname", None)
        await db.players.update_one(
            {"playerId": req.playerId},
            [{"$set": {
                **set_fields,
                field: {"$max": [{"$ifNull": ["$" + field, 0]}, d]},
            }}],
            upsert=True,
        )
    cur = await db.players.find_one({"playerId": req.playerId})
    best = cur.get(field, 0)
    rank = await db.players.count_documents({field: {"$gt": best}}) + 1
    return {"ok": True, "status": "accepted", "mode": mode,
            "bestDistance": best, "rank": rank}


@app.get("/api/leaderboard/top")
async def top(playerId: str | None = None, mode: str = "normal", limit: int = 100):
    limit = max(1, min(100, limit))
    # Strictly validate playerId using the same format rules as elsewhere;
    # ignore malformed values (still return the board, just without "you").
    pid = playerId if (playerId and valid_id(playerId)) else None
    field = MODE_FIELD[norm_mode(mode)]
    cursor = db.players.find(
        {field: {"$gt": 0}}, {"_id": 0, "nickname": 1, field: 1, "playerId": 1}
    ).sort(field, -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    top_list = []
    you = None
    for i, r in enumerate(rows):
        entry = {"rank": i + 1, "nickname": r.get("nickname", "Pigeon"),
                 "bestDistance": int(r.get(field, 0)),
                 "isYou": pid is not None and r.get("playerId") == pid}
        top_list.append(entry)

    if pid:
        me = await db.players.find_one({"playerId": pid})
        if me and me.get(field, 0) > 0:
            best = me.get(field, 0)
            rank = await db.players.count_documents({field: {"$gt": best}}) + 1
            you = {"rank": rank, "nickname": me.get("nickname", "Pigeon"),
                   "bestDistance": int(best), "inTop": rank <= len(top_list)}
    return {"ok": True, "mode": norm_mode(mode), "top": top_list, "you": you}
