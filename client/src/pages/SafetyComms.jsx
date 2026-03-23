import { useState } from 'react'
import { mockSafetyComms, mockCommsSummary, COMM_TYPES } from '../mocks/safetyComms'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  post_flight_debrief: 'text-sky-400 bg-sky-400/10 border-sky-400/40',
  toolbox_talk:        'text-green-400 bg-green-400/10 border-green-400/40',
  safety_bulletin:     'text-amber-400 bg-amber-400/10 border-amber-400/40',
  management_report:   'text-purple-400 bg-purple-400/10 border-purple-400/40',
}

const ITEM_RATING_COLORS = {
  nominal: 'text-green-400',
  minor:   'text-amber-400',
  major:   'text-red-400',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Type filter tab bar
 */
export function CommTypeFilter({ selected, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="comm-type-filter">
      <button
        onClick={() => onChange('all')}
        className={`text-xs px-3 py-1 rounded border transition-colors ${selected === 'all' ? 'border-sky-400 text-sky-400 bg-sky-400/10' : 'border-surface-border text-slate-400 hover:border-slate-500'}`}
        aria-pressed={selected === 'all'}
      >
        All
      </button>
      {Object.values(COMM_TYPES).map((ct) => (
        <button
          key={ct.key}
          onClick={() => onChange(ct.key)}
          className={`text-xs px-3 py-1 rounded border transition-colors ${selected === ct.key ? `${TYPE_STYLES[ct.key]} border` : 'border-surface-border text-slate-400 hover:border-slate-500'}`}
          aria-pressed={selected === ct.key}
        >
          {ct.icon} {ct.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Scorecard strip for communications types
 */
export function CommScorecardStrip() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="comm-scorecard-strip">
      <div className="bg-surface-card border border-sky-400/40 rounded-lg p-3 text-center">
        <p className="font-mono font-bold text-xl text-sky-400">{mockCommsSummary.debriefsLast30d}</p>
        <p className="text-xs text-slate-400 mt-0.5">Post-Flight Debriefs (30d)</p>
        <p className="text-xs text-green-400 mt-0.5">100% completion ✓</p>
      </div>
      <div className="bg-surface-card border border-green-400/40 rounded-lg p-3 text-center">
        <p className="font-mono font-bold text-xl text-green-400">{mockCommsSummary.toolboxTalksLast30d}</p>
        <p className="text-xs text-slate-400 mt-0.5">Toolbox Talks (30d)</p>
        <p className="text-xs text-amber-400 mt-0.5">{mockCommsSummary.toolboxTalksLast30d}/{mockCommsSummary.toolboxTalksTarget} target</p>
      </div>
      <div className="bg-surface-card border border-amber-400/40 rounded-lg p-3 text-center">
        <p className="font-mono font-bold text-xl text-amber-400">{mockCommsSummary.bulletinsYtd}</p>
        <p className="text-xs text-slate-400 mt-0.5">Safety Bulletins (YTD)</p>
        <p className="text-xs text-slate-500 mt-0.5">Monthly cadence</p>
      </div>
      <div className="bg-surface-card border border-purple-400/40 rounded-lg p-3 text-center">
        <p className="font-mono font-bold text-xl text-purple-400">{mockCommsSummary.nasaSubmittedYtd}</p>
        <p className="text-xs text-slate-400 mt-0.5">NASA ASRS Submitted (YTD)</p>
        <p className="text-xs text-amber-400 mt-0.5">{mockCommsSummary.nasaPendingYtd} pending</p>
      </div>
    </div>
  )
}

/**
 * A single communication card — expands to show full detail.
 */
export function CommCard({ comm }) {
  const [expanded, setExpanded] = useState(false)
  const ct = COMM_TYPES[comm.type]
  const typeStyle = TYPE_STYLES[comm.type]

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-lg overflow-hidden"
      data-testid={`comm-card-${comm.id}`}
    >
      {/* Header row */}
      <button
        className="w-full flex items-start gap-3 p-4 hover:bg-white/5 transition-colors text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="text-lg flex-shrink-0 mt-0.5" aria-hidden="true">{ct.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${typeStyle}`}>
              {ct.label}
            </span>
            {comm.nasaFlagged && (
              <span className={`text-xs px-2 py-0.5 rounded border font-medium ${comm.nasaStatus === 'submitted' ? 'text-green-400 border-green-400/40 bg-green-400/10' : 'text-amber-400 border-amber-400/40 bg-amber-400/10'}`}>
                NASA {comm.nasaStatus === 'submitted' ? `ACN: ${comm.nasaAcn}` : comm.nasaStatus === 'pending' ? 'Pending' : 'Flagged'}
              </span>
            )}
            <span className="text-xs text-slate-500">{comm.date}</span>
          </div>
          <p className="text-slate-100 text-sm font-semibold mt-1 leading-tight">{comm.title}</p>
          <p className="text-slate-400 text-xs mt-0.5">By {comm.author}</p>
        </div>
        <span className="text-slate-500 text-xs flex-shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-surface-border p-4 space-y-3">

          {/* Post-flight debrief detail */}
          {comm.type === 'post_flight_debrief' && comm.safetyItems && (
            <div>
              <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Debrief Items</h4>
              <div className="space-y-1.5">
                {comm.safetyItems.map((item) => (
                  <div key={item.area} className="flex items-start gap-2 text-xs">
                    <span className="text-slate-500 w-16 flex-shrink-0">{item.area}</span>
                    <span className={`font-semibold w-12 flex-shrink-0 ${ITEM_RATING_COLORS[item.rating] ?? 'text-slate-400'}`}>
                      {item.rating.toUpperCase()}
                    </span>
                    <span className="text-slate-300">{item.note}</span>
                  </div>
                ))}
              </div>
              {comm.tailNumber && (
                <p className="text-slate-500 text-xs mt-2">Aircraft: {comm.tailNumber}</p>
              )}
              {comm.nasaFlagged && (
                <div className={`mt-3 p-2 rounded text-xs border ${comm.nasaStatus === 'submitted' ? 'border-green-400/30 bg-green-400/5 text-green-300' : 'border-amber-400/30 bg-amber-400/5 text-amber-300'}`}>
                  {comm.nasaStatus === 'submitted'
                    ? `✓ NASA ASRS submitted — ACN: ${comm.nasaAcn}`
                    : '⚠ Flagged for NASA ASRS submission — pending'}
                </div>
              )}
            </div>
          )}

          {/* Toolbox talk detail */}
          {comm.type === 'toolbox_talk' && (
            <div>
              <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Topic</h4>
              <p className="text-slate-300 text-xs">{comm.topic}</p>
              <h4 className="text-slate-400 text-xs uppercase tracking-wider mt-3 mb-1">Attendees ({comm.attendeeCount})</h4>
              <div className="flex flex-wrap gap-1">
                {comm.attendees.map((a) => (
                  <span key={a} className="text-xs bg-surface border border-surface-border rounded px-1.5 py-0.5 text-slate-300">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Safety bulletin detail */}
          {comm.type === 'safety_bulletin' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-slate-400 text-xs uppercase tracking-wider">Highlights</h4>
                <span className="text-xs text-slate-500">
                  Acknowledgments: {comm.acknowledgments.received}/{comm.acknowledgments.required}
                  {comm.acknowledgments.received < comm.acknowledgments.required && (
                    <span className="text-amber-400 ml-1">⚠ {comm.acknowledgments.required - comm.acknowledgments.received} pending</span>
                  )}
                </span>
              </div>
              <ul className="space-y-1">
                {comm.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-slate-500 flex-shrink-0">·</span>{h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Management report detail */}
          {comm.type === 'management_report' && comm.kpiSummary && (
            <div>
              <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-2">KPI Summary</h4>
              <dl className="grid grid-cols-2 gap-1 text-xs">
                <div className="flex justify-between"><dt className="text-slate-400">Accidents</dt><dd className="text-green-400 font-mono">{comm.kpiSummary.accidentRate}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Serious incidents</dt><dd className="text-green-400 font-mono">{comm.kpiSummary.seriousIncidentRate}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Incidents</dt><dd className="text-slate-200 font-mono">{comm.kpiSummary.incidentRate}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Disclosure reports</dt><dd className="text-green-400 font-mono">{comm.kpiSummary.disclosureReportRate}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Training compliance</dt><dd className="text-amber-400 font-mono">{comm.kpiSummary.trainingCompliance}%</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Open CA items</dt><dd className="text-amber-400 font-mono">{comm.kpiSummary.auditFindingsOpen}</dd></div>
              </dl>
              <h4 className="text-slate-400 text-xs uppercase tracking-wider mt-3 mb-1.5">Recommended Actions</h4>
              <ul className="space-y-1">
                {comm.recommendedActions.map((a, i) => (
                  <li key={i} className="text-xs text-amber-300 flex items-start gap-1.5">
                    <span className="flex-shrink-0">→</span>{a}
                  </li>
                ))}
              </ul>
              <p className="text-slate-500 text-xs mt-2">Recipients: {comm.recipients.join(', ')}</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SafetyComms() {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? mockSafetyComms
    : mockSafetyComms.filter((c) => c.type === filter)

  return (
    <div data-testid="page-safety-comms" className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-100 font-bold text-lg">Safety Communications</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            4 communication types · post-flight debriefs · toolbox talks · bulletins · management reports
          </p>
        </div>
        <button className="text-sm bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded font-semibold text-xs">
          + New Communication
        </button>
      </div>

      {/* Channel descriptions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.values(COMM_TYPES).map((ct) => (
          <div key={ct.key} className={`border rounded-lg p-3 text-xs ${TYPE_STYLES[ct.key]}`}>
            <p className="font-semibold mb-1">{ct.icon} {ct.label}</p>
            <p className="text-slate-400 leading-relaxed">{ct.description}</p>
            {ct.nasaEligible && (
              <p className="mt-1 text-green-400 font-semibold">↗ NASA ASRS eligible</p>
            )}
          </div>
        ))}
      </div>

      <CommScorecardStrip />

      <div>
        <div className="flex items-center gap-4 mb-4">
          <CommTypeFilter selected={filter} onChange={setFilter} />
          <span className="ml-auto text-xs text-slate-500">{filtered.length} records</span>
        </div>

        <div className="space-y-3">
          {filtered.map((comm) => (
            <CommCard key={comm.id} comm={comm} />
          ))}
        </div>
      </div>
    </div>
  )
}
