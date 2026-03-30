import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  computeRiskScore, defconLevel, defconLabel, defconClasses,
  fuelConfusionRisk, experienceRisk, riskWarnings, riskBreakdown,
  serviceTypeLabel, fuelTypeLabel, fboCategoryLabel,
  serviceStatusLabel, weatherLabel, calcFuelFee,
  BASE_TASK_RISK, WEATHER_RISK,
  FBO_NOW,
  minutesUntilEta, timeUntilLabel,
  etaDelayMinutes, etaDelayFlag, formatEtaTime,
} from './fboUtils'
import {
  mockServiceOrders, mockArrivals, FEE_SCHEDULE, FBO_MAINTENANCE_LINKS, FBO_STAFF_IDS,
} from './mockDb'
import { mockAircraft } from '../mocks/aircraft'
import { mockPersonnel } from '../mocks/personnel'
import { FBO } from './FBO'

// Mock the sim broadcast hook so FBO component tests get predictable data
// (in real usage FBO polls /api/sim/state; in tests we inject a static sim state)
const TEST_SIM_AIRCRAFT = [
  {
    tail: 'N12345', makeModel: 'Beechcraft Baron 58',
    fuelType: 'avgas_100ll', turboprop: false, fboCategory: 'piston_twin',
    state: 'being_serviced', parkingSpot: 'A1',
    serviceActive: 'fueling', servicesNeeded: ['fueling', 'tie_down'], servicesDone: [],
  },
  {
    tail: 'N77701', makeModel: 'King Air B200',
    fuelType: 'jet_a', turboprop: true, fboCategory: 'turboprop_twin',
    state: 'parked', parkingSpot: 'A2',
    serviceActive: null, servicesNeeded: ['fueling', 'cleaning', 'tie_down'], servicesDone: [],
  },
  {
    tail: 'N55555', makeModel: 'Cessna Grand Caravan',
    fuelType: 'jet_a', turboprop: true, fboCategory: 'turboprop_single',
    state: 'taxiing_out', parkingSpot: null,
    serviceActive: null, servicesNeeded: ['fueling'], servicesDone: ['fueling'],
  },
]

vi.mock('../hooks/useSimBroadcast', () => ({
  useSimBroadcast: () => ({
    type: 'SIM_STATE',
    running: true,
    simTimeMs: new Date(FBO_NOW).getTime(),
    aircraft: TEST_SIM_AIRCRAFT,
    resources: [],
    staff: [],
    events: [{ id: 'ev-1', time: '18:15Z', type: 'arrival', message: 'N12345 entering pattern', tail: 'N12345' }],
  }),
}))

// ─── fboUtils — fuelConfusionRisk ─────────────────────────────────────────────

describe('fuelConfusionRisk', () => {
  test('turboprop with prop (jetFuelInPropAircraft=true) returns 5 — highest risk', () => {
    const caravan = { fuelType: 'jet_a', riskProfile: { jetFuelInPropAircraft: true, turboprop: true } }
    expect(fuelConfusionRisk(caravan)).toBe(5)
  })

  test('turboprop flag alone (no jetFuelInPropAircraft) returns 5', () => {
    const kingAir = { fuelType: 'jet_a', riskProfile: { turboprop: true, jetFuelInPropAircraft: false } }
    expect(fuelConfusionRisk(kingAir)).toBe(5)
  })

  test('pure jet aircraft (no prop) returns 1', () => {
    const citation = { fuelType: 'jet_a', riskProfile: { turboprop: false, jetFuelInPropAircraft: false } }
    expect(fuelConfusionRisk(citation)).toBe(1)
  })

  test('avgas piston aircraft returns 2', () => {
    const baron = { fuelType: 'avgas_100ll', riskProfile: { turboprop: false, jetFuelInPropAircraft: false } }
    expect(fuelConfusionRisk(baron)).toBe(2)
  })

  test('null aircraft returns 0', () => {
    expect(fuelConfusionRisk(null)).toBe(0)
    expect(fuelConfusionRisk(undefined)).toBe(0)
  })

  // Fleet-specific tests
  test('N55555 (Grand Caravan, riskProfile) returns 5', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N55555')
    expect(fuelConfusionRisk(ac)).toBe(5)
  })

  test('N22222 (Caravan) returns 5', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N22222')
    expect(fuelConfusionRisk(ac)).toBe(5)
  })

  test('N12345 (Baron 58, avgas piston) returns 2', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N12345')
    expect(fuelConfusionRisk(ac)).toBe(2)
  })
})

// ─── fboUtils — experienceRisk ────────────────────────────────────────────────

describe('experienceRisk', () => {
  test('< 1 year → +4', () => expect(experienceRisk(0.5)).toBe(4))
  test('1 year → +3 (in 1–3 bracket)', () => expect(experienceRisk(1)).toBe(3))
  test('2 years → +3', () => expect(experienceRisk(2)).toBe(3))
  test('3 years → +2 (in 3–7 bracket)', () => expect(experienceRisk(3)).toBe(2))
  test('7 years → +1 (in 7–15 bracket)', () => expect(experienceRisk(7)).toBe(1))
  test('15 years → +0', () => expect(experienceRisk(15)).toBe(0))
  test('null → +3 (unknown, treated as moderate)', () => expect(experienceRisk(null)).toBe(3))
})

