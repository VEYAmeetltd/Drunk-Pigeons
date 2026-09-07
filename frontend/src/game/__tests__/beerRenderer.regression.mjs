import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareBeerRenderer, BEER_BLUR_DP, sceneBlurRadius } from '../beerRenderer.js';
import { CONFIG } from '../../config.js';

function frameClock() {
  let id = 0;
  const pending = new Map();
  return {
    request(fn) { const next = ++id; pending.set(next, fn); return next; },
    cancel(key) { pending.delete(key); },
    step() { const batch = [...pending]; pending.clear(); batch.forEach(([, fn]) => fn()); },
    size() { return pending.size; },
  };
}
const clock = frameClock();
const events = [];
const cancel = prepareBeerRenderer(clock.request, clock.cancel, () => events.push('clear'), () => events.push('ready'));
for (let i = 0; i < 3; i++) clock.step();
assert.deepEqual(events, [], 'Gameplay remains gated during the initial render opportunities');
clock.step();
assert.deepEqual(events, ['clear'], 'Clear preview before enabling gameplay');
clock.step();
assert.deepEqual(events, ['clear']);
clock.step();
assert.deepEqual(events, ['clear', 'ready']);
assert.equal(clock.size(), 0, 'No continuous preparation loop survives');
cancel();
for (let i = 0; i < 10; i++) clock.step();
assert.equal(events.length, 2);
for (const stopAfter of [0, 2, 4, 5]) {
  const c = frameClock();
  let ready = false;
  const dispose = prepareBeerRenderer(c.request, c.cancel, () => {}, () => { ready = true; });
  for (let i = 0; i < stopAfter; i++) c.step();
  dispose();
  for (let i = 0; i < 10; i++) c.step();
  assert.equal(ready, false, 'Unmount must not enable gameplay later');
  assert.equal(c.size(), 0);
}
assert.equal(BEER_BLUR_DP, 9, 'Stronger, fixed scene blur is prepared before play');
const screen = readFileSync(new URL('../../screens/GameScreen.js', import.meta.url), 'utf8');
assert.doesNotMatch(screen, /boostTimer/, 'Beer lifetime belongs to the simulation, never a wall-clock timer');
assert.equal(CONFIG.PINT_BOOST_MS, 4500);

// Actual first-tap handler: preparation never starts run timing or consumes a
// flap. Once ready, the same first tap starts the run and flaps exactly once.
const flapBody = screen.split('const doFlap = useCallback(() => {')[1]?.split('\n  }, []);')[0];
assert.ok(flapBody);
let starts = 0, flaps = 0;
const context = {
  __DEV__: false,
  inputStatsRef: { current: { raw: 0, ignored: 0, accepted: 0, flaps: 0 } },
  rendererReadyRef: { current: false },
  Audio: { unlock() {}, flap() {} },
  engineRef: { current: { dead: false, start() { starts++; }, flap() { flaps++; } } },
  pausedRef: { current: false }, startedRef: { current: false }, runStartRef: { current: 0 },
  performance: { now: () => 123 }, setStarted() {}, pigeon: { id: 'classic' },
};
const tap = new Function(...Object.keys(context), flapBody).bind(null, ...Object.values(context));
tap();
assert.equal(starts, 0); assert.equal(flaps, 0); assert.equal(context.runStartRef.current, 0);
context.rendererReadyRef.current = true;
tap();
assert.equal(starts, 1); assert.equal(flaps, 1); assert.equal(context.runStartRef.current, 123);
tap();
assert.equal(starts, 1); assert.equal(flaps, 2);
console.log('PASS: finite/cancellable renderer preparation, immediate first ready tap, and fixed stronger blur with simulation-owned lifetime');

assert.equal(sceneBlurRadius(0), 0);
assert.equal(sceneBlurRadius(0.5), 1);
assert.equal(sceneBlurRadius(1), 4);
assert.equal(sceneBlurRadius(1, true), 9);
assert.equal(sceneBlurRadius(0, true), 9);
assert.equal(sceneBlurRadius(NaN), 0);
assert.equal(sceneBlurRadius(2), 4);
