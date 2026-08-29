import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  best: 'dp_bestScore',
  injured: 'dp_pigeonsInjured',
  sound: 'dp_soundEnabled',
  pigeon: 'dp_selectedPigeon',
  map: 'dp_selectedMap',
  unlocked: 'dp_unlockedPigeons',
};

async function getNumber(key, def) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? def : Number(v);
  } catch {
    return def;
  }
}

async function getString(key, def) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v == null ? def : v;
  } catch {
    return def;
  }
}

export const Persistence = {
  async loadAll() {
    const [best, injured, sound, pigeon, map, unlocked] = await Promise.all([
      getNumber(KEYS.best, 0),
      getNumber(KEYS.injured, 0),
      getString(KEYS.sound, '1'),
      getString(KEYS.pigeon, 'classic'),
      getString(KEYS.map, 'day'),
      getString(KEYS.unlocked, ''),
    ]);
    return {
      bestScore: best,
      pigeonsInjured: injured,
      soundEnabled: sound !== '0',
      selectedPigeon: pigeon,
      selectedMap: map,
      unlockedPigeons: unlocked ? unlocked.split(',').filter(Boolean) : [],
    };
  },
  setBest(v) {
    AsyncStorage.setItem(KEYS.best, String(v)).catch(() => {});
  },
  setInjured(v) {
    AsyncStorage.setItem(KEYS.injured, String(v)).catch(() => {});
  },
  setSound(on) {
    AsyncStorage.setItem(KEYS.sound, on ? '1' : '0').catch(() => {});
  },
  setPigeon(id) {
    AsyncStorage.setItem(KEYS.pigeon, id).catch(() => {});
  },
  setMap(id) {
    AsyncStorage.setItem(KEYS.map, id).catch(() => {});
  },
  setUnlocked(list) {
    AsyncStorage.setItem(KEYS.unlocked, list.join(',')).catch(() => {});
  },
};
