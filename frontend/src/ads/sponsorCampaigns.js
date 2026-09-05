import AsyncStorage from '@react-native-async-storage/async-storage';
import { logBillboardRotation, logStorageFlush } from '../diagnostics';
import { CONFIG } from '../config';

// Official INTIES logo asset — bundled locally so it's part of the same asset preload
// pass as every other billboard asset (never fetched over the network at runtime, so it
// can never appear late/blank or cause a stutter). Rendered exactly as supplied: never
// redrawn, recoloured, cropped or stretched (always resizeMode="contain" in the renderer).
import IntiesLogo from '../../assets/ads/inties-logo.png';

// Sponsor-campaign model. ONLY internally-approved records listed here are ever shown.
// There are no public uploads, no automatic approval, no in-app checkout, and no remote
// or executable content — every advert is bundled, static and rendered as procedural art
// (no external image loading, no HTML/script ads). All advertiser names below are ORIGINAL
// FICTIONAL placeholders and must never be replaced with a real brand for demo content.
export const SPONSOR_CAMPAIGNS = [
  {
    id: 'demo-breadcrumb-2026',
    advertiser: 'Breadcrumb Building Society',
    artwork: 'approved:breadcrumb', // internally-approved bundled artwork reference
    start: '2026-01-01',
    end: '2026-12-31',
    enabled: true,
    exclusive: false, // non-exclusive booking: shares its map's slots with the house/INTIES pool
    maps: ['day', 'dusk', 'easy'],
    weight: 2,
    headline: 'BREADCRUMB\nBUILDING SOCIETY',
    subline: 'Save your crumbs for a rainy day',
    bg: '#207a5e',
    fg: '#ffffff',
    accent: '#ffd23f',
  },
  {
    id: 'demo-pigeonpost-2026',
    advertiser: 'Pigeon Post Express',
    artwork: 'approved:pigeonpost',
    start: '2026-01-01',
    end: '2026-12-31',
    enabled: true,
    exclusive: false,
    maps: ['day', 'night'],
    weight: 1,
    headline: 'PIGEON POST\nEXPRESS',
    subline: 'First-class flapping, guaranteed',
    bg: '#2f4f8f',
    fg: '#ffffff',
    accent: '#ff9f1c',
  },
];

// Original DRUNK PIGEONS house adverts — the fallback whenever no approved campaign is
// active, the device is offline, artwork cannot load, campaign data is invalid/expired, or
// the player owns Remove Ads. No real brands anywhere.
export const HOUSE_ADS = [
  { id: 'house-flap', headline: 'FLAP\nRESPONSIBLY', subline: "don't drink and dive", bg: '#3a2f6e', fg: '#ffffff', accent: '#3ef2c0' },
  { id: 'house-chips', headline: 'CHIPS: A\nCOMPLETE BREAKFAST', subline: 'lunch and dinner too', bg: '#8a4b1f', fg: '#ffe9a8', accent: '#ffd23f' },
  { id: 'house-pigeoned', headline: 'ABSOLUTELY\nPIGEONED', subline: 'the only way to fly', bg: '#7a1f4a', fg: '#ffffff', accent: '#ff5fa2' },
  { id: 'house-yourad', headline: 'YOUR AD\nCOULD BE HERE', subline: 'advertise in DRUNK PIGEONS', bg: '#1f5a7a', fg: '#ffffff', accent: '#3ef2c0' },
];

// INTIES house-brand rotation — Drunk Pigeons' own cross-promotion, layered into the
// SAME "house ad" fallback slot pool used above (never a paid/booked campaign, and never
// shown while a real paid sponsor campaign is active for that map — paid campaigns are
// resolved earlier in pickBillboardAd() and always take priority). Every rotation knob
// lives in this one place, not scattered through the rendering component.
export const INTIES_ROTATION = {
  enabled: true,
  // Chance to show INTIES once a slot is off cooldown (see minGapHouseAds below). With a
  // hard 4-ad cooldown, a per-slot roll of 0.6 works out to an ACTUAL long-run appearance
  // rate of ~17-18% of eligible house-ad slots (simulated over 40k slots) — inside the
  // requested 15-20% band. Tune this single number to retarget the whole rotation.
  targetRate: 0.6,
  minGapHouseAds: 4,     // at least this many non-INTIES house ads before another INTIES ad
};

