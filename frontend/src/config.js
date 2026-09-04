// Central game configuration & tuning. All gameplay-affecting numbers live here.
export const CONFIG = {
  // Physics (px / second based, dt-normalised)
  GRAVITY: 2100,
  FLAP_VELOCITY: -620,
  MAX_FALL_SPEED: 1100,

  // World
  GROUND_H: 92,
  PIGEON_X_RATIO: 0.28, // horizontal position of pigeon as ratio of width

  // Pigeon sizing
  PIGEON_BASE_SIZE: 66,
  PIGEON_FAT_GROWTH: 0.1, // size multiplier added per fat level
  PIGEON_RADIUS_RATIO: 0.33,

  // Obstacles
  OBSTACLE_POOL: 7,
  OBSTACLE_WIDTH: 74,
  GAP_BASE: 258,
  GAP_MIN: 188,
  GAP_SHRINK_PER_SCORE: 1.1,
  SPACING_BASE: 300, // horizontal distance between obstacle pairs (px)
  SPACING_MIN: 232,
  SPACING_SHRINK_PER_SCORE: 1.2,
  MIN_TOP: 58,
  MIN_BOTTOM: 70, // above ground
  MAX_TOP_DELTA: 0, // 0 = unrestricted vertical variation (standard chaos)

  // Segment-geometry difficulty (Normal Mode): longer arms/masts/jibs + real
  // pieces allowed to reach a bit past the gap edge into the flight corridor.
  // Visible artwork only — hitboxes always match exactly what's drawn.
  HARD_GEOMETRY: true, // favours paired top+bottom encounters over open sky
  GEOM_SCALE: 1.6,
  GEOM_INTRUDE_BOTTOM: 26,
  GEOM_INTRUDE_TOP: 26,
  CHIP_GAP_SPREAD: 34, // px chips may sit off gap-centre (rewards precise flying)

  // Speed / difficulty
  SPEED_BASE: 235,
  SPEED_MAX: 380,
  SPEED_PER_SCORE: 2.6,

  // Chips
  CHIP_POOL: 28,
  CHIP_SIZE: 30,
  CHIP_SPAWN_MIN: 0.55, // seconds between chip spawns
  CHIP_SPAWN_MAX: 1.35,
  MAX_FAT_LEVEL: 6,

  // Feathers
  FEATHER_POOL: 16,

  // Revive
  REVIVE_INVINCIBLE_MS: 2000,

  // Distance: how many world pixels equal one displayed metre
  PIXELS_PER_METRE: 24,

  // 1000m "pigeon closes its eyes" blackout Easter egg
  BLACKOUT_TRIGGER_M: 1000, // distance (m) that fires the event, once per run
  BLACKOUT_MS: 3500,        // how long the eyes stay closed
  BLACKOUT_RECOVERY_MS: 800, // extra open-sky buffer after fade-out before obstacles resume

  // SKINNY JAB — extremely rare fictional syringe pickup that resets current fatness
  SKINNY_JAB_CHANCE: 0.005, // ~0.5% per eligible obstacle spawn opportunity
  SKINNY_JAB_MIN_FAT: 10, // only rolls once the pigeon carries >=10 chips of fatness
  SKINNY_JAB_SIZE: 34,

  // PUB PINT — collectible pint that briefly boosts the pigeon's own drunk visuals
  PINT_CHANCE: 0.06, // fairly common (fun pickup, not rare)
  PINT_SIZE: 34,
  PINT_BOOST_MS: 4200, // duration of the temporary extra-drunk visual boost
};

// Integer with thousands separators (no decimals). Safe on web + native (no Intl needed).
export const formatInt = (n) =>
  String(Math.floor(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const fatLevelFor = (chips) =>
  Math.min(CONFIG.MAX_FAT_LEVEL, Math.floor(chips / 10));

export const pigeonSizeFor = (fatLevel) =>
  CONFIG.PIGEON_BASE_SIZE * (1 + fatLevel * CONFIG.PIGEON_FAT_GROWTH);

export const pigeonRadiusFor = (fatLevel) =>
  pigeonSizeFor(fatLevel) * CONFIG.PIGEON_RADIUS_RATIO;

export const FAT_LABELS = [
  'Normal pigeon',
  'Slightly chunky',
  'Noticeably fat',
  'Very fat & struggling',
  'Ridiculously fat',
  'Ridiculously fat',
  'ABSOLUTE UNIT',
];

// Wording-only progression BEYOND "ABSOLUTE UNIT" (visual size/hitbox stay capped at
// MAX_FAT_LEVEL — these tiers never grow the pigeon further). Driven by TOTAL cumulative
// chips eaten this run (never reset by a Skinny Jab, only by a genuinely new run), at the
// same 10-chips-per-tier interval as the existing fatness tiers.
export const EXTRA_FAT_LABELS = [
  'AIRSPACE VIOLATION',
  'NEEDS ITS OWN RUNWAY',
  'HAS ITS OWN POSTCODE',
  'LEGALLY A LANDMARK',
  'VISIBLE FROM SPACE',
];

// 0 = not reached yet; 1..EXTRA_FAT_LABELS.length = index into EXTRA_FAT_LABELS (+1),
// capped at the final tier ("VISIBLE FROM SPACE") so it never overflows or cycles.
export const extraFatLevelFor = (totalChips) =>
  Math.max(0, Math.min(EXTRA_FAT_LABELS.length, Math.floor((totalChips || 0) / 10) - CONFIG.MAX_FAT_LEVEL));


// EASY MODE tuning — premium £14.99 ruleset. Overrides the standard difficulty
// numbers only (collision geometry, physics & controls stay identical). Absurdly
// forgiving: huge gaps, long safe spaces, gentle vertical transitions, slow ramp.
export const EASY_TUNING = {
  GAP_BASE: 430,
  GAP_MIN: 360,
  GAP_SHRINK_PER_SCORE: 0.25,
  SPACING_BASE: 470,
  SPACING_MIN: 400,
  SPACING_SHRINK_PER_SCORE: 0.3,
  SPEED_BASE: 205,
  SPEED_MAX: 300,
  SPEED_PER_SCORE: 0.8,
  MIN_TOP: 46,
  MIN_BOTTOM: 60,
  MAX_TOP_DELTA: 55, // clamp vertical jump between consecutive obstacles (no tight transitions)

  // Segment-geometry difficulty (Easy Mode): short, stubby pieces, never
  // reaching past the gap edge, and heavily favours open-sky single-sided
  // encounters over paired top+bottom pressure.
  HARD_GEOMETRY: false,
  GEOM_SCALE: 0.55,
  GEOM_INTRUDE_BOTTOM: 0,
  GEOM_INTRUDE_TOP: 0,
  CHIP_GAP_SPREAD: 18, // chips stay close to gap-centre, easy to scoop up
};
