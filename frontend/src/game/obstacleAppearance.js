// Decides, once per obstacle spawn, which FAMILY occupies the top and bottom
// side of that obstacle slot. Either side can be `null` (fully open sky) —
// that's what makes a "bottom-only" lamp post / crane / tree or a "top-only"
// hanging gantry possible instead of every encounter being a paired pipe.
// Purely a one-shot random pick at spawn time (mirrors how the engine already
// rolls o.kind/o.seed) — no need for spawnIndex-hash determinism any more,
// since the engine now caches the chosen geometry on the obstacle itself.
import { FAMILIES, BOTTOM_FAMILIES } from './obstacleGeometry';

// `hard` (Normal Mode) heavily favours a genuine piece on the OTHER side too
// (paired top+bottom pressure) and rarely leaves it wide open. Easy Mode
// flips that: the other side is open sky almost every time.
function pickTopFiller(hard) {
  const r = Math.random();
  if (hard) {
    if (r < 0.45) return FAMILIES.BUILDING;
    if (r < 0.55) return null;
    return FAMILIES.HANGING; // genuinely-mixed pair (different families both sides)
  }
  if (r < 0.4) return FAMILIES.BUILDING;
  if (r < 0.92) return null;
  return FAMILIES.HANGING;
}

function pickBottomFiller(hard) {
  const r = Math.random();
  if (hard) {
    if (r < 0.45) return FAMILIES.BUILDING;
    if (r < 0.55) return null;
    return BOTTOM_FAMILIES[Math.floor(Math.random() * BOTTOM_FAMILIES.length)];
  }
  if (r < 0.4) return FAMILIES.BUILDING;
  if (r < 0.92) return null;
  return BOTTOM_FAMILIES[Math.floor(Math.random() * BOTTOM_FAMILIES.length)];
}

// Normal Mode (`hard`): ~34% plain building pairs, 66% structural-family
// encounters, most of them paired with a genuine piece on the other side too.
// Easy Mode: ~62% plain building pairs, and any family encounter almost
// always leaves the other side wide open (single-sided, forgiving).
export function pickEncounter({ mustVary = false, hard = false } = {}) {
  let r = Math.random();
  if (mustVary) r = 0.52 + Math.random() * 0.48; // force a non-rectangular encounter
  const buildingCut = hard ? 0.34 : 0.62;
  const step = hard ? 0.12 : 0.06;
  let cut = buildingCut;
  if (r < cut) return { topFamily: FAMILIES.BUILDING, bottomFamily: FAMILIES.BUILDING };
  cut += step; if (r < cut) return { topFamily: pickTopFiller(hard), bottomFamily: FAMILIES.LAMP };
  cut += step; if (r < cut) return { topFamily: pickTopFiller(hard), bottomFamily: FAMILIES.CRANE };
  cut += hard ? step * 0.85 : step * 0.7; if (r < cut) return { topFamily: pickTopFiller(hard), bottomFamily: FAMILIES.SCAFFOLD };
  cut += step; if (r < cut) return { topFamily: pickTopFiller(hard), bottomFamily: FAMILIES.TREE };
  cut += hard ? step * 0.85 : step * 0.7; if (r < cut) return { topFamily: pickTopFiller(hard), bottomFamily: FAMILIES.INDUSTRIAL };
  cut += hard ? step * 0.7 : step * 0.7; if (r < cut) return { topFamily: pickTopFiller(hard), bottomFamily: FAMILIES.RAILWAY };
  return { topFamily: FAMILIES.HANGING, bottomFamily: pickBottomFiller(hard) };
}

// True when this encounter has at least one genuinely non-rectangular side.
export function isNonBuildingEncounter(enc) {
  return enc.topFamily === FAMILIES.HANGING || (enc.bottomFamily != null && enc.bottomFamily !== FAMILIES.BUILDING);
}
