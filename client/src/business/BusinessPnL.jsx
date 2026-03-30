// =============================================================================
// Business P&L — Revenue, KPIs, and Forecast across all business units
// Business units: Fuel Sales | Maintenance | Ground Services | Training
// Data comes from mockBusiness.js (programmatically generated from FBO sim)
// =============================================================================

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceArea, CartesianGrid, Cell,
} from 'recharts'
import {
  mockMonthly, mockKpiSeries,
  SKU_LIST, BU_LIST, BU_COLORS, SKU_COLORS, SEASONAL_IDX, MONTHS,
} from './mockBusiness'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1000) return '$' + Math.round(n / 1000 * 10) / 10 + 'k'
  return '$' + Math.round(n).toLocaleString()
}

function fmtPct(n, decimals = 1) {
  if (n == null) return '—'
  return n.toFixed(decimals) + '%'
}

function fmtDelta(pct) {
  if (pct == null) return null
  const sign = pct >= 0 ? '+' : ''
  return { text: sign + pct.toFixed(1) + '%', positive: pct >= 0 }
}

function addMonths(yyyyMM, n) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Period definitions ────────────────────────────────────────────────────────
// Current: Mar 2026 = index 14; "prior" = same period one year or quarter back
const PERIOD_OPTS = [
  { id: 'mtd', label: 'MTD',  cur: [14, 14],  prior: [13, 13] },    // Mar vs Feb
  { id: 'qtd', label: 'QTD',  cur: [12, 14],  prior: [9, 11]  },    // Q1 2026 vs Q4 2025
  { id: 'ytd', label: 'YTD',  cur: [12, 14],  prior: [0, 2]   },    // Jan-Mar 2026 vs Jan-Mar 2025
  { id: 't12', label: 'T12M', cur: [3, 14],   prior: null     },    // Apr 2025 – Mar 2026
]

function sliceMonthly(idxRange) {
  const [a, b] = idxRange
  return mockMonthly.slice(a, b + 1)
}

function sumPeriod(months) {
  return months.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.totalRevenue,
      cogs:    acc.cogs    + m.totalCogs,
      gp:      acc.gp      + m.grossProfit,
      budget:  acc.budget  + m.budget,
    }),
    { revenue: 0, cogs: 0, gp: 0, budget: 0 }
  )
}

function sumPeriodBySku(months, skuId) {
  return months.reduce(
    (acc, m) => ({
      revenue: acc.revenue + (m.skus[skuId]?.revenue ?? 0),
      cogs:    acc.cogs    + (m.skus[skuId]?.cogs    ?? 0),
    }),
    { revenue: 0, cogs: 0 }
  )
}

// ── Forecast math ─────────────────────────────────────────────────────────────
// 1. Compute seasonal indices from historical data
// 2. Deseasonalize → linear regression → re-seasonalize for projection
function buildForecast(series, horizon = 6) {
  const n = series.length
  const byMM = {}
  series.forEach(d => {
    const mm = d.month.slice(5, 7)
    if (!byMM[mm]) byMM[mm] = []
    byMM[mm].push(d.totalRevenue)
  })
  const overallMean = series.reduce((s, d) => s + d.totalRevenue, 0) / n
  const sIdx = {}
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const vals = byMM[mm] ?? [overallMean]
    sIdx[mm] = (vals.reduce((s, v) => s + v, 0) / vals.length) / overallMean
  }

  // Linear regression on deseasonalized data
  const ds = series.map((d, i) => {
    const mm = d.month.slice(5, 7)
    return { x: i, y: d.totalRevenue / (sIdx[mm] || 1) }
  })
  const sumX  = ds.reduce((s, d) => s + d.x, 0)
  const sumY  = ds.reduce((s, d) => s + d.y, 0)
  const sumXY = ds.reduce((s, d) => s + d.x * d.y, 0)
  const sumX2 = ds.reduce((s, d) => s + d.x * d.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intcpt = (sumY - slope * sumX) / n

  const residuals = ds.map(d => d.y - (slope * d.x + intcpt))
  const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / n)

  const lastMonth = series[n - 1].month
  const forecasts = []
  for (let h = 1; h <= horizon; h++) {
    const xi  = n - 1 + h
    const fut = addMonths(lastMonth, h)
    const mm  = fut.slice(5, 7)
    const si  = sIdx[mm] || 1
    const tv  = slope * xi + intcpt
    const fc  = Math.round(tv * si)
    const ci  = Math.round(rmse * si * 1.645)
    const [y, mo] = fut.split('-').map(Number)
    const label = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo - 1] + " '" + String(y).slice(2)
    forecasts.push({ month: fut, label, forecast: fc, low: Math.max(0, fc - ci), high: fc + ci })
  }
  return { forecasts, sIdx, slope, intcpt }
}

