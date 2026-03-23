import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { mockPilotReports, mockReportTrend } from '../mocks/pilotReports'
import { PaveBadge } from '../components/shared/PaveBadge'
import { getRiskLevel } from '../lib/riskColors'

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open:     { label: 'Open',     className: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
  reviewed: { label: 'Reviewed', className: 'text-green-400 border-green-400/40 bg-green-400/10' },
  nasa_sent:{ label: 'NASA Sent',className: 'text-purple-400 border-purple-400/40 bg-purple-400/10' },
  action:   { label: 'Action',   className: 'text-red-400 border-red-400/40 bg-red-400/10' },
}

/**
 * Trend chart — monthly report counts as a bar chart.
 * High count months are highlighted green (healthy reporting culture).
 */
export function ReportTrendChart({ data }) {
  const avg = data.reduce((s, d) => s + d.count, 0) / data.length

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-lg p-4"
      data-testid="report-trend-chart"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest">
          Reports per Month (12m)
        </h2>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-300">
            This month: <span className="text-green-400 font-mono font-bold">
              {data[data.length - 1].count}
            </span>
          </span>
          <span className="text-slate-500">
            Avg: <span className="font-mono">{avg.toFixed(1)}</span>
          </span>
          <span className="text-green-400">↗ Healthy culture</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.count >= avg ? '#22c55e' : '#334155'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Status chip for a pilot report.
 */
export function ReportStatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

/**
 * Single row in the pilot reports table.
 */
export function PilotReportRow({ report }) {
  return (
    <tr
      className="border-b border-surface-border text-sm hover:bg-white/5 transition-colors"
      data-testid={`report-row-${report.id}`}
    >
      <td className="py-2.5 px-4 font-mono text-slate-400 text-xs">{report.id}</td>
      <td className="py-2.5 px-4 text-slate-400 text-xs font-mono">{report.date}</td>
      <td className="py-2.5 px-4">
        <PaveBadge
          dimension={report.paveCategory}
          score={
            report.paveCategory === 'V' ? 76
            : report.paveCategory === 'P' ? 48
            : report.paveCategory === 'A' ? 22
            : 55
          }
          showLabel
        />
      </td>
      <td className="py-2.5 px-4 text-slate-300">{report.type}</td>
      <td className="py-2.5 px-4 text-slate-400 text-xs max-w-xs truncate">
        {report.title}
      </td>
      <td className="py-2.5 px-4">
        <ReportStatusChip status={report.status} />
      </td>
      <td className="py-2.5 px-4">
        <button
          className="text-xs text-sky-400 border border-sky-400/40 px-2 py-0.5 rounded hover:bg-sky-400/10 transition-colors"
          aria-label={`View report ${report.id}`}
        >
          View →
        </button>
      </td>
    </tr>
  )
}

/**
 * New report wizard trigger button (stub).
 */
export function NewReportButton() {
  return (
    <button
      className="text-sm bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded transition-colors font-semibold"
      aria-label="File a new pilot safety report"
      data-testid="btn-new-report"
    >
      + New Report
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PilotReports() {
  return (
    <div data-testid="page-pilot-reports">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-slate-100 font-bold text-lg">Pilot Safety Reports</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Non-punitive disclosure reporting · NASA ASRS integration
          </p>
        </div>
        <NewReportButton />
      </div>

      <div className="mb-5">
        <ReportTrendChart data={mockReportTrend} />
      </div>

      <section aria-label="Pilot safety report list">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          Recent Reports
        </h2>
        <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full" aria-label="Pilot safety reports">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                <th className="py-2 px-4 text-left font-medium">Report #</th>
                <th className="py-2 px-4 text-left font-medium">Date</th>
                <th className="py-2 px-4 text-left font-medium">PAVE</th>
                <th className="py-2 px-4 text-left font-medium">Type</th>
                <th className="py-2 px-4 text-left font-medium">Title</th>
                <th className="py-2 px-4 text-left font-medium">Status</th>
                <th className="py-2 px-4 text-left font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockPilotReports.map((report) => (
                <PilotReportRow key={report.id} report={report} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Wizard placeholder */}
      <div className="mt-6 p-4 border border-dashed border-surface-border rounded-lg text-center text-slate-500 text-xs">
        5-step pilot report wizard + NASA ASRS form integration — Phase 2
      </div>
    </div>
  )
}
