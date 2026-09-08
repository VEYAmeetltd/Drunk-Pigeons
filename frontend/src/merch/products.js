// DRUNK PIGEONS physical merch catalogue — transcribed verbatim from the live,
// authoritative website store (https://intiesltd.com/DPmerch) on 2026-09-08.
// This is a READ-ONLY mirror for display purposes only. Prices, names, sizes,
// descriptions and images are NOT invented here — do not add products, sizes
// or variants that don't exist on the website. Product ids are prefixed
// "merch-" so they can never collide with the digital IAP ids in ../store/products.js.
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

const HOODIE_SIZES = ['S', 'M', 'L', 'XL', '2XL'];

const DELIVERY_NOTE = '£85 excluding delivery. UK delivery is £4.99. International delivery is calculated from your country and shown before you pay.';

export const MERCH_PRODUCTS = [
  {
    id: 'merch-fancy',
    name: 'The Fancy Hoodie',
    tagline: 'CLASSY. TRASHY. ALWAYS PISSED.',
    color: 'White',
    fit: 'Relaxed unisex fit',
    price: 85,
    priceLabel: '£85',
    description: "Fancy never enters quietly—and neither does this hoodie.\n\nHer full-colour Drunk Pigeons artwork owns the front, while the unapologetic back print finishes the job from across the room. Clean white fabric, loud pink detail and absolutely no interest in blending in.",
    features: HOODIE_FEATURES,
    sizes: HOODIE_SIZES,
    deliveryNote: DELIVERY_NOTE,
    images: hoodieImages('fancy'),
  },
  {
    id: 'merch-king',
    name: 'The King Hoodie',
    tagline: 'NOT ELECTED. BARELY UPRIGHT. STILL KING.',
    color: 'Black',
    fit: 'Relaxed unisex fit',
    price: 85,
    priceLabel: '£85',
    description: "Royal authority, questionable decision-making.\n\nThe King takes centre stage in purple and gold against deep black, crowned, sceptred and gloriously unqualified. Turn around and the understated INTIES feather-crown mark signs it off without stealing the throne.",
    features: HOODIE_FEATURES,
    sizes: HOODIE_SIZES,
    deliveryNote: DELIVERY_NOTE,
    images: hoodieImages('king'),
  },
  {
    id: 'merch-roadman',
    name: 'The Roadman Hoodie',
    tagline: 'NO JOB. NO SHAME. FULL CONFIDENCE.',
    color: 'Black',
    fit: 'Relaxed unisex fit',
    price: 85,
    priceLabel: '£85',
    description: "Roadman doesn't do 9-to-5. He does whatever gets him home with the tin still cold.\n\nBomber jacket, cross-body bag and a beer he's definitely not sharing. The Roadman print owns the front in cool greys and street-grade grime, built for pigeons who consider the corner shop a personality trait.",
    features: HOODIE_FEATURES,
    sizes: HOODIE_SIZES,
    deliveryNote: DELIVERY_NOTE,
    images: hoodieImages('roadman'),
  },
  {
    id: 'merch-business',
    name: 'The Business Hoodie',
    tagline: 'SUITED. BOOTED. STILL A DEGENERATE.',
    color: 'Black',
    fit: 'Relaxed unisex fit',
    price: 85,
    priceLabel: '£85',
    description: "Business handles the boardroom exactly how he handles everything else—badly, but with total confidence.\n\nSharp navy suit, briefcase, tie loosened by 9:15am. The Business print anchors the front in boardroom colours for pigeons who talk a big game and still can't answer their emails on time.",
    features: HOODIE_FEATURES,
    sizes: HOODIE_SIZES,
    deliveryNote: DELIVERY_NOTE,
    images: hoodieImages('business'),
  },
  {
    id: 'merch-gym',
    name: 'The Gym Hoodie',
    tagline: 'ZERO GAINS. MAXIMUM DELUSION.',
    color: 'Black',
    fit: 'Relaxed unisex fit',
    price: 85,
    priceLabel: '£85',
    description: "Gym skipped leg day, skipped every day, and still walks around like he owns the place.\n\nGreen tank, a dumbbell he's clearly struggling with, and the face of a pigeon who peaked at the vending machine. The Gym print brings unearned muscle to the front for pigeons who talk protein but live on chips.",
    features: HOODIE_FEATURES,
    sizes: HOODIE_SIZES,
    deliveryNote: DELIVERY_NOTE,
    images: hoodieImages('gym'),
  },
];

export function getMerchProduct(id) {
  return MERCH_PRODUCTS.find((p) => p.id === id) || null;
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
