import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Audio } from '../audio/audio';
import { FONT, COLORS } from './theme';

const VARIANTS = {
  primary: { bg: COLORS.yellow, fg: '#3a2b06', border: '#c99a1e' },
  pink: { bg: COLORS.pink, fg: '#3a0620', border: '#c73a76' },
  teal: { bg: COLORS.teal, fg: '#053a2e', border: '#22a684' },
  ghost: { bg: 'transparent', fg: COLORS.text, border: '#6a5a95' },
};

export default function Button({ label, onPress, variant = 'primary', style, testID, small, disabled }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[aStyle, style, disabled && styles.disabled]}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPressIn={() => { if (!disabled) scale.value = withTiming(0.94, { duration: 70 }); }}
        onPressOut={() => { if (!disabled) scale.value = withTiming(1, { duration: 90 }); }}
        onPress={() => {
          if (disabled) return;
          Audio.ui();
          onPress && onPress();
        }}
        style={[
          styles.btn,
          small && styles.small,
          { backgroundColor: v.bg, borderColor: v.border, borderWidth: variant === 'ghost' ? 2 : 0 },
        ]}
      >
        <Text style={[styles.txt, small && styles.txtSmall, { color: v.fg }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  small: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 30 },
  txt: { fontFamily: FONT, fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  txtSmall: { fontSize: 15 },
  disabled: { opacity: 0.45 },
});
