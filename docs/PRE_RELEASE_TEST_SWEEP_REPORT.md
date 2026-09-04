# DRUNK PIGEONS — Final Pre-Release Test Sweep (Sections A–N)
Date: 2026-08 (read-only audit, zero code/config/dependency/database/asset changes made)
Scope: Establish Google Play production-build readiness. Every item below is classified
PASS / FAIL / BLOCKED / NOT TESTED / NO AUTOMATED COVERAGE with the evidence examined.

---

## A. Configuration
| Item | Evidence | Result |
|---|---|---|
| `app.json` orientation/portrait lock | `"orientation":"portrait"`, iOS `supportsTablet:false` | PASS |
| Android/iOS package IDs match | `com.drunkpigeons.app` (both) | PASS |
| Expo/RN SDK versions | expo `~51.0.28`, react-native `0.74.5`, reanimated `~3.10.1`, svg `15.2.0` | PASS (current, matched to installed deps) |
| App icon (`expo.icon`) | **absent** from `app.json`; no icon file anywhere under `frontend/assets/` | **FAIL — release blocker** |
| Splash screen (`expo.splash`) | absent from `app.json` | **FAIL — release blocker** |
| Android adaptive icon foreground image | `android.adaptiveIcon` only has `backgroundColor`, no `foregroundImage` | **FAIL — release blocker** |
| `android.versionCode` / `ios.buildNumber` | absent (only top-level `version:"1.0.0"`) | WARNING — required before first EAS build, not before this sweep |
| `eas.json` | does not exist | NOT TESTED — required for native build (Issue 2, already BLOCKED/P1) |
| AdMob app IDs wired | `react-native-google-mobile-ads` key present with real Android/iOS app IDs | PASS |

## B. Security
| Item | Evidence | Result |
|---|---|---|
| CORS | `server.py:30 allow_origins=["*"]`; confirmed live via `curl -I OPTIONS` returns `access-control-allow-origin: *` for an arbitrary Origin | **WARNING (known, accepted)** — PRD Update 17 explicitly deferred CORS lockdown until final pre-submission pass; still open |
| Secrets in `.env` not committed | `.gitignore` contains `.env`/`.env.*`/`*.env`; `git ls-files | grep .env$` returned nothing tracked | PASS |
| Secrets not hardcoded in source | grep for `api_key/secret/password=` in `frontend/src` found only `SecretCode.js: SECRET='733T'` (an intentional cosmetic easter-egg code, not a credential) | PASS |
| `service_auth.py` canonical signing | Reviewed: `METHOD\nPATH?QUERY\nSHA256(BODY)\nTIMESTAMP\nNONCE`, HMAC-SHA256 | PASS (code review) |
| Timestamp validation | `abs(now - ts) > 300s` rejected | PASS |
| Nonce replay protection | unique `(key_id, nonce)` Mongo index + TTL(600s); duplicate insert → 401 | PASS (also unit-tested, see G) |
| Constant-time signature comparison | `hmac.compare_digest` used, not `==` | PASS |
| Environment separation | secret only read from `backend/.env` (`INTIES_SERVICE_KEY_ID/SECRET` [+`_PREV`]); never returned in any response, logged, or written to docs | PASS |
| Logging redaction | no `print()`/log statement in `service_auth.py`/`service_advertising.py` touches the secret or full signature; failures return generic `401 Not authenticated` (no detail leak on which check failed) | PASS |
| Key rotation | optional `_PREV` slots verified simultaneously — supported | PASS (code review, contract doc §9) |
| Artwork storage path / internal keys never returned | confirmed `public_enquiry()` never includes `artwork_storage_path`; `/artwork` streams bytes only | PASS |
| Moderation match terms never leaked to client | `moderation_reason()` internal-only; endpoints return generic `"reason":"moderation"` / `"MODERATION"` | PASS |

