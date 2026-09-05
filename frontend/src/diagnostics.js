// Temporary internal-preview-only diagnostics for the v9->v10 native-lag investigation.
//
// __DEV__ is false in ANY EAS build that isn't the "development" (dev-client) profile
// — including the "preview" profile the user tests physical APKs from (confirmed
// against this project's eas.json: only "development" would use a dev client; "preview"
// and "production" both embed a production-mode JS bundle). So __DEV__-only
// instrumentation is invisible in a preview APK. This flag is ALSO true when
// EXPO_PUBLIC_DP_DIAGNOSTICS=1 is set, which eas.json sets ONLY for the "preview"
// build profile — never for "production". EXPO_PUBLIC_* vars are inlined into the
// bundle at build time by Expo's babel plugin, so this works in a real APK, not just
// the Metro dev server.
export const DIAGNOSTICS_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' && !!process.env && process.env.EXPO_PUBLIC_DP_DIAGNOSTICS === '1');

const MAX_LOG = 40; // bounded ring buffers — never grow unbounded, never hold PII

const state = {
  frameGaps: [], // { gapMs, distM, t } — raw rAF callback gaps > 25ms
  billboardRotations: [], // { distM, t } — each sponsor ad-slot rotation
  storageFlushes: [], // { ok, t } — each flushImpressions() attempt's outcome
  assetPreload: null, // { ms, t } — once, when the INTIES logo warm-up Image finishes decoding
};

function pushBounded(arr, entry) {
  arr.push(entry);
  if (arr.length > MAX_LOG) arr.shift();
}

export function logFrameGap(gapMs, distM, t) {
  if (!DIAGNOSTICS_ENABLED) return;
  pushBounded(state.frameGaps, { gapMs: Math.round(gapMs), distM, t: Math.round(t) });
}
export function logBillboardRotation(distM, t) {
  if (!DIAGNOSTICS_ENABLED) return;
  pushBounded(state.billboardRotations, { distM, t: Math.round(t) });
}
export function logStorageFlush(ok, t) {
  if (!DIAGNOSTICS_ENABLED) return;
  pushBounded(state.storageFlushes, { ok, t: Math.round(t) });
}
export function logAssetPreload(ms, t) {
  if (!DIAGNOSTICS_ENABLED) return;
  state.assetPreload = { ms: Math.round(ms), t: Math.round(t) };
}

// Deliberately console.log-only (no UI): readable via `adb logcat` on the physical
// device the user is testing, without adding any on-screen element or extra render
// during live gameplay. Call sites decide WHEN (game over / a deliberate action) —
// this function itself does not run on a timer or on every frame.
export function printDiagnosticsReport(label) {
  if (!DIAGNOSTICS_ENABLED) return;
  // eslint-disable-next-line no-console
  console.log(`[DP diagnostics${label ? ` - ${label}` : ''}]`, JSON.stringify(state));
}
