import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import DrunkPigeon from '../components/DrunkPigeon';
import DrunknessSlider from '../ui/DrunknessSlider';
import SecretCode from '../components/SecretCode';
import ManorThumb from '../components/ManorThumb';
import { getPigeon } from '../data/pigeons';
import { MAPS } from '../data/maps';
import { Billing } from '../store/billing';
import { Audio } from '../audio/audio';
import { Ionicons } from '@expo/vector-icons';

export default function MainMenu({
  bestScore,
  pigeonsInjured,
  soundEnabled,
  selectedPigeon,
  selectedMap,
  leetUnlock,
  easyModeOwned = false,
  easyPrice = '£14.99',
  isDev = false,
  onPlay,
  onPigeons,
  onSelectMap,
  onBuyEasy,
  onToggleSound,
  onLeetUnlock,
  onLeaderboard,
  onLegal,
  onOpenPurchaseTerms,
  drunkStrength = 1,
  drunkLevel = 0.5,
  onSetDrunk,
  onCommitDrunk,
}) {
  const pigeon = getPigeon(selectedPigeon);
  const { width } = useWindowDimensions();
  // Responsive menu pigeon size: slightly smaller than before (was 150) so BEST | PIGEON | INJURED
  // fits on one row across common widths; scales down on narrow phones before anything clips.
  const heroSize = Math.round(Math.max(88, Math.min(110, width * 0.28)));
  const [showCode, setShowCode] = useState(false);
  const [easySheet, setEasySheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [purchaseMsg, setPurchaseMsg] = useState('');
  const bob = useSharedValue(0);
  React.useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const pigeonStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 + bob.value * 20 }, { rotate: `${-6 + bob.value * 12}deg` }],
  }));

  const openEasySheet = () => {
    Audio.unlock();
    Audio.ui();
    setPurchaseMsg('');
    setEasySheet(true);
  };
  const closeEasySheet = () => {
    setEasySheet(false);
    setBusy(false);
    setPurchaseMsg('');
  };
  const runEasyPurchase = async (devOutcome) => {
    if (busy) return;
    setBusy(true);
    setPurchaseMsg('');
    const status = await onBuyEasy(devOutcome);
    setBusy(false);
    if (status === 'success') {
      Audio.highscore();
      setEasySheet(false);
      onSelectMap('easy'); // immediately selectable/selected, no restart needed
    } else if (status === 'cancelled') {
      closeEasySheet(); // nothing happens
    } else {
      Audio.crash();
      setPurchaseMsg("PURCHASE COULDN'T BE COMPLETED");
    }
  };

  const onManorPress = (id) => {
    if (id === 'easy' && !easyModeOwned) {
      openEasySheet();
      return;
    }
    Audio.ui();
    onSelectMap(id);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
      <View style={styles.top}>
        <Pressable testID="open-code-button"
          onPress={() => {
            Audio.unlock();
            Audio.ui();
            setShowCode(true);
          }}
          style={styles.codeMark}
        >
          <Text style={styles.codeTxt}>{leetUnlock ? '1337' : 'CODE'}</Text>
        </Pressable>
        <Pressable testID="legal-privacy-button" onPress={() => { Audio.ui(); onLegal && onLegal(); }} style={styles.legalPill}>
          <Text style={styles.soundTxt}>LEGAL & PRIVACY</Text>
        </Pressable>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.titleShadow}>DRUNK{'\n'}PIGEONS</Text>
        <Text style={styles.title}>DRUNK{'\n'}PIGEONS</Text>
        <Text style={styles.subtitle}>flap responsibly.</Text>
      </View>

      <View style={styles.heroRow}>
        <Stat label="BEST SCORE" value={bestScore} color={COLORS.yellow} testID="menu-best-score" />
        <Animated.View style={[styles.hero, pigeonStyle]}>
          <DrunkPigeon pigeon={pigeon} fatLevel={2} size={heroSize} intensity="full" eyes strength={drunkStrength} testID="menu-pigeon" />
        </Animated.View>
        <Stat label="PIGEONS INJURED" value={pigeonsInjured} color={COLORS.pink} testID="menu-injured" />
      </View>

      {/* Speaker toggle sits directly under the PIGEONS INJURED column, centred with it. */}
      <View style={styles.speakerRow} pointerEvents="box-none">
        <View style={styles.speakerSpacer} />
        <View style={{ width: heroSize, marginHorizontal: 4 }} />
        <View style={styles.speakerCol}>
          <Pressable
            testID="sound-toggle"
            onPress={onToggleSound}
            style={styles.speakerBtn}
            accessibilityRole="button"
            accessibilityLabel={soundEnabled ? 'Turn sound off' : 'Turn sound on'}
            accessibilityState={{ checked: soundEnabled, selected: soundEnabled }}
          >
            <Ionicons name={soundEnabled ? 'volume-high' : 'volume-mute'} size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <DrunknessSlider value={drunkLevel} onChange={onSetDrunk} onCommit={onCommitDrunk} />

      <Text style={styles.mapLabel}>CHOOSE YOUR MANOR</Text>
      <View style={styles.maps}>
        {MAPS.map((m) => (
          <Pressable
            key={m.id}
            testID={`map-${m.id}`}
            onPress={() => onManorPress(m.id)}
            style={[styles.mapCard, selectedMap === m.id && styles.mapCardActive]}
          >
            <View style={styles.mapSwatch}>
              <ManorThumb mapId={m.id} width={74} height={44} />
            </View>
            <Text style={styles.mapName} numberOfLines={1}>{m.name}</Text>
          </Pressable>
        ))}

        {/* RANDOM MANOR — picks one of the 3 standard maps each run (never Easy Mode) */}
        <Pressable
          testID="map-random"
          onPress={() => onManorPress('random')}
          style={[styles.mapCard, selectedMap === 'random' && styles.mapCardActive]}
        >
          <View style={styles.mapSwatch}>
            <ManorThumb variant="random" width={74} height={44} />
            <View style={styles.randomQ}><Text style={styles.randomQTxt}>?</Text></View>
          </View>
          <Text style={styles.mapName} numberOfLines={1}>Random</Text>
        </Pressable>

        {/* EASY MODE — premium £14.99. Always visible; locked until purchased. */}
        <Pressable
          testID="map-easy"
          onPress={() => onManorPress('easy')}
          style={[styles.mapCard, styles.easyCard, selectedMap === 'easy' && styles.mapCardActive]}
        >
          <View style={styles.mapSwatch}>
            <ManorThumb mapId="easy" width={74} height={44} />
            {!easyModeOwned && (
              <View style={styles.easyLock} testID="easy-lock">
                <Text style={styles.easyLockTxt}>🔒</Text>
              </View>
            )}
          </View>
          <Text style={styles.mapName} numberOfLines={1}>Easy Mode</Text>
          {!easyModeOwned && <Text style={styles.easyPrice} testID="easy-price">{easyPrice}</Text>}
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Button testID="play-button" label="PLAY" variant="primary" onPress={onPlay} style={{ flex: 1 }} />
        <Button testID="pigeons-button" label="PIGEONS" variant="pink" onPress={onPigeons} style={{ flex: 1 }} />
      </View>
      <Button
        testID="leaderboard-button"
        label="🏆  LEADERBOARD"
        variant="teal"
        onPress={onLeaderboard}
        style={{ width: '100%', marginTop: 12, marginBottom: 10 }}
      />
      </ScrollView>

      <SecretCode visible={showCode} onClose={() => setShowCode(false)} onUnlock={onLeetUnlock} />

      {/* EASY MODE purchase sheet — deliberate, no auto-start, no nagging */}
      {easySheet && (
        <View style={styles.sheetOverlay} testID="easy-purchase-sheet" onStartShouldSetResponder={() => true}>
          <View style={styles.sheet}>
            <Text style={styles.sheetKicker}>EASY MODE</Text>
            <Text style={styles.sheetPrice} testID="easy-sheet-price">{easyPrice}</Text>
            <Text style={styles.sheetBlurb}>An absurdly easy version of Drunk Pigeons. Huge gaps, endless calm. Scores go to the Silly Mode leaderboard only.</Text>
            <Text style={styles.sheetNote}>
              {Billing.platform === 'ios' ? 'Billed via the App Store · one-time purchase' : Billing.platform === 'android' ? 'Billed via Google Play · one-time purchase' : 'Billed via your app store · one-time purchase'}
            </Text>
            {!!purchaseMsg && <Text style={styles.sheetError} testID="easy-purchase-error">{purchaseMsg}</Text>}

            {isDev ? (
              <>
                <Text style={styles.devTag}>DEV SIMULATOR</Text>
                <Button testID="easy-sim-success" label={busy ? '…' : 'Simulate Success'} variant="teal" small onPress={() => runEasyPurchase('success')} style={styles.sheetBtn} />
                <View style={styles.simRow}>
                  <Button testID="easy-sim-cancel" label="Cancelled" variant="ghost" small onPress={() => runEasyPurchase('cancelled')} style={{ flex: 1 }} />
                  <Button testID="easy-sim-fail" label="Failed" variant="ghost" small onPress={() => runEasyPurchase('failed')} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <Button testID="easy-buy-confirm" label={busy ? '…' : `BUY — ${easyPrice}`} variant="primary" onPress={() => runEasyPurchase('success')} style={styles.sheetBtn} />
            )}
            <Button testID="easy-buy-cancel" label="CANCEL" variant="ghost" small onPress={closeEasySheet} style={styles.sheetBtn} />
            <Pressable testID="easy-purchase-terms" onPress={() => { Audio.ui(); onOpenPurchaseTerms && onOpenPurchaseTerms(); }} style={styles.termsLink}>
              <Text style={styles.termsLinkTxt}>Purchase terms</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  top: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingTop: 8 },
  codeMark: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  codeTxt: { fontFamily: FONT, color: 'rgba(199,184,230,0.5)', fontWeight: '700', fontSize: 12, letterSpacing: 3 },
  speakerRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8, marginTop: 2 },
  speakerSpacer: { flex: 1, minWidth: 0, maxWidth: 132 },
  speakerCol: { flex: 1, minWidth: 0, maxWidth: 132, alignItems: 'center' },
  speakerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  legalPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.bgAlt, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  soundTxt: { fontFamily: FONT, color: COLORS.textDim, fontWeight: '600', fontSize: 12, letterSpacing: 1 },
  titleWrap: { marginTop: 2, alignItems: 'center' },
  title: {
    fontFamily: FONT, color: COLORS.yellow, fontSize: 52, fontWeight: '700',
    textAlign: 'center', lineHeight: 50, letterSpacing: 2,
  },
  titleShadow: {
    position: 'absolute', top: 4, left: 4, fontFamily: FONT, color: COLORS.pink,
    fontSize: 52, fontWeight: '700', textAlign: 'center', lineHeight: 50, letterSpacing: 2, opacity: 0.5,
  },
  subtitle: { fontFamily: FONT, color: COLORS.teal, fontSize: 16, marginTop: 4, fontWeight: '600' },
  hero: { marginHorizontal: 4 },
  heroRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 3, gap: 8 },
  stats: { flexDirection: 'row', gap: 14, marginTop: 2 },
  stat: { backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 0, maxWidth: 132 },
  statLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  statValue: { fontFamily: FONT, fontSize: 26, fontWeight: '700', marginTop: 2 },
  mapLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, letterSpacing: 2, marginTop: 8, fontWeight: '600' },
  maps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  mapCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', width: 96 },
  mapCardActive: { borderColor: COLORS.yellow },
  mapSwatch: { width: 74, height: 44, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  mapSwatchGround: { height: 14, width: '100%' },
  mapName: { fontFamily: FONT, color: COLORS.text, fontSize: 11, marginTop: 6, fontWeight: '600', textAlign: 'center' },
  randomSwatch: { width: 74, height: 44, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' },
  randomStripe: { flex: 1, height: '100%' },
  randomQ: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  randomQTxt: { fontFamily: FONT, color: '#fff', fontSize: 24, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  easyCard: { borderColor: 'rgba(126,200,242,0.35)' },
  easyLock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,12,40,0.42)' },
  easyLockTxt: { fontSize: 20 },
  easyPrice: { fontFamily: FONT, color: COLORS.yellow, fontSize: 12, fontWeight: '700', marginTop: 2 },
  buttons: { flexDirection: 'row', gap: 14, marginTop: 22, width: '100%', marginBottom: 10 },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,8,30,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 60 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: COLORS.card, borderRadius: 24, padding: 22, alignItems: 'center' },
  sheetKicker: { fontFamily: FONT, color: COLORS.teal, fontSize: 16, fontWeight: '700', letterSpacing: 3 },
  sheetPrice: { fontFamily: FONT, color: COLORS.yellow, fontSize: 40, fontWeight: '700', marginTop: 4 },
  sheetBlurb: { fontFamily: FONT, color: COLORS.text, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  sheetNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 8, textAlign: 'center' },
  sheetError: { fontFamily: FONT, color: COLORS.pink, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  devTag: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, letterSpacing: 2, marginTop: 14 },
  sheetBtn: { width: '100%', marginTop: 10 },
  simRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
  termsLink: { marginTop: 12, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  termsLinkTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 1, textDecorationLine: 'underline' },
});