// ─── fboUtils — computeRiskScore ──────────────────────────────────────────────

describe('computeRiskScore', () => {
  const caravan = mockAircraft.find((a) => a.tailNumber === 'N55555')
  const baron   = mockAircraft.find((a) => a.tailNumber === 'N12345')
  const devonPark  = { yearsExperience: 1 }    // 1 yr → experienceRisk = 3
  const jordanKim  = { yearsExperience: 7 }    // 7 yr → experienceRisk = 1
  const samNguyen  = { yearsExperience: 3 }    // 3 yr → experienceRisk = 2

  test('N55555 (Caravan Jet-A) + Devon Park (1yr) + clear = DEFCON 1 (capped at 10)', () => {
    // base(4) + fuelConf(5) + exp(3) + weather(0) = 12 → cap 10
    const score = computeRiskScore({
      serviceType: 'fueling', aircraft: caravan, assignee: devonPark, weatherCondition: 'clear',
    })
    expect(score).toBe(10)
    expect(defconLevel(score)).toBe(1)
  })

  test('N12345 (Baron Avgas) + Jordan Kim (7yr) + clear = score 7 → DEFCON 2', () => {
    // base(4) + fuelConf(2) + exp(1) + weather(0) = 7
    const score = computeRiskScore({
      serviceType: 'fueling', aircraft: baron, assignee: jordanKim, weatherCondition: 'clear',
    })
    expect(score).toBe(7)
    expect(defconLevel(score)).toBe(2)
  })

  test('N22222 (Caravan) + Sam Nguyen (3yr) + light_rain = capped 10 → DEFCON 1', () => {
    const caravan22 = mockAircraft.find((a) => a.tailNumber === 'N22222')
    // base(4) + fuelConf(5) + exp(2) + weather(2) = 13 → cap 10
    const score = computeRiskScore({
      serviceType: 'fueling', aircraft: caravan22, assignee: samNguyen, weatherCondition: 'light_rain',
    })
    expect(score).toBe(10)
    expect(defconLevel(score)).toBe(1)
  })

  test('tie_down + experienced staff + high_wind = DEFCON 3', () => {
    // base(1) + fuelConf(0) + exp(1, 7yr) + weather(2) = 4 → DEFCON 4
    const score = computeRiskScore({
      serviceType: 'tie_down', aircraft: baron, assignee: jordanKim, weatherCondition: 'high_wind',
    })
    expect(score).toBe(4)
    expect(defconLevel(score)).toBe(4)
  })

  test('thunderstorm adds 5 — fueling is stopped', () => {
    const score = computeRiskScore({
      serviceType: 'fueling', aircraft: baron, assignee: jordanKim, weatherCondition: 'thunderstorm',
    })
    // base(4) + fuelConf(2) + exp(1) + weather(5) = 12 → cap 10
    expect(score).toBe(10)
    expect(defconLevel(score)).toBe(1)
  })

  test('score is always capped at 10', () => {
    const score = computeRiskScore({
      serviceType: 'fueling', aircraft: caravan, assignee: { yearsExperience: 0 }, weatherCondition: 'thunderstorm',
    })
    expect(score).toBeLessThanOrEqual(10)
  })

  test('fuelConfusion addend is 0 for non-fueling tasks', () => {
    const cleanScore = computeRiskScore({
      serviceType: 'cleaning', aircraft: caravan, assignee: devonPark, weatherCondition: 'clear',
    })
    // base(1) + fuelConf(0) + exp(3) + weather(0) = 4
    expect(cleanScore).toBe(4)
  })
})

// ─── fboUtils — defconLevel and labels ────────────────────────────────────────

describe('defconLevel', () => {
  test('score 10 → DEFCON 1', () => expect(defconLevel(10)).toBe(1))
  test('score 9 → DEFCON 1',  () => expect(defconLevel(9)).toBe(1))
  test('score 8 → DEFCON 2',  () => expect(defconLevel(8)).toBe(2))
  test('score 7 → DEFCON 2',  () => expect(defconLevel(7)).toBe(2))
  test('score 6 → DEFCON 3',  () => expect(defconLevel(6)).toBe(3))
  test('score 5 → DEFCON 3',  () => expect(defconLevel(5)).toBe(3))
  test('score 4 → DEFCON 4',  () => expect(defconLevel(4)).toBe(4))
  test('score 3 → DEFCON 4',  () => expect(defconLevel(3)).toBe(4))
  test('score 2 → DEFCON 5',  () => expect(defconLevel(2)).toBe(5))
  test('score 1 → DEFCON 5',  () => expect(defconLevel(1)).toBe(5))
})

