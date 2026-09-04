import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse, Circle, Path, Line, G } from 'react-native-svg';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { CONFIG } from '../config';
import SponsorBillboard from './SponsorBillboard';

// deterministic tiny PRNG so silhouettes/props are stable per mount
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genSkyline(width, seed, minH, maxH, bwMin, bwMax) {
  const rng = mulberry32(seed);
  const items = [];
  let x = 0;
  while (x < width) {
    const w = bwMin + rng() * (bwMax - bwMin);
    const h = minH + rng() * (maxH - minH);
    const lit = rng() > 0.6;
    items.push({ x, w: w - 4, h, lit });
    x += w;
  }
  return items;
}

// Seamless rolling-hill silhouette for EASY MODE.
function hillPath(tileW, height, baseFrac, amp, n1, n2, phase) {
  const base = height * baseFrac;
  const step = Math.max(8, Math.round(tileW / 48));
  const totalW = tileW * 2;
  let d = `M 0 ${height}`;
  for (let x = 0; x <= totalW; x += step) {
    const t = (x % tileW) / tileW;
    const y = base + amp * (0.6 * Math.sin(2 * Math.PI * n1 * t) + 0.4 * Math.sin(2 * Math.PI * n2 * t + phase));
    d += ` L ${x} ${y.toFixed(1)}`;
  }
  d += ` L ${totalW} ${height} Z`;
  return d;
}

function ParallaxLayer({ world, factor, tileW, top, height, children }) {
  const style = useAnimatedStyle(() => {
    const d = (world && world.value && world.value.distPx) || 0;
    return { transform: [{ translateX: -(((d * factor) % tileW) + tileW) % tileW }] };
  });
  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top, width: tileW * 2, height }, style]}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
}

function SkylineSvg({ tileW, height, items, color, windowColor, opacity }) {
  return (
    <Svg width={tileW * 2} height={height} opacity={opacity}>
      {[0, tileW].map((off) =>
        items.map((b, i) => (
          <React.Fragment key={`${off}-${i}`}>
            <Rect x={off + b.x} y={height - b.h} width={b.w} height={b.h} rx={2} fill={color} />
            {b.lit && (
              <Rect x={off + b.x + b.w * 0.3} y={height - b.h + 8} width={b.w * 0.4} height={6} fill={windowColor} opacity={0.85} />
            )}
          </React.Fragment>
        ))
      )}
    </Svg>
  );
}

// ---- distant landmark silhouettes (spires / cranes / domes / seaside) ----
function DistantSvg({ tileW, height, seed, style: kind, color }) {
  const rng = mulberry32(seed);
  const items = [];
  let x = 20;
  while (x < tileW - 20) {
    const bw = 40 + rng() * 46;
    const bh = height * (0.14 + rng() * 0.2);
    const roll = rng();
    let topper = 'flat';
    if (kind === 'london') topper = roll < 0.22 ? 'spire' : roll < 0.34 ? 'dome' : 'flat';
    else if (kind === 'gritty') topper = roll < 0.26 ? 'crane' : roll < 0.36 ? 'tank' : 'flat';
    else if (kind === 'seaside') topper = roll < 0.18 ? 'spire' : 'flat';
    items.push({ x, bw: bw - 6, bh, topper });
    x += bw + rng() * 26;
  }
  const draw = (off) =>
    items.map((b, i) => {
      const bx = off + b.x;
      const by = height - b.bh;
      const parts = [<Rect key="b" x={bx} y={by} width={b.bw} height={b.bh} rx={2} fill={color} />];
      if (b.topper === 'spire') {
        const cx = bx + b.bw / 2;
        parts.push(<Path key="s" d={`M ${cx - 6} ${by} L ${cx} ${by - 30} L ${cx + 6} ${by} Z`} fill={color} />);
        parts.push(<Rect key="s2" x={cx - 1.5} y={by - 42} width={3} height={14} fill={color} />);
      } else if (b.topper === 'dome') {
        const cx = bx + b.bw / 2;
        parts.push(<Path key="d" d={`M ${bx + 4} ${by} Q ${cx} ${by - 26} ${bx + b.bw - 4} ${by} Z`} fill={color} />);
        parts.push(<Rect key="d2" x={cx - 1.5} y={by - 34} width={3} height={10} fill={color} />);
      } else if (b.topper === 'crane') {
        const cx = bx + b.bw / 2;
        parts.push(<Line key="c1" x1={cx} y1={by} x2={cx} y2={by - 46} stroke={color} strokeWidth={3} />);
        parts.push(<Line key="c2" x1={cx - 26} y1={by - 40} x2={cx + 34} y2={by - 40} stroke={color} strokeWidth={3} />);
        parts.push(<Line key="c3" x1={cx + 30} y1={by - 40} x2={cx + 30} y2={by - 28} stroke={color} strokeWidth={2} />);
      } else if (b.topper === 'tank') {
        parts.push(<Ellipse key="t" cx={bx + b.bw / 2} cy={by} rx={13} ry={9} fill={color} />);
      }
      return <G key={`${off}-${i}`}>{parts}</G>;
    });
  return (
    <Svg width={tileW * 2} height={height}>
      {draw(0)}
      {draw(tileW)}
    </Svg>
  );
}

