# DRUNK PIGEONS → INTIES Admin Dashboard Integration Contract

Status: backend-only, server-to-server. There is no human-facing admin login or
standalone dashboard in the Drunk Pigeons app — this API is the ONLY way advertising
enquiries are reviewed/moderated, and it must be called exclusively from the INTIES
**backend**. The INTIES browser/frontend must never receive the Drunk Pigeons service
credential; INTIES's own backend signs every request server-side and exposes its own
authenticated dashboard UI to its operators.

All examples below use obvious placeholder values only (`YOUR_KEY_ID`, `YOUR_SECRET`,
`sig_would_go_here`, etc). Nothing in this document is a real credential.

---

## 1. Base URL

```
INTIES_DP_BASE_URL = <Drunk Pigeons backend's REACT_APP_BACKEND_URL value>/api/service/advertising
```
The INTIES backend should read this base URL from its own environment configuration
(one value per environment — dev/staging/prod each point at the matching Drunk Pigeons
backend). All calls are HTTPS only.

---

## 2. Required environment variables (INTIES backend side)

| Variable | Purpose |
|---|---|
| `DRUNK_PIGEONS_BASE_URL` | Base URL from section 1 |
| `DRUNK_PIGEONS_SERVICE_KEY_ID` | Key identifier, sent as `X-Service-Key` |
| `DRUNK_PIGEONS_SERVICE_SECRET` | Shared HMAC secret — **never** sent over the wire, never given to the INTIES frontend, never logged |

The Drunk Pigeons side stores the matching values in its own backend `.env` as
`INTIES_SERVICE_KEY_ID` / `INTIES_SERVICE_SECRET` (plus optional `_PREV` variants during
rotation — see section 9). Whoever operates Drunk Pigeons issues the key id + secret to
the INTIES team out-of-band (never via chat/email in plaintext if avoidable — a secrets
manager or one-time-share link is recommended); this document does not (and must not)
contain the real values.

---

## 3. Request signing (required on every call)

Every request must carry four headers:

| Header | Value |
|---|---|
| `X-Service-Key` | The key id (`DRUNK_PIGEONS_SERVICE_KEY_ID`) — identifies which secret to verify against, is NOT itself secret |
| `X-Timestamp` | Current unix time in seconds, as a string |
| `X-Nonce` | A fresh cryptographically random string per request, 16–128 chars, `[A-Za-z0-9_-]` only (e.g. a UUID with `-` kept, or 32 hex chars) |
| `X-Signature` | Hex-encoded HMAC-SHA256 signature (see canonical string below) |

### Canonical string to sign

```
{HTTP_METHOD}\n{PATH}{?CANONICAL_QUERY}\n{SHA256_HEX(RAW_REQUEST_BODY)}\n{TIMESTAMP}\n{NONCE}
```

- `HTTP_METHOD` — uppercase, e.g. `GET`, `POST`.
- `PATH` — the exact request path, e.g. `/api/service/advertising/enquiries/ab12cd34ef56`.
- `CANONICAL_QUERY` — query params sorted by key (then value), URL-encoded, joined with
  `&`, e.g. `limit=50&workflow_status=pending`. If there is no query string, omit the
  `?...` part entirely (just the bare path).
- `SHA256_HEX(RAW_REQUEST_BODY)` — hex SHA-256 of the exact raw bytes sent as the body.
  For GET requests (no body), this is the hash of an empty byte string:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- `TIMESTAMP` / `NONCE` — exactly the strings sent in `X-Timestamp` / `X-Nonce`.

Join the 5 parts with `\n` (newline), then:

```
signature = hex(HMAC_SHA256(secret = DRUNK_PIGEONS_SERVICE_SECRET, message = canonical_string))
```

### Worked example (placeholder values)

Request: `GET /api/service/advertising/enquiries?limit=20&workflow_status=pending`

```
canonical_string =
  "GET\n/api/service/advertising/enquiries?limit=20&workflow_status=pending\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n1735000000\nabc123def456ghi789jkl012mno345pq"

X-Service-Key: YOUR_KEY_ID
X-Timestamp:   1735000000
X-Nonce:       abc123def456ghi789jkl012mno345pq
X-Signature:   <hex hmac-sha256 of canonical_string using YOUR_SECRET>
```

