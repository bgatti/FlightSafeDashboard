// Aircraft registry — full fleet with airworthiness, inspection status, equipment, and risk characteristics
// inspectionStatus: current | due_soon | overdue
// airworthy: true | false
//
// operator — which organization operates/owns the aircraft:
//   'flightsafe' — primary SMS charter/management fleet
//   'journeys'   — Journeys Aviation (FBO, flight school, rentals at KBDU)
//   'mhg'        — Mile High Gliding (soaring operation at KBDU)
//   'ssb'        — Soaring Society of Boulder (glider club at KBDU)
//
// equipment   — safety systems physically installed on the aircraft
// riskProfile — operational characteristics that drive pilot qualifications and mission risk

const today = new Date('2026-03-21')
const daysFrom   = (d) => new Date(today.getTime() + d * 86_400_000).toISOString().split('T')[0]
const daysBefore = (d) => daysFrom(-d)

export const mockAircraft = [
  {
    id: 'ac-001',
    operator: 'flightsafe',
    tailNumber: 'N12345',
    makeModel: 'Beechcraft Baron 58',
    icaoType: 'BE58',
    passengerCapacity: 5,
    opCostPerHour: 870,     // twin piston — fuel + mx
    fuelCapacityGal:   166,  // usable gallons
    fuelBurnGalHr:      24,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   3283,  // basic empty weight
    maxGrossWeightLbs: 5100, // MTOW
    cruiseSpeedKts: 200,    // TAS at 8,000 ft, 65% power
    serviceCeiling: 20688,  // ft MSL
    singleEngineCeiling: 6500,
    year: 2018,
    serialNumber: 'TH-2181',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 2_840,
    lastAnnualDate: daysBefore(45),
    nextAnnualDue: daysFrom(320),
    last100hrDate: daysBefore(32),
    next100hrDue: daysFrom(68),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [
      { adNumber: 'AD 2023-14-09', description: 'Fuel tank sump inspection',          status: 'complied', compliedDate: daysBefore(90) },
      { adNumber: 'AD 2024-02-12', description: 'Landing gear actuator lubrication',  status: 'complied', compliedDate: daysBefore(45) },
    ],
    lastFlightDate: daysBefore(1),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-27T16:45:00',
    locationUpdatedBy: 'prs-001',  // James Smith — pilot who returned
    fuelType: 'avgas_100ll',        // Twin Continental IO-550-C — Avgas 100LL
    fboCategory: 'piston_twin',

    equipment: {
      ifrCertified:   true,   // Full IFR panel — dual Garmin G500 TXi, GFC 600 autopilot
      autopilot:      true,   // Garmin GFC 600 with VNAV
      glassPanel:     true,   // Garmin G500 TXi dual PFD/MFD
      fiki:           true,   // TKS fluid anti-ice (airframe + props)
      oxygen:         false,  // No supplemental O2 system
      pressurized:    false,  // Unpressurized
      gpwsTaws:       true,   // Garmin GI 275 with terrain — TAWS-B
      tcas:           false,  // No TCAS; traffic via ADS-B In only
      adsbOut:        true,   // ADS-B Out (GTS 800 transponder)
      adsbIn:         true,   // Traffic + weather via Garmin MFD
      elt:            '406',  // 406 MHz ELT
      stormscope:     true,   // L-3 WX-500 stormscope
    },

    riskProfile: {
      multiEngine:           true,   // Two Continental IO-550-C, 300 HP each
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           false,  // Tricycle gear
      complexAircraft:       true,   // Retractable gear + CS props + flaps (FAA complex)
      highPerformance:       true,   // >200 HP per engine (FAA HP endorsement)
      turbocharged:          false,  // Normally aspirated
      singlePilotCertified:  true,   // Certified for single-pilot ops
      ifr:                   true,   // IFR capable and regularly used IFR
      notes: 'Excellent cross-country platform. Multi-engine provides engine-out redundancy. TKS FIKI limits exposure to known icing.',
    },
    weightBalance: {
      emptyWeightLbs:        3319,
      emptyArm:              88.3,
      maxGrossLbs:           5500,
      maxFuelUsableGal:      100,   // main tanks only (50 gal/side)
      fuelWeightPerGal:      6.0,
      standardTrainingFuelGal: 80,
      stations: {
        frontSeats:   { arm: 85.5 },
        midSeats:     { arm: 118.1 },
        aftSeats:     { arm: 149.7 },
        fuel:         { arm: 93.6 },
        noseBaggage:  { arm: 22.5,  maxWeightLbs: 300 },
        aftBaggage:   { arm: 178.7, maxWeightLbs: 400 },
      },
      cgLimits: { forwardIn: 78.0, aftIn: 91.4 },
    },
  },

  {
    id: 'ac-002',
    operator: 'flightsafe',
    tailNumber: 'N67890',
    makeModel: 'Cessna 172S Skyhawk',
    icaoType: 'C172',
    passengerCapacity: 3,
    opCostPerHour: 180,
    fuelCapacityGal:    53,  // usable gallons
    fuelBurnGalHr:       9,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   1663,  // basic empty weight
    maxGrossWeightLbs: 2550, // MTOW
    cruiseSpeedKts: 122,    // TAS at 8,000 ft, 75% power
    serviceCeiling: 14000,
    year: 2020,
    serialNumber: '172S12344',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 1_120,
    lastAnnualDate: daysBefore(180),
    nextAnnualDue: daysFrom(185),
    last100hrDate: daysBefore(55),
    next100hrDue: daysFrom(45),
    melItemsOpen: [
      { item: 'Pitot heat inop', category: 'MEL C', openedDate: daysBefore(5), expiryDate: daysFrom(25) },
    ],
    openSquawks: [],
    airworthinessDirectives: [
      { adNumber: 'AD 2022-08-01', description: 'Elevator control stop inspection', status: 'complied', compliedDate: daysBefore(180) },
    ],
    lastFlightDate: daysBefore(2),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-26T11:30:00',
    locationUpdatedBy: 'prs-010',  // Sam Nguyen — ground handler
    fuelType: 'avgas_100ll',        // Lycoming IO-360 — Avgas 100LL
    fboCategory: 'piston_single',

    equipment: {
      ifrCertified:   true,   // Garmin G1000 NXi — full IFR
      autopilot:      true,   // Garmin GFC 700
      glassPanel:     true,   // G1000 NXi PFD/MFD
      fiki:           false,  // No ice protection; MEL pitot heat inop further degrades
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       true,   // G1000 TAWS-B built-in
      tcas:           false,
      adsbOut:        true,
      adsbIn:         true,
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           false,
      complexAircraft:       false,  // Fixed gear, fixed-pitch prop — NOT complex
      highPerformance:       false,  // 180 HP Lycoming IO-360
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   true,   // IFR certified but currently degraded — pitot heat MEL
      notes: 'MEL on pitot heat restricts IMC operations. Single-engine limits over-water and mountainous routing options.',
    },
    weightBalance: {
      emptyWeightLbs:        1663,
      emptyArm:              38.8,
      maxGrossLbs:           2550,
      maxFuelUsableGal:      53,
      fuelWeightPerGal:      6.0,
      standardTrainingFuelGal: 30,
      stations: {
        frontSeats:  { arm: 37.0 },
        rearSeats:   { arm: 73.0 },
        fuel:        { arm: 48.0 },
        baggage:     { arm: 95.0,  maxWeightLbs: 120 },
      },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },

  {
    id: 'ac-003',
    operator: 'flightsafe',
    tailNumber: 'N11111',
    makeModel: 'Piper Cherokee 28',
    icaoType: 'PA28',
    passengerCapacity: 3,
    opCostPerHour: 155,
    fuelCapacityGal:    50,  // usable gallons
    fuelBurnGalHr:       8,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   1348,  // basic empty weight
    maxGrossWeightLbs: 2450, // MTOW
    cruiseSpeedKts: 115,    // TAS at 6,500 ft
    serviceCeiling: 14100,
    year: 2015,
    serialNumber: '28-7890123',
    airworthy: true,
    inspectionStatus: 'due_soon',
    totalAirframeHours: 3_415,
    lastAnnualDate: daysBefore(340),
    nextAnnualDue: daysFrom(25),
    last100hrDate: daysBefore(88),
    next100hrDue: daysFrom(12),
    melItemsOpen: [],
    openSquawks: [
      { description: 'Altimeter #2 reads +80ft off', reportedDate: daysBefore(3), status: 'open' },
    ],
    airworthinessDirectives: [
      { adNumber: 'AD 2021-19-07', description: 'Brake master cylinder inspection',    status: 'complied', compliedDate: daysBefore(200) },
      { adNumber: 'AD 2024-11-03', description: 'Fuel selector valve inspection',      status: 'open',    compliedDate: null },
    ],
    lastFlightDate: daysBefore(3),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-25T13:45:00',
    locationUpdatedBy: 'prs-010',  // Sam Nguyen — ground handler
    fuelType: 'avgas_100ll',        // Lycoming O-360 — Avgas 100LL
    fboCategory: 'piston_single',

    equipment: {
      ifrCertified:   true,   // Garmin GTN 650 + GI 275 ADAHRS — IFR capable
      autopilot:      false,  // No autopilot installed
      glassPanel:     false,  // Steam gauges + GTN 650 GPS
      fiki:           false,  // No ice protection
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       false,  // No TAWS; GTN 650 has basic terrain awareness only
      tcas:           false,
      adsbOut:        true,
      adsbIn:         true,   // GTN 650 weather datalink
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           false,
      complexAircraft:       false,  // Fixed gear, fixed-pitch prop
      highPerformance:       false,  // 180 HP Lycoming O-360
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   true,
      notes: 'Open AD on fuel selector valve — significant airworthiness concern. No autopilot increases single-pilot workload in IMC. Altimeter squawk adds altitude deviation risk.',
    },
    weightBalance: {
      emptyWeightLbs:        1336,
      emptyArm:              85.7,
      maxGrossLbs:           2400,
      maxFuelUsableGal:      48,
      fuelWeightPerGal:      6.0,
      standardTrainingFuelGal: 30,
      stations: {
        frontSeats:  { arm: 85.5 },
        rearSeats:   { arm: 117.5 },
        fuel:        { arm: 95.0 },
        baggage:     { arm: 142.8, maxWeightLbs: 200 },
      },
      cgLimits: { forwardIn: 84.0, aftIn: 93.0 },
    },
  },

  {
    id: 'ac-004',
    operator: 'flightsafe',
    tailNumber: 'N22222',
    makeModel: 'Cessna 208 Caravan',
    icaoType: 'C208',
    passengerCapacity: 9,
    opCostPerHour: 680,
    fuelCapacityGal:   335,  // usable gallons
    fuelBurnGalHr:      59,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   4741,  // basic empty weight
    maxGrossWeightLbs: 8000, // MTOW
    cruiseSpeedKts: 175,    // TAS at 10,000 ft (PT6A-114A at 65%)
    serviceCeiling: 25000,
    year: 2019,
    serialNumber: '20800451',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 5_220,
    lastAnnualDate: daysBefore(60),
    nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(40),
    next100hrDue: daysFrom(60),
    melItemsOpen: [
      { item: 'Autopilot altitude hold inop', category: 'MEL B', openedDate: daysBefore(10), expiryDate: daysFrom(20) },
    ],
    openSquawks: [],
    airworthinessDirectives: [
      { adNumber: 'AD 2023-06-18', description: 'Engine fuel control unit inspection',  status: 'complied', compliedDate: daysBefore(60) },
      { adNumber: 'AD 2024-08-05', description: 'Propeller de-ice boot replacement',    status: 'complied', compliedDate: daysBefore(60) },
    ],
    lastFlightDate: daysBefore(1),
    assignedBase: 'KBDU',
    currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-19T14:00:00',
    locationUpdatedBy: 'prs-010',  // Sam Nguyen — towed to hangar for autopilot troubleshooting (wo-004)
    fuelType: 'jet_a',              // PT6A-114A turboprop — Jet-A / JP-8
    fboCategory: 'turboprop_single',

    equipment: {
      ifrCertified:   true,   // Garmin G1000 NXi — full IFR
      autopilot:      true,   // Garmin GFC 700 — altitude hold currently MEL'd
      glassPanel:     true,   // G1000 NXi PFD/MFD
      fiki:           true,   // TKS fluid anti-ice airframe; pneumatic prop boots
      oxygen:         true,   // Supplemental O2 for high-altitude ops
      pressurized:    false,  // Standard C208 — unpressurized
      gpwsTaws:       true,   // G1000 TAWS-B
      tcas:           false,  // No TCAS
      adsbOut:        true,
      adsbIn:         true,
      elt:            '406',
      stormscope:     true,   // Installed for wx avoidance
    },

    riskProfile: {
      multiEngine:           false,  // Single PT6A-114A turbine
      turboprop:             true,   // Pratt & Whitney PT6A — turbine engine
      jetFuelInPropAircraft: true,   // Burns Jet-A / JP-8 — confirm Jet-A availability at destination
      pressurized:           false,
      taildragger:           false,
      complexAircraft:       true,   // CS prop + flaps (FAA complex — no retractable gear on C208)
      highPerformance:       true,   // 675 SHP PT6A — far exceeds 200 HP threshold
      turbocharged:          false,  // Turbine, not turbocharged piston
      singlePilotCertified:  true,
      ifr:                   true,
      notes: 'Turboprop burns Jet-A — verify fuel availability at all alternates. Autopilot altitude hold MEL\'d; increases single-pilot IMC workload at cruise. FIKI certified for known icing.',
    },
  },

  {
    id: 'ac-005',
    operator: 'flightsafe',
    tailNumber: 'N33333',
    makeModel: 'Cessna 172N Skyhawk',
    icaoType: 'C172',
    passengerCapacity: 3,
    opCostPerHour: 175,
    fuelCapacityGal:    43,  // usable gallons
    fuelBurnGalHr:       8,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   1466,  // basic empty weight
    maxGrossWeightLbs: 2300, // MTOW
    cruiseSpeedKts: 120,    // TAS at 7,500 ft — older airframe, slightly slower
    serviceCeiling: 14000,
    year: 2008,
    serialNumber: '17273210',
    airworthy: false,                     // grounded
    inspectionStatus: 'overdue',
    totalAirframeHours: 6_810,
    lastAnnualDate: daysBefore(385),      // overdue
    nextAnnualDue: daysBefore(20),
    last100hrDate: daysBefore(110),       // overdue
    next100hrDue: daysBefore(10),
    melItemsOpen: [],
    openSquawks: [
      { description: 'Oil pressure fluctuating — engine run-up', reportedDate: daysBefore(8), status: 'grounding' },
      { description: 'Right brake dragging',                      reportedDate: daysBefore(8), status: 'open' },
    ],
    airworthinessDirectives: [
      { adNumber: 'AD 2022-08-01', description: 'Elevator control stop inspection', status: 'open', compliedDate: null },
    ],
    lastFlightDate: daysBefore(8),
    assignedBase: 'KBDU',
    currentLocation: 'maintenance_bay',
    locationUpdatedAt: '2026-03-20T08:30:00',
    locationUpdatedBy: 'prs-010',  // Sam Nguyen — towed AOG to maintenance bay
    fuelType: 'avgas_100ll',        // Lycoming O-320 — Avgas 100LL
    fboCategory: 'piston_single',

    equipment: {
      ifrCertified:   false,  // VFR panel only — no IFR GPS or approach capability
      autopilot:      false,
      glassPanel:     false,  // All steam gauges
      fiki:           false,
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       false,
      tcas:           false,
      adsbOut:        true,   // Retrofitted ADS-B Out transponder
      adsbIn:         false,
      elt:            '121.5', // Older ELT — not 406 MHz
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           false,
      complexAircraft:       false,
      highPerformance:       false,  // 160 HP Lycoming O-320
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   false,  // NOT IFR capable
      notes: 'GROUNDED. Annual and 100-hr overdue. Grounding squawk on engine oil pressure. Open AD on elevator. 121.5 ELT is non-conforming — 406 MHz required for new registrations.',
    },
  },

  {
    id: 'ac-006',
    operator: 'flightsafe',
    tailNumber: 'N44444',
    makeModel: 'Piper PA-34 Seneca',
    icaoType: 'PA34',
    passengerCapacity: 5,
    opCostPerHour: 310,
    cruiseSpeedKts:    161,  // TAS at 8,000 ft, 65% power (TSIO-360-RB)
    fuelCapacityGal:   128,  // usable gallons
    fuelBurnGalHr:      22,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   3052,  // basic empty weight
    maxGrossWeightLbs: 4570, // MTOW
    serviceCeiling: 25000,   // PA-34-220T turbocharged
    singleEngineCeiling: 7200,
    year: 2017,
    serialNumber: '34-7250220',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 2_105,
    lastAnnualDate: daysBefore(90),
    nextAnnualDue: daysFrom(275),
    last100hrDate: daysBefore(65),
    next100hrDue: daysFrom(35),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [
      { adNumber: 'AD 2023-12-04', description: 'Fuel line inspection P/N 758-990', status: 'complied', compliedDate: daysBefore(90) },
    ],
    lastFlightDate: daysBefore(4),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-24T07:15:00',
    locationUpdatedBy: 'prs-010',  // Sam Nguyen — preflighted for charter
    fuelType: 'avgas_100ll',        // Twin Continental TSIO-360-RB — Avgas 100LL
    fboCategory: 'piston_twin',

    equipment: {
      ifrCertified:   true,   // Dual Garmin GTN 750 + G500 TXi — full IFR
      autopilot:      true,   // Garmin GFC 500 with VNAV
      glassPanel:     true,   // G500 TXi + GTN 750
      fiki:           true,   // Pneumatic de-ice boots (airframe) + electric prop de-ice
      oxygen:         true,   // Portable O2 system — crew and pax masks available
      pressurized:    false,  // Unpressurized — O2 required above FL180
      gpwsTaws:       true,   // GTN 750 TAWS-B
      tcas:           false,
      adsbOut:        true,
      adsbIn:         true,
      elt:            '406',
      stormscope:     true,   // L-3 WX-900 stormscope
    },

    riskProfile: {
      multiEngine:           true,   // Twin Continental TSIO-360-RB, 220 HP each
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           false,
      complexAircraft:       true,   // Retractable gear + CS props + flaps (FAA complex)
      highPerformance:       true,   // >200 HP per engine (FAA HP endorsement)
      turbocharged:          true,   // Twin turbocharged — maintains performance at altitude
      singlePilotCertified:  true,
      ifr:                   true,
      notes: 'Turbocharged twin allows high-altitude routing above weather. De-ice boots + O2 enable extended IMC ops. Engine-out single-engine performance requires pilot proficiency.',
    },
  },

  {
    id: 'ac-007',
    operator: 'flightsafe',
    tailNumber: 'N55555',
    makeModel: 'Cessna 208B Grand Caravan',
    icaoType: 'C208',
    passengerCapacity: 9,
    opCostPerHour: 695,
    fuelCapacityGal:   335,  // usable gallons
    fuelBurnGalHr:      59,  // cruise burn gal/hr (65% power)
    emptyWeightLbs:   4990,  // basic empty weight
    maxGrossWeightLbs: 8807, // MTOW
    serviceCeiling: 25000,
    year: 2021,
    serialNumber: '208B5001',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 1_890,
    lastAnnualDate: daysBefore(30),
    nextAnnualDue: daysFrom(335),
    last100hrDate: daysBefore(20),
    next100hrDue: daysFrom(80),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [],
    lastFlightDate: daysBefore(0),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-28T14:20:00',
    locationUpdatedBy: 'prs-003',  // Marcus Davis — returned from charter
    fuelType: 'jet_a',              // PT6A-114A turboprop — Jet-A / JP-8
    fboCategory: 'turboprop_single',

    equipment: {
      ifrCertified:   true,   // Garmin G1000 NXi — full IFR
      autopilot:      true,   // Garmin GFC 700 fully operational
      glassPanel:     true,   // G1000 NXi with SVT synthetic vision
      fiki:           true,   // TKS fluid airframe + pneumatic prop boots
      oxygen:         true,   // Supplemental O2 system installed
      pressurized:    false,  // 208B standard — unpressurized
      gpwsTaws:       true,   // G1000 TAWS-A (higher standard than TAWS-B)
      tcas:           true,   // Garmin GTS 825 TCAS I
      adsbOut:        true,
      adsbIn:         true,
      elt:            '406',
      stormscope:     true,
    },

    riskProfile: {
      multiEngine:           false,  // Single PT6A-114A
      turboprop:             true,   // Pratt & Whitney PT6A
      jetFuelInPropAircraft: true,   // Burns Jet-A / JP-8
      pressurized:           false,
      taildragger:           false,
      complexAircraft:       true,   // CS prop + flaps (FAA complex)
      highPerformance:       true,   // 675 SHP
      turbocharged:          false,  // Turbine, not turbocharged piston
      singlePilotCertified:  true,
      ifr:                   true,
      notes: 'Best-equipped aircraft in fleet. TAWS-A, TCAS, SVT, full FIKI. Turboprop burns Jet-A — confirm availability at destination and alternates. Newest airframe with lowest hours.',
    },
  },

  // ── Glider fleet ──────────────────────────────────────────────────────────────

  {
    id: 'ac-008',
    operator: 'mhg',
    tailNumber: 'N8001G',
    makeModel: 'Schweizer SGS 2-33A',
    icaoType: 'S33',
    icaoHex: 'a7b301',
    passengerCapacity: 1,        // instructor + student
    opCostPerHour: 85,           // glider + tow combined wet rate
    fuelCapacityGal: 0,
    fuelBurnGalHr: 0,
    emptyWeightLbs: 575,
    maxGrossWeightLbs: 1040,
    cruiseSpeedKts: 45,
    serviceCeiling: 14000,
    year: 1972,
    serialNumber: '169',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 4_210,
    lastAnnualDate: daysBefore(60),
    nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(30),
    next100hrDue: daysFrom(70),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [],
    lastFlightDate: daysBefore(2),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-30T10:00:00',
    locationUpdatedBy: 'prs-001',
    fuelType: null,              // unpowered glider
    fboCategory: 'glider',
    glider: true,
    needs_tow: true,

    equipment: {
      ifrCertified:   false,
      autopilot:      false,
      glassPanel:     false,
      fiki:           false,
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       false,
      tcas:           false,
      adsbOut:        true,
      adsbIn:         false,
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           true,   // conventional tailwheel on glider
      complexAircraft:       false,
      highPerformance:       false,
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   false,
      notes: 'Training glider — requires aerotow for launch. VFR day only. Tailwheel ground handling required. Glider pilot certificate (§61.3) or student certificate required.',
    },
  },

  {
    id: 'ac-009',
    operator: 'mhg',
    tailNumber: 'N8002G',
    makeModel: 'Grob G 103 Twin Astir',
    icaoType: 'G103',
    icaoHex: 'a7b402',
    passengerCapacity: 1,        // 2-seat cross-country glider
    opCostPerHour: 95,
    fuelCapacityGal: 0,
    fuelBurnGalHr: 0,
    emptyWeightLbs: 750,
    maxGrossWeightLbs: 1323,
    cruiseSpeedKts: 54,
    serviceCeiling: 18000,
    year: 1983,
    serialNumber: '34032',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 2_880,
    lastAnnualDate: daysBefore(45),
    nextAnnualDue: daysFrom(320),
    last100hrDate: daysBefore(15),
    next100hrDue: daysFrom(85),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [],
    lastFlightDate: daysBefore(1),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T15:30:00',
    locationUpdatedBy: 'prs-001',
    fuelType: null,
    fboCategory: 'glider',
    glider: true,
    needs_tow: true,

    equipment: {
      ifrCertified:   false,
      autopilot:      false,
      glassPanel:     false,
      fiki:           false,
      oxygen:         true,   // supplemental O2 for wave/high-altitude soaring
      pressurized:    false,
      gpwsTaws:       false,
      tcas:           false,
      adsbOut:        true,
      adsbIn:         true,   // Garmin inReach (weather + traffic)
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           true,
      complexAircraft:       false,
      highPerformance:       false,
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   false,
      notes: 'High-performance cross-country glider. Requires aerotow to launch. O2 installed for wave flights above 12,500 ft. Best glide 38:1 at 54 kts. FAA glider certificate required.',
    },
  },

  // ─── Tow Aircraft ─────────────────────────────────────────────────────────
  {
    id: 'ac-010',
    operator: 'mhg',
    tailNumber: 'N3456P',
    makeModel: 'Piper PA-25-235 Pawnee',
    icaoType: 'PA25',
    icaoHex: 'a59663',
    passengerCapacity: 0,        // solo tow pilot only
    opCostPerHour: 110,
    fuelCapacityGal: 36,
    fuelBurnGalHr: 12,
    emptyWeightLbs: 1230,
    maxGrossWeightLbs: 2000,
    cruiseSpeedKts: 90,
    serviceCeiling: 14500,
    year: 1976,
    serialNumber: '25-4421',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 6_340,
    lastAnnualDate: daysBefore(30),
    nextAnnualDue: daysFrom(335),
    last100hrDate: daysBefore(30),
    next100hrDue: daysFrom(70),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [],
    lastFlightDate: daysBefore(1),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T16:00:00',
    locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll',
    fboCategory: 'piston_single',
    is_tow: true,

    equipment: {
      ifrCertified:   false,
      autopilot:      false,
      glassPanel:     false,
      fiki:           false,
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       false,
      tcas:           false,
      adsbOut:        true,
      adsbIn:         false,
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           true,
      complexAircraft:       false,
      highPerformance:       true,   // 235 HP — HP endorsement required
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   false,
      notes: 'Dedicated aerotow aircraft. Pawnee is the industry-standard glider tug. 235 HP Lycoming O-540. Taildragger — conventional gear endorsement required. Tow-certified pilot required.',
    },
  },

  {
    id: 'ac-011',
    operator: 'mhg',
    tailNumber: 'N7890C',
    makeModel: 'Piper PA-18-150 Super Cub',
    icaoType: 'PA18',
    icaoHex: 'a5f99b',
    passengerCapacity: 1,        // tow pilot + 1 passenger (not used for tow pax)
    opCostPerHour: 90,
    fuelCapacityGal: 18,
    fuelBurnGalHr: 9,
    emptyWeightLbs: 930,
    maxGrossWeightLbs: 1750,
    cruiseSpeedKts: 85,
    serviceCeiling: 19000,
    year: 1970,
    serialNumber: '18-7009',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 8_120,
    lastAnnualDate: daysBefore(60),
    nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(20),
    next100hrDue: daysFrom(80),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [],
    lastFlightDate: daysBefore(2),
    assignedBase: 'KBDU',
    currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-30T17:00:00',
    locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll',
    fboCategory: 'piston_single',
    is_tow: true,

    equipment: {
      ifrCertified:   false,
      autopilot:      false,
      glassPanel:     false,
      fiki:           false,
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       false,
      tcas:           false,
      adsbOut:        true,
      adsbIn:         false,
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           true,
      complexAircraft:       false,
      highPerformance:       false,
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   false,
      notes: 'Super Cub aerotow aircraft. 150 HP Lycoming O-320. Taildragger — conventional gear endorsement required. Tow-certified pilot required. Can tow to 3,000 ft AGL in standard conditions.',
    },
  },

  {
    id: 'ac-012',
    operator: 'mhg',
    tailNumber: 'N1234C',
    makeModel: 'Piper PA-18-150 Super Cub',
    icaoType: 'PA18',
    icaoHex: 'a4e8b7',
    passengerCapacity: 1,
    opCostPerHour: 90,
    fuelCapacityGal: 18,
    fuelBurnGalHr: 9,
    emptyWeightLbs: 930,
    maxGrossWeightLbs: 1750,
    cruiseSpeedKts: 85,
    serviceCeiling: 19000,
    year: 1968,
    serialNumber: '18-6802',
    airworthy: true,
    inspectionStatus: 'current',
    totalAirframeHours: 9_450,
    lastAnnualDate: daysBefore(10),
    nextAnnualDue: daysFrom(355),
    last100hrDate: daysBefore(10),
    next100hrDue: daysFrom(90),
    melItemsOpen: [],
    openSquawks: [],
    airworthinessDirectives: [],
    lastFlightDate: daysBefore(3),
    assignedBase: 'KBDU',
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-29T14:00:00',
    locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll',
    fboCategory: 'piston_single',
    is_tow: true,

    equipment: {
      ifrCertified:   false,
      autopilot:      false,
      glassPanel:     false,
      fiki:           false,
      oxygen:         false,
      pressurized:    false,
      gpwsTaws:       false,
      tcas:           false,
      adsbOut:        true,
      adsbIn:         false,
      elt:            '406',
      stormscope:     false,
    },

    riskProfile: {
      multiEngine:           false,
      turboprop:             false,
      jetFuelInPropAircraft: false,
      pressurized:           false,
      taildragger:           true,
      complexAircraft:       false,
      highPerformance:       false,
      turbocharged:          false,
      singlePilotCertified:  true,
      ifr:                   false,
      notes: 'Super Cub aerotow aircraft (second tug — peak demand). 150 HP Lycoming O-320. Taildragger — conventional gear endorsement required. Tow-certified pilot required.',
    },
  },

  // ─── Journeys Aviation fleet (KBDU FBO / Flight School) ─────────────────
  // Source: 2023-24 Aircraft Rental Price List (Dec 1, 2023)
  // W&B values are type-cert typical — consult aircraft POH for actual.

  {
    id: 'ja-001', operator: 'journeys', tailNumber: 'N6316S',
    makeModel: 'Cessna 150G (150 HP conversion)', icaoType: 'C150',
    passengerCapacity: 1, year: 1966, opCostPerHour: 139,
    fuelCapacityGal: 22.5, fuelBurnGalHr: 6.5, emptyWeightLbs: 1091, maxGrossWeightLbs: 1600,
    cruiseSpeedKts: 100, serviceCeiling: 12650,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 8200, lastAnnualDate: daysBefore(120), nextAnnualDue: daysFrom(245),
    last100hrDate: daysBefore(40), next100hrDue: daysFrom(60),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-04-02T15:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 139, prepay: 134.83, nonMember: 159, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: true, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 150G with 150 HP conversion. Garmin 175 GPS, Dual Nav/Com, Dual G5, Lynx 9000 ADS-B In/Out. Basic trainer.',
    },
    weightBalance: {
      emptyWeightLbs: 1091, emptyArm: 33.2, maxGrossLbs: 1600, maxFuelUsableGal: 22.5, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 22.5,
      stations: { frontSeats: { arm: 39.0, maxWeightLbs: 340 }, fuel: { arm: 42.0 }, baggage: { arm: 64.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 28.0, aftIn: 36.0 },
    },
  },
  {
    id: 'ja-002', operator: 'journeys', tailNumber: 'N235ND',
    makeModel: 'Diamond DA20-C1 Eclipse (VFR only)', icaoType: 'DA20',
    passengerCapacity: 1, year: null, opCostPerHour: 145,
    fuelCapacityGal: 24, fuelBurnGalHr: 6, emptyWeightLbs: 1168, maxGrossWeightLbs: 1764,
    cruiseSpeedKts: 118, serviceCeiling: 13120,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 5400, lastAnnualDate: daysBefore(90), nextAnnualDue: daysFrom(275),
    last100hrDate: daysBefore(30), next100hrDue: daysFrom(70),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-04-01T17:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 145, prepay: 140.65, nonMember: 165, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Diamond DA20-C1 Eclipse. Garmin 375 GPS, Aspen E5, ADS-B Out. VFR ONLY. Stick control, low-wing composite.',
    },
    weightBalance: {
      emptyWeightLbs: 1168, emptyArm: 10.0, maxGrossLbs: 1764, maxFuelUsableGal: 24, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 20,
      stations: { frontSeats: { arm: 10.0, maxWeightLbs: 397 }, fuel: { arm: 11.8 }, baggage: { arm: 18.9, maxWeightLbs: 44 } },
      cgLimits: { forwardIn: 8.07, aftIn: 12.16 },
    },
  },
  {
    id: 'ja-003', operator: 'journeys', tailNumber: 'N641DC',
    makeModel: 'Diamond DA20-C1 Eclipse (IFR)', icaoType: 'DA20',
    passengerCapacity: 1, year: null, opCostPerHour: 149,
    fuelCapacityGal: 24, fuelBurnGalHr: 6, emptyWeightLbs: 1168, maxGrossWeightLbs: 1764,
    cruiseSpeedKts: 118, serviceCeiling: 13120,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 4800, lastAnnualDate: daysBefore(60), nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(25), next100hrDue: daysFrom(75),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-04-02T14:30:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 149, prepay: 144.53, nonMember: 169, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: true, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Diamond DA20-C1 Eclipse. Garmin 650, Dual GF, Dual NavCom, ADS-B In/Out. IFR capable.',
    },
    weightBalance: {
      emptyWeightLbs: 1168, emptyArm: 10.0, maxGrossLbs: 1764, maxFuelUsableGal: 24, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 20,
      stations: { frontSeats: { arm: 10.0, maxWeightLbs: 397 }, fuel: { arm: 11.8 }, baggage: { arm: 18.9, maxWeightLbs: 44 } },
      cgLimits: { forwardIn: 8.07, aftIn: 12.16 },
    },
  },
  {
    id: 'ja-004', operator: 'journeys', tailNumber: 'N52993',
    makeModel: 'Cessna 172P Skyhawk', icaoType: 'C172',
    passengerCapacity: 3, year: null, opCostPerHour: 145,
    fuelCapacityGal: 43, fuelBurnGalHr: 8.5, emptyWeightLbs: 1420, maxGrossWeightLbs: 2400,
    cruiseSpeedKts: 114, serviceCeiling: 14200,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 9100, lastAnnualDate: daysBefore(150), nextAnnualDue: daysFrom(215),
    last100hrDate: daysBefore(50), next100hrDue: daysFrom(50),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-04-02T16:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 145, prepay: 140.65, nonMember: 165, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Cessna 172P. 160 HP Lycoming O-320. Garmin Aera 660, GTX 327 ADS-B In/Out. Basic 4-seat trainer.',
    },
    weightBalance: {
      emptyWeightLbs: 1420, emptyArm: 39.5, maxGrossLbs: 2400, maxFuelUsableGal: 43, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 35,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-005', operator: 'journeys', tailNumber: 'N733JM',
    makeModel: 'Cessna 172N Skyhawk (180 HP conversion)', icaoType: 'C172',
    passengerCapacity: 3, year: null, opCostPerHour: 159,
    fuelCapacityGal: 43, fuelBurnGalHr: 9, emptyWeightLbs: 1450, maxGrossWeightLbs: 2450,
    cruiseSpeedKts: 120, serviceCeiling: 14200,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 7600, lastAnnualDate: daysBefore(100), nextAnnualDue: daysFrom(265),
    last100hrDate: daysBefore(35), next100hrDue: daysFrom(65),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-04-02T17:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 159, prepay: 154.23, nonMember: 179, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: true, autopilot: true, glassPanel: true, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 172N with 180 HP O-360 conversion. Garmin 650, Dual G5s, Stratus ADS-B In/Out, S-Tec 2-Axis AP. Best-equipped 172 in fleet.',
    },
    weightBalance: {
      emptyWeightLbs: 1450, emptyArm: 39.5, maxGrossLbs: 2450, maxFuelUsableGal: 43, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 35,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-006', operator: 'journeys', tailNumber: 'N333RX',
    makeModel: 'Cessna 172G Skyhawk (180 HP conversion)', icaoType: 'C172',
    passengerCapacity: 3, year: null, opCostPerHour: 145,
    fuelCapacityGal: 39, fuelBurnGalHr: 9, emptyWeightLbs: 1375, maxGrossWeightLbs: 2300,
    cruiseSpeedKts: 118, serviceCeiling: 13100,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 10200, lastAnnualDate: daysBefore(80), nextAnnualDue: daysFrom(285),
    last100hrDate: daysBefore(45), next100hrDue: daysFrom(55),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-04-01T16:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 145, prepay: 140.65, nonMember: 165, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 172G with 180 HP conversion. Garmin 430 GPS, ADS-B In/Out. Older airframe, lower cost.',
    },
    weightBalance: {
      emptyWeightLbs: 1375, emptyArm: 39.5, maxGrossLbs: 2300, maxFuelUsableGal: 39, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 30,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-007', operator: 'journeys', tailNumber: 'N6694E',
    makeModel: 'Cessna 172N Skyhawk', icaoType: 'C172',
    passengerCapacity: 3, year: null, opCostPerHour: 161,
    fuelCapacityGal: 43, fuelBurnGalHr: 8.5, emptyWeightLbs: 1450, maxGrossWeightLbs: 2300,
    cruiseSpeedKts: 115, serviceCeiling: 14200,
    serialNumber: null, airworthy: true, inspectionStatus: 'due_soon',
    totalAirframeHours: 8800, lastAnnualDate: daysBefore(300), nextAnnualDue: daysFrom(65),
    last100hrDate: daysBefore(70), next100hrDue: daysFrom(30),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-04-02T12:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 161, prepay: 156.17, nonMember: 181, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: true, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 172N. 160 HP. Garmin 430W WAAS, Dual Garmin G5, Stratus ADS-B In/Out.',
    },
    weightBalance: {
      emptyWeightLbs: 1450, emptyArm: 39.5, maxGrossLbs: 2300, maxFuelUsableGal: 43, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 35,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-008', operator: 'journeys', tailNumber: 'N3547L',
    makeModel: 'Cessna 172S Skyhawk SP (TAA)', icaoType: 'C172',
    passengerCapacity: 3, year: null, opCostPerHour: 165,
    fuelCapacityGal: 53, fuelBurnGalHr: 9, emptyWeightLbs: 1663, maxGrossWeightLbs: 2550,
    cruiseSpeedKts: 122, serviceCeiling: 14000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 3200, lastAnnualDate: daysBefore(60), nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(20), next100hrDue: daysFrom(80),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-04-02T17:30:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 165, prepay: 160.05, nonMember: 185, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Private',
    equipment: { ifrCertified: true, autopilot: true, glassPanel: true, fiki: false, oxygen: false, pressurized: false, gpwsTaws: true, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 172S SP — TAA. Garmin G3X, GNX375, GFC500 Autopilot, ADS-B In/Out. Fuel injected IO-360-L2A. Requires Private certificate to rent solo.',
    },
    weightBalance: {
      emptyWeightLbs: 1663, emptyArm: 39.5, maxGrossLbs: 2550, maxFuelUsableGal: 53, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 45,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 48.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 }, aftBaggage: { arm: 123.0, maxWeightLbs: 50 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-009', operator: 'journeys', tailNumber: 'N401SS',
    makeModel: 'Cessna 182P Skylane', icaoType: 'C182',
    passengerCapacity: 3, year: null, opCostPerHour: 174,
    fuelCapacityGal: 65, fuelBurnGalHr: 12, emptyWeightLbs: 1645, maxGrossWeightLbs: 2950,
    cruiseSpeedKts: 140, serviceCeiling: 18100,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 6800, lastAnnualDate: daysBefore(110), nextAnnualDue: daysFrom(255),
    last100hrDate: daysBefore(55), next100hrDue: daysFrom(45),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(3), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T15:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 174, prepay: 168.78, nonMember: 194, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Pvt & 100TT, 15 takeoff & landing in make & model',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 182P Skylane. 230 HP Continental O-470-R. High-performance endorsement required. Garmin 650, Aera 560, Lynx 9000 ADS-B In/Out. Best mountain airplane in fleet. Requires Private + 100TT + 15 landings in type.',
    },
    weightBalance: {
      emptyWeightLbs: 1645, emptyArm: 41.6, maxGrossLbs: 2950, maxFuelUsableGal: 65, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 50,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 400 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 200 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-010', operator: 'journeys', tailNumber: 'N501EL',
    makeModel: 'American Champion Citabria 7ECA', icaoType: 'CIAB',
    passengerCapacity: 1, year: null, opCostPerHour: 182,
    fuelCapacityGal: 26, fuelBurnGalHr: 7, emptyWeightLbs: 1150, maxGrossWeightLbs: 1650,
    cruiseSpeedKts: 100, serviceCeiling: 13000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 5600, lastAnnualDate: daysBefore(75), nextAnnualDue: daysFrom(290),
    last100hrDate: daysBefore(15), next100hrDue: daysFrom(85),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-04-01T12:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 182, prepay: 176.54, nonMember: 202, unit: 'Hobbs hr wet' },
    soloInsuranceReq: 'Dual instruction only',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'American Champion Citabria 7ECA. 115 HP Lycoming O-235. DUAL INSTRUCTION ONLY — no solo rental. Tandem seating, conventional gear, aerobatic. Tailwheel instruction may incur parachute rental fee. Garmin 496 GPS, GTX 327.',
    },
    weightBalance: {
      emptyWeightLbs: 1150, emptyArm: 14.0, maxGrossLbs: 1650, maxFuelUsableGal: 26, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 20,
      stations: { frontSeats: { arm: 14.0, maxWeightLbs: 190 }, aftSeats: { arm: 25.0, maxWeightLbs: 190 }, fuel: { arm: 18.0 }, baggage: { arm: 42.0, maxWeightLbs: 50 } },
      cgLimits: { forwardIn: 11.0, aftIn: 19.0 },
    },
  },
  {
    id: 'ja-011', operator: 'journeys', tailNumber: 'N12JA',
    makeModel: 'Pipistrel Alpha Trainer (80 HP LSA)', icaoType: 'ALPT',
    passengerCapacity: 1, year: 2023, opCostPerHour: 119,
    fuelCapacityGal: 24, fuelBurnGalHr: 4.5, emptyWeightLbs: 615, maxGrossWeightLbs: 1212,
    cruiseSpeedKts: 108, serviceCeiling: 15000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 800, lastAnnualDate: daysBefore(45), nextAnnualDue: daysFrom(320),
    last100hrDate: daysBefore(10), next100hrDue: daysFrom(90),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-04-02T16:30:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 119, prepay: 115.43, nonMember: 139, unit: 'Tach hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Pipistrel Alpha Trainer. 2023. 80 HP Rotax 912 UL. BPRS ballistic parachute. GTR200, GTX445, Garmin 600 GPS. Tach time billing. Most affordable new trainer on the Front Range.',
    },
    weightBalance: {
      emptyWeightLbs: 615, emptyArm: null, maxGrossLbs: 1212, maxFuelUsableGal: 24, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 18,
      stations: { frontSeats: { arm: null, maxWeightLbs: 453 }, fuel: { arm: null } },
      cgLimits: null,
    },
  },
  {
    id: 'ja-012', operator: 'journeys', tailNumber: 'N202MM',
    makeModel: 'Pipistrel Virus SWiS-100 (LSA)', icaoType: 'VIRS',
    passengerCapacity: 1, year: null, opCostPerHour: 139,
    fuelCapacityGal: 28, fuelBurnGalHr: 5, emptyWeightLbs: 633, maxGrossWeightLbs: 1041,
    cruiseSpeedKts: 130, serviceCeiling: 15000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 1400, lastAnnualDate: daysBefore(90), nextAnnualDue: daysFrom(275),
    last100hrDate: daysBefore(30), next100hrDue: daysFrom(70),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(3), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-31T14:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    rentalRates: { member: 139, prepay: 134.83, nonMember: 159, unit: 'Tach hr wet' },
    soloInsuranceReq: 'Student',
    equipment: { ifrCertified: true, autopilot: true, glassPanel: true, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Pipistrel Virus SWiS-100. 100 HP Rotax 912 iS fuel injected. TAA: GMA245R, Garmin 650 NavCom, Autopilot, BPRS parachute. Tach time billing. High cruise speed for an LSA.',
    },
    weightBalance: {
      emptyWeightLbs: 633, emptyArm: null, maxGrossLbs: 1041, maxFuelUsableGal: 28, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 20,
      stations: { frontSeats: { arm: null, maxWeightLbs: 240 }, fuel: { arm: null } },
      cgLimits: null,
    },
  },

]

