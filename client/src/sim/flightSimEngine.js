/**
 * Part 135 Charter Flight Simulation Engine — KBDU Operations
 *
 * Each outbound charter generates a paired dead-head return flight.
 * When the dead head lands at KBDU it emits a `deadhead_landed` event
 * so the ramp sim can create a real FBO arrival for that aircraft.
 *
 * Loop:  charter departs KBDU
 *           → arrives destination
 *           → dead head scheduled (20 sim-min ground time)
 *           → dead head arrives KBDU
 *           → FBO ramp arrival (fuel, tie-down, etc.)
 *           → aircraft available for next charter
 *
 * 5% of dead-head landings trigger a post-flight maintenance squawk.
 */

import { mockAircraft } from '../mocks/aircraft'
import { mockPersonnel } from '../mocks/personnel'

// ── KBDU Charter Route Terrain Profiles ───────────────────────────────────────

const TERRAIN_KBDU_KASE = [
  { distNm:  0, elevFt: 5288,  label: 'KBDU' },
  { distNm: 15, elevFt: 7500 },
  { distNm: 25, elevFt: 9200,  label: 'Front Range' },
  { distNm: 40, elevFt: 11800 },
  { distNm: 55, elevFt: 13800, label: 'Continental Divide' },
  { distNm: 70, elevFt: 12400 },
  { distNm: 85, elevFt: 10200 },
  { distNm: 95, elevFt: 7820,  label: 'KASE' },
]

const TERRAIN_KBDU_KLXV = [
  { distNm:  0, elevFt: 5288,  label: 'KBDU' },
  { distNm: 15, elevFt: 7200 },
  { distNm: 30, elevFt: 9400,  label: 'Arapahoe Basin' },
  { distNm: 45, elevFt: 10800 },
  { distNm: 55, elevFt: 12600, label: 'Mosquito Range' },
  { distNm: 65, elevFt: 9927,  label: 'KLXV' },
]

const TERRAIN_KBDU_KTEX = [
  { distNm:   0, elevFt: 5288,  label: 'KBDU' },
  { distNm:  30, elevFt: 7800 },
  { distNm:  60, elevFt: 10200, label: 'Black Canyon' },
  { distNm:  90, elevFt: 12400 },
  { distNm: 120, elevFt: 13200, label: 'San Juan Range' },
  { distNm: 150, elevFt: 11600 },
  { distNm: 165, elevFt: 9800 },
  { distNm: 175, elevFt: 9070,  label: 'KTEX' },
]

const TERRAIN_KBDU_KCOS = [
  { distNm:  0, elevFt: 5288, label: 'KBDU' },
  { distNm: 20, elevFt: 6200 },
  { distNm: 40, elevFt: 7100, label: 'Palmer Divide' },
  { distNm: 60, elevFt: 6600 },
  { distNm: 85, elevFt: 6187, label: 'KCOS' },
]

const TERRAIN_KBDU_KEGE = [
  { distNm:   0, elevFt: 5288,  label: 'KBDU' },
  { distNm:  20, elevFt: 7400 },
  { distNm:  40, elevFt: 9200,  label: 'Vail Pass' },
  { distNm:  60, elevFt: 10800, label: 'Battle Mountain' },
  { distNm:  80, elevFt: 8800 },
  { distNm: 100, elevFt: 6548,  label: 'KEGE' },
]

const TERRAIN_KBDU_KGJT = [
  { distNm:   0, elevFt: 5288, label: 'KBDU' },
  { distNm:  25, elevFt: 7200 },
  { distNm:  50, elevFt: 9800, label: 'Rockies Crossing' },
  { distNm:  80, elevFt: 6400 },
  { distNm: 105, elevFt: 4800 },
  { distNm: 115, elevFt: 4858, label: 'KGJT' },
]

// ── Charter Routes ─────────────────────────────────────────────────────────────