// ---- decorative prop pool (mid-ground, desaturated, never collidable) ----
function propSvg(type, x, baseY, theme, rng) {
  const k = `${type}-${x}`;
  switch (type) {
    case 'bus': // red double-decker
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 30} width={54} height={26} rx={4} fill="#d1332e" />
          <Rect x={x + 4} y={baseY - 26} width={46} height={7} rx={2} fill="#ffe9a8" opacity={0.9} />
          <Rect x={x + 4} y={baseY - 15} width={46} height={7} rx={2} fill="#ffe9a8" opacity={0.9} />
          <Circle cx={x + 14} cy={baseY - 3} r={5} fill="#20232b" />
          <Circle cx={x + 42} cy={baseY - 3} r={5} fill="#20232b" />
        </G>
      );
    case 'phonebox':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 42} width={16} height={42} rx={2} fill="#d1332e" />
          <Rect x={x + 2.5} y={baseY - 38} width={11} height={26} rx={1} fill="#ffd9b0" opacity={0.85} />
          <Rect x={x - 1} y={baseY - 45} width={18} height={5} rx={1} fill="#b02a26" />
        </G>
      );
    case 'postbox':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 26} width={13} height={26} rx={6} fill="#d1332e" />
          <Rect x={x + 2.5} y={baseY - 18} width={8} height={2.5} fill="#7a1a17" />
        </G>
      );
    case 'lamp':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 44} width={3} height={44} fill={theme.obstacleDark} />
          <Circle cx={x + 1.5} cy={baseY - 46} r={4} fill={theme.window} opacity={0.9} />
        </G>
      );
    case 'tree':
      return (
        <G key={k}>
          <Rect x={x + 8} y={baseY - 14} width={5} height={14} fill="#6b4a2a" />
          <Circle cx={x + 10} cy={baseY - 22} r={15} fill="#4e8a3a" />
          <Circle cx={x + 2} cy={baseY - 16} r={10} fill="#5a9a44" />
          <Circle cx={x + 18} cy={baseY - 16} r={10} fill="#5a9a44" />
        </G>
      );
    case 'bunting': {
      const flags = [];
      for (let i = 0; i < 6; i++) {
        const fx = x + i * 16;
        flags.push(<Path key={i} d={`M ${fx} ${baseY - 54} L ${fx + 12} ${baseY - 54} L ${fx + 6} ${baseY - 44} Z`} fill={i % 3 === 0 ? '#d1332e' : i % 3 === 1 ? '#ffffff' : '#2f5d8f'} opacity={0.9} />);
      }
      return (
        <G key={k}>
          <Line x1={x} y1={baseY - 54} x2={x + 96} y2={baseY - 54} stroke={theme.obstacleDark} strokeWidth={1} opacity={0.5} />
          {flags}
        </G>
      );
    }
    case 'bin':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 22} width={16} height={22} rx={2} fill={rng() > 0.5 ? '#3a5a3a' : '#3a3a4a'} />
          <Rect x={x - 1} y={baseY - 25} width={18} height={4} rx={1} fill="#20232b" />
        </G>
      );
    case 'graffiti':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 26} width={64} height={26} fill={theme.obstacleDark} opacity={0.9} />
          <Path d={`M ${x + 6} ${baseY - 12} q 10 -14 20 0 q 10 14 20 0`} stroke="#3ef2c0" strokeWidth={3} fill="none" />
          <Path d={`M ${x + 40} ${baseY - 16} l 12 8`} stroke="#ff5fa2" strokeWidth={3} />
          <Circle cx={x + 14} cy={baseY - 18} r={3} fill="#ffd23f" />
        </G>
      );
    case 'scaffold': {
      const bars = [];
      for (let i = 0; i <= 3; i++) bars.push(<Line key={`v${i}`} x1={x + i * 16} y1={baseY - 48} x2={x + i * 16} y2={baseY} stroke="#8a8a6a" strokeWidth={2} />);
      for (let i = 0; i <= 3; i++) bars.push(<Line key={`h${i}`} x1={x} y1={baseY - i * 16} x2={x + 48} y2={baseY - i * 16} stroke="#8a8a6a" strokeWidth={2} />);
      return <G key={k} opacity={0.85}>{bars}</G>;
    }
    case 'fence': {
      const lines = [];
      for (let i = 0; i < 8; i++) {
        lines.push(<Line key={`a${i}`} x1={x + i * 8} y1={baseY - 24} x2={x + i * 8 + 8} y2={baseY} stroke="#9a9ab0" strokeWidth={1} opacity={0.5} />);
        lines.push(<Line key={`b${i}`} x1={x + i * 8} y1={baseY} x2={x + i * 8 + 8} y2={baseY - 24} stroke="#9a9ab0" strokeWidth={1} opacity={0.5} />);
      }
      return <G key={k}>{lines}</G>;
    }
    case 'aerial':
      return (
        <G key={k}>
          <Line x1={x} y1={baseY} x2={x} y2={baseY - 30} stroke={theme.obstacleDark} strokeWidth={2} />
          <Line x1={x - 8} y1={baseY - 24} x2={x + 8} y2={baseY - 24} stroke={theme.obstacleDark} strokeWidth={1.5} />
          <Line x1={x - 6} y1={baseY - 30} x2={x + 6} y2={baseY - 30} stroke={theme.obstacleDark} strokeWidth={1.5} />
        </G>
      );
    case 'chippy':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 34} width={58} height={34} rx={3} fill="#e8d3a1" />
          <Rect x={x} y={baseY - 44} width={58} height={12} rx={2} fill="#2f6b8f" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Rect key={i} x={x + 4 + i * 11} y={baseY - 44} width={5.5} height={12} fill="#ffffff" opacity={0.85} />
          ))}
          <Rect x={x + 10} y={baseY - 24} width={16} height={16} fill="#ffd23f" opacity={0.95} />
          <Rect x={x + 34} y={baseY - 22} width={14} height={22} rx={2} fill="#7a3b28" />
        </G>
      );
    case 'awning':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 26} width={44} height={26} rx={2} fill="#e8d3a1" />
          <Path d={`M ${x - 3} ${baseY - 26} L ${x + 47} ${baseY - 26} L ${x + 47} ${baseY - 16} L ${x - 3} ${baseY - 16} Z`} fill="#d1332e" />
          {[0, 1, 2, 3].map((i) => (
            <Rect key={i} x={x - 3 + i * 12.5} y={baseY - 26} width={6} height={10} fill="#ffffff" opacity={0.7} />
          ))}
          <Rect x={x + 16} y={baseY - 14} width={12} height={14} fill="#ffcf6b" opacity={0.9} />
        </G>
      );
    case 'bench':
      return (
        <G key={k}>
          <Rect x={x} y={baseY - 8} width={26} height={4} rx={1} fill="#6b4a2a" />
          <Rect x={x} y={baseY - 16} width={26} height={4} rx={1} fill="#6b4a2a" />
          <Rect x={x + 1} y={baseY - 8} width={3} height={8} fill="#4a3320" />
          <Rect x={x + 22} y={baseY - 8} width={3} height={8} fill="#4a3320" />
        </G>
      );
    default:
      return <G key={k} />;
  }
}

