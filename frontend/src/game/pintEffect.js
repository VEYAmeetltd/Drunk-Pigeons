import { CONFIG } from '../config';

// Simulation time only: pausing cannot sober the pigeon or consume its roll.
// No timers, animation scheduling, sound loading or React updates per frame.
export function createPintEffect(onActiveChange) {
  let remainingMs = 0;
  let turns = 0;
  let targetTurns = 0;
  function sober() {
    const wasActive = remainingMs > 0;
    remainingMs = 0;
    if (wasActive && onActiveChange) onActiveChange(false);
  }
  return {
    collect() {
      const wasActive = remainingMs > 0;
      remainingMs = CONFIG.PINT_BOOST_MS;
      // Each pickup earns one COMPLETE turn, including consecutive pickups.
      // A completed 360 degrees is visually identical to zero; never rewind
      // an unfinished roll when another beer arrives.
      if (turns === targetTurns) turns = targetTurns = 0;
      targetTurns += 1;
      if (!wasActive && onActiveChange) onActiveChange(true);
    },
    step(dt) {
      if (!(dt > 0) || !Number.isFinite(dt)) return;
      if (remainingMs > 0) {
        remainingMs = Math.max(0, remainingMs - dt * 1000);
        if (remainingMs < 0.000001) {
          remainingMs = 0;
          if (onActiveChange) onActiveChange(false);
        }
      }
      turns = Math.min(targetTurns, turns + dt * 1000 / CONFIG.PINT_ROLL_MS);
      if (targetTurns - turns < 0.000001) turns = targetTurns;
    },
    sober,
    reset() { sober(); turns = targetTurns = 0; },
    get active() { return remainingMs > 0; },
    get remainingMs() { return remainingMs; },
    get rollDegrees() { return turns * 360; },
    get flapScale() { return remainingMs > 0 ? CONFIG.PINT_FLAP_SCALE : 1; },
  };
}
