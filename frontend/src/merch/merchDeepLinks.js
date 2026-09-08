// Parses a DP deep link (native `drunkpigeons://...` scheme, or a web
// pathname+search) into a merch checkout return. Returns null for anything
// that isn't merch-related so App.js can safely ignore every other link.
//
// RESOLVED (2026-09): the backend now owns configurable Stripe return URLs.
// DP's confirmed real values (reusing the existing `drunkpigeons` scheme +
// existing merch/success|cancel path convention already coded here — no
// second linking scheme invented):
//   MERCH_CHECKOUT_SUCCESS_URL = drunkpigeons://merch/success
//   MERCH_CHECKOUT_CANCEL_URL  = drunkpigeons://merch/cancel
// The backend appends order_id (+ session_id on success) as query params —
// captured below, but never treated as proof of payment: the order_id +
// status_token this app stored locally (see MerchProductScreen.js) are what
// MerchReturnOverlay.js actually polls via GET /merch/orders/{id}/status.
export function parseMerchReturn(url) {
  if (!url) return null;
  const search = url.includes('?') ? url.split('?')[1] : '';
  const params = {};
  search.split('&').filter(Boolean).forEach((pair) => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  if (/merch\/success/i.test(url) || params.merch_status === 'success') {
    return { status: 'success', sessionId: params.session_id || null, orderId: params.order_id || null };
  }
  if (/merch\/cancel/i.test(url) || params.merch_status === 'cancel') {
    return { status: 'cancel', sessionId: params.session_id || null, orderId: params.order_id || null };
  }
  return null;
}
