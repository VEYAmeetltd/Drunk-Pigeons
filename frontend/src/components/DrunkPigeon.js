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
import { FONT } from '../ui/theme';

// TEMPORARY development diagnostic. When true the pigeon animates with wildly
// exaggerated amplitude + rapid events so effects are impossible to miss while
// debugging. MUST remain false in production.
export const DRUNK_DIAG = false;

const rand = (a, b) => a + Math.random() * (b - a);

/* A single drunk bubble that floats up + drifts + fades, then is removed by the parent. */
function Bubble({ dx, bsize, dur, base }) {
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
  return (
    <Animated.View style={[bStyles.bubble, { width: bsize, height: bsize, borderRadius: bsize / 2 }, st]} pointerEvents="none">
      <View style={[bStyles.shine, { width: bsize * 0.34, height: bsize * 0.34, borderRadius: bsize }]} />
    </Animated.View>
  );
}

/* Big readable "HIC!" that pops in, floats up and fades. Re-mounted each hiccup. */
function HicText({ base }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });
  }, []);
  const st = useAnimatedStyle(() => {
    const inA = Math.min(p.value / 0.18, 1);
    const outA = p.value < 0.55 ? 1 : 1 - (p.value - 0.55) / 0.45;
    return {
      opacity: Math.max(0, Math.min(inA, outA)),
      transform: [
        { translateY: -p.value * base * 0.55 },
        { scale: 0.6 + inA * 0.7 },
        { rotate: `${(p.value - 0.5) * 10}deg` },
      ],
    };
  });
  return (
    <Animated.Text
      testID="drunk-hic"
      style={[hStyles.txt, { fontSize: Math.max(14, base * 0.24) }, st]}
      pointerEvents="none"
    >
      HIC!
    </Animated.Text>
  );
}

/**
 * Shared drunk visual for every pigeon (menu, previews, gameplay).
 * VISUAL ONLY — never affects physics, hitbox, input, score or any mechanic.
 * Layering:  [caller position/opacity wrapper] -> DrunkPigeon body wrapper
 *            (sway/wobble/bob/barrel-roll/hiccup/wing-flail) -> PigeonSprite (fat + accessories),
 *            with bubbles + HIC! rendered above and never clipped.
 */
