// =============================================================================
// Ramp Simulation — FBO ground operations simulator
//
// Architecture:
//   • simStateRef (useRef) holds all mutable sim state — no React re-renders per frame
//   • uiSnap (useState) is a shallow snapshot updated at ~10fps for the UI
//   • requestAnimationFrame drives the tick loop
//   • BroadcastChannel('flightsafe_sim') broadcasts snapshots every 500ms to other tabs
//   • localStorage persists last broadcast for tabs that open after sim starts
// =============================================================================

import { useRef, useState, useEffect, useCallback } from 'react'
import { formatEtaTime, FBO_NOW } from '../fbo/fboUtils'
import { mockAircraft } from '../mocks/aircraft'
import {
  createFlightSimState,
  tickFlightSim,
  publishFlightsToStore,
  clearSimFlights,
  getAirworthyFleet,
} from './flightSimEngine'

const SIM_CHANNEL    = 'flightsafe_sim'
const SNAP_INTERVAL  = 100    // ms between React UI snapshots
const BCAST_INTERVAL = 500    // ms between BroadcastChannel updates

// ── Map coordinate system: SVG viewBox "0 0 100 70" ──────────────────────────
// All positions are (x, y) in SVG user units (0-100 wide, 0-70 tall).

// Key waypoints
const WP = {
  approach_entry:    { x: 110, y: 62 },  // aircraft enters from off-screen right
  runway_threshold:  { x: 85,  y: 62 },  // touchdown point
  taxiway_junction:  { x: 49,  y: 62 },  // runway ↔ taxiway intersection
  taxiway_ramp_gate: { x: 49,  y: 42 },  // taxiway ↔ ramp entrance
  departure_end:     { x: -10, y: 62 },  // take-off roll, exits left
}

// Ramp parking spots (center of each marked spot)
const PARKING = {
  A1: { x: 9,  y: 12 }, A2: { x: 19, y: 12 }, A3: { x: 29, y: 12 }, A4: { x: 39, y: 12 },
  A5: { x: 9,  y: 24 }, A6: { x: 19, y: 24 }, A7: { x: 29, y: 24 }, A8: { x: 39, y: 24 },
}
const RAMP_SPOTS = Object.keys(PARKING)

// Hangar maintenance bays (two bays aligned with the hangar door panels)
const HANGAR = {
  H1: { x: 69, y: 12 },   // left bay
  H2: { x: 80, y: 12 },   // right bay
}
const HANGAR_SLOTS = Object.keys(HANGAR)

// Fixed positions for vehicles and staff when idle
const HOME = {
  'ft-001': { x: 53, y: 12 },
  'ft-002': { x: 53, y: 18 },
  'tt-001': { x: 53, y: 28 },
  'gpu-001':{ x: 53, y: 35 },
  'prs-010':{ x: 70, y: 35 },
  'prs-014':{ x: 74, y: 35 },
  'prs-015':{ x: 78, y: 35 },
  'prs-016':{ x: 82, y: 35 },
}

// Aircraft type templates — cycled through as arrivals are generated
const AC_TEMPLATES = [
  { makeModel: 'Cessna Grand Caravan',      fuelType: 'jet_a',       fboCategory: 'turboprop_single', turboprop: true,  services: ['fueling','tie_down'],          fuelGal: 90,  icon: '✈' },
  { makeModel: 'Beechcraft Baron 58',        fuelType: 'avgas_100ll', fboCategory: 'piston_twin',      turboprop: false, services: ['fueling','tie_down'],          fuelGal: 60,  icon: '✈' },
  { makeModel: 'Cessna Citation CJ2+',       fuelType: 'jet_a',       fboCategory: 'jet_light',        turboprop: false, services: ['fueling','gpu','catering'],    fuelGal: 150, icon: '✈' },
  { makeModel: 'King Air B200',              fuelType: 'jet_a',       fboCategory: 'turboprop_twin',   turboprop: true,  services: ['fueling','cleaning','tie_down'],fuelGal: 120, icon: '✈' },
  { makeModel: 'Cessna 172 Skyhawk',         fuelType: 'avgas_100ll', fboCategory: 'piston_single',    turboprop: false, services: ['fueling'],                    fuelGal: 30,  icon: '✈' },
  { makeModel: 'Piper Seneca V',             fuelType: 'avgas_100ll', fboCategory: 'piston_twin',      turboprop: false, services: ['fueling','cleaning'],          fuelGal: 50,  icon: '✈' },
]

// Simulated service durations in sim-minutes
const SVC_MIN = { fueling: 22, tie_down: 8, cleaning: 55, gpu: 28, catering: 18, hangaring: 12, crew_car: 10 }

// Movement speeds (SVG units per sim-second)
const SPEED_AIRCRAFT = 6
const SPEED_VEHICLE  = 12
const SPEED_STAFF    = 9

// ── State factories ───────────────────────────────────────────────────────────

function makeResource(id, label, type) {
  return { id, label, type, state: 'available', assignedTo: null, assignedService: null,
           position: { ...HOME[id] }, serviceEndMs: null }
}

function makeStaff(id, name) {
  return { id, name, state: 'available', assignedTo: null, assignedService: null,
           position: { ...HOME[id] }, serviceEndMs: null }
}

