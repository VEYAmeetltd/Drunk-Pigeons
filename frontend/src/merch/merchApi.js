// ---------------------------------------------------------------------------
// DP MERCH ⇄ REAL STRIPE BACKEND — thin fetch client for the separately-owned
// merch service. Base URL comes ONLY from EXPO_PUBLIC_MERCH_BACKEND_URL (this
// is a DIFFERENT service to the main game backend / leaderboard). Contract
// confirmed live 2026-09:
//   GET  /api/merch/products
//   GET  /api/merch/shipping-destinations
//   POST /api/merch/quotes              {items, destination_country}
//   POST /api/merch/checkout-sessions   {quote_id, contact_email, client_request_id}
// success_url / cancel_url are deliberately NOT sent by this client — they
// are not part of the confirmed request contract (see PRD "Deep-link gap").
// ---------------------------------------------------------------------------
const RAW_BASE = (process.env.EXPO_PUBLIC_MERCH_BACKEND_URL || '').trim();
const BASE = RAW_BASE.replace(/\/$/, '');
const API = `${BASE}/api/merch`;

export class MerchApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'MerchApiError';
    this.status = status; // 0 = network/config error, else real HTTP status (e.g. 503)
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, timeout = 8000 } = {}) {
  if (!BASE) throw new MerchApiError('merch-backend-not-configured', 0, null);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    throw new MerchApiError('network-error', 0, null);
  }
  clearTimeout(t);
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok) {
    throw new MerchApiError(json?.detail || `http-${res.status}`, res.status, json);
  }
  return json;
}

export async function fetchMerchProducts() {
  const data = await request('/products');
  return Array.isArray(data?.products) ? data.products : [];
}

export async function fetchShippingDestinations() {
  const data = await request('/shipping-destinations');
  return Array.isArray(data?.destinations) ? data.destinations : [];
}

// items: [{ product_id, size, quantity }]
export async function requestQuote({ items, destinationCountry }) {
  return request('/quotes', { method: 'POST', body: { items, destination_country: destinationCountry } });
}

export async function createCheckoutSession({ quoteId, contactEmail, clientRequestId }) {
  return request('/checkout-sessions', {
    method: 'POST',
    body: { quote_id: quoteId, contact_email: contactEmail, client_request_id: clientRequestId },
  });
}

// Public, unauthenticated order-status lookup — token-gated (no auth header).
// Backend returns 404 for a wrong/missing token OR a nonexistent order (never
// distinguished, so this client never leaks which one it was).
export async function getOrderStatus({ orderId, statusToken }) {
  return request(`/orders/${encodeURIComponent(orderId)}/status?token=${encodeURIComponent(statusToken)}`);
}
