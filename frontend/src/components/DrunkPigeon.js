import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import PigeonSprite from './PigeonSprite';
import { Audio } from '../audio/audio';
import { FONT } from '../ui/theme';

// TEMPORARY development diagnostic. When true every pigeon fires its signature +
// events rapidly with exaggerated amplitude so they are impossible to miss while
// debugging. MUST remain false in production.
export const DRUNK_DIAG = false;

const rand = (a, b) => a + Math.random() * (b - a);

// ---- Per-pigeon drunk personality profiles (one shared controller, 7 configs) ----
// lean: static posture tilt (deg). sway/wob/bob: idle amplitude multipliers.
// weights: relative likelihood of each common event. sig: signature id.
// hic: hiccup label. sigCd: min ms between signature events. cadence: [min,max] ms.
const PROFILES = {
  classic: { lean: 0, sway: 1.2, wob: 1.25, bob: 1.15, hic: 'HIC!', hicSize: 0.26,
    rollMs: 620, weights: { bubble: 3, hic: 2, flail: 2, bigwob: 2, sig: 2 }, cadence: [1500, 2800], sigCd: 5000, sig: 'stagger' },
  business: { lean: 1, sway: 0.7, wob: 0.65, bob: 0.8, hic: 'hic.', hicSize: 0.17,
    rollMs: 760, weights: { bubble: 2, hic: 3, flail: 1, bigwob: 1, sig: 3 }, cadence: [1900, 3400], sigCd: 5600, sig: 'nap' },
  roadman: { lean: 9, sway: 0.95, wob: 1.0, bob: 1.2, hic: 'HIC—', hicSize: 0.24,
    rollMs: 480, weights: { bubble: 2, hic: 2, flail: 2, bigwob: 3, sig: 3 }, cadence: [1600, 3000], sigCd: 5200, sig: 'nahgood' },
  king: { lean: -5, sway: 0.75, wob: 0.6, bob: 0.9, hic: 'Hic!', hicSize: 0.2,
    rollMs: 1000, weights: { bubble: 2, hic: 3, flail: 1, bigwob: 2, sig: 3 }, cadence: [1900, 3400], sigCd: 5800, sig: 'salute' },
  gym: { lean: 0, sway: 1.0, wob: 1.1, bob: 1.0, hic: 'HIC!!', hicSize: 0.28,
    rollMs: 560, weights: { bubble: 2, hic: 2, flail: 2, bigwob: 2, sig: 3 }, cadence: [1600, 3000], sigCd: 5200, sig: 'rep' },
  tourist: { lean: 0, sway: 0.9, wob: 0.9, bob: 1.0, hic: 'hic?', hicSize: 0.2,
    rollMs: 700, weights: { bubble: 2, hic: 3, flail: 1, bigwob: 1, sig: 3 }, cadence: [1800, 3200], sigCd: 5600, sig: 'lost' },
  fancy: { lean: 4, sway: 0.7, wob: 0.55, bob: 0.85, hic: 'Hic.', hicSize: 0.18,
    rollMs: 900, weights: { bubble: 2, hic: 3, flail: 1, bigwob: 1, sig: 3 }, cadence: [2000, 3600], sigCd: 6000, sig: 'gentleman' },
};

const weightedPick = (weights) => {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
};

/* A single drunk bubble / gold sparkle that floats up + drifts + fades. */
function Bubble({ dx, bsize, dur, base, color }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) });
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateY: -p.value * base * 0.72 },
      { translateX: dx * p.value },
      { scale: 0.55 + p.value * 0.55 },
    ],
  }));
  const gold = color === 'gold';
  return (
    <Animated.View
      style={[
        bStyles.bubble,
        { width: bsize, height: bsize, borderRadius: bsize / 2 },
        gold && bStyles.gold,
        st,
      ]}
      pointerEvents="none"
    >
      {!gold && <View style={[bStyles.shine, { width: bsize * 0.34, height: bsize * 0.34, borderRadius: bsize }]} />}
    </Animated.View>
  );
}

