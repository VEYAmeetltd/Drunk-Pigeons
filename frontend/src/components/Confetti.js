import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';

const PALETTE = ['#ffd23f', '#ff5fa2', '#3ef2c0', '#ff7b54', '#8a94a6', '#ffffff'];
const N = 18;

function Piece({ i }) {
  const p = useSharedValue(0);
  const startX = (Math.random() * 2 - 1) * 130;
  const drift = (Math.random() * 2 - 1) * 60;
  const rot = (Math.random() * 2 - 1) * 720;
  const dur = 1500 + Math.random() * 700;
  const delay = Math.random() * 300;
  const color = PALETTE[i % PALETTE.length];
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: startX + drift * p.value },
      { translateY: -10 + p.value * 230 },
      { rotate: `${rot * p.value}deg` },
    ],
  }));
  return <Animated.View style={[styles.piece, { backgroundColor: color }, style]} pointerEvents="none" />;
}

// Lightweight one-shot confetti burst (reuses reanimated, ~18 pieces).
export default function Confetti() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      {Array.from({ length: N }).map((_, i) => (
        <Piece key={i} i={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  piece: { position: 'absolute', width: 10, height: 14, borderRadius: 2 },
});
