import { useState } from 'react'
import { addSquawk, getSquawks } from '../store/squawks'

/**
 * Squawk reporting panel — works for any operator / aircraft.
 *
 * @param {string}   tailNumber       - Aircraft tail number
 * @param {Object}   user             - { name, ... }
 * @param {string}   aircraftLabel    - e.g. "Schweizer SGS 2-32" (optional description)
 * @param {Function} onClose
 */
export function SquawkPanel({ tailNumber, user, aircraftLabel, onClose }) {
  const [severity, setSeverity] = useState('monitoring')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const allSquawks = getSquawks()
  const recentSquawks = allSquawks.filter((s) => s.tailNumber === tailNumber).slice(0, 8)
  const openSquawks = recentSquawks.filter((s) => s.status !== 'closed')
  const closedSquawks = recentSquawks.filter((s) => s.status === 'closed').slice(0, 3)

  const handleSubmit = () => {
    if (!description.trim()) return
    addSquawk({
      id: `sqk-${Date.now()}`, tailNumber,
      reportedBy: user.name,
      reportedDate: new Date().toISOString().split('T')[0],
      reportedAt: new Date().toISOString(),
      description: description.trim(), severity, status: 'open',
      melReference: null, melExpiryDate: null, airframeHours: null,
      resolvedDate: null, resolvedBy: null, resolutionNotes: null, workOrderId: null,
    })
    setSubmitted(true)
    setTimeout(() => { setSubmitted(false); setDescription(''); setSeverity('monitoring') }, 2000)
  }

  return (
    <section id="sec-squawk" className="py-10 px-4 sm:px-6 bg-gradient-to-b from-amber-950/20 via-surface to-surface animate-[fadeIn_0.3s_ease]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Squawk — {tailNumber}</h2>
            <p className="text-slate-400 text-sm">{aircraftLabel || 'Aircraft'} · Report an issue or review squawks</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition-colors">×</button>
        </div>

        {openSquawks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2">Open ({openSquawks.length})</h3>
            <div className="space-y-1.5">
              {openSquawks.map((s) => (
                <div key={s.id} className={`flex items-start gap-3 text-sm rounded-xl px-4 py-3 border ${
                  s.severity === 'grounding' ? 'bg-red-400/8 border-red-400/20' : s.severity === 'ops_limiting' ? 'bg-amber-400/8 border-amber-400/20' : 'bg-surface border-surface-border'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                    s.severity === 'grounding' ? 'bg-red-400' : s.severity === 'ops_limiting' ? 'bg-amber-400' : s.severity === 'deferred' ? 'bg-yellow-400' : 'bg-slate-400'
                  }`} />
                  <div className="flex-1">
                    <div className="text-slate-200">{s.description}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.reportedDate} · {s.severity} · {s.reportedBy}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {closedSquawks.length > 0 && (
          <details className="mb-6">
            <summary className="text-green-400/60 text-xs cursor-pointer mb-1">Recent resolved ({closedSquawks.length})</summary>
            {closedSquawks.map((s) => (
              <div key={s.id} className="text-xs text-slate-600 px-4 py-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                {s.description} — {s.resolvedDate || s.reportedDate}
              </div>
            ))}
          </details>
        )}

        {submitted ? (
          <div className="bg-green-400/10 border border-green-400/20 rounded-2xl p-6 text-center animate-[fadeIn_0.3s_ease]">
            <div className="w-6 h-6 rounded-full border-2 border-green-400/50 flex items-center justify-center text-green-400 text-xs font-bold mb-2 mx-auto">✓</div>
            <div className="text-green-400 font-semibold">Squawk submitted for {tailNumber}</div>
            <div className="text-slate-500 text-xs mt-1">Maintenance will review within 24 hours</div>
          </div>
        ) : (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-bold text-base">New Squawk</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { v: 'grounding', l: 'Grounding', color: 'red' },
                { v: 'ops_limiting', l: 'Ops Limiting', color: 'amber' },
                { v: 'deferred', l: 'Deferred / MEL', color: 'yellow' },
                { v: 'monitoring', l: 'Monitoring', color: 'slate' },
              ].map((s) => (
                <button key={s.v} onClick={() => setSeverity(s.v)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all border ${
                    severity === s.v
                      ? `bg-${s.color}-400/20 border-${s.color}-400/40 text-${s.color}-400`
                      : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'
                  }`}>
                  {s.l}
                </button>
              ))}
            </div>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue — what did you observe? When? During what phase of flight?"
              className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-400 focus:outline-none resize-none" />
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">Reporting as {user.name}</span>
              <div className="flex gap-2">
                <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-4 py-2.5 rounded-xl border border-surface-border transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={!description.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors">
                  Submit Squawk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