## C. Gameplay (all 3 maps + Easy Mode)
Delegated to `testing_agent` (iteration_30.json), frontend-only, live browser automation.
Result: **13/14 PASS**, 1 NOT TESTED (see below). 0 bugs found, 0 code changes made.
- Menu→READY→first-tap-starts-run on all 3 standard maps: PASS
- No scoring/movement before first tap: PASS
- Distance meter increments correctly: PASS
- Crash → Game Over overlay (PLAY AGAIN / REVIVE / MAIN MENU) on all 3 maps: PASS
- PLAY AGAIN resets a genuinely fresh run (distance/score/chips → 0): PASS
- MAIN MENU returns to menu: PASS
- Revive continues the SAME run (29m → resumed at 44m, not reset): PASS
- Revive usable exactly once per run, resets on next new run: PASS
- Segment-based hitboxes — no invisible-rectangle deaths in ~8 live runs: PASS-CIRCUMSTANTIAL (full statistical sweep already done in iteration_24, 12/12 headless assertions)
- Sponsor billboards / scenery never cause death or block taps: PASS
- Normal vs Easy difficulty distinctness: PASS-BY-CONFIG (code-confirmed `pickEncounter(hard=true/false)` split; no live A/B statistical run this session — already proven via iteration_24 headless harness: 26.3% paired encounters Normal vs 3.8% Easy)
- **1000m blackout event: NOT TESTED** — web-preview auto-fly heuristic tops out ~265–439m before crashing; code path reviewed and looks correct (`engine.js currentBlackout()`, `GameScreen.js BlackoutOverlay`) but not live-fired this session or in any prior iteration referenced. Recommend a dev-only distance-warp debug key for future QA, or accept code-review-only sign-off.

## D. Character Dialogue (Roadman scripted lines)
Result: **7/7 PASS** (iteration_30.json + prior iteration_29 deep coverage).
- No scripted bubble during READY/TAP-TO-FLAP: PASS
- "Wargwarn?" fires once on first flap: PASS
- "I said wargwarn fam?" fires once at 50m: PASS
- "A'ight say less, deekhed" fires once at 100m: PASS
- No repeat after revive (same run): PASS (verified iteration_29; flags live in `roadmanFlagsRef`, only cleared by `startRun()`)
- Fresh run resets all 3 flags: PASS
- No overlap with ambient heckler/idle quips: PASS-BY-CODE (`suppressQuips` gate)
- Non-blocking code-review notes carried forward: `else if` milestone check could delay the 100m line by one frame on a >50m single-frame jump (near-impossible at normal speeds); fixed 2200ms bubble timeout could truncate an earlier line if two fire within 2.2s. Neither observed in practice, neither blocking.

## E. Device Testing — **BLOCKED**
Genuine physical Android/iOS device testing (touch latency, real notch/cutout safe-area,
real AdMob ad rendering, real StoreKit/Play Billing sheets, thermal/battery, actual app
install from a signed AAB/IPA) **cannot be performed from this web-preview environment**.
Explicitly marked BLOCKED per user instruction — not converted to PASS on the basis of
Chromium/web-preview automation. Update 32 (responsive device-*size* audit) already
covered viewport/layout responsiveness across 10 iPhone/Samsung breakpoints, which is a
different (and already-passing) concern from genuine physical-device behaviour.

## F. Store Billing
| Item | Evidence | Result |
|---|---|---|
| Product ID matrix | `products.js`: 5 pigeons `drunkpigeons.pigeon.<id>` @ £1.99, bundle `drunkpigeons.pigeons.unlockall` @ £7.99, Easy Mode `drunkpigeons.mode.easymode` @ £14.99, Remove Ads `drunkpigeons.removeads` @ £2.99 | PASS (internally consistent; must be mirrored 1:1 in Play Console before submission) |
| Billing provider | `billing.js`: `IS_DEV` gate + pluggable `setBillingProvider()`; **no real StoreKit/Play Billing adapter injected** — only the DEV simulator (`purchase()`/`restore()`) runs today | **FAIL for production** (known, documented since Update 6/9/13 — real adapter injection is native-build work, Issue 2) |
| Server-side receipt/entitlement verification | grep of `frontend/src/store/*` for `receipt`/`verifyPurchase`/server-verify found **nothing** — entitlements are 100% client-side `AsyncStorage` | **FAIL — SEC-001, already tracked P1, deliberately deferred by user** |
| Restore Purchases safety | code review confirms `restorePurchases()` UNIONs restored items with existing local ownership (Update 47 fix) — never downgrades | PASS |
| Easy Mode / Remove Ads independence from 733T cheat | confirmed separate entitlement flags (`easyMode`, `removeAds` vs `leetUnlock`) | PASS |