// ─── Equipment flag definitions (for display labels and risk logic) ───────────

export const EQUIPMENT_FLAGS = {
  ifrCertified:   { label: 'IFR',         icon: '🛰',  riskReducing: true,  note: 'Full IFR avionics suite' },
  autopilot:      { label: 'Autopilot',   icon: '🤖',  riskReducing: true,  note: 'Reduces single-pilot workload in IMC' },
  glassPanel:     { label: 'Glass',       icon: '🖥',  riskReducing: true,  note: 'EFIS / glass cockpit' },
  fiki:           { label: 'FIKI',        icon: '❄️',  riskReducing: true,  note: 'Flight Into Known Icing certified' },
  oxygen:         { label: 'O₂',          icon: '💨',  riskReducing: true,  note: 'Supplemental oxygen system' },
  pressurized:    { label: 'Pressurized', icon: '🏔',  riskReducing: true,  note: 'Pressurized cabin — O₂ not required to FL250' },
  gpwsTaws:       { label: 'TAWS',        icon: '⛰',  riskReducing: true,  note: 'Terrain awareness and warning system' },
  tcas:           { label: 'TCAS',        icon: '✈️',  riskReducing: true,  note: 'Traffic collision avoidance' },
  adsbOut:        { label: 'ADS-B Out',   icon: '📡',  riskReducing: false, note: 'Required in most controlled airspace' },
  adsbIn:         { label: 'ADS-B In',    icon: '📻',  riskReducing: true,  note: 'Real-time traffic and weather in cockpit' },
  stormscope:     { label: 'Stormscope',  icon: '⚡',  riskReducing: true,  note: 'Lightning/convective activity detection' },
}

