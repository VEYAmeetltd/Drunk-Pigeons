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

let interstitial = null;
let interstitialLoaded = false;
let rewarded = null;
let rewardedLoaded = false;
let initialized = false;

function buildInterstitial() {
  if (!SDK) return;
  try {
    interstitial = InterstitialAd.createForAdRequest(interstitialUnitId(), REQ);
    interstitialLoaded = false;
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      interstitialLoaded = false;
    });
    interstitial.load();
  } catch (e) {
    interstitial = null;
  }
}

function buildRewarded() {
  if (!SDK) return;
  try {
    rewarded = RewardedAd.createForAdRequest(rewardedUnitId(), REQ);
    rewardedLoaded = false;
    rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      rewardedLoaded = true;
    });
    rewarded.addAdEventListener(AdEventType.ERROR, () => {
      rewardedLoaded = false;
    });
    rewarded.load();
  } catch (e) {
    rewarded = null;
  }
}

export const AdProvider = {
  supported: !!SDK,

  init() {
    if (!SDK || initialized) return;
    initialized = true;
    try {
      mobileAds()
        .initialize()
        .then(() => {
          buildInterstitial();
          buildRewarded();
        });
    } catch (e) {
      // SDK present but init failed — stay in safe fallback state
    }
  },

  preloadInterstitial() {
    if (!SDK) return;
    if (!interstitial || !interstitialLoaded) buildInterstitial();
  },

  preloadRewarded() {
    if (!SDK) return;
    if (!rewarded || !rewardedLoaded) buildRewarded();
  },

  isRewardedReady() {
    return !!(SDK && rewarded && rewardedLoaded);
  },

  // Show interstitial at a natural transition. Never blocks the game — resolves
  // immediately if nothing is loaded. Preloads the next one after close.
  showInterstitial() {
    return new Promise((resolve) => {
      if (!SDK || !interstitial || !interstitialLoaded) {
        buildInterstitial();
        resolve(false);
        return;
      }
      let done = false;
      const finish = (shown) => {
        if (done) return;
        done = true;
        buildInterstitial(); // preload next
        resolve(shown);
      };
      try {
        const unsubClose = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
          if (unsubClose) unsubClose();
          finish(true);
        });
        const unsubErr = interstitial.addAdEventListener(AdEventType.ERROR, () => {
          if (unsubErr) unsubErr();
          finish(false);
        });
        interstitial.show();
      } catch (e) {
        finish(false);
      }
    });
  },

  // Rewarded revive — grants ONLY on the verified EARNED_REWARD callback.
  // Prevents double-reward; preloads the next ad after close.
  showRewarded(onReward, onUnavailable) {
    if (!SDK || !rewarded || !rewardedLoaded) {
      buildRewarded();
      if (onUnavailable) onUnavailable();
      return;
    }
    let earned = false;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      buildRewarded(); // preload next
      if (earned) onReward();
      else if (onUnavailable) onUnavailable();
    };
    try {
      const unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
        if (unsubEarned) unsubEarned();
      });
      const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        if (unsubClosed) unsubClosed();
        settle();
      });
      const unsubErr = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        if (unsubErr) unsubErr();
        settle();
      });
      rewarded.show();
    } catch (e) {
      settle();
    }
  },
};

export default AdProvider;
