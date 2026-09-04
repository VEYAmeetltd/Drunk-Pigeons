import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Platform, BackHandler, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../ui/Button';
import { FONT, COLORS } from '../ui/theme';
import { Audio } from '../audio/audio';
import { AdvertiseAPI } from '../advertise/api';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdvertiseScreen({ onBack, onOpenTerms }) {
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack && onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  const [packages, setPackages] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [message, setMessage] = useState('');
  const [pkg, setPkg] = useState('');
  const [file, setFile] = useState(null); // {native, name, size, type, preview}
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const webInputRef = useRef(null);

  useEffect(() => {
    AdvertiseAPI.packages().then((d) => setPackages(d.packages || [])).catch(() => setPackages([
      { id: 'test-flight', name: 'TEST FLIGHT', scope: 'One map', days: 7, price: '£25' },
      { id: 'city-run', name: 'CITY RUN', scope: 'All maps', days: 14, price: '£50' },
      { id: 'full-pigeon', name: 'FULL PIGEON', scope: 'All maps', days: 30, price: '£90' },
      { id: 'exclusive-14', name: 'EXCLUSIVE PIGEON', scope: 'Exclusive paid sponsor across all maps', days: 14, price: '£250' },
      { id: 'exclusive-30', name: 'EXCLUSIVE PIGEON', scope: 'Exclusive paid sponsor across all maps', days: 30, price: '£500' },
    ]));
  }, []);

  const setFileFromWeb = useCallback((f) => {
    setSubmitError('');
    if (!ALLOWED.includes(f.type)) { setErrors((e) => ({ ...e, artwork: 'This pigeon only carries PNG, JPG, WEBP or PDF files.' })); return; }
    if (f.size > MAX_BYTES) { setErrors((e) => ({ ...e, artwork: 'That file is carrying too much baggage. Maximum size: 10MB.' })); return; }
    const preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
    setErrors((e) => ({ ...e, artwork: undefined }));
    setFile({ native: f, name: f.name, size: f.size, type: f.type, preview });
  }, []);

  const pickFile = useCallback(() => {
    Audio.ui();
    if (Platform.OS === 'web') {
      let input = webInputRef.current;
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = ACCEPT;
        input.style.display = 'none';
        input.addEventListener('change', (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (f) setFileFromWeb(f);
          ev.target.value = '';
        });
        document.body.appendChild(input);
        webInputRef.current = input;
      }
      input.click();
    } else {
      // Native uses expo-document-picker in EAS builds.
      (async () => {
        try {
          const DP = require('expo-document-picker');
          const r = await DP.getDocumentAsync({ type: ALLOWED, copyToCacheDirectory: true });
          if (r && !r.canceled && r.assets && r.assets[0]) {
            const a = r.assets[0];
            if (!ALLOWED.includes(a.mimeType)) { setErrors((e) => ({ ...e, artwork: 'This pigeon only carries PNG, JPG, WEBP or PDF files.' })); return; }
            if (a.size > MAX_BYTES) { setErrors((e) => ({ ...e, artwork: 'That file is carrying too much baggage. Maximum size: 10MB.' })); return; }
            setErrors((e) => ({ ...e, artwork: undefined }));
            setFile({ native: a, name: a.name, size: a.size, type: a.mimeType, preview: a.mimeType.startsWith('image/') ? a.uri : null });
          }
        } catch (e) {
          setErrors((er) => ({ ...er, artwork: 'File picker unavailable on this build.' }));
        }
      })();
    }
  }, [setFileFromWeb]);

  const removeFile = useCallback(() => { Audio.ui(); if (file && file.preview) { try { URL.revokeObjectURL(file.preview); } catch (e) {} } setFile(null); }, [file]);

  const valid = name.trim() && EMAIL_RE.test(email.trim()) && pkg && file && accept;

  const validateAll = () => {
    const e = {};
    if (!name.trim()) e.name = 'Please add your name.';
    if (!EMAIL_RE.test(email.trim())) e.email = "That email doesn't look ready for take-off.";
    if (!pkg) e.pkg = 'Choose where your advert should fly.';
    if (!file) e.artwork = 'Your pigeon needs some artwork.';
    if (!accept) e.accept = 'Please accept the Advertising Booking Terms.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!validateAll()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('business', business.trim());
      fd.append('message', message.trim());
      fd.append('package', pkg);
      fd.append('acceptTerms', 'true');
      if (Platform.OS === 'web') {
        fd.append('artwork', file.native, file.name);
      } else {
        fd.append('artwork', { uri: file.native.uri, name: file.name, type: file.type });
      }
      const res = await AdvertiseAPI.submit(fd);
      if (res.ok) {
        Audio.highscore();
        setDone(true);
      } else {
        let msg = 'That pigeon didn’t make it. Your enquiry has not been submitted — please try again.';
        try { const j = await res.json(); if (j && j.detail) msg = typeof j.detail === 'string' ? j.detail : msg; } catch (e) {}
        setSubmitError(msg);
      }
    } catch (e) {
      setSubmitError('That pigeon didn’t make it. Your enquiry has not been submitted — please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, name, email, business, message, pkg, file, accept]);

  if (done) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="advertise-success">
        <View style={styles.successWrap}>
          <Text style={styles.successTitle}>YOUR PIGEON HAS LANDED</Text>
          <Text style={styles.successBody}>We’ve received your advertising enquiry. We’ll review your artwork and email you if your campaign is approved.</Text>
          <Text style={styles.successNote}>No payment has been taken and your campaign is not yet reserved.</Text>
          <Button testID="advertise-back-to-docs" label="BACK TO DOCUMENTS" variant="primary" onPress={onBack} style={{ marginTop: 22, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']} testID="advertise-screen">
      <View style={styles.header}>
        <Button testID="advertise-back" label="‹ BACK" variant="ghost" small onPress={onBack} />
        <Text style={styles.kicker}>PIGEON PROMOTIONS</Text>
        <View style={{ width: 64 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>GET YOUR BRAND AIRBORNE</Text>
          <Text style={styles.intro}>Want your brand flying through Drunk Pigeons? Send us your details and artwork. We’ll review your campaign and contact you if it is approved. No payment is taken at this stage.</Text>

          <Field label="Name *" error={errors.name}>
            <TextInput testID="ad-name" style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={COLORS.textDim} />
          </Field>
          <Field label="Email address *" error={errors.email}>
            <TextInput testID="ad-email" style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={COLORS.textDim} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Field>
          <Field label="Business or brand name" error={null}>
            <TextInput testID="ad-business" style={styles.input} value={business} onChangeText={setBusiness} placeholder="Optional" placeholderTextColor={COLORS.textDim} />
          </Field>

          <Text style={styles.sectionLbl}>PACKAGE *</Text>
          {errors.pkg ? <Text style={styles.err}>{errors.pkg}</Text> : null}
          {packages.map((p) => {
            const sel = pkg === p.id;
            return (
              <Pressable key={p.id} testID={`ad-package-${p.id}`} onPress={() => { Audio.ui(); setPkg(p.id); setErrors((e) => ({ ...e, pkg: undefined })); }} style={[styles.pkgCard, sel && styles.pkgCardSel]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pkgName}>{p.name}</Text>
                  <Text style={styles.pkgMeta}>{p.scope} • {p.days} days • {p.price}</Text>
                </View>
                <View style={[styles.check, sel && styles.checkSel]} testID={sel ? `ad-package-${p.id}-checked` : undefined}>
                  {sel ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
          <Text style={styles.hintSmall}>Selecting a package is only part of an enquiry — it does not reserve the campaign.</Text>

          <Text style={styles.sectionLbl}>ARTWORK *</Text>
          {!file ? (
            <Pressable testID="ad-upload" onPress={pickFile} style={styles.upload} accessibilityRole="button">
              <Text style={styles.uploadPlus}>+ ADD YOUR ARTWORK</Text>
              <Text style={styles.uploadSub}>PNG, JPG, WEBP or PDF • Maximum 10MB</Text>
            </Pressable>
          ) : (
            <View style={styles.fileCard} testID="ad-file-card">
              {file.preview ? (
                <Image source={{ uri: file.preview }} style={styles.filePreview} resizeMode="cover" />
              ) : (
                <View style={[styles.filePreview, styles.pdfBox]}><Text style={styles.pdfTxt}>PDF</Text></View>
              )}
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                <Text style={styles.fileMeta}>{fmtSize(file.size)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable testID="ad-replace" onPress={pickFile} style={styles.smallBtn}><Text style={styles.smallBtnTxt}>REPLACE</Text></Pressable>
                  <Pressable testID="ad-remove" onPress={removeFile} style={[styles.smallBtn, styles.removeBtn]}><Text style={styles.smallBtnTxt}>REMOVE</Text></Pressable>
                </View>
              </View>
            </View>
          )}
          {errors.artwork ? <Text style={styles.err}>{errors.artwork}</Text> : null}

          <Field label="Additional message" error={null}>
            <TextInput testID="ad-message" style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage} placeholder="Optional" placeholderTextColor={COLORS.textDim} multiline />
          </Field>

          <Pressable testID="ad-accept" onPress={() => { Audio.ui(); setAccept((v) => !v); setErrors((e) => ({ ...e, accept: undefined })); }} style={styles.termsRow} accessibilityRole="checkbox" accessibilityState={{ checked: accept }}>
            <View style={[styles.box, accept && styles.boxOn]}>{accept ? <Text style={styles.boxTick}>✓</Text> : null}</View>
            <Text style={styles.termsTxt}>
              I have read and understand the{' '}
              <Text style={styles.termsLink} onPress={() => { Audio.ui(); onOpenTerms && onOpenTerms(); }} testID="ad-terms-link">Advertising Booking Terms</Text>
              {' '}and confirm I have permission to use the submitted artwork. Submitting an enquiry does not reserve a campaign or take payment.
            </Text>
          </Pressable>
          {errors.accept ? <Text style={styles.err}>{errors.accept}</Text> : null}

          {submitError ? <Text style={[styles.err, styles.submitErr]} testID="ad-submit-error">{submitError}</Text> : null}

          <Button
            testID="ad-submit"
            label={submitting ? 'SENDING…' : 'SEND ADVERTISING ENQUIRY'}
            variant="primary"
            disabled={!valid || submitting}
            onPress={submit}
            style={{ marginTop: 16, alignSelf: 'stretch', opacity: !valid || submitting ? 0.5 : 1 }}
          />
          {submitting ? <ActivityIndicator color={COLORS.yellow} style={{ marginTop: 10 }} /> : null}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, error, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLbl}>{label}</Text>
      {children}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  kicker: { fontFamily: FONT, color: COLORS.teal, fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 30, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  intro: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 18 },
  fieldLbl: { fontFamily: FONT, color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { fontFamily: FONT, backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 46 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  sectionLbl: { fontFamily: FONT, color: COLORS.text, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, marginTop: 10, marginBottom: 8 },
  hintSmall: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 6, marginBottom: 6, lineHeight: 17 },
  pkgCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', minHeight: 44 },
  pkgCardSel: { borderColor: COLORS.yellow },
  pkgName: { fontFamily: FONT, color: COLORS.text, fontSize: 16, fontWeight: '700' },
  pkgMeta: { fontFamily: FONT, color: COLORS.textDim, fontSize: 13, marginTop: 3 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: COLORS.textDim, alignItems: 'center', justifyContent: 'center' },
  checkSel: { borderColor: COLORS.yellow, backgroundColor: COLORS.yellow },
  checkMark: { color: COLORS.bg, fontWeight: '900', fontSize: 15 },
  upload: { borderWidth: 2, borderColor: COLORS.teal, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(62,242,192,0.06)', minHeight: 92 },
  uploadPlus: { fontFamily: FONT, color: COLORS.teal, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  uploadSub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 8 },
  fileCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14, padding: 12, alignItems: 'center' },
  filePreview: { width: 88, height: 88, borderRadius: 10, backgroundColor: '#000' },
  pdfBox: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#7a1f4a' },
  pdfTxt: { fontFamily: FONT, color: '#fff', fontWeight: '900', fontSize: 22 },
  fileName: { fontFamily: FONT, color: COLORS.text, fontSize: 14, fontWeight: '700' },
  fileMeta: { fontFamily: FONT, color: COLORS.textDim, fontSize: 12, marginTop: 3 },
  smallBtn: { backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, minHeight: 34, justifyContent: 'center' },
  removeBtn: { backgroundColor: 'rgba(255,80,120,0.22)' },
  smallBtnTxt: { fontFamily: FONT, color: COLORS.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, gap: 10 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: COLORS.textDim, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  boxTick: { color: COLORS.bg, fontWeight: '900', fontSize: 15 },
  termsTxt: { flex: 1, fontFamily: FONT, color: COLORS.textDim, fontSize: 13, lineHeight: 19 },
  termsLink: { color: COLORS.teal, fontWeight: '700', textDecorationLine: 'underline' },
  err: { fontFamily: FONT, color: '#ff6b8a', fontSize: 12, marginTop: 6, lineHeight: 17 },
  submitErr: { fontSize: 14, marginTop: 14 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  successTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 30, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  successBody: { fontFamily: FONT, color: COLORS.text, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 16 },
  successNote: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
});
