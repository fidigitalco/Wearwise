'use client'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { api, Page, UserQuery, UserRow } from '@/lib/api'
import { useLabel, useT, type Key } from '@/lib/i18n'
import { LoadError, PageHeader } from '@/components/charts'
import { Pager } from '@/components/Pager'
import { UserDrawer } from '@/components/UserDrawer'
import { UserTable } from '@/components/UserTable'

const PER_PAGE = 25
const KINDS: [string, Key][] = [['', 'all'], ['member', 'kindMember'], ['guest', 'kindGuest'], ['blocked', 'kindBlocked']]
const SORTS: [string, Key][] = [
  ['-date_joined', 'sortNewest'], ['date_joined', 'sortOldest'], ['-n_garments', 'sortCloset'], ['-n_wears', 'sortWears'], ['email', 'sortEmail'],
]

export default function UsersPage() {
  const t = useT()
  const label = useLabel()
  const [query, setQuery] = useState<UserQuery>({ kind: 'member', sort: '-date_joined', page: 1 })
  const [typed, setTyped] = useState('')
  const [data, setData] = useState<Page<UserRow> | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  // Search as you type, a beat after the last key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery((q) => (q.q === typed ? q : { ...q, q: typed, page: 1 })), 300)
    return () => clearTimeout(timer)
  }, [typed])

  const load = useCallback(() => {
    setBusy(true)
    setFailed(false)
    api.users(query).then(setData).catch(() => setFailed(true)).finally(() => setBusy(false))
  }, [query])

  useEffect(load, [load])

  const set = (patch: UserQuery) => setQuery((q) => ({ ...q, ...patch, page: patch.page ?? 1 }))
  const select = 'appearance-none h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-card text-sm text-slate-700 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('navUsers')} subtitle={data ? t('usersSubtitle', { n: data.count }) : undefined} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('search')}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-card text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5">
          {KINDS.map(([value, key]) => (
            <button key={value} onClick={() => set({ kind: value })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                (query.kind ?? '') === value ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
              {t(key)}
            </button>
          ))}
        </div>
        <Select value={query.plan ?? ''} onChange={(v) => set({ plan: v })} className={select}
          options={[['', `${t('colPlan')}: ${t('all')}`], ['free', t('free')], ['premium', t('premium')]]} />
        <Select value={query.provider ?? ''} onChange={(v) => set({ provider: v })} className={select}
          options={[['', `${t('colMethod')}: ${t('all')}`], ...(['email', 'apple', 'google'] as const).map((p) => [p, label('method', p)] as [string, string])]} />
        <Select value={query.sort ?? '-date_joined'} onChange={(v) => set({ sort: v })} className={select}
          options={SORTS.map(([v, k]) => [v, t(k)] as [string, string])} />
      </div>

      <div className={`bg-card rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''}`}>
        {failed ? <LoadError onRetry={load} /> : data ? (
          <>
            <UserTable rows={data.results} onOpen={setOpen} />
            <Pager page={data.page} pages={data.pages} total={data.count} perPage={PER_PAGE} disabled={busy}
              onChange={(page) => setQuery((q) => ({ ...q, page }))} />
          </>
        ) : <div className="py-16 text-center text-sm text-slate-400">{t('loading')}</div>}
      </div>

      <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />
    </div>
  )
}

function Select({ value, onChange, options, className }: {
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  className: string
}) {
  return (
    <label className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
        {options.map(([v, text]) => <option key={v} value={v} className="bg-card text-slate-900">{text}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </label>
  )
}
