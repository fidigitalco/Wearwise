'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORE_KEY = 'admin_theme'

/**
 * The script that runs before the page paints.
 *
 * Without it the panel renders light, the React effect reads storage a moment
 * later and everything flips — a white flash on every navigation for somebody
 * who chose dark. Inlined in <head> (layout.tsx) so it runs before the first
 * paint; it only stamps an attribute, which is what the palette keys off.
 *
 * `system` is not a third choice: it is what the FIRST visit resolves to, and
 * the resolved answer is stored. An admin who picks one has picked it.
 */
export const THEME_BOOT_SCRIPT = `
try {
  var t = localStorage.getItem('${STORE_KEY}');
  if (t !== 'light' && t !== 'dark') {
    t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`.trim()

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'light',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light until the client says otherwise. The server renders this too, and the
  // boot script above has already stamped the real answer on <html> by the time
  // anything is painted — this state only drives the toggle's own icon.
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const stamped = document.documentElement.getAttribute('data-theme')
    if (stamped === 'dark' || stamped === 'light') setThemeState(stamped)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(STORE_KEY, next) } catch { /* storage blocked */ }
  }, [])

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
