// Glider Ops — tow scheduling, capacity, and wait time calculations
// Settings live here for now; will migrate to the Settings page.

export const TOW_SETTINGS = {
  towsPerHour:        3,      // max tows a single tow plane can complete per hour
  hookupTimeMin:      10,     // ground handling: hookup, signals, taxi, release prep (min)
  minutesPer1000ft:   5,      // climb time per 1000 ft AGL on tow (min — ISA at field elev)
  timeAloftPer1000ft: 15,     // glider time aloft per 1000 ft before ready to re-tow (min)
  daMinPer1000ft:     1.5,    // extra climb minutes per 1000 ft of DA above field elevation
  fieldElevFt:        5288,   // KBDU field elevation
  towBaseFee:         15,     // $ flat fee per tow (hookup + launch)
  towPer1000ftFee:    16,     // $ per 1,000 ft of release altitude
  refuelTimeMin:      10,     // minutes offline for refuelling
  fuelWeightLbsPerGal: 6,    // avgas weight
  pilotChangeMin:     10,    // minutes offline for pilot changeover (briefing, walkaround, seat adjust)
}

// Per-aircraft tow profile
export const TOW_PLANE_PROFILE = {
  'ja-006': {  // N4337Y  Piper PA-25 Pawnee
    climbFtMin:      450,     // ft/min on tow at ISA, field elev
    fuelCapGal:      36,      // usable fuel capacity (gallons)
    fuelBurnGalHr:   12,      // gallons per hour (engine running: tow, taxi, idle)
    pilotWeightLbs:  180,     // typical tow pilot weight
    emptyWeightLbs:  1230,
    maxGrossLbs:     2000,
    // endurance: 36/12 = 3.0 hrs → refuel after ~3 hrs of ops
  },
  'ja-007': {  // N4384A  Piper PA-18 Super Cub
    climbFtMin:      300,
    fuelCapGal:      18,
    fuelBurnGalHr:   9,
    pilotWeightLbs:  180,
    emptyWeightLbs:  930,
    maxGrossLbs:     1750,
    // endurance: 18/9 = 2.0 hrs → refuel after ~2 hrs of ops
  },
  'ja-011': {  // N6719Z  Piper PA-25 Pawnee (Journeys)
    climbFtMin:      450,
    fuelCapGal:      36,
    fuelBurnGalHr:   12,
    pilotWeightLbs:  180,
    emptyWeightLbs:  1230,
    maxGrossLbs:     2000,
  },
  'ssb-001': {  // N4593Y  Piper PA-25-235 Pawnee (SSB)
    climbFtMin:      450,
    fuelCapGal:      36,
    fuelBurnGalHr:   12,
    pilotWeightLbs:  180,
    emptyWeightLbs:  1230,
    maxGrossLbs:     2000,
  },
  'ssb-002': {  // N4785F  Piper PA-18-150 Super Cub (SSB)
    climbFtMin:      300,
    fuelCapGal:      18,
    fuelBurnGalHr:   9,
    pilotWeightLbs:  180,
    emptyWeightLbs:  930,
    maxGrossLbs:     1750,
  },
}
// Legacy compat
export const TOW_PLANE_CLIMB = Object.fromEntries(
  Object.entries(TOW_PLANE_PROFILE).map(([id, p]) => [id, p.climbFtMin])
)
const DEFAULT_CLIMB_FTMIN = 350

export const TOW_HEIGHTS = [1000, 2000, 3000, 4000, 5000]  // feet

// ── Glider tow drag penalty ──────────────────────────────────────────────────
//
// Heavier gliders with higher drag need more tow energy (= more climb-feet).
// We express this as % extra demand on top of the raw release altitude.
//
// Factor = weight_penalty × drag_penalty
// weight_penalty = (allUpWeight / baselineWeight) − 1  (heavier = more penalty)
// drag_penalty   = glider drag coefficient (1.0 = clean modern, 1.3 = old/draggy)
//
// Baseline: 170 lb solo pilot in a clean glider at 800 lbs AUW → 0% penalty.

const GLIDER_DRAG_COEFF = {
  'ja-002': 1.10,   // SGS 1-34 — single-seat metal glider, moderate drag
  'ja-004': 1.25,   // SGS 2-32 — large 2-seat metal glider, high drag on tow
  'ac-010': 1.10,   // N48GD — glider (unknown type), assume moderate drag
}
const DEFAULT_DRAG_COEFF = 1.1

