import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * A flat drawing of a piece in a given colour, for things the user does not
 * own yet (shop suggestions, "Will this fit?"). The shop links are store
 * searches, not products, so there is no product photo to show; the drawing
 * shows the type and the colour that was picked. Drawn on a 100 × 100 canvas.
 */
type Shape = { body: string; details?: (stroke: string) => React.ReactNode };

function line(x1: number, y1: number, x2: number, y2: number) {
  return function SeamLine(s: string) {
    return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth={1.4} strokeOpacity={0.35} />;
  };
}

const TEE = 'M34 18 L44 14 Q50 19 56 14 L66 18 L82 30 L74 41 L67 36 L67 86 L33 86 L33 36 L26 41 L18 30 Z';
const LONG = 'M34 18 L44 14 Q50 19 56 14 L66 18 L80 30 L86 74 L76 76 L68 40 L67 86 L33 86 L32 40 L24 76 L14 74 L20 30 Z';
const TROUSERS = 'M32 12 L68 12 L72 90 L56 90 L50 36 L44 90 L28 90 Z';
const SHORTS = 'M30 26 L70 26 L74 66 L54 68 L50 46 L46 68 L26 66 Z';
const SKIRT = 'M36 18 L64 18 L78 82 L22 82 Z';
const DRESS = 'M40 12 L46 12 Q50 18 54 12 L60 12 L62 30 L58 40 L76 88 L24 88 L42 40 L38 30 Z';
const COAT = 'M36 12 L46 10 L50 22 L54 10 L64 12 L80 26 L86 80 L76 82 L70 46 L70 92 L30 92 L30 46 L24 82 L14 80 L20 26 Z';
const JACKET = 'M36 16 L46 13 L50 24 L54 13 L64 16 L80 28 L86 70 L76 72 L70 44 L70 78 L30 78 L30 44 L24 72 L14 70 L20 28 Z';
const SNEAKER = 'M14 56 Q16 44 28 42 L44 40 Q52 48 64 50 L80 54 Q88 57 88 66 L88 70 L14 70 Z';
const BOOT = 'M30 18 L52 18 L54 52 Q72 54 82 60 Q88 64 86 72 L28 72 Z';
const HEEL = 'M18 52 Q30 50 46 58 L70 66 Q82 68 84 72 L60 72 L52 68 L26 66 L22 82 L18 82 Z';
const LOAFER = 'M14 60 Q18 50 34 50 L60 52 Q80 54 86 62 L86 70 L14 70 Z';
const BAG = 'M22 38 L78 38 L84 86 L16 86 Z';
const BELT = 'M8 44 L92 44 L92 56 L8 56 Z';

