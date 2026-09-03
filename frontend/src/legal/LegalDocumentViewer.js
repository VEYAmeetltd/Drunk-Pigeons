import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform, BackHandler, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { COMPANY } from './legalDocuments';
import { LeaderboardAPI } from '../leaderboard/api';
import { Persistence } from '../storage/persistence';
import { Ads } from '../ads/ads';

const EMAIL = COMPANY.email;

const openMail = (subject, body) => {
  let url = `mailto:${EMAIL}`;
  const q = [];
  if (subject) q.push(`subject=${encodeURIComponent(subject)}`);
  if (body) q.push(`body=${encodeURIComponent(body)}`);
  if (q.length) url += `?${q.join('&')}`;
  Linking.openURL(url).catch(() => {});
};

const LINK_RE = /(gordon@intiesltd\.com|https?:\/\/[^\s)]+)/g;

// Renders a paragraph with clickable email + external URL links inline.
function RichText({ text, style, linkStyle, idPrefix }) {
  const parts = String(text).split(LINK_RE);
  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (p === EMAIL) {
          return (
            <Text
              key={i}
              testID={`${idPrefix}-mail-${i}`}
              style={linkStyle}
              onPress={() => openMail()}
              accessibilityRole="link"
            >
              {p}
            </Text>
          );
        }
        if (/^https?:\/\//.test(p)) {
          return (
            <Text
              key={i}
              testID={`${idPrefix}-url-${i}`}
              style={linkStyle}
              onPress={() => Linking.openURL(p).catch(() => {})}
              accessibilityRole="link"
            >
              {p}
            </Text>
          );
        }
        return p;
      })}
    </Text>
  );
}