const BASELINE_AUW_LBS = 800    // reference glider all-up weight for 0% penalty
const PILOT_WEIGHT_LBS = 170    // standard solo pilot
const DUAL_EXTRA_LBS   = 170    // second seat (instructor or passenger)

/**
 * Compute the tow demand penalty % for a specific flight.
 * Returns a multiplier ≥ 1.0 (e.g. 1.18 = 18% more demand).
 *
 * @param {object} opts
 * @param {string} [opts.gliderAcId]    Glider aircraft ID (for empty weight + drag coeff)
 * @param {number} [opts.emptyWeightLbs] Override empty weight
 * @param {boolean} [opts.isDual]       Dual instruction / passenger aboard
 * @param {number} [opts.pilotWeightLbs] Actual pilot weight (default 170)
 * @param {number} [opts.paxWeightLbs]  Actual passenger weight
 * @param {object[]} [opts.aircraftList] Full aircraft list for weight lookup
 * @returns {number}                    Demand multiplier (≥ 1.0)
 */
export function gliderTowDemandFactor({
  gliderAcId, emptyWeightLbs, isDual = false,
  pilotWeightLbs = PILOT_WEIGHT_LBS, paxWeightLbs,
  aircraftList,
} = {}) {
  // Resolve empty weight
  let empty = emptyWeightLbs
  if (!empty && gliderAcId && aircraftList) {
    const ac = aircraftList.find((a) => a.id === gliderAcId)
    empty = ac?.emptyWeightLbs ?? 600
  }
  empty = empty ?? 600

  // All-up weight
  const pax = isDual ? (paxWeightLbs ?? DUAL_EXTRA_LBS) : 0
  const auw = empty + pilotWeightLbs + pax

  // Weight penalty: % above baseline
  const weightPenalty = Math.max(0, (auw - BASELINE_AUW_LBS) / BASELINE_AUW_LBS)

  // Drag coefficient
  const dragCoeff = (gliderAcId && GLIDER_DRAG_COEFF[gliderAcId]) || DEFAULT_DRAG_COEFF

  // Combined: each factor contributes independently
  // e.g. 20% heavier × 1.25 drag = 1.20 × 1.25 = 1.50 → 50% more demand
  return (1 + weightPenalty) * dragCoeff
}

// ── Density altitude ─────────────────────────────────────────────────────────

/**
 * Compute density altitude from temperature and altimeter setting.
 * DA = pressure_altitude + (120 × (OAT − ISA_temp))
 * ISA temp at altitude ≈ 15 − 2 × (pressure_alt / 1000)
 *
 * @param {number} tempC         Outside air temperature (°C)
 * @param {number} altimInHg     Altimeter setting (inches Hg)
 * @param {number} fieldElevFt   Field elevation (ft MSL)
 * @returns {number}             Density altitude (ft)
 */
export function densityAltitude(tempC, altimInHg, fieldElevFt = TOW_SETTINGS.fieldElevFt) {
  const pressureAlt = fieldElevFt + (29.92 - altimInHg) * 1000
  const isaTemp = 15 - 2 * (pressureAlt / 1000)
  return Math.round(pressureAlt + 120 * (tempC - isaTemp))
}

/**
 * DA-adjusted climb rate for a tow plane (ft/min).
 * Accounts for density altitude (−3%/1000ft DA) and fuel weight.
 * Lighter fuel load → better power-to-weight → faster climb.
 *
 * @param {string} planeId        Aircraft ID
 * @param {number} [daFt]         Density altitude (ft). null → ISA at field elev.
 * @param {number} [fuelGal]      Current fuel load (gallons). null → full tanks.
 * @returns {number}              Climb rate in ft/min on tow
 */
export function towClimbRate(planeId, daFt = null, fuelGal = null) {
  const prof = TOW_PLANE_PROFILE[planeId]
  const isaRate = prof?.climbFtMin ?? DEFAULT_CLIMB_FTMIN

  // DA adjustment: −3% per 1000 ft above field
  let rate = isaRate
  if (daFt != null && daFt > TOW_SETTINGS.fieldElevFt) {
    const daAbove = daFt - TOW_SETTINGS.fieldElevFt
    rate *= Math.max(1 - 0.03 * (daAbove / 1000), 0.4)
  }

  // Fuel weight adjustment: lighter = faster
  // Compare current weight to full-fuel weight; each 100 lbs lighter ≈ +2% climb
  if (prof && fuelGal != null) {
    const fullFuelLbs = prof.fuelCapGal * TOW_SETTINGS.fuelWeightLbsPerGal
    const curFuelLbs  = fuelGal * TOW_SETTINGS.fuelWeightLbsPerGal
    const savedLbs    = fullFuelLbs - curFuelLbs
    if (savedLbs > 0) {
      rate *= 1 + 0.02 * (savedLbs / 100)
    }
  }

  return Math.round(rate)
}

