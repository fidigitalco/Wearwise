import type { LucideIcon } from 'lucide-react'

/**
 * The few pieces every page draws the same way.
 *
 * Status is told by a small dot on a neutral pill, not by a filled block of
 * colour: a table of red, green and amber pills shouts on every row, while a
 * grey pill with a dot reads at a glance and lets the one row that matters
 * stand out.
 */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const DOT: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  accent:  'bg-indigo-500',
  success: 'bg-emerald-600',
  warning: 'bg-amber-400',
  danger:  'bg-red-600',
  info:    'bg-indigo-300',
}

/** The pill's own classes, for the few places that build the element
 *  themselves (a <button>, a <select>). */
export const PILL =
  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ' +
  'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'

export function Pill({
  tone, icon: Icon, children, className = '', title,
}: {
  /** Omitted: no dot at all — a label, not a status. */
  tone?: Tone
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span className={`${PILL} ${className}`} title={title}>
      {tone && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[tone]}`} aria-hidden />}
      {Icon && <Icon size={12} strokeWidth={2} className="text-slate-500 shrink-0" aria-hidden />}
      {children}
    </span>
  )
}

/** The small square an icon sits in at the top of a stat card. */
export function IconTile({ icon: Icon, className = '' }: { icon: LucideIcon; className?: string }) {
  return (
    <div className={`w-9 h-9 rounded-lg border border-slate-200/80 bg-slate-50 grid place-items-center shrink-0 ${className}`}>
      <Icon size={18} strokeWidth={1.75} className="text-slate-500" aria-hidden />
    </div>
  )
}

/** Shown where a list has nothing in it yet. */
export function EmptyIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="w-11 h-11 mx-auto mb-3 rounded-xl border border-slate-200/80 bg-slate-50 grid place-items-center">
      <Icon size={20} strokeWidth={1.75} className="text-slate-400" aria-hidden />
    </div>
  )
}


/** "AZ" → 🇦🇿; '' for anything that is not a two-letter code. */
export function flag(code: string) {
  return /^[A-Za-z]{2}$/.test(code)
    ? String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : ''
}

/** "AZ" → "Azerbaijan" in the panel's language; the code itself where the browser cannot name it. */
export function countryName(code: string, lang: string) {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([lang === 'az' ? 'az' : 'en'], { type: 'region' }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** Install source as people say it: google_play → Google Play, instagram → Instagram. */
export function sourceName(source: string) {
  const known: Record<string, string> = { google_play: 'Google Play', direct: 'Direct', tiktok: 'TikTok', youtube: 'YouTube' }
  return known[source] ?? source.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase())
}
