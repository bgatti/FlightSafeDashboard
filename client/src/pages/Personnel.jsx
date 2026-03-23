import { useState } from 'react'
import { mockPersonnel, mockTrainingSummary, mockTrainingKpi } from '../mocks/personnel'
import { getRiskLevel } from '../lib/riskColors'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  pilot_pic:      { label: 'PIC',            color: 'text-sky-400 bg-sky-400/10 border-sky-400/40' },
  pilot_sic:      { label: 'SIC',            color: 'text-blue-400 bg-blue-400/10 border-blue-400/40' },
  dispatcher:     { label: 'Dispatcher',     color: 'text-teal-400 bg-teal-400/10 border-teal-400/40' },
  mechanic:       { label: 'Mechanic',       color: 'text-orange-400 bg-orange-400/10 border-orange-400/40' },
  ground:         { label: 'Ground',         color: 'text-slate-300 bg-slate-300/10 border-slate-300/40' },
  safety_officer: { label: 'Safety Mgr',    color: 'text-purple-400 bg-purple-400/10 border-purple-400/40' },
  admin:          { label: 'Admin',          color: 'text-slate-400 bg-slate-400/10 border-slate-400/40' },
}

function currencyStatus(expiryIso) {
  if (!expiryIso) return null
  const daysLeft = Math.round((new Date(expiryIso) - new Date('2026-03-21')) / 86_400_000)
  if (daysLeft < 0)  return { label: 'Expired',  color: 'text-red-400',   days: daysLeft }
  if (daysLeft < 30) return { label: 'Expiring', color: 'text-amber-400', days: daysLeft }
  return               { label: 'Current',  color: 'text-green-400', days: daysLeft }
}

function CurrencyChip({ label, expiryIso }) {
  if (!expiryIso) return null
  const s = currencyStatus(expiryIso)
  return (
    <span
      className={`text-xs ${s.color} font-mono`}
      title={`${label}: ${s.days >= 0 ? `${s.days}d remaining` : `expired ${Math.abs(s.days)}d ago`}`}
      aria-label={`${label}: ${s.label}`}
    >
      {s.days >= 0 ? `+${s.days}d` : `${s.days}d`}
    </span>
  )
}

