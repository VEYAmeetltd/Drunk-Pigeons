// RevenueCat controller — decides WHEN the real Google Play Billing provider
// gets wired into billing.js's pluggable Billing.setBillingProvider() slot.
//
// Deliberately Android-release-only:
//   - iOS/web: RevenueCatProvider stays unwired -> billing.js's existing
//     `if (!IS_DEV) return failed` path fails closed (rule: unsupported
//     platforms must never crash or grant anything).
//   - Android DEV/debug builds: also stays unwired, so the existing DEV
//     purchase simulator (Billing.isDev / PigeonsScreen's Simulate
//     Success/Cancelled/Failed buttons) keeps working exactly as before —
//     wiring the real SDK here would silently hijack those buttons into
//     attempting a real Play Billing purchase.
//   - Android RELEASE builds (__DEV__ false, incl. EAS "preview"/"production"
//     profiles): configures RevenueCat once and wires the real provider.
import { Platform } from 'react-native';
import RevenueCatProvider from './revenuecatProvider';
import { REVENUECAT_ANDROID_PUBLIC_KEY } from './revenuecatConfig';
import { setBillingProvider, IS_DEV } from './billing';

let wired = false;

export const RevenueCat = {
  init() {
    if (wired || Platform.OS !== 'android' || IS_DEV) return;
    RevenueCatProvider.configure(REVENUECAT_ANDROID_PUBLIC_KEY);
    setBillingProvider(RevenueCatProvider);
    wired = true;
  },
  // Startup / customer-info-refresh reconciliation. Returns owned product ids
  // on a successful authoritative response, or null (Android dev/debug, other
  // platforms, or RevenueCat unreachable) — callers must then leave the
  // existing local ownership cache untouched.
  async getOwnedProductIds() {
    if (Platform.OS !== 'android' || IS_DEV) return null;
    return RevenueCatProvider.getOwnedProductIds();
  },
};

export default RevenueCat;
