// Shared FleetDisplay — display-only fleet grid used by portal pages.
// No store imports, no API calls. Data comes via props.

import { useState } from 'react'
import { STATUS_COLOR, getAircraftPhoto } from './portalConstants'

/**
 * @param {object} props
 * @param {Array} props.fleet — aircraft objects
 * @param {string} props.brand — company name
 * @param {boolean} [props.showPayload] — show simple payload calculator (glider-style)
 * @param {function} [props.onSelect] — aircraft selection handler (ac) => void
 * @param {string} [props.heading] — section heading override
 * @param {string} [props.subtitle] — section subtitle
 * @param {React.ReactNode} [props.children] — extra content below grid
 */
export function FleetDisplay({
  fleet = [],
  brand,
  showPayload = false,
  onSelect,
  heading = 'Our Fleet',
  subtitle,
  children,
}) {
  const [expanded, setExpanded] = useState(null)
  const airworthy = fleet.filter((a) => a.status === 'airworthy').length

  return (
    <section id="sec-fleet" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{heading}</h2>
          {subtitle ? (
            <p className="text-slate-400">{subtitle}</p>
          ) : (
            <p className="text-slate-400">{airworthy} of {fleet.length} aircraft airworthy</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {fleet.map((ac) => {
            const s = STATUS_COLOR[ac.status] || STATUS_COLOR.unknown || { bg: 'bg-surface-card', border: 'border-surface-border', dot: 'bg-slate-400', text: 'text-slate-400', label: ac.status }
            const open = expanded === ac.id
            const photo = getAircraftPhoto(ac.type || ac.makeModel)
            return (
              <div key={ac.id}
                onClick={() => { setExpanded(open ? null : ac.id); onSelect?.(ac) }}
                className={`${s.bg} border ${s.border} rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01]`}>
                {photo && (
                  <div className="h-32 bg-surface">
                    <img src={photo} alt={ac.type || ac.makeModel} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-white text-base font-bold">{ac.type || ac.makeModel}</div>
                      <div className="text-slate-400 text-xs">
                        {ac.tailNumber}
                        {ac.seats ? ` · ${ac.seats}-seat` : ac.passengerCapacity != null ? ` · ${ac.passengerCapacity + 1} seats` : ''}
                        {ac.wing ? ` · ${ac.wing}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                      <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                    </div>
                  </div>
                  {ac.role && <div className="text-slate-300 text-xs mb-1">{ac.role}</div>}
                  {ac.notes && <div className="text-slate-500 text-[11px]">{ac.notes}</div>}
                  {open && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Weight & Balance</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {ac.emptyWeight && <div><span className="text-slate-500">Empty:</span> <span className="text-slate-200">{ac.emptyWeight} lbs</span></div>}
                        {ac.maxGross && <div><span className="text-slate-500">Max gross:</span> <span className="text-slate-200">{ac.maxGross} lbs</span></div>}
                        {ac.maxPayload && <div><span className="text-slate-500">Payload:</span> <span className="text-slate-200">{ac.maxPayload} lbs</span></div>}
                        {ac.wingSpan && <div><span className="text-slate-500">Wingspan:</span> <span className="text-slate-200">{ac.wingSpan}</span></div>}
                        {ac.glideRatio && <div><span className="text-slate-500">L/D:</span> <span className="text-slate-200">{ac.glideRatio}</span></div>}
                        {ac.vne && <div><span className="text-slate-500">Vne:</span> <span className="text-slate-200">{ac.vne} kts</span></div>}
                      </div>
                      {showPayload && ac.maxPayload && <PayloadCalc aircraft={ac} />}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {children}
      </div>
    </section>
  )
}

/* ─── Simple Payload Calculator (glider-style) ─── */
function PayloadCalc({ aircraft }) {
  const [pilotW, setPilotW] = useState('')
  const [paxW, setPaxW] = useState('')
  const total = (Number(pilotW) || 0) + (Number(paxW) || 0)
  const remaining = aircraft.maxPayload - total
  return (
    <div className="mt-3 space-y-2">
      <h4 className="text-slate-400 text-[10px] uppercase tracking-wide">Payload Calculator</h4>
      <div className="flex gap-2">
        <input type="number" placeholder="Pilot (lbs)" value={pilotW} onChange={(e) => setPilotW(e.target.value)} onClick={(e) => e.stopPropagation()}
          className="w-full bg-surface border border-surface-border rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        {aircraft.seats > 1 && (
          <input type="number" placeholder="Pax (lbs)" value={paxW} onChange={(e) => setPaxW(e.target.value)} onClick={(e) => e.stopPropagation()}
            className="w-full bg-surface border border-surface-border rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
        )}
      </div>
      {(pilotW || paxW) && (
        <div className={`text-xs font-medium ${remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
          {remaining < 0 ? `Over by ${Math.abs(remaining)} lbs` : `${remaining} lbs remaining`}
        </div>
      )}
    </div>
  )
}
