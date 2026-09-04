// Shared obstacle GEOMETRY — the single source of truth consumed by BOTH the
// collision engine (engine.js) and the renderer (GameEntities.js). A family
// builder returns { segments, decor }: `segments` are real solid pieces (pole,
// arm, mast, jib, plank, trunk, canopy, beam, cable, sign, ...) and are used
// for BOTH drawing AND hit-testing — never a big rectangular wrapper. `decor`
// is drawn but NEVER collidable (texture: rivets, cross-braces, base plates).
//
// Local coordinate frame per obstacle SIDE: x runs 0..OW along the lane (may
// go negative / beyond OW for pieces that genuinely project into open sky,
// e.g. a crane jib or a hanging gantry beam). y runs 0..H where H is the
// reserved height for that side (topH for the top side, bottomH for the
// bottom side). Bottom-anchored families (lamp/crane/scaffold/tree/
// industrial/railway) have their anchor (ground) at y=H and the gap-facing
// edge at y=0. The one top-anchored family (hanging) has its anchor
// (ceiling) at y=0 and the gap-facing edge at y=H.
//
// DIFFICULTY LEVERS (Normal vs Easy) are expressed ONLY through visible
// geometry here — never through invisible/enlarged hitboxes:
//  `scale`   — how long/thick the key blocking pieces (arm, jib, mast, legs,
//              tank, canopy...) are drawn. Bigger scale = more of the lane
//              genuinely occupied, for longer, by real solid artwork.
//  `intrude` — how many px a family's near-gap piece may reach PAST the
//              nominal gap edge into the flight corridor the difficulty
//              generator already reserves as clear. 0 = never crosses it
//              (old behaviour). This is the main "requires active height
//              control" lever; `clampToGapEdge` enforces the cap either way.
export const FAMILIES = {
  BUILDING: 'building',
  LAMP: 'lamp',
  CRANE: 'crane',
  SCAFFOLD: 'scaffold',
  TREE: 'tree',
  INDUSTRIAL: 'industrial',
  RAILWAY: 'railway',
  HANGING: 'hanging', // top-originating: gantry / suspended sign / hanging beam
};

// Every non-BUILDING family that can anchor from the ground.
export const BOTTOM_FAMILIES = [
  FAMILIES.LAMP,
  FAMILIES.CRANE,
  FAMILIES.SCAFFOLD,
  FAMILIES.TREE,
  FAMILIES.INDUSTRIAL,
  FAMILIES.RAILWAY,
];

function geomLamp(H, OW, seed, scale, intrude) {
  const poleH = Math.min(H - 6 + intrude, (110 + (seed % 55)) * scale);
  const poleTopY = H - poleH; // can go negative (past the gap edge) up to -intrude
  const poleW = 6 + 2 * scale;
  const poleX = OW / 2 - poleW / 2;
  const dir = seed % 2 === 0 ? 1 : -1;
  const armLen = 22 * scale;
  const armT = 5;
  const armY = poleTopY + 6;
  const armX = dir > 0 ? poleX + poleW : poleX - armLen;
  const headW = 20 * scale, headH = 14 * scale;
  const headX = dir > 0 ? armX + armLen - headW + 6 : armX - 6;
  const headY = armY - headH + 5;
  const black = '#25291f';
  const glow = '#ffe27a';
  return {
    segments: [
      { type: 'rect', x: poleX, y: poleTopY, w: poleW, h: poleH, fill: black, stroke: '#131610', strokeW: 1 },
      { type: 'rect', x: armX, y: armY, w: armLen, h: armT, fill: black, stroke: '#131610', strokeW: 1 },
      { type: 'rect', x: headX, y: headY, w: headW, h: headH, fill: glow, stroke: black, strokeW: 1.5, radius: 4 },
    ],
    decor: [{ type: 'rect', x: poleX - 3, y: H - 7, w: poleW + 6, h: 7, fill: '#1a1c15', radius: 1 }],
  };
}

