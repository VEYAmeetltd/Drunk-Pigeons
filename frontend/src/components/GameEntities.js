import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, useDerivedValue, withRepeat, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import Svg, { Circle, Rect as SvgRect, Line, G, Path } from 'react-native-svg';
import DrunkPigeon from './DrunkPigeon';
import { CONFIG, pigeonSizeFor } from '../config';
import { FONT } from '../ui/theme';
import { FAMILIES } from '../game/obstacleGeometry';

const OW = CONFIG.OBSTACLE_WIDTH;
// Stable, always-safe placeholder geometry for whichever side/family is NOT
// active on a given recycle — StructureShape stays mounted permanently and
// simply draws nothing (no segments) rather than being unmounted.
const EMPTY_GEO = { segments: [], decor: [] };

// DEV-ONLY mount instrumentation (no-op cost in production: a few integers,
// never rendered). Each counter increments exactly once per REAL React mount
// (empty-deps effect) so a test/dev build can confirm the obstacle pool's
// subtrees mount ONCE at screen-open and never again during gameplay.
export const DEV_MOUNT_STATS = { building: 0, structureShape: 0, obstacleView: 0 };
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

function shade(hex, f) {
  const h = (hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * f);
  const g = clamp(((n >> 8) & 255) * f);
  const b = clamp((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function rngFrom(seed) {
  let a = (seed || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- Pigeon ---------------- */
// The outer Animated.View owns ONLY the gameplay/physics-driven presentation:
// world position, velocity tilt, flap squash and death/invincible opacity.
// The drunk personality (sway, wobble, bob, hiccups, HIC!, bubbles, wing flail
// and the 360° barrel roll) lives INSIDE, in DrunkPigeon, so it can never touch
// physics — collision/hitbox use world.px/py + size only, not this visual transform.
export function PigeonView({ world, pigeon, fatLevel, boost = false, strength = 1, deflateSignal = 0, suppressQuips = false }) {
  const size = pigeonSizeFor(fatLevel);
  const style = useAnimatedStyle(() => {
    const w = world.value;
    const t = w.t || 0;
    const squashY = 1 - w.flap * 0.16;
    const squashX = 1 + w.flap * 0.12;
    let opacity = 1;
    if (w.dead) opacity = 0;
    else if (w.inv) opacity = 0.45 + 0.45 * Math.abs(Math.sin(t / 70));
    return {
      opacity,
      transform: [
        { translateX: w.px - size / 2 },
        { translateY: w.py - size / 2 },
        { rotate: `${w.tilt}deg` },
        { scaleX: squashX },
        { scaleY: squashY },
      ],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width: size, height: size }, style]} pointerEvents="none">
      <DrunkPigeon pigeon={pigeon} fatLevel={fatLevel} size={size} intensity="full" eyes boost={boost} strength={strength} sound deflateSignal={deflateSignal} suppressQuips={suppressQuips} testID="game-pigeon" />
    </Animated.View>
  );
}

/* Scripted priority speech bubble for the player pigeon (e.g. Roadman's one-time
 * intro/milestone lines). Independent of the ordinary HIC/quip system inside
 * DrunkPigeon — tracks the pigeon's live world.px/py every frame and reuses the SAME
 * flip/clamp containment recipe as HecklerView so it can never clip off any screen edge,
 * including the top safe-area inset on notch/Dynamic-Island devices. */
export function PigeonSpeechBubble({ world, text, textKey, screenW = 400, screenH = 800, topInset = 0 }) {
  const bubbleH = useSharedValue(46);
  const anchorHalf = 26; // approx pigeon radius, purely for bubble placement (not physics)

  const layout = useDerivedValue(() => {
    const w = world.value;
    const bh = bubbleH.value;
    const safeTop = topInset + BUBBLE_MARGIN;
    const safeBottom = screenH - BUBBLE_MARGIN;
    const safeLeft = BUBBLE_MARGIN;
    const safeRight = screenW - BUBBLE_MARGIN;
    const anchorTop = w.py - anchorHalf;
    const anchorBottom = w.py + anchorHalf;

    let bubY = anchorTop - BUBBLE_GAP - bh;
    let tailBelow = 0;
    if (bubY < safeTop) {
      bubY = anchorBottom + BUBBLE_GAP;
      tailBelow = 1;
      if (bubY + bh > safeBottom) bubY = Math.max(safeTop, safeBottom - bh);
    }
    let bubX = w.px - PIGEON_BUBBLE_W / 2;
    if (bubX < safeLeft) bubX = safeLeft;
    if (bubX + PIGEON_BUBBLE_W > safeRight) bubX = safeRight - PIGEON_BUBBLE_W;
    const tailX = Math.max(TAIL_HALF * 2, Math.min(PIGEON_BUBBLE_W - TAIL_HALF * 2, w.px - bubX));
    return { bubX, bubY, tailX, tailBelow };
  });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: layout.value.bubX }, { translateY: layout.value.bubY }],
  }));
  const tailStyle = useAnimatedStyle(() => {
    const left = layout.value.tailX - TAIL_HALF;
    return layout.value.tailBelow
      ? { left, top: -TAIL_HALF, bottom: undefined, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 3, borderTopWidth: 3 }
      : { left, bottom: -TAIL_HALF, top: undefined, borderRightWidth: 3, borderBottomWidth: 3, borderLeftWidth: 0, borderTopWidth: 0 };
  });

  return (
    <Animated.View style={[styles.abs, hkStyles.bubble, { width: PIGEON_BUBBLE_W }, bubbleStyle]} pointerEvents="none" testID="roadman-script-bubble">
      <View onLayout={(e) => { bubbleH.value = e.nativeEvent.layout.height; }}>
        <Text key={textKey} style={hkStyles.bubbleTxt} testID="roadman-script-text">{text}</Text>
      </View>
      <Animated.View style={[hkStyles.bubbleTail, tailStyle]} />
    </Animated.View>
  );
}

