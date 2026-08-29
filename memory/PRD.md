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

## Backlog / next
- P1: Native build packaging (EAS) + expo-av sound files to replace web synth on device.
- P1: Real AdMob rewarded/interstitial wired into ads.js hooks.
- P2: Unlock conditions for locked pigeons (e.g., chips/score milestones) + cosmetic accessories per map.
- P2: Parallax scrolling background, more obstacle art variety (bus/bin/clock-tower sprites), leaderboard.
- P2: Silence RN-Web SDK51 deprecation warnings (boxShadow/textShadow, pointerEvents in style).
