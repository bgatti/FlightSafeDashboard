import { useState, useEffect } from 'react'
import { getAllFlights, subscribe } from '../store/flights'
import { RiskBadge } from '../components/shared/RiskBadge'
import { PaveBadge } from '../components/shared/PaveBadge'
import { useUiStore } from '../stores/uiStore'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Format a UTC ISO string as relative departure time (e.g. "+2h", "+14h").
 */
function relativeTime(isoStr) {
  const diff = dayjs(isoStr).diff(dayjs(), 'minute')
  if (diff < 0) return 'Departed'
  if (diff < 60) return `+${diff}m`
  return `+${Math.round(diff / 60)}h`
}

/**
 * Single row in the flight risk table.
 */
export function FlightRiskRow({ flight, isSelected, onSelect }) {
  return (
    <tr
      className={[
        'border-b border-surface-border text-sm transition-colors cursor-pointer',
        isSelected ? 'bg-sky-400/10' : 'hover:bg-white/5',
      ].join(' ')}
      onClick={() => onSelect(flight.id === isSelected ? null : flight.id)}
      data-testid={`flight-row-${flight.id}`}
      aria-selected={isSelected}
    >
      <td className="py-2.5 px-3 w-10">
        <RiskBadge score={flight.riskScore} size="sm" />
      </td>
      <td className="py-2.5 px-3 font-mono text-slate-100 font-bold">
        {flight.callsign}
      </td>
      <td className="py-2.5 px-3 text-slate-300 font-mono">
        {flight.departure}→{flight.arrival}
      </td>
      <td className="py-2.5 px-3 text-slate-400 font-mono text-xs">
        {relativeTime(flight.plannedDepartureUtc)}
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1">
          <PaveBadge dimension="P" score={flight.riskP} />
          <PaveBadge dimension="A" score={flight.riskA} />
          <PaveBadge dimension="V" score={flight.riskV} />
          <PaveBadge dimension="E" score={flight.riskE} />
        </div>
      </td>
      <td className="py-2.5 px-3 text-slate-400 text-xs capitalize">
        {flight.missionType}
      </td>
      <td className="py-2.5 px-3 text-slate-400 text-xs">
        {flight.pic}
      </td>
      <td className="py-2.5 px-3">
        <button
          className="text-sky-400 hover:text-sky-300 text-xs px-2 py-0.5 border border-sky-400/40 rounded transition-colors"
          onClick={(e) => { e.stopPropagation(); onSelect(flight.id) }}
          aria-label={`View details for flight ${flight.callsign}`}
        >
          Detail →
        </button>
      </td>
    </tr>
  )
}

/**
 * Flight detail side drawer (stub — Phase 2 will add full PAVE breakdown
 * and AirSafe accident list).
 */
