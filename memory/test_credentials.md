
## Standalone Admin Dashboard — REMOVED (2026-08)
The human-facing /admin login (username/password + cookie session) was deleted entirely
per owner's scope correction. There is no admin frontend and no admin password anymore.

## INTIES service-to-service integration (added 2026-08)
- Protected API base: <preview_url>/api/service/advertising (see
  /app/docs/INTIES_DRUNK_PIGEONS_INTEGRATION_CONTRACT.md for the full contract).
- Auth: X-Service-Key + HMAC-SHA256 signature + X-Timestamp + X-Nonce (no cookie, no
  human login). Key id + secret live ONLY in backend/.env as INTIES_SERVICE_KEY_ID /
  INTIES_SERVICE_SECRET (values intentionally NOT copied here — read them directly from
  backend/.env on this pod if a testing/self-test run needs to sign a request).
- Rotation slots (optional, unset by default): INTIES_SERVICE_KEY_ID_PREV /
  INTIES_SERVICE_SECRET_PREV.
