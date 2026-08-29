"""
Backend tests for Drunk Pigeons leaderboard security hardening (iteration 13).

Covers:
- normal register/submit/top flow
- duplicate runId replay protection (P3a)
- top playerId validation (P3b) with malformed / injection-style ids
- mode separation (normal vs easy)
- anti-cheat rejections
- rate limiting sanity (a small burst should NOT trip 240/min IP limit)
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Read from frontend/.env directly as a fallback
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

API = f"{BASE_URL}/api"


def new_pid():
    return uuid.uuid4().hex  # 32 hex chars -> matches valid_id regex


def new_runid():
    return uuid.uuid4().hex


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- Health / basic ----------
def test_health(s):
    r = s.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Normal flow ----------
def test_register_ok(s):
    pid = new_pid()
    r = s.post(f"{API}/leaderboard/register",
               json={"playerId": pid, "nickname": "TEST_Bob"}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["playerId"] == pid
    assert body["nickname"] == "TEST_Bob"


def test_submit_accepted_and_top(s):
    pid = new_pid()
    # register
    s.post(f"{API}/leaderboard/register",
           json={"playerId": pid, "nickname": "TEST_Alice"}, timeout=15)
    run = new_runid()
    r = s.post(f"{API}/leaderboard/submit", json={
        "playerId": pid, "runId": run, "nickname": "TEST_Alice",
        "reportedDistance": 500.0, "runDuration": 60.0, "chipCount": 20,
        "mode": "normal",
    }, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["status"] == "accepted"
    assert body["mode"] == "normal"
    assert body["bestDistance"] >= 500
    assert isinstance(body["rank"], int) and body["rank"] >= 1

    # top w/ playerId returns you
    r2 = s.get(f"{API}/leaderboard/top",
               params={"playerId": pid, "mode": "normal", "limit": 50}, timeout=15)
    assert r2.status_code == 200
    j = r2.json()
    assert j["ok"] is True
    assert j["mode"] == "normal"
    assert isinstance(j["top"], list)
    assert j["you"] is not None
    assert j["you"]["bestDistance"] >= 500


# ---------- P3a: Duplicate runId ----------
def test_duplicate_runid_rejected(s):
    pid = new_pid()
    run = new_runid()
    payload = {"playerId": pid, "runId": run, "nickname": "TEST_Dup",
               "reportedDistance": 300.0, "runDuration": 40.0, "chipCount": 5,
               "mode": "normal"}
    r1 = s.post(f"{API}/leaderboard/submit", json=payload, timeout=15)
    assert r1.status_code == 200
    assert r1.json()["ok"] is True

    r2 = s.post(f"{API}/leaderboard/submit", json=payload, timeout=15)
    assert r2.status_code == 200
    body = r2.json()
    assert body["ok"] is False
    assert body["error"] == "duplicate-run"


# ---------- P3b: malformed playerId on /top ----------
@pytest.mark.parametrize("bad_pid", [
    "' OR 1=1",
    "   ",
    "$ne",
    "{\"$gt\":\"\"}",
    "a" * 500,
    "short",           # <8 chars
    "bad!chars@here",  # symbols not allowed
    "../etc/passwd",
])
def test_top_malformed_playerId_ignored(s, bad_pid):
    r = s.get(f"{API}/leaderboard/top",
              params={"playerId": bad_pid, "mode": "normal"}, timeout=15)
    assert r.status_code == 200, f"pid={bad_pid!r} -> {r.status_code} {r.text}"
    j = r.json()
    assert j["ok"] is True
    assert isinstance(j["top"], list)
    assert j["you"] is None


def test_top_unknown_wellformed_pid_you_null(s):
    pid = new_pid()  # well-formed but never submitted
    r = s.get(f"{API}/leaderboard/top",
              params={"playerId": pid, "mode": "normal"}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["you"] is None


# ---------- Mode separation ----------
def test_mode_separation(s):
    pid = new_pid()
    s.post(f"{API}/leaderboard/register",
           json={"playerId": pid, "nickname": "TEST_Modey"}, timeout=15)

    # easy submit
    r_easy = s.post(f"{API}/leaderboard/submit", json={
        "playerId": pid, "runId": new_runid(), "nickname": "TEST_Modey",
        "reportedDistance": 800.0, "runDuration": 120.0, "chipCount": 30,
        "mode": "easy",
    }, timeout=15)
    assert r_easy.status_code == 200
    ej = r_easy.json()
    assert ej["ok"] and ej["status"] == "accepted" and ej["mode"] == "easy"

    # normal board should NOT contain this player
    rn = s.get(f"{API}/leaderboard/top",
               params={"playerId": pid, "mode": "normal"}, timeout=15).json()
    assert rn["you"] is None, f"easy run leaked into normal: {rn['you']}"

    # easy board SHOULD contain it
    re_ = s.get(f"{API}/leaderboard/top",
                params={"playerId": pid, "mode": "easy"}, timeout=15).json()
    assert re_["you"] is not None
    assert re_["you"]["bestDistance"] >= 800

    # now standard submit for same player
    r_norm = s.post(f"{API}/leaderboard/submit", json={
        "playerId": pid, "runId": new_runid(), "nickname": "TEST_Modey",
        "reportedDistance": 400.0, "runDuration": 60.0, "chipCount": 10,
        "mode": "normal",
    }, timeout=15)
    assert r_norm.json()["status"] == "accepted"

    # normal board should now show 400, easy remains 800
    rn2 = s.get(f"{API}/leaderboard/top",
                params={"playerId": pid, "mode": "normal"}, timeout=15).json()
    assert rn2["you"] and rn2["you"]["bestDistance"] == 400
    re2 = s.get(f"{API}/leaderboard/top",
                params={"playerId": pid, "mode": "easy"}, timeout=15).json()
    assert re2["you"] and re2["you"]["bestDistance"] == 800


# ---------- Anti-cheat ----------
def test_anticheat_negative(s):
    pid = new_pid()
    r = s.post(f"{API}/leaderboard/submit", json={
        "playerId": pid, "runId": new_runid(), "nickname": "TEST_Neg",
        "reportedDistance": -10.0, "runDuration": 20.0, "chipCount": 0,
        "mode": "normal",
    }, timeout=15).json()
    assert r["ok"] is True and r["status"] == "rejected"


def test_anticheat_too_fast(s):
    pid = new_pid()
    # 100000m in 1s -> way beyond MAX_MPS*1.15 + 60
    r = s.post(f"{API}/leaderboard/submit", json={
        "playerId": pid, "runId": new_runid(), "nickname": "TEST_Fast",
        "reportedDistance": 99999.0, "runDuration": 1.0, "chipCount": 0,
        "mode": "normal",
    }, timeout=15).json()
    assert r["status"] == "rejected"


def test_anticheat_bad_id(s):
    r = s.post(f"{API}/leaderboard/submit", json={
        "playerId": "bad id!!", "runId": new_runid(), "nickname": "x",
        "reportedDistance": 100.0, "runDuration": 10.0, "chipCount": 0,
        "mode": "normal",
    }, timeout=15).json()
    assert r["ok"] is False and r["error"] == "bad-id"

    r2 = s.post(f"{API}/leaderboard/submit", json={
        "playerId": new_pid(), "runId": "!!bad!!", "nickname": "x",
        "reportedDistance": 100.0, "runDuration": 10.0, "chipCount": 0,
        "mode": "normal",
    }, timeout=15).json()
    assert r2["ok"] is False and r2["error"] == "bad-id"


# ---------- Rate limit sanity (IP limit is 240/min, small burst must not trip) ----------
def test_normal_burst_not_ip_ratelimited(s):
    # 10 register calls with different playerIds - way under 240 IP limit
    errors = []
    for _ in range(10):
        r = s.post(f"{API}/leaderboard/register",
                   json={"playerId": new_pid(), "nickname": "TEST_Burst"},
                   timeout=15).json()
        if not r.get("ok"):
            errors.append(r)
    assert not errors, f"Legit burst got rate-limited: {errors[:3]}"


def test_per_player_ratelimit_hit(s):
    # Same playerId hammered >20/min should hit per-playerId cap
    pid = new_pid()
    s.post(f"{API}/leaderboard/register",
           json={"playerId": pid, "nickname": "TEST_RL"}, timeout=15)
    hit = False
    for _ in range(25):
        r = s.post(f"{API}/leaderboard/submit", json={
            "playerId": pid, "runId": new_runid(), "nickname": "TEST_RL",
            "reportedDistance": 100.0, "runDuration": 20.0, "chipCount": 0,
            "mode": "normal",
        }, timeout=15).json()
        if r.get("error") == "rate-limited":
            hit = True
            break
    assert hit, "Expected per-playerId rate limit to trigger within 25 requests"