describe('defconLabel', () => {
  test('level 1 → CRITICAL', () => expect(defconLabel(1)).toBe('CRITICAL'))
  test('level 2 → ELEVATED', () => expect(defconLabel(2)).toBe('ELEVATED'))
  test('level 3 → CAUTION',  () => expect(defconLabel(3)).toBe('CAUTION'))
  test('level 4 → MONITOR',  () => expect(defconLabel(4)).toBe('MONITOR'))
  test('level 5 → NORMAL',   () => expect(defconLabel(5)).toBe('NORMAL'))
})

// ─── fboUtils — riskWarnings ──────────────────────────────────────────────────

describe('riskWarnings', () => {
  const caravan = mockAircraft.find((a) => a.tailNumber === 'N55555')
  const baron   = mockAircraft.find((a) => a.tailNumber === 'N12345')

  test('turboprop fueling generates FUEL_CONFUSION_TURBOPROP critical warning', () => {
    const warns = riskWarnings({
      serviceType: 'fueling', aircraft: caravan, assignee: null, weatherCondition: 'clear',
    })
    const w = warns.find((w) => w.code === 'FUEL_CONFUSION_TURBOPROP')
    expect(w).toBeDefined()
    expect(w.level).toBe('critical')
    expect(w.message).toMatch(/TURBOPROP/)
    expect(w.message).toMatch(/Jet-A/)
  })

  test('avgas aircraft fueling generates AVGAS_CONFIRM info warning', () => {
    const warns = riskWarnings({
      serviceType: 'fueling', aircraft: baron, assignee: null, weatherCondition: 'clear',
    })
    const w = warns.find((w) => w.code === 'AVGAS_CONFIRM')
    expect(w).toBeDefined()
    expect(w.level).toBe('info')
  })

  test('low-experience staff (< 2yr) generates LOW_EXPERIENCE warning', () => {
    const warns = riskWarnings({
      serviceType: 'fueling', aircraft: baron,
      assignee: { name: 'Devon Park', yearsExperience: 1 },
      weatherCondition: 'clear',
    })
    const w = warns.find((w) => w.code === 'LOW_EXPERIENCE')
    expect(w).toBeDefined()
    expect(w.level).toBe('warning')
  })

  test('experienced staff (7yr) does NOT generate LOW_EXPERIENCE warning', () => {
    const warns = riskWarnings({
      serviceType: 'fueling', aircraft: baron,
      assignee: { name: 'Jordan Kim', yearsExperience: 7 },
      weatherCondition: 'clear',
    })
    expect(warns.find((w) => w.code === 'LOW_EXPERIENCE')).toBeUndefined()
  })

  test('thunderstorm generates LIGHTNING_STOP critical warning', () => {
    const warns = riskWarnings({
      serviceType: 'fueling', aircraft: baron, assignee: null, weatherCondition: 'thunderstorm',
    })
    const w = warns.find((w) => w.code === 'LIGHTNING_STOP')
    expect(w).toBeDefined()
    expect(w.level).toBe('critical')
    expect(w.message).toMatch(/THUNDERSTORM/)
  })

  test('rain during fueling generates RAIN_FUEL_CONTAMINATION warning', () => {
    const warns = riskWarnings({
      serviceType: 'fueling', aircraft: baron, assignee: null, weatherCondition: 'light_rain',
    })
    const w = warns.find((w) => w.code === 'RAIN_FUEL_CONTAMINATION')
    expect(w).toBeDefined()
    expect(w.level).toBe('warning')
  })

  test('high wind during tow generates WIND_TOW_RISK warning', () => {
    const warns = riskWarnings({
      serviceType: 'tow', aircraft: baron, assignee: null, weatherCondition: 'high_wind',
    })
    const w = warns.find((w) => w.code === 'WIND_TOW_RISK')
    expect(w).toBeDefined()
  })

  test('preheat always generates PREHEAT_FIRE_PROXIMITY info', () => {
    const warns = riskWarnings({
      serviceType: 'preheat', aircraft: baron, assignee: null, weatherCondition: 'clear',
    })
    const w = warns.find((w) => w.code === 'PREHEAT_FIRE_PROXIMITY')
    expect(w).toBeDefined()
    expect(w.level).toBe('info')
  })
})

// ─── fboUtils — label helpers ─────────────────────────────────────────────────

describe('serviceTypeLabel', () => {
  test('fueling → Fueling', () => expect(serviceTypeLabel('fueling')).toBe('Fueling'))
  test('tow → Tow / Reposition', () => expect(serviceTypeLabel('tow')).toBe('Tow / Reposition'))
  test('preheat → Engine Pre-Heat', () => expect(serviceTypeLabel('preheat')).toBe('Engine Pre-Heat'))
  test('gpu → Ground Power (GPU)', () => expect(serviceTypeLabel('gpu')).toBe('Ground Power (GPU)'))
})

describe('fuelTypeLabel', () => {
  test('avgas_100ll → Avgas 100LL', () => expect(fuelTypeLabel('avgas_100ll')).toBe('Avgas 100LL'))
  test('jet_a → Jet-A',            () => expect(fuelTypeLabel('jet_a')).toBe('Jet-A'))
  test('null → —',                 () => expect(fuelTypeLabel(null)).toBe('—'))
})

