'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bug, Check, ChevronDown, ChevronUp, RotateCcw, Trash2 } from 'lucide-react'
import { api, type ErrorRow, type ErrorsPage } from '@/lib/api'
import { useLang, type Key } from '@/lib/i18n'
import { BarList, Card, LoadError, PageHeader, TrendChart } from '@/components/charts'
import { Pager } from '@/components/Pager'
import { EmptyIcon, Pill } from '@/components/ui'
import { formatDate } from '@/components/UserDrawer'

const PER_PAGE = 25
const KINDS: ['crash' | 'server', Key][] = [['crash', 'crashes'], ['server', 'serverErrors']]
const STATUSES: [string, Key][] = [['open', 'feedbackOpen'], ['resolved', 'feedbackResolved'], ['', 'all']]
const action = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors'

/**
 * What went wrong: JavaScript errors the app could not recover from (sent by
 * its global error handler, with platform and version), and 500s and logged
 * errors on the server (a repeat of an open one is counted, not added).
 */
export default function ErrorsPage() {
  const { t, lang } = useLang()
  const [query, setQuery] = useState<{ kind: 'crash' | 'server'; status: string; page: number }>({ kind: 'crash', status: 'open', page: 1 })
  const [data, setData] = useState<ErrorsPage | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const load = useCallback(() => {
    setBusy(true)
    setFailed(false)
    api.errors(query).then(setData).catch(() => setFailed(true)).finally(() => setBusy(false))
  }, [query])
  useEffect(load, [load])

  const toggle = (e: ErrorRow) => { api.updateError(e.kind, e.id, !e.resolved).then(load).catch(() => setFailed(true)) }
  const remove = (e: ErrorRow) => {
    if (window.confirm(t('deleteErrorConfirm'))) api.deleteError(e.kind, e.id).then(load).catch(() => setFailed(true))
  }
  const open = data ? data.open.crash + data.open.server : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('navErrors')} subtitle={data ? `${t('errorsSubtitle')} · ${t('openErrors', { n: open })}` : t('errorsSubtitle')} />

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
          <Card title={t('errorsLast14')}>
            <TrendChart height={180} series={[{ name: t('crashes'), data: data.daily.crash }, { name: t('serverErrors'), data: data.daily.server }]} />
          </Card>
          <Card title={t('crashesByVersion')}>
            {data.crashes_by_version.length
              ? <BarList height={180} data={data.crashes_by_version} label={(n) => (n ? `v${n}` : t('unknown'))} />
              : <div className="py-10 text-center text-sm text-slate-400">{t('noData')}</div>}
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5">
          {KINDS.map(([value, key]) => (
            <button key={value} onClick={() => setQuery((q) => ({ ...q, kind: value, page: 1 }))}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                query.kind === value ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
              {t(key)}{data ? ` · ${data.open[value]}` : ''}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5">
          {STATUSES.map(([value, key]) => (
            <button key={value} onClick={() => setQuery((q) => ({ ...q, status: value, page: 1 }))}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                query.status === value ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      <div className={`bg-card rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''}`}>
        {failed ? <LoadError onRetry={load} /> : !data ? (
          <div className="py-16 text-center text-sm text-slate-400">{t('loading')}</div>
        ) : data.results.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400"><EmptyIcon icon={Bug} />{t('noErrors')}</div>
        ) : (
          <>
            <ul className="divide-y divide-slate-200">
              {data.results.map((e) => (
                <li key={`${e.kind}${e.id}`} className="px-4 sm:px-6 py-4 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {e.kind === 'crash' ? (
                      <>
                        {e.fatal && <Pill tone="danger">{t('fatal')}</Pill>}
                        <Pill>{t(`platform_${e.platform || 'unknown'}` as Key)}{e.app_version ? ` v${e.app_version}` : ''}</Pill>
                        {e.device && <span>{e.device}</span>}
                      </>
                    ) : (
                      <>
                        <Pill tone={e.level === 'ERROR' || e.level === 'CRITICAL' ? 'danger' : 'warning'}>{e.level}</Pill>
                        {e.endpoint && <code className="text-slate-700">{e.method} {e.endpoint}</code>}
                        {e.count > 1 && <Pill tone="warning">{t('timesSeen', { n: e.count })}</Pill>}
                      </>
                    )}
                    {e.resolved && <Pill tone="success">{t('feedbackResolved')}</Pill>}
                    <span className="text-slate-700">{e.user ? e.user.email || t('guest') : t('signedOut')}</span>
                    <span>· {formatDate(e.last_seen_at, lang, true)}</span>
                  </div>
                  <p className="text-sm text-slate-900 font-mono break-words">{e.message}</p>
                  {expanded === e.id && e.detail && (
                    <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-80 whitespace-pre">{e.detail}</pre>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {e.detail && (
                      <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className={`${action} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
                        {expanded === e.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {t(expanded === e.id ? 'hideDetail' : 'showDetail')}
                      </button>
                    )}
                    <button onClick={() => toggle(e)} className={`${action} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
                      {e.resolved ? <RotateCcw size={13} /> : <Check size={13} />} {e.resolved ? t('markOpen') : t('markResolved')}
                    </button>
                    <button onClick={() => remove(e)} className={`${action} bg-card border-red-200 text-red-700 hover:bg-red-50`}>
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
