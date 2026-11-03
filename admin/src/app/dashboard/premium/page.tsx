'use client'
import { useCallback, useEffect, useState } from 'react'
import { Crown, Percent, Users } from 'lucide-react'
import { api, PremiumData } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { Card, Donut, LoadError, Loading, MetricCard, PageHeader } from '@/components/charts'
import { UserDrawer } from '@/components/UserDrawer'
import { UserTable } from '@/components/UserTable'

export default function PremiumPage() {
  const t = useT()
  const [data, setData] = useState<PremiumData | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(() => {
    setFailed(false)
    api.premium().then(setData).catch(() => setFailed(true))
  }, [])

  useEffect(load, [load])

  if (failed) return <LoadError onRetry={load} />
  if (!data) return <Loading />

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('navPremium')} subtitle={t('premiumSubtitle')} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6">
        <MetricCard icon={Crown} label={t('premiumUsers')} value={data.premium} sub={t('priceNote')} />
        <MetricCard icon={Users} label={t('freeUsers')} value={data.free} />
        <MetricCard icon={Percent} label={t('conversion')} value={`${data.conversion}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <Card title={t('plans')}>
          <Donut data={[{ name: 'premium', value: data.premium }, { name: 'free', value: data.free }]}
            label={(n) => (n === 'premium' ? t('premium') : t('free'))} />
        </Card>
        <div className="lg:col-span-2 bg-card rounded-xl border border-slate-200/80 shadow-sm overflow-hidden min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 px-6 pt-6 pb-4">{t('premiumList')}</h2>
          <UserTable rows={data.users} onOpen={setOpen} empty={t('noPremium')} />
        </div>
      </div>

      <UserDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />
    </div>
  )
}
