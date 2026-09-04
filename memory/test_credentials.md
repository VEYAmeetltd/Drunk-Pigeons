
## Admin Dashboard (Pigeon Promotions) — added 2026-06
- Route: <preview_url>/admin  (web deep-link)
- Username: admin
- Password: INTENTIONALLY NOT STORED HERE (per owner's explicit security instruction).
  Only a bcrypt hash lives in backend .env (ADMIN_PW_HASH_B64). The one-time bootstrap
  password was shown to the owner once in the build report. Rotate via POST /api/admin/rotate-password.
  Cookie session is Secure + HttpOnly + SameSite=Strict (same-origin only).
