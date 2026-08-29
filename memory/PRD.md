# DRUNK PIGEONS — PRD

## Problem statement
Small, funny, highly replayable one-touch mobile arcade game. A cartoon pigeon flies
left→right through a chaotic British city. Tap = flap up, no tap = gravity. Navigate gaps,
collect chips (pigeon gets progressively fatter), score per obstacle passed, crash funnily,
restart instantly. Philosophy: FUN → RESPONSIVE → FUNNY → REPLAYABLE → POLISHED.

## User choices (2026-06)
- Platform: React Native / Expo (served on web via react-native-web for instant preview; installable native later).
- Art: bright bold cartoon vector + gritty British street. 3 selectable maps, same difficulty, different visuals.
- Audio: in-code synth SFX (Web Audio).
- Revive: dev/test revive button with ad hook ready.
- Pigeons: Classic default+selected, Business unlocked, rest locked but previewable when tapped.

## Architecture
- Expo SDK 51, react-native-reanimated (per-frame transforms via a single `world` shared value, no React re-render on hot path), react-native-svg (vector pigeon/background), AsyncStorage (persistence).
- Served by supervisor `yarn start` = `expo start --web --port 3000`. Minimal FastAPI backend exists but is unused (game needs no backend).
- Modular systems (all under /app/frontend/src):
  - config.js — physics/difficulty/fat tuning
  - game/engine.js — pure simulation: physics, obstacle pool + passable-gap clamps, chip collection, circle-vs-rect collision, difficulty ramp, revive
  - components/ — PigeonSprite (SVG, widens with fat), GameEntities (PigeonView/ObstacleView/ChipView/FeatherView), Background (per-map)
  - screens/ — MainMenu, GameScreen (rAF loop + HUD + input), GameOverOverlay, PigeonsScreen
  - data/ — deathMessages (extensible), pigeons (cosmetic, no gameplay effect), maps (3 themes)
  - storage/persistence.js — AsyncStorage (best, injured, sound, pigeon, map)
  - audio/audio.js — Web Audio synth SFX (flap/chip/crash/ui/highscore/revive)
  - ads/ads.js — DEV placeholder hooks (rewarded revive grants immediately; interstitial no-op). MOCKED by design.

## Implemented (2026-06) — verified 100% by testing agent (iteration_1)- Complete playable loop: Menu → Play → flap/gravity → procedural obstacles → chips → progressive fattening (6 stages) → distance score → gradual difficulty → funny crash w/ feathers + random death message → Game Over → Play Again.
- Best Score + lifetime Pigeons Injured persist across reload.
- Revive: one per run, 2s shield banner, keeps score/chips; ad-hook-ready.
- 3 maps (day/night/dusk) selectable on menu; sound toggle persists.
- Pigeons screen: Classic (selected) + Business unlocked; roadman/king/gym/tourist/fancy locked but preview their look.
- Mobile-first portrait, safe areas, page-scroll prevented on web.

## Update 1 (2026-06) — verified 100% by testing agent (iteration_2)
- Live DISTANCE meter in metres (thousands separators, no decimals): starts 0 each run, counts smoothly, stops on crash, continues through revive. PPM=24 (config).
- BEST DISTANCE persisted locally (dp_bestDistance); shown on Game Over (go-distance / go-best-distance).
- In-game RESTART button (↻) with RESTART RUN? confirm overlay: pauses run, Cancel resumes exact run, Restart begins fresh run (distance/score/chips/fat/revive reset, same pigeon+map). Restart does NOT count as injury/death, no game-over, no menu return. Input-safe (restart taps never flap; Space ignored while paused).

## Update 3 (2026-06) — verified by testing agent (iteration_3) + visual confirm
- Building variety: procedural seed-based buildings (colour shades, 1-2 window columns, roof styles flat/parapet/pitched, chimneys, antennas, drainpipes, street-level door/shop/pub fronts). Collision geometry UNCHANGED (same OBSTACLE_WIDTH column); all decorations pointerEvents=none.
- Subtle world progression: parallax layers (clouds/far skyline/near skyline/street) driven by world.distPx + gentle distance-based sky tint. No abrupt switches, no difficulty change.
- Window hecklers: occasional single tiny angry person in a window (SVG, reaction poses: fist/point/wave/mug/newspaper/horrified/confused) with a bold speech bubble shouting randomised censored-British insults (data/insults.js, 30 lines, no back-to-back repeat). Cooldown 3.5-8s, max ONE at a time, ~1.5s life, clamped away from top HUD. Never collidable.
- Regression PASS on all 3 maps (physics/gaps/difficulty/collision/chips/score/distance/revive/restart unchanged).

