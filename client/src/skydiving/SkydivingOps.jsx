import { useState, useMemo } from 'react'
import {
  DZ_INFO,
  JUMP_PLANES,
  JUMP_PILOTS,
  JUMP_INSTRUCTORS,
  JUMP_PROGRAMS,
  JUMP_PRICING,
  REGULAR_JUMPERS,
  PROSPECTS,
  AFF_STUDENTS,
  DZ_WEATHER_LIMITS,
  getTodayLoads,
} from './skydivingData'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useStickyState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch { return defaultValue }
  })
  const set = (v) => {
    const next = typeof v === 'function' ? v(value) : v
    setValue(next)
    sessionStorage.setItem(key, JSON.stringify(next))
  }
  return [value, set]
}

const LICENSE_COLORS = {
  D: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  C: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  B: { bg: 'bg-sky-500/15',   text: 'text-sky-400',    border: 'border-sky-500/30' },
  A: { bg: 'bg-green-500/15', text: 'text-green-400',  border: 'border-green-500/30' },
}

const CURRENCY_COLORS = {
  current: { dot: 'bg-green-400', label: 'Current' },
  lapsed:  { dot: 'bg-yellow-400', label: 'Lapsed (>30 days)' },
  expired: { dot: 'bg-red-400', label: 'Expired' },
}

const PROSPECT_STATUS_COLORS = {
  new_lead:         { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: 'New Lead' },
  contacted:        { bg: 'bg-sky-500/15',    text: 'text-sky-400',    label: 'Contacted' },
  scheduled:        { bg: 'bg-green-500/15',  text: 'text-green-400',  label: 'Scheduled' },
  voucher_redeemed: { bg: 'bg-amber-500/15',  text: 'text-amber-400',  label: 'Voucher' },
}