export const RISK_PROFILE_FLAGS = {
  multiEngine:           { label: 'Multi-Engine',     icon: '✈️',  riskLevel: 'neutral', note: 'Engine-out redundancy; requires ME rating' },
  turboprop:             { label: 'Turboprop',        icon: '🔧',  riskLevel: 'caution', note: 'Turbine engine — different handling characteristics' },
  jetFuelInPropAircraft: { label: 'Jet-A fuel',       icon: '⛽',  riskLevel: 'caution', note: 'Burns Jet-A — confirm availability at all airports' },
  pressurized:           { label: 'Pressurized',      icon: '🏔',  riskLevel: 'neutral', note: 'Adds complexity; pressurization system management' },
  taildragger:           { label: 'Taildragger',      icon: '🛬',  riskLevel: 'high',    note: 'Conventional gear — higher ground loop risk' },
  complexAircraft:       { label: 'Complex',          icon: '⚙️',  riskLevel: 'caution', note: 'Retractable gear / CS prop — FAA complex endorsement' },
  highPerformance:       { label: 'High Performance', icon: '🔥',  riskLevel: 'caution', note: '>200 HP — FAA high performance endorsement required' },
  turbocharged:          { label: 'Turbocharged',     icon: '📈',  riskLevel: 'caution', note: 'Turbo/supercharged — density altitude less limiting' },
  ifr:                   { label: 'IFR Ops',          icon: '☁️',  riskLevel: 'neutral', note: 'Regularly operated IFR' },
  singlePilotCertified:  { label: 'Single Pilot',     icon: '👤',  riskLevel: 'neutral', note: 'Certified for single-pilot operations' },
}

