'use client'
import { useT } from '@/lib/i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Which page numbers the pager draws.
 *
 *  Always the first and the last, plus a window either side of the current one,
 *  with a gap marker standing in for what was left out. Drawing all of them was
 *  fine at 25 rows a page; at 10 a few hundred accounts is a few dozen buttons,
 *  and the pager would wrap into its own paragraph.
 */
export function pageList(page: number, pages: number, span = 1): (number | 'gap')[] {
  // A plain array rather than a Set: this file compiles below ES2015, where
  // spreading one to sort it needs downlevelIteration.
  const keep: number[] = []
  const add = (p: number) => { if (p >= 1 && p <= pages && keep.indexOf(p) < 0) keep.push(p) }
  add(1)
  for (let p = page - span; p <= page + span; p++) add(p)
  add(pages)
  keep.sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  let prev = 0
  for (const p of keep) {
    // A single skipped page is written out rather than hidden behind a gap:
    // "1 … 3" is longer than "1 2 3" and one click worse.
    if (prev && p - prev === 2) out.push(prev + 1)
    else if (prev && p - prev > 2) out.push('gap')
    out.push(p)
    prev = p
  }
  return out
}

/**
 * The pager both tables use — numbered, so any page is one click away.
 *
 * One component rather than one per page: the two tables page differently
 * underneath (the users list asks the server for a page, the premium list
 * slices an array it already has) but the control a person presses must not
 * differ at all.
 *
 * Draws nothing for a single page: there is nowhere to go, and the range above
 * it already says how many rows there are.
 */
export function Pager({ page, pages, total, perPage, onChange, disabled = false }: {
  page: number
  pages: number
  total: number
  perPage: number
  onChange: (page: number) => void
  /** True while the rows are being replaced, so a second click cannot queue up
   *  a page the table is not showing yet. */
  disabled?: boolean
}) {
  const t = useT()
  if (pages <= 1) return null

  const arrow = `inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-card border border-slate-200
                 text-slate-600 hover:bg-slate-50 hover:text-slate-900
                 disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-slate-600`

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-slate-100">
      <span className="text-xs text-slate-500">
        {t('pageOf', {
          from: (page - 1) * perPage + 1,
          to: Math.min(page * perPage, total),
          total,
        })}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => onChange(Math.max(1, page - 1))}
                disabled={page <= 1 || disabled} className={arrow}>
          <ChevronLeft size={14} /> {t('pagePrev')}
        </button>
        {pageList(page, pages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap${i}`} className="px-1 text-xs text-slate-400 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              disabled={disabled}
              aria-current={p === page ? 'page' : undefined}
              aria-label={t('pageGoTo', { page: p })}
              className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs border tabular-nums
                          disabled:opacity-40 ${
                p === page
                  ? 'bg-indigo-50 border-indigo-200 dark:border-indigo-300 text-indigo-600 dark:text-indigo-700 font-medium'
                  : 'bg-card border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button onClick={() => onChange(Math.min(pages, page + 1))}
                disabled={page >= pages || disabled} className={arrow}>
          {t('pageNext')} <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