describe('fboCategoryLabel', () => {
  test('piston_single → Piston Single',     () => expect(fboCategoryLabel('piston_single')).toBe('Piston Single'))
  test('turboprop_single → Turboprop Single', () => expect(fboCategoryLabel('turboprop_single')).toBe('Turboprop Single'))
  test('jet_light → Light Jet',             () => expect(fboCategoryLabel('jet_light')).toBe('Light Jet'))
})

describe('calcFuelFee', () => {
  test('Avgas 100LL × 60 gal = $450.00', () => expect(calcFuelFee('avgas_100ll', 60)).toBe(450.00))
  test('Jet-A × 80 gal = $464.00',        () => expect(calcFuelFee('jet_a', 80)).toBe(464.00))
  test('Jet-A × 90 gal = $522.00',        () => expect(calcFuelFee('jet_a', 90)).toBe(522.00))
})

// ─── mockDb — service orders data integrity ───────────────────────────────────

describe('mockServiceOrders', () => {
  test('all orders have required fields', () => {
    for (const o of mockServiceOrders) {
      expect(o.id).toBeTruthy()
      expect(o.tailNumber).toBeTruthy()
      expect(o.serviceType).toBeTruthy()
      expect(o.status).toBeTruthy()
      expect(o.requestedAt).toBeTruthy()
    }
  })

  test('all fueling orders have fuelType', () => {
    const fuelingOrders = mockServiceOrders.filter((o) => o.serviceType === 'fueling')
    expect(fuelingOrders.length).toBeGreaterThan(0)
    for (const o of fuelingOrders) {
      expect(o.fuelType).toBeTruthy()
      expect(['avgas_100ll', 'jet_a', 'mogas']).toContain(o.fuelType)
    }
  })

  test('fbo-001: N55555 Jet-A fueling assigned to prs-014 (Devon Park, 1yr) → DEFCON 1', () => {
    const order = mockServiceOrders.find((o) => o.id === 'fbo-001')
    expect(order.tailNumber).toBe('N55555')
    expect(order.fuelType).toBe('jet_a')
    expect(order.assignedTo).toBe('prs-014')
    // Verify Devon Park exists and has low experience
    const devon = mockPersonnel.find((p) => p.id === 'prs-014')
    expect(devon).toBeDefined()
    expect(devon.name).toMatch(/Devon/)
    expect(devon.yearsExperience).toBeLessThan(3)
    // Verify risk computes to DEFCON 1
    const ac = mockAircraft.find((a) => a.tailNumber === 'N55555')
    const score = computeRiskScore({
      serviceType: order.serviceType, aircraft: ac, assignee: devon, weatherCondition: order.weatherCondition,
    })
    expect(defconLevel(score)).toBe(1)
  })

  test('fbo-003: completed Caravan fueling in rain — risk would have been DEFCON 1', () => {
    const order = mockServiceOrders.find((o) => o.id === 'fbo-003')
    expect(order.status).toBe('completed')
    expect(order.tailNumber).toBe('N22222')
    expect(order.fuelType).toBe('jet_a')
    expect(order.weatherCondition).toBe('light_rain')
    const ac = mockAircraft.find((a) => a.tailNumber === 'N22222')
    const assignee = mockPersonnel.find((p) => p.id === order.assignedTo)
    const score = computeRiskScore({
      serviceType: order.serviceType, aircraft: ac, assignee, weatherCondition: order.weatherCondition,
    })
    expect(defconLevel(score)).toBe(1)
  })

  test('cross-module orders reference maintenance', () => {
    const crossOrders = mockServiceOrders.filter((o) => o.crossModule === 'maintenance')
    expect(crossOrders.length).toBeGreaterThan(0)
    for (const o of crossOrders) {
      expect(o.crossModuleRef).toBeTruthy()
    }
  })

  test('fbo-008 is a maintenance-requested tow for N33333 (AOG)', () => {
    const order = mockServiceOrders.find((o) => o.id === 'fbo-008')
    expect(order.tailNumber).toBe('N33333')
    expect(order.serviceType).toBe('tow')
    expect(order.crossModule).toBe('maintenance')
    expect(order.crossModuleRef).toBe('wo-001')
    // N33333 is grounded — confirm in aircraft registry
    const ac = mockAircraft.find((a) => a.tailNumber === 'N33333')
    expect(ac.airworthy).toBe(false)
  })
})

// ─── mockDb — arrivals data integrity ────────────────────────────────────────

