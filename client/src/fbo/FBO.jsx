import { useState, useMemo } from 'react'
import { useSimBroadcast } from '../hooks/useSimBroadcast'
import {
  mockServiceOrders, mockCrewVehicles,
  FEE_SCHEDULE, FBO_MAINTENANCE_LINKS, FBO_STAFF_IDS,
} from './mockDb'
import { mockAircraft } from '../mocks/aircraft'
import { mockPersonnel } from '../mocks/personnel'
import {
  computeRiskScore, defconLevel, defconClasses, defconLabel,
  riskWarnings, riskBreakdown, fuelConfusionRisk,
  serviceTypeLabel, fuelTypeLabel, fboCategoryLabel,
  serviceStatusLabel, serviceStatusColor, arrivalStatusLabel,
  weatherLabel, weatherColor, calcFuelFee,
  minutesUntilEta, timeUntilLabel, etaDelayFlag, formatEtaTime,
  BASE_TASK_RISK, WEATHER_RISK, FBO_NOW,
  transportTypeLabel, serviceStatusDot, dotColorClass, dotTextClass,
  crewCarStatusLabel, transportStatusLabel, cateringStatusLabel,
} from './fboUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAircraft(tailNumber) {
  return mockAircraft.find((a) => a.tailNumber === tailNumber) ?? null
}

function getPerson(id) {
  return mockPersonnel.find((p) => p.id === id) ?? null
}

function enrichOrder(order) {
  const aircraft = getAircraft(order.tailNumber)
  const assignee = getPerson(order.assignedTo)
  const score = computeRiskScore({
    serviceType: order.serviceType,
    aircraft,
    assignee,
    weatherCondition: order.weatherCondition,
  })
  const level = defconLevel(score)
  const warnings = riskWarnings({
    serviceType: order.serviceType,
    aircraft,
    assignee,
    weatherCondition: order.weatherCondition,
  })
  const breakdown = riskBreakdown({
    serviceType: order.serviceType,
    aircraft,
    assignee,
    weatherCondition: order.weatherCondition,
  })
  return { ...order, riskScore: score, defconLevel: level, warnings, breakdown, aircraft, assignee }
}

// ─── Sim → FBO data converters ─────────────────────────────────────────────

const SIM_AC_STATUS = {
  approach:       'inbound',
  taxiing_in:     'inbound',
  parked:         'arrived',
  being_serviced: 'arrived',
  ready:          'arrived',
}

function simAcToArrival(ac, simNowMs) {
  // Use the fixed etaMs stamped at spawn; only fall back to offset if missing (legacy)
  const etaMs     = ac.etaMs ?? (simNowMs + (ac.state === 'approach' ? 5 : ac.state === 'taxiing_in' ? 2 : 0) * 60000)
  const minsUntil = Math.round((etaMs - simNowMs) / 60000)
  const eta       = new Date(etaMs).toISOString()

  const serviceStatuses = {}
  for (const svc of (ac.servicesNeeded ?? [])) {
    if ((ac.servicesDone ?? []).includes(svc)) {
      serviceStatuses[svc] = { status: 'completed' }
    } else if (ac.serviceActive === svc) {
      serviceStatuses[svc] = { status: 'in_progress' }
    } else {
      serviceStatuses[svc] = { status: 'not_started' }
    }
  }

  return {
    id: ac.tail, tailNumber: ac.tail,
    makeModel: ac.makeModel,
    fuelType: ac.fuelType,
    fboCategory: ac.fboCategory ?? 'piston_single',
    riskProfile: { turboprop: ac.turboprop, jetFuelInPropAircraft: ac.turboprop && ac.fuelType === 'jet_a' },
    status: SIM_AC_STATUS[ac.state] ?? 'arrived',
    eta, adsbExpectedTime: null, departureEta: null,
    parkedAtMs: ac.parkedAtMs ?? null,
    serviceStartMs: ac.serviceStartMs ?? null,
    fromIcao: 'SIM',
    pilotName: null, passengerCount: null, crewCount: null,
    servicesRequested: ac.servicesNeeded ?? [],
    serviceStatuses,
    transportPreferences: (() => {
      if (!(ac.servicesNeeded ?? []).includes('crew_car')) return { type: 'none', status: 'not_requested' }
      const status = (ac.servicesDone ?? []).includes('crew_car') ? 'completed'
        : ac.serviceActive === 'crew_car' ? 'in_progress' : 'not_started'
      return { type: 'crew_car', status }
    })(),
    handlingInstructions: null,
    minsUntil,
    fuelRiskScore: 0, fuelDefconLevel: 1, fuelWarnings: [],
    assignee: null, delayFlag: null,
  }
}

// Build a fully-enriched service order list straight from sim state.
// One order per active service + one per completed service on each aircraft.
function simStateToOrders(simState) {
  if (!simState?.aircraft) return []
  const orders = []
  let seq = 1

  for (const ac of simState.aircraft) {
    const aircraft = {
      fuelType: ac.fuelType,
      riskProfile: {
        turboprop: ac.turboprop,
        jetFuelInPropAircraft: !!(ac.turboprop && ac.fuelType === 'jet_a'),
      },
    }

    // Find the staff member currently assigned to this aircraft
    const assignedStaff = (simState.staff ?? []).find(
      (p) => p.assignedTo === ac.tail
    )
    const assignee = assignedStaff
      ? { id: assignedStaff.id, name: assignedStaff.name, yearsExperience: null }
      : null

    const makeOrder = (svc, status) => {
      const score    = computeRiskScore({ serviceType: svc, aircraft, assignee: status === 'in_progress' ? assignee : null, weatherCondition: 'clear' })
      const warnings = status === 'in_progress' ? riskWarnings({ serviceType: svc, aircraft, assignee, weatherCondition: 'clear' }) : []
      const breakdown = riskBreakdown({ serviceType: svc, aircraft, assignee: null, weatherCondition: 'clear' })
      return {
        id: `sim-ord-${seq++}`,
        tailNumber: ac.tail,
        serviceType: svc,
        status,
        assignedTo: status === 'in_progress' ? (assignedStaff?.id ?? null) : null,
        weatherCondition: 'clear',
        riskScore: score,
        defconLevel: defconLevel(score),
        warnings,
        breakdown,
        aircraft,
        assignee: status === 'in_progress' ? assignee : null,
      }
    }

    if (ac.serviceActive) orders.push(makeOrder(ac.serviceActive, 'in_progress'))
    for (const svc of (ac.servicesDone ?? [])) orders.push(makeOrder(svc, 'completed'))
  }

  return orders
}