export const CHARTER_ROUTES = [
  {
    id: 'kbdu-kase',
    departure: 'KBDU', arrival: 'KASE',
    label: 'Aspen',
    distNm: 95,
    maxTerrainFt: 13800,
    minServiceCeilingFt: 17000,
    ifrRequired: true,
    terrain: TERRAIN_KBDU_KASE,
    maxPax: 5,
  },
  {
    id: 'kbdu-klxv',
    departure: 'KBDU', arrival: 'KLXV',
    label: 'Leadville',
    distNm: 65,
    maxTerrainFt: 12600,
    minServiceCeilingFt: 16000,
    ifrRequired: true,
    terrain: TERRAIN_KBDU_KLXV,
    maxPax: 4,
  },
  {
    id: 'kbdu-ktex',
    departure: 'KBDU', arrival: 'KTEX',
    label: 'Telluride',
    distNm: 175,
    maxTerrainFt: 13200,
    minServiceCeilingFt: 17000,
    ifrRequired: true,
    terrain: TERRAIN_KBDU_KTEX,
    maxPax: 6,
  },
  {
    id: 'kbdu-kcos',
    departure: 'KBDU', arrival: 'KCOS',
    label: 'Colorado Springs',
    distNm: 85,
    maxTerrainFt: 7100,
    minServiceCeilingFt: 10000,
    ifrRequired: false,
    terrain: TERRAIN_KBDU_KCOS,
    maxPax: 5,
  },
  {
    id: 'kbdu-kege',
    departure: 'KBDU', arrival: 'KEGE',
    label: 'Eagle / Vail',
    distNm: 100,
    maxTerrainFt: 10800,
    minServiceCeilingFt: 14000,
    ifrRequired: true,
    terrain: TERRAIN_KBDU_KEGE,
    maxPax: 5,
  },
  {
    id: 'kbdu-kgjt',
    departure: 'KBDU', arrival: 'KGJT',
    label: 'Grand Junction',
    distNm: 115,
    maxTerrainFt: 9800,
    minServiceCeilingFt: 13000,
    ifrRequired: false,
    terrain: TERRAIN_KBDU_KGJT,
    maxPax: 4,
  },
]

// ── Fleet and crew ────────────────────────────────────────────────────────────

const FLEET = mockAircraft.filter((ac) => ac.airworthy)
const PICS  = mockPersonnel.filter((p) => p.role === 'pilot_pic')
const SICS  = mockPersonnel.filter((p) => p.role === 'pilot_sic')

// ── Post-flight maintenance squawk pool ───────────────────────────────────────

const MX_SQUAWKS = [
  'Fuel cap O-ring weeping — confirm torque',
  'Brake pedal soft — check fluid level and lines',
  'Windshield heat element intermittent during climb',
  'GPS #2 lost satellite acquisition on approach',
  'Right NAV light flickering at cruise',
  'Elevator trim slow/stiff — check cable tension',
  'Avionics cooling fan intermittent noise',
  'ELT test switch — no indicator light',
  'Static wicks missing on right wingtip (2)',
  'Landing light dim — suspect failing filament',
  'Fuel vent tube — possible hairline crack observed',
  'Flap position indicator off by 3° at full flap',
  'Comm 2 intermittent squelch break at low signal',
  'Nose strut down 0.5 in — check nitrogen pressure',
]

// ── localStorage keys ─────────────────────────────────────────────────────────

const SIM_FLIGHTS_KEY = 'flightsafe_sim_flights'
const STORE_EVENT     = 'flightsafe:scheduled'

export function getSimFlights() {
  try { return JSON.parse(localStorage.getItem(SIM_FLIGHTS_KEY) || '[]') } catch { return [] }
}

function writeSimFlights(records) {
  try {
    localStorage.setItem(SIM_FLIGHTS_KEY, JSON.stringify(records))
    window.dispatchEvent(new CustomEvent(STORE_EVENT))
  } catch (_) {}
}

export function clearSimFlights() {
  localStorage.removeItem(SIM_FLIGHTS_KEY)
  window.dispatchEvent(new CustomEvent(STORE_EVENT))
}

// ── Airworthy fleet export (for ramp initial placement) ───────────────────────