export const INTIES_CREATIVES = [
  // Creative 1 — the official logo lockup already contains the "INTIES" wordmark and
  // "A safer way to meet." tagline, so no extra headline text is layered over it.
  { id: 'inties-1', headline: null, subline: null, url: 'INTIESLTD.COM', logo: IntiesLogo },
  { id: 'inties-2', headline: 'GET PIGEONED.', subline: "DON'T WING YOUR SAFETY.", url: 'INTIESLTD.COM', logo: IntiesLogo },
  { id: 'inties-3', headline: 'THE PIGEON MAKES\nBAD DECISIONS.', subline: "YOU DON'T HAVE TO.", url: 'INTIESLTD.COM', logo: IntiesLogo },
];

// Sequential rotation memory (session-scoped, reset each time a billboard mounts — see
// resetIntiesRotation()). This is passive scenery rotation, not gameplay state, so it is
// intentionally NOT part of run validation, scoring or any persisted player data.
let _houseSlotsSinceInties = INTIES_ROTATION.minGapHouseAds;
let _lastDecidedSeed = null;

export function resetIntiesRotation() {
  _houseSlotsSinceInties = INTIES_ROTATION.minGapHouseAds;
  _lastDecidedSeed = null;
}

// hash()/HOUSE_ADS are defined below; this stays a thin decision step called from inside
// pickBillboardAd() only once we've already established this slot has no active paid
// campaign (or the player owns Remove Ads) — i.e. it's a genuine "house ad" slot.
function pickIntiesOrHouseAd(seed) {
  if (INTIES_ROTATION.enabled && seed !== _lastDecidedSeed) {
    _lastDecidedSeed = seed;
    _houseSlotsSinceInties += 1;
    if (_houseSlotsSinceInties > INTIES_ROTATION.minGapHouseAds) {
      const roll = (hash(seed * 97 + 1013) % 1000) / 1000;
      if (roll < INTIES_ROTATION.targetRate) {
        _houseSlotsSinceInties = 0;
        const c = INTIES_CREATIVES[hash(seed + 555) % INTIES_CREATIVES.length];
        return { ...c, kind: 'inties', label: 'ADVERTISEMENT' };
      }
    }
  }
  const h = HOUSE_ADS[hash(seed * 2654435761 + 7) % HOUSE_ADS.length];
  return { ...h, kind: 'house', label: 'DRUNK PIGEONS' };
}

function hash(n) {
  let a = (n | 0) >>> 0;
  a = (a ^ 61) ^ (a >>> 16);
  a = (a + (a << 3)) >>> 0;
  a = a ^ (a >>> 4);
  a = (a * 0x27d4eb2d) >>> 0;
  a = a ^ (a >>> 15);
  return a >>> 0;
}

function isValidCampaign(c, nowMs) {
  if (!c || !c.enabled) return false;
  const s = Date.parse(c.start);
  const e = Date.parse(c.end);
  if (Number.isNaN(s) || Number.isNaN(e) || s > e) return false;
  return nowMs >= s && nowMs <= e;
}

function pickWeighted(camps, seed) {
  const total = camps.reduce((sum, c) => sum + (c.weight || 1), 0);
  let r = ((hash(seed) % 1000) / 1000) * total;
  for (const c of camps) {
    r -= c.weight || 1;
    if (r <= 0) return { ...c, kind: 'campaign', label: 'ADVERTISEMENT' };
  }
  return { ...camps[0], kind: 'campaign', label: 'ADVERTISEMENT' };
}

// A booked "Exclusive Pigeon" campaign reserves 100% of its map's slots (real advertisers
// pay for that guarantee — INTIES must never appear in a reserved placement). Every other
// (non-exclusive) paid campaign shares its map's slots with the house/INTIES pool instead
// of monopolising every single billboard — this single number is the one central knob for
// that split.
export const AD_MIX = {
  nonExclusivePaidShare: 0.5, // fraction of slots a live non-exclusive campaign still wins; the rest fall through to the house/INTIES pool
};

function activeCampaigns(mapId, nowMs) {
  return SPONSOR_CAMPAIGNS.filter(
    (c) => isValidCampaign(c, nowMs) && Array.isArray(c.maps) && c.maps.includes(mapId)
  );
}

// Deterministic advert for a billboard slot. Remove Ads owners always fall straight
// through to the house-ad pool (which now occasionally includes an INTIES creative, see
// pickIntiesOrHouseAd()) — paid 3rd-party artwork is never shown to them. Selection uses
// only the slot seed + map + date: never player behaviour or personal data. An active
// EXCLUSIVE campaign always wins every slot on its booked map(s). A non-exclusive campaign
// wins AD_MIX.nonExclusivePaidShare of slots; the remainder fall through to the house/INTIES
// pool exactly like a map with no active campaign at all.
export function pickBillboardAd({ mapId, nowMs, removeAds, seed }) {
  if (!removeAds) {
    const camps = activeCampaigns(mapId, nowMs);
    const exclusive = camps.filter((c) => c.exclusive);
    if (exclusive.length) return pickWeighted(exclusive, seed);
    const shared = camps.filter((c) => !c.exclusive);
    if (shared.length) {
      const roll = (hash(seed * 13 + 31) % 1000) / 1000;
      if (roll < AD_MIX.nonExclusivePaidShare) return pickWeighted(shared, seed);
    }
  }
  return pickIntiesOrHouseAd(seed);
}

