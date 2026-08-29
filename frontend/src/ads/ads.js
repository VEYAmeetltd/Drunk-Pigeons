// Advertising hooks — placeholders only. NEVER blocks gameplay or testing.
// Real AdMob / rewarded-ad SDK integration will replace these callbacks later.
let deathsSinceInterstitial = 0;

export const Ads = {
  // Called after every crash. Returns whether an interstitial *would* show
  // (every 4-6 deaths). In dev it only logs — no real ad, no blocking.
  registerDeath() {
    deathsSinceInterstitial += 1;
    const threshold = 4 + Math.floor(Math.random() * 3); // 4-6
    if (deathsSinceInterstitial >= threshold) {
      deathsSinceInterstitial = 0;
      if (typeof console !== 'undefined') {
        console.log('[Ads] (dev) interstitial slot reached — no-op placeholder');
      }
      return true;
    }
    return false;
  },

  // Rewarded-ad revive hook. In dev, immediately succeeds (no real ad).
  // Later: replace body with rewarded-ad load + onReward callback.
  showRewardedRevive(onReward) {
    if (typeof console !== 'undefined') {
      console.log('[Ads] (dev) rewarded revive — granting immediately');
    }
    onReward();
  },
};
