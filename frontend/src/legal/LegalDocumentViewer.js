import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Platform, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { COMPANY } from './legalDocuments';

const EMAIL = COMPANY.email;

async function copyText(text) {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy fallback
  }
  try {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) return true;
    }
  } catch {
    // fall through
  }
  try {
    // Optional native clipboard if the app is built with it; never a hard dependency.
    // eslint-disable-next-line global-require
    const Clip = require('expo-clipboard');
    if (Clip && Clip.setStringAsync) { await Clip.setStringAsync(text); return true; }
  } catch {
    // not available — graceful failure
  }
  return false;
}

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

function PrivacyChoicesActions({ playerId, onManageConsent }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [consentMsg, setConsentMsg] = useState('');
  const supportId = playerId || 'unavailable';

  const doCopy = async () => {
    const ok = await copyText(supportId);
    setCopied(ok);
    setCopyFailed(!ok);
    setTimeout(() => { setCopied(false); setCopyFailed(false); }, 2500);
  };

  const doDeleteEmail = () => {
    openMail(
      'DRUNK PIGEONS leaderboard data deletion request',
      `Please delete my DRUNK PIGEONS leaderboard data.\n\nMy Support ID: ${supportId}\n\n(Please keep this ID so we can locate the anonymous leaderboard record. Do not include passwords or payment-card details.)`
    );
  };

  const doManageConsent = async () => {
    setConsentMsg('');
    try {
      const res = onManageConsent ? await onManageConsent() : { ok: false };
      if (!res || !res.ok) {
        setConsentMsg('Ad privacy options are managed on the mobile app; not available in this preview.');
      }
    } catch {
      setConsentMsg('Ad privacy options are managed on the mobile app; not available in this preview.');
    }
  };

  return (
    <View style={styles.actionPanel} testID="privacy-choices-actions">
      <Text style={styles.actionTitle}>YOUR SUPPORT ID</Text>
      <Text style={styles.supportId} testID="support-id-value" selectable>{supportId}</Text>
      <View style={styles.actionRow}>
        <Button testID="copy-support-id" label={copied ? 'COPIED ✓' : (copyFailed ? 'COPY FAILED' : 'COPY ID')} variant="teal" small onPress={doCopy} style={{ flex: 1 }} />
        <Button testID="email-delete-request" label="EMAIL DELETION REQUEST" variant="primary" small onPress={doDeleteEmail} style={{ flex: 1.6 }} />
      </View>
      <Button testID="manage-ad-choices" label="MANAGE AD PRIVACY CHOICES" variant="ghost" small onPress={doManageConsent} style={{ marginTop: 10 }} />
      {!!consentMsg && <Text style={styles.consentMsg} testID="manage-ad-choices-msg">{consentMsg}</Text>}
      <Text style={styles.actionHint}>Include your Support ID in any deletion request. Never send passwords or card details.</Text>
    </View>
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

export default function LegalDocumentViewer({ doc, onBack, playerId, onManageConsent }) {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack && onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

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

        {doc.id === 'privacy-choices' && (
          <PrivacyChoicesActions playerId={playerId} onManageConsent={onManageConsent} />
        )}

        {doc.sections.map((s, i) => (
          <Section key={i} section={s} idPrefix={`${idPrefix}-s${i}`} />
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
  actionTitle: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  supportId: { fontFamily: Platform.OS === 'web' ? 'monospace' : FONT, color: COLORS.yellow, fontSize: 15, fontWeight: '700', marginTop: 6, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  consentMsg: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 8, lineHeight: 17 },
  actionHint: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, marginTop: 12, lineHeight: 16, fontStyle: 'italic' },
  companyBox: { backgroundColor: COLORS.bgAlt, borderRadius: 14, padding: 16, marginTop: 26 },
  companyTitle: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  companyLine: { fontFamily: FONT, color: '#e9e2f7', fontSize: 13, lineHeight: 20 },
  externalBtn: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.card, minHeight: 44, justifyContent: 'center' },
  externalTxt: { fontFamily: FONT, color: COLORS.teal, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  companyNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, marginTop: 10, fontStyle: 'italic', lineHeight: 16 },
});
