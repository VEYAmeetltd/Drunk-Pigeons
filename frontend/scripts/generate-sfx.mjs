// Offline/build-time export of the existing web sound recipes to short WAVs.
// Ships generated samples: this synth is never imported by the game.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/audio/audio.js'), 'utf8');
let events = [];
const sounds = new Function('tone', 'noise', 'ensure', `let enabled=true; const Audio = ${source.split('export const Audio = ')[1]}; return Audio;`)
  (o => events.push({ ...o, noise:false }), o => events.push({ ...o, noise:true }), () => {});
const jobs = ['flap','chip','crash','ui','highscore','revive','pop','pint','leet'].map(name => [name,() => sounds[name]()]);
for (const kind of ['stagger','nap','nahgood','salute','rep','lost','gentleman']) jobs.push([`sig_${kind}`,() => sounds.drunkSig(kind)]);
const SAMPLE_RATE = 48000;
const out = path.join(root, 'src/audio/sfx'); fs.mkdirSync(out, {recursive:true});
let bytes = 0;
for (const [name, collect] of jobs) {
  events = []; collect();
  const duration = Math.max(...events.map(e => (e.delay || 0) + e.dur)) + 0.02;
  const pcm = new Float64Array(Math.ceil(duration * SAMPLE_RATE));
  let randomState = 0x44505346;
  const random = () => { randomState = (Math.imul(randomState,1664525)+1013904223) >>> 0; return randomState / 0x100000000; };
  for (const e of events) {
    const count = Math.ceil(e.dur * SAMPLE_RATE);
    const start = Math.round((e.delay || 0) * SAMPLE_RATE);
    const freq = e.freq || 440;
    const ratio = e.slideTo ? Math.log(e.slideTo / freq) : 0;
    let filteredNoise = 0;
    const alpha = 1 - Math.exp(-2 * Math.PI * 1200 / SAMPLE_RATE);
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE;
      let wave;
      if (e.noise) {
        filteredNoise += alpha * ((random() * 2 - 1) * (1 - t / e.dur) - filteredNoise);
        wave = filteredNoise;
      } else {
        const phase = ratio ? 2 * Math.PI * freq * e.dur / ratio * Math.expm1(ratio * t / e.dur) : 2 * Math.PI * freq * t;
        if (e.type === 'square') wave = Math.sin(phase) >= 0 ? 1 : -1;
        else if (e.type === 'triangle') wave = 2 / Math.PI * Math.asin(Math.sin(phase));
        else if (e.type === 'sawtooth') wave = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
        else wave = Math.sin(phase);
      }
      const envelope = !e.noise && t < 0.01
        ? 0.0001 * Math.pow(e.gain / 0.0001,t / 0.01)
        : e.gain * Math.pow(0.0001 / e.gain,Math.max(0,t - (e.noise ? 0 : 0.01)) / (e.dur - (e.noise ? 0 : 0.01)));
      pcm[start + i] += wave * envelope * 0.5; // existing web master gain
    }
  }
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write('RIFF',0); wav.writeUInt32LE(wav.length - 8,4); wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(SAMPLE_RATE,24); wav.writeUInt32LE(SAMPLE_RATE * 2,28);
  wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(pcm.length * 2,40);
  for (let i = 0; i < pcm.length; i++) wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i])) * 32767),44 + i * 2);
  fs.writeFileSync(path.join(out,`${name}.wav`),wav); bytes += wav.length;
}
console.log(`Exported ${jobs.length} short PCM WAV effects (${bytes} bytes) from the existing web recipes.`);
