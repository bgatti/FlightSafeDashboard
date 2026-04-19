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

  // ── Mile High Gliding fleet ────────────────────────────────────────────────

  {
    id: 'ac-008', operator: 'mhg', tailNumber: 'N103RH',
    makeModel: 'Experimental (unknown type)', icaoType: 'VENT',
    passengerCapacity: 1, year: null, opCostPerHour: 120,
    fuelCapacityGal: 30, fuelBurnGalHr: 8, emptyWeightLbs: 1200, maxGrossWeightLbs: 1800,
    cruiseSpeedKts: 100, serviceCeiling: 14000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 2_400, lastAnnualDate: daysBefore(60), nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(30), next100hrDue: daysFrom(70),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-30T10:00:00', locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Experimental/unknown type. VFR only. ADS-B Out.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-009', operator: 'mhg', tailNumber: 'N2183V',
    makeModel: 'Piper PA-32R', icaoType: 'P32R',
    passengerCapacity: 5, year: null, opCostPerHour: 220,
    fuelCapacityGal: 84, fuelBurnGalHr: 14, emptyWeightLbs: 2100, maxGrossWeightLbs: 3600,
    cruiseSpeedKts: 155, serviceCeiling: 16700,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 4_500, lastAnnualDate: daysBefore(45), nextAnnualDue: daysFrom(320),
    last100hrDate: daysBefore(15), next100hrDue: daysFrom(85),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T15:30:00', locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: true, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Piper PA-32R. Retractable gear, complex aircraft. High-performance endorsement required. 6-seat single.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-010', operator: 'mhg', tailNumber: 'N48GD',
    makeModel: 'Glider (unknown type)', icaoType: 'GLID',
    passengerCapacity: 1, year: null, opCostPerHour: 85,
    fuelCapacityGal: 0, fuelBurnGalHr: 0, emptyWeightLbs: 600, maxGrossWeightLbs: 1100,
    cruiseSpeedKts: 50, serviceCeiling: 18000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 3_200, lastAnnualDate: daysBefore(50), nextAnnualDue: daysFrom(315),
    last100hrDate: daysBefore(25), next100hrDue: daysFrom(75),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-30T10:00:00', locationUpdatedBy: 'prs-001',
    fuelType: null, fboCategory: 'glider',
    glider: true, needs_tow: true,
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Glider — requires aerotow for launch. VFR day only. Glider pilot certificate required.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-011', operator: 'mhg', tailNumber: 'N58219',
    makeModel: 'Boeing/Stearman PT-17 Kaydet', icaoType: 'ST75',
    passengerCapacity: 1, year: null, opCostPerHour: 250,
    fuelCapacityGal: 46, fuelBurnGalHr: 14, emptyWeightLbs: 1936, maxGrossWeightLbs: 2717,
    cruiseSpeedKts: 95, serviceCeiling: 11200,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 6_800, lastAnnualDate: daysBefore(30), nextAnnualDue: daysFrom(335),
    last100hrDate: daysBefore(30), next100hrDue: daysFrom(70),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(3), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-29T14:00:00', locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Boeing/Stearman PT-17 Kaydet biplane. Continental R-670. Taildragger — conventional gear endorsement required. Open cockpit, tandem seating. VFR day only.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-012', operator: 'mhg', tailNumber: 'N584RH',
    makeModel: 'Robinson R-44 Raven', icaoType: 'R44',
    icaoHex: 'a78643',
    passengerCapacity: 3, year: null, opCostPerHour: 350,
    fuelCapacityGal: 31, fuelBurnGalHr: 14, emptyWeightLbs: 1495, maxGrossWeightLbs: 2500,
    cruiseSpeedKts: 110, serviceCeiling: 14000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 2_100, lastAnnualDate: daysBefore(40), nextAnnualDue: daysFrom(325),
    last100hrDate: daysBefore(20), next100hrDue: daysFrom(80),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T16:00:00', locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Robinson R-44 Raven helicopter. Lycoming IO-540, 245 HP. Requires rotorcraft-helicopter rating. VFR only.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-013', operator: 'mhg', tailNumber: 'N697RM',
    makeModel: 'Robinson R-44 Raven', icaoType: 'R44',
    icaoHex: 'a9463a',
    passengerCapacity: 3, year: null, opCostPerHour: 350,
    fuelCapacityGal: 31, fuelBurnGalHr: 14, emptyWeightLbs: 1495, maxGrossWeightLbs: 2500,
    cruiseSpeedKts: 110, serviceCeiling: 14000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 1_800, lastAnnualDate: daysBefore(55), nextAnnualDue: daysFrom(310),
    last100hrDate: daysBefore(25), next100hrDue: daysFrom(75),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-30T17:00:00', locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: false, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Robinson R-44 Raven helicopter. Lycoming IO-540, 245 HP. Requires rotorcraft-helicopter rating. VFR only.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-014', operator: 'mhg', tailNumber: 'N717VS',
    makeModel: 'Beechcraft Duke 60', icaoType: 'BE60',
    passengerCapacity: 5, year: null, opCostPerHour: 550,
    fuelCapacityGal: 232, fuelBurnGalHr: 40, emptyWeightLbs: 4450, maxGrossWeightLbs: 6775,
    cruiseSpeedKts: 220, serviceCeiling: 30000,
    singleEngineCeiling: 16600,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 3_600, lastAnnualDate: daysBefore(70), nextAnnualDue: daysFrom(295),
    last100hrDate: daysBefore(35), next100hrDue: daysFrom(65),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(4), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-28T14:00:00', locationUpdatedBy: 'prs-001',
    fuelType: 'avgas_100ll', fboCategory: 'piston_twin',
    equipment: { ifrCertified: true, autopilot: true, glassPanel: false, fiki: true, oxygen: true, pressurized: true, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: true, turboprop: false, jetFuelInPropAircraft: false, pressurized: true, taildragger: false, complexAircraft: true, highPerformance: true, turbocharged: true, singlePilotCertified: true, ifr: true,
      notes: 'Beechcraft Duke 60. Twin turbocharged Lycoming TIO-541. Pressurized, complex, high-performance. Multi-engine rating required. FIKI equipped.',
    },
    weightBalance: null,
  },

  {
    id: 'ac-015', operator: 'mhg', tailNumber: 'N77FD',
    makeModel: 'Cessna 501 Citation 1SP', icaoType: 'C501',
    passengerCapacity: 6, year: null, opCostPerHour: 1800,
    fuelCapacityGal: 542, fuelBurnGalHr: 130, emptyWeightLbs: 7100, maxGrossWeightLbs: 11850,
    cruiseSpeedKts: 350, serviceCeiling: 41000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 5_200, lastAnnualDate: daysBefore(50), nextAnnualDue: daysFrom(315),
    last100hrDate: daysBefore(20), next100hrDue: daysFrom(80),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(5), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-27T10:00:00', locationUpdatedBy: 'prs-001',
    fuelType: 'jet_a', fboCategory: 'jet',
    equipment: { ifrCertified: true, autopilot: true, glassPanel: false, fiki: true, oxygen: true, pressurized: true, gpwsTaws: true, tcas: true, adsbOut: true, adsbIn: true, elt: '406', stormscope: true },
    riskProfile: { multiEngine: true, turboprop: false, jetFuelInPropAircraft: false, pressurized: true, taildragger: false, complexAircraft: true, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Cessna 501 Citation 1SP. Twin Pratt & Whitney JT15D turbofans. Jet — type rating required. Pressurized, FIKI, TCAS, TAWS. Burns Jet-A.',
    },
    weightBalance: null,
  },

  // ─── Journeys Aviation fleet (KBDU FBO / Flight School) ─────────────────

  {
    id: 'ja-001', operator: 'journeys', tailNumber: 'N12JA',
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
    id: 'ja-002', operator: 'journeys', tailNumber: 'N134BC',
    makeModel: 'Schweizer SGS 1-34', icaoType: 'GLID',
    passengerCapacity: 0, year: null, opCostPerHour: 60,
    fuelCapacityGal: 0, fuelBurnGalHr: 0, emptyWeightLbs: 450, maxGrossWeightLbs: 700,
    cruiseSpeedKts: 50, serviceCeiling: 18000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 3_800, lastAnnualDate: daysBefore(80), nextAnnualDue: daysFrom(285),
    last100hrDate: daysBefore(40), next100hrDue: daysFrom(60),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(3), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T14:00:00', locationUpdatedBy: null,
    fuelType: null, fboCategory: 'glider',
    glider: true, needs_tow: true,
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Schweizer SGS 1-34. Single-seat glider. Requires aerotow for launch. VFR day only. Glider pilot certificate required.',
    },
    weightBalance: null,
  },
  {
    id: 'ja-003', operator: 'journeys', tailNumber: 'N202MM',
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
  {
    id: 'ja-004', operator: 'journeys', tailNumber: 'N2471W',
    makeModel: 'Schweizer SGS 2-32', icaoType: 'GLID',
    icaoHex: 'a24c90',
    passengerCapacity: 1, year: 1964, opCostPerHour: 75,
    fuelCapacityGal: 0, fuelBurnGalHr: 0, emptyWeightLbs: 850, maxGrossWeightLbs: 1430,
    cruiseSpeedKts: 50, serviceCeiling: 18000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 5_600, lastAnnualDate: daysBefore(70), nextAnnualDue: daysFrom(295),
    last100hrDate: daysBefore(35), next100hrDue: daysFrom(65),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-04-01T12:00:00', locationUpdatedBy: null,
    fuelType: null, fboCategory: 'glider',
    glider: true, needs_tow: true,
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Schweizer SGS 2-32. 2-seat glider (1964). Requires aerotow for launch. VFR day only. Used for spin training and upset recovery. Glider pilot certificate required.',
    },
    weightBalance: null,
  },
  {
    id: 'ja-005', operator: 'journeys', tailNumber: 'N333RX',
    makeModel: 'Cessna 172 Skyhawk', icaoType: 'C172',
    icaoHex: 'a3a281',
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
      notes: 'Cessna 172 Skyhawk. Garmin 430 GPS, ADS-B In/Out. Older airframe, lower cost.',
    },
    weightBalance: {
      emptyWeightLbs: 1375, emptyArm: 39.5, maxGrossLbs: 2300, maxFuelUsableGal: 39, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 30,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-006', operator: 'journeys', tailNumber: 'N4337Y',
    makeModel: 'Piper PA-25 Pawnee', icaoType: 'PA25',
    icaoHex: 'a531a7',
    passengerCapacity: 0, year: null, opCostPerHour: 110,
    fuelCapacityGal: 36, fuelBurnGalHr: 12, emptyWeightLbs: 1230, maxGrossWeightLbs: 2000,
    cruiseSpeedKts: 90, serviceCeiling: 14500,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 6_500, lastAnnualDate: daysBefore(30), nextAnnualDue: daysFrom(335),
    last100hrDate: daysBefore(30), next100hrDue: daysFrom(70),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T16:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    is_tow: true,
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Piper PA-25 Pawnee tow plane. 235 HP Lycoming O-540. Taildragger — conventional gear endorsement required. Tow-certified pilot required.',
    },
    weightBalance: null,
  },
  {
    id: 'ja-007', operator: 'journeys', tailNumber: 'N4384A',
    makeModel: 'Piper PA-18 Super Cub', icaoType: 'PA18',
    passengerCapacity: 1, year: null, opCostPerHour: 90,
    fuelCapacityGal: 18, fuelBurnGalHr: 9, emptyWeightLbs: 930, maxGrossWeightLbs: 1750,
    cruiseSpeedKts: 85, serviceCeiling: 19000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 8_200, lastAnnualDate: daysBefore(60), nextAnnualDue: daysFrom(305),
    last100hrDate: daysBefore(20), next100hrDue: daysFrom(80),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(2), assignedBase: 'KBDU', currentLocation: 'hangar',
    locationUpdatedAt: '2026-03-30T17:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    is_tow: true,
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: false, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Piper PA-18 Super Cub tow plane. 150 HP Lycoming O-320. Taildragger — conventional gear endorsement required. Tow-certified pilot required.',
    },
    weightBalance: null,
  },
  {
    id: 'ja-008', operator: 'journeys', tailNumber: 'N501EL',
    makeModel: 'Bellanca 7GCBC Citabria', icaoType: 'CH7A',
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
      notes: 'Bellanca 7GCBC Citabria. 150 HP Lycoming O-320. DUAL INSTRUCTION ONLY — no solo rental. Tandem seating, conventional gear, aerobatic. Tailwheel endorsement required.',
    },
    weightBalance: {
      emptyWeightLbs: 1150, emptyArm: 14.0, maxGrossLbs: 1650, maxFuelUsableGal: 26, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 20,
      stations: { frontSeats: { arm: 14.0, maxWeightLbs: 190 }, aftSeats: { arm: 25.0, maxWeightLbs: 190 }, fuel: { arm: 18.0 }, baggage: { arm: 42.0, maxWeightLbs: 50 } },
      cgLimits: { forwardIn: 11.0, aftIn: 19.0 },
    },
  },
  {
    id: 'ja-009', operator: 'journeys', tailNumber: 'N52993',
    makeModel: 'Cessna 172 Skyhawk', icaoType: 'C172',
    icaoHex: 'a6ae0c',
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
      notes: 'Cessna 172 Skyhawk. 160 HP Lycoming O-320. Garmin Aera 660, GTX 327 ADS-B In/Out. Basic 4-seat trainer.',
    },
    weightBalance: {
      emptyWeightLbs: 1420, emptyArm: 39.5, maxGrossLbs: 2400, maxFuelUsableGal: 43, fuelWeightPerGal: 6.0, standardTrainingFuelGal: 35,
      stations: { frontSeats: { arm: 37.0, maxWeightLbs: 400 }, aftSeats: { arm: 73.0, maxWeightLbs: 340 }, fuel: { arm: 46.0 }, baggage: { arm: 95.0, maxWeightLbs: 120 } },
      cgLimits: { forwardIn: 35.0, aftIn: 47.3 },
    },
  },
  {
    id: 'ja-010', operator: 'journeys', tailNumber: 'N6027P',
    makeModel: 'Piper PA-24 Comanche', icaoType: 'PA24',
    passengerCapacity: 3, year: null, opCostPerHour: 195,
    fuelCapacityGal: 60, fuelBurnGalHr: 12, emptyWeightLbs: 1680, maxGrossWeightLbs: 2900,
    cruiseSpeedKts: 155, serviceCeiling: 20000,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 5_400, lastAnnualDate: daysBefore(100), nextAnnualDue: daysFrom(265),
    last100hrDate: daysBefore(40), next100hrDue: daysFrom(60),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(3), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T15:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    equipment: { ifrCertified: true, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: true, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: false, complexAircraft: true, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: true,
      notes: 'Piper PA-24 Comanche. 250 HP Lycoming O-540. Complex (retractable gear, CS prop). High-performance endorsement required.',
    },
    weightBalance: null,
  },
  {
    id: 'ja-011', operator: 'journeys', tailNumber: 'N6719Z',
    makeModel: 'Piper PA-25 Pawnee', icaoType: 'PA25',
    icaoHex: 'a8e31a',
    passengerCapacity: 0, year: null, opCostPerHour: 110,
    fuelCapacityGal: 36, fuelBurnGalHr: 12, emptyWeightLbs: 1230, maxGrossWeightLbs: 2000,
    cruiseSpeedKts: 90, serviceCeiling: 14500,
    serialNumber: null, airworthy: true, inspectionStatus: 'current',
    totalAirframeHours: 7_100, lastAnnualDate: daysBefore(10), nextAnnualDue: daysFrom(355),
    last100hrDate: daysBefore(10), next100hrDue: daysFrom(90),
    melItemsOpen: [], openSquawks: [], airworthinessDirectives: [],
    lastFlightDate: daysBefore(1), assignedBase: 'KBDU', currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-31T16:00:00', locationUpdatedBy: null,
    fuelType: 'avgas_100ll', fboCategory: 'piston_single',
    is_tow: true,
    equipment: { ifrCertified: false, autopilot: false, glassPanel: false, fiki: false, oxygen: false, pressurized: false, gpwsTaws: false, tcas: false, adsbOut: true, adsbIn: false, elt: '406', stormscope: false },
    riskProfile: { multiEngine: false, turboprop: false, jetFuelInPropAircraft: false, pressurized: false, taildragger: true, complexAircraft: false, highPerformance: true, turbocharged: false, singlePilotCertified: true, ifr: false,
      notes: 'Piper PA-25 Pawnee tow plane. 235 HP Lycoming O-540. Taildragger — conventional gear endorsement required. Tow-certified pilot required.',
    },
    weightBalance: null,
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
  total:              26,   // 7 FlightSafe + 8 MHG + 11 Journeys
  airworthy:          25,
  grounded:           1,
  melOpen:            2,
  openSquawks:        3,
  inspectionsDueSoon: 1,
  adOpenItems:        2,
  ifrCapable:        15,
  fikiEquipped:       5,    // N12345, N22222, N44444, N55555, N717VS
  multiEngine:        3,    // N12345, N44444, N717VS
  turboprop:          2,    // N22222, N55555
  gliders:            3,    // N134BC (SGS 1-34), N2471W (SGS 2-32), N48GD
  towPlanes:          3,    // N4337Y, N4384A (Super Cub), N6719Z (Pawnees)
  journeysFleet:     11,    // Journeys Aviation fleet
}
