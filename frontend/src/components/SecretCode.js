import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Button from '../ui/Button';
import Confetti from './Confetti';
import { Audio } from '../audio/audio';
import { FONT, COLORS } from '../ui/theme';

const SECRET = '733T';
const WRONG = [
  'NOPE.',
  'NICE TRY.',
  'THE PIGEONS KNOW.',
  'INCORRECT, HUMAN.',
  "COO-N'T HAPPEN.",
  'ABSOLUTE NONSENSE.',
  'NOT EVEN CLOSE, MATE.',
];

// Hidden Easter-egg code entry. On correct 733T it celebrates and unlocks all pigeons.
export default function SecretCode({ visible, onClose, onUnlock }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(false);

  if (!visible) return null;

  const submit = () => {
    if (code.trim().toUpperCase() === SECRET) {
      setError('');
      setCelebrate(true);
      Audio.leet();
      onUnlock && onUnlock();
    } else {
      setError(WRONG[Math.floor(Math.random() * WRONG.length)]);
      Audio.ui();
    }
  };

  const close = () => {
    setCode('');
    setError('');
    setCelebrate(false);
    onClose && onClose();
  };

  return (
    <View style={styles.overlay} testID="code-overlay" onStartShouldSetResponder={() => true}>
      {!celebrate ? (
        <View style={styles.card}>
          <Text style={styles.title}>ENTER CODE</Text>
          <TextInput
            testID="code-input"
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="- - - -"
            placeholderTextColor="#8a7bb5"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {!!error && (
            <Text style={styles.error} testID="code-error">
              {error}
            </Text>
          )}
          <Button testID="code-submit" label="SUBMIT" variant="primary" onPress={submit} style={styles.btn} />
          <Button testID="code-cancel" label="CANCEL" variant="ghost" onPress={close} style={styles.btn} />
        </View>
      ) : (
        <View style={styles.card}>
          <Confetti />
          <Text style={styles.leet} testID="leet-achieved">
            LEET PIGEON{'\n'}STATUS ACHIEVED
          </Text>
          <Text style={styles.unlocked} testID="leet-unlocked">
            ALL PIGEONS UNLOCKED
          </Text>
          <Text style={styles.badge}>1337</Text>
          <Button testID="leet-done" label="COO!" variant="teal" onPress={close} style={styles.btn} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,8,30,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
  },
  card: { width: '100%', maxWidth: 340, backgroundColor: COLORS.card, borderRadius: 24, padding: 24, alignItems: 'center', overflow: 'hidden' },
  title: { fontFamily: FONT, color: COLORS.yellow, fontSize: 26, fontWeight: '700', letterSpacing: 2, marginBottom: 14 },
  input: {
    width: '100%',
    backgroundColor: COLORS.bgAlt,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#6a5a95',
    color: '#fff',
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  error: { fontFamily: FONT, color: COLORS.pink, fontSize: 16, fontWeight: '700', marginTop: 12, letterSpacing: 1 },
  btn: { width: '100%', marginTop: 12 },
  leet: { fontFamily: FONT, color: COLORS.yellow, fontSize: 26, fontWeight: '700', textAlign: 'center', letterSpacing: 1, marginTop: 20 },
  unlocked: { fontFamily: FONT, color: COLORS.teal, fontSize: 16, fontWeight: '700', marginTop: 10, letterSpacing: 1 },
  badge: { fontFamily: FONT, color: COLORS.pink, fontSize: 30, fontWeight: '700', letterSpacing: 4, marginTop: 8 },
});
