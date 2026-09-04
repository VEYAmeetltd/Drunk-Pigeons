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

// Per-map family pools (map id -> ordered list). Every family in the pool WILL appear
// across a run because section selection walks the pool with a deterministic shuffle.
const POOLS = {
  day: [ // Sunny London — brighter, parks, scaffolding, cranes, colourful billboards
    FAMILIES.BUILDING, FAMILIES.PARK, FAMILIES.SCAFFOLD, FAMILIES.CRANE,
    FAMILIES.BILLBOARD, FAMILIES.ROOFTOP, FAMILIES.BUNTING,
  ],
  night: [ // Gritty Backstreet — tower blocks, industrial chimneys, railway, worn signs
    FAMILIES.BUILDING, FAMILIES.RAILWAY, FAMILIES.ROOFTOP, FAMILIES.SCAFFOLD,
    FAMILIES.BILLBOARD, FAMILIES.CRANE,
  ],
  dusk: [ // Chippy Sunset — takeaway/pub signs, rooftop vents, washing lines
    FAMILIES.BUILDING, FAMILIES.BILLBOARD, FAMILIES.ROOFTOP, FAMILIES.BUNTING,
    FAMILIES.PARK, FAMILIES.SCAFFOLD,
  ],
  easy: [ // gentle default
    FAMILIES.BUILDING, FAMILIES.PARK, FAMILIES.BILLBOARD, FAMILIES.ROOFTOP,
  ],
};

const SECTION_LEN = 3; // obstacles per environmental section before a transition

function hash(n) {
  let a = (n | 0) >>> 0;
  a = (a ^ 61) ^ (a >>> 16);
  a = (a + (a << 3)) >>> 0;
  a = a ^ (a >>> 4);
  a = (a * 0x27d4eb2d) >>> 0;
  a = a ^ (a >>> 15);
  return a >>> 0;
}

// Deterministic family for an obstacle, contiguous within a section, then it changes.
// Depends only on the obstacle's spawn order + map id => stable within a run and
// fully compatible with run-validation (no wall-clock / no extra randomness stored).
export function familyForObstacle(spawnIndex, mapId) {
  const pool = POOLS[mapId] || POOLS.day;
  const section = Math.floor((spawnIndex || 0) / SECTION_LEN);
  // Walk the pool in a shuffled order so every family shows up, avoiding immediate
  // repeats between adjacent sections.
  const idx = hash(section * 2654435761) % pool.length;
  let fam = pool[idx];
  if (section > 0) {
    const prev = pool[hash((section - 1) * 2654435761) % pool.length];
    if (fam === prev) fam = pool[(idx + 1) % pool.length];
  }
  return fam;
}

// A stable 0..1 variant value for within-family art variety (seeded per obstacle).
export function variantFor(seed) {
  return (hash(seed || 1) % 1000) / 1000;
}
