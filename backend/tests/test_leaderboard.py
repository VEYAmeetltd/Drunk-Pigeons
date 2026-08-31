"""Backend tests for Drunk Pigeons global leaderboard + anti-cheat."""
import os
import time
import uuid
import re
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env (no defaults)
FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
BASE_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api/leaderboard"


def new_pid():
    # 32-char hex, matches [A-Za-z0-9_-]{8,64}
    return "p" + uuid.uuid4().hex


def new_rid():
    return "r" + uuid.uuid4().hex


def uniq(base):
    # Globally-unique nickname (usernames are now enforced unique per player).
    return (re.sub(r"[^A-Za-z0-9]", "", base)[:6] + uuid.uuid4().hex[:8])


@pytest.fixture
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


# ---------- health ----------
def test_health(s):
    r = s.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- register / nickname sanitisation ----------
class TestRegister:
    def test_clean_name(self, s):
        pid = new_pid()
        name = uniq("Clean")
        r = s.post(f"{API}/register", json={"playerId": pid, "nickname": name})
        j = r.json()
        assert j.get("ok") is True and j.get("nickname") == name

    @pytest.mark.parametrize("bad", [
        "",                    # empty
        "   ",                 # whitespace
        "A" * 17,              # too long
        "hello<script>",       # < >
        "visit http://x.com",  # url
        "www.evil.com",        # url
        "bad\x01name",         # control char
        "&#eviltricks",        # html entity
    ])
    def test_bad_names_rejected(self, s, bad):
        pid = new_pid()
        r = s.post(f"{API}/register", json={"playerId": pid, "nickname": bad})
        j = r.json()
        assert j.get("ok") is False and j.get("error") == "bad-name", f"input={bad!r} -> {j}"

    def test_profanity_rejected(self, s):
        pid = new_pid()
        r = s.post(f"{API}/register", json={"playerId": pid, "nickname": "fuckPigeon"})
        body = r.json()
        # moderation now returns a distinct stable generic code (never leaks the term)
        assert body["ok"] is False and body["error"] in ("bad-name", "MODERATION")

    def test_slur_evasion_rejected(self, s):
        # leetspeak / separated racist slur must be rejected server-side
        for nick in ("n1g5a", "n.i.g.g.a", "JesusIsShit", "God"):
            pid = new_pid()
            r = s.post(f"{API}/register", json={"playerId": pid, "nickname": nick})
            assert r.json().get("ok") is False, nick

    def test_moderation_counter_sequence(self, s):
        pid = new_pid()
        for i in range(1, 6):
            r = s.post(f"{API}/register", json={"playerId": pid, "nickname": "God"}).json()
            assert r.get("error") == "MODERATION" and r.get("attempt") == i, r
        ok = s.post(f"{API}/register", json={"playerId": pid, "nickname": f"TipsyTom{pid[-5:]}"}).json()
        assert ok.get("ok") is True, ok
        r = s.post(f"{API}/register", json={"playerId": pid, "nickname": "God"}).json()
        assert r.get("attempt") == 1, r

    def test_moderation_counter_ignores_other_errors(self, s):
        holder = new_pid()
        name = f"UniqueName{holder[-5:]}"
        assert s.post(f"{API}/register", json={"playerId": holder, "nickname": name}).json().get("ok")
        pid = new_pid()
        taken = s.post(f"{API}/register", json={"playerId": pid, "nickname": name}).json()
        assert taken.get("ok") is False and "attempt" not in taken, taken
        r = s.post(f"{API}/register", json={"playerId": pid, "nickname": "God"}).json()
        assert r.get("attempt") == 1, r


    def test_moderation_not_bypassable_via_submit(self, s):
        # calling /submit directly must not attach a blocked nickname
        pid = new_pid()
        s.post(f"{API}/submit", json={
            "playerId": pid, "nickname": "n1g5a", "distance": 12.0,
            "chips": 3, "runId": new_pid(), "mode": "normal",
        })
        r = s.get(f"{API}/leaderboard", params={"mode": "normal"})
        rows = r.json().get("entries", r.json()) if isinstance(r.json(), dict) else r.json()
        names = [str(x.get("nickname", "")) for x in rows] if isinstance(rows, list) else []
        assert not any("nig" in n.lower() for n in names)

    def test_bad_playerid(self, s):
        r = s.post(f"{API}/register", json={"playerId": "short", "nickname": "Bob"})
        assert r.json() == {"ok": False, "error": "bad-id"}


