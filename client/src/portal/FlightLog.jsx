/**
 * FlightLog — IACRA-categorized log of closed/past flights.
 * Shared between MileHighGliding and JourneysBoulder portals.
 * Shows only closed flights, grouped by IACRA time categories.
 * Uses FlightLogCard for read-only display.
 */

import { useState, useEffect } from 'react'
import { getAllFlights, subscribe } from '../store/flights'
import { FlightLogCard } from './FlightLogCard'
import { PortalIcon } from '../portal'

const IACRA_CATEGORIES = [
  { id: 'dual',       label: 'Dual Received',  icon: '👨‍✈️', filter: (f) => f.missionType === 'training_dual' || f.dualHours > 0 },
  { id: 'solo',       label: 'Solo / PIC',     icon: '🧑‍✈️', filter: (f) => f.missionType === 'training_solo' || f.soloHours > 0 },
  { id: 'xc',         label: 'Cross-Country',  icon: '🗺️',  filter: (f) => f.crossCountry || f.waypoints?.length > 1 || f._sessionLabel?.includes('XC') },
  { id: 'night',      label: 'Night',          icon: '🌙',  filter: (f) => f.nightHours > 0 || f._sessionLabel?.toLowerCase()?.includes('night') },
  { id: 'instrument', label: 'Instrument',     icon: '☁️',  filter: (f) => f.instrumentHours > 0 || f._sessionLabel?.toLowerCase()?.includes('instrument') || f._sessionLabel?.toLowerCase()?.includes('ifr') },
  { id: 'ground',     label: 'Ground Training', icon: '📚', filter: (f) => f.groundHours > 0 || f.missionType === 'ground' },
]

export function FlightLog({ user, operator = 'journeys' }) {
  const [flights, setFlights] = useState(() => getAllFlights())
  useEffect(() => subscribe(setFlights), [])

  // Only closed flights for this user at this operator
  const myFlights = flights.filter((f) => {
    if (f.status !== 'closed') return false
    const isMine = f.picId === user.id || f.sicId === user.id || f._source === `${operator}_portal`
    const isOp = f.operator === operator || f._source === `${operator}_portal`
    return isMine && isOp
  }).sort((a, b) => new Date(b.plannedDepartureUtc) - new Date(a.plannedDepartureUtc))

  // Summary totals
  const totals = {
    total: 0, pic: 0, dual: 0, solo: 0, night: 0, instrument: 0, xc: 0, launches: 0,
  }
  for (const f of myFlights) {
    totals.total      += f.totalHours ?? f._duration ?? 0
    totals.pic        += f.picHours ?? 0
    totals.dual       += f.dualHours ?? 0
    totals.solo       += f.soloHours ?? 0
    totals.night      += f.nightHours ?? 0
    totals.instrument += f.instrumentHours ?? 0
    totals.xc         += f.crossCountryHours ?? 0
    totals.launches   += f._postFlight?.numLaunches ?? f.towInfo?.numTows ?? 0
  }

  return (
    <div>
      <h3 className="text-white text-xl sm:text-2xl font-bold mb-2">Flight Log</h3>

      {myFlights.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-6 text-center">
          <p className="text-slate-500 text-sm">No closed flights yet.</p>
          <p className="text-slate-600 text-xs mt-1">Completed flights will appear here grouped by IACRA categories.</p>
        </div>
      ) : null}

      {/* Summary bar */}
      {myFlights.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[10px] font-mono text-slate-500">
        <span>Total <span className="text-slate-200">{totals.total.toFixed(1)}h</span></span>
        {totals.pic > 0        && <span>PIC <span className="text-slate-200">{totals.pic.toFixed(1)}h</span></span>}
        {totals.dual > 0       && <span>Dual <span className="text-purple-400">{totals.dual.toFixed(1)}h</span></span>}
        {totals.solo > 0       && <span>Solo <span className="text-amber-400">{totals.solo.toFixed(1)}h</span></span>}
        {totals.night > 0      && <span>Night <span className="text-slate-200">{totals.night.toFixed(1)}h</span></span>}
        {totals.instrument > 0 && <span>Inst <span className="text-sky-400">{totals.instrument.toFixed(1)}h</span></span>}
        {totals.xc > 0         && <span>XC <span className="text-slate-200">{totals.xc.toFixed(1)}h</span></span>}
        {totals.launches > 0   && <span>Launches <span className="text-indigo-400">{totals.launches}</span></span>}
        <span className="text-slate-600">· {myFlights.length} flights</span>
      </div>}

      {/* IACRA categories */}
      {IACRA_CATEGORIES.map((cat) => {
        const catFlights = myFlights.filter(cat.filter)
        if (catFlights.length === 0) return null
        const catHrs = catFlights.reduce((sum, f) => sum + (f.totalHours ?? f._duration ?? 0), 0)
        return (
          <details key={cat.id} className="mb-2 group">
            <summary className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors list-none">
              <div className="flex items-center gap-2.5">
                <span className="text-slate-400"><PortalIcon emoji={cat.icon} size={18} /></span>
                <span className="text-white text-sm font-semibold">{cat.label}</span>
                <span className="text-slate-500 text-xs">({catFlights.length})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sky-400 text-sm font-bold">{catHrs.toFixed(1)} hr</span>
                <span className="text-slate-600 text-xs group-open:rotate-90 transition-transform">▸</span>
              </div>
            </summary>
            <div className="mt-1 space-y-1.5 pb-2 pl-2">
              {catFlights.map((f) => (
                <FlightLogCard key={f.id} flight={f} user={user} />
              ))}
            </div>
          </details>
        )
      })}

      {/* Uncategorized flights */}
      {(() => {
        const categorized = new Set()
        for (const cat of IACRA_CATEGORIES) {
          myFlights.filter(cat.filter).forEach((f) => categorized.add(f.id))
        }
        const uncategorized = myFlights.filter((f) => !categorized.has(f.id))
        if (uncategorized.length === 0) return null
        return (
          <details className="mb-2 group">
            <summary className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors list-none">
              <div className="flex items-center gap-2.5">
                <span className="text-slate-400"><PortalIcon emoji="📋" size={18} /></span>
                <span className="text-white text-sm font-semibold">Other</span>
                <span className="text-slate-500 text-xs">({uncategorized.length})</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sky-400 text-sm font-bold">
                  {uncategorized.reduce((s, f) => s + (f.totalHours ?? f._duration ?? 0), 0).toFixed(1)} hr
                </span>
                <span className="text-slate-600 text-xs group-open:rotate-90 transition-transform">▸</span>
              </div>
            </summary>
            <div className="mt-1 space-y-1.5 pb-2 pl-2">
              {uncategorized.map((f) => (
                <FlightLogCard key={f.id} flight={f} user={user} />
              ))}
            </div>
          </details>
        )
      })()}
    </div>
  )
}