## Update 4 (2026-06) — verified 100% by testing agent (iteration_4)
- Secret 733T Easter egg on main menu: subtle "CODE" entry (top-left) opens ENTER CODE overlay (code-input/code-submit/code-cancel). Case-insensitive (733T/733t).
- Wrong code → random cheeky response (code-error), unlocks nothing. Correct → confetti + Audio.leet(), "LEET PIGEON STATUS ACHIEVED" / "ALL PIGEONS UNLOCKED".
- Persistent `leetUnlock` flag (dp_leetUnlock) as an ADDITIVE override — unlocks all currently-locked pigeons, normal PIGEONS.locked architecture untouched. Subtle "1337" badge on Pigeons screen + menu label flips CODE→1337. Persists across reload. No gameplay changes.

## Update 5 (2026-06) — verified 100% by testing agent (iteration_5)
- Chips redesigned as golden potato-crisp SVGs (irregular curved shape, toasted patches, shimmer) with subtle rotation/bob — no trademarked branding.
- Strict chip placement: isChipPosSafe() validates full chip bounds + 12px padding vs ground/ceiling and every building's top/bottom rects; generateChipsForObstacle() places validated gap chips + trails (line/arc/rise/fall) in open sky between buildings, skipping any invalid chip (2169 observations → 0 overlaps, 0 underground). CHIP_POOL raised to 28.
- Window hecklers refactored to be window-anchored dependents of a specific obstacle: only spawn on a fully on-screen building with a fitting window; person clipped inside the window (head/shoulders visible, lower body hidden); position derived from the live obstacle each frame; released on recycle/off-screen — no orphaned people or floating bubbles. Speech bubble anchored to the person.
- No gameplay/physics/difficulty/scoring/chip-value/fatness/collision changes. (Note: no "pub +5" pickup exists in this build — referenced in brief but never implemented; left out of scope.)

## Update 6 (2026-06) — Pigeon Store & Entitlements — verified 100% (iterations 6-7)
- Store layer: src/store/products.js (configurable product IDs drunkpigeons.pigeon.<id> + .pigeons.unlockall), entitlements.js (source: free|purchased|bundle|leet|locked, canUse), billing.js (IS_DEV flag, pluggable setBillingProvider for real StoreKit/Play, DEV purchase/restore simulator, localized-price ready).
- Classic + Business FREE. Five premium pigeons £1.99 each (still previewable while locked) + "UNLOCK ALL 5 — £7.99 (SAVE £1.96)". Non-consumable, no subscriptions, no card handling, no Stripe.
- DEV simulator (sim-success/cancel/fail + restore) only in dev builds; success updates entitlement + persists (dp_purchasedPigeons, dp_bundleOwned) and unlocks immediately; cancel/fail unlock nothing (fail shows friendly message). Bundle unlocks all five and hides. RESTORE PURCHASES with visible confirmation (restore-msg).
- 733T remains a SEPARATE local `leet` entitlement (not a purchase record). Premium pigeons are cosmetic-only — zero gameplay advantage. Production billing to be injected via setBillingProvider() before release (Apple/Google authoritative for paid ownership).

## Update 7 (2026-06) — Online Global Leaderboard + Anti-Cheat — verified 100% (iteration_8)
- Backend: FastAPI + MongoDB (motor). Endpoints /api/leaderboard/register|submit|top. Collections players{playerId,nickname,bestDistance,updatedAt} + runs{runId unique} + flagged. Env MONGO_URL/DB_NAME (backend/.env, load_dotenv).
- Ranked ONLY by best distance (m). Anonymous local playerId (uuid), sanitized nickname (<=16, HTML/URL/control/profanity filtered). Best distance never decreases (atomic $max). Top 100 + your-rank fallback + highlight.
- Anti-cheat (server-authoritative, mirrors engine SPEED_MAX 380 / PPM 24 => ~15.83 m/s): rejects negative/NaN/Inf/over-cap(100000)/too-fast(distance>duration*maxMps*1.15+60)/impossible-chips(>1.2/m)/bad-id/duplicate runId(unique index=replay protection); flags plausible-but-extreme(>=40000) out of Top; in-memory rate limiter (20/60s/player).
- Frontend: LEADERBOARD menu button + LeaderboardScreen (nickname entry+validation, list, your-rank, offline 'LEADERBOARD UNAVAILABLE' state, retry). Submission is async/fire-and-forget on real crash ONLY when distance>submittedBest and nickname set; manual restart submits nothing; revive keeps same run. Game fully playable offline. dp_playerId/dp_nickname/dp_submittedBest persisted. Backend tests: /app/backend/tests/test_leaderboard.py (24 cases).