// Anonymous, aggregate-only display counter — no player identity, no cross-campaign
// tracking, no advertising identifiers. Best-effort local persistence.
const IMPR_KEY = 'dp.ad.impressions.v1';
let _impr = null; // last-loaded on-disk snapshot (lazily fetched, cached after)
async function loadImpr() {
  if (_impr) return _impr;
  try {
    _impr = JSON.parse((await AsyncStorage.getItem(IMPR_KEY)) || '{}') || {};
  } catch (e) {
    _impr = {};
  }
  return _impr;
}
// DEV-only, bounded (small integers) counters so a profile build can correlate a
// reported frame stall against an actual billboard rotation/storage write.
export const DEV_AD_STATS = { rotations: 0, flushAttempts: 0, storageWrites: 0, flushFailures: 0 };

// Bounded in-memory delta queue (at most one counter per distinct ad id — a
// handful of entries for the lifetime of the app). recordImpression() ONLY
// ever touches this object; it never calls AsyncStorage itself, so a billboard
// rotation mid-gameplay can never trigger a native bridge write, no matter how
// often it fires.
let _pending = {};
let _dirty = false;
let _flushing = null; // in-flight flush promise — guards against duplicate concurrent flushes

// Called from the billboard-rotation callback ONLY. Fully synchronous JS —
// increments an in-memory counter and returns. No promise, no bridge call.
export function recordImpression(adId, distPx) {
  if (!adId) return;
  if (typeof __DEV__ !== 'undefined' && __DEV__) DEV_AD_STATS.rotations += 1;
  logBillboardRotation(typeof distPx === 'number' ? Math.floor(distPx / CONFIG.PIXELS_PER_METRE) : null, Date.now());
  _pending[adId] = (_pending[adId] || 0) + 1;
  _dirty = true;
}

// Persists any queued impressions. Intended to be called ONLY from natural
// pause points: game paused (restart-confirm), game over, leaving GameScreen,
// AppState backgrounding/inactivating, or on unmount — see GameScreen.js.
// Never called on a timer and never called from the rotation callback itself.
//
// On "synchronous" vs "asynchronous": everything up to and including the
// `AsyncStorage.setItem(...)` CALL below runs synchronously on the JS thread
// (merging the queued delta into the loaded snapshot, JSON.stringify). That
// call itself returns a Promise immediately — it does not block the JS
// thread waiting for the result. What happens after that point (the bridge
// message dispatch to native, and the native-side disk write) is genuinely
// asynchronous and completes later, off of whichever frame called this
// function. This file has NOT measured that native-side duration on a
// physical device, so no claim is made about its real wall-clock cost —
// only that it can no longer be triggered by, or block, a live gameplay frame,
// since it is now solely caller-triggered from the pause points above.
export async function flushImpressions() {
  if (_flushing) return _flushing; // already flushing — don't start a duplicate write
  if (!_dirty) return;
  const delta = _pending;
  _pending = {};
  _dirty = false;
  if (typeof __DEV__ !== 'undefined' && __DEV__) DEV_AD_STATS.flushAttempts += 1;
  _flushing = (async () => {
    try {
      const m = await loadImpr();
      for (const id of Object.keys(delta)) m[id] = (m[id] || 0) + delta[id];
      await AsyncStorage.setItem(IMPR_KEY, JSON.stringify(m));
      if (typeof __DEV__ !== 'undefined' && __DEV__) DEV_AD_STATS.storageWrites += 1;
      logStorageFlush(true, Date.now());
    } catch (e) {
      // Requeue the delta so impression totals are never lost — the next
      // pause-point trigger will retry this exact flush.
      for (const id of Object.keys(delta)) _pending[id] = (_pending[id] || 0) + delta[id];
      _dirty = true;
      if (typeof __DEV__ !== 'undefined' && __DEV__) DEV_AD_STATS.flushFailures += 1;
      logStorageFlush(false, Date.now());
    } finally {
      _flushing = null;
    }
  })();
  return _flushing;
}

export async function getImpressionCounts() {
  const m = await loadImpr();
  const merged = { ...m };
  for (const id of Object.keys(_pending)) merged[id] = (merged[id] || 0) + _pending[id];
  return merged;
}
