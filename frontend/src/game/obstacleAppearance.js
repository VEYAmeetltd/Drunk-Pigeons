// Decides, once per obstacle spawn, which FAMILY occupies the top and bottom
// side of that obstacle slot. Either side can be `null` (fully open sky) —
// that's what makes a "bottom-only" lamp post / crane / tree or a "top-only"
// hanging gantry possible instead of every encounter being a paired pipe.
// Purely a one-shot random pick at spawn time (mirrors how the engine already
// rolls o.kind/o.seed) — no need for spawnIndex-hash determinism any more,
// since the engine now caches the chosen geometry on the obstacle itself.
import { FAMILIES, BOTTOM_FAMILIES } from './obstacleGeometry';

function pickTopFiller() {
  const r = Math.random();
  if (r < 0.55) return FAMILIES.BUILDING;
  if (r < 0.8) return null;
  return FAMILIES.HANGING; // occasional genuinely-mixed pair (different families both sides)
}

function pickBottomFiller() {
  const r = Math.random();
  if (r < 0.55) return FAMILIES.BUILDING;
  if (r < 0.8) return null;
  return BOTTOM_FAMILIES[Math.floor(Math.random() * BOTTOM_FAMILIES.length)];
}

// Target spawn balance: ~52% classic building pairs, 10% lamp posts, 10%
// crane/scaffold, 10% trees/park, 18% industrial/railway/hanging.
export function pickEncounter({ mustVary = false } = {}) {
  let r = Math.random();
  if (mustVary) r = 0.52 + Math.random() * 0.48; // force a non-rectangular encounter
  if (r < 0.52) return { topFamily: FAMILIES.BUILDING, bottomFamily: FAMILIES.BUILDING };
  if (r < 0.62) return { topFamily: pickTopFiller(), bottomFamily: FAMILIES.LAMP };
  if (r < 0.67) return { topFamily: pickTopFiller(), bottomFamily: FAMILIES.CRANE };
  if (r < 0.72) return { topFamily: pickTopFiller(), bottomFamily: FAMILIES.SCAFFOLD };
  if (r < 0.82) return { topFamily: pickTopFiller(), bottomFamily: FAMILIES.TREE };
  if (r < 0.88) return { topFamily: pickTopFiller(), bottomFamily: FAMILIES.INDUSTRIAL };
  if (r < 0.94) return { topFamily: pickTopFiller(), bottomFamily: FAMILIES.RAILWAY };
  return { topFamily: FAMILIES.HANGING, bottomFamily: pickBottomFiller() };
}

// True when this encounter has at least one genuinely non-rectangular side.
export function isNonBuildingEncounter(enc) {
  return enc.topFamily === FAMILIES.HANGING || (enc.bottomFamily != null && enc.bottomFamily !== FAMILIES.BUILDING);
}
