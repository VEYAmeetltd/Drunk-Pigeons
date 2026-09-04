// Reusable obstacle-APPEARANCE system. It only decides how the (unchanged) obstacle
// geometry is *drawn* — collision hitboxes are never affected. ~40% of obstacle pairs
// are genuinely non-building structures (crane, scaffolding, railway gantry, tree,
// billboard) with bold, unmistakable silhouettes; the rest are varied cartoon buildings.

export const FAMILIES = {
  BUILDING: 'building',
  SCAFFOLD: 'scaffold',
  CRANE: 'crane',
  BILLBOARD: 'billboard',
  RAILWAY: 'railway',
  ROOFTOP: 'rooftop', // (legacy) chimneys / vents — building-attached decor
  PARK: 'park', // trees / park structures
  BUNTING: 'bunting', // (legacy) washing lines / bunting — building-attached decor
};

function hash(n) {
  let a = (n | 0) >>> 0;
  a = (a ^ 61) ^ (a >>> 16);
  a = (a + (a << 3)) >>> 0;
  a = a ^ (a >>> 4);
  a = (a * 0x27d4eb2d) >>> 0;
  a = a ^ (a >>> 15);
  return a >>> 0;
}

// Per-map pools of STRONG, bold non-building silhouettes (all rendered by
// StructureColumn). Every entry is unmistakably not a rectangular building.
const NON_BUILDING = {
  day: [FAMILIES.CRANE, FAMILIES.SCAFFOLD, FAMILIES.PARK, FAMILIES.BILLBOARD, FAMILIES.RAILWAY],
  night: [FAMILIES.CRANE, FAMILIES.SCAFFOLD, FAMILIES.RAILWAY, FAMILIES.BILLBOARD],
  dusk: [FAMILIES.BILLBOARD, FAMILIES.SCAFFOLD, FAMILIES.PARK, FAMILIES.CRANE, FAMILIES.RAILWAY],
  easy: [FAMILIES.PARK, FAMILIES.BILLBOARD, FAMILIES.CRANE],
};

// Deterministic "is this spawn index a non-building?" — forced backbone every 4th pair
// (caps consecutive building-only pairs at 3 and guarantees a non-building by index 2)
// plus ~20% extra => ~40% non-building overall. Depends only on spawn order => stable
// per run and compatible with server run-validation.
function isNonBuilding(k) {
  const forced = (k % 4) === 2;
  const extra = (hash(k * 2654435761) % 5) === 0;
  return forced || extra;
}

// 0-based rank of a non-building spawn among all non-buildings so far. Memoised so long
// runs stay cheap (obsGeom is only recomputed on (re)spawn, but this keeps it O(1) amortised).
const _rankCache = [];
function nonBuildingRank(i) {
  if (_rankCache.length === 0) _rankCache[0] = isNonBuilding(0) ? 1 : 0;
  for (let k = _rankCache.length; k <= i; k++) {
    _rankCache[k] = _rankCache[k - 1] + (isNonBuilding(k) ? 1 : 0);
  }
  return _rankCache[i] - 1;
}

// Deterministic family for an obstacle. Non-buildings rotate through the map pool by
// rank so distinct silhouettes appear quickly (3+ within the first 12 pairs).
export function familyForObstacle(spawnIndex, mapId) {
  const i = spawnIndex || 0;
  const nb = NON_BUILDING[mapId] || NON_BUILDING.day;
  if (!isNonBuilding(i)) return FAMILIES.BUILDING;
  return nb[nonBuildingRank(i) % nb.length];
}

// A stable 0..1 variant value for within-family art variety (seeded per obstacle).
export function variantFor(seed) {
  return (hash(seed || 1) % 1000) / 1000;
}
