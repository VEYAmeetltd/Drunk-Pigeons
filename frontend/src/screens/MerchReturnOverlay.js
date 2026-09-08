import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { verifyMerchCheckoutSession } from '../merch/checkoutClient';

// Success/cancel/unknown return states for the DP Merch checkout handoff.
// CRITICAL: a "success" deep-link is NEVER treated as proof of payment on its
// own — the backend's verify response is the only source of truth. Until a
// real backend contract exists, verify always resolves not-ok, so this
// correctly shows "we'll confirm shortly" rather than a fake "ORDER CONFIRMED".
export default function MerchReturnOverlay({ status, sessionId, devPreview, onDone }) {
  const [verifying, setVerifying] = useState(status === 'success' && !devPreview);
  const [confirmed, setConfirmed] = useState(!!devPreview);

  useEffect(() => {
    if (status !== 'success' || devPreview) return;
    let cancelled = false;
    verifyMerchCheckoutSession(sessionId).then((res) => {
      if (cancelled) return;
      setConfirmed(!!(res && res.ok));
      setVerifying(false);
    });
    return () => { cancelled = true; };
  }, [status, sessionId, devPreview]);

  return (
    <View style={styles.root} testID="merch-return-overlay">
      {devPreview && <Text style={styles.devTag}>DEV PREVIEW — NOT A REAL ORDER</Text>}

      {status === 'cancel' && (
        <>
          <Text style={styles.kicker}>CHECKOUT CANCELLED</Text>
          <Text style={styles.body}>No charge was made — your hoodie is still waiting for you whenever you're ready.</Text>
        </>
      )}

      {status === 'success' && verifying && (
        <>
          <ActivityIndicator size="large" color={COLORS.yellow} style={{ marginBottom: 18 }} />
          <Text style={styles.kicker}>CONFIRMING YOUR ORDER…</Text>
          <Text style={styles.body}>Hang tight, we're checking this with the till.</Text>
        </>
      )}

      {status === 'success' && !verifying && confirmed && (
        <>
          <Text style={styles.kickerYellow}>ORDER CONFIRMED</Text>
          <Text style={styles.body}>One chaos-grade hoodie is on its way to you. Wear it responsibly. Or don't.</Text>
        </>
      )}

      {status === 'success' && !verifying && !confirmed && (
        <>
          <Text style={styles.kicker}>WE'LL CONFIRM THIS SHORTLY</Text>
          <Text style={styles.body}>If your payment went through, a receipt will land in your email soon. Not sure? Reach us at support@intiesltd.com.</Text>
        </>
      )}

      <Button testID="merch-return-done" label="BACK TO STORE" variant="primary" onPress={onDone} style={{ marginTop: 26, width: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  devTag: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, letterSpacing: 2, marginBottom: 20 },
  kicker: { fontFamily: FONT, color: COLORS.pink, fontSize: 20, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  kickerYellow: { fontFamily: FONT, color: COLORS.yellow, fontSize: 24, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  body: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
});