function geomCrane(H, OW, seed, scale, intrude) {
  const dark = '#8a6410';
  const yellow = '#f2b41c';
  const mastW = 10 + 4 * scale;
  const mastX = OW / 2 - mastW / 2;
  const jibT = 7 + 2 * scale;
  const jibY = 20 - intrude; // can go negative (past the gap edge) up to -intrude
  const jibLenR = OW * (0.5 + 0.18 * scale);
  const jibLenL = OW * (0.16 + 0.1 * scale);
  const cabW = 14 + 4 * scale, cabH = 12 + 4 * scale;
  return {
    segments: [
      { type: 'rect', x: mastX, y: 0, w: mastW, h: H, fill: yellow, stroke: dark, strokeW: 2 },
      { type: 'rect', x: mastX + mastW / 2 - 3, y: jibY, w: jibLenR, h: jibT, fill: yellow, stroke: dark, strokeW: 2 },
      { type: 'rect', x: mastX + mastW / 2 - jibLenL + 3, y: jibY, w: jibLenL, h: jibT, fill: dark, stroke: dark, strokeW: 1 },
      { type: 'rect', x: mastX - 3, y: jibY + jibT, w: cabW, h: cabH, fill: '#e9e2c9', stroke: dark, strokeW: 2 },
    ],
    decor: [
      { type: 'capsule', x1: mastX + 2, y1: 6, x2: mastX + mastW - 2, y2: 26, stroke: dark, t: 2.5 },
      { type: 'capsule', x1: mastX + mastW - 2, y1: 6, x2: mastX + 2, y2: 26, stroke: dark, t: 2.5 },
      { type: 'capsule', x1: mastX + mastW / 2 + jibLenR - 8, y1: jibY + jibT, x2: mastX + mastW / 2 + jibLenR - 8, y2: jibY + jibT + 20, stroke: dark, t: 2 },
    ],
  };
}

function geomScaffold(H, OW, seed, scale, intrude) {
  const pole = '#c9ccd1';
  const plankC = '#c79a54';
  const dark = '#5c6068';
  const segs = [];
  const decor = [];
  const poleW = 3 + 2 * scale;
  const poleXs = [6, OW / 2 - poleW / 2, OW - 9 - poleW];
  for (const px of poleXs) segs.push({ type: 'rect', x: px, y: -intrude, w: poleW, h: H + intrude, fill: pole, stroke: dark, strokeW: 1 });
  const deckH = 7 + 2 * scale;
  const deckGap = Math.max(30, 46 - 10 * scale); // decks closer together as scale increases
  const decks = Math.max(2, Math.floor((H + intrude) / deckGap));
  for (let i = 0; i < decks; i++) {
    const y = H - 16 - i * deckGap;
    if (y < -intrude + 2) break;
    segs.push({ type: 'rect', x: 4, y, w: OW - 8, h: deckH, fill: plankC, stroke: dark, strokeW: 1 });
    const braceLen = Math.min(34, y + intrude - 2);
    if (braceLen > 6) {
      decor.push({ type: 'capsule', x1: 7, y1: y + deckH, x2: OW - 7, y2: y + deckH + braceLen, stroke: pole, t: 2 });
      decor.push({ type: 'capsule', x1: OW - 7, y1: y + deckH, x2: 7, y2: y + deckH + braceLen, stroke: pole, t: 2 });
    }
  }
  return { segments: segs, decor };
}

