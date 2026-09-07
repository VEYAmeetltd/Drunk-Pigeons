import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { FONT } from '../ui/theme';
import { pickBillboardAd, recordImpression, resetIntiesRotation } from '../ads/sponsorCampaigns';
// Per-map physical framing for the freestanding billboard structure.
const FRAMES = {
  day: { support: '#c9ccd1', supportDk: '#9aa1a8', frame: '#eef1f4', frameEdge: '#c2c7cd', lights: false },
  night: { support: '#4a4f55', supportDk: '#2b2f33', frame: '#5a4b3a', frameEdge: '#31271b', lights: false },
  dusk: { support: '#b07a4a', supportDk: '#7c522d', frame: '#3a2340', frameEdge: '#241528', lights: true, lightColor: '#ffcf6b' },
  easy: { support: '#cfd6dd', supportDk: '#a7b0b8', frame: '#ffffff', frameEdge: '#d6dde3', lights: false },
};

// How often (in scrolled pixels) a new billboard cycles through. Sized so, across the
// game's speed range, one appears roughly every 15-25s. Kept fully separate from
// collision, scoring and validated-run logic — this is scenery only.
export const GAP_DISTPX = 5600;
// Mid-ground parallax factor (matches the decorative prop layer): billboards sit in
// front of the skyline but scroll slower than foreground obstacles.
const SCROLL_F = 0.52;

function MarqueeLights({ width, color }) {
  const n = Math.max(6, Math.floor(width / 24));
  return (
    <View style={{ position: 'absolute', top: -3, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color }} />
      ))}
    </View>
  );
}

// A prominent wordmark in INTIES ink, ivory and turquoise. The artwork is
// static between slots; it adds no images, gradients, timers or animations.
export function IntiesBillboardArtwork({ width, height }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 300 180" testID="sponsor-billboard-inties-wordmark">
      <Rect x={4} y={4} width={292} height={172} rx={5} fill="#0b1012" stroke="#24504e" strokeWidth={1.5} />
      <Line x1={108} y1={34} x2={192} y2={34} stroke="#00e5cf" strokeWidth={2} />
      <SvgText x={150} y={94} textAnchor="middle" fontFamily="serif" fontWeight="700" fontSize={57} letterSpacing={3} fill="#f4f5ec">INTIES</SvgText>
      <SvgText x={150} y={140} textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize={33} letterSpacing={2} fill="#00e5cf">LTD.com</SvgText>
      <Line x1={126} y1={160} x2={174} y2={160} stroke="#00e5cf" strokeWidth={2} />
    </Svg>
  );
}

