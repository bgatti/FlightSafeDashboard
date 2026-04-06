/**
 * FlightLogCard — read-only flight log entry for closed/past flights.
 * Shared between MileHighGliding and JourneysBoulder portals.
 * Shows IACRA-relevant data: hours, ACS tasks, tow info, PIREP, route.
 * No interactive elements (no squawk form, no NASA report, no close button).
 */

import { useState } from 'react'
import { mockAircraft } from '../mocks/aircraft'
import { getAircraftPhoto, PortalIcon } from '../portal'

export function FlightLogCard({ flight, user }) {
  const [expanded, setExpanded] = useState(false)
  const f = flight
  const pf = f._postFlight
  const dep = new Date(f.plannedDepartureUtc)
  const ac = mockAircraft.find((a) => a.tailNumber === f.tailNumber)
  const photo = getAircraftPhoto(ac?.makeModel)

  // Time values
  const billedHrs = pf?.realHours || pf?.hobbsTime || f._duration || f.totalHours
  const billedLabel = pf?.billingMode === 'real_hour' ? 'real hr' : pf?.billingMode === 'tach' ? 'tach' : 'hr'
  const launches = pf?.numLaunches || f.towInfo?.numTows
  const rating = pf?.rating ? '★'.repeat(pf.rating) + '☆'.repeat(5 - pf.rating) : null
  const acsResults = pf?.acsResults
  const acsCount = acsResults ? Object.values(acsResults).filter(Boolean).length : 0
  const topic = f._sessionLabel?.includes('—') ? f._sessionLabel.split('—').slice(1).join('—').trim() : null
  const isGlider = f.categoryClass === 'Glider' || ac?.fboCategory === 'glider' || f.aircraftType?.match(/S33|AS21|G103|DIS2|ASW|DG/)
  const isDual = f.missionType === 'training_dual'
  const isSolo = f.missionType === 'training_solo'

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card/50 overflow-hidden transition-all">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        {/* Aircraft photo */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-card flex-shrink-0">
          {photo
            ? <img src={photo} alt={f.tailNumber} loading="lazy" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-slate-600 text-lg">{isGlider ? '🪂' : '✈'}</div>
          }
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <span className="text-slate-100 text-sm font-semibold truncate">
              {topic || f._sessionLabel || `${f.departure ?? ''}→${f.arrival ?? ''}` || f.tailNumber}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-500 flex-wrap">
            <span className="font-mono">{f.tailNumber}</span>
            {f.pic && <span>PIC: {f.pic}</span>}
            {billedHrs && <span className="text-sky-400 font-medium">{billedHrs} {billedLabel}</span>}
            {launches && <span className="text-indigo-400">{launches} tow{launches > 1 ? 's' : ''}</span>}
            {acsCount > 0 && <span className="text-green-400">{acsCount} ACS ✓</span>}
            {rating && <span className="text-amber-400">{rating}</span>}
          </div>
        </div>

        {/* Date + category badge */}
        <div className="flex-shrink-0 text-right">
          <div className="text-slate-500 text-[10px]">{dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div className="flex items-center gap-1.5 mt-0.5 justify-end">
            {f.categoryClass && <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono">{f.categoryClass}</span>}
            {isDual && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">Dual</span>}
            {isSolo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">Solo</span>}
          </div>
        </div>

        <span className="text-slate-600 text-xs flex-shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-border pt-3 space-y-3 animate-[fadeIn_0.2s_ease]">

          {/* IACRA time breakdown */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2">
            <TimeField label="Total" value={f.totalHours ?? billedHrs} />
            <TimeField label="PIC" value={f.picHours} />
            <TimeField label="SIC" value={f.sicHours} />
            <TimeField label="Dual Rcvd" value={f.dualHours} />
            <TimeField label="Solo" value={f.soloHours} />
            <TimeField label="Night" value={f.nightHours} />
            <TimeField label="Instrument" value={f.instrumentHours} />
            {f.crossCountry && <TimeField label="XC" value={f.crossCountryHours ?? '✓'} unit="" />}
            {launches != null && <TimeField label="Launches" value={launches} unit="" />}
            {f.groundHours != null && <TimeField label="Ground" value={f.groundHours} />}
          </div>

          {/* Tach/Hobbs */}
          {(pf?.tachStart || pf?.hobbsStart) && (
            <div className="flex gap-4 text-[10px] text-slate-500">
              {pf.tachStart && pf.tachEnd && <span>Tach: {pf.tachStart} → {pf.tachEnd}</span>}
              {pf.hobbsStart && pf.hobbsEnd && <span>Hobbs: {pf.hobbsStart} → {pf.hobbsEnd}</span>}
            </div>
          )}

          {/* Flight details */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {f.departure && f.arrival && f.departure !== f.arrival && (
              <div><span className="text-slate-600">Route </span><span className="text-slate-300 font-mono">{f.departure} → {f.arrival}</span></div>
            )}
            {f.flightPurpose && <div><span className="text-slate-600">Purpose </span><span className="text-slate-400 capitalize">{f.flightPurpose.replace(/_/g, ' ')}</span></div>}
            {f.stageName && <div><span className="text-slate-600">Stage </span><span className="text-slate-300">{f.stageName}</span></div>}
            {f.state && <div><span className="text-slate-600">State </span><span className="text-slate-400">{f.state}</span></div>}
            {f.instrumentActual && <div><span className="text-slate-600">IMC </span><span className="text-red-400">Actual</span></div>}
            {f.endorsementType && <div><span className="text-slate-600">Endorsement </span><span className="text-amber-400 capitalize">{f.endorsementType.replace(/_/g, ' ')}</span></div>}
          </div>

          {/* Instructor / crew */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {f.pic && <div><span className="text-slate-600">{isDual ? 'Instructor' : 'PIC'} </span><span className="text-slate-300">{f.pic}</span></div>}
            {f.sic && <div><span className="text-slate-600">{isDual ? 'Student' : 'SIC'} </span><span className="text-slate-300">{f.sic}</span></div>}
            {pf?.closedBy && <div><span className="text-slate-600">Closed by </span><span className="text-slate-400">{pf.closedBy}</span></div>}
          </div>

          {/* ACS tasks completed */}
          {acsResults && acsCount > 0 && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">ACS Tasks — Meets Standards</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(acsResults).filter(([, v]) => v).map(([task]) => (
                  <span key={task} className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 border border-green-400/20 text-green-400">
                    ✓ {task}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Maneuvers covered (from IACRA fields) */}
          {Array.isArray(f.maneuversCovered) && f.maneuversCovered.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Maneuvers</div>
              <div className="text-xs text-slate-400">{f.maneuversCovered.join(', ')}</div>
            </div>
          )}

          {/* Route / waypoints */}
          {f.waypoints?.length > 1 && (
            <div className="text-[10px] text-sky-400/60">Route: {f.waypoints.join(' → ')}</div>
          )}
          {pf?.route && <div className="text-[10px] text-sky-400/60">Route: {pf.route}</div>}

          {/* Flight notes */}
          {pf?.flightNotes && (
            <div className="text-xs text-slate-500 italic border-l-2 border-slate-700 pl-2">"{pf.flightNotes}"</div>
          )}

          {/* Tow info for gliders */}
          {isGlider && f.towInfo && (
            <div className="flex gap-3 text-[10px] text-slate-500">
              {f.towInfo.towHeights?.map((h, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/15 text-indigo-400">
                  Tow {i + 1}: {h.toLocaleString()} ft
                </span>
              ))}
            </div>
          )}

          {/* PIREP summary (if filed during close-out) */}
          {pf?.pirep && (
            <div className="bg-amber-400/5 border border-amber-400/15 rounded-xl px-3 py-2">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wide mb-1">PIREP Filed</div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                {pf.pirep.turbulence && <span>Turb: {pf.pirep.turbulence}</span>}
                {pf.pirep.icing && <span>Icing: {pf.pirep.icing}</span>}
                {pf.pirep.altitude && <span>Alt: {pf.pirep.altitude}</span>}
                {pf.pirep.visibility && <span>Low vis</span>}
                {pf.pirep.other && <span>{pf.pirep.other}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TimeField({ label, value, unit = 'h' }) {
  const show = value != null && value !== false && value !== 0
  return (
    <div className={show ? '' : 'opacity-25'}>
      <div className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</div>
      <div className={`text-xs font-mono ${show ? 'text-slate-200' : 'text-slate-700'}`}>
        {show ? (typeof value === 'number' ? `${value}${unit}` : value) : '—'}
      </div>
    </div>
  )
}