function PropSvg({ tileW, height, seed, theme }) {
  const pool = theme.props || [];
  const baseY = height - 6;
  const rng = mulberry32(seed);
  const placements = [];
  let x = 30 + rng() * 60;
  while (x < tileW - 40 && pool.length) {
    const type = pool[Math.floor(rng() * pool.length)];
    placements.push({ type, x });
    x += 120 + rng() * 140;
  }
  const draw = (off) => placements.map((p, i) => <G key={`${off}-${i}`}>{propSvg(p.type, off + p.x, baseY, theme, rng)}</G>);
  return (
    <Svg width={tileW * 2} height={height} opacity={0.82}>
      {draw(0)}
      {draw(tileW)}
    </Svg>
  );
}

// ---- sky birds (chippy seagulls) ----
function Birds({ tileW, groundY, color }) {
  const pts = [
    [tileW * 0.24, groundY * 0.28],
    [tileW * 0.3, groundY * 0.22],
    [tileW * 0.66, groundY * 0.34],
    [tileW * 0.8, groundY * 0.26],
  ];
  return (
    <Svg width={tileW * 2} height={groundY} opacity={0.6}>
      {[0, tileW].map((off) =>
        pts.map(([cx, cy], i) => (
          <Path key={`${off}-${i}`} d={`M ${off + cx - 6} ${cy} q 6 -6 6 0 q 0 -6 6 0`} stroke={color} strokeWidth={2} fill="none" />
        ))
      )}
    </Svg>
  );
}

