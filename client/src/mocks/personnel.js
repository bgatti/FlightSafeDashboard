// Personnel roster — pilots, crew, and ground service
// Training status: current | expiring | expired
// Role: pilot_pic | pilot_sic | dispatcher | mechanic | ground | safety_officer | admin

const today = new Date('2026-03-21')
const daysFrom = (d) => new Date(today.getTime() + d * 86_400_000).toISOString().split('T')[0]
const daysBefore = (d) => daysFrom(-d)

export const mockPersonnel = [
  // ─── Flight Crew ──────────────────────────────────────────────────────────
  {
    id: 'prs-001',
    name: 'James Smith',
    weightLbs: 192,
    role: 'pilot_pic',
    roleLabel: 'Chief Pilot',
    isChiefPilot: true,
    department: 'Flight Operations',
    certificateNumber: 'ATP-4421190',
    certType: 'ATP',
    cfiCert: 'CFI-4421190',
    cfiRatings: ['CFI', 'CFII', 'MEI'],
    medicalClass: 1,
    medicalExpiry: daysFrom(165),
    lastFlightReview: daysBefore(280),
    ifrCurrencyExpiry: daysFrom(28),       // expiring soon
    nightCurrencyExpiry: daysFrom(55),
    dutyHoursLast30d: 62,
    flightHoursYtd: 214,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2025-06-15', status: 'current', nextDue: '2027-06-15' },
      { course: 'HAZMAT Awareness',          completedOn: '2024-11-20', status: 'current', nextDue: '2026-11-20' },
      { course: 'Emergency Procedures',      completedOn: '2025-03-01', status: 'current', nextDue: '2027-03-01' },
    ],
  },
  {
    id: 'prs-002',
    name: 'Rachel Jones',
    weightLbs: 143,
    role: 'pilot_sic',
    roleLabel: 'Pilot — SIC',
    department: 'Flight Operations',
    certificateNumber: 'CPL-8812044',
    certType: 'Commercial',
    cfiCert: 'CFI-8812044',
    cfiRatings: ['CFI'],
    medicalClass: 2,
    medicalExpiry: daysFrom(90),
    lastFlightReview: daysBefore(180),
    ifrCurrencyExpiry: daysFrom(70),
    nightCurrencyExpiry: daysFrom(-5),     // expired
    dutyHoursLast30d: 45,
    flightHoursYtd: 160,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-02-01', status: 'current', nextDue: '2027-02-01' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2024-06-10', status: 'expiring', nextDue: daysFrom(20) },
      { course: 'HAZMAT Awareness',          completedOn: '2024-11-01', status: 'current', nextDue: '2026-11-01' },
      { course: 'Emergency Procedures',      completedOn: '2025-01-15', status: 'current', nextDue: '2027-01-15' },
    ],
  },
  {
    id: 'prs-003',
    name: 'Marcus Davis',
    weightLbs: 183,
    role: 'pilot_pic',
    roleLabel: 'Pilot — PIC',
    towCertified: true,
    department: 'Flight Operations',
    certificateNumber: 'ATP-9930017',
    certType: 'ATP',
    medicalClass: 1,
    medicalExpiry: daysFrom(210),
    lastFlightReview: daysBefore(90),
    ifrCurrencyExpiry: daysFrom(120),
    nightCurrencyExpiry: daysFrom(100),
    dutyHoursLast30d: 58,
    flightHoursYtd: 198,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-15', status: 'current', nextDue: '2027-01-15' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2025-07-20', status: 'current', nextDue: '2027-07-20' },
      { course: 'HAZMAT Awareness',          completedOn: '2025-01-05', status: 'current', nextDue: '2027-01-05' },
      { course: 'Emergency Procedures',      completedOn: '2025-02-10', status: 'current', nextDue: '2027-02-10' },
    ],
  },
  {
    id: 'prs-004',
    name: 'Anika Patel',
    weightLbs: 138,
    role: 'pilot_sic',
    roleLabel: 'Pilot — SIC',
    department: 'Flight Operations',
    certificateNumber: 'CPL-7701234',
    certType: 'Commercial',
    medicalClass: 2,
    medicalExpiry: daysFrom(320),
    lastFlightReview: daysBefore(60),
    ifrCurrencyExpiry: daysFrom(180),
    nightCurrencyExpiry: daysFrom(90),
    dutyHoursLast30d: 40,
    flightHoursYtd: 130,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-03-01', status: 'current', nextDue: '2027-03-01' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2025-03-15', status: 'current', nextDue: '2027-03-15' },
      { course: 'HAZMAT Awareness',          completedOn: '2025-02-01', status: 'current', nextDue: '2027-02-01' },
      { course: 'Emergency Procedures',      completedOn: '2024-09-10', status: 'expiring', nextDue: daysFrom(30) },
    ],
  },
  {
    id: 'prs-005',
    name: 'Carlos Rivera',
    weightLbs: 198,
    role: 'pilot_pic',
    roleLabel: 'Pilot — PIC',
    department: 'Flight Operations',
    certificateNumber: 'ATP-5540088',
    certType: 'ATP',
    medicalClass: 1,
    medicalExpiry: daysFrom(-10),          // expired
    lastFlightReview: daysBefore(400),
    ifrCurrencyExpiry: daysFrom(200),
    nightCurrencyExpiry: daysFrom(150),
    dutyHoursLast30d: 70,
    flightHoursYtd: 241,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2024-12-01', status: 'current', nextDue: '2026-12-01' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2024-05-01', status: 'current', nextDue: '2026-05-01' },
      { course: 'HAZMAT Awareness',          completedOn: '2023-11-15', status: 'expired',  nextDue: '2025-11-15' },
      { course: 'Emergency Procedures',      completedOn: '2024-08-01', status: 'current', nextDue: '2026-08-01' },
    ],
  },
  // ─── Dispatchers ──────────────────────────────────────────────────────────
  {
    id: 'prs-006',
    name: 'Alex Torres',
    role: 'dispatcher',
    roleLabel: 'Dispatcher',
    department: 'Operations',
    certificateNumber: 'ADD-220044',
    certType: 'Aircraft Dispatcher',
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 88,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-20', status: 'current', nextDue: '2027-01-20' },
      { course: 'Emergency Procedures',      completedOn: '2025-01-20', status: 'current', nextDue: '2027-01-20' },
      { course: 'HAZMAT Awareness',          completedOn: '2025-01-20', status: 'current', nextDue: '2027-01-20' },
    ],
  },
  // ─── Safety Officer ────────────────────────────────────────────────────────
  {
    id: 'prs-007',
    name: 'Jordan Lee',
    role: 'safety_officer',
    roleLabel: 'Safety Manager',
    department: 'Safety',
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 80,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-05', status: 'current', nextDue: '2027-01-05' },
      { course: 'SMS Implementation (CAST)', completedOn: '2025-02-10', status: 'current', nextDue: '2028-02-10' },
      { course: 'Root Cause Analysis',       completedOn: '2025-03-01', status: 'current', nextDue: '2028-03-01' },
      { course: 'Emergency Procedures',      completedOn: '2025-01-05', status: 'current', nextDue: '2027-01-05' },
    ],
  },
  // ─── Mechanics ────────────────────────────────────────────────────────────
  {
    id: 'prs-008',
    name: 'Tyler Brooks',
    role: 'mechanic',
    roleLabel: 'A&P Mechanic',
    department: 'Maintenance',
    certificateNumber: 'AME-774412',
    certType: 'A&P',
    canReturnToService: false,    // A&P only — no IA authority
    supervisorId: 'prs-011',      // reports to Sarah Cole
    currentLocation: 'on_prem',
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 12,    // on wo-003 (pitot heat), standing by for part arrival
    specializations: ['piston', 'airframe', 'powerplant'],
    yearsExperience: 8,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 92,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current',  nextDue: '2027-01-10' },
      { course: 'HAZMAT Handling',           completedOn: '2024-10-15', status: 'current',  nextDue: '2026-10-15' },
      { course: 'FOD Awareness',             completedOn: '2025-02-01', status: 'current',  nextDue: '2027-02-01' },
    ],
  },
  {
    id: 'prs-009',
    name: 'Diane Wu',
    role: 'mechanic',
    roleLabel: 'A&P / IA',
    department: 'Maintenance',
    certificateNumber: 'AME-881022',
    certType: 'A&P / IA',
    canReturnToService: true,     // IA — can sign off annual/100hr return-to-service
    supervisorId: null,           // senior inspector; no internal supervisor
    currentLocation: 'on_prem',
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 20,    // supervising multiple open WOs, airworthiness reviews
    specializations: ['piston', 'turbine', 'avionics', 'airframe', 'powerplant'],
    yearsExperience: 18,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 86,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2024-12-15', status: 'current',  nextDue: '2026-12-15' },
      { course: 'HAZMAT Handling',           completedOn: '2024-10-01', status: 'current',  nextDue: '2026-10-01' },
      { course: 'FOD Awareness',             completedOn: '2024-12-15', status: 'current',  nextDue: '2026-12-15' },
    ],
  },
  {
    id: 'prs-011',
    name: 'Sarah Cole',
    role: 'mechanic',
    roleLabel: 'A&P / IA — Chief Inspector',
    department: 'Maintenance',
    certificateNumber: 'AME-991055',
    certType: 'A&P / IA',
    canReturnToService: true,     // IA — primary signer for all RTS and annual sign-offs
    supervisorId: null,           // chief inspector — reports to DOM
    currentLocation: 'on_prem',
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 36,    // lead on wo-001 (AOG), wo-005, wo-006 — heavily loaded
    specializations: ['piston', 'turbine', 'airframe', 'powerplant', 'inspection'],
    yearsExperience: 22,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 96,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-08', status: 'current',  nextDue: '2027-01-08' },
      { course: 'HAZMAT Handling',           completedOn: '2025-02-10', status: 'current',  nextDue: '2027-02-10' },
      { course: 'FOD Awareness',             completedOn: '2025-01-08', status: 'current',  nextDue: '2027-01-08' },
      { course: 'Human Factors in Mx',       completedOn: '2025-03-01', status: 'current',  nextDue: '2027-03-01' },
    ],
  },
  {
    id: 'prs-012',
    name: 'Mike Ferris',
    role: 'mechanic',
    roleLabel: 'A&P Mechanic',
    department: 'Maintenance',
    certificateNumber: 'AME-662301',
    certType: 'A&P',
    canReturnToService: false,
    supervisorId: 'prs-011',      // reports to Sarah Cole
    currentLocation: 'on_prem',
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 22,    // lead on wo-002 (brake repair), waiting on master cylinder
    specializations: ['piston', 'airframe', 'landing_gear', 'hydraulics'],
    yearsExperience: 12,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 84,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-15', status: 'current',  nextDue: '2027-01-15' },
      { course: 'HAZMAT Handling',           completedOn: '2024-11-20', status: 'current',  nextDue: '2026-11-20' },
      { course: 'FOD Awareness',             completedOn: '2025-01-15', status: 'current',  nextDue: '2027-01-15' },
    ],
  },
  {
    id: 'prs-013',
    name: 'T. Huang',
    role: 'mechanic',
    roleLabel: 'Avionics Technician (External)',
    department: 'Maintenance',    // external contractor, attached to Maintenance
    certificateNumber: 'AVN-330812',
    certType: 'A&P',              // Garmin-certified avionics specialist
    canReturnToService: false,
    supervisorId: null,            // external contractor
    currentLocation: 'off_site',   // scheduled on-site 2026-04-02
    capacityHoursPerWeek: null,    // external — billed per engagement
    assignedHoursThisWeek: 0,
    specializations: ['avionics', 'garmin', 'autopilot'],
    yearsExperience: 15,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 0,
    flightHoursYtd: 0,
    training: [
      { course: 'Garmin G1000 / GFC 700 Certification', completedOn: '2024-06-01', status: 'current', nextDue: '2026-06-01' },
    ],
  },
  // ─── Ground Service ────────────────────────────────────────────────────────
  {
    id: 'prs-010',
    name: 'Sam Nguyen',
    role: 'ground',
    roleLabel: 'Ground Handler / Line Tech',
    fboRole: 'ground_handler',
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 3,             // 3yr → experienceRisk = +2
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 18,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 76,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'FOD Awareness',             completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'Ramp Safety',               completedOn: '2024-09-01', status: 'expiring', nextDue: daysFrom(25) },
      { course: 'Fuel Handling & Type ID',   completedOn: '2024-06-15', status: 'current', nextDue: '2026-06-15' },
    ],
  },
  // ─── FBO Line Service Staff ────────────────────────────────────────────────
  // Devon Park — new hire (1 yr). RISK: low experience significantly raises
  // fueling risk score — always requires supervisor co-sign for fueling tasks.
  {
    id: 'prs-014',
    name: 'Devon Park',
    role: 'ground',
    roleLabel: 'Line Service Tech',
    fboRole: 'line_service_tech',
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 1,             // 1yr → experienceRisk = +3 (1–3yr bracket)
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 24,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 68,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-09-10', status: 'current', nextDue: '2027-09-10' },
      { course: 'FOD Awareness',             completedOn: '2025-09-10', status: 'current', nextDue: '2027-09-10' },
      { course: 'Ramp Safety',               completedOn: '2025-09-15', status: 'current', nextDue: '2027-09-15' },
      { course: 'Fuel Handling & Type ID',   completedOn: '2025-10-01', status: 'current', nextDue: '2027-10-01' },
    ],
  },
  // Jordan Kim — 7yr senior line service. Low risk addend for fueling assignments.
  {
    id: 'prs-015',
    name: 'Jordan Kim',
    role: 'ground',
    roleLabel: 'Senior Line Tech',
    fboRole: 'line_service_senior',
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 7,             // 7yr → experienceRisk = +1 (7–15yr bracket)
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 30,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 82,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'FOD Awareness',             completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'Ramp Safety',               completedOn: '2025-03-01', status: 'current', nextDue: '2027-03-01' },
      { course: 'Fuel Handling & Type ID',   completedOn: '2025-02-01', status: 'current', nextDue: '2027-02-01' },
      { course: 'Aircraft Towing Procedures', completedOn: '2025-01-20', status: 'current', nextDue: '2027-01-20' },
    ],
  },
  // ─── CFI / Flight Instructors ──────────────────────────────────────────────
  // Linda Foster — full-time CFI/CFII. Not a Part 135 PIC/SIC; dedicated instructor role.
  {
    id: 'prs-017',
    name: 'Linda Foster',
    weightLbs: 147,
    role: 'cfi',
    roleLabel: 'Flight Instructor (CFI/CFII)',
    gliderRating: true,
    department: 'Flight Operations',
    certificateNumber: 'CPL-7790441',
    certType: 'Commercial',
    cfiCert: 'CFI-7790441',
    cfiRatings: ['CFI', 'CFII'],
    medicalClass: 2,
    medicalExpiry: daysFrom(280),
    lastFlightReview: daysBefore(60),
    ifrCurrencyExpiry: daysFrom(90),
    nightCurrencyExpiry: daysFrom(120),
    dutyHoursLast30d: 72,
    flightHoursYtd: 180,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2025-04-15', status: 'current', nextDue: '2027-04-15' },
      { course: 'HAZMAT Awareness',          completedOn: '2025-02-20', status: 'current', nextDue: '2027-02-20' },
      { course: 'Emergency Procedures',      completedOn: '2025-03-10', status: 'current', nextDue: '2027-03-10' },
    ],
  },
  // Greg Yamamoto — CFI, also qualified as Part 135 SIC. Split duties between
  // instructing and charter SIC flights. Combines CFI + Part 135 roles.
  {
    id: 'prs-018',
    name: 'Greg Yamamoto',
    weightLbs: 168,
    role: 'pilot_sic',           // Part 135 SIC qualification
    roleLabel: 'Pilot SIC / CFI',
    department: 'Flight Operations',
    certificateNumber: 'CPL-5512088',
    certType: 'Commercial',
    cfiCert: 'CFI-5512088',
    cfiRatings: ['CFI'],
    medicalClass: 2,
    medicalExpiry: daysFrom(195),
    lastFlightReview: daysBefore(120),
    ifrCurrencyExpiry: daysFrom(45),
    nightCurrencyExpiry: daysFrom(80),
    dutyHoursLast30d: 55,
    flightHoursYtd: 140,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-15', status: 'current', nextDue: '2027-01-15' },
      { course: 'CRM — Crew Resource Mgmt', completedOn: '2025-05-01', status: 'current', nextDue: '2027-05-01' },
      { course: 'HAZMAT Awareness',          completedOn: '2025-03-01', status: 'current', nextDue: '2027-03-01' },
      { course: 'Emergency Procedures',      completedOn: '2025-02-15', status: 'current', nextDue: '2027-02-15' },
    ],
  },
  // ─── Tow Pilots ────────────────────────────────────────────────────────────
  // Dedicated glider tow pilots with tow-certified endorsement.
  // towCertified: true → eligible for glider_tow op type in FlightPlanning.
  {
    id: 'prs-019',
    name: 'Dale Hoffman',
    weightLbs: 178,
    role: 'pilot_pic',
    roleLabel: 'Tow Pilot',
    towCertified: true,
    towCheckouts: ['ja-006', 'ja-007', 'ssb-001', 'ssb-002'],  // Journeys + SSB tow planes
    towBaseSchedule: { mon: ['am'], tue: ['am', 'pm'], wed: [], thu: ['am', 'pm'], fri: ['am'], sat: ['am', 'pm'], sun: [] },
    department: 'Flight Operations',
    certificateNumber: 'CPL-3341077',
    certType: 'Commercial',
    medicalClass: 2,
    medicalExpiry: daysFrom(240),
    lastFlightReview: daysBefore(45),
    ifrCurrencyExpiry: daysFrom(110),
    nightCurrencyExpiry: daysFrom(90),
    dutyHoursLast30d: 38,
    flightHoursYtd: 120,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'Aerotow Operations',        completedOn: '2025-03-15', status: 'current', nextDue: '2027-03-15' },
      { course: 'Emergency Procedures',      completedOn: '2025-02-20', status: 'current', nextDue: '2027-02-20' },
    ],
  },
  {
    id: 'prs-020',
    name: 'Cassandra Lee',
    weightLbs: 140,
    role: 'pilot_pic',
    roleLabel: 'Tow Pilot',
    towCertified: true,
    towCheckouts: ['ja-007', 'ja-011', 'ssb-002'],  // Super Cub N4384A, Pawnee N6719Z, SSB Cub
    towBaseSchedule: { mon: [], tue: ['am'], wed: ['am', 'pm'], thu: [], fri: ['pm'], sat: ['am'], sun: ['am', 'pm'] },
    department: 'Flight Operations',
    certificateNumber: 'PPL-7712034',
    certType: 'Private',
    medicalClass: 3,
    medicalExpiry: daysFrom(180),
    lastFlightReview: daysBefore(200),
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: daysFrom(60),
    dutyHoursLast30d: 22,
    flightHoursYtd: 75,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-04-01', status: 'current', nextDue: '2027-04-01' },
      { course: 'Aerotow Operations',        completedOn: '2025-04-10', status: 'current', nextDue: '2027-04-10' },
      { course: 'Emergency Procedures',      completedOn: '2025-04-05', status: 'current', nextDue: '2027-04-05' },
    ],
  },
  {
    id: 'prs-021',
    name: 'Brett Sandoval',
    weightLbs: 195,
    role: 'pilot_pic',
    roleLabel: 'Tow Pilot',
    towCertified: true,
    towCheckouts: ['ja-006', 'ja-007', 'ja-011', 'ssb-001', 'ssb-002'],  // all tow planes incl SSB
    towBaseSchedule: { mon: ['pm'], tue: [], wed: ['am'], thu: ['pm'], fri: ['am', 'pm'], sat: [], sun: ['am'] },
    department: 'Flight Operations',
    certificateNumber: 'CPL-4490228',
    certType: 'Commercial',
    medicalClass: 2,
    medicalExpiry: daysFrom(300),
    lastFlightReview: daysBefore(100),
    ifrCurrencyExpiry: daysFrom(75),
    nightCurrencyExpiry: daysFrom(120),
    dutyHoursLast30d: 48,
    flightHoursYtd: 150,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-02-01', status: 'current', nextDue: '2027-02-01' },
      { course: 'Aerotow Operations',        completedOn: '2025-05-20', status: 'current', nextDue: '2027-05-20' },
      { course: 'Emergency Procedures',      completedOn: '2025-03-15', status: 'current', nextDue: '2027-03-15' },
    ],
  },
  // ─── Taildragger + Tow Qualified Pilots ────────────────────────────────────
  // Both hold FAA tailwheel endorsement AND tow certification.
  // taildragherEndorsement: true → shown in taildragger-specific risk filters.
  // towCertified: true → eligible for glider_tow assignments.
  {
    id: 'prs-022',
    name: 'Walt Erikson',
    weightLbs: 185,
    role: 'pilot_pic',
    roleLabel: 'Pilot — Taildragger / Tow',
    towCertified: true,
    towCheckouts: ['ja-006', 'ja-007', 'ja-011'],  // all three — taildragger endorsed
    towBaseSchedule: { mon: ['am', 'pm'], tue: [], wed: ['pm'], thu: ['am'], fri: [], sat: ['am', 'pm'], sun: ['am', 'pm'] },
    taildragherEndorsement: true,
    department: 'Flight Operations',
    certificateNumber: 'CPL-6671055',
    certType: 'Commercial',
    medicalClass: 2,
    medicalExpiry: daysFrom(310),
    lastFlightReview: daysBefore(70),
    ifrCurrencyExpiry: daysFrom(85),
    nightCurrencyExpiry: daysFrom(140),
    dutyHoursLast30d: 44,
    flightHoursYtd: 165,
    training: [
      { course: 'Initial SMS Training',       completedOn: '2025-01-20', status: 'current', nextDue: '2027-01-20' },
      { course: 'Aerotow Operations',         completedOn: '2025-02-10', status: 'current', nextDue: '2027-02-10' },
      { course: 'Tailwheel Endorsement Trng', completedOn: '2024-08-15', status: 'current', nextDue: '2026-08-15' },
      { course: 'Emergency Procedures',       completedOn: '2025-03-01', status: 'current', nextDue: '2027-03-01' },
    ],
  },
  {
    id: 'prs-023',
    name: 'Ingrid Voss',
    weightLbs: 152,
    role: 'pilot_pic',
    roleLabel: 'Pilot — Taildragger / Tow',
    towCertified: true,
    towCheckouts: ['ja-006', 'ja-011', 'ssb-001'],  // Pawnees: N4337Y, N6719Z, N4593Y (SSB)
    towBaseSchedule: { mon: [], tue: ['pm'], wed: ['am', 'pm'], thu: [], fri: ['am'], sat: ['pm'], sun: [] },
    taildragherEndorsement: true,
    department: 'Flight Operations',
    certificateNumber: 'CPL-7780219',
    certType: 'Commercial',
    medicalClass: 2,
    medicalExpiry: daysFrom(195),
    lastFlightReview: daysBefore(110),
    ifrCurrencyExpiry: daysFrom(55),
    nightCurrencyExpiry: daysFrom(100),
    dutyHoursLast30d: 36,
    flightHoursYtd: 130,
    training: [
      { course: 'Initial SMS Training',       completedOn: '2025-02-15', status: 'current', nextDue: '2027-02-15' },
      { course: 'Aerotow Operations',         completedOn: '2025-03-20', status: 'current', nextDue: '2027-03-20' },
      { course: 'Tailwheel Endorsement Trng', completedOn: '2024-11-05', status: 'current', nextDue: '2026-11-05' },
      { course: 'Emergency Procedures',       completedOn: '2025-01-25', status: 'current', nextDue: '2027-01-25' },
    ],
  },
  // ─── Wing Walkers ──────────────────────────────────────────────────────────
  // Ground personnel trained to walk wingtips during glider launch and recovery.
  // wingWalker: true → eligible for glider ops wing-walking schedule.
  {
    id: 'prs-024',
    name: 'Tony Reeves',
    role: 'ground',
    roleLabel: 'Wing Walker',
    wingWalker: true,
    wingWalkerBaseSchedule: { mon: ['am'], tue: ['am', 'pm'], wed: [], thu: ['am'], fri: ['am', 'pm'], sat: ['am', 'pm'], sun: ['am'] },
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 2,
    capacityHoursPerWeek: 30,
    assignedHoursThisWeek: 14,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 56,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',        completedOn: '2025-06-01', status: 'current', nextDue: '2027-06-01' },
      { course: 'Wing Walking & Launch Safety', completedOn: '2025-06-05', status: 'current', nextDue: '2027-06-05' },
      { course: 'Ramp Safety',                 completedOn: '2025-06-10', status: 'current', nextDue: '2027-06-10' },
    ],
  },
  {
    id: 'prs-025',
    name: 'Maria Santos',
    role: 'ground',
    roleLabel: 'Wing Walker',
    wingWalker: true,
    wingWalkerBaseSchedule: { mon: ['am', 'pm'], tue: [], wed: ['am', 'pm'], thu: ['pm'], fri: [], sat: ['am', 'pm'], sun: ['am', 'pm'] },
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 4,
    capacityHoursPerWeek: 35,
    assignedHoursThisWeek: 18,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 68,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',        completedOn: '2025-03-15', status: 'current', nextDue: '2027-03-15' },
      { course: 'Wing Walking & Launch Safety', completedOn: '2025-03-20', status: 'current', nextDue: '2027-03-20' },
      { course: 'Ramp Safety',                 completedOn: '2025-04-01', status: 'current', nextDue: '2027-04-01' },
      { course: 'FOD Awareness',               completedOn: '2025-03-25', status: 'current', nextDue: '2027-03-25' },
    ],
  },
  {
    id: 'prs-026',
    name: 'Kevin Cho',
    role: 'ground',
    roleLabel: 'Wing Walker / Line Tech',
    wingWalker: true,
    wingWalkerBaseSchedule: { mon: [], tue: ['am'], wed: ['am'], thu: ['am', 'pm'], fri: ['pm'], sat: ['am'], sun: [] },
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 1,
    capacityHoursPerWeek: 25,
    assignedHoursThisWeek: 10,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 42,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',        completedOn: '2025-09-01', status: 'current', nextDue: '2027-09-01' },
      { course: 'Wing Walking & Launch Safety', completedOn: '2025-09-10', status: 'current', nextDue: '2027-09-10' },
      { course: 'Ramp Safety',                 completedOn: '2025-09-15', status: 'current', nextDue: '2027-09-15' },
    ],
  },
  // Rosa Mendez — FBO coordinator (desk / dispatch). 4yr experience.
  // Handles arrivals, scheduling, catering coordination, and fee management.
  {
    id: 'prs-016',
    name: 'Rosa Mendez',
    role: 'ground',
    roleLabel: 'FBO Coordinator',
    fboRole: 'fbo_coordinator',
    department: 'Ground Operations',
    currentLocation: 'on_prem',
    yearsExperience: 4,             // 4yr → experienceRisk = +2 (3–7yr bracket)
    capacityHoursPerWeek: 40,
    assignedHoursThisWeek: 20,
    certificateNumber: null,
    certType: null,
    medicalClass: null,
    medicalExpiry: null,
    lastFlightReview: null,
    ifrCurrencyExpiry: null,
    nightCurrencyExpiry: null,
    dutyHoursLast30d: 74,
    flightHoursYtd: 0,
    training: [
      { course: 'Initial SMS Training',      completedOn: '2025-01-10', status: 'current', nextDue: '2027-01-10' },
      { course: 'Customer Service — FBO',    completedOn: '2025-02-01', status: 'current', nextDue: '2027-02-01' },
      { course: 'HAZMAT Awareness',          completedOn: '2025-01-15', status: 'current', nextDue: '2027-01-15' },
      { course: 'Fuel Handling & Type ID',   completedOn: '2025-01-20', status: 'current', nextDue: '2027-01-20' },
    ],
  },
]

