import React, { useMemo } from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse, Circle, Path, Line, G } from 'react-native-svg';
import { getMap, EASY_MAP } from '../data/maps';

// Lightweight STATIC miniature previews for the "Choose your Manor" cards.
// Each is a tiny snapshot reusing the real map palette/art direction — never a
// live game world. Rendered in a 74x44 viewBox and scaled to the card.
export default function ManorThumb({ mapId, variant, width = 74, height = 44 }) {
  const gid = useMemo(() => `${variant || mapId}-${Math.random().toString(36).slice(2, 7)}`, [mapId, variant]);

  if (variant === 'random') return <RandomThumb width={width} height={height} gid={gid} />;
  if (mapId === 'easy') return <EasyThumb width={width} height={height} gid={gid} map={EASY_MAP} />;

  const map = getMap(mapId);
  const Body =
    mapId === 'day' ? <DayScene map={map} gid={gid} /> : mapId === 'night' ? <NightScene map={map} gid={gid} /> : <DuskScene map={map} gid={gid} />;

  return (
    <Svg width={width} height={height} viewBox="0 0 74 44">
      <Defs>
        <LinearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
          {(map.skyStops || [{ o: 0, c: map.skyTop }, { o: 1, c: map.skyBottom }]).map((s, i) => (
            <Stop key={i} offset={String(s.o)} stopColor={s.c} />
          ))}
        </LinearGradient>
        {map.sun && (
          <RadialGradient id={`${gid}-sun`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={map.sun.core} stopOpacity="1" />
            <Stop offset="0.45" stopColor={map.sun.core} stopOpacity="0.65" />
            <Stop offset="1" stopColor={map.sun.glow} stopOpacity="0" />
          </RadialGradient>
        )}
      </Defs>
      <Rect x="0" y="0" width="74" height="44" fill={`url(#${gid}-sky)`} />
      {Body}
    </Svg>
  );
}

// small brick building with roof + windows
function Bldg({ x, y, w, h, fill, roof, win, chimney }) {
  const cols = Math.max(1, Math.round(w / 6));
  const wins = [];
  for (let r = 0; r < Math.max(1, Math.round(h / 7)); r++) {
    for (let c = 0; c < cols; c++) {
      wins.push(<Rect key={`${r}-${c}`} x={x + 2 + c * 6} y={y + 3 + r * 7} width={3} height={3.4} fill={win} opacity={0.9} />);
    }
  }
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} fill={fill} />
      <Rect x={x - 1} y={y - 2} width={w + 2} height={2.5} fill={roof} />
      {chimney && <Rect x={x + w - 5} y={y - 6} width={3} height={5} fill={roof} />}
      {wins}
    </G>
  );
}

function DayScene({ map, gid }) {
  const b = map.brickPalette;
  return (
    <G>
      <Ellipse cx="15" cy="10" rx="9" ry="4.5" fill={map.cloud} />
      <Ellipse cx="21" cy="9" rx="6" ry="3.5" fill={map.cloud} />
      <Ellipse cx="55" cy="8" rx="8" ry="4" fill={map.cloud} />
      {/* ground */}
      <Rect x="0" y="34" width="74" height="10" fill={map.ground} />
      <Rect x="0" y="34" width="74" height="3" fill={map.groundTop} />
      {/* terrace buildings */}
      <Bldg x={4} y={18} w={16} h={16} fill={b[0]} roof={map.roofPalette[0]} win={map.window} chimney />
      <Bldg x={22} y={13} w={13} h={21} fill={b[3]} roof={map.roofPalette[1]} win={map.window} chimney />
      <Bldg x={37} y={20} w={13} h={14} fill={b[1]} roof={map.roofPalette[2]} win={map.window} />
      {/* red double-decker bus */}
      <G>
        <Rect x="54" y="25" width="17" height="9" rx="1.5" fill="#d1332e" />
        <Rect x="55.5" y="26.5" width="14" height="2.6" fill="#ffe9a8" />
        <Circle cx="58" cy="34" r="2" fill="#20232b" />
        <Circle cx="67" cy="34" r="2" fill="#20232b" />
      </G>
      {/* street lamp */}
      <Rect x="51" y="24" width="1.4" height="10" fill={map.obstacleDark} />
      <Circle cx="51.7" cy="23.5" r="1.8" fill={map.window} />
    </G>
  );
}

