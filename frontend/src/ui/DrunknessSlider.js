import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { FONT, COLORS } from './theme';
import { Audio } from '../audio/audio';

const LABEL_W = 116;
const LABEL_HALF = LABEL_W / 2;

// Dependency-free horizontal slider for the "Drunkness" visual-intensity setting.
// 0 = SOBER, 0.5 = TIPSY, 1 = ABSOLUTELY PIGEONED. Purely cosmetic.
export default function DrunknessSlider({ value = 0.5, onChange, onCommit }) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const clamp = (v) => Math.max(0, Math.min(1, v));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (wRef.current > 0) onChange && onChange(clamp(e.nativeEvent.locationX / wRef.current));
      },
      onPanResponderMove: (e) => {
        if (wRef.current > 0) onChange && onChange(clamp(e.nativeEvent.locationX / wRef.current));
      },
      onPanResponderRelease: () => {
        Audio.ui();
        onCommit && onCommit();
      },
    })
  ).current;

  const pct = clamp(value);
  const near = (t) => Math.abs(pct - t) < 0.12;

  return (
    <View style={styles.wrap} testID="drunkness-slider">
      <Text style={styles.title}>DRUNKNESS</Text>
      <View
        style={styles.trackHit}
        onLayout={(ev) => { const width = ev.nativeEvent.layout.width; wRef.current = width; setW(width); }}
        {...pan.panHandlers}
      >
        <View style={styles.track} />
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        <View style={[styles.thumb, { left: w ? Math.max(0, Math.min(w - 22, pct * w - 11)) : 0 }]} testID="drunkness-thumb" />
      </View>
      {/* Labels centred directly under 0% / 50% / 100% of the track */}
      <View style={styles.labels}>
        {w > 0 && (
          <>
            <Text style={[styles.label, styles.labelBox, { left: 0 * w - LABEL_HALF }, near(0) && styles.labelActive]}>SOBER</Text>
            <Text style={[styles.label, styles.labelBox, { left: 0.5 * w - LABEL_HALF }, near(0.5) && styles.labelActive]}>TIPSY</Text>
            <Text style={[styles.label, styles.labelBox, styles.pigeoned, { left: 1 * w - LABEL_HALF }, near(1) && styles.pigeonedActive]}>ABSOLUTELY PIGEONED</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', paddingHorizontal: LABEL_HALF, paddingVertical: 8 },
  title: { fontFamily: FONT, color: COLORS.textDim, fontWeight: '700', fontSize: 12, letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  trackHit: { height: 30, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: COLORS.bgAlt },
  fill: { position: 'absolute', height: 8, borderRadius: 4, backgroundColor: COLORS.pink },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.yellow, borderWidth: 2, borderColor: '#fff' },
  labels: { position: 'relative', height: 30, marginTop: 18 },
  labelBox: { position: 'absolute', top: 0, width: LABEL_W, textAlign: 'center' },
  label: { fontFamily: FONT, color: COLORS.textDim, fontWeight: '600', fontSize: 10, letterSpacing: 0.5 },
  labelActive: { color: COLORS.teal },
  pigeoned: { color: '#b98bff', fontWeight: '800', fontSize: 10 },
  pigeonedActive: { color: COLORS.yellow, textShadowColor: 'rgba(255,210,63,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
});