// =============================================================================
// Mechanic Certificates
// Per 14 CFR 43.9(a)(3): maintenance records must identify the specific
// certificate type and number under which work was performed / approved.
// Certificates are independent of the person — they may be acquired, suspended,
// reinstated, or revoked at any time.  Work orders reference certificateId,
// NOT just a personId.
//
// cert_type: A_and_P | IA | Repairman | Avionics
// status:    active | suspended | revoked | expired | surrendered
// =============================================================================
export const mockCertificates = [
  // Tyler Brooks — A&P only
  { id: 'cert-001', personnelId: 'prs-008', certType: 'A_and_P', certificateNumber: 'AME-774412',
    issuedDate: '2017-06-10', status: 'active', statusDate: '2017-06-10', statusNotes: null },

  // Diane Wu — A&P + IA (two separate certificates)
  { id: 'cert-002', personnelId: 'prs-009', certType: 'A_and_P', certificateNumber: 'AME-881022',
    issuedDate: '2006-04-01', status: 'active', statusDate: '2006-04-01', statusNotes: null },
  { id: 'cert-003', personnelId: 'prs-009', certType: 'IA',      certificateNumber: 'IA-881022',
    issuedDate: '2011-09-15', status: 'active', statusDate: '2011-09-15', statusNotes: null },

  // Sarah Cole — A&P + IA
  { id: 'cert-004', personnelId: 'prs-011', certType: 'A_and_P', certificateNumber: 'AME-991055',
    issuedDate: '2003-08-20', status: 'active', statusDate: '2003-08-20', statusNotes: null },
  { id: 'cert-005', personnelId: 'prs-011', certType: 'IA',      certificateNumber: 'IA-991055',
    issuedDate: '2008-03-05', status: 'active', statusDate: '2008-03-05', statusNotes: null },

  // Mike Ferris — A&P only
  { id: 'cert-006', personnelId: 'prs-012', certType: 'A_and_P', certificateNumber: 'AME-662301',
    issuedDate: '2013-11-12', status: 'active', statusDate: '2013-11-12', statusNotes: null },

  // T. Huang — Avionics (external)
  { id: 'cert-007', personnelId: 'prs-013', certType: 'Avionics', certificateNumber: 'AVN-330812',
    issuedDate: '2009-05-30', status: 'active', statusDate: '2009-05-30', statusNotes: null },
]

