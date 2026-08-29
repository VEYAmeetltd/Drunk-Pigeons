"""Backend tests for mode-based routing (Global vs Silly/Easy).

Verifies:
- mode='normal' submissions only update bestDistance (Global) and appear only in
  /top?mode=normal.
- mode='easy' submissions only update sillyBestDistance and appear only in
  /top?mode=easy.
- Easy Mode anti-cheat tolerance (huge distances accepted, not flagged).
- Server-decided routing: an easy-magnitude distance with mode='easy' NEVER
  leaks into Global.
- Existing anti-cheat still applies in both modes.
"""
import os
import re
import uuid
import pytest
import requests
from pathlib import Path

FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
BASE_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"
API = f"{BASE_URL}/api/leaderboard"


def new_pid():
    return "p" + uuid.uuid4().hex


def new_rid():
    return "r" + uuid.uuid4().hex


@pytest.fixture
def s():
    ses = requests.Session()
    ses.headers.update({"Content-Type": "application/json"})
    return ses


def _register(s, name):
    pid = new_pid()
    r = s.post(f"{API}/register", json={"playerId": pid, "nickname": name}).json()
    assert r.get("ok"), r
    return pid


# -------- Independence of normal vs easy best distances --------
class TestModeIndependence:
    def test_normal_only_updates_global(self, s):
        pid = _register(s, "NormOnly" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 1200, "runDuration": 100,
            "mode": "normal",
        }).json()
        assert r.get("ok") and r.get("status") == "accepted"
        assert r.get("mode") == "normal"
        assert r.get("bestDistance") >= 1200

        # Global top: should contain player with distance >=1200
        g = s.get(f"{API}/top", params={"playerId": pid, "mode": "normal", "limit": 100}).json()
        assert g.get("ok") and g.get("mode") == "normal"
        me_global = g.get("you")
        assert me_global is not None and me_global.get("bestDistance") >= 1200

        # Silly top: player must NOT be there — no silly submission yet
        sl = s.get(f"{API}/top", params={"playerId": pid, "mode": "easy", "limit": 100}).json()
        assert sl.get("ok") and sl.get("mode") == "easy"
        assert sl.get("you") is None

    def test_easy_only_updates_silly(self, s):
        pid = _register(s, "EasyOnly" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 3000, "runDuration": 260,
            "mode": "easy",
        }).json()
        assert r.get("ok") and r.get("status") == "accepted", r
        assert r.get("mode") == "easy"
        assert r.get("bestDistance") >= 3000

        # Silly top: contains player
        sl = s.get(f"{API}/top", params={"playerId": pid, "mode": "easy", "limit": 100}).json()
        assert sl.get("ok") and sl.get("you") is not None
        assert sl["you"]["bestDistance"] >= 3000

        # Global top: player must NOT be there
        g = s.get(f"{API}/top", params={"playerId": pid, "mode": "normal", "limit": 100}).json()
        assert g.get("ok") and g.get("you") is None

    def test_both_modes_independent_bests(self, s):
        pid = _register(s, "Both" + uuid.uuid4().hex[:4])
        # Normal 800m
        s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 800, "runDuration": 70, "mode": "normal",
        })
        # Easy 5000m
        s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 5000, "runDuration": 450, "mode": "easy",
        })
        g = s.get(f"{API}/top", params={"playerId": pid, "mode": "normal"}).json()
        sl = s.get(f"{API}/top", params={"playerId": pid, "mode": "easy"}).json()
        assert g["you"]["bestDistance"] == 800
        assert sl["you"]["bestDistance"] >= 5000
        # boards are independent — global doesn't know about 5000, silly doesn't know about 800
        assert g["you"]["bestDistance"] != sl["you"]["bestDistance"]


# -------- Easy Mode anti-cheat tolerance --------
class TestEasyAntiCheatTolerance:
    def test_long_easy_run_18000_accepted(self, s):
        """Legit long easy run: 18000m over 1600s. ~11.25 m/s ≤ 15.83."""
        pid = _register(s, "Silly18k" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 18000, "runDuration": 1600, "mode": "easy",
        }).json()
        assert r.get("ok") and r.get("status") == "accepted", r
        # Should appear in Silly top
        sl = s.get(f"{API}/top", params={"playerId": pid, "mode": "easy", "limit": 100}).json()
        assert sl.get("you") is not None
        # inTop OR you.rank populated
        found = any(row.get("bestDistance", 0) >= 18000 and row.get("isYou") for row in sl.get("top", []))
        assert found or (sl["you"]["bestDistance"] >= 18000)

    def test_long_easy_run_30000_accepted(self, s):
        """Even longer: 30000m over 2500s. Below FLAG_DISTANCE_EASY=250000."""
        pid = _register(s, "Silly30k" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 30000, "runDuration": 2500, "mode": "easy",
        }).json()
        assert r.get("ok") and r.get("status") == "accepted", r
        assert r.get("bestDistance") >= 30000

    def test_normal_flag_at_40000_still_enforced(self, s):
        """Normal-mode flag at 40000m: even with plausible speed it should be flagged (not accepted)."""
        pid = _register(s, "NormBig" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 45000, "runDuration": 3200, "mode": "normal",
        }).json()
        assert r.get("ok") and r.get("status") == "flagged", r
        # Player must not be in Global top with 45000m
        g = s.get(f"{API}/top", params={"playerId": pid, "mode": "normal", "limit": 100}).json()
        assert g.get("you") is None