// ── Shared UI components ──────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">{children}</h3>
}

function KpiTile({ label, value, sub, subPositive }) {
  const subColor = subPositive === true ? 'text-emerald-400' : subPositive === false ? 'text-red-400' : 'text-slate-500'
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-3 text-center min-w-[120px]">
      <p className="font-mono font-bold text-xl text-slate-100">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  )
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-surface-border mb-4">
      {tabs.map((t, i) => (
        <button
          key={t}
          onClick={() => onChange(i)}
          className={[
            'px-4 py-2 text-sm transition-colors border-b-2 -mb-px',
            i === active
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-100',
          ].join(' ')}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
  color: '#f1f5f9',
  fontSize: 12,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BusinessPnL() {
  const [tab,     setTab]    = useState(0)
  const [period,  setPeriod] = useState('ytd')
  const [buFilter, setBu]   = useState('all')
  const [top8,    setTop8]   = useState(true)

  const periodOpt = PERIOD_OPTS.find(p => p.id === period)

  // Aggregate selected period
  const curMonths   = useMemo(() => sliceMonthly(periodOpt.cur), [period])
  const priorMonths = useMemo(() => periodOpt.prior ? sliceMonthly(periodOpt.prior) : null, [period])
  const curSum      = useMemo(() => sumPeriod(curMonths),   [curMonths])
  const priorSum    = useMemo(() => priorMonths ? sumPeriod(priorMonths) : null, [priorMonths])

  const revDelta    = priorSum ? fmtDelta(((curSum.revenue - priorSum.revenue) / priorSum.revenue) * 100) : null
  const budgetDelta = fmtDelta(((curSum.revenue - curSum.budget) / curSum.budget) * 100)
  const marginPct   = Math.round((curSum.gp / curSum.revenue) * 1000) / 10

  // BU breakdown for selected period
  const buBreakdown = useMemo(() => {
    return BU_LIST.map(bu => {
      const buSkus = SKU_LIST.filter(s => s.bu === bu)
      const rev  = buSkus.reduce((s, sku) => s + sumPeriodBySku(curMonths, sku.id).revenue, 0)
      const cogs = buSkus.reduce((s, sku) => s + sumPeriodBySku(curMonths, sku.id).cogs, 0)
      const gp   = rev - cogs
      return { bu, rev, cogs, gp, margin: rev ? Math.round((gp / rev) * 1000) / 10 : 0 }
    })
  }, [curMonths])

  // SKU breakdown for selected period (top8 mode rolls gpu + other_svcs)
  const skuRows = useMemo(() => {
    const top8Ids = SKU_LIST.slice(0, 8).map(s => s.id)
    const allRows = SKU_LIST.map(sku => {
      const { revenue, cogs } = sumPeriodBySku(curMonths, sku.id)
      const gp = revenue - cogs
      const priorRev = priorMonths ? sumPeriodBySku(priorMonths, sku.id).revenue : null
      const delta = priorRev ? fmtDelta(((revenue - priorRev) / priorRev) * 100) : null
      return { ...sku, revenue, cogs, gp, margin: revenue ? Math.round((gp / revenue) * 1000) / 10 : 0, delta }
    }).sort((a, b) => b.revenue - a.revenue)

    if (!top8) return allRows

    const top  = allRows.filter(r => top8Ids.includes(r.id))
    const rest = allRows.filter(r => !top8Ids.includes(r.id))
    if (!rest.length) return top
    const otherRev  = rest.reduce((s, r) => s + r.revenue, 0)
    const otherCogs = rest.reduce((s, r) => s + r.cogs, 0)
    const otherGp   = otherRev - otherCogs
    top.push({
      id: '__other__', label: 'Other Services', bu: 'Ground Services',
      revenue: otherRev, cogs: otherCogs, gp: otherGp,
      margin: otherRev ? Math.round((otherGp / otherRev) * 1000) / 10 : 0, delta: null,
    })
    return top
  }, [curMonths, priorMonths, top8])

  // Chart data: last 13 months for overview area chart
  const areaData = useMemo(() => mockMonthly.slice(2).map(m => {
    const row = { month: m.label }
    BU_LIST.forEach(bu => {
      const buSkus = SKU_LIST.filter(s => s.bu === bu)
      row[bu] = buSkus.reduce((s, sku) => s + (m.skus[sku.id]?.revenue ?? 0), 0)
    })
    row.budget = m.budget
    return row
  }), [])

  // Forecast
  const { forecasts, sIdx } = useMemo(() => buildForecast(mockMonthly), [])

  const forecastChartData = useMemo(() => {
    const hist = mockMonthly.slice(3).map(m => ({
      label: m.label, actual: m.totalRevenue, forecast: null, low: null, high: null,
    }))
    const fwd = forecasts.map(f => ({
      label: f.label, actual: null, forecast: f.forecast, low: f.low, high: f.high,
    }))
    return [...hist, ...fwd]
  }, [forecasts])

  const seasonalChartData = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months.map((m, i) => {
      const mm = String(i + 1).padStart(2, '0')
      return { month: m, index: Math.round((sIdx[mm] ?? 1) * 100) }
    })
  }, [sIdx])

  // Filtered rows for SKU bar chart
  const filteredSkuRows = useMemo(
    () => skuRows.filter(r => buFilter === 'all' || r.bu === buFilter),
    [skuRows, buFilter]
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100 font-semibold text-lg">Business P&L</h1>
          <p className="text-slate-500 text-xs mt-0.5">FBO · Maintenance · Ground Services · Training</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1">
          {PERIOD_OPTS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={[
                'px-3 py-1.5 text-xs rounded border transition-colors',
                period === p.id
                  ? 'bg-sky-400/10 border-sky-400 text-sky-400'
                  : 'border-surface-border text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex gap-3 flex-wrap">
        <KpiTile
          label="Revenue"
          value={fmt$(curSum.revenue)}
          sub={revDelta ? revDelta.text + ' vs prior' : undefined}
          subPositive={revDelta?.positive}
        />
        <KpiTile
          label="vs Budget"
          value={budgetDelta.text}
          sub={fmt$(curSum.budget) + ' budget'}
          subPositive={budgetDelta.positive}
        />
        <KpiTile
          label="Gross Profit"
          value={fmt$(curSum.gp)}
          sub={fmtPct(marginPct) + ' margin'}
          subPositive={marginPct > 35}
        />
        <KpiTile
          label="COGS"
          value={fmt$(curSum.cogs)}
          sub={fmtPct(100 - marginPct) + ' of revenue'}
          subPositive={undefined}
        />
      </div>

      {/* Tabs */}
      <TabBar
        tabs={['Overview', 'Revenue by SKU', 'KPIs', 'Forecast']}
        active={tab}
        onChange={setTab}
      />

      {/* ── Tab 0: Overview ─────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-lg p-4">
            <SectionTitle>Monthly Revenue by Business Unit (13 months)</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={areaData} margin={{ top: 4, right: 8, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmt$(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {BU_LIST.map(bu => (
                  <Area key={bu} type="monotone" dataKey={bu} stackId="1"
                    fill={BU_COLORS[bu]} stroke={BU_COLORS[bu]} fillOpacity={0.7} />
                ))}
                <Line type="monotone" dataKey="budget" stroke="#f59e0b" strokeDasharray="4 4"
                  strokeWidth={1.5} dot={false} name="Budget" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* P&L summary table */}
          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Business Unit</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Revenue</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">COGS</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Gross Profit</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {buBreakdown.map(row => (
                  <tr key={row.bu} className="border-b border-surface-border/50 hover:bg-white/5">
                    <td className="px-4 py-2 text-slate-100 flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: BU_COLORS[row.bu] }} />
                      {row.bu}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-100">{fmt$(row.rev)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-400">{fmt$(row.cogs)}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400">{fmt$(row.gp)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300">{fmtPct(row.margin)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="bg-white/5">
                  <td className="px-4 py-2 text-slate-100 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-sky-400">{fmt$(curSum.revenue)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-400">{fmt$(curSum.cogs)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-400">{fmt$(curSum.gp)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-300">{fmtPct(marginPct)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 1: Revenue by SKU ──────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              {/* BU filter */}
              <select
                value={buFilter}
                onChange={e => setBu(e.target.value)}
                className="bg-surface-card border border-surface-border text-slate-300 text-xs rounded px-2 py-1.5"
              >
                <option value="all">All Business Units</option>
                {BU_LIST.map(bu => <option key={bu} value={bu}>{bu}</option>)}
              </select>
            </div>
            {/* Top 8 toggle */}
            <button
              onClick={() => setTop8(t => !t)}
              className={[
                'text-xs px-3 py-1.5 rounded border transition-colors',
                top8
                  ? 'bg-sky-400/10 border-sky-400 text-sky-400'
                  : 'border-surface-border text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {top8 ? 'Top 8 SKUs' : 'All SKUs'}
            </button>
          </div>

          {/* Horizontal bar chart */}
          <div className="bg-surface-card border border-surface-border rounded-lg p-4">
            <SectionTitle>Revenue by SKU — {periodOpt.label}</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(filteredSkuRows.length * 32, 200)}>
              <BarChart
                data={filteredSkuRows}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 120, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} width={115} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmt$(v), n]} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 3, 3, 0]}
                  label={{ position: 'right', formatter: fmt$, fill: '#94a3b8', fontSize: 11 }}>
                  {filteredSkuRows.map(row => (
                    <Cell key={row.id} fill={SKU_COLORS[row.id] ?? '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detail table */}
          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">SKU</th>
                  <th className="text-left px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Unit</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Revenue</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">COGS</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Margin</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">vs Prior</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkuRows.map(row => (
                  <tr key={row.id} className="border-b border-surface-border/50 hover:bg-white/5">
                    <td className="px-4 py-2 text-slate-100 flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: SKU_COLORS[row.id] ?? '#64748b' }} />
                      {row.label}
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{row.bu}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-100">{fmt$(row.revenue)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-400">{fmt$(row.cogs)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-300">{fmtPct(row.margin)}</td>
                    <td className={`px-4 py-2 text-right font-mono text-xs ${!row.delta ? 'text-slate-600' : row.delta.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.delta ? row.delta.text : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: KPIs ───────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'revPerVisit',    label: 'Revenue per Visit',     fmt: fmt$,    color: '#38bdf8' },
            { key: 'grossMarginPct', label: 'Gross Margin %',        fmt: v => fmtPct(v, 1), color: '#34d399' },
            { key: 'avgTicket',      label: 'Avg Transaction Value', fmt: fmt$,    color: '#a78bfa' },
            { key: 'rampUtilPct',    label: 'Ramp Utilization %',    fmt: v => fmtPct(v, 0), color: '#fb923c' },
          ].map(({ key, label, fmt: fmtFn, color }) => {
            const latest = mockKpiSeries[mockKpiSeries.length - 1]
            const prev   = mockKpiSeries[mockKpiSeries.length - 2]
            const delta  = fmtDelta(((latest[key] - prev[key]) / prev[key]) * 100)
            return (
              <div key={key} className="bg-surface-card border border-surface-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <SectionTitle>{label}</SectionTitle>
                  <span className={`text-xs font-mono ${delta.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {delta.text} MoM
                  </span>
                </div>
                <p className="font-mono font-bold text-xl text-slate-100 mb-2">{fmtFn(latest[key])}</p>
                <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={mockKpiSeries} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtFn(v), label]} />
                    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2}
                      dot={false} activeDot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab 3: Forecast ───────────────────────────────────────────────── */}
      {tab === 3 && (
        <div className="space-y-4">
          {/* Main forecast chart */}
          <div className="bg-surface-card border border-surface-border rounded-lg p-4">
            <SectionTitle>Revenue Forecast — Trend + Seasonal (6-month outlook)</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={forecastChartData} margin={{ top: 4, right: 16, left: 48, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={1} />
                <YAxis tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [fmt$(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                {/* CI band */}
                <ReferenceArea
                  x1={forecastChartData.find(d => d.forecast != null)?.label}
                  x2={forecastChartData[forecastChartData.length - 1]?.label}
                  fill="#f59e0b" fillOpacity={0.07}
                />
                <Line type="monotone" dataKey="actual"   name="Actual"   stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#f59e0b' }} connectNulls={false} />
                <Line type="monotone" dataKey="high"     name="CI High"  stroke="#f59e0b" strokeWidth={1} strokeDasharray="2 4" dot={false} opacity={0.5} />
                <Line type="monotone" dataKey="low"      name="CI Low"   stroke="#f59e0b" strokeWidth={1} strokeDasharray="2 4" dot={false} opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Seasonal index */}
          <div className="bg-surface-card border border-surface-border rounded-lg p-4">
            <SectionTitle>Seasonal Index (derived from 15-month history — Apr = 1.00 baseline)</SectionTitle>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={seasonalChartData} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[60, 140]} tickFormatter={v => v + '%'} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v + '%', 'Seasonal Index']} />
                <ReferenceLine y={100} stroke="#64748b" strokeDasharray="4 4" />
                <Bar dataKey="index" name="Index" radius={[2, 2, 0, 0]}
                  fill="#38bdf8" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast table */}
          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Month</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Forecast</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">Low (90% CI)</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">High (90% CI)</th>
                  <th className="text-right px-4 py-2 text-slate-400 text-xs uppercase tracking-wider font-medium">CI Range</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map(f => (
                  <tr key={f.month} className="border-b border-surface-border/50 hover:bg-white/5">
                    <td className="px-4 py-2 text-slate-100 font-medium">{f.label}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-400 font-semibold">{fmt$(f.forecast)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-400">{fmt$(f.low)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-400">{fmt$(f.high)}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500 text-xs">±{fmt$(f.high - f.forecast)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
