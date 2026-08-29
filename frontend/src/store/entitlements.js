// Character entitlement system. Determines whether a pigeon can be used and WHY.
// Sources: free | purchased | bundle | leet | locked. Easter-egg (leet) unlocks are
// kept deliberately separate from paid purchase records.
export function entitlementFor(pigeon, ent) {
  if (!pigeon || !pigeon.premium) return { source: 'free', canUse: true };
  const purchased = ent && ent.purchased ? ent.purchased : [];
  if (purchased.includes(pigeon.id)) return { source: 'purchased', canUse: true };
  if (ent && ent.bundleOwned) return { source: 'bundle', canUse: true };
  if (ent && ent.leetUnlock) return { source: 'leet', canUse: true };
  return { source: 'locked', canUse: false };
}

export function canUse(pigeon, ent) {
  return entitlementFor(pigeon, ent).canUse;
}

// True when every premium pigeon is already usable (hide the Unlock All bundle).
export function allPremiumUnlocked(pigeons, ent) {
  return pigeons.filter((p) => p.premium).every((p) => canUse(p, ent));
}

// EASY MODE is its OWN independent £14.99 entitlement. Deliberately NOT tied to
// the 733T (leet) unlock or any pigeon purchase — only a real Easy Mode purchase
// (or a restored Easy Mode ownership) grants it.
export function easyModeOwned(ent) {
  return !!(ent && ent.easyMode);
}

// Permanent Remove Ads entitlement — independent of pigeons/bundle/Easy Mode/733T.
export function removeAdsOwned(ent) {
  return !!(ent && ent.removeAds);
}