/* Floating quip text (HIC!, quips). Re-mounted each time it shows. */
function Quip({ base, text, color, sizeFactor }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) });
  }, []);
  const st = useAnimatedStyle(() => {
    const inA = Math.min(p.value / 0.18, 1);
    const outA = p.value < 0.55 ? 1 : 1 - (p.value - 0.55) / 0.45;
    return {
      opacity: Math.max(0, Math.min(inA, outA)),
      transform: [
        { translateY: -p.value * base * 0.55 },
        { scale: 0.6 + inA * 0.7 },
        { rotate: `${(p.value - 0.5) * 8}deg` },
      ],
    };
  });
  return (
    <Animated.Text
      testID="drunk-hic"
      style={[qStyles.txt, { color, fontSize: Math.max(12, base * (sizeFactor || 0.22)) }, st]}
      pointerEvents="none"
    >
      {text}
    </Animated.Text>
  );
}

/* Tiny cartoon map that appears, flips upside-down, then fades — Tourist only. */
function MapProp({ base }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) });
  }, []);
  const st = useAnimatedStyle(() => {
    const inA = Math.min(p.value / 0.15, 1);
    const outA = p.value < 0.75 ? 1 : 1 - (p.value - 0.75) / 0.25;
    return {
      opacity: Math.max(0, Math.min(inA, outA)),
      transform: [{ rotate: `${p.value > 0.45 ? 180 : 0}deg` }, { scale: 0.8 + inA * 0.2 }],
    };
  });
  const w = base * 0.42;
  const h = base * 0.3;
  return (
    <Animated.View style={[mStyles.map, { width: w, height: h }, st]} pointerEvents="none">
      <View style={[mStyles.line, { width: '60%', top: '25%' }]} />
      <View style={[mStyles.line, { width: '40%', top: '50%' }]} />
      <View style={[mStyles.dot, { left: '65%', top: '55%' }]} />
    </Animated.View>
  );
}

/**
 * Shared drunk visual for every pigeon (menu, previews, gameplay), now driven by
 * a per-character personality profile. VISUAL ONLY — never affects physics,
 * hitbox, input, score, fatness or any mechanic. Layering:
 *   [caller position/opacity wrapper] -> DrunkPigeon body wrapper (idle + events +
 *   signature transform) -> PigeonSprite (fat + accessories). Whole container
 *   transforms so accessories always stay attached; bubbles/HIC/props overlay above.
 */
