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
  MIN_TOP: 58,
  MIN_BOTTOM: 70, // above ground

  // Speed / difficulty
  SPEED_BASE: 235,
  SPEED_MAX: 380,
  SPEED_PER_SCORE: 2.6,

  // Chips
  CHIP_POOL: 18,
  CHIP_SIZE: 30,
  CHIP_SPAWN_MIN: 0.55, // seconds between chip spawns
  CHIP_SPAWN_MAX: 1.35,
  MAX_FAT_LEVEL: 6,

  // Feathers
  FEATHER_POOL: 16,

  // Revive
  REVIVE_INVINCIBLE_MS: 2000,
};

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
