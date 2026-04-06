// Seed the SQLite database with mock/default data from client source files.
// Imports directly from client mocks (plain ESM, no browser dependencies).
// Runs inside a single transaction for atomicity.

import { mockAircraft } from '../../client/src/mocks/aircraft.js'
import { mockFlights, mockGliderTowFlights, mockMhgTrainingFlights } from '../../client/src/mocks/flights.js'
import { mockJumpFlights, JUMP_PRICING } from '../../client/src/skydiving/skydivingData.js'
import { mockPersonnel, mockCertificates } from '../../client/src/mocks/personnel.js'
import {
  mockSquawks, mockWorkOrders, mockParts,
  mockInspectionSchedule, mockMaintenanceRecords, mockComponentTbo,
} from '../../client/src/maintenance/mockDb.js'

// Seed client aircraft (from store/clients.js — extracted here to avoid localStorage refs)
const SEED_CLIENTS = [
  { id: 'cli-seed-001', tailNumber: 'N412GL', ownerName: 'Weber, J.',    phone: '(303) 555-0171', email: 'jweber@example.com',  makeModel: 'Schweizer SGS 2-33A', icaoType: 'S33',  fboCategory: 'glider',        fuelType: null,          basedHere: true,  notes: 'Hangar 4 — regular weekender' },
  { id: 'cli-seed-002', tailNumber: 'N88KS',  ownerName: 'Kim, S.',      phone: '(720) 555-0234', email: 'skim@example.com',    makeModel: 'Schempp-Hirth Discus 2b', icaoType: 'DIS2', fboCategory: 'glider',   fuelType: null,          basedHere: true,  notes: 'Competition glider — handle with care' },
  { id: 'cli-seed-003', tailNumber: 'N27PG',  ownerName: 'Peters, G.',   phone: '(303) 555-0399', email: null,                  makeModel: 'Schleicher ASK 21',    icaoType: 'AS21', fboCategory: 'glider',        fuelType: null,          basedHere: false, notes: null },
  { id: 'cli-seed-004', tailNumber: 'N531TP', ownerName: 'Andrews, M.',  phone: '(720) 555-0412', email: 'mandrews@example.com', makeModel: 'Cessna 182T',         icaoType: 'C182', fboCategory: 'piston_single', fuelType: 'avgas_100ll', basedHere: true,  notes: 'Based tenant — Hangar 2' },
  { id: 'cli-seed-005', tailNumber: 'N900TX', ownerName: 'Rockwell LLC', phone: '(303) 555-0500', email: 'ops@rockwell.example', makeModel: 'Beechcraft King Air 350', icaoType: 'BE35', fboCategory: 'turboprop_twin', fuelType: 'jet_a',  basedHere: false, notes: 'Frequent transient — prefers south ramp' },
  { id: 'cli-seed-006', tailNumber: 'N77FX',  ownerName: 'Dunn, R.',     phone: null,              email: 'rdunn@example.com',   makeModel: 'Cirrus SR22',          icaoType: 'SR22', fboCategory: 'piston_single', fuelType: 'avgas_100ll', basedHere: false, notes: null },
]

// Glider pricing (from GliderOps.jsx)
const GLIDER_PRICING = {
  towPer1000ft:      20,
  gliderRentalPerHr: 85,
  instructionPerHr:  65,
  towMinimum:        30,
}

