// =============================================================================
// FBO Mock Data — service orders, arrivals, fee schedule, cross-module links
//
// Risk scores (riskScore, defconLevel) are NOT stored here — they are computed
// dynamically from fboUtils.computeRiskScore() using the order's serviceType,
// aircraft fuelType / riskProfile, assigned staff experience, and weather.
// =============================================================================

// ─── Service Orders ───────────────────────────────────────────────────────────
// Scenario notes:
//  fbo-001  N55555 (Grand Caravan, Jet-A, turboprop-with-prop) fueled by Devon Park (1 yr)
//           → Score: 4 + 5 + 3 + 0 = 12 → capped 10 → DEFCON 1 CRITICAL
//  fbo-002  N12345 (Baron 58, Avgas) fueled by Jordan Kim (7 yr)
//           → Score: 4 + 2 + 1 + 0 = 7 → DEFCON 2 ELEVATED
//  fbo-003  N22222 (Caravan, Jet-A, turboprop-with-prop) fueled by Sam Nguyen (3 yr) in rain
//           → Score: 4 + 5 + 2 + 2 = 13 → capped 10 → DEFCON 1 CRITICAL (completed)
//  fbo-007  Maintenance-requested preheat for N11111 — cross-module preheat link
//  fbo-008  Maintenance-requested tow for N33333 (AOG) → cross-module tow request
export const mockServiceOrders = [
  {
    id: 'fbo-001',
    tailNumber: 'N55555',
    serviceType: 'fueling',
    fuelType: 'jet_a',
    fuelQuantityGal: 90,
    assignedTo: 'prs-014',      // Devon Park — 1 yr experience
    weatherCondition: 'clear',
    status: 'pending',
    priority: 'normal',
    requestedAt: '2026-03-28T14:45:00',
    completedAt: null,
    fee: null,
    crossModule: null,
    crossModuleRef: null,
    notes: 'Post-flight fill. N55555 returned from KDAL. Top-off per captain request.',
  },
  {
    id: 'fbo-002',
    tailNumber: 'N12345',
    serviceType: 'fueling',
    fuelType: 'avgas_100ll',
    fuelQuantityGal: 60,
    assignedTo: 'prs-015',      // Jordan Kim — 7 yr experience
    weatherCondition: 'clear',
    status: 'in_progress',
    priority: 'normal',
    requestedAt: '2026-03-28T15:00:00',
    completedAt: null,
    fee: null,
    crossModule: null,
    crossModuleRef: null,
    notes: 'Pre-departure fueling. James Smith departing KDFW at 1700Z.',
  },
  {
    id: 'fbo-003',
    tailNumber: 'N22222',
    serviceType: 'fueling',
    fuelType: 'jet_a',
    fuelQuantityGal: 80,
    assignedTo: 'prs-010',      // Sam Nguyen — 3 yr experience
    weatherCondition: 'light_rain',
    status: 'completed',
    priority: 'normal',
    requestedAt: '2026-03-27T09:15:00',
    completedAt: '2026-03-27T09:48:00',
    fee: 464.00,                // 80 gal × $5.80
    crossModule: null,
    crossModuleRef: null,
    notes: 'Pre-flight fill. Caravan N22222 to KDEN. Sumped after fill — clean fuel confirmed.',
  },
  {
    id: 'fbo-004',
    tailNumber: 'N67890',
    serviceType: 'cleaning',
    fuelType: null,
    fuelQuantityGal: null,
    cleaningType: 'interior_detail',
    assignedTo: 'prs-014',      // Devon Park
    weatherCondition: 'clear',
    status: 'pending',
    priority: 'low',
    requestedAt: '2026-03-28T10:00:00',
    completedAt: null,
    fee: 150.00,
    crossModule: null,
    crossModuleRef: null,
    notes: 'Interior detail before afternoon training flights.',
  },
  {
    id: 'fbo-005',
    tailNumber: 'N44444',
    serviceType: 'tie_down',
    fuelType: null,
    fuelQuantityGal: null,
    assignedTo: 'prs-010',      // Sam Nguyen
    weatherCondition: 'high_wind',
    status: 'completed',
    priority: 'urgent',
    requestedAt: '2026-03-28T13:00:00',
    completedAt: '2026-03-28T13:22:00',
    fee: 15.00,
    crossModule: null,
    crossModuleRef: null,
    notes: 'Wind advisory — double tie-down configuration (6 points). All ramp aircraft secured.',
  },
  {
    id: 'fbo-006',
    tailNumber: 'N55555',
    serviceType: 'hangaring',
    fuelType: null,
    fuelQuantityGal: null,
    assignedTo: 'prs-015',      // Jordan Kim
    weatherCondition: 'clear',
    status: 'completed',
    priority: 'normal',
    requestedAt: '2026-03-26T17:30:00',
    completedAt: '2026-03-26T17:58:00',
    fee: 85.00,                 // turboprop_single hangar nightly
    crossModule: null,
    crossModuleRef: null,
    notes: 'Overnight hangar. Return to ramp 0700 following day.',
  },
  {
    id: 'fbo-007',
    tailNumber: 'N11111',
    serviceType: 'preheat',
    fuelType: null,
    fuelQuantityGal: null,
    assignedTo: 'prs-015',      // Jordan Kim
    weatherCondition: 'clear',
    status: 'completed',
    priority: 'normal',
    requestedAt: '2026-03-28T06:00:00',
    completedAt: '2026-03-28T08:05:00',
    fee: 75.00,
    crossModule: 'maintenance',
    crossModuleRef: 'wo-006',   // N11111 100-hr inspection WO
    notes: 'Engine pre-heat 2 hrs before 100-hr inspection. FBO ground heater placed at cowling per Cherokee POH. Maintenance (Diane Wu) to inspect oil viscosity before start.',
  },
  {
    id: 'fbo-008',
    tailNumber: 'N33333',
    serviceType: 'tow',
    fuelType: null,
    fuelQuantityGal: null,
    assignedTo: 'prs-010',      // Sam Nguyen
    weatherCondition: 'clear',
    status: 'pending',
    priority: 'urgent',
    requestedAt: '2026-03-28T11:00:00',
    completedAt: null,
    fee: 0,                     // Internal — no charge
    crossModule: 'maintenance',
    crossModuleRef: 'wo-001',   // N33333 engine investigation WO
    notes: 'Maintenance requests tow: maintenance bay → ramp for engine run test. Authorized by Sarah Cole (A&P/IA cert-005). Return to maintenance bay if oil pressure fault confirmed.',
  },
  {
    id: 'fbo-009',
    tailNumber: 'N12345',
    serviceType: 'transportation',
    transportationType: 'crew_car',
    vehicleId: 'cv-001',
    assignedTo: 'prs-016',      // Rosa Mendez — FBO coordinator
    weatherCondition: 'clear',
    status: 'in_progress',
    priority: 'normal',
    requestedAt: '2026-03-28T14:30:00Z',
    completedAt: null,
    fee: 0,
    crossModule: null,
    crossModuleRef: null,
    notes: 'Crew Car #1 checked out to James Smith. Return by 18:00Z.',
  },
  {
    id: 'fbo-010',
    tailNumber: 'N77701',
    serviceType: 'transportation',
    transportationType: 'limo',
    vehicleId: null,
    assignedTo: 'prs-016',
    weatherCondition: 'clear',
    status: 'pending',
    priority: 'normal',
    requestedAt: '2026-03-28T14:00:00Z',
    completedAt: null,
    fee: 180.00,
    crossModule: null,
    crossModuleRef: null,
    notes: '2-vehicle limo. Capt. Holloway + 4 pax. Grand Hyatt downtown. Pickup at gate.',
  },
  {
    id: 'fbo-011',
    tailNumber: 'N44444',
    serviceType: 'transportation',
    transportationType: 'uber',
    vehicleId: null,
    assignedTo: null,
    weatherCondition: 'clear',
    status: 'completed',
    priority: 'low',
    requestedAt: '2026-03-28T17:30:00Z',
    completedAt: '2026-03-28T18:00:00Z',
    fee: 0,
    crossModule: null,
    crossModuleRef: null,
    notes: 'Pilot M. Kowalski self-arranged Uber. No coordination fee.',
  },
]