function TrainingStatusDot({ status }) {
  const colors = { current: 'bg-green-400', expiring: 'bg-amber-400', expired: 'bg-red-400' }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-slate-500'}`}
      aria-label={status}
      title={status}
    />
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function PersonnelRow({ person, onSelect, isSelected }) {
  const roleCfg = ROLE_LABELS[person.role] ?? { label: person.role, color: 'text-slate-400 bg-slate-400/10 border-slate-400/40' }
  const trainingIssues = person.training.filter((t) => t.status !== 'current').length
  const trainingLevel = trainingIssues > 1 ? 'high' : trainingIssues === 1 ? 'medium' : 'low'
  const medStatus = person.medicalExpiry ? currencyStatus(person.medicalExpiry) : null

  return (
    <tr
      className={[
        'border-b border-surface-border text-sm cursor-pointer transition-colors',
        isSelected ? 'bg-sky-400/10' : 'hover:bg-white/5',
      ].join(' ')}
      onClick={() => onSelect(person.id)}
      data-testid={`personnel-row-${person.id}`}
      aria-selected={isSelected}
    >
      <td className="py-2.5 px-4 text-slate-100 font-semibold">{person.name}</td>
      <td className="py-2.5 px-4">
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${roleCfg.color}`}>
          {roleCfg.label}
        </span>
      </td>
      <td className="py-2.5 px-4 text-slate-400 text-xs">{person.department}</td>
      <td className="py-2.5 px-4 text-xs">
        {medStatus ? (
          <span className={medStatus.color}>
            {medStatus.label} ({medStatus.days >= 0 ? `${medStatus.days}d` : `${Math.abs(medStatus.days)}d ago`})
          </span>
        ) : <span className="text-slate-600">—</span>}
      </td>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2 text-xs">
          {person.ifrCurrencyExpiry && (
            <span className="text-slate-400">IFR: <CurrencyChip label="IFR Currency" expiryIso={person.ifrCurrencyExpiry} /></span>
          )}
          {person.nightCurrencyExpiry && (
            <span className="text-slate-400">Night: <CurrencyChip label="Night Currency" expiryIso={person.nightCurrencyExpiry} /></span>
          )}
          {!person.ifrCurrencyExpiry && !person.nightCurrencyExpiry && (
            <span className="text-slate-600">—</span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-1">
          {person.training.map((t) => (
            <TrainingStatusDot key={t.course} status={t.status} />
          ))}
          <span className={`ml-1 text-xs ${trainingIssues > 0 ? getRiskLevel(trainingIssues * 35).textClass : 'text-green-400'}`}>
            {trainingIssues > 0 ? `${trainingIssues} issue${trainingIssues > 1 ? 's' : ''}` : '✓ All current'}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-4 font-mono text-xs text-slate-400">
        {person.dutyHoursLast30d}h
      </td>
    </tr>
  )
}

export function PersonnelDetailDrawer({ person, onClose }) {
  if (!person) return null
  const roleCfg = ROLE_LABELS[person.role] ?? { label: person.role, color: 'text-slate-400' }

  return (
    <aside
      className="w-80 flex-shrink-0 bg-surface-card border-l border-surface-border p-4 overflow-y-auto"
      aria-label={`Personnel details for ${person.name}`}
      data-testid="personnel-detail-drawer"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-100 font-bold">{person.name}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100" aria-label="Close">✕</button>
      </div>

      <div className="space-y-4 text-sm">
        {/* Role & cert */}
        <div>
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${roleCfg.color}`}>
            {roleCfg.label}
          </span>
          <p className="text-slate-400 text-xs mt-1">{person.department}</p>
          {person.certificateNumber && (
            <p className="text-slate-500 text-xs mt-0.5 font-mono">
              {person.certType} · {person.certificateNumber}
            </p>
          )}
        </div>

        {/* Currency */}
        {(person.medicalExpiry || person.ifrCurrencyExpiry) && (
          <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Currency</h3>
            <dl className="space-y-1">
              {person.medicalExpiry && (
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-400">Medical Class {person.medicalClass}</dt>
                  <dd className={currencyStatus(person.medicalExpiry)?.color}>
                    {person.medicalExpiry}
                  </dd>
                </div>
              )}
              {person.lastFlightReview && (
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-400">Last flight review</dt>
                  <dd className="text-slate-300 font-mono">{person.lastFlightReview}</dd>
                </div>
              )}
              {person.ifrCurrencyExpiry && (
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-400">IFR currency</dt>
                  <dd className={currencyStatus(person.ifrCurrencyExpiry)?.color}>
                    {person.ifrCurrencyExpiry}
                  </dd>
                </div>
              )}
              {person.nightCurrencyExpiry && (
                <div className="flex justify-between text-xs">
                  <dt className="text-slate-400">Night currency</dt>
                  <dd className={currencyStatus(person.nightCurrencyExpiry)?.color}>
                    {person.nightCurrencyExpiry}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Training record */}
        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Training Record</h3>
          <div className="space-y-2">
            {person.training.map((t) => {
              const statusColors = { current: 'text-green-400', expiring: 'text-amber-400', expired: 'text-red-400' }
              return (
                <div key={t.course} className="border border-surface-border rounded p-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-slate-300 text-xs leading-tight">{t.course}</span>
                    <span className={`text-xs font-semibold flex-shrink-0 ${statusColors[t.status]}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1 font-mono">
                    Completed: {t.completedOn} · Due: {t.nextDue}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity */}
        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-1">Activity</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-400">Duty hours (30d)</dt>
              <dd className="text-slate-200 font-mono">{person.dutyHoursLast30d}h</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Flight hours (YTD)</dt>
              <dd className="text-slate-200 font-mono">{person.flightHoursYtd}h</dd>
            </div>
          </dl>
        </div>
      </div>
    </aside>
  )
}

export function TrainingSummaryBars({ data }) {
  return (
    <div className="space-y-2" data-testid="training-summary-bars">
      {data.map((dept) => {
        const level = dept.pct >= 90 ? 'low' : dept.pct >= 70 ? 'medium' : 'high'
        const color = level === 'low' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#ef4444'
        return (
          <div key={dept.department} className="flex items-center gap-3">
            <span className="text-slate-400 text-xs w-36 flex-shrink-0">{dept.department}</span>
            <div
              className="flex-1 h-2 bg-surface rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={dept.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${dept.department}: ${dept.pct}%`}
            >
              <div className="h-full rounded-full" style={{ width: `${dept.pct}%`, backgroundColor: color }} />
            </div>
            <span className="font-mono text-xs w-8 text-right" style={{ color }}>{dept.pct}%</span>
            <span className="text-xs text-slate-500 w-12">{dept.completed}/{dept.total}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Personnel() {
  const [selectedId, setSelectedId] = useState(null)
  const [filterRole, setFilterRole] = useState('all')

  const filtered = filterRole === 'all'
    ? mockPersonnel
    : mockPersonnel.filter((p) => p.role === filterRole)

  const selected = mockPersonnel.find((p) => p.id === selectedId) ?? null

  return (
    <div className="flex gap-4" data-testid="page-personnel">
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-100 font-bold text-lg">Personnel & Training</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {mockPersonnel.length} personnel · SMS training + currency records
            </p>
          </div>
          <button className="text-sm bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded font-semibold text-xs">
            + Add Personnel
          </button>
        </div>

        {/* Training summary by dept */}
        <section
          className="bg-surface-card border border-surface-border rounded-lg p-4"
          aria-label="Training completion by department"
        >
          <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
            Training Completion by Department
          </h2>
          <TrainingSummaryBars data={mockTrainingSummary} />
        </section>

        {/* Roster table */}
        <section aria-label="Personnel roster">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-slate-400 text-xs uppercase tracking-widest">Roster</h2>
            <select
              className="bg-surface-card border border-surface-border text-slate-200 text-xs rounded px-2 py-1 ml-2"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              <option value="pilot_pic">PIC</option>
              <option value="pilot_sic">SIC</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="mechanic">Mechanic</option>
              <option value="ground">Ground</option>
              <option value="safety_officer">Safety Officer</option>
            </select>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full" aria-label="Personnel roster">
              <thead>
                <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                  <th className="py-2 px-4 text-left font-medium">Name</th>
                  <th className="py-2 px-4 text-left font-medium">Role</th>
                  <th className="py-2 px-4 text-left font-medium">Department</th>
                  <th className="py-2 px-4 text-left font-medium">Medical</th>
                  <th className="py-2 px-4 text-left font-medium">Currency</th>
                  <th className="py-2 px-4 text-left font-medium">Training</th>
                  <th className="py-2 px-4 text-left font-medium">Duty (30d)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => (
                  <PersonnelRow
                    key={person.id}
                    person={person}
                    isSelected={selectedId === person.id}
                    onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <PersonnelDetailDrawer
        person={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