function geomTree(H, OW, seed, scale, intrude) {
  const trunk = '#7a5330';
  const green1 = '#2f8b3c', green2 = '#3fa24c', green3 = '#57bd62';
  const trunkH = Math.min(H * 0.5 + intrude * 0.6, 80 * scale);
  const trunkW = 10 + 4 * scale;
  const canopyR = Math.min(OW * 0.56, (30 + (seed % 14)) * scale, H * 0.42 + intrude * 0.5);
  let canopyCy = H - trunkH - canopyR * 0.5;
  const minCy = canopyR - intrude;
  if (canopyCy < minCy) canopyCy = minCy;
  return {
    segments: [
      { type: 'rect', x: OW / 2 - trunkW / 2, y: H - trunkH, w: trunkW, h: trunkH, fill: trunk, stroke: '#5f4025', strokeW: 1 },
      { type: 'capsule', x1: OW / 2, y1: canopyCy, x2: OW / 2, y2: canopyCy, fill: green2, stroke: green1, strokeW: 2, t: canopyR * 2 },
    ],
    decor: [
      { type: 'capsule', x1: OW / 2 - canopyR * 0.35, y1: canopyCy - canopyR * 0.32, x2: OW / 2 - canopyR * 0.35, y2: canopyCy - canopyR * 0.32, fill: green3, t: canopyR * 0.7 },
    ],
  };
}

function geomIndustrial(H, OW, seed, scale, intrude) {
  const body = '#8a8f97', dark = '#565b62', warn = '#e2b53a';
  if (seed % 2 === 0) {
    const w = 13 + 8 * scale;
    return {
      segments: [{ type: 'rect', x: OW / 2 - w / 2, y: -intrude, w, h: H + intrude, fill: '#9a4a3a', stroke: '#6b2f22', strokeW: 2 }],
      decor: [{ type: 'rect', x: OW / 2 - w / 2 - 2, y: -intrude, w: w + 4, h: 10, fill: '#6b2f22' }],
    };
  }
  const tankW = Math.min(OW - 8, 38 + 16 * scale);
  const tankH = Math.min(H * 0.5 + intrude * 0.4, 38 + 20 * scale);
  const topBuffer = Math.max(0, Math.min(H * 0.35, 40) - intrude * 1.2);
  const tankY = Math.max(-intrude, H - tankH - topBuffer);
  const legW = 5 + 2 * scale;
  const legXs = [OW / 2 - tankW / 2 + 5, OW / 2 + tankW / 2 - 5 - legW];
  const legY = tankY + tankH * 0.75;
  return {
    segments: [
      { type: 'rect', x: OW / 2 - tankW / 2, y: tankY, w: tankW, h: tankH, fill: body, stroke: dark, strokeW: 2, radius: 6 },
      { type: 'rect', x: legXs[0], y: legY, w: legW, h: Math.max(4, H - legY), fill: dark, stroke: dark, strokeW: 1 },
      { type: 'rect', x: legXs[1], y: legY, w: legW, h: Math.max(4, H - legY), fill: dark, stroke: dark, strokeW: 1 },
    ],
    decor: [{ type: 'rect', x: OW / 2 - tankW / 2 + 4, y: tankY + 6, w: tankW - 8, h: 5, fill: warn, radius: 2 }],
  };
}

function geomRailway(H, OW, seed, scale, intrude) {
  const steel = '#5f6870', dark = '#363c42', lt = '#828b94';
  const legW = 6 + 4 * scale;
  const legXs = [8, OW - 8 - legW];
  const segs = legXs.map((lx) => ({ type: 'rect', x: lx, y: -intrude, w: legW, h: H + intrude, fill: steel, stroke: dark, strokeW: 2 }));
  // an extra solid centre brace (real, collidable) when scale is high enough —
  // Normal Mode gets an occasional genuine cross-blocker; Easy stays leg-only.
  if (scale >= 0.85) {
    const midY = H * 0.32;
    segs.push({ type: 'capsule', x1: legXs[0] + legW / 2, y1: midY - 5, x2: legXs[1] + legW / 2, y2: midY + 5, stroke: steel, t: 6 + 3 * scale });
  }
  const decor = [];
  const bays = Math.max(2, Math.floor(H / 46));
  for (let i = 0; i < bays; i++) {
    const y0 = i * 46, y1 = y0 + 46;
    if (y1 > H) break;
    decor.push({ type: 'capsule', x1: legXs[0] + legW / 2, y1: y0, x2: legXs[1] + legW / 2, y2: y1, stroke: lt, t: 3.5 });
    decor.push({ type: 'capsule', x1: legXs[1] + legW / 2, y1: y0, x2: legXs[0] + legW / 2, y2: y1, stroke: lt, t: 3.5 });
  }
  return { segments: segs, decor };
}

