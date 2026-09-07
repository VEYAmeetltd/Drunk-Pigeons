const fs = require('fs');
const path = require('path');
const { withMainApplication, withDangerousMod } = require('expo/config-plugins');

const REGISTRATION = 'add(com.intiesltd.drunkpigeons.effects.DPVisualEffectsPackage())';

module.exports = function withDPVisualEffects(config) {
  config = withMainApplication(config, (mod) => {
    const application = mod.modResults;
    if (application.language !== 'kt') {
      throw new Error('DP visual effects expects the Expo Kotlin MainApplication. No Java application file was modified.');
    }
    if (!application.contents.includes(REGISTRATION)) {
      const anchor = /PackageList\(this\)\.packages\.apply\s*\{/g;
      if ([...application.contents.matchAll(anchor)].length !== 1) {
        throw new Error('DP visual effects could not locate the native package list. MainApplication was not changed.');
      }
      application.contents = application.contents.replace(anchor, (s) => `${s}\n              ${REGISTRATION}`);
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/com/intiesltd/drunkpigeons/effects');
    fs.mkdirSync(target, { recursive: true });
    for (const file of ['DPBeerWorldManager.java', 'DPVisualEffectsPackage.java', 'DPGameAudioModule.java']) {
      // These files are generated from the checked-in plugin sources, so both
      // local prebuild and a fresh EAS native generation produce the same code.
      fs.copyFileSync(path.join(__dirname, 'android', file), path.join(target, file));
    }
    const sounds = path.join(__dirname, '../src/audio/sfx');
    const audioTarget = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/assets/dp_sfx');
    fs.mkdirSync(audioTarget, { recursive: true });
    for (const file of fs.readdirSync(sounds).filter(file => file.endsWith('.wav'))) {
      fs.copyFileSync(path.join(sounds, file), path.join(audioTarget, file));
    }
    return mod;
  }]);
};