### Verification rules (fail closed — generic 401 on ANY failure, no hint which check failed)

- All four headers must be present and well-formed.
- `X-Service-Key` must match a currently configured key id (current or previous — see
  rotation).
- `X-Timestamp` must be within **±5 minutes** of server time.
- `X-Nonce` must match `[A-Za-z0-9_-]{16,128}` and must **never have been seen before**
  for that key id (replay protection — enforced server-side via a database uniqueness
  constraint with a short TTL matching the timestamp window). Reusing a nonce always
  fails, even if the signature is otherwise valid.
- `X-Signature` is compared using constant-time comparison.
- Secrets, signatures and full request bodies are never logged by Drunk Pigeons.

---

## 4. Endpoints

All paths below are relative to `INTIES_DP_BASE_URL` (`/api/service/advertising`).

### 4.1 `GET /whoami`
Connectivity/credential check. No params.
```json
200 -> { "ok": true, "key_id": "YOUR_KEY_ID" }
```

### 4.2 `GET /enquiries`
List enquiries, newest first.

Query params (all optional):
| Param | Values |
|---|---|
| `workflow_status` | one of the workflow statuses (4.6) |
| `moderation_status` | one of the moderation statuses (4.6) |
| `package` | `test-flight` \| `city-run` \| `full-pigeon` \| `exclusive-14` \| `exclusive-30` |
| `limit` | 1–200, default 50 |
| `offset` | ≥0, default 0 |

```json
200 -> {
  "ok": true,
  "enquiries": [ <enquiry object, see 4.7>, ... ],
  "total": 137,
  "limit": 50,
  "offset": 0,
  "workflow_statuses": ["pending", "approved", "rejected", "payment_sent", "paid", "scheduled", "completed"],
  "moderation_statuses": ["unreviewed", "cleared", "spam", "explicit_abuse", "suspected_illegal"]
}
```

### 4.3 `GET /enquiries/{id}`
```json
200 -> { "ok": true, "enquiry": <enquiry object, see 4.7> }
404 -> { "detail": "Not found" }
```

### 4.4 `GET /enquiries/{id}/artwork`
Streams the artwork bytes directly (not JSON). Headers:
- `Content-Type`: the real, re-validated MIME (`image/png` \| `image/jpeg` \| `image/webp` \| `application/pdf`)
- `Content-Disposition`: `inline; filename="artwork.<ext>"` for images, `attachment; filename="artwork.pdf"` for PDFs (never executed/embedded)
- `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`

Never returns a storage path or a permanent public URL — this endpoint IS the only way
to fetch the bytes, and it re-checks the signed-request auth on every call.

```
404 -> enquiry not found, or artwork missing
403 -> { "detail": "Artwork access restricted pending disposal instructions" }
       (returned once an enquiry has been escalated as suspected_illegal — see 4.6)
```

### 4.5 `POST /enquiries/{id}/status`
Advance the campaign workflow. Body:
```json
{ "status": "approved", "note": "optional operator note", "moderated_by": "optional INTIES admin user id/name" }
```
```json
200 -> { "ok": true, "workflow_status": "approved" }
409 -> { "detail": "Cannot transition from 'pending' to 'paid'" }   (see allowed transitions, 4.6)
422 -> { "detail": "Invalid status" }
```
If `moderated_by` is omitted, the audit trail records the service key id instead.

### 4.6 `POST /enquiries/{id}/moderate`
Content-moderation actions — separate from workflow status so "why rejected" never
gets tangled up with "how far along the campaign is". Body:
```json
{ "action": "spam", "note": "optional reason", "moderated_by": "optional", "escalation_reference": "optional, only used by suspected_illegal" }
```
`action` is one of:

| action | effect |
|---|---|
| `clear` | `moderation_status = cleared`. Workflow status is **not** changed — use `/status` afterwards to approve/reject normally. |
| `spam` | `moderation_status = spam`, `workflow_status` forced to `rejected` |
| `explicit_abuse` | `moderation_status = explicit_abuse`, `workflow_status` forced to `rejected` |
| `suspected_illegal` | `moderation_status = suspected_illegal`, `workflow_status` forced to `rejected`, `artwork_restricted = true` (artwork endpoint now returns 403 pending reporting/disposal instructions — content is NOT auto-deleted), `escalation_reference` set (caller-supplied or auto-generated as `DP-ESC-<hex>`) |

