import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, BackHandler, TextInput, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { Audio } from '../audio/audio';
import { requestMerchQuote, requestMerchCheckout } from '../merch/checkoutClient';
import { formatMinor } from '../merch/products';
import { Persistence } from '../storage/persistence';

const VIEWS = [
  { key: 'front', label: 'FRONT' },
  { key: 'back', label: 'BACK' },
  { key: 'left', label: 'LEFT' },
  { key: 'right', label: 'RIGHT' },
];

const DESTINATION_COUNTRY = 'GB'; // only destination the backend currently returns

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mobile product-detail view for one hoodie. Fetches an authoritative price
// quote (POST /merch/quotes) the moment a size is picked, then hands off to
// the real Stripe backend via requestMerchCheckout() — DP never estimates
// price client-side and never invents a checkout URL (see checkoutClient.js).
export default function MerchProductScreen({ product, onBack }) {
  const [view, setView] = useState('front');
  const [size, setSize] = useState(null);
  const [email, setEmail] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const reqSeq = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack && onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const fetchQuote = useCallback((chosenSize) => {
    if (!product || !chosenSize) return;
    const seq = ++reqSeq.current;
    setQuoteBusy(true);
    setQuoteError(false);
    setQuote(null);
    setNotice('');
    requestMerchQuote({ productId: product.id, size: chosenSize, quantity: 1, destinationCountry: DESTINATION_COUNTRY })
      .then((res) => {
        if (seq !== reqSeq.current) return; // stale response from a size changed mid-flight
        setQuoteBusy(false);
        if (res.ok) setQuote(res.quote);
        else setQuoteError(true);
      });
  }, [product]);

  const chooseSize = (s) => {
    Audio.ui();
    setSize(s);
    fetchQuote(s);
  };

  if (!product) return null;

  const isQuoteExpired = () => !quote || (quote.expires_at && new Date(quote.expires_at).getTime() <= Date.now());

  const runCheckout = async () => {
    if (!size || checkoutBusy || quoteBusy) return;
    if (!EMAIL_RE.test(email.trim())) { setNotice('Enter a valid email to continue.'); return; }
    setCheckoutBusy(true);
    setNotice('');
    Audio.ui();

    let activeQuote = quote;
    if (isQuoteExpired()) {
      const refreshed = await requestMerchQuote({ productId: product.id, size, quantity: 1, destinationCountry: DESTINATION_COUNTRY });
      if (!refreshed.ok) { setCheckoutBusy(false); setNotice("Couldn't refresh the price — please try again."); return; }
      activeQuote = refreshed.quote;
      setQuote(activeQuote);
    }

    const res = await requestMerchCheckout({ quoteId: activeQuote.id, contactEmail: email.trim() });
    setCheckoutBusy(false);
    if (res.ok && res.checkoutUrl) {
      // Stored BEFORE opening Stripe so the deep-link return can poll order
      // status even if the app is fully killed while the user pays in the
      // external browser (see Persistence.getPendingMerchOrder in
      // MerchReturnOverlay.js). Never logged — status_token stays local-only.
      Persistence.setPendingMerchOrder({ orderId: res.orderId, statusToken: res.statusToken });
      Linking.openURL(res.checkoutUrl);
      return;
    }
    if (res.reason === 'unavailable') {
      setNotice('Checkout is temporarily unavailable — please check back soon.');
    } else if (res.reason === 'network') {
      setNotice("Can't reach the store right now — check your connection and try again.");
    } else {
      setNotice('Something went wrong — please try again.');
    }
  };

  const canBuy = size && quote && !quoteBusy && !checkoutBusy && !quoteError;

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
            <Pressable key={s} testID={`merch-size-${s}`} onPress={() => chooseSize(s)} style={[styles.sizePill, size === s && styles.sizePillActive]}>
              <Text style={[styles.sizePillTxt, size === s && styles.sizePillTxtActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        {!!size && (
          <View style={styles.quoteBox} testID="merch-quote-box">
            {quoteBusy && (
              <View style={styles.quoteLoading}>
                <ActivityIndicator size="small" color={COLORS.textDim} />
                <Text style={styles.quoteLoadingTxt}>Getting your price...</Text>
              </View>
            )}
            {!quoteBusy && quoteError && (
              <View>
                <Text style={styles.quoteErrorTxt} testID="merch-quote-error">Couldn't get a price quote — check your connection.</Text>
                <Button testID="merch-quote-retry" label="RETRY" variant="ghost" small onPress={() => fetchQuote(size)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
              </View>
            )}
            {!quoteBusy && !quoteError && quote && (
              <>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Subtotal</Text>
                  <Text style={styles.quoteValue} testID="merch-quote-subtotal">{formatMinor(quote.subtotal_minor, quote.currency)}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{quote.shipping.label}</Text>
                  <Text style={styles.quoteValue} testID="merch-quote-shipping">{formatMinor(quote.shipping.amount_minor, quote.currency)}</Text>
                </View>
                <View style={[styles.quoteRow, styles.quoteTotalRow]}>
                  <Text style={styles.quoteTotalLabel}>Total</Text>
                  <Text style={styles.quoteTotalValue} testID="merch-quote-total">{formatMinor(quote.total_minor, quote.currency)}</Text>
                </View>
              </>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>YOUR EMAIL (for order confirmation)</Text>
        <TextInput
          testID="merch-email-input"
          style={styles.emailInput}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#8a7bb5"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        {!!notice && <Text style={styles.notice} testID="merch-checkout-notice">{notice}</Text>}

        <Button
          testID="merch-buy-now"
          label={checkoutBusy ? '…' : quote ? `BUY NOW — ${formatMinor(quote.total_minor, quote.currency)}` : size ? 'SELECT A SIZE' : 'SELECT A SIZE'}
          variant={canBuy ? 'primary' : 'ghost'}
          disabled={!canBuy}
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
  quoteBox: { marginTop: 16, backgroundColor: COLORS.card, borderRadius: 16, padding: 14 },
  quoteLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quoteLoadingTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13 },
  quoteErrorTxt: { fontFamily: FONT, color: COLORS.pink, fontSize: 13 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  quoteLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13 },
  quoteValue: { fontFamily: FONT, color: COLORS.text, fontSize: 13, fontWeight: '600' },
  quoteTotalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  quoteTotalLabel: { fontFamily: FONT, color: COLORS.text, fontSize: 15, fontWeight: '700' },
  quoteTotalValue: { fontFamily: FONT, color: COLORS.yellow, fontSize: 17, fontWeight: '700' },
  emailInput: { fontFamily: FONT, color: COLORS.text, fontSize: 15, backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 },
  notice: { fontFamily: FONT, color: COLORS.pink, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  deliveryNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14, fontStyle: 'italic' },
});
