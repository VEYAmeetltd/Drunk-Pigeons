import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import PigeonSprite from '../components/PigeonSprite';
import { PIGEONS } from '../data/pigeons';
import { Audio } from '../audio/audio';

export default function PigeonsScreen({ selectedPigeon, unlockedPigeons, leetUnlock, onSelect, onBack }) {
  const [preview, setPreview] = useState(selectedPigeon);
  const isUnlocked = (p) => !p.locked || leetUnlock || unlockedPigeons.includes(p.id);
  const previewP = PIGEONS.find((p) => p.id === preview) || PIGEONS[0];
  const previewUnlocked = isUnlocked(previewP);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Button testID="pigeons-back" label="BACK" variant="ghost" small onPress={onBack} />
        <Text style={styles.title}>PIGEONS</Text>
        {leetUnlock ? (
          <Text style={styles.leetBadge} testID="leet-badge">1337</Text>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {/* Preview panel — always shows what a pigeon looks like, locked or not */}
      <View style={styles.previewCard}>
        <View style={styles.previewSprite}>
          <PigeonSprite pigeon={previewP} fatLevel={1} size={140} />
          {!previewUnlocked && (
            <View style={styles.previewLock} testID="preview-lock">
              <Text style={styles.lockEmoji}>LOCKED</Text>
            </View>
          )}
        </View>
        <Text style={styles.previewName}>{previewP.name}</Text>
        <Text style={styles.previewTag}>{previewP.tagline}</Text>
        {previewUnlocked ? (
          selectedPigeon === previewP.id ? (
            <Text style={[styles.previewState, { color: COLORS.teal }]}>SELECTED</Text>
          ) : (
            <Button
              testID="select-pigeon"
              label="SELECT"
              variant="teal"
              small
              onPress={() => onSelect(previewP.id)}
              style={{ marginTop: 8 }}
            />
          )
        ) : (
          <Text style={[styles.previewState, { color: COLORS.pink }]}>UNLOCK COMING SOON</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {PIGEONS.map((p) => {
          const unlocked = isUnlocked(p);
          const active = selectedPigeon === p.id;
          return (
            <Pressable
              key={p.id}
              testID={`pigeon-card-${p.id}`}
              onPress={() => {
                Audio.ui();
                setPreview(p.id);
              }}
              style={[styles.card, active && styles.cardActive, preview === p.id && styles.cardPreview]}
            >
              <View style={styles.cardSprite}>
                <PigeonSprite pigeon={p} fatLevel={0} size={70} />
                {!unlocked && (
                  <View style={styles.cardLock}>
                    <Text style={styles.cardLockTxt}>🔒</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{p.name.replace(' Pigeon', '')}</Text>
              {active && <Text style={styles.cardBadge}>✓</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 30, fontWeight: '700', letterSpacing: 2 },
  leetBadge: { width: 70, textAlign: 'right', fontFamily: FONT, color: COLORS.pink, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  previewCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 16, alignItems: 'center', marginTop: 10 },
  previewSprite: { height: 150, justifyContent: 'center', alignItems: 'center' },
  previewLock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,16,48,0.55)', borderRadius: 16 },
  lockEmoji: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 20, letterSpacing: 3 },
  previewName: { fontFamily: FONT, color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 6 },
  previewTag: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, marginTop: 2, fontStyle: 'italic' },
  previewState: { fontFamily: FONT, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 16, justifyContent: 'center' },
  card: { width: 100, height: 120, backgroundColor: COLORS.bgAlt, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  cardActive: { borderColor: COLORS.teal },
  cardPreview: { backgroundColor: COLORS.card },
  cardSprite: { height: 72, justifyContent: 'center' },
  cardLock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cardLockTxt: { fontSize: 26 },
  cardName: { fontFamily: FONT, color: COLORS.text, fontSize: 12, fontWeight: '600', marginTop: 4 },
  cardBadge: { position: 'absolute', top: 6, right: 8, color: COLORS.teal, fontWeight: '700', fontSize: 16 },
});
