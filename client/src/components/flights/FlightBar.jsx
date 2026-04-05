import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { RiskChecklist, AckProgressChip } from './RiskChecklist'
import { mockPersonnel } from '../../mocks/personnel'
import { mockAircraft } from '../../mocks/aircraft'
import { updateFlight, addFlight } from '../../store/flights'
import { estimateFlightDuration, estimateEta, formatHours, CRUISE_SPEEDS_KTS } from '../../lib/flightCalc'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(utc)
dayjs.extend(relativeTime)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDep(iso) {
  if (!iso) return '—'
  const diff = dayjs(iso).diff(dayjs(), 'minute')
  if (diff < -60)  return `Dep ${Math.abs(Math.round(diff / 60))}h ago`
  if (diff < 0)    return 'Enroute'
  if (diff < 60)   return `+${diff}m`
  return `+${Math.round(diff / 60)}h`
}

/** Large-format departure countdown: "Departs in 2:35" or "Departed 1:20 ago" or "Airborne" */
function depCountdown(iso, status) {
  if (!iso) return { text: '--', sub: '' }
  if (status === 'completed') return { text: 'Completed', sub: '' }
  const diffMin = dayjs(iso).diff(dayjs(), 'minute')
  if (status === 'active' || (diffMin < 0 && diffMin > -10)) {
    return { text: 'Airborne', sub: '' }
  }
  if (diffMin < 0) {
    const absMins = Math.abs(diffMin)
    const h = Math.floor(absMins / 60)
    const m = absMins % 60
    return { text: h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `0:${String(m).padStart(2, '0')}`, sub: 'ago' }
  }
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return { text: h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `0:${String(m).padStart(2, '0')}`, sub: diffMin <= 30 ? 'soon' : '' }
}

function riskColor(ratio, disq) {
  if (disq) return 'text-red-400'
  if (!ratio) return 'text-slate-500'
  if (ratio >= 4)  return 'text-purple-400'
  if (ratio >= 2)  return 'text-red-400'
  if (ratio >= 1.5) return 'text-orange-400'
  if (ratio >= 1)  return 'text-yellow-400'
  return 'text-green-400'
}

function riskBg(ratio) {
  if (!ratio) return 'bg-slate-700/20'
  if (ratio >= 4)  return 'bg-purple-500/10'
  if (ratio >= 2)  return 'bg-red-500/10'
  if (ratio >= 1.5) return 'bg-orange-500/10'
  if (ratio >= 1)  return 'bg-yellow-500/10'
  return 'bg-green-500/10'
}

function TrendBadge({ trend, delta }) {
  if (!trend || trend === 'stable') return null
  const up = trend === 'increasing'
  return (
    <span className={`text-xs font-mono ${up ? 'text-red-400' : 'text-green-400'}`}>
      {up ? '↑' : '↓'}{delta != null ? ` ${delta > 0 ? '+' : ''}${delta.toFixed(2)}×` : ''}
    </span>
  )
}

const PART_BADGE_STYLES = {
  '135': 'text-sky-400   border-sky-500/40   bg-sky-500/10',
  '91':  'text-amber-400 border-amber-500/40 bg-amber-500/10',
  '61':  'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
}