// ─── Arrivals ─────────────────────────────────────────────────────────────────
// arr-002 (King Air B200): turboprop_twin — has props, burns Jet-A.
//   Same confusion risk as Caravan. Assign only experienced line staff.
export const mockArrivals = [
  {
    id: 'arr-001',
    tailNumber: 'N88801',
    makeModel: 'Cessna Citation CJ2+',
    icaoType: 'C525A',
    fuelType: 'jet_a',
    isOwnFleet: false,
    fboCategory: 'jet_light',
    riskProfile: { turboprop: false, jetFuelInPropAircraft: false },
    eta: '2026-03-29T14:30:00Z',
    departureEta: '2026-03-30T08:00:00Z',
    adsbExpectedTime: null,
    adsbSource: null,
    adsbUpdatedAt: null,
    fromIcao: 'KHOU',
    pilotName: 'Capt. T. Morrison',
    passengerCount: 2,
    crewCount: 1,
    servicesRequested: ['fueling', 'hangaring', 'gpu', 'catering'],
    serviceStatuses: {
      fueling:   { status: 'not_started',  updatedAt: null },
      hangaring: { status: 'not_started',  updatedAt: null },
      gpu:       { status: 'not_started',  updatedAt: null },
      catering:  { status: 'ordered',      updatedAt: '2026-03-28T10:00:00Z' },
    },
    fuelRequestGal: 150,
    handlingInstructions: 'Crew needs rental car. Cater for 3 (1 crew + 2 pax). Hangar overnight. Depart 0800 local.',
    transportPreferences: {
      type:      'rental_vehicle',
      vehicleId: null,
      status:    'reserved',
      notes:     'Capt. Morrison: full-size SUV, 2 days. Reserved via Enterprise.',
    },
    status: 'confirmed',
    assignedTo: 'prs-016',
    notes: null,
  },
  {
    id: 'arr-002',
    tailNumber: 'N77701',
    makeModel: 'Beechcraft King Air B200',
    icaoType: 'BE20',
    fuelType: 'jet_a',
    isOwnFleet: false,
    fboCategory: 'turboprop_twin',
    riskProfile: { turboprop: true, jetFuelInPropAircraft: true },
    eta: '2026-03-28T18:00:00Z',
    departureEta: '2026-03-29T09:00:00Z',
    adsbExpectedTime: '2026-03-28T18:15:00Z',
    adsbSource: 'FlightAware',
    adsbUpdatedAt: '2026-03-28T15:28:00Z',
    fromIcao: 'KSAT',
    pilotName: 'Capt. M. Holloway',
    passengerCount: 4,
    crewCount: 2,
    servicesRequested: ['fueling', 'tie_down', 'cleaning'],
    serviceStatuses: {
      fueling:  { status: 'reserved',    updatedAt: '2026-03-28T14:00:00Z' },
      tie_down: { status: 'not_started', updatedAt: null },
      cleaning: { status: 'not_started', updatedAt: null },
    },
    fuelRequestGal: 120,
    handlingInstructions: 'Top off both wing tanks. Fill left nacelle first, then right. Ramp park acceptable. Return 0900 local.',
    transportPreferences: {
      type:      'limo',
      vehicleId: null,
      status:    'reserved',
      notes:     '2-vehicle limo. Capt. Holloway + 4 pax. Grand Hyatt downtown.',
    },
    status: 'confirmed',
    assignedTo: 'prs-016',
    notes: 'King Air B200 — turboprop twin, Jet-A. Senior line staff required for fueling.',
  },
  {
    id: 'arr-003',
    tailNumber: 'N12345',
    makeModel: 'Beechcraft Baron 58',
    icaoType: 'BE58',
    fuelType: 'avgas_100ll',
    isOwnFleet: true,
    fboCategory: 'piston_twin',
    riskProfile: { turboprop: false, jetFuelInPropAircraft: false },
    eta: '2026-03-28T16:45:00Z',
    departureEta: '2026-03-28T18:30:00Z',
    adsbExpectedTime: '2026-03-28T16:38:00Z',
    adsbSource: 'FlightAware',
    adsbUpdatedAt: '2026-03-28T15:22:00Z',
    fromIcao: 'KORD',
    pilotName: 'James Smith',
    passengerCount: 1,
    crewCount: 1,
    servicesRequested: ['fueling', 'tie_down'],
    serviceStatuses: {
      fueling:  { status: 'in_progress', updatedAt: '2026-03-28T15:00:00Z' },
      tie_down: { status: 'not_started', updatedAt: null },
    },
    fuelRequestGal: 40,
    handlingInstructions: 'James will taxi to ramp — no tow needed. Top off both tanks with Avgas 100LL.',
    transportPreferences: {
      type:      'crew_car',
      vehicleId: 'cv-001',
      status:    'checked_out',
      notes:     'Crew Car #1. James Smith. Return by 18:00Z.',
    },
    status: 'inbound',
    assignedTo: 'prs-015',
    notes: null,
  },
]