/**
 * Climb feet delivered per segment by a tow plane.
 * = (segment minutes − hookup time) × climb rate
 *
 * @param {string} planeId
 * @param {number} [daFt]
 * @param {object} [s]          TOW_SETTINGS
 * @param {number} [fuelGal]    Current fuel (gallons). null → full tanks.
 * @returns {number}            Deliverable climb-feet in one 20-min segment
 */
export function planeSegmentFt(planeId, daFt = null, s = TOW_SETTINGS, fuelGal = null) {
  const climbMin = SEGMENT_MINUTES - s.hookupTimeMin
  if (climbMin <= 0) return 0
  return Math.round(towClimbRate(planeId, daFt, fuelGal) * climbMin)
}

/**
 * Simulate fuel state for a tow plane across the day's segments.
 * Burns fuel by hours on duty (engine running for taxi, climb, return, idle).
 * Refuels when remaining fuel drops below reserve or when endurance is reached.
 *
 * @param {string}  planeId
 * @param {object[]} towEvents    Scheduled tow events (from buildTowSchedule)
 * @param {number}  segCount      Number of segments
 * @param {number}  baseMs        Day start (epoch ms)
 * @param {object}  [s]           TOW_SETTINGS
 * @returns {Array<{fuelGal: number, fuelPct: number, refuelling: boolean}>}
 */
export function simulateFuelState(planeId, towEvents, segCount, baseMs, s = TOW_SETTINGS) {
  const prof = TOW_PLANE_PROFILE[planeId]
  if (!prof) return Array.from({ length: segCount }, () => ({ fuelGal: null, fuelPct: 100, refuelling: false }))

  const burnPerSegGal = prof.fuelBurnGalHr * (SEGMENT_MINUTES / 60)  // gal consumed per on-duty segment
  const reservePct    = 0.20  // refuel at 20% remaining
  const reserveGal    = prof.fuelCapGal * reservePct
  const refuelSegs    = Math.ceil(s.refuelTimeMin / SEGMENT_MINUTES)

  let fuel = prof.fuelCapGal
  let refuelCountdown = 0

  // Determine which segments the plane is on duty (has tow events assigned)
  // Only burn fuel when actually towing — no tows = no burn
  const onDutySegs = new Set()
  for (const ev of towEvents) {
    if (ev.assignedPlaneId !== planeId) continue
    const segIdx = Math.floor((ev.actualStartMs - baseMs) / (SEGMENT_MINUTES * 60_000))
    // Engine running: this segment + 1 before (startup/taxi) + 1 after (return/taxi)
    for (let j = Math.max(0, segIdx - 1); j <= Math.min(segCount - 1, segIdx + 1); j++) {
      onDutySegs.add(j)
    }
  }
  // No tow events for this plane → full fuel all day, no refuelling
  if (onDutySegs.size === 0) {
    return Array.from({ length: segCount }, () => ({ fuelGal: prof.fuelCapGal, fuelPct: 100, refuelling: false }))
  }

  const states = []
  for (let i = 0; i < segCount; i++) {
    if (refuelCountdown > 0) {
      states.push({ fuelGal: fuel, fuelPct: Math.round((fuel / prof.fuelCapGal) * 100), refuelling: true })
      refuelCountdown--
      if (refuelCountdown === 0) fuel = prof.fuelCapGal
      continue
    }

    // Burn fuel if on duty this segment
    if (onDutySegs.has(i)) {
      fuel -= burnPerSegGal
      fuel = Math.max(fuel, 0)
    }

    const pct = Math.round((fuel / prof.fuelCapGal) * 100)
    states.push({ fuelGal: fuel, fuelPct: pct, refuelling: false })

    // Trigger refuel when at or below reserve
    if (fuel <= reserveGal && onDutySegs.has(i)) {
      refuelCountdown = refuelSegs
    }
  }
  return states
}

/**
 * Tow price: flat base fee + per-1000-ft fee.
 */
export function towPrice(heightFt, s = TOW_SETTINGS) {
  return s.towBaseFee + Math.ceil(heightFt / 1000) * s.towPer1000ftFee
}

/**
 * Compute the DA-adjusted tow cycle time for a specific aircraft.
 * cycle = hookup + (heightFt / climbRate)
 */
