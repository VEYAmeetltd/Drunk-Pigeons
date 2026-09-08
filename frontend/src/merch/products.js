// DRUNK PIGEONS physical merch catalogue.
// COMMERCE-FACING IDENTITY: the backend's product ids (dp-fancy-hoodie,
// dp-king-hoodie, dp-roadman-hoodie, dp-business-hoodie, dp-gym-hoodie) are
// the ONE canonical id used everywhere (cart/quote/checkout/testIDs) — there
// is no second local id system. name/colour/price/currency/sizes are
// AUTHORITATIVE from the backend (GET /api/merch/products); the backend
// currently returns image_asset_keys: null for every product, so the real
// product photography (mirrored verbatim from https://intiesltd.com/DPmerch)
// stays local and is merged in by id. Taglines/descriptions/features are the
// same live-website creative copy transcribed previously — not invented.
import { fetchMerchProducts } from './merchApi';

const IMG_BASE = 'https://intiesltd.com/merch';

function hoodieImages(slug) {
  return {
    front: `${IMG_BASE}/${slug}-hoodie-front.png`,
    back: `${IMG_BASE}/${slug}-hoodie-back.png`,
    left: `${IMG_BASE}/${slug}-hoodie-left.png`,
    right: `${IMG_BASE}/${slug}-hoodie-right.png`,
  };
}

const HOODIE_FEATURES = [
  'Premium 350 g/m² Stanley/Stella Slammer 2.0',
  'Soft, light-suede finish with a relaxed silhouette',
  'Full-colour DTG artwork on the front and back',
  'Kangaroo pocket with durable ribbed cuffs and hem',
];

const DELIVERY_NOTE = 'Price excludes delivery. UK delivery is £4.99. International delivery is calculated for your country and shown before you pay.';

// Local creative content keyed by the BACKEND product id — everything here
// is display-only; price/sizes/name/colour always come from the live API.
const CREATIVE_CONTENT = {
  'dp-fancy-hoodie': {
    tagline: 'CLASSY. TRASHY. ALWAYS PISSED.',
    fit: 'Relaxed unisex fit',
    description: "Fancy never enters quietly—and neither does this hoodie.\n\nHer full-colour Drunk Pigeons artwork owns the front, while the unapologetic back print finishes the job from across the room. Clean white fabric, loud pink detail and absolutely no interest in blending in.",
    features: HOODIE_FEATURES,
    images: hoodieImages('fancy'),
  },
  'dp-king-hoodie': {
    tagline: 'NOT ELECTED. BARELY UPRIGHT. STILL KING.',
    fit: 'Relaxed unisex fit',
    description: "Royal authority, questionable decision-making.\n\nThe King takes centre stage in purple and gold against deep black, crowned, sceptred and gloriously unqualified. Turn around and the understated INTIES feather-crown mark signs it off without stealing the throne.",
    features: HOODIE_FEATURES,
    images: hoodieImages('king'),
  },
  'dp-roadman-hoodie': {
    tagline: 'NO JOB. NO SHAME. FULL CONFIDENCE.',
    fit: 'Relaxed unisex fit',
    description: "Roadman doesn't do 9-to-5. He does whatever gets him home with the tin still cold.\n\nBomber jacket, cross-body bag and a beer he's definitely not sharing. The Roadman print owns the front in cool greys and street-grade grime, built for pigeons who consider the corner shop a personality trait.",
    features: HOODIE_FEATURES,
    images: hoodieImages('roadman'),
  },
  'dp-business-hoodie': {
    tagline: 'SUITED. BOOTED. STILL A DEGENERATE.',
    fit: 'Relaxed unisex fit',
    description: "Business handles the boardroom exactly how he handles everything else—badly, but with total confidence.\n\nSharp navy suit, briefcase, tie loosened by 9:15am. The Business print anchors the front in boardroom colours for pigeons who talk a big game and still can't answer their emails on time.",
    features: HOODIE_FEATURES,
    images: hoodieImages('business'),
  },
  'dp-gym-hoodie': {
    tagline: 'ZERO GAINS. MAXIMUM DELUSION.',
    fit: 'Relaxed unisex fit',
    description: "Gym skipped leg day, skipped every day, and still walks around like he owns the place.\n\nGreen tank, a dumbbell he's clearly struggling with, and the face of a pigeon who peaked at the vending machine. The Gym print brings unearned muscle to the front for pigeons who talk protein but live on chips.",
    features: HOODIE_FEATURES,
    images: hoodieImages('gym'),
  },
};