// Top-anchored only: hanging beam, suspended ad sign, or overhead railway gantry.
function geomHanging(H, OW, seed, scale, intrude) {
  const variant = seed % 3;
  const dark = '#33373d', cable = '#1f2226';
  if (variant === 0) {
    const beamT = 8 + 3 * scale;
    const reach = beamT + (26 + 12 * scale);
    const cableBottom = Math.min(H + intrude, reach);
    return {
      segments: [{ type: 'rect', x: -OW * 0.35, y: 0, w: OW * 1.7, h: beamT, fill: dark, stroke: '#1a1c1f', strokeW: 2 }],
      decor: [
        { type: 'capsule', x1: OW * 0.18, y1: beamT, x2: OW * 0.18, y2: cableBottom, stroke: cable, t: 3 },
        { type: 'capsule', x1: OW * 0.82, y1: beamT, x2: OW * 0.82, y2: cableBottom, stroke: cable, t: 3 },
      ],
    };
  }
  if (variant === 1) {
    const avail = H - 4;
    const cableLen = Math.max(10, avail * 0.28 * scale);
    const signW = Math.min(OW * (1.05 + 0.2 * scale), 100);
    const signH = Math.max(16, Math.min(avail - cableLen + intrude, 30 * scale));
    return {
      segments: [
        { type: 'capsule', x1: OW * 0.28, y1: 0, x2: OW * 0.28, y2: cableLen, stroke: cable, t: 4 },
        { type: 'capsule', x1: OW * 0.72, y1: 0, x2: OW * 0.72, y2: cableLen, stroke: cable, t: 4 },
        { type: 'rect', x: OW / 2 - signW / 2, y: cableLen, w: signW, h: signH, fill: '#ffffff', stroke: dark, strokeW: 2, radius: 4 },
      ],
      decor: [{ type: 'rect', x: OW / 2 - signW / 2 + 6, y: cableLen + 6, w: signW - 12, h: 6, fill: '#e0483a', radius: 2 }],
    };
  }
  const beamT = 7 + 3 * scale;
  const legH = 16 * scale + intrude;
  return {
    segments: [
      { type: 'rect', x: -OW * 0.3, y: 10, w: OW * 1.6, h: beamT, fill: '#3b3f45', stroke: '#22252a', strokeW: 2 },
      { type: 'rect', x: 6, y: 0, w: 6, h: legH, fill: '#3b3f45', stroke: '#22252a', strokeW: 1 },
      { type: 'rect', x: OW - 12, y: 0, w: 6, h: legH, fill: '#3b3f45', stroke: '#22252a', strokeW: 1 },
    ],
    decor: [
      { type: 'capsule', x1: 4, y1: 18, x2: 4, y2: 18, fill: '#e0483a', t: 6 },
      { type: 'capsule', x1: OW - 4, y1: 18, x2: OW - 4, y2: 18, fill: '#4ad06a', t: 6 },
    ],
  };
}

// Safety net: guarantees no piece can ever reach further than `intrude` px
// past the gap-facing edge into the corridor — no matter what the per-family
// math above produced. `intrude=0` reproduces the original "never crosses
// the edge" behaviour; a positive value is the ONLY way a piece can reach
// into the flight corridor, and it's always an explicit, bounded amount.
function clampToGapEdge(list, H, anchorEdge, intrude) {
  const out = [];
  for (const seg of list) {
    if (seg.type === 'rect') {
      let { y, h } = seg;
      if (anchorEdge === 'bottom') {
        const minY = -intrude;
        if (y < minY) { h += y - minY; y = minY; }
      } else {
        const maxY = H + intrude;
        if (y + h > maxY) h = maxY - y;
      }
      if (h <= 0) continue;
      out.push({ ...seg, y, h });
    } else {
      let { y1, y2 } = seg;
      if (anchorEdge === 'bottom') {
        const minY = -intrude;
        y1 = Math.max(minY, y1);
        y2 = Math.max(minY, y2);
      } else {
        const maxY = H + intrude;
        y1 = Math.min(maxY, y1);
        y2 = Math.min(maxY, y2);
      }
      out.push({ ...seg, y1, y2 });
    }
  }
  return out;
}

