// Standard manors — richer, layered, distinctly-British palettes. VISUAL ONLY:
// none of these fields affect physics, hitboxes, gaps, placement or scoring.
// Existing keys (skyTop/skyBottom/cloud/skyline/skylineBack/ground/groundTop/
// obstacle/obstacleDark/window/accent/feather) are preserved for compatibility
// with the engine, window-heckler anchoring and feather colours. New art fields:
//   skyStops   – multi-stop sky gradient
//   cloudShadow– cloud underside tint
//   sun        – { core, glow } low sunset sun (or absent)
//   haze       – full-screen atmospheric tint (or absent)
//   brickPalette/roofPalette/doorPalette – per-building colour variety
//   pavement   – street strip colour
//   distant    – distant-silhouette style id
//   props      – decorative background prop pool (never collidable)
export const MAPS = [
  {
    id: 'day',
    name: 'Sunny London',
    blurb: 'Bright & bold city day',
    skyTop: '#4fc3f7',
    skyBottom: '#cdeafd',
    skyStops: [
      { o: 0, c: '#2f9be6' },
      { o: 0.5, c: '#6fc4f2' },
      { o: 1, c: '#d3edfd' },
    ],
    cloud: '#ffffff',
    cloudShadow: '#d6ecfb',
    skyline: '#8090b6',
    skylineBack: '#a7b6d2',
    ground: '#5d8a3a',
    groundTop: '#7cb342',
    pavement: '#b9a68c',
    obstacle: '#c0522d',
    obstacleDark: '#8f3a1d',
    window: '#ffe082',
    accent: '#ffd23f',
    feather: '#ffffff',
    brickPalette: ['#c0522d', '#b5642f', '#d98a5a', '#e8d3a1', '#cf7f52', '#a9603a'],
    roofPalette: ['#7a3b28', '#5b4a3a', '#8f3a1d', '#6b4f3a'],
    doorPalette: ['#2f5d8f', '#7a3b28', '#3a6b4a', '#5a3d63'],
    distant: 'london',
    props: ['bus', 'phonebox', 'postbox', 'lamp', 'tree', 'bunting'],
  },
  {
    id: 'night',
    name: 'Gritty Backstreet',
    blurb: 'Rough, grimy backstreets',
    skyTop: '#141127',
    skyBottom: '#3f2f52',
    skyStops: [
      { o: 0, c: '#100e22' },
      { o: 0.55, c: '#281f3c' },
      { o: 1, c: '#43324f' },
    ],
    cloud: '#2c2745',
    cloudShadow: '#201a36',
    skyline: '#241d3d',
    skylineBack: '#2f2850',
    ground: '#1a1730',
    groundTop: '#2a2547',
    pavement: '#3a3550',
    obstacle: '#3d3550',
    obstacleDark: '#272038',
    window: '#ff5fa2',
    accent: '#3ef2c0',
    feather: '#e7d9ff',
    brickPalette: ['#4a3540', '#5a3a2f', '#3d3550', '#6b5a3a', '#47564a', '#7a4a3a'],
    roofPalette: ['#241d33', '#2a2038', '#1f2a28'],
    doorPalette: ['#20232b', '#3a2f2a', '#2a3540'],
    distant: 'gritty',
    haze: 'rgba(150,150,180,0.05)',
    props: ['bin', 'graffiti', 'scaffold', 'fence', 'aerial'],
  },
  {
    id: 'dusk',
    name: 'Chippy Sunset',
    blurb: 'Golden-hour seaside grease',
    skyTop: '#5a3a86',
    skyBottom: '#ffe6a0',
    skyStops: [
      { o: 0, c: '#4a2f7a' },
      { o: 0.26, c: '#a5527d' },
      { o: 0.5, c: '#ff7b54' },
      { o: 0.72, c: '#ff9e4a' },
      { o: 0.88, c: '#ffcf6b' },
      { o: 1, c: '#ffe9a8' },
    ],
    cloud: '#ffd9a8',
    cloudShadow: '#c76f83',
    skyline: '#6b3d63',
    skylineBack: '#9c5a7d',
    ground: '#6b3f2a',
    groundTop: '#8a5236',
    pavement: '#7a5a48',
    obstacle: '#5a3d63',
    obstacleDark: '#402b48',
    window: '#ffd23f',
    accent: '#ff8a5f',
    feather: '#fff3e0',
    brickPalette: ['#7a4a5a', '#8a5236', '#9c5a4a', '#6b4f6a', '#a3654a', '#7a5a3a'],
    roofPalette: ['#402b48', '#5a3a3a', '#3a2b48'],
    doorPalette: ['#3a2b48', '#7a3b28', '#5a3d2a'],
    distant: 'seaside',
    sun: { core: '#ffe58a', glow: '#ff9440' },
    props: ['chippy', 'awning', 'lamp', 'bench'],
  },
];

export const DEFAULT_MAP = 'day';
export const getMap = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

// EASY MODE — premium £14.99 landscape. Its own peaceful, open, spacious identity
// (soft sky, rolling meadow, gentle pastel buildings) so players instantly know
// they're in the chill mode. Same cartoon style, no clutter.
export const EASY_MAP = {
  id: 'easy',
  name: 'Easy Mode',
  blurb: 'you paid for peace',
  skyTop: '#7ec8f2',
  skyBottom: '#d8f4ff',
  skyStops: [
    { o: 0, c: '#7ec8f2' },
    { o: 1, c: '#e4f7ff' },
  ],
  cloud: '#ffffff',
  cloudShadow: '#d8eef7',
  skyline: '#a8d98a',
  skylineBack: '#c6e8ac',
  ground: '#4e9d3f',
  groundTop: '#82cd54',
  pavement: '#7ec850',
  obstacle: '#9fd67f',
  obstacleDark: '#6fae56',
  window: '#fff6c9',
  accent: '#ffd23f',
  feather: '#ffffff',
};

// The three STANDARD maps that count for the normal Global leaderboard.
export const STANDARD_MAP_IDS = MAPS.map((m) => m.id);

export const isEasySelection = (sel) => sel === 'easy';
export const isRandomSelection = (sel) => sel === 'random';

// Resolve the concrete map used for one run. RANDOM MANOR picks ONLY from the
// three STANDARD maps — Easy Mode is permanently excluded from the random pool.
export function getMapForSelection(sel) {
  if (sel === 'easy') return EASY_MAP;
  if (sel === 'random') return MAPS[Math.floor(Math.random() * MAPS.length)];
  return getMap(sel);
}

// Gameplay ruleset a selection generates: only Easy Mode is 'easy'; everything
// else (including Random Manor's standard picks) is 'normal'.
export const modeForSelection = (sel) => (sel === 'easy' ? 'easy' : 'normal');
