// Advertising hooks — placeholder module (no live AdMob SDK in this build).
// Entitlement-aware: honours the permanent Remove Ads purchase. Real
// AdMob / rewarded-ad SDK integration will replace these callbacks later,
// but the entitlement gate + interval config below are already correct.
let deathsSinceInterstitial = 0;
let removeAdsOwned = false;
let interstitialDeathInterval = 5; // configurable — every ~5 genuine deaths

export const Ads = {
  // Permanent Remove Ads entitlement. When true, NO automatic interstitial is
  // ever requested/shown. Rewarded revive stays available regardless.
  setRemoveAds(owned) {
    removeAdsOwned = !!owned;
  },
  isRemoveAdsOwned() {
    return removeAdsOwned;
  },
  setInterstitialInterval(n) {
    if (Number.isFinite(n) && n > 0) interstitialDeathInterval = Math.floor(n);
  },

  // Whether automatic interstitials are currently enabled for this player.
  interstitialsEnabled() {
    return !removeAdsOwned;
  },

  // Called after every GENUINE death. Returns whether an automatic interstitial
  // should show at the next natural transition. Always false when Remove Ads is
  // owned (and we don't bother counting/requesting anything for those users).
  registerDeath() {
    if (removeAdsOwned) return false; // Remove Ads — never auto-advertise
    deathsSinceInterstitial += 1;
    if (deathsSinceInterstitial >= interstitialDeathInterval) {
      deathsSinceInterstitial = 0;
      if (typeof console !== 'undefined') {
        console.log('[Ads] (dev) interstitial slot reached — no-op placeholder');
      }
      return true;
    }
    return false;
  },

  // Optional rewarded-ad revive — ALWAYS available, even with Remove Ads, because
  // it's player-initiated and grants a reward. In dev it succeeds immediately.
  // Later: replace body with rewarded-ad load + verified onReward callback.
  showRewardedRevive(onReward) {
    if (typeof console !== 'undefined') {
      console.log('[Ads] (dev) rewarded revive — granting immediately');
    }
    onReward();
  },
};