// ─── Departures ───────────────────────────────────────────────────────────────
// Own-fleet departures scheduled today. Departure-specific fields use `etd`.
export const mockDepartures = [
  {
    id: 'dep-001',
    tailNumber: 'N55555',
    makeModel: 'Cessna Grand Caravan EX',
    fuelType: 'jet_a',
    isOwnFleet: true,
    fboCategory: 'turboprop_single',
    riskProfile: { turboprop: true, jetFuelInPropAircraft: true },
    etd: '2026-03-28T17:00:00Z',
    toIcao: 'KDAL',
    pilotName: 'Capt. R. Torres',
    passengerCount: 3,
    crewCount: 1,
    servicesRequested: ['fueling', 'gpu'],
    serviceStatuses: {
      fueling: { status: 'in_progress', updatedAt: '2026-03-28T14:45:00Z' },
      gpu:     { status: 'completed',   updatedAt: '2026-03-28T15:00:00Z' },
    },
    transportPreferences: null,
    status: 'preparing',
    notes: 'Depart KDAL non-stop. Fuel to tabs (90 gal Jet-A per fbo-001).',
  },
  {
    id: 'dep-002',
    tailNumber: 'N44444',
    makeModel: 'Piper Seneca V',
    fuelType: 'avgas_100ll',
    isOwnFleet: true,
    fboCategory: 'piston_twin',
    riskProfile: { turboprop: false, jetFuelInPropAircraft: false },
    etd: '2026-03-28T19:00:00Z',
    toIcao: 'KAUS',
    pilotName: 'M. Kowalski',
    passengerCount: 2,
    crewCount: 1,
    servicesRequested: ['fueling', 'cleaning'],
    serviceStatuses: {
      fueling:  { status: 'not_started', updatedAt: null },
      cleaning: { status: 'completed',   updatedAt: '2026-03-28T13:45:00Z' },
    },
    transportPreferences: {
      type:      'uber',
      vehicleId: null,
      status:    'departed',
      notes:     'Pilot M. Kowalski already en route via Uber.',
    },
    status: 'scheduled',
    notes: null,
  },
]

