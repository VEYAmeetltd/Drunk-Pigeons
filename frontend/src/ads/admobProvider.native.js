// NATIVE (Android/iOS) AdMob provider — real Google Mobile Ads SDK integration.
// Metro selects this file for native builds; the web preview uses
// admobProvider.web.js instead, so the SDK is never bundled for web.
//
// Two formats only: optional Rewarded Revive + occasional Game Over Interstitial.
// The revive is granted ONLY on the verified EARNED_REWARD callback.
import { rewardedUnitId, interstitialUnitId } from './admobConfig';

// Guarded require so a missing SDK (e.g. Expo Go without the native module)
// degrades safely instead of crashing the game.
let SDK = null;
try {
  SDK = require('react-native-google-mobile-ads');
} catch (e) {
  SDK = null;
}

const mobileAds = SDK && SDK.default;
const InterstitialAd = SDK && SDK.InterstitialAd;
const RewardedAd = SDK && SDK.RewardedAd;
const AdEventType = SDK && SDK.AdEventType;
const RewardedAdEventType = SDK && SDK.RewardedAdEventType;

const REQ = { requestNonPersonalizedAdsOnly: true };

// An ad that is loading is already owned by its slot. Never create another
// native instance just because the first one has not emitted LOADED yet.
const interstitial = { ad: null, phase: 'idle', unsubscribe: [] };
const rewarded = { ad: null, phase: 'idle', unsubscribe: [] };
let initialization = null;

function initialize() {
  if (!SDK) return Promise.resolve(false);
  if (!initialization) {
    initialization = Promise.resolve()
      .then(() => mobileAds().initialize())
      .then(() => true)
      .catch(() => {
        initialization = null; // a later explicit preload can retry
        return false;
      });
  }
  return initialization;
}

function release(slot) {
  const listeners = slot.unsubscribe;
  slot.unsubscribe = [];
  slot.ad = null;
  slot.phase = 'idle';
  listeners.forEach((unsubscribe) => unsubscribe());
}

function preload(slot) {
  if (!SDK || slot.phase !== 'idle') return;
  slot.phase = 'loading'; // reserve BEFORE awaiting SDK initialization
  initialize().then((ok) => {
    if (!ok) {
      release(slot);
      return;
    }
    try {
      const isRewarded = slot === rewarded;
      const ad = isRewarded
        ? RewardedAd.createForAdRequest(rewardedUnitId(), REQ)
        : InterstitialAd.createForAdRequest(interstitialUnitId(), REQ);
      slot.ad = ad;
      slot.unsubscribe.push(ad.addAdEventListener(
        isRewarded ? RewardedAdEventType.LOADED : AdEventType.LOADED,
        () => {
          if (slot.ad === ad && slot.phase === 'loading') slot.phase = 'ready';
        },
      ));
      slot.unsubscribe.push(ad.addAdEventListener(AdEventType.ERROR, () => {
        // show() owns errors while showing. Events from a discarded instance
        // must never change the ready state of its replacement.
        if (slot.ad === ad && slot.phase !== 'showing') release(slot);
      }));
      ad.load();
    } catch (e) {
      release(slot);
    }
  });
}

function show(slot, done) {
  if (!SDK || slot.phase !== 'ready') {
    preload(slot); // deduplicated if an earlier request is still loading
    done(false);
    return;
  }
  const ad = slot.ad;
  const isRewarded = slot === rewarded;
  slot.phase = 'showing';
  let earned = false;
  let settled = false;
  const finish = (closed) => {
    if (settled) return;
    settled = true;
    release(slot); // removes ALL load/show listeners, including the unused ones
    // Closing a rewarded ad resumes flight. Leave this slot idle; the next
    // menu/game-over preload owns replenishment, outside that resumed run.
    done(isRewarded ? earned : closed);
  };
  try {
    if (isRewarded) {
      slot.unsubscribe.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        if (!settled) earned = true;
      }));
    }
    slot.unsubscribe.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish(true)));
    slot.unsubscribe.push(ad.addAdEventListener(AdEventType.ERROR, () => finish(false)));
    // The SDK can reject its Promise as well as throw synchronously.
    Promise.resolve(ad.show()).catch(() => finish(false));
  } catch (e) {
    finish(false);
  }
}

export const AdProvider = {
  supported: !!SDK,

  // Initialization is shared by all callers. Only preload() creates ads, so
  // Ads.init() cannot create two more WebViews when this Promise resolves.
  init: initialize,

  preloadInterstitial() { preload(interstitial); },
  preloadRewarded() { preload(rewarded); },

  isRewardedReady() {
    return !!(SDK && rewarded.phase === 'ready');
  },

  showInterstitial() {
    return new Promise((resolve) => show(interstitial, resolve));
  },

  showRewarded(onReward, onUnavailable) {
    show(rewarded, (earned) => {
      if (earned) onReward();
      else if (onUnavailable) onUnavailable();
    });
  },
  // Google UMP privacy-options form. Uses the SDK's AdsConsent when present and the
  // form is available; otherwise resolves gracefully so callers never crash.
  async showPrivacyOptions() {
    try {
      const AdsConsent = SDK && SDK.AdsConsent;
      if (!AdsConsent || !AdsConsent.showPrivacyOptionsForm) return { ok: false, reason: 'unavailable' };
      await AdsConsent.showPrivacyOptionsForm();
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'error' };
    }
  },
  // True only when Google UMP reports the privacy-options entry point is REQUIRED.
  async getPrivacyOptionsRequired() {
    try {
      const AdsConsent = SDK && SDK.AdsConsent;
      if (!AdsConsent) return false;
      let info = null;
      if (AdsConsent.getConsentInfo) info = await AdsConsent.getConsentInfo();
      else if (AdsConsent.requestInfoUpdate) info = await AdsConsent.requestInfoUpdate();
      const status = info && info.privacyOptionsRequirementStatus;
      const REQUIRED = (AdsConsent.PrivacyOptionsRequirementStatus
        && AdsConsent.PrivacyOptionsRequirementStatus.REQUIRED) || 'REQUIRED';
      return status === REQUIRED;
    } catch (e) {
      return false;
    }
  },
};

export default AdProvider;
