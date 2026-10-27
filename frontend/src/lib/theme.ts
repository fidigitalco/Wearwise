import { useColorScheme } from 'react-native';

/**
 * Warm neutrals with one amber accent: the clothes are the colour on screen,
 * so the chrome stays quiet. Primary buttons are ink-on-paper (inverted in dark
 * mode); `highlight` marks scores and the selected chip.
 */
export const LIGHT = {
  isDark: false,
  bg: '#FAF8F5',
  card: '#FFFFFF',
  cardAlt: '#F3EFEA',
  border: '#E7E2DC',
  text: '#1C1917',
  textSub: '#57534E',
  textMuted: '#78716C',
  primary: '#1C1917',
  onPrimary: '#FFFFFF',
  highlight: '#B45309',
  onHighlight: '#FFFFFF',
  highlightBg: '#FEF3C7',
  danger: '#B91C1C',
  success: '#15803D',
  overlay: 'rgba(28,25,23,0.45)',
};

export const DARK: typeof LIGHT = {
  isDark: true,
  bg: '#0C0A09',
  card: '#1C1917',
  cardAlt: '#292524',
  border: '#292524',
  text: '#FAFAF9',
  textSub: '#D6D3D1',
  textMuted: '#A8A29E',
  primary: '#FAFAF9',
  onPrimary: '#0C0A09',
  highlight: '#F59E0B',
  onHighlight: '#0C0A09',
  highlightBg: '#3B2A0B',
  danger: '#F87171',
  success: '#4ADE80',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Theme = typeof LIGHT;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