const SHAPES: Record<string, Shape> = {
  t_shirt: { body: TEE }, polo: { body: TEE, details: (s) => <Path d="M44 14 L50 24 L56 14" stroke={s} strokeWidth={1.4} strokeOpacity={0.4} fill="none" /> },
  tank_top: { body: 'M38 14 L44 14 Q50 26 56 14 L62 14 L66 34 L66 86 L34 86 L34 34 Z' },
  shirt: { body: LONG, details: (s) => <>{line(50, 20, 50, 86)(s)}<Path d="M43 14 L50 22 L57 14" stroke={s} strokeWidth={1.4} strokeOpacity={0.4} fill="none" /></> },
  blouse: { body: LONG },
  sweater: { body: LONG, details: line(33, 80, 67, 80) },
  hoodie: { body: LONG, details: (s) => <><Path d="M40 16 Q50 34 60 16" stroke={s} strokeWidth={1.6} strokeOpacity={0.4} fill="none" />{line(38, 62, 62, 62)(s)}</> },
  cardigan: { body: LONG, details: (s) => <>{line(50, 22, 50, 86)(s)}<Circle cx={53} cy={40} r={1.4} fill={s} opacity={0.4} /><Circle cx={53} cy={55} r={1.4} fill={s} opacity={0.4} /><Circle cx={53} cy={70} r={1.4} fill={s} opacity={0.4} /></> },
  jeans: { body: TROUSERS, details: (s) => <>{line(32, 20, 68, 20)(s)}<Path d="M36 20 Q38 30 46 30" stroke="#C9A35A" strokeWidth={1.2} fill="none" /></> },
  trousers: { body: TROUSERS, details: line(41, 20, 38, 88) },
  chinos: { body: TROUSERS, details: line(32, 20, 68, 20) },
  joggers: { body: TROUSERS, details: line(30, 84, 44, 84) },
  leggings: { body: 'M36 12 L64 12 L64 90 L54 90 L50 36 L46 90 L36 90 Z' },
  shorts: { body: SHORTS }, skirt: { body: SKIRT },
  day_dress: { body: DRESS }, evening_dress: { body: 'M40 10 L46 10 Q50 16 54 10 L60 10 L62 30 L57 40 L70 94 L30 94 L43 40 L38 30 Z' },
  jumpsuit: { body: 'M36 14 L44 12 Q50 20 56 12 L64 14 L66 46 L68 92 L54 92 L50 56 L46 92 L32 92 L34 46 Z' },
  coat: { body: COAT, details: (s) => <>{line(50, 22, 50, 92)(s)}<Circle cx={45} cy={42} r={1.6} fill={s} opacity={0.4} /><Circle cx={45} cy={58} r={1.6} fill={s} opacity={0.4} /></> },
  trench: { body: COAT, details: (s) => <>{line(50, 22, 50, 92)(s)}<Rect x={30} y={52} width={40} height={4} fill={s} opacity={0.25} /></> },
  blazer: { body: JACKET, details: (s) => <><Path d="M46 13 L50 40 L54 13" stroke={s} strokeWidth={1.4} strokeOpacity={0.4} fill="none" /><Circle cx={50} cy={52} r={1.6} fill={s} opacity={0.4} /></> },
  jacket: { body: JACKET, details: line(50, 24, 50, 78) },
  denim_jacket: { body: JACKET, details: (s) => <>{line(50, 24, 50, 78)(s)}{line(34, 40, 46, 40)(s)}{line(54, 40, 66, 40)(s)}</> },
  rain_jacket: { body: JACKET, details: (s) => <><Path d="M40 16 Q50 6 60 16" stroke={s} strokeWidth={1.6} strokeOpacity={0.4} fill="none" />{line(50, 24, 50, 78)(s)}</> },
  puffer: { body: JACKET, details: (s) => <>{[34, 46, 58, 70].map((y) => <Line key={y} x1={22} y1={y} x2={78} y2={y} stroke={s} strokeWidth={1.4} strokeOpacity={0.3} />)}</> },
  sneakers: { body: SNEAKER, details: (s) => <><Rect x={14} y={66} width={74} height={5} rx={2} fill="#fff" />{line(40, 46, 48, 52)(s)}</> },
  boots: { body: BOOT }, heels: { body: HEEL }, loafers: { body: LOAFER }, oxfords: { body: LOAFER, details: line(42, 52, 54, 56) },
  flats: { body: LOAFER }, sandals: { body: 'M14 66 L86 66 L86 70 L14 70 Z', details: (s) => <Path d="M30 66 Q44 46 58 66" stroke={s} strokeWidth={3} strokeOpacity={0.5} fill="none" /> },
  tote: { body: BAG, details: (s) => <Path d="M36 38 Q36 18 50 18 Q64 18 64 38" stroke={s} strokeWidth={2.4} strokeOpacity={0.5} fill="none" /> },
  backpack: { body: 'M28 26 Q28 16 50 16 Q72 16 72 26 L74 88 L26 88 Z', details: (s) => <Rect x={36} y={56} width={28} height={18} rx={3} fill={s} opacity={0.18} /> },
  crossbody: { body: 'M24 48 L76 48 L78 80 L22 80 Z', details: (s) => <Path d="M26 48 L50 12 L74 48" stroke={s} strokeWidth={1.6} strokeOpacity={0.5} fill="none" /> },
  clutch: { body: 'M16 40 L84 40 L84 70 L16 70 Z', details: line(16, 52, 84, 52) },
  briefcase: { body: 'M16 36 L84 36 L84 82 L16 82 Z', details: (s) => <Path d="M40 36 L40 28 L60 28 L60 36" stroke={s} strokeWidth={2} strokeOpacity={0.5} fill="none" /> },
  belt: { body: BELT, details: (s) => <Rect x={60} y={41} width={14} height={18} rx={2} fill="none" stroke="#C9A35A" strokeWidth={2} /> },
};

// A type with no drawing of its own borrows one from its category.
const BY_CATEGORY: Record<string, string> = {
  top: 't_shirt', bottom: 'trousers', dress: 'day_dress', outerwear: 'jacket', shoes: 'sneakers', bag: 'tote', accessory: 'belt',
};

function isLight(rgb: [number, number, number]) {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 200;
}

export function GarmentSketch({ subcategory, category, rgb, size = 56 }: {
  subcategory: string; category: string; rgb: [number, number, number]; size?: number;
}) {
  const shape = SHAPES[subcategory] ?? SHAPES[BY_CATEGORY[category] ?? 't_shirt'];
  const fill = `rgb(${rgb.join(',')})`;
  // Pale pieces get a grey outline so white on a light card still has an edge.
  const edge = isLight(rgb) ? '#9A958C' : 'rgba(0,0,0,0.25)';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="sketchShade" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.22} />
          <Stop offset="0.55" stopColor="#fff" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </LinearGradient>
      </Defs>
      <Path d={shape.body} fill={fill} stroke={edge} strokeWidth={1} strokeLinejoin="round" />
      <Path d={shape.body} fill="url(#sketchShade)" />
      {shape.details?.(isLight(rgb) ? '#6B665E' : '#000')}
    </Svg>
  );
}