## G. Backend
| Item | Evidence | Result |
|---|---|---|
| Automated test suite | `python3 -m pytest backend/tests -q` → **108 passed**, 0 failed, ~61s (7 files: acceptance, leaderboard, leaderboard_hardening, mode_leaderboard, moderation, moderation_flow, service_integration) | PASS |
| `/api/health` | live `curl` → `{"status":"ok","moderation":"dp-mod-2026-06-01"}` | PASS |
| Leaderboard anti-cheat constants mirror client physics | `SPEED_MAX 380`, `PPM 24` reviewed against engine.js — consistent | PASS |
| Rate limiting (per-player + per-IP) | code review: 20/min/player, 240/min/IP, `service_auth` 120/min/key | PASS (in-memory only — not multi-worker-durable, pre-existing noted limitation, non-blocking for a single-instance deploy) |
| TTL retention | `runs` 7d, `flagged` 30d, `service_nonces` 600s — `players` (leaderboard) never TTL'd | PASS |
| Unique-nickname migration idempotency | `_migrate_unique_nicknames()` reviewed, runs on every startup, sparse unique index | PASS |

## H. Ads / INTIES Billboards
| Item | Evidence | Result |
|---|---|---|
| INTIES rotation reachability | `sponsorCampaigns.js`: `targetRate:0.6`, `minGapHouseAds:4`, `AD_MIX.nonExclusivePaidShare:0.5`, `exclusive` flag per campaign — the Update 55 fix for the iteration_27-found reachability bug is present and correct | PASS |
| No consecutive INTIES appearances | `_houseSlotsSinceInties` cooldown counter reviewed | PASS |
| Billboards non-collidable / non-interactive | confirmed `pointerEvents="none"` tree in `Background.js`→`SponsorBillboard.js`, never in the `obstacles[]` array (separate system) | PASS |
| Remove Ads → house-only artwork | `removeAdsOwned` wiring reviewed App→GameScreen→Background→SponsorBillboard | PASS |

## I. Data / Privacy
| Item | Evidence | Result |
|---|---|---|
| Self-service leaderboard deletion | `POST /api/leaderboard/delete` reviewed + covered by `test_acceptance.py` (5 delete-flow cases, part of the 108 passing) | PASS |
| No PII beyond nickname+score | `players` schema reviewed: `playerId` (anon uuid), `nickname`, `bestDistance`/`sillyBestDistance`, timestamps only | PASS |
| Report/block nickname flow | `POST /api/leaderboard/report`, deduped, anonymous reporter key only | PASS |
| Terms/Rules/Online-Safety acceptance recorded | `POST/GET /api/leaderboard/accept`, anonymous, versioned | PASS |
| Children/COPPA-style language present | Privacy Policy §13 + Online Safety §9 both contain explicit under-18/child-safety, no-chat/no-DM/no-photo-upload, data-minimisation language | PASS (content); **Apple/Google age-rating + Play "Data Safety" form completion is a store-console task, not app code** — NOT TESTED (outside this workspace) |
| AdMob consent (UMP) hook present | `ads.js`/`admobProvider.native.js` `showPrivacyOptions()`/`getPrivacyOptionsRequired()` implemented; privacy policy §7/§8 references Google UMP requirement | PASS (code); **actual UMP form only renders on a real native AdMob SDK on-device** — NOT TESTED here (ties to Section E) |

