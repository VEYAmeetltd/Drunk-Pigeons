import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MainMenu from './src/screens/MainMenu';
import PigeonsScreen from './src/screens/PigeonsScreen';
import GameScreen from './src/screens/GameScreen';
import { Persistence } from './src/storage/persistence';
import { Audio } from './src/audio/audio';
import { loadFonts, COLORS } from './src/ui/theme';
import { getPigeon } from './src/data/pigeons';
import { getMap } from './src/data/maps';

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('menu'); // menu | game | pigeons
  const [state, setState] = useState({
    bestScore: 0,
    pigeonsInjured: 0,
    soundEnabled: true,
    selectedPigeon: 'classic',
    selectedMap: 'day',
    unlockedPigeons: [],
  });

  useEffect(() => {
    loadFonts();
    // stop the browser from scrolling / bouncing while playing (web only)
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const s = document.documentElement.style;
      const b = document.body.style;
      s.height = '100%';
      b.height = '100%';
      b.margin = '0';
      b.overflow = 'hidden';
      b.overscrollBehavior = 'none';
      b.touchAction = 'none';
    }
    Persistence.loadAll().then((loaded) => {
      setState(loaded);
      Audio.setEnabled(loaded.soundEnabled);
      setReady(true);
    });
  }, []);

  const update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);

  const handleToggleSound = useCallback(() => {
    setState((s) => {
      const soundEnabled = !s.soundEnabled;
      Audio.setEnabled(soundEnabled);
      Persistence.setSound(soundEnabled);
      if (soundEnabled) Audio.ui();
      return { ...s, soundEnabled };
    });
  }, []);

  const handleSelectMap = useCallback((id) => {
    update({ selectedMap: id });
    Persistence.setMap(id);
  }, [update]);

  const handleSelectPigeon = useCallback((id) => {
    update({ selectedPigeon: id });
    Persistence.setPigeon(id);
    Audio.ui();
  }, [update]);

  const handleCrash = useCallback(({ score }) => {
    setState((s) => {
      const pigeonsInjured = s.pigeonsInjured + 1;
      Persistence.setInjured(pigeonsInjured);
      let bestScore = s.bestScore;
      if (score > bestScore) {
        bestScore = score;
        Persistence.setBest(bestScore);
      }
      return { ...s, pigeonsInjured, bestScore };
    });
  }, []);

  if (!ready) return <View style={styles.boot} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {screen === 'menu' && (
          <MainMenu
            bestScore={state.bestScore}
            pigeonsInjured={state.pigeonsInjured}
            soundEnabled={state.soundEnabled}
            selectedPigeon={state.selectedPigeon}
            selectedMap={state.selectedMap}
            onPlay={() => setScreen('game')}
            onPigeons={() => setScreen('pigeons')}
            onSelectMap={handleSelectMap}
            onToggleSound={handleToggleSound}
          />
        )}
        {screen === 'pigeons' && (
          <PigeonsScreen
            selectedPigeon={state.selectedPigeon}
            unlockedPigeons={state.unlockedPigeons}
            onSelect={handleSelectPigeon}
            onBack={() => setScreen('menu')}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            key={state.selectedMap + state.selectedPigeon}
            pigeon={getPigeon(state.selectedPigeon)}
            map={getMap(state.selectedMap)}
            bestScore={state.bestScore}
            onCrash={handleCrash}
            onExit={() => setScreen('menu')}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  boot: { flex: 1, backgroundColor: COLORS.bg },
});
