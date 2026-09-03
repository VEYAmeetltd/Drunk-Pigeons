import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MainMenu from './src/screens/MainMenu';
import PigeonsScreen from './src/screens/PigeonsScreen';
import GameScreen from './src/screens/GameScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import LegalScreen from './src/screens/LegalScreen';
import LegalDocumentViewer from './src/legal/LegalDocumentViewer';
import { getLegalDoc } from './src/legal/legalDocuments';
import { Persistence } from './src/storage/persistence';
import { LeaderboardAPI, generatePlayerId, GAME_VERSION } from './src/leaderboard/api';
import { Audio } from './src/audio/audio';
import { loadFonts, COLORS } from './src/ui/theme';
import { RotateOverlay } from './src/ui/RotateOverlay';
import { getPigeon } from './src/data/pigeons';
import { modeForSelection } from './src/data/maps';
import { Billing } from './src/store/billing';
import { PRODUCTS, DEFAULT_PRICES } from './src/store/products';
import { Ads } from './src/ads/ads';

// Drunkness slider (0=SOBER, 0.5=TIPSY, 1=ABSOLUTELY PIGEONED) → amplitude multiplier.
const drunkStrengthFor = (level) => 0.2 + Math.max(0, Math.min(1, level)) * 1.5;

export default function App() {
  const [ready, setReady] = useState(false);

  // Web: enable viewport-fit=cover so notched mobile browsers expose
  // env(safe-area-inset-*) to react-native-safe-area-context (native handles insets already).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }, []);

  const [screen, setScreen] = useState('menu'); // menu | game | pigeons | leaderboard | legal
  // Legal document overlay (docId) — shown above any screen so opening "Purchase
  // terms" / rules links never resets store/menu/leaderboard state.
  const [legalOverlay, setLegalOverlay] = useState(null);
  const openLegalDoc = useCallback((id) => setLegalOverlay(id), []);
  const closeLegalDoc = useCallback(() => setLegalOverlay(null), []);
  const manageAdConsent = useCallback(() => Ads.showPrivacyOptions(), []);

  // Phone-landscape guard: show a "rotate to portrait" overlay only on phone-sized
  // landscape (short side < 500). Leaves desktop/tablet alone. Native is already
  // portrait-locked via app.json; this covers mobile web.
  const { width: winW, height: winH } = useWindowDimensions();
  const phoneLandscape = winW > winH && Math.min(winW, winH) < 500;
  const [state, setState] = useState({
    bestScore: 0,
    bestDistance: 0,
    bestDistanceSilly: 0,
    pigeonsInjured: 0,
    soundEnabled: true,
    selectedPigeon: 'classic',
    selectedMap: 'day',
    unlockedPigeons: [],
    leetUnlock: false,
    purchasedPigeons: [],
    bundleOwned: false,
    easyModeOwned: false,
    removeAdsOwned: false,
    drunkLevel: 1,
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

  // Keep the ad system's Remove Ads entitlement in sync — takes effect immediately.
  useEffect(() => {
    Ads.setRemoveAds(state.removeAdsOwned);
  }, [state.removeAdsOwned]);

  // Leaderboard identity (kept in a ref for stale-free access inside async crash handler)
  const lbRef = useRef({ playerId: '', nickname: '', submittedBest: 0, submittedBestSilly: 0 });
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    Persistence.loadLeaderboard().then((lb) => {
      let pid = lb.playerId;
      if (!pid) {
        pid = generatePlayerId();
        Persistence.setPlayerId(pid);
      }
      lbRef.current = {
        playerId: pid,
        nickname: lb.nickname,
        submittedBest: lb.submittedBest,
        submittedBestSilly: lb.submittedBestSilly,
      };
      setNickname(lb.nickname);

      // Reconcile a locally-cached name with the server (authoritative). If the
      // name was removed server-side (moderation takedown / reset), clear it
      // locally so the name-entry flow reopens. Never wipe on network failure.
      if (lb.nickname) {
        LeaderboardAPI.me(pid).then((res) => {
          if (res && res.ok && !res.nickname) {
            lbRef.current.nickname = '';
            Persistence.setNickname('');
            setNickname('');
          }
        });
      }
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

  const handleSetDrunk = useCallback((level) => {
    const v = Math.max(0, Math.min(1, level));
    setState((s) => ({ ...s, drunkLevel: v }));
  }, []);
  const handleCommitDrunk = useCallback(() => {
    setState((s) => { Persistence.setDrunk(s.drunkLevel); return s; });
  }, []);

  const handleSelectMap = useCallback((id) => {
    setState((s) => {
      if (id === 'easy' && !s.easyModeOwned) return s; // locked -> menu opens the purchase sheet instead
      Persistence.setMap(id);
      return { ...s, selectedMap: id };
    });
  }, []);

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

  // Purchase the one-time, non-consumable EASY MODE unlock (£14.99). Independent
  // of pigeon purchases and the 733T unlock.
  const buyEasyMode = useCallback(async (devOutcome) => {
    const res = await Billing.purchase(PRODUCTS.mode.easy, devOutcome);
    if (res.status === 'success') {
      update({ easyModeOwned: true });
      Persistence.setEasyMode(true);
    }
    return res.status;
  }, [update]);

  // Purchase the permanent Remove Ads entitlement (£2.99). Disables automatic
  // interstitials immediately; rewarded revive stays available.
  const buyRemoveAds = useCallback(async (devOutcome) => {
    const res = await Billing.purchase(PRODUCTS.removeads, devOutcome);
    if (res.status === 'success') {
      update({ removeAdsOwned: true });
      Persistence.setRemoveAds(true);
    }
    return res.status;
  }, [update]);

  // Restore non-consumable purchases. In production this queries Apple/Google
  // ownership; in DEV we simulate by restoring the locally-known owned products.
  const restorePurchases = useCallback(async () => {
    const owned = [
      ...state.purchasedPigeons.map((id) => PRODUCTS.pigeons[id]),
      ...(state.bundleOwned ? [PRODUCTS.bundle] : []),
      ...(state.easyModeOwned ? [PRODUCTS.mode.easy] : []),
      ...(state.removeAdsOwned ? [PRODUCTS.removeads] : []),
    ];
    const restored = await Billing.restore(owned);
    const ids = Object.entries(PRODUCTS.pigeons)
      .filter(([, pid]) => restored.includes(pid))
      .map(([id]) => id);
    const bundle = restored.includes(PRODUCTS.bundle);
    const easy = restored.includes(PRODUCTS.mode.easy);
    const removeAds = restored.includes(PRODUCTS.removeads);
    setState((s) => {
      Persistence.setPurchased(ids);
      Persistence.setBundle(bundle);
      Persistence.setEasyMode(easy);
      Persistence.setRemoveAds(removeAds);
      return { ...s, purchasedPigeons: ids, bundleOwned: bundle, easyModeOwned: easy, removeAdsOwned: removeAds };
    });
    return restored.length;
  }, [state.purchasedPigeons, state.bundleOwned, state.easyModeOwned, state.removeAdsOwned]);

  const handleCrash = useCallback(({ score, distance, chips, runId, runDuration, reviveUsed, mode = 'normal' }) => {
    const isEasy = mode === 'easy';
    setState((s) => {
      const pigeonsInjured = s.pigeonsInjured + 1;
      Persistence.setInjured(pigeonsInjured);
      const patch = { pigeonsInjured };
      if (isEasy) {
        // Easy Mode never touches the normal Global best score/distance.
        let bestDistanceSilly = s.bestDistanceSilly;
        if (distance > bestDistanceSilly) {
          bestDistanceSilly = distance;
          Persistence.setBestDistanceSilly(bestDistanceSilly);
        }
        patch.bestDistanceSilly = bestDistanceSilly;
      } else {
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
        patch.bestScore = bestScore;
        patch.bestDistance = bestDistance;
      }
      return { ...s, ...patch };
    });

    // Async best-distance submission (never blocks PLAY AGAIN). Only a genuine new
    // personal best is submitted, and only if the player has chosen a nickname.
    // Easy Mode runs are submitted with mode:'easy' and can ONLY reach the Silly
    // Mode leaderboard — never Global.
    const lb = lbRef.current;
    const prevSubmitted = isEasy ? lb.submittedBestSilly : lb.submittedBest;
    if (lb.nickname && runId && distance > prevSubmitted) {
      LeaderboardAPI.submit({
        playerId: lb.playerId,
        runId,
        nickname: lb.nickname,
        reportedDistance: distance,
        runDuration,
        reviveUsed: !!reviveUsed,
        chipCount: chips,
        mode: isEasy ? 'easy' : 'normal',
        gameVersion: GAME_VERSION,
      }).then((res) => {
        if (res && res.ok && res.status === 'accepted') {
          if (isEasy) {
            lbRef.current.submittedBestSilly = distance;
            Persistence.setSubmittedBestSilly(distance);
          } else {
            lbRef.current.submittedBest = distance;
            Persistence.setSubmittedBest(distance);
          }
        }
      });
    }
  }, []);

  if (!ready) return <View style={styles.boot} />;

  const drunkStrength = drunkStrengthFor(state.drunkLevel);

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
            easyModeOwned={state.easyModeOwned}
            easyPrice={Billing.priceFor(PRODUCTS.mode.easy) || DEFAULT_PRICES.easyMode}
            isDev={Billing.isDev}
            drunkStrength={drunkStrength}
            drunkLevel={state.drunkLevel}
            onSetDrunk={handleSetDrunk}
            onCommitDrunk={handleCommitDrunk}
            onPlay={() => setScreen('game')}
            onPigeons={() => setScreen('pigeons')}
            onSelectMap={handleSelectMap}
            onBuyEasy={buyEasyMode}
            onToggleSound={handleToggleSound}
            onLeetUnlock={handleLeetUnlock}
            onLeaderboard={() => setScreen('leaderboard')}
            onLegal={() => setScreen('legal')}
            onOpenPurchaseTerms={() => openLegalDoc('purchases')}
          />
        )}
        {screen === 'leaderboard' && (
          <LeaderboardScreen
            playerId={lbRef.current.playerId}
            nickname={nickname}
            onSetNickname={setLeaderboardName}
            onBack={() => setScreen('menu')}
            onOpenLegal={openLegalDoc}
          />
        )}
        {screen === 'legal' && (
          <LegalScreen
            onOpenDoc={openLegalDoc}
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
            removeAdsOwned={state.removeAdsOwned}
            removeAdsPrice={Billing.priceFor(PRODUCTS.removeads) || DEFAULT_PRICES.removeAds}
            drunkStrength={drunkStrength}
            onSelect={handleSelectPigeon}
            onBuyPigeon={buyPigeon}
            onBuyBundle={buyBundle}
            onBuyRemoveAds={buyRemoveAds}
            onRestore={restorePurchases}
            onBack={() => setScreen('menu')}
            onOpenPurchaseTerms={() => openLegalDoc('purchases')}
          />
        )}
        {screen === 'game' && (
          <GameScreen
            key={state.selectedMap + state.selectedPigeon}
            pigeon={getPigeon(state.selectedPigeon)}
            mapSelection={state.selectedMap}
            bestScore={state.bestScore}
            bestDistance={modeForSelection(state.selectedMap) === 'easy' ? state.bestDistanceSilly : state.bestDistance}
            drunkStrength={drunkStrength}
            drunkLevel={state.drunkLevel}
            onCrash={handleCrash}
            onExit={() => setScreen('menu')}
          />
        )}
      </View>
      {legalOverlay && (
        <View style={styles.legalOverlay}>
          <LegalDocumentViewer
            doc={getLegalDoc(legalOverlay)}
            playerId={lbRef.current.playerId}
            onManageConsent={manageAdConsent}
            onBack={closeLegalDoc}
          />
        </View>
      )}
      <RotateOverlay visible={phoneLandscape} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  boot: { flex: 1, backgroundColor: COLORS.bg },
  legalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bg, zIndex: 80 },
});
