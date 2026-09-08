// Parses a DP deep link (native `drunkpigeons://...` scheme, or a web
// pathname+search) into a merch checkout return. Returns null for anything
// that isn't merch-related so App.js can safely ignore every other link.
//
// KNOWN GAP: the confirmed checkout-sessions request contract has no
// success_url/cancel_url field, so DP cannot tell the backend which URL to
// redirect Stripe to after payment — this parser is future-ready for
// whatever the backend team eventually redirects to, but nothing currently
// triggers it in production (see Final Report section H).
export function parseMerchReturn(url) {
  if (!url) return null;
  const search = url.includes('?') ? url.split('?')[1] : '';
  const params = {};
  search.split('&').filter(Boolean).forEach((pair) => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  if (/merch\/success/i.test(url) || params.merch_status === 'success') {
    return { status: 'success', sessionId: params.session_id || null };
  }
  if (/merch\/cancel/i.test(url) || params.merch_status === 'cancel') {
    return { status: 'cancel', sessionId: params.session_id || null };
  }
  return null;
}