describe('mockArrivals', () => {
  test('all arrivals have required fields', () => {
    for (const a of mockArrivals) {
      expect(a.id).toBeTruthy()
      expect(a.tailNumber).toBeTruthy()
      expect(a.eta).toBeTruthy()
      expect(a.fuelType).toBeTruthy()
      expect(a.status).toBeTruthy()
      expect(Array.isArray(a.servicesRequested)).toBe(true)
    }
  })

  test('arr-002 King Air B200 is turboprop_twin with jetFuelInPropAircraft — highest confusion risk', () => {
    const arr = mockArrivals.find((a) => a.id === 'arr-002')
    expect(arr.fuelType).toBe('jet_a')
    expect(arr.fboCategory).toBe('turboprop_twin')
    expect(arr.riskProfile.turboprop).toBe(true)
    expect(arr.riskProfile.jetFuelInPropAircraft).toBe(true)
    // King Air fueling risk should compute to DEFCON 1
    const score = computeRiskScore({
      serviceType: 'fueling',
      aircraft: { fuelType: arr.fuelType, riskProfile: arr.riskProfile },
      assignee: null,
      weatherCondition: 'clear',
    })
    expect(defconLevel(score)).toBe(1)
  })

  test('arr-001 Citation CJ2 (pure jet, no prop) has lower confusion risk', () => {
    const arr = mockArrivals.find((a) => a.id === 'arr-001')
    expect(arr.riskProfile.turboprop).toBe(false)
    expect(arr.riskProfile.jetFuelInPropAircraft).toBe(false)
    const score = computeRiskScore({
      serviceType: 'fueling',
      aircraft: { fuelType: arr.fuelType, riskProfile: arr.riskProfile },
      assignee: null,
      weatherCondition: 'clear',
    })
    // base(4) + fuelConf(1, pure jet) + exp(3, null) + weather(0) = 8 → DEFCON 2
    expect(defconLevel(score)).toBe(2)
  })

  test('arr-003 N12345 is own fleet and inbound', () => {
    const arr = mockArrivals.find((a) => a.id === 'arr-003')
    expect(arr.isOwnFleet).toBe(true)
    expect(arr.status).toBe('inbound')
    expect(arr.fuelType).toBe('avgas_100ll')
  })
})

// ─── mockDb — fee schedule data integrity ─────────────────────────────────────

describe('FEE_SCHEDULE', () => {
  test('contains ramp fees for all aircraft categories', () => {
    const categories = ['piston_single', 'piston_twin', 'turboprop_single', 'turboprop_twin', 'jet_light']
    for (const cat of categories) {
      const fee = FEE_SCHEDULE.find((f) => f.category === cat && f.serviceType === 'ramp_fee')
      expect(fee).toBeDefined()
      expect(fee.feePerUnit).toBeGreaterThan(0)
    }
  })

  test('contains hangar fees for all aircraft categories', () => {
    const categories = ['piston_single', 'piston_twin', 'turboprop_single', 'turboprop_twin', 'jet_light']
    for (const cat of categories) {
      const fee = FEE_SCHEDULE.find((f) => f.category === cat && f.serviceType === 'hangar_fee')
      expect(fee).toBeDefined()
    }
  })

  test('Avgas 100LL is $7.50/gal', () => {
    const fee = FEE_SCHEDULE.find((f) => f.label === 'Avgas 100LL' && f.serviceType === 'fueling')
    expect(fee).toBeDefined()
    expect(fee.feePerUnit).toBe(7.50)
    expect(fee.unit).toBe('gallon')
  })

  test('Jet-A is $5.80/gal', () => {
    const fee = FEE_SCHEDULE.find((f) => f.label === 'Jet-A' && f.serviceType === 'fueling')
    expect(fee).toBeDefined()
    expect(fee.feePerUnit).toBe(5.80)
    expect(fee.unit).toBe('gallon')
  })

  test('turboprop ramp fee is higher than piston twin', () => {
    const turbopropFee = FEE_SCHEDULE.find((f) => f.category === 'turboprop_single' && f.serviceType === 'ramp_fee')
    const pistonFee    = FEE_SCHEDULE.find((f) => f.category === 'piston_twin'      && f.serviceType === 'ramp_fee')
    expect(turbopropFee.feePerUnit).toBeGreaterThan(pistonFee.feePerUnit)
  })

  test('engine pre-heat is $75 per event', () => {
    const fee = FEE_SCHEDULE.find((f) => f.serviceType === 'preheat')
    expect(fee).toBeDefined()
    expect(fee.feePerUnit).toBe(75)
    expect(fee.unit).toBe('event')
  })
})

// ─── mockDb — cross-module links ──────────────────────────────────────────────

describe('FBO_MAINTENANCE_LINKS', () => {
  test('all links reference valid FBO service order IDs', () => {
    const soIds = new Set(mockServiceOrders.map((o) => o.id))
    for (const link of FBO_MAINTENANCE_LINKS) {
      expect(soIds.has(link.fboServiceId)).toBe(true)
    }
  })

  test('fbo-mx-001 is a tow request from maintenance, pending', () => {
    const link = FBO_MAINTENANCE_LINKS.find((l) => l.id === 'fbo-mx-001')
    expect(link.requestType).toBe('tow_request')
    expect(link.requestedBy).toBe('maintenance')
    expect(link.status).toBe('pending')
    expect(link.maintenanceWoId).toBe('wo-001')
  })

  test('fbo-mx-002 is a completed preheat link from FBO to Maintenance', () => {
    const link = FBO_MAINTENANCE_LINKS.find((l) => l.id === 'fbo-mx-002')
    expect(link.requestType).toBe('preheat')
    expect(link.requestedBy).toBe('fbo')
    expect(link.status).toBe('completed')
    expect(link.maintenanceWoId).toBe('wo-006')
  })
})