function createInitialSimState() {
  // Place the airworthy Part 135 fleet on the ramp at start
  const fleet = getAirworthyFleet()
  const simTimeMs = new Date(FBO_NOW).getTime()
  const fleetOnRamp = fleet.slice(0, RAMP_SPOTS.length).map((ac, i) => {
    const spot    = RAMP_SPOTS[i]
    const spotPos = PARKING[spot]
    return {
      id:             `ac-fleet-${i}`,
      tail:           ac.tailNumber,
      makeModel:      ac.makeModel,
      fuelType:       ac.fuelType,
      turboprop:      ac.turboprop,
      fboCategory:    ac.fboCategory,
      state:          'parked',
      pos:            { ...spotPos },
      parkingSpot:    spot,
      servicesNeeded: ['fueling', 'tie_down'],
      servicesDone:   [],
      serviceActive:  null,
      serviceEndMs:   null,
      readyAtMs:      null,
      fuelGal:        ac.fuelGal,
      taxiPhase:      0,
      etaMs:          simTimeMs,
      parkedAtMs:     simTimeMs,
      serviceStartMs: null,
    }
  })

  return {
    running:          false,
    simTimeMs,
    speedMultiplier:  5,
    arrivalRatePerHr: 1,   // dead-head returns are primary FBO traffic; transients are background
    aircraft:         fleetOnRamp,
    resources: [
      makeResource('ft-001',  'Fuel Truck 1', 'fuel_truck'),
      makeResource('ft-002',  'Fuel Truck 2', 'fuel_truck'),
      makeResource('tt-001',  'Tow Tug',      'tow_tug'),
      makeResource('gpu-001', 'GPU Unit',     'gpu'),
    ],
    staff: [
      makeStaff('prs-010', 'Sam N.'),
      makeStaff('prs-014', 'Devon P.'),
      makeStaff('prs-015', 'Jordan K.'),
      makeStaff('prs-016', 'Rosa M.'),
    ],
    events:             [],
    _nextAcIdx:         0,
    _nextTailN:         101,
    _nextEvId:          1,
    _lastArrivalSimMs:  0,
    _lastSnapRealMs:    0,
    _lastBcastRealMs:   0,
    _lastFlushedEvId:   0,
    flightSim:          createFlightSimState(),
    // Grounded / in-maintenance aircraft shown in hangar at start
    hangarAircraft: mockAircraft
      .filter((ac) => !ac.airworthy)
      .slice(0, HANGAR_SLOTS.length)
      .map((ac, i) => ({
        id:               `ha-init-${i}`,
        tail:             ac.tailNumber,
        makeModel:        ac.makeModel,
        fuelType:         ac.fuelType,
        turboprop:        ac.riskProfile?.turboprop ?? false,
        fboCategory:      ac.fboCategory,
        slot:             HANGAR_SLOTS[i],
        maintenanceNote:  ac.openSquawks?.[0]?.description ?? 'Scheduled maintenance',
        maintenanceEndMs: null,   // grounded indefinitely — no auto-release
      })),
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) }

function stepToward(pos, target, speed, deltaS) {
  const d = dist(pos, target)
  if (d < 0.001) return { pos: target, arrived: true }
  const t = Math.min(1, (speed * deltaS) / d)
  return { pos: { x: pos.x + (target.x - pos.x) * t, y: pos.y + (target.y - pos.y) * t }, arrived: t >= 1 }
}

// ── Event logger ──────────────────────────────────────────────────────────────

function logEvent(s, type, message, tail = null, severity = 'info') {
  const id   = `ev-${s._nextEvId++}`
  const mins = new Date(s.simTimeMs)
  const hhmm = mins.toISOString().slice(11, 16) + 'Z'
  s.events.unshift({ id, time: hhmm, type, message, tail, severity })
  if (s.events.length > 100) s.events.length = 100
}

// ── Resource / staff helpers ──────────────────────────────────────────────────

function freeStaff(s)  { return s.staff.find((p) => p.state === 'available') ?? null }
function freeResource(s, type) { return s.resources.find((r) => r.type === type && r.state === 'available') ?? null }
function resourceNeeded(svc)   {
  if (svc === 'fueling') return 'fuel_truck'
  if (svc === 'gpu')     return 'gpu'
  if (svc === 'tow')     return 'tow_tug'
  return null
}
function freeParkingSpot(s) {
  const used = new Set(s.aircraft.map((a) => a.parkingSpot).filter(Boolean))
  return RAMP_SPOTS.find((sp) => !used.has(sp)) ?? null
}

function freeHangarSlot(s) {
  const used = new Set(s.hangarAircraft.map((h) => h.slot))
  return HANGAR_SLOTS.find((sl) => !used.has(sl)) ?? null
}

function fuelLabel(fuelType) {
  return fuelType === 'jet_a' ? 'Jet-A' : 'Avgas'
}

// ── Simulation tick ───────────────────────────────────────────────────────────