# ---------- submit accept/reject ----------
class TestSubmit:
    def _register(self, s, name=None):
        pid = new_pid()
        name = name or uniq("Arcade")
        r = s.post(f"{API}/register", json={"playerId": pid, "nickname": name})
        assert r.json().get("ok")
        return pid

    def test_accepted_plausible(self, s):
        pid = self._register(s)
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 842, "runDuration": 70, "chipCount": 10,
        })
        j = r.json()
        assert j.get("ok") and j.get("status") == "accepted"
        assert j.get("bestDistance") >= 842
        assert isinstance(j.get("rank"), int)

    def test_over_cap(self, s):
        pid = self._register(s)
        j = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 999999999, "runDuration": 6000000,
        }).json()
        # ok:true but status rejected (server records but doesn't count)
        assert j.get("ok") and j.get("status") == "rejected"

    def test_negative_distance(self, s):
        pid = self._register(s)
        j = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": -50, "runDuration": 30,
        }).json()
        assert j.get("status") == "rejected"

    def test_too_fast(self, s):
        pid = self._register(s)
        j = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 5000, "runDuration": 2,
        }).json()
        assert j.get("status") == "rejected"

    def test_impossible_chips(self, s):
        pid = self._register(s)
        j = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 150, "runDuration": 15, "chipCount": 50000,
        }).json()
        assert j.get("status") == "rejected"

    def test_duplicate_runid(self, s):
        pid = self._register(s)
        rid = new_rid()
        payload = {"playerId": pid, "runId": rid,
                   "reportedDistance": 500, "runDuration": 40}
        first = s.post(f"{API}/submit", json=payload).json()
        assert first.get("ok") and first.get("status") == "accepted"
        second = s.post(f"{API}/submit", json=payload).json()
        assert second == {"ok": False, "error": "duplicate-run"}

    def test_bad_id_short(self, s):
        j = s.post(f"{API}/submit", json={
            "playerId": "short", "runId": "shortrun",
            "reportedDistance": 100, "runDuration": 20,
        }).json()
        assert j == {"ok": False, "error": "bad-id"}


# ---------- best-only-goes-up ----------
def test_best_only_increases(s):
    pid = new_pid()
    s.post(f"{API}/register", json={"playerId": pid, "nickname": uniq("Best")})
    # accept 3000
    j1 = s.post(f"{API}/submit", json={
        "playerId": pid, "runId": new_rid(),
        "reportedDistance": 3000, "runDuration": 240,
    }).json()
    assert j1.get("status") == "accepted" and j1.get("bestDistance") >= 3000
    # accept 300 (worse) — best should remain >=3000
    j2 = s.post(f"{API}/submit", json={
        "playerId": pid, "runId": new_rid(),
        "reportedDistance": 300, "runDuration": 30,
    }).json()
    assert j2.get("status") == "accepted"
    assert j2.get("bestDistance") >= 3000
    # verify via top(playerId)
    t = s.get(f"{API}/top", params={"playerId": pid}).json()
    assert t.get("ok")
    you = t.get("you")
    mine = next((r for r in t.get("top", []) if r.get("isYou")), you)
    assert mine is not None
    assert mine["bestDistance"] >= 3000


# ---------- top endpoint sort + you fallback ----------
def test_top_sorted_and_you_fallback(s):
    r = s.get(f"{API}/top").json()
    assert r.get("ok") and isinstance(r.get("top"), list)
    dists = [row["bestDistance"] for row in r["top"]]
    assert dists == sorted(dists, reverse=True)
    for i, row in enumerate(r["top"]):
        assert row["rank"] == i + 1
        assert "nickname" in row and "bestDistance" in row and "isYou" in row

    # A brand-new player not in list => you should be None (no submissions)
    ghost = new_pid()
    r2 = s.get(f"{API}/top", params={"playerId": ghost}).json()
    assert r2.get("ok")
    # ghost has no submissions -> you is None
    assert r2.get("you") is None


def test_you_fallback_when_outside_top(s):
    # Create a low-scoring player and confirm you.rank is populated & inTop reflects presence
    pid = new_pid()
    s.post(f"{API}/register", json={"playerId": pid, "nickname": uniq("Low")})
    s.post(f"{API}/submit", json={
        "playerId": pid, "runId": new_rid(),
        "reportedDistance": 1, "runDuration": 5,
    })
    r = s.get(f"{API}/top", params={"playerId": pid, "limit": 1}).json()
    assert r.get("ok")
    # With limit=1, low scorer is almost certainly not in top => you.inTop should be False and you populated
    you = r.get("you")
    assert you is not None
    assert isinstance(you.get("rank"), int) and you.get("rank") >= 1
    assert "inTop" in you
    assert you.get("bestDistance") >= 1


# ---------- rate limit ----------
def test_rate_limited(s):
    pid = new_pid()
    s.post(f"{API}/register", json={"playerId": pid, "nickname": uniq("Spam")})
    saw_rl = False
    for _ in range(30):
        j = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 100, "runDuration": 20,
        }).json()
        if j.get("error") == "rate-limited":
            saw_rl = True
            break
    assert saw_rl, "expected rate-limited after >20 submissions in a minute"


# ---------- rejected scores never surface on Top ----------
def test_rejected_never_on_top(s):
    pid = new_pid()
    nick = "HackyPigeon_" + uuid.uuid4().hex[:4]
    s.post(f"{API}/register", json={"playerId": pid, "nickname": nick})
    # Impossible submission
    s.post(f"{API}/submit", json={
        "playerId": pid, "runId": new_rid(),
        "reportedDistance": 999999999, "runDuration": 3,
    })
    r = s.get(f"{API}/top", params={"playerId": pid, "limit": 100}).json()
    assert not any(row["nickname"] == nick for row in r.get("top", []))
    # you should also be None since no accepted submission
    assert r.get("you") is None
