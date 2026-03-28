/**
 * Schedule-level conflict detection across all flights.
 *
 * Detects two classes of conflict:
 *   - Pilot conflicts: same pilot double-booked, or impossible airport transit
 *   - Aircraft conflicts: aircraft physically can't be at departure airport
 *     (previous flight landed somewhere else, or still airborne)
 *
 * Also generates "implied repositioning" entries — phantom flights the system
 * infers are needed to move an aircraft from where it is to where it needs to be.
 */

import { estimateFlightDuration, estimateEta, CRUISE_SPEEDS_KTS, routeDistNm } from './flightCalc'

const LIVE = new Set(['planned', 'active'])
const REPOSITION_BUFFER_MIN = 30   // minimum ground time before a turnaround departs

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute ETA for a flight using cruise-speed estimate */
function flightEta(flight) {
  const kts = CRUISE_SPEEDS_KTS[flight.aircraftType] ?? 150
  const est  = estimateFlightDuration(flight.departure, flight.arrival, kts, 15)
  if (!est) return null
  return estimateEta(new Date(flight.plannedDepartureUtc), est.totalHours)
}

function addConflict(map, flightId, entry) {
  if (!map[flightId]) map[flightId] = []
  // Deduplicate
  const dup = map[flightId].some(
    (e) => e.type === entry.type && e.conflictFlightId === entry.conflictFlightId
  )
  if (!dup) map[flightId].push(entry)
}

function fmtUtc(date) {
  if (!date) return '?'
  return new Date(date).toUTCString().slice(17, 22) + 'Z'
}

function gapMinutes(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 60_000)
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute all conflicts and implied repositioning gaps across a flight list.
 *
 * @param {Flight[]} allFlights  - full set of flights (from getAllFlights or a subset)
 * @returns {{
 *   pilotConflicts:    { [flightId]: ConflictEntry[] },
 *   aircraftConflicts: { [flightId]: ConflictEntry[] },
 *   impliedRepos:      ImpliedRepo[],
 * }}
 */