// ─── Operator definitions ────────────────────────────────────────────────────
export const OPERATORS = {
  flightsafe: { id: 'flightsafe', name: 'FlightSafe SMS',        short: 'FlightSafe', color: 'sky' },
  journeys:   { id: 'journeys',   name: 'Journeys Aviation',     short: 'Journeys',   color: 'blue' },
  mhg:        { id: 'mhg',        name: 'Mile High Gliding',     short: 'MHG',        color: 'indigo' },
  ssb:        { id: 'ssb',        name: 'Soaring Society of Boulder', short: 'SSB',    color: 'purple' },
}

// Helper: filter aircraft by operator
export const getAircraftByOperator = (op) => mockAircraft.filter((a) => a.operator === op)

// Fleet summary for scorecard (all operators combined)
export const mockFleetSummary = {
  total:              24,
  airworthy:          23,
  grounded:           1,
  melOpen:            2,
  openSquawks:        3,
  inspectionsDueSoon: 3,
  adOpenItems:        2,
  ifrCapable:        16,
  fikiEquipped:       4,    // N12345, N22222, N44444, N55555
  multiEngine:        2,    // N12345, N44444
  turboprop:          2,    // N22222, N55555
  gliders:            2,    // N8001G, N8002G
  towPlanes:          3,    // N3456P (Pawnee), N7890C, N1234C (Super Cubs)
  journeysFleet:     12,    // Journeys Aviation powered aircraft
}
