import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { bodyScale, type AvatarProfile } from '../lib/avatar';
import { rgbCss, useMeta } from '../lib/meta';
import type { Garment } from '../types';

/**
 * A 2D figure wearing an outfit (prototype spec §2.1 "fitting room", §4): the
 * body follows the avatar's height, weight and skin tone, the head is the face
 * photo when there is one, and each piece is drawn by its type in its own
 * colour: sleeve length, coat length, trousers, shorts or a skirt, boots taller
 * than sneakers. A sketch of the look, not a photo of it.
 *
 * Drawn on a 200 × 440 canvas; only the left half of symmetric shapes is
 * written out, the right is its mirror.
 */
const W = 200;
const H = 440;
const MIRROR = `translate(${W},0) scale(-1,1)`;

const SHORT_SLEEVES = new Set(['t_shirt', 'polo']);
const NO_SLEEVES = new Set(['tank_top']);
const OUTER_LENGTH: Record<string, number> = {
  blazer: 206, jacket: 198, denim_jacket: 196, puffer: 212, rain_jacket: 222, coat: 300, trench: 306,
};
const BUTTONED = new Set(['blazer', 'coat', 'trench', 'cardigan', 'shirt']);
const LAPELS = new Set(['blazer', 'coat', 'trench']);

type Piece = { sub: string; color: string };

function Shape({ d, fill, mirror }: { d: string; fill: string; mirror?: boolean }) {
  const body = (
    <>
      <Path d={d} fill={fill} />
      <Path d={d} fill="url(#shade)" />
    </>
  );
  return mirror ? <><G>{body}</G><G transform={MIRROR}>{body}</G></> : body;
}

function Top({ p }: { p: Piece }) {
  const sleeve = NO_SLEEVES.has(p.sub) ? null
    : SHORT_SLEEVES.has(p.sub) ? 'M64 74 L50 80 L45 110 L61 114 L68 98 Z'
      : 'M64 74 L50 80 L42 188 L58 190 L68 112 Z';
  return (
    <>
      {sleeve ? <Shape d={sleeve} fill={p.color} mirror /> : null}
      <Shape d={NO_SLEEVES.has(p.sub) ? 'M72 76 Q100 70 128 76 L134 186 Q100 192 66 186 Z' : 'M64 74 Q100 66 136 74 L134 186 Q100 192 66 186 Z'} fill={p.color} />
      {p.sub === 'shirt' || p.sub === 'polo' ? <Path d="M89 70 L100 86 L111 70 L104 67 L100 76 L96 67 Z" fill="#000" opacity={0.12} /> : null}
      {p.sub === 'sweater' || p.sub === 'cardigan' || p.sub === 'hoodie'
        ? <Line x1={67} y1={180} x2={133} y2={180} stroke="#000" strokeOpacity={0.15} strokeWidth={3} /> : null}
      {p.sub === 'cardigan' ? <Line x1={100} y1={72} x2={100} y2={188} stroke="#000" strokeOpacity={0.18} strokeWidth={1.5} /> : null}
      {p.sub === 'hoodie' ? <Path d="M80 72 Q100 96 120 72" stroke="#000" strokeOpacity={0.18} strokeWidth={3} fill="none" /> : null}
      {BUTTONED.has(p.sub) ? [100, 128, 156].map((y) => <Circle key={y} cx={p.sub === 'cardigan' ? 104 : 100} cy={y} r={2} fill="#000" opacity={0.25} />) : null}
    </>
  );
}

function Bottom({ p }: { p: Piece }) {
  if (p.sub === 'skirt') return <Shape d="M70 178 L130 178 L142 266 L58 266 Z" fill={p.color} />;
  const hem = p.sub === 'shorts' ? 242 : 366;
  return <Shape d={`M68 178 L132 178 L131 ${hem} L101 ${hem} L100 214 L99 ${hem} L69 ${hem} Z`} fill={p.color} />;
}

function Dress({ p }: { p: Piece }) {
  if (p.sub === 'jumpsuit') {
    return <><Top p={{ ...p, sub: 'tank_top' }} /><Bottom p={{ ...p, sub: 'trousers' }} /></>;
  }
  const hem = p.sub === 'evening_dress' ? 360 : 282;
  return <Shape d={`M72 76 Q100 70 128 76 L132 176 L${150 + (hem - 282) / 8} ${hem} L${50 - (hem - 282) / 8} ${hem} L68 176 Z`} fill={p.color} />;
}