// ─── Crew Vehicles ─────────────────────────────────────────────────────────────
// FBO-owned vehicles available for crew use. Third-party (limo, rental) tracked
// via transportPreferences on arrivals but not stored here.
export const mockCrewVehicles = [
  {
    id: 'cv-001',
    label: 'Crew Car #1',
    type: 'crew_car',
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    status: 'checked_out',
    checkedOutTo: 'James Smith (N12345)',
    expectedReturn: '2026-03-28T18:00:00Z',
    lastCleaned: '2026-03-28',
    lastFilled: '2026-03-28',
    notes: 'With James Smith. Return by 18:00Z.',
  },
  {
    id: 'cv-002',
    label: 'Crew Car #2',
    type: 'crew_car',
    make: 'Ford',
    model: 'F-150',
    year: 2022,
    status: 'filled',
    checkedOutTo: null,
    expectedReturn: null,
    lastCleaned: '2026-03-27',
    lastFilled: '2026-03-28',
    notes: 'Reserved for King Air N77701 arrival at 18:00Z.',
  },
  {
    id: 'cv-003',
    label: 'Crew Car #3',
    type: 'crew_car',
    make: 'Chevrolet',
    model: 'Equinox',
    year: 2023,
    status: 'cleaned',
    checkedOutTo: null,
    expectedReturn: null,
    lastCleaned: '2026-03-28',
    lastFilled: '2026-03-27',
    notes: 'Needs fuel before next use.',
  },
]