// Themed environment with layered parallax + subtle distance-based tone shift.
export default function Background({ theme, width, height, world, removeAds }) {
  const groundY = height - CONFIG.GROUND_H;
  const tileW = Math.max(320, Math.round(width));
  const isEasy = theme.id === 'easy';
  const stops = theme.skyStops || [{ o: 0, c: theme.skyTop }, { o: 1, c: theme.skyBottom }];

  const far = useMemo(() => genSkyline(tileW, 1337, groundY * 0.18, groundY * 0.42, 54, 92), [tileW, groundY]);
  const near = useMemo(() => genSkyline(tileW, 9042, groundY * 0.12, groundY * 0.3, 42, 70), [tileW, groundY]);

  const tintStyle = useAnimatedStyle(() => {
    const d = (world && world.value && world.value.distPx) || 0;
    const o = 0.03 + 0.06 * (0.5 + 0.5 * Math.sin(d / 5200));
    return { opacity: o };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* sky (multi-stop gradient) */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            {stops.map((s, i) => (
              <Stop key={i} offset={String(s.o)} stopColor={s.c} />
            ))}
          </LinearGradient>
          {theme.sun && (
            <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={theme.sun.core} stopOpacity="1" />
              <Stop offset="0.4" stopColor={theme.sun.core} stopOpacity="0.7" />
              <Stop offset="1" stopColor={theme.sun.glow} stopOpacity="0" />
            </RadialGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#sky)" />
        {/* low setting sun, safely behind gameplay, near horizon */}
        {theme.sun && (
          <Circle cx={width * 0.72} cy={groundY * 0.82} r={Math.min(width, groundY) * 0.34} fill="url(#sun)" />
        )}
        {theme.sun && <Circle cx={width * 0.72} cy={groundY * 0.82} r={34} fill={theme.sun.core} opacity={0.95} />}
      </Svg>

      {/* subtle world-progression tone shift */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.skylineBack }, tintStyle]} pointerEvents="none" />

      {/* atmospheric haze (gritty) */}
      {theme.haze && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.haze }]} pointerEvents="none" />}

      {/* clouds (slowest), tinted with an underside shadow */}
      <ParallaxLayer world={world} factor={0.05} tileW={tileW} top={0} height={groundY}>
        <Svg width={tileW * 2} height={groundY}>
          {[0, tileW].map((off) => (
            <React.Fragment key={off}>
              <Ellipse cx={off + tileW * 0.22} cy={groundY * 0.2} rx="48" ry="21" fill={theme.cloudShadow || theme.cloud} opacity="0.6" />
              <Ellipse cx={off + tileW * 0.2} cy={groundY * 0.18} rx="46" ry="20" fill={theme.cloud} opacity="0.9" />
              <Ellipse cx={off + tileW * 0.28} cy={groundY * 0.2} rx="34" ry="16" fill={theme.cloud} opacity="0.9" />
              <Ellipse cx={off + tileW * 0.74} cy={groundY * 0.32} rx="54" ry="23" fill={theme.cloudShadow || theme.cloud} opacity="0.5" />
              <Ellipse cx={off + tileW * 0.72} cy={groundY * 0.3} rx="52" ry="22" fill={theme.cloud} opacity="0.8" />
              <Ellipse cx={off + tileW * 0.82} cy={groundY * 0.32} rx="34" ry="15" fill={theme.cloud} opacity="0.8" />
            </React.Fragment>
          ))}
        </Svg>
      </ParallaxLayer>

      {/* chippy seagulls high in the sky */}
      {theme.id === 'dusk' && (
        <ParallaxLayer world={world} factor={0.08} tileW={tileW} top={0} height={groundY}>
          <Birds tileW={tileW} groundY={groundY} color={theme.skyline} />
        </ParallaxLayer>
      )}

      {isEasy ? (
        <>
          <ParallaxLayer world={world} factor={0.12} tileW={tileW} top={0} height={groundY}>
            <Svg width={tileW * 2} height={groundY} opacity={0.7}>
              <Path d={hillPath(tileW, groundY, 0.74, groundY * 0.1, 2, 3, 1.2)} fill={theme.skylineBack} />
            </Svg>
          </ParallaxLayer>
          <ParallaxLayer world={world} factor={0.3} tileW={tileW} top={0} height={groundY}>
            <Svg width={tileW * 2} height={groundY} opacity={0.95}>
              <Path d={hillPath(tileW, groundY, 0.86, groundY * 0.08, 1, 2, 0.4)} fill={theme.skyline} />
            </Svg>
          </ParallaxLayer>
        </>
      ) : (
        <>
          {/* distant landmark silhouettes (slowest solid layer) */}
          <ParallaxLayer world={world} factor={0.1} tileW={tileW} top={0} height={groundY}>
            <View style={{ opacity: 0.55 }}>
              <DistantSvg tileW={tileW} height={groundY} seed={4711} style={theme.distant} color={theme.skylineBack} />
            </View>
          </ParallaxLayer>

          {/* far skyline */}
          <ParallaxLayer world={world} factor={0.18} tileW={tileW} top={0} height={groundY}>
            <SkylineSvg tileW={tileW} height={groundY} items={far} color={theme.skylineBack} windowColor={theme.window} opacity={0.75} />
          </ParallaxLayer>

          {/* near skyline with lit windows */}
          <ParallaxLayer world={world} factor={0.36} tileW={tileW} top={0} height={groundY}>
            <SkylineSvg tileW={tileW} height={groundY} items={near} color={theme.skyline} windowColor={theme.window} opacity={0.92} />
          </ParallaxLayer>

          {/* decorative prop layer (mid-ground, behind obstacles) */}
          <ParallaxLayer world={world} factor={0.52} tileW={tileW} top={0} height={groundY}>
            <PropSvg tileW={tileW} height={groundY} seed={2026} theme={theme} />
          </ParallaxLayer>
        </>
      )}

      {/* sponsored background billboard (mid-ground scenery — behind all gameplay,
          no collision, never intercepts input, separate from scoring/run logic) */}
      <SponsorBillboard world={world} theme={theme} width={width} groundY={groundY} removeAds={removeAds} />

      {/* ground */}
      <View style={{ position: 'absolute', top: groundY, width, height: CONFIG.GROUND_H, backgroundColor: theme.ground }} />
      <View style={{ position: 'absolute', top: groundY, width, height: 12, backgroundColor: theme.groundTop }} />
      {/* pavement strip */}
      <View style={{ position: 'absolute', top: groundY + 12, width, height: 10, backgroundColor: theme.pavement || theme.groundTop, opacity: 0.9 }} />

      {/* scrolling ground detail */}
      {isEasy ? (
        <ParallaxLayer world={world} factor={1.0} tileW={tileW} top={groundY - 8} height={20}>
          <Svg width={tileW * 2} height={20}>
            {Array.from({ length: Math.ceil((tileW * 2) / 128) }).map((_, i) => (
              <React.Fragment key={i}>
                <Ellipse cx={24 + i * 128} cy={14} rx={7} ry={9} fill={theme.groundTop} opacity={0.55} />
                <Ellipse cx={24 + i * 128 + 12} cy={16} rx={5} ry={6} fill={theme.groundTop} opacity={0.45} />
              </React.Fragment>
            ))}
          </Svg>
        </ParallaxLayer>
      ) : (
        <ParallaxLayer world={world} factor={1.0} tileW={tileW} top={groundY + 26} height={14}>
          <View style={{ flexDirection: 'row', width: tileW * 2 }}>
            {Array.from({ length: Math.ceil((tileW * 2) / 44) }).map((_, i) => (
              <View key={i} style={{ width: 24, height: 6, marginRight: 20, borderRadius: 3, backgroundColor: theme.groundTop, opacity: 0.5 }} />
            ))}
          </View>
        </ParallaxLayer>
      )}
    </View>
  );
}
