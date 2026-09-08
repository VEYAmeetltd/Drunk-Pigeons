// ---------------------------------------------------------------------------
// DP MERCH ⇄ REAL STRIPE BACKEND — the ONE integration boundary.
//
// Wired to the confirmed live contract (2026-09, updated with order-status
// endpoint). The backend remains the sole owner of Stripe secrets/session
// creation/webhooks/order persistence; this file only ever forwards a quote
// id + email and returns a client-safe checkoutUrl (Stripe Checkout hosted
// page) — never a secret. A "success" deep-link return is NEVER treated as
// proof of payment on its own — checkOrderStatus() (backed by the public
// GET /merch/orders/{id}/status?token=... endpoint) is the only source of
// truth; see MerchReturnOverlay.js for the bounded polling flow.
// ---------------------------------------------------------------------------
import { requestQuote, createCheckoutSession, getOrderStatus, MerchApiError } from './merchApi';

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
// a client-safe URL to open (never a secret key) plus the order_id +
// status_token needed later to poll order-status, or a clean failure reason.
// client_request_id is freshly generated per attempt so a retry after a
// network hiccup can never double-charge (backend-side idempotency key).
export async function requestMerchCheckout({ quoteId, contactEmail }) {
  try {
    const session = await createCheckoutSession({
      quoteId,
      contactEmail,
      clientRequestId: generateClientRequestId(),
    });
    return {
      ok: true,
      checkoutUrl: session.checkout_url,
      orderId: session.order_id,
      sessionId: session.session_id,
      statusToken: session.status_token,
    };
  } catch (e) {
    if (e instanceof MerchApiError) {
      // 503 is the CURRENT expected state (Stripe key not configured server-side yet).
      return { ok: false, reason: e.status === 503 ? 'unavailable' : e.status === 0 ? 'network' : `http-${e.status}`, status: e.status };
    }
    return { ok: false, reason: 'unknown' };
  }
}

// Checks the authoritative payment status of a previously-created order via
// the public, token-gated order-status endpoint. Returns
// { ok:true, status, paymentStatus } or { ok:false, reason }. A wrong/missing
// token and a nonexistent order both surface as the same 404 -> 'not-found'
// (the backend never reveals which) — callers must not retry indefinitely.
export async function checkOrderStatus({ orderId, statusToken }) {
  try {
    const data = await getOrderStatus({ orderId, statusToken });
    return { ok: true, status: data.status, paymentStatus: data.payment_status };
  } catch (e) {
    if (e instanceof MerchApiError) {
      return { ok: false, reason: e.status === 404 ? 'not-found' : e.status === 0 ? 'network' : `http-${e.status}` };
    }
    return { ok: false, reason: 'unknown' };
  }
}