function tick(s, deltaRealMs) {
  if (!s.running) return
  const deltaSimMs = deltaRealMs * s.speedMultiplier
  const deltaSimS  = deltaSimMs / 1000
  s.simTimeMs     += deltaSimMs

  // ── 1. Generate arrivals ──────────────────────────────────────────────────
  const msPerArrival = (3600000) / Math.max(0.1, s.arrivalRatePerHr)
  if (s.simTimeMs - s._lastArrivalSimMs >= msPerArrival) {
    const spot = freeParkingSpot(s)
    if (spot) {
      const tmpl  = AC_TEMPLATES[s._nextAcIdx % AC_TEMPLATES.length]
      s._nextAcIdx++
      const tail  = `N${String(1000 + s._nextTailN++).slice(1)}X`
      // Compute fixed ETA from total path distance: approach_entry → junction → gate → spot
      const spotPos    = PARKING[spot]
      const totalDist  = dist(WP.approach_entry, WP.taxiway_junction)
                       + dist(WP.taxiway_junction, WP.taxiway_ramp_gate)
                       + dist(WP.taxiway_ramp_gate, spotPos)
      const etaTravelMs = Math.round((totalDist / SPEED_AIRCRAFT) * 1000)
      s.aircraft.push({
        id: `ac-${s._nextAcIdx}`, tail, tmpl,
        makeModel: tmpl.makeModel, fuelType: tmpl.fuelType, turboprop: tmpl.turboprop,
        fboCategory: tmpl.fboCategory,
        state: 'approach',
        pos: { ...WP.approach_entry },
        parkingSpot: spot,
        servicesNeeded: Math.random() < 0.25 ? [...tmpl.services, 'crew_car'] : [...tmpl.services],
        servicesDone:   [],
        serviceActive:  null,
        serviceEndMs:   null,
        readyAtMs:      null,
        fuelGal:        tmpl.fuelGal,
        taxiPhase:      0,
        etaMs:          s.simTimeMs + etaTravelMs,
        parkedAtMs:     null,
        serviceStartMs: null,
      })
      logEvent(s, 'arrival', `${tail} (${tmpl.makeModel}) entering pattern`, tail)
    }
    s._lastArrivalSimMs = s.simTimeMs
  }

  // ── 2. Move and transition aircraft ───────────────────────────────────────
  for (const ac of s.aircraft) {
    if (ac.state === 'approach') {
      const { pos, arrived } = stepToward(ac.pos, WP.taxiway_junction, SPEED_AIRCRAFT, deltaSimS)
      ac.pos = pos
      if (arrived) {
        ac.state = 'taxiing_in'
        ac.taxiPhase = 0
        logEvent(s, 'taxi', `${ac.tail} landed — taxiing to ramp spot ${ac.parkingSpot}`, ac.tail)
      }
    }
    else if (ac.state === 'taxiing_in') {
      // phase 0 → gate, phase 1 → parking spot
      const taxiInWps = [WP.taxiway_ramp_gate, PARKING[ac.parkingSpot]]
      const target    = taxiInWps[ac.taxiPhase]
      const { pos, arrived } = stepToward(ac.pos, target, SPEED_AIRCRAFT, deltaSimS)
      ac.pos = pos
      if (arrived) {
        if (ac.taxiPhase < taxiInWps.length - 1) {
          ac.taxiPhase++
        } else {
          ac.state      = 'parked'
          ac.parkedAtMs = s.simTimeMs
          logEvent(s, 'parked', `${ac.tail} parked at ${ac.parkingSpot}`, ac.tail)
        }
      }
    }
    else if (ac.state === 'taxiing_out') {
      // phase 0 → gate, phase 1 → junction, phase 2 → departure
      const taxiOutWps = [WP.taxiway_ramp_gate, WP.taxiway_junction, WP.departure_end]
      const target     = taxiOutWps[ac.taxiPhase]
      const { pos, arrived } = stepToward(ac.pos, target, SPEED_AIRCRAFT, deltaSimS)
      ac.pos = pos
      if (arrived) {
        if (ac.taxiPhase < taxiOutWps.length - 1) {
          ac.taxiPhase++
        } else {
          ac.state = 'departed'
          logEvent(s, 'departure', `${ac.tail} departed`, ac.tail)
        }
      }
    }

    // Service completion check
    if (ac.state === 'being_serviced' && ac.serviceEndMs && s.simTimeMs >= ac.serviceEndMs) {
      const svc = ac.serviceActive
      ac.servicesDone.push(svc)
      ac.serviceActive = null
      ac.serviceEndMs  = null
      logEvent(s, 'svc_done', `${ac.tail} — ${svc} complete`, ac.tail)
      // Release assigned resources and staff
      for (const r of s.resources) {
        if (r.assignedTo === ac.tail && r.assignedService === svc) {
          r.state = 'returning'; r.assignedTo = null; r.assignedService = null
        }
      }
      for (const p of s.staff) {
        if (p.assignedTo === ac.tail && p.assignedService === svc) {
          p.state = 'returning'; p.assignedTo = null; p.assignedService = null
        }
      }
      const remaining = ac.servicesNeeded.filter((x) => !ac.servicesDone.includes(x))
      if (remaining.length === 0) {
        ac.state = 'ready'
        ac.readyAtMs = s.simTimeMs
        logEvent(s, 'ready', `${ac.tail} — all services complete, ready to depart`, ac.tail)
      } else {
        ac.state = 'parked'  // wait for dispatch of next service
      }
    }

    // Ready → taxi out after 2 sim-minutes
    if (ac.state === 'ready' && ac.readyAtMs && s.simTimeMs - ac.readyAtMs > 2 * 60000) {
      ac.state = 'taxiing_out'
      ac.taxiPhase = 0
      logEvent(s, 'taxi_out', `${ac.tail} taxiing to runway`, ac.tail)
    }
  }

  // ── 3. Dispatch services to parked aircraft ───────────────────────────────
  for (const ac of s.aircraft) {
    if (ac.state !== 'parked') continue
    const remaining = ac.servicesNeeded.filter((x) => !ac.servicesDone.includes(x))
    if (remaining.length === 0) continue

    const svc     = remaining[0]
    const resType = resourceNeeded(svc)
    const worker  = freeStaff(s)
    if (!worker) continue
    const res = resType ? freeResource(s, resType) : null
    if (resType && !res) continue   // resource needed but not available — skip

    // Assign
    worker.state = 'dispatched'; worker.assignedTo = ac.tail; worker.assignedService = svc
    if (res) { res.state = 'dispatched'; res.assignedTo = ac.tail; res.assignedService = svc }

    // Start service on aircraft
    ac.state          = 'being_serviced'
    ac.serviceActive  = svc
    ac.serviceEndMs   = s.simTimeMs + (SVC_MIN[svc] ?? 15) * 60000
    ac.serviceStartMs = s.simTimeMs

    const resLabel = res ? ` + ${res.label}` : ''
    logEvent(s, 'dispatch',
      `${worker.name}${resLabel} → ${svc} on ${ac.tail} (${fuelLabel(ac.fuelType)})`, ac.tail)
  }

  // ── 4. Move vehicles and staff ─────────────────────────────────────────────
  for (const r of [...s.resources, ...s.staff]) {
    const speed = r.type ? SPEED_VEHICLE : SPEED_STAFF
    if (r.state === 'dispatched' && r.assignedTo) {
      const ac = s.aircraft.find((a) => a.tail === r.assignedTo)
      if (ac) {
        const { pos, arrived } = stepToward(r.position, ac.pos, speed, deltaSimS)
        r.position = pos
        if (arrived) r.state = 'working'
      }
    } else if (r.state === 'returning') {
      const home = HOME[r.id]
      if (home) {
        const { pos, arrived } = stepToward(r.position, home, speed, deltaSimS)
        r.position = pos
        if (arrived) r.state = 'available'
      }
    } else if (r.state === 'working' && r.assignedTo) {
      // Track aircraft position while working
      const ac = s.aircraft.find((a) => a.tail === r.assignedTo)
      if (ac) r.position = { ...ac.pos }
    }
  }

  // ── 5. Clean up fully departed aircraft ────────────────────────────────────
  s.aircraft = s.aircraft.filter((ac) => {
    if (ac.state !== 'departed') return true
    return ac.pos.x > -5  // keep briefly visible during departure roll
  })

  // ── 6. Part 135 charter flight simulation ──────────────────────────────────
  const fsEvents = tickFlightSim(
    s.flightSim,
    s.simTimeMs,
    (type, message, tail, severity) => logEvent(s, type, message, tail, severity ?? 'info'),
  )

  // ── 7. Dead-head returns — MX aircraft → hangar, others → ramp ───────────
  for (const ev of fsEvents) {
    if (ev.type !== 'deadhead_landed') continue

    if (ev.requiresMaintenance) {
      // Route to hangar for maintenance
      const slot = freeHangarSlot(s)
      if (slot) {
        const mxDurMs = (90 + Math.random() * 60) * 60000   // 90–150 sim-min
        s.hangarAircraft.push({
          id:               `ha-mx-${s._nextAcIdx++}`,
          tail:             ev.tailNumber,
          makeModel:        ev.makeModel,
          fuelType:         ev.fuelType,
          turboprop:        ev.turboprop,
          fboCategory:      ev.fboCategory,
          slot,
          maintenanceNote:  ev.maintenanceSquawk,
          maintenanceEndMs: s.simTimeMs + mxDurMs,
        })
        logEvent(s, 'maintenance',
          `${ev.tailNumber} towed to hangar — ${ev.maintenanceSquawk}`,
          ev.tailNumber)
        continue
      }
      // Hangar full — fall through to ramp arrival with squawk noted
      logEvent(s, 'maintenance',
        `${ev.tailNumber} hangar full — squawk open on ramp: ${ev.maintenanceSquawk}`,
        ev.tailNumber)
    }

    // Normal ramp arrival (1:1 dead-head → FBO turnaround)
    const spot = freeParkingSpot(s)
    if (!spot) continue
    const spotPos     = PARKING[spot]
    const totalDist   = dist(WP.approach_entry, WP.taxiway_junction)
                      + dist(WP.taxiway_junction, WP.taxiway_ramp_gate)
                      + dist(WP.taxiway_ramp_gate, spotPos)
    const etaTravelMs = Math.round((totalDist / SPEED_AIRCRAFT) * 1000)
    s.aircraft.push({
      id:             `ac-rtn-${s._nextAcIdx++}`,
      tail:           ev.tailNumber,
      makeModel:      ev.makeModel,
      fuelType:       ev.fuelType,
      turboprop:      ev.turboprop,
      fboCategory:    ev.fboCategory,
      state:          'approach',
      pos:            { ...WP.approach_entry },
      parkingSpot:    spot,
      servicesNeeded: ev.services,
      servicesDone:   [],
      serviceActive:  null,
      serviceEndMs:   null,
      readyAtMs:      null,
      fuelGal:        ev.fuelGal,
      taxiPhase:      0,
      etaMs:          s.simTimeMs + etaTravelMs,
      parkedAtMs:     null,
      serviceStartMs: null,
    })
    logEvent(s, 'arrival',
      `${ev.tailNumber} (${ev.makeModel}) returning from charter — entering pattern`,
      ev.tailNumber)
  }

  // ── 8. Release aircraft from hangar after maintenance complete ────────────
  s.hangarAircraft = s.hangarAircraft.filter((ha) => {
    if (ha.maintenanceEndMs === null) return true             // permanently grounded
    if (s.simTimeMs < ha.maintenanceEndMs) return true        // work in progress
    const spot = freeParkingSpot(s)
    if (!spot) return true                                    // ramp full — hold
    const spotPos = PARKING[spot]
    s.aircraft.push({
      id:             `ac-hmx-${s._nextAcIdx++}`,
      tail:           ha.tail,
      makeModel:      ha.makeModel,
      fuelType:       ha.fuelType,
      turboprop:      ha.turboprop,
      fboCategory:    ha.fboCategory,
      state:          'parked',
      pos:            { ...spotPos },
      parkingSpot:    spot,
      servicesNeeded: ['fueling', 'tie_down'],
      servicesDone:   [],
      serviceActive:  null,
      serviceEndMs:   null,
      readyAtMs:      null,
      fuelGal:        ha.fuelType === 'jet_a' ? 120 : 55,
      taxiPhase:      0,
      etaMs:          s.simTimeMs,
      parkedAtMs:     s.simTimeMs,
      serviceStartMs: null,
    })
    logEvent(s, 'parked',
      `${ha.tail} maintenance complete — towed to ramp, ready for next charter`,
      ha.tail)
    return false
  })
}

