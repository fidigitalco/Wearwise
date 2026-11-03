'use client'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import type { ChartPoint, TrendData } from '@/lib/api'
import { useChartColors } from '@/lib/chartColors'
import { useT } from '@/lib/i18n'
import { EmptyIcon, IconTile } from './ui'

/** The page's title and one line under it, with optional controls on the right. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Loading() {
  const t = useT()
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-slate-400 text-sm">{t('loading')}</div>
    </div>
  )
}

export function LoadError({ onRetry }: { onRetry?: () => void }) {
  const t = useT()
  return (
    <div className="p-8">
      <div className="bg-card rounded-xl border border-slate-200/80 p-10 text-center shadow-sm">
        <EmptyIcon icon={AlertTriangle} />
        <div className="text-sm font-medium text-slate-900">{t('loadFailed')}</div>
        <div className="text-xs text-slate-500 mt-1">{t('checkConnection')}</div>
        {onRetry && (
          <button onClick={onRetry} className="mt-4 text-xs font-medium text-indigo-600 dark:text-indigo-700 hover:underline">
            {t('retry')}
          </button>
        )}
      </div>
    </div>
  )
}

export function MetricCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: LucideIcon }) {
  return (
    <div className="bg-card rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <IconTile icon={icon} />
      </div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums -mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-xl border border-slate-200/80 p-6 shadow-sm min-w-0 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function NoData({ height }: { height: number }) {
  const t = useT()
  return <div className="grid place-items-center text-xs text-slate-400" style={{ height }}>{t('noData')}</div>
}

/** One or more daily series on shared dates; the first series is the accent, the rest lighter shades. */
export function TrendChart({ series, height = 220 }: { series: { name: string; data: TrendData }[]; height?: number }) {
  const chart = useChartColors()
  const labels = series[0]?.data.labels ?? []
  const rows = labels.map((label, i) => Object.fromEntries([['label', label], ...series.map((s) => [s.name, s.data.data[i] ?? 0])]))
  const empty = series.every((s) => s.data.data.every((v) => !v))
  if (empty) return <NoData height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.tick }} interval="preserveStartEnd" minTickGap={24}
          tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: chart.tick }} allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, ...chart.tooltip }} cursor={{ stroke: chart.cursor }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Line key={s.name} type="monotone" dataKey={s.name} name={s.name}
            stroke={i === 0 ? chart.primary : chart.series[(i + 2) % chart.series.length]}
            strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Categories as bars in shades of the one accent; `label` turns raw names into words. */
export function BarList({ data, label = (n) => n, height = 220, horizontal = false }: {
  data: ChartPoint[]
  label?: (name: string) => string
  height?: number
  horizontal?: boolean
}) {
  const t = useT()
  const chart = useChartColors()
  const rows = data.map((d) => ({ ...d, name: label(d.name) }))
  if (!rows.some((r) => r.value)) return <NoData height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} barSize={horizontal ? 14 : 28} layout={horizontal ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: chart.tick }} allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: chart.tick }} tickLine={false} axisLine={false} width={96} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: chart.tick }} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: chart.tick }} allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          </>
        )}
        <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, ...chart.tooltip }} cursor={{ fill: chart.grid }} />
        <Bar dataKey="value" name={t('chartCount')} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
          {rows.map((_, i) => <Cell key={i} fill={chart.series[i % chart.series.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** A donut with the numbers listed beside it. */
export function Donut({ data, label = (n) => n, height = 180 }: { data: ChartPoint[]; label?: (name: string) => string; height?: number }) {
  const chart = useChartColors()
  const total = data.reduce((a, d) => a + d.value, 0)
  if (!total) return <NoData height={height} />
  const colors = data.length === 2 ? [chart.primary, chart.rest] : chart.series
  return (
    <div className="flex items-center gap-6">
      <div className="w-40 shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={1} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, ...chart.tooltip }}
              formatter={(v: number, n: string) => [v, label(n)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 min-w-0 space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="flex-1 truncate text-slate-600">{label(d.name)}</span>
            <span className="tabular-nums font-medium text-slate-900">{d.value}</span>
            <span className="tabular-nums text-xs text-slate-400 w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
