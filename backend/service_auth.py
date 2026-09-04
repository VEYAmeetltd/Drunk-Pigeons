"""Server-to-server authentication for the INTIES Admin Dashboard integration.

Never exposed to any browser/frontend. The Drunk Pigeons service credential lives
ONLY in backend environment variables (INTIES_SERVICE_KEY_ID / INTIES_SERVICE_SECRET,
plus an optional _PREV pair for zero-downtime rotation) and is never logged, returned
in a response, or written to documentation.

Every request to a protected endpoint must carry:
  X-Service-Key : key id (identifies WHICH secret to verify against — not a secret itself)
  X-Timestamp   : unix seconds
  X-Nonce       : random string, 16-128 chars [A-Za-z0-9_-], unique per request
  X-Signature   : hex HMAC-SHA256 of the canonical string below, using the shared secret

Canonical string (newline-joined):
  {METHOD}\n{PATH}?{CANONICAL_QUERY}\n{SHA256_HEX(RAW_BODY)}\n{TIMESTAMP}\n{NONCE}
(when there is no query string, it's just {PATH} with no trailing "?")

Fails closed on any missing/malformed/mismatched component (generic 401, no detail
about which check failed). See /app/docs/INTIES_DRUNK_PIGEONS_INTEGRATION_CONTRACT.md
for the full contract with worked examples.
"""
import os
import re
import hmac
import hashlib
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import Request, HTTPException
from pymongo.errors import DuplicateKeyError

from advertising import client_ip, rate_limit

TS_WINDOW_S = 300          # +/- 5 minutes clock skew tolerance
NONCE_RE = re.compile(r"^[A-Za-z0-9_\-]{16,128}$")
RATE_LIMIT = 120           # requests
RATE_WINDOW_S = 60         # per key, per minute


def _configured_secrets():
    """key_id -> secret, for every configured (current + previous) credential slot."""
    out = {}
    kid = os.environ.get("INTIES_SERVICE_KEY_ID", "")
    sec = os.environ.get("INTIES_SERVICE_SECRET", "")
    if kid and sec:
        out[kid] = sec
    kid_prev = os.environ.get("INTIES_SERVICE_KEY_ID_PREV", "")
    sec_prev = os.environ.get("INTIES_SERVICE_SECRET_PREV", "")
    if kid_prev and sec_prev:
        out[kid_prev] = sec_prev
    return out


def _canonical_query(request: Request) -> str:
    items = sorted(request.query_params.multi_items())
    return urlencode(items)


async def require_service_auth(request: Request):
    """FastAPI dependency: verifies the full signed-request contract. Raises 401/429."""
    key_id = request.headers.get("x-service-key", "")
    ts_raw = request.headers.get("x-timestamp", "")
    nonce = request.headers.get("x-nonce", "")
    sig = request.headers.get("x-signature", "")

    if not (key_id and ts_raw and nonce and sig):
        raise HTTPException(status_code=401, detail="Not authenticated")

    secrets_map = _configured_secrets()
    secret = secrets_map.get(key_id)
    if not secret:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not rate_limit(f"svc:{key_id}", limit=RATE_LIMIT, window_s=RATE_WINDOW_S):
        raise HTTPException(status_code=429, detail="Too many requests")

    try:
        ts_int = int(ts_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Not authenticated")
    if abs(int(time.time()) - ts_int) > TS_WINDOW_S:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not NONCE_RE.match(nonce):
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.body()
    body_hash = hashlib.sha256(body or b"").hexdigest()
    query = _canonical_query(request)
    target = f"{request.url.path}?{query}" if query else request.url.path
    canonical = f"{request.method}\n{target}\n{body_hash}\n{ts_raw}\n{nonce}"
    expected = hmac.new(secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=401, detail="Not authenticated")

    # replay protection: this (key_id, nonce) pair must never be seen twice within the
    # timestamp window. Enforced by a unique index + TTL in server.py startup.
    db = request.app.state.db
    try:
        await db.service_nonces.insert_one({
            "key_id": key_id,
            "nonce": nonce,
            "createdAt": datetime.now(timezone.utc),
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {"key_id": key_id, "ip": client_ip(request)}
