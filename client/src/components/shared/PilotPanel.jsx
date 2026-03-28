import { useState, useMemo } from 'react'
import { estimateFlightDuration, estimateEta, formatHours } from '../../lib/flightCalc'
import { computeFatigueMetrics, checkSchedulingConflicts } from '../../lib/pilotSchedule'

// ─── Small helpers ────────────────────────────────────────────────────────────

function riskColor(score, disqualified) {
  if (disqualified) return 'text-red-400'
  if (score <= 20)  return 'text-green-400'
  if (score <= 45)  return 'text-yellow-400'
  if (score <= 70)  return 'text-orange-400'
  return 'text-red-400'
}

function riskBg(score, disqualified) {
  if (disqualified) return 'bg-red-500/10 border-red-500/30'
  if (score <= 20)  return 'bg-green-400/10 border-green-500/20'
  if (score <= 45)  return 'bg-yellow-400/10 border-yellow-500/20'
  if (score <= 70)  return 'bg-orange-400/10 border-orange-500/20'
  return 'bg-red-500/10 border-red-500/30'
}

function fatigueBg(risk) {
  if (risk === 'critical') return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (risk === 'warning')  return 'text-orange-400 bg-orange-500/10 border-orange-500/30'
  if (risk === 'caution')  return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
  return 'text-slate-500 bg-slate-700/20 border-slate-700/40'
}

// ─── AvailabilityChip (exported for collapsed card rows) ──────────────────────

function AvailabilityChip({ assessments }) {
  if (!assessments) return null
  const qualified = assessments.filter((a) => !a.disqualified)
  const warnings  = assessments.filter((a) => !a.disqualified && a.factors.length > 0)
  const disq      = assessments.filter((a) => a.disqualified)

  if (qualified.length === 0) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/30">
        No qualified pilot
      </span>
    )
  }
  if (warnings.length === qualified.length) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded border bg-yellow-400/10 text-yellow-400 border-yellow-500/20">
        {qualified.length} pilot{qualified.length !== 1 ? 's' : ''} · warnings
      </span>
    )
  }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded border bg-green-400/10 text-green-400 border-green-500/20">
      {qualified.length} pilot{qualified.length !== 1 ? 's' : ''} available
      {disq.length > 0 ? ` · ${disq.length} disq.` : ''}
    </span>
  )
}

// ─── PilotBioRow ──────────────────────────────────────────────────────────────

