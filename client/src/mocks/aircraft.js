// Aircraft registry — full fleet with airworthiness, inspection status, equipment, and risk characteristics
// inspectionStatus: current | due_soon | overdue
// airworthy: true | false
//
// equipment   — safety systems physically installed on the aircraft
// riskProfile — operational characteristics that drive pilot qualifications and mission risk

const today = new Date('2026-03-21')
const daysFrom   = (d) => new Date(today.getTime() + d * 86_400_000).toISOString().split('T')[0]
const daysBefore = (d) => daysFrom(-d)

export const mockAircraft = [
  {
    id: 'ac-001',
    tailNumber: 'N12345',
    makeModel: 'Beechcraft Baron 58',
    icaoType: 'BE58',
    passengerCapacity: 5,
    opCostPerHour: 870,     // twin piston — fuel + mx
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
  },

  {
    id: 'ac-002',
    tailNumber: 'N67890',
    makeModel: 'Cessna 172S Skyhawk',
    icaoType: 'C172',
    passengerCapacity: 3,
    opCostPerHour: 180,
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
  },

  {
    id: 'ac-003',
    tailNumber: 'N11111',
    makeModel: 'Piper Cherokee 28',
    icaoType: 'PA28',
    passengerCapacity: 3,
    opCostPerHour: 155,
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
  },

  {
    id: 'ac-004',
    tailNumber: 'N22222',
    makeModel: 'Cessna 208 Caravan',
    icaoType: 'C208',
    passengerCapacity: 9,
    opCostPerHour: 680,
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
    currentLocation: 'ramp',
    locationUpdatedAt: '2026-03-28T08:00:00',
    locationUpdatedBy: 'prs-010',  // Sam Nguyen — autopilot MEL cleared, back on ramp
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
    tailNumber: 'N33333',
    makeModel: 'Cessna 172N Skyhawk',
    icaoType: 'C172',
    passengerCapacity: 3,
    opCostPerHour: 175,
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
    tailNumber: 'N44444',
    makeModel: 'Piper PA-34 Seneca',
    icaoType: 'PA34',
    passengerCapacity: 5,
    opCostPerHour: 310,
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
    tailNumber: 'N55555',
    makeModel: 'Cessna 208B Grand Caravan',
    icaoType: 'C208',
    passengerCapacity: 9,
    opCostPerHour: 695,
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

// Fleet summary for scorecard
export const mockFleetSummary = {
  total:              7,
  airworthy:          6,
  grounded:           1,
  melOpen:            2,
  openSquawks:        3,
  inspectionsDueSoon: 2,
  adOpenItems:        2,
  ifrCapable:         6,    // all except N33333
  fikiEquipped:       4,    // N12345, N22222, N44444, N55555
  multiEngine:        2,    // N12345, N44444
  turboprop:          2,    // N22222, N55555
}