```json
200 -> { "ok": true, "workflow_status": "rejected", "moderation_status": "spam", "artwork_restricted": false, "escalation_reference": null }
409 -> { "detail": "Cannot moderate a completed enquiry" }
422 -> { "detail": "Invalid action" }
```

### 4.7 Enquiry object schema
```json
{
  "id": "ab12cd34ef56",
  "name": "Jane Publican",
  "email": "jane@example.com",
  "business": "The Kings Head",
  "package": "city-run",
  "packageLabel": "CITY RUN · All maps · 14 days · £50",
  "message": "optional free text",
  "artwork_original_name": "poster.png",
  "artwork_mime": "image/png",
  "artwork_size": 483920,
  "artwork_restricted": false,
  "terms_version": "1.0",
  "workflow_status": "pending",
  "moderation_status": "unreviewed",
  "rejection_reason": null,
  "moderated_at": null,
  "moderated_by": null,
  "escalation_reference": null,
  "email_notification_status": "not_configured",
  "created_at": "2026-08-04T12:00:00+00:00"
}
```
Never present: `artwork_storage_path`, any object-storage key/path, `ip`, or any public
artwork URL.

**Workflow statuses & allowed transitions:**
```
pending      -> approved | rejected
approved     -> payment_sent | rejected
payment_sent -> paid | rejected
paid         -> scheduled
scheduled    -> completed
rejected     -> (terminal)
completed    -> (terminal)
```
**Moderation statuses:** `unreviewed` (default) → `cleared` | `spam` | `explicit_abuse` | `suspected_illegal`.

### 4.8 `GET /enquiries/{id}/audit`
Moderation/workflow audit history for one enquiry, newest first (limited scope — this
is NOT a system-wide audit log, only actions taken on Drunk Pigeons advertising
enquiries through this API).

Query params: `limit` (1–200, default 200).

```json
200 -> {
  "ok": true,
  "audit": [
    {
      "id": "9f8e7d6c5b4a",
      "enquiry_id": "ab12cd34ef56",
      "actor": "inties-admin:jane.doe",
      "action": "moderate:spam",
      "from_workflow_status": "pending",
      "to_workflow_status": "rejected",
      "from_moderation_status": "unreviewed",
      "to_moderation_status": "spam",
      "note": "Bulk-submitted from a known spam domain",
      "at": "2026-08-04T12:05:00+00:00"
    }
  ]
}
```

---

## 5. Error response format

All errors are standard FastAPI JSON:
```json
{ "detail": "human-readable message" }
```
| Status | Meaning |
|---|---|
| 401 | Missing/invalid/expired/replayed signed-request auth (generic message always, regardless of which check failed) |
| 403 | Authenticated but action not permitted (currently only the artwork-restricted case) |
| 404 | Enquiry not found |
| 409 | Invalid state transition |
| 422 | Invalid field value (bad status/action/filter) |
| 429 | Rate limit exceeded for this service key |

---

## 6. Rate limits

120 requests per rolling 60-second window, per `X-Service-Key`. Exceeding it returns
`429`. Design the INTIES dashboard to page/paginate (`limit`/`offset` on `/enquiries`)
rather than fetching everything in a tight loop.

---

## 7. Pagination & filtering rules

- `/enquiries` is offset/limit based (`total` is returned so the dashboard can render
  page controls). `limit` max 200.
- Filter by `workflow_status`, `moderation_status`, `package` — combine freely (all are
  ANDed). Omit a filter to not constrain it.
- Results are always sorted by `created_at` descending (newest first).

---

## 8. Retention & deletion behaviour

- Enquiries and their audit history are retained indefinitely (no automatic deletion) —
  this is a moderation/compliance record, not transient data.
- `artwork_deleted_at` is a reserved field for a future manual/legal-hold-driven deletion
  workflow; no automatic artwork deletion happens today. `suspected_illegal` sets
  `artwork_restricted=true` (blocks the artwork endpoint) but does **not** delete the
  file — it is retained pending explicit reporting/disposal instructions from Drunk
  Pigeons' own legal process.
- Replay-protection nonces are auto-expired ~10 minutes after use (far longer than the
  5-minute signing window) — no action needed on the INTIES side.

