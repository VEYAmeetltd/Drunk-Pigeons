import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const src = fs.readFileSync(path.join(root,'src/audio/audio.android.js'),'utf8');
const calls = [];
const native = {
  prepare(){ calls.push(['prepare']); },
  setEnabled(value){ calls.push(['enabled',value]); },
  play(name){ calls.push(['play',name]); },
};
const make = modules => new Function('NativeModules',src.replace(/^import[^\n]*\n/, '').replace('export const Audio','const Audio')+'\nreturn Audio;')(modules);
const audio = make({DPGameAudio:native});
audio.setEnabled(true);
for (let i=0;i<100;i++){ audio.unlock(); audio.flap(); }
assert.equal(calls.filter(c=>c[0]==='prepare').length,1,'Preload once, not on every tap');
assert.equal(calls.filter(c=>c[0]==='play').length,100);
audio.setEnabled(false);
const muted = calls.length;
for (const name of ['flap','chip','crash','ui','highscore','revive','pop','pint','leet']) audio[name]();
audio.drunkSig('nap');
assert.equal(calls.length,muted,'Muted events cannot reach native playback');
audio.setEnabled(true);
for (const name of ['flap','chip','crash','ui','highscore','revive','pop','pint','leet']) audio[name]();
for (const kind of ['stagger','nap','nahgood','salute','rep','lost','gentleman']) audio.drunkSig(kind);
const beforeUnknown=calls.length;audio.drunkSig('unknown');assert.equal(calls.length,beforeUnknown);
const played=[...new Set(calls.filter(c=>c[0]==='play').map(c=>c[1]))].sort();
const files=fs.readdirSync(path.join(root,'src/audio/sfx')).filter(f=>f.endsWith('.wav')).sort();
assert.deepEqual(files,played.map(p=>p+'.wav'));
let totalBytes=0;
for (const file of files) {
  const b=fs.readFileSync(path.join(root,'src/audio/sfx',file));totalBytes+=b.length;
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
  assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),48000);
  assert.equal(b.readUInt16LE(34),16);assert.equal(b.readUInt32LE(40),b.length-44);
  assert.ok(b.length>2000 && b.length<1000000,'SoundPool samples stay short');
  let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));
  assert.ok(peak>100 && peak<30000,`${file}: audible samples without clipping`);
}
assert.ok(totalBytes<1024*1024,'Whole predecoded SFX set stays below one MiB');
assert.throws(()=>make({}).setEnabled(true),/Run expo prebuild/,'Missing registration must not quietly ship silent audio');
console.log(`PASS: Android sound routing, one-time preload, mute/unmute and all ${files.length} non-silent bounded PCM samples`);