export default function DrunkPigeon({
  pigeon,
  fatLevel = 0,
  size = 120,
  intensity = 'full', // 'full' (gameplay / hero) | 'calm' (grid previews)
  eyes = true,        // enable blink/droopy eyes (skip on tiny sprites for perf)
  boost = false,      // temporary extra drunkenness (e.g. a pub boost)
  active = true,      // false pauses the random event scheduler
  testID,
}) {
  const calm = intensity === 'calm';
  const diag = DRUNK_DIAG;
  const fat = 1 + Math.min(fatLevel, 6) * 0.14;
  const amp = (calm ? 0.6 : 1) * fat * (boost ? 1.5 : 1) * (diag ? 2.2 : 1);

  // continuous idle drivers (pure UI-thread, cheap)
  const sway = useSharedValue(0.5);
  const wob = useSharedValue(0.5);
  const bob = useSharedValue(0.5);
  // discrete event drivers
  const roll = useSharedValue(0);
  const hic = useSharedValue(0);
  const flail = useSharedValue(0);
  const bigWob = useSharedValue(0);

  const [bubbles, setBubbles] = useState([]);
  const [hicKey, setHicKey] = useState(0);
  const [hicShown, setHicShown] = useState(false);
  const [blink, setBlink] = useState(false);
  const bubbleId = useRef(0);
  const timers = useRef([]);
  const mounted = useRef(true);

  const pushTimer = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  };

  // start continuous idle + cleanup everything on unmount
  useEffect(() => {
    mounted.current = true;
    sway.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    wob.value = withRepeat(withTiming(1, { duration: 820, easing: Easing.inOut(Easing.sin) }), -1, true);
    bob.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      mounted.current = false;
      [sway, wob, bob, roll, hic, flail, bigWob].forEach(cancelAnimation);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // random drunk-event scheduler — one major event at a time, unpredictable timing
  useEffect(() => {
    if (!active) return undefined;
    let stopped = false;

    const spawnBubbles = (n) => {
      if (!mounted.current) return;
      const items = [];
      for (let i = 0; i < n; i += 1) {
        const id = (bubbleId.current += 1);
        const dur = rand(900, 1500);
        items.push({ id, dx: rand(-10, 16), bsize: rand(5, 11), dur });
        pushTimer(() => {
          if (mounted.current) setBubbles((b) => b.filter((x) => x.id !== id));
        }, dur + 80);
      }
      setBubbles((b) => [...b, ...items].slice(-16));
    };
    const doHic = () => {
      hic.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 180 }));
      setHicKey((k) => k + 1);
      setHicShown(true);
      pushTimer(() => mounted.current && setHicShown(false), 1000);
      spawnBubbles(2);
    };
    const doRoll = () => {
      roll.value = withSequence(
        withTiming(1, { duration: calm ? 780 : 640, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      );
    };
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

    const pool = ['bubble', 'bubble', 'hic', 'flail', 'bigwob', 'roll'];
    const tick = () => {
      if (stopped || !mounted.current) return;
      const e = pool[Math.floor(Math.random() * pool.length)];
      if (e === 'bubble') spawnBubbles(Math.round(rand(2, 4)));
      else if (e === 'hic') doHic();
      else if (e === 'roll') doRoll();
      else if (e === 'flail') doFlail();
      else doBigWob();
      const next = diag ? rand(700, 1200) : calm ? rand(2600, 4600) : rand(1500, 2900);
      pushTimer(tick, next);
    };
    pushTimer(tick, diag ? 500 : calm ? 1400 : 700);
    const amb = setInterval(() => spawnBubbles(1), diag ? 700 : calm ? 2400 : 1500);
    return () => {
      stopped = true;
      clearInterval(amb);
    };
  }, [active, calm, diag]);

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
    const swayDeg = (sway.value - 0.5) * 2 * 6 * amp;
    const wobDeg = (wob.value - 0.5) * 2 * 3 * amp;
    const bobPx = (bob.value - 0.5) * 2 * size * 0.045 * amp;
    const rollDeg = roll.value * 360;
    const flailDeg = Math.sin(flail.value * Math.PI * 8) * 10 * amp;
    const flailScaleY = 1 + Math.sin(flail.value * Math.PI * 8) * 0.07;
    const bigDeg = bigWob.value * 15 * amp;
    const hicY = -hic.value * size * 0.09;
    const hicScale = 1 + hic.value * 0.09;
    return {
      transform: [
        { translateY: bobPx + hicY },
        { rotate: `${swayDeg + wobDeg + rollDeg + flailDeg + bigDeg}deg` },
        { scaleX: (2 - flailScaleY) * hicScale },
        { scaleY: flailScaleY * hicScale },
      ],
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} testID={testID}>
      <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, bodyStyle]}>
        <PigeonSprite pigeon={pigeon} fatLevel={fatLevel} size={size} droopy={eyes} blink={eyes && blink} />
      </Animated.View>

      {/* bubbles — anchored near the beak, float up ABOVE the pigeon (never clipped) */}
      <View style={[bStyles.layer, { left: size * 0.6, top: size * 0.24 }]} pointerEvents="none">
        {bubbles.map((b) => (
          <Bubble key={b.id} dx={b.dx} bsize={b.bsize} dur={b.dur} base={size} />
        ))}
      </View>

      {/* HIC! — above the head */}
      <View style={[hStyles.host, { top: -size * 0.06, width: size }]} pointerEvents="none">
        {hicShown && <HicText key={hicKey} base={size} />}
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
  shine: { backgroundColor: 'rgba(255,255,255,0.9)', marginTop: 1, marginRight: 1 },
});

const hStyles = StyleSheet.create({
  host: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  txt: {
    fontFamily: FONT,
    color: '#ffd23f',
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
});
