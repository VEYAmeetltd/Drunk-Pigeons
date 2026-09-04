import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import Svg, { Circle, Rect as SvgRect, Line, G, Path } from 'react-native-svg';
import DrunkPigeon from './DrunkPigeon';
import { CONFIG, pigeonSizeFor } from '../config';
import { FONT } from '../ui/theme';
import { familyForObstacle, variantFor, FAMILIES } from '../game/obstacleAppearance';

const OW = CONFIG.OBSTACLE_WIDTH;

function shade(hex, f) {
  const h = (hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * f);
  const g = clamp(((n >> 8) & 255) * f);
  const b = clamp((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function rngFrom(seed) {
  let a = (seed || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- Pigeon ---------------- */
// The outer Animated.View owns ONLY the gameplay/physics-driven presentation:
// world position, velocity tilt, flap squash and death/invincible opacity.
// The drunk personality (sway, wobble, bob, hiccups, HIC!, bubbles, wing flail
// and the 360° barrel roll) lives INSIDE, in DrunkPigeon, so it can never touch
// physics — collision/hitbox use world.px/py + size only, not this visual transform.
export function PigeonView({ world, pigeon, fatLevel, boost = false, strength = 1, deflateSignal = 0 }) {
  const size = pigeonSizeFor(fatLevel);
  const style = useAnimatedStyle(() => {
    const w = world.value;
    const t = w.t || 0;
    const squashY = 1 - w.flap * 0.16;
    const squashX = 1 + w.flap * 0.12;
    let opacity = 1;
    if (w.dead) opacity = 0;
    else if (w.inv) opacity = 0.45 + 0.45 * Math.abs(Math.sin(t / 70));
    return {
      opacity,
      transform: [
        { translateX: w.px - size / 2 },
        { translateY: w.py - size / 2 },
        { rotate: `${w.tilt}deg` },
        { scaleX: squashX },
        { scaleY: squashY },
      ],
    };
  });
  return (
    <Animated.View style={[styles.abs, { width: size, height: size }, style]} pointerEvents="none">
      <DrunkPigeon pigeon={pigeon} fatLevel={fatLevel} size={size} intensity="full" eyes boost={boost} strength={strength} sound deflateSignal={deflateSignal} testID="game-pigeon" />
    </Animated.View>
  );
}

/* "SKINNY AGAIN!" toast — flashes on Skinny Jab pickup, then fades. */
export function SkinnyToast() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });
  }, []);
  const st = useAnimatedStyle(() => {
    const inA = Math.min(p.value / 0.14, 1);
    const outA = p.value < 0.6 ? 1 : 1 - (p.value - 0.6) / 0.4;
    return {
      opacity: Math.max(0, Math.min(inA, outA)),
      transform: [{ translateY: -p.value * 46 }, { scale: 0.6 + inA * 0.7 }, { rotate: `${(p.value - 0.5) * 10}deg` }],
    };
  });
  return (
    <View pointerEvents="none" style={skinnyStyles.host}>
      <Animated.Text style={[skinnyStyles.txt, st]}>SKINNY AGAIN!</Animated.Text>
    </View>
  );
}

