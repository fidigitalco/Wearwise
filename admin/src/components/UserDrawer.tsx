'use client'
import { useEffect, useState } from 'react'
import { Ban, Crown, MapPin, Trash2, X } from 'lucide-react'
import { api, UserDetail } from '@/lib/api'
import { useLabel, useLang } from '@/lib/i18n'
import { Pill } from './ui'

export function formatDate(iso: string | null, lang: string, time = false) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(lang === 'az' ? 'az-AZ' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/**
 * One account, sliding in from the right: who they are, how much they use the
 * app (counts only — their closet, outfits and wear history stay private), and
 * the actions an admin takes on an account (plan, block, delete). `onChanged` lets the list behind it refresh.
 */
export function UserDrawer({ id, onClose, onChanged }: {
  id: number | null
  onClose: () => void
  onChanged: () => void
}) {
  const { t, lang } = useLang()
  const label = useLabel()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setUser(null)
    setError('')
    if (id == null) return
    let live = true
    api.user(id).then((u) => { if (live) setUser(u) }).catch((e) => { if (live) setError(String(e.message ?? e)) })
    return () => { live = false }
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (id == null) return null

  const update = (patch: { plan?: 'free' | 'premium'; is_active?: boolean }) => {
    setBusy(true)
    api.updateUser(id, patch)
      .then((u) => { setUser(u); onChanged() })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setBusy(false))
  }

  const remove = () => {
    if (!user) return
    const who = user.email || user.name || `#${user.id}`
    if (!window.confirm(t('deleteConfirm', { who }))) return
    setBusy(true)
    api.deleteUser(id)
      .then(() => { onChanged(); onClose() })
      .catch((e) => { setError(String(e.message ?? e)); setBusy(false) })
  }

  const counts = user ? [
    [t('countGarments'), user.counts.garments],
    [t('countSaved'), user.counts.saved],
    [t('countWears'), user.counts.wears],
    [t('countPlans'), user.counts.plans],
    [t('countLooks'), user.counts.looks_asked],
    [t('countAssistant'), user.counts.assistant],
    [t('countOutfits'), user.counts.outfits],
    [t('countScans'), user.counts.scans],
  ] as const : []

  const button = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/30" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card border-l border-slate-200 shadow-xl flex flex-col">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{user ? user.name || t('noName') : '…'}</div>
            <div className="text-xs text-slate-500 truncate">{user ? (user.is_guest ? t('guest') : user.email) : ''}</div>
          </div>
          <button onClick={onClose} aria-label={t('close')}
            className="w-9 h-9 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
          {!user && !error && <div className="text-sm text-slate-400">{t('loading')}</div>}
          {user && (
            <>
              <div className="flex flex-wrap gap-2">
                <Pill tone={user.plan === 'premium' ? 'accent' : 'neutral'}>{user.plan === 'premium' ? t('premium') : t('free')}</Pill>
                <Pill>{label('method', user.provider)}</Pill>
                {!user.is_active && <Pill tone="danger">{t('blocked')}</Pill>}
                {!user.onboarded && <Pill tone="warning">{t('notOnboarded')}</Pill>}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field term={t('joined')} value={formatDate(user.date_joined, lang)} />
                <Field term={t('lastActive')} value={user.last_active ? formatDate(user.last_active, lang, true) : t('never')} />
                <Field term={t('style')} value={user.style_direction.replace(/_/g, ' ')} />
                <Field term={t('occasion')} value={user.main_occasion.replace(/_/g, ' ')} />
                {user.location && (
                  <Field term={t('location')} value={
                    <a className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-700 hover:underline" target="_blank" rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${user.location[0]}&mlon=${user.location[1]}#map=11/${user.location[0]}/${user.location[1]}`}>
                      <MapPin size={12} /> {user.location[0].toFixed(2)}, {user.location[1].toFixed(2)}
                    </a>
                  } />
                )}
              </dl>

              <div className="grid grid-cols-4 gap-2">
                {counts.map(([name, n]) => (
                  <div key={name} className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2.5">
                    <div className="text-lg font-semibold tabular-nums text-slate-900">{n}</div>
                    <div className="text-[11px] text-slate-500 leading-tight">{name}</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400">{t('privacyNote')}</p>
            </>
          )}
        </div>

        {user && (
          <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-slate-200 shrink-0">
            {!user.is_guest && (
              <button disabled={busy} onClick={() => update({ plan: user.plan === 'premium' ? 'free' : 'premium' })}
                className={`${button} bg-indigo-600 border-indigo-600 text-white hover:brightness-90`}>
                <Crown size={14} /> {user.plan === 'premium' ? t('makeFree') : t('makePremium')}
              </button>
            )}
            <button disabled={busy} onClick={() => update({ is_active: !user.is_active })}
              className={`${button} bg-card border-slate-200 text-slate-700 hover:bg-slate-100`}>
              <Ban size={14} /> {user.is_active ? t('block') : t('unblock')}
            </button>
            <button disabled={busy} onClick={remove}
              className={`${button} ml-auto bg-card border-red-200 text-red-700 hover:bg-red-50`}>
              <Trash2 size={14} /> {t('deleteUser')}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

function Field({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{term}</dt>
      <dd className="text-slate-900 capitalize truncate">{value}</dd>
    </div>
  )
}
