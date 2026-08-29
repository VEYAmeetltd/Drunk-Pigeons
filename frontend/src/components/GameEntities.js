import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Rect as SvgRect, Line, G, Path } from 'react-native-svg';
import PigeonSprite from './PigeonSprite';
import { CONFIG, pigeonSizeFor } from '../config';
import { FONT } from '../ui/theme';

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
export function PigeonView({ world, pigeon, fatLevel }) {
  const size = pigeonSizeFor(fatLevel);
  const style = useAnimatedStyle(() => {
    const w = world.value;
    const t = w.t || 0;
    const wobble = Math.sin(t / 170) * (3 + fatLevel) + Math.sin(t / 91) * 1.5;
    const bob = Math.sin(t / 150) * 2;
    const rot = w.tilt + wobble;
    const squashY = 1 - w.flap * 0.16;
    const squashX = 1 + w.flap * 0.12;
    let opacity = 1;
    if (w.dead) opacity = 0;
    else if (w.inv) opacity = 0.45 + 0.45 * Math.abs(Math.sin(t / 70));
    return {
      opacity,
      transform: [
        { translateX: w.px - size / 2 },
        { translateY: w.py - size / 2 + bob },
        { rotate: `${rot}deg` },
        { scaleX: squashX },
        { scaleY: squashY },
      ],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width: size, height: size }, style]} pointerEvents="none">
      <PigeonSprite pigeon={pigeon} fatLevel={fatLevel} size={size} />
    </Animated.View>
  );
}

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
  return (
    <Animated.View style={[styles.abs, { left: 0, top: 0, width: OW }, style]} pointerEvents="none">
      <Building height={topH} theme={theme} seed={geom.seed} flip />
      <View style={{ position: 'absolute', top: bottomY, height: bottomH, width: OW }}>
        <Building height={bottomH} theme={theme} seed={geom.seed} ground />
      </View>
    </Animated.View>
  );
}

// Procedurally varied cartoon building. Collision is unchanged (fixed OW column);
// everything here is decorative and never intercepts touches.
function Building({ height, theme, seed, flip, ground }) {
  const cfg = useMemo(() => {
    const r = rngFrom((seed || 1) + (flip ? 7777 : 13));
    const bodyF = 0.82 + r() * 0.36;
    const body = shade(theme.obstacle, bodyF);
    const border = shade(theme.obstacle, bodyF * 0.68);
    const type = Math.floor(r() * 5); // 0 residential 1 rundown 2 commercial 3 pub 4 office
    const cols = type === 2 || type === 3 ? 1 : r() > 0.35 ? 2 : 1;
    const roof = Math.floor(r() * 3); // 0 flat bar, 1 parapet, 2 pitched
    const chimneys = type === 0 || type === 1 ? Math.floor(r() * 3) : 0;
    const antenna = r() > 0.6;
    const drainpipe = r() > 0.45 ? (r() > 0.5 ? 'left' : 'right') : null;
    const balcony = type === 0 && r() > 0.55;
    const front = ground ? (type === 3 ? 'pub' : type === 2 ? 'shop' : 'door') : null;
    const litSeed = r();
    return { body, border, type, cols, roof, chimneys, antenna, drainpipe, balcony, front, litSeed };
  }, [seed, flip, ground, theme]);

  const rows = useMemo(() => {
    const usable = height - 30 - (ground ? 20 : 0);
    const n = Math.max(0, Math.floor(usable / 30));
    return Array.from({ length: n });
  }, [height, ground]);

  if (height <= 0) return null;
  const edgeStyle = flip ? { bottom: -3 } : { top: -3 };
  const accent = theme.accent;

  return (
    <View style={[obStyles.col, { height, backgroundColor: cfg.body, borderColor: cfg.border }]}>
      {/* roof / parapet on the gap-facing edge */}
      <Roof roof={cfg.roof} flip={flip} color={cfg.border} />
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
          <View style={[obStyles.door, { backgroundColor: shade(theme.obstacle, 0.5) }]} />
        </View>
      )}
    </View>
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
        {/* irregular curved potato-crisp body */}
        <Path
          d="M6.5 15 C4 8 10 4.5 15 4.5 C20.5 4.5 27 7 27.5 13 C28 18 25 22 21 25 C17 28 10.5 27.5 8 23 C6 19.5 7.5 17 6.5 15 Z"
          fill="#f2b83a"
          stroke="#c9861a"
          strokeWidth="1.4"
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