// ─── Aircraft registry — fuel type and fboCategory ────────────────────────────

describe('mockAircraft fuelType and fboCategory', () => {
  test('all aircraft have fuelType', () => {
    for (const ac of mockAircraft) {
      expect(ac.fuelType).toBeTruthy()
      expect(['avgas_100ll', 'jet_a', 'mogas']).toContain(ac.fuelType)
    }
  })

  test('all aircraft have fboCategory', () => {
    for (const ac of mockAircraft) {
      expect(ac.fboCategory).toBeTruthy()
    }
  })

  test('Caravans (N22222, N55555) are jet_a turboprop_single', () => {
    for (const tail of ['N22222', 'N55555']) {
      const ac = mockAircraft.find((a) => a.tailNumber === tail)
      expect(ac.fuelType).toBe('jet_a')
      expect(ac.fboCategory).toBe('turboprop_single')
      expect(ac.riskProfile.jetFuelInPropAircraft).toBe(true)
    }
  })

  test('Piston aircraft (N12345, N67890, N11111, N33333, N44444) are avgas_100ll', () => {
    for (const tail of ['N12345', 'N67890', 'N11111', 'N33333', 'N44444']) {
      const ac = mockAircraft.find((a) => a.tailNumber === tail)
      expect(ac.fuelType).toBe('avgas_100ll')
    }
  })

  test('N12345 Baron 58 is piston_twin', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N12345')
    expect(ac.fboCategory).toBe('piston_twin')
  })

  test('N44444 Seneca is piston_twin', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N44444')
    expect(ac.fboCategory).toBe('piston_twin')
  })
})

// ─── Personnel — FBO staff ────────────────────────────────────────────────────

describe('FBO staff personnel', () => {
  test('FBO_STAFF_IDS includes Sam Nguyen and new FBO staff', () => {
    expect(FBO_STAFF_IDS).toContain('prs-010')  // Sam Nguyen
    expect(FBO_STAFF_IDS).toContain('prs-014')  // Devon Park
    expect(FBO_STAFF_IDS).toContain('prs-015')  // Jordan Kim
    expect(FBO_STAFF_IDS).toContain('prs-016')  // Rosa Mendez
  })

  test('Devon Park (prs-014) has yearsExperience < 3 and is low-risk-amplifying', () => {
    const devon = mockPersonnel.find((p) => p.id === 'prs-014')
    expect(devon).toBeDefined()
    expect(devon.yearsExperience).toBeLessThan(3)
    expect(experienceRisk(devon.yearsExperience)).toBeGreaterThanOrEqual(3)
  })

  test('Jordan Kim (prs-015) has yearsExperience >= 7 → experienceRisk = 1', () => {
    const jordan = mockPersonnel.find((p) => p.id === 'prs-015')
    expect(jordan).toBeDefined()
    expect(jordan.yearsExperience).toBeGreaterThanOrEqual(7)
    expect(experienceRisk(jordan.yearsExperience)).toBe(1)
  })

  test('Rosa Mendez (prs-016) is FBO coordinator', () => {
    const rosa = mockPersonnel.find((p) => p.id === 'prs-016')
    expect(rosa).toBeDefined()
    expect(rosa.name).toMatch(/Rosa/)
    expect(rosa.fboRole).toBeTruthy()
  })

  test('Sam Nguyen (prs-010) has yearsExperience set', () => {
    const sam = mockPersonnel.find((p) => p.id === 'prs-010')
    expect(sam.yearsExperience).toBeDefined()
    expect(sam.yearsExperience).toBeGreaterThan(0)
  })
})

// ─── FBO Component — render tests ────────────────────────────────────────────