## Update 8 (2026-06) — 1000m "Pigeon Closes Its Eyes" blackout — verified (visual + engine reasoning)
- At 1000m (once per run) the screen fades to black (fade-in 450ms, hold, fade-out 800ms) with white text "This is what it looks like when a pigeon closes it's eyes." Fires ONCE per run (eventTriggered), configurable via CONFIG.BLACKOUT_TRIGGER_M / BLACKOUT_MS (3500) / BLACKOUT_RECOVERY_MS (800).
- Gameplay NEVER pauses: overlay is pointerEvents="none" (tap still flaps), physics + distance keep running. On trigger the world is cleared to open sky (obstacles + chips deactivated) and spawns are suppressed until quietUntilT (blackout end + recovery buffer), so the blind stretch is fair (only ground collision applies). Then obstacles resume smoothly.
- engine.js: currentBlackout(now) is a pure time function → snapshot.blackout (0..1). GameScreen BlackoutOverlay polls the shared world value (no hot-path re-render). Also fires in Easy Mode (see Update 9). Verified visually by temporarily lowering the trigger; overlay shows and clears correctly.

## Update 9 (2026-06) — Random Manor + £14.99 Easy Mode + Silly Mode leaderboard — verified 100% (iteration_9, 18/18 new + 24/24 legacy)
- CHOOSE YOUR MANOR now has 5 tiles: 3 standard maps (unchanged difficulty/physics) + RANDOM MANOR (map-random) + EASY MODE (map-easy, premium).
- RANDOM MANOR: each brand-new run (incl. Play Again / Restart) re-picks ONE of the 3 STANDARD maps only (getMapForSelection in data/maps.js) — Easy Mode is permanently excluded from the random pool, before/after purchase.
- EASY MODE: premium £14.99 one-time non-consumable (product drunkpigeons.mode.easymode). Always visible; locked (🔒 + price) until purchased. Tapping opens a deliberate purchase sheet (EASY MODE / £14.99 / BUY — £14.99 / CANCEL) via the existing pluggable Billing + DEV simulator (Success/Cancel/Fail; Restore via Pigeons screen). Success unlocks + selects immediately (no restart); Cancel/Fail unlock nothing. Independent of 733T (leet) and pigeon purchases. Persisted (dp_easyOwned).
- EASY MODE ruleset (config.js EASY_TUNING): huge gaps (GAP_BASE 430), long spacing (470), slow ramp, gentle vertical transitions (MAX_TOP_DELTA 55). Same controls/physics/collision geometry. Peaceful meadow-green identity (EASY_MAP). engine.reset(w,h,tuning) merges tuning over CONFIG. STANDARD maps untouched (fairness preserved).
- SILLY MODE leaderboard: server stores independent bestDistance (Global) and sillyBestDistance (Silly) per player; submit() routes STRICTLY by validated `mode` field (norm_mode coerces anything but 'easy' → 'normal') so Easy runs can NEVER enter Global. classify(req, mode) uses FLAG_DISTANCE_EASY=250000 so legit long Silly runs aren't flagged. GET /top?mode=normal|easy. Frontend: LeaderboardScreen show-silly/show-global toggle (🏆 GLOBAL ↔ 🏆 SILLY MODE), shared anonymous nickname. App.handleCrash submits mode-appropriately with separate submittedBest / submittedBestSilly. Backend regression: /app/backend/tests/test_mode_leaderboard.py (18 cases) + test_leaderboard.py (24).
- MOCKED: store billing (dev simulator) — real StoreKit/Play Billing injected via setBillingProvider() before release.

## Update 10 (2026-06) — Silly Podium + Easy Skyline polish — verified visually
- SILLY PODIUM: the Silly Mode leaderboard now opens with a cheeky "🏆 SILLY HALL OF FAME" top-3 podium — 👑 gold #1 (tallest, centre), 🥈 silver #2 (left), 🥉 bronze #3 (right), each with medal, nickname, distance and a coloured plinth; empty slots read "up for grabs"; your-row highlighted teal. Ranks #4+ render as the normal list below. Global leaderboard keeps the plain list (podium is Silly-only). (LeaderboardScreen.js SillyPodium + podium/rest split.)
- EASY SKYLINE: Easy Mode background swaps the dense city skyline for sparse, seamless rolling hills (Background.js hillPath — integer-frequency sine wave that tiles under parallax) in two green depth layers, plus soft grass tufts instead of kerb dashes, over the bright meadow palette. Standard maps unchanged (isEasy branch only).

