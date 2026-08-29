import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MainMenu from './src/screens/MainMenu';
import PigeonsScreen from './src/screens/PigeonsScreen';
import GameScreen from './src/screens/GameScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { Persistence } from './src/storage/persistence';
import { LeaderboardAPI, generatePlayerId, GAME_VERSION } from './src/leaderboard/api';
import { Audio } from './src/audio/audio';
import { loadFonts, COLORS } from './src/ui/theme';
import { getPigeon } from './src/data/pigeons';
import { getMap } from './src/data/maps';
import { Billing } from './src/store/billing';
import { PRODUCTS } from './src/store/products';

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('menu'); // menu | game | pigeons
  const [state, setState] = useState({
    bestScore: 0,
    bestDistance: 0,
    pigeonsInjured: 0,
    soundEnabled: true,
    selectedPigeon: 'classic',
    selectedMap: 'day',
    unlockedPigeons: [],
    leetUnlock: false,
    purchasedPigeons: [],
    bundleOwned: false,
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

  // Leaderboard identity (kept in a ref for stale-free access inside async crash handler)
  const lbRef = useRef({ playerId: '', nickname: '', submittedBest: 0 });
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    Persistence.loadLeaderboard().then((lb) => {
      let pid = lb.playerId;
      if (!pid) {
        pid = generatePlayerId();
        Persistence.setPlayerId(pid);
      }
      lbRef.current = { playerId: pid, nickname: lb.nickname, submittedBest: lb.submittedBest };
      setNickname(lb.nickname);
    });
  }, []);

  const setLeaderboardName = useCallback(async (name) => {
    const res = await LeaderboardAPI.register(lbRef.current.playerId, name);
    if (res && res.ok) {
      lbRef.current.nickname = res.nickname;
      Persistence.setNickname(res.nickname);
      setNickname(res.nickname);
    }
    return res || { ok: false, offline: true };
  }, []);

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

  const handleLeetUnlock = useCallback(() => {
    update({ leetUnlock: true });
    Persistence.setLeet(true);
  }, [update]);

  // Purchase a single premium pigeon via the store hook (DEV simulator for now).
  const buyPigeon = useCallback(async (id, devOutcome) => {
    const res = await Billing.purchase(PRODUCTS.pigeons[id], devOutcome);
    if (res.status === 'success') {
      setState((s) => {
        const purchasedPigeons = s.purchasedPigeons.includes(id)
          ? s.purchasedPigeons
          : [...s.purchasedPigeons, id];
        Persistence.setPurchased(purchasedPigeons);
        return { ...s, purchasedPigeons };
      });
    }
    return res.status;
  }, []);

  const buyBundle = useCallback(async (devOutcome) => {
    const res = await Billing.purchase(PRODUCTS.bundle, devOutcome);
    if (res.status === 'success') {
      update({ bundleOwned: true });
      Persistence.setBundle(true);
    }
    return res.status;
  }, [update]);

  // Restore non-consumable purchases. In production this queries Apple/Google
  // ownership; in DEV we simulate by restoring the locally-known owned products.
  const restorePurchases = useCallback(async () => {
    const owned = [
      ...state.purchasedPigeons.map((id) => PRODUCTS.pigeons[id]),
      ...(state.bundleOwned ? [PRODUCTS.bundle] : []),
    ];
    const restored = await Billing.restore(owned);
    const ids = Object.entries(PRODUCTS.pigeons)
      .filter(([, pid]) => restored.includes(pid))
      .map(([id]) => id);
    const bundle = restored.includes(PRODUCTS.bundle);
    setState((s) => {
      Persistence.setPurchased(ids);
      Persistence.setBundle(bundle);
      return { ...s, purchasedPigeons: ids, bundleOwned: bundle };
    });
    return restored.length;
  }, [state.purchasedPigeons, state.bundleOwned]);

  const handleCrash = useCallback(({ score, distance, chips, runId, runDuration, reviveUsed }) => {
    setState((s) => {
      const pigeonsInjured = s.pigeonsInjured + 1;
      Persistence.setInjured(pigeonsInjured);
      let bestScore = s.bestScore;
      if (score > bestScore) {
        bestScore = score;
        Persistence.setBest(bestScore);
      }
      let bestDistance = s.bestDistance;
      if (distance > bestDistance) {
        bestDistance = distance;
        Persistence.setBestDistance(bestDistance);
      }
      return { ...s, pigeonsInjured, bestScore, bestDistance };
    });

    // Async best-distance submission (never blocks PLAY AGAIN). Only a genuine new
    // personal best is submitted, and only if the player has chosen a nickname.
    const lb = lbRef.current;
    if (lb.nickname && runId && distance > lb.submittedBest) {
      LeaderboardAPI.submit({
        playerId: lb.playerId,
        runId,
        nickname: lb.nickname,
        reportedDistance: distance,
        runDuration,
        reviveUsed: !!reviveUsed,
        chipCount: chips,
        gameVersion: GAME_VERSION,
      }).then((res) => {
        if (res && res.ok && res.status === 'accepted') {
          lbRef.current.submittedBest = distance;
          Persistence.setSubmittedBest(distance);
        }
      });
    }
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
            leetUnlock={state.leetUnlock}
            onPlay={() => setScreen('game')}
            onPigeons={() => setScreen('pigeons')}
            onSelectMap={handleSelectMap}
            onToggleSound={handleToggleSound}
            onLeetUnlock={handleLeetUnlock}
            onLeaderboard={() => setScreen('leaderboard')}
          />
        )}
        {screen === 'leaderboard' && (
          <LeaderboardScreen
            playerId={lbRef.current.playerId}
            nickname={nickname}
            onSetNickname={setLeaderboardName}
            onBack={() => setScreen('menu')}
          />
        )}
        {screen === 'pigeons' && (
          <PigeonsScreen
            selectedPigeon={state.selectedPigeon}
            unlockedPigeons={state.unlockedPigeons}
            leetUnlock={state.leetUnlock}
            purchasedPigeons={state.purchasedPigeons}
            bundleOwned={state.bundleOwned}
            onSelect={handleSelectPigeon}
            onBuyPigeon={buyPigeon}
            onBuyBundle={buyBundle}
            onRestore={restorePurchases}
            onBack={() => setScreen('menu')}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            key={state.selectedMap + state.selectedPigeon}
            pigeon={getPigeon(state.selectedPigeon)}
            map={getMap(state.selectedMap)}
            bestScore={state.bestScore}
            bestDistance={state.bestDistance}
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