export default function DrunkPigeon({
  pigeon,
  fatLevel = 0,
  size = 120,
  intensity = 'full', // 'full' (gameplay / hero) | 'calm' (grid previews)
  eyes = true,        // enable blink/droopy eyes (skip on tiny sprites for perf)
  boost = false,      // temporary extra drunkenness (Pub pint boost)
  strength = 1,       // player wobble-strength setting multiplier
  sound = false,      // play tiny character sound on signatures (gameplay only)
  active = true,      // false pauses the random event scheduler
  testID,
}) {
  const prof = PROFILES[pigeon && pigeon.id] || PROFILES.classic;
  const calm = intensity === 'calm';
  const diag = DRUNK_DIAG;
  const fatF = 1 + Math.min(fatLevel, 6) * 0.14; // fatter => bigger + slower personality
  const amp = (calm ? 0.62 : 1) * fatF * (boost ? 1.5 : 1) * strength * (diag ? 2.2 : 1);
  const swayA = amp * prof.sway;
  const wobA = amp * prof.wob;
  const bobA = amp * prof.bob;
  const leanDeg = prof.lean * (calm ? 0.8 : 1);

  // continuous idle drivers (pure UI-thread)
  const sway = useSharedValue(0.5);
  const wob = useSharedValue(0.5);
  const bob = useSharedValue(0.5);
  // shared event drivers
  const roll = useSharedValue(0);
  const hic = useSharedValue(0);
  const flail = useSharedValue(0);
  const bigWob = useSharedValue(0);
  // signature drivers (added on top of everything)
  const sigRot = useSharedValue(0);
  const sigY = useSharedValue(0);
  const sigSX = useSharedValue(1);
  const sigSY = useSharedValue(1);

  const [bubbles, setBubbles] = useState([]);
  const [hicShown, setHicShown] = useState(false);
  const [hicKey, setHicKey] = useState(0);
  const [quip, setQuip] = useState(null); // { key, text, color, sizeFactor }
  const [mapKey, setMapKey] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [blink, setBlink] = useState(false);
  const [napClosed, setNapClosed] = useState(false);
  const bubbleId = useRef(0);
  const timers = useRef([]);
  const mounted = useRef(true);
  const lastSig = useRef(0);

  const pushTimer = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  };
  const spawnBubbles = (n, color) => {
    if (!mounted.current) return;
    const items = [];
    for (let i = 0; i < n; i += 1) {
      const id = (bubbleId.current += 1);
      const dur = rand(900, 1500);
      items.push({ id, dx: rand(-10, 16), bsize: rand(5, 11), dur, color });
      pushTimer(() => {
        if (mounted.current) setBubbles((b) => b.filter((x) => x.id !== id));
      }, dur + 80);
    }
    setBubbles((b) => [...b, ...items].slice(-18));
  };
  const doHic = () => {
    hic.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 180 }));
    setHicKey((k) => k + 1);
    setHicShown(true);
    pushTimer(() => mounted.current && setHicShown(false), 1000);
    // Gym: hiccup tenses the whole chest.
    if (prof.sig === 'rep') {
      sigSY.value = withSequence(withTiming(1.14, { duration: 100 }), withTiming(1, { duration: 220 }));
    }
    // Fancy/King: a small dignified reaction bubble.
    if (prof.sig === 'gentleman' || prof.sig === 'salute') spawnBubbles(1, 'gold');
    else spawnBubbles(1);
  };

  // start continuous idle + cleanup everything on unmount
  useEffect(() => {
    mounted.current = true;
    sway.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    wob.value = withRepeat(withTiming(1, { duration: 820, easing: Easing.inOut(Easing.sin) }), -1, true);
    bob.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      mounted.current = false;
      [sway, wob, bob, roll, hic, flail, bigWob, sigRot, sigY, sigSX, sigSY].forEach(cancelAnimation);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // ---- signature animations (visual only) ----
  const runSignature = (fs) => {
    const A = amp;
    if (sound) Audio.drunkSig(prof.sig);
    const T = (ms) => Math.round(ms * fs); // fatter/slower
    switch (prof.sig) {
      case 'stagger': { // Classic — messy over-correcting stumble
        sigRot.value = withSequence(
          withTiming(24 * A, { duration: T(240), easing: Easing.out(Easing.quad) }),
          withTiming(-30 * A, { duration: T(300), easing: Easing.inOut(Easing.sin) }),
          withTiming(15 * A, { duration: T(220), easing: Easing.inOut(Easing.sin) }),
          withTiming(-7 * A, { duration: T(200) }),
          withTiming(0, { duration: T(240) }),
        );
        flail.value = withSequence(withTiming(1, { duration: T(520), easing: Easing.linear }), withTiming(0, { duration: 0 }));
        spawnBubbles(2);
        return T(1200);
      }
      case 'nap': { // Business — falls asleep flying, then startles awake
        setNapClosed(true);
        sigRot.value = withSequence(withTiming(15, { duration: T(520), easing: Easing.inOut(Easing.sin) }), withTiming(15, { duration: T(360) }));
        sigY.value = withSequence(withTiming(size * 0.06, { duration: T(520) }), withTiming(size * 0.06, { duration: T(360) }));
        pushTimer(() => {
          if (!mounted.current) return;
          setNapClosed(false);
          sigRot.value = withSequence(withTiming(-13, { duration: 90 }), withTiming(5, { duration: 160 }), withTiming(0, { duration: 300 }));
          sigY.value = withTiming(0, { duration: 300 });
          sigSY.value = withSequence(withTiming(1.12, { duration: 90 }), withTiming(1, { duration: 220 }));
          flail.value = withSequence(withTiming(1, { duration: 380, easing: Easing.linear }), withTiming(0, { duration: 0 }));
          if (Math.random() < 0.4) showQuip('…meeting?', '#c3cad6', 0.14);
        }, T(900));
        return T(1500);
      }
      case 'nahgood': { // Roadman — huge wobble, then pretends it never happened
        sigRot.value = withSequence(
          withTiming(28 * A, { duration: T(200), easing: Easing.out(Easing.quad) }),
          withTiming(-26 * A, { duration: T(200), easing: Easing.inOut(Easing.sin) }),
          withTiming(16 * A, { duration: T(180) }),
          withTiming(0, { duration: T(220) }),
        );
        pushTimer(() => {
          if (!mounted.current) return;
          sigY.value = withSequence(withTiming(size * 0.05, { duration: 150 }), withTiming(-size * 0.02, { duration: 150 }), withTiming(0, { duration: 150 }));
          flail.value = withSequence(withTiming(1, { duration: 260, easing: Easing.linear }), withTiming(0, { duration: 0 }));
          if (Math.random() < 0.5) showQuip(Math.random() < 0.5 ? 'SAFE.' : "I'M GOOD.", '#7ec8f2', 0.16);
        }, T(820));
        return T(1400);
      }
      case 'salute': { // King — majestic pose, loses balance into a slow royal roll
        spawnBubbles(3, 'gold');
        sigSY.value = withSequence(withTiming(1.1, { duration: T(300) }), withTiming(1.1, { duration: T(200) }), withTiming(1, { duration: T(500) }));
        sigSX.value = withSequence(withTiming(1.06, { duration: T(300) }), withTiming(1, { duration: T(700) }));
        pushTimer(() => {
          if (!mounted.current) return;
          roll.value = withSequence(withTiming(1, { duration: T(1000), easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 0 }));
        }, T(520));
        pushTimer(() => {
          if (!mounted.current) return;
          sigRot.value = withSequence(withTiming(-8, { duration: 200 }), withTiming(6, { duration: 200 }), withTiming(0, { duration: 220 }));
        }, T(1600));
        return T(1900);
      }
      case 'rep': { // Gym — three drunken dumbbell curls, final rep nearly fails, proud flex
        sigSY.value = withSequence(
          withTiming(0.9, { duration: T(160) }), withTiming(1.05, { duration: T(160) }),
          withTiming(0.88, { duration: T(180) }), withTiming(1.05, { duration: T(180) }),
          withTiming(0.82, { duration: T(230) }), withTiming(1.08, { duration: T(230) }),
          withTiming(1, { duration: T(220) }),
        );
        pushTimer(() => {
          if (!mounted.current) return;
          // final-rep shake + bulge, then proud flex
          sigRot.value = withSequence(
            withTiming(6, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(5, { duration: 60 }),
            withTiming(-4, { duration: 60 }), withTiming(0, { duration: 120 }),
          );
          sigSX.value = withSequence(withTiming(1.12, { duration: 260 }), withTiming(1, { duration: 300 }));
          flail.value = withSequence(withTiming(1, { duration: 300, easing: Easing.linear }), withTiming(0, { duration: 0 }));
        }, T(1080));
        return T(1700);
      }
      case 'lost': { // Tourist — looks everywhere, checks an upside-down map
        sigRot.value = withSequence(
          withTiming(-18, { duration: T(300), easing: Easing.inOut(Easing.sin) }),
          withTiming(20, { duration: T(300), easing: Easing.inOut(Easing.sin) }),
          withTiming(-14, { duration: T(260) }),
          withTiming(0, { duration: T(240) }),
        );
        pushTimer(() => {
          if (!mounted.current) return;
          setMapKey((k) => k + 1);
          setShowMap(true);
          pushTimer(() => mounted.current && setShowMap(false), T(1400));
          if (Math.random() < 0.35) showQuip('…London?', '#bfe6e0', 0.15);
        }, T(700));
        return T(2000);
      }
      case 'gentleman': { // Fancy — calm monocle adjust + pipe puff, controlled roll, polite nod
        sigRot.value = withTiming(18, { duration: T(300), easing: Easing.out(Easing.quad) });
        spawnBubbles(1, 'gold'); // monocle glint
        pushTimer(() => mounted.current && spawnBubbles(2), T(220)); // pipe puff
        pushTimer(() => {
          if (!mounted.current) return;
          roll.value = withSequence(withTiming(1, { duration: T(860), easing: Easing.inOut(Easing.cubic) }), withTiming(0, { duration: 0 }));
        }, T(360));
        pushTimer(() => {
          if (!mounted.current) return;
          sigRot.value = withSequence(withTiming(0, { duration: 200 }), withTiming(6, { duration: 160 }), withTiming(0, { duration: 200 }));
          if (Math.random() < 0.3) showQuip('Ahem.', '#f6dd9a', 0.14);
        }, T(1260));
        return T(1800);
      }
      default:
        return 0;
    }
  };

  const showQuip = (text, color, sizeFactor) => {
    setQuip({ key: Date.now(), text, color, sizeFactor });
    pushTimer(() => mounted.current && setQuip((q) => (q && q.text === text ? null : q)), 1100);
  };

  // random drunk-event scheduler — weighted, cooldown-gated, one major at a time
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;
    const fs = Math.min(fatF, 1.7);

    const doFlail = () => {
      flail.value = withSequence(withTiming(1, { duration: 540, easing: Easing.linear }), withTiming(0, { duration: 0 }));
    };
    const doBigWob = () => {
      bigWob.value = withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(-1, { duration: 440, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 320, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
      );
    };
    const doRoll = () => {
      // barrel-roll flavour per personality (speed only; still visual-only + safe)
      const ms = Math.round(prof.rollMs * fs);
      const ease = prof.sig === 'gentleman' || prof.sig === 'salute' ? Easing.inOut(Easing.sin) : Easing.inOut(Easing.cubic);
      roll.value = withSequence(withTiming(1, { duration: ms, easing: ease }), withTiming(0, { duration: 0 }));
      if (prof.sig === 'stagger') doFlail(); // messy spin
    };

    const runEvent = (kind) => {
      if (kind === 'sig') {
        const now = Date.now();
        const cd = (diag ? 1200 : prof.sigCd * 0.5) * (boost ? 0.6 : 1);
        if (now - lastSig.current < cd) { spawnBubbles(2); return 700; }
        lastSig.current = now;
        return runSignature(fs);
      }
      if (kind === 'bubble') { spawnBubbles(Math.round(rand(2, 4))); return 700; }
      if (kind === 'hic') { doHic(); return 900; }
      if (kind === 'flail') { doFlail(); return 700; }
      if (kind === 'bigwob') { doBigWob(); return 900; }
      if (kind === 'roll') { doRoll(); return Math.round(prof.rollMs * fs) + 250; }
      return 700;
    };

    let first = true;
    const tick = () => {
      if (stopped || !mounted.current) return;
      let kind;
      if (first) {
        first = false;
        kind = 'sig';
        lastSig.current = 0; // allow the very first signature immediately
      } else {
        kind = diag && Math.random() < 0.6 ? 'sig' : weightedPick(prof.weights);
      }
      const dur = runEvent(kind);
      const [lo, hi] = prof.cadence;
      // Keep personality lively so it is unmistakable even in short runs.
      const gapBase = diag ? rand(400, 800) : calm ? rand(lo * 0.9, hi * 0.9) : rand(lo * 0.5, hi * 0.5);
      const gap = gapBase * (boost ? 0.55 : 1);
      pushTimer(tick, dur + gap);
    };
    pushTimer(tick, diag ? 400 : 650);
    const amb = setInterval(() => spawnBubbles(1), diag ? 700 : calm ? 2600 : 1600);
    return () => {
      stopped = true;
      clearInterval(amb);
    };
  }, [active, calm, diag, boost, fatLevel, pigeon && pigeon.id]);

  // occasional blink (larger sprites only)
  useEffect(() => {
    if (!active || !eyes) return undefined;
    let stopped = false;
    const loop = () => {
      if (stopped || !mounted.current) return;
      setBlink(true);
      pushTimer(() => mounted.current && setBlink(false), 140);
      pushTimer(loop, rand(1800, 4200));
    };
    pushTimer(loop, rand(1200, 2600));
    return () => {
      stopped = true;
    };
  }, [active, eyes]);

  const bodyStyle = useAnimatedStyle(() => {
    const swayDeg = (sway.value - 0.5) * 2 * 10 * swayA;
    const wobDeg = (wob.value - 0.5) * 2 * 5 * wobA;
    const bobPx = (bob.value - 0.5) * 2 * size * 0.07 * bobA;
    const rollDeg = roll.value * 360;
    const flailDeg = Math.sin(flail.value * Math.PI * 8) * 12 * amp;
    const flailScaleY = 1 + Math.sin(flail.value * Math.PI * 8) * 0.08;
    const bigDeg = bigWob.value * 18 * amp;
    const hicY = -hic.value * size * 0.1;
    const hicScale = 1 + hic.value * 0.1;
    return {
      transform: [
        { translateY: bobPx + hicY + sigY.value },
        { rotate: `${leanDeg + swayDeg + wobDeg + rollDeg + flailDeg + bigDeg + sigRot.value}deg` },
        { scaleX: (2 - flailScaleY) * hicScale * sigSX.value },
        { scaleY: flailScaleY * hicScale * sigSY.value },
      ],
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} testID={testID}>
      <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, bodyStyle]}>
        <PigeonSprite pigeon={pigeon} fatLevel={fatLevel} size={size} droopy={eyes} blink={eyes && (blink || napClosed)} />
        {showMap && (
          <View style={[mStyles.host, { top: size * 0.42 }]} pointerEvents="none">
            <MapProp key={mapKey} base={size} />
          </View>
        )}
      </Animated.View>

      {/* bubbles — anchored near the beak, float up ABOVE the pigeon (never clipped) */}
      <View style={[bStyles.layer, { left: size * 0.6, top: size * 0.24 }]} pointerEvents="none">
        {bubbles.map((b) => (
          <Bubble key={b.id} dx={b.dx} bsize={b.bsize} dur={b.dur} base={size} color={b.color} />
        ))}
      </View>

      {/* HIC! — above the head, personality label + colour */}
      <View style={[qStyles.host, { top: -size * 0.06, width: size }]} pointerEvents="none">
        {hicShown && <Quip key={`h${hicKey}`} base={size} text={prof.hic} color="#ffd23f" sizeFactor={prof.hicSize} />}
      </View>
      {/* signature quips */}
      <View style={[qStyles.host, { top: -size * 0.12, width: size }]} pointerEvents="none">
        {quip && <Quip key={quip.key} base={size} text={quip.text} color={quip.color} sizeFactor={quip.sizeFactor} />}
      </View>
    </View>
  );
}

const bStyles = StyleSheet.create({
  layer: { position: 'absolute', width: 0, height: 0 },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(226,240,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  gold: { backgroundColor: 'rgba(255,210,63,0.9)', borderColor: 'rgba(255,235,150,0.95)' },
  shine: { backgroundColor: 'rgba(255,255,255,0.9)', marginTop: 1, marginRight: 1 },
});

const qStyles = StyleSheet.create({
  host: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  txt: {
    fontFamily: FONT,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
});

const mStyles = StyleSheet.create({
  host: { position: 'absolute', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  map: { backgroundColor: '#f3ead0', borderRadius: 3, borderWidth: 1.5, borderColor: '#b8a980' },
  line: { position: 'absolute', height: 2, backgroundColor: '#b8a980', left: '18%' },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#e23b3b' },
});
