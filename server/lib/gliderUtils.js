// Glider Ops — tow scheduling, capacity, and wait time calculations
// Ported from client/src/glider/gliderUtils.js for server-side MCP access.
// Pure functions — no browser dependencies.

export const TOW_SETTINGS = {
  towsPerHour:        3,
  groundTimeMin:      10,
  minutesPer1000ft:   5,
  timeAloftPer1000ft: 15,
}

export const TOW_HEIGHTS = [1000, 2000, 3000]

export function towCycleMin(heightFt, s = TOW_SETTINGS) {
  return s.groundTimeMin + Math.ceil(heightFt / 1000) * s.minutesPer1000ft
}

export function timeAloftMin(heightFt, s = TOW_SETTINGS) {
  return Math.ceil(heightFt / 1000) * s.timeAloftPer1000ft
}

export function isTowFlight(f, airport) {
  if (f.mission_type === 'tow_session' || f.part91_type === 'tow_session') return false
  if (!f.tow_info?.towHeights?.length && !f.tow_info?.numTows) {
    if (f.mission_type !== 'glider_tow' && f.part91_type !== 'glider_tow') return false
  }
  return (f.departure ?? f.airport ?? f.tow_info?.airport) === airport
}

export function buildTowSchedule(flights, airport, s = TOW_SETTINGS, towPlanes) {
  const towFlights = flights
    .filter((f) => isTowFlight(f, airport))
    .sort((a, b) => new Date(a.planned_departure_utc) - new Date(b.planned_departure_utc))

  const events = []
  for (const f of towFlights) {
    const heights     = f.tow_info?.towHeights ?? [2000]
    const requestedMs = new Date(f.planned_departure_utc).getTime()
    heights.forEach((h, i) => events.push({ flight: f, heightFt: h, towIndex: i, requestedMs }))
  }
  events.sort((a, b) => a.requestedMs - b.requestedMs || a.towIndex - b.towIndex)

  const reservationReadyAt = {}

  if (towPlanes && towPlanes.length > 0) {
    const planeFreeAt = {}
    for (const p of towPlanes) planeFreeAt[p.id] = 0

    const scheduled = []
    for (const ev of events) {
      const { flight, heightFt, towIndex, requestedMs } = ev
      const gliderReadyAt = reservationReadyAt[flight.id] ?? requestedMs
      const cycleMs       = towCycleMin(heightFt, s) * 60_000
      const aloftMs       = timeAloftMin(heightFt, s) * 60_000

      let bestPlaneId = null, bestStart = Infinity
      for (const p of towPlanes) {
        const canStart = Math.max(planeFreeAt[p.id], gliderReadyAt)
        if (canStart < bestStart) { bestStart = canStart; bestPlaneId = p.id }
      }
      if (!bestPlaneId) bestPlaneId = towPlanes[0].id

      const actualStart = bestStart
      planeFreeAt[bestPlaneId]      = actualStart + cycleMs
      reservationReadyAt[flight.id] = actualStart + aloftMs

      scheduled.push({ ...ev, assignedPlaneId: bestPlaneId, actualStartMs: actualStart, actualEndMs: actualStart + cycleMs })
    }
    return scheduled
  }

  let towFreeAt = 0
  const scheduled = []
  for (const ev of events) {
    const { flight, heightFt, towIndex, requestedMs } = ev
    const gliderReadyAt = reservationReadyAt[flight.id] ?? requestedMs
    const actualStart   = Math.max(towFreeAt, gliderReadyAt)
    const cycleMs       = towCycleMin(heightFt, s) * 60_000
    const aloftMs       = timeAloftMin(heightFt, s) * 60_000

    towFreeAt                     = actualStart + cycleMs
    reservationReadyAt[flight.id] = actualStart + aloftMs

    scheduled.push({ ...ev, actualStartMs: actualStart, actualEndMs: actualStart + cycleMs })
  }
  return scheduled
}

export function towDeficiencyMin(flights, airport, windowStartMs, windowEndMs, s = TOW_SETTINGS) {
  let demandMin = 0
  for (const f of flights) {
    if (!isTowFlight(f, airport)) continue
    const fStart = new Date(f.planned_departure_utc).getTime()
    if (fStart < windowStartMs || fStart >= windowEndMs) continue
    const heights = f.tow_info?.towHeights ?? [2000]
    demandMin += heights.reduce((sum, h) => sum + towCycleMin(h, s), 0)
  }

  let supplyMin = 0
  for (const f of flights) {
    if (f.mission_type !== 'tow_session' && f.part91_type !== 'tow_session') continue
    if ((f.airport ?? f.departure) !== airport) continue
    const dbStart = new Date(f.planned_departure_utc).getTime()
    const dbEnd   = f.planned_arrival_utc ? new Date(f.planned_arrival_utc).getTime() : dbStart
    supplyMin += Math.max(0, (Math.min(dbEnd, windowEndMs) - Math.max(dbStart, windowStartMs)) / 60_000)
  }

  const windowMin = (windowEndMs - windowStartMs) / 60_000
  if (supplyMin === 0) supplyMin = windowMin

  const def = demandMin - supplyMin
  const color =
    def <= -(windowMin / 3) ? 'green'  :
    def <= 0                ? 'yellow' : 'red'

  return {
    deficiencyMin: Math.round(def),
    demandMin:     Math.round(demandMin),
    supplyMin:     Math.round(supplyMin),
    isStandby:     def > 0,
    color,
  }
}

/**
 * Promote standby reservations that can now fit.
 * Returns array of promoted flight IDs.
 */
export function promoteStandbyReservations(flights, airport, s = TOW_SETTINGS) {
  const promoted = []
  const standbys = flights
    .filter((f) => f.tow_info?.isStandby)
    .sort((a, b) => new Date(a.planned_departure_utc) - new Date(b.planned_departure_utc))

  for (const sb of standbys) {
    const working = flights.map((f) =>
      f.id === sb.id ? { ...f, tow_info: { ...f.tow_info, isStandby: false } } : f
    )
    const depMs = new Date(sb.planned_departure_utc).getTime()
    const { isStandby } = towDeficiencyMin(working, airport, depMs, depMs + 30 * 60_000, s)
    if (!isStandby) {
      // Promote — update the flights array in place for subsequent checks
      const idx = flights.findIndex((f) => f.id === sb.id)
      if (idx >= 0) flights[idx] = { ...flights[idx], tow_info: { ...flights[idx].tow_info, isStandby: false } }
      promoted.push(sb.id)
    }
  }
  return promoted
}
