// ---------------------------------------------------------------------------
// DP MERCH ⇄ SEPARATE STRIPE BACKEND — the ONE integration boundary.
//
// A separate implementation owns Stripe: Checkout Session creation, secrets,
// webhooks, payment verification and order persistence. DP does not have a
// real endpoint/contract yet, so both functions below are honest stubs —
// they never fabricate a URL, never fake a successful session, and never
// contact any server. Once the real backend contract is provided, THIS FILE
// is the only place that needs to change; MerchProductScreen/MerchReturnOverlay
// already call it exactly the way a real implementation would be called.
//
// WHAT DP STILL NEEDS FROM THE BACKEND (see also PRD.md "Update — DP Merch
// Store" and the final task report):
//   • POST checkout endpoint URL
//   • Request fields: which product identifier format (this file sends the
//     catalogue id e.g. "merch-fancy" + size + quantity — confirm/rename)
//   • Response shape: expects a client-safe { checkoutUrl } (Stripe Checkout
//     hosted page) to open, OR a client secret for a different flow — TBD
//   • success_url contract: DP will listen on drunkpigeons://merch/success
//     (and, on web, /?merch_status=success) with a session id in the query —
//     confirm the exact param name (assumed session_id below)
//   * cancel_url contract: drunkpigeons://merch/cancel (web: ?merch_status=cancel)
//   • Any auth required on the checkout endpoint (anonymous vs signed-in)
// ---------------------------------------------------------------------------

// Creates a Stripe Checkout Session for one product/size/quantity. Returns a
// client-safe URL to open (never a secret key). NOT CONFIGURED YET.
export async function requestMerchCheckout({ productId, size, quantity }) {
  return { ok: false, reason: 'not-configured' };
}

// Confirms a return from Stripe checkout is authoritatively paid. The backend
// — not this app — is the source of truth; a success deep-link/query param
// alone is never treated as proof of payment. NOT CONFIGURED YET.
export async function verifyMerchCheckoutSession(sessionId) {
  return { ok: false, reason: 'not-configured' };
}
