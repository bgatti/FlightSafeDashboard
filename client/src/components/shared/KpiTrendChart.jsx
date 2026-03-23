import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

/**
 * KPI trend line chart with year-over-year comparison overlay.
 * Shows "this year" vs "last year" on the same axis.
 *
 * @param {object} kpiData - One entry from mockKpiTimeSeries:
 *   { labels, thisYear, lastYear, label, unit, lowerIsBetter }
 * @param {number} [target] - Optional target reference line value
 * @param {string} [className]
 */
export function KpiTrendChart({ kpiData, target, className = '' }) {
  if (!kpiData) return null

  const chartData = kpiData.labels.map((month, i) => ({
    month,
    'This Year': kpiData.thisYear[i],
    'Last Year': kpiData.lastYear[i],
  }))

  const latest = kpiData.thisYear[kpiData.thisYear.length - 1]
  const prev   = kpiData.lastYear[kpiData.lastYear.length - 1]
  const delta  = latest - prev
  const improved = kpiData.lowerIsBetter ? delta < 0 : delta > 0
  const deltaStr = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)

  return (
    <div
      className={`bg-surface-card border border-surface-border rounded-lg p-4 ${className}`}
      data-testid="kpi-trend-chart"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-slate-300 text-xs font-semibold">{kpiData.label}</h3>
          <p className="text-slate-500 text-xs mt-0.5">vs same period last year</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-lg font-bold text-slate-100">
            {latest}{kpiData.unit === '%' ? '%' : ''}
          </span>
          <span
            className={`ml-2 text-xs font-semibold ${improved ? 'text-green-400' : 'text-red-400'}`}
            aria-label={`Year-over-year change: ${deltaStr}${kpiData.unit}`}
          >
            {improved ? '▲' : '▼'} {deltaStr}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
            formatter={(value) => (
              <span style={{ color: value === 'This Year' ? '#38bdf8' : '#64748b' }}>
                {value}
              </span>
            )}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label={{ value: 'Target', fill: '#f59e0b', fontSize: 10, position: 'right' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Last Year"
            stroke="#475569"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          <Line
            type="monotone"
            dataKey="This Year"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={{ fill: '#38bdf8', r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