function NightScene({ map, gid }) {
  const b = map.brickPalette;
  return (
    <G>
      {/* grimy clouds */}
      <Ellipse cx="50" cy="9" rx="12" ry="4" fill={map.cloud} opacity="0.6" />
      {/* ground */}
      <Rect x="0" y="34" width="74" height="10" fill={map.ground} />
      <Rect x="0" y="34" width="74" height="2.5" fill={map.groundTop} />
      {/* run-down blocks */}
      <Bldg x={3} y={16} w={15} h={18} fill={b[0]} roof={map.roofPalette[0]} win={map.window} />
      <Bldg x={20} y={12} w={14} h={22} fill={b[1]} roof={map.roofPalette[1]} win={map.window} chimney />
      <Bldg x={36} y={19} w={13} h={15} fill={b[4]} roof={map.roofPalette[2]} win={map.window} />
      {/* rooftop aerial */}
      <Line x1="27" y1="12" x2="27" y2="5" stroke="#8a8aa0" strokeWidth="1" />
      <Line x1="24" y1="7" x2="30" y2="7" stroke="#8a8aa0" strokeWidth="0.8" />
      {/* graffiti wall + tag */}
      <Rect x="51" y="24" width="20" height="10" fill={map.obstacleDark} />
      <Path d="M53 30 q3 -4 6 0 q3 4 6 0" stroke={map.accent} strokeWidth="1.4" fill="none" />
      <Path d="M64 27 l4 3" stroke={map.window} strokeWidth="1.4" />
      {/* chain-link fence hint */}
      <G opacity="0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <React.Fragment key={i}>
            <Line x1={51 + i * 5} y1="34" x2={54 + i * 5} y2="30" stroke="#9a9ab0" strokeWidth="0.6" />
            <Line x1={51 + i * 5} y1="30" x2={54 + i * 5} y2="34" stroke="#9a9ab0" strokeWidth="0.6" />
          </React.Fragment>
        ))}
      </G>
    </G>
  );
}

function DuskScene({ map, gid }) {
  return (
    <G>
      {/* glowing low sun */}
      <Circle cx="50" cy="30" r="20" fill={`url(#${gid}-sun)`} />
      <Circle cx="50" cy="30" r="7" fill={map.sun.core} opacity="0.95" />
      {/* sunset clouds */}
      <Ellipse cx="18" cy="10" rx="10" ry="3.6" fill={map.cloud} opacity="0.9" />
      <Ellipse cx="18" cy="11.6" rx="10" ry="2.4" fill={map.cloudShadow} opacity="0.7" />
      <Ellipse cx="60" cy="14" rx="8" ry="3" fill={map.cloud} opacity="0.85" />
      {/* ground */}
      <Rect x="0" y="34" width="74" height="10" fill={map.ground} />
      <Rect x="0" y="34" width="74" height="2.5" fill={map.groundTop} />
      {/* rooftop silhouettes with warm windows */}
      <Rect x="2" y="20" width="15" height="14" fill={map.obstacleDark} />
      <Rect x="4" y="23" width="3.4" height="3.4" fill={map.window} />
      <Rect x="10" y="23" width="3.4" height="3.4" fill={map.window} />
      <Rect x="4" y="28.5" width="3.4" height="3.4" fill={map.window} />
      <Rect x="19" y="16" width="13" height="18" fill={map.roofPalette[0]} />
      <Rect x="22" y="19" width="3.2" height="3.2" fill={map.window} />
      <Rect x="27" y="19" width="3.2" height="3.2" fill={map.window} />
      {/* chippy with striped awning */}
      <Rect x="60" y="23" width="13" height="11" fill="#e8d3a1" />
      <Path d="M58 23 L74 23 L74 27 L58 27 Z" fill="#d1332e" />
      {[0, 1, 2, 3].map((i) => (
        <Rect key={i} x={58 + i * 4} y="23" width="2" height="4" fill="#ffffff" opacity="0.75" />
      ))}
      <Rect x="64" y="28" width="5" height="6" fill={map.window} opacity="0.95" />
      {/* seagull */}
      <Path d="M36 9 q2 -2 4 0 q2 -2 4 0" stroke={map.skyline} strokeWidth="1" fill="none" opacity="0.7" />
    </G>
  );
}

