// Shared FleetDisplay — display-only fleet grid used by portal pages.
// No store imports, no API calls. Data comes via props.

import { useState } from 'react'
import { FleetCard } from '../components/shared/FleetCard'

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
  heading = 'Fleet',
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
          {fleet.map((ac) => (
            <FleetCard
              key={ac.id}
              aircraft={ac}
              expanded={expanded === ac.id}
              onToggle={() => { setExpanded(expanded === ac.id ? null : ac.id); onSelect?.(ac) }}
              renderSpecs={(a) => (
                <>
                  {a.seats ? ` · ${a.seats}-seat` : a.passengerCapacity != null ? ` · ${a.passengerCapacity + 1} seats` : ''}
                  {a.wing ? ` · ${a.wing}` : ''}
                </>
              )}
              renderDetail={(a) => (
                <>
                  <h4 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Weight & Balance</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {a.emptyWeight && <div><span className="text-slate-500">Empty:</span> <span className="text-slate-200">{a.emptyWeight} lbs</span></div>}
                    {a.maxGross && <div><span className="text-slate-500">Max gross:</span> <span className="text-slate-200">{a.maxGross} lbs</span></div>}
                    {a.maxPayload && <div><span className="text-slate-500">Payload:</span> <span className="text-slate-200">{a.maxPayload} lbs</span></div>}
                    {a.wingSpan && <div><span className="text-slate-500">Wingspan:</span> <span className="text-slate-200">{a.wingSpan}</span></div>}
                    {a.glideRatio && <div><span className="text-slate-500">L/D:</span> <span className="text-slate-200">{a.glideRatio}</span></div>}
                    {a.vne && <div><span className="text-slate-500">Vne:</span> <span className="text-slate-200">{a.vne} kts</span></div>}
                  </div>
                  {showPayload && a.maxPayload && <PayloadCalc aircraft={a} />}
                </>
              )}
            />
          ))}
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
