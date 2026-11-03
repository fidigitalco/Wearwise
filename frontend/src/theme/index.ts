import { Platform, type TextStyle } from 'react-native';

/**
 * WearWise design tokens: warm ivory pages, white surfaces, charcoal type and a
 * restrained muted olive for primary actions and selected states. The clothes
 * carry the colour; the interface stays quiet. Every colour used in the app is
 * defined here.
 *
 * Brand tokens (from the design brief): background #F6F4EF, surface #FFFFFF,
 * textPrimary #242722, textSecondary #817F76, accent #68705A, accentPressed
 * #515944, accentSubtle #E9ECE4, sand #E6DFD3, border #E4E0D8, success #55765B,
 * warning #A77B40, error #A64F46.
 *
 * Accessibility: textSecondary measures 3.6:1 on the background, fine for icons
 * and placeholders (3:1) but below 4.5:1 for small text, so small secondary text
 * uses `textMuted` (#6E6C64, 4.8:1 on background, 5.3:1 on white). White on the
 * accent is 5.2:1; text on the accent-subtle tint stays charcoal. `warning`
 * (3.4:1) is never used for text.
 */
export const LIGHT = {
  isDark: false,
  bg: '#F6F4EF',
  card: '#FFFFFF',
  cardAlt: '#E6DFD3', // sand: image wells, tracks, placeholders
  sand: '#E6DFD3',
  tile: '#F1EEE8', // the one light ground every cut-out piece sits on
  border: '#E4E0D8',
  text: '#242722',
  textSub: '#6E6C64',
  textMuted: '#6E6C64',
  textSecondary: '#817F76', // icons, placeholders, dividers in text
  primary: '#68705A',
  primaryPressed: '#515944',
  accent: '#A65E3E', // terracotta: a rare editorial touch (section kickers), never a button
  onPrimary: '#FFFFFF',
  highlight: '#68705A',
  onHighlight: '#FFFFFF',
  highlightBg: '#E9ECE4',
  success: '#55765B',
  warning: '#A77B40',
  danger: '#A64F46',
  overlay: 'rgba(36,39,34,0.45)',
  onImage: '#FFFFFF', // text and icons laid over photos or the dark overlay
  imageShade: 'rgba(36,39,34,0.34)', // keeps text on a photo readable
  frosted: 'rgba(255,255,255,0.92)', // small controls floating on photos
  swatchFallback: '#E4E0D8',
  shadow: '#242722',
};

export const DARK: typeof LIGHT = {
  isDark: true,
  bg: '#161814',
  card: '#1F221D',
  cardAlt: '#2A2D27',
  sand: '#2A2D27',
  tile: '#262922',
  border: '#33372F',
  text: '#F1EFE9',
  textSub: '#BDBAB1',
  textMuted: '#A9A69C',
  textSecondary: '#8F8C83',
  primary: '#A3AC92',
  primaryPressed: '#8C957B',
  accent: '#D49A7C',
  onPrimary: '#161814',
  highlight: '#B6BEA6',
  onHighlight: '#161814',
  highlightBg: '#2C3227',
  success: '#86A98B',
  warning: '#C9A06A',
  danger: '#CF8077',
  overlay: 'rgba(0,0,0,0.6)',
  onImage: '#FFFFFF',
  imageShade: 'rgba(0,0,0,0.4)',
  frosted: 'rgba(31,34,29,0.9)',
  swatchFallback: '#33372F',
  shadow: '#000000',
};

export type Theme = typeof LIGHT;

/**
 * The app is light-only for now, whatever the phone's setting (app.json
 * `userInterfaceStyle: "light"` keeps native pickers and alerts light too).
 * DARK stays defined so a dark mode can be switched back on in one place.
 */
export function useTheme(): Theme {
  return LIGHT;
}

// 4/8-point spacing; moderate radii (cards 12–14). Pills only for compact filters.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 10, lg: 14, xl: 16, pill: 999 };
export const iconSize = { sm: 16, md: 20, lg: 24 };
/** Minimum comfortable touch target. */
export const touch = 44;
/** Page side margin, the same on every screen. */
export const gutter = 20;

// SF Pro is the iOS system font; Android falls back to its system sans.
const family = Platform.select<TextStyle['fontFamily']>({ ios: 'System', default: undefined });
// Big titles use a serif for an editorial, fashion-magazine voice; both ship with the OS.
const serif = Platform.select<TextStyle['fontFamily']>({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

export const type = {
  display: { fontFamily: serif, fontSize: 30, lineHeight: 36, fontWeight: '500', letterSpacing: -0.3 },
  title: { fontFamily: family, fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: { fontFamily: family, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontFamily: family, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily: family, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label: { fontFamily: family, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  caption: { fontFamily: family, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontFamily: family, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

/** Restrained elevation; most surfaces rely on a 1 px border instead. */
export function elevation(t: Theme, level: 1 | 2 = 1) {
  return {
    shadowColor: t.shadow,
    shadowOpacity: t.isDark ? 0.3 : level === 1 ? 0.04 : 0.08,
    shadowRadius: level === 1 ? 6 : 14,
    shadowOffset: { width: 0, height: level === 1 ? 1 : 4 },
    elevation: level === 1 ? 1 : 3,
  };
}