# -------- Anti-cheat still works in both modes --------
class TestAntiCheatBothModes:
    @pytest.mark.parametrize("mode", ["normal", "easy"])
    def test_negative_rejected(self, s, mode):
        pid = _register(s, f"Neg{mode}" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": -100, "runDuration": 20, "mode": mode,
        }).json()
        assert r.get("status") == "rejected"
        # Not on either top
        for m in ("normal", "easy"):
            top = s.get(f"{API}/top", params={"playerId": pid, "mode": m}).json()
            assert top.get("you") is None

    @pytest.mark.parametrize("mode", ["normal", "easy"])
    def test_too_fast_rejected(self, s, mode):
        pid = _register(s, f"Fast{mode}" + uuid.uuid4().hex[:4])
        # 10000m in 5s => far above MAX_MPS*1.15*5+60
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 10000, "runDuration": 5, "mode": mode,
        }).json()
        assert r.get("status") == "rejected"

    @pytest.mark.parametrize("mode", ["normal", "easy"])
    def test_duplicate_runid(self, s, mode):
        pid = _register(s, f"Dup{mode}" + uuid.uuid4().hex[:4])
        rid = new_rid()
        payload = {"playerId": pid, "runId": rid,
                   "reportedDistance": 400, "runDuration": 40, "mode": mode}
        first = s.post(f"{API}/submit", json=payload).json()
        assert first.get("ok") and first.get("status") == "accepted"
        second = s.post(f"{API}/submit", json=payload).json()
        assert second == {"ok": False, "error": "duplicate-run"}

    def test_bad_playerid(self, s):
        r = s.post(f"{API}/submit", json={
            "playerId": "short", "runId": new_rid(),
            "reportedDistance": 100, "runDuration": 20, "mode": "easy",
        }).json()
        assert r == {"ok": False, "error": "bad-id"}

    def test_bad_runid(self, s):
        pid = _register(s, "BadR" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": "x",
            "reportedDistance": 100, "runDuration": 20, "mode": "easy",
        }).json()
        assert r == {"ok": False, "error": "bad-id"}

    def test_nan_rejected(self, s):
        pid = _register(s, "NaN" + uuid.uuid4().hex[:4])
        # requests will serialise float('nan') as NaN which fastapi/pydantic may reject at parse.
        # Test via json string manually.
        r = requests.post(f"{API}/submit",
                          data='{"playerId":"' + pid + '","runId":"' + new_rid() + '","reportedDistance":NaN,"runDuration":30,"mode":"easy"}',
                          headers={"Content-Type": "application/json"})
        # Either pydantic rejects with 4xx OR server returns status=rejected. Both acceptable.
        if r.status_code == 200:
            assert r.json().get("status") == "rejected"
        else:
            assert r.status_code >= 400


# -------- Mode routing: easy-magnitude never in Global --------
class TestModeRoutingProtection:
    def test_easy_magnitude_run_never_in_global(self, s):
        """The core guarantee: a very long easy run (would look like cheating in
        Global) with mode='easy' lands ONLY in Silly and NEVER in Global top."""
        pid = _register(s, "Guard" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 22000, "runDuration": 2000, "mode": "easy",
        }).json()
        assert r.get("status") == "accepted" and r.get("mode") == "easy"

        # Fetch a large Global top and assert player NOT in it
        g = s.get(f"{API}/top", params={"playerId": pid, "mode": "normal", "limit": 100}).json()
        assert g.get("you") is None
        for row in g.get("top", []):
            assert row.get("isYou") is False

        # But present in Silly
        sl = s.get(f"{API}/top", params={"playerId": pid, "mode": "easy", "limit": 100}).json()
        assert sl.get("you") is not None
        assert sl["you"]["bestDistance"] >= 22000

    def test_default_mode_is_normal(self, s):
        """Omitting mode should default to 'normal' -> Global only."""
        pid = _register(s, "Def" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 700, "runDuration": 60,
        }).json()
        assert r.get("ok") and r.get("status") == "accepted"
        assert r.get("mode") == "normal"

    def test_unknown_mode_treated_as_normal(self, s):
        pid = _register(s, "Unk" + uuid.uuid4().hex[:4])
        r = s.post(f"{API}/submit", json={
            "playerId": pid, "runId": new_rid(),
            "reportedDistance": 600, "runDuration": 60, "mode": "hardcore",
        }).json()
        assert r.get("ok") and r.get("status") == "accepted"
        assert r.get("mode") == "normal"
        # In Global, not Silly
        g = s.get(f"{API}/top", params={"playerId": pid, "mode": "normal"}).json()
        sl = s.get(f"{API}/top", params={"playerId": pid, "mode": "easy"}).json()
        assert g.get("you") is not None
        assert sl.get("you") is None