function simAcToDeparture(ac, simNowMs) {
  const etd = new Date(simNowMs + 5 * 60000).toISOString()
  return {
    id: ac.tail, tailNumber: ac.tail,
    makeModel: ac.makeModel,
    fuelType: ac.fuelType,
    status: 'preparing',
    etd,
    minsUntil: 5,
    servicesRequested: [],
    serviceStatuses: {},
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DefconBadge({ level, score, compact }) {
  const cls = defconClasses(level)
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold border ${cls.badge} ${cls.border}`}
        data-testid={`defcon-badge-${level}`}
      >
        DC{level}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border ${cls.badge} ${cls.border}`}
      data-testid={`defcon-badge-${level}`}
    >
      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
      DEFCON {level} — {defconLabel(level)} {score != null && <span className="opacity-70">({score}/10)</span>}
    </span>
  )
}

function FuelTypeBadge({ fuelType }) {
  if (fuelType === 'jet_a') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-orange-900/40 text-orange-300 border border-orange-400/30">
        Jet-A
      </span>
    )
  }
  if (fuelType === 'avgas_100ll') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-blue-900/40 text-blue-300 border border-blue-400/30">
        Avgas 100LL
      </span>
    )
  }
  return <span className="text-xs text-slate-500">—</span>
}

function WeatherChip({ condition }) {
  const color = weatherColor(condition)
  return (
    <span className={`text-xs font-medium ${color}`}>
      {weatherLabel(condition)}
    </span>
  )
}

function WarningBanner({ warning }) {
  const styles = {
    critical: 'bg-red-900/30 border-red-400/40 text-red-300',
    warning:  'bg-amber-900/30 border-amber-400/40 text-amber-300',
    info:     'bg-sky-900/20 border-sky-400/30 text-sky-300',
  }
  const icons = { critical: '⛔', warning: '⚠', info: 'ℹ' }
  return (
    <div className={`text-xs rounded border px-3 py-2 flex gap-2 ${styles[warning.level] ?? styles.info}`}>
      <span className="flex-shrink-0">{icons[warning.level]}</span>
      <span>{warning.message}</span>
    </div>
  )
}

function ScoreBreakdown({ breakdown }) {
  const items = [
    { label: 'Task base', value: breakdown.base },
    { label: 'Fuel confusion', value: breakdown.fuelConf },
    { label: 'Experience', value: breakdown.exp },
    { label: 'Weather', value: breakdown.wx },
  ]
  return (
    <div className="flex gap-3 text-xs text-slate-400">
      {items.map(({ label, value }) => (
        <span key={label} className={value > 0 ? 'text-slate-300' : ''}>
          {label} <span className="font-mono">+{value}</span>
        </span>
      ))}
    </div>
  )
}

// ─── Service Status Dot ────────────────────────────────────────────────────────

function StatusDot({ status, minsUntilOp, label }) {
  const dot = serviceStatusDot(status, minsUntilOp)
  const cls = dotColorClass(dot)
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`}
      title={`${label}: ${status}`}
    />
  )
}

// ─── Transport chip ────────────────────────────────────────────────────────────

function TransportChip({ transport, minsUntilOp }) {
  if (!transport) return null
  const dot = serviceStatusDot(transport.status, minsUntilOp)
  const dotCls = dotColorClass(dot)
  const statusLabel =
    transport.type === 'crew_car' ? crewCarStatusLabel(transport.status) : transportStatusLabel(transport.status)
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotCls}`} />
      <span className="text-slate-300 font-medium">{transportTypeLabel(transport.type)}</span>
      <span className="text-slate-500">—</span>
      <span className={dotTextClass(dot)}>{statusLabel}</span>
      {transport.notes && (
        <span className="text-slate-600 truncate max-w-xs" title={transport.notes}>{transport.notes}</span>
      )}
    </div>
  )
}

// ─── Service list with status dots ────────────────────────────────────────────

function ServiceDotList({ servicesRequested, serviceStatuses, minsUntilOp }) {
  return (
    <div className="flex flex-wrap gap-2">
      {servicesRequested.map((svc) => {
        const s = serviceStatuses?.[svc]
        const status = s?.status ?? 'not_started'
        const dot = serviceStatusDot(status, minsUntilOp)
        const dotCls = dotColorClass(dot)
        const textCls = dotTextClass(dot)
        return (
          <span key={svc} className="flex items-center gap-1 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotCls}`} title={status} />
            <span className="text-slate-300">{serviceTypeLabel(svc)}</span>
            <span className={`${textCls} opacity-75`}>({status.replace(/_/g, ' ')})</span>
          </span>
        )
      })}
    </div>
  )
}

