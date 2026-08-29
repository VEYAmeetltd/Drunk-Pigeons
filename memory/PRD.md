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

## Implemented (2026-06) — verified 100% by testing agent (iteration_1)
- Complete playable loop: Menu → Play → flap/gravity → procedural obstacles → chips → progressive fattening (6 stages) → distance score → gradual difficulty → funny crash w/ feathers + random death message → Game Over → Play Again.
- Best Score + lifetime Pigeons Injured persist across reload.
- Revive: one per run, 2s shield banner, keeps score/chips; ad-hook-ready.
- 3 maps (day/night/dusk) selectable on menu; sound toggle persists.
- Pigeons screen: Classic (selected) + Business unlocked; roadman/king/gym/tourist/fancy locked but preview their look.
- Mobile-first portrait, safe areas, page-scroll prevented on web.

## Backlog / next
- P1: Native build packaging (EAS) + expo-av sound files to replace web synth on device.
- P1: Real AdMob rewarded/interstitial wired into ads.js hooks.
- P2: Unlock conditions for locked pigeons (e.g., chips/score milestones) + cosmetic accessories per map.
- P2: Parallax scrolling background, more obstacle art variety (bus/bin/clock-tower sprites), leaderboard.
- P2: Silence RN-Web SDK51 deprecation warnings (boxShadow/textShadow, pointerEvents in style).
