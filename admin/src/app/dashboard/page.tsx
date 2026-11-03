'use client'
import { useCallback, useEffect, useState } from 'react'
import { Activity, Crown, Layers, Shirt, UserPlus, Users, UserRound, CheckCircle2 } from 'lucide-react'
import { api, Analytics, Stats } from '@/lib/api'
import { useLabel, useT } from '@/lib/i18n'
import { BarList, Card, LoadError, Loading, MetricCard, PageHeader, TrendChart } from '@/components/charts'

export default function DashboardPage() {
  const t = useT()
  const label = useLabel()
  const [stats, setStats] = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setFailed(false)
    Promise.all([api.stats(), api.analytics(30)])
      .then(([s, a]) => {
        setStats(s)
        setAnalytics(a)
      })
      .catch(() => setFailed(true))
  }, [])

  useEffect(load, [load])

  if (failed) return <LoadError onRetry={load} />
  if (!stats || !analytics) return <Loading />

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('navDashboard')} subtitle={t('dashSubtitle')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-5">
        <MetricCard icon={Users} label={t('totalUsers')} value={stats.total_users} sub={`+${stats.new_today} ${t('newToday')}`} />
        <MetricCard icon={UserPlus} label={t('newThisWeek')} value={stats.new_this_week} />
        <MetricCard icon={Activity} label={t('activeUsers')} value={stats.active_users} sub={t('last30Days')} />
        <MetricCard icon={Crown} label={t('premiumUsers')} value={stats.premium_users} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        <MetricCard icon={UserRound} label={t('guests')} value={stats.guests} sub={t('guestsSub')} />
        <MetricCard icon={Shirt} label={t('totalGarments')} value={stats.garments} sub={t('samplesSub', { n: stats.sample_garments })} />
        <MetricCard icon={Layers} label={t('totalOutfits')} value={stats.outfits} sub={t('savedSub', { n: stats.saved_outfits })} />
        <MetricCard icon={CheckCircle2} label={t('totalWears')} value={stats.wears} sub={t('plansSub', { n: stats.plans })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <Card title={t('signupTrend')}>
          <TrendChart series={[{ name: t('signups'), data: analytics.signups }, { name: t('guestVisits'), data: analytics.guests }]} />
        </Card>
        <Card title={t('garmentCategories')}>
          <BarList data={analytics.categories} label={(n) => label('cat', n)} />
        </Card>
      </div>

      <Card title={t('activity')}>
        <TrendChart series={[
          { name: t('looksAsked'), data: analytics.looks },
          { name: t('wears'), data: analytics.wears },
          { name: t('uploads'), data: analytics.uploads },
          { name: t('assistantAsks'), data: analytics.assistant },
        ]} height={260} />
      </Card>
    </div>
  )
}
