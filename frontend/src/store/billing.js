import { Platform } from 'react-native';
import { PRODUCTS, PREMIUM_IDS, DEFAULT_PRICES } from './products';

// Are we in a development/testing build? The DEV purchase simulator is ONLY
// available when true and must never be exposed in production.
export const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? !!__DEV__
    : typeof process === 'undefined' || !process.env || process.env.NODE_ENV !== 'production';

// Pluggable billing provider. In production, inject a real StoreKit (iOS) /
// Google Play Billing (Android) adapter implementing:
//   getPrices(): Promise<{ [productId]: localizedPriceString }>
//   purchase(productId): Promise<{ status:'success'|'cancelled'|'failed', productId }>
//   restore(): Promise<string[]>  // owned non-consumable productIds
let provider = null;
export function setBillingProvider(p) {
  provider = p;
}

// Local price map (UK dev defaults). Replaced by localized store prices in prod.
const priceMap = {};
PREMIUM_IDS.forEach((k) => {
  priceMap[PRODUCTS.pigeons[k]] = DEFAULT_PRICES.pigeon;
});
priceMap[PRODUCTS.bundle] = DEFAULT_PRICES.bundle;
priceMap[PRODUCTS.mode.easy] = DEFAULT_PRICES.easyMode;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const Billing = {
  isDev: IS_DEV,
  platform: Platform.OS,
  products: PRODUCTS,

  async getPrices() {
    if (provider && provider.getPrices) {
      try {
        const p = await provider.getPrices();
        Object.assign(priceMap, p);
      } catch {
        /* fall back to defaults */
      }
    }
    return { ...priceMap };
  },

  priceFor(productId) {
    return priceMap[productId] || '';
  },

  // devOutcome is used ONLY by the development simulator UI; a real provider ignores it.
  async purchase(productId, devOutcome = 'success') {
    if (provider && provider.purchase) return provider.purchase(productId);
    if (!IS_DEV) return { status: 'failed', productId, reason: 'billing-not-configured' };
    // ----- DEVELOPMENT SIMULATOR ONLY -----
    await wait(280);
    return { status: devOutcome, productId };
  },

  async restore(devOwned = []) {
    if (provider && provider.restore) return provider.restore();
    if (!IS_DEV) return [];
    // ----- DEVELOPMENT SIMULATOR ONLY -----
    await wait(280);
    return devOwned;
  },
};
