import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { Audio } from '../audio/audio';
import { requestMerchCheckout } from '../merch/checkoutClient';

const VIEWS = [
  { key: 'front', label: 'FRONT' },
  { key: 'back', label: 'BACK' },
  { key: 'left', label: 'LEFT' },
  { key: 'right', label: 'RIGHT' },
];

// Mobile product-detail view for one hoodie. Purchase CTA hands off to the
// separately-implemented Stripe backend via requestMerchCheckout() — DP never
// invents an endpoint, a Stripe URL, or a card-entry form (see checkoutClient.js).
export default function MerchProductScreen({ product, onBack }) {
  const [view, setView] = useState('front');
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack && onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  if (!product) return null;

  const runCheckout = async () => {
    if (!size || busy) return;
    setBusy(true);
    setNotice('');
    Audio.ui();
    const res = await requestMerchCheckout({ productId: product.id, size, quantity: qty });
    setBusy(false);
    if (!res || !res.ok) {
      // Honest, on-brand version of the same "checkout being connected" state
      // the live website itself currently shows — never a fake success, never
      // a generic crash-y error.
      setNotice("Checkout is being connected — check back soon.");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="merch-product-screen">
      <View style={styles.header}>
        <Button testID="merch-product-back" label="‹ STORE" variant="ghost" small onPress={onBack} />
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.photoTile}>
          <Image source={{ uri: product.images[view] }} style={styles.photo} resizeMode="contain" />
        </View>
        <View style={styles.viewTabs}>
          {VIEWS.map((v) => (
            <Pressable key={v.key} testID={`merch-view-${v.key}`} onPress={() => setView(v.key)} style={[styles.viewTab, view === v.key && styles.viewTabActive]}>
              <Text style={[styles.viewTabTxt, view === v.key && styles.viewTabTxtActive]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.tagline}>{product.tagline}</Text>
        <Text style={styles.name}>{product.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{product.color} · {product.fit}</Text>
          <Text style={styles.price}>{product.priceLabel}</Text>
        </View>

        {product.description.split('\n\n').map((para, i) => (
          <Text key={i} style={styles.paragraph}>{para}</Text>
        ))}

        <View style={styles.features}>
          {product.features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureBullet}>◆</Text>
              <Text style={styles.featureTxt}>{f}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>CHOOSE YOUR SIZE</Text>
        <View style={styles.sizeRow}>
          {product.sizes.map((s) => (
            <Pressable key={s} testID={`merch-size-${s}`} onPress={() => { Audio.ui(); setSize(s); }} style={[styles.sizePill, size === s && styles.sizePillActive]}>
              <Text style={[styles.sizePillTxt, size === s && styles.sizePillTxtActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>QUANTITY</Text>
        <View style={styles.qtyRow}>
          <Pressable testID="merch-qty-minus" onPress={() => { Audio.ui(); setQty((q) => Math.max(1, q - 1)); }} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnTxt}>−</Text>
          </Pressable>
          <Text style={styles.qtyValue} testID="merch-qty-value">{qty}</Text>
          <Pressable testID="merch-qty-plus" onPress={() => { Audio.ui(); setQty((q) => Math.min(9, q + 1)); }} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnTxt}>+</Text>
          </Pressable>
        </View>

        {!!notice && <Text style={styles.notice} testID="merch-checkout-notice">{notice}</Text>}

        <Button
          testID="merch-buy-now"
          label={busy ? '…' : size ? `BUY NOW — ${product.priceLabel}` : 'SELECT A SIZE'}
          variant={size ? 'primary' : 'ghost'}
          disabled={!size || busy}
          onPress={runCheckout}
          style={{ width: '100%', marginTop: 18 }}
        />

        <Text style={styles.deliveryNote}>{product.deliveryNote}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 40 },
  photoTile: { backgroundColor: '#ffffff', borderRadius: 20, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  viewTabs: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  viewTab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: COLORS.card },
  viewTabActive: { backgroundColor: COLORS.pink },
  viewTabTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  viewTabTxtActive: { color: '#3a0620' },
  tagline: { fontFamily: FONT, color: COLORS.pink, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, textAlign: 'center' },
  name: { fontFamily: FONT, color: COLORS.yellow, fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 8 },
  meta: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13 },
  price: { fontFamily: FONT, color: COLORS.text, fontSize: 20, fontWeight: '700' },
  paragraph: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, lineHeight: 21, marginTop: 14 },
  features: { marginTop: 16, backgroundColor: COLORS.card, borderRadius: 16, padding: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
  featureBullet: { color: COLORS.teal, fontSize: 10, marginTop: 4 },
  featureTxt: { flex: 1, fontFamily: FONT, color: COLORS.text, fontSize: 13, lineHeight: 19 },
  sectionLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 22, marginBottom: 10 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sizePill: { minWidth: 52, minHeight: 44, borderRadius: 22, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  sizePillActive: { borderColor: COLORS.yellow },
  sizePillTxt: { fontFamily: FONT, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  sizePillTxtActive: { color: COLORS.yellow },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center' },
  qtyBtnTxt: { fontFamily: FONT, color: COLORS.text, fontSize: 20, fontWeight: '700' },
  qtyValue: { fontFamily: FONT, color: COLORS.text, fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  notice: { fontFamily: FONT, color: COLORS.pink, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  deliveryNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14, fontStyle: 'italic' },
});
