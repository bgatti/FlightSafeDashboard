// Glider Ops — tow scheduling, capacity, and wait time calculations
// Settings live here for now; will migrate to the Settings page.

export const TOW_SETTINGS = {
  towsPerHour:        3,   // max tows a single tow plane can complete per hour
  groundTimeMin:      10,  // tow plane ground turnaround time between tows (min)
  minutesPer1000ft:   5,   // tow flight time per 1000 ft of tow height (min)
  timeAloftPer1000ft: 15,  // glider time aloft per 1000 ft before ready to re-tow (min)
}

export const TOW_HEIGHTS = [1000, 2000, 3000]  // feet

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Minutes of tow-plane time consumed by one tow (ground + flight). */
export function towCycleMin(heightFt, s = TOW_SETTINGS) {
  return s.groundTimeMin + Math.ceil(heightFt / 1000) * s.minutesPer1000ft
}

/** Minutes the glider stays aloft before it's ready for a second tow. */
export function timeAloftMin(heightFt, s = TOW_SETTINGS) {
  return Math.ceil(heightFt / 1000) * s.timeAloftPer1000ft
}

// ── Tow plane timeline builder ────────────────────────────────────────────────
//
// A tow reservation can request N tows at specific heights.
// The tow plane sequences requests in order of requested time.
// For multi-tow reservations the glider must be aloft and back before tow 2.

export function isTowFlight(f, airport) {
  // Any flight that requests tows (has towHeights or numTows) and is not a tow_session itself
  if (f.missionType === 'tow_session' || f.part91Type === 'tow_session') return false
  if (!f.towInfo?.towHeights?.length && !f.towInfo?.numTows) {
    // Legacy check — older records may only have missionType set
    if (f.missionType !== 'glider_tow' && f.part91Type !== 'glider_tow') return false
  }
  return (f.departure ?? f.airport ?? f.towInfo?.airport) === airport
}

/**
 * Build a list of individual tow events, each with an actualStartMs.
 * Accounts for tow-plane queue and per-reservation aloft gaps.
 *
 * @param {object[]} flights   All scheduled flights (including tow reservations)
 * @param {string}   airport  ICAO identifier
 * @param {object}   s        TOW_SETTINGS override
 * @returns {Array<{flight, heightFt, towIndex, requestedMs, actualStartMs, actualEndMs}>}
 */
/**
 * Build a list of individual tow events, each assigned to a specific tow plane.
 *
 * @param {object[]} flights       All scheduled flights
 * @param {string}   airport       ICAO identifier
 * @param {object}   s             TOW_SETTINGS override
 * @param {object[]} [towPlanes]   Available tow aircraft (airworthy, not grounded).
 *                                 When provided, events are assigned to the earliest-available plane.
 *                                 When omitted, falls back to single-queue (legacy).
 * @returns {Array<{flight, heightFt, towIndex, requestedMs, actualStartMs, actualEndMs, assignedPlaneId}>}
 */
export function buildTowSchedule(flights, airport, s = TOW_SETTINGS, towPlanes) {
  const towFlights = flights
    .filter((f) => isTowFlight(f, airport))
    .sort((a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc))

  // Flatten into individual tow events per height requested
  const events = []
  for (const f of towFlights) {
    const heights      = f.towInfo?.towHeights ?? [2000]
    const requestedMs  = new Date(f.plannedDepartureUtc).getTime()
    heights.forEach((h, i) => events.push({ flight: f, heightFt: h, towIndex: i, requestedMs }))
  }
  // Sort: primary = requested time, secondary = tow index within reservation
  events.sort((a, b) => a.requestedMs - b.requestedMs || a.towIndex - b.towIndex)

  const reservationReadyAt = {}       // when each reservation's glider is ready for next tow

  if (towPlanes && towPlanes.length > 0) {
    // Multi-plane assignment: each plane has its own queue
    const planeFreeAt = {}
    for (const p of towPlanes) planeFreeAt[p.id] = 0

    const scheduled = []
    for (const ev of events) {
      const { flight, heightFt, towIndex, requestedMs } = ev
      const gliderReadyAt = reservationReadyAt[flight.id] ?? requestedMs
      const cycleMs       = towCycleMin(heightFt, s) * 60_000
      const aloftMs       = timeAloftMin(heightFt, s) * 60_000

      // Find the plane that can start earliest
      let bestPlaneId = null, bestStart = Infinity
      for (const p of towPlanes) {
        const canStart = Math.max(planeFreeAt[p.id], gliderReadyAt)
        if (canStart < bestStart) { bestStart = canStart; bestPlaneId = p.id }
      }
      if (!bestPlaneId) bestPlaneId = towPlanes[0].id

      const actualStart = bestStart
      planeFreeAt[bestPlaneId]         = actualStart + cycleMs
      reservationReadyAt[flight.id]    = actualStart + aloftMs

      scheduled.push({
        ...ev,
        assignedPlaneId: bestPlaneId,
        actualStartMs:   actualStart,
        actualEndMs:     actualStart + cycleMs,
      })
    }
    return scheduled
  }

  // Legacy single-queue fallback
  let towFreeAt = 0
  const scheduled = []
  for (const ev of events) {
    const { flight, heightFt, towIndex, requestedMs } = ev
    const gliderReadyAt = reservationReadyAt[flight.id] ?? requestedMs
    const actualStart   = Math.max(towFreeAt, gliderReadyAt)
    const cycleMs       = towCycleMin(heightFt, s) * 60_000
    const aloftMs       = timeAloftMin(heightFt, s) * 60_000

    towFreeAt                        = actualStart + cycleMs
    reservationReadyAt[flight.id]    = actualStart + aloftMs

    scheduled.push({
      ...ev,
      actualStartMs: actualStart,
      actualEndMs:   actualStart + cycleMs,
    })
  }
  return scheduled
}

