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

assert.match(entities, /export function SkinnyToast\({\s*signal/, 'SkinnyToast must take a signal prop, not remount via key');
assert.doesNotMatch(screen, /skinnyKey > 0 && <SkinnyToast/, 'SkinnyToast must not be conditionally mounted via skinnyKey any more');
assert.match(screen, /<SkinnyToast signal={skinnySignal}/, 'SkinnyToast must stay permanently mounted, driven by a signal prop');

assert.match(entities, /export function PigeonSpeechBubble\({[^}]*visible/, 'PigeonSpeechBubble must take a visible prop, not be conditionally mounted');
assert.doesNotMatch(screen, /{scriptedLine && </, 'PigeonSpeechBubble must not be conditionally mounted via scriptedLine truthiness any more');

console.log('PASS: Roadman speech bubble and Skinny Jab effects keep stable mounted subtrees');
