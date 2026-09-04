// Reusable obstacle-APPEARANCE system. It only decides how the (unchanged) obstacle
// geometry is *drawn* — collision hitboxes are never affected. Families are grouped
// into short contiguous "sections" so the scenery transitions naturally between
// rooftops, construction, commercial streets, railway areas and parks.

export const FAMILIES = {
  BUILDING: 'building',
  SCAFFOLD: 'scaffold',
  CRANE: 'crane',
  BILLBOARD: 'billboard',
  RAILWAY: 'railway',
  ROOFTOP: 'rooftop', // chimneys / vents / water tanks
  PARK: 'park', // trees / park structures
  BUNTING: 'bunting', // washing lines / bunting
};

// Per-map non-building family pools are defined below (NON_BUILDING).

function hash(n) {
  let a = (n | 0) >>> 0;
  a = (a ^ 61) ^ (a >>> 16);
  a = (a + (a << 3)) >>> 0;
  a = a ^ (a >>> 4);
  a = (a * 0x27d4eb2d) >>> 0;
  a = a ^ (a >>> 15);
  return a >>> 0;
}

const NON_BUILDING = {
  day: [FAMILIES.CRANE, FAMILIES.SCAFFOLD, FAMILIES.PARK, FAMILIES.BILLBOARD, FAMILIES.RAILWAY],
  night: [FAMILIES.ROOFTOP, FAMILIES.RAILWAY, FAMILIES.BILLBOARD, FAMILIES.SCAFFOLD, FAMILIES.CRANE],
  dusk: [FAMILIES.BILLBOARD, FAMILIES.SCAFFOLD, FAMILIES.ROOFTOP, FAMILIES.BUNTING, FAMILIES.PARK],
  easy: [FAMILIES.PARK, FAMILIES.BILLBOARD, FAMILIES.ROOFTOP],
};

// Deterministic family for an obstacle. ~40% are genuinely non-building. A forced
// non-building backbone on every 5th pair guarantees: a non-building within the first
// six pairs (index 2) and never more than four building-only pairs in a row. Depends
// only on spawn order + map id => stable per run and run-validation compatible.
export function familyForObstacle(spawnIndex, mapId) {
  const i = spawnIndex || 0;
  const nb = NON_BUILDING[mapId] || NON_BUILDING.day;
  const forced = (i % 5) === 2; // backbone (caps consecutive buildings at 4, hits i=2)
  const extra = (hash(i * 2654435761) % 5) === 0; // ~20% more => ~40% total
  if (!(forced || extra)) return FAMILIES.BUILDING;
  return nb[hash(i * 40503 + 7) % nb.length];
}

// A stable 0..1 variant value for within-family art variety (seeded per obstacle).
export function variantFor(seed) {
  return (hash(seed || 1) % 1000) / 1000;
}
