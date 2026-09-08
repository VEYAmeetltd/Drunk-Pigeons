// ---------------------------------------------------------------------------
// DP MERCH ⇄ REAL STRIPE BACKEND — the ONE integration boundary.
//
// Wired to the confirmed live contract (2026-09) at merchApi.js. The backend
// remains the sole owner of Stripe secrets/session-creation/webhooks/order
// persistence; this file only ever forwards a quote id + email and returns a
// client-safe checkoutUrl (Stripe Checkout hosted page) — never a secret.
//
// KNOWN GAP (see Final Report, sections G/H): the confirmed checkout-sessions
// request contract has NO success_url/cancel_url fields, so DP cannot tell
// the backend where to redirect the browser after Stripe. Until the backend
// team confirms its server-side redirect target (and, separately, an
// order-status endpoint), verifyMerchCheckoutSession() stays an honest stub —
// a deep-link return is NEVER treated as proof of payment.
// ---------------------------------------------------------------------------
import { requestQuote, createCheckoutSession, MerchApiError } from './merchApi';

function generateClientRequestId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // crypto unavailable in this runtime — fall through to the fallback below
  }
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// Fetches an authoritative price quote for one line item. Returns
// { ok: true, quote } or { ok: false, reason }. Never estimates pricing
// client-side — the backend's quotes response is the only source of truth.
export async function requestMerchQuote({ productId, size, quantity, destinationCountry }) {
  try {
    const quote = await requestQuote({
      items: [{ product_id: productId, size, quantity }],
      destinationCountry,
    });
    return { ok: true, quote };
  } catch (e) {
    if (e instanceof MerchApiError) {
      return { ok: false, reason: e.status === 0 ? 'network' : `http-${e.status}`, status: e.status };
    }
    return { ok: false, reason: 'unknown' };
  }
}

// Creates a Stripe Checkout Session for a previously-fetched quote. Returns
// a client-safe URL to open (never a secret key), or a clean failure reason.
// client_request_id is freshly generated per attempt so a retry after a
// network hiccup can never double-charge (backend-side idempotency key).
export async function requestMerchCheckout({ quoteId, contactEmail }) {
  try {
    const session = await createCheckoutSession({
      quoteId,
      contactEmail,
      clientRequestId: generateClientRequestId(),
    });
    return { ok: true, checkoutUrl: session.checkout_url, orderId: session.order_id, sessionId: session.session_id };
  } catch (e) {
    if (e instanceof MerchApiError) {
      // 503 is the CURRENT expected state (Stripe key not configured server-side yet).
      return { ok: false, reason: e.status === 503 ? 'unavailable' : e.status === 0 ? 'network' : `http-${e.status}`, status: e.status };
    }
    return { ok: false, reason: 'unknown' };
  }
}

// Confirms a return from Stripe checkout is authoritatively paid. The backend
// — not this app — is the source of truth; a success deep-link/query param
// alone is never treated as proof of payment. NOT CONFIGURED YET — no
// order-status endpoint exists in the confirmed contract (see Final Report).
export async function verifyMerchCheckoutSession(sessionId) {
  return { ok: false, reason: 'not-configured' };
}
