/**
 * Pilot scheduling utilities — fatigue estimation and conflict detection.
 *
 * Fatigue model: FAR 135.267 / simple Part 91 guidance
 *   - Flight time limit: 8h in any 24-hour period
 *   - Warning threshold: 7h (1h buffer)
 *   - Rest required between duty days: 10h (FAR 135.273)
 */

import { getAllFlights } from '../store/flights'
import { estimateFlightDuration, estimateEta, CRUISE_SPEEDS_KTS } from './flightCalc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return start-of-day UTC for an ISO string or Date */
function utcDayStart(dateOrIso) {
  const d = new Date(dateOrIso)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function sameUtcDay(a, b) {
  return utcDayStart(a).getTime() === utcDayStart(b).getTime()
}

/** Estimate duration for a flight record in hours (total including taxi) */
function flightDurationHours(flight) {
  const cruiseKts = CRUISE_SPEEDS_KTS[flight.aircraftType] ?? 150
  const est = estimateFlightDuration(flight.departure, flight.arrival, cruiseKts, 15)
  return est?.totalHours ?? 1.5  // fallback: 1.5h if airports unknown
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Get all non-cancelled flights where a pilot is PIC or SIC on a given UTC day.
 * @param {string}  pilotId  - personnel ID
 * @param {Date|string} day  - any point in the target UTC day
 */
export function getPilotFlightsOnDay(pilotId, day) {
  if (!pilotId) return []
  const flights = getAllFlights().filter(
    (f) => f.status !== 'cancelled' &&
           f.status !== 'closed' &&
           (f.picId === pilotId || f.sicId === pilotId) &&
           f.plannedDepartureUtc &&
           sameUtcDay(f.plannedDepartureUtc, day)
  )
  return flights.sort((a, b) =>
    new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc)
  )
}

/**
 * Estimate the pilot's accumulated flying hours today (from scheduled flights).
 * @param {string} pilotId
 * @param {Date|string} day         - which UTC day to check
 * @param {number} [proposedHours]  - additional hours from proposed flight
 * @returns {{ accumulatedHours, projectedHours, flightCount, fatigueRisk }}
 *   fatigueRisk: 'none' | 'warning' | 'critical'
 */
export function computeFatigueMetrics(pilotId, day, proposedHours = 0) {
  const todayFlights = getPilotFlightsOnDay(pilotId, day)
  const accumulatedHours = todayFlights.reduce((sum, f) => sum + flightDurationHours(f), 0)
  const projectedHours   = accumulatedHours + proposedHours

  let fatigueRisk = 'none'
  if (projectedHours >= 8) fatigueRisk = 'critical'
  else if (projectedHours >= 7) fatigueRisk = 'warning'
  else if (accumulatedHours >= 5) fatigueRisk = 'caution'  // already flying today, watch the hours

  return {
    accumulatedHours: Math.round(accumulatedHours * 10) / 10,
    projectedHours:   Math.round(projectedHours  * 10) / 10,
    flightCount:      todayFlights.length,
    fatigueRisk,
  }
}

/**
 * Check for scheduling conflicts for a pilot on a proposed flight.
 *
 * A conflict exists when:
 *   (a) LOCATION: the pilot has a flight arriving at airport X, and the new
 *       flight departs from airport Y ≠ X, and there's insufficient travel time.
 *   (b) TIME OVERLAP: the pilot's existing flight is still enroute when the new
 *       flight departs (within 30 min).
 *
 * @param {string}  pilotId         - personnel ID
 * @param {string}  deptAirport     - proposed departure ICAO
 * @param {Date|string} depUtc      - proposed departure time
 * @param {Date|string} etaUtc      - estimated arrival time of proposed flight
 * @returns {Array<{ type, message, flight }>}
 */
export function checkSchedulingConflicts(pilotId, deptAirport, depUtc, etaUtc) {
  if (!pilotId || !deptAirport || !depUtc) return []

  const proposedDep = new Date(depUtc)
  const proposedEta = etaUtc ? new Date(etaUtc) : null
  const conflicts   = []

  // Check flights the same day AND the day before (for late-night/early-morning)
  const flightsToCheck = [
    ...getPilotFlightsOnDay(pilotId, proposedDep),
    ...getPilotFlightsOnDay(pilotId, new Date(proposedDep.getTime() - 86_400_000)),
  ]

  for (const f of flightsToCheck) {
    const fDep = new Date(f.plannedDepartureUtc)
    const cruiseKts = CRUISE_SPEEDS_KTS[f.aircraftType] ?? 150
    const est = estimateFlightDuration(f.departure, f.arrival, cruiseKts, 15)
    const fEta = estimateEta(fDep, est?.totalHours ?? 1.5)

    // (b) Time overlap — existing flight is enroute during proposed departure (±30 min)
    if (fEta && proposedDep >= fDep && proposedDep <= new Date(fEta.getTime() + 30 * 60_000)) {
      conflicts.push({
        type: 'time_overlap',
        message: `Already flying ${f.departure}→${f.arrival} — not yet landed`,
        flight: f,
      })
      continue
    }

    // (a) Location mismatch — arrives at different airport, then needs to depart from deptAirport
    // within a window where transit would be impossible
    const GapH = 2  // minimum gap in hours (generous — flight-ferry or repositioning possible)
    if (fEta && f.arrival !== deptAirport) {
      const gapMs = proposedDep.getTime() - fEta.getTime()
      const gapH  = gapMs / 3_600_000
      // Flag if the gap is < GapH and the flight arrives at a different airport
      if (gapH >= 0 && gapH < GapH) {
        conflicts.push({
          type: 'location_mismatch',
          message: `Arriving ${f.arrival} at ~${fEta.toUTCString().slice(17, 22)}Z — ${deptAirport} departs ${Math.round(gapH * 60)}m later`,
          flight: f,
        })
      }
    }

    // Also check if this flight's departure conflicts with proposed ETA (reverse direction)
    if (proposedEta && fDep >= proposedEta && f.departure !== (/* proposed arr */ deptAirport)) {
      const gapMs = fDep.getTime() - proposedEta.getTime()
      const gapH  = gapMs / 3_600_000
      if (gapH < 2 && f.departure !== deptAirport) {
        // only flag if at a different airport
        conflicts.push({
          type: 'location_mismatch',
          message: `Next flight departs ${f.departure} — only ${Math.round(gapH * 60)}m after this ETA`,
          flight: f,
        })
      }
    }
  }

  // Deduplicate by flight id
  const seen = new Set()
  return conflicts.filter((c) => {
    if (seen.has(c.flight.id)) return false
    seen.add(c.flight.id)
    return true
  })
}
