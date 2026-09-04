import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import Svg, { Circle, Rect as SvgRect, Line, G, Path } from 'react-native-svg';
import DrunkPigeon from './DrunkPigeon';
import { CONFIG, pigeonSizeFor } from '../config';
import { FONT } from '../ui/theme';
import { familyForObstacle, variantFor, FAMILIES } from '../game/obstacleAppearance';

const OW = CONFIG.OBSTACLE_WIDTH;

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
export function PigeonView({ world, pigeon, fatLevel, boost = false, strength = 1, deflateSignal = 0 }) {
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
      <DrunkPigeon pigeon={pigeon} fatLevel={fatLevel} size={size} intensity="full" eyes boost={boost} strength={strength} sound deflateSignal={deflateSignal} testID="game-pigeon" />
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
export function ObstacleView({ world, index, geom, theme, screenH }) {
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
  const family = familyForObstacle(geom.spawnIndex, theme.id);
  return (
    <Animated.View style={[styles.abs, { left: 0, top: 0, width: OW }, style]} pointerEvents="none">
      <Building height={topH} theme={theme} seed={geom.seed} family={family} flip />
      <View style={{ position: 'absolute', top: bottomY, height: bottomH, width: OW }}>
        <Building height={bottomH} theme={theme} seed={geom.seed} family={family} ground />
      </View>
    </Animated.View>
  );
}

// Procedurally varied cartoon building. Collision is unchanged (fixed OW column);
// everything here is decorative and never intercepts touches.
function Building({ height, theme, seed, flip, ground, family = FAMILIES.BUILDING }) {
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
  const gapEdge = flip ? 'bottom' : 'top'; // edge facing the navigable gap
  const anchorEdge = flip ? 'top' : 'bottom'; // edge anchored to screen edge (safe for extensions)
  // Families with heavy bespoke art hide the default window grid to avoid clutter.
  const showWindows = family === FAMILIES.BUILDING || family === FAMILIES.BUNTING
    || family === FAMILIES.ROOFTOP || family === FAMILIES.BILLBOARD;

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

      {/* family appearance overlay — confined to the column rect, never solid */}
      <FamilyDecor
        family={family}
        height={height}
        theme={theme}
        seed={seed}
        gapEdge={gapEdge}
        anchorEdge={anchorEdge}
      />

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

// Purely decorative per-family art. Everything is absolutely positioned INSIDE the
// column rect (0..height x 0..OW) so it can never alter collision or block the gap.
function FamilyDecor({ family, height, theme, seed, gapEdge, anchorEdge }) {
  const v = variantFor(seed);
  const accent = theme.accent;
  const metal = '#9aa3ad';
  const dark = theme.obstacleDark || '#333';
  if (family === FAMILIES.SCAFFOLD) {
    const planks = Math.max(1, Math.floor(height / 46));
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 4, backgroundColor: metal, opacity: 0.9 }} />
        <View style={{ position: 'absolute', right: 6, top: 0, bottom: 0, width: 4, backgroundColor: metal, opacity: 0.9 }} />
        <View style={{ position: 'absolute', left: OW / 2 - 2, top: 0, bottom: 0, width: 4, backgroundColor: metal, opacity: 0.7 }} />
        {Array.from({ length: planks }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', left: 4, right: 4, top: 20 + i * 46, height: 6, backgroundColor: '#caa15a', opacity: 0.95 }} />
        ))}
        <View style={{ position: 'absolute', [gapEdge]: 6, left: 4, width: 6, height: 6, backgroundColor: accent }} />
      </View>
    );
  }
  if (family === FAMILIES.CRANE) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', left: OW / 2 - 3, top: 0, bottom: 0, width: 6, backgroundColor: '#f2c14e' }} />
        {/* jib on the anchored (non-gap) edge — sits in free sky above the route */}
        <View style={{ position: 'absolute', [anchorEdge]: 14, left: 4, right: 4, height: 6, backgroundColor: '#f2c14e' }} />
        <View style={{ position: 'absolute', [anchorEdge]: 20, right: 8, width: 3, height: Math.min(26, height * 0.3), backgroundColor: dark }} />
        <View style={{ position: 'absolute', [anchorEdge]: 20 + Math.min(26, height * 0.3), right: 6, width: 8, height: 6, backgroundColor: dark }} />
      </View>
    );
  }
  if (family === FAMILIES.BILLBOARD) {
    const bh = Math.min(64, Math.max(34, height * 0.4));
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', [gapEdge]: 10, left: 6, right: 6, height: bh, backgroundColor: '#fff', borderWidth: 3, borderColor: accent, borderRadius: 3, justifyContent: 'center', paddingHorizontal: 6 }}>
          <View style={{ height: 5, backgroundColor: accent, marginBottom: 4, width: '80%' }} />
          <View style={{ height: 5, backgroundColor: dark, marginBottom: 4, width: '55%' }} />
          <View style={{ height: 5, backgroundColor: v > 0.5 ? theme.window : accent, width: '70%' }} />
        </View>
        <View style={{ position: 'absolute', [gapEdge]: 0, left: 14, width: 4, height: 12, backgroundColor: dark }} />
        <View style={{ position: 'absolute', [gapEdge]: 0, right: 14, width: 4, height: 12, backgroundColor: dark }} />
      </View>
    );
  }
  if (family === FAMILIES.RAILWAY) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', [gapEdge]: 0, left: 0, right: 0, height: 10, backgroundColor: dark }} />
        <View style={{ position: 'absolute', [gapEdge]: 10, left: 0, right: 0, height: 6, backgroundColor: metal, opacity: 0.85 }} />
        {[0, 1].map((i) => (
          <View key={i} style={{ position: 'absolute', [gapEdge]: 18, left: 8 + i * (OW / 2), width: OW / 2 - 14, height: Math.min(40, height * 0.4), borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: dark, opacity: 0.6 }} />
        ))}
      </View>
    );
  }
  if (family === FAMILIES.ROOFTOP) {
    return (
      <View style={[obStyles.edgeDeco, { [gapEdge]: -2 }]} pointerEvents="none">
        <View style={{ position: 'absolute', [gapEdge]: 4, left: 8, width: 20, height: 18, borderRadius: 4, backgroundColor: '#7d8790' }} />
        <View style={{ position: 'absolute', [gapEdge]: 22, left: 12, width: 12, height: 8, backgroundColor: '#5f676e' }} />
        <View style={{ position: 'absolute', [gapEdge]: 4, right: 10, width: 8, height: 14, backgroundColor: dark, borderRadius: 2 }} />
        <View style={{ position: 'absolute', [gapEdge]: 4, right: 24, width: 8, height: 20, backgroundColor: dark, borderRadius: 2 }} />
      </View>
    );
  }
  if (family === FAMILIES.PARK) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', left: OW / 2 - 5, top: 8, bottom: 8, width: 10, backgroundColor: '#6b4a2b', borderRadius: 4 }} />
        <View style={{ position: 'absolute', [gapEdge]: 6, left: 2, width: OW - 4, height: OW - 4, borderRadius: (OW - 4) / 2, backgroundColor: '#3f9d4a' }} />
        <View style={{ position: 'absolute', [gapEdge]: 2, left: 10, width: OW - 24, height: OW - 24, borderRadius: (OW - 24) / 2, backgroundColor: '#57b562', opacity: 0.9 }} />
      </View>
    );
  }
  if (family === FAMILIES.BUNTING) {
    const n = 5;
    return (
      <View style={{ position: 'absolute', [gapEdge]: 6, left: 4, right: 4, height: 16, flexDirection: 'row', justifyContent: 'space-between' }} pointerEvents="none">
        {Array.from({ length: n }).map((_, i) => (
          <View key={i} style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: i % 2 ? accent : theme.window }} />
        ))}
      </View>
    );
  }
  return null;
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
export function HecklerView({ world, text, reaction, theme }) {
  const WIN = 36;
  const style = useAnimatedStyle(() => {
    const h = world.value.heckler;
    if (!h || !h.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const op = h.life > 0.35 ? 1 : Math.max(0, h.life / 0.35);
    return { opacity: op, transform: [{ translateX: h.x - WIN / 2 }, { translateY: h.y - WIN / 2 }] };
  });
  return (
    <Animated.View style={[styles.abs, { width: WIN, height: WIN }, style]} pointerEvents="none" testID="heckler">
      {/* speech bubble points down to the window */}
      <View style={hkStyles.bubble}>
        <Text style={hkStyles.bubbleTxt} numberOfLines={2} testID="heckler-insult">{text}</Text>
        <View style={hkStyles.bubbleTail} />
      </View>
      {/* window opening clips the person's body (lower body hidden behind wall) */}
      <View style={[hkStyles.window, { width: WIN, height: WIN, backgroundColor: theme.window, borderColor: theme.obstacleDark }]}>
        <WindowPerson reaction={reaction} theme={theme} win={WIN} />
      </View>
    </Animated.View>
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
    position: 'absolute',
    bottom: 44,
    left: -58,
    width: 156,
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
    bottom: -9,
    left: 70,
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
    borderRightWidth: 3,
    borderBottomWidth: 3,
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
