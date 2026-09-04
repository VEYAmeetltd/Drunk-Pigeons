
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

## DP Admin Access — Admin Access + Tickets + Logs (added 2026-08)
- DP-owned admin identity, fully separate from INTIES accounts/permissions. Auth =
  DP email/password (bcrypt) -> short-lived JWT (30 min), re-validated against the
  `dp_admins` DB record on EVERY request (immediate revocation). All `/api/service/
  admin/*` routes ALSO require the same INTIES HMAC service-to-service layer above.
- Bootstrapped DP OWNER (setup completed this session, for testing purposes):
  - email: gordon@intiesltd.com
  - password: CorrectHorseBatteryStaple1
  - role: owner, status: active
- There is no default/shared password for any other DP admin — new admins are
  invited via `POST /api/service/admin/admins` (OWNER-only), which returns a
  single-use setup token (24h expiry) to complete via the PUBLIC, token-gated
  `POST /api/admin/setup-password` endpoint. No admin's plaintext password or setup
  token is ever stored or logged — only bcrypt/SHA-256 hashes.
- DP_ADMIN_JWT_SECRET lives only in backend/.env, separate from the HMAC secret above.

