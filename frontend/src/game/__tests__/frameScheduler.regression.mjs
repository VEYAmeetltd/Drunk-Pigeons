// Regression test for the 60Hz frame-pipeline fix (see GameScreen.js / frameScheduler.js).
//
// BUG: requestAnimationFrame fires at the DISPLAY's native refresh rate, so on a
// 90Hz/120Hz Android phone the engine was being stepped and a fresh world.value
// snapshot published on every single rAF callback — 1.5x-2x the intended rate.
// This produced excess simulation work, extra allocations/UI-thread transfers
// per second, and (worse) made the game itself run FASTER/DRIFT on high-refresh
// hardware since more fixed-feeling steps happened per real second.
//
// FIX: createFixedStepScheduler() decouples rAF's native cadence from the
// simulation, which is capped to a fixed 60Hz cadence via a classic
// accumulator. This test proves that cap holds and that elapsed real time
// produces IDENTICAL simulation/distance results at 60Hz, 90Hz and 120Hz
// display refresh rates, plus that a flap is always applied immediately
// (never delayed waiting on the accumulator).
//
// Run with: node --experimental-loader ./src/game/__tests__/esm-loader.mjs src/game/__tests__/frameScheduler.regression.mjs

import assert from 'node:assert/strict';
import { createEngine } from '../engine.js';
import { createFixedStepScheduler, SIM_STEP, MAX_FRAME_DT } from '../frameScheduler.js';

const noop = () => {};

// Simulates `durationSec` of real wall-clock time as a sequence of rAF
// callbacks firing at a fixed `hz`, driving the SAME scheduler+engine wiring
// GameScreen.js uses. Returns how many fixed sim steps actually ran and the
// resulting simulation state, so different display rates can be compared.
function simulate(hz, durationSec) {
  const scheduler = createFixedStepScheduler();
  const eng = createEngine({ onScore: noop, onChip: noop, onCrash: noop, onSkinnyJab: noop, onPint: noop });
  eng.reset(400, 800);
  eng.start();

  const frameMs = 1000 / hz;
  const totalFrames = Math.round((durationSec * 1000) / frameMs);
  let now = 0;
  scheduler.reset(now);

  let stepCount = 0;
  let maxStepsInOneFrame = 0;
  for (let i = 0; i < totalFrames; i++) {
    now += frameMs;
    const steps = scheduler.consume(now);
    maxStepsInOneFrame = Math.max(maxStepsInOneFrame, steps);
    for (let s = 0; s < steps; s++) {
      eng.step(SIM_STEP, now);
      stepCount++;
    }
  }
  return { stepCount, maxStepsInOneFrame, distancePx: eng.getSnapshot(now).distPx, distanceM: eng.distanceMeters };
}

const DURATION_SEC = 4;
const expectedSteps = Math.round(DURATION_SEC / SIM_STEP); // 240 fixed steps in 4s @ 60Hz cap

const r60 = simulate(60, DURATION_SEC);
const r90 = simulate(90, DURATION_SEC);
const r120 = simulate(120, DURATION_SEC);

// 1. The simulation must never run faster than ~60 updates/sec, no matter how
//    fast rAF actually fires (this is the core of the reported bug — a 120Hz
//    display was silently stepping the engine ~2x too often).
for (const [label, r] of [['60Hz', r60], ['90Hz', r90], ['120Hz', r120]]) {
  assert.ok(
    r.stepCount <= expectedSteps + 1,
    `${label} display: expected <= ${expectedSteps + 1} sim steps over ${DURATION_SEC}s (60Hz cap), got ${r.stepCount}`
  );
  assert.ok(
    r.stepCount >= expectedSteps - 1,
    `${label} display: expected >= ${expectedSteps - 1} sim steps over ${DURATION_SEC}s, got ${r.stepCount}`
  );
}

// 2. No single rAF callback should ever be allowed to burst more steps than the
//    stall-protection cap permits (MAX_FRAME_DT / SIM_STEP), even on a slow frame.
const maxStepsAllowed = Math.ceil(MAX_FRAME_DT / SIM_STEP);
for (const [label, r] of [['60Hz', r60], ['90Hz', r90], ['120Hz', r120]]) {
  assert.ok(
    r.maxStepsInOneFrame <= maxStepsAllowed,
    `${label} display: no single frame should run more than ${maxStepsAllowed} sim steps, got ${r.maxStepsInOneFrame}`
  );
}

// 3. No drift between refresh rates: the same elapsed real time must produce
//    the same number of sim steps (within 1, from rounding at the tail end)
//    and therefore practically identical simulated distance — a 120Hz phone
//    must play at the SAME speed as a 60Hz phone, never faster.
assert.ok(Math.abs(r60.stepCount - r90.stepCount) <= 1, '60Hz and 90Hz displays must produce the same sim-step count (no drift)');
assert.ok(Math.abs(r60.stepCount - r120.stepCount) <= 1, '60Hz and 120Hz displays must produce the same sim-step count (no drift)');

const oneStepDistance = 235 * SIM_STEP; // SPEED_BASE px/s * one fixed step — worst-case single-step tolerance
assert.ok(
  Math.abs(r60.distancePx - r90.distancePx) <= oneStepDistance,
  `distance must not drift between 60Hz and 90Hz displays (60Hz=${r60.distancePx}, 90Hz=${r90.distancePx})`
);
assert.ok(
  Math.abs(r60.distancePx - r120.distancePx) <= oneStepDistance,
  `distance must not drift between 60Hz and 120Hz displays (60Hz=${r60.distancePx}, 120Hz=${r120.distancePx})`
);
assert.equal(r60.distanceM, r90.distanceM, 'displayed metres must match exactly between 60Hz and 90Hz displays');
assert.equal(r60.distanceM, r120.distanceM, 'displayed metres must match exactly between 60Hz and 120Hz displays');

// 4. Immediate first-flap handling: flap() must apply its velocity change the
//    instant it is called — it must NEVER be queued/delayed waiting on the
//    fixed-step accumulator to "catch up" (this is what makes input feel
//    responsive even while the sim itself is capped to 60Hz).
{
  const scheduler = createFixedStepScheduler();
  const eng = createEngine({ onScore: noop, onChip: noop, onCrash: noop, onSkinnyJab: noop, onPint: noop });
  eng.reset(400, 800);
  eng.start();
  scheduler.reset(0);

  // Advance by a tiny sub-step amount (less than one SIM_STEP) so the
  // accumulator has NOT yet accrued enough to run a sim step...
  const tinyFrameMs = (SIM_STEP * 1000) / 4; // a quarter of one fixed step
  const stepsBefore = scheduler.consume(tinyFrameMs);
  assert.equal(stepsBefore, 0, 'a sub-fixed-step frame must not trigger a sim step yet');

  // ...flap() must still take effect immediately, independent of the engine
  // ever having stepped again.
  eng.flap();
  const snap = eng.getSnapshot(tinyFrameMs);
  assert.equal(snap.flap, 1, 'flapPulse must be applied immediately on flap(), even mid-accumulator');
}

console.log(
  `PASS: 60Hz frame-pipeline cap holds across 60/90/120Hz (steps: 60Hz=${r60.stepCount} 90Hz=${r90.stepCount} 120Hz=${r120.stepCount}, distance identical, flap is immediate)`
);