function Outer({ p }: { p: Piece }) {
  const len = OUTER_LENGTH[p.sub] ?? 204;
  return (
    <>
      <Shape d="M64 72 L47 79 L39 194 L57 196 L69 114 Z" fill={p.color} mirror />
      <Shape d={`M63 71 L97 71 L95 ${len} L58 ${len} Z`} fill={p.color} mirror />
      {LAPELS.has(p.sub) ? <Path d="M84 72 L97 118 L97 72 Z M116 72 L103 118 L103 72 Z" fill="#000" opacity={0.12} /> : null}
      {p.sub === 'puffer'
        ? Array.from({ length: 6 }, (_, i) => 92 + i * 20).map((y) => (
          <Line key={y} x1={58} y1={y} x2={142} y2={y} stroke="#000" strokeOpacity={0.14} strokeWidth={2} />))
        : null}
      {p.sub === 'trench' ? <Rect x={58} y={176} width={84} height={6} fill="#000" opacity={0.15} /> : null}
      {BUTTONED.has(p.sub) ? [104, 134, 164].map((y) => <Circle key={y} cx={91} cy={y} r={2.2} fill="#000" opacity={0.3} />) : null}
    </>
  );
}

function Shoes({ p }: { p: Piece }) {
  if (p.sub === 'boots') {
    return <Shape d="M72 336 L96 336 L97 372 Q99 382 88 382 L66 382 Q62 382 64 374 L72 368 Z" fill={p.color} mirror />;
  }
  if (p.sub === 'heels') return <Shape d="M73 366 L95 366 L97 376 L92 384 L90 378 L70 378 Q66 376 73 366 Z" fill={p.color} mirror />;
  if (p.sub === 'sandals') {
    return <><Path d="M70 374 L96 374" stroke={p.color} strokeWidth={4} /><Path d="M104 374 L130 374" stroke={p.color} strokeWidth={4} /></>;
  }
  const sole = p.sub === 'sneakers';
  return (
    <>
      <Shape d="M70 364 L96 364 L98 378 L66 380 Q62 378 70 364 Z" fill={p.color} mirror />
      {sole ? <><Rect x={64} y={377} width={35} height={4} rx={2} fill="#fff" /><Rect x={101} y={377} width={35} height={4} rx={2} fill="#fff" /></> : null}
    </>
  );
}

export function Avatar({ profile, items, width = 180 }: { profile: AvatarProfile; items: { slot: string; garment: Garment }[]; width?: number }) {
  const meta = useMeta();
  const { wide, tall } = bodyScale(profile);
  const color = (g: Garment) => {
    const rgb = g.colors?.[0]?.rgb ?? (g.primary_color ? meta.colors[g.primary_color] : undefined);
    return rgb ? rgbCss(rgb) : '#8A8A8A';
  };
  const piece = (slot: string): Piece | null => {
    const g = items.find((i) => i.slot === slot)?.garment;
    return g ? { sub: g.subcategory, color: color(g) } : null;
  };
  const top = piece('top');
  const bottom = piece('bottom');
  const dress = piece('dress');
  const outer = piece('outerwear');
  const shoes = piece('shoes');
  const skin = profile.skin;
  // Feet stay on the floor; a taller figure grows upwards. Width scales around the centre line.
  const frame = `translate(0,${H - 392 * tall - 8}) scale(1,${tall})`;
  const body = `translate(${W / 2},0) scale(${wide},1) translate(${-W / 2},0)`;

  return (
    <Svg width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.16} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.16} />
        </LinearGradient>
        <ClipPath id="face"><Circle cx={100} cy={40} r={22} /></ClipPath>
      </Defs>
      <Ellipse cx={100} cy={H - 6} rx={58 * wide} ry={5} fill="#000" opacity={0.08} />
      <G transform={frame}>
        <G transform={body}>
          <Rect x={92} y={58} width={16} height={16} fill={skin} />
          <Shape d="M66 78 L54 82 L46 190 L58 192 L68 110 Z" fill={skin} mirror />
          <Path d="M66 76 Q100 70 134 76 L130 182 L70 182 Z" fill={skin} />
          <Rect x={72} y={176} width={26} height={194} rx={10} fill={skin} />
          <Rect x={102} y={176} width={26} height={194} rx={10} fill={skin} />
          {dress ? <Dress p={dress} /> : (
            <>
              {bottom ? <Bottom p={bottom} /> : null}
              {top ? <Top p={top} /> : null}
            </>
          )}
          {outer ? <Outer p={outer} /> : null}
          {shoes ? <Shoes p={shoes} /> : <><Ellipse cx={85} cy={372} rx={13} ry={6} fill={skin} /><Ellipse cx={115} cy={372} rx={13} ry={6} fill={skin} /></>}
        </G>
        {profile.face ? (
          <SvgImage href={{ uri: profile.face }} x={78} y={18} width={44} height={44} clipPath="url(#face)" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <Circle cx={100} cy={40} r={22} fill={skin} />
            <Path d="M78 38 Q79 15 100 15 Q121 15 122 38 Q117 25 100 25 Q83 25 78 38 Z" fill="#3B2A20" />
          </>
        )}
      </G>
    </Svg>
  );
}
