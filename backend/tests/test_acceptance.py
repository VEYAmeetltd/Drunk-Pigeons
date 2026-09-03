"""Backend tests for anonymous rules-acceptance recording (legal compliance)."""
import uuid
from pathlib import Path

import requests

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


def test_accept_records_and_reads_back():
    pid = new_pid()
    r0 = requests.get(f"{API}/accept", params={"playerId": pid}, timeout=10).json()
    assert r0 == {"ok": True, "acceptedVersion": None}
    r1 = requests.post(f"{API}/accept", json={
        "playerId": pid,
        "acceptedVersion": "2.0|2.0|2.0",
        "documents": {"terms": "2.0", "leaderboard-rules": "2.0", "online-safety": "2.0"},
    }, timeout=10).json()
    assert r1["ok"] is True
    r2 = requests.get(f"{API}/accept", params={"playerId": pid}, timeout=10).json()
    assert r2["acceptedVersion"] == "2.0|2.0|2.0"


def test_accept_rejects_bad_id():
    r = requests.post(f"{API}/accept", json={"playerId": "not a valid id!", "acceptedVersion": "2.0"}, timeout=10).json()
    assert r["ok"] is False


def test_accept_version_change_overwrites():
    pid = new_pid()
    requests.post(f"{API}/accept", json={"playerId": pid, "acceptedVersion": "1.0|1.0|1.0"}, timeout=10)
    requests.post(f"{API}/accept", json={"playerId": pid, "acceptedVersion": "2.0|2.0|2.0"}, timeout=10)
    r = requests.get(f"{API}/accept", params={"playerId": pid}, timeout=10).json()
    assert r["acceptedVersion"] == "2.0|2.0|2.0"


def test_leaderboard_delete_removes_record_and_frees_nickname():
    import re
    pid = new_pid()
    name = "DelBird" + uuid.uuid4().hex[:8]
    r = requests.post(f"{API}/register", json={"playerId": pid, "nickname": name}, timeout=10).json()
    assert r.get("ok") is True
    # me() reports the registered nickname
    assert requests.get(f"{API}/me", params={"playerId": pid}, timeout=10).json()["nickname"] == name
    # delete without any email / support id — just the anonymous player key
    d = requests.post(f"{API}/delete", json={"playerId": pid}, timeout=10).json()
    assert d.get("ok") is True and d.get("deleted", 0) >= 1
    # record gone, nickname released
    assert requests.get(f"{API}/me", params={"playerId": pid}, timeout=10).json()["nickname"] is None
    assert requests.get(f"{API}/check", params={"nickname": name}, timeout=10).json().get("available") is True


def test_leaderboard_delete_rejects_bad_id():
    r = requests.post(f"{API}/delete", json={"playerId": "bad id!"}, timeout=10).json()
    assert r["ok"] is False


def test_report_nickname_ok_and_validation():
    pid = new_pid()
    r = requests.post(f"{API}/report", json={"reporterId": pid, "nickname": "RudeBird99", "reason": "offensive"}, timeout=10).json()
    assert r["ok"] is True
    # dedupe: same reporter+name again still ok
    r2 = requests.post(f"{API}/report", json={"reporterId": pid, "nickname": "RudeBird99"}, timeout=10).json()
    assert r2["ok"] is True
    assert requests.post(f"{API}/report", json={"reporterId": "bad id!", "nickname": "X"}, timeout=10).json()["ok"] is False
    assert requests.post(f"{API}/report", json={"reporterId": pid, "nickname": ""}, timeout=10).json()["ok"] is False