export function towCycleMinDA(heightFt, s = TOW_SETTINGS, daFt = null, planeId = null) {
  const rate = towClimbRate(planeId, daFt)
  const climbMin = heightFt / rate
  return Math.round(s.hookupTimeMin + climbMin)
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Minutes of tow-plane time consumed by one tow (hookup + climb). */
export function towCycleMin(heightFt, s = TOW_SETTINGS) {
  return s.hookupTimeMin + Math.ceil(heightFt / 1000) * s.minutesPer1000ft
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
 * @param {MaintenanceWindow[]} [mxWindows]  Scheduled maintenance windows.
 *                                           When a plane is in maintenance at a candidate start time,
 *                                           it is skipped for that event.
 * @returns {Array<{flight, heightFt, towIndex, requestedMs, actualStartMs, actualEndMs, assignedPlaneId}>}
 */
export function buildTowSchedule(flights, airport, s = TOW_SETTINGS, towPlanes, mxWindows = []) {
  const towFlights = flights
    .filter((f) => isTowFlight(f, airport))
    .sort((a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc))

  // Flatten into individual tow events per height requested
  const events = []
  for (const f of towFlights) {
    const heights      = f.towInfo?.towHeights ?? [2000]
    const requestedMs  = new Date(f.plannedDepartureUtc ?? f.planned_departure_utc).getTime()
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

      // Find the plane that can start earliest (skip planes in maintenance)
      let bestPlaneId = null, bestStart = Infinity
      for (const p of towPlanes) {
        const canStart = Math.max(planeFreeAt[p.id], gliderReadyAt)
        if (isInMaintenance(p.id, canStart, mxWindows)) continue
        if (canStart < bestStart) { bestStart = canStart; bestPlaneId = p.id }
      }
      // Fallback: if all planes are in maintenance, pick the first that exits soonest
      if (!bestPlaneId) {
        for (const p of towPlanes) {
          const canStart = Math.max(planeFreeAt[p.id], gliderReadyAt)
          if (canStart < bestStart) { bestStart = canStart; bestPlaneId = p.id }
        }
        if (!bestPlaneId) bestPlaneId = towPlanes[0].id
      }

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
    const requestedMs = new Date(f.plannedDepartureUtc ?? f.planned_departure_utc).getTime()
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
    const fStart = new Date(f.plannedDepartureUtc ?? f.planned_departure_utc).getTime()
    if (fStart < windowStartMs || fStart >= windowEndMs) continue
    const heights = f.towInfo?.towHeights ?? [2000]
    demandMin += heights.reduce((sum, h) => sum + towCycleMin(h, s), 0)
  }

  // Supply: tow duty block minutes overlapping the window (multiple planes stack)
  let supplyMin = 0
  for (const f of flights) {
    if (f.missionType !== 'tow_session' && f.part91Type !== 'tow_session') continue
    if ((f.airport ?? f.departure) !== airport) continue
    const dbStart = new Date(f.plannedDepartureUtc ?? f.planned_departure_utc).getTime()
    const arrUtc  = f.plannedArrivalUtc ?? f.planned_arrival_utc
    const dbEnd   = arrUtc ? new Date(arrUtc).getTime() : dbStart
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

// ── Maintenance windows ──────────────────────────────────────────────────────
//
// A maintenance window marks a tow aircraft as unavailable for a time range.
// This is separate from squawks (which ground indefinitely until resolved).
// Use these to model scheduled inspections, oil changes, annual downtime, etc.

/**
 * @typedef {Object} MaintenanceWindow
 * @property {string} aircraftId  — tow aircraft id (e.g. 'ja-006')
 * @property {number} startMs     — epoch ms
 * @property {number} endMs       — epoch ms
 * @property {string} [reason]    — human label ('Annual inspection', '100-hr', etc.)
 */

/**
 * Return true if aircraftId is in a maintenance window at the given time.
 */
export function isInMaintenance(aircraftId, timeMs, maintenanceWindows = []) {
  return maintenanceWindows.some(
    (w) => w.aircraftId === aircraftId && timeMs >= w.startMs && timeMs < w.endMs
  )
}

/**
 * Filter a list of tow planes to only those available (not grounded, not in maintenance)
 * at a specific moment.
 *
 * @param {object[]} towPlanes           All tow aircraft objects
 * @param {number}   timeMs              Epoch ms to check
 * @param {object[]} aircraftList        Full aircraft list (for airworthy flag)
 * @param {object[]} squawks             Active squawks
 * @param {MaintenanceWindow[]} mxWindows Scheduled maintenance windows
 * @param {Function} isGroundedFn        Grounding check (default: imported isAircraftGrounded)
 */
export function availableTowPlanesAt(towPlanes, timeMs, aircraftList, squawks, mxWindows = [], isGroundedFn) {
  return towPlanes.filter((p) => {
    if (isGroundedFn && isGroundedFn(p.id, aircraftList, squawks)) return false
    if (isInMaintenance(p.id, timeMs, mxWindows)) return false
    return true
  })
}

/**
 * Convert closed grounding squawks into implicit maintenance windows.
 * A grounded-then-resolved aircraft was unavailable from report time until resolution.
 * This lets the violin chart show the plane as historically unavailable even after
 * the squawk is closed.
 *
 * @param {object[]} squawks        All squawks (open + closed)
 * @param {object[]} aircraftList   Full aircraft list (to map tailNumber → id)
 * @returns {MaintenanceWindow[]}
 */
export function squawksToMaintenanceWindows(squawks, aircraftList) {
  const windows = []
  for (const s of squawks) {
    if (s.severity !== 'grounding') continue
    if (s.status !== 'closed') continue  // open squawks are handled by isAircraftGrounded

    // Map tailNumber to aircraftId
    const ac = aircraftList.find((a) =>
      a.id === s.aircraftId || a.tailNumber === (s.tailNumber ?? s.tail_number)
    )
    if (!ac) continue

    // Start: reportedAt (ISO timestamp) or reportedDate (date string) → start of that day
    const startStr = s.reportedAt ?? s.reportedDate
    if (!startStr) continue
    const startMs = new Date(startStr).getTime()
    if (isNaN(startMs)) continue

    // End: best available resolution timestamp
    const endStr = s.resolvedDate ?? s.resolvedAt ?? s.closedAt
    let endMs
    if (endStr && endStr.includes('T')) {
      // Full ISO timestamp — use directly
      endMs = new Date(endStr).getTime()
    } else if (endStr) {
      // Date-only string — need to estimate the actual resolution time
      const today = new Date().toISOString().split('T')[0]
      if (endStr === today) {
        // Resolved today but no time — assume start of today (conservative: plane available all day)
        // Better to undercount grounding than overcount it
        endMs = new Date(endStr + 'T07:00:00').getTime()
      } else {
        endMs = new Date(endStr + 'T23:59:59').getTime()
      }
    } else {
      // No resolution timestamp at all
      const reportDate = (s.reportedDate ?? '').split('T')[0]
      const today = new Date().toISOString().split('T')[0]
      if (reportDate && reportDate < today) {
        endMs = new Date(reportDate + 'T23:59:59').getTime()
      } else {
        endMs = new Date(today + 'T07:00:00').getTime()
      }
    }

    if (endMs <= startMs) continue

    windows.push({
      aircraftId: ac.id,
      startMs,
      endMs,
      reason: `Squawk: ${s.description?.slice(0, 30) ?? 'grounding'}`,
    })
  }
  return windows
}

// ── 20-minute (⅓ hour) segment builder ───────────────────────────────────────
//
// Tow operations run in ~20-minute cycles (ground + tow + return).
// Segments are the natural resolution for capacity planning.

export const SEGMENT_MINUTES = 20
const SEGMENT_MS = SEGMENT_MINUTES * 60_000

// ── Seeded gaussian jitter for tow demand placement ──────────────────────────
// Deterministic per-event so the chart doesn't jitter on re-render.
// Uses a simple hash → Box-Muller transform, σ = 10 minutes.

function hashSeed(flightId, towIndex) {
  let h = 0x9e3779b9
  const s = `${flightId}:${towIndex}`
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x5bd1e995)
    h ^= h >>> 15
  }
  return (h >>> 0) / 0xffffffff          // uniform in [0,1)
}

function gaussianJitterMs(flightId, towIndex, sigmaMin = 10) {
  const u1 = hashSeed(flightId, towIndex) || 0.0001
  const u2 = hashSeed(flightId + '_', towIndex)
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.round(z * sigmaMin * 60_000)  // ms
}

/**
 * Build demand/supply segments at 20-minute resolution with per-plane availability
 * that respects grounding and maintenance windows.
 *
 * @param {object}   opts
 * @param {object[]} opts.flights
 * @param {string}   opts.airport
 * @param {object[]} opts.towPlanes        All tow aircraft (including grounded)
 * @param {object[]} opts.aircraftList     Full aircraft list
 * @param {object[]} opts.squawks
 * @param {MaintenanceWindow[]} opts.mxWindows
 * @param {Function} opts.isGroundedFn
 * @param {object}   [opts.schedCtx]       Pilot schedule context for pilot-constrained supply.
 *   When provided, supply is min(available_planes, matched_pilots).
 *   Shape: { towPilots, effectiveBlocksFn, matchingFn }
 *   - towPilots: array of pilot objects with towCheckouts, towBaseSchedule
 *   - effectiveBlocksFn(pilot, date): returns Set<'am'|'pm'> of scheduled blocks
 *   - matchingFn(availPilots, availPlanes): returns { matched: number, assignments: {planeId: pilotId} }
 * @param {object}   [opts.settings]
 * @param {number}   [opts.startHour=7]
 * @param {number}   [opts.numHours=13]
 * @param {Date}     [opts.date]           Override "today" — build segments for a specific date
 * @returns {Array<{startMs, endMs, label, reservedMin, standbyMin, demandByType, byPlane, availablePlaneIds, pilotCount, matchedPilotNames}>}
 */
export function buildSegments({
  flights, airport, towPlanes, aircraftList, squawks,
  mxWindows = [], isGroundedFn, schedCtx = null, settings = TOW_SETTINGS,
  startHour = 7, numHours = 13, date = null, daFt = null,
}) {
  const refDate = date ?? new Date()
  const baseMs  = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), startHour, 0, 0, 0).getTime()
  const totalSegments = Math.ceil((numHours * 60) / SEGMENT_MINUTES)

  const towFlights = flights.filter((f) => isTowFlight(f, airport))
  const dutyBlocks = flights.filter(
    (f) => f.missionType === 'tow_session' || f.part91Type === 'tow_session'
  )

  // Build individual tow events using the tow schedule so multi-tow reservations
  // spread demand across their actual tow times (+ gaussian jitter to avoid
  // artificial alignment on 20-minute boundaries).
  const airworthyPlanes = towPlanes.filter((p) => {
    if (isGroundedFn && isGroundedFn(p.id, aircraftList, squawks)) return false
    return true
  })
  const towEvents = buildTowSchedule(flights, airport, settings, airworthyPlanes.length ? airworthyPlanes : undefined, mxWindows)

  // Simulate fuel state for each tow plane across the day
  const fuelStates = {}
  for (const p of towPlanes) {
    fuelStates[p.id] = simulateFuelState(p.id, towEvents, totalSegments, baseMs, settings)
  }

  // Track pilot→plane assignments from previous segment to detect changeovers
  const prevPilotForPlane = {}  // planeId → pilotId from last segment
  const changeoverCountdown = {} // planeId → segments remaining offline

  return Array.from({ length: totalSegments }, (_, i) => {
    const startMs = baseMs + i * SEGMENT_MS
    const endMs   = startMs + SEGMENT_MS
    const midMs   = startMs + SEGMENT_MS / 2
    const h       = new Date(startMs).getHours()
    const m       = new Date(startMs).getMinutes()
    const label   = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Demand in climb-feet (how many feet of tow the reservations consume)
    let reservedFt = 0
    let standbyFt  = 0
    const demandByType = { pattern: 0, scenic: 0, mountain: 0 }
    const byPlane   = {}

    // Demand: place each individual tow event in its actual scheduled segment,
    // jittered by ±10 min (gaussian) to avoid artificial alignment.
    const demandFlights = []
    const seenFlightIds = new Set()
    for (const ev of towEvents) {
      const jitter   = gaussianJitterMs(ev.flight.id, ev.towIndex)
      const eventMs  = ev.actualStartMs + jitter
      if (eventMs < startMs || eventMs >= endMs) continue
      // Demand = release altitude × glider drag factor
      // Heavier / draggier gliders consume more tow-plane climb capacity
      const f = ev.flight
      const gliderAcId = (!f.ownAircraft && f.tailNumber !== 'OWN') ? aircraftList.find((a) => a.tailNumber === (f.tailNumber ?? f.tail_number))?.id : null
      const factor = gliderTowDemandFactor({
        gliderAcId,
        isDual: !!f.sic,
        aircraftList,
      })
      const ft = Math.round(ev.heightFt * factor)
      if (f.towInfo?.isStandby) standbyFt  += ft
      else                       reservedFt += ft
      // Classify by raw tow height (type), but use adjusted ft for magnitude
      if (ev.heightFt <= 1000)      demandByType.pattern  += ft
      else if (ev.heightFt >= 3000) demandByType.mountain += ft
      else                          demandByType.scenic   += ft
      if (!seenFlightIds.has(ev.flight.id)) {
        seenFlightIds.add(ev.flight.id)
        demandFlights.push(ev.flight)
      }
    }

    // Available planes at segment midpoint (accounts for grounding + maintenance)
    const availablePlaneIds = towPlanes
      .filter((p) => {
        if (isGroundedFn && isGroundedFn(p.id, aircraftList, squawks)) return false
        if (isInMaintenance(p.id, midMs, mxWindows)) return false
        return true
      })
      .map((p) => p.id)

    // ── Pilot-constrained supply ──────────────────────────────────────────────
    // Determine how many pilots are available for this segment via bipartite matching.
    // The effective supply is min(planes, pilots) — can't fly without a pilot.
    let pilotCount = null          // null = no schedule context (unconstrained)
    let matchedPilotNames = []     // names of matched pilots for display
    let pilotAssignments = []      // [{pilotName, planeId}] for individual labels
    let pilotMatchedPlaneIds = null // which planes have pilots matched

    if (schedCtx && schedCtx.towPilots && schedCtx.effectiveBlocksFn && schedCtx.matchingFn) {
      const segDate = new Date(midMs)
      const segHour = segDate.getHours() + segDate.getMinutes() / 60
      // AM: 8:00-12:30, PM: 12:30-17:00
      const block = segHour >= 8 && segHour < 12.5 ? 'am' : segHour >= 12.5 && segHour < 17 ? 'pm' : null

      if (block) {
        const availPilots = schedCtx.towPilots.filter((p) =>
          schedCtx.effectiveBlocksFn(p, segDate).has(block)
        )
        const availPlaneObjs = towPlanes.filter((p) => availablePlaneIds.includes(p.id))
        const { matched, assignments } = schedCtx.matchingFn(availPilots, availPlaneObjs)
        pilotCount = matched
        matchedPilotNames = availPilots
          .filter((p) => Object.values(assignments).includes(p.id))
          .map((p) => p.name)
        pilotMatchedPlaneIds = Object.keys(assignments)
        // Build individual pilot→plane assignments for labelling
        // Detect pilot changeovers — different pilot on same plane triggers a gap
        for (const [planeId, pilotId] of Object.entries(assignments)) {
          const pilot = availPilots.find((p) => p.id === pilotId)
          if (pilot) pilotAssignments.push({ pilotName: pilot.name, planeId })
          // Check if pilot changed on this plane
          if (prevPilotForPlane[planeId] && prevPilotForPlane[planeId] !== pilotId) {
            const changeSegs = Math.ceil(settings.pilotChangeMin / SEGMENT_MINUTES)
            changeoverCountdown[planeId] = changeSegs
          }
          prevPilotForPlane[planeId] = pilotId
        }
      } else {
        pilotCount = 0
        matchedPilotNames = []
        pilotMatchedPlaneIds = []
      }
    }

    // Decrement changeover countdowns and track which planes are in changeover
    const planesInChangeover = new Set()
    for (const pid of Object.keys(changeoverCountdown)) {
      if (changeoverCountdown[pid] > 0) {
        planesInChangeover.add(pid)
        changeoverCountdown[pid]--
      }
    }

    // Supply in climb-feet per plane, accounting for fuel state, DA, and changeover.
    // Refuelling or changeover planes deliver 0 for that segment.
    for (const db of dutyBlocks) {
      const dbStart    = new Date(db.plannedDepartureUtc).getTime()
      const arrUtc     = db.plannedArrivalUtc ?? db.planned_arrival_utc
      const dbEnd      = arrUtc ? new Date(arrUtc).getTime() : dbStart
      const overlapMin = Math.max(0, (Math.min(dbEnd, endMs) - Math.max(dbStart, startMs)) / 60_000)
      if (overlapMin <= 0) continue
      const pid = db.towInfo?.towPlaneId ?? db.tailNumber ?? '_pool'
      if (availablePlaneIds.includes(pid) || !towPlanes.some((p) => p.id === pid)) {
        if (pilotMatchedPlaneIds && !pilotMatchedPlaneIds.includes(pid)) continue
        const fs = fuelStates[pid]?.[i]
        if (fs?.refuelling) continue  // offline for refuelling
        if (planesInChangeover.has(pid)) continue  // pilot changeover
        const frac = overlapMin / SEGMENT_MINUTES
        byPlane[pid] = (byPlane[pid] ?? 0) + Math.round(planeSegmentFt(pid, daFt, settings, fs?.fuelGal) * frac)
      }
    }

    // Fallback: if no duty blocks, each available (and pilot-matched) plane contributes full segment
    if (Object.keys(byPlane).length === 0) {
      const planesWithSupply = pilotMatchedPlaneIds ?? availablePlaneIds
      for (const pid of planesWithSupply) {
        if (availablePlaneIds.includes(pid)) {
          const fs = fuelStates[pid]?.[i]
          if (fs?.refuelling) continue  // offline for refuelling
          if (planesInChangeover.has(pid)) continue  // pilot changeover
          byPlane[pid] = planeSegmentFt(pid, daFt, settings, fs?.fuelGal)
        }
      }
    }

    // Collect standby flights in this segment for interactive confirm
    const standbyFlights = towFlights.filter((f) => {
      if (!f.towInfo?.isStandby) return false
      const depMs = new Date(f.plannedDepartureUtc ?? f.planned_departure_utc).getTime()
      return !isNaN(depMs) && depMs >= startMs && depMs < endMs
    })

    // Per-plane fuel state for this segment
    const planeFuel = {}
    for (const pid of availablePlaneIds) {
      const fs = fuelStates[pid]?.[i]
      if (fs) planeFuel[pid] = fs
    }

    return { startMs, endMs, label, reservedFt, standbyFt, demandByType, demandFlights, byPlane, planeFuel, planesInChangeover: [...planesInChangeover], availablePlaneIds, pilotCount, matchedPilotNames, pilotAssignments, standbyFlights }
  })
}