## Update 11 (2026-06) — Manor Visual Polish & Environment Identity — verified 100% (iteration_10, visual-only, 0 regressions)
- VISUAL ONLY: no physics/hitbox/gap/placement/scroll/chip-placement/scoring/leaderboard changes (engine.js untouched). All new layers pointerEvents=none.
- maps.js palettes expanded + new art fields (skyStops multi-stop sky, cloudShadow, sun, haze, brickPalette/roofPalette/doorPalette, pavement, distant, props). Existing keys preserved for engine/heckler/feather compatibility.
- Background.js rebuilt into ~5 lightweight parallax layers: rich sky gradient → distant landmark silhouettes (DistantSvg: London spires/domes, Gritty cranes/tanks, seaside) → far skyline → near skyline with lit windows → decorative prop layer (PropSvg) → ground + pavement + detail. Distant layers scroll slower; slow procedural variety avoids obvious looping. Easy Mode hills branch retained.
- Manor identities: Sunny London (red buses/phone+post boxes/lamps/tree/bunting, bright layered skyline); Gritty (chain-link fences/wheelie bins/graffiti/aerials/scaffold + haze + neon-pink lit windows, grimy-but-colourful); Chippy Sunset show-stopper (purple→pink→orange→gold gradient + glowing low sun behind gameplay + seagulls + striped chippy awnings/benches + warm-lit windows).
- GameEntities.Building() draws brick/roof/door colours from the per-manor palettes (fixed OBSTACLE_WIDTH & collision rects unchanged). ChipView gains a translucent dark contrast halo (behind the crisp, collision unaffected) so gold chips stay visible on bright skies. HecklerView unchanged — window-anchoring preserved (no orphan bubbles).
- Readability safeguards verified: obstacles stay high-contrast vs desaturated background; chips visible on all three; screen-wide tap flap unaffected; window people anchored; no new collidable scenery; 0 console/runtime errors.

## Update 12 (2026-06) — "Choose your Manor" preview cards — illustrated thumbnails (visual-only, menu-only)
- Replaced the old two-colour swatch previews with lightweight STATIC illustrated mini-scenes (new src/components/ManorThumb.js, react-native-svg, 74x44 viewBox) that reuse each map's real palette/art direction — tiny snapshots of the actual maps, not live worlds.
- Sunny London: blue sky + clouds + red-brick terraces (chimneys/windows) + red double-decker bus + street lamp + green ground. Gritty: dark sky, grimy brick blocks with pink windows, rooftop aerial, graffiti tag accent, chain-link fence. Chippy Sunset (most colourful): multi-stop sunset gradient + glowing low sun + dark rooftops with warm glowing windows + striped chippy awning + seagull. Random: subtle 3-way vertical split of the standard manors (day/night/dusk skies + hint buildings + dusk sun) with the existing "?" overlay on top — NO Easy Mode imagery. Easy Mode: peaceful blue sky, fluffy clouds, rolling green hills, distant simple buildings (lots of open room).
- Preserved: card size, yellow selected border, manor names, horizontal layout, tap/select behaviour, Random functionality, Easy Mode lock + £14.99 purchase behaviour. Gameplay maps NOT modified. Verified via screenshot; 0 lint errors.

## Update 13 (2026-06) — £2.99 Remove Ads permanent entitlement — verified (store flow via screenshot)
- New non-consumable one-time purchase `drunkpigeons.removeads` (£2.99) via the existing pluggable Billing + DEV simulator (Success/Cancel/Fail/Restore). Independent of pigeons/bundle (£1.99/£7.99), Easy Mode (£14.99) and the 733T unlock.
- Entitlement `removeAdsOwned`: persisted (dp_removeAdsOwned), restored via the existing Restore Purchases, and kept in sync with the ad system via App useEffect → Ads.setRemoveAds() (takes effect immediately, no restart).
- ads.js is now entitlement-aware: registerDeath() returns no-interstitial when Remove Ads is owned (configurable interstitialDeathInterval=5); interstitialsEnabled()/isRemoveAdsOwned() helpers added. Rewarded revive (showRewardedRevive) stays available for everyone (player-initiated). NOTE: no live AdMob SDK in this web build yet — interstitials remain placeholders, but the gate/config are correct for when the real SDK is plugged in.
- UI: unobtrusive "REMOVE ADS — £2.99" row in the Pigeons store (below Restore Purchases), flips to "ADS REMOVED ✓" once owned. Verified: buy→owned flip, price display, independence (pigeons stay locked). 0 lint errors.