function ServiceOrderCard({ order, expanded }) {
  const [open, setOpen] = useState(expanded ?? false)
  const cls = defconClasses(order.defconLevel)
  const isPending = order.status === 'pending' || order.status === 'in_progress'

  return (
    <div className={`rounded border ${cls.border} ${cls.bg} p-3 space-y-2`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-slate-100 text-sm">{order.tailNumber}</span>
          <span className="text-slate-300 text-sm">{serviceTypeLabel(order.serviceType)}</span>
          {order.fuelType && <FuelTypeBadge fuelType={order.fuelType} />}
          {order.fuelQuantityGal && (
            <span className="text-xs text-slate-400">{order.fuelQuantityGal} gal</span>
          )}
          {order.crossModule === 'maintenance' && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-violet-900/40 text-violet-300 border border-violet-400/30">
              Maint. Link
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs ${serviceStatusColor(order.status)}`}>
            {serviceStatusLabel(order.status)}
          </span>
          <DefconBadge level={order.defconLevel} score={order.riskScore} compact />
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-slate-500 hover:text-slate-300 text-xs"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Assignee + weather row */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>
          Assigned: <span className="text-slate-300">{order.assignee?.name ?? 'Unassigned'}</span>
          {order.assignee?.yearsExperience != null && (
            <span className="ml-1 text-slate-500">({order.assignee.yearsExperience} yr)</span>
          )}
        </span>
        <WeatherChip condition={order.weatherCondition} />
        {order.fee != null && (
          <span className="text-green-400">${order.fee.toFixed(2)}</span>
        )}
      </div>

      {/* Active warnings (always visible if critical and pending) */}
      {isPending && order.warnings.filter((w) => w.level === 'critical').map((w) => (
        <WarningBanner key={w.code} warning={w} />
      ))}

      {/* Expanded detail */}
      {open && (
        <div className="space-y-2 pt-1">
          <ScoreBreakdown breakdown={order.breakdown} />
          {order.warnings.filter((w) => w.level !== 'critical').map((w) => (
            <WarningBanner key={w.code} warning={w} />
          ))}
          {order.notes && (
            <p className="text-xs text-slate-400 italic">{order.notes}</p>
          )}
          {order.crossModuleRef && (
            <p className="text-xs text-violet-300">
              Maintenance WO: <span className="font-mono">{order.crossModuleRef}</span>
            </p>
          )}
          {order.completedAt && (
            <p className="text-xs text-slate-500">
              Completed: {order.completedAt.replace('T', ' ').slice(0, 16)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DEFCON summary strip ──────────────────────────────────────────────────────

function DefconStrip({ activeOrders }) {
  const counts = [1, 2, 3, 4, 5].map((level) => ({
    level,
    count: activeOrders.filter((o) => o.defconLevel === level).length,
  }))
  return (
    <div className="flex gap-2" aria-label="DEFCON summary">
      {counts.map(({ level, count }) => {
        const cls = defconClasses(level)
        return (
          <div
            key={level}
            className={`flex-1 rounded border px-3 py-2 text-center ${cls.bg} ${cls.border}`}
          >
            <div className={`text-lg font-bold font-mono ${cls.text}`}>{count}</div>
            <div className={`text-xs font-mono ${cls.text}`}>DC{level}</div>
            <div className="text-xs text-slate-500">{defconLabel(level)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Gantt Chart ──────────────────────────────────────────────────────────────
// Shows aircraft operations on a rolling 6-hour window: now-2h → now+4h.
// The window recomputes from simNow so the "now" marker always stays visible.

const GANTT_MINS = 360  // 6-hour window

function ganttPct(isoTime, ganttStart) {
  const mins = (new Date(isoTime) - new Date(ganttStart)) / 60000
  return Math.max(0, Math.min(100, (mins / GANTT_MINS) * 100))
}

function buildHourMarks(ganttStartMs) {
  // Find first whole UTC hour at or after ganttStart, then mark every hour in window
  const firstHourMs = Math.ceil(ganttStartMs / 3600000) * 3600000
  const ganttStart  = new Date(ganttStartMs).toISOString()
  const marks = []
  for (let ms = firstHourMs; ms <= ganttStartMs + GANTT_MINS * 60000; ms += 3600000) {
    const iso   = new Date(ms).toISOString()
    const label = iso.slice(11, 16) + 'Z'
    marks.push({ label, pct: ganttPct(iso, ganttStart) })
  }
  return marks
}

// Estimated minutes of ground services by type
const SVC_DURATION = {
  fueling: 30, cleaning: 90, tie_down: 15, gpu: 45, preheat: 120,
  hangaring: 20, tow: 30, repositioning: 30, catering: 20, crew_car: 10,
}

function estimateServiceMinutes(servicesRequested) {
  return servicesRequested.reduce((sum, s) => sum + (SVC_DURATION[s] ?? 20), 0)
}

function GanttBar({ startIso, endIso, color, title, ganttStart }) {
  const left  = ganttPct(startIso, ganttStart)
  const right = ganttPct(endIso, ganttStart)
  const width = Math.max(0.8, right - left)
  return (
    <div
      className={`absolute top-1 bottom-1 rounded-sm ${color}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={title}
    />
  )
}

function GanttChart({ enrichedArrivals, enrichedDepartures, simNow }) {
  const nowMs       = new Date(simNow ?? FBO_NOW).getTime()
  const ganttStartMs = nowMs - 2 * 60 * 60 * 1000   // 2 hours before now
  const ganttStart  = new Date(ganttStartMs).toISOString()
  const NOW_PCT     = ganttPct(simNow ?? FBO_NOW, ganttStart)
  const hourMarks   = buildHourMarks(ganttStartMs)

  // Build unified rows sorted by operation time
  const arrRows = enrichedArrivals
    .filter((a) => a.status !== 'cancelled' && a.status !== 'departed')
    .map((a) => ({
      id: a.id,
      tailNumber: a.tailNumber,
      makeModel: a.makeModel,
      opType: 'arrival',
      opTime: a.adsbExpectedTime ?? a.eta,
      departureTime: a.departureEta ?? null,
      servicesRequested: a.servicesRequested,
      serviceStatuses: a.serviceStatuses,
      fuelType: a.fuelType,
      status: a.status,
      parkedAtMs: a.parkedAtMs ?? null,
      serviceStartMs: a.serviceStartMs ?? null,
    }))

  const depRows = enrichedDepartures
    .filter((d) => d.status !== 'cancelled')
    .map((d) => ({
      id: d.id,
      tailNumber: d.tailNumber,
      makeModel: d.makeModel,
      opType: 'departure',
      opTime: d.etd,
      departureTime: d.etd,
      servicesRequested: d.servicesRequested,
      serviceStatuses: d.serviceStatuses,
      fuelType: d.fuelType,
      status: d.status,
    }))

  const rows = [...arrRows, ...depRows].sort(
    (a, b) => new Date(a.opTime) - new Date(b.opTime)
  )

  return (
    <div className="space-y-3" data-testid="gantt-chart">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Operations Timeline — Today UTC
      </h2>

      {/* Hour axis */}
      <div className="relative h-4 ml-28">
        {hourMarks.map(({ label, pct }) => (
          <div
            key={label}
            className="absolute flex flex-col items-center"
            style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-slate-600 text-xs whitespace-nowrap">{label}</span>
          </div>
        ))}
      </div>

      {/* Grid + rows */}
      <div className="space-y-1.5">
        {rows.map((row) => {
          const svcMins    = estimateServiceMinutes(row.servicesRequested)
          const opTimestamp = new Date(row.opTime)

          // For arrivals: inbound bar (window start → opTime), services bar (parkedAt/svcStart → svcEnd)
          // For departures: services bar (opTime-svcMins → opTime), departure tick at opTime
          // Use fixed timestamps (stamped once in sim) to prevent the window drifting with sim clock.
          const svcAnchorMs = row.opType === 'arrival'
            ? (row.serviceStartMs ?? row.parkedAtMs ?? opTimestamp.getTime())
            : opTimestamp.getTime() - svcMins * 60000
          const svcStartIso = new Date(svcAnchorMs).toISOString()
          const svcEndIso = row.opType === 'arrival'
            ? new Date(svcAnchorMs + svcMins * 60000).toISOString()
            : row.opTime

          const allServicesComplete = row.servicesRequested.length > 0 &&
            row.servicesRequested.every((s) => {
              const st = row.serviceStatuses?.[s]?.status
              return st === 'completed' || st === 'returned' || st === 'loaded'
            })

          return (
            <div key={row.id} className="flex items-center gap-2">
              {/* Row label */}
              <div className="w-28 flex-shrink-0 text-right pr-2 space-y-0.5">
                <div className="font-mono text-xs font-bold text-slate-200">{row.tailNumber}</div>
                <div className={`text-xs ${row.opType === 'arrival' ? 'text-sky-400' : 'text-amber-400'}`}>
                  {row.opType === 'arrival' ? '▼ ARR' : '▲ DEP'}
                  {' '}{formatEtaTime(row.opTime)}
                </div>
              </div>

              {/* Timeline bar */}
              <div className="relative flex-1 h-7 bg-slate-800/60 rounded border border-slate-700/50 overflow-hidden">
                {/* Hour grid lines */}
                {hourMarks.map(({ pct }) => (
                  <div
                    key={pct}
                    className="absolute top-0 bottom-0 w-px bg-slate-700/40"
                    style={{ left: `${pct}%` }}
                  />
                ))}

                {/* Inbound transit bar (arrivals only) */}
                {row.opType === 'arrival' && (
                  <GanttBar
                    startIso={ganttStart}
                    endIso={row.opTime}
                    color="bg-slate-600/50 border-l border-slate-500/30"
                    title={`Inbound → ${formatEtaTime(row.opTime)}`}
                    ganttStart={ganttStart}
                  />
                )}

                {/* Services window bar */}
                <GanttBar
                  startIso={svcStartIso}
                  endIso={svcEndIso}
                  color={allServicesComplete ? 'bg-green-500/50' : 'bg-sky-500/60'}
                  title={`Services (${svcMins} min est.)`}
                  ganttStart={ganttStart}
                />

                {/* Departure/disposition bar for turnaround arrivals */}
                {row.opType === 'arrival' && row.departureTime && (
                  <GanttBar
                    startIso={svcEndIso}
                    endIso={row.departureTime}
                    color="bg-amber-500/40"
                    title={`At ramp until ${formatEtaTime(row.departureTime)}`}
                    ganttStart={ganttStart}
                  />
                )}

                {/* Operation time tick */}
                <div
                  className={`absolute top-0 bottom-0 w-0.5 ${row.opType === 'arrival' ? 'bg-sky-400/80' : 'bg-amber-400/80'}`}
                  style={{ left: `${ganttPct(row.opTime, ganttStart)}%` }}
                  title={row.opType === 'arrival' ? `ETA ${formatEtaTime(row.opTime)}` : `ETD ${formatEtaTime(row.opTime)}`}
                />

                {/* "NOW" marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
                  style={{ left: `${NOW_PCT}%` }}
                  title={`Now: ${formatEtaTime(FBO_NOW)}`}
                />
              </div>

              {/* Service status dots (compact) */}
              <div className="flex gap-1 flex-shrink-0 items-center" title="Service status dots">
                {row.servicesRequested.map((svc) => {
                  const st = row.serviceStatuses?.[svc]?.status ?? 'not_started'
                  const mins = minutesUntilEta(row.opTime)
                  const dot = serviceStatusDot(st, mins)
                  return (
                    <span
                      key={svc}
                      className={`w-2.5 h-2.5 rounded-full ${dotColorClass(dot)}`}
                      title={`${serviceTypeLabel(svc)}: ${st}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 pt-1 border-t border-slate-700/50">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-600/50 inline-block" aria-hidden="true" /> Inbound transit</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-sky-500/60 inline-block" aria-hidden="true" /> Svc window</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500/50 inline-block" aria-hidden="true" /> Svc complete</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-500/40 inline-block" /> At ramp</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-white/40 inline-block" /> Now</span>
        <span>Dots: <span className="text-green-400">●</span> on schedule <span className="text-amber-400">●</span> needs attention <span className="text-red-400">●</span> late</span>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ enrichedOrders, enrichedArrivals, enrichedDepartures, pendingCrossModule, simState }) {
  const activeOrders = enrichedOrders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
  const sortedActive = [...activeOrders].sort((a, b) => b.riskScore - a.riskScore)

  const hasThunderstorm = activeOrders.some((o) => o.weatherCondition === 'thunderstorm')

  return (
    <div className="space-y-5">
      {hasThunderstorm && (
        <div className="bg-red-900/40 border border-red-400/50 rounded px-4 py-3 text-red-300 font-bold text-sm flex items-center gap-2">
          <span className="text-lg">⚡</span>
          THUNDERSTORM ADVISORY — CEASE ALL RAMP AND FUELING OPERATIONS IMMEDIATELY
        </div>
      )}

      {/* Operations Gantt */}
      <GanttChart
        enrichedArrivals={enrichedArrivals}
        enrichedDepartures={enrichedDepartures}
        simNow={simState?.running ? new Date(simState.simTimeMs).toISOString() : undefined}
      />

      {/* DEFCON strip */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Risk Summary — Active Orders
        </h2>
        <DefconStrip activeOrders={activeOrders} />
      </div>

      {/* Pending cross-module requests */}
      {pendingCrossModule.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Pending Maintenance Requests
          </h2>
          <div className="space-y-2">
            {pendingCrossModule.map((link) => {
              const authorizer = getPerson(link.authorizedBy)
              return (
                <div
                  key={link.id}
                  className="rounded border border-violet-400/30 bg-violet-900/20 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-violet-300 font-semibold">{serviceTypeLabel(link.requestType)}</span>
                    <span className="text-xs text-slate-500">from Maintenance</span>
                  </div>
                  <p className="text-xs text-slate-300">{link.description}</p>
                  {authorizer && (
                    <p className="text-xs text-slate-500 mt-1">
                      Authorized by {authorizer.name} · WO: <span className="font-mono">{link.maintenanceWoId}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Aircraft on ground status */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Fleet on Ground
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-surface-border">
                <th className="text-left py-1.5 pr-3">Aircraft</th>
                <th className="text-left py-1.5 pr-3">Fuel</th>
                <th className="text-left py-1.5 pr-3">Location</th>
                <th className="text-left py-1.5">Active FBO Services</th>
              </tr>
            </thead>
            <tbody>
              {(simState?.aircraft ?? [])
                .filter((ac) => !['departed'].includes(ac.state))
                .map((ac) => (
                  <tr key={ac.tail} className="border-b border-surface-border/50">
                    <td className="py-1.5 pr-3">
                      <span className="font-mono font-bold text-slate-200">{ac.tail}</span>
                      <span className="ml-1.5 text-slate-500">{ac.makeModel}</span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <FuelTypeBadge fuelType={ac.fuelType} />
                      {ac.turboprop && ac.fuelType === 'jet_a' && (
                        <span className="ml-1 text-amber-400 text-xs" title="Turboprop — confirm Jet-A">⚠</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400">
                      {ac.parkingSpot ?? ac.state.replace('_', ' ')}
                    </td>
                    <td className="py-1.5 text-slate-400">
                      {ac.serviceActive
                        ? <span className="text-amber-300">{ac.serviceActive}</span>
                        : ac.state === 'ready'
                          ? <span className="text-green-400">Ready</span>
                          : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Active service orders sorted by risk */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Active Orders — Highest Risk First
        </h2>
        {sortedActive.length === 0 ? (
          <p className="text-slate-500 text-sm">No active service orders.</p>
        ) : (
          <div className="space-y-2">
            {sortedActive.map((o) => (
              <ServiceOrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>

      {/* Incoming arrivals needing fuel */}
      {enrichedArrivals.filter((a) => a.status !== 'departed' && a.status !== 'cancelled').length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Upcoming Arrivals with Fuel Requests
          </h2>
          <div className="space-y-2">
            {enrichedArrivals
              .filter((a) => a.servicesRequested.includes('fueling') && a.status !== 'departed')
              .map((a) => (
                <div key={a.id} className="rounded border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-slate-200">{a.tailNumber}</span>
                    <span className="text-slate-400">{a.makeModel}</span>
                    <FuelTypeBadge fuelType={a.fuelType} />
                    {(a.riskProfile?.turboprop || a.riskProfile?.jetFuelInPropAircraft) && (
                      <span className="text-amber-300 text-xs font-semibold">TURBOPROP</span>
                    )}
                    <DefconBadge level={a.fuelDefconLevel} score={a.fuelRiskScore} compact />
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>Res: {formatEtaTime(a.eta)}</span>
                    {a.adsbExpectedTime && (
                      <span>· ADS-B: {formatEtaTime(a.adsbExpectedTime)}</span>
                    )}
                    {a.delayFlag && (
                      <span className={`text-xs font-bold ${a.delayFlag.color}`}>
                        {a.delayFlag.late ? '⚠' : '↑'} {a.delayFlag.label}
                      </span>
                    )}
                    <span>· {timeUntilLabel(a.eta)}</span>
                    <span>· {a.fuelRequestGal} gal · {arrivalStatusLabel(a.status)}</span>
                  </div>
                  {a.fuelWarnings.filter((w) => w.level === 'critical').map((w) => (
                    <WarningBanner key={w.code} warning={w} />
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aircraft Ops Tab ─────────────────────────────────────────────────────────

function ArrivalTimeRow({ arrival }) {
  const reservationTime = formatEtaTime(arrival.eta)
  const expectedTime    = arrival.adsbExpectedTime ? formatEtaTime(arrival.adsbExpectedTime) : null
  const countdown       = timeUntilLabel(arrival.eta)
  const { delayFlag }   = arrival

  return (
    <div className="space-y-1">
      {/* Reservation row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500 w-28 flex-shrink-0">Reservation at:</span>
        <span className="font-mono text-slate-200">{reservationTime}</span>
        <span className={`font-medium ${
          arrival.minsUntil < 0 ? 'text-slate-500' :
          arrival.minsUntil < 30 ? 'text-green-400' : 'text-slate-400'
        }`}>
          {countdown}
        </span>
      </div>
      {/* ADS-B expected row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500 w-28 flex-shrink-0">Expected (ADS-B):</span>
        {expectedTime ? (
          <>
            <span className={`font-mono ${delayFlag ? (delayFlag.late ? 'text-orange-300' : 'text-green-300') : 'text-slate-300'}`}>
              {expectedTime}
            </span>
            {delayFlag ? (
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${delayFlag.bgColor} ${delayFlag.color}`}>
                {delayFlag.late ? '⚠' : '↑'} {delayFlag.label}
              </span>
            ) : (
              <span className="text-slate-500">on time</span>
            )}
            {arrival.adsbUpdatedAt && (
              <span className="text-slate-600">
                updated {formatEtaTime(arrival.adsbUpdatedAt)}
              </span>
            )}
          </>
        ) : (
          <span className="text-slate-600 italic">not yet in tracking range</span>
        )}
      </div>
    </div>
  )
}

// Sort: soonest ETA first; departed/cancelled/no_show last
const ARRIVAL_STATUS_ORDER  = { inbound: 0, confirmed: 1, arrived: 2, departed: 99, cancelled: 99, no_show: 99 }
const DEPARTURE_STATUS_ORDER = { preparing: 0, scheduled: 1, departed: 99, cancelled: 99 }

function AircraftOpsTab({ enrichedArrivals, enrichedDepartures }) {
  const sortedArrivals = [...enrichedArrivals]
    .filter((a) => a.status !== 'departed' && a.status !== 'cancelled' && a.status !== 'no_show')
    .sort((a, b) => {
      const oa = ARRIVAL_STATUS_ORDER[a.status] ?? 50
      const ob = ARRIVAL_STATUS_ORDER[b.status] ?? 50
      if (oa !== ob) return oa - ob
      return new Date(a.eta).getTime() - new Date(b.eta).getTime()
    })

  const sortedDepartures = [...enrichedDepartures]
    .filter((d) => d.status !== 'cancelled')
    .sort((a, b) => {
      const oa = DEPARTURE_STATUS_ORDER[a.status] ?? 50
      const ob = DEPARTURE_STATUS_ORDER[b.status] ?? 50
      if (oa !== ob) return oa - ob
      return new Date(a.etd).getTime() - new Date(b.etd).getTime()
    })

  return (
    <div className="space-y-6">
      {/* ── Inbound arrivals ────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Inbound Arrivals — soonest first
        </h2>
        {sortedArrivals.length === 0 && (
          <p className="text-slate-500 text-sm italic">No active arrivals — start the simulation to see live operations.</p>
        )}
        {sortedArrivals.map((arrival) => {
          const hasTurbopropRisk = arrival.riskProfile?.turboprop || arrival.riskProfile?.jetFuelInPropAircraft
          const fuelCls = defconClasses(arrival.fuelDefconLevel)
          const minsUntilArr = arrival.minsUntil

          return (
            <div
              key={arrival.id}
              data-testid={`arrival-card-${arrival.id}`}
              className="rounded border border-slate-700 bg-slate-800/50 p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-100">{arrival.tailNumber}</span>
                  <span className="text-slate-300 text-sm">{arrival.makeModel}</span>
                  <FuelTypeBadge fuelType={arrival.fuelType} />
                  {hasTurbopropRisk && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-amber-900/40 text-amber-300 border border-amber-400/30">
                      TURBOPROP
                    </span>
                  )}
                  {arrival.isOwnFleet && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-sky-900/30 text-sky-300 border border-sky-400/20">
                      Fleet
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${
                  arrival.status === 'inbound'   ? 'text-sky-400' :
                  arrival.status === 'confirmed' ? 'text-green-400' : 'text-slate-400'
                }`}>
                  {arrivalStatusLabel(arrival.status)}
                </span>
              </div>

              {/* Time rows */}
              <ArrivalTimeRow arrival={arrival} />

              {/* Departure time if turnaround */}
              {arrival.departureEta && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-amber-400 font-medium">▲ Departure:</span>
                  <span className="font-mono text-slate-200">{formatEtaTime(arrival.departureEta)}</span>
                  <span className="text-slate-500">{timeUntilLabel(arrival.departureEta)}</span>
                </div>
              )}

              {/* Crew / pax / coordinator */}
              <div className="text-xs text-slate-400">
                From <span className="text-slate-300">{arrival.fromIcao}</span>
                {' · '}{arrival.crewCount} crew · {arrival.passengerCount} pax
                {' · '}Coordinator: <span className="text-slate-300">{arrival.assignee?.name ?? '—'}</span>
              </div>

              {/* Services with status dots */}
              <ServiceDotList
                servicesRequested={arrival.servicesRequested}
                serviceStatuses={arrival.serviceStatuses}
                minsUntilOp={minsUntilArr}
              />

              {/* Transportation */}
              <TransportChip transport={arrival.transportPreferences} minsUntilOp={minsUntilArr} />

              {/* Fuel request with risk */}
              {arrival.servicesRequested.includes('fueling') && (
                <div className={`rounded border ${fuelCls.border} ${fuelCls.bg} px-3 py-2 space-y-1.5`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300 font-semibold">Fuel Request:</span>
                    <FuelTypeBadge fuelType={arrival.fuelType} />
                    <span className="text-slate-400">{arrival.fuelRequestGal} gal</span>
                    <span className="text-slate-400">≈ ${calcFuelFee(arrival.fuelType, arrival.fuelRequestGal).toFixed(2)}</span>
                    <DefconBadge level={arrival.fuelDefconLevel} score={arrival.fuelRiskScore} compact />
                  </div>
                  {arrival.fuelWarnings.map((w) => (
                    <WarningBanner key={w.code} warning={w} />
                  ))}
                </div>
              )}

              {arrival.handlingInstructions && (
                <p className="text-xs text-slate-400 italic border-t border-slate-700/50 pt-2">
                  {arrival.handlingInstructions}
                </p>
              )}
              {arrival.notes && <p className="text-xs text-amber-300/80 italic">{arrival.notes}</p>}
            </div>
          )
        })}
      </div>

      {/* ── Outbound departures ─────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Outbound Departures — soonest first
        </h2>
        {sortedDepartures.length === 0 && (
          <p className="text-slate-500 text-sm italic">No active departures.</p>
        )}
        {sortedDepartures.map((dep) => {
          const minsUntilDep = dep.minsUntil
          return (
            <div
              key={dep.id}
              data-testid={`departure-card-${dep.id}`}
              className="rounded border border-amber-700/40 bg-amber-900/10 p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-400 font-mono font-bold text-xs">▲ DEP</span>
                  <span className="font-mono font-bold text-slate-100">{dep.tailNumber}</span>
                  <span className="text-slate-300 text-sm">{dep.makeModel}</span>
                  <FuelTypeBadge fuelType={dep.fuelType} />
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${
                  dep.status === 'preparing' ? 'text-amber-400' :
                  dep.status === 'scheduled' ? 'text-sky-400' : 'text-slate-400'
                }`}>
                  {dep.status === 'preparing' ? 'Preparing' : dep.status === 'scheduled' ? 'Scheduled' : dep.status}
                </span>
              </div>

              {/* ETD */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 w-28 flex-shrink-0">Departure (ETD):</span>
                <span className="font-mono text-amber-200">{formatEtaTime(dep.etd)}</span>
                <span className={`font-medium ${minsUntilDep < 30 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {timeUntilLabel(dep.etd)}
                </span>
              </div>

              {/* Crew / pax / destination */}
              <div className="text-xs text-slate-400">
                To <span className="text-slate-300">{dep.toIcao}</span>
                {' · '}{dep.crewCount} crew · {dep.passengerCount} pax
                {' · '}{dep.pilotName}
              </div>

              {/* Services with status dots */}
              <ServiceDotList
                servicesRequested={dep.servicesRequested}
                serviceStatuses={dep.serviceStatuses}
                minsUntilOp={minsUntilDep}
              />

              {/* Transportation */}
              <TransportChip transport={dep.transportPreferences} minsUntilOp={minsUntilDep} />

              {dep.notes && <p className="text-xs text-slate-400 italic border-t border-slate-700/50 pt-2">{dep.notes}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({ enrichedOrders }) {
  const [statusFilter, setStatusFilter] = useState('active')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = useMemo(() => {
    let result = enrichedOrders
    if (statusFilter === 'active') {
      result = result.filter((o) => o.status === 'pending' || o.status === 'in_progress')
    } else if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter)
    }
    if (typeFilter !== 'all') {
      result = result.filter((o) => o.serviceType === typeFilter)
    }
    return [...result].sort((a, b) => b.riskScore - a.riskScore)
  }, [enrichedOrders, statusFilter, typeFilter])

  const serviceTypes = [...new Set(enrichedOrders.map((o) => o.serviceType))]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex gap-1">
          {['active', 'all', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={[
                'px-2 py-1 rounded text-xs transition-colors',
                statusFilter === f
                  ? 'bg-sky-400/20 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              {f === 'active' ? 'Active' : f === 'all' ? 'All' : 'Completed'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2 py-1 rounded text-xs transition-colors ${typeFilter === 'all' ? 'bg-sky-400/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All types
          </button>
          {serviceTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-1 rounded text-xs transition-colors ${typeFilter === t ? 'bg-sky-400/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {serviceTypeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm">No orders match current filters.</p>
        )}
        {filtered.map((o) => (
          <ServiceOrderCard key={o.id} order={o} />
        ))}
      </div>
    </div>
  )
}

// ─── Fees Tab ─────────────────────────────────────────────────────────────────

function FeesTab() {
  const categories = [
    'piston_single', 'piston_twin', 'turboprop_single', 'turboprop_twin',
    'jet_light', 'jet_midsize', 'jet_heavy',
  ]

  const rampFees = FEE_SCHEDULE.filter((f) => f.serviceType === 'ramp_fee')
  const hangarFees = FEE_SCHEDULE.filter((f) => f.serviceType === 'hangar_fee')
  const fuelFees = FEE_SCHEDULE.filter((f) => f.serviceType === 'fueling')
  const otherFees = FEE_SCHEDULE.filter((f) => !['ramp_fee', 'hangar_fee', 'fueling'].includes(f.serviceType))

  return (
    <div className="space-y-6">
      {/* Ramp + Hangar matrix */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Recurring Fees by Aircraft Category
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-surface-border">
                <th className="text-left py-2 pr-4">Category</th>
                <th className="text-right py-2 pr-4">Ramp / Day</th>
                <th className="text-right py-2 pr-4">Hangar / Night</th>
                <th className="text-left py-2 text-slate-600">Ramp waiver</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const ramp = rampFees.find((f) => f.category === cat)
                const hangar = hangarFees.find((f) => f.category === cat)
                return (
                  <tr key={cat} className="border-b border-surface-border/50">
                    <td className="py-2 pr-4 text-slate-300">{fboCategoryLabel(cat)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-400">
                      ${ramp?.feePerUnit ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-green-400">
                      ${hangar?.feePerUnit ?? '—'}
                    </td>
                    <td className="py-2 text-slate-500">{ramp?.notes}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fuel prices */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Fuel — Retail Into-Plane Rates
        </h2>
        <div className="flex gap-4">
          {fuelFees.map((f) => (
            <div key={f.id} className="rounded border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm flex-1">
              <div className="font-bold text-slate-200">{f.label}</div>
              <div className="text-2xl font-mono font-bold text-green-400 mt-1">${f.feePerUnit.toFixed(2)}</div>
              <div className="text-xs text-slate-500 mt-1">per gallon</div>
              {f.notes && <div className="text-xs text-slate-400 mt-2">{f.notes}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Other services */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Other Services
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-surface-border">
                <th className="text-left py-2 pr-4">Service</th>
                <th className="text-right py-2 pr-4">Rate</th>
                <th className="text-left py-2 pr-2">Unit</th>
                <th className="text-left py-2 text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {otherFees.map((f) => (
                <tr key={f.id} className="border-b border-surface-border/50">
                  <td className="py-1.5 pr-4 text-slate-300">{f.label}</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-green-400">
                    {f.feePerUnit < 1 ? `$${f.feePerUnit.toFixed(2)}` : `$${f.feePerUnit}`}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-400">{f.unit}</td>
                  <td className="py-1.5 text-slate-500">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transportation */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Transportation Services
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-surface-border">
                <th className="text-left py-2 pr-4">Service</th>
                <th className="text-right py-2 pr-4">Rate</th>
                <th className="text-left py-2 pr-2">Unit</th>
                <th className="text-left py-2 text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {FEE_SCHEDULE.filter((f) => f.serviceType === 'transportation').map((f) => (
                <tr key={f.id} className="border-b border-surface-border/50">
                  <td className="py-1.5 pr-4 text-slate-300">{f.label}</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-green-400">
                    {f.feePerUnit === 0 ? 'Free' : `$${f.feePerUnit}`}
                  </td>
                  <td className="py-1.5 pr-2 text-slate-400">{f.unit}</td>
                  <td className="py-1.5 text-slate-500">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Crew vehicle status */}
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-500 mb-2">Crew Car Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {mockCrewVehicles.map((v) => {
              const statusColor =
                v.status === 'checked_out' ? 'text-amber-400' :
                v.status === 'filled'      ? 'text-green-400' :
                v.status === 'cleaned'     ? 'text-sky-400'   : 'text-slate-400'
              return (
                <div key={v.id} className="rounded border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{v.label}</span>
                    <span className={statusColor}>{v.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-slate-500">{v.make} {v.model} {v.year}</div>
                  {v.checkedOutTo && (
                    <div className="text-amber-300 text-xs">Out: {v.checkedOutTo}</div>
                  )}
                  {v.notes && <div className="text-slate-600">{v.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Staff & Safety Tab ───────────────────────────────────────────────────────

function FuelConfusionReferenceCard() {
  return (
    <div className="rounded border border-amber-400/30 bg-amber-900/10 p-4 space-y-3">
      <h3 className="text-sm font-bold text-amber-300">
        Fuel Type Reference — Required Reading for All Line Staff
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Avgas */}
        <div className="rounded border border-blue-400/30 bg-blue-900/20 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-400" />
            <span className="font-bold text-blue-300 text-sm">Avgas 100LL (Blue)</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
            <li>Piston engines only</li>
            <li>Smaller filler nozzle</li>
            <li>Blue dye — visually distinguishable</li>
            <li>Examples: C172, Cherokee, Baron 58, Seneca</li>
          </ul>
        </div>
        {/* Jet-A */}
        <div className="rounded border border-orange-400/30 bg-orange-900/20 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="font-bold text-orange-300 text-sm">Jet-A (Straw / Clear)</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
            <li>Turbine and turboprop engines</li>
            <li>Large nozzle — <strong>physically cannot enter Avgas filler port</strong></li>
            <li>TURBOPROPS HAVE PROPELLERS but burn Jet-A</li>
            <li>Examples: Cessna Caravan, King Air, TBM, PC-12</li>
          </ul>
        </div>
      </div>
      {/* Critical warning */}
      <div className="rounded border border-red-400/50 bg-red-900/30 px-3 py-2.5 space-y-1">
        <p className="text-xs font-bold text-red-300">
          Critical Risk: Avgas nozzle IS smaller and CAN enter a Jet-A filler port.
        </p>
        <p className="text-xs text-red-200/80">
          A turboprop with propellers looks like a piston aircraft. Low-experience staff
          may see the propeller and reach for the Avgas hose — this IS the misfueling path.
          Always verify aircraft fuel type from the filler-cap placard or POH before opening
          any filler cap. When unsure, stop and ask a senior technician.
        </p>
      </div>
    </div>
  )
}

function DefconReferenceCard() {
  const levels = [
    { level: 1, description: 'Stop — supervisor required. Do not proceed without senior sign-off.' },
    { level: 2, description: 'High risk — experienced staff only. Brief team before starting.' },
    { level: 3, description: 'Caution — supervisor awareness required. Double-check fuel type.' },
    { level: 4, description: 'Monitor — routine precautions apply. Confirm checklist.' },
    { level: 5, description: 'Normal — standard operating procedures.' },
  ]
  return (
    <div className="rounded border border-slate-700 bg-slate-800/30 p-4 space-y-2">
      <h3 className="text-sm font-bold text-slate-300">DEFCON Risk Level Guide</h3>
      <div className="space-y-1.5">
        {levels.map(({ level, description }) => {
          const cls = defconClasses(level)
          return (
            <div key={level} className={`flex items-start gap-3 rounded px-2 py-1.5 ${cls.bg}`}>
              <span className={`font-mono font-bold text-sm flex-shrink-0 ${cls.text}`}>
                DC{level}
              </span>
              <div>
                <span className={`text-xs font-bold ${cls.text}`}>{defconLabel(level)}</span>
                <span className="text-xs text-slate-400 ml-2">{description}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeatherRiskCard() {
  const items = Object.entries(WEATHER_RISK).filter(([, v]) => v > 0)
  return (
    <div className="rounded border border-slate-700 bg-slate-800/30 p-4 space-y-2">
      <h3 className="text-sm font-bold text-slate-300">Weather Risk Addends</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(([condition, delta]) => (
          <div key={condition} className="flex items-center justify-between text-xs border border-slate-700/50 rounded px-2 py-1">
            <span className={weatherColor(condition)}>{weatherLabel(condition)}</span>
            <span className={`font-mono font-bold ${delta >= 4 ? 'text-red-400' : delta >= 2 ? 'text-orange-400' : 'text-yellow-400'}`}>
              +{delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StaffSafetyTab({ enrichedOrders }) {
  const fboStaff = mockPersonnel.filter((p) => FBO_STAFF_IDS.includes(p.id))
  const activeOrders = enrichedOrders.filter((o) => o.status === 'pending' || o.status === 'in_progress')

  return (
    <div className="space-y-6">
      <FuelConfusionReferenceCard />

      {/* Staff cards */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Line Service Staff
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fboStaff.map((staff) => {
            const assignedOrders = activeOrders.filter((o) => o.assignedTo === staff.id)
            const highestRisk = assignedOrders.length > 0
              ? Math.max(...assignedOrders.map((o) => o.riskScore))
              : 0
            const topLevel = defconLevel(highestRisk)
            const topCls = highestRisk > 0 ? defconClasses(topLevel) : defconClasses(5)

            const expYrs = staff.yearsExperience
            const expCategory =
              expYrs == null ? 'Unknown' :
              expYrs < 1  ? '< 1 yr — High risk addend +4' :
              expYrs < 3  ? `${expYrs} yr — Risk addend +3` :
              expYrs < 7  ? `${expYrs} yr — Risk addend +2` :
              expYrs < 15 ? `${expYrs} yr — Risk addend +1` :
                            `${expYrs} yr — Risk addend +0`

            return (
              <div
                key={staff.id}
                className="rounded border border-slate-700 bg-slate-800/40 p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">{staff.name}</div>
                    <div className="text-xs text-slate-400">{staff.roleLabel}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      staff.currentLocation === 'on_prem' ? 'bg-green-900/40 text-green-300' :
                      staff.currentLocation === 'off_site' ? 'bg-amber-900/40 text-amber-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {staff.currentLocation?.replace('_', ' ')}
                    </span>
                    {assignedOrders.length > 0 && (
                      <DefconBadge level={topLevel} score={highestRisk} compact />
                    )}
                  </div>
                </div>

                {/* Experience */}
                <div className={`text-xs rounded px-2 py-1 ${
                  expYrs != null && expYrs < 2
                    ? 'bg-red-900/30 text-red-300'
                    : expYrs != null && expYrs < 5
                    ? 'bg-amber-900/20 text-amber-300'
                    : 'bg-slate-700/40 text-slate-400'
                }`}>
                  Experience: {expCategory}
                </div>

                {/* Active assignments */}
                {assignedOrders.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Active assignments:</div>
                    {assignedOrders.map((o) => (
                      <div key={o.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${defconClasses(o.defconLevel).bg}`}>
                        <DefconBadge level={o.defconLevel} compact />
                        <span className="font-mono text-slate-300">{o.tailNumber}</span>
                        <span className="text-slate-400">{serviceTypeLabel(o.serviceType)}</span>
                        {o.fuelType && <FuelTypeBadge fuelType={o.fuelType} />}
                      </div>
                    ))}
                  </div>
                )}

                {expYrs != null && expYrs < 2 && assignedOrders.some((o) => o.serviceType === 'fueling') && (
                  <div className="text-xs bg-red-900/30 border border-red-400/30 rounded px-2 py-1.5 text-red-300">
                    ⚠ Low-experience staff assigned to fueling — supervisor co-sign required
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DefconReferenceCard />
        <WeatherRiskCard />
      </div>
    </div>
  )
}

