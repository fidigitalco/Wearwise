'use client'
import { Users } from 'lucide-react'
import type { UserRow } from '@/lib/api'
import { useLabel, useLang } from '@/lib/i18n'
import { EmptyIcon, Pill } from './ui'
import { formatDate } from './UserDrawer'

/** The accounts table both the users and premium pages draw; a row opens that user. */
export function UserTable({ rows, onOpen, empty }: { rows: UserRow[]; onOpen: (id: number) => void; empty?: string }) {
  const { t, lang } = useLang()
  const label = useLabel()
  if (!rows.length) {
    return (
      <div className="py-16 text-center">
        <EmptyIcon icon={Users} />
        <div className="text-sm text-slate-500">{empty ?? t('noUsers')}</div>
      </div>
    )
  }
  const th = 'px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/60">
          <tr>
            <th className={th}>{t('colUser')}</th>
            <th className={th}>{t('colMethod')}</th>
            <th className={th}>{t('colPlan')}</th>
            <th className={`${th} text-right`}>{t('colCloset')}</th>
            <th className={`${th} text-right`}>{t('colOutfits')}</th>
            <th className={`${th} text-right`}>{t('colWears')}</th>
            <th className={th}>{t('colJoined')}</th>
            <th className={th}>{t('colStatus')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((u) => (
            <tr key={u.id} onClick={() => onOpen(u.id)} className="cursor-pointer hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 dark:text-indigo-700 grid place-items-center text-xs font-semibold shrink-0">
                    {(u.name || u.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate max-w-[220px]">{u.name || t('noName')}</div>
                    <div className="text-xs text-slate-500 truncate max-w-[220px]">{u.is_guest ? t('guest') : u.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3"><Pill>{label('method', u.provider)}</Pill></td>
              <td className="px-4 py-3">
                <Pill tone={u.plan === 'premium' ? 'accent' : 'neutral'}>{u.plan === 'premium' ? t('premium') : t('free')}</Pill>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{u.garments}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{u.outfits}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">{u.wears}</td>
              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(u.date_joined, lang)}</td>
              <td className="px-4 py-3">
                {u.is_active ? <Pill tone="success">{t('active')}</Pill> : <Pill tone="danger">{t('blocked')}</Pill>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
