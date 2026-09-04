import AsyncStorage from '@react-native-async-storage/async-storage';

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

function activeCampaigns(mapId, nowMs) {
  return SPONSOR_CAMPAIGNS.filter(
    (c) => isValidCampaign(c, nowMs) && Array.isArray(c.maps) && c.maps.includes(mapId)
  );
}

// Deterministic advert for a billboard slot. Remove Ads owners — and any state without a
// valid approved campaign for this map — always receive a DRUNK PIGEONS house advert so
// the billboard structure remains part of the scenery. Selection uses only the slot seed +
// map + date: never player behaviour or personal data.
export function pickBillboardAd({ mapId, nowMs, removeAds, seed }) {
  if (!removeAds) {
    const camps = activeCampaigns(mapId, nowMs);
    if (camps.length) {
      const total = camps.reduce((sum, c) => sum + (c.weight || 1), 0);
      let r = ((hash(seed) % 1000) / 1000) * total;
      for (const c of camps) {
        r -= c.weight || 1;
        if (r <= 0) return { ...c, kind: 'campaign', label: 'ADVERTISEMENT' };
      }
      return { ...camps[0], kind: 'campaign', label: 'ADVERTISEMENT' };
    }
  }
  const h = HOUSE_ADS[hash(seed * 2654435761 + 7) % HOUSE_ADS.length];
  return { ...h, kind: 'house', label: 'DRUNK PIGEONS' };
}

// Anonymous, aggregate-only display counter — no player identity, no cross-campaign
// tracking, no advertising identifiers. Best-effort local persistence.
const IMPR_KEY = 'dp.ad.impressions.v1';
let _impr = null;
async function loadImpr() {
  if (_impr) return _impr;
  try {
    _impr = JSON.parse((await AsyncStorage.getItem(IMPR_KEY)) || '{}') || {};
  } catch (e) {
    _impr = {};
  }
  return _impr;
}
export function recordImpression(adId) {
  if (!adId) return;
  loadImpr().then((m) => {
    m[adId] = (m[adId] || 0) + 1;
    AsyncStorage.setItem(IMPR_KEY, JSON.stringify(m)).catch(() => {});
  });
}
export async function getImpressionCounts() {
  return { ...(await loadImpr()) };
}
