import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';

export default function GameOverOverlay({
  message,
  score,
  best,
  chips,
  isNewBest,
  canRevive,
  onPlayAgain,
  onRevive,
  onMenu,
}) {
  return (
    <View style={styles.overlay} testID="game-over-overlay">
      <View style={styles.card}>
        <Text style={styles.dead}>SPLAT!</Text>
        <Text style={styles.msg} testID="death-message">{message}</Text>

        {isNewBest && <Text style={styles.newBest} testID="new-best-badge">NEW BEST!</Text>}

        <View style={styles.rows}>
          <Row label="SCORE" value={score} color={COLORS.yellow} testID="go-score" />
          <Row label="BEST" value={best} color={COLORS.teal} testID="go-best" />
          <Row label="CHIPS EATEN" value={chips} color={COLORS.pink} testID="go-chips" />
        </View>

        <Button testID="play-again-button" label="PLAY AGAIN" variant="primary" onPress={onPlayAgain} style={styles.btn} />
        <Button
          testID="revive-button"
          label={canRevive ? 'REVIVE (dev)' : 'REVIVE USED'}
          variant={canRevive ? 'teal' : 'ghost'}
          onPress={canRevive ? onRevive : undefined}
          style={[styles.btn, !canRevive && { opacity: 0.5 }]}
        />
        {canRevive && <Text style={styles.devNote}>dev revive · ad hook ready</Text>}
        <Button testID="menu-button" label="MAIN MENU" variant="ghost" onPress={onMenu} style={styles.btn} />
      </View>
    </View>
  );
}

function Row({ label, value, color, testID }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text testID={testID} style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,8,30,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: COLORS.card, borderRadius: 24, padding: 24, alignItems: 'center' },
  dead: { fontFamily: FONT, color: COLORS.pink, fontSize: 46, fontWeight: '700', letterSpacing: 2 },
  msg: { fontFamily: FONT, color: COLORS.text, fontSize: 18, textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  newBest: { fontFamily: FONT, color: COLORS.yellow, fontSize: 16, fontWeight: '700', marginTop: 10, letterSpacing: 2 },
  rows: { width: '100%', marginVertical: 16, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  rowLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  rowValue: { fontFamily: FONT, fontSize: 24, fontWeight: '700' },
  btn: { width: '100%', marginTop: 10 },
  devNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, marginTop: 4 },
});
