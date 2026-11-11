'use client'
import { useCallback, useEffect, useState } from 'react'
import { api, Analytics } from '@/lib/api'
import { useLabel, useLang, type Key } from '@/lib/i18n'
import { countryName, flag, sourceName } from '@/components/ui'
import { BarList, Card, Donut, LoadError, Loading, PageHeader, TrendChart } from '@/components/charts'

const RANGES = [7, 30, 90] as const

export default function AnalyticsPage() {
  const { t, lang } = useLang()
  const label = useLabel()
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setFailed(false)
    api.analytics(days).then(setData).catch(() => setFailed(true))
  }, [days])

  useEffect(load, [load])

  if (failed) return <LoadError onRetry={load} />
  if (!data) return <Loading />

  const words = (n: string) => n.replace(/_/g, ' ')
  const state = (n: string) => (n === 'active' ? t('active') : n === 'inactive' ? t('inactive') : n)
  const plan = (n: string) => (n === 'premium' ? t('premium') : t('free'))
  const reaction = (n: string) => (n === 'liked' ? t('liked') : t('disliked'))
  const special = (n: string) => (n === 'unknown' ? t('unknown') : n === 'other' ? t('other') : null)
  const platform = (n: string) => special(n) ?? t(`platform_${n}` as Key)
  const version = (n: string) => special(n) ?? `v${n}`
  const country = (n: string) => special(n) ?? `${flag(n)} ${countryName(n, lang)}`
  const source = (n: string) => special(n) ?? sourceName(n)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('navAnalytics')}
        subtitle={t('analyticsSubtitle')}
        right={
          <div className="inline-flex rounded-lg border border-slate-200 bg-card p-0.5">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  days === r ? 'bg-indigo-50 text-indigo-600 dark:text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                {t('days', { n: r })}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        <Stat label={t('totalUsers')} value={data.total} />
        <Stat label={t('onboarded')} value={data.onboarded} sub={data.total ? `${Math.round((data.onboarded / data.total) * 100)}%` : undefined} />
        <Stat label={t('avgGarments')} value={data.avg_garments} />
        <Stat label={t('activeUsers')} value={data.active_inactive[0]?.value ?? 0} sub={t('last30Days')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <Card title={t('signups')}>
          <TrendChart series={[{ name: t('signups'), data: data.signups }, { name: t('guestVisits'), data: data.guests }]} />
        </Card>
        <Card title={t('looksAsked')}>
          <TrendChart series={[{ name: t('looksAsked'), data: data.looks }, { name: t('assistantAsks'), data: data.assistant }]} />
        </Card>
        <Card title={t('wears')}>
          <TrendChart series={[{ name: t('wears'), data: data.wears }, { name: t('uploads'), data: data.uploads }]} />
        </Card>
        <Card title={t('affiliateClicks')}>
          {data.stores.length
            ? <TrendChart series={[{ name: t('affiliateClicks'), data: data.clicks }]} />
            : <div className="py-10 text-center text-sm text-slate-400">{t('noData')}</div>}
          {data.stores.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">{data.stores.map((x) => `${x.name}: ${x.value}`).join(' · ')}</p>
          )}
        </Card>
        <Card title={t('garmentCategories')}>
          <BarList data={data.categories} label={(n) => label('cat', n)} />
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-6">
        <Card title={t('activeInactive')}><Donut data={data.active_inactive} label={state} /></Card>
        <Card title={t('signInMethods')}><Donut data={data.providers} label={(n) => label('method', n)} /></Card>
        <Card title={t('plans')}><Donut data={data.plans} label={plan} /></Card>
        <Card title={t('feedback')}><Donut data={data.feedback} label={reaction} /></Card>
        <Card title={t('styles')}><Donut data={data.styles} label={words} /></Card>
        <Card title={t('occasions')}><Donut data={data.occasions} label={words} /></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-6">
        <Card title={t('platforms')}><Donut data={data.platforms} label={platform} /></Card>
        <Card title={t('versions')}><BarList data={data.versions} label={version} /></Card>
        <Card title={t('installSources')}>
          {data.install_sources.length
            ? <Donut data={data.install_sources} label={source} />
            : <div className="py-10 text-center text-sm text-slate-400">{t('noData')}</div>}
        </Card>
        <Card title={t('deviceCountries')}>
          <BarList data={data.device_countries} label={country} horizontal height={Math.max(160, data.device_countries.length * 30)} />
        </Card>
        <Card title={t('ipCountries')}>
          <BarList data={data.ip_countries} label={country} horizontal height={Math.max(160, data.ip_countries.length * 30)} />
        </Card>
      </div>
      <p className="text-xs text-slate-400 -mt-3 mb-6">{t('clientInfoNote')}</p>

      <Card title={t('colors')}>
        <BarList data={data.colors} label={words} horizontal height={Math.max(160, data.colors.length * 30)} />
      </Card>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}