// Builds { segments, decor } for a non-BUILDING family. `H` is the reserved
// height for that side (topH or bottomH); `seed` picks size/side variety.
// `scale`/`intrudeBottom`/`intrudeTop` are the ONLY difficulty knobs (Normal
// vs Easy Mode) — always expressed as real, visible geometry; the matching
// clamp keeps every reach bounded and every visible piece = the hitbox.
// Returns null for BUILDING/unknown — callers keep the existing full-rect
// building collision & rendering path untouched.
export function buildGeometry(family, { H, OW, seed, scale = 1, intrudeBottom = 0, intrudeTop = 0 }) {
  const s = (seed || 1) >>> 0;
  let raw;
  let anchorEdge = 'bottom';
  let intrude = intrudeBottom;
  switch (family) {
    case FAMILIES.LAMP: raw = geomLamp(H, OW, s, scale, intrudeBottom); break;
    case FAMILIES.CRANE: raw = geomCrane(H, OW, s, scale, intrudeBottom); break;
    case FAMILIES.SCAFFOLD: raw = geomScaffold(H, OW, s, scale, intrudeBottom); break;
    case FAMILIES.TREE: raw = geomTree(H, OW, s, scale, intrudeBottom); break;
    case FAMILIES.INDUSTRIAL: raw = geomIndustrial(H, OW, s, scale, intrudeBottom); break;
    case FAMILIES.RAILWAY: raw = geomRailway(H, OW, s, scale, intrudeBottom); break;
    case FAMILIES.HANGING: raw = geomHanging(H, OW, s, scale, intrudeTop); anchorEdge = 'top'; intrude = intrudeTop; break;
    default: return null;
  }
  return {
    segments: clampToGapEdge(raw.segments, H, anchorEdge, intrude),
    decor: clampToGapEdge(raw.decor || [], H, anchorEdge, intrude),
  };
}

// Circle (pigeon, radius r, centre px,py) vs one LOCAL segment translated by
// the obstacle's world offset (ox,oy). Used by both the engine (collision)
// and nothing else — the renderer draws these same segments as-is.
export function hitTestSegment(px, py, r, seg, ox, oy) {
  if (seg.type === 'rect') {
    const sx = ox + seg.x, sy = oy + seg.y;
    const nx = Math.max(sx, Math.min(px, sx + seg.w));
    const ny = Math.max(sy, Math.min(py, sy + seg.h));
    const dx = px - nx, dy = py - ny;
    return dx * dx + dy * dy < r * r;
  }
  const x1 = ox + seg.x1, y1 = oy + seg.y1, x2 = ox + seg.x2, y2 = oy + seg.y2;
  const dx0 = x2 - x1, dy0 = y2 - y1;
  const len2 = dx0 * dx0 + dy0 * dy0;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((px - x1) * dx0 + (py - y1) * dy0) / len2));
  const cx = x1 + dx0 * t, cy = y1 + dy0 * t;
  const dx = px - cx, dy = py - cy;
  const rr = r + (seg.t || 4) / 2;
  return dx * dx + dy * dy < rr * rr;
}

// How far (px) this geometry's solid pieces project outside the [0,OW] lane —
// used by the engine's broad-phase culling so a wide jib/gantry beam is never
// skipped just because the obstacle's nominal lane has scrolled past.
export function projectionMargin(segments, OW) {
  let m = 0;
  for (const s of segments) {
    if (s.type === 'rect') {
      m = Math.max(m, -s.x, s.x + s.w - OW);
    } else {
      const half = (s.t || 4) / 2;
      m = Math.max(m, -s.x1 - half, -s.x2 - half, s.x1 + half - OW, s.x2 + half - OW);
    }
  }
  return Math.max(0, m);
}
