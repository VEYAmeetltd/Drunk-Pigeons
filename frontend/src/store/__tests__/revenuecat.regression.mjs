import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PRODUCTS = {
  pigeons: {
    roadman: 'drunkpigeons.pigeon.roadman',
    king: 'drunkpigeons.pigeon.king',
    gym: 'drunkpigeons.pigeon.gym',
    tourist: 'drunkpigeons.pigeon.tourist',
    fancy: 'drunkpigeons.pigeon.fancy',
  },
  bundle: 'drunkpigeons.pigeons.unlockall',
  mode: { easy: 'drunkpigeons.mode.easymode' },
  removeads: 'drunkpigeons.removeads',
};
const ALL_IDS = [
  ...Object.values(PRODUCTS.pigeons),
  PRODUCTS.bundle,
  PRODUCTS.mode.easy,
  PRODUCTS.removeads,
];

// Execute the production provider against a controllable fake react-native-purchases
// SDK. Only its require()/export boundary is replaced; configure/purchase/restore
// logic is unmodified (mirrors ../../ads/__tests__/admobLifecycle.regression.mjs).
const providerSource = readFileSync(new URL('../revenuecatProvider.native.js', import.meta.url), 'utf8');
const buildProvider = new Function('require', 'PRODUCTS', providerSource
  .replace(/^import .* from '\.\/products';\r?\n/m, '')
  .replace('export const RevenueCatProvider', 'const RevenueCatProvider')
  .replace('export default RevenueCatProvider;', 'return RevenueCatProvider;'));

function fixture() {
  const calls = { configure: 0, purchase: [], getProducts: [], restore: 0, getCustomerInfo: 0 };
  let customerInfo = { allPurchasedProductIdentifiers: [] };
  let nextPurchaseError = null;
  const catalog = {};
  const PURCHASES_ERROR_CODE = { PURCHASE_CANCELLED_ERROR: 'CANCELLED', PAYMENT_PENDING_ERROR: 'PENDING' };
  const sdk = {
    configure() { calls.configure++; },
    async getProducts(ids, category) {
      calls.getProducts.push({ ids, category });
      return ids.filter((id) => catalog[id]).map((id) => catalog[id]);
    },
    async purchaseStoreProduct({ product }) {
      calls.purchase.push(product.identifier);
      if (nextPurchaseError) { const e = nextPurchaseError; nextPurchaseError = null; throw e; }
      customerInfo = { allPurchasedProductIdentifiers: [...customerInfo.allPurchasedProductIdentifiers, product.identifier] };
      return { customerInfo };
    },
    async restorePurchases() { calls.restore++; return customerInfo; },
    async getCustomerInfo() { calls.getCustomerInfo++; return customerInfo; },
    PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
    PURCHASES_ERROR_CODE,
  };
  const provider = buildProvider(() => sdk, PRODUCTS);
  return {
    provider, calls, PURCHASES_ERROR_CODE,
    setProduct(id, priceString) { catalog[id] = { identifier: id, priceString }; },
    failNextPurchaseWith(error) { nextPurchaseError = error; },
    setCustomerInfo(ci) { customerInfo = ci; },
  };
}

// 1. Configuration happens exactly once.
{
  const f = fixture();
  f.provider.configure('goog_key_1');
  f.provider.configure('goog_key_2');
  f.provider.configure('goog_key_3');
  assert.equal(f.calls.configure, 1, 'Purchases.configure() must be called exactly once per process');
}

// 2. Localized price mapping — only returned identifiers appear; the request uses
// NON_SUBSCRIPTION so Android queries the correct one-time-product catalog.
{
  const f = fixture();
  f.setProduct(PRODUCTS.pigeons.roadman, '£1.99');
  f.setProduct(PRODUCTS.removeads, '£2.99');
  const prices = await f.provider.getPrices();
  assert.deepEqual(prices, { [PRODUCTS.pigeons.roadman]: '£1.99', [PRODUCTS.removeads]: '£2.99' });
  assert.equal(f.calls.getProducts[0].category, 'NON_SUBSCRIPTION');
  assert.deepEqual(new Set(f.calls.getProducts[0].ids), new Set(ALL_IDS), 'requests all 8 known DP product ids');
}

// 3. Successful purchase grants ownership only after CustomerInfo confirms the
// EXACT product identifier.
{
  const f = fixture();
  f.setProduct(PRODUCTS.pigeons.king, '£1.99');
  const res = await f.provider.purchase(PRODUCTS.pigeons.king);
  assert.deepEqual(res, { status: 'success', productId: PRODUCTS.pigeons.king });
  assert.deepEqual(f.calls.purchase, [PRODUCTS.pigeons.king], 'purchaseStoreProduct receives the exact fetched StoreProduct');
}