// Default glider settings (from store/gliderSettings.js)
const DEFAULT_SETTINGS = {
  baseAirport:      'KBDU',
  altTafAirport:    'KBJC',
  regionName:       'Front Range Soaring',
  regionBounds:     { north: 40.25, south: 39.85, west: -105.70, east: -105.20 },
  regionCenter:     { lat: 40.02, lon: -105.45 },
  regionRadiusNm:   40,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const js = (v) => v == null ? null : JSON.stringify(v)
const bool = (v) => v ? 1 : 0

// ── Seed function ────────────────────────────────────────────────────────────

export function seed(db) {
  const tx = db.transaction(() => {
    // ── Aircraft ────────────────────────────────────────────────────────────
    const insertAircraft = db.prepare(`
      INSERT INTO aircraft (
        id, operator, tail_number, make_model, icao_type, passenger_capacity,
        op_cost_per_hour, fuel_capacity_gal, fuel_burn_gal_hr, empty_weight_lbs,
        max_gross_weight_lbs, cruise_speed_kts, service_ceiling, year, serial_number,
        airworthy, inspection_status, total_airframe_hours, last_annual_date,
        next_annual_due, last_100hr_date, next_100hr_due, last_flight_date,
        assigned_base, current_location, location_updated_at, location_updated_by,
        fuel_type, fbo_category, equipment, risk_profile, weight_balance,
        mel_items_open, open_squawks, airworthiness_directives
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `)

    for (const a of mockAircraft) {
      insertAircraft.run(
        a.id, a.operator ?? null, a.tailNumber, a.makeModel, a.icaoType, a.passengerCapacity ?? null,
        a.opCostPerHour ?? null, a.fuelCapacityGal ?? null, a.fuelBurnGalHr ?? null, a.emptyWeightLbs ?? null,
        a.maxGrossWeightLbs ?? null, a.cruiseSpeedKts ?? null, a.serviceCeiling ?? null, a.year ?? null, a.serialNumber ?? null,
        bool(a.airworthy), a.inspectionStatus ?? 'current', a.totalAirframeHours ?? null, a.lastAnnualDate ?? null,
        a.nextAnnualDue ?? null, a.last100hrDate ?? null, a.next100hrDue ?? null, a.lastFlightDate ?? null,
        a.assignedBase ?? null, a.currentLocation ?? 'ramp', a.locationUpdatedAt ?? null, a.locationUpdatedBy ?? null,
        a.fuelType ?? null, a.fboCategory ?? null, js(a.equipment), js(a.riskProfile), js(a.weightBalance),
        js(a.melItemsOpen), js(a.openSquawks), js(a.airworthinessDirectives)
      )
    }

    // ── Personnel ──────────────────────────────────────────────────────────
    const insertPersonnel = db.prepare(`
      INSERT INTO personnel (
        id, name, weight_lbs, role, role_label, department, certificate_number,
        cert_type, cfi_cert, cfi_ratings, medical_class, medical_expiry,
        last_flight_review, ifr_currency_expiry, night_currency_expiry,
        duty_hours_last_30d, flight_hours_ytd, training
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const p of mockPersonnel) {
      insertPersonnel.run(
        p.id, p.name, p.weightLbs ?? null, p.role, p.roleLabel ?? null,
        p.department ?? 'Operations', p.certificateNumber ?? null,
        p.certType ?? null, p.cfiCert ?? null, js(p.cfiRatings),
        p.medicalClass ?? null, p.medicalExpiry ?? null,
        p.lastFlightReview ?? null, p.ifrCurrencyExpiry ?? null, p.nightCurrencyExpiry ?? null,
        p.dutyHoursLast30d ?? null, p.flightHoursYtd ?? null, js(p.training)
      )
    }

    // ── Mechanic Certificates ──────────────────────────────────────────────
    const insertCert = db.prepare(`
      INSERT INTO mechanic_certificates (
        id, personnel_id, cert_type, certificate_number, issued_date,
        status, status_date, status_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const c of mockCertificates) {
      insertCert.run(
        c.id, c.personnelId, c.certType, c.certificateNumber,
        c.issuedDate ?? null, c.status ?? 'active', c.statusDate ?? null, c.statusNotes ?? null
      )
    }

    // ── Flights ────────────────────────────────────────────────────────────

    // ICAO type → IACRA category/class mapping
    const CATEGORY_CLASS = {
      C172: 'ASEL', C182: 'ASEL', PA28: 'ASEL', SR22: 'ASEL', C208: 'ASEL', C208B: 'ASEL',
      BE58: 'AMEL', PA34: 'AMEL', BE35: 'AMEL',
      S33: 'Glider', AS21: 'Glider', G103: 'Glider', DIS2: 'Glider', ASW20: 'Glider', DG1000: 'Glider',
      DHC6: 'AMEL', C206: 'ASEL',
    }

    // Departure airport → US state
    const AIRPORT_STATE = {
      KBDU: 'CO', KASE: 'CO', KTEX: 'CO', KLXV: 'CO', KCOS: 'CO', KEGE: 'CO',
      KBJC: 'CO', KDEN: 'CO', KAPA: 'CO', KGXY: 'CO', KCFO: 'CO',
    }

    // Estimate flight hours from route (rough NM-based)
    const ROUTE_NM = {
      'KBDU-KASE': 95, 'KASE-KBDU': 95, 'KBDU-KTEX': 175, 'KBDU-KLXV': 65,
      'KBDU-KCOS': 85, 'KBDU-KEGE': 100, 'KBDU-KDEN': 25, 'KBDU-KBJC': 12,
    }

    function estimateHours(f) {
      // Use _postFlight.realHours if available (training flights)
      if (f._postFlight?.realHours) return parseFloat(f._postFlight.realHours)
      if (f._duration) return f._duration
      const key = `${f.departure ?? f.airport ?? ''}-${f.arrival ?? f.airport ?? ''}`
      const nm = ROUTE_NM[key]
      if (nm) {
        const kts = { C208: 160, C208B: 170, BE58: 200, PA34: 160, C172: 120, PA28: 120, SR22: 170, C182: 140, DHC6: 150 }[f.aircraftType] ?? 140
        return Math.round((nm / kts + 0.25) * 10) / 10  // + taxi/climb
      }
      return null  // unknown — don't populate
    }

    function isNightFlight(f) {
      if (!f.plannedDepartureUtc) return false
      const h = new Date(f.plannedDepartureUtc).getUTCHours()
      return h >= 1 && h < 6 || h >= 24  // ~sunset in CO is ~01:00-02:00Z (~7PM MDT)
    }

    function isXC(f) {
      if (!f.departure || !f.arrival || f.departure === f.arrival) return false
      const key = `${f.departure}-${f.arrival}`
      return (ROUTE_NM[key] ?? 0) > 50
    }

    function computeLogbook(f) {
      const totalHours = estimateHours(f)
      const cat = CATEGORY_CLASS[f.aircraftType] ?? null
      const st = AIRPORT_STATE[f.departure ?? f.airport] ?? null
      const night = isNightFlight(f)
      const xc = isXC(f)
      const mt = f.missionType ?? ''
      const isTrainingDual = mt === 'training_dual' || mt === 'training' && f.sic
      const isTrainingSolo = mt === 'training_solo'
      const isGliderTow = mt === 'glider_tow' || f.part91Type === 'glider_tow'
      const isParaOps = mt === 'parachute_ops'

      // Flight purpose
      let purpose = 'commercial'
      if (f.part === '61' || isTrainingDual || isTrainingSolo) purpose = 'training'
      else if (mt === 'positioning' || mt === 'ferry') purpose = 'currency'
      else if (f.part === '91' && !isGliderTow && !isParaOps) purpose = 'proficiency'

      // Stage name from metadata
      const stageName = f._sessionLabel ?? (f.trainingType ? f.trainingType.replace(/_/g, ' ') : null)

      return {
        total_hours:       totalHours,
        pic_hours:         totalHours && !isTrainingDual ? totalHours : null,
        sic_hours:         totalHours && f.sicId && !isTrainingDual ? totalHours : null,
        dual_hours:        totalHours && isTrainingDual ? totalHours : null,
        dual_given_hours:  null,  // only for CFI — set on instructor's entry
        solo_hours:        totalHours && isTrainingSolo ? totalHours : null,
        night_hours:       totalHours && night ? totalHours : null,
        instrument_hours:  totalHours && f.riskSnapshot?.weatherSummary?.flightCategory === 'IFR' ? Math.round(totalHours * 0.6 * 10) / 10 : null,
        instrument_actual: f.riskSnapshot?.weatherSummary?.flightCategory === 'IFR' ? 1 : 0,
        cross_country:     xc ? 1 : 0,
        cross_country_hours: xc && totalHours ? totalHours : null,
        ground_hours:      null,
        category_class:    cat,
        flight_purpose:    purpose,
        stage_name:        stageName,
        maneuvers_covered: null,
        endorsement_type:  null,
        state:             st,
      }
    }

    const insertFlight = db.prepare(`
      INSERT INTO flights (
        id, source, callsign, tail_number, aircraft_type,
        departure, arrival, airport, waypoints, planned_departure_utc,
        planned_arrival_utc, status, pic, pic_id, sic, sic_id,
        passengers, mission_type, part, part91_type,
        risk_score, risk_p, risk_a, risk_v, risk_e,
        risk_snapshot, tow_info, terrain_profile, metadata,
        total_hours, pic_hours, sic_hours, dual_hours, dual_given_hours,
        solo_hours, night_hours, instrument_hours, instrument_actual,
        cross_country, cross_country_hours, ground_hours,
        category_class, flight_purpose, stage_name, maneuvers_covered,
        endorsement_type, state
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `)

    function insertFlightRow(f, source = 'seed') {
      const known = new Set([
        'id', 'callsign', 'tailNumber', 'aircraftType', 'departure', 'arrival',
        'airport', 'waypoints', 'plannedDepartureUtc', 'plannedArrivalUtc',
        'status', 'pic', 'picId', 'sic', 'sicId', 'passengers',
        'missionType', 'part', 'part91Type',
        'riskScore', 'riskP', 'riskA', 'riskV', 'riskE',
        'riskSnapshot', 'towInfo', 'terrainProfile',
      ])
      const metadata = {}
      for (const [k, v] of Object.entries(f)) {
        if (!known.has(k) && v !== undefined) metadata[k] = v
      }

      const lb = computeLogbook(f)

      insertFlight.run(
        f.id, source, f.callsign ?? null, f.tailNumber ?? null, f.aircraftType ?? null,
        f.departure ?? null, f.arrival ?? null, f.airport ?? null, js(f.waypoints), f.plannedDepartureUtc ?? null,
        f.plannedArrivalUtc ?? null, f.status ?? 'scheduled', f.pic ?? null, f.picId ?? null, f.sic ?? null, f.sicId ?? null,
        js(f.passengers), f.missionType ?? null, f.part ?? null, f.part91Type ?? null,
        f.riskScore ?? null, f.riskP ?? null, f.riskA ?? null, f.riskV ?? null, f.riskE ?? null,
        js(f.riskSnapshot), js(f.towInfo), js(f.terrainProfile), js(Object.keys(metadata).length ? metadata : null),
        lb.total_hours, lb.pic_hours, lb.sic_hours, lb.dual_hours, lb.dual_given_hours,
        lb.solo_hours, lb.night_hours, lb.instrument_hours, lb.instrument_actual,
        lb.cross_country, lb.cross_country_hours, lb.ground_hours,
        lb.category_class, lb.flight_purpose, lb.stage_name, js(lb.maneuvers_covered),
        lb.endorsement_type, lb.state
      )
    }

    for (const f of mockFlights)              insertFlightRow(f, 'seed')
    for (const f of mockGliderTowFlights)     insertFlightRow(f, 'seed')
    for (const f of mockMhgTrainingFlights)   insertFlightRow(f, 'seed')
    for (const f of mockJumpFlights)          insertFlightRow(f, 'seed')

    // ── Work Orders (before squawks — squawks FK references work_orders) ──
    const insertWO = db.prepare(`
      INSERT INTO work_orders (
        id, tail_number, created_date, priority, type, title, description,
        status, location, hold_reason, queue_position,
        estimated_hours, actual_hours, parts_cost, labor_cost,
        completed_date, deferred_to, notes,
        assigned_personnel_ids, supervisor_id, supervisor_certificate_id,
        accruing_hours, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const w of mockWorkOrders) {
      insertWO.run(
        w.id, w.tailNumber, w.createdDate, w.priority, w.type, w.title, w.description,
        w.status, w.location ?? 'ramp', w.holdReason ?? null, w.queuePosition ?? null,
        w.estimatedHours ?? null, w.actualHours ?? null, w.partsCost ?? 0, w.laborCost ?? 0,
        w.completedDate ?? null, w.deferredTo ?? null, w.notes ?? null,
        js(w.assignedPersonnelIds), w.supervisorId ?? null, w.supervisorCertificateId ?? null,
        w.accruingHours ? 1 : 0, w.startedAt ?? null
      )
    }

    // ── Squawks ────────────────────────────────────────────────────────────
    const insertSquawk = db.prepare(`
      INSERT INTO squawks (
        id, tail_number, reported_by, reported_date, description,
        severity, status, mel_reference, mel_expiry_date, airframe_hours,
        resolved_date, resolved_by, resolution_notes, work_order_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const s of mockSquawks) {
      insertSquawk.run(
        s.id, s.tailNumber, s.reportedBy, s.reportedDate, s.description,
        s.severity, s.status, s.melReference ?? null, s.melExpiryDate ?? null, s.airframeHours ?? null,
        s.resolvedDate ?? null, s.resolvedBy ?? null, s.resolutionNotes ?? null, s.workOrderId ?? null
      )
    }

    // ── Parts ──────────────────────────────────────────────────────────────
    const insertPart = db.prepare(`
      INSERT INTO parts (
        id, work_order_id, tail_number, part_number, description, quantity,
        unit_cost, supplier, po_number, ordered_date, eta_date,
        arrived_date, installed_date, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const p of mockParts) {
      insertPart.run(
        p.id, p.workOrderId, p.tailNumber, p.partNumber, p.description, p.quantity ?? 1,
        p.unitCost ?? 0, p.supplier ?? null, p.poNumber ?? null, p.orderedDate ?? null, p.etaDate ?? null,
        p.arrivedDate ?? null, p.installedDate ?? null, p.status, p.notes ?? null
      )
    }

    // ── Inspection Schedule ────────────────────────────────────────────────
    const insertInsp = db.prepare(`
      INSERT INTO inspection_schedule (
        id, tail_number, inspection_type, next_due_date, next_due_hours,
        frequency_days, frequency_hours, last_completed_date, last_completed_hours,
        next_recurrence, overdue
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const i of mockInspectionSchedule) {
      insertInsp.run(
        i.id, i.tailNumber, i.inspectionType, i.nextDueDate ?? null, i.nextDueHours ?? null,
        i.frequencyDays ?? null, i.frequencyHours ?? null,
        i.lastCompletedDate ?? null, i.lastCompletedHours ?? null,
        i.nextRecurrence ?? null, i.overdue ? 1 : 0
      )
    }

    // ── Maintenance Records ────────────────────────────────────────────────
    const insertRecord = db.prepare(`
      INSERT INTO maintenance_records (
        id, tail_number, work_order_id, completed_date, work_type, description,
        technician, certification_level, hours_worked, materials_cost, labor_cost, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const r of mockMaintenanceRecords) {
      insertRecord.run(
        r.id, r.tailNumber, r.workOrderId ?? null, r.completedDate ?? null,
        r.workType ?? null, r.description,
        r.technician ?? null, r.certificationLevel ?? null,
        r.hoursWorked ?? null, r.materialsCost ?? null, r.laborCost ?? null, r.notes ?? null
      )
    }

    // ── Component TBO ──────────────────────────────────────────────────────
    const insertTbo = db.prepare(`
      INSERT INTO component_tbo (
        id, tail_number, component, tbo_hours, tbo_months,
        installed_date, installed_hours, next_overhaul_due, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const t of mockComponentTbo) {
      insertTbo.run(
        t.id, t.tailNumber, t.component, t.tboHours, t.tboMonths ?? null,
        t.installedDate ?? null, t.installedHours ?? null, t.nextOverhaulDue ?? null, t.notes ?? null
      )
    }

    // ── Client Aircraft ────────────────────────────────────────────────────
    const insertClient = db.prepare(`
      INSERT INTO client_aircraft (
        id, tail_number, owner_name, phone, email, make_model,
        icao_type, fbo_category, fuel_type, based_here, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const c of SEED_CLIENTS) {
      insertClient.run(
        c.id, c.tailNumber, c.ownerName, c.phone ?? null, c.email ?? null, c.makeModel ?? null,
        c.icaoType ?? null, c.fboCategory ?? 'glider', c.fuelType ?? null, bool(c.basedHere), c.notes ?? null
      )
    }

    // ── Pricing ────────────────────────────────────────────────────────────
    const insertPricing = db.prepare(
      `INSERT INTO pricing (category, key, value, label) VALUES (?, ?, ?, ?)`
    )

    const gliderPricingLabels = {
      towPer1000ft:      'Tow per 1,000 ft',
      gliderRentalPerHr: 'Glider rental per hour',
      instructionPerHr:  'Instruction per hour',
      towMinimum:        'Minimum tow charge',
    }
    for (const [k, v] of Object.entries(GLIDER_PRICING)) {
      insertPricing.run('glider', k, v, gliderPricingLabels[k] ?? k)
    }

    const jumpPricingLabels = {
      tandem14k:     'Tandem 14,000 ft',
      tandem18k:     'Tandem 18,000 ft (HALO)',
      videoHandcam:  'Handcam video',
      videoOutside:  'Outside video',
      videoCombo:    'Video combo',
      funJumperFull: 'Fun jumper full altitude',
      funJumperHopNPop: 'Fun jumper hop & pop',
      gearRentalFull:   'Gear rental (full day)',
      packerTip:        'Packer tip',
    }
    for (const [k, v] of Object.entries(JUMP_PRICING)) {
      insertPricing.run('skydiving', k, v, jumpPricingLabels[k] ?? k)
    }

    // ── Settings ───────────────────────────────────────────────────────────
    const insertSetting = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)`
    )
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      insertSetting.run(k, JSON.stringify(v))
    }
  })

  tx()
}
