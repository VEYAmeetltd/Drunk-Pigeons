import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { LeaderboardAPI } from '../leaderboard/api';
import { formatInt } from '../config';
import { Audio } from '../audio/audio';

// Cheeky gold/silver/bronze top-3 podium — Silly Mode only.
function SillyPodium({ entries }) {
  const byRank = {
    1: entries.find((e) => e.rank === 1),
    2: entries.find((e) => e.rank === 2),
    3: entries.find((e) => e.rank === 3),
  };
  const order = [
    { key: 2, medal: '🥈', color: '#c9d2e0', h: 74 },
    { key: 1, medal: '👑', color: COLORS.yellow, h: 104 },
    { key: 3, medal: '🥉', color: '#d08b52', h: 56 },
  ];
  return (
    <View style={styles.podiumWrap} testID="silly-podium">
      <Text style={styles.podiumTitle}>🏆 SILLY HALL OF FAME</Text>
      <View style={styles.podiumRow}>
        {order.map(({ key, medal, color, h }) => {
          const p = byRank[key];
          return (
            <View key={key} style={styles.podCol} testID={p ? `podium-${key}` : undefined}>
              {p ? (
                <>
                  <Text style={styles.podMedal}>{medal}</Text>
                  <Text style={[styles.podNick, p.isYou && styles.txtYou]} numberOfLines={1}>{p.nickname}</Text>
                  <Text style={[styles.podDist, p.isYou && styles.txtYou]}>{formatInt(p.bestDistance)}m</Text>
                  <View style={[styles.podBlock, { height: h, backgroundColor: color }, p.isYou && styles.podBlockYou]}>
                    <Text style={styles.podRank}>{key}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.podMedalDim}>·</Text>
                  <Text style={styles.podEmpty}>up for grabs</Text>
                  <View style={[styles.podBlock, styles.podBlockEmpty, { height: h }]}>
                    <Text style={styles.podRank}>{key}</Text>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const suf = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suf}`;
}

// Escalating DRUNK PIGEONS message for consecutive prohibited-name attempts.
function moderationMessage(attempt) {
  const n = Number(attempt) || 1;
  if (n === 1) return "Username not allowed... Thought you were smart, didn't you? ;)";
  if (n === 2) return "Seriously? 3rd time's a charm?";
  if (n === 3) return "Third time wasn't the charm either.";
  if (n === 10) return "Still trying, huh? I could do this all day... maybe?";
  return `Must be really pigeoned if you thought you would get it on the ${ordinal(n)} try.`;
}

export default function LeaderboardScreen({ playerId, nickname, onSetNickname, onBack }) {
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [top, setTop] = useState([]);
  const [you, setYou] = useState(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  // Live name availability: '' (idle) | 'checking' | 'free' | 'taken' | 'invalid' | 'offline'
  const [avail, setAvail] = useState('');
  const checkTimer = useRef(null);
  const checkSeq = useRef(0);
  const [board, setBoard] = useState('normal'); // 'normal' (Global) | 'silly' (Easy Mode)
  const isSilly = board === 'silly';
  const podium = isSilly ? top.slice(0, 3) : [];
  const rest = isSilly ? top.slice(3) : top;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await LeaderboardAPI.top(playerId, isSilly ? 'easy' : 'normal');
    if (!res || !res.ok) {
      setOffline(true);
    } else {
      setOffline(false);
      setTop(res.top || []);
      setYou(res.you || null);
    }
    setLoading(false);
  }, [playerId, isSilly]);

  useEffect(() => {
    load();
  }, [load]);

  const onChangeName = useCallback((v) => {
    setName(v);
    setErr('');
    if (checkTimer.current) clearTimeout(checkTimer.current);
    const trimmed = v.trim();
    if (!trimmed) { setAvail(''); return; }
    setAvail('checking');
    const seq = ++checkSeq.current;
    checkTimer.current = setTimeout(async () => {
      const res = await LeaderboardAPI.check(trimmed, playerId);
      if (seq !== checkSeq.current) return; // ignore out-of-order responses
      if (!res || (!res.ok && res.offline)) { setAvail('offline'); return; }
      if (res.available) setAvail('free');
      else setAvail(res.reason === 'invalid' ? 'invalid' : res.reason === 'moderation' ? 'blocked' : 'taken');
    }, 450);
  }, [playerId]);

  useEffect(() => () => { if (checkTimer.current) clearTimeout(checkTimer.current); }, []);

  const submitName = async () => {
    if (avail !== 'free' && avail !== 'blocked') return;
    setErr('');
    setSaving(true);
    const res = await onSetNickname(name);
    setSaving(false);
    if (res && res.ok) {
      Audio.ui();
      load();
    } else if (res && res.offline) {
      setErr('LEADERBOARD UNAVAILABLE');
    } else if (res && res.error === 'USERNAME_TAKEN') {
      setErr('That pigeon name is already taken.');
      setAvail('taken');
    } else if (res && res.error === 'NAME_LOCKED') {
      setErr('Your pigeon name is already locked in.');
    } else if (res && res.error === 'MODERATION') {
      setErr(moderationMessage(res.attempt));
      setAvail('blocked');
    } else {
      setErr('TRY ANOTHER NAME, PIGEON.');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Button testID="leaderboard-back" label="BACK" variant="ghost" small onPress={onBack} />
        <Text style={styles.title} testID="leaderboard-title">{isSilly ? '🏆 SILLY MODE' : '🏆 GLOBAL'}</Text>
        {isSilly ? (
          <Pressable testID="show-global" onPress={() => { Audio.ui(); setBoard('normal'); }} style={styles.toggle}>
            <Text style={styles.toggleTxt}>‹ GLOBAL</Text>
          </Pressable>
        ) : (
          <Pressable testID="show-silly" onPress={() => { Audio.ui(); setBoard('silly'); }} style={styles.sillyToggle}>
            <Text style={styles.sillyToggleTxt}>🏆</Text>
            <Text style={styles.sillyToggleLabel}>SILLY</Text>
          </Pressable>
        )}
      </View>
      {isSilly && (
        <Text style={styles.sillyNote} testID="silly-note">Easy Mode distances only — separate from Global.</Text>
      )}

      {!nickname && !offline && (
        <View style={styles.nameCard}>
          <Text style={styles.nameLabel}>PICK A LEADERBOARD NAME</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="nickname-input"
              style={styles.input}
              value={name}
              onChangeText={onChangeName}
              placeholder="e.g. FatPigeon69"
              placeholderTextColor="#8a7bb5"
              maxLength={16}
              autoCorrect={false}
              onSubmitEditing={submitName}
            />
            <View style={styles.statusBox} testID="nickname-status">
              {avail === 'checking' && <ActivityIndicator size="small" color={COLORS.textDim} testID="nickname-checking" />}
              {avail === 'free' && <Text style={styles.tick} testID="nickname-available">✓</Text>}
              {(avail === 'taken' || avail === 'invalid' || avail === 'offline' || avail === 'blocked') && (
                <Text style={styles.cross} testID="nickname-unavailable">✕</Text>
              )}
            </View>
          </View>
          {avail === 'free' && <Text style={styles.hintOk} testID="nickname-hint">Nice — that name is free.</Text>}
          {avail === 'taken' && <Text style={styles.hintBad} testID="nickname-hint">That pigeon name is already taken.</Text>}
          {avail === 'blocked' && !err && <Text style={styles.hintBad} testID="nickname-hint">This nickname isn't allowed. Please choose another.</Text>}
          {avail === 'invalid' && <Text style={styles.hintBad} testID="nickname-hint">That name won't fly, pigeon.</Text>}
          {avail === 'offline' && <Text style={styles.hintDim} testID="nickname-hint">Can't check right now — try again.</Text>}
          <Text style={styles.warnNote} testID="nickname-warning">⚠ Choose carefully — this cannot be changed.</Text>
          {!!err && <Text style={styles.err} testID="nickname-error">{err}</Text>}
          <Button
            testID="nickname-save"
            label={saving ? '…' : 'SAVE NAME'}
            variant="primary"
            small
            disabled={(avail !== 'free' && avail !== 'blocked') || saving}
            onPress={submitName}
            style={{ marginTop: 10 }}
          />
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
            {isSilly && podium.length > 0 && <SillyPodium entries={podium} />}
            {rest.map((r) => (
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
  toggle: { width: 70, alignItems: 'flex-end', paddingVertical: 6 },
  toggleTxt: { fontFamily: FONT, color: COLORS.teal, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  sillyToggle: { width: 70, alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 12, paddingVertical: 4 },
  sillyToggleTxt: { fontSize: 16 },
  sillyToggleLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: -1 },
  sillyNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  offTitle: { fontFamily: FONT, color: COLORS.pink, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  offSub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, marginTop: 6 },
  empty: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, textAlign: 'center', marginTop: 30 },
  nameCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginTop: 10 },
  nameLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  input: { backgroundColor: COLORS.bgAlt, borderRadius: 12, borderWidth: 2, borderColor: '#6a5a95', color: '#fff', fontFamily: FONT, fontSize: 18, fontWeight: '700', paddingVertical: 10, paddingHorizontal: 12, marginTop: 8, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBox: { width: 30, height: 30, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  tick: { color: COLORS.teal, fontSize: 24, fontWeight: '900' },
  cross: { color: COLORS.textDim, fontSize: 22, fontWeight: '900' },
  hintOk: { fontFamily: FONT, color: COLORS.teal, fontSize: 12, fontWeight: '700', marginTop: 6 },
  hintBad: { fontFamily: FONT, color: COLORS.pink, fontSize: 12, fontWeight: '700', marginTop: 6 },
  hintDim: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '700', marginTop: 6 },
  warnNote: { fontFamily: FONT, color: COLORS.yellow, fontSize: 12, fontWeight: '700', marginTop: 8, letterSpacing: 0.3 },
  err: { fontFamily: FONT, color: COLORS.pink, fontSize: 13, fontWeight: '700', marginTop: 8 },
  list: { paddingVertical: 12, gap: 6 },
  podiumWrap: { paddingTop: 6, paddingBottom: 14, alignItems: 'center' },
  podiumTitle: { fontFamily: FONT, color: COLORS.pink, fontSize: 15, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, width: '100%' },
  podCol: { flex: 1, alignItems: 'center', maxWidth: 130 },
  podMedal: { fontSize: 26 },
  podMedalDim: { fontSize: 22, opacity: 0.35 },
  podNick: { fontFamily: FONT, color: COLORS.text, fontSize: 13, fontWeight: '700', maxWidth: '100%', marginTop: 2 },
  podEmpty: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  podDist: { fontFamily: FONT, color: COLORS.yellow, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  podBlock: { width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', paddingTop: 6 },
  podBlockEmpty: { backgroundColor: COLORS.bgAlt, opacity: 0.5 },
  podBlockYou: { borderWidth: 2, borderColor: COLORS.teal },
  podRank: { fontFamily: FONT, color: 'rgba(20,12,40,0.6)', fontSize: 24, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  rowYou: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.teal },
  rank: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, fontWeight: '700', width: 64 },
  nick: { fontFamily: FONT, color: COLORS.text, fontSize: 16, fontWeight: '700', flex: 1 },
  dist: { fontFamily: FONT, color: COLORS.yellow, fontSize: 16, fontWeight: '700' },
  txtYou: { color: COLORS.teal },
  youBar: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.bgAlt },
  youLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, letterSpacing: 2, fontWeight: '600', marginBottom: 4 },
});
