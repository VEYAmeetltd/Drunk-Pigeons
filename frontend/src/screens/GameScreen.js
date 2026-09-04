import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Background from '../components/Background';
import { PigeonView, PigeonSpeechBubble, ObstacleView, ChipView, JabView, PintView, FeatherView, HecklerView, DrunkScreenFX, SkinnyToast, DEV_MOUNT_STATS } from '../components/GameEntities';
import GameOverOverlay from './GameOverOverlay';
import Button from '../ui/Button';
import { createEngine } from '../game/engine';
import { CONFIG, EASY_TUNING, fatLevelFor, FAT_LABELS, EXTRA_FAT_LABELS, extraFatLevelFor, formatInt } from '../config';
import { getMapForSelection, modeForSelection } from '../data/maps';
import { randomDeathMessage } from '../data/deathMessages';
import { pickInsult, pickReaction } from '../data/insults';
import { generateRunId } from '../leaderboard/api';
import { Audio } from '../audio/audio';
import { Ads } from '../ads/ads';
import { FONT, COLORS } from '../ui/theme';

function emptySnapshot() {
  return {
    px: -999, py: 0, t: 0, tilt: 0, flap: 0, fat: 0, inv: 0, dead: 0, distM: 0, distPx: 0, blackout: 0,
    jab: { x: -999, y: 0, active: 0, anim: 0 },
    pop: 0,
    heckler: { x: -999, y: 0, w: 36, h: 36, active: 0, life: 0 },
    obs: Array.from({ length: CONFIG.OBSTACLE_POOL }, () => ({ x: -999, active: 0 })),
    chips: Array.from({ length: CONFIG.CHIP_POOL }, () => ({ x: -999, y: 0, active: 0, anim: 0, eaten: 0 })),
    feathers: Array.from({ length: CONFIG.FEATHER_POOL }, () => ({ x: -999, y: 0, rot: 0, active: 0, life: 0 })),
  };
}

// Full-screen fade-to-black for the 1000m "pigeon closes its eyes" Easter egg.
// Polls the shared world value (no React re-render on the hot path) and never
// blocks touch input, so the pigeon keeps flapping through the blind stretch.
function BlackoutOverlay({ world }) {
  const [a, setA] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      try {
        setA(world.value.blackout || 0);
      } catch (e) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[GameScreen] blackout HUD read failed', e);
      }
    }, 50);
    return () => clearInterval(id);
  }, [world]);
  if (a <= 0.001) return null;
  return (
    <View
      style={[styles.blackout, { opacity: a }]}
      pointerEvents="none"
      testID="blackout-overlay"
    >
      <Text style={[styles.blackoutTxt, { opacity: Math.max(0, (a - 0.35) / 0.65) }]}>
        This is what it looks like when a pigeon closes it's eyes.
      </Text>
    </View>
  );
}

// Live distance readout — isolates re-renders to just this tiny component.
function DistanceHUD({ world }) {
  const [m, setM] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      try {
        setM(world.value.distM || 0);
      } catch (e) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[GameScreen] distance HUD read failed', e);
      }
    }, 60);
    return () => clearInterval(id);
  }, [world]);
  return (
    <View style={styles.distHud} testID="distance-hud" pointerEvents="none">
      <Text style={styles.distTxt}>{formatInt(m)}m</Text>
    </View>
  );
}

// Comic "POP!" that floats up from the pigeon when a Skinny Jab deflates it.
function PopText({ world }) {
  const style = useAnimatedStyle(() => {
    const w = world.value;
    const pop = w.pop || 0;
    const dtp = pop ? w.t - pop : 99999;
    if (!pop || dtp < 0 || dtp > 1100) return { opacity: 0, transform: [{ translateX: -999 }] };
    const p = dtp / 1100;
    const s = 0.5 + Math.min(1, p * 5) * 0.7;
    return {
      opacity: 1 - p,
      transform: [{ translateX: w.px - 50 }, { translateY: w.py - 74 - p * 46 }, { scale: s }],
    };
  });
  return (
    <Animated.View style={[styles.pop, style]} pointerEvents="none" testID="skinny-jab-pop">
      <Text style={styles.popTxt}>POP!</Text>
    </Animated.View>
  );
}

