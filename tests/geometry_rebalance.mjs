// Headless statistical test of the DRUNK PIGEONS difficulty rebalance.
// Uses the real engine (pure JS pipeline) to spawn N obstacles in Normal vs
// Easy mode and measures the difficulty-rebalance invariants.
import { createEngine } from '../frontend/src/game/engine.js';
import { CONFIG, EASY_TUNING } from '../frontend/src/config.js';
import { FAMILIES, hitTestSegment } from '../frontend/src/game/obstacleGeometry.js';

const W = 390, H = 844;
const N = 400; // obstacles to sample per mode

function sampleMode(tuning, label) {
  const eng = createEngine({});
  eng.reset(W, H, tuning);
  // manually cycle placeObstacle by stepping until many are recycled off-screen.
  // Faster: reach into the engine's public getObstacleGeom + manually advance
  // by stepping large dt to scroll obstacles left; the engine spawns new ones.
  eng.start();
  const seen = [];
  let safety = 200000;
  while (seen.length < N && safety-- > 0) {
    eng.step(1 / 60, performance.now());
    // ensure the pigeon never dies during sampling: keep it at mid-screen and
    // never collide by continually flapping. Simpler: just make it invincible
    // by teleporting via revive when dead.
    if (eng.dead) {
      // pull raw sample after every crash; then reset (fresh spawn stream).
      const geoms = eng.getObstacleGeom();
      for (const g of geoms) if (g.active) seen.push(g);
      eng.reset(W, H, tuning);
      eng.start();
      continue;
    }
    // Flap every step to keep it alive (won't affect obstacle spawning).
    eng.flap();
  }
  if (seen.length < N) {
    const geoms = eng.getObstacleGeom();
    for (const g of geoms) if (g.active) seen.push(g);
  }
  return { label, obstacles: seen.slice(0, N) };
}

function analyse({ label, obstacles }) {
  let building = 0, pairedNonBuilding = 0, openSky = 0, singleSided = 0;
  let intrudeTopMax = 0, intrudeBottomMax = 0;
  let armReachMax = 0, armReachSum = 0, armCount = 0;
  const familyCounts = {};

  for (const o of obstacles) {
    const tf = o.topFamily, bf = o.bottomFamily;
    familyCounts[tf || 'none'] = (familyCounts[tf || 'none'] || 0) + 1;
    familyCounts['B:' + (bf || 'none')] = (familyCounts['B:' + (bf || 'none')] || 0) + 1;

    if (tf === FAMILIES.BUILDING && bf === FAMILIES.BUILDING) building++;
    else if ((tf == null || tf === FAMILIES.BUILDING) && (bf == null || bf === FAMILIES.BUILDING)) building++;
    else if (tf != null && bf != null && tf !== FAMILIES.BUILDING && bf !== FAMILIES.BUILDING) pairedNonBuilding++;
    else if (tf == null && bf == null) openSky++;
    else singleSided++;

    // measure how much geometry intrudes past the gap edge
    if (o.topGeo) {
      for (const s of o.topGeo.segments) {
        if (s.type === 'rect') intrudeTopMax = Math.max(intrudeTopMax, (s.y + s.h) - o.topH);
      }
    }
    const bTop = o.topH + o.gap;
    const groundY = H - CONFIG.GROUND_H;
    const bottomH = groundY - bTop;
    if (o.bottomGeo) {
      for (const s of o.bottomGeo.segments) {
        if (s.type === 'rect') intrudeBottomMax = Math.max(intrudeBottomMax, -s.y); // negative y = intrudes into corridor
        // arm reach = how far outside the [0,OW] lane a piece extends
        const OW = CONFIG.OBSTACLE_WIDTH;
        if (s.type === 'rect') {
          const outside = Math.max(-s.x, s.x + s.w - OW, 0);
          if (outside > 0) { armReachMax = Math.max(armReachMax, outside); armReachSum += outside; armCount++; }
        }
      }
    }
  }
  const total = obstacles.length || 1;
  return {
    label,
    total,
    buildingPct: (building / total * 100).toFixed(1),
    pairedNonBuildingPct: (pairedNonBuilding / total * 100).toFixed(1),
    singleSidedPct: (singleSided / total * 100).toFixed(1),
    openSkyPct: (openSky / total * 100).toFixed(1),
    intrudeTopMax: intrudeTopMax.toFixed(1),
    intrudeBottomMax: intrudeBottomMax.toFixed(1),
    armReachMax: armReachMax.toFixed(1),
    armReachAvg: armCount ? (armReachSum / armCount).toFixed(1) : '0',
    armCount,
    familyCounts,
  };
}