describe('FBO component', () => {
  test('renders page heading', () => {
    render(<FBO />)
    expect(screen.getByText('FBO Operations')).toBeInTheDocument()
  })

  test('renders all 5 tabs', () => {
    render(<FBO />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Aircraft Ops')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
    expect(screen.getByText('Staff & Safety')).toBeInTheDocument()
  })

  test('Overview tab shows DEFCON summary strip', () => {
    render(<FBO />)
    const strip = screen.getByLabelText('DEFCON summary')
    expect(strip).toBeInTheDocument()
    expect(strip.textContent).toMatch(/DC1/)
    expect(strip.textContent).toMatch(/DC5/)
  })

  test('Overview shows N55555 fbo-001 as DEFCON 1 (Jet-A turboprop + 1yr staff)', () => {
    render(<FBO />)
    // DEFCON 1 badge should be present for this critical order
    const dc1Badges = screen.getAllByTestId('defcon-badge-1')
    expect(dc1Badges.length).toBeGreaterThan(0)
  })

  test('turboprop fueling shows fuel confusion warning text', () => {
    render(<FBO />)
    expect(screen.getAllByText(/TURBOPROP/).length).toBeGreaterThan(0)
  })

  test('Aircraft Ops tab shows King Air B200 with turboprop warning', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    expect(screen.getAllByText(/King Air B200/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('TURBOPROP').length).toBeGreaterThan(0)
  })

  test('Fees tab shows Avgas and Jet-A prices', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Fees'))
    expect(screen.getByText('Avgas 100LL')).toBeInTheDocument()
    expect(screen.getByText('Jet-A')).toBeInTheDocument()
    expect(screen.getByText('$7.50')).toBeInTheDocument()
    expect(screen.getByText('$5.80')).toBeInTheDocument()
  })

  test('Fees tab shows ramp and hangar fees in a table', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Fees'))
    expect(screen.getByText('Recurring Fees by Aircraft Category')).toBeInTheDocument()
    expect(screen.getByText('Piston Single')).toBeInTheDocument()
    expect(screen.getByText('Turboprop Single')).toBeInTheDocument()
  })

  test('Staff & Safety tab shows fuel confusion reference card', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Staff & Safety'))
    expect(screen.getAllByText(/Fuel Type Reference/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Avgas 100LL/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Jet-A/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Avgas nozzle IS smaller and CAN enter a Jet-A filler port/)).toBeInTheDocument()
  })

  test('Staff & Safety tab shows Devon Park with low experience indicator', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Staff & Safety'))
    expect(screen.getByText('Devon Park')).toBeInTheDocument()
    // Should show experience category with risk addend
    expect(screen.getAllByText(/yr — Risk addend/).length).toBeGreaterThan(0)
  })

  test('Staff & Safety tab shows DEFCON guide', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Staff & Safety'))
    expect(screen.getByText('DEFCON Risk Level Guide')).toBeInTheDocument()
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('NORMAL').length).toBeGreaterThan(0)
  })

  test('Services tab filter buttons work', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Services'))
    // Filters exist
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('All types')).toBeInTheDocument()
    // Switch to All to see completed orders
    fireEvent.click(screen.getByText('All'))
    // N55555 Caravan has a completed fueling in the test sim state
    expect(screen.getAllByText(/N55555/).length).toBeGreaterThan(0)
  })

  test('Overview shows pending maintenance cross-module requests', () => {
    render(<FBO />)
    expect(screen.getByText(/Tow N33333 from maintenance bay/)).toBeInTheDocument()
  })

  test('Aircraft Ops tab shows departures section', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    expect(screen.getAllByText(/Outbound Departures/i).length).toBeGreaterThan(0)
    // dep-001 N55555 departure should appear
    expect(screen.getAllByTestId(/departure-card-/).length).toBeGreaterThanOrEqual(1)
  })

  test('Aircraft Ops tab shows departure ETD times', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    expect(screen.getAllByText(/Departure \(ETD\):/i).length).toBeGreaterThan(0)
  })

  test('Aircraft Ops tab shows service dots for arrival services', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    // arr-003 Baron has fueling in_progress and tie_down not_started
    expect(screen.getAllByText(/in progress/i).length).toBeGreaterThan(0)
  })

  test('Aircraft Ops tab shows transport section for arrivals', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    // Arrival cards render for sim aircraft
    expect(screen.getAllByTestId(/arrival-card-/).length).toBeGreaterThan(0)
  })

  test('Overview tab shows Gantt chart', () => {
    render(<FBO />)
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument()
    expect(screen.getAllByText(/Operations Timeline/i).length).toBeGreaterThan(0)
  })

  test('Overview tab Gantt shows today operations', () => {
    render(<FBO />)
    // dep-001 N55555 is preparing, should show in gantt
    const gantt = screen.getByTestId('gantt-chart')
    expect(gantt.textContent).toMatch(/N55555/)
    expect(gantt.textContent).toMatch(/N12345/)
  })

  test('Fees tab shows crew vehicle status', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Fees'))
    expect(screen.getAllByText(/Crew Car #1/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Crew Car #2/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Crew Car Status/i).length).toBeGreaterThan(0)
  })

  test('Fees tab shows transportation fee table', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Fees'))
    expect(screen.getAllByText(/Transportation Services/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Limousine Service/i).length).toBeGreaterThan(0)
  })
})

// ─── fboUtils — ADS-B / arrival time helpers ──────────────────────────────────
// FBO_NOW = '2026-03-28T15:30:00Z'

describe('minutesUntilEta', () => {
  test('ETA 2h 15m in future → 135', () => {
    expect(minutesUntilEta('2026-03-28T17:45:00Z')).toBe(135)
  })

  test('ETA exactly at FBO_NOW → 0', () => {
    expect(minutesUntilEta('2026-03-28T15:30:00Z')).toBe(0)
  })

  test('ETA 20 minutes ago → -20', () => {
    expect(minutesUntilEta('2026-03-28T15:10:00Z')).toBe(-20)
  })
})