// READY-state "TAP TO FLAP" prompt with a subtle pulse. Never intercepts touches
// (pointerEvents none) — the full-screen flap layer beneath handles the tap.
function ReadyHint() {
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withRepeat(withTiming(1.08, { duration: 620, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: p.value }], opacity: 0.9 + (p.value - 1) }));
  return (
    <View style={styles.hint} pointerEvents="none" testID="tap-to-flap-hint">
      <Animated.Text style={[styles.hintTxt, style]}>TAP TO FLAP</Animated.Text>
      <Text style={styles.hintSub}>keep the drunk pigeon airborne</Text>
    </View>
  );
}

export default function GameScreen({ pigeon, mapSelection, bestDistance = 0, drunkStrength = 1, drunkLevel = 0.5, removeAdsOwned = false, onCrash, onExit }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const world = useSharedValue(emptySnapshot());
  const mode = modeForSelection(mapSelection); // 'normal' | 'easy' (stable for this instance)
  const [activeMap, setActiveMap] = useState(() => getMapForSelection(mapSelection));

  const [chips, setChips] = useState(0);
  const [fatChipsCur, setFatChipsCur] = useState(0); // currentFatness (resets on Skinny Jab); drives visible size
  const [deflateN, setDeflateN] = useState(0); // increments on jab -> squash animation
  const [skinnyKey, setSkinnyKey] = useState(0); // remounts the SKINNY AGAIN! toast
  const [obsGeom, setObsGeom] = useState(() =>
    Array.from({ length: CONFIG.OBSTACLE_POOL }, () => ({ active: false, topH: 0, gap: CONFIG.GAP_BASE, kind: 0 }))
  );
  const [over, setOver] = useState(null); // {message, score, chips, isNewBest}
  const [canRevive, setCanRevive] = useState(true);
  const [reviveBusy, setReviveBusy] = useState(false);
  const [reviveMsg, setReviveMsg] = useState('');
  const [shield, setShield] = useState(false);
  const [started, setStarted] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [heckler, setHeckler] = useState({ id: 0, text: '', reaction: 'fist' });
  const [pintBoost, setPintBoost] = useState(false); // temporary extra-drunk visual after a pint
  const boostTimer = useRef(null);
  // Roadman-only one-time scripted lines (intro flap / 50m / 100m). A priority speech
  // bubble anchored to the player pigeon — independent of, and takes priority over, his
  // ordinary HIC/quip dialogue (see suppressQuips on PigeonView/DrunkPigeon below).
  const [scriptedLine, setScriptedLine] = useState(null); // { key, text } | null
  const roadmanFlagsRef = useRef({ wargwarn: false, wargwarn50: false, wargwarn100: false });
  const scriptedTimerRef = useRef(null);
  const showScriptedLine = useCallback((text) => {
    if (scriptedTimerRef.current) clearTimeout(scriptedTimerRef.current);
    setScriptedLine({ key: Date.now(), text });
    scriptedTimerRef.current = setTimeout(() => setScriptedLine(null), 2200);
  }, []);

  const engineRef = useRef(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const cbRef = useRef({});
  const shieldTimer = useRef(null);
  const pausedRef = useRef(false);
  const runIdRef = useRef('');
  const runStartRef = useRef(0);
  // Authoritative READY->RUNNING flag read synchronously by the tap handler
  // (refs avoid stale closures / waiting on React render before the first flap).
  const startedRef = useRef(false);
  // DEV-only input instrumentation (never rendered in production).
  const inputStatsRef = useRef({ raw: 0, accepted: 0, flaps: 0, ignored: 0, lastReason: '' });
  const [devStats, setDevStats] = useState(null);
  // DEV-only chunk-spawn / frame-time instrumentation (never rendered in
  // production). Polled at a low cadence (not every frame) into a small HUD
  // so a profile build can visually confirm chunk generation stays cheap and
  // off the frame that becomes visible.
  const perfStatsRef = useRef({ stepMs: 0, chunkMs: 0, maxChunkMs: 0 });
  const [perfHud, setPerfHud] = useState(null);
  const mountBaselineRef = useRef(null);

  // keep latest callbacks
  cbRef.current.onChip = (c, fatCur) => {
    setChips(c);
    setFatChipsCur(fatCur); // currentFatness (== total until a Skinny Jab resets it)
    Audio.chip();
  };
  cbRef.current.onSkinnyJab = () => {
    Audio.pop();
    setFatChipsCur(0); // instant fatness reset; squash + toast add the comedic beat
    setDeflateN((n) => n + 1);
    setSkinnyKey((k) => k + 1);
  };
  cbRef.current.onPint = () => {
    Audio.pint();
    setPintBoost(true);
    if (boostTimer.current) clearTimeout(boostTimer.current);
    boostTimer.current = setTimeout(() => setPintBoost(false), CONFIG.PINT_BOOST_MS);
  };
  cbRef.current.onCrash = ({ score: sc, chips: ch, distance: dist }) => {
    Audio.crash();
    // Best Score = longest distance travelled, in meters. This is the ONLY source of
    // truth for "best" — never obstacle-pass counts, chips, or fatness tiers.
    const isNewBest = dist > bestDistance;
    if (isNewBest) setTimeout(() => Audio.highscore(), 250);
    setOver({ message: randomDeathMessage(), chips: ch, distance: dist, isNewBest });
    Ads.registerDeath();
    if (onCrash)
      onCrash({
        score: sc,
        chips: ch,
        distance: dist,
        mode,
        runId: runIdRef.current,
        runDuration: (performance.now() - runStartRef.current) / 1000,
        reviveUsed: !!(engineRef.current && engineRef.current.usedRevive),
      });
  };

  const buildEngine = useCallback(() => {
    return createEngine({
      onChip: (c, fat) => cbRef.current.onChip(c, fat),
      onCrash: (info) => cbRef.current.onCrash(info),
      onSkinnyJab: () => cbRef.current.onSkinnyJab(),
      onPint: () => cbRef.current.onPint(),
    });
  }, []);

  const startRun = useCallback(() => {
    const eng = engineRef.current;
    // RANDOM MANOR re-picks one of the 3 standard maps for every brand-new run.
    const m = getMapForSelection(mapSelection);
    setActiveMap(m);
    eng.reset(width, height, mode === 'easy' ? EASY_TUNING : undefined);
    runIdRef.current = generateRunId();
    // Anti-cheat run timing starts on the FIRST gameplay tap (READY->RUNNING),
    // not when PLAY was pressed. Seeded here only to avoid a stale value.
    runStartRef.current = 0;
    startedRef.current = false;
    setStarted(false);
    setChips(0);
    setFatChipsCur(0);
    setOver(null);
    setCanRevive(true);
    setReviveBusy(false);
    setReviveMsg('');
    setShield(false);
    setObsGeom(eng.getObstacleGeom());
    world.value = eng.getSnapshot(performance.now());
    // A brand-new run resets the Roadman scripted-line triggers (revive must NOT).
    roadmanFlagsRef.current = { wargwarn: false, wargwarn50: false, wargwarn100: false };
    if (scriptedTimerRef.current) clearTimeout(scriptedTimerRef.current);
    setScriptedLine(null);
  }, [width, height, mapSelection, mode]);

  // init engine + loop
  useEffect(() => {
    Ads.init();
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
      const snap = eng.getSnapshot(now);
      world.value = snap;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const p = eng.getPerfStats();
        const stats = perfStatsRef.current;
        stats.stepMs = p.stepMs;
        stats.chunkMs = p.placeObstacleMs;
        stats.maxChunkMs = Math.max(stats.maxChunkMs, p.placeObstacleMs);
      }
      if (pigeon.id === 'roadman') {
        const flags = roadmanFlagsRef.current;
        if (!flags.wargwarn50 && snap.distM >= 50) {
          flags.wargwarn50 = true;
          showScriptedLine('I said wargwarn fam?');
        } else if (!flags.wargwarn100 && snap.distM >= 100) {
          flags.wargwarn100 = true;
          showScriptedLine("A'ight say less, deekhed");
        }
      }
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
      if (boostTimer.current) clearTimeout(boostTimer.current);
      if (scriptedTimerRef.current) clearTimeout(scriptedTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DEV-only: low-cadence poll of the perf ref into state so the on-screen
  // HUD updates without adding a React re-render to the hot per-frame path.
  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return undefined;
    const id = setInterval(() => {
      const base = mountBaselineRef.current;
      const mountsSinceStart = base
        ? {
            building: DEV_MOUNT_STATS.building - base.building,
            structureShape: DEV_MOUNT_STATS.structureShape - base.structureShape,
            obstacleView: DEV_MOUNT_STATS.obstacleView - base.obstacleView,
          }
        : null;
      setPerfHud({ ...perfStatsRef.current, mountsSinceStart, recycles: engineRef.current ? engineRef.current.getPerfStats().recycleCount : 0 });
    }, 250);
    return () => clearInterval(id);
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

  // Single authoritative gameplay tap handler. Fires on touch-DOWN (onPressIn).
  // Reads refs so it always sees the live game state; the first tap in READY both
  // starts the run (and its official timing) AND applies exactly one flap.
  const doFlap = useCallback(() => {
    const st = inputStatsRef.current;
    st.raw += 1;
    Audio.unlock();
    const eng = engineRef.current;
    if (!eng || eng.dead) {
      st.ignored += 1;
      st.lastReason = 'dead/no-engine';
      if (typeof __DEV__ !== 'undefined' && __DEV__) setDevStats({ ...st, state: 'GAME_OVER' });
      return;
    }
    if (pausedRef.current) {
      st.ignored += 1;
      st.lastReason = 'paused';
      if (typeof __DEV__ !== 'undefined' && __DEV__) setDevStats({ ...st, state: 'PAUSED' });
      return;
    }
    if (!startedRef.current) {
      // READY -> RUNNING on the first valid tap. Snapshot the obstacle-pool
      // mount counters right here so the dev HUD can show any mounts that
      // happen AFTER this point (should stay exactly 0 for the pooled fix
      // to be verified correct).
      startedRef.current = true;
      runStartRef.current = performance.now();
      eng.start();
      setStarted(true);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        mountBaselineRef.current = { ...DEV_MOUNT_STATS };
      }
      if (pigeon.id === 'roadman' && !roadmanFlagsRef.current.wargwarn) {
        roadmanFlagsRef.current.wargwarn = true;
        showScriptedLine('Wargwarn?');
      }
    }
    st.accepted += 1;
    eng.flap();
    st.flaps += 1;
    Audio.flap();
    if (typeof __DEV__ !== 'undefined' && __DEV__) setDevStats({ ...st, state: 'RUNNING' });
  }, []);

  const doRevive = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.canRevive()) return;
    if (reviveBusy) return; // button protection — no duplicate ad requests
    setReviveBusy(true);
    setReviveMsg('');
    Ads.showRewardedRevive(
      () => {
        // verified reward callback — grant the revive, continue the SAME run
        eng.revive(performance.now());
        Audio.revive();
        setOver(null);
        setCanRevive(false);
        setReviveBusy(false);
        setShield(true);
        if (shieldTimer.current) clearTimeout(shieldTimer.current);
        shieldTimer.current = setTimeout(() => setShield(false), CONFIG.REVIVE_INVINCIBLE_MS);
      },
      () => {
        // no ad / incomplete reward — return cleanly to Game Over
        setReviveBusy(false);
        setReviveMsg('NO AD AVAILABLE — THE PIGEONS HAVE PROBABLY DRUNK THE SERVER.');
      }
    );
  }, [reviveBusy]);

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
    startRun();
  }, [startRun]);

  const fatLevel = fatLevelFor(fatChipsCur);
  // Beyond ABSOLUTE UNIT, wording keeps progressing off TOTAL chips this run (chips),
  // independent of fatChipsCur (which a Skinny Jab resets) — see config.js.
  const extraLevel = extraFatLevelFor(chips);

  return (
    <View style={styles.root}>
      <Background theme={activeMap} width={width} height={height} world={world} removeAds={removeAdsOwned} />

      {/* obstacles */}
      {obsGeom.map((g, i) => (
        <ObstacleView key={i} world={world} index={i} geom={g} theme={activeMap} screenH={height} />
      ))}

      {/* window heckler (environmental comedy) */}
      <HecklerView world={world} text={heckler.text} reaction={heckler.reaction} theme={activeMap} screenW={width} screenH={height} topInset={insets.top} />

      {/* chips */}
      {Array.from({ length: CONFIG.CHIP_POOL }).map((_, i) => (
        <ChipView key={i} world={world} index={i} />
      ))}

      {/* Skinny Jab rare pickup */}
      <JabView world={world} />
      {/* Pub pint pickup */}
      <PintView world={world} />
      <PopText world={world} />

      {/* feathers */}
      {Array.from({ length: CONFIG.FEATHER_POOL }).map((_, i) => (
        <FeatherView key={i} world={world} index={i} color={activeMap.feather} />
      ))}

      {/* pigeon */}
      <PigeonView world={world} pigeon={pigeon} fatLevel={fatLevel} boost={pintBoost} strength={drunkStrength} deflateSignal={deflateN} suppressQuips={!!scriptedLine} />

      {/* Roadman-only one-time scripted lines — priority speech bubble, safe-area clamped */}
      {scriptedLine && (
        <PigeonSpeechBubble world={world} text={scriptedLine.text} textKey={scriptedLine.key} screenW={width} screenH={height} topInset={insets.top} />
      )}

      {/* Drunk soft-focus over the WORLD only (never moves it) — below the HUD */}
      <DrunkScreenFX level={Math.min(1.4, drunkLevel + (pintBoost ? 0.4 : 0))} />

      {/* "SKINNY AGAIN!" toast on jab pickup — above the blur so it stays crisp */}
      {skinnyKey > 0 && <SkinnyToast key={skinnyKey} />}

      {/* flap input layer (below HUD buttons). Single authoritative handler on the
          gesture-responder touch-DOWN event so a valid tap is captured immediately
          (not on release) and never depends on React render timing. */}
      <View
        testID="flap-area"
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
        onResponderTerminationRequest={() => false}
        onResponderGrant={doFlap}
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
        <View style={styles.fatMsgWrap} pointerEvents="none">
          {extraLevel > 0 ? (
            <Text style={styles.fatLabel} testID="fat-label">{EXTRA_FAT_LABELS[extraLevel - 1]}</Text>
          ) : (
            fatLevel > 0 && <Text style={styles.fatLabel} testID="fat-label">{FAT_LABELS[fatLevel]}</Text>
          )}
        </View>
      </SafeAreaView>

      {shield && (
        <View style={styles.shield} pointerEvents="none" testID="shield-banner">
          <Text style={styles.shieldTxt}>SHIELD ACTIVE</Text>
        </View>
      )}

      {!started && !over && <ReadyHint />}

      {typeof __DEV__ !== 'undefined' && __DEV__ && devStats && (
        <View style={styles.devStats} pointerEvents="none" testID="dev-input-stats">
          <Text style={styles.devStatsTxt}>
            state:{devStats.state} raw:{devStats.raw} acc:{devStats.accepted} flap:{devStats.flaps} ign:{devStats.ignored}
            {devStats.lastReason ? ` (${devStats.lastReason})` : ''} match:{String(devStats.accepted === devStats.flaps)}
          </Text>
        </View>
      )}

      {typeof __DEV__ !== 'undefined' && __DEV__ && perfHud && (
        <View style={styles.perfHud} pointerEvents="none" testID="dev-perf-stats">
          <Text style={styles.devStatsTxt}>
            step:{perfHud.stepMs.toFixed(3)}ms chunk:{perfHud.chunkMs.toFixed(3)}ms maxChunk:{perfHud.maxChunkMs.toFixed(3)}ms pool:{CONFIG.OBSTACLE_POOL} recycles:{perfHud.recycles}{'\n'}
            mountsSinceStart building:{perfHud.mountsSinceStart ? perfHud.mountsSinceStart.building : '-'} structureShape:{perfHud.mountsSinceStart ? perfHud.mountsSinceStart.structureShape : '-'} obstacleView:{perfHud.mountsSinceStart ? perfHud.mountsSinceStart.obstacleView : '-'}
          </Text>
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

      {/* 1000m blackout Easter egg — covers everything, never blocks flaps */}
      <BlackoutOverlay world={world} />

      {over && (
        <GameOverOverlay
          message={over.message}
          chips={over.chips}
          distance={over.distance}
          bestDistance={Math.max(bestDistance, over.distance)}
          isNewBest={over.isNewBest}
          canRevive={canRevive}
          reviveBusy={reviveBusy}
          reviveMsg={reviveMsg}
          onPlayAgain={async () => {
            // occasional interstitial at the natural Game Over -> next-run
            // transition (never during gameplay; skipped for Remove Ads owners).
            await Ads.showInterstitialIfDue();
            setReviveMsg('');
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
  fatMsgWrap: { alignItems: 'center', marginTop: 10 },
  fatLabel: { fontFamily: FONT, color: COLORS.yellow, fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  shield: { position: 'absolute', bottom: 60, alignSelf: 'center', backgroundColor: 'rgba(62,242,192,0.9)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center' },
  shieldTxt: { fontFamily: FONT, color: '#053a2e', fontWeight: '700', fontSize: 16, letterSpacing: 1 },
  hint: { position: 'absolute', top: '46%', left: 0, right: 0, alignItems: 'center' },
  hintTxt: { fontFamily: FONT, color: '#fff', fontSize: 34, fontWeight: '700', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  hintSub: { fontFamily: FONT, color: '#fff', fontSize: 15, marginTop: 4, opacity: 0.9 },
  devStats: { position: 'absolute', bottom: 4, left: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, zIndex: 60 },
  perfHud: { position: 'absolute', bottom: 24, left: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, zIndex: 60 },
  devStatsTxt: { fontFamily: FONT, color: '#7CFFB2', fontSize: 10, fontWeight: '700' },
  confirmOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,8,30,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 340, backgroundColor: COLORS.card, borderRadius: 24, padding: 24, alignItems: 'center' },
  confirmTitle: { fontFamily: FONT, color: COLORS.yellow, fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  confirmSub: { fontFamily: FONT, color: COLORS.textDim, fontSize: 14, marginTop: 6, textAlign: 'center' },
  confirmBtn: { width: '100%', marginTop: 12 },
  blackout: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, zIndex: 50 },
  blackoutTxt: { fontFamily: FONT, color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', lineHeight: 30, letterSpacing: 0.5 },
  pop: { position: 'absolute', left: 0, top: 0, width: 100, alignItems: 'center', zIndex: 40 },
  popTxt: { fontFamily: FONT, color: '#fff', fontSize: 34, fontWeight: '700', letterSpacing: 1, textShadowColor: '#ff3b8d', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
});