function EasyThumb({ width, height, gid, map }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 74 44">
      <Defs>
        <LinearGradient id={`${gid}-sky`} x1="0" y1="0" x2="0" y2="1">
          {(map.skyStops || [{ o: 0, c: map.skyTop }, { o: 1, c: map.skyBottom }]).map((s, i) => (
            <Stop key={i} offset={String(s.o)} stopColor={s.c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="74" height="44" fill={`url(#${gid}-sky)`} />
      {/* fluffy clouds + lots of open flying room */}
      <Ellipse cx="16" cy="11" rx="9" ry="4.5" fill={map.cloud} />
      <Ellipse cx="23" cy="10" rx="6" ry="3.5" fill={map.cloud} />
      <Ellipse cx="56" cy="9" rx="8" ry="4" fill={map.cloud} />
      {/* very distant simple buildings */}
      <Rect x="10" y="28" width="8" height="6" fill={map.skylineBack} opacity="0.8" />
      <Rect x="52" y="27" width="9" height="7" fill={map.skylineBack} opacity="0.8" />
      {/* rolling green hills */}
      <Path d="M0 34 Q18 27 37 33 Q56 39 74 32 L74 44 L0 44 Z" fill={map.skyline} />
      <Path d="M0 38 Q20 33 40 38 Q58 42 74 37 L74 44 L0 44 Z" fill={map.ground} />
      <Rect x="0" y="34" width="74" height="0" fill={map.groundTop} />
    </Svg>
  );
}

// Random = subtle vertical split of the three STANDARD manors (no Easy Mode).
function RandomThumb({ width, height, gid }) {
  const [day, night, dusk] = ['day', 'night', 'dusk'].map(getMap);
  return (
    <Svg width={width} height={height} viewBox="0 0 74 44">
      <Defs>
        <LinearGradient id={`${gid}-d`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={day.skyStops[0].c} />
          <Stop offset="1" stopColor={day.skyStops[day.skyStops.length - 1].c} />
        </LinearGradient>
        <LinearGradient id={`${gid}-n`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night.skyStops[0].c} />
          <Stop offset="1" stopColor={night.skyStops[night.skyStops.length - 1].c} />
        </LinearGradient>
        <LinearGradient id={`${gid}-s`} x1="0" y1="0" x2="0" y2="1">
          {dusk.skyStops.map((s, i) => (
            <Stop key={i} offset={String(s.o)} stopColor={s.c} />
          ))}
        </LinearGradient>
      </Defs>
      {/* three sky slices */}
      <Rect x="0" y="0" width="24.7" height="44" fill={`url(#${gid}-d)`} />
      <Rect x="24.7" y="0" width="24.6" height="44" fill={`url(#${gid}-n)`} />
      <Rect x="49.3" y="0" width="24.7" height="44" fill={`url(#${gid}-s)`} />
      {/* a hint building per slice */}
      <Rect x="6" y="20" width="12" height="14" fill={day.brickPalette[0]} />
      <Rect x="30" y="18" width="12" height="16" fill={night.brickPalette[1]} />
      <Circle cx="61" cy="28" r="6" fill={dusk.sun.core} opacity="0.9" />
      <Rect x="55" y="22" width="12" height="12" fill={dusk.obstacleDark} opacity="0.85" />
      {/* ground band */}
      <Rect x="0" y="34" width="24.7" height="10" fill={day.ground} />
      <Rect x="24.7" y="34" width="24.6" height="10" fill={night.ground} />
      <Rect x="49.3" y="34" width="24.7" height="10" fill={dusk.ground} />
      {/* subtle scrim so the ? reads clearly on top (added by MainMenu) */}
      <Rect x="0" y="0" width="74" height="44" fill="#140c28" opacity="0.28" />
    </Svg>
  );
}