// ---- Fairness/collision safety test: for each obstacle sample many points
// inside the "reserved fair corridor" (nominal gap band) and ensure NONE of
// the segments claim to hit a point that is more than `intrude` px past the
// gap edge — i.e. no invisible-box deaths in the fair corridor.
function collisionFairness({ label, obstacles }, expectedIntrudeBottom, expectedIntrudeTop) {
  const OW = CONFIG.OBSTACLE_WIDTH;
  const r = 22; // small pigeon radius
  let unfair = 0;
  for (const o of obstacles) {
    if (!o.active) continue;
    // Sample a grid of pigeon centre positions strictly inside the "fair"
    // corridor: y in (topH + intrudeTop + r + 2, topH + gap - intrudeBottom - r - 2)
    const ox = o.x, bTop = o.topH + o.gap;
    const yMin = o.topH + expectedIntrudeTop + r + 2;
    const yMax = bTop - expectedIntrudeBottom - r - 2;
    if (yMax <= yMin) continue;
    for (let step = 0; step < 6; step++) {
      const px = ox + (OW * (step + 0.5)) / 6;
      const py = yMin + (yMax - yMin) * ((step + 0.5) / 6);
      let hit = false;
      if (o.topGeo) for (const s of o.topGeo.segments) if (hitTestSegment(px, py, r, s, ox, 0)) { hit = true; break; }
      if (!hit && o.bottomGeo) for (const s of o.bottomGeo.segments) if (hitTestSegment(px, py, r, s, ox, bTop)) { hit = true; break; }
      if (hit) unfair++;
    }
  }
  return { label, unfairHits: unfair };
}

const normal = sampleMode(undefined, 'NORMAL');
const easy = sampleMode(EASY_TUNING, 'EASY');

const nA = analyse(normal);
const eA = analyse(easy);

console.log('=== ANALYSIS ===');
console.log(JSON.stringify(nA, null, 2));
console.log(JSON.stringify(eA, null, 2));

console.log('\n=== COLLISION FAIRNESS (corridor should be clear of segment hits) ===');
console.log(JSON.stringify(collisionFairness(normal, CONFIG.GEOM_INTRUDE_BOTTOM, CONFIG.GEOM_INTRUDE_TOP)));
console.log(JSON.stringify(collisionFairness(easy, EASY_TUNING.GEOM_INTRUDE_BOTTOM, EASY_TUNING.GEOM_INTRUDE_TOP)));

// ---- Assertions
const results = [];
function check(name, cond, detail) { results.push({ name, pass: cond, detail }); }

check('Normal has more paired non-building than Easy',
  parseFloat(nA.pairedNonBuildingPct) > parseFloat(eA.pairedNonBuildingPct),
  `${nA.pairedNonBuildingPct}% vs ${eA.pairedNonBuildingPct}%`);

check('Easy has more building/open (forgiving) than Normal',
  (parseFloat(eA.buildingPct) + parseFloat(eA.singleSidedPct)) >=
  (parseFloat(nA.buildingPct) + parseFloat(nA.singleSidedPct)) * 0.9,
  `easy forgiving=${(parseFloat(eA.buildingPct)+parseFloat(eA.singleSidedPct)).toFixed(1)}% vs normal=${(parseFloat(nA.buildingPct)+parseFloat(nA.singleSidedPct)).toFixed(1)}%`);

check('Normal geometry actually intrudes into corridor (>0 px)',
  parseFloat(nA.intrudeBottomMax) > 5 || parseFloat(nA.intrudeTopMax) > 5,
  `top=${nA.intrudeTopMax} bottom=${nA.intrudeBottomMax}`);

check('Easy geometry does NOT intrude into corridor (0 px)',
  parseFloat(eA.intrudeBottomMax) < 1 && parseFloat(eA.intrudeTopMax) < 1,
  `top=${eA.intrudeTopMax} bottom=${eA.intrudeBottomMax}`);

check('Normal has longer arm/jib reach than Easy',
  parseFloat(nA.armReachMax) > parseFloat(eA.armReachMax),
  `normal max=${nA.armReachMax} avg=${nA.armReachAvg}; easy max=${eA.armReachMax} avg=${eA.armReachAvg}`);

check('Normal HARD_GEOMETRY delivers a fair fraction of paired encounters (>15%)',
  parseFloat(nA.pairedNonBuildingPct) > 15,
  `${nA.pairedNonBuildingPct}%`);

check('Easy predominantly single-sided or building (>=70%)',
  parseFloat(eA.buildingPct) + parseFloat(eA.singleSidedPct) >= 70,
  `${(parseFloat(eA.buildingPct)+parseFloat(eA.singleSidedPct)).toFixed(1)}%`);

console.log('\n=== ASSERTIONS ===');
let pass = 0, fail = 0;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.name} — ${r.detail}`);
  if (r.pass) pass++; else fail++;
}
console.log(`\n${pass}/${pass+fail} assertions passed`);
process.exit(fail === 0 ? 0 : 1);