/** Look up all active certificates for a personnel ID. */
export function activeCertsForPerson(personnelId) {
  return mockCertificates.filter((c) => c.personnelId === personnelId && c.status === 'active')
}

/** True if the person currently holds an active IA certificate. */
export function hasActiveIA(personnelId) {
  return mockCertificates.some(
    (c) => c.personnelId === personnelId && c.certType === 'IA' && c.status === 'active'
  )
}

// Training completion summary by department (for charts)
export const mockTrainingSummary = [
  { department: 'Flight Operations', total: 5,  completed: 4, pct: 80  },
  { department: 'Operations',        total: 1,  completed: 1, pct: 100 },
  { department: 'Safety',            total: 1,  completed: 1, pct: 100 },
  { department: 'Maintenance',       total: 5,  completed: 5, pct: 100 },
  { department: 'Ground Operations', total: 4,  completed: 4, pct: 100 },  // Sam + Devon + Jordan + Rosa
]

// Overall training completion (for KPI scorecard)
export const mockTrainingKpi = {
  totalPersonnel: 23,             // added taildragger/tow pilots Walt Erikson (prs-022), Ingrid Voss (prs-023)
  smsTrainingCurrent: 17,         // 1 has expired HAZMAT (Rivera)
  currencyIssues: 3,              // night currency expired (Jones), medical expired (Rivera), HAZMAT expired (Rivera)
  overdueCourses: 2,
}

// Maintenance team roster — mechanics and avionics staff only
export const mockMaintenancePersonnel = (mockPersonnel) =>
  mockPersonnel.filter((p) => p.department === 'Maintenance')
