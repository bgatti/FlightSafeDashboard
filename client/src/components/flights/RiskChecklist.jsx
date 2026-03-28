import { useState, useEffect } from 'react'
import { getFlightAcks, setAck, removeAck, subscribeAcks, countAcks } from '../../store/ackStore'

const SEV_COLOR = {
  critical: 'text-red-400 bg-red-400/10 border-red-500/30',
  high:     'text-orange-400 bg-orange-400/10 border-orange-500/30',
  moderate: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
  low:      'text-slate-400 bg-slate-700/40 border-slate-600/40',
}

const CAT_LABEL = {
  terrain: 'Terrain',
  weather: 'Weather',
  wx:      'Weather',
  pilot:   'Pilot',
  operational: 'Operations',
}

/** Single checkable risk item row. */
function RiskItemRow({ flightId, item, currentUser, canCrewAck, canSupervisorAck, acks }) {
  const itemAcks  = acks[item.id] ?? {}
  const crewAck   = itemAcks.crew
  const supAck    = itemAcks.supervisor

  function toggle(role) {
    if (role === 'crew' && !canCrewAck) return
    if (role === 'supervisor' && !canSupervisorAck) return
    const existing = role === 'crew' ? crewAck : supAck
    if (existing) {
      removeAck(flightId, item.id, role)
    } else {
      setAck(flightId, item.id, role, currentUser.id, currentUser.shortName)
    }
  }

  const rph = item.additionalRiskPerMhr
  return (
    <div className={`flex items-start gap-3 rounded border px-3 py-2 text-xs ${SEV_COLOR[item.severity] ?? SEV_COLOR.low}`}>
      {/* Severity dot */}
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-2 h-2 rounded-full ${
          item.severity === 'critical' ? 'bg-red-400'
          : item.severity === 'high'   ? 'bg-orange-400'
          : item.severity === 'moderate' ? 'bg-yellow-400'
          : 'bg-slate-500'
        }`} />
      </div>

      {/* Label + source */}
      <div className="flex-1 min-w-0">
        <span className="font-medium">{item.label}</span>
        {rph > 0 && <span className="ml-2 opacity-60">+{rph.toFixed(1)} acc/Mhr</span>}
        <span className="ml-2 opacity-50 capitalize">{CAT_LABEL[item.category] ?? item.category}</span>
      </div>

      {/* Crew ack */}
      <button
        onClick={() => toggle('crew')}
        disabled={!canCrewAck}
        title={crewAck ? `Acknowledged by ${crewAck.name}` : canCrewAck ? 'Click to acknowledge (crew)' : 'Not your flight'}
        className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
          crewAck
            ? 'bg-green-400/20 border-green-500/40 text-green-400'
            : canCrewAck
              ? 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
              : 'border-slate-700 text-slate-600 cursor-not-allowed'
        }`}
      >
        <span>{crewAck ? '✓' : '○'}</span>
        <span>Crew</span>
        {crewAck && <span className="opacity-60 font-normal">{crewAck.name}</span>}
      </button>

      {/* Supervisor ack */}
      <button
        onClick={() => toggle('supervisor')}
        disabled={!canSupervisorAck}
        title={supAck ? `Acknowledged by ${supAck.name}` : canSupervisorAck ? 'Click to acknowledge (supervisor)' : 'Not authorized'}
        className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
          supAck
            ? 'bg-sky-400/20 border-sky-500/40 text-sky-400'
            : canSupervisorAck
              ? 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
              : 'border-slate-700 text-slate-600 cursor-not-allowed'
        }`}
      >
        <span>{supAck ? '✓' : '○'}</span>
        <span>Supvr</span>
        {supAck && <span className="opacity-60 font-normal">{supAck.name}</span>}
      </button>
    </div>
  )
}

// ─── RiskChecklist (exported) ─────────────────────────────────────────────────

/**
 * Props:
 *  flight       - full flight record (needs id, picId, riskSnapshot.riskItems)
 *  currentUser  - { id, name, shortName, role, isChiefPilot }
 */
export function RiskChecklist({ flight, currentUser }) {
  const [acks, setAcks] = useState(() => getFlightAcks(flight.id))

  useEffect(() => {
    const unsub = subscribeAcks(() => setAcks(getFlightAcks(flight.id)))
    return unsub
  }, [flight.id])

  const items = flight.riskSnapshot?.riskItems ?? []
  if (items.length === 0) {
    return (
      <div className="text-xs text-slate-600 italic">
        No risk items captured — scheduled via legacy system or no active factors.
      </div>
    )
  }

  // Permission logic
  const isPIC         = currentUser.id === flight.picId
  const isChiefPilot  = currentUser.isChiefPilot
  const isSafetyOfficer = currentUser.role === 'safety_officer'
  const picIsChief    = flight.picId && flight.picId === /* chief pilot id */ 'prs-001'

  const canCrewAck       = isPIC
  const canSupervisorAck = (!isPIC && isChiefPilot) || (isSafetyOfficer && picIsChief)

  const { crew, supervisor, total } = countAcks(flight.id, items.length)

  // Group by category
  const grouped = {}
  for (const item of items) {
    const cat = item.category ?? 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  const sortOrder = ['pilot', 'weather', 'terrain', 'operational', 'other']
  const sortedCats = Object.keys(grouped).sort(
    (a, b) => (sortOrder.indexOf(a) ?? 99) - (sortOrder.indexOf(b) ?? 99)
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Risk Review</span>
        <div className="flex gap-3">
          <span className={crew >= total ? 'text-green-400' : 'text-slate-500'}>
            Crew {crew}/{total}
          </span>
          <span className={supervisor >= total ? 'text-sky-400' : 'text-slate-500'}>
            Supvr {supervisor}/{total}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
        <div className="h-full bg-green-400/80 transition-all" style={{ width: `${(crew / total) * 50}%` }} />
        <div className="h-full bg-sky-400/80 transition-all" style={{ width: `${(supervisor / total) * 50}%` }} />
      </div>

      {/* Role context */}
      {!canCrewAck && !canSupervisorAck && (
        <p className="text-xs text-slate-600 italic">
          {isPIC ? null : 'You are not authorized to acknowledge risks for this flight in your current role.'}
        </p>
      )}

      {/* Risk items by category */}
      {sortedCats.map((cat) => (
        <div key={cat}>
          <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">
            {CAT_LABEL[cat] ?? cat}
          </div>
          <div className="flex flex-col gap-1.5">
            {grouped[cat].map((item) => (
              <RiskItemRow
                key={item.id}
                flightId={flight.id}
                item={item}
                currentUser={currentUser}
                canCrewAck={canCrewAck}
                canSupervisorAck={canSupervisorAck}
                acks={acks}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Small progress chip for the collapsed FlightBar row. */
export function AckProgressChip({ flightId, totalItems, currentUserIsPIC }) {
  const [counts, setCounts] = useState(() => countAcks(flightId, totalItems))

  useEffect(() => {
    const unsub = subscribeAcks(() => setCounts(countAcks(flightId, totalItems)))
    return unsub
  }, [flightId, totalItems])

  if (totalItems === 0) return null

  const relevant = currentUserIsPIC ? counts.crew : counts.supervisor
  const isComplete = relevant >= totalItems

  return (
    <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
      isComplete
        ? 'bg-green-400/10 border-green-500/20 text-green-400'
        : 'bg-slate-700/30 border-slate-600/40 text-slate-500'
    }`}>
      <span>{relevant}/{totalItems}</span>
      <span>✓</span>
    </div>
  )
}
