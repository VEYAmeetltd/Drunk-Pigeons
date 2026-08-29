import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { LeaderboardAPI } from '../leaderboard/api';
import { formatInt } from '../config';
import { Audio } from '../audio/audio';

export default function LeaderboardScreen({ playerId, nickname, onSetNickname, onBack }) {
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [top, setTop] = useState([]);
  const [you, setYou] = useState(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await LeaderboardAPI.top(playerId);
    if (!res || !res.ok) {
      setOffline(true);
    } else {
      setOffline(false);
      setTop(res.top || []);
      setYou(res.you || null);
    }
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitName = async () => {
    setErr('');
    setSaving(true);
    const res = await onSetNickname(name);
    setSaving(false);
    if (res && res.ok) {
      Audio.ui();
      load();
    } else if (res && res.offline) {
      setErr('LEADERBOARD UNAVAILABLE');
    } else {
      setErr('TRY ANOTHER NAME, PIGEON.');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Button testID="leaderboard-back" label="BACK" variant="ghost" small onPress={onBack} />
        <Text style={styles.title}>🏆 GLOBAL</Text>
        <View style={{ width: 70 }} />
      </View>

      {!nickname && !offline && (
        <View style={styles.nameCard}>
          <Text style={styles.nameLabel}>PICK A LEADERBOARD NAME</Text>
          <TextInput
            testID="nickname-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. FatPigeon69"
            placeholderTextColor="#8a7bb5"
            maxLength={16}
            autoCorrect={false}
            onSubmitEditing={submitName}
          />
          {!!err && <Text style={styles.err} testID="nickname-error">{err}</Text>}
          <Button testID="nickname-save" label={saving ? '…' : 'SAVE NAME'} variant="primary" small onPress={submitName} style={{ marginTop: 10 }} />
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.yellow} /></View>
      ) : offline ? (
        <View style={styles.center} testID="leaderboard-offline">
          <Text style={styles.offTitle}>LEADERBOARD UNAVAILABLE</Text>
          <Text style={styles.offSub}>THE PIGEONS ARE PROBABLY DRUNK.</Text>
          <Button label="RETRY" variant="ghost" small onPress={load} style={{ marginTop: 14 }} />
        </View>
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {top.length === 0 && <Text style={styles.empty}>NO SCORES YET. BE THE FIRST DRUNK PIGEON.</Text>}
            {top.map((r) => (
              <View key={r.rank} style={[styles.row, r.isYou && styles.rowYou]} testID={`lb-row-${r.rank}`}>
                <Text style={[styles.rank, r.isYou && styles.txtYou]}>#{r.rank}</Text>
                <Text style={[styles.nick, r.isYou && styles.txtYou]} numberOfLines={1}>{r.nickname}</Text>
                <Text style={[styles.dist, r.isYou && styles.txtYou]}>{formatInt(r.bestDistance)}m</Text>
              </View>
            ))}
          </ScrollView>
          {you && !you.inTop && (
            <View style={styles.youBar} testID="your-rank">
              <Text style={styles.youLabel}>YOUR RANK</Text>
              <View style={styles.row}>
                <Text style={[styles.rank, styles.txtYou]}>#{formatInt(you.rank)}</Text>
                <Text style={[styles.nick, styles.txtYou]} numberOfLines={1}>{you.nickname}</Text>
                <Text style={[styles.dist, styles.txtYou]}>{formatInt(you.bestDistance)}m</Text>
              </View>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 26, fontWeight: '700', letterSpacing: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  offTitle: { fontFamily: FONT, color: COLORS.pink, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  offSub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, marginTop: 6 },
  empty: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, textAlign: 'center', marginTop: 30 },
  nameCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginTop: 10 },
  nameLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  input: { backgroundColor: COLORS.bgAlt, borderRadius: 12, borderWidth: 2, borderColor: '#6a5a95', color: '#fff', fontFamily: FONT, fontSize: 18, fontWeight: '700', paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  err: { fontFamily: FONT, color: COLORS.pink, fontSize: 13, fontWeight: '700', marginTop: 8 },
  list: { paddingVertical: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  rowYou: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.teal },
  rank: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, fontWeight: '700', width: 64 },
  nick: { fontFamily: FONT, color: COLORS.text, fontSize: 16, fontWeight: '700', flex: 1 },
  dist: { fontFamily: FONT, color: COLORS.yellow, fontSize: 16, fontWeight: '700' },
  txtYou: { color: COLORS.teal },
  youBar: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.bgAlt },
  youLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 4 },
});
