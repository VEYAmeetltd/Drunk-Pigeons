import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Background from '../components/Background';
import { PigeonView, ObstacleView, ChipView, FeatherView, HecklerView } from '../components/GameEntities';
import GameOverOverlay from './GameOverOverlay';
import Button from '../ui/Button';
import { createEngine } from '../game/engine';
import { CONFIG, fatLevelFor, FAT_LABELS, formatInt } from '../config';
import { randomDeathMessage } from '../data/deathMessages';
import { pickInsult, pickReaction } from '../data/insults';
import { generateRunId } from '../leaderboard/api';
import { Audio } from '../audio/audio';
import { Ads } from '../ads/ads';
import { FONT, COLORS } from '../ui/theme';

function emptySnapshot() {
  return {
    px: -999, py: 0, t: 0, tilt: 0, flap: 0, fat: 0, inv: 0, dead: 0, distM: 0, distPx: 0,
    heckler: { x: -999, y: 0, w: 36, h: 36, active: 0, life: 0 },
    obs: Array.from({ length: CONFIG.OBSTACLE_POOL }, () => ({ x: -999, active: 0 })),
    chips: Array.from({ length: CONFIG.CHIP_POOL }, () => ({ x: -999, y: 0, active: 0, anim: 0, eaten: 0 })),
    feathers: Array.from({ length: CONFIG.FEATHER_POOL }, () => ({ x: -999, y: 0, rot: 0, active: 0, life: 0 })),
  };
}

// Live distance readout — isolates re-renders to just this tiny component.
function DistanceHUD({ world }) {
  const [m, setM] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      try {
        setM(world.value.distM || 0);
      } catch {}
    }, 60);
    return () => clearInterval(id);
  }, [world]);
  return (
    <View style={styles.distHud} testID="distance-hud" pointerEvents="none">
      <Text style={styles.distTxt}>{formatInt(m)}m</Text>
    </View>
  );
}

