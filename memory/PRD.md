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

## Backlog / next
- P1: Native build packaging (EAS) + expo-av sound files to replace web synth on device.
- P1: Real AdMob rewarded/interstitial wired into ads.js hooks; inject real StoreKit/Play Billing provider (pigeons + easymode + restore).
- P2: Unlock conditions for locked pigeons (chips/score milestones) + cosmetic accessories per map.
- P2: Distinct Easy Mode background art (reduce skyline density) beyond the palette swap.
- P2: Silence RN-Web SDK51 deprecation warnings (boxShadow/textShadow, pointerEvents in style).
