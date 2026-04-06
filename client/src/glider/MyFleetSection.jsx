import { useState } from 'react'
import { JB_INFO } from './journeysBoulderData'
import { getSquawks } from '../store/squawks'
import { addServiceRequest, getServiceRequests } from '../store/serviceRequests'

export function MyFleetSection({ user, onSquawk, operator = 'journeys' }) {
  const extraOwned = (() => { try { return JSON.parse(sessionStorage.getItem(`journeys_owned_${user?.id}`) || '[]') } catch { return [] } })()
  const owned = [...(user?.ownedAircraft || []), ...extraOwned.filter((a) => !(user?.ownedAircraft || []).some((o) => o.tail === a.tail))]
  if (owned.length === 0) return null
  const allSquawks = getSquawks()
  const allServiceReqs = getServiceRequests()

  return (
    <section id="sec-my-aircraft" className="py-12 px-6 bg-gradient-to-b from-purple-950/20 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">My Aircraft</h2>
          <p className="text-slate-400 text-sm">{owned.length} registered · Maintenance: {JB_INFO.maintenancePhone}</p>
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
