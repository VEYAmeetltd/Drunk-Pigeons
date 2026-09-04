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

function geomLamp(H, OW, seed) {
  const poleH = Math.min(H - 8, 110 + (seed % 55));
  const poleTopY = H - poleH;
  const poleW = 7;
  const poleX = OW / 2 - poleW / 2;
  const dir = seed % 2 === 0 ? 1 : -1;
  const armLen = 24;
  const armT = 5;
  const armY = poleTopY + 6;
  const armX = dir > 0 ? poleX + poleW : poleX - armLen;
  const headW = 22, headH = 15;
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

function geomCrane(H, OW, seed) {
  const dark = '#8a6410';
  const yellow = '#f2b41c';
  const mastW = 12;
  const mastX = OW / 2 - mastW / 2;
  const jibT = 8;
  const jibY = 20;
  const jibLenR = OW * 0.62;
  const jibLenL = OW * 0.22;
  const cabW = 16, cabH = 14;
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

function geomScaffold(H, OW, seed) {
  const pole = '#c9ccd1';
  const plankC = '#c79a54';
  const dark = '#5c6068';
  const segs = [];
  const decor = [];
  const poleXs = [6, OW / 2 - 2, OW - 10];
  for (const px of poleXs) segs.push({ type: 'rect', x: px, y: 0, w: 4, h: H, fill: pole, stroke: dark, strokeW: 1 });
  const decks = Math.max(2, Math.floor(H / 42));
  for (let i = 0; i < decks; i++) {
    const y = H - 16 - i * 42;
    if (y < 2) break;
    segs.push({ type: 'rect', x: 4, y, w: OW - 8, h: 8, fill: plankC, stroke: dark, strokeW: 1 });
    const braceLen = Math.min(34, y - 2);
    if (braceLen > 6) {
      decor.push({ type: 'capsule', x1: 7, y1: y + 8, x2: OW - 7, y2: y + 8 + braceLen, stroke: pole, t: 2 });
      decor.push({ type: 'capsule', x1: OW - 7, y1: y + 8, x2: 7, y2: y + 8 + braceLen, stroke: pole, t: 2 });
    }
  }
  return { segments: segs, decor };
}

function geomTree(H, OW, seed) {
  const trunk = '#7a5330';
  const green1 = '#2f8b3c', green2 = '#3fa24c', green3 = '#57bd62';
  const trunkH = Math.min(H * 0.5, 80);
  const trunkW = 12;
  const canopyR = Math.min(OW * 0.5, 30 + (seed % 14), H * 0.4);
  let canopyCy = H - trunkH - canopyR * 0.55;
  if (canopyCy - canopyR < 2) canopyCy = canopyR + 2;
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

function geomIndustrial(H, OW, seed) {
  const body = '#8a8f97', dark = '#565b62', warn = '#e2b53a';
  if (seed % 2 === 0) {
    const w = 15;
    return {
      segments: [{ type: 'rect', x: OW / 2 - w / 2, y: 0, w, h: H, fill: '#9a4a3a', stroke: '#6b2f22', strokeW: 2 }],
      decor: [{ type: 'rect', x: OW / 2 - w / 2 - 2, y: 0, w: w + 4, h: 10, fill: '#6b2f22' }],
    };
  }
  const tankW = Math.min(OW - 8, 48);
  const tankH = Math.min(H * 0.5, 52);
  const tankY = Math.max(0, H - tankH - Math.min(H * 0.35, 40));
  const legW = 6;
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

function geomRailway(H, OW, seed) {
  const steel = '#5f6870', dark = '#363c42', lt = '#828b94';
  const legW = 8;
  const legXs = [9, OW - 17];
  const segs = legXs.map((lx) => ({ type: 'rect', x: lx, y: 0, w: legW, h: H, fill: steel, stroke: dark, strokeW: 2 }));
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
function geomHanging(H, OW, seed) {
  const variant = seed % 3;
  const dark = '#33373d', cable = '#1f2226';
  if (variant === 0) {
    const beamT = 10;
    const cableBottom = Math.min(H - 4, beamT + 34);
    return {
      segments: [{ type: 'rect', x: -OW * 0.35, y: 0, w: OW * 1.7, h: beamT, fill: dark, stroke: '#1a1c1f', strokeW: 2 }],
      decor: [
        { type: 'capsule', x1: OW * 0.18, y1: beamT, x2: OW * 0.18, y2: cableBottom, stroke: cable, t: 3 },
        { type: 'capsule', x1: OW * 0.82, y1: beamT, x2: OW * 0.82, y2: cableBottom, stroke: cable, t: 3 },
      ],
    };
  }
  if (variant === 1) {
    const avail = H - 6;
    const cableLen = Math.max(10, avail * 0.32);
    const signW = Math.min(OW * 1.25, 88);
    const signH = Math.max(16, Math.min(avail - cableLen, 32));
    return {
      segments: [
        { type: 'capsule', x1: OW * 0.28, y1: 0, x2: OW * 0.28, y2: cableLen, stroke: cable, t: 4 },
        { type: 'capsule', x1: OW * 0.72, y1: 0, x2: OW * 0.72, y2: cableLen, stroke: cable, t: 4 },
        { type: 'rect', x: OW / 2 - signW / 2, y: cableLen, w: signW, h: signH, fill: '#ffffff', stroke: dark, strokeW: 2, radius: 4 },
      ],
      decor: [{ type: 'rect', x: OW / 2 - signW / 2 + 6, y: cableLen + 6, w: signW - 12, h: 6, fill: '#e0483a', radius: 2 }],
    };
  }
  const beamT = 8;
  return {
    segments: [
      { type: 'rect', x: -OW * 0.3, y: 10, w: OW * 1.6, h: beamT, fill: '#3b3f45', stroke: '#22252a', strokeW: 2 },
      { type: 'rect', x: 6, y: 0, w: 6, h: 18, fill: '#3b3f45', stroke: '#22252a', strokeW: 1 },
      { type: 'rect', x: OW - 12, y: 0, w: 6, h: 18, fill: '#3b3f45', stroke: '#22252a', strokeW: 1 },
    ],
    decor: [
      { type: 'capsule', x1: 4, y1: 18, x2: 4, y2: 18, fill: '#e0483a', t: 6 },
      { type: 'capsule', x1: OW - 4, y1: 18, x2: OW - 4, y2: 18, fill: '#4ad06a', t: 6 },
    ],
  };
}

// Safety net: guarantees no piece can ever poke past the gap-facing edge into
// the corridor the difficulty/gap generator already considers clear — no
// matter what the per-family math above produced. Only the gap-facing edge is
// clamped (the anchor edge is the structure's own ground/ceiling, never a
// fairness concern).
function clampToGapEdge(list, H, anchorEdge) {
  const out = [];
  for (const seg of list) {
    if (seg.type === 'rect') {
      let { y, h } = seg;
      if (anchorEdge === 'bottom') {
        if (y < 0) { h += y; y = 0; }
      } else if (y + h > H) {
        h = H - y;
      }
      if (h <= 0) continue;
      out.push({ ...seg, y, h });
    } else {
      let { y1, y2 } = seg;
      if (anchorEdge === 'bottom') {
        y1 = Math.max(0, y1);
        y2 = Math.max(0, y2);
      } else {
        y1 = Math.min(H, y1);
        y2 = Math.min(H, y2);
      }
      out.push({ ...seg, y1, y2 });
    }
  }
  return out;
}

// Builds { segments, decor } for a non-BUILDING family. `H` is the reserved
// height for that side (topH or bottomH); `seed` picks size/side variety.
// Returns null for BUILDING/unknown — callers keep the existing full-rect
// building collision & rendering path untouched.
export function buildGeometry(family, { H, OW, seed }) {
  const s = (seed || 1) >>> 0;
  let raw;
  let anchorEdge = 'bottom';
  switch (family) {
    case FAMILIES.LAMP: raw = geomLamp(H, OW, s); break;
    case FAMILIES.CRANE: raw = geomCrane(H, OW, s); break;
    case FAMILIES.SCAFFOLD: raw = geomScaffold(H, OW, s); break;
    case FAMILIES.TREE: raw = geomTree(H, OW, s); break;
    case FAMILIES.INDUSTRIAL: raw = geomIndustrial(H, OW, s); break;
    case FAMILIES.RAILWAY: raw = geomRailway(H, OW, s); break;
    case FAMILIES.HANGING: raw = geomHanging(H, OW, s); anchorEdge = 'top'; break;
    default: return null;
  }
  return {
    segments: clampToGapEdge(raw.segments, H, anchorEdge),
    decor: clampToGapEdge(raw.decor || [], H, anchorEdge),
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
