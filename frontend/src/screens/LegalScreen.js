import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { LEGAL_DOCUMENTS } from '../legal/legalDocuments';
import { Audio } from '../audio/audio';

export default function LegalScreen({ onOpenDoc, onBack }) {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack && onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // "ADVERTISE IN DRUNK PIGEONS" — opens a pre-filled email. We never collect any of
  // these details inside the app; the enquiry is composed entirely in the mail client.
  const openAdvertise = useCallback(() => {
    Audio.ui();
    const subject = 'Drunk Pigeons advertising enquiry';
    const body = [
      'Business name:',
      'Contact name:',
      'Product or service:',
      'Website:',
      'Proposed advertisement:',
      'Preferred campaign dates:',
      'Intended countries:',
      '',
    ].join('\n\n');
    const url = `mailto:support@intiesltd.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="legal-screen">
      <View style={styles.header}>
        <Button testID="legal-back" label="‹ BACK" variant="ghost" small onPress={onBack} />
        <Text style={styles.title}>LEGAL & PRIVACY</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>The approved DRUNK PIGEONS policies. Readable offline, any time.</Text>
        {LEGAL_DOCUMENTS.map((d) => (
          <Pressable
            key={d.id}
            testID={`legal-doc-row-${d.id}`}
            onPress={() => { Audio.ui(); onOpenDoc(d.id); }}
            style={styles.row}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={2}>{d.title}</Text>
              <Text style={styles.rowMeta}>Version {d.version} · {d.lastUpdated}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <Pressable
          testID="advertise-enquiry-button"
          onPress={openAdvertise}
          style={[styles.row, styles.adRow]}
          accessibilityRole="button"
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={2}>ADVERTISE IN DRUNK PIGEONS</Text>
            <Text style={styles.rowMeta}>Email our team about sponsored billboards</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.footer}>Published by INTIES LTD. · Company number 17433193 · England and Wales</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 },
  intro: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, minHeight: 44 },
  adRow: { borderWidth: 1.5, borderColor: COLORS.yellow },
  sectionLabel: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 8, marginBottom: 8 },
  rowText: { flex: 1, paddingRight: 10 },
  rowTitle: { fontFamily: FONT, color: COLORS.text, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  rowMeta: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 3 },
  chevron: { fontFamily: FONT, color: COLORS.teal, fontSize: 26, fontWeight: '700' },
  footer: { fontFamily: FONT, color: COLORS.textDim, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14, fontStyle: 'italic' },
});
