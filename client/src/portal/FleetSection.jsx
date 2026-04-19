import { useState, useMemo } from 'react'
import { useAircraftStars } from '../hooks/useAircraftStars'
import { getAircraftByOperator, mockAircraft } from '../mocks/aircraft'
import { addSquawk, getSquawks, subscribeSquawks } from '../store/squawks'
import { addServiceRequest, getServiceRequests } from '../store/serviceRequests'
import { getAllFlights, subscribe } from '../store/flights'
import { STATUS_COLOR, getAircraftPhoto, fmt$ } from './portalConstants'
import { PortalIcon } from './icons'
import { SquawkPanel } from './SquawkPanel'
import { FleetCard } from '../components/shared/FleetCard'

const RENTAL_PDF = 'http://journeysaviation.com/uploads/1/3/2/8/132898297/aircraft_rental_price_list_12.1.2023.pdf'
const WB_CALC_URL = 'https://www.journeysaviation.com/aircraft-fleet.html'

// Compute fuel weight for a given aircraft based on user's fuel mode
function computeFuelForAircraft(ac, fuelMode, fuelHours, fuelMiles) {
  const burn = ac.fuelBurnGalHr || 0
  const kts = ac.cruiseSpeedKts || 100
  const lbsPerGal = ac.weightBalance?.fuelWeightPerGal || 6
  const maxGal = ac.fuelCapacityGal || 0

  let gallonsNeeded = 0
  if (fuelMode === 'hours') {
    gallonsNeeded = (Number(fuelHours) || 0) * burn
  } else {
    // miles → nautical miles → hours → gallons
    const nm = (Number(fuelMiles) || 0) / 1.151
    const hours = nm / kts
    gallonsNeeded = hours * burn
  }
  // Add 45 min VFR reserve
  const reserve = burn * 0.75
  const totalGal = gallonsNeeded + reserve
  const cappedGal = Math.min(totalGal, maxGal)
  const fuelLbs = Math.round(cappedGal * lbsPerGal)
  const exceedsTanks = totalGal > maxGal

  return { gallonsNeeded: Math.round(gallonsNeeded * 10) / 10, reserveGal: Math.round(reserve * 10) / 10, totalGal: Math.round(totalGal * 10) / 10, cappedGal: Math.round(cappedGal * 10) / 10, fuelLbs, exceedsTanks, maxGal }
}

function evaluateAircraft(ac, frontLbs, aftLbs, fuelInfo) {
  const wb = ac.weightBalance || {}
  if (!wb.maxGrossLbs || !wb.emptyWeightLbs) return { status: 'unknown', msg: 'No W&B data' }
  const empty = wb.emptyWeightLbs
  const gross = wb.maxGrossLbs
  const totalWt = empty + frontLbs + aftLbs + fuelInfo.fuelLbs
  const margin = gross - totalWt
  const usefulLoad = gross - empty
  const stationIssues = []
  const stations = wb.stations || {}
  if (stations.frontSeats?.maxWeightLbs && frontLbs > stations.frontSeats.maxWeightLbs) stationIssues.push(`Front seats: ${frontLbs} > ${stations.frontSeats.maxWeightLbs} max`)
  if (stations.aftSeats?.maxWeightLbs && aftLbs > stations.aftSeats.maxWeightLbs) stationIssues.push(`Aft seats: ${aftLbs} > ${stations.aftSeats.maxWeightLbs} max`)

  if (fuelInfo.exceedsTanks) stationIssues.push(`Fuel needed ${fuelInfo.totalGal} gal > ${fuelInfo.maxGal} gal capacity`)

  if (margin < 0) return { status: 'over', msg: `${Math.abs(margin)} lbs over gross`, totalWt, margin, usefulLoad, stationIssues }
  if (margin < 50) return { status: 'tight', msg: `Only ${margin} lbs margin`, totalWt, margin, usefulLoad, stationIssues }
  if (stationIssues.length > 0) return { status: 'warn', msg: `${margin} lbs margin — see warnings`, totalWt, margin, usefulLoad, stationIssues }
  return { status: 'ok', msg: `${margin} lbs margin`, totalWt, margin, usefulLoad, stationIssues }
}

