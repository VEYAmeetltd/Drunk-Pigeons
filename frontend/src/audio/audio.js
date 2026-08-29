import { Platform } from 'react-native';

// Lightweight in-code synth SFX using the Web Audio API (web).
// On native this is a safe no-op for now; swap in expo-av + sound files later.
let ctx = null;
let enabled = true;
let master = null;

function ensure() {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.3, slideTo = null, delay = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.25, gain = 0.4 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime;
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

export const Audio = {
  setEnabled(v) {
    enabled = !!v;
  },
  isEnabled() {
    return enabled;
  },
  unlock() {
    ensure();
  },
  flap() {
    tone({ freq: 520, slideTo: 300, type: 'square', dur: 0.1, gain: 0.14 });
  },
  chip() {
    tone({ freq: 880, slideTo: 1320, type: 'triangle', dur: 0.09, gain: 0.22 });
  },
  crash() {
    tone({ freq: 220, slideTo: 60, type: 'sawtooth', dur: 0.35, gain: 0.3 });
    noise({ dur: 0.3, gain: 0.35 });
  },
  ui() {
    tone({ freq: 660, type: 'sine', dur: 0.08, gain: 0.18 });
  },
  highscore() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.22, delay: i * 0.11 })
    );
  },
  revive() {
    tone({ freq: 300, slideTo: 900, type: 'triangle', dur: 0.3, gain: 0.22 });
  },
};