// ── Wait time per reservation ─────────────────────────────────────────────────

/**
 * For each reservation find its first and second actual tow slots and the wait time.
 */
export function computeTowReservations(flights, airport, s = TOW_SETTINGS) {
  const schedule = buildTowSchedule(flights, airport, s)
  const towFlights = flights.filter((f) => isTowFlight(f, airport))

  return towFlights.map((f) => {
    const myEvents = schedule.filter((e) => e.flight.id === f.id)
    const first    = myEvents.find((e) => e.towIndex === 0)
    const second   = myEvents.find((e) => e.towIndex === 1)
    const requestedMs = new Date(f.plannedDepartureUtc).getTime()
    const waitMin  = first
      ? Math.max(0, Math.round((first.actualStartMs - requestedMs) / 60_000))
      : null

    const waitColor =
      waitMin === null  ? 'slate'  :
      waitMin === 0     ? 'blue'   :
      waitMin <= 5      ? 'green'  :
      waitMin <= 10     ? 'yellow' : 'red'

    return {
      ...f,
      firstSlot:   first  ? new Date(first.actualStartMs)  : null,
      secondSlot:  second ? new Date(second.actualStartMs) : null,
      waitMin,
      waitColor,
      isStandby:   f.towInfo?.isStandby ?? false,
    }
  }).sort((a, b) =>
    new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc)
  )
}

// ── 15-minute period grid ─────────────────────────────────────────────────────

/**
 * For each 15-minute period in a day, compute the average wait for tows starting in it.
 * @param {object[]} reservations  Output of computeTowReservations()
 * @param {number}   dayStartMs    Start of the day (ms)
 * @param {number}   periodCount   Number of 15-min periods (default 48 = full day)
 */
export function computePeriodWaits(reservations, dayStartMs, periodCount = 48) {
  const PERIOD_MS = 15 * 60_000
  return Array.from({ length: periodCount }, (_, i) => {
    const start = dayStartMs + i * PERIOD_MS
    const end   = start + PERIOD_MS
    const inPeriod = reservations.filter((r) => {
      if (!r.firstSlot) return false
      const ms = r.firstSlot.getTime()
      return ms >= start && ms < end
    })
    const avgWait = inPeriod.length > 0
      ? Math.round(inPeriod.reduce((s, r) => s + (r.waitMin ?? 0), 0) / inPeriod.length)
      : null
    const color =
      avgWait === null ? null    :
      avgWait === 0    ? 'blue'  :
      avgWait <= 5     ? 'green' :
      avgWait <= 10    ? 'yellow': 'red'
    return { start, end, avgWait, color, count: inPeriod.length }
  })
}

// ── Tow capacity deficiency ───────────────────────────────────────────────────
//
// Single authority for tow saturation. Positive = demand exceeds supply (standby needed).
// Supply comes from scheduled tow duty blocks (tow_session flights). When no duty blocks
// are present the window duration itself is used as a theoretical single-plane fallback.

/**
 * Compute tow-minute deficiency for a time window.
 *
 * @param {object[]} flights        All scheduled flights
 * @param {string}   airport        ICAO identifier
 * @param {number}   windowStartMs  Window start (epoch ms)
 * @param {number}   windowEndMs    Window end (epoch ms)
 * @param {object}   s              TOW_SETTINGS override
 * @returns {{ deficiencyMin, demandMin, supplyMin, isStandby, color }}
 */
export function towDeficiencyMin(flights, airport, windowStartMs, windowEndMs, s = TOW_SETTINGS) {
  // Demand: sum of tow-cycle minutes for each glider-tow flight departing in the window
  let demandMin = 0
  for (const f of flights) {
    if (!isTowFlight(f, airport)) continue
    const fStart = new Date(f.plannedDepartureUtc).getTime()
    if (fStart < windowStartMs || fStart >= windowEndMs) continue
    const heights = f.towInfo?.towHeights ?? [2000]
    demandMin += heights.reduce((sum, h) => sum + towCycleMin(h, s), 0)
  }

  // Supply: tow duty block minutes overlapping the window (multiple planes stack)
  let supplyMin = 0
  for (const f of flights) {
    if (f.missionType !== 'tow_session' && f.part91Type !== 'tow_session') continue
    if ((f.airport ?? f.departure) !== airport) continue
    const dbStart = new Date(f.plannedDepartureUtc).getTime()
    const dbEnd   = f.plannedArrivalUtc ? new Date(f.plannedArrivalUtc).getTime() : dbStart
    supplyMin += Math.max(0, (Math.min(dbEnd, windowEndMs) - Math.max(dbStart, windowStartMs)) / 60_000)
  }

  // Fallback: no duty blocks scheduled → use window duration as theoretical single-plane capacity
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
 * Legacy wrapper — delegates to towDeficiencyMin for backwards compatibility.
 * Used by FlightPlanning.jsx; GliderOps uses towDeficiencyMin directly.
 */
export function getTowAvailability(flights, airport, depMs, towHeights) {
  const WINDOW = 30 * 60_000
  return towDeficiencyMin(flights, airport, depMs, depMs + WINDOW)
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function towColorCss(color) {
  return {
    green:  'text-green-400  bg-green-400/10  border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',
    red:    'text-red-400    bg-red-400/10    border-red-500/30',
    blue:   'text-sky-400    bg-sky-400/10    border-sky-500/30',
    slate:  'text-slate-400  bg-slate-400/10  border-slate-500/30',
  }[color] ?? 'text-slate-400 bg-slate-400/10 border-slate-500/30'
}
