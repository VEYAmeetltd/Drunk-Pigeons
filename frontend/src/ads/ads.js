// Advertising controller — platform-agnostic. Delegates to the AdMob provider
// (real Google Mobile Ads SDK on native via admobProvider.native.js; safe dev
// fallback on web via admobProvider.web.js). Enforces the DRUNK PIGEONS rules:
//   • Optional Rewarded Revive — always available (player-initiated).
//   • Occasional Game Over Interstitial — ~every N genuine deaths, shown only at
//     the Game Over → next-run transition, and NEVER when Remove Ads is owned.
import AdProvider from './admobProvider';
import { INTERSTITIAL_DEATH_INTERVAL } from './admobConfig';

let removeAdsOwned = false;
let interstitialDeathInterval = INTERSTITIAL_DEATH_INTERVAL; // ~5
let deathsSinceInterstitial = 0;
let interstitialPending = false;

export const Ads = {
  // Initialise the SDK + preload the first ads (no-op on web).
  init() {
    AdProvider.init();
    AdProvider.preloadInterstitial();
    AdProvider.preloadRewarded();
  },

  // Permanent Remove Ads entitlement — suppresses ALL automatic interstitials.
  setRemoveAds(owned) {
    removeAdsOwned = !!owned;
    if (removeAdsOwned) interstitialPending = false;
  },
  isRemoveAdsOwned() {
    return removeAdsOwned;
  },
  setInterstitialInterval(n) {
    if (Number.isFinite(n) && n > 0) interstitialDeathInterval = Math.floor(n);
  },
  interstitialsEnabled() {
    return !removeAdsOwned;
  },

  // Called after every GENUINE death (not manual restart). Counts toward the
  // interstitial cadence and marks one pending — but NEVER during gameplay and
  // NEVER for Remove Ads owners. The ad is actually shown at the transition via
  // showInterstitialIfDue().
  registerDeath() {
    if (removeAdsOwned) return false;
    deathsSinceInterstitial += 1;
    if (deathsSinceInterstitial >= interstitialDeathInterval) {
      deathsSinceInterstitial = 0;
      interstitialPending = true;
      return true;
    }
    return false;
  },

  // Called at the natural Game Over → next-run transition (e.g. PLAY AGAIN).
  // Shows a pending interstitial if due; always resolves so the next run is
  // never blocked, even on ad failure/no network.
  async showInterstitialIfDue() {
    if (removeAdsOwned || !interstitialPending) return false;
    interstitialPending = false;
    try {
      await AdProvider.showInterstitial();
    } catch (e) {
      // never block the next run
    }
    return true;
  },

  // Optional Rewarded Revive — available to everyone (incl. Remove Ads owners).
  // onReward fires ONLY on the verified reward callback; onUnavailable fires when
  // no ad is ready / it fails / the reward wasn't earned.
  showRewardedRevive(onReward, onUnavailable) {
    AdProvider.showRewarded(onReward, onUnavailable);
  },
  isRewardedReady() {
    return AdProvider.isRewardedReady ? AdProvider.isRewardedReady() : true;
  },
};