// Fixed display order on the storefront (matches the live website drop order).
const CATALOGUE_ORDER = [
  'dp-fancy-hoodie',
  'dp-king-hoodie',
  'dp-roadman-hoodie',
  'dp-business-hoodie',
  'dp-gym-hoodie',
];

// Minor units (pence) -> a clean £ label. Drops ".00" so £85.00 reads "£85".
export function formatMinor(amountMinor, currency) {
  if (typeof amountMinor !== 'number') return '';
  const val = amountMinor / 100;
  const str = Number.isInteger(val) ? String(val) : val.toFixed(2);
  if ((currency || '').toLowerCase() === 'gbp') return `£${str}`;
  return `${str} ${(currency || '').toUpperCase()}`;
}

function mergeProduct(apiProduct) {
  const creative = CREATIVE_CONTENT[apiProduct.id];
  if (!creative) return null; // unknown backend product — skip rather than invent content
  return {
    id: apiProduct.id,
    name: apiProduct.name,
    color: apiProduct.colour,
    price_minor: apiProduct.price_minor,
    currency: apiProduct.currency,
    priceLabel: formatMinor(apiProduct.price_minor, apiProduct.currency),
    sizes: apiProduct.sizes,
    tagline: creative.tagline,
    fit: creative.fit,
    description: creative.description,
    features: creative.features,
    images: creative.images,
    deliveryNote: DELIVERY_NOTE,
  };
}

// In-memory cache of the last successfully-loaded catalogue, keyed by id.
let _cache = {};

// Fetches the live catalogue, merges in local creative content, and caches
// it so getMerchProduct(id) can be read synchronously afterwards (used when
// navigating from the already-loaded store list into a product detail
// screen). Throws on failure — callers own the loading/error UI.
export async function loadMerchCatalogue() {
  const apiProducts = await fetchMerchProducts();
  const byId = {};
  apiProducts.forEach((p) => { byId[p.id] = p; });
  const merged = CATALOGUE_ORDER
    .map((id) => (byId[id] ? mergeProduct(byId[id]) : null))
    .filter(Boolean);
  const next = {};
  merged.forEach((p) => { next[p.id] = p; });
  _cache = next;
  return merged;
}

export function getMerchProduct(id) {
  return _cache[id] || null;
}

// Store-front hero copy — verbatim from the live website.
export const MERCH_STORE_INFO = {
  kicker: 'OFFICIAL MERCH · DROP 001',
  headline: 'WEAR THE CHAOS.',
  subhead: 'Five pigeons. Zero shared brain cells. Premium organic hoodies made on demand for the people who kept flying after common sense said stop.',
  badges: ['Made on demand', 'Secure Stripe checkout', 'Sold by INTIES LTD'],
  note: {
    kicker: 'A NOTE FROM US',
    paragraphs: [
      "This isn't merch for merch's sake.",
      "We've spent real time choosing the garment, refining the artwork and obsessing over the details because we wanted to make something genuinely worth wearing—not stick a logo on a cheap hoodie and call it a day.",
      "At £85, we know it isn't an impulse purchase. It's made on demand, built around original Drunk Pigeons artwork and created with the same care we're putting into the world around it. If you choose to wear one, you're not just buying a hoodie—you're joining the flock and helping us build this strange little universe from the beginning.",
      "Welcome to the chaos. We're glad you're here.",
    ],
  },
  details: [
    { kicker: 'THE GARMENT', heading: 'Proper hoodie. Not throwaway merch.', body: 'A heavyweight 350 g/m² relaxed hoodie with a soft finish, roomy kangaroo pocket and resilient ribbing. Built to be worn—not kept pristine in a drawer.' },
    { kicker: 'THE MATERIAL', heading: 'Organic at its core.', body: 'European fulfilment uses 100% organic combed ring-spun cotton. US fulfilment uses 80% organic cotton and 20% recycled polyester. Composition may therefore vary by fulfilment region.' },
    { kicker: 'THE FIT', heading: 'Relaxed, unisex and unapologetic.', body: 'Available in S–2XL. The garment uses US sizing; European customers are advised by the manufacturer to choose one size down. A full measurement guide will appear before checkout.' },
    { kicker: 'DELIVERY WITHOUT THE NASTY SURPRISE', heading: 'You see the full cost before paying.', body: 'UK delivery is a flat £4.99. For every other country, delivery is calculated from the destination and clearly displayed before payment. Your checkout can also display the total in your local currency—no mystery charge hiding on the next screen.' },
  ],
};
