'use client'
import { useTheme } from './theme'

/**
 * The colours recharts needs as VALUES.
 *
 * Everything else in the panel is a Tailwind class resolving to a CSS variable
 * (see tailwind.config.js), but recharts paints SVG and takes most of its
 * colours as attributes — `stroke="#F1F5F9"` on a grid line — and an attribute
 * is not CSS, so a variable never resolves there. The grid and the tooltip were
 * the light theme's, drawn on a dark card.
 *
 * The data is one hue: olive, the accent. A chart with several series tells
 * them apart by shade (`series`, darkest first), not by a rainbow — red and
 * green read as "bad" and "good" even when they only mean "the third type".
 */
export const CHART_PRIMARY = '#68705A'

export function useChartColors() {
  const dark = useTheme().theme === 'dark'
  return {
    primary: dark ? '#A3AC92' : CHART_PRIMARY,
    /** Olive, strongest to faintest; index it modulo its length. Dark mode
     *  reads the scale from the bright end, or the pale shades sink into the
     *  card. */
    series: dark
      ? ['#C8CFBD', '#B6BEA6', '#A3AC92', '#8C957B', '#68705A', '#515944']
      : ['#515944', '#68705A', '#7D866D', '#A3AC92', '#C8CFBD', '#DDE2D5'],
    /** Grid lines and the inert half of a two-slice pie. */
    grid: dark ? '#2A2D27' : '#EFECE5',
    rest: dark ? '#33372F' : '#E4E0D8',
    /** Axis labels. */
    tick: dark ? '#8F8C83' : '#959289',
    tooltip: dark
      ? { background: '#1F221D', border: '1px solid #33372F', color: '#F1EFE9' }
      : { background: '#ffffff', border: '1px solid #E4E0D8', color: '#242722' },
    cursor: dark ? '#3A3E35' : '#E4E0D8',
  }
}