function fmtDate(d) {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    airworthy:   { cls: 'text-green-400 border-green-500/30 bg-green-500/10', label: 'Airworthy' },
    maintenance: { cls: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10', label: 'Maintenance' },
    active:      { cls: 'text-green-400 border-green-500/30 bg-green-500/10', label: 'Active' },
  }
  const s = map[status] ?? { cls: 'text-slate-400 border-surface-border bg-surface-card', label: status }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${s.cls}`}>{s.label}</span>
}

// ─── Fleet Tab ───────────────────────────────────────────────────────────────

function FleetTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-200">Jump Plane Fleet</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {JUMP_PLANES.map((p) => (
          <div key={p.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-slate-100 font-semibold text-sm">{p.type}</div>
                <div className="text-xs text-sky-400 font-mono">{p.tailNumber}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="text-xs text-slate-400 mb-3">{p.role}</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div><span className="text-slate-500">Capacity:</span> <span className="text-slate-200">{p.seats} jumpers</span></div>
              <div><span className="text-slate-500">Max Gross:</span> <span className="text-slate-200">{p.maxGross.toLocaleString()} lbs</span></div>
              <div><span className="text-slate-500">Useful Load:</span> <span className="text-slate-200">{p.usefulLoad.toLocaleString()} lbs</span></div>
              <div><span className="text-slate-500">Climb:</span> <span className="text-slate-200">{p.climbRate}</span></div>
              <div><span className="text-slate-500">Jump Door:</span> <span className="text-slate-200">{p.jumpDoor}</span></div>
            </div>
            {p.notes && <div className="text-[10px] text-slate-500 mt-2 italic">{p.notes}</div>}
          </div>
        ))}
      </div>

      {/* Fleet summary */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 text-xs">
        <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-2">Fleet Summary</div>
        <div className="flex flex-wrap gap-6">
          <div><span className="text-slate-500">Total Aircraft:</span> <span className="text-slate-200">{JUMP_PLANES.length}</span></div>
          <div><span className="text-slate-500">Airworthy:</span> <span className="text-green-400">{JUMP_PLANES.filter(p => p.status === 'airworthy').length}</span></div>
          <div><span className="text-slate-500">In Maintenance:</span> <span className="text-yellow-400">{JUMP_PLANES.filter(p => p.status === 'maintenance').length}</span></div>
          <div><span className="text-slate-500">Max Capacity/Load:</span> <span className="text-slate-200">{Math.max(...JUMP_PLANES.filter(p => p.status === 'airworthy').map(p => p.seats))} jumpers</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── Pilots Tab ──────────────────────────────────────────────────────────────

function PilotsTab() {
  return (
    <div className="space-y-6">
      {/* Jump Pilots */}
      <div>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Jump Pilots</h2>
        <div className="grid gap-3">
          {JUMP_PILOTS.map((p) => {
            const qualPlanes = JUMP_PLANES.filter(jp => p.aircraftTypesQual.includes(jp.id))
            return (
              <div key={p.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-slate-100 font-semibold text-sm">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.role}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    {p.uspaRating && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${LICENSE_COLORS[p.uspaRating]?.bg} ${LICENSE_COLORS[p.uspaRating]?.text} ${LICENSE_COLORS[p.uspaRating]?.border}`}>
                        USPA {p.uspaRating}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs mt-2">
                  <div><span className="text-slate-500">Certificate:</span> <span className="text-slate-200">{p.certType}</span></div>
                  <div><span className="text-slate-500">Total Hours:</span> <span className="text-slate-200">{p.totalHours.toLocaleString()}</span></div>
                  <div><span className="text-slate-500">Jump Pilot Hrs:</span> <span className="text-slate-200">{p.jumpPilotHours.toLocaleString()}</span></div>
                  <div><span className="text-slate-500">Own Jumps:</span> <span className="text-slate-200">{p.ownJumps}</span></div>
                  <div><span className="text-slate-500">Medical:</span> <span className="text-slate-200">Class {p.medicalClass} — exp {fmtDate(p.medicalExpiry)}</span></div>
                  <div><span className="text-slate-500">Weight:</span> <span className="text-slate-200">{p.weightLbs} lbs</span></div>
                  <div className="col-span-2"><span className="text-slate-500">Qualified:</span> <span className="text-slate-200">{qualPlanes.map(q => q.type.split(' ').pop()).join(', ')}</span></div>
                </div>
                {p.notes && <div className="text-[10px] text-slate-500 mt-2 italic">{p.notes}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tandem & AFF Instructors */}
      <div>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Tandem & AFF Instructors</h2>
        <div className="grid gap-3">
          {JUMP_INSTRUCTORS.map((inst) => (
            <div key={inst.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-slate-100 font-semibold text-sm">{inst.name}</div>
                  <div className="text-xs text-slate-400">{inst.role}</div>
                </div>
                <StatusBadge status={inst.status} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs mt-2">
                <div><span className="text-slate-500">USPA License:</span> <span className="text-slate-200 font-mono">{inst.uspaLicense}</span></div>
                <div><span className="text-slate-500">Total Jumps:</span> <span className="text-slate-200">{inst.totalJumps.toLocaleString()}</span></div>
                <div><span className="text-slate-500">Tandem Jumps:</span> <span className="text-slate-200">{inst.tandemJumps.toLocaleString()}</span></div>
                <div><span className="text-slate-500">AFF Jumps:</span> <span className="text-slate-200">{inst.affJumps.toLocaleString()}</span></div>
                <div><span className="text-slate-500">Weight:</span> <span className="text-slate-200">{inst.weightLbs} lbs</span></div>
                <div><span className="text-slate-500">Medical:</span> <span className="text-slate-200">exp {fmtDate(inst.medicalExpiry)}</span></div>
                <div className="col-span-2"><span className="text-slate-500">Ratings:</span> <span className="text-slate-200">{inst.ratings.join(', ')}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Jumpers Tab ─────────────────────────────────────────────────────────────

function JumpersTab() {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return REGULAR_JUMPERS
    return REGULAR_JUMPERS.filter(j => j.licenseLevel === filter)
  }, [filter])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Regular Jumpers</h2>
        <div className="flex gap-1">
          {['all', 'D', 'C', 'B', 'A'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                filter === f
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                  : 'border-surface-border text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? 'All' : `${f}-License`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-border text-slate-500 text-left">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">License</th>
              <th className="py-2 pr-3 font-medium">Jumps</th>
              <th className="py-2 pr-3 font-medium">Weight</th>
              <th className="py-2 pr-3 font-medium">Exit Wt</th>
              <th className="py-2 pr-3 font-medium">Canopy</th>
              <th className="py-2 pr-3 font-medium">WL</th>
              <th className="py-2 pr-3 font-medium">Currency</th>
              <th className="py-2 pr-3 font-medium">Last Jump</th>
              <th className="py-2 pr-3 font-medium">Disciplines</th>
              <th className="py-2 font-medium">Gear</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => {
              const lc = LICENSE_COLORS[j.licenseLevel] ?? {}
              const cc = CURRENCY_COLORS[j.currency] ?? CURRENCY_COLORS.expired
              return (
                <tr key={j.id} className="border-b border-surface-border/50 hover:bg-white/[.02]">
                  <td className="py-2 pr-3 text-slate-200 font-medium">{j.name}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${lc.bg} ${lc.text} ${lc.border}`}>
                      {j.licenseLevel}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-200 font-mono">{j.totalJumps.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-slate-300">{j.weightLbs} lbs</td>
                  <td className="py-2 pr-3 text-slate-300">{j.exitWeight} lbs</td>
                  <td className="py-2 pr-3 text-slate-300">{j.canopyType}</td>
                  <td className="py-2 pr-3 text-slate-300 font-mono">{j.wingLoading ?? '--'}</td>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
                      <span className="text-slate-300">{cc.label}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{fmtDate(j.lastJumpDate)}</td>
                  <td className="py-2 pr-3 text-slate-400">{j.disciplines.join(', ')}</td>
                  <td className="py-2 text-slate-400">{j.ownGear ? 'Own' : 'Rental'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['D', 'C', 'B', 'A'].map(level => {
          const count = REGULAR_JUMPERS.filter(j => j.licenseLevel === level).length
          const lc = LICENSE_COLORS[level]
          return (
            <div key={level} className={`rounded-xl border p-3 ${lc.bg} ${lc.border}`}>
              <div className={`text-lg font-bold ${lc.text}`}>{count}</div>
              <div className="text-xs text-slate-400">{level}-License jumpers</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Prospects Tab ───────────────────────────────────────────────────────────

function ProspectsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Prospects & Leads</h2>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
            {PROSPECTS.filter(p => p.status === 'new_lead').length} new
          </span>
          <span className="px-2 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400">
            {PROSPECTS.filter(p => p.status === 'contacted').length} contacted
          </span>
          <span className="px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-400">
            {PROSPECTS.filter(p => p.status === 'scheduled').length} scheduled
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {PROSPECTS.map((p) => {
          const sc = PROSPECT_STATUS_COLORS[p.status] ?? PROSPECT_STATUS_COLORS.new_lead
          return (
            <div key={p.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-slate-100 font-semibold text-sm">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.email} · {p.phone}</div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sc.bg} ${sc.text}`}>
                  {sc.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
                <div><span className="text-slate-500">Interest:</span> <span className="text-slate-200 capitalize">{p.interest.replace('_', ' ')}</span></div>
                <div><span className="text-slate-500">Weight:</span> <span className="text-slate-200">{p.weightLbs} lbs</span></div>
                <div><span className="text-slate-500">Source:</span> <span className="text-slate-200">{p.source}</span></div>
                <div><span className="text-slate-500">Inquired:</span> <span className="text-slate-200">{fmtDate(p.dateInquired)}</span></div>
                {p.completedTandems > 0 && (
                  <div><span className="text-slate-500">Prior Tandems:</span> <span className="text-slate-200">{p.completedTandems}</span></div>
                )}
                {p.scheduledDate && (
                  <div><span className="text-slate-500">Scheduled:</span> <span className="text-green-400">{fmtDate(p.scheduledDate)}</span></div>
                )}
                {p.convertToAFF && (
                  <div className="col-span-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      AFF Candidate
                    </span>
                  </div>
                )}
              </div>
              {p.notes && <div className="text-[10px] text-slate-500 mt-2 italic">{p.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── AFF Students Tab ────────────────────────────────────────────────────────

function StudentsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-200">AFF Students (In-Progress)</h2>
      <div className="grid gap-4">
        {AFF_STUDENTS.map((s) => {
          const instructor = JUMP_INSTRUCTORS.find(i => i.id === s.assignedInstructorId)
          const passedLevels = s.levelHistory.filter(l => l.result === 'pass').length
          const repeats = s.levelHistory.filter(l => l.result === 'repeat').length
          const pctComplete = Math.round((s.currentLevel / 7) * 100)
          return (
            <div key={s.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-slate-100 font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.email} · {s.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400">
                    Level {s.currentLevel}/7
                  </span>
                  <StatusBadge status={s.status} />
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>AFF Progression</span>
                  <span>{pctComplete}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all"
                    style={{ width: `${pctComplete}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                <div><span className="text-slate-500">Weight:</span> <span className="text-slate-200">{s.weightLbs} lbs</span></div>
                <div><span className="text-slate-500">Exit Weight:</span> <span className="text-slate-200">{s.exitWeight} lbs</span></div>
                <div><span className="text-slate-500">Total Jumps:</span> <span className="text-slate-200">{s.totalJumps}</span></div>
                <div><span className="text-slate-500">Freefall:</span> <span className="text-slate-200">{(s.freefallTime * 60).toFixed(0)} min</span></div>
                <div><span className="text-slate-500">Instructor:</span> <span className="text-slate-200">{instructor?.name ?? '--'}</span></div>
                <div><span className="text-slate-500">Enrolled:</span> <span className="text-slate-200">{fmtDate(s.enrolledDate)}</span></div>
                <div><span className="text-slate-500">Levels Passed:</span> <span className="text-green-400">{passedLevels}</span></div>
                <div><span className="text-slate-500">Repeats:</span> <span className={repeats > 0 ? 'text-yellow-400' : 'text-slate-400'}>{repeats}</span></div>
              </div>

              {/* Level history */}
              <div className="mt-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Level History</div>
                <div className="flex flex-wrap gap-1">
                  {s.levelHistory.map((l, i) => (
                    <span
                      key={i}
                      title={`Level ${l.level} — ${l.result} — ${l.notes || 'no notes'}`}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        l.result === 'pass'
                          ? 'border-green-500/30 bg-green-500/10 text-green-400'
                          : 'border-red-500/30 bg-red-500/10 text-red-400'
                      }`}
                    >
                      L{l.level} {l.result === 'pass' ? '✓' : '↻'}
                    </span>
                  ))}
                </div>
              </div>

              {s.notes && <div className="text-[10px] text-slate-500 mt-2 italic">{s.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Programs Tab ────────────────────────────────────────────────────────────

function ProgramsTab() {
  const programs = Object.values(JUMP_PROGRAMS)

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-200">Education & License Programs</h2>

      {/* Training paths */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {programs.map((prog) => (
          <div key={prog.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col">
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg">{prog.icon}</span>
              <div>
                <div className="text-slate-100 font-semibold text-sm">{prog.name}</div>
                {prog.reg && <div className="text-[10px] text-sky-400">{prog.reg}</div>}
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3 flex-1">{prog.description}</p>

            {/* Requirements */}
            {prog.requirements?.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Requirements</div>
                <ul className="space-y-0.5">
                  {prog.requirements.map((r) => (
                    <li key={r.id} className="text-[10px] text-slate-400 flex items-start gap-1">
                      <span className="text-slate-600 mt-0.5">•</span>
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pricing */}
            {prog.pricePerJump && (
              <div className="text-xs"><span className="text-slate-500">Price:</span> <span className="text-green-400">${prog.pricePerJump}/jump</span></div>
            )}
            {prog.pricePerLevel && (
              <div className="text-xs"><span className="text-slate-500">Range:</span> <span className="text-green-400">${prog.pricePerLevel[prog.pricePerLevel.length - 1].price}–${prog.pricePerLevel[0].price}/level</span></div>
            )}
            {prog.typicalCost && (
              <div className="text-xs"><span className="text-slate-500">Typical:</span> <span className="text-slate-300">${prog.typicalCost.min.toLocaleString()}–${prog.typicalCost.avg.toLocaleString()}</span></div>
            )}
            {prog.minJumps && (
              <div className="text-xs"><span className="text-slate-500">Min jumps:</span> <span className="text-slate-300">{prog.minJumps}</span></div>
            )}
          </div>
        ))}
      </div>

      {/* Pricing reference */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4">
        <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-2">Quick Pricing Reference</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
          <div><span className="text-slate-500">Tandem (14k):</span> <span className="text-green-400">${JUMP_PRICING.tandem14k}</span></div>
          <div><span className="text-slate-500">Tandem (18k HALO):</span> <span className="text-green-400">${JUMP_PRICING.tandem18k}</span></div>
          <div><span className="text-slate-500">Fun Jump (full alt):</span> <span className="text-green-400">${JUMP_PRICING.funJumperFull}</span></div>
          <div><span className="text-slate-500">Hop-n-Pop:</span> <span className="text-green-400">${JUMP_PRICING.funJumperHopNPop}</span></div>
          <div><span className="text-slate-500">Video (handcam):</span> <span className="text-slate-300">${JUMP_PRICING.videoHandcam}</span></div>
          <div><span className="text-slate-500">Video (outside):</span> <span className="text-slate-300">${JUMP_PRICING.videoOutside}</span></div>
          <div><span className="text-slate-500">Gear Rental:</span> <span className="text-slate-300">${JUMP_PRICING.gearRentalFull}/day</span></div>
          <div><span className="text-slate-500">Packer Tip:</span> <span className="text-slate-300">${JUMP_PRICING.packerTip}</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── Safety Tab ──────────────────────────────────────────────────────────────

function SafetyTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-200">Weather & Safety Limits</h2>
      <div className="bg-surface-card border border-surface-border rounded-xl p-4">
        <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-3">DZ Weather Limits</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-xs">
          <div>
            <div className="text-slate-500">Max Ground Wind — Students</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.maxWindStudent} kt</div>
          </div>
          <div>
            <div className="text-slate-500">Max Ground Wind — Licensed</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.maxWindLicensed} kt</div>
          </div>
          <div>
            <div className="text-slate-500">Max Ground Wind — Tandem</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.maxWindTandem} kt</div>
          </div>
          <div>
            <div className="text-slate-500">Max Upper Winds</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.maxUpperWinds} kt</div>
          </div>
          <div>
            <div className="text-slate-500">Min Ceiling</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.minCeiling.toLocaleString()} ft AGL</div>
          </div>
          <div>
            <div className="text-slate-500">Min Visibility</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.minVisibility} SM</div>
          </div>
          <div>
            <div className="text-slate-500">Lightning Hold</div>
            <div className="text-slate-200 font-mono text-sm mt-0.5">{DZ_WEATHER_LIMITS.lightningHold} min</div>
          </div>
        </div>
      </div>

      {/* USPA membership stats */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4">
        <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-3">DZ Info</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs">
          <div><span className="text-slate-500">DZ Name:</span> <span className="text-slate-200">{DZ_INFO.name}</span></div>
          <div><span className="text-slate-500">Airport:</span> <span className="text-slate-200">{DZ_INFO.airport}</span></div>
          <div><span className="text-slate-500">USPA Group Member:</span> <span className="text-green-400">{DZ_INFO.uspaNumber}</span></div>
          <div><span className="text-slate-500">Elevation:</span> <span className="text-slate-200">{DZ_INFO.fieldElevation}</span></div>
          <div><span className="text-slate-500">Jump Altitudes:</span> <span className="text-slate-200">{DZ_INFO.jumpAltitudes}</span></div>
          <div><span className="text-slate-500">Hours:</span> <span className="text-slate-200">{DZ_INFO.hours}</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SkydivingOps() {
  const [activeTab, setActiveTab] = useStickyState('skydiving_activeTab', 'overview')
  const ops = useMemo(() => getTodayLoads(), [])

  const airworthy = JUMP_PLANES.filter(p => p.status === 'airworthy').length
  const currentJumpers = REGULAR_JUMPERS.filter(j => j.currency === 'current').length
  const affActive = AFF_STUDENTS.filter(s => s.status === 'active').length

  const tabs = [
    { key: 'overview',  label: 'Overview' },
    { key: 'fleet',     label: `Fleet (${JUMP_PLANES.length})` },
    { key: 'pilots',    label: `Pilots (${JUMP_PILOTS.length + JUMP_INSTRUCTORS.length})` },
    { key: 'jumpers',   label: `Jumpers (${REGULAR_JUMPERS.length})` },
    { key: 'students',  label: `Students (${AFF_STUDENTS.length})` },
    { key: 'prospects', label: `Prospects (${PROSPECTS.length})` },
    { key: 'programs',  label: 'Programs' },
    { key: 'safety',    label: 'Safety' },
  ]

  return (
    <div className="flex flex-col gap-6" data-testid="skydiving-ops">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Skydiving Operations</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Jump plane scheduling, jumper management, and training for {DZ_INFO.airport}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-400">
            {airworthy} planes ready
          </span>
          <span className="text-xs px-2 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400">
            {currentJumpers} active jumpers
          </span>
          {affActive > 0 && (
            <span className="text-xs px-2 py-1 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400">
              {affActive} AFF students
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-surface-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`whitespace-nowrap text-xs px-3 py-2 rounded-t transition-colors ${
              activeTab === t.key
                ? 'bg-surface-card border border-b-0 border-surface-border text-sky-400 font-medium -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab ops={ops} />}
      {activeTab === 'fleet'    && <FleetTab />}
      {activeTab === 'pilots'   && <PilotsTab />}
      {activeTab === 'jumpers'  && <JumpersTab />}
      {activeTab === 'students' && <StudentsTab />}
      {activeTab === 'prospects'&& <ProspectsTab />}
      {activeTab === 'programs' && <ProgramsTab />}
      {activeTab === 'safety'   && <SafetyTab />}
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ ops }) {
  return (
    <div className="space-y-6">
      {/* Live ops strip */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-500 uppercase tracking-wide text-[10px]">Today's Operations</div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            ops.isOperating
              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
              : 'bg-slate-700 text-slate-400 border border-surface-border'
          }`}>
            {ops.isOperating ? 'DZ Open' : 'DZ Closed'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <div className="text-slate-500">Loads Flown</div>
            <div className="text-slate-100 text-lg font-bold font-mono">{ops.loadsFlown} / {ops.loadsPlanned}</div>
          </div>
          <div>
            <div className="text-slate-500">Jumpers Today</div>
            <div className="text-slate-100 text-lg font-bold font-mono">{ops.jumpersToday}</div>
          </div>
          <div>
            <div className="text-slate-500">Tandems Today</div>
            <div className="text-slate-100 text-lg font-bold font-mono">{ops.tandemsToday}</div>
          </div>
          <div>
            <div className="text-slate-500">Planes Flying</div>
            <div className="text-slate-100 text-lg font-bold font-mono">{ops.planesFlying} / {ops.planesTotal}</div>
          </div>
          <div>
            <div className="text-slate-500">Next Load</div>
            <div className="text-slate-100 text-lg font-bold font-mono">{ops.nextLoadEta}</div>
          </div>
        </div>
        <div className="flex gap-6 mt-3 text-xs text-slate-400">
          <span>Ground wind: {ops.windGround}</span>
          <span>Winds aloft: {ops.windAltitude}</span>
          <span>Jump run: {ops.jumpRun}</span>
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <div className="text-xs text-slate-500">Fleet</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{JUMP_PLANES.filter(p => p.status === 'airworthy').length}<span className="text-sm text-slate-500">/{JUMP_PLANES.length}</span></div>
          <div className="text-[10px] text-slate-500 mt-0.5">airworthy aircraft</div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <div className="text-xs text-slate-500">Jump Pilots</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{JUMP_PILOTS.filter(p => p.status === 'active').length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">active pilots</div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <div className="text-xs text-slate-500">Instructors</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{JUMP_INSTRUCTORS.filter(i => i.status === 'active').length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">tandem / AFF instructors</div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <div className="text-xs text-slate-500">Prospects</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{PROSPECTS.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{PROSPECTS.filter(p => p.convertToAFF).length} AFF candidates</div>
        </div>
      </div>

      {/* Recent jumpers needing attention */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4">
        <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-3">Attention Items</div>
        <div className="space-y-2 text-xs">
          {REGULAR_JUMPERS.filter(j => j.currency === 'lapsed').map(j => (
            <div key={j.id} className="flex items-center gap-2 text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span className="text-slate-200">{j.name}</span>
              <span>— currency lapsed ({fmtDate(j.lastJumpDate)}), needs coach jump</span>
            </div>
          ))}
          {AFF_STUDENTS.filter(s => {
            const uspa = s.docs?.uspaMembership
            if (!uspa) return false
            const exp = new Date(uspa.expiry)
            const now = new Date()
            return (exp - now) < 30 * 86400000
          }).map(s => (
            <div key={s.id} className="flex items-center gap-2 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-slate-200">{s.name}</span>
              <span>— USPA membership expiring soon</span>
            </div>
          ))}
          {JUMP_PILOTS.filter(p => {
            const exp = new Date(p.medicalExpiry)
            const now = new Date()
            return (exp - now) < 90 * 86400000
          }).map(p => (
            <div key={p.id} className="flex items-center gap-2 text-orange-400">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="text-slate-200">{p.name}</span>
              <span>— medical expires {fmtDate(p.medicalExpiry)}</span>
            </div>
          ))}
          {JUMP_PLANES.filter(p => p.status === 'maintenance').map(p => (
            <div key={p.id} className="flex items-center gap-2 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-slate-200">{p.tailNumber} ({p.type})</span>
              <span>— in maintenance</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