/* "SKINNY AGAIN!" toast — flashes on Skinny Jab pickup, then fades. */
export function SkinnyToast() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });
  }, []);
  const st = useAnimatedStyle(() => {
    const inA = Math.min(p.value / 0.14, 1);
    const outA = p.value < 0.6 ? 1 : 1 - (p.value - 0.6) / 0.4;
    return {
      opacity: Math.max(0, Math.min(inA, outA)),
      transform: [{ translateY: -p.value * 46 }, { scale: 0.6 + inA * 0.7 }, { rotate: `${(p.value - 0.5) * 10}deg` }],
    };
  });
  return (
    <View pointerEvents="none" style={skinnyStyles.host}>
      <Animated.Text style={[skinnyStyles.txt, st]}>SKINNY AGAIN!</Animated.Text>
    </View>
  );
}

const skinnyStyles = StyleSheet.create({
  host: { position: 'absolute', top: '32%', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  txt: {
    fontFamily: FONT,
    color: '#7ef0c0',
    fontWeight: '900',
    fontSize: 34,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 4,
  },
});

/* ---------------- Obstacle ---------------- */
// Each side (top/bottom) renders EXACTLY what the engine used for collision:
// FAMILIES.BUILDING keeps the classic full-rect cartoon building (unchanged
// hitbox); every other family (or null = open sky) draws the cached
// segment/decor list (`geom.topGeo` / `geom.bottomGeo`) built once by the
// engine — so the visible silhouette and the hitbox can never drift apart.
export function ObstacleView({ world, index, geom, theme, screenH }) {
  useEffect(() => {
    if (DEV) DEV_MOUNT_STATS.obstacleView++;
  }, []);
  const style = useAnimatedStyle(() => {
    const o = world.value.obs[index];
    return {
      opacity: o && o.active ? 1 : 0,
      transform: [{ translateX: o ? o.x : -999 }],
    };
  });
  const groundY = screenH - CONFIG.GROUND_H;
  const topH = geom.topH;
  const bottomY = topH + geom.gap;
  const bottomH = Math.max(0, groundY - bottomY);
  const topIsBuilding = geom.topFamily === FAMILIES.BUILDING;
  const bottomIsBuilding = geom.bottomFamily === FAMILIES.BUILDING;
  // Both possible silhouettes (Building AND StructureShape) are ALWAYS mounted
  // for BOTH sides, for the lifetime of this pool slot. Recycling a slot
  // between families (e.g. BUILDING <-> HANGING) only ever toggles
  // height/opacity here — it can never unmount/mount this subtree, which was
  // the actual cause of the visible spawn-time hitch (the earlier lookahead-
  // distance fix alone did not touch this).
  return (
    <Animated.View style={[styles.abs, { left: 0, top: 0, width: OW }, style]} pointerEvents="none">
      <View style={{ position: 'absolute', top: 0, height: topH, width: OW, opacity: topIsBuilding ? 1 : 0 }} pointerEvents="none">
        <Building height={topIsBuilding ? topH : 0} theme={theme} seed={geom.seed} flip />
      </View>
      <View style={{ position: 'absolute', top: 0, height: topH, width: OW, opacity: topIsBuilding ? 0 : 1 }} pointerEvents="none">
        <StructureShape geo={geom.topGeo || EMPTY_GEO} boxW={OW} boxH={topH} />
      </View>
      <View style={{ position: 'absolute', top: bottomY, height: bottomH, width: OW, opacity: bottomIsBuilding ? 1 : 0 }} pointerEvents="none">
        <Building height={bottomIsBuilding ? bottomH : 0} theme={theme} seed={geom.seed} ground />
      </View>
      <View style={{ position: 'absolute', top: bottomY, height: bottomH, width: OW, opacity: bottomIsBuilding ? 0 : 1 }} pointerEvents="none">
        <StructureShape geo={geom.bottomGeo || EMPTY_GEO} boxW={OW} boxH={bottomH} />
      </View>
    </Animated.View>
  );
}

// Procedurally varied cartoon building. Collision is unchanged (fixed OW column);
// everything here is decorative and never intercepts touches.
function Building({ height, theme, seed, flip, ground }) {
  useEffect(() => {
    if (DEV) DEV_MOUNT_STATS.building++;
  }, []);
  const cfg = useMemo(() => {
    const r = rngFrom((seed || 1) + (flip ? 7777 : 13));
    const bricks = theme.brickPalette && theme.brickPalette.length ? theme.brickPalette : [theme.obstacle];
    const base = bricks[Math.floor(r() * bricks.length)] || theme.obstacle;
    const bodyF = 0.9 + r() * 0.2;
    const body = shade(base, bodyF);
    const border = shade(base, bodyF * 0.66);
    const roofs = theme.roofPalette && theme.roofPalette.length ? theme.roofPalette : [border];
    const roofColor = roofs[Math.floor(r() * roofs.length)] || border;
    const doors = theme.doorPalette && theme.doorPalette.length ? theme.doorPalette : [shade(base, 0.5)];
    const doorColor = doors[Math.floor(r() * doors.length)] || shade(base, 0.5);
    const type = Math.floor(r() * 5); // 0 residential 1 rundown 2 commercial 3 pub 4 office
    const cols = type === 2 || type === 3 ? 1 : r() > 0.35 ? 2 : 1;
    const roof = Math.floor(r() * 3); // 0 flat bar, 1 parapet, 2 pitched
    const chimneys = type === 0 || type === 1 ? Math.floor(r() * 3) : 0;
    const antenna = r() > 0.6;
    const drainpipe = r() > 0.45 ? (r() > 0.5 ? 'left' : 'right') : null;
    const balcony = type === 0 && r() > 0.55;
    const front = ground ? (type === 3 ? 'pub' : type === 2 ? 'shop' : 'door') : null;
    const litSeed = r();
    return { body, border, roofColor, doorColor, type, cols, roof, chimneys, antenna, drainpipe, balcony, front, litSeed };
  }, [seed, flip, ground, theme]);

  const rows = useMemo(() => {
    const usable = height - 30 - (ground ? 20 : 0);
    const n = Math.max(0, Math.floor(usable / 30));
    return Array.from({ length: n });
  }, [height, ground]);

  if (height <= 0) return null;
  const edgeStyle = flip ? { bottom: -3 } : { top: -3 };
  const accent = theme.accent;
  const showWindows = true;

  return (
    <View style={[obStyles.col, { height, backgroundColor: cfg.body, borderColor: cfg.border }]}>
      {/* roof / parapet on the gap-facing edge */}
      <Roof roof={cfg.roof} flip={flip} color={cfg.roofColor} />
      <View style={[obStyles.edgeDeco, edgeStyle]} pointerEvents="none">
        {Array.from({ length: cfg.chimneys }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 12 + i * 22,
              [flip ? 'top' : 'bottom']: 2,
              width: 12,
              height: 16,
              backgroundColor: cfg.border,
              borderRadius: 2,
            }}
          />
        ))}
        {cfg.antenna && (
          <View
            style={{
              position: 'absolute',
              right: 14,
              [flip ? 'top' : 'bottom']: 2,
              width: 2,
              height: 20,
              backgroundColor: cfg.border,
            }}
          />
        )}
      </View>

      {/* drainpipe */}
      {cfg.drainpipe && (
        <View
          style={{
            position: 'absolute',
            [cfg.drainpipe]: 4,
            top: 8,
            bottom: 8,
            width: 3,
            backgroundColor: cfg.border,
            opacity: 0.8,
          }}
        />
      )}

      {/* windows */}
      {showWindows && (
      <View style={[obStyles.windows, ground && { justifyContent: 'flex-start' }]}>
        {rows.map((_, i) => (
          <View key={i} style={[obStyles.winRow, { gap: cfg.cols === 2 ? 8 : 0 }]}>
            {Array.from({ length: cfg.cols }).map((_, c) => {
              const lit = ((i * 3 + c * 7 + Math.floor(cfg.litSeed * 100)) % 5) < 2;
              return (
                <View
                  key={c}
                  style={[
                    obStyles.win,
                    cfg.cols === 1 && { width: 26 },
                    { backgroundColor: lit ? theme.window : cfg.border, borderColor: cfg.border },
                    cfg.balcony && i === 0 && { borderBottomWidth: 3, borderBottomColor: accent },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      )}

      {/* street-level shop / pub / door on the ground building */}
      {cfg.front && (
        <View style={obStyles.front} pointerEvents="none">
          {cfg.front !== 'door' && (
            <View style={[obStyles.sign, { backgroundColor: accent }]}>
              <View style={obStyles.signDot} />
              <View style={obStyles.signDot} />
              <View style={obStyles.signDot} />
            </View>
          )}
          <View style={[obStyles.door, { backgroundColor: cfg.doorColor }]} />
        </View>
      )}
    </View>
  );
}

// Renders a non-BUILDING obstacle side from the engine's cached { segments,
// decor } — the exact same list the engine hit-tests against. `segments` are
// real solid pieces (pole/arm/mast/jib/plank/trunk/canopy/beam/cable/sign);
// `decor` (cross-braces, rivets, base plates) is drawn but never collidable.
// The SVG canvas grows to the geometry's own bounding box so pieces that
// genuinely project outside the OW lane (a crane jib, a hanging beam) are
// never clipped — nothing here is a rectangular wrapper standing in for the
// real silhouette.
function segBounds(seg) {
  if (seg.type === 'rect') return { x0: seg.x, y0: seg.y, x1: seg.x + seg.w, y1: seg.y + seg.h };
  const half = (seg.t || 4) / 2;
  return {
    x0: Math.min(seg.x1, seg.x2) - half,
    y0: Math.min(seg.y1, seg.y2) - half,
    x1: Math.max(seg.x1, seg.x2) + half,
    y1: Math.max(seg.y1, seg.y2) + half,
  };
}

function StructureShape({ geo, boxW, boxH }) {
  useEffect(() => {
    if (DEV) DEV_MOUNT_STATS.structureShape++;
  }, []);
  const box = useMemo(() => {
    let minX = 0, minY = 0, maxX = boxW, maxY = boxH;
    for (const seg of [...geo.segments, ...(geo.decor || [])]) {
      const b = segBounds(seg);
      minX = Math.min(minX, b.x0); maxX = Math.max(maxX, b.x1);
      minY = Math.min(minY, b.y0); maxY = Math.max(maxY, b.y1);
    }
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }, [geo, boxW, boxH]);
  return (
    <View style={{ position: 'absolute', left: box.minX, top: box.minY, width: box.w, height: box.h }} pointerEvents="none">
      <Svg width={box.w} height={box.h} viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}>
        {(geo.decor || []).map((seg, i) => <ShapePiece key={`d${i}`} seg={seg} muted />)}
        {geo.segments.map((seg, i) => <ShapePiece key={`s${i}`} seg={seg} />)}
      </Svg>
    </View>
  );
}

function ShapePiece({ seg, muted }) {
  const opacity = muted ? 0.55 : 1;
  if (seg.type === 'rect') {
    return (
      <SvgRect
        x={seg.x} y={seg.y} width={seg.w} height={seg.h} rx={seg.radius || 0}
        fill={seg.fill || '#888'} stroke={seg.stroke || 'transparent'} strokeWidth={seg.strokeW || 0}
        opacity={opacity}
      />
    );
  }
  if (seg.x1 === seg.x2 && seg.y1 === seg.y2) {
    return (
      <Circle
        cx={seg.x1} cy={seg.y1} r={(seg.t || 8) / 2}
        fill={seg.fill || seg.stroke || '#888'} stroke={seg.stroke || 'transparent'} strokeWidth={seg.strokeW || 0}
        opacity={opacity}
      />
    );
  }
  return (
    <Line
      x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
      stroke={seg.stroke || seg.fill || '#888'} strokeWidth={seg.t || 3} strokeLinecap="round"
      opacity={opacity}
    />
  );
}

function Roof({ roof, flip, color }) {
  if (roof === 2) {
    // pitched triangle pointing away from the building body (toward the gap)
    const tri = flip
      ? { borderTopWidth: 13, borderTopColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent' }
      : { borderBottomWidth: 13, borderBottomColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
    return (
      <View
        style={[
          obStyles.roofWrap,
          flip ? { bottom: -12 } : { top: -12 },
          { width: 0, height: 0, borderLeftWidth: OW / 2, borderRightWidth: OW / 2, alignSelf: 'center' },
          tri,
        ]}
        pointerEvents="none"
      />
    );
  }
  if (roof === 1) {
    // parapet: bar with two notches
    return (
      <View style={[obStyles.roofBar, flip ? { bottom: -4 } : { top: -4 }, { backgroundColor: color }]} pointerEvents="none">
        <View style={[obStyles.notch, { backgroundColor: color }]} />
        <View style={[obStyles.notch, { backgroundColor: color }]} />
        <View style={[obStyles.notch, { backgroundColor: color }]} />
      </View>
    );
  }
  // flat cap
  return <View style={[obStyles.cap, flip ? { bottom: -4 } : { top: -4 }, { backgroundColor: color }]} pointerEvents="none" />;
}

/* ---------------- Chip (golden potato crisp) ---------------- */
export function ChipView({ world, index }) {
  const S = CONFIG.CHIP_SIZE;
  const style = useAnimatedStyle(() => {
    const c = world.value.chips[index];
    if (!c || !c.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const t = world.value.t || 0;
    const phase = index * 1.7;
    const wobble = Math.sin(t / 260 + phase) * 10; // gentle rotation
    const bob = Math.sin(t / 300 + phase) * 2; // gentle bob
    const scale = c.eaten ? 1 + c.anim * 1.4 : 1;
    const opacity = c.eaten ? 1 - c.anim : 1;
    return {
      opacity,
      transform: [
        { translateX: c.x - S / 2 },
        { translateY: c.y - S / 2 + bob },
        { rotate: `${wobble}deg` },
        { scale },
      ],
    };
  });
  // shimmer highlight pulses subtly
  const shimmer = useAnimatedStyle(() => {
    const t = world.value.t || 0;
    return { opacity: 0.55 + 0.35 * Math.abs(Math.sin(t / 220 + index)) };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <Svg width={S} height={S} viewBox="0 0 32 32">
        {/* soft contrast halo so the crisp stays visible on bright/busy skies */}
        <Circle cx="16" cy="16" r="15" fill="rgba(35,22,5,0.16)" />
        {/* irregular curved potato-crisp body */}
        <Path
          d="M6.5 15 C4 8 10 4.5 15 4.5 C20.5 4.5 27 7 27.5 13 C28 18 25 22 21 25 C17 28 10.5 27.5 8 23 C6 19.5 7.5 17 6.5 15 Z"
          fill="#f2b83a"
          stroke="#a86a12"
          strokeWidth="1.7"
        />
        {/* darker toasted patches for texture */}
        <Path d="M11 19 C13 21 17 21 19 19" stroke="#d99a24" strokeWidth="1.2" fill="none" opacity="0.7" />
        <Circle cx="12" cy="12" r="1.1" fill="#c9861a" opacity="0.55" />
        <Circle cx="20" cy="16" r="1" fill="#c9861a" opacity="0.5" />
        <Circle cx="16" cy="22" r="0.9" fill="#c9861a" opacity="0.5" />
      </Svg>
      {/* shimmer highlight */}
      <Animated.View style={[chipStyles.shine, shimmer]} pointerEvents="none" />
    </Animated.View>
  );
}

/* ---------------- Skinny Jab (rare fatness-reset pickup) ---------------- */
export function JabView({ world }) {
  const S = CONFIG.SKINNY_JAB_SIZE;
  const style = useAnimatedStyle(() => {
    const j = world.value.jab;
    if (!j || !j.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const t = world.value.t || 0;
    const bob = Math.sin(t / 280) * 3;
    const rot = Math.sin(t / 420) * 14 - 20;
    return {
      opacity: 1,
      transform: [{ translateX: j.x - S / 2 }, { translateY: j.y - S / 2 + bob }, { rotate: `${rot}deg` }],
    };
  });
  const sparkle = useAnimatedStyle(() => {
    const t = world.value.t || 0;
    return { opacity: 0.4 + 0.6 * Math.abs(Math.sin(t / 180)) };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <Svg width={S} height={S} viewBox="0 0 40 40">
        {/* glow halo so the rare pickup pops */}
        <Circle cx="20" cy="20" r="18" fill="rgba(80,220,200,0.18)" />
        {/* syringe barrel (diagonal), generic & cartoonish */}
        <G>
          <Line x1="9" y1="31" x2="27" y2="13" stroke="#dff6f1" strokeWidth="9" strokeLinecap="round" />
          <Line x1="9" y1="31" x2="27" y2="13" stroke="#9fe6db" strokeWidth="5" strokeLinecap="round" />
          {/* teal fluid */}
          <Line x1="12" y1="28" x2="22" y2="18" stroke="#2fd6b6" strokeWidth="4.4" strokeLinecap="round" />
          {/* plunger flange + rod */}
          <Line x1="5.5" y1="27" x2="12" y2="34" stroke="#cfeee9" strokeWidth="3.4" strokeLinecap="round" />
          <Line x1="3" y1="33" x2="9.5" y2="39.5" stroke="#8fd8cc" strokeWidth="3" strokeLinecap="round" />
          {/* needle */}
          <Line x1="27" y1="13" x2="35" y2="5" stroke="#b7c4c2" strokeWidth="2" strokeLinecap="round" />
          <Line x1="24" y1="16" x2="30" y2="10" stroke="#eef7f5" strokeWidth="5.2" strokeLinecap="round" />
        </G>
      </Svg>
      {/* rare-item sparkle */}
      <Animated.View style={[jabStyles.sparkle, sparkle]} pointerEvents="none" />
    </Animated.View>
  );
}

const jabStyles = StyleSheet.create({
  sparkle: { position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
});

/* ---------------- Pub Pint (collectible drunk boost) ---------------- */
export function PintView({ world }) {
  const S = CONFIG.PINT_SIZE;
  const style = useAnimatedStyle(() => {
    const pt = world.value.pint;
    if (!pt || !pt.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const t = world.value.t || 0;
    const bob = Math.sin(t / 260) * 3;
    const rot = Math.sin(t / 500) * 10;
    return {
      opacity: 1,
      transform: [{ translateX: pt.x - S / 2 }, { translateY: pt.y - S / 2 + bob }, { rotate: `${rot}deg` }],
    };
  });
  const foam = useAnimatedStyle(() => {
    const t = world.value.t || 0;
    return { opacity: 0.5 + 0.5 * Math.abs(Math.sin(t / 200)) };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <Svg width={S} height={S} viewBox="0 0 40 40">
        {/* glow halo */}
        <Circle cx="20" cy="21" r="18" fill="rgba(255,196,0,0.16)" />
        {/* glass mug */}
        <SvgRect x="9" y="12" width="17" height="23" rx="2.5" fill="rgba(255,224,130,0.55)" stroke="#e8b53a" strokeWidth="1.6" />
        {/* amber beer */}
        <SvgRect x="10.5" y="18" width="14" height="15.5" rx="2" fill="#f2a71b" />
        {/* handle */}
        <Path d="M 26 16 q 8 1 8 8 q 0 7 -8 7" fill="none" stroke="#e8b53a" strokeWidth="2.4" />
        {/* foam head */}
        <Circle cx="13" cy="13" r="4.4" fill="#fffdf3" />
        <Circle cx="18.5" cy="11.5" r="4.8" fill="#fffdf3" />
        <Circle cx="23.5" cy="13" r="4.2" fill="#fffdf3" />
      </Svg>
      <Animated.View style={[jabStyles.sparkle, { backgroundColor: '#fffdf3' }, foam]} pointerEvents="none" />
    </Animated.View>
  );
}

/* -------- Drunk screen soft-focus (gameplay world only; HUD stays crisp) --------
   Fair by design: this NEVER moves the world (no camera tilt/translate) so on-screen
   obstacle positions always match their hitboxes. It only breathes a soft-focus haze
   + (web) a light backdrop blur, scaling with the Drunkness level (0..~1.4 with Pub
   boost). Rendered BELOW the HUD so distance/chips/buttons remain sharp. */
export function DrunkScreenFX({ level = 0 }) {
  const lv = Math.max(0, Math.min(1.4, level));
  const focus = useSharedValue(0);
  useEffect(() => {
    focus.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(focus);
  }, []);
  const style = useAnimatedStyle(() => {
    if (lv <= 0.02) return { opacity: 0 };
    // irregular breathing: two sines so it never feels like a clean loop
    const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(focus.value * Math.PI * 2 + Math.sin(focus.value * 7)));
    const opacity = Math.min(0.2, lv * (0.05 + breathe * 0.09));
    const blurPx = Platform.OS === 'web' ? lv * (0.7 + breathe * 1.4) : 0; // max ~ 2.9px @ boosted
    const web = Platform.OS === 'web' ? { backdropFilter: `blur(${blurPx}px)`, WebkitBackdropFilter: `blur(${blurPx}px)` } : {};
    return { opacity: 1, ...web, backgroundColor: `rgba(245,240,255,${opacity})` };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} testID="drunk-screen-fx" />;
}


/* ---------------- Feather ---------------- */
export function FeatherView({ world, index, color }) {
  const style = useAnimatedStyle(() => {
    const f = world.value.feathers[index];
    if (!f || !f.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    return {
      opacity: Math.max(0, Math.min(1, f.life)),
      transform: [{ translateX: f.x }, { translateY: f.y }, { rotate: `${f.rot}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.abs, style]} pointerEvents="none">
      <View style={[featherStyles.f, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/* ---------------- Window heckler (person clipped inside a window) ---------------- */
// The speech bubble is positioned/sized independently of the anchor window so it can
// flip above/below and slide horizontally to stay fully inside the visible viewport
// (including the top safe-area inset on notch/Dynamic-Island devices) — its own real
// measured height (text can wrap to any number of lines) drives the containment math,
// never a text-shrinking fallback.
const BUBBLE_W = 168;
const PIGEON_BUBBLE_W = 176;
const BUBBLE_MARGIN = 10; // safe margin kept from every screen edge
const BUBBLE_GAP = 8;     // gap kept between the bubble and its window anchor
const TAIL_HALF = 7;

export function HecklerView({ world, text, reaction, theme, screenW = 400, screenH = 800, topInset = 0 }) {
  const WIN = 36;
  const bubbleH = useSharedValue(48); // corrected on layout once the real (wrapped) text height is known

  const layout = useDerivedValue(() => {
    const h = world.value.heckler;
    if (!h || !h.active) {
      return { op: 0, winX: -999, winY: -999, bubX: -999, bubY: -999, tailX: BUBBLE_W / 2, tailBelow: 0 };
    }
    const op = h.life > 0.35 ? 1 : Math.max(0, h.life / 0.35);
    const winX = h.x - WIN / 2;
    const winY = h.y - WIN / 2;
    const bh = bubbleH.value;
    const safeTop = topInset + BUBBLE_MARGIN;
    const safeBottom = screenH - BUBBLE_MARGIN;
    const safeLeft = BUBBLE_MARGIN;
    const safeRight = screenW - BUBBLE_MARGIN;

    // Prefer above the window (classic speech-bubble placement); flip below it
    // when there isn't enough safe-area room above (e.g. window near the top
    // of the screen, behind a notch/Dynamic Island).
    let bubY = winY - BUBBLE_GAP - bh;
    let tailBelow = 0; // 0 = tail points down at the window (bubble above it)
    if (bubY < safeTop) {
      bubY = winY + WIN + BUBBLE_GAP;
      tailBelow = 1; // tail points up at the window (bubble below it)
      if (bubY + bh > safeBottom) bubY = Math.max(safeTop, safeBottom - bh);
    }

    let bubX = h.x - BUBBLE_W / 2;
    if (bubX < safeLeft) bubX = safeLeft;
    if (bubX + BUBBLE_W > safeRight) bubX = safeRight - BUBBLE_W;

    // Tail stays aimed at the actual window x position even after the bubble
    // itself was shifted inward to stay on-screen.
    const tailX = Math.max(TAIL_HALF * 2, Math.min(BUBBLE_W - TAIL_HALF * 2, h.x - bubX));

    return { op, winX, winY, bubX, bubY, tailX, tailBelow };
  });

  const winStyle = useAnimatedStyle(() => ({
    opacity: layout.value.op,
    transform: [{ translateX: layout.value.winX }, { translateY: layout.value.winY }],
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: layout.value.op,
    transform: [{ translateX: layout.value.bubX }, { translateY: layout.value.bubY }],
  }));

  const tailStyle = useAnimatedStyle(() => {
    const left = layout.value.tailX - TAIL_HALF;
    return layout.value.tailBelow
      ? { left, top: -TAIL_HALF, bottom: undefined, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 3, borderTopWidth: 3 }
      : { left, bottom: -TAIL_HALF, top: undefined, borderRightWidth: 3, borderBottomWidth: 3, borderLeftWidth: 0, borderTopWidth: 0 };
  });

  return (
    <React.Fragment>
      {/* speech bubble — positioned independently so it can flip/slide to stay on-screen */}
      <Animated.View style={[styles.abs, hkStyles.bubble, { width: BUBBLE_W }, bubbleStyle]} pointerEvents="none" testID="heckler-bubble">
        <View onLayout={(e) => { bubbleH.value = e.nativeEvent.layout.height; }}>
          <Text style={hkStyles.bubbleTxt} testID="heckler-insult">{text}</Text>
        </View>
        <Animated.View style={[hkStyles.bubbleTail, tailStyle]} />
      </Animated.View>
      {/* window opening clips the person's body (lower body hidden behind wall) */}
      <Animated.View style={[styles.abs, { width: WIN, height: WIN }, winStyle]} pointerEvents="none" testID="heckler">
        <View style={[hkStyles.window, { width: WIN, height: WIN, backgroundColor: theme.window, borderColor: theme.obstacleDark }]}>
          <WindowPerson reaction={reaction} theme={theme} win={WIN} />
        </View>
      </Animated.View>
    </React.Fragment>
  );
}

function WindowPerson({ reaction, theme }) {
  const skin = '#f3c9a0';
  const cloth = theme.accent;
  // Drawn taller than the window; the parent window View clips the lower body.
  return (
    <Svg width={36} height={54} viewBox="0 0 36 54" style={{ position: 'absolute', top: 4, left: 0 }}>
      {/* body/shoulders (extends below the window, gets clipped) */}
      <SvgRect x="7" y="24" width="22" height="30" rx="6" fill={cloth} />
      {/* head */}
      <Circle cx="18" cy="15" r="9" fill={skin} />
      <Circle cx="14.5" cy="14" r="1.5" fill="#20232b" />
      <Circle cx="21.5" cy="14" r="1.5" fill="#20232b" />
      {reaction === 'horrified' ? (
        <Circle cx="18" cy="19" r="2.4" fill="#20232b" />
      ) : (
        <Path d="M14.5 19 Q18 17 21.5 19" stroke="#20232b" strokeWidth="1.7" fill="none" />
      )}
      {/* angry brows */}
      <Line x1="12" y1="11" x2="16.5" y2="12.4" stroke="#20232b" strokeWidth="1.6" />
      <Line x1="24" y1="11" x2="19.5" y2="12.4" stroke="#20232b" strokeWidth="1.6" />
      {/* reaction arm / prop */}
      {reaction === 'fist' && (
        <G>
          <Line x1="26" y1="30" x2="31" y2="20" stroke={skin} strokeWidth="3.2" />
          <Circle cx="32" cy="18" r="4" fill={skin} />
        </G>
      )}
      {reaction === 'wave' && (
        <G>
          <Line x1="26" y1="30" x2="30" y2="18" stroke={skin} strokeWidth="3.2" />
          <Circle cx="31" cy="16" r="3.4" fill={skin} />
        </G>
      )}
      {reaction === 'point' && (
        <G>
          <Line x1="10" y1="30" x2="2" y2="24" stroke={skin} strokeWidth="3.2" />
          <Circle cx="1.5" cy="24" r="3" fill={skin} />
        </G>
      )}
      {reaction === 'mug' && <SvgRect x="25" y="28" width="8" height="9" rx="1.6" fill="#ffffff" stroke={theme.obstacleDark} strokeWidth="1.6" />}
      {reaction === 'newspaper' && <SvgRect x="22" y="28" width="13" height="10" rx="1" fill="#ffffff" stroke={theme.obstacleDark} strokeWidth="1" />}
      {reaction === 'confused' && (
        <G>
          <Line x1="26" y1="28" x2="26" y2="14" stroke={skin} strokeWidth="3.2" />
          <Circle cx="26" cy="12" r="3" fill={skin} />
        </G>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});

const hkStyles = StyleSheet.create({
  window: {
    borderRadius: 5,
    borderWidth: 3,
    overflow: 'hidden',
  },
  bubble: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#20232b',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  bubbleTxt: { fontFamily: FONT, color: '#20232b', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  bubbleTail: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
    borderColor: '#20232b',
    transform: [{ rotate: '45deg' }],
  },
});

const obStyles = StyleSheet.create({
  col: {
    width: OW,
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cap: { position: 'absolute', left: 0, width: OW, height: 10, borderRadius: 4 },
  roofBar: { position: 'absolute', left: 0, width: OW, height: 9, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  notch: { width: 8, height: 6, marginTop: -4 },
  roofWrap: { position: 'absolute' },
  edgeDeco: { position: 'absolute', left: 0, width: OW, height: 22 },
  windows: { marginTop: 16, gap: 10, alignItems: 'center' },
  winRow: { flexDirection: 'row' },
  win: { width: 14, height: 15, borderRadius: 2, borderWidth: 1, opacity: 0.95 },
  front: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  sign: { width: OW - 18, height: 12, borderRadius: 3, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  signDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.5)' },
  door: { width: 20, height: 18, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
});

const chipStyles = StyleSheet.create({
  shine: {
    position: 'absolute',
    top: '26%',
    left: '30%',
    width: 7,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#fff4c4',
  },
});

const featherStyles = StyleSheet.create({
  f: { width: 14, height: 8, borderRadius: 6, opacity: 0.95 },
});
