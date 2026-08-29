import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse } from 'react-native-svg';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { CONFIG } from '../config';

// deterministic tiny PRNG so silhouettes are stable per mount
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
              <Rect
                x={off + b.x + b.w * 0.3}
                y={height - b.h + 8}
                width={b.w * 0.4}
                height={6}
                fill={windowColor}
                opacity={0.8}
              />
            )}
          </React.Fragment>
        ))
      )}
    </Svg>
  );
}

// Themed environment with parallax layers + subtle distance-based tone shift.
export default function Background({ theme, width, height, world }) {
  const groundY = height - CONFIG.GROUND_H;
  const tileW = Math.max(320, Math.round(width));

  const far = useMemo(() => genSkyline(tileW, 1337, groundY * 0.18, groundY * 0.42, 54, 92), [tileW, groundY]);
  const near = useMemo(() => genSkyline(tileW, 9042, groundY * 0.12, groundY * 0.3, 42, 70), [tileW, groundY]);

  const tintStyle = useAnimatedStyle(() => {
    const d = (world && world.value && world.value.distPx) || 0;
    const o = 0.04 + 0.09 * (0.5 + 0.5 * Math.sin(d / 5200));
    return { opacity: o };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* sky */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.skyTop} />
            <Stop offset="1" stopColor={theme.skyBottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#sky)" />
      </Svg>

      {/* subtle world-progression tone shift */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.skylineBack }, tintStyle]}
        pointerEvents="none"
      />

      {/* clouds (slowest) */}
      <ParallaxLayer world={world} factor={0.05} tileW={tileW} top={0} height={groundY}>
        <Svg width={tileW * 2} height={groundY}>
          {[0, tileW].map((off) => (
            <React.Fragment key={off}>
              <Ellipse cx={off + tileW * 0.2} cy={groundY * 0.2} rx="46" ry="20" fill={theme.cloud} opacity="0.85" />
              <Ellipse cx={off + tileW * 0.28} cy={groundY * 0.22} rx="34" ry="16" fill={theme.cloud} opacity="0.85" />
              <Ellipse cx={off + tileW * 0.72} cy={groundY * 0.32} rx="52" ry="22" fill={theme.cloud} opacity="0.7" />
              <Ellipse cx={off + tileW * 0.82} cy={groundY * 0.34} rx="34" ry="15" fill={theme.cloud} opacity="0.7" />
            </React.Fragment>
          ))}
        </Svg>
      </ParallaxLayer>

      {/* far skyline */}
      <ParallaxLayer world={world} factor={0.16} tileW={tileW} top={0} height={groundY}>
        <SkylineSvg tileW={tileW} height={groundY} items={far} color={theme.skylineBack} windowColor={theme.window} opacity={0.7} />
      </ParallaxLayer>

      {/* near skyline */}
      <ParallaxLayer world={world} factor={0.36} tileW={tileW} top={0} height={groundY}>
        <SkylineSvg tileW={tileW} height={groundY} items={near} color={theme.skyline} windowColor={theme.window} opacity={0.9} />
      </ParallaxLayer>

      {/* ground */}
      <View style={{ position: 'absolute', top: groundY, width, height: CONFIG.GROUND_H, backgroundColor: theme.ground }} />
      <View style={{ position: 'absolute', top: groundY, width, height: 10, backgroundColor: theme.groundTop }} />
      {/* scrolling street detail (kerb dashes) */}
      <ParallaxLayer world={world} factor={1.0} tileW={tileW} top={groundY + 22} height={16}>
        <View style={{ flexDirection: 'row', width: tileW * 2 }}>
          {Array.from({ length: Math.ceil((tileW * 2) / 44) }).map((_, i) => (
            <View key={i} style={{ width: 24, height: 6, marginRight: 20, borderRadius: 3, backgroundColor: theme.groundTop, opacity: 0.5 }} />
          ))}
        </View>
      </ParallaxLayer>
    </View>
  );
}
