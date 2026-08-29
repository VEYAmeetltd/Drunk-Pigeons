import os
import re
import math
import time
from datetime import datetime, timezone
from collections import defaultdict, deque
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

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
NICK_MAX = 16

BADWORDS = [
    "fuck", "shit", "cunt", "nigg", "faggot", "rape", "nazi", "paki", "retard",
    "bitch", "whore", "slut", "kkk", "hitler", "porn", "sex", "dick", "penis",
]

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
    low = re.sub(r"[^a-z]", "", name.lower())
    if any(b in low for b in BADWORDS):
        return None
    return name


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
    gameVersion: str = "1.0.0"


@app.on_event("startup")
async def _startup():
    await db.runs.create_index("runId", unique=True)
    await db.players.create_index("playerId", unique=True)
    await db.players.create_index([("bestDistance", -1)])


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/leaderboard/register")
async def register(req: RegisterReq):
    if not valid_id(req.playerId):
        return {"ok": False, "error": "bad-id"}
    name = sanitize_nickname(req.nickname)
    if not name:
        return {"ok": False, "error": "bad-name"}
    await db.players.update_one(
        {"playerId": req.playerId},
        {"$set": {"nickname": name, "updatedAt": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"bestDistance": 0, "status": "accepted"}},
        upsert=True,
    )
    return {"ok": True, "playerId": req.playerId, "nickname": name}


def classify(req: SubmitReq):
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
    # distance-vs-time plausibility (with generous tolerance + startup buffer)
    max_possible = dur * MAX_MPS * 1.15 + 60
    if d > max_possible:
        return "rejected", "too-fast"
    # chip sanity (secondary signal)
    if req.chipCount < 0 or req.chipCount > d * CHIP_CAP_RATIO + 30:
        return "rejected", "chips"
    # plausible but extreme -> flag (kept out of visible Top)
    if d >= FLAG_DISTANCE:
        return "flagged", "extreme"
    return "accepted", "ok"


@app.post("/api/leaderboard/submit")
async def submit(req: SubmitReq):
    if not valid_id(req.playerId) or not valid_id(req.runId):
        return {"ok": False, "error": "bad-id"}
    if rate_limited(req.playerId):
        return {"ok": False, "error": "rate-limited"}

    # replay protection: each runId processed once
    try:
        await db.runs.insert_one(
            {"runId": req.runId, "playerId": req.playerId,
             "at": datetime.now(timezone.utc).isoformat()}
        )
    except Exception:
        return {"ok": False, "error": "duplicate-run"}

    status, reason = classify(req)
    d = float(req.reportedDistance)

    # ensure player exists (nickname may come with submit for first-timers)
    name = sanitize_nickname(req.nickname) if req.nickname else None
    player = await db.players.find_one({"playerId": req.playerId})
    if not player and name:
        await db.players.insert_one(
            {"playerId": req.playerId, "nickname": name, "bestDistance": 0,
             "status": "accepted", "updatedAt": datetime.now(timezone.utc).isoformat()}
        )

    if status != "accepted":
        # record attempt but never let it reach the visible leaderboard
        await db.flagged.insert_one(
            {"playerId": req.playerId, "runId": req.runId, "distance": d,
             "status": status, "reason": reason,
             "at": datetime.now(timezone.utc).isoformat()}
        )
        cur = await db.players.find_one({"playerId": req.playerId}) or {}
        return {"ok": True, "status": status, "bestDistance": cur.get("bestDistance", 0)}

    # atomic max update: best never decreases
    set_fields = {"updatedAt": datetime.now(timezone.utc).isoformat()}
    if name:
        set_fields["nickname"] = name
    await db.players.update_one(
        {"playerId": req.playerId},
        [{"$set": {
            **set_fields,
            "bestDistance": {"$max": [{"$ifNull": ["$bestDistance", 0]}, d]},
        }}],
        upsert=True,
    )
    cur = await db.players.find_one({"playerId": req.playerId})
    best = cur.get("bestDistance", 0)
    rank = await db.players.count_documents({"bestDistance": {"$gt": best}}) + 1
    return {"ok": True, "status": "accepted", "bestDistance": best, "rank": rank}


@app.get("/api/leaderboard/top")
async def top(playerId: str | None = None, limit: int = 100):
    limit = max(1, min(100, limit))
    cursor = db.players.find(
        {"bestDistance": {"$gt": 0}}, {"_id": 0, "nickname": 1, "bestDistance": 1, "playerId": 1}
    ).sort("bestDistance", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    top_list = []
    you = None
    for i, r in enumerate(rows):
        entry = {"rank": i + 1, "nickname": r.get("nickname", "Pigeon"),
                 "bestDistance": int(r.get("bestDistance", 0)),
                 "isYou": playerId is not None and r.get("playerId") == playerId}
        top_list.append(entry)

    if playerId:
        me = await db.players.find_one({"playerId": playerId})
        if me and me.get("bestDistance", 0) > 0:
            best = me.get("bestDistance", 0)
            rank = await db.players.count_documents({"bestDistance": {"$gt": best}}) + 1
            you = {"rank": rank, "nickname": me.get("nickname", "Pigeon"),
                   "bestDistance": int(best), "inTop": rank <= len(top_list)}
    return {"ok": True, "top": top_list, "you": you}
