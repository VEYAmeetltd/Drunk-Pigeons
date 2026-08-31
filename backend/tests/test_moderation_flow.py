"""Focused regression: Leaderboard moderation rejection counter + submit bypass."""
import os
import uuid
import time
import pytest
import requests
from pathlib import Path

# Read EXPO_PUBLIC_BACKEND_URL from frontend/.env (per problem statement)
def _load_base():
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")

BASE_URL = _load_base()
API = f"{BASE_URL}/api/leaderboard"

BANNED = ["fuckpigeon", "shitpigeon", "cuntpigeon"]


def new_pid():
    return "p" + uuid.uuid4().hex


@pytest.fixture
def sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestModerationCounter:
    def test_counter_increments_1_to_25(self, sess):
        pid = new_pid()
        for i in range(1, 26):
            name = BANNED[i % len(BANNED)]
            r = sess.post(f"{API}/register", json={"playerId": pid, "nickname": name})
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("ok") is False
            assert data.get("error") == "MODERATION"
            assert data.get("attempt") == i, f"expected attempt {i}, got {data}"

    def test_username_taken_does_not_increment(self, sess):
        # register a valid unique name first with player A
        pa = new_pid()
        good = f"GoodBird{uuid.uuid4().hex[:6]}"
        r = sess.post(f"{API}/register", json={"playerId": pa, "nickname": good})
        assert r.json().get("ok") is True

        # player B tries a banned name (attempt 1), then tries taken name (should not increment),
        # then banned again (should be attempt 2)
        pb = new_pid()
        r1 = sess.post(f"{API}/register", json={"playerId": pb, "nickname": "fuckpigeon"})
        assert r1.json().get("attempt") == 1

        r2 = sess.post(f"{API}/register", json={"playerId": pb, "nickname": good})
        d2 = r2.json()
        assert d2.get("ok") is False
        assert d2.get("error") == "USERNAME_TAKEN"
        assert "attempt" not in d2

        r3 = sess.post(f"{API}/register", json={"playerId": pb, "nickname": "shitpigeon"})
        assert r3.json().get("attempt") == 2, r3.json()

    def test_bad_name_does_not_increment(self, sess):
        pid = new_pid()
        r1 = sess.post(f"{API}/register", json={"playerId": pid, "nickname": "fuckpigeon"})
        assert r1.json().get("attempt") == 1

        # invalid (empty / too long / illegal chars)
        r2 = sess.post(f"{API}/register", json={"playerId": pid, "nickname": ""})
        assert r2.json().get("error") == "bad-name"
        assert "attempt" not in r2.json()

        r3 = sess.post(f"{API}/register", json={"playerId": pid, "nickname": "<script>"})
        assert r3.json().get("error") == "bad-name"

        r4 = sess.post(f"{API}/register", json={"playerId": pid, "nickname": "cuntpigeon"})
        assert r4.json().get("attempt") == 2, r4.json()

    def test_successful_register_resets_counter(self, sess):
        pid = new_pid()
        for i in range(1, 4):
            r = sess.post(f"{API}/register", json={"playerId": pid, "nickname": "fuckpigeon"})
            assert r.json().get("attempt") == i

        good = f"GoodBird{uuid.uuid4().hex[:6]}"
        r = sess.post(f"{API}/register", json={"playerId": pid, "nickname": good})
        assert r.json().get("ok") is True

        # counter must reset -> next banned attempt = 1
        # Note: this player's name is now locked, so try a fresh player? No — reset check is
        # about the counter, but same player registering a banned name returns MODERATION
        # (moderation check happens before NAME_LOCKED check).
        r2 = sess.post(f"{API}/register", json={"playerId": pid, "nickname": "shitpigeon"})
        d = r2.json()
        assert d.get("error") == "MODERATION"
        assert d.get("attempt") == 1, d


class TestSubmitBypass:
    def test_submit_with_banned_name_drops_name(self, sess):
        pid = new_pid()
        run_id = "r" + uuid.uuid4().hex
        # submit run with banned nickname
        payload = {
            "playerId": pid,
            "runId": run_id,
            "nickname": "fuckpigeon",
            "reportedDistance": 500.0,
            "runDuration": 60.0,
            "chipCount": 5,
            "mode": "normal",
        }
        r = sess.post(f"{API}/submit", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("status") == "accepted"

        # verify the banned name did NOT appear on leaderboard
        top = sess.get(f"{API}/top?playerId={pid}").json()
        nicks = [e["nickname"] for e in top.get("top", [])]
        assert "fuckpigeon" not in nicks
        # "you" entry either missing nickname or defaulted to "Pigeon"
        you = top.get("you")
        if you:
            assert you.get("nickname") != "fuckpigeon"