export default function GameScreen({ pigeon, map, bestScore, bestDistance = 0, onCrash, onExit }) {
  const { width, height } = useWindowDimensions();
  const world = useSharedValue(emptySnapshot());

  const [score, setScore] = useState(0);
  const [chips, setChips] = useState(0);
  const [obsGeom, setObsGeom] = useState(() =>
    Array.from({ length: CONFIG.OBSTACLE_POOL }, () => ({ active: false, topH: 0, gap: CONFIG.GAP_BASE, kind: 0 }))
  );
  const [over, setOver] = useState(null); // {message, score, chips, isNewBest}
  const [canRevive, setCanRevive] = useState(true);
  const [shield, setShield] = useState(false);
  const [started, setStarted] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [heckler, setHeckler] = useState({ id: 0, text: '', reaction: 'fist' });

  const engineRef = useRef(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const cbRef = useRef({});
  const shieldTimer = useRef(null);
  const pausedRef = useRef(false);
  const runIdRef = useRef('');
  const runStartRef = useRef(0);

  // keep latest callbacks
  cbRef.current.onScore = (s) => setScore(s);
  cbRef.current.onChip = (c) => {
    setChips(c);
    Audio.chip();
  };
  cbRef.current.onCrash = ({ score: sc, chips: ch, distance: dist }) => {
    Audio.crash();
    const isNewBest = sc > bestScore || dist > bestDistance;
    if (isNewBest) setTimeout(() => Audio.highscore(), 250);
    setOver({ message: randomDeathMessage(), score: sc, chips: ch, distance: dist, isNewBest });
    Ads.registerDeath();
    if (onCrash)
      onCrash({
        score: sc,
        chips: ch,
        distance: dist,
        runId: runIdRef.current,
        runDuration: (performance.now() - runStartRef.current) / 1000,
        reviveUsed: !!(engineRef.current && engineRef.current.usedRevive),
      });
  };

  const buildEngine = useCallback(() => {
    return createEngine({
      onScore: (s) => cbRef.current.onScore(s),
      onChip: (c) => cbRef.current.onChip(c),
      onCrash: (info) => cbRef.current.onCrash(info),
    });
  }, []);

  const startRun = useCallback(() => {
    const eng = engineRef.current;
    eng.reset(width, height);
    runIdRef.current = generateRunId();
    runStartRef.current = performance.now();
    setScore(0);
    setChips(0);
    setOver(null);
    setCanRevive(true);
    setShield(false);
    setObsGeom(eng.getObstacleGeom());
    world.value = eng.getSnapshot(performance.now());
  }, [width, height]);

  // init engine + loop
  useEffect(() => {
    engineRef.current = buildEngine();
    startRun();
    lastRef.current = performance.now();

    const loop = (now) => {
      const eng = engineRef.current;
      if (pausedRef.current) {
        lastRef.current = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      let dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (dt > 1 / 30) dt = 1 / 30;
      eng.step(dt, now);
      world.value = eng.getSnapshot(now);
      const dirty = eng.consumeDirty();
      if (dirty) setObsGeom(eng.getObstacleGeom());
      const hk = eng.consumeHeckler();
      if (hk) setHeckler({ id: hk.id, text: pickInsult(hk.insultR), reaction: pickReaction(hk.reactionR) });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (shieldTimer.current) clearTimeout(shieldTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard support (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        doFlap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doFlap = useCallback(() => {
    if (pausedRef.current) return;
    Audio.unlock();
    if (!started) setStarted(true);
    const eng = engineRef.current;
    if (!eng || eng.dead) return;
    eng.flap();
    Audio.flap();
  }, [started]);

  const doRevive = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.canRevive()) return;
    Ads.showRewardedRevive(() => {
      eng.revive(performance.now());
      Audio.revive();
      setOver(null);
      setCanRevive(false);
      setShield(true);
      if (shieldTimer.current) clearTimeout(shieldTimer.current);
      shieldTimer.current = setTimeout(() => setShield(false), CONFIG.REVIVE_INVINCIBLE_MS);
    });
  }, []);

  const openRestartConfirm = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.dead) return; // only during an active run
    Audio.ui();
    pausedRef.current = true;
    setConfirmRestart(true);
  }, []);

  const cancelRestart = useCallback(() => {
    Audio.ui();
    setConfirmRestart(false);
    lastRef.current = performance.now();
    pausedRef.current = false;
  }, []);

  const confirmRestartNow = useCallback(() => {
    Audio.ui();
    setConfirmRestart(false);
    pausedRef.current = false;
    lastRef.current = performance.now();
    setStarted(true);
    startRun();
  }, [startRun]);

  const fatLevel = fatLevelFor(chips);

  return (
    <View style={styles.root}>
      <Background theme={map} width={width} height={height} world={world} />

      {/* obstacles */}
      {obsGeom.map((g, i) => (
        <ObstacleView key={i} world={world} index={i} geom={g} theme={map} screenH={height} />
      ))}

      {/* window heckler (environmental comedy) */}
      <HecklerView world={world} text={heckler.text} reaction={heckler.reaction} theme={map} />

      {/* chips */}
      {Array.from({ length: CONFIG.CHIP_POOL }).map((_, i) => (
        <ChipView key={i} world={world} index={i} />
      ))}

      {/* feathers */}
      {Array.from({ length: CONFIG.FEATHER_POOL }).map((_, i) => (
        <FeatherView key={i} world={world} index={i} color={map.feather} />
      ))}

      {/* pigeon */}
      <PigeonView world={world} pigeon={pigeon} fatLevel={fatLevel} />

      {/* flap input layer (below HUD buttons) */}
      <Pressable
        testID="flap-area"
        style={StyleSheet.absoluteFill}
        onPressIn={doFlap}
      />

      {/* HUD */}
      <SafeAreaView style={styles.hud} pointerEvents="box-none">
        <View style={styles.hudTop} pointerEvents="box-none">
          <View style={styles.leftCluster} pointerEvents="box-none">
            <Pressable testID="restart-button" onPress={openRestartConfirm} style={styles.restartBtn}>
              <Text style={styles.restartIcon}>↻</Text>
            </Pressable>
            <Pressable testID="exit-button" onPress={onExit} style={styles.exit}>
              <Text style={styles.exitTxt}>‹ MENU</Text>
            </Pressable>
          </View>
          <DistanceHUD world={world} />
          <View style={styles.chipHud} testID="chip-hud">
            <View style={styles.chipIcon} />
            <Text style={styles.chipTxt}>{chips}</Text>
          </View>
        </View>
        <View style={styles.scoreWrap} pointerEvents="none">
          <Text style={styles.scoreShadow}>{score}</Text>
          <Text style={styles.score} testID="score-hud">{score}</Text>
          {fatLevel > 0 && <Text style={styles.fatLabel}>{FAT_LABELS[fatLevel]}</Text>}
        </View>
      </SafeAreaView>

      {shield && (
        <View style={styles.shield} pointerEvents="none" testID="shield-banner">
          <Text style={styles.shieldTxt}>SHIELD ACTIVE</Text>
        </View>
      )}

      {!started && !over && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintTxt}>TAP TO FLAP</Text>
          <Text style={styles.hintSub}>keep the drunk pigeon airborne</Text>
        </View>
      )}

      {confirmRestart && (
        <View style={styles.confirmOverlay} testID="restart-confirm-overlay" onStartShouldSetResponder={() => true}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>RESTART RUN?</Text>
            <Text style={styles.confirmSub}>Start fresh with the same pigeon & map</Text>
            <Button testID="restart-confirm-yes" label="Restart" variant="primary" onPress={confirmRestartNow} style={styles.confirmBtn} />
            <Button testID="restart-cancel" label="Cancel" variant="ghost" onPress={cancelRestart} style={styles.confirmBtn} />
          </View>
        </View>
      )}

      {over && (
        <GameOverOverlay
          message={over.message}
          score={over.score}
          best={Math.max(bestScore, over.score)}
          chips={over.chips}
          distance={over.distance}
          bestDistance={Math.max(bestDistance, over.distance)}
          isNewBest={over.isNewBest}
          canRevive={canRevive}
          onPlayAgain={() => {
            setStarted(true);
            startRun();
          }}
          onRevive={doRevive}
          onMenu={onExit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  hud: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 16 },
  hudTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  leftCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restartBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  restartIcon: { fontFamily: FONT, color: '#fff', fontSize: 24, fontWeight: '700', marginTop: -2 },
  distHud: { backgroundColor: 'rgba(0,0,0,0.3)', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 16 },
  distTxt: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  exit: { backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  exitTxt: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 14 },
  chipHud: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  chipIcon: { width: 18, height: 9, borderRadius: 3, backgroundColor: '#f4c542', borderWidth: 1.5, borderColor: '#c99a1e', transform: [{ rotate: '30deg' }] },
  chipTxt: { fontFamily: FONT, color: '#fff', fontWeight: '700', fontSize: 18 },
  scoreWrap: { alignItems: 'center', marginTop: 10 },
  score: { fontFamily: FONT, color: '#fff', fontSize: 64, fontWeight: '700' },
  scoreShadow: { position: 'absolute', top: 3, fontFamily: FONT, color: 'rgba(0,0,0,0.3)', fontSize: 64, fontWeight: '700' },
  fatLabel: { fontFamily: FONT, color: COLORS.yellow, fontSize: 16, fontWeight: '700', marginTop: -6, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  shield: { position: 'absolute', bottom: 60, alignSelf: 'center', backgroundColor: 'rgba(62,242,192,0.9)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center' },
  shieldTxt: { fontFamily: FONT, color: '#053a2e', fontWeight: '700', fontSize: 16, letterSpacing: 1 },
  hint: { position: 'absolute', top: '46%', left: 0, right: 0, alignItems: 'center' },
  hintTxt: { fontFamily: FONT, color: '#fff', fontSize: 34, fontWeight: '700', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  hintSub: { fontFamily: FONT, color: '#fff', fontSize: 15, marginTop: 4, opacity: 0.9 },
  confirmOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,8,30,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 340, backgroundColor: COLORS.card, borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  confirmSub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, marginTop: 6, textAlign: 'center' },
  confirmBtn: { width: '100%', marginTop: 12 },
});
