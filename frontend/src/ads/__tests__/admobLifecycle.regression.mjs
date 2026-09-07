import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Execute the production provider against a controllable native SDK. Only its
// import/export boundary is replaced; preload/show/callback logic is unmodified.
const source = readFileSync(process.argv[2] || new URL('../admobProvider.native.js', import.meta.url), 'utf8');
const execute = new Function('require', 'rewardedUnitId', 'interstitialUnitId', source
  .replace(/^import .* from '\.\/admobConfig';\r?\n/m, '')
  .replace('export const AdProvider', 'const AdProvider')
  .replace('export default AdProvider;', 'return AdProvider;'));
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture({ missing = false } = {}) {
  const ads = [];
  const inits = [];
  const sdk = {
    default: () => ({ initialize: () => new Promise((resolve, reject) => inits.push({ resolve, reject })) }),
    AdEventType: { LOADED: 'loaded', ERROR: 'error', CLOSED: 'closed' },
    RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
  };
  for (const kind of ['InterstitialAd', 'RewardedAd']) {
    sdk[kind] = { createForAdRequest: (id, options) => {
      assert.equal(options.requestNonPersonalizedAdsOnly, true);
      const listeners = new Map();
      const ad = {
        kind, id, loads: 0, shows: 0,
        addAdEventListener(event, fn) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(fn);
          return () => listeners.get(event).delete(fn);
        },
        listeners(event) { return [...(listeners.get(event) || [])]; },
        listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
        emit(event) { ad.listeners(event).forEach((fn) => fn()); },
        load() { ad.loads++; },
        show() { ad.shows++; return ad.rejectShow ? Promise.reject(Error('show rejected')) : Promise.resolve(); },
      };
      ads.push(ad);
      return ad;
    } };
  }
  const provider = execute(() => { if (missing) throw Error('native SDK unavailable'); return sdk; }, () => 'rewarded-unit', () => 'interstitial-unit');
  return { provider, ads, inits };
}

const f = fixture();
// The exact call ordering of Ads.init(), repeated across a rapid screen remount.
for (let i = 0; i < 20; i++) {
  f.provider.init();
  f.provider.preloadInterstitial();
  f.provider.preloadRewarded();
}
await tick();
assert.equal(f.inits.length, 1, 'All callers share one SDK initialization');
assert.equal(f.ads.length, 0, 'No ad is constructed before initialization completes');
f.inits[0].resolve([]);
await tick();
assert.equal(f.ads.length, 2, 'Exactly one ad per format, including after init resolves');
for (let i = 0; i < 20; i++) {
  f.provider.preloadInterstitial();
  f.provider.preloadRewarded();
}
await tick();
assert.equal(f.ads.length, 2, 'A loading ad is retained, not replaced');
assert.ok(f.ads.every((ad) => ad.loads === 1));

const oldReward = f.ads.find((ad) => ad.kind === 'RewardedAd');
const staleLoaded = oldReward.listeners('loaded')[0];
oldReward.emit('error');
assert.equal(oldReward.listenerCount(), 0, 'Failed requests release their listeners');
f.provider.preloadRewarded();
await tick();
const reward = f.ads.at(-1);
staleLoaded();
assert.equal(f.provider.isRewardedReady(), false, 'Orphan events cannot mark a replacement ready');
reward.emit('loaded');
assert.equal(f.provider.isRewardedReady(), true);
f.provider.preloadRewarded();
await tick();
assert.equal(f.ads.length, 3, 'Ready ads are also retained');

let earned = 0, unavailable = 0;
f.provider.showRewarded(() => earned++, () => unavailable++);
assert.equal(f.provider.isRewardedReady(), false, 'A showing ad cannot be shown twice');
reward.emit('earned');
reward.emit('earned');
assert.equal(earned, 0, 'Revive waits for the ad to close');
reward.emit('closed');
reward.emit('error');
assert.equal(earned, 1, 'An earned revive is granted exactly once');
assert.equal(unavailable, 0);
assert.equal(reward.listenerCount(), 0);
await tick();
assert.equal(f.ads.length, 3, 'Closing a rewarded ad must not start native loading as flight resumes');
f.provider.preloadRewarded(); // next real menu/game-over pause
await tick();
const unearnedAd = f.ads.at(-1);
unearnedAd.emit('loaded');
f.provider.showRewarded(() => earned++, () => unavailable++);
unearnedAd.emit('closed');
assert.equal(earned, 1, 'Closing without EARNED_REWARD never grants revive');
assert.equal(unavailable, 1);
f.provider.preloadRewarded();
await tick();

const rejectedAd = f.ads.at(-1);
rejectedAd.emit('loaded');
rejectedAd.rejectShow = true;
f.provider.showRewarded(() => earned++, () => unavailable++);
await tick();
assert.equal(earned, 1);
assert.equal(unavailable, 2, 'Rejected show Promises settle the UI callback');
assert.equal(rejectedAd.listenerCount(), 0);

const interstitialAd = f.ads.find((ad) => ad.kind === 'InterstitialAd');
interstitialAd.emit('loaded');
const shown = f.provider.showInterstitial();
interstitialAd.emit('closed');
assert.equal(await shown, true);
assert.equal(interstitialAd.listenerCount(), 0);
await tick();
assert.equal(f.ads.filter(ad => ad.kind === 'InterstitialAd').length, 1, 'Closing an interstitial does not start loading during the next run');

const retry = fixture();
retry.provider.preloadRewarded();
await tick();
retry.inits[0].reject(Error('init failed'));
await tick();
assert.equal(retry.ads.length, 0);
retry.provider.preloadRewarded();
await tick();
assert.equal(retry.inits.length, 2, 'Initialization failure allows a later explicit retry');
retry.inits[1].resolve([]);
await tick();
assert.equal(retry.ads.length, 1);

const absent = fixture({ missing: true }).provider;
assert.equal(absent.supported, false);
await absent.init();
absent.preloadInterstitial();
absent.preloadRewarded();
assert.equal(await absent.showInterstitial(), false);
absent.showRewarded(() => assert.fail('Unavailable SDK cannot grant a reward'), () => unavailable++);
assert.equal(unavailable, 3);
const controllerSource = readFileSync(new URL('../ads.js', import.meta.url), 'utf8');
const calls = [];
const controller = new Function('AdProvider', 'INTERSTITIAL_DEATH_INTERVAL', controllerSource
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export const Ads', 'const Ads') + '\nreturn Ads;')({
    init() { calls.push('init'); },
    preloadRewarded() { calls.push('rewarded'); },
    preloadInterstitial() { calls.push('interstitial'); },
    showInterstitial() { calls.push('show'); return Promise.resolve(true); },
  }, 5);
controller.init();
assert.deepEqual(calls, ['init', 'interstitial', 'rewarded']);
calls.length = 0;
for (let i = 1; i <= 5; i++) assert.equal(controller.registerDeath(), i === 5);
assert.equal(calls.filter(x => x === 'rewarded').length, 5, 'Game-over pauses replenish reward slots');
assert.equal(calls.filter(x => x === 'show').length, 0, 'Preloading never displays an ad');
await controller.showInterstitialIfDue();
assert.equal(calls.filter(x => x === 'show').length, 1, 'Existing death cadence is preserved');
controller.setRemoveAds(true);
calls.length = 0;
controller.registerDeath();
assert.deepEqual(calls, ['rewarded'], 'Remove Ads still suppresses automatic interstitials');
assert.equal(await controller.showInterstitialIfDue(), false);
console.log('PASS: native ad initialization/load deduplication, retry, stale-event isolation, listener cleanup and earned-only revive');