function PartBadge({ part }) {
  const p = part ?? '135'
  return (
    <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-mono hidden sm:block ${PART_BADGE_STYLES[p] ?? 'text-slate-500 border-slate-600'}`}>
      Pt {p}
    </span>
  )
}

function StatusDot({ status }) {
  const cls =
    status === 'active'    ? 'bg-green-400 animate-pulse' :
    status === 'completed' ? 'bg-slate-600'                :
    status === 'cancelled' ? 'bg-red-500'                  :
    'bg-sky-400'
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} title={status} />
}

// ─── Mini terrain chart (from captured snapshot) ──────────────────────────────

function MiniTerrain({ terrainProfile }) {
  if (!terrainProfile?.profile?.length) return null
  const profile = terrainProfile.profile

  const chartData = profile.map((pt) => ({
    nm:     Math.round(pt.distNm * 10) / 10,
    elevFt: pt.elevFt != null && pt.elevFt > -900 ? pt.elevFt : null,
    label:  pt.label ?? null,
  }))
  const hasData = chartData.some((p) => p.elevFt != null)
  if (!hasData) return null

  const maxElevFt = terrainProfile.maxElevFt ?? 0
  const yMax = Math.ceil(Math.max(maxElevFt, 5000) / 5000) * 5000 + 2000

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-slate-600 uppercase tracking-widest">Terrain (captured at scheduling)</div>
      <div className="flex gap-4 text-xs text-slate-500 mb-1">
        <span>Max: <span className="text-amber-400 font-mono">{maxElevFt.toLocaleString()} ft</span></span>
        <span>Route: <span className="text-slate-400 font-mono">{terrainProfile.routeDistNm} nm</span></span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="terrainGradMini" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#92400e" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#78350f" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="nm" tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={(v) => `${v}nm`} interval="preserveStartEnd" tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} domain={[0, yMax]} width={28} tickLine={false} />
          <Area type="monotone" dataKey="elevFt" stroke="#92400e" fill="url(#terrainGradMini)" strokeWidth={1} dot={false} connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

const PILOTS = mockPersonnel.filter((p) => p.role?.startsWith('pilot'))
const AIRCRAFT_LIST = mockAircraft.filter((a) => a.airworthy)

function EditPanel({ flight, onSave, onCancel }) {
  const [pic,  setPic]  = useState(flight.picId ?? '')
  const [sic,  setSic]  = useState(flight.sicId ?? '')
  const [tail, setTail] = useState(flight.tailNumber ?? '')
  const [pax,  setPax]  = useState(String(flight.passengers ?? 1))
  const [time, setTime] = useState(
    flight.plannedDepartureUtc
      ? dayjs(flight.plannedDepartureUtc).utc().format('YYYY-MM-DDTHH:mm')
      : ''
  )
  const [mission, setMission] = useState(flight.missionType ?? 'charter')

  function save() {
    const picPilot = PILOTS.find((p) => p.id === pic)
    const sicPilot = PILOTS.find((p) => p.id === sic)
    onSave({
      picId: pic || null,
      sicId: sic || null,
      pic: picPilot ? `${picPilot.name.split(' ')[1]}, ${picPilot.name[0]}.` : flight.pic,
      sic: sicPilot ? `${sicPilot.name.split(' ')[1]}, ${sicPilot.name[0]}.` : null,
      tailNumber: tail,
      callsign: tail,
      passengers: parseInt(pax) || 1,
      plannedDepartureUtc: time ? new Date(time + 'Z').toISOString() : flight.plannedDepartureUtc,
      missionType: mission,
    })
  }

  const inputCls = 'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 w-full'

  return (
    <div className="flex flex-col gap-3 border border-sky-500/20 bg-sky-500/5 rounded p-3">
      <div className="text-xs text-sky-400 font-medium">Edit Flight</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">PIC</label>
          <select value={pic} onChange={(e) => setPic(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {PILOTS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.certType})</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">SIC</label>
          <select value={sic} onChange={(e) => setSic(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {PILOTS.filter((p) => p.id !== pic).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Aircraft</label>
          <select value={tail} onChange={(e) => setTail(e.target.value)} className={inputCls}>
            {AIRCRAFT_LIST.map((a) => <option key={a.id} value={a.tailNumber}>{a.tailNumber} — {a.makeModel}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Departure (UTC)</label>
          <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Passengers</label>
          <input type="number" min="0" max="20" value={pax} onChange={(e) => setPax(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Mission</label>
          <select value={mission} onChange={(e) => setMission(e.target.value)} className={inputCls}>
            {['charter', 'training', 'positioning', 'cargo', 'ferry'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="text-xs px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition-colors">
          Save Changes
        </button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-slate-200 rounded transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Snapshot weather summary ────────────────────────────────────────────────

function WeatherSummary({ weatherSummary }) {
  if (!weatherSummary) return null
  const { flightCategory: cat, sigmetCount: sig, airmetCount: air } = weatherSummary
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {cat && (
        <span className={`px-2 py-0.5 rounded border font-mono ${
          cat === 'VFR'  ? 'text-green-400 border-green-500/30 bg-green-500/10' :
          cat === 'MVFR' ? 'text-blue-400  border-blue-500/30  bg-blue-500/10'  :
          cat === 'IFR'  ? 'text-red-400   border-red-500/30   bg-red-500/10'   :
                           'text-purple-400 border-purple-500/30 bg-purple-500/10'
        }`}>{cat}</span>
      )}
      {sig > 0 && <span className="px-2 py-0.5 rounded border text-red-300 border-red-500/30 bg-red-500/10">{sig} SIGMET{sig > 1 ? 's' : ''}</span>}
      {air > 0 && <span className="px-2 py-0.5 rounded border text-amber-300 border-amber-500/30 bg-amber-500/10">{air} AIRMET{air > 1 ? 's' : ''}</span>}
      {!cat && sig === 0 && air === 0 && <span className="text-slate-600">No weather data captured</span>}
    </div>
  )
}

// ─── FlightBar (exported) ─────────────────────────────────────────────────────

/**
 * The main flight card component — collapsed + expandable.
 *
 * Props:
 *   flight       - flight record (see store schema)
 *   currentUser  - { id, name, shortName, role, isChiefPilot }
 *   recalculating - bool — showing stale / recalculating indicator
 */
export function FlightBar({ flight, currentUser, recalculating, conflicts = [] }) {
  const [expanded,        setExpanded]        = useState(false)
  const [editing,         setEditing]         = useState(false)
  const [returnScheduled, setReturnScheduled] = useState(false)

  const hasConflicts     = conflicts.length > 0
  const pilotConflicts   = conflicts.filter((c) => c.type.startsWith('pilot'))
  const aircraftConflicts = conflicts.filter((c) => c.type.startsWith('aircraft'))

  const snap      = flight.riskSnapshot
  const ratio     = snap?.ratioToBaseline ?? (flight.riskScore ? flight.riskScore / 25 : null)
  const trend     = snap?.riskTrend ?? 'stable'
  const delta     = snap?.riskDelta ?? 0
  const items     = snap?.riskItems ?? []
  const depTime   = dayjs(flight.plannedDepartureUtc).utc()
  const isPIC     = currentUser?.id === flight.picId
  const isStale   = snap?.lastCheckedAt
    ? Date.now() - new Date(snap.lastCheckedAt).getTime() > 15 * 60_000
    : false

  function handleSave(updates) {
    updateFlight(flight.id, updates)
    setEditing(false)
  }

  const ratioCls = riskColor(ratio)

  return (
    <div className={`bg-surface-card border rounded-lg transition-colors ${
      hasConflicts
        ? 'border-orange-500/40'
        : expanded ? 'border-sky-500/30' : 'border-surface-border hover:border-slate-600'
    }`}>
      {/* ── Collapsed row ── */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 flex-wrap"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <StatusDot status={flight.status} />

        {/* Tail + type */}
        <div className="flex-shrink-0 w-20">
          <div className="text-sm font-mono font-bold text-slate-100">{flight.callsign}</div>
          <div className="text-xs text-slate-500">{flight.aircraftType}</div>
        </div>

        {/* Route + departure countdown */}
        <div className="flex-1 min-w-[140px] flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-mono text-slate-200">{flight.departure} → {flight.arrival}</div>
            <div className="text-xs text-slate-500">{depTime.format('MMM D HH:mm[Z]')}</div>
          </div>
          {/* Large departure countdown */}
          {(() => {
            const cd = depCountdown(flight.plannedDepartureUtc, flight.status)
            const diffMin = dayjs(flight.plannedDepartureUtc).diff(dayjs(), 'minute')
            const isUrgent = diffMin >= 0 && diffMin <= 30
            const isPast = diffMin < 0 && flight.status !== 'active'
            return (
              <div className={`flex-shrink-0 text-right min-w-[70px] ${isPast ? 'opacity-60' : ''}`}>
                <div className={`text-lg font-bold font-mono leading-tight ${
                  flight.status === 'active' ? 'text-green-400' :
                  flight.status === 'completed' ? 'text-slate-500' :
                  isUrgent ? 'text-amber-400' :
                  isPast ? 'text-slate-500' :
                  'text-slate-100'
                }`}>{cd.text}</div>
                <div className={`text-[10px] ${
                  flight.status === 'active' ? 'text-green-500' :
                  flight.status === 'completed' ? 'text-slate-600' :
                  isPast ? 'text-slate-600' :
                  isUrgent ? 'text-amber-500' : 'text-slate-500'
                }`}>
                  {flight.status === 'active' ? '' : flight.status === 'completed' ? '' : isPast ? 'dep ago' : cd.sub || 'departs in'}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Crew */}
        <div className="flex-shrink-0 min-w-[100px]">
          <div className="text-xs text-slate-300">{flight.pic ?? '—'}</div>
          {flight.sic && <div className="text-xs text-slate-500">{flight.sic}</div>}
        </div>

        {/* Pax */}
        {flight.passengers != null && (
          <div className="flex-shrink-0 text-xs text-center w-10">
            <div className="text-slate-300">{flight.passengers}</div>
            <div className="text-slate-600">pax</div>
          </div>
        )}

        {/* Conflict chip */}
        {hasConflicts && (
          <div className="flex-shrink-0 flex flex-col gap-0.5">
            {pilotConflicts.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400">
                ⚠ {pilotConflicts.length} pilot
              </span>
            )}
            {aircraftConflicts.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400">
                ⚠ {aircraftConflicts.length} a/c
              </span>
            )}
          </div>
        )}

        {/* Risk ratio + trend */}
        <div className="flex-shrink-0 flex flex-col gap-0.5 min-w-[80px]">
          {ratio != null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-mono font-bold ${ratioCls}`}>{ratio.toFixed(2)}×</span>
                <TrendBadge trend={trend} delta={delta} />
              </div>
              <div className={`h-1.5 rounded-full ${riskBg(ratio)} overflow-hidden`}>
                <div
                  className={`h-full rounded-full ${
                    ratio >= 4 ? 'bg-purple-400' : ratio >= 2 ? 'bg-red-400' : ratio >= 1.5 ? 'bg-orange-400' : ratio >= 1 ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${Math.min(100, (ratio / 4) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          )}
          {isStale && !recalculating && (
            <span className="text-[9px] text-yellow-600 animate-pulse">⚠ stale</span>
          )}
          {recalculating && (
            <span className="text-[9px] text-slate-500 animate-pulse">recalc…</span>
          )}
        </div>

        {/* Ack progress */}
        {items.length > 0 && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <AckProgressChip flightId={flight.id} totalItems={items.length} currentUserIsPIC={isPIC} />
          </div>
        )}

        {/* Mission badge */}
        {flight._flightType === 'deadhead'
          ? <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 border border-slate-600 text-slate-400 font-mono hidden sm:block">DH</span>
          : flight.missionType === 'parachute_ops'
          ? <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-400 hidden sm:block">§105 Para</span>
          : <span className="flex-shrink-0 text-[10px] text-slate-600 capitalize hidden sm:block">{flight.missionType}</span>
        }

        {/* Part badge */}
        <PartBadge part={flight.part} />

        {/* Maintenance required flag (sim-generated) */}
        {flight._requiresMaintenance && (
          <span
            className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-mono"
            title={flight._maintenanceSquawk ?? 'Post-flight maintenance required'}
          >
            MX REQ
          </span>
        )}

        <span className="flex-shrink-0 text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-border pt-4 flex flex-col gap-5">

          {/* Maintenance squawk banner (sim-generated, 5% of flights) */}
          {flight._requiresMaintenance && flight._maintenanceSquawk && (
            <div className="px-3 py-2 rounded bg-red-950/40 border border-red-800/40 text-xs flex items-start gap-2">
              <span className="text-red-400 font-mono font-bold flex-shrink-0">MX SQUAWK</span>
              <span className="text-red-300">{flight._maintenanceSquawk}</span>
            </div>
          )}

          {/* Mission details + edit toggle */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex gap-6 flex-wrap text-xs">
              <div><span className="text-slate-600">Mission </span><span className="text-slate-300 capitalize">{flight.missionType === 'parachute_ops' ? 'Parachute Ops (§105)' : flight.missionType}</span></div>
              <div><span className="text-slate-600">Dep </span><span className="text-slate-300 font-mono">{depTime.format('YYYY-MM-DD HH:mm[Z]')}</span></div>
              <div><span className="text-slate-600">PIC </span><span className="text-slate-300">{flight.pic ?? '—'}</span></div>
              {flight.sic && <div><span className="text-slate-600">SIC </span><span className="text-slate-300">{flight.sic}</span></div>}
              {flight.passengers != null && <div><span className="text-slate-600">Pax </span><span className="text-slate-300">{flight.passengers}</span></div>}
            </div>
            {flight.picId && (  // only user-scheduled flights support edit
              <button
                onClick={() => setEditing((v) => !v)}
                className="text-xs px-2 py-1 border border-slate-700 text-slate-400 hover:text-sky-400 hover:border-sky-500/40 rounded transition-colors flex-shrink-0"
              >
                {editing ? 'Cancel edit' : 'Edit…'}
              </button>
            )}
          </div>

          {editing && <EditPanel flight={flight} onSave={handleSave} onCancel={() => setEditing(false)} />}

          {/* ── Parachute ops details ── */}
          {flight.jumpInfo && (() => {
            const ji = flight.jumpInfo
            const manifest = ji.manifest ?? []
            const totalExit = manifest.reduce((s, m) => s + m.exitWeight, 0)
            const jumpTypeLabels = { tandem: 'Tandem', fun_jump: 'Fun Jump', aff: 'AFF', hop_n_pop: 'Hop-n-Pop', formation: 'Formation' }
            return (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-pink-500 uppercase tracking-widest">Parachute Operations — FAR §105</div>
                <div className="flex gap-6 flex-wrap text-xs">
                  <div><span className="text-slate-600">Jump Type </span><span className="text-pink-300 font-medium">{jumpTypeLabels[ji.jumpType] ?? ji.jumpType}</span></div>
                  <div><span className="text-slate-600">Exit Alt </span><span className="text-slate-200 font-mono">{ji.jumpAltitudeFt?.toLocaleString()} ft</span></div>
                  {ji.jumpMasterName && <div><span className="text-slate-600">Jump Master </span><span className="text-slate-200">{ji.jumpMasterName}</span></div>}
                  <div><span className="text-slate-600">Load </span><span className="text-slate-200 font-mono">#{ji.loadNumber || '--'}</span></div>
                  <div><span className="text-slate-600">Manifest </span><span className="text-slate-200">{manifest.length} jumpers</span></div>
                  <div><span className="text-slate-600">Total exit wt </span><span className="text-slate-200 font-mono">{totalExit.toLocaleString()} lbs</span></div>
                </div>
                {manifest.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs mt-1">
                      <thead>
                        <tr className="border-b border-surface-border text-slate-500 text-left">
                          <th className="py-1 pr-2 font-medium w-6">#</th>
                          <th className="py-1 pr-3 font-medium">Name</th>
                          <th className="py-1 pr-3 font-medium">Slot</th>
                          <th className="py-1 pr-3 font-medium">License</th>
                          <th className="py-1 pr-3 font-medium text-right">Body</th>
                          <th className="py-1 font-medium text-right">Exit Wt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manifest.map((m, i) => (
                          <tr key={i} className="border-b border-surface-border/40">
                            <td className="py-1 pr-2 text-slate-500 font-mono">{i + 1}</td>
                            <td className="py-1 pr-3 text-slate-200">{m.name}</td>
                            <td className="py-1 pr-3 text-slate-400">{m.slot?.replace(/-/g, ' ')}</td>
                            <td className="py-1 pr-3 text-slate-400 font-mono">{m.licenseLevel}</td>
                            <td className="py-1 pr-3 text-right text-slate-300 font-mono">{m.weightLbs}</td>
                            <td className="py-1 text-right text-slate-200 font-mono">{m.exitWeight}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-surface-border">
                          <td colSpan={4} className="py-1 text-slate-500 font-medium">Total</td>
                          <td className="py-1 pr-3 text-right text-slate-300 font-mono">{manifest.reduce((s, m) => s + m.weightLbs, 0).toLocaleString()}</td>
                          <td className="py-1 text-right text-slate-200 font-mono font-medium">{totalExit.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Conflict details ── */}
          {hasConflicts && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] text-orange-500 uppercase tracking-widest">Scheduling Conflicts</div>
              {conflicts.map((c, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded border ${
                  c.type.startsWith('aircraft')
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                }`}>
                  <span className="flex-shrink-0 mt-0.5">
                    {c.type.startsWith('aircraft') ? '✈' : '👤'}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium capitalize">{c.type.replace(/_/g, ' ')}: </span>
                    {c.message}
                    {c.conflictFlight && (
                      <span className="ml-2 text-slate-500 font-mono">
                        [{c.conflictFlight.tailNumber} {c.conflictFlight.departure}→{c.conflictFlight.arrival}]
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Risk snapshot header */}
          {snap && (
            <div className="flex flex-col gap-1 text-xs">
              <div className="text-[10px] text-slate-600 uppercase tracking-widest">Risk Profile</div>
              <div className="flex flex-wrap gap-4 text-slate-400">
                <span>Captured <span className="text-slate-300">{dayjs(snap.capturedAt).utc().format('MMM D HH:mm[Z]')}</span></span>
                <span>Checked <span className={isStale ? 'text-yellow-400' : 'text-slate-300'}>
                  {dayjs(snap.lastCheckedAt).utc().format('MMM D HH:mm[Z]')}
                </span></span>
                {snap.summary && (
                  <span>
                    <span className="text-blue-300">{snap.summary.accidentData_accMhr?.toFixed(1)}</span>
                    <span className="text-slate-600"> + </span>
                    <span className="text-orange-300">{snap.summary.knownRiskAddition_accMhr?.toFixed(1)}</span>
                    <span className="text-slate-600"> = </span>
                    <span className={ratioCls}>{snap.summary.total_accMhr?.toFixed(1)} acc/Mhr · {ratio?.toFixed(2)}× baseline</span>
                  </span>
                )}
                <TrendBadge trend={trend} delta={delta} />
              </div>
              <WeatherSummary weatherSummary={snap.weatherSummary} />
            </div>
          )}

          {/* Terrain profile */}
          {snap?.terrainProfile && <MiniTerrain terrainProfile={snap.terrainProfile} />}

          {/* Risk checklist */}
          {items.length > 0 && currentUser && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Risk Acknowledgments</div>
              <RiskChecklist flight={flight} currentUser={currentUser} />
            </div>
          )}

          {/* PAVE breakdown */}
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">P.A.V.E.</div>
            <div className="flex gap-4 flex-wrap text-xs">
              {[
                { k: 'P', label: 'Pilot',       score: flight.riskP },
                { k: 'A', label: 'Aircraft',    score: flight.riskA },
                { k: 'V', label: 'enVironment', score: flight.riskV },
                { k: 'E', label: 'External',    score: flight.riskE },
              ].map(({ k, label, score }) => (
                <div key={k} className="text-center min-w-[52px]">
                  <div className={`font-mono font-bold text-sm ${
                    score >= 70 ? 'text-red-400' : score >= 40 ? 'text-yellow-400' : 'text-green-400'
                  }`}>{score ?? '—'}</div>
                  <div className="text-slate-600">{k} · {label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Return trip scheduling ── */}
          {flight.status !== 'cancelled' && flight.status !== 'closed' && (() => {
            const cruiseKts  = CRUISE_SPEEDS_KTS[flight.aircraftType] ?? 150
            const est        = estimateFlightDuration(flight.departure, flight.arrival, cruiseKts, 15)
            const depDate    = new Date(flight.plannedDepartureUtc)
            const eta        = estimateEta(depDate, est?.totalHours)
            const returnDep  = eta ? new Date(eta.getTime() + 30 * 60_000) : null

            function scheduleReturn() {
              if (!returnDep) return
              addFlight({
                id:                  `flt-${Date.now()}`,
                callsign:            flight.tailNumber,
                tailNumber:          flight.tailNumber,
                aircraftType:        flight.aircraftType,
                departure:           flight.arrival,
                arrival:             flight.departure,
                waypoints:           [],
                plannedDepartureUtc: returnDep.toISOString(),
                status:              'planned',
                pic:                 flight.pic ?? null,
                picId:               flight.picId ?? null,
                sic:                 null,
                sicId:               null,
                passengers:          0,
                missionType:         'positioning',
                riskScore:           10,
                riskSnapshot: {
                  capturedAt:      new Date().toISOString(),
                  lastCheckedAt:   new Date().toISOString(),
                  ratioToBaseline: 0.8,
                  riskTrend:       'stable',
                  riskDelta:       0,
                  weatherSummary:  null,
                  terrainProfile:  null,
                  riskItems:       [],
                },
              })
              setReturnScheduled(true)
            }

            return (
              <div className="flex items-center gap-3 p-2 bg-slate-800/40 rounded border border-slate-700/40">
                <div className="flex-1 text-xs text-slate-500">
                  <span className="text-slate-400 font-medium">Return trip: </span>
                  <span className="font-mono text-slate-300">{flight.arrival}→{flight.departure}</span>
                  <span className="ml-2">· 0 pax · Repositioning</span>
                  {returnDep && (
                    <span className="ml-2">
                      · Departs <span className="font-mono text-slate-300">
                        {returnDep.toUTCString().slice(17, 22)}Z
                      </span>
                    </span>
                  )}
                  {est && (
                    <span className="ml-2 text-slate-600">
                      (ETA+30m · {formatHours(est.totalHours)} block)
                    </span>
                  )}
                </div>
                {returnScheduled ? (
                  <span className="text-xs text-sky-400 flex-shrink-0">✓ Scheduled</span>
                ) : (
                  <button
                    onClick={scheduleReturn}
                    className="text-xs px-3 py-1 rounded border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-colors flex-shrink-0"
                  >
                    Schedule Return
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