const EVAL_STYLE = {
  ok:      { ring: 'ring-green-400/40', bg: 'bg-green-400/8', border: 'border-green-400/30', badge: 'bg-green-400/20 text-green-400', label: '✓ Good' },
  tight:   { ring: 'ring-amber-400/40', bg: 'bg-amber-400/8', border: 'border-amber-400/30', badge: 'bg-amber-400/20 text-amber-400', label: '⚠ Tight' },
  warn:    { ring: 'ring-amber-400/40', bg: 'bg-amber-400/8', border: 'border-amber-400/30', badge: 'bg-amber-400/20 text-amber-400', label: '⚠ Check' },
  over:    { ring: 'ring-red-400/40',   bg: 'bg-red-400/8',   border: 'border-red-400/30',   badge: 'bg-red-400/20 text-red-400',     label: '✗ Over' },
  unknown: { ring: '',                  bg: 'bg-surface-card', border: 'border-surface-border', badge: 'bg-slate-400/20 text-slate-400', label: '—' },
}

export function MyFleetSection({ user, onSquawk, operator = 'journeys', maintenancePhone }) {
  const extraOwned = (() => { try { return JSON.parse(localStorage.getItem(`journeys_owned_${user?.id}`) || '[]') } catch { return [] } })()
  const owned = [...(user?.ownedAircraft || []), ...extraOwned.filter((a) => !(user?.ownedAircraft || []).some((o) => o.tail === a.tail))]
  if (owned.length === 0) return null
  const allSquawks = getSquawks()
  const allServiceReqs = getServiceRequests()

  return (
    <section id="sec-my-aircraft" className="py-12 px-6 bg-gradient-to-b from-purple-950/20 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">My Aircraft</h2>
          <p className="text-slate-400 text-sm">{owned.length} registered{maintenancePhone ? ` · Maintenance: ${maintenancePhone}` : ''}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {owned.map((ac) => {
            const openSquawks = allSquawks.filter((s) => s.tailNumber === ac.tail && s.status !== 'closed')
            const closedSquawks = allSquawks.filter((s) => s.tailNumber === ac.tail && s.status === 'closed')
            const reqs = allServiceReqs.filter((r) => r.tailNumber === ac.tail)
            const scheduled = reqs.filter((r) => r.status === 'requested' || r.status === 'scheduled')
            const inProgress = reqs.filter((r) => ['in_progress', 'parts_on_order', 'diagnosis', 'awaiting_parts'].includes(r.status))
            const completed = reqs.filter((r) => r.status === 'completed')
            const hasGrounding = openSquawks.some((s) => s.severity === 'grounding')
            const totalItems = openSquawks.length + scheduled.length + inProgress.length

            return (
              <div key={ac.tail} className={`bg-surface-card border rounded-2xl p-5 ${hasGrounding ? 'border-red-400/30' : 'border-purple-400/20'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white text-lg font-bold">🛩️ {ac.tail}</div>
                    <div className="text-slate-400 text-xs">{ac.type}</div>
                    {ac.agents && <div className="text-slate-500 text-[10px] mt-0.5">{ac.agents.join(', ')}</div>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    hasGrounding ? 'bg-red-400/20 text-red-400' : openSquawks.length > 0 ? 'bg-amber-400/20 text-amber-400' : 'bg-green-400/20 text-green-400'
                  }`}>
                    {hasGrounding ? 'GROUNDED' : openSquawks.length > 0 ? `${openSquawks.length} squawk${openSquawks.length > 1 ? 's' : ''}` : 'Clean'}
                  </span>
                </div>

                {/* Open squawks */}
                {openSquawks.map((s) => (
                  <details key={s.id} className={`rounded-lg mb-1 border ${s.severity === 'grounding' ? 'bg-red-400/8 border-red-400/20' : 'bg-amber-400/5 border-amber-400/15'}`}>
                    <summary className="flex items-start gap-2 text-xs px-3 py-2 cursor-pointer">
                      <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${s.severity === 'grounding' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <span className="text-slate-200 flex-1">{s.description}</span>
                      <span className={`text-[10px] font-medium ${s.severity === 'grounding' ? 'text-red-400' : 'text-amber-400'}`}>{s.severity}</span>
                    </summary>
                    <div className="px-3 pb-2 text-[10px] text-slate-500 space-y-0.5 ml-4">
                      <div>Reported: {s.reportedDate} by {s.reportedBy}</div>
                      {s.melReference && <div>MEL: {s.melReference} · Expires: {s.melExpiryDate || 'N/A'}</div>}
                      {s.workOrderId && <div>Work Order: {s.workOrderId}</div>}
                      {s.airframeHours && <div>Airframe hours: {s.airframeHours}</div>}
                    </div>
                  </details>
                ))}

                {/* Scheduled */}
                {scheduled.map((r) => (
                  <details key={r.id} className="rounded-lg mb-1 border bg-sky-400/5 border-sky-400/15">
                    <summary className="flex items-center gap-2 text-xs px-3 py-2 cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span className="text-slate-200 flex-1 capitalize">{r.type?.replace(/_/g, ' ')}</span>
                      <span className="text-sky-400 text-[10px]">{r.preferredDate || 'Requested'}</span>
                    </summary>
                    <div className="px-3 pb-2 text-[10px] text-slate-500 space-y-0.5 ml-4">
                      <div>Requested: {r.requestedDate} by {r.requestedBy}</div>
                      {r.description && <div>Details: {r.description}</div>}
                      {r.notes && <div>Notes: {r.notes}</div>}
                    </div>
                  </details>
                ))}

                {/* In-progress */}
                {inProgress.map((r) => (
                  <details key={r.id} className="rounded-lg mb-1 border bg-amber-400/5 border-amber-400/15">
                    <summary className="flex items-center justify-between text-xs px-3 py-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-slate-200 capitalize">{r.type?.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-amber-400 text-[10px] font-medium capitalize">{r.status?.replace(/_/g, ' ')}</span>
                    </summary>
                    <div className="px-3 pb-2 text-[10px] text-slate-500 space-y-0.5 ml-4">
                      <div>Requested: {r.requestedDate} by {r.requestedBy}</div>
                      {r.description && <div>Details: {r.description}</div>}
                      {r.notes && <div>Notes: {r.notes}</div>}
                      <div>Status: <span className="text-amber-400 capitalize">{r.status?.replace(/_/g, ' ')}</span></div>
                    </div>
                  </details>
                ))}

                {/* Closed squawks */}
                {closedSquawks.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-green-400/60 text-[10px] cursor-pointer">Resolved squawks ({closedSquawks.length})</summary>
                    <div className="mt-1 space-y-0.5">
                      {closedSquawks.map((s) => (
                        <details key={s.id} className="rounded-lg border border-green-400/10 bg-green-400/[0.03]">
                          <summary className="flex items-center gap-2 text-[10px] text-slate-500 px-3 py-1.5 cursor-pointer">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                            <span className="flex-1">{s.description}</span>
                            <span className="text-green-400/50">{s.resolvedDate || s.reportedDate}</span>
                          </summary>
                          <div className="px-3 pb-1.5 text-[10px] text-slate-600 space-y-0.5 ml-4">
                            <div>Reported: {s.reportedDate} by {s.reportedBy}</div>
                            {s.resolvedBy && <div>Resolved: {s.resolvedDate} by {s.resolvedBy}</div>}
                            {s.resolutionNotes && <div>Resolution: {s.resolutionNotes}</div>}
                            {s.workOrderId && <div>Work Order: {s.workOrderId}</div>}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                )}

                {/* Completed service requests */}
                {completed.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-green-400/60 text-[10px] cursor-pointer">Completed maintenance ({completed.length})</summary>
                    <div className="mt-1 space-y-0.5">
                      {completed.map((r) => (
                        <details key={r.id} className="rounded-lg border border-green-400/10 bg-green-400/[0.03]">
                          <summary className="flex items-center gap-2 text-[10px] text-slate-500 px-3 py-1.5 cursor-pointer">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                            <span className="flex-1 capitalize">{r.type?.replace(/_/g, ' ')}</span>
                            <span className="text-green-400/50">{r.requestedDate}</span>
                          </summary>
                          <div className="px-3 pb-1.5 text-[10px] text-slate-600 space-y-0.5 ml-4">
                            <div>Requested: {r.requestedDate} by {r.requestedBy}</div>
                            {r.description && <div>Details: {r.description}</div>}
                            {r.notes && <div>Notes: {r.notes}</div>}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                )}

                {totalItems === 0 && closedSquawks.length === 0 && completed.length === 0 && (
                  <p className="text-slate-600 text-[10px]">No maintenance history</p>
                )}

                {/* Annual recommendation */}
                {(() => {
                  const annuals = reqs.filter((r) => r.type === 'annual_inspection')
                  const lastAnnual = annuals.find((r) => r.status === 'completed')
                  const pendingAnnual = annuals.find((r) => r.status === 'requested' || r.status === 'scheduled' || r.status === 'in_progress')
                  const lastDate = lastAnnual?.requestedDate ? new Date(lastAnnual.requestedDate) : null
                  const monthsSince = lastDate ? Math.round((Date.now() - lastDate.getTime()) / (30 * 86400000)) : 999
                  const needsAnnual = monthsSince >= 9 && !pendingAnnual
                  if (!needsAnnual) return null
                  return (
                    <div className="mt-2 bg-sky-400/8 border border-sky-400/20 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📋</span>
                        <div>
                          <div className="text-sky-400 text-xs font-semibold">Annual inspection recommended</div>
                          <div className="text-slate-500 text-[10px]">{lastDate ? `Last: ${lastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${monthsSince} months ago)` : 'No annual on record'}</div>
                        </div>
                      </div>
                      <button onClick={() => {
                          addServiceRequest({ id: `sr-ann-${Date.now()}`, type: 'annual_inspection', tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator, notes: `Annual inspection recommended — ${monthsSince >= 12 ? 'OVERDUE' : 'due soon'}. ${ac.tail} (${ac.type})` })
                        }}
                        className="text-[10px] text-sky-400 bg-sky-400/15 border border-sky-400/25 px-3 py-1.5 rounded-lg hover:bg-sky-400/25 transition-colors font-medium flex-shrink-0">
                        Schedule
                      </button>
                    </div>
                  )
                })()}

                {/* Action buttons + quick services */}
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => { onSquawk?.(ac.tail); setTimeout(() => document.getElementById('sec-squawk')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded-xl text-[10px] font-medium transition-all border border-amber-500/20">
                      Squawk
                    </button>
                    <button onClick={() => {
                        addServiceRequest({ id: `sr-mx-${Date.now()}`, type: 'annual_inspection', tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator, notes: `Annual inspection for ${ac.tail} (${ac.type})` })
                        alert('Annual inspection requested for ' + ac.tail)
                      }}
                      className="flex-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 py-2 rounded-xl text-[10px] font-medium transition-all border border-sky-500/20">
                      📋 Annual
                    </button>
                    <button onClick={() => {
                        addServiceRequest({ id: `sr-mx-${Date.now()}`, type: '100hr_inspection', tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator, notes: `100-hour inspection for ${ac.tail} (${ac.type})` })
                        alert('100-hr inspection requested for ' + ac.tail)
                      }}
                      className="flex-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 py-2 rounded-xl text-[10px] font-medium transition-all border border-sky-500/20">
                      📋 100hr
                    </button>
                  </div>
                  {/* Quick FBO services */}
                  <details>
                    <summary className="text-slate-400 text-[10px] cursor-pointer hover:text-slate-200">⛽ Quick Service Order {ac.fuelType ? `(${ac.fuelType})` : ''}</summary>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        { id: 'fuel', label: `⛽ ${ac.fuelType || '100LL'} top-off` },
                        { id: 'tiedown', label: '🔗 Tie-down' },
                        { id: 'hangar', label: '🏠 Hangar' },
                        { id: 'preheat', label: '🔥 Preheat' },
                        { id: 'lavatory', label: '🚻 Lav' },
                        { id: 'oxygen', label: '💨 O₂' },
                        { id: 'deice', label: '❄️ De-ice' },
                        { id: 'gpu', label: '🔌 GPU' },
                        { id: 'cleaning', label: '🧽 Clean' },
                      ].map((svc) => {
                        const isDefault = (ac.defaultServices || []).includes(svc.id)
                        return (
                          <button key={svc.id} onClick={() => {
                              addServiceRequest({ id: `sr-svc-${Date.now()}-${svc.id}`, type: svc.id, tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator, notes: `${svc.label} for ${ac.tail}` })
                            }}
                            className={`px-2 py-1 rounded text-[10px] transition-all border ${isDefault ? 'bg-purple-400/15 border-purple-400/30 text-purple-300' : 'bg-surface border-surface-border text-slate-500 hover:border-slate-400 hover:text-slate-200'}`}>
                            {svc.label}
                          </button>
                        )
                      })}
                    </div>
                  </details>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function FleetSection({ user, onBookAircraft, onSquawk, squawkVersion, operator = 'journeys' }) {
  const fleet = getAircraftByOperator(operator)
  const [expanded, setExpanded] = useState(null)
  const [stars, setStar] = useAircraftStars()
  // Live squawk data for each aircraft
  const allSquawks = getSquawks()
  const squawksByTail = useMemo(() => {
    const map = {}
    fleet.forEach((ac) => {
      map[ac.tailNumber] = allSquawks.filter((s) => s.tailNumber === ac.tailNumber && s.status !== 'closed')
    })
    return map
  }, [fleet, allSquawks, squawkVersion])
  const [frontSeats, setFrontSeats] = useState('')
  const [aftSeats, setAftSeats] = useState('')
  const [fuelMode, setFuelMode] = useState('hours')  // 'hours' | 'miles'
  const [fuelHours, setFuelHours] = useState('3')
  const [fuelMiles, setFuelMiles] = useState('')

  const frontLbs = Number(frontSeats) || 0
  const aftLbs = Number(aftSeats) || 0
  const hasInput = frontLbs > 0 || aftLbs > 0

  return (
    <section id="sec-fleet" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Fleet & Weight Balance</h2>
          <p className="text-slate-400">{fleet.length} aircraft — enter your mission below to see which aircraft work</p>
          <div className="flex gap-3 justify-center mt-4">
            <a href={RENTAL_PDF} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
              Rental Price List PDF ↗
            </a>
            <a href={WB_CALC_URL} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
              W&B Calculator (Excel) ↗
            </a>
          </div>
        </div>

        {/* ── Universal W&B Input Form ── */}
        <div className="bg-surface-card border border-sky-400/20 rounded-2xl p-6 mb-8 shadow-lg shadow-sky-500/5">
          <h3 className="text-white font-bold text-sm mb-4">Mission Planner — Enter your load, see which aircraft fit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Front Seats (lbs)</label>
              <input type="number" placeholder="e.g. 340" value={frontSeats} onChange={(e) => setFrontSeats(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              <div className="text-slate-600 text-[10px] mt-1">Pilot + front passenger</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Rear Seats (lbs)</label>
              <input type="number" placeholder="e.g. 0" value={aftSeats} onChange={(e) => setAftSeats(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              <div className="text-slate-600 text-[10px] mt-1">Rear passengers (0 for 2-seat)</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Fuel — {fuelMode === 'hours' ? 'Hours' : 'Distance (mi)'}</label>
              {fuelMode === 'hours' ? (
                <input type="number" placeholder="3" value={fuelHours} onChange={(e) => setFuelHours(e.target.value)} step="0.5" min="0"
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              ) : (
                <input type="number" placeholder="e.g. 200" value={fuelMiles} onChange={(e) => setFuelMiles(e.target.value)} min="0"
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              )}
              <div className="text-slate-600 text-[10px] mt-1">+ 45 min VFR reserve auto-added</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Fuel Mode</label>
              <div className="flex gap-2 h-[46px]">
                <button onClick={() => setFuelMode('hours')}
                  className={`flex-1 rounded-xl text-sm font-medium transition-all ${fuelMode === 'hours' ? 'bg-sky-500 text-white' : 'bg-surface border border-surface-border text-slate-400 hover:text-white'}`}>
                  Hours
                </button>
                <button onClick={() => setFuelMode('miles')}
                  className={`flex-1 rounded-xl text-sm font-medium transition-all ${fuelMode === 'miles' ? 'bg-sky-500 text-white' : 'bg-surface border border-surface-border text-slate-400 hover:text-white'}`}>
                  Miles
                </button>
              </div>
              <div className="text-slate-600 text-[10px] mt-1">{fuelMode === 'hours' ? 'Flight time at cruise' : 'Statute miles one-way'}</div>
            </div>
          </div>
          {hasInput && (
            <div className="mt-4 pt-3 border-t border-surface-border flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Front: <strong className="text-slate-200">{frontLbs} lbs</strong></span>
              <span>Rear: <strong className="text-slate-200">{aftLbs} lbs</strong></span>
              <span>Fuel: <strong className="text-slate-200">{fuelMode === 'hours' ? `${fuelHours || 0} hrs` : `${fuelMiles || 0} mi`} + 45 min reserve</strong></span>
            </div>
          )}
        </div>

        {/* ── Fleet cards — colored by W&B evaluation ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {fleet.map((ac) => {
            const wb = ac.weightBalance || {}
            const rates = ac.rentalRates || {}
            const rp = ac.riskProfile || {}
            const fuelInfo = computeFuelForAircraft(ac, fuelMode, fuelHours, fuelMiles)
            const evaluation = hasInput ? evaluateAircraft(ac, frontLbs, aftLbs, fuelInfo) : null
            const es = evaluation ? EVAL_STYLE[evaluation.status] : EVAL_STYLE.unknown
            const usefulLoad = wb.maxGrossLbs && wb.emptyWeightLbs ? wb.maxGrossLbs - wb.emptyWeightLbs : null
            const stationEntries = wb.stations ? Object.entries(wb.stations) : []
            const open = expanded === ac.id

            // Live grounding check from squawks
            const acSquawks = squawksByTail[ac.tailNumber] || []
            const hasGroundingSquawk = acSquawks.some((s) => s.severity === 'grounding')
            const isGrounded = !ac.airworthy || hasGroundingSquawk
            const openSquawkCount = acSquawks.length

            // Evaluation-based card styling override
            const evalStatus = hasInput && evaluation
              ? { bg: es.bg, border: es.border, dot: 'bg-slate-400', text: 'text-slate-400', label: '' }
              : isGrounded
                ? { bg: 'bg-red-400/8', border: 'border-red-400/30', dot: 'bg-red-400', text: 'text-red-400', label: 'Grounded' }
                : undefined  // use default STATUS_COLOR

            return (
              <FleetCard
                key={ac.id}
                aircraft={ac}
                name={ac.makeModel}
                expanded={open}
                onToggle={() => setExpanded(open ? null : ac.id)}
                statusColors={evalStatus}
                className={hasInput && evaluation ? `ring-1 ${es.ring}` : ''}
                renderSpecs={() => (
                  <>
                    <span> · {ac.passengerCapacity + 1} seats{ac.year ? ` · ${ac.year}` : ''}</span>
                    {/* W&B eval summary — always visible when mission input is active */}
                    {hasInput && evaluation && evaluation.status !== 'unknown' && (
                      <div className={`rounded-lg p-2.5 mt-2 text-xs ${es.bg} border ${es.border}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Gross: <strong className="text-white">{evaluation.totalWt?.toLocaleString()} / {wb.maxGrossLbs?.toLocaleString()} lbs</strong></span>
                          <span className={`font-bold ${evaluation.margin >= 0 ? (evaluation.margin < 50 ? 'text-amber-400' : 'text-green-400') : 'text-red-400'}`}>
                            {evaluation.margin >= 0 ? `+${evaluation.margin}` : evaluation.margin} lbs
                          </span>
                        </div>
                        <div className="text-slate-500 text-[10px] mt-1">
                          Fuel: {fuelInfo.cappedGal} gal ({fuelInfo.fuelLbs} lbs) incl. 45 min reserve
                          {fuelInfo.exceedsTanks && <span className="text-red-400 ml-1">— exceeds {fuelInfo.maxGal} gal tank capacity!</span>}
                        </div>
                        {evaluation.stationIssues.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {evaluation.stationIssues.map((iss, i) => (
                              <div key={i} className="text-amber-400 text-[10px]">⚠ {iss}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Rate details */}
                    {rates.member != null && (
                      <div className="text-slate-500 text-[10px] mt-1">
                        Member ${rates.member} · Pre-pay ${rates.prepay} · Non-mbr ${rates.nonMember} / {rates.unit || 'hr'}
                      </div>
                    )}
                    {/* Equipment tags */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ac.equipment?.ifrCertified && <span className="text-[9px] bg-sky-400/15 text-sky-400 px-1.5 py-0.5 rounded">IFR</span>}
                      {ac.equipment?.autopilot && <span className="text-[9px] bg-sky-400/15 text-sky-400 px-1.5 py-0.5 rounded">AP</span>}
                      {ac.equipment?.glassPanel && <span className="text-[9px] bg-sky-400/15 text-sky-400 px-1.5 py-0.5 rounded">Glass</span>}
                      {ac.equipment?.adsbOut && <span className="text-[9px] bg-slate-400/15 text-slate-400 px-1.5 py-0.5 rounded">ADS-B</span>}
                      {rp.highPerformance && <span className="text-[9px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded">HP</span>}
                      {rp.taildragger && <span className="text-[9px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded">TW</span>}
                      {ac.soloInsuranceReq && <span className="text-[9px] bg-slate-400/15 text-slate-500 px-1.5 py-0.5 rounded">Solo: {ac.soloInsuranceReq}</span>}
                    </div>
                    {/* Compact specs */}
                    <div className="text-slate-500 text-[10px] mt-1">
                      {ac.cruiseSpeedKts} kts · {ac.fuelBurnGalHr} gal/hr · {ac.fuelCapacityGal} gal
                      {usefulLoad && ` · ${usefulLoad} lbs useful`}
                    </div>
                  </>
                )}
                renderHeaderRight={() => (
                  <div className="text-right flex-shrink-0 ml-3">
                    {user && (
                      <div className="flex gap-0 mb-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        {[1, 2, 3].map((s) => (
                          <button key={s} onClick={() => setStar(ac.tailNumber, (stars[ac.tailNumber] || 0) === s ? 0 : s)}
                            className={`text-sm leading-none transition-all hover:scale-125 ${s <= (stars[ac.tailNumber] || 0) ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}>★</button>
                        ))}
                      </div>
                    )}
                    {rates.member != null && <div className="text-green-400 font-bold text-lg">${rates.member}</div>}
                    {hasInput && evaluation ? (
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${es.badge}`}>{es.label}</span>
                    ) : (
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`w-2 h-2 rounded-full ${isGrounded ? 'bg-red-400' : openSquawkCount > 0 ? 'bg-amber-400' : 'bg-green-400'}`} />
                        <span className={`text-[10px] font-medium ${isGrounded ? 'text-red-400' : openSquawkCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          {isGrounded ? 'GROUNDED' : openSquawkCount > 0 ? `${openSquawkCount} squawk${openSquawkCount > 1 ? 's' : ''}` : 'Airworthy'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                renderDetail={wb.maxGrossLbs ? () => (
                      <div className="space-y-3">
                        {acSquawks.length > 0 && (
                          <div className="mb-3">
                            <h4 className={`text-[10px] uppercase tracking-wide mb-1 ${hasGroundingSquawk ? 'text-red-400 font-bold' : 'text-amber-400'}`}>
                              {hasGroundingSquawk ? '⚠ GROUNDED' : 'Open Squawks'} ({acSquawks.length})
                            </h4>
                            {acSquawks.map((s) => (
                              <div key={s.id} className={`text-[10px] px-2 py-1 rounded mb-0.5 border ${s.severity === 'grounding' ? 'bg-red-400/10 border-red-400/20 text-red-300' : 'bg-amber-400/5 border-amber-400/15 text-slate-300'}`}>
                                {s.description} <span className="text-slate-500">· {s.severity} · {s.reportedDate}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <h4 className="text-slate-400 text-[10px] uppercase tracking-wide">Full Weight & Balance</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">Empty wt:</span> <span className="text-slate-200">{wb.emptyWeightLbs?.toLocaleString()} lbs</span></div>
                          <div><span className="text-slate-500">Max gross:</span> <span className="text-slate-200">{wb.maxGrossLbs?.toLocaleString()} lbs</span></div>
                          <div><span className="text-slate-500">Useful load:</span> <span className="text-slate-200">{usefulLoad} lbs</span></div>
                          <div><span className="text-slate-500">Fuel capacity:</span> <span className="text-slate-200">{ac.fuelCapacityGal} gal</span></div>
                          <div><span className="text-slate-500">Burn rate:</span> <span className="text-slate-200">{ac.fuelBurnGalHr} gal/hr</span></div>
                          <div><span className="text-slate-500">Cruise:</span> <span className="text-slate-200">{ac.cruiseSpeedKts} kts TAS</span></div>
                        </div>
                        {rp.notes && <div className="text-slate-500 text-[10px] italic">{rp.notes}</div>}
                        {stationEntries.length > 0 && (
                          <div className="space-y-0.5">
                            <h4 className="text-slate-500 text-[10px] uppercase tracking-wide">Loading Stations</h4>
                            {stationEntries.map(([name, st]) => (
                              <div key={name} className="flex justify-between text-[10px]">
                                <span className="text-slate-400">{name}</span>
                                <span className="text-slate-300">{st.arm != null ? `Arm ${st.arm}" · ` : ''}{st.maxWeightLbs ? `Max ${st.maxWeightLbs} lbs` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {wb.cgLimits && <div className="text-[10px] text-slate-500">CG range: {wb.cgLimits.forwardIn}" – {wb.cgLimits.aftIn}"</div>}
                        {user && (
                          <button onClick={(e) => { e.stopPropagation(); onSquawk?.(ac.tailNumber); setTimeout(() => document.getElementById('sec-squawk')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
                            className="mt-2 w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded-xl text-xs transition-all border border-amber-500/20">
                            Report Squawk — {ac.tailNumber}
                          </button>
                        )}
                      </div>
                ) : undefined}
                renderActions={user && !isGrounded && ac.fboCategory !== 'sim' ? () => (
                  <button onClick={(e) => {
                      e.stopPropagation()
                      onBookAircraft?.(ac)
                      setTimeout(() => document.getElementById('sec-schedule')?.scrollIntoView({ behavior: 'smooth' }), 100)
                    }}
                    className="w-full bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-all border border-sky-500/30 hover:border-sky-500">
                    Book {ac.tailNumber} →
                  </button>
                ) : undefined}
              />
            )
          })}
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">W&B values are type-cert typical — consult aircraft POH for actual. Fuel calculation assumes cruise burn + 45 min VFR reserve.</p>
      </div>
    </section>
  )
}
