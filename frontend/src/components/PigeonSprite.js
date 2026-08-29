import React from 'react';
import Svg, { Ellipse, Circle, Path, Polygon, Rect, G, Line } from 'react-native-svg';

// Pure vector cartoon pigeon. Cosmetic only. Widens with fatLevel.
// `droopy` gives permanent half-lidded drunk eyes; `blink` briefly shuts them.
export default function PigeonSprite({ pigeon, fatLevel = 0, size = 66, droopy = false, blink = false }) {
  const p = pigeon;
  const grow = fatLevel; // 0..6
  const rx = 30 + grow * 4.2;
  const ry = 25 + grow * 2.2;
  const cx = 56;
  const cy = 58;
  const bellyRx = rx * 0.72;
  const bellyRy = ry * 0.78;
  const eyeCx = cx + rx * 0.78 + 6;
  const eyeCy = cy - ry * 0.7 - 3;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 110">
      {/* tail */}
      <Path
        d={`M ${cx - rx + 4} ${cy} L 10 ${cy - 14} L 14 ${cy + 6} L 10 ${cy + 20} Z`}
        fill={p.wing}
      />
      {/* body */}
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.body} />
      {/* belly */}
      <Ellipse cx={cx + 2} cy={cy + ry * 0.35} rx={bellyRx} ry={bellyRy} fill={p.belly} />
      {/* wing (flap look) */}
      <Ellipse
        cx={cx - 2}
        cy={cy - 2}
        rx={rx * 0.55}
        ry={ry * 0.5}
        fill={p.wing}
        transform={`rotate(-18 ${cx - 2} ${cy - 2})`}
      />
      {/* head */}
      <Circle cx={cx + rx * 0.78} cy={cy - ry * 0.7} r={16 + grow * 0.8} fill={p.body} />
      {/* beak */}
      <Polygon
        points={`${cx + rx * 0.78 + 12},${cy - ry * 0.7 - 3} ${cx + rx * 0.78 + 30},${
          cy - ry * 0.7 + 1
        } ${cx + rx * 0.78 + 12},${cy - ry * 0.7 + 7}`}
        fill={p.beak}
      />
      {/* eye */}
      <Circle cx={cx + rx * 0.78 + 5} cy={cy - ry * 0.7 - 3} r={4.4} fill="#fff" />
      <Circle cx={eyeCx} cy={eyeCy + (droopy ? 1.4 : 0)} r={2.6} fill={p.eye} />
      {/* drunk half-lidded / blinking eyelid (same colour as head so it reads as a lid) */}
      {(droopy || blink) && (
        <>
          <Circle
            cx={eyeCx - 1}
            cy={eyeCy - (blink ? 0 : 3.1)}
            r={blink ? 6.2 : 5.6}
            fill={p.body}
          />
          <Line
            x1={eyeCx - 7}
            y1={eyeCy + (blink ? 0.5 : -1.6)}
            x2={eyeCx + 5}
            y2={eyeCy + (blink ? 0.5 : -1.6)}
            stroke={p.wing}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      )}
      {/* feet */}
      <Line x1={cx - 6} y1={cy + ry} x2={cx - 6} y2={cy + ry + 10} stroke={p.beak} strokeWidth={3} />
      <Line x1={cx + 8} y1={cy + ry} x2={cx + 8} y2={cy + ry + 10} stroke={p.beak} strokeWidth={3} />

      {/* Gym pigeon carries dumbbells (curl with the body during "One More Rep") */}
      {p.id === 'gym' && (
        <G>
          {/* front dumbbell near the wing */}
          <Line x1={cx - 4} y1={cy + ry * 0.28} x2={cx + 16} y2={cy + ry * 0.28} stroke="#3a3a42" strokeWidth={3} />
          <Rect x={cx - 10} y={cy + ry * 0.28 - 6} width={7} height={12} rx={2} fill="#2b2b30" />
          <Rect x={cx + 15} y={cy + ry * 0.28 - 6} width={7} height={12} rx={2} fill="#2b2b30" />
        </G>
      )}

      {/* accessories */}
      <Accessory type={p.accessory} cx={cx} cy={cy} rx={rx} ry={ry} grow={grow} color="#e23b3b" />
    </Svg>
  );
}

function Accessory({ type, cx, cy, rx, ry, grow }) {
  const hx = cx + rx * 0.78; // head x
  const hy = cy - ry * 0.7; // head y
  const hr = 16 + grow * 0.8;
  switch (type) {
    case 'tie':
      return (
        <G>
          <Polygon points={`${cx + 10},${cy - 6} ${cx + 20},${cy - 6} ${cx + 15},${cy + 4}`} fill="#e23b3b" />
          <Polygon points={`${cx + 12},${cy + 3} ${cx + 18},${cy + 3} ${cx + 20},${cy + 24} ${cx + 15},${cy + 30} ${cx + 10},${cy + 24}`} fill="#e23b3b" />
        </G>
      );
    case 'hood':
      return <Path d={`M ${hx - hr - 3} ${hy} A ${hr + 4} ${hr + 4} 0 0 1 ${hx + hr + 3} ${hy}`} fill="#2b2b30" />;
    case 'crown':
      return (
        <Polygon
          points={`${hx - 12},${hy - hr + 3} ${hx - 6},${hy - hr - 8} ${hx},${hy - hr + 1} ${hx + 6},${hy - hr - 10} ${hx + 12},${hy - hr + 3}`}
          fill="#ffd23f"
          stroke="#c99a1e"
          strokeWidth={1.5}
        />
      );
    case 'headband':
      return (
        <G>
          <Rect x={hx - hr} y={hy - 6} width={hr * 2} height={7} rx={3} fill="#ff5fa2" />
          <Circle cx={hx - hr + 2} cy={hy - 3} r={3} fill="#ff5fa2" />
        </G>
      );
    case 'camera':
      return (
        <G>
          <Line x1={cx - 8} y1={cy - 18} x2={cx + 18} y2={cy + 6} stroke="#333" strokeWidth={2} />
          <Rect x={cx + 2} y={cy + 2} width={20} height={13} rx={2} fill="#333" />
          <Circle cx={cx + 12} cy={cy + 8} r={4} fill="#88d" />
        </G>
      );
    case 'monocle':
      return (
        <G>
          <Circle cx={hx + 5} cy={hy - 3} r={7} fill="none" stroke="#d9a441" strokeWidth={2} />
          <Line x1={hx + 5} y1={hy + 4} x2={cx + 6} y2={cy + 8} stroke="#d9a441" strokeWidth={1.5} />
        </G>
      );
    default:
      return null;
  }
}
