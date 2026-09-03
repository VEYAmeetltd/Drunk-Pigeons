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
