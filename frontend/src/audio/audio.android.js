import { NativeModules } from 'react-native';

// Short, predecoded samples in Android SoundPool. No synthesis, sample loading,
// timers or React updates on a flap/pickup. Web keeps the existing synth module.
let enabled = true;
let prepared = false;
function nativeAudio() {
  const module = NativeModules.DPGameAudio;
  if (!module) throw new Error('DP Android audio is missing. Run expo prebuild before building this APK.');
  return module;
}
function prepare() {
  if (prepared) return;
  nativeAudio().prepare();
  prepared = true;
}
function play(name) {
  if (!enabled) return;
  prepare();
  nativeAudio().play(name);
}
const signatures = new Set(['stagger', 'nap', 'nahgood', 'salute', 'rep', 'lost', 'gentleman']);

export const Audio = {
  setEnabled(value) {
    enabled = !!value;
    prepare(); // normally called by App's saved-settings load, while at the menu
    nativeAudio().setEnabled(enabled);
  },
  isEnabled() { return enabled; },
  unlock: prepare,
  flap() { play('flap'); },
  chip() { play('chip'); },
  crash() { play('crash'); },
  ui() { play('ui'); },
  highscore() { play('highscore'); },
  revive() { play('revive'); },
  pop() { play('pop'); },
  pint() { play('pint'); },
  leet() { play('leet'); },
  drunkSig(kind) { if (signatures.has(kind)) play(`sig_${kind}`); },
};
