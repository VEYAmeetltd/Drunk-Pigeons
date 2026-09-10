// NATIVE RevenueCat / Google Play Billing provider — real react-native-purchases
// SDK integration. Wired as the Billing provider only for Android RELEASE builds
// (see revenuecat.js controller — dev/debug builds keep the existing DEV
// simulator in billing.js untouched). Metro selects this file for native
// (iOS+Android) builds; the web preview uses revenuecatProvider.web.js instead,
// so the SDK is never bundled for web.
//
// Every DRUNK PIGEONS product is a NON-CONSUMABLE, one-time purchase. DP already
// has its own shop UI (PigeonsScreen/MainMenu), so we always purchase the exact
// StoreProduct via purchaseStoreProduct — never offerings/packages/react-native-purchases-ui.
import { PRODUCTS } from './products';

// Guarded require so a missing/unlinked native module degrades safely instead
// of crashing the game (mirrors ../ads/admobProvider.native.js).
let SDK = null;
try {
  SDK = require('react-native-purchases');
} catch (e) {
  SDK = null;
}

const Purchases = SDK && (SDK.default || SDK);
const PRODUCT_CATEGORY = SDK && SDK.PRODUCT_CATEGORY;
const PURCHASES_ERROR_CODE = SDK && SDK.PURCHASES_ERROR_CODE;

// All 8 non-consumable, one-time DRUNK PIGEONS product identifiers.
const ALL_PRODUCT_IDS = [
  PRODUCTS.pigeons.roadman,
  PRODUCTS.pigeons.king,
  PRODUCTS.pigeons.gym,
  PRODUCTS.pigeons.tourist,
  PRODUCTS.pigeons.fancy,
  PRODUCTS.bundle,
  PRODUCTS.mode.easy,
  PRODUCTS.removeads,
];

let configured = false;

// Called exactly once (guarded here AND in revenuecat.js) per app process.
function configure(apiKey) {
  if (!SDK || configured) return;
  Purchases.configure({ apiKey });
  configured = true;
}

// Maps a PurchasesError to the 3 outcomes the existing shop UI understands
// (PigeonsScreen.runPurchase checks 'success' / 'cancelled' / anything else).
// Any error that isn't an explicit user-cancel or a pending payment is treated
// as a failure — nothing is ever granted on an ambiguous/unknown error.
function classifyError(error) {
  if (error && error.userCancelled) return 'cancelled';
  const code = error && error.code;
  if (PURCHASES_ERROR_CODE && code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
  if (PURCHASES_ERROR_CODE && code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return 'pending';
  return 'failed';
}

// Localized Google Play prices for every DP product, using the NON_SUBSCRIPTION
// category (Android would otherwise query the subscription catalog and return
// nothing). Missing products are simply absent from the map — billing.js already
// falls back to DEFAULT_PRICES for any id it doesn't recognise.
async function getPrices() {
  if (!SDK) return {};
  try {
    const products = await Purchases.getProducts(ALL_PRODUCT_IDS, PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    const prices = {};
    (products || []).forEach((p) => {
      if (p && p.identifier && p.priceString) prices[p.identifier] = p.priceString;
    });
    return prices;
  } catch (e) {
    return {};
  }
}

async function findProduct(productId) {
  const products = await Purchases.getProducts([productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  return (products || []).find((p) => p && p.identifier === productId) || null;
}

// A null/undefined/empty productId — or one outside our known 8-product set —
// must never reach the native RevenueCat bridge (root cause of the crash this
// guards: com.revenuecat.purchases.hybridcommon.CommonKt.purchaseProduct threw
// a NullPointerException because a malformed identifier reached it).
function isKnownProductId(productId) {
  return typeof productId === 'string' && productId.length > 0 && ALL_PRODUCT_IDS.includes(productId);
}

// Purchases the EXACT StoreProduct for productId. Grants nothing until
// CustomerInfo confirms ownership of this exact product identifier — a
// successful native purchase call alone is never treated as a grant.
async function purchase(productId) {
  if (!SDK) return { status: 'failed', productId, reason: 'unavailable' };
  if (!isKnownProductId(productId)) return { status: 'failed', productId, reason: 'invalid-product' };
  try {
    const product = await findProduct(productId);
    if (!product) return { status: 'failed', productId, reason: 'unavailable' };
    // purchaseStoreProduct(product) takes the StoreProduct itself (it carries
    // .identifier) — it must NEVER be wrapped in an extra { product } object,
    // which is exactly what caused productIdentifier to arrive as null/undefined
    // at the native bridge and crash the app on every purchase.
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    const owned = (customerInfo && customerInfo.allPurchasedProductIdentifiers) || [];
    if (owned.includes(productId)) return { status: 'success', productId };
    return { status: 'failed', productId, reason: 'not-confirmed' };
  } catch (error) {
    return { status: classifyError(error), productId };
  }
}

// User-triggered ONLY (never called automatically — see restore-purchases button
// in PigeonsScreen.js). Returns every DP product id this Play account owns.
async function restore() {
  if (!SDK) return [];
  try {
    const customerInfo = await Purchases.restorePurchases();
    const owned = (customerInfo && customerInfo.allPurchasedProductIdentifiers) || [];
    return owned.filter((id) => ALL_PRODUCT_IDS.includes(id));
  } catch (e) {
    return [];
  }
}

// Startup / customer-info-refresh reconciliation — NOT user-triggered, and
// distinct from restore() above. Returns the authoritative owned-id list on a
// successful response, or null when RevenueCat is unreachable so the caller
// (App.js) preserves whatever ownership is already cached locally.
async function getOwnedProductIds() {
  if (!SDK) return null;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const owned = (customerInfo && customerInfo.allPurchasedProductIdentifiers) || [];
    return owned.filter((id) => ALL_PRODUCT_IDS.includes(id));
  } catch (e) {
    return null;
  }
}

export const RevenueCatProvider = {
  supported: !!SDK,
  ALL_PRODUCT_IDS,
  configure,
  getPrices,
  purchase,
  restore,
  getOwnedProductIds,
};

export default RevenueCatProvider;
