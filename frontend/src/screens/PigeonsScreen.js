import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import DrunkPigeon from '../components/DrunkPigeon';
import { PIGEONS } from '../data/pigeons';
import { Audio } from '../audio/audio';
import { entitlementFor, allPremiumUnlocked } from '../store/entitlements';
import { DEFAULT_PRICES } from '../store/products';
import { Billing } from '../store/billing';

export default function PigeonsScreen({
  selectedPigeon,
  unlockedPigeons,
  leetUnlock,
  purchasedPigeons = [],
  bundleOwned = false,
  removeAdsOwned = false,
  removeAdsPrice = '£2.99',
  drunkStrength = 1,
  onSelect,
  onBuyPigeon,
  onBuyBundle,
  onBuyRemoveAds,
  onRestore,
  onBack,
  onOpenPurchaseTerms,
}) {
  const [preview, setPreview] = useState(selectedPigeon);
  const [sheet, setSheet] = useState(null); // { kind:'pigeon'|'bundle', id, price }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');

  const ent = { purchased: purchasedPigeons, bundleOwned, leetUnlock };
  const ownedBundle = allPremiumUnlocked(PIGEONS, ent);
  const previewP = PIGEONS.find((p) => p.id === preview) || PIGEONS[0];
  const previewEnt = entitlementFor(previewP, ent);

  const openPigeonSheet = (id) => {
    Audio.ui();
    setMsg('');
    setSheet({ kind: 'pigeon', id, price: Billing.priceFor(Billing.products.pigeons[id]) || DEFAULT_PRICES.pigeon });
  };
  const openBundleSheet = () => {
    Audio.ui();
    setMsg('');
    setSheet({ kind: 'bundle', price: Billing.priceFor(Billing.products.bundle) || DEFAULT_PRICES.bundle });
  };
  const openRemoveAdsSheet = () => {
    Audio.ui();
    setMsg('');
    setSheet({ kind: 'removeads', price: Billing.priceFor(Billing.products.removeads) || removeAdsPrice });
  };
  const closeSheet = () => {
    setSheet(null);
    setBusy(false);
    setMsg('');
  };

  const runPurchase = async (devOutcome) => {
    if (busy || !sheet) return;
    setBusy(true);
    setMsg('');
    let status;
    if (sheet.kind === 'bundle') status = await onBuyBundle(devOutcome);
    else if (sheet.kind === 'removeads') status = await onBuyRemoveAds(devOutcome);
    else status = await onBuyPigeon(sheet.id, devOutcome);
    setBusy(false);
    if (status === 'success') {
      Audio.highscore();
      closeSheet();
    } else if (status === 'cancelled') {
      closeSheet(); // return cleanly, unlock nothing
    } else {
      Audio.crash();
      setMsg("PURCHASE COULDN'T BE COMPLETED");
    }
  };

  const doRestore = async () => {
    Audio.ui();
    const n = await onRestore();
    setRestoreMsg(n > 0 ? `RESTORED ${n} PURCHASE${n === 1 ? '' : 'S'}` : 'NOTHING TO RESTORE');
  };

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

      {/* Preview panel */}
      <View style={styles.previewCard}>
        <View style={styles.previewSprite}>
          <DrunkPigeon pigeon={previewP} fatLevel={1} size={130} intensity="full" eyes strength={drunkStrength} testID={`preview-pigeon-${previewP.id}`} />
          {!previewEnt.canUse && (
            <View style={styles.previewLock} testID="preview-lock">
              <Text style={styles.lockEmoji}>LOCKED</Text>
            </View>
          )}
        </View>
        <Text style={styles.previewName}>{previewP.name}</Text>
        <Text style={styles.previewTag}>{previewP.tagline}</Text>
        {previewEnt.canUse ? (
          selectedPigeon === previewP.id ? (
            <Text style={[styles.previewState, { color: COLORS.teal }]}>SELECTED</Text>
          ) : (
            <Button testID="select-pigeon" label="SELECT" variant="teal" small onPress={() => onSelect(previewP.id)} style={{ marginTop: 8 }} />
          )
        ) : (
          <Button
            testID="preview-unlock"
            label={`UNLOCK — ${DEFAULT_PRICES.pigeon}`}
            variant="primary"
            small
            onPress={() => openPigeonSheet(previewP.id)}
            style={{ marginTop: 8 }}
          />
        )}
      </View>

      {/* Unlock All bundle */}
      {!ownedBundle && (
        <Pressable testID="unlock-all-button" onPress={openBundleSheet} style={styles.bundle}>
          <View>
            <Text style={styles.bundleTitle}>UNLOCK ALL 5 — {DEFAULT_PRICES.bundle}</Text>
            <Text style={styles.bundleSave}>SAVE {DEFAULT_PRICES.bundleSave}</Text>
          </View>
          <Text style={styles.bundleChevron}>›</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {PIGEONS.map((p) => {
          const e = entitlementFor(p, ent);
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
                <DrunkPigeon pigeon={p} fatLevel={0} size={70} intensity="calm" eyes={false} strength={drunkStrength} testID={`grid-pigeon-${p.id}`} />
                {!e.canUse && (
                  <View style={styles.cardLock}>
                    <Text style={styles.cardLockTxt}>🔒</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{p.name.replace(' Pigeon', '')}</Text>
              {e.canUse ? (
                active && <Text style={styles.cardBadge}>✓</Text>
              ) : (
                <Text style={styles.cardPrice} testID={`price-${p.id}`}>{DEFAULT_PRICES.pigeon}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable testID="restore-purchases" onPress={doRestore} style={styles.restore}>
        <Text style={styles.restoreTxt}>RESTORE PURCHASES</Text>
      </Pressable>
      {!!restoreMsg && (
        <Text style={styles.restoreMsg} testID="restore-msg">{restoreMsg}</Text>
      )}

      {/* Remove Ads — unobtrusive permanent purchase */}
      {removeAdsOwned ? (
        <View style={styles.removeAdsRow} testID="remove-ads-owned">
          <Text style={styles.removeAdsOwnedTxt}>ADS REMOVED ✓</Text>
        </View>
      ) : (
        <Pressable testID="remove-ads-button" onPress={openRemoveAdsSheet} style={styles.removeAdsRow}>
          <Text style={styles.removeAdsTitle} testID="remove-ads-price">REMOVE ADS — {removeAdsPrice}</Text>
          <Text style={styles.removeAdsSub}>no interstitials · optional revive stays</Text>
        </Pressable>
      )}

      <Pressable testID="store-purchase-terms" onPress={() => { Audio.ui(); onOpenPurchaseTerms && onOpenPurchaseTerms(); }} style={styles.termsLink}>
        <Text style={styles.termsLinkTxt}>Purchase terms</Text>
      </Pressable>

      {/* Purchase sheet (native flow placeholder + DEV simulator) */}
      {sheet && (
        <View style={styles.sheetOverlay} testID="purchase-sheet" onStartShouldSetResponder={() => true}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {sheet.kind === 'bundle' ? 'UNLOCK ALL 5 PIGEONS' : sheet.kind === 'removeads' ? 'REMOVE ADS' : `UNLOCK ${(PIGEONS.find((p) => p.id === sheet.id) || {}).name || ''}`}
            </Text>
            <Text style={styles.sheetPrice}>{sheet.price}</Text>
            <Text style={styles.sheetNote}>
              {Billing.platform === 'ios' ? 'Billed via the App Store' : Billing.platform === 'android' ? 'Billed via Google Play' : 'Billed via your app store'}
            </Text>
            {!!msg && <Text style={styles.sheetError} testID="purchase-error">{msg}</Text>}

            {Billing.isDev ? (
              <>
                <Text style={styles.devTag}>DEV SIMULATOR</Text>
                <Button testID="sim-success" label={busy ? '…' : 'Simulate Success'} variant="teal" small onPress={() => runPurchase('success')} style={styles.sheetBtn} />
                <View style={styles.simRow}>
                  <Button testID="sim-cancel" label="Cancelled" variant="ghost" small onPress={() => runPurchase('cancelled')} style={{ flex: 1 }} />
                  <Button testID="sim-fail" label="Failed" variant="ghost" small onPress={() => runPurchase('failed')} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <Button testID="purchase-confirm" label="BUY" variant="primary" onPress={() => runPurchase('success')} style={styles.sheetBtn} />
            )}
            <Button testID="purchase-cancel" label="Close" variant="ghost" small onPress={closeSheet} style={styles.sheetBtn} />
            <Pressable testID="sheet-purchase-terms" onPress={() => { Audio.ui(); onOpenPurchaseTerms && onOpenPurchaseTerms(); }} style={styles.termsLink}>
              <Text style={styles.termsLinkTxt}>Purchase terms</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 30, fontWeight: '700', letterSpacing: 2 },
  leetBadge: { width: 70, textAlign: 'right', fontFamily: FONT, color: COLORS.pink, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  previewCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 14, alignItems: 'center', marginTop: 10 },
  previewSprite: { height: 132, justifyContent: 'center', alignItems: 'center' },
  previewLock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,16,48,0.55)', borderRadius: 16 },
  lockEmoji: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 20, letterSpacing: 3 },
  previewName: { fontFamily: FONT, color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  previewTag: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, marginTop: 2, fontStyle: 'italic' },
  previewState: { fontFamily: FONT, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 10 },
  bundle: { marginTop: 12, backgroundColor: COLORS.bgAlt, borderRadius: 16, borderWidth: 2, borderColor: COLORS.yellow, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bundleTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  bundleSave: { fontFamily: FONT, color: COLORS.teal, fontSize: 13, fontWeight: '700', marginTop: 2 },
  bundleChevron: { fontFamily: FONT, color: COLORS.yellow, fontSize: 30, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 14, justifyContent: 'center' },
  card: { width: 100, height: 120, backgroundColor: COLORS.bgAlt, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  cardActive: { borderColor: COLORS.teal },
  cardPreview: { backgroundColor: COLORS.card },
  cardSprite: { height: 72, justifyContent: 'center' },
  cardLock: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cardLockTxt: { fontSize: 26 },
  cardName: { fontFamily: FONT, color: COLORS.text, fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardPrice: { fontFamily: FONT, color: COLORS.yellow, fontSize: 13, fontWeight: '700', marginTop: 2 },
  cardBadge: { position: 'absolute', top: 6, right: 8, color: COLORS.teal, fontWeight: '700', fontSize: 16 },
  restore: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginBottom: 6, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  restoreTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 2, textDecorationLine: 'underline' },
  restoreMsg: { fontFamily: FONT, color: COLORS.teal, fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'center', marginTop: -2, marginBottom: 8 },
  removeAdsRow: { alignSelf: 'center', alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 22, marginBottom: 12 },
  removeAdsTitle: { fontFamily: FONT, color: COLORS.text, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  removeAdsSub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 10, marginTop: 2 },
  removeAdsOwnedTxt: { fontFamily: FONT, color: COLORS.teal, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,8,30,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 60 },
  sheet: { width: '100%', maxWidth: 340, backgroundColor: COLORS.card, borderRadius: 24, padding: 22, alignItems: 'center' },
  sheetTitle: { fontFamily: FONT, color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sheetPrice: { fontFamily: FONT, color: COLORS.yellow, fontSize: 34, fontWeight: '700', marginTop: 6 },
  sheetNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 4 },
  sheetError: { fontFamily: FONT, color: COLORS.pink, fontSize: 14, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  devTag: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, letterSpacing: 2, marginTop: 14 },
  sheetBtn: { width: '100%', marginTop: 10 },
  simRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
  termsLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 },
  termsLinkTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '600', letterSpacing: 1, textDecorationLine: 'underline' },
});
