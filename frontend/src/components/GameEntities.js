import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import PigeonSprite from './PigeonSprite';
import { CONFIG, pigeonSizeFor } from '../config';

const OW = CONFIG.OBSTACLE_WIDTH;

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
      <Building height={topH} theme={theme} kind={geom.kind} flip />
      <View style={{ position: 'absolute', top: bottomY, height: bottomH, width: OW }}>
        <Building height={bottomH} theme={theme} kind={geom.kind} />
      </View>
    </Animated.View>
  );
}

function Building({ height, theme, kind, flip }) {
  const rows = useMemo(() => {
    const n = Math.max(0, Math.floor((height - 26) / 34));
    return Array.from({ length: n });
  }, [height]);
  if (height <= 0) return null;
  return (
    <View
      style={[
        obStyles.col,
        { height, backgroundColor: theme.obstacle, borderColor: theme.obstacleDark },
      ]}
    >
      {/* cap on the "gap facing" edge */}
      <View
        style={[
          obStyles.cap,
          flip ? { bottom: -4 } : { top: -4 },
          { backgroundColor: theme.obstacleDark },
        ]}
      />
      <Cap kind={kind} theme={theme} flip={flip} />
      <View style={obStyles.windows}>
        {rows.map((_, i) => (
          <View key={i} style={obStyles.winRow}>
            <View style={[obStyles.win, { backgroundColor: theme.window }]} />
            <View style={[obStyles.win, { backgroundColor: theme.window }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Themed accent that distinguishes obstacle kinds.
function Cap({ kind, theme, flip }) {
  const edge = flip ? { bottom: 2 } : { top: 2 };
  if (kind === 0) {
    // chimney
    return (
      <View style={[obStyles.accent, edge, { left: 10 }]}>
        <View style={{ width: 14, height: 18, backgroundColor: theme.obstacleDark, borderRadius: 2 }} />
      </View>
    );
  }
  if (kind === 1) {
    // hanging pub sign
    return (
      <View style={[obStyles.accent, edge, { alignSelf: 'center' }]}>
        <View style={{ width: 30, height: 20, backgroundColor: theme.accent, borderRadius: 4 }} />
      </View>
    );
  }
  if (kind === 2) {
    // scaffolding poles
    return (
      <View style={[obStyles.accent, edge, { flexDirection: 'row', gap: 6, alignSelf: 'center' }]}>
        <View style={{ width: 4, height: 22, backgroundColor: theme.accent }} />
        <View style={{ width: 4, height: 22, backgroundColor: theme.accent }} />
        <View style={{ width: 4, height: 22, backgroundColor: theme.accent }} />
      </View>
    );
  }
  // clock face
  return (
    <View style={[obStyles.accent, edge, { alignSelf: 'center' }]}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, borderColor: theme.obstacleDark }} />
    </View>
  );
}

/* ---------------- Chip (a British chip / fry) ---------------- */
export function ChipView({ world, index }) {
  const S = CONFIG.CHIP_SIZE;
  const style = useAnimatedStyle(() => {
    const c = world.value.chips[index];
    if (!c || !c.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const scale = c.eaten ? 1 + c.anim * 1.4 : 1;
    const opacity = c.eaten ? 1 - c.anim : 1;
    return {
      opacity,
      transform: [
        { translateX: c.x - S / 2 },
        { translateY: c.y - S / 2 },
        { rotate: '35deg' },
        { scale },
      ],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <View style={chipStyles.chip}>
        <View style={chipStyles.chipHi} />
      </View>
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

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
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
  accent: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  windows: { marginTop: 14, gap: 12, alignItems: 'center' },
  winRow: { flexDirection: 'row', gap: 8 },
  win: { width: 14, height: 16, borderRadius: 2, opacity: 0.9 },
});

const chipStyles = StyleSheet.create({
  chip: {
    width: CONFIG.CHIP_SIZE,
    height: CONFIG.CHIP_SIZE * 0.5,
    marginTop: CONFIG.CHIP_SIZE * 0.25,
    backgroundColor: '#f4c542',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#c99a1e',
    overflow: 'hidden',
  },
  chipHi: {
    position: 'absolute',
    top: 2,
    left: 3,
    right: 3,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#fff3c4',
  },
});

const featherStyles = StyleSheet.create({
  f: { width: 14, height: 8, borderRadius: 6, opacity: 0.95 },
});