// Large freestanding sponsored billboard, rendered in the mid-ground scenery layer inside
// Background (so it is always behind obstacles, coins, the pigeon and the interface, and —
// as part of a pointerEvents="none" tree — can never intercept a tap). No collision, never
// touches obstacle generation, scoring or run validation.
export default function SponsorBillboard({ world, telemetry, theme, width, groundY, removeAds }) {
  const BILL_W = Math.round(Math.min(300, Math.max(210, width * 0.56)));
  const faceH = Math.round(BILL_W * 0.6);
  const legH = 80;
  const structureH = faceH + legH;
  const feetY = groundY + 14;
  const topY = feetY - structureH;
  const frame = FRAMES[theme.id] || FRAMES.day;

  const [ad, setAd] = useState(() => ({ ...pickBillboardAd({ mapId: theme.id, nowMs: Date.now(), removeAds: !!removeAds, seed: 17, slotIndex: 0 }), slotIndex: 0 }));
  const slotRef = useRef(-1);

  useEffect(() => {
    slotRef.current = -1;
    resetIntiesRotation();
    const id = setInterval(() => {
      // Read the engine's JS mirror, not a blocking UI-thread shared value.
      const d = telemetry.current.distPx || 0;
      const k = Math.floor(d / GAP_DISTPX);
      if (k !== slotRef.current) {
        slotRef.current = k;
        const picked = pickBillboardAd({ mapId: theme.id, nowMs: Date.now(), removeAds: !!removeAds, seed: k * 101 + 17, slotIndex: k });
        setAd({ ...picked, slotIndex: k });
        recordImpression(picked.id, d);
      }
    }, 120);
    return () => clearInterval(id);
  }, [telemetry, theme.id, removeAds]);

  const currentSlot = ad.slotIndex;
  const style = useAnimatedStyle(() => {
    let d = 0;
    try {
      d = (world.value && world.value.distPx) || 0;
    } catch (e) {
      d = 0;
    }
    const k = Math.floor(d / GAP_DISTPX);
    const prog = d - k * GAP_DISTPX; // 0..GAP_DISTPX
    const x = width - prog * SCROLL_F; // enters from the right edge, scrolls left
    const on = x > -BILL_W - 4 && x < width + 4;
    return { transform: [{ translateX: x }], opacity: on && k === currentSlot ? 1 : 0 };
  });

  const isInties = ad.kind === 'inties';
  const headSize = Math.round(BILL_W * 0.1);
  const intiesBg = '#0a0d0f';

  return (
    <React.Fragment>
      <Animated.View
      pointerEvents="none"
      testID="sponsor-billboard"
      style={[{ position: 'absolute', left: 0, top: topY, width: BILL_W, height: structureH }, style]}
    >
      {/* advertising face */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: BILL_W, height: faceH }}>
        <View style={{ flex: 1, backgroundColor: frame.frame, borderWidth: 4, borderColor: frame.frameEdge, borderRadius: 6, padding: 5 }}>
          {/* artwork panel — backing colour shows behind procedural artwork; content keeps its proportions */}
          <View style={{ flex: 1, backgroundColor: isInties ? intiesBg : ad.bg, borderRadius: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            {/* Both small artwork trees mount in READY, before the first flap. */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: isInties ? 1 : 0 }}>
              <IntiesBillboardArtwork width={BILL_W - 36} height={faceH - 18} />
            </View>
            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', opacity: isInties ? 0 : 1 }}>
                <Text
                  style={{ fontFamily: FONT, color: ad.fg, fontWeight: '700', fontSize: headSize, lineHeight: Math.round(headSize * 1.12), textAlign: 'center', letterSpacing: 0.5 }}
                  numberOfLines={3}
                  adjustsFontSizeToFit
                >
                  {ad.headline}
                </Text>
                <View style={{ height: 3, width: '55%', backgroundColor: ad.accent, borderRadius: 2, marginVertical: 6 }} />
                <Text
                  style={{ fontFamily: FONT, color: ad.fg, opacity: 0.92, fontSize: Math.round(BILL_W * 0.052), textAlign: 'center' }}
                  numberOfLines={2}
                >
                  {ad.subline}
                </Text>
            </View>
            {/* small, readable advertising label */}
            <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 }}>
              <Text style={{ fontFamily: FONT, color: '#fff', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }}>{ad.label}</Text>
            </View>
          </View>
        </View>
        {frame.lights && <MarqueeLights width={BILL_W} color={frame.lightColor} />}
      </View>

      {/* support structure */}
      <View style={{ position: 'absolute', top: faceH, left: 0, width: BILL_W, height: legH }}>
        <Svg width={BILL_W} height={legH}>
          <Line x1={BILL_W * 0.28} y1={0} x2={BILL_W * 0.2} y2={legH} stroke={frame.support} strokeWidth={7} />
          <Line x1={BILL_W * 0.72} y1={0} x2={BILL_W * 0.8} y2={legH} stroke={frame.support} strokeWidth={7} />
          <Line x1={BILL_W * 0.28} y1={0} x2={BILL_W * 0.2} y2={legH} stroke={frame.supportDk} strokeWidth={2} />
          <Line x1={BILL_W * 0.72} y1={0} x2={BILL_W * 0.8} y2={legH} stroke={frame.supportDk} strokeWidth={2} />
          {/* cross bracing */}
          <Line x1={BILL_W * 0.26} y1={6} x2={BILL_W * 0.74} y2={legH - 6} stroke={frame.supportDk} strokeWidth={3} />
          <Line x1={BILL_W * 0.74} y1={6} x2={BILL_W * 0.26} y2={legH - 6} stroke={frame.supportDk} strokeWidth={3} />
          {/* horizontal ties */}
          <Line x1={BILL_W * 0.24} y1={legH * 0.5} x2={BILL_W * 0.76} y2={legH * 0.5} stroke={frame.support} strokeWidth={3} />
          <Line x1={BILL_W * 0.26} y1={4} x2={BILL_W * 0.74} y2={4} stroke={frame.support} strokeWidth={4} />
          {/* feet */}
          <Rect x={BILL_W * 0.16} y={legH - 6} width={18} height={6} rx={1} fill={frame.supportDk} />
          <Rect x={BILL_W * 0.74} y={legH - 6} width={18} height={6} rx={1} fill={frame.supportDk} />
        </Svg>
      </View>
    </Animated.View>
    </React.Fragment>
  );
}
