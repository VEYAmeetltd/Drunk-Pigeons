import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { checkOrderStatus } from '../merch/checkoutClient';
import { Persistence } from '../storage/persistence';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 6; // ~15s bounded window — a sensible, non-aggressive cadence

// Post-checkout return screen. A Stripe redirect (success OR cancel) is
// NEVER treated as proof of payment by itself — the public order-status
// endpoint (GET /merch/orders/{id}/status?token=...) is the only source of
// truth, checked using the order_id + status_token this app stored locally
// right before opening Stripe Checkout (see MerchProductScreen.js). Success
// gets a short, bounded poll to ride out normal webhook lag; it only ever
// shows "confirmed" on an authoritative paid response.
export default function MerchReturnOverlay({ status, devPreview, onDone }) {
  // checking | confirmed | pending-timeout | failed | expired | cancelled | refunded | unavailable
  const [phase, setPhase] = useState(devPreview ? 'confirmed' : 'checking');
  const attemptsRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (devPreview) return undefined;
    let cancelled = false;
    const finish = (next) => { if (!cancelled) setPhase(next); };

    const poll = async () => {
      const pending = await Persistence.getPendingMerchOrder();
      if (cancelled) return;
      if (!pending) { finish('unavailable'); return; }

      const res = await checkOrderStatus({ orderId: pending.orderId, statusToken: pending.statusToken });
      if (cancelled) return;

      if (!res.ok) {
        // 404 (bad/expired token or unknown order) or network failure — never retry indefinitely.
        Persistence.clearPendingMerchOrder();
        finish('unavailable');
        return;
      }

      const p = res.paymentStatus;
      if (p === 'paid') { Persistence.clearPendingMerchOrder(); finish('confirmed'); return; }
      if (p === 'failed') { Persistence.clearPendingMerchOrder(); finish('failed'); return; }
      if (p === 'expired') { Persistence.clearPendingMerchOrder(); finish('expired'); return; }
      if (p === 'cancelled') { Persistence.clearPendingMerchOrder(); finish('cancelled'); return; }
      if (p === 'refunded') { Persistence.clearPendingMerchOrder(); finish('refunded'); return; }

      // payment_status still "pending". A genuine cancel-return from Stripe
      // doesn't need a poll loop — show the plain cancelled message once.
      if (status === 'cancel') { finish('cancelled'); return; }

      attemptsRef.current += 1;
      if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
        // Leave the pending order stored — reopening the app later could still resolve it.
        finish('pending-timeout');
        return;
      }
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => { cancelled = true; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [status, devPreview]);

  return (
    <View style={styles.root} testID="merch-return-overlay">
      {devPreview && <Text style={styles.devTag}>DEV PREVIEW — NOT A REAL ORDER</Text>}

      {phase === 'checking' && (
        <>
          <ActivityIndicator size="large" color={COLORS.yellow} style={{ marginBottom: 18 }} />
          <Text style={styles.kicker} testID="merch-return-confirming">CONFIRMING YOUR PAYMENT…</Text>
          <Text style={styles.body}>Hang tight, we're checking this with the till.</Text>
        </>
      )}

      {phase === 'confirmed' && (
        <>
          <Text style={styles.kickerYellow} testID="merch-return-confirmed">ORDER CONFIRMED</Text>
          <Text style={styles.body}>One chaos-grade hoodie is on its way to you. Wear it responsibly. Or don't.</Text>
        </>
      )}

      {phase === 'pending-timeout' && (
        <>
          <Text style={styles.kicker} testID="merch-return-pending">STILL CONFIRMING</Text>
          <Text style={styles.body}>Payment received — still confirming. You can safely return to the game.</Text>
        </>
      )}

      {phase === 'failed' && (
        <>
          <Text style={styles.kicker} testID="merch-return-failed">PAYMENT FAILED</Text>
          <Text style={styles.body}>Your payment didn't go through — no charge was made. Feel free to try again.</Text>
        </>
      )}

      {phase === 'expired' && (
        <>
          <Text style={styles.kicker} testID="merch-return-expired">CHECKOUT EXPIRED</Text>
          <Text style={styles.body}>That checkout link timed out — head back to the store to grab a fresh price.</Text>
        </>
      )}

      {phase === 'cancelled' && (
        <>
          <Text style={styles.kicker} testID="merch-return-cancelled">CHECKOUT CANCELLED</Text>
          <Text style={styles.body}>No charge was made — your hoodie is still waiting for you whenever you're ready.</Text>
        </>
      )}

      {phase === 'refunded' && (
        <>
          <Text style={styles.kicker} testID="merch-return-refunded">ORDER REFUNDED</Text>
          <Text style={styles.body}>This order has been refunded. Reach us at support@intiesltd.com if that's unexpected.</Text>
        </>
      )}

      {phase === 'unavailable' && (
        <>
          <Text style={styles.kicker} testID="merch-return-unavailable">WE CAN'T CONFIRM THIS RIGHT NOW</Text>
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