// 4. User cancellation grants nothing.
{
  const f = fixture();
  f.setProduct(PRODUCTS.pigeons.gym, '£1.99');
  f.failNextPurchaseWith({ userCancelled: true });
  const res = await f.provider.purchase(PRODUCTS.pigeons.gym);
  assert.deepEqual(res, { status: 'cancelled', productId: PRODUCTS.pigeons.gym });
  const owned = await f.provider.getOwnedProductIds();
  assert.deepEqual(owned, [], 'cancellation must unlock nothing');
}

// 5. Pending payment and generic failure both grant nothing.
{
  const f = fixture();
  f.setProduct(PRODUCTS.mode.easy, '£14.99');
  f.failNextPurchaseWith({ code: f.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR });
  const pending = await f.provider.purchase(PRODUCTS.mode.easy);
  assert.equal(pending.status, 'pending');
  f.failNextPurchaseWith(new Error('network down'));
  const failed = await f.provider.purchase(PRODUCTS.mode.easy);
  assert.equal(failed.status, 'failed');
  const owned = await f.provider.getOwnedProductIds();
  assert.deepEqual(owned, [], 'pending and failed purchases must unlock nothing');
}

// 6. Missing/unavailable product fails closed without ever calling purchaseStoreProduct.
{
  const f = fixture();
  const res = await f.provider.purchase(PRODUCTS.bundle);
  assert.deepEqual(res, { status: 'failed', productId: PRODUCTS.bundle, reason: 'unavailable' });
  assert.deepEqual(f.calls.purchase, [], 'an unavailable product is never sent to purchaseStoreProduct');
}

// 7. Restore maps all eight product IDs correctly (and ignores unrelated ids).
{
  const f = fixture();
  f.setCustomerInfo({ allPurchasedProductIdentifiers: [...ALL_IDS, 'some.other.apps.product'] });
  const restored = await f.provider.restore();
  assert.deepEqual(new Set(restored), new Set(ALL_IDS));
  assert.equal(f.calls.restore, 1);
}

// 8. Release builds cannot use the dev simulator — the controller only wires the
// real provider for Android RELEASE builds; dev/other-platform init() is a no-op.
{
  const controllerSource = readFileSync(new URL('../revenuecat.js', import.meta.url), 'utf8');
  const buildController = new Function(
    'Platform', 'RevenueCatProvider', 'REVENUECAT_ANDROID_PUBLIC_KEY', 'setBillingProvider', 'IS_DEV',
    controllerSource
      .replace(/^import .*;\r?\n/gm, '')
      .replace('export const RevenueCat', 'const RevenueCat')
      .replace('export default RevenueCat;', 'return RevenueCat;'),
  );

  let wiredProvider = null;
  const setBillingProvider = (p) => { wiredProvider = p; };
  let configureCalls = 0;
  const fakeProvider = { configure: () => { configureCalls++; }, getOwnedProductIds: async () => ['x'] };

  // Android + __DEV__ true (debug/local build): must NOT wire the real provider.
  wiredProvider = null; configureCalls = 0;
  const devController = buildController({ OS: 'android' }, fakeProvider, 'key', setBillingProvider, true);
  devController.init();
  devController.init();
  assert.equal(wiredProvider, null, 'IS_DEV must never wire the real provider — the dev simulator stays in control');
  assert.equal(configureCalls, 0);
  assert.equal(await devController.getOwnedProductIds(), null, 'dev builds never reconcile against RevenueCat');

  // iOS (unsupported platform in this task's scope): must fail closed regardless of IS_DEV.
  wiredProvider = null;
  buildController({ OS: 'ios' }, fakeProvider, 'key', setBillingProvider, false).init();
  assert.equal(wiredProvider, null, 'iOS is unsupported and must fail closed (never wires a provider)');

  // Android RELEASE build (__DEV__ false): wires the real provider exactly once.
  wiredProvider = null; configureCalls = 0;
  const releaseController = buildController({ OS: 'android' }, fakeProvider, 'key', setBillingProvider, false);
  releaseController.init();
  releaseController.init();
  releaseController.init();
  assert.equal(wiredProvider, fakeProvider, 'release Android build wires the real RevenueCat provider');
  assert.equal(configureCalls, 1, 'controller-level configure is also called exactly once');
  assert.deepEqual(await releaseController.getOwnedProductIds(), ['x']);
}

console.log('PASS: RevenueCat configures once, maps localized prices, grants ownership only on confirmed CustomerInfo, fails closed on cancel/pending/failure/unavailable products, restore maps all 8 product ids, and the dev simulator is never hijacked outside Android release builds');
