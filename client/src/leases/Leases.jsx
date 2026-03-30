// =============================================================================
// Aircraft Leases — per-aircraft lease relationships
// Shows: lease terms, program hours utilization, maintenance reserve ledger,
//        engine reserve ledger (turboprops), and itemized debit history
// =============================================================================

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  ReferenceLine,
} from 'recharts'
import {
  mockLeases,
  LEASE_MONTHS,
  LEASE_TYPE_LABELS,
  LEASE_TYPE_COLORS,
  DEBIT_CATEGORIES,
} from './mockLeases'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (Math.abs(n) >= 1_000)    return '$' + Math.round(n / 1000 * 10) / 10 + 'k'
  return '$' + Math.round(n).toLocaleString()
}

function fmtHrs(n) {
  if (n == null) return '—'
  return n.toLocaleString() + ' hrs'
}

function fmtPct(n) {
  if (n == null) return '—'
  return Math.round(n) + '%'
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
  color: '#f1f5f9',
  fontSize: 12,
}

// ── Shared components ─────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
      {children}
    </h3>
  )
}

function KpiTile({ label, value, sub, subColor = 'text-slate-500', highlight }) {
  return (
    <div className={`bg-surface-card border rounded-lg p-3 text-center min-w-[130px] flex-1 ${
      highlight ? 'border-sky-400/40' : 'border-surface-border'
    }`}>
      <p className={`font-mono font-bold text-xl ${highlight ? 'text-sky-400' : 'text-slate-100'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  )
}

// ── Reserve Ledger (reused for both mx and engine reserve) ────────────────────

function ReserveLedger({ title, reservePerHr, monthlyFlown, debits, color, suspended }) {
  // Build running balance per month
  const chartData = useMemo(() => {
    let cumulativeAccrued = 0
    let cumulativeDebited = 0

    return LEASE_MONTHS.map((m, i) => {
      cumulativeAccrued += (monthlyFlown[i] ?? 0) * reservePerHr
      // Apply debits that fall in this month
      const monthDebits = debits.filter(d => d.yearMonth === m.key && !d.aogEvent)
      cumulativeDebited += monthDebits.reduce((s, d) => s + d.total, 0)
      const balance = cumulativeAccrued - cumulativeDebited
      return {
        month: m.label,
        accrued: Math.round(cumulativeAccrued),
        debited: Math.round(cumulativeDebited),
        balance: Math.round(balance),
      }
    })
  }, [reservePerHr, monthlyFlown, debits])

  const totalAccrued  = chartData[chartData.length - 1]?.accrued  ?? 0
  const totalDebited  = chartData[chartData.length - 1]?.debited  ?? 0
  const currentBalance = totalAccrued - totalDebited
  const activeDebits  = debits.filter(d => !d.aogEvent)

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>{title}</SectionTitle>
        <div className="flex gap-4 text-xs text-slate-400">
          <span>Accrued: <span className="text-emerald-400 font-mono">{fmt$(totalAccrued)}</span></span>
          <span>Debited: <span className="text-red-400 font-mono">{fmt$(totalDebited)}</span></span>
          <span>Balance: <span className={`font-mono font-bold ${currentBalance >= 0 ? 'text-sky-400' : 'text-red-400'}`}>{fmt$(currentBalance)}</span></span>
        </div>
      </div>

      {suspended ? (
        <div className="text-center text-slate-500 text-sm py-8">
          Lease suspended — accrual paused
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v)} width={50} />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v, n) => [fmt$(v), n === 'balance' ? 'Net Balance' : n === 'accrued' ? 'Cumulative Accrued' : 'Cumulative Debited']} />
            <Area type="monotone" dataKey="accrued" stroke="#34d399" fill="#34d39920" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="balance" stroke={color} fill={color + '20'} strokeWidth={2} dot={false} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Debit table */}
      {activeDebits.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Itemized Debits</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-surface-border">
                  <th className="text-left pb-1.5 pr-3 font-medium">Date</th>
                  <th className="text-left pb-1.5 pr-3 font-medium">Description</th>
                  <th className="text-left pb-1.5 pr-3 font-medium">Category</th>
                  <th className="text-right pb-1.5 pr-3 font-medium">Labor</th>
                  <th className="text-right pb-1.5 pr-3 font-medium">Parts</th>
                  <th className="text-right pb-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeDebits.map(d => (
                  <tr key={d.id} className="border-b border-surface-border/50 hover:bg-white/5 transition-colors">
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">{d.date}</td>
                    <td className="py-1.5 pr-3 text-slate-300 max-w-[280px]">
                      <span className="block truncate" title={d.description}>{d.description}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                      {DEBIT_CATEGORIES[d.category] ?? d.category}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-slate-300 font-mono whitespace-nowrap">{fmt$(d.laborCost)}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-300 font-mono whitespace-nowrap">{fmt$(d.partsCost)}</td>
                    <td className="py-1.5 text-right text-slate-100 font-mono font-semibold whitespace-nowrap">{fmt$(d.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-surface-border">
                  <td colSpan={4} className="pt-2 text-slate-500 text-right pr-3">Total debited</td>
                  <td />
                  <td className="pt-2 text-right text-red-400 font-mono font-bold">{fmt$(totalDebited)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cost breakdown pie ────────────────────────────────────────────────────────

const PIE_COLORS = ['#fb923c', '#38bdf8', '#34d399', '#a78bfa', '#fbbf24']

function CostBreakdownPie({ allDebits }) {
  const byCategory = useMemo(() => {
    const map = {}
    allDebits.filter(d => !d.aogEvent && d.total > 0).forEach(d => {
      const label = DEBIT_CATEGORIES[d.category] ?? d.category
      map[label] = (map[label] ?? 0) + d.total
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [allDebits])

  if (byCategory.length === 0) return null

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-4">
      <SectionTitle>Maintenance Cost by Category</SectionTitle>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={byCategory} dataKey="value" cx="50%" cy="50%"
              innerRadius={45} outerRadius={70} paddingAngle={3}>
              {byCategory.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => fmt$(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1.5 text-xs flex-1">
          {byCategory.map((cat, i) => (
            <div key={cat.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-slate-300 flex-1 truncate">{cat.name}</span>
              <span className="text-slate-100 font-mono font-semibold">{fmt$(cat.value)}</span>
            </div>
          ))}
          <div className="border-t border-surface-border mt-1 pt-1 flex justify-between">
            <span className="text-slate-400">Total</span>
            <span className="text-slate-100 font-mono font-bold">
              {fmt$(byCategory.reduce((s, c) => s + c.value, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Leases() {
  const [selectedId, setSelectedId] = useState('ac-001')
  const lease = mockLeases.find(l => l.aircraftId === selectedId) ?? mockLeases[0]

  const suspended = lease.status === 'suspended'

  // ── Computed KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalFlown      = lease.monthlyFlown.reduce((s, h) => s + h, 0)
    const totalContracted = lease.monthlyContracted.reduce((s, h) => s + h, 0)
    const revenueYTD      = totalFlown * lease.hourlyRate
    const utilPct         = totalContracted > 0 ? (totalFlown / totalContracted) * 100 : 0
    const mxAccrued       = totalFlown * lease.maintenanceReservePerHr
    const mxDebited       = lease.maintenanceDebits
      .filter(d => !d.aogEvent).reduce((s, d) => s + d.total, 0)
    const erAccrued       = lease.engineReserveApplicable
      ? totalFlown * lease.engineReservePerHr : 0
    const erDebited       = lease.engineDebits.reduce((s, d) => s + d.total, 0)
    const reserveBalance  = (mxAccrued - mxDebited) + (erAccrued - erDebited)

    return { totalFlown, totalContracted, revenueYTD, utilPct, reserveBalance, mxDebited }
  }, [lease])

  // ── Hours chart data ───────────────────────────────────────────────────────
  const hoursChartData = LEASE_MONTHS.map((m, i) => ({
    month: m.label,
    contracted: lease.monthlyContracted[i] ?? 0,
    flown:      lease.monthlyFlown[i] ?? 0,
  }))

  // ── All debits combined for cost breakdown ─────────────────────────────────
  const allDebits = [...lease.maintenanceDebits, ...lease.engineDebits]

  // ── AOG event (N33333 suspended) ───────────────────────────────────────────
  const aogEvent = lease.maintenanceDebits.find(d => d.aogEvent)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Aircraft selector tabs ── */}
      <div className="flex-shrink-0 overflow-x-auto border-b border-surface-border bg-surface-card px-4">
        <div className="flex gap-1 py-2 min-w-max">
          {mockLeases.map(l => {
            const isActive = l.aircraftId === selectedId
            const isSuspended = l.status === 'suspended'
            return (
              <button
                key={l.aircraftId}
                onClick={() => setSelectedId(l.aircraftId)}
                className={[
                  'flex flex-col items-center px-3 py-2 rounded text-xs transition-colors border whitespace-nowrap',
                  isActive
                    ? 'bg-sky-400/10 border-sky-400/50 text-sky-400'
                    : isSuspended
                    ? 'border-amber-500/30 text-amber-500/60 hover:text-amber-400 hover:bg-amber-400/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5',
                ].join(' ')}
              >
                <span className="font-mono font-bold text-sm">{l.tailNumber}</span>
                <span className="text-slate-500 text-[10px] mt-0.5">
                  {l.makeModel.split(' ').slice(1, 3).join(' ')}
                </span>
                {isSuspended && (
                  <span className="text-[9px] text-amber-500 font-semibold mt-0.5 uppercase tracking-wide">
                    Suspended
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Aircraft detail ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Lease Header */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-slate-100 font-bold text-lg">{lease.tailNumber}</h2>
                <span className="text-slate-400 text-sm">{lease.makeModel}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${LEASE_TYPE_COLORS[lease.leaseType]}`}>
                  {LEASE_TYPE_LABELS[lease.leaseType]}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${
                  suspended
                    ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
                    : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
                }`}>
                  {suspended ? 'Suspended' : 'Active'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 mt-2">
                <span>
                  <span className="text-slate-500">Lessee</span>{' '}
                  <span className="text-slate-200">{lease.lesseeCompany}</span>
                </span>
                <span>
                  <span className="text-slate-500">Lessor</span>{' '}
                  <span className="text-slate-200">{lease.lessorCompany}</span>
                </span>
                <span>
                  <span className="text-slate-500">Term</span>{' '}
                  <span className="text-slate-200">{lease.leaseStart} → {lease.leaseEnd}</span>
                </span>
                <span>
                  <span className="text-slate-500">Deposit</span>{' '}
                  <span className="text-slate-200">{fmt$(lease.securityDeposit)}</span>
                </span>
                <span>
                  <span className="text-slate-500">Auto-renew</span>{' '}
                  <span className={lease.autoRenew ? 'text-emerald-400' : 'text-slate-400'}>
                    {lease.autoRenew ? 'Yes' : 'No'}
                  </span>
                </span>
              </div>
              {lease.statusNote && (
                <p className="mt-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-1">
                  {lease.statusNote}
                </p>
              )}
            </div>

            {/* Rate summary */}
            <div className="flex flex-col gap-1 text-right">
              <div className="text-slate-100 font-mono font-bold text-xl">
                {fmt$(lease.hourlyRate)}<span className="text-slate-500 text-sm font-normal">/hr</span>
              </div>
              <div className="text-xs text-slate-400">
                MR: <span className="text-orange-400 font-mono">{fmt$(lease.maintenanceReservePerHr)}/hr</span>
                {lease.engineReserveApplicable && (
                  <> &nbsp;·&nbsp; ER: <span className="text-violet-400 font-mono">{fmt$(lease.engineReservePerHr)}/hr</span></>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="flex flex-wrap gap-3">
          <KpiTile
            label="Revenue Billed (YTD)"
            value={fmt$(kpis.revenueYTD)}
            sub={`${fmtHrs(kpis.totalFlown)} flown`}
            highlight
          />
          <KpiTile
            label="Utilization"
            value={fmtPct(kpis.utilPct)}
            sub={`${fmtHrs(kpis.totalFlown)} of ${fmtHrs(kpis.totalContracted)}`}
            subColor={kpis.utilPct >= 90 ? 'text-emerald-400' : kpis.utilPct >= 75 ? 'text-amber-400' : 'text-red-400'}
          />
          <KpiTile
            label="Reserve Balance"
            value={fmt$(kpis.reserveBalance)}
            sub={kpis.reserveBalance >= 0 ? 'Funded' : 'Deficit'}
            subColor={kpis.reserveBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <KpiTile
            label="Total Mx Debited"
            value={fmt$(kpis.mxDebited)}
            sub={`${allDebits.filter(d => !d.aogEvent && d.total > 0).length} events`}
          />
          <KpiTile
            label="Program Hours"
            value={fmtHrs(kpis.totalContracted)}
            sub={`${fmtHrs(kpis.totalContracted - kpis.totalFlown)} remaining`}
            subColor={(kpis.totalContracted - kpis.totalFlown) > 0 ? 'text-slate-400' : 'text-amber-400'}
          />
        </div>

        {/* Program Hours Chart */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Program Hours — Monthly Contracted vs Flown</SectionTitle>
            <span className="text-xs text-slate-500">Apr 2025 – Mar 2026</span>
          </div>
          {suspended ? (
            <div className="h-[160px] flex items-center justify-center text-slate-500 text-sm">
              Lease suspended — no active flight billing after 2026-03-20
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hoursChartData} barCategoryGap="30%"
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v + 'h'} width={38} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v, n) => [v + ' hrs', n === 'contracted' ? 'Contracted' : 'Flown']} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="contracted" name="Contracted" fill="#334155" radius={[2, 2, 0, 0]} />
                <Bar dataKey="flown" name="Flown" fill="#38bdf8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {!suspended && (
            <div className="mt-2 flex gap-4 text-xs text-slate-500">
              <span>
                {lease.leaseType === 'wet_lease_acmi'
                  ? 'ACMI: contracted hours are guaranteed minimum block — lessee pays regardless of utilization'
                  : 'Dry Lease / Leaseback: contracted hours are projected utilization ceiling'}
              </span>
            </div>
          )}
        </div>

        {/* Maintenance Reserve Ledger */}
        <ReserveLedger
          title={`Maintenance Reserve — ${fmt$(lease.maintenanceReservePerHr)}/hr accrual`}
          reservePerHr={lease.maintenanceReservePerHr}
          monthlyFlown={lease.monthlyFlown}
          debits={lease.maintenanceDebits}
          color="#38bdf8"
          suspended={suspended}
        />

        {/* Engine Reserve Ledger (turboprops only) */}
        {lease.engineReserveApplicable && (
          <ReserveLedger
            title={`Engine Reserve (PT6A) — ${fmt$(lease.engineReservePerHr)}/hr accrual`}
            reservePerHr={lease.engineReservePerHr}
            monthlyFlown={lease.monthlyFlown}
            debits={lease.engineDebits}
            color="#a78bfa"
            suspended={suspended}
          />
        )}

        {/* AOG event notice (N33333) */}
        {aogEvent && (
          <div className="bg-red-400/5 border border-red-400/20 rounded-lg p-4">
            <p className="text-xs text-red-400 font-semibold mb-1">AOG Event — Pending Diagnosis</p>
            <p className="text-xs text-slate-400">{aogEvent.description}</p>
            <p className="text-xs text-slate-500 mt-1">
              Maintenance costs for AOG investigation will be debited against the reserve once work orders are closed.
            </p>
          </div>
        )}

        {/* Cost breakdown pie */}
        {allDebits.filter(d => !d.aogEvent && d.total > 0).length > 0 && (
          <CostBreakdownPie allDebits={allDebits} />
        )}

        {/* Lease financial summary */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-4">
          <SectionTitle>Lease Financial Summary</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-xs">
            {[
              ['Hourly rate',             fmt$(lease.hourlyRate) + '/hr'],
              ['Hours flown (YTD)',        fmtHrs(kpis.totalFlown)],
              ['Gross revenue billed',     fmt$(kpis.revenueYTD)],
              ['MR rate',                  fmt$(lease.maintenanceReservePerHr) + '/hr'],
              ['MR accrued',               fmt$(kpis.totalFlown * lease.maintenanceReservePerHr)],
              ['MR debited',               fmt$(lease.maintenanceDebits.filter(d => !d.aogEvent).reduce((s,d) => s+d.total, 0))],
              ...(lease.engineReserveApplicable ? [
                ['ER rate',                fmt$(lease.engineReservePerHr) + '/hr'],
                ['ER accrued',             fmt$(kpis.totalFlown * lease.engineReservePerHr)],
                ['ER debited',             fmt$(lease.engineDebits.reduce((s,d) => s+d.total, 0))],
              ] : []),
              ['Security deposit held',   fmt$(lease.securityDeposit)],
              ['Net reserve balance',     fmt$(kpis.reserveBalance)],
              ['Utilization vs contract', fmtPct(kpis.utilPct)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2 py-1 border-b border-surface-border/40">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-200 font-mono">{val}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