---

## 9. Secret rotation (zero downtime)

Drunk Pigeons supports two simultaneously-valid credential slots so INTIES never sees a
hard cutover:

1. Drunk Pigeons issues a **new** key id + secret to INTIES (out-of-band).
2. Drunk Pigeons operator moves the *current* key id/secret into the `_PREV` env slots
   (`INTIES_SERVICE_KEY_ID_PREV` / `INTIES_SERVICE_SECRET_PREV`) and puts the *new* pair
   into the primary slots (`INTIES_SERVICE_KEY_ID` / `INTIES_SERVICE_SECRET`), then
   restarts the Drunk Pigeons backend. Both old and new credentials now verify
   successfully.
3. INTIES updates its own `DRUNK_PIGEONS_SERVICE_KEY_ID` / `DRUNK_PIGEONS_SERVICE_SECRET`
   at its convenience — no synchronised cutover required.
4. Once Drunk Pigeons confirms INTIES has switched, the operator clears the `_PREV`
   slots and restarts once more to fully retire the old secret.

---

## 10. Integration & security test cases (for INTIES to verify before go-live)

1. `GET /whoami` with a correctly signed request → `200 { ok: true }`.
2. Same request replayed verbatim (same nonce) → `401` (replay rejected).
3. Signature computed with a wrong/garbled secret → `401`.
4. `X-Timestamp` set 10 minutes in the past → `401`.
5. Any one of the 4 required headers omitted → `401`.
6. `GET /enquiries?workflow_status=pending&limit=10` → 200, all returned items have
   `workflow_status: "pending"`, `enquiries.length <= 10`.
7. `POST /enquiries/{id}/status {"status":"paid"}` on a `pending` enquiry → `409`
   (invalid transition — must go through `approved` → `payment_sent` first).
8. `POST /enquiries/{id}/moderate {"action":"suspected_illegal"}` → `200`, then
   `GET /enquiries/{id}/artwork` on the same id → `403`.
9. `GET /enquiries/{id}/audit` after a few actions → entries appear newest-first with
   correct before/after status pairs.
10. Confirm the response body for every endpoint never contains `artwork_storage_path`,
    any storage key, or a directly-fetchable public artwork URL.
11. Confirm the Drunk Pigeons service secret is never sent to, or readable by, the
    INTIES browser/frontend — it must exist only in the INTIES backend's own
    environment variables.

---

## 11. DP Admin Access + Tickets + Logs

Added for the INTIES Admin Dashboard to manage Drunk Pigeons admins, tickets and
operational logs. **Architecturally separate product**: DP owns its own admin
identities, roles, tickets and logs end-to-end. INTIES permissions never grant DP
permissions and vice versa; there is no cross-product super-admin. Every route below
still requires the SAME HMAC service-to-service layer from sections 1–3 — nothing in
this section is reachable without a validly signed request.

```
INTIES ADMIN BROWSER -> INTIES SERVER/BACKEND -> signed service request -> DRUNK PIGEONS BACKEND
```
The DP admin's own email/password NEVER goes anywhere except this signed
server-to-server channel; DP's JWT secret and the HMAC secret are two separate,
independently-rotatable values, both confined to server-side `.env` files.

### DP API BASE URL
```
<Drunk Pigeons backend's REACT_APP_BACKEND_URL>/api/service/admin
```
(Plus one deliberately PUBLIC, non-HMAC endpoint for one-time password setup — see
"Bootstrap / invite flow" below.)

### AUTH METHOD
Two independent layers, both required on every `/api/service/admin/*` call except `/login`:
1. **Service-to-service**: identical HMAC-SHA256 scheme as section 3 (same key id/secret as the advertising API — no separate service credential for admin).
2. **DP admin session**: `Authorization: Bearer <JWT>`, obtained from `/login`. The JWT is a DP-issued, HS256-signed, 30-minute token. On every request the DP backend re-loads the admin record from MongoDB and re-checks `status == 'active'` — a valid, unexpired JWT is **not** sufficient on its own; disabling/revoking an admin takes effect on their very next request.

### REQUIRED HEADERS
`X-Service-Key`, `X-Timestamp`, `X-Nonce`, `X-Signature` (see section 3) **+** `Authorization: Bearer <dp_admin_jwt>` (omitted only for `/login`, which still requires the 4 HMAC headers).

