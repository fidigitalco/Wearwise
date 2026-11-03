/** @type {import('tailwindcss').Config} */

/**
 * The palette is a set of CSS variables, not fixed hexes.
 *
 * The panel was written in plain Tailwind neutrals — `bg-white` for a card,
 * `text-slate-900` for a heading, `border-slate-200` for a hairline — about 400
 * of them across ten pages. Adding a `dark:` twin to each would have been four
 * hundred edits and four hundred chances to miss one.
 *
 * So each shade resolves to a variable instead, and globals.css gives the
 * variables one set of values in light and another in dark. Every existing
 * class then means the right colour in both, and anything written later
 * inherits that for free.
 *
 * The scale is used semantically here — low numbers for surfaces, high ones for
 * text — so dark mode is mostly that scale read backwards: slate-50 is the
 * deepest background, slate-900 the brightest text.
 *
 * `white` is deliberately NOT remapped: it is the ink on coloured buttons
 * (`bg-indigo-600 text-white`), which look the same in both themes. Cards say
 * `bg-card`.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name, shades) =>
  Object.fromEntries(shades.map((s) => [s, v(`${name}-${s}`)]));

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // A surface that stays dark in both themes (the "scroll for more"
        // hint). The navigation rail itself is `bg-card` now.
        sidebar: '#242722',
        accent: '#68705A',
        // What a card is made of. `bg-white` used to say this.
        card: v('card'),
        slate: scale('slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        indigo: scale('indigo', [50, 100, 200, 300, 500, 600, 700]),
        red: scale('red', [50, 100, 200, 600, 700]),
        amber: scale('amber', [50, 100, 200, 400, 700]),
        emerald: scale('emerald', [50, 100, 600, 700]),
        sky: scale('sky', [100, 700]),
        violet: scale('violet', [100, 700]),
        teal: scale('teal', [100, 700]),
        blue: scale('blue', [100, 700]),
        green: scale('green', [100, 700]),
        orange: scale('orange', [100, 700]),
        purple: scale('purple', [100, 700]),
        rose: scale('rose', [100, 700]),
      },
    },
  },
  plugins: [],
}
