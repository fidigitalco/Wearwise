'use client'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, Play, Plus, RefreshCw, Store, Trash2 } from 'lucide-react'
import { api, StoreConn, type ApiError } from '@/lib/api'
import { useLang, type Key } from '@/lib/i18n'
import { LoadError, PageHeader } from '@/components/charts'
import { EmptyIcon, Pill } from '@/components/ui'
import { formatDate } from '@/components/UserDrawer'

const KINDS: StoreConn['kind'][] = ['feed', 'aliexpress', 'awin', 'links']
const FIELD_LABEL: Record<string, string> = {
  app_key: 'App Key', app_secret: 'App Secret', tracking_id: 'Tracking ID', keywords: 'Keywords', ship_to: 'Ship to (AZ, TR…)',
  currency: 'Currency (USD…)', api_key: 'API key', feed_ids: 'Feed IDs', language: 'Language (en…)', url: 'Feed URL', format: 'Format (auto, xml, csv, tsv)',
}

type Draft = { id?: number; name: string; store: string; kind: StoreConn['kind']; config: Record<string, string>; link_template: string; gender: string; notes?: string }
const EMPTY: Draft = { name: '', store: '', kind: 'feed', config: {}, link_template: '', gender: '' }

/** Store connections: the owner enters what each store or network gave them; products are imported daily. */
export default function StoresPage() {
  const { t, lang } = useLang()
  const [rows, setRows] = useState<StoreConn[] | null>(null)
  const [kinds, setKinds] = useState<Record<string, Record<string, boolean>>>({})
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<number, { ok: boolean; text: string }>>({})
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setFailed(false)
    api.stores().then((r) => { setRows(r.results); setKinds(r.kinds) }).catch(() => setFailed(true))
  }, [])
  useEffect(load, [load])

  const edit = (r: StoreConn) => setDraft({
    id: r.id, name: r.name, store: r.store, kind: r.kind, link_template: r.link_template, gender: r.gender, notes: r.notes,
    config: Object.fromEntries(Object.entries(r.config).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])),
  })

  const save = async () => {
    if (!draft) return
    setErrors({})
    const config: Record<string, string | string[]> = { ...draft.config }
    if (typeof config.keywords === 'string') config.keywords = config.keywords.split(',').map((x) => x.trim()).filter(Boolean)
    const body = { name: draft.name, store: draft.store, kind: draft.kind, config, link_template: draft.link_template, gender: draft.gender }
    try {
      // Switch on only once something to connect with was filled in; an empty save keeps it waiting.
      const filled = draft.kind === 'links' ? !!draft.link_template.trim() : Object.values(draft.config).some((v) => String(v ?? '').trim())
      if (draft.id) await api.updateStore(draft.id, (filled ? { ...body, active: true } : body) as Partial<StoreConn>)
      else await api.addStore(body as Partial<StoreConn>)
      setDraft(null)
      load()
    } catch (e) {
      setErrors((e as ApiError).fields ?? { name: 'name' })
    }
  }

  const test = async (r: StoreConn) => {
    try {
      const out = await api.testStore(r.id)
      setNotes((n) => ({ ...n, [r.id]: out.ok ? { ok: true, text: t('storeTestOk', { n: out.count }) } : { ok: false, text: t('storeTestFail', { error: out.error }) } }))
    } catch {
      setNotes((n) => ({ ...n, [r.id]: { ok: false, text: t('storeTestFail', { error: 'server' }) } }))
    }
  }
  const sync = (r: StoreConn) => { api.syncStore(r.id).then(load).catch(() => setFailed(true)); setTimeout(load, 8000) }
  const remove = (r: StoreConn) => { if (window.confirm(t('storeDeleteConfirm'))) api.deleteStore(r.id).then(load).catch(() => setFailed(true)) }
  const toggle = (r: StoreConn) => { api.updateStore(r.id, { active: !r.active }).then(load).catch(() => setFailed(true)) }

  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors'
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-card text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const fields = draft ? Object.keys(kinds[draft.kind] ?? {}) : []

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader title={t('navStores')} subtitle={t('storesSubtitle')} />
      {failed && <LoadError onRetry={load} />}

      {draft ? (
        <div className="bg-card rounded-xl border border-slate-200 p-5 space-y-4 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">{t('storeName')}</span>
              <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              {errors.name && <span className="text-xs text-red-600">{t(errors.name === 'taken' ? 'storeErr_taken' : 'storeErr_name')}</span>}
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">{t('storeKind')}</span>
              <select className={input} value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as StoreConn['kind'], config: {} })}>
                {KINDS.map((k) => <option key={k} value={k}>{t(`storeKind_${k}` as Key)}</option>)}
              </select>
            </label>
          </div>
          {draft.notes ? (
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold">{t('storeHowTo')}: </span>{draft.notes}
            </div>
          ) : null}
          <p className="text-xs text-slate-500 leading-relaxed">{t(`storeHelp_${draft.kind}` as Key)}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">{t('storeStoreName')}</span>
              <input className={input} value={draft.store} placeholder="Trendyol" onChange={(e) => setDraft({ ...draft, store: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">{t('storeGender')}</span>
              <select className={input} value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
                <option value="">—</option><option value="women">women</option><option value="men">men</option><option value="unisex">unisex</option>
              </select>
            </label>
            {fields.map((f) => {
              const secret = kinds[draft.kind]?.[f]
              return (
                <label key={f} className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">{FIELD_LABEL[f] ?? f}</span>
                  <input className={input} value={draft.config[f] ?? ''} type={secret && !String(draft.config[f] ?? '').startsWith('••') ? 'password' : 'text'}
                    onChange={(e) => setDraft({ ...draft, config: { ...draft.config, [f]: e.target.value } })} />
                  {secret && String(draft.config[f] ?? '').startsWith('••') && <span className="text-[11px] text-slate-400">{t('storeSecretKept')}</span>}
                </label>
              )
            })}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">{t('storeLinkTemplate')}</span>
            <input className={input} value={draft.link_template} placeholder={t('storeLinkTemplateHint')}
              onChange={(e) => setDraft({ ...draft, link_template: e.target.value })} />
            {errors.link_template && <span className="text-xs text-red-600">{t('storeErr_missing_url')}</span>}
          </label>
          <div className="flex gap-2">
            <button onClick={save} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:brightness-90">{t('storeSave')}</button>
            <button onClick={() => { setDraft(null); setErrors({}) }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">{t('storeCancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setDraft({ ...EMPTY })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:brightness-90">
          <Plus size={16} /> {t('storeAdd')}
        </button>
      )}

      {rows && !rows.length && !draft ? (
        <div className="bg-card rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <EmptyIcon icon={Store} />
          <p className="text-sm text-slate-500">{t('storeEmpty')}</p>
        </div>
      ) : null}

      {rows?.length ? (
        <input className={`${input} max-w-sm`} placeholder={t('storeSearch')} value={search} onChange={(e) => setSearch(e.target.value)} />
      ) : null}

      {([1, 2, 3] as const).map((wave) => {
        const list = (rows ?? []).filter((r) => (wave === 3 ? r.priority >= 3 : r.priority === wave))
          .filter((r) => !search || `${r.name} ${r.network}`.toLowerCase().includes(search.toLowerCase()))
        if (!list.length) return null
        return (
          <section key={wave} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t(`storeWave${wave}` as Key)} · {list.length}</h2>
            <ul className="space-y-3">
              {list.map((r) => (
                <li key={r.id} className="bg-card rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    <Pill tone="neutral">{t(`storeKind_${r.kind}` as Key)}</Pill>
                    {r.network && <Pill tone="neutral">{t('storeNetwork')}: {r.network}</Pill>}
                    {r.waiting ? <Pill tone="accent">{t('storeWaiting')}</Pill>
                      : <Pill tone={r.active ? 'success' : 'neutral'}>{t(r.active ? 'storeActive' : 'storeInactive')}</Pill>}
                    {r.kind !== 'links' && !r.waiting && <span>· {t('storeProducts', { n: r.product_count })}</span>}
                    {!r.waiting && <span>· {r.last_sync_at ? formatDate(r.last_sync_at, lang, true) : t('storeNever')}</span>}
                  </div>
                  {r.waiting && r.notes && <p className="text-xs text-slate-500 leading-relaxed">{r.notes}</p>}
                  {r.last_status && <p className={`text-xs ${r.last_status.startsWith('Error') ? 'text-red-600' : 'text-slate-600'}`}>{r.last_status}</p>}
                  {notes[r.id] && <p className={`text-xs ${notes[r.id].ok ? 'text-emerald-700' : 'text-red-600'}`}>{notes[r.id].text}</p>}
                  <div className="flex flex-wrap gap-2">
                    {r.kind !== 'links' && !r.waiting && (
                      <>
                        <button onClick={() => test(r)} className={`${btn} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}><Play size={13} /> {t('storeTest')}</button>
                        <button onClick={() => sync(r)} className={`${btn} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}><RefreshCw size={13} /> {t('storeSync')}</button>
                      </>
                    )}
                    <button onClick={() => edit(r)} className={`${btn} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}><Pencil size={13} /> {t('storeEdit')}</button>
                    {!r.waiting && (
                      <button onClick={() => toggle(r)} className={`${btn} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>{t(r.active ? 'storeInactive' : 'storeActive')}</button>
                    )}
                    <button onClick={() => remove(r)} className={`${btn} bg-card border-red-200 text-red-700 hover:bg-red-50`}><Trash2 size={13} /> {t('delete')}</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
