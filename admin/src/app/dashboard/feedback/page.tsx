'use client'
import { useCallback, useEffect, useState } from 'react'
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { api, FeedbackRow, Page } from '@/lib/api'
import { useLang, type Key } from '@/lib/i18n'
import { LoadError, PageHeader } from '@/components/charts'
import { Pager } from '@/components/Pager'
import { EmptyIcon, Pill } from '@/components/ui'
import { formatDate } from '@/components/UserDrawer'

const PER_PAGE = 25
const STATUSES: [string, Key][] = [['open', 'feedbackOpen'], ['resolved', 'feedbackResolved'], ['', 'all']]

/** What users wrote from Settings → Send feedback. They sent it to us, so who wrote it is shown. */
export default function FeedbackPage() {
  const { t, lang } = useLang()
  const [query, setQuery] = useState({ status: 'open', page: 1 })
  const [data, setData] = useState<(Page<FeedbackRow> & { open: number }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setBusy(true)
    setFailed(false)
    api.feedback(query).then(setData).catch(() => setFailed(true)).finally(() => setBusy(false))
  }, [query])

  useEffect(load, [load])

  const toggle = (f: FeedbackRow) => { api.updateFeedback(f.id, !f.resolved).then(load).catch(() => setFailed(true)) }
  const remove = (f: FeedbackRow) => {
    if (window.confirm(t('deleteFeedbackConfirm'))) api.deleteFeedback(f.id).then(load).catch(() => setFailed(true))
  }

  const action = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors'

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('navFeedback')} subtitle={data ? `${t('feedbackSubtitle')} · ${t('openFeedbackSub', { n: data.open })}` : t('feedbackSubtitle')} />

      <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5 mb-4">
        {STATUSES.map(([value, key]) => (
          <button key={value} onClick={() => setQuery({ status: value, page: 1 })}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              query.status === value ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
            {t(key)}
          </button>
        ))}
      </div>

      <div className={`bg-card rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''}`}>
        {failed ? <LoadError onRetry={load} /> : !data ? (
          <div className="py-16 text-center text-sm text-slate-400">{t('loading')}</div>
        ) : data.results.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400"><EmptyIcon icon={MessageSquare} />{t('noFeedback')}</div>
        ) : (
          <>
            <ul className="divide-y divide-slate-200">
              {data.results.map((f) => (
                <li key={f.id} className="px-6 py-4 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Pill tone={f.kind === 'problem' ? 'danger' : f.kind === 'idea' ? 'accent' : 'neutral'}>{t(`kind_${f.kind}` as Key)}</Pill>
                    {f.resolved && <Pill tone="success">{t('feedbackResolved')}</Pill>}
                    <span className="text-slate-700 font-medium">
                      {f.user ? (f.user.is_guest ? t('guest') : f.user.email || f.user.name) : '—'}
                    </span>
                    <span>· {formatDate(f.created_at, lang, true)}</span>
                    {(f.platform || f.app_version) && <span>· {[f.platform, f.app_version].filter(Boolean).join(' ')}</span>}
                  </div>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{f.message}</p>
                  <div className="flex gap-2">
                    <button onClick={() => toggle(f)} className={`${action} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
                      {f.resolved ? <RotateCcw size={13} /> : <Check size={13} />} {f.resolved ? t('markOpen') : t('markResolved')}
                    </button>
                    <button onClick={() => remove(f)} className={`${action} bg-card border-red-200 text-red-700 hover:bg-red-50`}>
                      <Trash2 size={13} /> {t('delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={data.page} pages={data.pages} total={data.count} perPage={PER_PAGE} disabled={busy}
              onChange={(page) => setQuery((q) => ({ ...q, page }))} />
          </>
        )}
      </div>
    </div>
  )
}