const skinnyStyles = StyleSheet.create({
  host: { position: 'absolute', top: '32%', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  txt: {
    fontFamily: FONT,
    color: '#7ef0c0',
    fontWeight: '900',
    fontSize: 34,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 4,
  },
});

/* ---------------- Obstacle ---------------- */
export function ObstacleView({ world, index, geom, theme, screenH }) {
  const style = useAnimatedStyle(() => {
    const o = world.value.obs[index];
    return {
      opacity: o && o.active ? 1 : 0,
      transform: [{ translateX: o ? o.x : -999 }],
    };
  });
  const groundY = screenH - CONFIG.GROUND_H;
  const topH = geom.topH;
  const bottomY = topH + geom.gap;
  const bottomH = Math.max(0, groundY - bottomY);
  const family = familyForObstacle(geom.spawnIndex, theme.id);
  return (
    <Animated.View style={[styles.abs, { left: 0, top: 0, width: OW }, style]} pointerEvents="none">
      <Building height={topH} theme={theme} seed={geom.seed} family={family} flip />
      <View style={{ position: 'absolute', top: bottomY, height: bottomH, width: OW }}>
        <Building height={bottomH} theme={theme} seed={geom.seed} family={family} ground />
      </View>
    </Animated.View>
  );
}

// Procedurally varied cartoon building. Collision is unchanged (fixed OW column);
// everything here is decorative and never intercepts touches.
function Building({ height, theme, seed, flip, ground, family = FAMILIES.BUILDING }) {
  const cfg = useMemo(() => {
    const r = rngFrom((seed || 1) + (flip ? 7777 : 13));
    const bricks = theme.brickPalette && theme.brickPalette.length ? theme.brickPalette : [theme.obstacle];
    const base = bricks[Math.floor(r() * bricks.length)] || theme.obstacle;
    const bodyF = 0.9 + r() * 0.2;
    const body = shade(base, bodyF);
    const border = shade(base, bodyF * 0.66);
    const roofs = theme.roofPalette && theme.roofPalette.length ? theme.roofPalette : [border];
    const roofColor = roofs[Math.floor(r() * roofs.length)] || border;
    const doors = theme.doorPalette && theme.doorPalette.length ? theme.doorPalette : [shade(base, 0.5)];
    const doorColor = doors[Math.floor(r() * doors.length)] || shade(base, 0.5);
    const type = Math.floor(r() * 5); // 0 residential 1 rundown 2 commercial 3 pub 4 office
    const cols = type === 2 || type === 3 ? 1 : r() > 0.35 ? 2 : 1;
    const roof = Math.floor(r() * 3); // 0 flat bar, 1 parapet, 2 pitched
    const chimneys = type === 0 || type === 1 ? Math.floor(r() * 3) : 0;
    const antenna = r() > 0.6;
    const drainpipe = r() > 0.45 ? (r() > 0.5 ? 'left' : 'right') : null;
    const balcony = type === 0 && r() > 0.55;
    const front = ground ? (type === 3 ? 'pub' : type === 2 ? 'shop' : 'door') : null;
    const litSeed = r();
    return { body, border, roofColor, doorColor, type, cols, roof, chimneys, antenna, drainpipe, balcony, front, litSeed };
  }, [seed, flip, ground, theme]);

  const rows = useMemo(() => {
    const usable = height - 30 - (ground ? 20 : 0);
    const n = Math.max(0, Math.floor(usable / 30));
    return Array.from({ length: n });
  }, [height, ground]);

  if (height <= 0) return null;
  const gapEdgeB = flip ? 'bottom' : 'top';
  const anchorEdgeB = flip ? 'top' : 'bottom';
  const STRUCT = [FAMILIES.CRANE, FAMILIES.SCAFFOLD, FAMILIES.RAILWAY, FAMILIES.PARK, FAMILIES.BILLBOARD];
  if (STRUCT.includes(family)) {
    return (
      <StructureColumn
        family={family}
        height={height}
        theme={theme}
        seed={seed}
        gapEdge={gapEdgeB}
        anchorEdge={anchorEdgeB}
      />
    );
  }
  const edgeStyle = flip ? { bottom: -3 } : { top: -3 };
  const accent = theme.accent;
  // Only genuine buildings reach here (non-building families render as StructureColumn).
  const showWindows = true;

  return (
    <View style={[obStyles.col, { height, backgroundColor: cfg.body, borderColor: cfg.border }]}>
      {/* roof / parapet on the gap-facing edge */}
      <Roof roof={cfg.roof} flip={flip} color={cfg.roofColor} />
      <View style={[obStyles.edgeDeco, edgeStyle]} pointerEvents="none">
        {Array.from({ length: cfg.chimneys }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: 12 + i * 22,
              [flip ? 'top' : 'bottom']: 2,
              width: 12,
              height: 16,
              backgroundColor: cfg.border,
              borderRadius: 2,
            }}
          />
        ))}
        {cfg.antenna && (
          <View
            style={{
              position: 'absolute',
              right: 14,
              [flip ? 'top' : 'bottom']: 2,
              width: 2,
              height: 20,
              backgroundColor: cfg.border,
            }}
          />
        )}
      </View>

      {/* drainpipe */}
      {cfg.drainpipe && (
        <View
          style={{
            position: 'absolute',
            [cfg.drainpipe]: 4,
            top: 8,
            bottom: 8,
            width: 3,
            backgroundColor: cfg.border,
            opacity: 0.8,
          }}
        />
      )}

      {/* windows */}
      {showWindows && (
      <View style={[obStyles.windows, ground && { justifyContent: 'flex-start' }]}>
        {rows.map((_, i) => (
          <View key={i} style={[obStyles.winRow, { gap: cfg.cols === 2 ? 8 : 0 }]}>
            {Array.from({ length: cfg.cols }).map((_, c) => {
              const lit = ((i * 3 + c * 7 + Math.floor(cfg.litSeed * 100)) % 5) < 2;
              return (
                <View
                  key={c}
                  style={[
                    obStyles.win,
                    cfg.cols === 1 && { width: 26 },
                    { backgroundColor: lit ? theme.window : cfg.border, borderColor: cfg.border },
                    cfg.balcony && i === 0 && { borderBottomWidth: 3, borderBottomColor: accent },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      )}

      {/* street-level shop / pub / door on the ground building */}
      {cfg.front && (
        <View style={obStyles.front} pointerEvents="none">
          {cfg.front !== 'door' && (
            <View style={[obStyles.sign, { backgroundColor: accent }]}>
              <View style={obStyles.signDot} />
              <View style={obStyles.signDot} />
              <View style={obStyles.signDot} />
            </View>
          )}
          <View style={[obStyles.door, { backgroundColor: cfg.doorColor }]} />
        </View>
      )}
    </View>
  );
}

// Distinct non-building structures with BOLD, unmistakable silhouettes.
//
// Fairness/collision: the engine's hitbox is a solid rect spanning the full OW column
// from the screen edge to the gap edge (same as buildings) — difficulty is unchanged.
// So the OPAQUE solid body of every structure fills that exact column (visible solid ==
// hitbox — you never die on empty air). The recognisable "signature" parts (crane jib,
// billboard panel, tree canopy bumps, scaffold poles) project OUTWARD on the anchored
// screen-edge side into genuinely free sky and carry NO hidden hitbox, so they can only
// ever be forgiving, never unfair. The wrapper does NOT clip, so those signatures show.
function StructureColumn({ family, height, theme, seed, gapEdge, anchorEdge }) {
  if (family === FAMILIES.CRANE) return <CraneStruct height={height} anchorEdge={anchorEdge} />;
  if (family === FAMILIES.SCAFFOLD) return <ScaffoldStruct height={height} seed={seed} anchorEdge={anchorEdge} />;
  if (family === FAMILIES.RAILWAY) return <RailwayStruct height={height} anchorEdge={anchorEdge} />;
  if (family === FAMILIES.BILLBOARD) return <BillboardStruct height={height} theme={theme} seed={seed} anchorEdge={anchorEdge} />;
  return <TreeStruct height={height} gapEdge={gapEdge} anchorEdge={anchorEdge} />;
}

const structStyles = StyleSheet.create({
  wrap: { width: OW, height: '100%' },
  body: { position: 'absolute', left: 0, top: 0, width: OW, borderRadius: 4, overflow: 'hidden' },
});

// Yellow tower crane: opaque lattice mast (full column) + projecting jib + hook in free sky.
function CraneStruct({ height, anchorEdge }) {
  const dark = '#8a6410';
  const yellow = '#f2b41c';
  const jibY = 8; // distance from the anchored screen edge to the jib beam
  const rungs = Math.max(3, Math.floor(height / 26));
  return (
    <View style={[structStyles.wrap, { height }]} pointerEvents="none">
      {/* opaque mast body = the hitbox */}
      <View style={[structStyles.body, { height, backgroundColor: yellow, borderWidth: 2, borderColor: dark }]}>
        <Svg width={OW} height={height} viewBox={`0 0 ${OW} ${height}`}>
          <SvgRect x="3" y="0" width="4" height={height} fill={dark} />
          <SvgRect x={OW - 7} y="0" width="4" height={height} fill={dark} />
          {Array.from({ length: rungs }).map((_, i) => {
            const y = 4 + i * 26;
            return (
              <G key={i}>
                <Line x1="5" y1={y} x2={OW - 5} y2={y + 20} stroke={dark} strokeWidth="3" />
                <Line x1={OW - 5} y1={y} x2="5" y2={y + 20} stroke={dark} strokeWidth="3" />
                <Line x1="5" y1={y} x2={OW - 5} y2={y} stroke={dark} strokeWidth="2.5" />
              </G>
            );
          })}
        </Svg>
      </View>
      {/* operator cab at the anchored end */}
      <View style={{ position: 'absolute', [anchorEdge]: jibY - 2, left: OW / 2 - 9, width: 18, height: 16, backgroundColor: '#e9e2c9', borderWidth: 2, borderColor: dark, borderRadius: 2 }} />
      {/* long horizontal jib projecting into free sky (no hitbox) */}
      <View style={{ position: 'absolute', [anchorEdge]: jibY, left: -OW * 0.95, width: OW * 1.9, height: 9, backgroundColor: yellow, borderWidth: 2, borderColor: dark }} />
      {/* short counter-jib block */}
      <View style={{ position: 'absolute', [anchorEdge]: jibY - 6, right: -OW * 0.35, width: 14, height: 12, backgroundColor: dark, borderRadius: 2 }} />
      {/* hook cable + hook hanging from the far end of the jib */}
      <View style={{ position: 'absolute', [anchorEdge]: jibY + 9, left: -OW * 0.75, width: 2, height: 22, backgroundColor: dark }} />
      <View style={{ position: 'absolute', [anchorEdge]: jibY + 31, left: -OW * 0.75 - 3, width: 8, height: 6, backgroundColor: dark, borderRadius: 2 }} />
    </View>
  );
}

// Scaffolding-clad building: opaque muted body + dense pole/plank/brace frame + green net + poles jutting past the top.
function ScaffoldStruct({ height, seed, anchorEdge }) {
  const v = variantFor(seed);
  const pole = '#c9ccd1';
  const plankC = '#c79a54';
  const decks = Math.max(2, Math.floor(height / 40));
  const net = v > 0.5 ? 'rgba(78,168,102,0.30)' : 'rgba(64,132,196,0.28)';
  return (
    <View style={[structStyles.wrap, { height }]} pointerEvents="none">
      {/* opaque building carcass = the hitbox */}
      <View style={[structStyles.body, { height, backgroundColor: '#8b8f96', borderWidth: 2, borderColor: '#5c6068' }]}>
        {/* safety netting panel */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: net }]} />
        <Svg width={OW} height={height} viewBox={`0 0 ${OW} ${height}`}>
          {/* vertical standards */}
          <SvgRect x="5" y="0" width="4" height={height} fill={pole} />
          <SvgRect x={OW / 2 - 2} y="0" width="4" height={height} fill={pole} />
          <SvgRect x={OW - 9} y="0" width="4" height={height} fill={pole} />
          {Array.from({ length: decks }).map((_, i) => {
            const y = 12 + i * 40;
            return (
              <G key={i}>
                {/* ledger + wooden plank deck */}
                <SvgRect x="4" y={y} width={OW - 8} height="3" fill={pole} />
                <SvgRect x="4" y={y + 4} width={OW - 8} height="6" fill={plankC} />
                {/* cross brace */}
                <Line x1="7" y1={y + 10} x2={OW - 7} y2={y + 40} stroke={pole} strokeWidth="2.5" />
                <Line x1={OW - 7} y1={y + 10} x2="7" y2={y + 40} stroke={pole} strokeWidth="2.5" />
              </G>
            );
          })}
        </Svg>
      </View>
      {/* poles + a warning banner jutting past the anchored edge */}
      <View style={{ position: 'absolute', [anchorEdge]: -10, left: 5, width: 4, height: 14, backgroundColor: pole }} />
      <View style={{ position: 'absolute', [anchorEdge]: -10, left: OW / 2 - 2, width: 4, height: 14, backgroundColor: pole }} />
      <View style={{ position: 'absolute', [anchorEdge]: -10, left: OW - 9, width: 4, height: 14, backgroundColor: pole }} />
      <View style={{ position: 'absolute', [anchorEdge]: -6, left: 3, right: 3, height: 6, backgroundColor: '#e2b53a' }} />
    </View>
  );
}

// Railway steel gantry / girder bridge: opaque steel body + triangulated truss + rivets + signal gantry beam.
function RailwayStruct({ height, anchorEdge }) {
  const steel = '#5f6870';
  const dk = '#363c42';
  const lt = '#828b94';
  const bays = Math.max(3, Math.floor(height / 30));
  return (
    <View style={[structStyles.wrap, { height }]} pointerEvents="none">
      <View style={[structStyles.body, { height, backgroundColor: steel, borderWidth: 2, borderColor: dk }]}>
        <Svg width={OW} height={height} viewBox={`0 0 ${OW} ${height}`}>
          {/* flange chords */}
          <SvgRect x="4" y="0" width="6" height={height} fill={dk} />
          <SvgRect x={OW - 10} y="0" width="6" height={height} fill={dk} />
          {Array.from({ length: bays }).map((_, i) => {
            const y = i * 30;
            return (
              <G key={i}>
                <Line x1="8" y1={y} x2={OW - 8} y2={y + 30} stroke={lt} strokeWidth="4" />
                <Line x1={OW - 8} y1={y} x2="8" y2={y + 30} stroke={lt} strokeWidth="4" />
                <Line x1="6" y1={y} x2={OW - 6} y2={y} stroke={dk} strokeWidth="3" />
                <Circle cx="7" cy={y} r="1.6" fill={lt} />
                <Circle cx={OW - 7} cy={y} r="1.6" fill={lt} />
              </G>
            );
          })}
        </Svg>
      </View>
      {/* signal gantry cross-beam projecting past both edges into free sky */}
      <View style={{ position: 'absolute', [anchorEdge]: 6, left: -OW * 0.35, width: OW * 1.7, height: 8, backgroundColor: dk }} />
      <View style={{ position: 'absolute', [anchorEdge]: 0, left: -OW * 0.28, width: 6, height: 6, borderRadius: 3, backgroundColor: '#e0483a' }} />
      <View style={{ position: 'absolute', [anchorEdge]: 0, right: -OW * 0.28, width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ad06a' }} />
    </View>
  );
}

// Roadside billboard / sign gantry: opaque support leg (full column) + big ad panel projecting into free sky.
function BillboardStruct({ height, theme, seed, anchorEdge }) {
  const v = variantFor(seed);
  const accent = theme.accent;
  const dark = theme.obstacleDark || '#333';
  const post = '#6a6f77';
  const panelH = 46;
  const panelW = OW * 1.7;
  return (
    <View style={[structStyles.wrap, { height }]} pointerEvents="none">
      {/* opaque support structure = the hitbox */}
      <View style={[structStyles.body, { height, backgroundColor: post, borderWidth: 2, borderColor: '#464b52' }]}>
        <Svg width={OW} height={height} viewBox={`0 0 ${OW} ${height}`}>
          <SvgRect x={OW / 2 - 8} y="0" width="6" height={height} fill="#4d525a" />
          <SvgRect x={OW / 2 + 2} y="0" width="6" height={height} fill="#4d525a" />
          {Array.from({ length: Math.max(2, Math.floor(height / 34)) }).map((_, i) => (
            <Line key={i} x1={OW / 2 - 6} y1={10 + i * 34} x2={OW / 2 + 8} y2={30 + i * 34} stroke="#3b3f45" strokeWidth="3" />
          ))}
        </Svg>
      </View>
      {/* the big billboard panel projecting into free sky on the anchored edge */}
      <View style={{ position: 'absolute', [anchorEdge]: 4, left: (OW - panelW) / 2, width: panelW, height: panelH, backgroundColor: '#ffffff', borderWidth: 3, borderColor: dark, borderRadius: 4, padding: 6, justifyContent: 'center' }}>
        <View style={{ height: 8, width: '85%', backgroundColor: accent, marginBottom: 5, borderRadius: 2 }} />
        <View style={{ height: 7, width: '60%', backgroundColor: v > 0.5 ? theme.window : '#e0483a', marginBottom: 5, borderRadius: 2 }} />
        <View style={{ height: 7, width: '72%', backgroundColor: dark, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// Big leafy tree / topiary: the OPAQUE full-width green foliage fills the whole column
// (so the solid hitbox stays honest — no dying on empty air beside a thin trunk), with a
// bushy rounded canopy at the gap edge and a brown trunk detail drawn on top at the base.
function TreeStruct({ height, gapEdge, anchorEdge }) {
  const trunk = '#7a5330';
  const cw = OW;
  const canopyH = Math.min(height, OW + 22);
  return (
    <View style={[structStyles.wrap, { height }]} pointerEvents="none">
      {/* full-width foliage body = the honest hitbox */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: cw, height, backgroundColor: '#2f8b3c', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }} />
      {/* brown trunk detail on the anchored (screen-edge) base, drawn over the foliage */}
      <View style={{ position: 'absolute', [anchorEdge]: 0, left: OW / 2 - 7, width: 14, height: Math.min(height, height * 0.5), backgroundColor: trunk }} />
      <View style={{ position: 'absolute', [anchorEdge]: 0, left: OW / 2 - 7, width: 5, height: Math.min(height, height * 0.5), backgroundColor: '#5f4025' }} />
      {/* bushy rounded leaf layers near the gap edge (never poke past the gap edge line) */}
      <View style={{ position: 'absolute', [gapEdge]: 0, left: -4, width: cw + 8, height: canopyH, borderRadius: cw, backgroundColor: '#3fa24c' }} />
      <View style={{ position: 'absolute', [gapEdge]: canopyH * 0.22, left: 4, width: cw - 8, height: canopyH * 0.66, borderRadius: cw, backgroundColor: '#57bd62' }} />
      <View style={{ position: 'absolute', [gapEdge]: canopyH * 0.4, left: 12, width: cw - 26, height: canopyH * 0.38, borderRadius: cw, backgroundColor: '#74d17e', opacity: 0.92 }} />
    </View>
  );
}

function Roof({ roof, flip, color }) {
  if (roof === 2) {
    // pitched triangle pointing away from the building body (toward the gap)
    const tri = flip
      ? { borderTopWidth: 13, borderTopColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent' }
      : { borderBottomWidth: 13, borderBottomColor: color, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
    return (
      <View
        style={[
          obStyles.roofWrap,
          flip ? { bottom: -12 } : { top: -12 },
          { width: 0, height: 0, borderLeftWidth: OW / 2, borderRightWidth: OW / 2, alignSelf: 'center' },
          tri,
        ]}
        pointerEvents="none"
      />
    );
  }
  if (roof === 1) {
    // parapet: bar with two notches
    return (
      <View style={[obStyles.roofBar, flip ? { bottom: -4 } : { top: -4 }, { backgroundColor: color }]} pointerEvents="none">
        <View style={[obStyles.notch, { backgroundColor: color }]} />
        <View style={[obStyles.notch, { backgroundColor: color }]} />
        <View style={[obStyles.notch, { backgroundColor: color }]} />
      </View>
    );
  }
  // flat cap
  return <View style={[obStyles.cap, flip ? { bottom: -4 } : { top: -4 }, { backgroundColor: color }]} pointerEvents="none" />;
}

/* ---------------- Chip (golden potato crisp) ---------------- */
export function ChipView({ world, index }) {
  const S = CONFIG.CHIP_SIZE;
  const style = useAnimatedStyle(() => {
    const c = world.value.chips[index];
    if (!c || !c.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const t = world.value.t || 0;
    const phase = index * 1.7;
    const wobble = Math.sin(t / 260 + phase) * 10; // gentle rotation
    const bob = Math.sin(t / 300 + phase) * 2; // gentle bob
    const scale = c.eaten ? 1 + c.anim * 1.4 : 1;
    const opacity = c.eaten ? 1 - c.anim : 1;
    return {
      opacity,
      transform: [
        { translateX: c.x - S / 2 },
        { translateY: c.y - S / 2 + bob },
        { rotate: `${wobble}deg` },
        { scale },
      ],
    };
  });
  // shimmer highlight pulses subtly
  const shimmer = useAnimatedStyle(() => {
    const t = world.value.t || 0;
    return { opacity: 0.55 + 0.35 * Math.abs(Math.sin(t / 220 + index)) };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <Svg width={S} height={S} viewBox="0 0 32 32">
        {/* soft contrast halo so the crisp stays visible on bright/busy skies */}
        <Circle cx="16" cy="16" r="15" fill="rgba(35,22,5,0.16)" />
        {/* irregular curved potato-crisp body */}
        <Path
          d="M6.5 15 C4 8 10 4.5 15 4.5 C20.5 4.5 27 7 27.5 13 C28 18 25 22 21 25 C17 28 10.5 27.5 8 23 C6 19.5 7.5 17 6.5 15 Z"
          fill="#f2b83a"
          stroke="#a86a12"
          strokeWidth="1.7"
        />
        {/* darker toasted patches for texture */}
        <Path d="M11 19 C13 21 17 21 19 19" stroke="#d99a24" strokeWidth="1.2" fill="none" opacity="0.7" />
        <Circle cx="12" cy="12" r="1.1" fill="#c9861a" opacity="0.55" />
        <Circle cx="20" cy="16" r="1" fill="#c9861a" opacity="0.5" />
        <Circle cx="16" cy="22" r="0.9" fill="#c9861a" opacity="0.5" />
      </Svg>
      {/* shimmer highlight */}
      <Animated.View style={[chipStyles.shine, shimmer]} pointerEvents="none" />
    </Animated.View>
  );
}

/* ---------------- Skinny Jab (rare fatness-reset pickup) ---------------- */
export function JabView({ world }) {
  const S = CONFIG.SKINNY_JAB_SIZE;
  const style = useAnimatedStyle(() => {
    const j = world.value.jab;
    if (!j || !j.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const t = world.value.t || 0;
    const bob = Math.sin(t / 280) * 3;
    const rot = Math.sin(t / 420) * 14 - 20;
    return {
      opacity: 1,
      transform: [{ translateX: j.x - S / 2 }, { translateY: j.y - S / 2 + bob }, { rotate: `${rot}deg` }],
    };
  });
  const sparkle = useAnimatedStyle(() => {
    const t = world.value.t || 0;
    return { opacity: 0.4 + 0.6 * Math.abs(Math.sin(t / 180)) };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <Svg width={S} height={S} viewBox="0 0 40 40">
        {/* glow halo so the rare pickup pops */}
        <Circle cx="20" cy="20" r="18" fill="rgba(80,220,200,0.18)" />
        {/* syringe barrel (diagonal), generic & cartoonish */}
        <G>
          <Line x1="9" y1="31" x2="27" y2="13" stroke="#dff6f1" strokeWidth="9" strokeLinecap="round" />
          <Line x1="9" y1="31" x2="27" y2="13" stroke="#9fe6db" strokeWidth="5" strokeLinecap="round" />
          {/* teal fluid */}
          <Line x1="12" y1="28" x2="22" y2="18" stroke="#2fd6b6" strokeWidth="4.4" strokeLinecap="round" />
          {/* plunger flange + rod */}
          <Line x1="5.5" y1="27" x2="12" y2="34" stroke="#cfeee9" strokeWidth="3.4" strokeLinecap="round" />
          <Line x1="3" y1="33" x2="9.5" y2="39.5" stroke="#8fd8cc" strokeWidth="3" strokeLinecap="round" />
          {/* needle */}
          <Line x1="27" y1="13" x2="35" y2="5" stroke="#b7c4c2" strokeWidth="2" strokeLinecap="round" />
          <Line x1="24" y1="16" x2="30" y2="10" stroke="#eef7f5" strokeWidth="5.2" strokeLinecap="round" />
        </G>
      </Svg>
      {/* rare-item sparkle */}
      <Animated.View style={[jabStyles.sparkle, sparkle]} pointerEvents="none" />
    </Animated.View>
  );
}

const jabStyles = StyleSheet.create({
  sparkle: { position: 'absolute', top: 3, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
});

/* ---------------- Pub Pint (collectible drunk boost) ---------------- */
export function PintView({ world }) {
  const S = CONFIG.PINT_SIZE;
  const style = useAnimatedStyle(() => {
    const pt = world.value.pint;
    if (!pt || !pt.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const t = world.value.t || 0;
    const bob = Math.sin(t / 260) * 3;
    const rot = Math.sin(t / 500) * 10;
    return {
      opacity: 1,
      transform: [{ translateX: pt.x - S / 2 }, { translateY: pt.y - S / 2 + bob }, { rotate: `${rot}deg` }],
    };
  });
  const foam = useAnimatedStyle(() => {
    const t = world.value.t || 0;
    return { opacity: 0.5 + 0.5 * Math.abs(Math.sin(t / 200)) };
  });
  return (
    <Animated.View style={[styles.abs, { width: S, height: S }, style]} pointerEvents="none">
      <Svg width={S} height={S} viewBox="0 0 40 40">
        {/* glow halo */}
        <Circle cx="20" cy="21" r="18" fill="rgba(255,196,0,0.16)" />
        {/* glass mug */}
        <SvgRect x="9" y="12" width="17" height="23" rx="2.5" fill="rgba(255,224,130,0.55)" stroke="#e8b53a" strokeWidth="1.6" />
        {/* amber beer */}
        <SvgRect x="10.5" y="18" width="14" height="15.5" rx="2" fill="#f2a71b" />
        {/* handle */}
        <Path d="M 26 16 q 8 1 8 8 q 0 7 -8 7" fill="none" stroke="#e8b53a" strokeWidth="2.4" />
        {/* foam head */}
        <Circle cx="13" cy="13" r="4.4" fill="#fffdf3" />
        <Circle cx="18.5" cy="11.5" r="4.8" fill="#fffdf3" />
        <Circle cx="23.5" cy="13" r="4.2" fill="#fffdf3" />
      </Svg>
      <Animated.View style={[jabStyles.sparkle, { backgroundColor: '#fffdf3' }, foam]} pointerEvents="none" />
    </Animated.View>
  );
}

/* -------- Drunk screen soft-focus (gameplay world only; HUD stays crisp) --------
   Fair by design: this NEVER moves the world (no camera tilt/translate) so on-screen
   obstacle positions always match their hitboxes. It only breathes a soft-focus haze
   + (web) a light backdrop blur, scaling with the Drunkness level (0..~1.4 with Pub
   boost). Rendered BELOW the HUD so distance/chips/buttons remain sharp. */
export function DrunkScreenFX({ level = 0 }) {
  const lv = Math.max(0, Math.min(1.4, level));
  const focus = useSharedValue(0);
  useEffect(() => {
    focus.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(focus);
  }, []);
  const style = useAnimatedStyle(() => {
    if (lv <= 0.02) return { opacity: 0 };
    // irregular breathing: two sines so it never feels like a clean loop
    const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(focus.value * Math.PI * 2 + Math.sin(focus.value * 7)));
    const opacity = Math.min(0.2, lv * (0.05 + breathe * 0.09));
    const blurPx = Platform.OS === 'web' ? lv * (0.7 + breathe * 1.4) : 0; // max ~ 2.9px @ boosted
    const web = Platform.OS === 'web' ? { backdropFilter: `blur(${blurPx}px)`, WebkitBackdropFilter: `blur(${blurPx}px)` } : {};
    return { opacity: 1, ...web, backgroundColor: `rgba(245,240,255,${opacity})` };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} testID="drunk-screen-fx" />;
}


/* ---------------- Feather ---------------- */
export function FeatherView({ world, index, color }) {
  const style = useAnimatedStyle(() => {
    const f = world.value.feathers[index];
    if (!f || !f.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    return {
      opacity: Math.max(0, Math.min(1, f.life)),
      transform: [{ translateX: f.x }, { translateY: f.y }, { rotate: `${f.rot}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.abs, style]} pointerEvents="none">
      <View style={[featherStyles.f, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/* ---------------- Window heckler (person clipped inside a window) ---------------- */
export function HecklerView({ world, text, reaction, theme }) {
  const WIN = 36;
  const style = useAnimatedStyle(() => {
    const h = world.value.heckler;
    if (!h || !h.active) return { opacity: 0, transform: [{ translateX: -999 }] };
    const op = h.life > 0.35 ? 1 : Math.max(0, h.life / 0.35);
    return { opacity: op, transform: [{ translateX: h.x - WIN / 2 }, { translateY: h.y - WIN / 2 }] };
  });
  return (
    <Animated.View style={[styles.abs, { width: WIN, height: WIN }, style]} pointerEvents="none" testID="heckler">
      {/* speech bubble points down to the window */}
      <View style={hkStyles.bubble}>
        <Text style={hkStyles.bubbleTxt} numberOfLines={2} testID="heckler-insult">{text}</Text>
        <View style={hkStyles.bubbleTail} />
      </View>
      {/* window opening clips the person's body (lower body hidden behind wall) */}
      <View style={[hkStyles.window, { width: WIN, height: WIN, backgroundColor: theme.window, borderColor: theme.obstacleDark }]}>
        <WindowPerson reaction={reaction} theme={theme} win={WIN} />
      </View>
    </Animated.View>
  );
}

function WindowPerson({ reaction, theme }) {
  const skin = '#f3c9a0';
  const cloth = theme.accent;
  // Drawn taller than the window; the parent window View clips the lower body.
  return (
    <Svg width={36} height={54} viewBox="0 0 36 54" style={{ position: 'absolute', top: 4, left: 0 }}>
      {/* body/shoulders (extends below the window, gets clipped) */}
      <SvgRect x="7" y="24" width="22" height="30" rx="6" fill={cloth} />
      {/* head */}
      <Circle cx="18" cy="15" r="9" fill={skin} />
      <Circle cx="14.5" cy="14" r="1.5" fill="#20232b" />
      <Circle cx="21.5" cy="14" r="1.5" fill="#20232b" />
      {reaction === 'horrified' ? (
        <Circle cx="18" cy="19" r="2.4" fill="#20232b" />
      ) : (
        <Path d="M14.5 19 Q18 17 21.5 19" stroke="#20232b" strokeWidth="1.7" fill="none" />
      )}
      {/* angry brows */}
      <Line x1="12" y1="11" x2="16.5" y2="12.4" stroke="#20232b" strokeWidth="1.6" />
      <Line x1="24" y1="11" x2="19.5" y2="12.4" stroke="#20232b" strokeWidth="1.6" />
      {/* reaction arm / prop */}
      {reaction === 'fist' && (
        <G>
          <Line x1="26" y1="30" x2="31" y2="20" stroke={skin} strokeWidth="3.2" />
          <Circle cx="32" cy="18" r="4" fill={skin} />
        </G>
      )}
      {reaction === 'wave' && (
        <G>
          <Line x1="26" y1="30" x2="30" y2="18" stroke={skin} strokeWidth="3.2" />
          <Circle cx="31" cy="16" r="3.4" fill={skin} />
        </G>
      )}
      {reaction === 'point' && (
        <G>
          <Line x1="10" y1="30" x2="2" y2="24" stroke={skin} strokeWidth="3.2" />
          <Circle cx="1.5" cy="24" r="3" fill={skin} />
        </G>
      )}
      {reaction === 'mug' && <SvgRect x="25" y="28" width="8" height="9" rx="1.6" fill="#ffffff" stroke={theme.obstacleDark} strokeWidth="1.6" />}
      {reaction === 'newspaper' && <SvgRect x="22" y="28" width="13" height="10" rx="1" fill="#ffffff" stroke={theme.obstacleDark} strokeWidth="1" />}
      {reaction === 'confused' && (
        <G>
          <Line x1="26" y1="28" x2="26" y2="14" stroke={skin} strokeWidth="3.2" />
          <Circle cx="26" cy="12" r="3" fill={skin} />
        </G>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});

const hkStyles = StyleSheet.create({
  window: {
    borderRadius: 5,
    borderWidth: 3,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    bottom: 44,
    left: -58,
    width: 156,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#20232b',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  bubbleTxt: { fontFamily: FONT, color: '#20232b', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  bubbleTail: {
    position: 'absolute',
    bottom: -9,
    left: 70,
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#20232b',
    transform: [{ rotate: '45deg' }],
  },
});

const obStyles = StyleSheet.create({
  col: {
    width: OW,
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cap: { position: 'absolute', left: 0, width: OW, height: 10, borderRadius: 4 },
  roofBar: { position: 'absolute', left: 0, width: OW, height: 9, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
  notch: { width: 8, height: 6, marginTop: -4 },
  roofWrap: { position: 'absolute' },
  edgeDeco: { position: 'absolute', left: 0, width: OW, height: 22 },
  windows: { marginTop: 16, gap: 10, alignItems: 'center' },
  winRow: { flexDirection: 'row' },
  win: { width: 14, height: 15, borderRadius: 2, borderWidth: 1, opacity: 0.95 },
  front: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  sign: { width: OW - 18, height: 12, borderRadius: 3, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  signDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.5)' },
  door: { width: 20, height: 18, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
});

const chipStyles = StyleSheet.create({
  shine: {
    position: 'absolute',
    top: '26%',
    left: '30%',
    width: 7,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#fff4c4',
  },
});

const featherStyles = StyleSheet.create({
  f: { width: 14, height: 8, borderRadius: 6, opacity: 0.95 },
});