## J. Performance
| Item | Evidence | Result |
|---|---|---|
| Hot-path architecture | rAF loop + single Reanimated shared value (`world`) driving all per-frame transforms — no React re-render on the gameplay hot path (confirmed via code review of `GameScreen.js`/`engine.js`/`DrunkPigeon.js`, consistent with PRD architecture notes) | PASS (code review) |
| Object pooling | obstacles/chips/feathers use fixed-size recycled pools (confirmed Update 29 code-review note, unchanged since) | PASS |
| Real device FPS/thermal/battery | requires a physical device | **BLOCKED** (Section E) |
| Bundle/asset weight | single new asset this era is `inties-logo.png` (bundled locally, no network fetch) — no bloat concerns found | PASS |

## K. Error Handling
| Item | Evidence | Result |
|---|---|---|
| Backend bare `except:`/silent `except Exception: pass` | grep across `backend/*.py` → **0 matches** | PASS |
| Frontend empty `catch {}` blocks | grep found 2, both in `AdvertiseScreen.js` (`URL.revokeObjectURL` best-effort cleanup, and a best-effort error-body parse with a sensible pre-set fallback `msg`) — both benign by design, not silent failures of a critical path | PASS (acceptable) |
| Guarded dev-only logging | Update 29 already added guarded `__DEV__` logging to the 2 previously-silent HUD interval catches | PASS |
| Leftover debug/diagnostic flags | grep for `__DP_DEV`, `DRUNK_DIAG`, `DIAG_STATIC`, `__DP_FILM`, `__DP_NOCLIP` → only `DRUNK_DIAG = false` constant remains (inert, correctly disabled) | PASS |
| Stray `console.log/warn/error` outside `__DEV__` guards | grep found **0** unguarded occurrences in `frontend/src` | PASS |

## L. Legal / Compliance
| Item | Evidence | Result |
|---|---|---|
| 6 public legal documents present | `legalDocuments.js` confirmed all 6 (`privacy` doc verified present with full §1–13 structure; Terms, Leaderboard Rules, Online Safety, Advertising Booking Terms, and the 6th public doc are the same array — internal docs 05-09/11/13-15 confirmed excluded per Update 39) | PASS |
| Internal-only docs not bundled | confirmed by original Update 39 audit (not present in DOM/bundle) — not re-verified this session (no changes to this file since) | PASS (no regression suspected) |
| Company/contact info consistent | `COMPANY` const: INTIES LTD., company no. 17433193, England & Wales, 128 City Road London EC1V 2NX, gordon@intiesltd.com — matches integration contract doc | PASS |
| Advertising booking terms cover prohibited content | confirmed list present (illegal/extremist/CSEA content explicitly excluded, §ref line ~1097) | PASS |
| Age-rating / Data-Safety form completion | Apple App Store / Google Play Console-side declarations — **cannot be completed from this codebase**, must be done manually at submission time using the privacy policy as source | NOT TESTED / OUT OF SCOPE |

## M. Assets
| Item | Evidence | Result |
|---|---|---|
| App icon file(s) | **none found** anywhere under `frontend/assets/` (only `assets/ads/inties-logo.png` exists) | **FAIL — release blocker, must fix before `eas build`** |
| Splash screen asset | none found | **FAIL — release blocker** |
| Adaptive icon foreground (Android) | none found, `app.json` only sets a background colour | **FAIL — release blocker** |
| INTIES billboard creative | `inties-logo.png` (1536×1024 RGBA) present, correctly bundled, rendered via `resizeMode="contain"` | PASS |
| In-game art (pigeons, buildings, obstacles) | all vector/SVG generated in-code, no missing-asset risk | PASS |

## N. Final Consolidated Report

### Overall verdict: **READY WITH WARNINGS** (for continuing native-build prep) — **NOT READY** for immediate Play Store submission.
Core gameplay, dialogue, backend, security-of-integration, moderation, and legal-content
engineering are all solid and regression-clean. What remains is store-packaging and
production-hardening work that was always known to require a native build phase — none
of it is a code-quality regression found in this sweep.

