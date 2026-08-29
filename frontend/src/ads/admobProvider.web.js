// WEB / dev-preview AdMob provider — safe fallback. The native Google Mobile Ads
// SDK cannot run in the browser preview, so we never import it here (Metro picks
// this file for web). Rewarded revive resolves as a successful reward so the flow
// stays testable in preview; the interstitial is a no-op. The REAL SDK
// implementation lives in admobProvider.native.js for Android/iOS builds.
export const AdProvider = {
  supported: false,
  init() {},
  preloadInterstitial() {},
  preloadRewarded() {},
  isRewardedReady() {
    return true; // dev: allow the revive flow to be exercised in preview
  },
  // Resolve immediately with a "reward" in dev preview.
  showInterstitial() {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[Ads:web] interstitial (dev no-op)');
    return Promise.resolve(false);
  },
  showRewarded(onReward, onUnavailable) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[Ads:web] rewarded revive (dev grant)');
    onReward();
  },
};

export default AdProvider;
