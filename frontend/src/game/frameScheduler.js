// Fixed-timestep scheduler used by the game loop (see GameScreen.js).
//
// PROBLEM: requestAnimationFrame fires at the DISPLAY's native refresh rate
// (60Hz on most phones, but 90Hz/120Hz on many modern Android devices). If we
// stepped the physics engine and published a fresh world.value snapshot on
// EVERY rAF callback, a 120Hz device would run the simulation twice as fast
// as intended and publish/allocate 2x the snapshots per second — this was the
// root cause of the reported physical-Android micro-stutter/GC pressure.
//
// FIX: decouple "how often rAF fires" (kept at native refresh rate, for the
// lowest-latency touch pickup on the very next frame) from "how often the
// simulation actually steps" (capped to a fixed 60Hz cadence via a classic
// fixed-timestep accumulator). This guarantees identical elapsed-time/
// distance behaviour regardless of the device's display refresh rate.
export const SIM_STEP = 1 / 60;
// Existing long-pause/stall protection: a single rAF callback can contribute
// at most this many seconds to the accumulator, so a real stall (tab switch,
// slow frame) never dumps a huge backlog into a catch-up burst of steps.
export const MAX_FRAME_DT = 1 / 30;

export function createFixedStepScheduler() {
  let last = null;
  let acc = 0;

  return {
    // Call when (re)starting or resuming from a pause — drops any pending
    // backlog so a paused/backgrounded app never catches up in one burst.
    reset(now) {
      last = now;
      acc = 0;
    },
    // Feed the current rAF timestamp (ms). Returns how many fixed SIM_STEPs
    // should run for this callback (0, 1, or more on a slow/dropped frame).
    consume(now) {
      if (last === null) last = now;
      let frameDt = (now - last) / 1000;
      last = now;
      if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;
      acc += frameDt;
      let steps = 0;
      while (acc >= SIM_STEP) {
        acc -= SIM_STEP;
        steps++;
      }
      return steps;
    },
  };
}