// ── Server event flush ────────────────────────────────────────────────────────
// Called every BCAST_INTERVAL. Identifies events not yet sent (by numeric id)
// and POSTs them to /api/sim/events in oldest-first order.
function flushEventsToServer(s) {
  const newEvents = s.events
    .filter((e) => parseInt(e.id.slice(3), 10) > s._lastFlushedEvId)
    .sort((a, b) => parseInt(a.id.slice(3), 10) - parseInt(b.id.slice(3), 10))
  if (newEvents.length === 0) return
  s._lastFlushedEvId = parseInt(newEvents[newEvents.length - 1].id.slice(3), 10)
  fetch('/api/sim/events', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(newEvents),
  }).catch(() => { /* server may not be running — ignore */ })
}

// ── BroadcastChannel helpers ──────────────────────────────────────────────────

function broadcastSnapshot(channel, s) {
  const payload = {
    type:       'SIM_STATE',
    running:    s.running,
    simTimeMs:  s.simTimeMs,
    aircraft:   s.aircraft.map((a) => ({
      tail: a.tail, makeModel: a.makeModel, fuelType: a.fuelType, turboprop: a.turboprop,
      fboCategory: a.fboCategory,
      state: a.state, parkingSpot: a.parkingSpot,
      serviceActive:  a.serviceActive,
      servicesNeeded: a.servicesNeeded,
      servicesDone:   a.servicesDone,
      etaMs:          a.etaMs,
      parkedAtMs:     a.parkedAtMs,
      serviceStartMs: a.serviceStartMs,
      readyAtMs:      a.readyAtMs,
      fuelGal:        a.fuelGal,
    })),
    resources:  s.resources.map((r) => ({ id: r.id, label: r.label, state: r.state, assignedTo: r.assignedTo })),
    staff:      s.staff.map((p) => ({ id: p.id, name: p.name, state: p.state, assignedTo: p.assignedTo, assignedService: p.assignedService })),
    events:     s.events.slice(0, 20),
  }
  try {
    channel.postMessage(payload)
    localStorage.setItem('flightsafe_sim_last', JSON.stringify({ ...payload, ts: Date.now() }))
  } catch (_) { /* ignore */ }

  // Push to server — this is the reliable cross-tab channel (no RAF throttling issues)
  fetch('/api/sim/state', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(() => { /* server may not be running */ })

  // Publish Part 135 flights to flight store (localStorage → Flights page)
  publishFlightsToStore(s.flightSim)
}

// ── Service type display label ─────────────────────────────────────────────────
const SVC_LABELS = {
  fueling: 'Fueling', tie_down: 'Tie-Down', cleaning: 'Cleaning',
  gpu: 'GPU', catering: 'Catering', hangaring: 'Hangar', crew_car: 'Crew Car',
}
function svcLabel(s) { return SVC_LABELS[s] ?? s }

// ── Color helpers ─────────────────────────────────────────────────────────────

function acColor(state) {
  if (state === 'approach' || state === 'taxiing_in') return '#38bdf8'  // sky
  if (state === 'parked') return '#94a3b8'                              // slate
  if (state === 'being_serviced') return '#fbbf24'                     // amber
  if (state === 'ready') return '#4ade80'                              // green
  if (state === 'taxiing_out' || state === 'departed') return '#f97316' // orange
  return '#94a3b8'
}

function resourceColor(state) {
  if (state === 'available') return '#4ade80'
  if (state === 'dispatched') return '#fbbf24'
  if (state === 'working') return '#f97316'
  if (state === 'returning') return '#38bdf8'
  return '#94a3b8'
}

function stateLabel(state) {
  const map = {
    approach: 'Approach', taxiing_in: 'Taxi In', parked: 'Parked',
    being_serviced: 'Servicing', ready: 'Ready', taxiing_out: 'Taxi Out',
    departed: 'Departed',
  }
  return map[state] ?? state
}

// ── Main Sim Component ────────────────────────────────────────────────────────

export function Sim() {
  const simRef         = useRef(createInitialSimState())
  const rafRef         = useRef(null)
  const lastRealMsRef  = useRef(null)
  const channelRef     = useRef(null)

  const [snap, setSnap]    = useState(() => createInitialSimState())
  const [speed, setSpeed]  = useState(5)
  const [rate, setRate]    = useState(1)

  // Init BroadcastChannel
  useEffect(() => {
    channelRef.current = new BroadcastChannel(SIM_CHANNEL)
    return () => { channelRef.current?.close() }
  }, [])

  // RAF loop
  useEffect(() => {
    let lastSnapMs  = 0
    let lastBcastMs = 0

    function loop(realMs) {
      const s = simRef.current
      if (lastRealMsRef.current !== null) {
        const delta = Math.min(realMs - lastRealMsRef.current, 200)  // cap at 200ms to avoid huge jumps
        tick(s, delta)
      }
      lastRealMsRef.current = realMs

      // Snapshot for React
      if (realMs - lastSnapMs > SNAP_INTERVAL) {
        lastSnapMs = realMs
        // Shallow copy for React — only what the UI needs
        setSnap({
          running:    s.running,
          simTimeMs:  s.simTimeMs,
          speedMultiplier: s.speedMultiplier,
          arrivalRatePerHr: s.arrivalRatePerHr,
          aircraft:   s.aircraft.map((a) => ({ ...a, pos: { ...a.pos } })),
          resources:  s.resources.map((r) => ({ ...r, position: { ...r.position } })),
          staff:      s.staff.map((p) => ({ ...p, position: { ...p.position } })),
          events:         s.events.slice(0, 40),
          simFlights:     s.flightSim.simFlights.map((sf) => ({ ...sf })),
          hangarAircraft: s.hangarAircraft.map((ha) => ({ ...ha })),
        })
      }

      // Broadcast to other tabs + flush events to server
      if (realMs - lastBcastMs > BCAST_INTERVAL && channelRef.current) {
        lastBcastMs = realMs
        broadcastSnapshot(channelRef.current, s)
        flushEventsToServer(s)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const toggleRun = useCallback(() => {
    simRef.current.running = !simRef.current.running
    if (simRef.current.running) {
      lastRealMsRef.current = null  // reset delta on resume
    }
    setSnap((prev) => ({ ...prev, running: simRef.current.running }))
  }, [])

  const handleReset = useCallback(() => {
    simRef.current = createInitialSimState()
    simRef.current.speedMultiplier  = speed
    simRef.current.arrivalRatePerHr = rate
    setSnap({ ...simRef.current, simFlights: [], hangarAircraft: simRef.current.hangarAircraft })
    fetch('/api/sim/events', { method: 'DELETE' }).catch(() => {})
    clearSimFlights()
  }, [speed, rate])

  const handleSpeed = useCallback((v) => {
    setSpeed(v)
    simRef.current.speedMultiplier = v
  }, [])

  const handleRate = useCallback((v) => {
    setRate(v)
    simRef.current.arrivalRatePerHr = v
  }, [])

  // Sim clock display
  const simTime    = new Date(snap.simTimeMs).toISOString().slice(11, 19) + 'Z'
  const activeAc   = snap.aircraft.filter((a) => a.state !== 'departed').length
  const onGround   = snap.aircraft.filter((a) => ['parked','being_serviced','ready'].includes(a.state)).length
  const inService  = snap.aircraft.filter((a) => a.state === 'being_serviced').length
  const simFlights = snap.simFlights ?? []
  const airborne   = simFlights.filter((sf) => sf.status === 'airborne').length

  return (
    <div className="space-y-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Ramp Simulation</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time FBO ground operations · Resource conflict detection · Cross-tab broadcast
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sky-400 text-sm">{simTime}</span>
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
            snap.running
              ? 'bg-green-900/40 text-green-300 border-green-400/40'
              : 'bg-slate-700/40 text-slate-400 border-slate-600'
          }`}>
            {snap.running ? '● RUNNING' : '⏸ PAUSED'}
          </span>
        </div>
      </div>

      {/* Controls bar */}
      <div className="rounded border border-slate-700 bg-slate-800/60 p-3 flex flex-wrap gap-5 items-end">
        {/* Play/Pause/Reset */}
        <div className="flex gap-2">
          <button
            onClick={toggleRun}
            className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${
              snap.running
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30'
                : 'bg-green-500/20 text-green-300 border-green-400/40 hover:bg-green-500/30'
            }`}
          >
            {snap.running ? '⏸ Pause' : '▶ Run'}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded text-sm text-slate-400 border border-slate-600 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            ↺ Reset
          </button>
        </div>

        {/* Speed */}
        <div className="space-y-1 min-w-[160px]">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Sim Speed</span>
            <span className="text-sky-400 font-mono font-bold">{speed}×</span>
          </div>
          <input
            type="range" min="1" max="120" step="1" value={speed}
            onChange={(e) => handleSpeed(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>1×</span><span>30×</span><span>60×</span><span>120×</span>
          </div>
        </div>

        {/* Transient arrival rate (background traffic — dead-head returns drive primary FBO ops) */}
        <div className="space-y-1 min-w-[180px]">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Transient Rate</span>
            <span className="text-amber-400 font-mono font-bold">{rate}/hr</span>
          </div>
          <input
            type="range" min="0" max="8" step="0.5" value={rate}
            onChange={(e) => handleRate(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-slate-600">
            <span>0</span><span>2/hr</span><span>4/hr</span><span>8/hr</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 ml-auto text-xs">
          <div className="text-center">
            <div className="text-sky-400 font-bold font-mono text-lg">{activeAc}</div>
            <div className="text-slate-500">On Field</div>
          </div>
          <div className="text-center">
            <div className="text-amber-400 font-bold font-mono text-lg">{inService}</div>
            <div className="text-slate-500">In Svc</div>
          </div>
          <div className="text-center">
            <div className="text-green-400 font-bold font-mono text-lg">{onGround}</div>
            <div className="text-slate-500">On Ramp</div>
          </div>
          <div className="text-center">
            <div className="text-violet-400 font-bold font-mono text-lg">{airborne}</div>
            <div className="text-slate-500">Airborne</div>
          </div>
        </div>
      </div>

      {/* Main layout: map + resources side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map — takes 2/3 on large screens */}
        <div className="lg:col-span-2 rounded border border-slate-700 bg-slate-900 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ramp Map</span>
            <span className="text-xs text-slate-600">North ↑</span>
          </div>
          <RampMap aircraft={snap.aircraft} resources={snap.resources} staff={snap.staff} hangarAircraft={snap.hangarAircraft ?? []} />
        </div>

        {/* Resource panel — 1/3 */}
        <div className="space-y-3">
          <ResourcePanel resources={snap.resources} staff={snap.staff} aircraft={snap.aircraft} hangarAircraft={snap.hangarAircraft ?? []} />
        </div>
      </div>

      {/* Part 135 Charter Flights */}
      <CharterFlightPanel simFlights={simFlights} simTimeMs={snap.simTimeMs} />

      {/* Event log */}
      <EventLog events={snap.events} />
    </div>
  )
}

// ── Ramp Map (SVG) ─────────────────────────────────────────────────────────────

function RampMap({ aircraft, resources, staff, hangarAircraft = [] }) {
  return (
    <svg
      viewBox="0 0 100 70"
      className="w-full"
      style={{ background: '#1a2332', display: 'block' }}
    >
      {/* ── Ground areas ─────────────────────────────── */}
      {/* Grass / infield */}
      <rect x="0" y="0" width="100" height="70" fill="#1c2b1c" />

      {/* Runway 17L/35R */}
      <rect x="2" y="58" width="96" height="7" fill="#374151" rx="0.5" />
      {/* Centerline dashes */}
      {[10,20,30,40,50,60,70,80].map((x) => (
        <rect key={x} x={x} y="61" width="4" height="1" fill="#f8fafc" opacity="0.3" />
      ))}
      {/* Runway numbers */}
      <text x="6"  y="65" fontSize="2" fill="#9ca3af" fontFamily="monospace">17L</text>
      <text x="89" y="63" fontSize="2" fill="#9ca3af" fontFamily="monospace">35R</text>

      {/* Taxiway Alpha (N-S) */}
      <rect x="47" y="38" width="5" height="20" fill="#4b5563" />
      <text x="48" y="36.5" fontSize="1.8" fill="#f59e0b" fontFamily="monospace">α</text>

      {/* Taxiway Bravo (E-W entry to ramp) */}
      <rect x="2" y="38" width="45" height="4" fill="#4b5563" />

      {/* Ramp / Apron */}
      <rect x="2" y="2" width="58" height="36" fill="#374151" rx="0.5" />
      {/* Parking spot outlines */}
      {Object.entries(PARKING).map(([id, pos]) => (
        <g key={id}>
          <rect x={pos.x - 3.5} y={pos.y - 4} width="7" height="8" fill="none" stroke="#475569" strokeWidth="0.3" rx="0.2" />
          <text x={pos.x} y={pos.y + 5.5} fontSize="1.4" fill="#64748b" textAnchor="middle" fontFamily="monospace">{id}</text>
        </g>
      ))}
      <text x="4" y="6" fontSize="2" fill="#64748b" fontFamily="monospace">RAMP</text>

      {/* Hangar */}
      <rect x="63" y="2" width="22" height="20" fill="#1e3a5f" rx="0.5" />
      <rect x="65" y="17" width="8"  height="5" fill="#0f2540" />  {/* door L */}
      <rect x="75" y="17" width="8"  height="5" fill="#0f2540" />  {/* door R */}
      {/* Bay divider */}
      <line x1="74" y1="7" x2="74" y2="17" stroke="#0f2540" strokeWidth="0.4" />
      <text x="74" y="5" fontSize="1.8" fill="#60a5fa" textAnchor="middle" fontFamily="monospace">HANGAR / MX</text>

      {/* Hangar aircraft — rendered inside bays */}
      {hangarAircraft.map((ha) => {
        const pos = HANGAR[ha.slot]
        if (!pos) return null
        const isGrounded = ha.maintenanceEndMs === null
        const col = isGrounded ? '#ef4444' : '#fb923c'   // red = grounded, orange = temp MX
        const textCol = isGrounded ? '#fca5a5' : '#fed7aa'
        return (
          <g key={ha.id} transform={`translate(${pos.x},${pos.y})`}>
            {/* Fuselage */}
            <ellipse cx="0" cy="0" rx="3.2" ry="1.1" fill={col} opacity="0.85" />
            {/* Wings */}
            <ellipse cx="0" cy="0" rx="0.8" ry="3" fill={col} opacity="0.65" />
            {/* Tail fin */}
            <ellipse cx="-2.2" cy="0" rx="0.5" ry="1.6" fill={col} opacity="0.65" />
            {/* Tail number */}
            <text y="4.2" fontSize="1.3" fill={textCol} textAnchor="middle" fontFamily="monospace">
              {ha.tail}
            </text>
            {/* MX badge */}
            <text x="3.5" y="-1.5" fontSize="1.4" fill={col} textAnchor="middle">🔧</text>
          </g>
        )
      })}

      {/* FBO Building */}
      <rect x="63" y="26" width="22" height="11" fill="#1e3a5f" rx="0.5" />
      <rect x="70" y="32" width="4"  height="5" fill="#0f2540" />  {/* door */}
      <text x="74" y="31" fontSize="2" fill="#60a5fa" textAnchor="middle" fontFamily="monospace">FBO</text>

      {/* Fuel station area */}
      <rect x="52" y="6" width="8" height="14" fill="#292524" rx="0.3" />
      <text x="56" y="14.5" fontSize="1.6" fill="#f59e0b" textAnchor="middle" fontFamily="monospace">⛽</text>

      {/* Staff lounge / dispatch */}
      <rect x="63" y="38" width="22" height="7" fill="#1a3040" rx="0.3" />
      <text x="74" y="42.5" fontSize="1.7" fill="#38bdf8" textAnchor="middle" fontFamily="monospace">DISPATCH</text>

      {/* ── Staff (rendered before aircraft so aircraft appears on top) ──── */}
      {staff.map((p) => {
        const col = p.state === 'available' ? '#4ade80' : p.state === 'working' ? '#f97316' : '#fbbf24'
        const initials = p.name.slice(0, 2).toUpperCase()
        return (
          <g key={p.id}>
            <circle cx={p.position.x} cy={p.position.y} r="1.5" fill={col} opacity="0.9" />
            <text x={p.position.x} y={p.position.y + 0.55} fontSize="1.2" fill="#0f172a"
              textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontWeight="bold">
              {initials}
            </text>
          </g>
        )
      })}

      {/* ── Vehicles ───────────────────────────────────── */}
      {resources.map((r) => {
        const col = resourceColor(r.state)
        const icon = r.type === 'fuel_truck' ? '⛽' : r.type === 'gpu' ? '⚡' : '🔧'
        return (
          <g key={r.id}>
            <rect
              x={r.position.x - 2.2} y={r.position.y - 1.5}
              width="4.5" height="3" rx="0.5"
              fill={col} opacity="0.85"
            />
            <text x={r.position.x} y={r.position.y + 0.55} fontSize="1.4" fill="#0f172a"
              textAnchor="middle" dominantBaseline="middle">
              {icon}
            </text>
          </g>
        )
      })}

      {/* ── Aircraft ──────────────────────────────────── */}
      {aircraft.map((ac) => {
        const col = acColor(ac.state)
        const rot = ac.state === 'taxiing_out' ? 180 : 0
        return (
          <g key={ac.id} transform={`translate(${ac.pos.x},${ac.pos.y})`}>
            <g transform={`rotate(${rot})`}>
              {/* Fuselage */}
              <ellipse cx="0" cy="0" rx="3.5" ry="1.2" fill={col} opacity="0.9" />
              {/* Wings */}
              <ellipse cx="0" cy="0" rx="1" ry="3.5" fill={col} opacity="0.7" />
              {/* Tail */}
              <ellipse cx="-2.5" cy="0" rx="0.6" ry="1.8" fill={col} opacity="0.7" />
            </g>
            {/* Tail number label */}
            <text y="4" fontSize="1.4" fill="#e2e8f0" textAnchor="middle" fontFamily="monospace"
              style={{ pointerEvents: 'none' }}>
              {ac.tail}
            </text>
            {/* Fuel type dot */}
            <circle cx="3" cy="-2" r="0.8"
              fill={ac.fuelType === 'jet_a' ? '#fb923c' : '#60a5fa'} opacity="0.9" />
          </g>
        )
      })}

      {/* Legend */}
      <g>
        <rect x="2" y="48" width="35" height="8" fill="#0f172a" opacity="0.7" rx="0.5" />
        <circle cx="4"  cy="51" r="0.9" fill="#38bdf8" />
        <text   x="5.5" y="51.4" fontSize="1.5" fill="#94a3b8" dominantBaseline="middle">Inbound</text>
        <circle cx="13" cy="51" r="0.9" fill="#fbbf24" />
        <text   x="14.5" y="51.4" fontSize="1.5" fill="#94a3b8" dominantBaseline="middle">Servicing</text>
        <circle cx="24" cy="51" r="0.9" fill="#4ade80" />
        <text   x="25.5" y="51.4" fontSize="1.5" fill="#94a3b8" dominantBaseline="middle">Ready</text>
        <circle cx="4"  cy="54" r="0.9" fill="#fb923c" />
        <text   x="5.5" y="54.4" fontSize="1.5" fill="#94a3b8" dominantBaseline="middle">Jet-A</text>
        <circle cx="13" cy="54" r="0.9" fill="#60a5fa" />
        <text   x="14.5" y="54.4" fontSize="1.5" fill="#94a3b8" dominantBaseline="middle">Avgas</text>
      </g>
    </svg>
  )
}

// ── Resource Panel ─────────────────────────────────────────────────────────────

function ResourcePanel({ resources, staff, aircraft = [], hangarAircraft = [] }) {
  return (
    <div className="space-y-3">
      {/* Vehicles */}
      <div className="rounded border border-slate-700 bg-slate-800/60">
        <div className="px-3 py-1.5 border-b border-slate-700">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ground Vehicles</span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {resources.map((r) => {
            const col = resourceColor(r.state)
            const busy = r.state !== 'available'
            return (
              <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                  <span className="text-xs text-slate-300 font-medium">{r.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs" style={{ color: col }}>
                    {r.state.replace(/_/g, ' ')}
                  </span>
                  {busy && r.assignedTo && (
                    <div className="text-xs text-slate-500 font-mono">{r.assignedTo}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Staff */}
      <div className="rounded border border-slate-700 bg-slate-800/60">
        <div className="px-3 py-1.5 border-b border-slate-700">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Line Staff</span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {staff.map((p) => {
            const busy = p.state !== 'available'
            const col  = p.state === 'available' ? '#4ade80' : p.state === 'working' ? '#f97316' : '#fbbf24'
            return (
              <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                  <span className="text-xs text-slate-300 font-medium">{p.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs" style={{ color: col }}>
                    {p.state.replace(/_/g, ' ')}
                  </span>
                  {busy && p.assignedTo && (
                    <div className="text-xs text-slate-500 font-mono">
                      {p.assignedTo}{p.assignedService && ` — ${svcLabel(p.assignedService)}`}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Aircraft on ground */}
      <div className="rounded border border-slate-700 bg-slate-800/60">
        <div className="px-3 py-1.5 border-b border-slate-700">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ramp</span>
        </div>
        <div className="divide-y divide-slate-700/50 max-h-40 overflow-y-auto">
          {aircraft.filter(a => a.state !== 'departed').length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-600">No aircraft on ramp</div>
          )}
          {aircraft
            .filter((a) => a.state !== 'departed')
            .map((a) => {
              const col = acColor(a.state)
              return (
                <div key={a.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                    <span className="font-mono text-xs text-slate-200">{a.tail}</span>
                    <span className={`text-xs ${a.fuelType === 'jet_a' ? 'text-orange-400' : 'text-blue-400'}`}>
                      {a.fuelType === 'jet_a' ? 'Jet-A' : 'Avgas'}
                    </span>
                    {a.turboprop && <span className="text-xs text-amber-400">PROP</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-xs" style={{ color: col }}>{stateLabel(a.state)}</span>
                    {a.serviceActive && (
                      <div className="text-xs text-slate-500">{svcLabel(a.serviceActive)}</div>
                    )}
                    {a.parkingSpot && <div className="text-xs text-slate-600">{a.parkingSpot}</div>}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Hangar / Maintenance */}
      <div className="rounded border border-slate-700 bg-slate-800/60">
        <div className="px-3 py-1.5 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hangar / MX</span>
          <span className="text-xs text-slate-600">{hangarAircraft.length} a/c</span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {hangarAircraft.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-600">Hangar clear</div>
          )}
          {hangarAircraft.map((ha) => {
            const isGrounded = ha.maintenanceEndMs === null
            const col = isGrounded ? '#ef4444' : '#fb923c'
            return (
              <div key={ha.id} className="px-3 py-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: col }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-slate-200">{ha.tail}</span>
                      <span className="text-xs text-slate-600">Bay {ha.slot}</span>
                    </div>
                    {ha.maintenanceNote && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={ha.maintenanceNote}>
                        {ha.maintenanceNote}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs" style={{ color: col }}>
                    {isGrounded ? 'Grounded' : 'In MX'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Charter Flight Panel ───────────────────────────────────────────────────────

const FLIGHT_STATUS_STYLE = {
  scheduled: { dot: '#94a3b8', label: 'Scheduled', text: 'text-slate-400' },
  boarding:  { dot: '#fbbf24', label: 'Boarding',  text: 'text-amber-400' },
  airborne:  { dot: '#a78bfa', label: 'Airborne',  text: 'text-violet-400' },
  arrived:   { dot: '#4ade80', label: 'Block In',  text: 'text-green-400' },
  complete:  { dot: '#64748b', label: 'Complete',  text: 'text-slate-500' },
}

function formatEte(sf, simTimeMs) {
  if (sf.status === 'airborne') {
    const remMs = sf.estimatedArrivalMs - simTimeMs
    if (remMs <= 0) return 'On final'
    const m = Math.round(remMs / 60000)
    return `ETE ${m} min`
  }
  if (sf.status === 'boarding') {
    const depMs = sf.scheduledDepartureMs - simTimeMs
    const m = Math.max(0, Math.round(depMs / 60000))
    return `Departs in ${m} min`
  }
  if (sf.status === 'scheduled') {
    const depMs = sf.scheduledDepartureMs - simTimeMs
    const m = Math.max(0, Math.round(depMs / 60000))
    return `Dep in ${m} min`
  }
  if (sf.status === 'arrived') return 'Arrived'
  return ''
}

function CharterFlightPanel({ simFlights, simTimeMs }) {
  const visible = (simFlights ?? []).filter((sf) => sf.status !== 'complete')

  return (
    <div className="rounded border border-slate-700 bg-slate-900">
      <div className="px-3 py-1.5 border-b border-slate-700 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Part 135 Charter Ops
          </span>
          <span className="ml-2 text-xs text-slate-600">KBDU base · Rocky Mountain destinations</span>
        </div>
        <span className="text-xs text-slate-600">{visible.length} flight{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {visible.length === 0 && (
        <div className="px-3 py-3 text-xs text-slate-600">
          No active charter flights — sim will generate them as it runs
        </div>
      )}

      {visible.length > 0 && (
        <div className="divide-y divide-slate-800">
          {visible.map((sf) => {
            const style = FLIGHT_STATUS_STYLE[sf.status] ?? FLIGHT_STATUS_STYLE.scheduled
            return (
              <div key={sf.id} className="px-3 py-2 flex items-center gap-3 text-xs hover:bg-slate-800/30">
                {/* Status dot */}
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: style.dot }} />

                {/* Tail + route */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="font-mono text-slate-200 font-medium">{sf.tailNumber}</span>
                  {sf.type === 'deadhead'
                    ? <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600 font-mono">DH</span>
                    : <span className="text-[10px] px-1 py-0.5 rounded bg-violet-900/40 text-violet-400 border border-violet-700/40 font-mono">135</span>
                  }
                  <span className="text-slate-500 mx-0.5">·</span>
                  <span className="text-slate-400">{sf.departure}→{sf.arrival}</span>
                  <span className="text-slate-600 ml-1 hidden sm:inline">({sf.routeLabel})</span>
                </div>

                {/* PIC */}
                <div className="hidden md:block text-slate-500 w-28 truncate">
                  {sf.picName?.split(' ').pop() ?? ''}
                  {sf.sicId && <span className="text-slate-700"> / {sf.sicName?.split(' ').pop()}</span>}
                </div>

                {/* Pax */}
                <div className="text-slate-500 w-14 text-right">
                  {sf.type === 'deadhead'
                    ? <span className="text-slate-600">crew</span>
                    : `${sf.passengers} pax`
                  }
                </div>

                {/* ETE */}
                <div className="text-slate-400 w-24 text-right font-mono">
                  {formatEte(sf, simTimeMs)}
                </div>

                {/* Status pill */}
                <span className={`px-2 py-0.5 rounded text-xs font-medium border w-20 text-center flex-shrink-0 ${
                  sf.status === 'airborne'  ? 'bg-violet-900/40 border-violet-500/30 text-violet-300' :
                  sf.status === 'boarding'  ? 'bg-amber-900/40  border-amber-500/30  text-amber-300'  :
                  sf.status === 'arrived'   ? 'bg-green-900/40  border-green-500/30  text-green-300'  :
                                              'bg-slate-800/60  border-slate-600     text-slate-400'
                }`}>
                  {style.label}
                </span>

                {/* Maintenance flag */}
                {sf.requiresMaintenance && (
                  <span className="text-red-400 text-xs font-mono" title={sf.maintenanceSquawk}>
                    MX
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Event Log ─────────────────────────────────────────────────────────────────

function EventLog({ events }) {
  const sevColor = {
    arrival:           'text-sky-400',
    taxi:              'text-slate-400',
    parked:            'text-slate-400',
    dispatch:          'text-amber-400',
    svc_done:          'text-green-400',
    ready:             'text-green-300',
    taxi_out:          'text-orange-400',
    departure:         'text-orange-300',
    conflict:          'text-red-400',
    flight_scheduled:  'text-violet-400',
    flight_boarding:   'text-amber-400',
    flight_departed:   'text-violet-300',
    flight_arrived:    'text-green-300',
    maintenance:       'text-red-400',
  }
  return (
    <div className="rounded border border-slate-700 bg-slate-900">
      <div className="px-3 py-1.5 border-b border-slate-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Log</span>
        <span className="text-xs text-slate-600">{events.length} events</span>
      </div>
      <div className="h-44 overflow-y-auto font-mono text-xs divide-y divide-slate-800">
        {events.length === 0 && (
          <div className="px-3 py-3 text-slate-600">Press Run to start simulation...</div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="px-3 py-1 flex gap-3 hover:bg-slate-800/40">
            <span className="text-slate-600 flex-shrink-0 w-14">{ev.time}</span>
            <span className={`flex-shrink-0 w-16 ${sevColor[ev.type] ?? 'text-slate-400'}`}>
              {ev.type.replace(/_/g, ' ')}
            </span>
            <span className="text-slate-300">{ev.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
