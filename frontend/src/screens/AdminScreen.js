import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { AdminAPI } from '../advertise/api';

export default function AdminScreen({ onExit }) {
  const [authed, setAuthed] = useState(null); // null=checking
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sel, setSel] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => { AdminAPI.me().then((r) => setAuthed(r.ok)).catch(() => setAuthed(false)); }, []);

  const load = useCallback(async () => {
    try { const r = await AdminAPI.list(); if (r.ok) { const d = await r.json(); setItems(d.enquiries || []); setStatuses(d.statuses || []); } } catch (e) {}
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  const doLogin = useCallback(async () => {
    if (busy) return; setBusy(true); setLoginErr('');
    try {
      const r = await AdminAPI.login(username.trim(), password);
      if (r.ok) { setAuthed(true); setPassword(''); }
      else setLoginErr('Incorrect username or password.');
    } catch (e) { setLoginErr('Login failed. Please try again.'); }
    finally { setBusy(false); }
  }, [busy, username, password]);

  const doLogout = useCallback(async () => { try { await AdminAPI.logout(); } catch (e) {} setAuthed(false); setItems([]); setSel(null); }, []);

  const openDetail = useCallback(async (it) => {
    setSel(it); setPreview(null);
    try {
      const r = await fetch(AdminAPI.artworkUrl(it.id), { credentials: 'include' });
      if (r.ok) { const b = await r.blob(); setPreview({ url: URL.createObjectURL(b), mime: it.artwork_mime }); }
    } catch (e) {}
  }, []);

  const changeStatus = useCallback(async (id, status) => {
    try { const r = await AdminAPI.setStatus(id, status); if (r.ok) { setItems((xs) => xs.map((x) => x.id === id ? { ...x, status } : x)); setSel((s) => s && s.id === id ? { ...s, status } : s); } } catch (e) {}
  }, []);

  if (authed === null) return <SafeAreaView style={styles.root}><ActivityIndicator color={COLORS.yellow} style={{ marginTop: 60 }} /></SafeAreaView>;

  if (!authed) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="admin-login">
        <View style={styles.loginWrap}>
          <Text style={styles.title}>ADMIN</Text>
          <Text style={styles.sub}>Pigeon Promotions dashboard</Text>
          <TextInput testID="admin-username" style={styles.input} value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={COLORS.textDim} autoCapitalize="none" />
          <TextInput testID="admin-password" style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={COLORS.textDim} secureTextEntry autoCapitalize="none" onSubmitEditing={doLogin} />
          {loginErr ? <Text style={styles.err} testID="admin-login-error">{loginErr}</Text> : null}
          <Button testID="admin-login-submit" label={busy ? '…' : 'LOG IN'} variant="primary" disabled={busy} onPress={doLogin} style={{ marginTop: 14, alignSelf: 'stretch' }} />
          <Pressable onPress={onExit} style={{ marginTop: 16 }}><Text style={styles.link}>‹ Back to game</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (sel) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="admin-detail">
        <View style={styles.header}>
          <Button testID="admin-detail-back" label="‹ LIST" variant="ghost" small onPress={() => setSel(null)} />
          <Text style={styles.kicker}>ENQUIRY</Text>
          <View style={{ width: 64 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {preview ? (
            preview.mime === 'application/pdf'
              ? <Pressable onPress={() => Linking.openURL(preview.url)} style={[styles.artwork, styles.pdfBox]}><Text style={styles.pdfTxt}>PDF — tap to open</Text></Pressable>
              : <Image source={{ uri: preview.url }} style={styles.artwork} resizeMode="contain" testID="admin-artwork" />
          ) : <View style={[styles.artwork, styles.pdfBox]}><ActivityIndicator color={COLORS.yellow} /></View>}
          <Row k="Name" v={sel.name} />
          <Row k="Email" v={sel.email} />
          <Row k="Business" v={sel.business || '—'} />
          <Row k="Package" v={sel.packageLabel} />
          <Row k="Artwork" v={`${sel.artwork_original_name} (${sel.artwork_mime})`} />
          <Row k="Message" v={sel.message || '—'} />
          <Row k="Terms" v={`v${sel.terms_version}`} />
          <Row k="Email notify" v={sel.email_notification_status} />
          <Text style={styles.sectionLbl}>STATUS</Text>
          <View style={styles.statusWrap}>
            {statuses.map((s) => (
              <Pressable key={s} testID={`admin-status-${s}`} onPress={() => changeStatus(sel.id, s)} style={[styles.statusChip, sel.status === s && styles.statusChipSel]}>
                <Text style={[styles.statusTxt, sel.status === s && styles.statusTxtSel]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="admin-dashboard">
      <View style={styles.header}>
        <Button testID="admin-logout" label="LOG OUT" variant="ghost" small onPress={doLogout} />
        <Text style={styles.kicker}>PIGEON PROMOTIONS</Text>
        <Pressable onPress={load} testID="admin-refresh"><Text style={styles.link}>↻</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>ENQUIRIES ({items.length})</Text>
        {items.length === 0 ? <Text style={styles.sub}>No enquiries yet.</Text> : null}
        {items.map((it) => (
          <Pressable key={it.id} testID={`admin-enquiry-${it.id}`} onPress={() => openDetail(it)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{it.name} · {it.email}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>{it.packageLabel}</Text>
            </View>
            <Text style={[styles.badge, it.status !== 'pending' && styles.badgeActive]}>{it.status}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvK}>{k}</Text>
      <Text style={styles.kvV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  kicker: { fontFamily: FONT, color: COLORS.teal, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  loginWrap: { flex: 1, alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 28, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 28, fontWeight: '700', letterSpacing: 0.5 },
  sub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, marginTop: 6, marginBottom: 14 },
  input: { fontFamily: FONT, backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 10, minHeight: 46 },
  err: { fontFamily: FONT, color: '#ff6b8a', fontSize: 13, marginTop: 10 },
  link: { fontFamily: FONT, color: COLORS.teal, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, minHeight: 44 },
  rowTitle: { fontFamily: FONT, color: COLORS.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 3 },
  badge: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  badgeActive: { color: COLORS.bg, backgroundColor: COLORS.yellow },
  artwork: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#000', marginBottom: 14 },
  pdfBox: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#3a2340' },
  pdfTxt: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 16 },
  kv: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  kvK: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, width: 110 },
  kvV: { fontFamily: FONT, color: COLORS.text, fontSize: 14, flex: 1 },
  sectionLbl: { fontFamily: FONT, color: COLORS.text, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginTop: 18, marginBottom: 10 },
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { backgroundColor: COLORS.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 2, borderColor: 'transparent', minHeight: 40, justifyContent: 'center' },
  statusChipSel: { borderColor: COLORS.yellow },
  statusTxt: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, fontWeight: '700' },
  statusTxtSel: { color: COLORS.yellow },
});