// ── Gaussian kernel smoothing ────────────────────────────────────────────────
//
// Schedules represent probabilities — people arrive early/late, prep takes time.
// A ~10-minute sigma gaussian produces the gentle violin curves.

/**
 * Smooth a series of numeric values with a gaussian kernel.
 * Area-preserving: the smoothed curve crosses a step at 50% of the step height,
 * and the total integral (sum of values) is preserved.
 *
 * Uses a normalized gaussian kernel (weights sum to 1 over the full radius).
 * Out-of-bounds samples are treated as zero — this correctly tapers at array edges.
 *
 * @param {number[]} values     Raw values per segment
 * @param {number}   sigmaSeg   Sigma in segment-units (e.g. 0.5 = half a segment = 10 min)
 * @returns {number[]}          Smoothed values (same length, area-preserving)
 */
export function gaussianSmooth(values, sigmaSeg = 0.5) {
  const n = values.length
  if (n === 0) return []

  // Pre-compute kernel weights, normalized so they sum to 1
  const radius = Math.ceil(sigmaSeg * 3)
  const kernel = []
  let kSum = 0
  for (let d = -radius; d <= radius; d++) {
    const w = Math.exp(-0.5 * (d / sigmaSeg) ** 2)
    kernel.push(w)
    kSum += w
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum

  const out = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let k = 0; k < kernel.length; k++) {
      const j = i + (k - radius)
      if (j >= 0 && j < n) {
        sum += values[j] * kernel[k]
      }
      // out-of-bounds → 0 (no contribution, correctly tapers at edges)
    }
    out[i] = sum
  }
  return out
}