function Section({ section, idPrefix }) {
  switch (section.type) {
    case 'heading':
      return <Text style={styles.h1}>{section.text}</Text>;
    case 'subheading':
      return <Text style={styles.h2}>{section.text}</Text>;
    case 'paragraph':
      return <RichText text={section.text} style={styles.body} linkStyle={styles.link} idPrefix={idPrefix} />;
    case 'bullets':
      return (
        <View style={styles.bullets}>
          {section.items.map((it, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <RichText text={it} style={styles.bulletText} linkStyle={styles.link} idPrefix={`${idPrefix}-b${i}`} />
            </View>
          ))}
        </View>
      );
    case 'callout':
      return (
        <View style={styles.callout}>
          {!!section.title && <Text style={styles.calloutTitle}>{section.title}</Text>}
          <RichText text={section.text} style={styles.calloutBody} linkStyle={styles.link} idPrefix={idPrefix} />
        </View>
      );
    case 'table':
      // Mobile-friendly: render each data row as a stacked card with column labels
      // (avoids horizontal scrolling for 2-4 column tables).
      return (
        <View style={styles.tableWrap}>
          {section.rows.map((row, ri) => (
            <View key={ri} style={styles.tableCard}>
              {row.map((cell, ci) => (
                <View key={ci} style={styles.tableCell}>
                  {!!(section.header && section.header[ci]) && (
                    <Text style={styles.tableLabel}>{section.header[ci]}</Text>
                  )}
                  <RichText text={cell} style={styles.tableValue} linkStyle={styles.link} idPrefix={`${idPrefix}-t${ri}${ci}`} />
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    default:
      return null;
  }
}

export default function LegalDocumentViewer({ doc, onBack, playerId, onManageConsent, onLeaderboardDeleted }) {
  const isPC = !!doc && doc.id === 'privacy-choices';
  const [pcHasData, setPcHasData] = useState(false);
  const [pcUmp, setPcUmp] = useState(false);
  const [pcDeleting, setPcDeleting] = useState(false);
  const [pcResult, setPcResult] = useState(''); // '' | 'success' | 'fail'
  const [pcConfirm, setPcConfirm] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack && onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    if (!isPC) return undefined;
    let alive = true;
    if (playerId) {
      LeaderboardAPI.me(playerId).then((r) => {
        if (alive && r && r.ok && r.nickname) setPcHasData(true);
      });
    }
    Ads.getPrivacyOptionsRequired().then((req) => { if (alive) setPcUmp(!!req); });
    return () => { alive = false; };
  }, [isPC, playerId]);

  const doDelete = async () => {
    setPcConfirm(false);
    if (pcDeleting || !playerId) return;
    setPcDeleting(true);
    try {
      const res = await LeaderboardAPI.deleteLeaderboardData(playerId);
      if (res && res.ok) {
        Persistence.setNickname('');
        Persistence.setSubmittedBest(0);
        Persistence.setSubmittedBestSilly(0);
        setPcHasData(false);
        setPcResult('success');
        onLeaderboardDeleted && onLeaderboardDeleted();
      } else {
        setPcResult('fail');
      }
    } catch {
      setPcResult('fail');
    }
    setPcDeleting(false);
  };

  // Extra controls injected directly beneath the relevant legal sections.
  const injectAfter = (s) => {
    if (!isPC || s.type !== 'subheading') return null;
    const t = String(s.text || '').toLowerCase();
    if (/advertising choices/.test(t)) {
      if (!pcUmp) return null; // only when Google UMP says the entry point is required
      return (
        <Button
          testID="google-ump-button"
          label="GOOGLE AD PRIVACY OPTIONS"
          variant="teal"
          small
          onPress={() => onManageConsent && onManageConsent()}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      );
    }
    if (/delete leaderboard data/.test(t)) {
      if (pcResult === 'success') {
        return <Text style={styles.deleteSuccess} testID="delete-success">✓ Your leaderboard nickname and score have been removed.</Text>;
      }
      if (!pcHasData) return null; // only when online leaderboard data exists
      return (
        <View style={{ marginTop: 12 }}>
          <Button
            testID="delete-leaderboard-data"
            label={pcDeleting ? 'DELETING…' : 'DELETE MY LEADERBOARD DATA'}
            variant="danger"
            small
            disabled={pcDeleting}
            onPress={() => setPcConfirm(true)}
            style={{ alignSelf: 'flex-start' }}
          />
          {pcResult === 'fail' && (
            <Text style={styles.deleteFail} testID="delete-fail">Couldn't reach the server. Please try again in a moment.</Text>
          )}
        </View>
      );
    }
    return null;
  };

  if (!doc) return null;
  const idPrefix = `legal-${doc.id}`;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID={`legal-viewer-${doc.id}`}>
      <View style={styles.header}>
        <Button testID="legal-doc-back" label="‹ BACK" variant="ghost" small onPress={onBack} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        testID={`legal-scroll-${doc.id}`}
      >
        <Text style={styles.docTitle} testID="legal-doc-title">{doc.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.statusBadge}>{doc.status}</Text>
          <Text style={styles.metaText}>Version {doc.version}</Text>
        </View>
        <Text style={styles.lastUpdated} testID="legal-doc-updated">Last updated: {doc.lastUpdated}</Text>

        {isPC && (
          <View style={styles.minimalBox} testID="privacy-minimal-note">
            <Text style={styles.minimalText}>
              DRUNK PIGEONS collects the minimum information needed to run the game. It does not require identity documents, real names, email addresses, phone numbers, account passwords or precise location.
            </Text>
          </View>
        )}

        {doc.sections.map((s, i) => (
          <React.Fragment key={i}>
            <Section section={s} idPrefix={`${idPrefix}-s${i}`} />
            {injectAfter(s)}
          </React.Fragment>
        ))}

        {/* Persistent company-information section */}
        <View style={styles.companyBox} testID="legal-company-info">
          <Text style={styles.companyTitle}>PUBLISHER</Text>
          <Text style={styles.companyLine}>{COMPANY.name} · Company number {COMPANY.companyNumber}</Text>
          <Text style={styles.companyLine}>Registered in {COMPANY.jurisdiction}</Text>
          <Text style={styles.companyLine}>{COMPANY.office}</Text>
          <Text style={styles.companyLine}>
            Contact:{' '}
            <Text style={styles.link} testID="company-email-link" onPress={() => openMail()} accessibilityRole="link">
              {COMPANY.email}
            </Text>
          </Text>
          {!!doc.externalUrl && (
            <Pressable
              testID="legal-external-link"
              onPress={() => Linking.openURL(doc.externalUrl).catch(() => {})}
              style={styles.externalBtn}
            >
              <Text style={styles.externalTxt}>View this document online</Text>
            </Pressable>
          )}
          <Text style={styles.companyNote}>The online page may not be available yet; the full text above is always readable in-app.</Text>
        </View>
      </ScrollView>

      <Modal visible={pcConfirm} transparent animationType="fade" onRequestClose={() => setPcConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="delete-confirm-modal">
            <Text style={styles.modalTitle}>Delete leaderboard data?</Text>
            <Text style={styles.modalBody}>
              This removes your public nickname and leaderboard score from our servers. Your purchases are not affected. This can't be undone.
            </Text>
            <View style={styles.modalRow}>
              <Button testID="delete-cancel" label="CANCEL" variant="ghost" small onPress={() => setPcConfirm(false)} style={{ flex: 1 }} />
              <Button testID="delete-confirm" label="DELETE" variant="danger" small onPress={doDelete} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  headerSpacer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40 },
  docTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 26, fontWeight: '700', letterSpacing: 0.5, lineHeight: 32 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  statusBadge: { fontFamily: FONT, color: COLORS.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, backgroundColor: COLORS.bgAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  metaText: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '600' },
  lastUpdated: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  h1: { fontFamily: FONT, color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 2, letterSpacing: 0.3 },
  h2: { fontFamily: FONT, color: COLORS.yellow, fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 2 },
  body: { fontFamily: FONT, color: '#e9e2f7', fontSize: 15, lineHeight: 23, marginTop: 8, fontWeight: '400' },
  link: { color: COLORS.teal, textDecorationLine: 'underline', fontWeight: '600' },
  bullets: { marginTop: 8 },
  bulletRow: { flexDirection: 'row', marginTop: 6, paddingRight: 4 },
  bulletDot: { fontFamily: FONT, color: COLORS.pink, fontSize: 15, lineHeight: 23, width: 16 },
  bulletText: { flex: 1, fontFamily: FONT, color: '#e9e2f7', fontSize: 15, lineHeight: 23 },
  callout: { backgroundColor: COLORS.bgAlt, borderRadius: 14, padding: 14, marginTop: 14, borderLeftWidth: 3, borderLeftColor: COLORS.teal },
  calloutTitle: { fontFamily: FONT, color: COLORS.teal, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  calloutBody: { fontFamily: FONT, color: '#e9e2f7', fontSize: 14, lineHeight: 21 },
  tableWrap: { marginTop: 12, gap: 10 },
  tableCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 12, gap: 8 },
  tableCell: {},
  tableLabel: { fontFamily: FONT, color: COLORS.pink, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2, textTransform: 'uppercase' },
  tableValue: { fontFamily: FONT, color: '#e9e2f7', fontSize: 14, lineHeight: 20 },
  actionPanel: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#4a3a6b' },
  minimalBox: { backgroundColor: COLORS.bgAlt, borderRadius: 12, padding: 14, marginTop: 14, borderLeftWidth: 3, borderLeftColor: COLORS.teal },
  minimalText: { fontFamily: FONT, color: '#e9e2f7', fontSize: 14, lineHeight: 21 },
  deleteSuccess: { fontFamily: FONT, color: COLORS.teal, fontSize: 14, fontWeight: '700', marginTop: 12, lineHeight: 20 },
  deleteFail: { fontFamily: FONT, color: COLORS.pink, fontSize: 13, marginTop: 8, lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  modalCard: { width: '100%', maxWidth: 380, backgroundColor: COLORS.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  modalBody: { fontFamily: FONT, color: '#e9e2f7', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  modalRow: { flexDirection: 'row', gap: 12 },
  companyBox: { backgroundColor: COLORS.bgAlt, borderRadius: 14, padding: 16, marginTop: 26 },
  companyTitle: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  companyLine: { fontFamily: FONT, color: '#e9e2f7', fontSize: 13, lineHeight: 20 },
  externalBtn: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.card, minHeight: 44, justifyContent: 'center' },
  externalTxt: { fontFamily: FONT, color: COLORS.teal, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  companyNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, marginTop: 10, fontStyle: 'italic', lineHeight: 16 },
});
