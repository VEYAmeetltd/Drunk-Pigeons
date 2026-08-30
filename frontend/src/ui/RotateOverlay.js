import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONT, COLORS } from './theme';

// Lightweight "please rotate to portrait" guard. Shown only in phone landscape
// (native is already locked to portrait via app.json; this covers mobile web).
export function RotateOverlay({ visible }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="auto" testID="rotate-overlay">
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <View style={styles.phone}>
            <View style={styles.notch} />
            <View style={styles.homeDot} />
          </View>
          <Text style={styles.arrow}>⟲</Text>
        </View>
        <Text style={styles.title}>TURN IT BACK, YOU MUPPET</Text>
        <Text style={styles.sub}>DRUNK PIGEONS is a portrait game.</Text>
        <Text style={styles.hint}>Even the pigeon can't fly sideways — rotate your phone upright.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 9999,
  },
  card: { alignItems: 'center', maxWidth: 460 },
  iconWrap: { width: 150, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  phone: {
    width: 66,
    height: 112,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: COLORS.yellow,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  notch: { width: 22, height: 5, borderRadius: 3, backgroundColor: COLORS.yellow },
  homeDot: { width: 20, height: 4, borderRadius: 2, backgroundColor: COLORS.textDim },
  arrow: {
    position: 'absolute',
    right: 6,
    top: 2,
    fontFamily: FONT,
    color: COLORS.teal,
    fontSize: 62,
    fontWeight: '700',
  },
  title: {
    fontFamily: FONT,
    color: COLORS.yellow,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: { fontFamily: FONT, color: COLORS.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  hint: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
