import { useState, useEffect } from 'react'
import { PortalIcon } from './icons'

/**
 * Airport operations / field conditions dashboard.
 *
 * @param {Function}  getOps       - Returns current ops object {isOpen, fieldElevation, runwayInUse, windDir, windSpeed, temp, ...}
 * @param {string}    title        - Section heading
 * @param {string}    openLabel    - Text shown when operating
 * @param {string}    closedLabel  - Text shown when closed
 * @param {Array}     weatherLinks - [{label, url}] for external weather links
 * @param {Array}     fields       - [{label, key, icon}] to display — uses `key` on the ops object
 *                                   If omitted, displays a default set
 * @param {Function}  children     - Extra content rendered below the grid (e.g. tow plane status)
 */
export function AirportOps({ getOps, title = 'Current Operations', openLabel, closedLabel, weatherLinks = [], fields, children }) {
  const [ops, setOps] = useState(getOps)
  useEffect(() => { const id = setInterval(() => setOps(getOps()), 60000); return () => clearInterval(id) }, [getOps])

  const isOpen = ops.isOpen ?? ops.isOperating ?? false

  const defaultFields = [
    { label: 'Field', key: 'fieldElevation', icon: '⛰️' },
    { label: 'Runway', key: 'runwayInUse', icon: '🛬' },
    { label: 'Wind', value: `${ops.windDir} @ ${ops.windSpeed}`, icon: '💨' },
    { label: 'Temp', key: 'temp', icon: '🌡️' },
  ]
  const displayFields = fields || defaultFields

  return (
    <section id="sec-operations" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <span className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            {title}
          </h2>
          <p className="text-slate-400">
            {isOpen ? (openLabel || 'Operations active') : (closedLabel || 'Operations closed — check back during daylight hours')}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {displayFields.map((item) => (
            <div key={item.label} className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
              <div className="flex justify-center mb-1.5 text-slate-400"><PortalIcon emoji={item.icon} size={20} /></div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wide">{item.label}</div>
              <div className="text-white text-sm font-bold mt-1">{item.value ?? ops[item.key] ?? '--'}</div>
            </div>
          ))}
        </div>
        {weatherLinks.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center">
            {weatherLinks.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
                {l.label} ↗
              </a>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