export function getAirworthyFleet() {
  return FLEET.map((ac) => ({
    tailNumber:    ac.tailNumber,
    makeModel:     ac.makeModel,
    icaoType:      ac.icaoType,
    fuelType:      ac.fuelType,
    turboprop:     ac.riskProfile?.turboprop ?? false,
    fboCategory:   ac.fboCategory,
    fuelGal:       ac.fuelType === 'jet_a' ? 120 : 55,
    cruiseSpeedKts: ac.cruiseSpeedKts ?? 150,
  }))
}

// ── Route / aircraft matching ─────────────────────────────────────────────────

function acCanFlyRoute(ac, route) {
  if (!ac.airworthy) return false
  if ((ac.serviceCeiling ?? 0) < route.minServiceCeilingFt) return false
  if (route.ifrRequired && !ac.equipment?.ifrCertified) return false
  return true
}

function eligibleRoutes(ac) {
  return CHARTER_ROUTES.filter((r) => acCanFlyRoute(ac, r))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flightDurationMs(distNm, speedKts) {
  return Math.round((distNm / Math.max(80, speedKts)) * 3_600_000)
}

// Aircraft with an active charter OR dead head in progress
function aircraftBusy(fs) {
  return new Set(
    fs.simFlights
      .filter((sf) => ['scheduled', 'boarding', 'airborne'].includes(sf.status))
      .map((sf) => sf.tailNumber)
  )
}

// Aircraft pending a dead-head return (arrived at destination, dead head not yet complete)
function aircraftPendingReturn(fs) {
  return new Set(
    fs.simFlights
      .filter((sf) => sf.type === 'charter' && ['arrived', 'complete'].includes(sf.status))
      .filter((sf) => {
        // Check if a dead head for this charter already exists
        return !fs.simFlights.some(
          (dh) => dh.type === 'deadhead' && dh.charterFlightId === sf.id
        )
      })
      .map((sf) => sf.tailNumber)
  )
}

function riskForRoute(route) {
  return Math.min(95, 28 + (route.maxTerrainFt > 12000 ? 28 : route.maxTerrainFt > 10000 ? 16 : 5))
}

function buildRiskSnapshot(route, simTimeMs) {
  const riskItems = []
  if (route.maxTerrainFt > 10000) {
    riskItems.push({ id: 'op_mtn_terrain', label: 'High terrain — Rocky Mountain corridor', category: 'terrain', severity: 'high' })
  }
  if (route.maxTerrainFt > 12000) {
    riskItems.push({ id: 'op_high_terrain', label: `Terrain above 12,000 ft MSL — ${route.label}`, category: 'terrain', severity: 'critical' })
  }
  if (route.ifrRequired) {
    riskItems.push({ id: 'op_ifr_mtn', label: 'IFR over mountainous terrain', category: 'operational', severity: 'moderate' })
  }
  riskItems.push({ id: 'op_135_charter', label: 'Part 135 on-demand charter', category: 'operational', severity: 'low' })
  const score = riskForRoute(route)
  return {
    capturedAt:      new Date(simTimeMs).toISOString(),
    lastCheckedAt:   new Date(simTimeMs).toISOString(),
    ratioToBaseline: +(score / 40).toFixed(2),
    riskTrend:       'stable',
    riskDelta:       0,
    weatherSummary: {
      flightCategory: 'VFR',
      sigmetCount:    0,
      airmetCount:    route.maxTerrainFt > 12000 ? 1 : 0,
      windKts:        12,
      visibilitySm:   10,
    },
    terrainProfile: {
      profile:     route.terrain,
      maxElevFt:   route.maxTerrainFt,
      routeDistNm: route.distNm,
    },
    riskItems,
  }
}

// Dead-head risk snapshot (reversed terrain, lower risk — no pax)
function buildDeadheadSnapshot(charter, simTimeMs) {
  const reversedTerrain = [...charter.riskSnapshot.terrainProfile.profile]
    .reverse()
    .map((pt, i, arr) => ({
      ...pt,
      distNm: arr[arr.length - 1].distNm - pt.distNm,
    }))
    .sort((a, b) => a.distNm - b.distNm)
  const score = Math.round(charter.riskScore * 0.75)
  return {
    capturedAt:      new Date(simTimeMs).toISOString(),
    lastCheckedAt:   new Date(simTimeMs).toISOString(),
    ratioToBaseline: +(score / 40).toFixed(2),
    riskTrend:       'stable',
    riskDelta:       0,
    weatherSummary:  { ...charter.riskSnapshot.weatherSummary },
    terrainProfile: {
      profile:     reversedTerrain,
      maxElevFt:   charter.riskSnapshot.terrainProfile.maxElevFt,
      routeDistNm: charter.distNm,
    },
    riskItems: [
      { id: 'op_ferry_return', label: 'Ferry / dead-head — crew only, no pax', category: 'operational', severity: 'low' },
      { id: 'op_mtn_terrain',  label: 'Rocky Mountain terrain on return leg',   category: 'terrain',     severity: 'high'  },
    ],
  }
}

// ── Convert sim flight → Flights page store record ────────────────────────────

export function toStoreRecord(sf) {
  const storeStatus =
    sf.status === 'airborne'                              ? 'active'    :
    sf.status === 'arrived' || sf.status === 'complete'   ? 'completed' :
    'planned'

  return {
    id:                   sf.id,
    callsign:             sf.tailNumber,
    tailNumber:           sf.tailNumber,
    aircraftType:         sf.icaoType,
    departure:            sf.departure,
    arrival:              sf.arrival,
    waypoints:            [],
    plannedDepartureUtc:  new Date(sf.scheduledDepartureMs).toISOString(),
    status:               storeStatus,
    pic:                  sf.picName,
    picId:                sf.picId,
    sic:                  sf.sicName ?? null,
    sicId:                sf.sicId ?? null,
    passengers:           sf.passengers,
    missionType:          sf.type === 'deadhead' ? 'ferry' : 'charter',
    riskScore:            sf.riskScore,
    riskP:                sf.riskP,
    riskA:                sf.riskA,
    riskV:                sf.riskV,
    riskE:                sf.riskE,
    riskSnapshot:         sf.riskSnapshot,
    _sim:                 true,
    _flightType:          sf.type,
    _requiresMaintenance: sf.requiresMaintenance ?? false,
    _maintenanceSquawk:   sf.maintenanceSquawk ?? null,
    _charterFlightId:     sf.charterFlightId ?? null,
  }
}

// ── Initial flight sim state ──────────────────────────────────────────────────

export function createFlightSimState() {
  return {
    simFlights:    [],
    _nextFlightMs: null,
    _flightCounter: 1,
  }
}

// ── Main tick — returns ramp-arrival events for Sim.jsx ───────────────────────

export function tickFlightSim(fs, simTimeMs, logEvent) {
  const rampEvents = []   // { type: 'deadhead_landed', ...acData }

  const INTERVAL_MIN = 40   // sim-minutes between charter generations
  const INTERVAL_MAX = 75

  // ── 1. Generate new charter ────────────────────────────────────────────────
  if (fs._nextFlightMs === null || simTimeMs >= fs._nextFlightMs) {
    const busy      = aircraftBusy(fs)
    const available = FLEET.filter((ac) => !busy.has(ac.tailNumber))

    if (available.length > 0) {
      const ac     = available[Math.floor(Math.random() * available.length)]
      const routes = eligibleRoutes(ac)

      if (routes.length > 0) {
        const route      = routes[Math.floor(Math.random() * routes.length)]
        const pic        = PICS[Math.floor(Math.random() * PICS.length)]
        const needsSic   = ac.passengerCapacity >= 6 || route.ifrRequired
        const sic        = needsSic ? SICS[Math.floor(Math.random() * SICS.length)] : null
        const maxPax     = Math.min(ac.passengerCapacity - 1, route.maxPax)
        const passengers = Math.max(1, Math.floor(Math.random() * maxPax) + 1)
        const durationMs = flightDurationMs(route.distNm, ac.cruiseSpeedKts ?? 150)
        const depMs      = simTimeMs + 15 * 60000
        const score      = riskForRoute(route)

        const charter = {
          id:                   `sflt-${fs._flightCounter++}`,
          type:                 'charter',
          tailNumber:           ac.tailNumber,
          aircraftId:           ac.id,
          icaoType:             ac.icaoType,
          makeModel:            ac.makeModel,
          cruiseSpeedKts:       ac.cruiseSpeedKts ?? 150,
          departure:            route.departure,
          arrival:              route.arrival,
          routeLabel:           route.label,
          distNm:               route.distNm,
          scheduledDepartureMs: depMs,
          estimatedArrivalMs:   depMs + durationMs,
          durationMs,
          picId:                pic.id,
          picName:              pic.name,
          sicId:                sic?.id   ?? null,
          sicName:              sic?.name ?? null,
          passengers,
          status:               'scheduled',
          departedAtMs:         null,
          arrivedAtMs:          null,
          requiresMaintenance:  false,
          maintenanceSquawk:    null,
          riskScore:            score,
          riskP:                Math.round(score * 0.88),
          riskA:                Math.round(score * 0.70),
          riskV:                Math.round(score * 1.10),
          riskE:                Math.round(score * 0.82),
          riskSnapshot:         buildRiskSnapshot(route, simTimeMs),
        }

        fs.simFlights.push(charter)
        logEvent('flight_scheduled',
          `Charter: ${ac.tailNumber} KBDU→${route.arrival} (${route.label}), ${passengers} pax — PIC: ${pic.name.split(' ').pop()}`,
          ac.tailNumber, 'info')
      }
    }

    const next = (INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN)) * 60000
    fs._nextFlightMs = simTimeMs + next
  }

  // ── 2. Advance all flight states ───────────────────────────────────────────
  for (const sf of fs.simFlights) {

    // ── Scheduled → Boarding ──
    if (sf.status === 'scheduled' && simTimeMs >= sf.scheduledDepartureMs - 10 * 60000) {
      sf.status = 'boarding'
      const label = sf.type === 'deadhead' ? 'Dead head boarding' : 'Charter boarding'
      logEvent('flight_boarding',
        `${sf.tailNumber} ${label} — ${sf.departure}→${sf.arrival}, departs in 10 min`,
        sf.tailNumber, 'info')
    }

    // ── Boarding → Airborne ──
    else if (sf.status === 'boarding' && simTimeMs >= sf.scheduledDepartureMs) {
      sf.status       = 'airborne'
      sf.departedAtMs = simTimeMs
      const etMin     = Math.round(sf.durationMs / 60000)
      if (sf.type === 'deadhead') {
        logEvent('flight_departed',
          `${sf.tailNumber} dead head airborne ${sf.departure}→KBDU — ETE ${etMin} min`,
          sf.tailNumber, 'info')
      } else {
        logEvent('flight_departed',
          `${sf.tailNumber} airborne KBDU→${sf.arrival} (${sf.routeLabel}) — ETE ${etMin} min`,
          sf.tailNumber, 'info')
      }
    }

    // ── Airborne → Arrived (charter) ──
    else if (sf.status === 'airborne' && sf.type === 'charter' && simTimeMs >= sf.estimatedArrivalMs) {
      sf.status      = 'arrived'
      sf.arrivedAtMs = simTimeMs
      logEvent('flight_arrived',
        `${sf.tailNumber} arrived ${sf.arrival} — block in, pax deplaning`,
        sf.tailNumber, 'info')

      // Schedule paired dead-head return after 20 sim-min ground time at destination
      const returnDepMs  = simTimeMs + 20 * 60000
      const returnDurMs  = flightDurationMs(sf.distNm, sf.cruiseSpeedKts ?? 150)
      const dhScore      = Math.round(sf.riskScore * 0.75)

      const deadhead = {
        id:                   `sflt-${fs._flightCounter++}`,
        type:                 'deadhead',
        tailNumber:           sf.tailNumber,
        aircraftId:           sf.aircraftId,
        icaoType:             sf.icaoType,
        makeModel:            sf.makeModel,
        cruiseSpeedKts:       sf.cruiseSpeedKts,
        departure:            sf.arrival,    // reversed
        arrival:              'KBDU',
        routeLabel:           `Return — ${sf.routeLabel}`,
        distNm:               sf.distNm,
        scheduledDepartureMs: returnDepMs,
        estimatedArrivalMs:   returnDepMs + returnDurMs,
        durationMs:           returnDurMs,
        picId:                sf.picId,
        picName:              sf.picName,
        sicId:                sf.sicId,
        sicName:              sf.sicName,
        passengers:           0,            // crew only
        status:               'scheduled',
        departedAtMs:         null,
        arrivedAtMs:          null,
        requiresMaintenance:  false,
        maintenanceSquawk:    null,
        riskScore:            dhScore,
        riskP:                Math.round(dhScore * 0.88),
        riskA:                Math.round(dhScore * 0.70),
        riskV:                Math.round(dhScore * 1.10),
        riskE:                Math.round(dhScore * 0.82),
        riskSnapshot:         buildDeadheadSnapshot(sf, simTimeMs),
        charterFlightId:      sf.id,
      }

      fs.simFlights.push(deadhead)
      logEvent('flight_scheduled',
        `Dead head: ${sf.tailNumber} ${sf.arrival}→KBDU — ${sf.picName.split(' ').pop()} returning`,
        sf.tailNumber, 'info')
    }

    // ── Airborne → Arrived (dead head) ──
    else if (sf.status === 'airborne' && sf.type === 'deadhead' && simTimeMs >= sf.estimatedArrivalMs) {
      sf.status      = 'arrived'
      sf.arrivedAtMs = simTimeMs

      // 5% maintenance squawk on block-in
      if (Math.random() < 0.05) {
        sf.requiresMaintenance = true
        sf.maintenanceSquawk   = MX_SQUAWKS[Math.floor(Math.random() * MX_SQUAWKS.length)]
        logEvent('maintenance',
          `${sf.tailNumber} post-flight squawk: ${sf.maintenanceSquawk}`,
          sf.tailNumber, 'warning')
      } else {
        logEvent('flight_arrived',
          `${sf.tailNumber} dead head complete — KBDU block in, ready for next charter`,
          sf.tailNumber, 'info')
      }

      // Emit ramp arrival event — 1:1 match: one dead head = one FBO arrival
      const acData = FLEET.find((a) => a.tailNumber === sf.tailNumber)
      rampEvents.push({
        type:                'deadhead_landed',
        tailNumber:          sf.tailNumber,
        makeModel:           sf.makeModel,
        fuelType:            acData?.fuelType              ?? 'jet_a',
        turboprop:           acData?.riskProfile?.turboprop ?? false,
        fboCategory:         acData?.fboCategory            ?? 'turboprop_single',
        fuelGal:             acData?.fuelType === 'jet_a' ? 120 : 55,
        services:            Math.random() < 0.3
          ? ['fueling', 'cleaning', 'tie_down']
          : ['fueling', 'tie_down'],
        requiresMaintenance: sf.requiresMaintenance,
        maintenanceSquawk:   sf.maintenanceSquawk,
      })
    }

    // ── Archive 20 sim-min after arrival ──
    else if (sf.status === 'arrived' && simTimeMs >= sf.arrivedAtMs + 20 * 60000) {
      sf.status = 'complete'
    }
  }

  // ── 3. Prune old complete flights ──────────────────────────────────────────
  fs.simFlights = fs.simFlights.filter(
    (sf) => sf.status !== 'complete' || simTimeMs - sf.arrivedAtMs < 30 * 60000
  )

  return rampEvents
}

// ── Publish to flight store ───────────────────────────────────────────────────

export function publishFlightsToStore(fs) {
  const visible = fs.simFlights.filter((sf) => sf.status !== 'complete')
  writeSimFlights(visible.map(toStoreRecord))
}