// ─── Main FBO Component ───────────────────────────────────────────────────────

const TABS = ['overview', 'aircraft_ops', 'services', 'fees', 'staff_safety']
const TAB_LABELS = {
  overview:     'Overview',
  aircraft_ops: 'Aircraft Ops',
  services:     'Services',
  fees:         'Fees',
  staff_safety: 'Staff & Safety',
}

export function FBO() {
  const [tab, setTab] = useState('overview')

  const simState       = useSimBroadcast()
  const mockOrders     = useMemo(() => mockServiceOrders.map(enrichOrder), [])
  const enrichedOrders = simState?.running ? simStateToOrders(simState) : mockOrders
  const simNowMs       = simState?.simTimeMs ?? Date.now()

  // Always use sim data — empty arrays when no sim is running
  const enrichedArrivals = (simState?.aircraft ?? [])
    .filter((ac) => !['taxiing_out', 'departed'].includes(ac.state))
    .map((ac) => simAcToArrival(ac, simNowMs))

  const enrichedDepartures = (simState?.aircraft ?? [])
    .filter((ac) => ac.state === 'taxiing_out')
    .map((ac) => simAcToDeparture(ac, simNowMs))

  const pendingCrossModule = FBO_MAINTENANCE_LINKS.filter((l) => l.status === 'pending')

  return (
    <div className="space-y-4">
      {/* Simulation active banner */}
      {simState?.running && (
        <div className="rounded border border-green-400/40 bg-green-900/20 px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-green-400 font-bold">● SIM ACTIVE</span>
          <span className="text-green-300">
            {simState.aircraft?.length ?? 0} aircraft on field ·{' '}
            {simState.staff?.filter((p) => p.state !== 'available').length ?? 0} staff deployed
          </span>
          <span className="text-xs text-slate-500 ml-auto">
            Last event: {simState.events?.[0]?.message ?? '—'}
          </span>
        </div>
      )}
      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">FBO Operations</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Ground services · Fueling · Aircraft Ops · Transportation · Ramp management · Safety risk scoring
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-surface-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-3 py-2 text-sm rounded-t transition-colors',
              tab === t
                ? 'bg-sky-400/10 text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview' && (
          <OverviewTab
            enrichedOrders={enrichedOrders}
            enrichedArrivals={enrichedArrivals}
            enrichedDepartures={enrichedDepartures}
            pendingCrossModule={pendingCrossModule}
            simState={simState}
          />
        )}
        {tab === 'aircraft_ops' && (
          <AircraftOpsTab enrichedArrivals={enrichedArrivals} enrichedDepartures={enrichedDepartures} />
        )}
        {tab === 'services' && <ServicesTab enrichedOrders={enrichedOrders} />}
        {tab === 'fees' && <FeesTab />}
        {tab === 'staff_safety' && <StaffSafetyTab enrichedOrders={enrichedOrders} />}
      </div>
    </div>
  )
}
