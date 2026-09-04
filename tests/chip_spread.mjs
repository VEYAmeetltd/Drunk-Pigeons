// Verify chip spread: chips inside gap corridor sit tighter to centre in Easy
// than in Normal (CHIP_GAP_SPREAD=18 vs 34), and no chips overlap obstacle art.
import { createEngine } from '../frontend/src/game/engine.js';
import { CONFIG, EASY_TUNING } from '../frontend/src/config.js';
import { FAMILIES, hitTestSegment } from '../frontend/src/game/obstacleGeometry.js';

const W = 390, H = 844;
const OW = CONFIG.OBSTACLE_WIDTH;
const CHIP_R = CONFIG.CHIP_SIZE * 0.5;

function sample(tuning, label) {
  const eng = createEngine({ onChip: () => {} });
  eng.reset(W, H, tuning);
  eng.start();
  let safety = 20000;
  const offsets = [];
  let unsafe = 0;
  const seenChipIds = new Set();
  while (safety-- > 0 && offsets.length < 300) {
    eng.step(1 / 60, performance.now());
    eng.flap();
    const snap = eng.getSnapshot(performance.now());
    const geoms = eng.getObstacleGeom();
    // For each active chip near an obstacle, compute offset from gap centre.
    for (const c of snap.chips) {
      if (!c.active || c.eaten) continue;
      // find nearest obstacle by x
      let best = null, bestDx = 1e9;
      for (const g of geoms) {
        if (!g.active) continue;
        const cx = c.x; // (obstacle x isn't in getObstacleGeom, need snapshot)
      }
      // Snapshot obstacles have x; join by index
      const obsSnap = snap.obs;
      for (let i = 0; i < obsSnap.length; i++) {
        if (!obsSnap[i].active) continue;
        const ox = obsSnap[i].x;
        if (c.x >= ox && c.x <= ox + OW) { best = { g: geoms[i], ox }; break; }
      }
      if (!best || !best.g) continue;
      const gapCy = best.g.topH + best.g.gap / 2;
      const off = c.y - gapCy;
      const key = `${Math.round(c.x)}_${Math.round(c.y)}`;
      if (!seenChipIds.has(key)) {
        seenChipIds.add(key);
        offsets.push(Math.abs(off));
        // check chip doesn't overlap segment art
        const bTop = best.g.topH + best.g.gap;
        if (best.g.topGeo) for (const s of best.g.topGeo.segments) if (hitTestSegment(c.x, c.y, CHIP_R, s, best.ox, 0)) unsafe++;
        if (best.g.bottomGeo) for (const s of best.g.bottomGeo.segments) if (hitTestSegment(c.x, c.y, CHIP_R, s, best.ox, bTop)) unsafe++;
      }
    }
    if (eng.dead) { eng.reset(W, H, tuning); eng.start(); }
  }
  offsets.sort((a, b) => a - b);
  const avg = offsets.reduce((a, b) => a + b, 0) / (offsets.length || 1);
  const p90 = offsets[Math.floor(offsets.length * 0.9)] || 0;
  return { label, samples: offsets.length, avgOff: avg.toFixed(2), maxOff: (offsets[offsets.length - 1] || 0).toFixed(2), p90Off: p90.toFixed(2), unsafeChips: unsafe };
}

const n = sample(undefined, 'NORMAL');
const e = sample(EASY_TUNING, 'EASY');
console.log(JSON.stringify(n, null, 2));
console.log(JSON.stringify(e, null, 2));

const results = [];
function check(name, cond, detail) { results.push({ name, pass: cond, detail }); }
check('Normal chip spread wider than Easy (max offset)', parseFloat(n.maxOff) > parseFloat(e.maxOff), `${n.maxOff} vs ${e.maxOff}`);
check('Normal max offset near CHIP_GAP_SPREAD=34', parseFloat(n.maxOff) >= 30 && parseFloat(n.maxOff) <= 40, `${n.maxOff}`);
check('Easy max offset near CHIP_GAP_SPREAD=18', parseFloat(e.maxOff) >= 15 && parseFloat(e.maxOff) <= 22, `${e.maxOff}`);
check('No chip overlaps segment art in Normal', n.unsafeChips === 0, `${n.unsafeChips}`);
check('No chip overlaps segment art in Easy', e.unsafeChips === 0, `${e.unsafeChips}`);
let pass = 0, fail = 0;
for (const r of results) { console.log(`${r.pass?'PASS':'FAIL'}: ${r.name} — ${r.detail}`); r.pass?pass++:fail++; }
console.log(`${pass}/${pass+fail} chip-spread assertions passed`);
process.exit(fail === 0 ? 0 : 1);