export function computeScheduleConflicts(allFlights) {
  const live = allFlights.filter((f) => LIVE.has(f.status))

  const pilotConflicts    = {}
  const aircraftConflicts = {}
  const impliedRepos      = []

  // ── Pilot conflicts ───────────────────────────────────────────────────────

  // Map pilotId → all their assignments (flight + role)
  const pilotMap = {}
  for (const f of live) {
    for (const [role, pid] of [['pic', f.picId], ['sic', f.sicId]]) {
      if (!pid) continue
      if (!pilotMap[pid]) pilotMap[pid] = []
      pilotMap[pid].push({ flight: f, role })
    }
  }

  for (const [, assignments] of Object.entries(pilotMap)) {
    if (assignments.length < 2) continue

    const sorted = [...assignments].sort(
      (a, b) => new Date(a.flight.plannedDepartureUtc) - new Date(b.flight.plannedDepartureUtc)
    )

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const fA  = sorted[i].flight
        const fB  = sorted[j].flight
        const depA = new Date(fA.plannedDepartureUtc)
        const depB = new Date(fB.plannedDepartureUtc)
        const etaA = flightEta(fA)
        const etaB = flightEta(fB)
        if (!etaA) continue

        // Time overlap: B departs before A lands
        if (depB < etaA) {
          addConflict(pilotConflicts, fB.id, {
            type:             'pilot_overlap',
            message:          `Pilot still flying ${fA.departure}→${fA.arrival} (lands ~${fmtUtc(etaA)})`,
            conflictFlightId: fA.id,
            conflictFlight:   fA,
          })
          addConflict(pilotConflicts, fA.id, {
            type:             'pilot_overlap',
            message:          `Next flight ${fB.departure}→${fB.arrival} departs at ${fmtUtc(depB)} before this lands`,
            conflictFlightId: fB.id,
            conflictFlight:   fB,
          })
          continue
        }

        // Location mismatch: A arrives X, B departs Y ≠ X, within 2 h
        const gapH = (depB - etaA) / 3_600_000
        if (gapH < 2 && fA.arrival && fB.departure && fA.arrival !== fB.departure) {
          addConflict(pilotConflicts, fB.id, {
            type:             'pilot_location',
            message:          `Pilot arrives ${fA.arrival} ~${fmtUtc(etaA)}, only ${gapMinutes(etaA, depB)}m to reach ${fB.departure}`,
            conflictFlightId: fA.id,
            conflictFlight:   fA,
          })
        }
      }
    }
  }

  // ── Aircraft conflicts + implied repositioning ────────────────────────────

  // Group by tailNumber, sorted by departure
  const byTail = {}
  for (const f of live) {
    if (!f.tailNumber) continue
    ;(byTail[f.tailNumber] = byTail[f.tailNumber] ?? []).push(f)
  }

  for (const [tail, tailFlights] of Object.entries(byTail)) {
    if (tailFlights.length < 2) continue

    const sorted = [...tailFlights].sort(
      (a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc)
    )

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr    = sorted[i]
      const next    = sorted[i + 1]
      const depNext = new Date(next.plannedDepartureUtc)
      const eta     = flightEta(curr)

      // Time overlap: next departs before current lands
      if (eta && depNext < eta) {
        addConflict(aircraftConflicts, next.id, {
          type:             'aircraft_overlap',
          message:          `${tail} still airborne on ${curr.departure}→${curr.arrival} (ETA ${fmtUtc(eta)})`,
          conflictFlightId: curr.id,
          conflictFlight:   curr,
        })
        addConflict(aircraftConflicts, curr.id, {
          type:             'aircraft_overlap',
          message:          `Next flight departs ${fmtUtc(depNext)}, aircraft not yet landed`,
          conflictFlightId: next.id,
          conflictFlight:   next,
        })
      }

      // Location mismatch: aircraft ends up at a different airport than next departure
      if (curr.arrival && next.departure && curr.arrival !== next.departure) {
        const windowMs    = depNext - (eta ?? depNext)
        const windowMin   = Math.round(windowMs / 60_000)
        const repoDistNm  = routeDistNm(curr.arrival, next.departure)
        const repoKts     = CRUISE_SPEEDS_KTS[curr.aircraftType] ?? 150
        const repoEst     = estimateFlightDuration(curr.arrival, next.departure, repoKts, 15)
        const feasible    = repoEst ? (repoEst.totalHours * 60 + REPOSITION_BUFFER_MIN) <= windowMin : null

        addConflict(aircraftConflicts, next.id, {
          type:             'aircraft_location',
          message:          `${tail} at ${curr.arrival} after prev flight — must reach ${next.departure}${windowMin > 0 ? ` in ${windowMin}m` : ''}`,
          conflictFlightId: curr.id,
          conflictFlight:   curr,
          feasible,
        })

        impliedRepos.push({
          id:          `implied-${curr.id}-${next.id}`,
          _type:       'implied_reposition',
          tailNumber:  tail,
          aircraftType: curr.aircraftType,
          fromAirport:  curr.arrival,
          toAirport:    next.departure,
          windowStart:  eta ?? new Date(curr.plannedDepartureUtc),
          windowEnd:    depNext,
          windowMinutes: windowMin,
          distNm:       repoDistNm,
          estFlightHours: repoEst?.totalHours ?? null,
          feasible,
          prevFlight: curr,
          nextFlight: next,
        })
      }
    }
  }

  return { pilotConflicts, aircraftConflicts, impliedRepos }
}

/**
 * Merge pilot and aircraft conflicts for a flight into a single list.
 * Used for display in FlightBar.
 */
export function allConflictsForFlight(flightId, pilotConflicts, aircraftConflicts) {
  return [
    ...(pilotConflicts[flightId] ?? []),
    ...(aircraftConflicts[flightId] ?? []),
  ]
}