### 1. Genuine release blockers (must fix before generating the production AAB)
- **No app icon / splash screen / Android adaptive-icon foreground image exist anywhere in the repo.** `expo prebuild`/EAS build cannot produce a store-correct binary without these. (Section A, M)
- **SEC-001**: entitlements (pigeons, bundle, Easy Mode, Remove Ads) are 100% client-side (`AsyncStorage`); no server-side Apple/Google receipt verification exists. Already tracked P1, deliberately deferred by the user — but it IS a genuine pre-submission blocker for accepting real money. (Section F)
- **No real StoreKit/Play Billing adapter** — only the DEV purchase simulator works. Required native-build step (`setBillingProvider`). (Section F)
- **No `eas.json`, no `android.versionCode`/`ios.buildNumber`** — required scaffolding for the first EAS build. (Section A)

### 2. Release warnings / residual risks (should fix, not hard blockers)
- CORS is `allow_origins=["*"]` — acceptable for the current preview/testing phase but should be locked to the production domain(s) before/at submission (explicitly deferred by user since Update 17; re-confirmed still open).
- In-memory rate limiters (per-player/IP/service-key) are not durable across multiple backend workers/restarts — fine for a single-instance deployment, worth revisiting if horizontally scaled.
- Real AdMob UMP consent flow and real ad rendering only exist on the native SDK path — currently only code-reviewed, never fired on a real device.

### 3. Non-blocking polish
- Cosmetic RN-Web deprecation console warnings (`pointerEvents` prop, `shadow*`/`textShadow*` style props) — harmless today, worth cleaning before an RN 0.75+ upgrade.
- Two theoretical (never-observed) timing edge cases in the Roadman scripted-line milestone logic under extreme frame lag.
- 1000m blackout event has never been live-fired in any QA session (web-preview distance ceiling); code review only.

### 4. Environment-blocked checks (cannot be resolved from this workspace)
- Section E: genuine physical Android/iOS device testing (touch latency, safe-area insets, thermal, real ad rendering, real purchase sheets).
- Google Play Console billing product configuration + Data Safety form + age rating — console-side tasks, not app code.

### 5. Automated coverage gaps
- No live statistical A/B run comparing Normal vs Easy Mode obstacle density this session (already proven once via the iteration_24 headless harness — not re-run, no regression suspected since no geometry code changed).
- 1000m blackout — no automated or manual live trigger to date; recommend a dev-only distance-warp debug hook for future QA sessions only (not production code).

### 6. Smallest necessary remediation + regression scope (for separate approval — not performed in this read-only sweep)
1. Add `expo.icon` (1024×1024), `expo.splash`, and `android.adaptiveIcon.foregroundImage` assets + wire into `app.json`. Regression scope: visual only, no gameplay/backend retest needed beyond a smoke screenshot.
2. Add `eas.json` + set `android.versionCode`/`ios.buildNumber`. Regression scope: none (build config only).
3. Implement SEC-001 (server-side Apple/Google receipt verification) + inject a real billing provider once native builds begin. Regression scope: full Section F re-test + backend entitlement tests.
4. Finalise CORS allow-list to the production domain(s) at submission time. Regression scope: re-run `test_service_integration.py` + a cross-origin smoke check.

---
**Testing methodology**: static code review (`view`/`grep`) across `backend/*.py`, `frontend/src/**`, `app.json`, `.env`/`.gitignore`; live read-only `curl` against the running backend; a full `pytest` run (108/108 passed, no code touched); one smoke screenshot; one dedicated `testing_agent` browser-automation pass covering Sections C & D (`/app/test_reports/iteration_30.json`), building on 6 prior testing_agent iterations (24–29) already covering geometry, INTIES rotation, heckler containment, and Roadman dialogue in earlier sessions. **Zero code, configuration, dependency, database, or asset changes were made during this sweep.**