function PilotBioRow({ assessment, estimatedFlightHours, departureAirport, departureTime, estimatedEta, onSelectAsPic }) {
  const [expanded, setExpanded] = useState(false)
  const a = assessment

  // Fatigue + conflicts
  const fatigue = useMemo(() => {
    if (!a.pilotId) return null
    const day = departureTime ? new Date(departureTime) : new Date()
    return computeFatigueMetrics(a.pilotId, day, estimatedFlightHours ?? 0)
  }, [a.pilotId, departureTime, estimatedFlightHours])

  const conflicts = useMemo(() => {
    if (!a.pilotId || !departureAirport || !departureTime) return []
    return checkSchedulingConflicts(a.pilotId, departureAirport, departureTime, estimatedEta)
  }, [a.pilotId, departureAirport, departureTime, estimatedEta])

  const hasConflict = conflicts.length > 0
  const hasFatigueIssue = fatigue?.fatigueRisk === 'warning' || fatigue?.fatigueRisk === 'critical'

  return (
    <div className={`border rounded p-3 text-xs flex flex-col gap-2 ${
      hasConflict ? 'bg-red-500/10 border-red-500/30' : riskBg(a.riskScore, a.disqualified)
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            hasConflict ? 'bg-red-500 animate-pulse' : a.disqualified ? 'bg-red-500' : 'bg-green-400'
          }`}
          title={hasConflict ? 'Scheduling conflict' : a.disqualified ? 'Disqualified' : 'Available'}
        />

        {/* Name + cert */}
        <div className="flex-1 min-w-0">
          <span className="text-slate-200 font-medium">{a.name}</span>
          <span className="text-slate-500 ml-1.5">{a.certType} · Class {a.medicalClass} medical</span>
        </div>

        {/* Today's hours (fatigue chip) */}
        {fatigue && (
          <div className={`flex-shrink-0 text-center px-2 py-0.5 rounded border ${fatigueBg(fatigue.fatigueRisk)}`}>
            <div className="font-mono">{formatHours(fatigue.projectedHours)}</div>
            <div className="text-slate-500 text-[9px]">today{fatigue.flightCount > 0 ? ` (${fatigue.flightCount}+1 flt)` : ''}</div>
          </div>
        )}

        {/* TOL in type */}
        <div className="text-center flex-shrink-0">
          <div className="font-mono text-slate-300">{a.tolInType90d}</div>
          <div className="text-slate-500">TOL/90d type</div>
        </div>

        {/* Hours in type */}
        <div className="text-center flex-shrink-0">
          <div className="font-mono text-slate-300">{a.hoursInType > 0 ? `${a.hoursInType}h` : '—'}</div>
          <div className="text-slate-500">hrs in type</div>
        </div>

        {/* Total hours */}
        <div className="text-center flex-shrink-0">
          <div className="font-mono text-slate-300">{(a.totalHours / 1000).toFixed(1)}k</div>
          <div className="text-slate-500">total hrs</div>
        </div>

        {/* Risk score */}
        <div className="flex-shrink-0 text-right min-w-[64px]">
          <div className={`font-semibold ${hasConflict ? 'text-red-400' : riskColor(a.riskScore, a.disqualified)}`}>
            {hasConflict ? 'CONFLICT' : a.disqualified ? 'DISQ' : a.riskLabel}
          </div>
          <div className="text-slate-600">{a.riskScore}/100</div>
        </div>

        {/* Quick-schedule button — only for clean green pilots */}
        {onSelectAsPic && !a.disqualified && !hasConflict && !hasFatigueIssue && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelectAsPic(a.pilotId) }}
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors"
          >
            Schedule →
          </button>
        )}

        <button
          className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Conflict warnings — always visible */}
      {hasConflict && (
        <div className="flex flex-col gap-1">
          {conflicts.map((c, i) => (
            <p key={i} className="text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
              ⚠ Conflict: {c.message}
            </p>
          ))}
        </div>
      )}

      {/* Fatigue warning — only if relevant */}
      {!hasConflict && hasFatigueIssue && (
        <p className={`px-2 py-1 rounded border ${
          fatigue.fatigueRisk === 'critical'
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : 'text-orange-300 bg-orange-500/10 border-orange-500/20'
        }`}>
          ⚠ Fatigue: {formatHours(fatigue.projectedHours)} projected today
          {fatigue.fatigueRisk === 'critical' ? ' — exceeds 8h flight time limit' : ' — approaching 8h limit'}
        </p>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/10 pt-2 flex flex-col gap-1.5">
          {/* Licenses + endorsements */}
          <div className="flex flex-wrap gap-1 mb-1">
            {(a.licenses ?? []).flatMap((l) =>
              (l.ratings ?? []).map((r) => (
                <span key={`${l.type}-${r}`} className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  {r}
                </span>
              ))
            )}
            {(a.endorsements ?? []).map((e) => (
              <span key={e} className="px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600">
                {e.replace(/_/g, ' ')}
              </span>
            ))}
          </div>

          {/* Currency dates */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-500">
            <span>IFR currency expires</span>
            <span className={new Date(a.ifrCurrencyExpiry) < new Date() ? 'text-red-400' : 'text-slate-400'}>
              {a.ifrCurrencyExpiry}
            </span>
            <span>Night currency expires</span>
            <span className={new Date(a.nightCurrencyExpiry) < new Date() ? 'text-red-400' : 'text-slate-400'}>
              {a.nightCurrencyExpiry}
            </span>
            <span>Medical expires</span>
            <span className={new Date(a.medicalExpiry) < new Date() ? 'text-red-400' : 'text-slate-400'}>
              {a.medicalExpiry}
            </span>
            <span>Last flight review</span>
            <span className="text-slate-400">{a.lastFlightReview}</span>
            {fatigue && (
              <>
                <span>Flying today (scheduled)</span>
                <span className={hasFatigueIssue ? 'text-orange-400' : 'text-slate-400'}>
                  {formatHours(fatigue.accumulatedHours)} ({fatigue.flightCount} flight{fatigue.flightCount !== 1 ? 's' : ''})
                </span>
              </>
            )}
          </div>

          {/* Hours breakdown */}
          <div className="flex gap-4 mt-1 text-slate-500">
            {Object.entries(a.hoursByCategory ?? {}).map(([k, v]) => (
              <div key={k} className="text-center">
                <div className="text-slate-400 font-mono">{v}</div>
                <div className="text-slate-600">{k}</div>
              </div>
            ))}
          </div>

          {/* Risk factors */}
          {(a.disqualifiers.length > 0 || a.factors.length > 0) && (
            <div className="flex flex-col gap-1 mt-1">
              {a.disqualifiers.map((f) => (
                <p key={f.id} className="text-red-400 bg-red-400/10 border border-red-500/20 rounded px-2 py-0.5">
                  ✕ {f.label}
                </p>
              ))}
              {a.factors.map((f) => (
                <p key={f.id} className={`px-2 py-0.5 rounded border ${
                  f.severity === 'warning'
                    ? 'text-orange-300 bg-orange-400/10 border-orange-500/20'
                    : 'text-yellow-300 bg-yellow-400/10 border-yellow-500/20'
                }`}>
                  ⚠ {f.label}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PilotPanel (exported) ────────────────────────────────────────────────────

/**
 * Shows available crew for a specific aircraft card and provides a
 * "Schedule Flight" form to assign PIC/SIC and create the flight.
 *
 * Props:
 *  - aircraft          : the aircraft record (needs cruiseSpeedKts)
 *  - pilotAssessments  : PilotAssessment[] from PilotRisk API
 *  - loading           : bool — pilots still loading
 *  - flightConditions  : { isIFR, isNight, hasPassengers, dept, arr }
 *  - departureTime     : Date | null — proposed departure
 *  - onSchedule        : (picId, sicId, missionType) => void
 *  - onScheduleReturn  : ({ returnDep, returnArr, returnDepTime, missionType }) => void | undefined
 *  - isScheduled       : bool — flight already scheduled
 *  - scheduledEta      : Date | null — ETA of the just-scheduled flight (for return trip)
 */
export function PilotPanel({
  aircraft, pilotAssessments, loading, flightConditions,
  departureTime, onSchedule, onScheduleReturn, isScheduled, scheduledEta,
}) {
  const [showForm,       setShowForm]       = useState(false)
  const [selectedPic,    setSelectedPic]    = useState('')
  const [selectedSic,    setSelectedSic]    = useState('')
  const [missionType,    setMissionType]    = useState('charter')
  const [confirming,     setConfirming]     = useState(false)
  const [returnScheduled, setReturnScheduled] = useState(false)

  const dept = flightConditions?.dept
  const arr  = flightConditions?.arr

  // Estimated flight duration
  const estDuration = useMemo(() =>
    estimateFlightDuration(dept, arr, aircraft?.cruiseSpeedKts, 15),
    [dept, arr, aircraft?.cruiseSpeedKts]
  )

  const estEta = useMemo(() =>
    estimateEta(departureTime, estDuration?.totalHours),
    [departureTime, estDuration?.totalHours]
  )

  // Return trip departure = ETA + 30 min
  const returnDepTime = scheduledEta
    ? new Date(scheduledEta.getTime() + 30 * 60_000)
    : null

  const qualified = (pilotAssessments ?? []).filter((a) => !a.disqualified)
  const hasRoute  = dept && arr

  async function handleConfirm() {
    if (!selectedPic) return
    setConfirming(true)
    onSchedule(selectedPic, selectedSic || null, missionType)
    setShowForm(false)
    setConfirming(false)
  }

  function handleScheduleReturn() {
    if (!onScheduleReturn || !returnDepTime) return
    onScheduleReturn({
      returnDep: arr,
      returnArr: dept,
      returnDepTime,
      missionType: 'positioning',
    })
    setReturnScheduled(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 uppercase tracking-wide">Crew Assessment</div>
        {/* Flight duration estimate */}
        {estDuration && (
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span className="font-mono text-slate-300">{estDuration.distNm} nm</span>
            <span>·</span>
            <span>Est. <span className="font-mono text-sky-300">{formatHours(estDuration.flightHours)}</span> flight</span>
            <span>·</span>
            <span>Total <span className="font-mono text-slate-300">{formatHours(estDuration.totalHours)}</span> w/ taxi</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 animate-pulse">Assessing pilot qualifications…</p>
      ) : !pilotAssessments ? (
        <p className="text-xs text-slate-600">
          {hasRoute ? 'PilotRisk unavailable' : 'Enter route to assess pilots'}
        </p>
      ) : (
        <>
          {/* Pilot bio rows */}
          <div className="flex flex-col gap-2">
            {pilotAssessments.map((a) => (
              <PilotBioRow
                key={a.pilotId}
                assessment={a}
                estimatedFlightHours={estDuration?.totalHours}
                departureAirport={dept}
                departureTime={departureTime?.toISOString?.() ?? departureTime}
                estimatedEta={estEta}
                onSelectAsPic={(pilotId) => {
                  setSelectedPic(pilotId)
                  setShowForm(true)
                }}
              />
            ))}
          </div>

          {/* Schedule form / post-schedule return trip offer */}
          <div className="border border-surface-border rounded p-3 bg-slate-900/40">
            {isScheduled ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-green-400 font-medium">
                  ✓ Flight scheduled — visible in Flights tab
                </p>
                {/* Return trip offer */}
                {onScheduleReturn && !returnScheduled && returnDepTime && (
                  <div className="flex items-center gap-3 mt-1 p-2 bg-slate-800/60 rounded border border-slate-700/60">
                    <div className="flex-1 text-xs text-slate-400">
                      <span className="text-slate-200">Schedule return trip?</span>
                      <span className="ml-2 font-mono text-sky-300">{arr}→{dept}</span>
                      <span className="ml-2">0 pax · Repositioning · Departs </span>
                      <span className="font-mono text-slate-300">
                        {returnDepTime.toUTCString().slice(17, 22)}Z
                      </span>
                      {estDuration && (
                        <span className="ml-2 text-slate-500">
                          (ETA+30m — {formatHours(estDuration.totalHours)} ground time)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleScheduleReturn}
                      className="text-xs px-3 py-1 rounded border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 transition-colors flex-shrink-0"
                    >
                      Schedule Return
                    </button>
                  </div>
                )}
                {returnScheduled && (
                  <p className="text-xs text-sky-400">✓ Return repositioning trip scheduled</p>
                )}
              </div>
            ) : !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                disabled={qualified.length === 0}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  qualified.length > 0
                    ? 'border-sky-500/50 text-sky-400 hover:bg-sky-500/10'
                    : 'border-slate-700 text-slate-600 cursor-not-allowed'
                }`}
              >
                {qualified.length === 0 ? 'No qualified pilots — cannot schedule' : 'Schedule This Flight…'}
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-slate-400 font-medium">
                  Schedule {aircraft.tailNumber} · {dept}→{arr}
                  {estDuration && (
                    <span className="ml-2 text-slate-500">
                      · {formatHours(estDuration.totalHours)} est. block time
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {/* PIC */}
                  <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                    <label className="text-xs text-slate-500">PIC (required)</label>
                    <select
                      value={selectedPic}
                      onChange={(e) => setSelectedPic(e.target.value)}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">— select pilot —</option>
                      {qualified.map((a) => (
                        <option key={a.pilotId} value={a.pilotId}>
                          {a.name} ({a.certType}) · {a.riskLabel} risk
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SIC (optional) */}
                  <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                    <label className="text-xs text-slate-500">SIC (optional)</label>
                    <select
                      value={selectedSic}
                      onChange={(e) => setSelectedSic(e.target.value)}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">— none —</option>
                      {(pilotAssessments ?? [])
                        .filter((a) => a.pilotId !== selectedPic)
                        .map((a) => (
                          <option key={a.pilotId} value={a.pilotId}>
                            {a.name}{a.disqualified ? ' (DISQ)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Mission type */}
                  <div className="flex flex-col gap-1 min-w-[120px]">
                    <label className="text-xs text-slate-500">Mission type</label>
                    <select
                      value={missionType}
                      onChange={(e) => setMissionType(e.target.value)}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="charter">Charter</option>
                      <option value="training">Training</option>
                      <option value="positioning">Positioning</option>
                      <option value="cargo">Cargo</option>
                      <option value="ferry">Ferry</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedPic || confirming}
                    className={`text-xs px-4 py-1.5 rounded font-medium transition-colors ${
                      selectedPic
                        ? 'bg-sky-600 hover:bg-sky-500 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {confirming ? 'Scheduling…' : 'Confirm & Schedule'}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Re-export the chip for use in collapsed card rows
export { AvailabilityChip }