// ─── Fee Schedule ─────────────────────────────────────────────────────────────
// Ramp fees and hangar fees: two tiers — basic and standard.
// "Usual x and x" per user requirement: ramp + hangar are the two recurring fees.
export const FEE_SCHEDULE = [
  // ── Ramp fees (per aircraft day; waived with minimum fuel purchase) ──────
  { id: 'fee-001', category: 'piston_single',    serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 25,   unit: 'day',    notes: 'Waived with Avgas purchase ≥ 20 gal' },
  { id: 'fee-002', category: 'piston_twin',      serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 35,   unit: 'day',    notes: 'Waived with Avgas purchase ≥ 30 gal' },
  { id: 'fee-003', category: 'turboprop_single', serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 75,   unit: 'day',    notes: 'Waived with Jet-A purchase ≥ 50 gal' },
  { id: 'fee-004', category: 'turboprop_twin',   serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 90,   unit: 'day',    notes: 'Waived with Jet-A purchase ≥ 75 gal' },
  { id: 'fee-005', category: 'jet_light',        serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 150,  unit: 'day',    notes: 'Waived with Jet-A purchase ≥ 100 gal' },
  { id: 'fee-006', category: 'jet_midsize',      serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 200,  unit: 'day',    notes: 'Waived with Jet-A purchase ≥ 150 gal' },
  { id: 'fee-007', category: 'jet_heavy',        serviceType: 'ramp_fee',    label: 'Ramp Fee',           feePerUnit: 350,  unit: 'day',    notes: 'Waived with Jet-A purchase ≥ 250 gal' },
  // ── Hangar fees (per night) ───────────────────────────────────────────────
  { id: 'fee-008', category: 'piston_single',    serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 30,   unit: 'night',  notes: null },
  { id: 'fee-009', category: 'piston_twin',      serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 50,   unit: 'night',  notes: null },
  { id: 'fee-010', category: 'turboprop_single', serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 85,   unit: 'night',  notes: null },
  { id: 'fee-011', category: 'turboprop_twin',   serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 110,  unit: 'night',  notes: null },
  { id: 'fee-012', category: 'jet_light',        serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 175,  unit: 'night',  notes: null },
  { id: 'fee-013', category: 'jet_midsize',      serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 225,  unit: 'night',  notes: null },
  { id: 'fee-014', category: 'jet_heavy',        serviceType: 'hangar_fee',  label: 'Hangar',             feePerUnit: 400,  unit: 'night',  notes: null },
  // ── Fuel (retail, per gallon) ─────────────────────────────────────────────
  { id: 'fee-015', category: 'all',              serviceType: 'fueling',     label: 'Avgas 100LL',        feePerUnit: 7.50, unit: 'gallon', notes: 'Blue dye. Piston aircraft only.' },
  { id: 'fee-016', category: 'all',              serviceType: 'fueling',     label: 'Jet-A',              feePerUnit: 5.80, unit: 'gallon', notes: 'Into-plane rate. Turbine/turboprop aircraft.' },
  // ── Other services ────────────────────────────────────────────────────────
  { id: 'fee-017', category: 'all',              serviceType: 'tie_down',    label: 'Tie-Down',           feePerUnit: 10,   unit: 'day',    notes: 'Chain + chocks. Complimentary with fuel purchase.' },
  { id: 'fee-018', category: 'all',              serviceType: 'cleaning',    label: 'Interior Detail',    feePerUnit: 150,  unit: 'each',   notes: 'Vacuum + wipe-down. ~2 hrs.' },
  { id: 'fee-019', category: 'all',              serviceType: 'cleaning',    label: 'Full Detail',        feePerUnit: 350,  unit: 'each',   notes: 'Interior + exterior hand wash + dry. ~4 hrs.' },
  { id: 'fee-020', category: 'all',              serviceType: 'cleaning',    label: 'Exterior Wash',      feePerUnit: 200,  unit: 'each',   notes: 'Hand wash + chamois dry. ~2.5 hrs.' },
  { id: 'fee-021', category: 'all',              serviceType: 'preheat',     label: 'Engine Pre-Heat',    feePerUnit: 75,   unit: 'event',  notes: 'Ground combustion heater. 2-hr minimum. Maintenance inspection recommended.' },
  { id: 'fee-022', category: 'all',              serviceType: 'gpu',         label: 'Ground Power (GPU)', feePerUnit: 50,   unit: 'hour',   notes: '28 V DC or 115 V AC. Fire watch required during hook-up.' },
  { id: 'fee-023', category: 'all',              serviceType: 'oxygen_service', label: 'O₂ Service',     feePerUnit: 85,   unit: 'fill',   notes: 'Aviator breathing oxygen (1,800 PSI). A&P witness required per 14 CFR 43.' },
  { id: 'fee-024', category: 'all',              serviceType: 'tow',         label: 'Repositioning / Tow', feePerUnit: 45,  unit: 'each',   notes: 'Ramp area only. Long tow (> 500 ft) quoted separately.' },
  { id: 'fee-025', category: 'all',              serviceType: 'lavatory_service', label: 'Lavatory Service', feePerUnit: 35, unit: 'each',  notes: 'Turboprop / jet aircraft only.' },
  { id: 'fee-026', category: 'all',              serviceType: 'catering',    label: 'Catering Coordination', feePerUnit: 25, unit: 'each', notes: 'Handling fee — catering vendor billed separately.' },
  { id: 'fee-027', category: 'all', serviceType: 'transportation', label: 'Crew Car',                    feePerUnit: 0,   unit: 'day',  notes: 'Complimentary with fuel purchase ≥ 50 gal. Cleaning + fill required before return.' },
  { id: 'fee-028', category: 'all', serviceType: 'transportation', label: 'Rental Vehicle Coordination', feePerUnit: 25,  unit: 'each', notes: 'Coordination fee — rental vendor billed separately. Reserve 24 hrs ahead.' },
  { id: 'fee-029', category: 'all', serviceType: 'transportation', label: 'Limousine Service',           feePerUnit: 85,  unit: 'hour', notes: 'Minimum 2 hours. Contact Rosa Mendez for vendor coordination.' },
]

