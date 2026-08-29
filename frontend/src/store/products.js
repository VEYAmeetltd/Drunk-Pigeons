// Centralised, configurable store product identifiers. Match these to the final
// App Store Connect / Google Play Console product IDs before release.
export const PRODUCTS = {
  pigeons: {
    roadman: 'drunkpigeons.pigeon.roadman',
    king: 'drunkpigeons.pigeon.king',
    gym: 'drunkpigeons.pigeon.gym',
    tourist: 'drunkpigeons.pigeon.tourist',
    fancy: 'drunkpigeons.pigeon.fancy',
  },
  bundle: 'drunkpigeons.pigeons.unlockall',
  // Gameplay MODE unlocks (non-consumable, one-time). Separate from pigeon cosmetics.
  mode: {
    easy: 'drunkpigeons.mode.easymode',
  },
};

// The five current premium (paid) pigeon ids.
export const PREMIUM_IDS = ['roadman', 'king', 'gym', 'tourist', 'fancy'];

// UK dev-config default price strings. In production these are replaced by the
// LOCALIZED price strings returned by Apple/Google (see Billing.getPrices()).
export const DEFAULT_PRICES = {
  pigeon: '£1.99',
  bundle: '£7.99',
  bundleSave: '£1.96', // 5 x £1.99 (£9.95) - £7.99
  easyMode: '£14.99',
};

export const pigeonProductId = (id) => PRODUCTS.pigeons[id];