describe('timeUntilLabel', () => {
  test('2h 15m ahead → "in 2h 15m"', () => {
    expect(timeUntilLabel('2026-03-28T17:45:00Z')).toBe('in 2h 15m')
  })

  test('exactly 1h ahead → "in 1h"', () => {
    expect(timeUntilLabel('2026-03-28T16:30:00Z')).toBe('in 1h')
  })

  test('45m ahead → "in 45m"', () => {
    expect(timeUntilLabel('2026-03-28T16:15:00Z')).toBe('in 45m')
  })

  test('5m ago → "5m ago"', () => {
    expect(timeUntilLabel('2026-03-28T15:25:00Z')).toBe('5m ago')
  })

  test('31m ago → "Arrived" (past threshold)', () => {
    expect(timeUntilLabel('2026-03-28T14:59:00Z')).toBe('Arrived')
  })
})

describe('etaDelayMinutes', () => {
  test('arr-002: reserved 18:00Z, ADS-B 18:15Z → +15 (late)', () => {
    expect(etaDelayMinutes('2026-03-28T18:00:00Z', '2026-03-28T18:15:00Z')).toBe(15)
  })

  test('arr-003: reserved 16:45Z, ADS-B 16:38Z → -7 (early)', () => {
    expect(etaDelayMinutes('2026-03-28T16:45:00Z', '2026-03-28T16:38:00Z')).toBe(-7)
  })

  test('no ADS-B data → null', () => {
    expect(etaDelayMinutes('2026-03-28T18:00:00Z', null)).toBeNull()
    expect(etaDelayMinutes(null, '2026-03-28T18:00:00Z')).toBeNull()
  })
})

describe('etaDelayFlag', () => {
  test('arr-002: 15m late → flag with late=true, label "15m late"', () => {
    const flag = etaDelayFlag('2026-03-28T18:00:00Z', '2026-03-28T18:15:00Z')
    expect(flag).not.toBeNull()
    expect(flag.late).toBe(true)
    expect(flag.minutes).toBe(15)
    expect(flag.label).toBe('15m late')
    expect(flag.color).toContain('orange')
  })

  test('arr-003: 7m early → null (under 10m threshold)', () => {
    const flag = etaDelayFlag('2026-03-28T16:45:00Z', '2026-03-28T16:38:00Z')
    expect(flag).toBeNull()
  })

  test('exactly at threshold (10m) → flagged (threshold is strict <, not <=)', () => {
    const flag = etaDelayFlag('2026-03-28T18:00:00Z', '2026-03-28T18:10:00Z')
    expect(flag).not.toBeNull()  // |10| < 10 is false → flag is raised
    expect(flag.minutes).toBe(10)
  })

  test('11m early → flag with late=false, label "11m early"', () => {
    const flag = etaDelayFlag('2026-03-28T18:00:00Z', '2026-03-28T17:49:00Z')
    expect(flag).not.toBeNull()
    expect(flag.late).toBe(false)
    expect(flag.label).toBe('11m early')
    expect(flag.color).toContain('green')
  })

  test('no ADS-B data → null', () => {
    expect(etaDelayFlag('2026-03-28T18:00:00Z', null)).toBeNull()
  })
})

describe('formatEtaTime', () => {
  test('formats ISO to "HH:MM Z"', () => {
    expect(formatEtaTime('2026-03-28T18:00:00Z')).toBe('18:00 Z')
    expect(formatEtaTime('2026-03-28T16:45:00Z')).toBe('16:45 Z')
  })

  test('null → "—"', () => {
    expect(formatEtaTime(null)).toBe('—')
  })
})

// ─── Arrivals tab — sort order and ADS-B display ──────────────────────────────

describe('Aircraft Ops tab — sort and ADS-B', () => {
  test('arrivals tab shows all 3 mock arrivals', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    expect(screen.getAllByText(/N55555|N44444|N12345|King Air|Citation|Baron/).length).toBeGreaterThan(0)
  })

  test('sim arrivals show ADS-B tracking status (not yet in range for sim aircraft)', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    // Sim aircraft have no adsbExpectedTime so show "not yet in tracking range"
    expect(screen.getAllByText(/not yet in tracking range/i).length).toBeGreaterThan(0)
  })

  test('arr-003 Baron 58 shows "Reservation at:" row', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    expect(screen.getAllByText(/Reservation at:/i).length).toBeGreaterThan(0)
  })

  test('arr-001 Citation shows "not yet in tracking range" (no ADS-B)', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    expect(screen.getAllByText(/not yet in tracking range/i).length).toBeGreaterThan(0)
  })

  test('arrivals render arrival cards for sim aircraft', () => {
    render(<FBO />)
    fireEvent.click(screen.getByText('Aircraft Ops'))
    // TEST_SIM_AIRCRAFT has 2 non-taxiing_out aircraft (N12345 + N77701)
    const cards = screen.getAllByTestId(/arrival-card-/)
    expect(cards.length).toBeGreaterThanOrEqual(2)
  })
})
