import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { loadMerchCatalogue, MERCH_STORE_INFO } from '../merch/products';
import { Audio } from '../audio/audio';

// In-game DP Merch storefront — mirrors the visual identity of the live
// website (https://intiesltd.com/DPmerch): dark background, pink/yellow DP
// accents, white product-photo tiles, bold all-caps taglines. Catalogue/price
// is fetched live from the real merch backend (see ../merch/products.js).
export default function MerchScreen({ onBack, onOpenProduct, isDev, onDevPreviewReturn }) {
  const [products, setProducts] = useState(null); // null = loading
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setProducts(null);
    loadMerchCatalogue()
      .then((list) => setProducts(list))
      .catch(() => { setProducts(null); setError(true); });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack && onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="merch-screen">
      <View style={styles.header}>
        <Button testID="merch-back" label="‹ BACK" variant="ghost" small onPress={onBack} />
        <Text style={styles.headerTitle}>DP MERCH</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroWrap, styles.heroWrapTop]}>
          <Text style={styles.headlineShadow}>{MERCH_STORE_INFO.headline}</Text>
          <Text style={styles.headline}>{MERCH_STORE_INFO.headline}</Text>
        </View>
        <Text style={styles.subhead}>{MERCH_STORE_INFO.subhead}</Text>

        <View style={styles.badgeRow}>
          {MERCH_STORE_INFO.badges.map((b) => (
            <View key={b} style={styles.badge}><Text style={styles.badgeTxt}>{b}</Text></View>
          ))}
        </View>

        {products === null && !error && (
          <View style={styles.stateBox} testID="merch-loading">
            <ActivityIndicator size="large" color={COLORS.yellow} />
            <Text style={styles.stateTxt}>Loading the flock's finest...</Text>
          </View>
        )}

        {error && (
          <View style={styles.stateBox} testID="merch-error">
            <Text style={styles.stateTxt}>Couldn't load the store — check your connection.</Text>
            <Button testID="merch-retry" label="RETRY" variant="ghost" small onPress={load} style={{ marginTop: 12 }} />
          </View>
        )}

        {products && products.map((p) => (
          <Pressable
            key={p.id}
            testID={`merch-product-card-${p.id}`}
            onPress={() => { Audio.ui(); onOpenProduct(p.id); }}
            style={styles.card}
            accessibilityRole="button"
          >
            <View style={styles.photoTile}>
              <Image source={{ uri: p.images.front }} style={styles.photo} resizeMode="contain" />
            </View>
            <Text style={styles.cardTagline} numberOfLines={2}>{p.tagline}</Text>
            <Text style={styles.cardName}>{p.name}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>{p.color} · {p.fit}</Text>
              <Text style={styles.cardPrice} testID={`merch-price-${p.id}`}>{p.priceLabel}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.noteKicker}>{MERCH_STORE_INFO.note.kicker}</Text>
        {MERCH_STORE_INFO.note.paragraphs.map((para, i) => (
          <Text key={i} style={styles.noteBody}>{para}</Text>
        ))}

        <Text style={styles.footer}>Published by INTIES LTD. · Physical merchandise, sold and fulfilled separately from in-app purchases.</Text>

        {isDev && (
          <Pressable testID="merch-dev-preview-return" onPress={onDevPreviewReturn} style={styles.devPreviewBtn}>
            <Text style={styles.devPreviewTxt}>DEV: PREVIEW ORDER-CONFIRMED SCREEN</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  headerTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 36 },
  heroWrap: { width: '100%', marginTop: 6, alignItems: 'center' },
  heroWrapTop: { marginTop: 16 },
  headline: { width: '100%', fontFamily: FONT, color: COLORS.yellow, fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 1 },
  headlineShadow: { position: 'absolute', top: 3, left: 0, width: '100%', fontFamily: FONT, color: COLORS.pink, fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 1, opacity: 0.5 },
  subhead: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14, marginBottom: 6 },
  badge: { backgroundColor: COLORS.card, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  badgeTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '600' },
  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  stateTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, textAlign: 'center', marginTop: 12 },
  card: { backgroundColor: COLORS.card, borderRadius: 20, padding: 14, marginTop: 16 },
  photoTile: { backgroundColor: '#ffffff', borderRadius: 16, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  cardTagline: { fontFamily: FONT, color: COLORS.pink, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 12 },
  cardName: { fontFamily: FONT, color: COLORS.text, fontSize: 19, fontWeight: '700', marginTop: 4 },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  cardMeta: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12 },
  cardPrice: { fontFamily: FONT, color: COLORS.yellow, fontSize: 18, fontWeight: '700' },
  noteKicker: { fontFamily: FONT, color: COLORS.teal, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 28 },
  noteBody: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, lineHeight: 20, marginTop: 10 },
  footer: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  devPreviewBtn: { marginTop: 18, alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  devPreviewTxt: { fontFamily: FONT, color: 'rgba(199,184,230,0.5)', fontSize: 11, letterSpacing: 1, textAlign: 'center' },
});
