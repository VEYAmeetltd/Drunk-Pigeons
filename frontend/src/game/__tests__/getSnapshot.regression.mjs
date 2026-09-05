// Regression test for the getSnapshot() identity/native-rendering bug.
//
// BUG: an earlier "perf optimisation" mutated the SAME nested obs/chips/
// feathers/heckler/jab/pint objects in place every frame and only ever
// returned a fresh TOP-LEVEL wrapper. On native Android, Reanimated caches
// nested values as "shareable" clones keyed by JS object identity, so
// UI-thread worklets kept reading the FIRST-ever transferred obstacle
// positions forever — obstacles froze off-screen and never became visible.
//
// This test proves getSnapshot() always publishes brand-new nested
// references (and that those references' VALUES track the simulation),
// so the bug class cannot silently regress again.
//
// Run with: node --experimental-vm-modules src/game/__tests__/getSnapshot.regression.mjs
// (pure ESM, no Jest/RN dependency required — engine.js has none either)

import assert from 'node:assert/strict';
import { createEngine } from '../engine.js';

const noop = () => {};
const eng = createEngine({ onScore: noop, onChip: noop, onCrash: noop, onSkinnyJab: noop, onPint: noop });
eng.reset(400, 800);
eng.start();

const snap1 = eng.getSnapshot(0);
eng.step(1 / 60, 1 / 60);
const snap2 = eng.getSnapshot(1 / 60);

// 1. Every nested container must be a NEW reference on every call.
assert.notStrictEqual(snap1.obs, snap2.obs, 'snapshot.obs must be a fresh array each call');
assert.notStrictEqual(snap1.chips, snap2.chips, 'snapshot.chips must be a fresh array each call');
assert.notStrictEqual(snap1.feathers, snap2.feathers, 'snapshot.feathers must be a fresh array each call');
assert.notStrictEqual(snap1.heckler, snap2.heckler, 'snapshot.heckler must be a fresh object each call');
assert.notStrictEqual(snap1.jab, snap2.jab, 'snapshot.jab must be a fresh object each call');
assert.notStrictEqual(snap1.pint, snap2.pint, 'snapshot.pint must be a fresh object each call');

// 2. Every per-slot element inside obs/chips/feathers must ALSO be fresh —
//    this is exactly the mistake the regression made (fresh array, stale
//    elements inside it).
for (let i = 0; i < snap1.obs.length; i++) {
  assert.notStrictEqual(snap1.obs[i], snap2.obs[i], `snapshot.obs[${i}] must be a fresh object each call`);
}
for (let i = 0; i < snap1.chips.length; i++) {
  assert.notStrictEqual(snap1.chips[i], snap2.chips[i], `snapshot.chips[${i}] must be a fresh object each call`);
}
for (let i = 0; i < snap1.feathers.length; i++) {
  assert.notStrictEqual(snap1.feathers[i], snap2.feathers[i], `snapshot.feathers[${i}] must be a fresh object each call`);
}

// 3. Stepping the engine must be reflected in the NEWLY published snapshot
//    (proves the fresh objects carry real, current simulation values, not
//    just fresh-but-frozen placeholders).
assert.ok(snap1.obs.some((o) => o.active === 1), 'expected at least one active obstacle at run start');
const movedIdx = snap1.obs.findIndex((o) => o.active === 1);
assert.notStrictEqual(
  snap1.obs[movedIdx].x,
  snap2.obs[movedIdx].x,
  'active obstacle x must change between consecutive snapshots after stepping'
);

// eslint-disable-next-line no-undef
console.log('PASS: getSnapshot() publishes fresh nested references with live, tracking values on every call');
