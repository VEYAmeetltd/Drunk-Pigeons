import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// DRUNK PIGEONS — centralised AdMob configuration.
// Identifiers with "~" are ADMOB APP IDs (go in app config / SDK app id).
// Identifiers with "/" are individual AD UNIT IDs (rewarded / interstitial).
// Only two ad formats exist: optional Rewarded Revive + occasional Game Over
// Interstitial. No banners, no app-open, no other formats.
// ---------------------------------------------------------------------------

// Production AdMob App IDs (used by the native SDK / app.json config plugin).
export const ADMOB_APP_ID = {
  android: 'ca-app-pub-1908215441963534~6037769588',
  ios: 'ca-app-pub-1908215441963534~2962732884',
};

// Production ad-unit IDs (live DRUNK PIGEONS units).
const PROD_UNITS = {
  android: {
    interstitial: 'ca-app-pub-1908215441963534/9785442908',
    rewarded: 'ca-app-pub-1908215441963534/7183330294',
  },
  ios: {
    interstitial: 'ca-app-pub-1908215441963534/1594188197',
    rewarded: 'ca-app-pub-1908215441963534/8023487878',
  },
};

// Google's OFFICIAL TEST ad-unit IDs — used for all development/testing so we
// never hammer the live units. (Same test IDs across platforms per Google docs.)
const TEST_UNITS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};

// Development builds use Google TEST ads; production/release builds use the real
// DRUNK PIGEONS units. __DEV__ is true in dev client / Metro, false in release.
export const USE_TEST_ADS =
  typeof __DEV__ !== 'undefined' ? __DEV__ : true;

function platformKey() {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export function interstitialUnitId() {
  if (USE_TEST_ADS) return TEST_UNITS.interstitial;
  return PROD_UNITS[platformKey()].interstitial;
}

export function rewardedUnitId() {
  if (USE_TEST_ADS) return TEST_UNITS.rewarded;
  return PROD_UNITS[platformKey()].rewarded;
}

export function appId() {
  return ADMOB_APP_ID[platformKey()];
}

// Interstitial cadence — approximately every N genuine deaths.
export const INTERSTITIAL_DEATH_INTERVAL = 5;

export const AdMobConfig = {
  ADMOB_APP_ID,
  PROD_UNITS,
  TEST_UNITS,
  USE_TEST_ADS,
  interstitialUnitId,
  rewardedUnitId,
  appId,
  INTERSTITIAL_DEATH_INTERVAL,
};
