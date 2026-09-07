// Executes the actual JS polling callbacks with a hostile UI shared-value
// getter. This catches thread readbacks that web gameplay tests do not expose.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = process.argv[2] ? resolve(process.argv[2], 'src') : resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const screen = readFileSync(resolve(root, 'screens/GameScreen.js'), 'utf8');
const billboard = readFileSync(resolve(root, 'components/SponsorBillboard.js'), 'utf8');
const background = readFileSync(resolve(root, 'components/Background.js'), 'utf8');
const pigeon = readFileSync(resolve(root, 'components/DrunkPigeon.js'), 'utf8');
const entities = readFileSync(resolve(root, 'components/GameEntities.js'), 'utf8');
let reads = 0;
const world = { get value() { reads++; throw new Error('Synchronous UI readback forbidden'); } };
const telemetry = { current: { distM: 0, distPx: 0, blackout: 0 } };

function callback(source, start) {
  const section = source.slice(source.indexOf(start));
  const match = section.match(/const id = setInterval\(\(\) => \{([\s\S]*?)\n\s*\}, (\d+)\);/);
  assert.ok(match, `Polling callback found: ${start}`);
  return match[1];
}
let distance, blackout, ad;
const slotRef = { current: -1 };
const impressions = [];
const selected = [];
const distanceTick = new Function('world', 'telemetry', 'setM', callback(screen, 'function DistanceHUD'));
const blackoutTick = new Function('world', 'telemetry', 'setA', callback(screen, 'function BlackoutOverlay'));
const billboardTick = new Function('world', 'telemetry', 'slotRef', 'GAP_DISTPX', 'theme', 'removeAds', 'pickBillboardAd', 'setAd', 'recordImpression', callback(billboard, 'slotRef.current = -1;'));
function poll() {
  distanceTick(world, telemetry, x => { distance = x; });
  blackoutTick(world, telemetry, x => { blackout = x; });
  billboardTick(world, telemetry, slotRef, 5600, { id: 'day' }, false,
    options => { selected.push(options); return { id: `ad-${options.seed}` }; },
    x => { ad = x; }, (id, d) => impressions.push({ id, d }));
}
for (const d of [0, 240, 5599, 5600, 5601, 11200]) {
  telemetry.current = { distPx: d, distM: Math.floor(d / 24), blackout: d === 11200 ? 0.8 : 0 };
  poll();
  assert.equal(distance, Math.floor(d / 24));
  assert.equal(blackout, telemetry.current.blackout);
}
assert.equal(reads, 0, 'HUD, blackout and billboard must never fetch UI state');
assert.equal(impressions.length, 3, 'Exactly one impression per observed slot, no duplicate per poll');
assert.deepEqual(selected.map(x => x.seed), [17, 118, 219]);
assert.equal(ad.id, 'ad-219');
telemetry.current = { distPx: 0, distM: 0, blackout: 0 };
poll();
assert.equal(distance, 0, 'Restart clears distance immediately in the JS mirror');
assert.equal(blackout, 0, 'Restart clears blackout');
assert.equal(impressions.length, 4, 'Restart selects slot zero again');
assert.doesNotMatch(screen.replace(/world\.value\s*=/g, ''), /world\.value\s*(?:\.|\[)/, 'Diagnostics must not reintroduce UI readback');
assert.match(screen, /telemetry\.current = initialSnapshot/);
assert.match(screen, /telemetry\.current = snap/);
assert.match(background, /<SponsorBillboard[^>]*telemetry=\{telemetry\}/);
assert.doesNotMatch(pigeon, /\[active, calm, diag, boost, strength/, 'Beer must not restart the random scheduler');
const beer = pigeon.slice(pigeon.indexOf('const wasBoosted'), pigeon.indexOf('// ---- signature animations'));
assert.doesNotMatch(beer, /spawnBubbles|bigWob\.value|flail\.value|hic\.value/, 'Pint must not mount bubble bursts or compete with random event drivers');
assert.match(beer, /pintWob\.value = withSequence/);
assert.match(pigeon, /pintWob\.value \* 22/);
const nativeFx = entities.slice(entities.indexOf('export function DrunkScreenFX'), entities.indexOf('/* ---------------- Feather'));
assert.match(nativeFx, /return null/);
assert.doesNotMatch(nativeFx, /rgba|<View|<Animated|withRepeat/, 'Native beer effect must not recolour the whole screen');
console.log('PASS: actual HUD/blackout/billboard callbacks work with ZERO UI readbacks; restart, ad slots and beer lifecycle verified');