## Update 14 (2026-06) — Real AdMob configuration wired — verified 100% (iteration_11, web-fallback flow)
- Centralised config src/ads/admobConfig.js with the exact production IDs (no swaps): Android App ~6037769588, iOS App ~2962732884; Android interstitial /9785442908 + rewarded /7183330294; iOS interstitial /1594188197 + rewarded /8023487878. Google TEST units used when USE_TEST_ADS (=__DEV__); real units only in release. INTERSTITIAL_DEATH_INTERVAL=5.
- Platform-split provider so the native SDK never enters the web bundle: admobProvider.native.js = real react-native-google-mobile-ads v13 (InterstitialAd/RewardedAd, revive gated on EARNED_REWARD, preload after each show, guarded require); admobProvider.web.js = safe dev fallback (rewarded auto-grants, interstitial no-op). Installed react-native-google-mobile-ads@13.6.1. app.json carries `react-native-google-mobile-ads` key with android_app_id/ios_app_id + iOS NSUserTrackingUsageDescription + bundle identifiers. (v13 has no Expo config-plugin file, so the SDK's app.json key is used instead of a `plugins` entry — a plugins entry crashed `expo start`.)
- ads.js controller: init/preload, registerDeath() counts + marks pending (returns false when Remove Ads owned), showInterstitialIfDue() fires only at the Game Over→PLAY AGAIN transition and never blocks the next run, showRewardedRevive(onReward,onUnavailable). GameScreen: Ads.init() on mount; revive gated on verified reward with reviveBusy rapid-tap guard + "NO AD AVAILABLE…" message; PLAY AGAIN awaits interstitial-if-due. GameOverOverlay: real "REVIVE / Watch an ad to continue" UI. Remove Ads owners keep optional revive (no interstitials). Manual restart never calls registerDeath (doesn't count as death).
- Verified: revive continues SAME run (distance/score/chips preserved), one-per-run + reset on new run, rapid-tap protection, PLAY AGAIN never freezes, Remove Ads gating, correct ID mapping, 0 AdMob console errors. NOTE: real ad rendering only occurs on native device builds (SDK can't run in web preview) — web validated the full flow/gating via the fallback.
- BUILD NOTE: react-native-google-mobile-ads@^13 stays in package.json (needed for native/EAS builds) but its installed copy was removed from this preview's node_modules because its TurboModule TS-in-JS files crash the repo's JS lint-engine scan. The web bundle never imports it (uses admobProvider.web.js), so web/preview is unaffected; `yarn install` on EAS/production restores it for device builds.

## Update 15 (2026-06) — Remove "REVIVE USED" placeholder after revive (UI-only)
- GameOverOverlay now renders the revive block only when canRevive is true. After the one-per-run revive is consumed, subsequent Game Over screens show just PLAY AGAIN + MAIN MENU (no greyed "REVIVE USED"/"UNAVAILABLE"/disabled button, no empty gap — card rebalances). First death still shows PLAY AGAIN / REVIVE (Watch an ad to continue) / MAIN MENU. All revive/ad/entitlement/leaderboard logic and same-run continuation unchanged. Verified via screenshot (13m→33m same-run continuation, second death shows only PLAY AGAIN + MAIN MENU).

## Update 16 (2026-06) — Rare "Skinny Jab" pickup — verified (engine tests 10/10, iteration_12)
- New extremely rare fictional syringe pickup that INSTANTLY resets current fatness to original size. Engine now separates `fatChips` (drives fat level + pigeon radius/size) from `chipCount` (total eaten → HUD/score/leaderboard): eating a chip increments both; collecting a Skinny Jab sets fatChips=0 only (total chips/score/leaderboard untouched), then chips fatten from zero again.
- Spawn: rolls CONFIG.SKINNY_JAB_CHANCE (0.005) per obstacle spawn ONLY when fatChips>=SKINNY_JAB_MIN_FAT (10) and none active; placed into a fully validated safe gap (isJabPosSafe, full sprite bounds + pad) or skipped. Dev-overridable via engine.setSkinnyJabChance(). Collection by flight (circle overlap) → fatChips=0, feather burst, popT set, Audio.pop(), onSkinnyJab callback. reset() clears jab/fatChips/popT/skinnyJabCount. onCrash payload carries skinnyJabCount.
- Visuals: GameEntities.JabView = teal cartoon syringe SVG (bob/rotation/sparkle glow); GameScreen.PopText = big "POP!" (testid skinny-jab-pop) that scales/pops, floats up and fades ~1s above the pigeon; both pointerEvents=none (never block flap). Deflation is instant (size reads fatLevelFor(fatChips)). No changes to distance/score/speed/gravity/collision/revive/leaderboard/manors. Works in all manors + Easy Mode.
- Verified: /app/frontend/tests/engine_skinny_jab.test.mjs (10/10) — snapshot shape, 0 obstacle overlaps over 4000 steps, fatChips-vs-chipCount split, reset cleanup, setSkinnyJabChance validation, crash payload. UI mount/reset + no page errors confirmed. Temp test values (1.0/1) reverted to prod (0.005/10).

## Update 17 (2026-06) — Security hardening SEC-002 + P3 fixes (server-only, no gameplay change)
- SEC-002 (anonymous-write abuse): added a per-IP rate limiter (client_ip via X-Forwarded-For; RL_IP_MAX=240/min) ON TOP of the existing per-playerId limiter (20/min), applied to BOTH /api/leaderboard/register and /submit — caps a single flooder rotating self-generated playerIds while staying generous enough for households/mobile/public IPs sharing one address. No extra personal data collected.
- SEC-002 (unbounded growth): TTL retention indexes so transient abuse-control data auto-expires — runs.createdAt 7d, flagged.createdAt 30d (BSON Date fields added). The persistent `players`/leaderboard collection is NEVER TTL'd; ranking logic untouched.
- P3a: replay-protection insert now catches only pymongo DuplicateKeyError → 'duplicate-run'; other DB errors are no longer masked as duplicates (surface as real failures).
- P3b: GET /api/leaderboard/top now strictly validates the playerId query param with valid_id() (same rules as elsewhere); malformed values are ignored (board still returns, just without "you") — confirmed an injection-style string is safely dropped.
- NOT changed (per user): CORS lockdown (origins not final), gameplay/physics/manors/skinny-jab/chips/purchases/ads/revive/1000m/ranking/UI.

## PRE-PRODUCTION SECURITY REQUIREMENTS (must-do before store submission)
1. SEC-001 — implement REAL server-side purchase entitlement verification (Apple StoreKit + Google Play Billing receipt validation) before accepting production paid entitlements (Easy Mode £14.99, pigeons £1.99, bundle £7.99, Remove Ads £2.99). Entitlements are currently client-side (AsyncStorage) with a dev simulator — acceptable ONLY for pre-production. 733T remains a cosmetic-pigeon-only cheat and must not grant paid entitlements.
2. Re-run the Security Audit AFTER production IAP/receipt verification is implemented.
3. Re-run the Security Audit IMMEDIATELY BEFORE store submission (also finalise CORS origin allow-list + AdMob UMP/ATT consent at that time).
- SEC-003 (leaderboard plausibility/anti-cheat): retained as-is for launch prep (lightweight plausibility + duplicate + flagging); no signed-telemetry system at this stage.

## Backlog / next
- P1: Native build packaging (EAS) + expo-av sound files to replace web synth on device.
- P1: Real AdMob rewarded/interstitial wired into ads.js hooks; inject real StoreKit/Play Billing provider (pigeons + easymode + restore).
- P2: Unlock conditions for locked pigeons (chips/score milestones) + cosmetic accessories per map.
- P2: Distinct Easy Mode background art (reduce skyline density) beyond the palette swap.
- P2: Silence RN-Web SDK51 deprecation warnings (boxShadow/textShadow, pointerEvents in style).

## Update 18 (2026-06) — Leaderboard username uniqueness hardening — verified (backend 63 tests pass + UI screenshot)
- Global, case- AND space-insensitive unique usernames. New `normalize_nickname()` collapses a name to lowercase alphanumerics ("FatPigeon" = "fat pigeon" = "FATPIGEON" -> "fatpigeon").
- Backend (server.py): `_startup` now runs `_migrate_unique_nicknames()` which backfills `normalized_nickname` on existing players (oldest updatedAt keeps the name), de-duplicates legacy collisions by appending a short hex suffix to the nickname, then creates a SPARSE UNIQUE index on `normalized_nickname` (sparse so players without a name don't collide on null).
- `/register` computes normalized_nickname, upserts by playerId, catches pymongo DuplicateKeyError and returns `{ok:false, error:"USERNAME_TAKEN"}` — never leaks the other player's id. Re-saving your OWN name always succeeds.
- `/submit` name path: pre-checks whether the normalized name is held by a DIFFERENT player; if so it silently drops the name (score still records, player shows as default "Pigeon"). Wrapped in try/except DuplicateKeyError as a race fallback so a legit run is never lost.
- Frontend (LeaderboardScreen.js): USERNAME_TAKEN branch shows exact message "That pigeon name is already taken." (pink), input keeps its value, session/state preserved for retry. api.js already bubbled the error payload through.
- Tests: added test_username_uniqueness_case_insensitive + test_submit_with_taken_name_still_records_score; updated legacy tests to use unique nicknames (uniq() helper) since names are now globally unique. Full backend suite 63 passed. UI verified via screenshot (typed a taken name -> message rendered, retry preserved).

## Update 19 (2026-06) — Live name-availability hint + permanent name — verified (65 backend tests + UI screenshots)
- New read-only endpoint GET /api/leaderboard/check?nickname=&playerId= → {ok,available,reason}. Validates+normalizes the name; available:false with reason "taken" if held by a DIFFERENT player (case/space-insensitive), reason "invalid" for bad/empty names; a player's OWN name reads available to them. No writes, no rate-limit interference with register/submit.
- Names are now PERMANENT: /register rejects a switch to a DIFFERENT name once one is set (error "NAME_LOCKED"); re-saving the same identity (e.g. capitalisation) stays idempotent-OK. USERNAME_TAKEN uniqueness unchanged.
- Frontend (LeaderboardScreen.js): debounced (450ms) live check as the player types → teal ✓ "Nice — that name is free." when free, grey ✕ + reason ("already taken" / "won't fly") otherwise, spinner while checking, offline hint on network fail. SAVE NAME is disabled (Button now supports a `disabled` prop) until the name is confirmed free. Permanent-name warning shown always: "⚠ Choose carefully — this cannot be changed." api.js gained LeaderboardAPI.check().
- Tests: added test_check_availability + test_name_is_permanent_locked; full backend suite 65 passed. UI verified via screenshots (taken → grey ✕ + disabled save; free → teal ✓ + enabled save; warning visible).

## Update 20 (2026-06) — DRUNK ANIMATION: root-cause fix + shared visible system — VISUALLY VERIFIED
- ROOT CAUSE: there was never a real drunk system. Menu (MainMenu.js) and Pigeon Selection (PigeonsScreen.js preview + grid) rendered a 100% STATIC `PigeonSprite` SVG. Gameplay (GameEntities.PigeonView) had only a tiny ±3–9° sine `wobble` baked into the physics transform — no hiccup, HIC!, bubbles, barrel roll, wing flail, blink or drunk idle anywhere. Prior "implemented" claims were false; nothing animated on menu/previews and gameplay was near-static.
- NEW shared component `src/components/DrunkPigeon.js` used by ALL pigeons (gameplay + menu + all 7 previews incl. locked). Provides: continuous drunk idle (sway+uneven wobble+bob), droopy half-lidded eyes + occasional blink (via new PigeonSprite `droopy`/`blink` props), random one-at-a-time major events (hiccup+floating "HIC!", drunk bubbles that rise/drift/fade above the head, wing flail, big wobble, full 360° barrel roll). `intensity` (full/calm), `eyes`, `boost`, `active` props; fat increases amplitude. Pure reanimated (withRepeat/withSequence, UI-thread) + a lightweight JS scheduler; all timers/animations cancelled on unmount.
- TRANSFORM ARCHITECTURE (no conflicts): PigeonView outer Animated.View owns ONLY physics-driven presentation (world translate, velocity tilt, flap squash, dead/inv opacity); DrunkPigeon is nested INSIDE and owns the drunk visual transform; PigeonSprite (fat + accessories) is nested inside that. Bubbles/HIC render as non-clipped overlays. Because the whole sprite container rotates, accessories (tie/hood/crown/headband/camera/monocle) stay attached through wobble/roll.
- GAMEPLAY UNCHANGED: collision/hitbox use world.px/py + size in engine.js (untouched). The barrel roll & all drunk motion are purely visual — physics/gravity/flap/scoring/leaderboard/skinny-jab/manors/ads/IAP all unchanged. Removed only the old cosmetic wobble/bob from the physics transform.
- DEV DIAGNOSTIC: `DRUNK_DIAG` flag in DrunkPigeon.js exaggerates amplitude + fires events rapidly for verification. Used during testing, then set back to **false** (production) — confirmed.
- VISUAL VERIFICATION (screenshot agent): Menu — multi-frame distinct rotations + bubbles + droopy eyes; production cadence 16/16 sampled frames moving and HIC! observed within the window. Pigeon Selection — big preview + all 7 grid pigeons (incl. locked) visibly wobble with bubbles + HIC!, accessories attached. Gameplay — pigeon visibly drunk-tilted with bubbles mid-flight; controls remain fair.
- NOTE: spec mentioned a "Pub +5" pickup — no such pickup exists in the codebase (only decorative pub buildings). DrunkPigeon exposes a ready `boost` prop for temporary extra drunkenness, but it is not wired to any pickup since none exists (no gameplay was invented).

## Update 21 (2026-06) — Per-pigeon DRUNK PERSONALITIES (7 signature animations) — VISUALLY VERIFIED
- Extended the existing shared DrunkPigeon controller with a `PROFILES` config map (one controller, 7 personality profiles) — NOT seven engines. Each profile tunes idle amplitude/lean, event weights, cadence, hiccup label + a unique signature with cooldown + weighted randomness (one major event at a time).
- Signatures (all VISUAL-ONLY, driven by new sigRot/sigY/sigSX/sigSY shared values + existing roll/flail/hic): Classic "THE STAGGER" (over-correcting stumble + wing panic), Business "THE POWER NAP" (eyes close/head-drop asleep then startle awake, rare "…meeting?"), Roadman "NAH I'M GOOD" (huge wobble then confident recovery + nod, rare "SAFE."/"I'M GOOD."), King "THE ROYAL SALUTE" (gold sparkle + chest puff → slow majestic accidental roll → recover), Gym "ONE MORE REP" (3 drunken curls, final-rep shake/bulge → proud flex), Tourist "WHERE AM I" (looks L/R/behind + upside-down cartoon MapProp, rare "…London?"), Fancy "THE GENTLEMAN'S RECOVERY" (monocle glint + pipe-puff bubbles → slow controlled roll → polite nod, rare "Ahem.").
- Personality hiccups: per-profile HIC label/size (HIC! / hic. / HIC— / Hic! / HIC!! / hic? / Hic.); Gym hiccup tenses the chest; King/Fancy emit a gold bubble.
- Barrel-roll flavour varies by profile (rollMs + easing): Classic messy (adds flail), Roadman fast, King/Fancy slow & controlled, etc. Still the same safe visual-only roll.
- Fatness: durations scale with fatF (fatter = bigger + slower personality). Skinny Jab / Pub boost untouched — `boost` prop shortens cadence + cooldown and raises amplitude of THAT character's own behaviours (ready hook; still no pub pickup exists in-game).
- Accessory safety: whole container transforms so tie/hood/crown/headband/camera/monocle stay attached through every wobble/roll. Transient props (MapProp, gold sparkles, pipe-puff bubbles) are overlays, not permanent accessories. NOTE: sprite accessories differ from brief — Gym=headband (no dumbbells), King=crown (no staff), Fancy=monocle (no pipe), Tourist=camera (no glasses); animations were built around the REAL accessories, no new permanent art fabricated.
- Gameplay UNCHANGED: physics/hitbox/input in engine.js untouched; all personality motion is in the visual layer; tapping flaps immediately during any signature. DEV `DRUNK_DIAG` used to force signatures during verification, then set back to false (confirmed).
- VERIFIED (screenshot agent): Pigeon Selection cycled through all 7 (incl. locked) — signature quips "…meeting?", "SAFE.", personality hiccups "Hic."/"hic?" observed, distinct poses, accessories attached. Menu at production cadence: 8/8 sampled frames moving (continuous personality idle). Diagnostic disabled in production.

## Update 22 (2026-06) — Drunk visibility: PROVEN render path + made obvious (no new system)
- URL insight: .env has TWO preview hostnames — REACT_APP_BACKEND_URL=chip-pigeon… (canonical, what the user sees) and EXPO_PUBLIC_BACKEND_URL=d3e2f44b… Earlier verification used d3e2f44b; now verified on chip-pigeon too — BOTH serve the same current build and DrunkPigeon animates on both.
- RIDICULOUS PROOF TEST passed: temporary DIAG_STATIC forced the rendered pigeon to 2x + 45° on the OUTER root View of DrunkPigeon; gameplay AND menu pigeons became visibly huge+rotated on chip-pigeon URL → confirms DrunkPigeon (GameEntities.PigeonView→DrunkPigeon; MainMenu→DrunkPigeon; PigeonsScreen preview+grid→DrunkPigeon) IS the exact visible element in all three screens. No wrong/dead/duplicate component, no static image overlay, no transform overwrite (parent physics View and child DrunkPigeon View compose because they are separate Views; within DrunkPigeon bodyStyle is the sole transform). Diagnostic removed after.
- ROOT CAUSE of "looks static": not a broken render path — the base idle amplitude was too small AND signatures were cooldown-gated (~5–6s) so short gameplay runs (die at ~7m) rarely showed personality. Perception/tuning issue.
- FIX (tuning only, no new features): raised base idle amplitude (sway ±6→±10°, wobble ±3→±5°, bob 0.045→0.07); the scheduler now fires each pigeon's SIGNATURE immediately on mount (first event) and halved cadence + signature cooldown (prof.sigCd*0.5) so personality is unmistakable even in short runs. All still visual-only; physics/hitbox/input untouched.
- VERIFIED at production settings on chip-pigeon URL: menu pigeon shows distinct drunk poses frame-to-frame; Pigeons grid shows signatures firing at once (Business "…meeting?", Fancy "Ahem." quips). DIAG_STATIC + DRUNK_DIAG both removed/false in production.
