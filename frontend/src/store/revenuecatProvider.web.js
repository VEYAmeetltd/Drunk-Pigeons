// WEB / dev-preview RevenueCat stub — Google Play Billing has no web equivalent,
// so this fails closed: no real prices, no purchases, no restores, no
// reconciliation. Metro picks this file for web; the real implementation lives
// in revenuecatProvider.native.js (wired for Android release builds only).
export const RevenueCatProvider = {
  supported: false,
  ALL_PRODUCT_IDS: [],
  configure() {},
  async getPrices() { return {}; },
  async purchase(productId) { return { status: 'failed', productId, reason: 'unsupported-platform' }; },
  async restore() { return []; },
  async getOwnedProductIds() { return null; },
};

export default RevenueCatProvider;