export function FlightDetailDrawer({ flight, onClose }) {
  if (!flight) return null

  return (
    <aside
      className="w-80 flex-shrink-0 bg-surface-card border-l border-surface-border p-4 overflow-y-auto"
      aria-label={`Flight details for ${flight.callsign}`}
      data-testid="flight-detail-drawer"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-100 font-bold">{flight.callsign}</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 transition-colors"
          aria-label="Close detail drawer"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <span className="text-slate-400 text-xs">Route</span>
          <p className="text-slate-100 font-mono">
            {flight.departure} → {flight.arrival}
          </p>
        </div>
        <div>
          <span className="text-slate-400 text-xs">Aircraft</span>
          <p className="text-slate-100">{flight.aircraftType} · {flight.tailNumber}</p>
        </div>
        <div>
          <span className="text-slate-400 text-xs">Crew</span>
          <p className="text-slate-100">{flight.pic}{flight.sic ? ` / ${flight.sic}` : ''}</p>
        </div>
        <div>
          <span className="text-slate-400 text-xs">Departure</span>
          <p className="text-slate-100 font-mono text-xs">
            {dayjs(flight.plannedDepartureUtc).utc().format('YYYY-MM-DD HH:mm[Z]')}
            {' '}({relativeTime(flight.plannedDepartureUtc)})
          </p>
        </div>

        {/* Composite risk */}
        <div className="pt-2 border-t border-surface-border">
          <span className="text-slate-400 text-xs block mb-2">Composite Risk Score</span>
          <RiskBadge score={flight.riskScore} size="lg" />
        </div>

        {/* PAVE breakdown */}
        <div>
          <span className="text-slate-400 text-xs block mb-2">P.A.V.E. Breakdown</span>
          <div className="space-y-2">
            {[
              { key: 'P', score: flight.riskP, label: 'Pilot' },
              { key: 'A', score: flight.riskA, label: 'Aircraft' },
              { key: 'V', score: flight.riskV, label: 'enVironment' },
              { key: 'E', score: flight.riskE, label: 'External' },
            ].map(({ key, score, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">{label}</span>
                <PaveBadge dimension={key} score={score} showLabel />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-surface-border text-slate-500 text-xs italic">
          AirSafe similar accidents + full PAVE detail — Phase 2
        </div>
      </div>
    </aside>
  )
}

/**
 * Toolbar with filter/sort controls and export button.
 */
export function FlightListToolbar({ sortBy, onSortChange }) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap" data-testid="flight-list-toolbar">
      <div className="flex items-center gap-2">
        <label className="text-slate-400 text-xs" htmlFor="sort-select">Sort:</label>
        <select
          id="sort-select"
          className="bg-surface-card border border-surface-border text-slate-200 text-xs rounded px-2 py-1"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="risk">Risk (highest)</option>
          <option value="departure">Departure (soonest)</option>
          <option value="callsign">Callsign</option>
        </select>
      </div>

      <button className="ml-auto text-xs text-slate-400 border border-surface-border px-2 py-1 rounded hover:border-slate-500 transition-colors">
        Export CSV
      </button>
      <button className="text-xs text-sky-400 border border-sky-400/40 px-2 py-1 rounded hover:bg-sky-400/10 transition-colors">
        + Add Flight
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FlightRiskList() {
  const [sortBy, setSortBy] = useState('risk')
  const [flights, setFlights] = useState(() => getAllFlights())
  const selectedId = useUiStore((s) => s.selectedFlightId)
  const setSelectedFlight = useUiStore((s) => s.setSelectedFlight)

  // Live-update when a flight is scheduled from /plan
  useEffect(() => subscribe(setFlights), [])

  const sorted = [...flights].sort((a, b) => {
    if (sortBy === 'risk') return b.riskScore - a.riskScore
    if (sortBy === 'departure') return new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc)
    return a.callsign.localeCompare(b.callsign)
  })

  const selectedFlight = flights.find((f) => f.id === selectedId) ?? null

  return (
    <div className="flex gap-4 h-full" data-testid="page-flight-risk-list">
      {/* Table panel */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h1 className="text-slate-100 font-bold text-lg">Flight Risk List</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {flights.length} flights · sorted by {sortBy}
          </p>
        </div>

        <FlightListToolbar sortBy={sortBy} onSortChange={setSortBy} />

        <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full" aria-label="Planned flights risk assessment">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                <th className="py-2 px-3 text-left font-medium">Risk</th>
                <th className="py-2 px-3 text-left font-medium">Callsign</th>
                <th className="py-2 px-3 text-left font-medium">Route</th>
                <th className="py-2 px-3 text-left font-medium">Dept</th>
                <th className="py-2 px-3 text-left font-medium">P.A.V.E.</th>
                <th className="py-2 px-3 text-left font-medium">Type</th>
                <th className="py-2 px-3 text-left font-medium">PIC</th>
                <th className="py-2 px-3 text-left font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((flight) => (
                <FlightRiskRow
                  key={flight.id}
                  flight={flight}
                  isSelected={selectedId === flight.id}
                  onSelect={setSelectedFlight}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      <FlightDetailDrawer
        flight={selectedFlight}
        onClose={() => setSelectedFlight(null)}
      />
    </div>
  )
}
