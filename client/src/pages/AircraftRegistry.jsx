import { useState } from 'react'
import { mockAircraft, mockFleetSummary } from '../mocks/aircraft'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inspectionColor(status) {
  if (status === 'overdue')   return 'text-red-400'
  if (status === 'due_soon')  return 'text-amber-400'
  return 'text-green-400'
}

function inspectionLabel(status) {
  if (status === 'overdue')  return 'Overdue'
  if (status === 'due_soon') return 'Due Soon'
  return 'Current'
}

function daysUntil(iso) {
  const diff = Math.round((new Date(iso) - new Date('2026-03-21')) / 86_400_000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  return `${diff}d`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function AircraftRow({ aircraft, isSelected, onSelect }) {
  const melCount = aircraft.melItemsOpen.length
  const sqkCount = aircraft.openSquawks.length
  const openAds  = aircraft.airworthinessDirectives.filter((ad) => ad.status === 'open').length

  return (
    <tr
      className={[
        'border-b border-surface-border text-sm cursor-pointer transition-colors',
        isSelected ? 'bg-sky-400/10' : 'hover:bg-white/5',
        !aircraft.airworthy ? 'opacity-60' : '',
      ].join(' ')}
      onClick={() => onSelect(aircraft.id)}
      data-testid={`aircraft-row-${aircraft.id}`}
      aria-selected={isSelected}
    >
      {/* Airworthy status */}
      <td className="py-2.5 px-4 w-4">
        <span
          className={aircraft.airworthy ? 'text-green-400' : 'text-red-400'}
          title={aircraft.airworthy ? 'Airworthy' : 'Grounded'}
          aria-label={aircraft.airworthy ? 'Airworthy' : 'Grounded'}
        >
          {aircraft.airworthy ? '●' : '✕'}
        </span>
      </td>
      <td className="py-2.5 px-4 font-mono font-bold text-slate-100">{aircraft.tailNumber}</td>
      <td className="py-2.5 px-4 text-slate-300 text-xs">{aircraft.makeModel}</td>
      <td className="py-2.5 px-4 text-slate-500 text-xs font-mono">{aircraft.icaoType} · {aircraft.year}</td>
      <td className="py-2.5 px-4">
        <span className={`text-xs ${inspectionColor(aircraft.inspectionStatus)}`}>
          {inspectionLabel(aircraft.inspectionStatus)}
        </span>
      </td>
      <td className="py-2.5 px-4 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-slate-400">100hr: <span className={aircraft.inspectionStatus === 'overdue' ? 'text-red-400' : 'text-slate-300'} >{daysUntil(aircraft.next100hrDue)}</span></span>
          <span className="text-slate-400">Annual: <span className="text-slate-300">{daysUntil(aircraft.nextAnnualDue)}</span></span>
        </div>
      </td>
      <td className="py-2.5 px-4 font-mono text-xs text-slate-400">
        {aircraft.totalAirframeHours.toLocaleString()}h
      </td>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2 text-xs">
          {melCount > 0 && (
            <span className="text-amber-400 border border-amber-400/40 bg-amber-400/10 rounded px-1">
              MEL {melCount}
            </span>
          )}
          {sqkCount > 0 && (
            <span className="text-red-400 border border-red-400/40 bg-red-400/10 rounded px-1">
              SQK {sqkCount}
            </span>
          )}
          {openAds > 0 && (
            <span className="text-purple-400 border border-purple-400/40 bg-purple-400/10 rounded px-1">
              AD {openAds}
            </span>
          )}
          {melCount === 0 && sqkCount === 0 && openAds === 0 && (
            <span className="text-green-400">✓ Clean</span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-4 text-xs text-slate-500">{aircraft.assignedBase}</td>
    </tr>
  )
}

export function AircraftDetailDrawer({ aircraft, onClose }) {
  if (!aircraft) return null

  return (
    <aside
      className="w-80 flex-shrink-0 bg-surface-card border-l border-surface-border p-4 overflow-y-auto"
      aria-label={`Aircraft details for ${aircraft.tailNumber}`}
      data-testid="aircraft-detail-drawer"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-slate-100 font-bold font-mono">{aircraft.tailNumber}</h2>
          <p className="text-slate-400 text-xs">{aircraft.makeModel}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-100" aria-label="Close">✕</button>
      </div>

      <div className="space-y-4 text-sm">
        {/* Airworthiness */}
        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Airworthiness</h3>
          <div className={`text-sm font-semibold mb-2 ${aircraft.airworthy ? 'text-green-400' : 'text-red-400'}`}>
            {aircraft.airworthy ? '● Airworthy' : '✕ Grounded'}
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between"><dt className="text-slate-400">Serial</dt><dd className="font-mono text-slate-300">{aircraft.serialNumber}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Year</dt><dd className="text-slate-300">{aircraft.year}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Total hours</dt><dd className="font-mono text-slate-300">{aircraft.totalAirframeHours.toLocaleString()}h</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Base</dt><dd className="text-slate-300">{aircraft.assignedBase}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Last flight</dt><dd className="text-slate-300">{aircraft.lastFlightDate}</dd></div>
          </dl>
        </div>

        {/* Inspections */}
        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Inspections</h3>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between"><dt className="text-slate-400">Last annual</dt><dd className="text-slate-300">{aircraft.lastAnnualDate}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Next annual</dt>
              <dd className={inspectionColor(aircraft.inspectionStatus)}>{aircraft.nextAnnualDue} ({daysUntil(aircraft.nextAnnualDue)})</dd>
            </div>
            <div className="flex justify-between"><dt className="text-slate-400">Last 100hr</dt><dd className="text-slate-300">{aircraft.last100hrDate}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Next 100hr</dt>
              <dd className={aircraft.next100hrDue < '2026-04-21' ? 'text-amber-400' : 'text-slate-300'}>{aircraft.next100hrDue} ({daysUntil(aircraft.next100hrDue)})</dd>
            </div>
          </dl>
        </div>

        {/* MEL items */}
        {aircraft.melItemsOpen.length > 0 && (
          <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">MEL Items</h3>
            {aircraft.melItemsOpen.map((mel, i) => (
              <div key={i} className="border border-amber-400/30 bg-amber-400/5 rounded p-2 text-xs mb-1.5">
                <p className="text-amber-300 font-semibold">{mel.category}</p>
                <p className="text-slate-300">{mel.item}</p>
                <p className="text-slate-500 mt-0.5">Expires: {mel.expiryDate}</p>
              </div>
            ))}
          </div>
        )}

        {/* Open squawks */}
        {aircraft.openSquawks.length > 0 && (
          <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">Open Squawks</h3>
            {aircraft.openSquawks.map((sq, i) => (
              <div key={i} className={`border rounded p-2 text-xs mb-1.5 ${sq.status === 'grounding' ? 'border-red-400/40 bg-red-400/5' : 'border-surface-border'}`}>
                <p className={sq.status === 'grounding' ? 'text-red-400 font-semibold' : 'text-slate-300'}>{sq.description}</p>
                <p className="text-slate-500 mt-0.5">Reported: {sq.reportedDate} · {sq.status}</p>
              </div>
            ))}
          </div>
        )}

        {/* ADs */}
        <div>
          <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">
            Airworthiness Directives ({aircraft.airworthinessDirectives.length})
          </h3>
          {aircraft.airworthinessDirectives.map((ad, i) => (
            <div key={i} className={`border rounded p-2 text-xs mb-1.5 ${ad.status === 'open' ? 'border-red-400/40 bg-red-400/5' : 'border-surface-border'}`}>
              <div className="flex items-start justify-between">
                <span className="font-mono text-slate-400 text-xs">{ad.adNumber}</span>
                <span className={ad.status === 'open' ? 'text-red-400 font-semibold' : 'text-green-400'}>
                  {ad.status === 'open' ? 'OPEN' : '✓'}
                </span>
              </div>
              <p className="text-slate-300 mt-0.5">{ad.description}</p>
              {ad.compliedDate && <p className="text-slate-500 mt-0.5">Complied: {ad.compliedDate}</p>}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// Fleet scorecard tiles
function FleetTile({ label, value, color = 'text-slate-100' }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-3 text-center">
      <p className={`font-mono font-bold text-2xl ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AircraftRegistry() {
  const [selectedId, setSelectedId] = useState(null)
  const selected = mockAircraft.find((a) => a.id === selectedId) ?? null

  return (
    <div className="flex gap-4" data-testid="page-aircraft-registry">
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-100 font-bold text-lg">Aircraft Registry</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {mockAircraft.length}-aircraft fleet · airworthiness, inspections, MEL, ADs
            </p>
          </div>
          <button className="text-sm bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded font-semibold text-xs">
            + Add Aircraft
          </button>
        </div>

        {/* Fleet scorecard */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <FleetTile label="Total Fleet"     value={mockFleetSummary.total}              color="text-slate-100" />
          <FleetTile label="Airworthy"       value={mockFleetSummary.airworthy}           color="text-green-400" />
          <FleetTile label="Grounded"        value={mockFleetSummary.grounded}            color="text-red-400" />
          <FleetTile label="MEL Open"        value={mockFleetSummary.melOpen}             color="text-amber-400" />
          <FleetTile label="Open Squawks"    value={mockFleetSummary.openSquawks}         color="text-amber-400" />
          <FleetTile label="Insp Due (30d)"  value={mockFleetSummary.inspectionsDueSoon}  color="text-amber-400" />
        </div>

        {/* Fleet table */}
        <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full" aria-label="Aircraft registry">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                <th className="py-2 px-4 text-left font-medium w-6">AW</th>
                <th className="py-2 px-4 text-left font-medium">Tail #</th>
                <th className="py-2 px-4 text-left font-medium">Make / Model</th>
                <th className="py-2 px-4 text-left font-medium">Type / Yr</th>
                <th className="py-2 px-4 text-left font-medium">Insp Status</th>
                <th className="py-2 px-4 text-left font-medium">Next Due</th>
                <th className="py-2 px-4 text-left font-medium">Airframe</th>
                <th className="py-2 px-4 text-left font-medium">Items</th>
                <th className="py-2 px-4 text-left font-medium">Base</th>
              </tr>
            </thead>
            <tbody>
              {mockAircraft.map((ac) => (
                <AircraftRow
                  key={ac.id}
                  aircraft={ac}
                  isSelected={selectedId === ac.id}
                  onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AircraftDetailDrawer aircraft={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