// ─── FBO ↔ Maintenance Cross-Module Links ────────────────────────────────────
// Aircraft heating is shared:
//   FBO: places combustion ground heater (preheat service order).
//   Maintenance: inspects engine oil, cowling, and engine condition post-heat
//                before authorizing start. Generates a maintenance note on the WO.
//
// Tow requests from Maintenance:
//   When a maintenance WO requires moving an aircraft (e.g. to ramp for engine
//   run test), Maintenance creates a tow request that FBO fulfils.
//   A&P or IA authorization is required before any movement of a grounded aircraft.
export const FBO_MAINTENANCE_LINKS = [
  {
    id: 'fbo-mx-001',
    requestType: 'tow_request',
    description: 'Tow N33333 from maintenance bay to ramp for engine run test (oil pressure fault investigation)',
    requestedBy: 'maintenance',
    fboServiceId: 'fbo-008',
    maintenanceWoId: 'wo-001',
    authorizedBy: 'prs-011',    // Sarah Cole — A&P/IA cert-005
    status: 'pending',
    notes: 'Aircraft is grounded (AOG). Tow authorized for engine run only. Do NOT release to flight. Return to maintenance bay after run.',
  },
  {
    id: 'fbo-mx-002',
    requestType: 'preheat',
    description: 'Engine pre-heat N11111 before 100-hr inspection — FBO places heater, Maintenance inspects result',
    requestedBy: 'fbo',
    fboServiceId: 'fbo-007',
    maintenanceWoId: 'wo-006',
    authorizedBy: 'prs-009',    // Diane Wu — A&P/IA cert-003
    status: 'completed',
    notes: 'FBO completed ground heat 0600–0800. Diane Wu inspected oil: 15W-50, clear, no contamination. Engine start authorized.',
  },
]

// ─── FBO Ground Staff reference (subset of mockPersonnel) ────────────────────
// IDs of personnel who are FBO line service staff (for filtering in UI)
export const FBO_STAFF_IDS = ['prs-010', 'prs-014', 'prs-015', 'prs-016']
