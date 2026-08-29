import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  best: 'dp_bestScore',
  bestDist: 'dp_bestDistance',
  injured: 'dp_pigeonsInjured',
  sound: 'dp_soundEnabled',
  pigeon: 'dp_selectedPigeon',
  map: 'dp_selectedMap',
  unlocked: 'dp_unlockedPigeons',
  leet: 'dp_leetUnlock',
  purchased: 'dp_purchasedPigeons',
  bundle: 'dp_bundleOwned',
  easy: 'dp_easyOwned',
  bestDistSilly: 'dp_bestDistanceSilly',
  playerId: 'dp_playerId',
  nickname: 'dp_nickname',
  submittedBest: 'dp_submittedBest',
  submittedBestSilly: 'dp_submittedBestSilly',
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
    const [best, bestDist, bestDistSilly, injured, sound, pigeon, map, unlocked, leet, purchased, bundle, easy] = await Promise.all([
      getNumber(KEYS.best, 0),
      getNumber(KEYS.bestDist, 0),
      getNumber(KEYS.bestDistSilly, 0),
      getNumber(KEYS.injured, 0),
      getString(KEYS.sound, '1'),
      getString(KEYS.pigeon, 'classic'),
      getString(KEYS.map, 'day'),
      getString(KEYS.unlocked, ''),
      getString(KEYS.leet, '0'),
      getString(KEYS.purchased, ''),
      getString(KEYS.bundle, '0'),
      getString(KEYS.easy, '0'),
    ]);
    return {
      bestScore: best,
      bestDistance: bestDist,
      bestDistanceSilly: bestDistSilly,
      pigeonsInjured: injured,
      soundEnabled: sound !== '0',
      selectedPigeon: pigeon,
      selectedMap: map,
      unlockedPigeons: unlocked ? unlocked.split(',').filter(Boolean) : [],
      leetUnlock: leet === '1',
      purchasedPigeons: purchased ? purchased.split(',').filter(Boolean) : [],
      bundleOwned: bundle === '1',
      easyModeOwned: easy === '1',
    };
  },
  setEasyMode(on) {
    AsyncStorage.setItem(KEYS.easy, on ? '1' : '0').catch(() => {});
  },
  setBestDistanceSilly(v) {
    AsyncStorage.setItem(KEYS.bestDistSilly, String(v)).catch(() => {});
  },
  setSubmittedBestSilly(v) {
    AsyncStorage.setItem(KEYS.submittedBestSilly, String(v)).catch(() => {});
  },
  setPurchased(list) {
    AsyncStorage.setItem(KEYS.purchased, list.join(',')).catch(() => {});
  },
  setBundle(on) {
    AsyncStorage.setItem(KEYS.bundle, on ? '1' : '0').catch(() => {});
  },
  setPlayerId(v) {
    AsyncStorage.setItem(KEYS.playerId, v).catch(() => {});
  },
  setNickname(v) {
    AsyncStorage.setItem(KEYS.nickname, v).catch(() => {});
  },
  setSubmittedBest(v) {
    AsyncStorage.setItem(KEYS.submittedBest, String(v)).catch(() => {});
  },
  async loadLeaderboard() {
    const [playerId, nickname, submittedBest, submittedBestSilly] = await Promise.all([
      getString(KEYS.playerId, ''),
      getString(KEYS.nickname, ''),
      getNumber(KEYS.submittedBest, 0),
      getNumber(KEYS.submittedBestSilly, 0),
    ]);
    return { playerId, nickname, submittedBest, submittedBestSilly };
  },
  setLeet(on) {
    AsyncStorage.setItem(KEYS.leet, on ? '1' : '0').catch(() => {});
  },
  setBest(v) {
    AsyncStorage.setItem(KEYS.best, String(v)).catch(() => {});
  },
  setBestDistance(v) {
    AsyncStorage.setItem(KEYS.bestDist, String(v)).catch(() => {});
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
