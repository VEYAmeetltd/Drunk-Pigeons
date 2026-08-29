import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import PigeonSprite from '../components/PigeonSprite';
import { getPigeon } from '../data/pigeons';
import { MAPS } from '../data/maps';
import { Audio } from '../audio/audio';

export default function MainMenu({
  bestScore,
  pigeonsInjured,
  soundEnabled,
  selectedPigeon,
  selectedMap,
  onPlay,
  onPigeons,
  onSelectMap,
  onToggleSound,
}) {
  const pigeon = getPigeon(selectedPigeon);
  const bob = useSharedValue(0);
  React.useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const pigeonStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 + bob.value * 20 }, { rotate: `${-6 + bob.value * 12}deg` }],
  }));

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <Pressable testID="sound-toggle" onPress={onToggleSound} style={styles.sound}>
          <Text style={styles.soundTxt}>{soundEnabled ? 'SOUND: ON' : 'SOUND: OFF'}</Text>
        </Pressable>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.titleShadow}>DRUNK{'\n'}PIGEONS</Text>
        <Text style={styles.title}>DRUNK{'\n'}PIGEONS</Text>
        <Text style={styles.subtitle}>flap responsibly.</Text>
      </View>

      <Animated.View style={[styles.hero, pigeonStyle]}>
        <PigeonSprite pigeon={pigeon} fatLevel={2} size={150} />
      </Animated.View>

      <View style={styles.stats}>
        <Stat label="BEST SCORE" value={bestScore} color={COLORS.yellow} testID="menu-best-score" />
        <Stat label="PIGEONS INJURED" value={pigeonsInjured} color={COLORS.pink} testID="menu-injured" />
      </View>

      <Text style={styles.mapLabel}>PICK YOUR MANOR</Text>
      <View style={styles.maps}>
        {MAPS.map((m) => (
          <Pressable
            key={m.id}
            testID={`map-${m.id}`}
            onPress={() => {
              Audio.ui();
              onSelectMap(m.id);
            }}
            style={[styles.mapCard, selectedMap === m.id && styles.mapCardActive]}
          >
            <View style={[styles.mapSwatch, { backgroundColor: m.skyTop }]}>
              <View style={[styles.mapSwatchGround, { backgroundColor: m.ground }]} />
            </View>
            <Text style={styles.mapName}>{m.name}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.buttons}>
        <Button testID="play-button" label="PLAY" variant="primary" onPress={onPlay} style={{ flex: 1 }} />
        <Button testID="pigeons-button" label="PIGEONS" variant="pink" onPress={onPigeons} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, color, testID }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text testID={testID} style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 24, alignItems: 'center' },
  top: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 8 },
  sound: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: COLORS.bgAlt },
  soundTxt: { fontFamily: FONT, color: COLORS.textDim, fontWeight: '600', fontSize: 12, letterSpacing: 1 },
  titleWrap: { marginTop: 6, alignItems: 'center' },
  title: {
    fontFamily: FONT, color: COLORS.yellow, fontSize: 52, fontWeight: '700',
    textAlign: 'center', lineHeight: 50, letterSpacing: 2,
  },
  titleShadow: {
    position: 'absolute', top: 4, left: 4, fontFamily: FONT, color: COLORS.pink,
    fontSize: 52, fontWeight: '700', textAlign: 'center', lineHeight: 50, letterSpacing: 2, opacity: 0.5,
  },
  subtitle: { fontFamily: FONT, color: COLORS.teal, fontSize: 16, marginTop: 4, fontWeight: '600' },
  hero: { marginVertical: 6 },
  stats: { flexDirection: 'row', gap: 14, marginTop: 2 },
  stat: { backgroundColor: COLORS.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', minWidth: 130 },
  statLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  statValue: { fontFamily: FONT, fontSize: 30, fontWeight: '700' },
  mapLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, letterSpacing: 2, marginTop: 16, fontWeight: '600' },
  maps: { flexDirection: 'row', gap: 10, marginTop: 8 },
  mapCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', width: 96 },
  mapCardActive: { borderColor: COLORS.yellow },
  mapSwatch: { width: 74, height: 44, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  mapSwatchGround: { height: 14, width: '100%' },
  mapName: { fontFamily: FONT, color: COLORS.text, fontSize: 11, marginTop: 6, fontWeight: '600', textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 14, marginTop: 22, width: '100%', marginBottom: 10 },
});
