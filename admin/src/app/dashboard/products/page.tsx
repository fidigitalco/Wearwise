'use client'
import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Eye, EyeOff, Pencil, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { api, type ApiError, type Page, type ProductForm, type ProductMeta, type ProductRow } from '@/lib/api'
import { useLang, type Key } from '@/lib/i18n'
import { LoadError, PageHeader } from '@/components/charts'
import { Pager } from '@/components/Pager'
import { EmptyIcon, Pill } from '@/components/ui'

const PER_PAGE = 25
const KINDS: [string, Key][] = [['real', 'kindReal'], ['demo', 'kindDemo'], ['', 'all']]
const EMPTY: ProductForm = {
  url: '', name: '', brand: '', store: '', price: '', currency: 'AZN', subcategory: '', color: '', gender: 'women', image_url: '',
}
const SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', TRY: '₺', AZN: '₼', RUB: '₽' }
const money = (n: number, c: string) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${SYMBOL[c] ?? c}`

const input = 'w-full h-9 px-3 rounded-lg border border-slate-200 bg-card text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500'
const action = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors'

/**
 * Real pieces with the link to their own product page. The app offers the one
 * or two that match a "complete your wardrobe" pick (type and colour) instead
 * of a search in the store. Demo rows only link to a search; they can be hidden.
 */
export default function ProductsPage() {
  const { t, lang } = useLang()
  const [query, setQuery] = useState({ kind: 'real', q: '', page: 1 })
  const [search, setSearch] = useState('')
  const [data, setData] = useState<(Page<ProductRow> & { real: number; demo: number }) | null>(null)
  const [meta, setMeta] = useState<ProductMeta | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [form, setForm] = useState<ProductForm | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setBusy(true)
    setFailed(false)
    api.products(query).then(setData).catch(() => setFailed(true)).finally(() => setBusy(false))
  }, [query])
  useEffect(load, [load])
  useEffect(() => { api.productMeta().then(setMeta).catch(() => setFailed(true)) }, [])
  // Search as the admin types, a moment after they stop.
  useEffect(() => {
    const id = setTimeout(() => setQuery((q) => (q.q === search ? q : { ...q, q: search, page: 1 })), 300)
    return () => clearTimeout(id)
  }, [search])

  const kindName = (sub: string) => meta?.categories.flatMap((c) => c.subs).find((s) => s.id === sub)?.[lang] ?? sub
  const colorOf = (id: string) => meta?.colors.find((c) => c.id === id)
  const set = (patch: Partial<ProductForm>) => setForm((f) => (f ? { ...f, ...patch } : f))

  const openNew = () => { setForm(EMPTY); setEditing(null); setErrors({}); setNotice('') }
  const openEdit = (p: ProductRow) => {
    setForm({ url: p.url, name: p.name, brand: p.brand, store: p.store, price: String(p.price), currency: p.currency,
      subcategory: p.subcategory, color: p.color, gender: p.gender, image_url: p.image_url })
    setEditing(p.id); setErrors({}); setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Fill what the link itself tells: the store, and often the type and colour from its words.
  const guess = (url: string) => {
    if (!url.trim()) return
    api.guessProduct(url.trim()).then((g) => {
      setErrors((e) => ({ ...e, url: g.search ? 'search' : '' }))
      setForm((f) => f && {
        ...f,
        store: f.store || g.store,
        subcategory: f.subcategory || g.subcategory || '',
        color: f.color || g.color || '',
      })
    }).catch(() => {})
  }

  const save = () => {
    if (!form) return
    setSaving(true)
    setErrors({})
    const call = editing ? api.updateProduct(editing, form) : api.addProduct(form)
    call.then(() => {
      setNotice(t('productSaved'))
      setForm(null)
      setEditing(null)
      setQuery((q) => ({ ...q, kind: 'real', page: 1 }))
      load()
    }).catch((e: ApiError) => {
      if (e.fields) setErrors(e.fields)
      else setFailed(true)
    }).finally(() => setSaving(false))
  }

  const toggle = (p: ProductRow) => { api.updateProduct(p.id, { active: !p.active }).then(load).catch(() => setFailed(true)) }
  const remove = (p: ProductRow) => {
    if (window.confirm(t('deleteProductConfirm'))) api.deleteProduct(p.id).then(load).catch(() => setFailed(true))
  }

  const errText = (field: string) => {
    const e = errors[field]
    if (!e) return null
    const key: Key = e === 'search' ? 'err_search' : e === 'required' ? 'err_required' : 'err_invalid'
    return <p className="text-xs text-red-600 mt-1">{t(key)}</p>
  }
  const label = (key: Key, children: React.ReactNode, field?: string, hint?: Key) => (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{t(key)}</span>
      {children}
      {field && errText(field)}
      {hint && !(field && errors[field]) && <p className="text-xs text-slate-400 mt-1">{t(hint)}</p>}
    </label>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('navProducts')}
        subtitle={data ? `${t('productsSubtitle')} · ${t('productsCounts', { real: data.real, demo: data.demo })}` : t('productsSubtitle')}
        right={!form && (
          <button onClick={openNew} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <Plus size={16} /> {t('addProduct')}
          </button>
        )}
      />
      <p className="text-sm text-slate-500 -mt-5 mb-6 max-w-3xl">{t('productsHow')}</p>
      {notice && !form && <p className="mb-4 text-sm text-emerald-700">{notice}</p>}

      {form && meta && (
        <div className="bg-card rounded-xl border border-slate-200/80 shadow-sm p-5 mb-6">
          <div className="flex items-center mb-4">
            <h2 className="flex-1 text-sm font-semibold text-slate-900">{t(editing ? 'editProduct' : 'addProduct')}</h2>
            <button onClick={() => { setForm(null); setEditing(null) }} aria-label={t('close')}
              className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {label('productUrl',
                  <input className={input} value={form.url} placeholder="https://www.trendyol.com/…-p-123456"
                    onChange={(e) => set({ url: e.target.value })} onBlur={(e) => guess(e.target.value)} />, 'url', 'productUrlHint')}
              </div>
              <div className="sm:col-span-2">{label('productName', <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} />, 'name')}</div>
              {label('productBrand', <input className={input} value={form.brand} onChange={(e) => set({ brand: e.target.value })} />, 'brand')}
              {label('productStore', <input className={input} value={form.store} onChange={(e) => set({ store: e.target.value })} />, 'store')}
              <div className="grid grid-cols-[1fr_100px] gap-2">
                {label('productPrice', <input className={input} inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value.replace(',', '.') })} />, 'price')}
                {label('productCurrency',
                  <select className={input} value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
                    {meta.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>, 'currency')}
              </div>
              {label('productGender',
                <select className={input} value={form.gender} onChange={(e) => set({ gender: e.target.value as ProductForm['gender'] })}>
                  {meta.genders.map((g) => <option key={g} value={g}>{t(`gender_${g}` as Key)}</option>)}
                </select>, 'gender')}
              {label('productType',
                <select className={input} value={form.subcategory} onChange={(e) => set({ subcategory: e.target.value })}>
                  <option value="">{t('chooseOption')}</option>
                  {meta.categories.map((c) => (
                    <optgroup key={c.id} label={t(`cat_${c.id}` as Key)}>
                      {c.subs.map((s) => <option key={s.id} value={s.id}>{s[lang]}</option>)}
                    </optgroup>
                  ))}
                </select>, 'subcategory')}
              {label('productColor',
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border border-slate-200 shrink-0"
                    style={{ background: form.color ? `rgb(${colorOf(form.color)?.rgb.join(',')})` : 'transparent' }} />
                  <select className={input} value={form.color} onChange={(e) => set({ color: e.target.value })}>
                    <option value="">{t('chooseOption')}</option>
                    {meta.colors.map((c) => <option key={c.id} value={c.id}>{c[lang]}</option>)}
                  </select>
                </div>, 'color')}
              <div className="sm:col-span-2">
                {label('productImage', <input className={input} value={form.image_url} placeholder="https://cdn.dsmcdn.com/…jpg"
                  onChange={(e) => set({ image_url: e.target.value })} />, 'image_url', 'productImageHint')}
              </div>
            </div>
            <div className="w-40 h-40 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden grid place-items-center">
              {form.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                : <ShoppingBag size={28} className="text-slate-300" />}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={save} disabled={saving}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {t('save')}
            </button>
            <button onClick={() => { setForm(null); setEditing(null) }}
              className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">{t('cancel')}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5">
          {KINDS.map(([value, key]) => (
            <button key={value} onClick={() => setQuery((q) => ({ ...q, kind: value, page: 1 }))}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                query.kind === value ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
              {t(key)}
            </button>
          ))}
        </div>
        <input className={`${input} max-w-xs`} placeholder={t('productSearch')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {query.kind === 'demo' && <p className="text-xs text-slate-500 mb-3">{t('demoNote')}</p>}

      <div className={`bg-card rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''}`}>
        {failed ? <LoadError onRetry={load} /> : !data ? (
          <div className="py-16 text-center text-sm text-slate-400">{t('loading')}</div>
        ) : data.results.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400"><EmptyIcon icon={ShoppingBag} />{t('noProducts')}</div>
        ) : (
          <>
            <ul className="divide-y divide-slate-200">
              {data.results.map((p) => (
                <li key={p.id} className={`px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 ${p.active ? '' : 'opacity-60'}`}>
                  <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 grid place-items-center">
                    {p.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      : <ShoppingBag size={18} className="text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      <span>{[p.brand, p.store].filter(Boolean).join(' · ')}</span>
                      <span>· {money(p.price, p.currency)}</span>
                      <span className="inline-flex items-center gap-1">
                        · <span className="w-2.5 h-2.5 rounded-full border border-slate-200" style={{ background: `rgb(${colorOf(p.color)?.rgb.join(',') ?? '200,200,200'})` }} />
                        {colorOf(p.color)?.[lang] ?? p.color} {kindName(p.subcategory)}
                      </span>
                      <span>· {t(`gender_${p.gender}` as Key)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={p.is_demo ? 'neutral' : 'accent'}>{t(p.is_demo ? 'kindDemo' : 'kindReal')}</Pill>
                    {!p.active && <Pill tone="warning">{t('productHidden')}</Pill>}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className={`${action} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
                      <ExternalLink size={13} /> {t('openLink')}
                    </a>
                    {!p.is_demo && (
                      <button onClick={() => openEdit(p)} className={`${action} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
                        <Pencil size={13} /> {t('edit')}
                      </button>
                    )}
                    <button onClick={() => toggle(p)} className={`${action} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
                      {p.active ? <EyeOff size={13} /> : <Eye size={13} />} {t(p.active ? 'hideProduct' : 'showProduct')}
                    </button>
                    {!p.is_demo && (
                      <button onClick={() => remove(p)} className={`${action} bg-card border-red-200 text-red-700 hover:bg-red-50`}>
                        <Trash2 size={13} /> {t('delete')}
                      </button>
                    )}
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