/**
 * Build an SVG path string for a smooth violin curve from segment values.
 * Values are mapped to y-offsets from a centre line, producing the violin shape.
 *
 * @param {number[]} smoothed   Smoothed values per segment
 * @param {number}   maxVal     Scale reference (maps to full amplitude)
 * @param {number}   amplitude  Pixel amplitude (half-height of the violin)
 * @param {number}   width      Total pixel width of the chart area
 * @param {boolean}  flip       If true, draw below the centre (supply side)
 * @returns {string}            SVG path `d` attribute
 */
export function violinPath(smoothed, maxVal, amplitude, width, flip = false) {
  if (smoothed.length === 0 || maxVal === 0) return ''
  const n = smoothed.length
  const dx = width / n
  const sign = flip ? 1 : -1

  // Build points: centre-line is y=0; violin extends in `sign` direction
  const pts = smoothed.map((v, i) => ({
    x: i * dx + dx / 2,
    y: sign * (v / maxVal) * amplitude,
  }))

  // Smooth cubic bezier through the points
  if (pts.length < 2) return `M ${pts[0].x} 0 L ${pts[0].x} ${pts[0].y} Z`

  let d = `M ${pts[0].x} 0 L ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2
    d += ` C ${cpx} ${pts[i - 1].y}, ${cpx} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`
  }
  d += ` L ${pts[pts.length - 1].x} 0 Z`
  return d
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
