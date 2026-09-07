// Static-source regression test (no RN test renderer available here): asserts the
// permanently-mounted / signal-driven pattern used for the Skinny Jab toast and the
// Roadman scripted speech bubble is present in source, so a future edit can't quietly
// go back to key={...}/conditional-mount remounting each pickup — that was previously
// creating a new animated/text subtree on a live gameplay frame on every trigger.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entities = readFileSync(join(__dirname, '../../components/GameEntities.js'), 'utf8');
const screen = readFileSync(join(__dirname, '../../screens/GameScreen.js'), 'utf8');
const mainMenu = readFileSync(join(__dirname, '../../screens/MainMenu.js'), 'utf8');
const background = readFileSync(join(__dirname, '../../components/Background.js'), 'utf8');
const billboard = readFileSync(join(__dirname, '../../components/SponsorBillboard.js'), 'utf8');
const drunkPigeon = readFileSync(join(__dirname, '../../components/DrunkPigeon.js'), 'utf8');

assert.match(entities, /export function SkinnyToast\({\s*signal/, 'SkinnyToast must take a signal prop, not remount via key');
assert.doesNotMatch(screen, /skinnyKey > 0 && <SkinnyToast/, 'SkinnyToast must not be conditionally mounted via skinnyKey any more');
assert.match(screen, /<SkinnyToast signal={skinnySignal}/, 'SkinnyToast must stay permanently mounted, driven by a signal prop');
assert.doesNotMatch(entities, /<Animated\.Text[^>]*>SKINNY AGAIN!/, 'Skinny Jab text must not animate on every frame');
assert.match(screen, /<PopText signal={skinnySignal}/, 'POP callout must be driven by the pickup signal, not the per-frame world value');
assert.doesNotMatch(screen, /function PopText\({\s*world/, 'POP callout must never subscribe to the per-frame world value');

assert.match(entities, /export function PigeonSpeechBubble\({[^}]*visible/, 'PigeonSpeechBubble must take a visible prop, not be conditionally mounted');
assert.doesNotMatch(screen, /{scriptedLine && </, 'PigeonSpeechBubble must not be conditionally mounted via scriptedLine truthiness any more');
const roadman = entities.slice(entities.indexOf('export function PigeonSpeechBubble'), entities.indexOf('/* "SKINNY AGAIN!'));
assert.match(roadman, /pigeonSpeechPresentation\(world.value/, 'Roadman speech follows its pigeon via a UI worklet');
assert.match(screen, /<StablePigeonSpeechBubble[^>]*world=/);
assert.match(roadman, /<SvgText\b/);
assert.doesNotMatch(roadman, /<Text\b|<Animated\.Text\b|onLayout=/, 'Attached speech must not move or measure native Text');
assert.doesNotMatch(screen, /scriptedTimerRef/, 'Speech uses active play time');

const hecklerStart = entities.indexOf('export function HecklerView');
const hecklerEnd = entities.indexOf('function WindowPerson', hecklerStart);
const hecklerSource = entities.slice(hecklerStart, hecklerEnd);
assert.match(hecklerSource, /hecklerPresentation\(world.value, eventId/, 'Window and speech must share the current simulation event');
assert.doesNotMatch(hecklerSource, /<Text\b|<Animated\.Text\b/, 'The attached speech must not move native Text every frame');
assert.match(hecklerSource, /<SvgText\b/, 'Heckler speech must use the bounded SVG artwork');
assert.doesNotMatch(screen, /hecklerTimerRef/, 'A wall-clock timer must not detach speech from the simulated person');
assert.doesNotMatch(hecklerSource, /onLayout=/, 'Heckler callout must not measure native text during live gameplay');
assert.doesNotMatch(billboard, /renderToHardwareTextureAndroid|shouldRasterizeIOS/, 'Billboard must not force a persistent native GPU texture');
assert.doesNotMatch(drunkPigeon, /renderToHardwareTextureAndroid|shouldRasterizeIOS/, 'Pigeon quips must not force native GPU textures');

assert.match(screen, /function ReadyHint\(\{ visible, preparing = false \}\)/, 'Ready hint must toggle visibility without remounting');
assert.match(screen, /return \(\) => cancelAnimation\(p\)/, 'Ready hint must cancel its infinite pulse');
assert.match(screen, /<ReadyHint visible=\{!started && !over\} preparing=\{!rendererReady\} \/>/, 'Ready hint must remain mounted across PLAY AGAIN and show preparation before enabling the first tap');
assert.doesNotMatch(screen, /\{!started && !over && <ReadyHint/, 'Ready hint must not conditionally remount');
assert.match(mainMenu, /return \(\) => cancelAnimation\(bob\)/, 'Main-menu bob must cancel when leaving the menu');
assert.doesNotMatch(background, /renderToHardwareTextureAndroid|shouldRasterizeIOS/, 'Large background SVG layers must not allocate additional full-size hardware textures');
assert.match(drunkPigeon, /boost \? 2\.8 : 1/, 'Pub Pint must strongly amplify the pigeon without moving the world');
assert.match(entities, /export function DrunkScreenFX\(\{ level = 0, boosted = false \}\)/, 'Native Pub Pint treatment must be explicit and finite');
assert.match(screen, /const startRun[\s\S]*?setPintBoost\(false\)/, 'A new run must clear any surviving Pub Pint boost');
assert.match(screen, /onCrash[\s\S]*?setPintBoost\(false\)/, 'A crash must clear the Pub Pint boost immediately');
const drunkFxStart = entities.indexOf('export function DrunkScreenFX');
const drunkFxEnd = entities.indexOf('/* ---------------- Feather', drunkFxStart);
const nativeDrunkFx = entities.slice(drunkFxStart, drunkFxEnd);
assert.doesNotMatch(nativeDrunkFx, /useAnimatedStyle|withRepeat|withTiming/, 'Pub Pint screen treatment must stay static on native');

// Ambient personality animations are visual flavour, not gameplay events. They
// must never emit unexplained signature SFX, and both their scheduler and the
// screen-owned simulation clock must stop behind pause/game-over overlays.
const pigeonViewStart = entities.indexOf('export function PigeonView');
const pigeonViewEnd = entities.indexOf('/* Roadman', pigeonViewStart);
const pigeonView = entities.slice(pigeonViewStart, pigeonViewEnd);
assert.match(pigeonView, /active = true/, 'PigeonView must expose an explicit activity gate');
assert.match(pigeonView, /active=\{active\}/, 'The activity gate must reach DrunkPigeon');
assert.doesNotMatch(pigeonView, /<DrunkPigeon[^>]*\ssound(?:\s|=|\/|>)/, 'Ambient character signatures must not emit random gameplay sounds');
assert.match(screen, /onCrash[\s\S]*?pausedRef\.current = true;[\s\S]*?Audio\.crash\(\)/, 'Game Over must freeze the screen clock before playing the one-shot crash sound');
assert.match(screen, /const startRun[\s\S]*?pausedRef\.current = false;[\s\S]*?schedulerRef\.current\.reset/, 'A new run must explicitly resume and reset the screen clock');
assert.match(screen, /eng\.revive\(now\);[\s\S]*?schedulerRef\.current\.reset\(now\);[\s\S]*?pausedRef\.current = false;/, 'A rewarded revive must resume without a catch-up frame');
assert.match(screen, /<StablePigeonView[^>]*active=\{!over && !confirmRestart\}/, 'Character event timers must stop behind both blocking overlays');
console.log('PASS: scripted text effects stay mounted and native text is isolated from per-frame movement');