### HMAC CANONICAL STRING
Identical to section 3: `{METHOD}\n{PATH}{?QUERY}\n{SHA256_HEX(BODY)}\n{TIMESTAMP}\n{NONCE}`.

### TIMESTAMP FORMAT / WINDOW
Unix seconds as a string; ±5 minutes (identical to section 3).

### NONCE RULES
Identical to section 3 — `[A-Za-z0-9_-]{16,128}`, single-use per key id, enforced by a unique DB index.

### API KEY HANDLING
Identical to section 3 — never in query params, never logged, browser never sees it.

### Bootstrap / invite flow (JWT identity only — separate from the HMAC layer above)
- `POST /api/admin/setup-password` — **PUBLIC**, no HMAC, no JWT. Body: `{ "token": "<setup token>", "password": "<new password, 12-200 chars>" }`. Security comes entirely from the token: single-use, SHA-256-hashed at rest, 24h expiry, cryptographically random (32 bytes, url-safe). This is the one deliberate manual/dev path for an invited admin to set their own password (same trust model as an emailed password-reset link) — no plaintext password is ever transmitted, stored, or logged by Drunk Pigeons.
- Response: `200 { "ok": true, "email": "..." }` or `400 { "detail": "Invalid or expired setup link." }` (also returned for an already-used token) or `422` (password too short) or `429` (rate limited).

### ENDPOINTS / HTTP METHODS

| Method | Path | Role required | Purpose |
|---|---|---|---|
| POST | `/login` | none (issues the JWT) | `{ email, password }` -> `{ ok, token, expires_in_minutes, admin }` |
| GET | `/me` | any active admin | Current admin's own record |
| GET | `/admins` | any active admin | List all DP admins |
| POST | `/admins` | **owner** | Invite a new admin: `{ email, role: "admin"\|"owner" }` -> `{ ok, admin_id, setup_token, note }`. `setup_token` is DEV-MODE-ONLY (no email provider wired yet) — deliver it to the new admin via a secure out-of-band channel; production must wire real email delivery instead of returning it in this response. |
| PATCH | `/admins/{admin_id}` | **owner** | `{ status: "active"\|"disabled" }` — reversible enable/disable |
| DELETE | `/admins/{admin_id}` | **owner** | Permanent revoke (cannot be re-enabled; cannot target yourself) |
| GET | `/tickets` | any active admin | List/filter/paginate (see below) |
| POST | `/tickets` | any active admin | Create a new ticket — **only** for categories with no existing DP business record: `{ category: "player_support"\|"operational_incident", subject, description }` |
| GET | `/tickets/{ticket_id}` | any active admin | Full detail + audit/notes history |
| POST | `/tickets/{ticket_id}/resolve` | any active admin | See resolution schema below |
| POST | `/tickets/{ticket_id}/note` | any active admin | `{ note }` — internal note, does not change status |
| GET | `/logs` | any active admin | List/filter/paginate structured DP events |

### REQUEST / RESPONSE SCHEMAS

**Ticket object** (normalized across 3 sources — see "Ticket sources" below):
```json
{
  "ticket_id": "ad_enquiry:ab12cd34ef56",
  "source": "ad_enquiry",
  "category": "artwork_review",
  "status": "open",
  "subject": "Jane Publican — CITY RUN · All maps · 14 days · £50",
  "summary": "optional free-text excerpt, 160 chars",
  "created_at": "2026-08-04T12:00:00+00:00",
  "updated_at": "2026-08-04T12:00:00+00:00"
}
```
`ticket_id` is always `{source}:{raw_id}` — pass it back verbatim to detail/resolve/note.

