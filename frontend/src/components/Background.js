import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Ellipse, Path } from 'react-native-svg';
import { CONFIG } from '../config';

// Static themed environment: sky gradient, clouds, skyline silhouette, ground.
export default function Background({ theme, width, height }) {
  const groundY = height - CONFIG.GROUND_H;
  const sky = groundY;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.skyTop} />
            <Stop offset="1" stopColor={theme.skyBottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#sky)" />

        {/* clouds */}
        <Ellipse cx={width * 0.2} cy={sky * 0.2} rx="46" ry="20" fill={theme.cloud} opacity="0.85" />
        <Ellipse cx={width * 0.28} cy={sky * 0.22} rx="34" ry="16" fill={theme.cloud} opacity="0.85" />
        <Ellipse cx={width * 0.78} cy={sky * 0.34} rx="52" ry="22" fill={theme.cloud} opacity="0.7" />
        <Ellipse cx={width * 0.7} cy={sky * 0.36} rx="34" ry="15" fill={theme.cloud} opacity="0.7" />

        {/* far skyline */}
        <SkylineBack width={width} baseY={groundY} color={theme.skylineBack} />
        {/* near skyline */}
        <SkylineFront width={width} baseY={groundY} color={theme.skyline} />

        {/* ground */}
        <Rect x="0" y={groundY} width={width} height={CONFIG.GROUND_H} fill={theme.ground} />
        <Rect x="0" y={groundY} width={width} height="10" fill={theme.groundTop} />
      </Svg>
    </View>
  );
}

function SkylineBack({ width, baseY, color }) {
  const bw = 70;
  const n = Math.ceil(width / bw) + 1;
  let d = `M 0 ${baseY}`;
  for (let i = 0; i < n; i++) {
    const h = 60 + ((i * 37) % 90);
    const x = i * bw;
    d += ` L ${x} ${baseY - h} L ${x + bw * 0.7} ${baseY - h} L ${x + bw * 0.7} ${baseY}`;
  }
  d += ` L ${width} ${baseY} Z`;
  return <Path d={d} fill={color} opacity="0.7" />;
}

function SkylineFront({ width, baseY, color }) {
  const bw = 54;
  const n = Math.ceil(width / bw) + 1;
  let d = `M 0 ${baseY}`;
  for (let i = 0; i < n; i++) {
    const h = 40 + ((i * 53) % 70);
    const x = i * bw;
    d += ` L ${x} ${baseY - h} L ${x + bw * 0.8} ${baseY - h} L ${x + bw * 0.8} ${baseY}`;
  }
  d += ` L ${width} ${baseY} Z`;
  return <Path d={d} fill={color} opacity="0.85" />;
}