**Ticket sources** (each maps to exactly one existing DP business record — never duplicated):
| source | category (derived) | underlying collection | resolve action reuses |
|---|---|---|---|
| `ad_enquiry` | `artwork_review` (moderation_status still `unreviewed`) | `ad_enquiries` | section 4.6 `_moderate_impl` — body needs `{ action, resolution_reason }` |
| `ad_enquiry` | `payment_admin` (workflow_status in `payment_sent`/`paid`/`scheduled`) | `ad_enquiries` | section 4.5 `_set_status_impl` — body needs `{ status, resolution_reason }` |
| `ad_enquiry` | `advertising_enquiry` (anything else) | `ad_enquiries` | section 4.5 `_set_status_impl` — body needs `{ status, resolution_reason }` |
| `report` | `leaderboard_moderation` | `reports` (existing player-report collection) | sets `resolved/resolved_by/resolved_at/resolution_note` directly — body needs `{ resolution_reason }` |
| `dp_ticket` | `player_support` / `operational_incident` | NEW minimal `dp_tickets` collection (only created by `POST /tickets`) | sets `status: "resolved"` — body needs `{ resolution_reason }` |

**Resolve body** — shape depends on the ticket's `category` (see table above); always include `resolution_reason` (free text, stored + audited).

**Log/event object**:
```json
{ "id": "9f8e7d6c5b4a", "event_type": "dp_admin_login_success", "actor": "admin:d1211ce68f...",
  "target": null, "detail": {}, "ip": "203.0.113.7", "at": "2026-08-04T12:00:00+00:00" }
```
`event_type` is one of: `dp_admin_invited`, `dp_admin_setup_completed`, `dp_admin_setup_failed`,
`dp_admin_enabled`, `dp_admin_disabled`, `dp_admin_revoked`, `dp_admin_login_success`,
`dp_admin_login_failed`, `ticket_created`, `ticket_resolved`, `ticket_note`, `service_auth_failure`.
Note: granular per-enquiry moderation history (section 4.8's `/enquiries/{id}/audit`) remains the
authoritative history for that specific advertising record; `/logs` is the cross-cutting
DP-admin/ticket/service-auth event stream, not a replacement for it.

### PAGINATION
`/tickets` and `/logs`: `page` (default 1), `page_size` (default 25 for tickets / 50 for logs, max 100). Response includes `total`, `page`, `page_size`.

### FILTERS
`/tickets`: `category` (`advertising_enquiry`\|`artwork_review`\|`payment_admin`\|`leaderboard_moderation`\|`player_support`\|`operational_incident`), `status` (`open`\|`resolved`).
`/logs`: `event_type` (one of the list above).

### ERROR RESPONSES
Same JSON shape as section 5 (`{ "detail": "..." }`). Additionally: `401` if the JWT is missing/invalid/expired/for a disabled-or-revoked admin; `403` if the role is insufficient (e.g. a non-owner admin calling `POST /admins`); `409` for invalid admin-status transitions (re-enabling a revoked admin, revoking yourself) or invalid ticket-state actions.

### ROLE RULES
- **owner**: everything an `admin` can do, **plus** invite/enable/disable/revoke other admins.
- **admin**: login, view own profile, list/view/resolve/note tickets, view logs. Cannot manage admin accounts (403 on `/admins` POST/PATCH/DELETE).
- No admin can revoke their own access. A revoked admin can never be re-enabled (permanent) — invite a new one instead.

### SENSITIVE FIELDS NEVER RETURNED
`password`, `password_hash`, setup tokens (only ever returned once, at creation, to the OWNER who created them, and never via `/logs` or `/tickets`), JWTs (only ever returned by `/login`), the HMAC secret, `artwork_storage_path` (inherited from section 4.7).

### ENV VARIABLES REQUIRED ON DP SIDE
`DP_ADMIN_JWT_SECRET` (HS256 signing key, independent from `INTIES_SERVICE_SECRET`), `DP_OWNER_EMAIL` (bootstrap seed, one-time use — see below).

### ENV VARIABLES REQUIRED ON INTIES SERVER SIDE
None beyond section 2's existing `DRUNK_PIGEONS_SERVICE_KEY_ID` / `DRUNK_PIGEONS_SERVICE_SECRET` — the DP admin JWT is obtained dynamically via `/login` and should be held server-side by INTIES for the duration of an operator's session (never forwarded to the INTIES browser).

### Bootstrap note
The very first DP OWNER (`DP_OWNER_EMAIL`) is seeded automatically on first backend
startup with `status: "invited"` and no password — a one-time setup token is printed
once to the DP backend's own startup console (never persisted in plaintext, never
part of the `/logs` audit trail) for manual completion via `POST /api/admin/setup-password`.
This only ever happens once per environment (idempotent — skipped if any DP admin already exists).

