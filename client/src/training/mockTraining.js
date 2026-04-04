// =============================================================================
// Training Module — mock data
// Students, CFI roster, programs, schedule, flying club, DPE contacts
//
// Aircraft key (training-relevant):
//   ac-001 = N12345  Baron 58       — complex, multi-engine, IFR, high-perf
//   ac-002 = N67890  C172S G1000    — IFR, glass, primary trainer (pitot heat MEL)
//   ac-003 = N11111  Cherokee PA-28 — IFR (GTN650), steam gauges, secondary trainer
//                                     ⚠ open AD on fuel selector
//   ac-004 = N22222  C208 Caravan   — turboprop, charter / not used for training
//   ac-005 = N33333  C172N          — GROUNDED / not airworthy
//   ac-006 = N44444  Seneca PA-34   — complex, twin, charter (also used commercial complex)
//   ac-007 = N55555  Grand Caravan  — turboprop, charter / not used for training
// =============================================================================

const today = new Date('2026-03-29')
const daysFrom   = (d) => new Date(today.getTime() + d * 86_400_000).toISOString().split('T')[0]
const daysBefore = (d) => daysFrom(-d)

// ── Program Definitions ────────────────────────────────────────────────────────

export const PROGRAMS = {
  private_pilot: {
    id:   'private_pilot',
    name: 'Private Pilot Certificate',
    reg:  'FAR Part 61',
    icon: '🛩️',
    description: 'From first flight to solo and checkride. Primary aircraft: C172S.',
    wetRatePerHr: 185,
    instructorRatePerHr: 70,
    typicalHours: { min: 40, avg: 60 },
    typicalCost:  { min: 9_000, avg: 13_500 },
    stages: [
      { number: 1, title: 'Intro & Pre-Solo Ground',    objectives: ['Basic airmanship', 'Traffic patterns', 'Emergency procedures'], minHours: 15 },
      { number: 2, title: 'Pre-Solo Maneuvers',         objectives: ['Stalls', 'Steep turns', 'S-turns', 'Simulated engine failure'], minHours: 5  },
      { number: 3, title: 'Solo Flight Operations',     objectives: ['First solo', 'Solo T&Ls ×10', 'Short/soft field', 'Solo XC'], minHours: 10 },
      { number: 4, title: 'Night & Instrument',         objectives: ['3 hrs dual night', '1 solo night XC', '3 hrs hood work'], minHours: 7  },
      { number: 5, title: 'Checkride Prep',             objectives: ['Mock oral', 'Mock practical', 'IACRA / endorsements'], minHours: 3  },
    ],
    requirements: [
      { id: 'total',      label: 'Total flight time',           min: 40,  unit: 'hrs' },
      { id: 'dual',       label: 'Dual flight training',        min: 20,  unit: 'hrs' },
      { id: 'solo',       label: 'Solo PIC',                    min: 10,  unit: 'hrs' },
      { id: 'xc_dual',    label: 'Cross-country dual',          min: 3,   unit: 'hrs' },
      { id: 'xc_solo',    label: 'Solo cross-country',          min: 5,   unit: 'hrs' },
      { id: 'night_dual', label: 'Night dual (incl. XC + T&Ls)',min: 3,   unit: 'hrs' },
      { id: 'instrument', label: 'Instrument (hood) time',      min: 3,   unit: 'hrs' },
    ],
  },

  instrument_rating: {
    id:   'instrument_rating',
    name: 'Instrument Rating Add-On',
    reg:  'FAR Part 61',
    icon: '🌫️',
    description: 'IFR currency and procedures. Requires PPL. Aircraft: C172S (G1000 IFR).',
    wetRatePerHr: 185,
    instructorRatePerHr: 75,
    typicalHours: { min: 40, avg: 55 },
    typicalCost:  { min: 6_500, avg: 9_500 },
    stages: [
      { number: 1, title: 'IFR Fundamentals',        objectives: ['Attitude instrument flying', 'Basic holds', 'Partial panel'], minHours: 15 },
      { number: 2, title: 'Approaches & Procedures', objectives: ['ILS', 'RNAV/GPS', 'VOR', 'Missed approach'], minHours: 20 },
      { number: 3, title: 'IFR XC & Checkride Prep', objectives: ['IFR XC ≥250nm', 'ATIS/clearances', 'Mock IFR practical'], minHours: 5  },
    ],
    requirements: [
      { id: 'xc_pic',     label: 'Cross-country PIC',           min: 50,  unit: 'hrs' },
      { id: 'instrument', label: 'Actual/simulated instrument',  min: 40,  unit: 'hrs' },
      { id: 'dual_cfii',  label: 'Dual with CFII',               min: 15,  unit: 'hrs' },
    ],
  },

  commercial_pilot: {
    id:   'commercial_pilot',
    name: 'Commercial Pilot Certificate',
    reg:  'FAR Part 61',
    icon: '✈️',
    description: 'Commercial ASEL. Requires PPL + IR. Complex endorsement on Baron/Seneca.',
    wetRatePerHr: 185,
    instructorRatePerHr: 80,
    typicalHours: { min: 250, avg: 270 },
    typicalCost:  { min: 18_000, avg: 25_000 },
    stages: [
      { number: 1, title: 'Commercial Maneuvers',    objectives: ['Chandelles', 'Lazy 8s', 'Eights-on-pylons', 'Commercial precision T&Ls'], minHours: 20 },
      { number: 2, title: 'Complex / High-Perf',     objectives: ['Complex endorsement (Baron)', 'High-perf endorsement', 'Complex solo'], minHours: 10 },
      { number: 3, title: 'Commercial XC & Night',   objectives: ['2 dual night XC', '5 hrs solo night', '10 hrs solo XC'], minHours: 30 },
      { number: 4, title: 'Checkride Prep',           objectives: ['Mock oral', 'Mock commercial practical', 'IACRA'], minHours: 5  },
    ],
    requirements: [
      { id: 'total',      label: 'Total flight time',            min: 250, unit: 'hrs' },
      { id: 'pic',        label: 'PIC flight time',              min: 100, unit: 'hrs' },
      { id: 'xc_pic',     label: 'Cross-country PIC',            min: 50,  unit: 'hrs' },
      { id: 'night_pic',  label: 'Night PIC',                    min: 5,   unit: 'hrs' },
      { id: 'instrument', label: 'Instrument flight time',       min: 10,  unit: 'hrs' },
      { id: 'dual',       label: 'Dual flight training',         min: 55,  unit: 'hrs' },
    ],
  },

  glider_private_pilot: {
    id:   'glider_private_pilot',
    name: 'Glider Private Pilot Certificate',
    reg:  'FAR Part 61 §61.109(f)',
    icon: '🪂',
    description: 'Earn your glider certificate. Tow-launched operations from KBDU. Aircraft: SGS 2-33A or G103.',
    wetRatePerHr: 85,
    instructorRatePerHr: 65,
    towRatePerLaunch: 40,    // per tow (to 2000 ft)
    typicalHours: { min: 10, avg: 20 },
    typicalLaunches: { min: 20, avg: 35 },
    typicalCost:  { min: 2_200, avg: 3_800 },
    stages: [
      { number: 1, title: 'Intro & Ground School',        objectives: ['Glider aerodynamics', 'Tow procedures', 'Traffic patterns'], minHours: 3 },
      { number: 2, title: 'Dual Soaring & Pattern Work',  objectives: ['Aerotow techniques', 'Thermaling', 'Landing accuracy'], minHours: 5 },
      { number: 3, title: 'Solo Operations',              objectives: ['First solo', 'Solo T&Ls ×5', 'Soaring XC'], minHours: 2 },
    ],
    requirements: [
      { id: 'total_glider',  label: 'Total glider flight time',  min: 10,  unit: 'hrs' },
      { id: 'solo_glider',   label: 'Solo PIC glider time',      min: 2,   unit: 'hrs' },
      { id: 'launches',      label: 'Total launches',            min: 20,  unit: 'launches' },
      { id: 'solo_launches', label: 'Solo launches',             min: 10,  unit: 'launches' },
    ],
  },

  glider_add_on: {
    id:   'glider_add_on',
    name: 'Glider Add-On Rating',
    reg:  'FAR Part 61 §61.63',
    icon: '🪂',
    description: 'Add glider to an existing pilot certificate. Expedited program for rated pilots. Aircraft: G103.',
    wetRatePerHr: 95,
    instructorRatePerHr: 65,
    towRatePerLaunch: 45,
    typicalHours: { min: 3, avg: 8 },
    typicalLaunches: { min: 10, avg: 20 },
    typicalCost:  { min: 900, avg: 1_800 },
    stages: [
      { number: 1, title: 'Transition & Pattern Work', objectives: ['Glider systems', 'Aerotow techniques', 'Accuracy landings'], minHours: 3 },
      { number: 2, title: 'Solo & Checkride Prep',     objectives: ['Solo flights', 'Soaring maneuvers', 'Mock practical'],      minHours: 2 },
    ],
    requirements: [
      { id: 'dual_glider',   label: 'Dual glider instruction',  min: 3,   unit: 'hrs' },
      { id: 'solo_launches', label: 'Solo launches',             min: 5,   unit: 'launches' },
    ],
  },

  glider_cfig: {
    id:   'glider_cfig',
    name: 'Glider Flight Instructor (CFIG)',
    reg:  'FAR Part 61 §61.183',
    icon: '🎓',
    description: 'Glider instructor certificate. Requires Glider Commercial or ATP. Airport: KBDU.',
    wetRatePerHr: 95,
    instructorRatePerHr: 75,
    towRatePerLaunch: 45,
    typicalHours: { min: 15, avg: 25 },
    typicalLaunches: { min: 25, avg: 40 },
    typicalCost:  { min: 2_500, avg: 4_000 },
    stages: [
      { number: 1, title: 'Fundamentals of Instruction', objectives: ['Teaching methods', 'FITS', 'Scenario-based training'], minHours: 8 },
      { number: 2, title: 'Instructor Maneuvers',        objectives: ['Spin training', 'Stall recognition', 'Aerotow emergencies'], minHours: 5 },
      { number: 3, title: 'Checkride Prep',              objectives: ['CFIG oral', 'FOI written', 'Practical test'], minHours: 4 },
    ],
    requirements: [
      { id: 'total_glider', label: 'Total glider PIC', min: 25,  unit: 'hrs' },
      { id: 'instruction',  label: 'Dual given',        min: 5,   unit: 'hrs' },
    ],
  },
}

// ── Block Purchase Packages ────────────────────────────────────────────────────

export const BLOCK_PACKAGES = [
  { id: 'block-10',  hours: 10,  discountPct: 5,  label: '10-Hour Block',  popular: false },
  { id: 'block-20',  hours: 20,  discountPct: 10, label: '20-Hour Block',  popular: true  },
  { id: 'block-40',  hours: 40,  discountPct: 15, label: '40-Hour Block',  popular: false },
]

// ── Flying Club Configuration ──────────────────────────────────────────────────

export const CLUB_CONFIG = {
  name:              'Boulder Aviators Club',
  monthlyDues:       75,
  initFee:           150,
  hourlyDiscountPct: 10,
  requiresMedical:   true,
  requiresBfr:       true,
  requiresRenters:   true,
  eligibleAircraft:  ['ac-002', 'ac-003'],   // C172S and Cherokee (single-engine pistons)
}

export const mockClubMembers = [
  { id: 'cm-001', personnelId: 'prs-001', name: 'James Smith',    memberSince: '2022-01-01', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: true,  medicalCurrent: true,  rentersUploaded: true  },
  { id: 'cm-002', personnelId: 'prs-003', name: 'Marcus Davis',   memberSince: '2023-06-15', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: true,  medicalCurrent: true,  rentersUploaded: true  },
  { id: 'cm-003', personnelId: 'prs-004', name: 'Anika Patel',    memberSince: '2024-02-01', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: true,  medicalCurrent: true,  rentersUploaded: true,  gliderRating: true  },
  { id: 'cm-004', personnelId: 'prs-017', name: 'Linda Foster',   memberSince: '2021-09-01', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: true,  medicalCurrent: true,  rentersUploaded: true  },
  { id: 'cm-005', personnelId: 'prs-018', name: 'Greg Yamamoto',  memberSince: '2023-03-10', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: true,  medicalCurrent: true,  rentersUploaded: true,  gliderRating: true  },
  { id: 'cm-006', personnelId: null,      name: 'Fiona Weston',   memberSince: '2025-04-01', duesCurrent: false, lastPayDate: '2026-02-01', bfrCurrent: true,  medicalCurrent: true,  rentersUploaded: true  },
  { id: 'cm-007', personnelId: null,      name: 'Omar Khalid',    memberSince: '2024-11-15', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: false, medicalCurrent: true,  rentersUploaded: true  },
  { id: 'cm-008', personnelId: null,      name: 'Pauline Greco',  memberSince: '2025-01-20', duesCurrent: true,  lastPayDate: '2026-03-01', bfrCurrent: true,  medicalCurrent: false, rentersUploaded: false },
]

// ── DPE Contacts ──────────────────────────────────────────────────────────────

export const mockDpeContacts = [
  {
    id:       'dpe-001',
    name:     'Robert Hawkins',
    location: 'KBDU — Boulder Municipal',
    phone:    '303-555-0190',
    email:    'rhawkins.dpe@gmail.com',
    authorizes: ['private_pilot', 'instrument_rating', 'commercial_pilot'],
    typicalFee: 700,
    availableNextDate: daysFrom(7),
  },
  {
    id:       'dpe-002',
    name:     'Sandra Mitchell',
    location: 'KCOS — Colorado Springs',
    phone:    '719-555-0245',
    email:    'smitchell.dpe@coair.net',
    authorizes: ['private_pilot', 'instrument_rating'],
    typicalFee: 650,
    availableNextDate: daysFrom(14),
  },
]

// ── Students ──────────────────────────────────────────────────────────────────

export const mockStudents = [
  // ── Emily Carter — PPL, Stage 5/5, ready for checkride ───────────────────────
  {
    id:              'std-001',
    name:            'Emily Carter',
    weightLbs:       135,
    email:           'ecarter@email.com',
    phone:           '720-555-0101',
    enrolledDate:    '2025-11-01',
    program:         'private_pilot',
    currentStage:    5,
    status:          'active',
    assignedCfiId:   'prs-017',               // Linda Foster — CFI/CFII
    assignedAircraftIds: ['ac-002', 'ac-003'], // C172S (primary) + Cherokee (secondary)
    preferences: {
      preferredSlots: ['0900', '1000', '1100'],
      preferredDays:  [1, 2, 3, 4],           // Tue–Fri
      weatherMin:     'vmc',
    },

    docs: {
      governmentId:    { type: 'drivers_license', expiry: '2028-05-15', uploaded: true,  uploadDate: '2025-11-01' },
      insurance:       { carrier: 'AVEMCO',       policyNumber: 'AV-4412001', expiry: daysFrom(185), uploaded: true, uploadDate: '2025-11-01' },
      medicalCert:     { class: 3, certNumber: 'MED-441021', expiry: '2028-04-30', uploaded: true, uploadDate: '2025-11-05' },
      studentPilotCert:{ certNumber: 'SPC-441021', issueDate: '2025-11-05', uploaded: true },
      knowledgeTest:   { score: 92, dateTaken: daysBefore(30), uploaded: true },
    },

    hours: {
      total: 42.8, dual: 28.5, soloPIC: 14.3,
      xc_dual: 4.1, xc_solo: 6.2, night_dual: 3.5, instrument: 3.2,
    },

    blockHoursPurchased: 20,
    blockHoursUsed:      18.5,
    clubMember:          true,

    dpe: {
      status: 'scheduled',
      scheduledDate: daysFrom(12),
      dpeId: 'dpe-001',
      tasks: [
        { id: 'req-hours',     label: 'All FAR 61.109 hours met',              done: true  },
        { id: 'req-maneuvers', label: 'All ACS maneuvers signed off by CFI',   done: true  },
        { id: 'req-medical',   label: 'Current 3rd class medical on file',     done: true  },
        { id: 'req-ktest',     label: 'Knowledge test passed (within 24 mo.)', done: true  },
        { id: 'req-8710',      label: 'CFI endorsements on 8710 form',         done: true  },
        { id: 'req-iacra',     label: 'IACRA application submitted',           done: true  },
        { id: 'req-dpe',       label: 'DPE selected & availability confirmed', done: true  },
        { id: 'req-fee',       label: 'DPE fee arranged ($700)',                done: true  },
        { id: 'req-airworthy', label: 'Aircraft confirmed airworthy on date',  done: false },
        { id: 'req-renters',   label: "Renter's insurance current on checkride date", done: true },
      ],
    },
  },

  // ── Tyler Mason — PPL, Stage 1/5, just starting ──────────────────────────────
  {
    id:              'std-002',
    name:            'Tyler Mason',
    weightLbs:       178,
    email:           'tmason@email.com',
    phone:           '303-555-0177',
    enrolledDate:    '2026-02-15',
    program:         'private_pilot',
    currentStage:    1,
    status:          'active',
    assignedCfiId:   'prs-018',               // Greg Yamamoto — CFI
    assignedAircraftIds: ['ac-002', 'ac-003'], // C172S primary, Cherokee secondary
    preferences: {
      preferredSlots: ['1300', '1400', '1500'],
      preferredDays:  [1, 3, 5],              // Tue, Thu, Sat
      weatherMin:     'vmc',
    },

    docs: {
      governmentId:    { type: 'passport',   expiry: '2030-07-22', uploaded: true,  uploadDate: '2026-02-15' },
      insurance:       { carrier: 'USAIG',   policyNumber: 'US-9918722', expiry: daysFrom(22), uploaded: true, uploadDate: '2026-02-15' },
      medicalCert:     { class: 3, certNumber: 'MED-881203', expiry: '2028-01-31', uploaded: true, uploadDate: '2026-02-20' },
      studentPilotCert:{ certNumber: 'SPC-881203', issueDate: '2026-02-20', uploaded: true },
      knowledgeTest:   null,
    },

    hours: {
      total: 7.2, dual: 7.2, soloPIC: 0,
      xc_dual: 0, xc_solo: 0, night_dual: 0, instrument: 0,
    },

    blockHoursPurchased: 10,
    blockHoursUsed:      7.2,
    clubMember:          false,

    dpe: { status: 'not_started', scheduledDate: null, dpeId: null, tasks: [] },
  },

  // ── Priya Singh — Instrument Rating, Stage 2/3 ───────────────────────────────
  {
    id:              'std-003',
    name:            'Priya Singh',
    weightLbs:       128,
    email:           'psingh@email.com',
    phone:           '720-555-0233',
    enrolledDate:    '2025-09-10',
    program:         'instrument_rating',
    currentStage:    2,
    status:          'active',
    assignedCfiId:   'prs-001',               // James Smith — ATP / CFI / CFII ← CFII required
    assignedAircraftIds: ['ac-002'],           // C172S G1000 — IFR glass
    preferences: {
      preferredSlots: ['0800', '0900', '1000'],
      preferredDays:  [1, 3, 5],              // Tue, Thu, Sat
      weatherMin:     'any',                  // IR student — happy with any wx
    },

    docs: {
      governmentId: { type: 'drivers_license', expiry: '2027-03-10', uploaded: true, uploadDate: '2025-09-10' },
      insurance:    { carrier: 'AVEMCO', policyNumber: 'AV-7701233', expiry: daysFrom(165), uploaded: true, uploadDate: '2025-09-10' },
      medicalCert:  { class: 2, certNumber: 'MED-330977', expiry: '2027-09-30', uploaded: true, uploadDate: '2025-09-12' },
      pilotCert:    { certNumber: 'PPL-330977', certType: 'Private', uploaded: true },
      knowledgeTest:{ score: 88, dateTaken: daysBefore(45), uploaded: true },
    },

    hours: {
      total: 112.5, dual: 22.0, soloPIC: 90.5,
      xc_dual: 12.5, xc_solo: 55.0, night_dual: 4.0, instrument: 28.5,
      xc_pic: 68.0, dual_cfii: 18.5,
    },

    blockHoursPurchased: 20,
    blockHoursUsed:      14.0,
    clubMember:          true,

    dpe: {
      status: 'pending', scheduledDate: null, dpeId: null,
      tasks: [
        { id: 'req-hours',     label: 'All FAR 61.65 hours met',               done: false },
        { id: 'req-maneuvers', label: 'All ACS approaches/procedures signed off', done: false },
        { id: 'req-medical',   label: 'Current medical on file',               done: true  },
        { id: 'req-ktest',     label: 'IFR knowledge test passed',             done: true  },
        { id: 'req-8710',      label: 'CFII 8710 endorsements complete',       done: false },
        { id: 'req-iacra',     label: 'IACRA application submitted',           done: false },
        { id: 'req-dpe',       label: 'DPE selected & availability confirmed', done: false },
        { id: 'req-fee',       label: 'DPE fee arranged ($700)',                done: false },
        { id: 'req-airworthy', label: 'Aircraft confirmed airworthy on date',  done: false },
        { id: 'req-renters',   label: "Renter's insurance current on date",    done: true  },
      ],
    },
  },

  // ── Derek Hayes — Commercial, Stage 3/4 ─────────────────────────────────────
  {
    id:              'std-004',
    name:            'Derek Hayes',
    weightLbs:       193,
    email:           'dhayes@email.com',
    phone:           '303-555-0312',
    enrolledDate:    '2024-06-01',
    program:         'commercial_pilot',
    currentStage:    3,
    status:          'active',
    assignedCfiId:   'prs-001',               // James Smith — ATP / CFI / MEI
    assignedAircraftIds: ['ac-001', 'ac-002'], // Baron (complex) + C172S
    preferences: {
      preferredSlots: ['0800', '0900', '1300', '1400'],
      preferredDays:  [2, 4, 5],              // Wed, Fri, Sat
      weatherMin:     'any',
    },

    docs: {
      governmentId: { type: 'drivers_license', expiry: '2029-11-04', uploaded: true, uploadDate: '2024-06-01' },
      insurance:    { carrier: 'AVEMCO', policyNumber: 'AV-5530441', expiry: daysFrom(-8), uploaded: true, uploadDate: '2024-06-01' }, // EXPIRED
      medicalCert:  { class: 1, certNumber: 'MED-220441', expiry: daysFrom(310), uploaded: true, uploadDate: '2024-06-05' },
      pilotCert:    { certNumber: 'PPL-220441', certType: 'Private', uploaded: true },
      irCert:       { certNumber: 'IR-220441',  certType: 'Instrument', uploaded: true },
      knowledgeTest:{ score: 95, dateTaken: daysBefore(90), uploaded: true },
    },

    hours: {
      total: 238.5, dual: 60.0, soloPIC: 178.5,
      xc_dual: 22.0, xc_solo: 65.0, night_dual: 8.0, instrument: 42.0,
      pic: 138.5, xc_pic: 68.0, night_pic: 12.0,
    },

    blockHoursPurchased: 40,
    blockHoursUsed:      36.5,
    clubMember:          false,

    dpe: {
      status: 'not_started', scheduledDate: null, dpeId: null,
      tasks: [
        { id: 'req-hours',     label: 'All FAR 61.129 hours met',              done: false },
        { id: 'req-maneuvers', label: 'All ACS maneuvers signed off',          done: false },
        { id: 'req-medical',   label: 'Current 1st class medical on file',     done: true  },
        { id: 'req-ktest',     label: 'Commercial knowledge test passed',      done: true  },
        { id: 'req-8710',      label: 'CFI 8710 endorsements complete',        done: false },
        { id: 'req-iacra',     label: 'IACRA application submitted',           done: false },
        { id: 'req-dpe',       label: 'DPE selected & availability confirmed', done: false },
        { id: 'req-fee',       label: 'DPE fee arranged ($700)',                done: false },
        { id: 'req-airworthy', label: 'Aircraft confirmed airworthy on date',  done: false },
        { id: 'req-renters',   label: "Renter's insurance current on date",    done: false }, // expired!
      ],
    },
  },

  // ── Glider students ────────────────────────────────────────────────────────
  {
    id:              'std-005',
    name:            'Ryan Okada',
    weightLbs:       172,
    email:           'rokada@email.com',
    phone:           '720-555-0198',
    enrolledDate:    '2026-01-10',
    program:         'glider_private_pilot',
    currentStage:    2,
    status:          'active',
    assignedCfiId:   'prs-017',               // Linda Foster — CFIG
    assignedAircraftIds: ['ac-008', 'ac-009'], // SGS 2-33A + G103 Twin Astir
    preferences: {
      preferredSlots: ['1000', '1100', '1300'],
      preferredDays:  [0, 6],                  // weekends
      weatherMin:     'vmc',
    },
    docs: {
      governmentId:     { type: 'drivers_license', expiry: '2030-03-01', uploaded: true,  uploadDate: '2026-01-10' },
      insurance:        { carrier: 'AVEMCO', policyNumber: 'AV-6612055', expiry: daysFrom(200), uploaded: true, uploadDate: '2026-01-10' },
      medicalCert:      { class: 3, certNumber: 'MED-661202', expiry: '2028-01-31', uploaded: true, uploadDate: '2026-01-12' },
      studentPilotCert: { certNumber: 'SPC-661202', issueDate: '2026-01-12', uploaded: true },
    },
    hours: {
      total: 8.5, dual: 7.0, soloPIC: 1.5,
    },
    blockHoursPurchased: 15,
    blockHoursUsed:       8.5,
    clubMember:           false,
    dpe: { status: 'not_started', scheduledDate: null, dpeId: null, tasks: [] },
  },
  {
    id:              'std-006',
    name:            'Sara Lindstrom',
    weightLbs:       138,
    email:           'slindstrom@email.com',
    phone:           '303-555-0267',
    enrolledDate:    '2025-10-15',
    program:         'glider_add_on',
    currentStage:    3,
    status:          'active',
    assignedCfiId:   'prs-017',               // Linda Foster — CFIG
    assignedAircraftIds: ['ac-009'],           // G103 Twin Astir
    preferences: {
      preferredSlots: ['0900', '1000'],
      preferredDays:  [2, 4, 6],              // Wed, Fri, Sat
      weatherMin:     'vmc',
    },
    docs: {
      governmentId: { type: 'drivers_license', expiry: '2028-09-15', uploaded: true, uploadDate: '2025-10-15' },
      insurance:    { carrier: 'AVEMCO', policyNumber: 'AV-7730119', expiry: daysFrom(180), uploaded: true, uploadDate: '2025-10-15' },
      medicalCert:  { class: 2, certNumber: 'MED-770119', expiry: daysFrom(290), uploaded: true, uploadDate: '2025-10-16' },
      pilotCert:    { certNumber: 'PPL-770119', certType: 'Private', uploaded: true },
    },
    hours: {
      total: 195.0, dual: 12.0, soloPIC: 183.0,
    },
    blockHoursPurchased: 10,
    blockHoursUsed:       9.5,
    clubMember:           true,
    dpe: { status: 'not_started', scheduledDate: null, dpeId: null, tasks: [] },
  },

  // ── Maria Vasquez — PPL holder, working on Instrument Rating, Stage 1 ────────
  {
    id:              'std-007',
    name:            'Maria Vasquez',
    weightLbs:       145,
    email:           'mvasquez@email.com',
    phone:           '303-555-0388',
    enrolledDate:    '2026-01-15',
    program:         'instrument_rating',
    currentStage:    1,
    status:          'active',
    assignedCfiId:   'prs-017',               // Linda Foster — CFI/CFII
    assignedAircraftIds: ['ac-002'],           // C172S — IFR glass panel
    preferences: {
      preferredSlots: ['1000', '1100', '1400'],
      preferredDays:  [1, 3, 5],              // Tue, Thu, Sat
      weatherMin:     'any',                  // IFR training — any weather
    },
    docs: {
      governmentId:    { type: 'drivers_license', expiry: '2029-02-20', uploaded: true, uploadDate: '2026-01-15' },
      insurance:       { carrier: 'AVEMCO', policyNumber: 'AV-9901200', expiry: daysFrom(200), uploaded: true, uploadDate: '2026-01-15' },
      medicalCert:     { class: 3, certNumber: 'MED-9901200', expiry: '2028-06-30', uploaded: true, uploadDate: '2026-01-16' },
      pilotCert:       { certNumber: 'PPL-9901200', certType: 'Private ASEL', uploaded: true },
      knowledgeTest:   { score: null, dateTaken: null, uploaded: false },
    },
    hours: {
      total: 310, dual: 55, soloPIC: 255,
      xc_dual: 12, xc_solo: 68, xc_pic: 72,
      night_dual: 5, night_pic: 8,
      instrument: 8, dual_cfii: 4,
    },
    blockHoursPurchased: 20,
    blockHoursUsed:      4,
    clubMember:          false,
    dpe: { status: 'not_started', scheduledDate: null, dpeId: null, tasks: [] },
  },

  // ── Jake Rosen — PPL+IR holder, working on Commercial, Stage 2 ───────────────
  {
    id:              'std-008',
    name:            'Jake Rosen',
    weightLbs:       190,
    email:           'jrosen@email.com',
    phone:           '720-555-0499',
    enrolledDate:    '2025-09-01',
    program:         'commercial_pilot',
    currentStage:    2,
    status:          'active',
    assignedCfiId:   'prs-001',               // James Smith — CFI/CFII/MEI
    assignedAircraftIds: ['ac-001', 'ac-002'], // Baron (complex) + C172S
    preferences: {
      preferredSlots: ['0800', '0900', '1000'],
      preferredDays:  [0, 2, 4],              // Mon, Wed, Fri
      weatherMin:     'any',
    },
    docs: {
      governmentId:    { type: 'drivers_license', expiry: '2028-11-01', uploaded: true, uploadDate: '2025-09-01' },
      insurance:       { carrier: 'Southwest', policyNumber: 'SW-4410550', expiry: daysFrom(150), uploaded: true, uploadDate: '2025-09-01' },
      medicalCert:     { class: 2, certNumber: 'MED-4410550', expiry: daysFrom(300), uploaded: true, uploadDate: '2025-09-02' },
      pilotCert:       { certNumber: 'PPL-4410550', certType: 'Private ASEL, Instrument', uploaded: true },
      irCert:          { certNumber: 'IR-4410550', uploaded: true },
      knowledgeTest:   { score: 88, dateTaken: daysBefore(45), uploaded: true },
    },
    hours: {
      total: 238.5, dual: 68, soloPIC: 170.5, pic: 170.5,
      xc_dual: 18, xc_solo: 55, xc_pic: 62,
      night_dual: 8, night_pic: 12,
      instrument: 48, dual_cfii: 42,
    },
    blockHoursPurchased: 30,
    blockHoursUsed:      22,
    clubMember:          true,
    dpe: { status: 'pending', scheduledDate: null, dpeId: null, tasks: [
      { id: 'req-hours',     label: 'All FAR 61.129 hours met',               done: true  },
      { id: 'req-maneuvers', label: 'Commercial maneuvers signed off',         done: true  },
      { id: 'req-complex',   label: 'Complex endorsement complete',            done: true  },
      { id: 'req-hp',        label: 'High-performance endorsement complete',   done: false },
      { id: 'req-medical',   label: 'Current 2nd class medical on file',       done: true  },
      { id: 'req-ktest',     label: 'Knowledge test passed',                   done: true  },
      { id: 'req-8710',      label: 'CFI endorsements on 8710 form',           done: false },
      { id: 'req-iacra',     label: 'IACRA application submitted',             done: false },
      { id: 'req-dpe',       label: 'DPE selected & availability confirmed',   done: false },
      { id: 'req-fee',       label: 'DPE fee arranged',                        done: false },
    ] },
  },

  // ── Dave Kowalski — CPL+ME holder, doing tailwheel endorsement ───────────────
  {
    id:              'std-009',
    name:            'Dave Kowalski',
    weightLbs:       195,
    email:           'dkowalski@email.com',
    phone:           '303-555-0612',
    enrolledDate:    '2026-03-15',
    program:         'private_pilot',         // enrolled for endorsement work, using PPL program
    currentStage:    5,                       // all PPL stages complete
    status:          'active',
    assignedCfiId:   'prs-018',               // Greg Yamamoto — CFI
    assignedAircraftIds: ['ac-002'],
    preferences: {
      preferredSlots: ['0900', '1000', '1100'],
      preferredDays:  [2, 4],                 // Wed, Fri
      weatherMin:     'vmc',
    },
    docs: {
      governmentId:    { type: 'drivers_license', expiry: '2027-08-10', uploaded: true, uploadDate: '2026-03-15' },
      insurance:       { carrier: 'AVEMCO', policyNumber: 'AV-1212000', expiry: daysFrom(250), uploaded: true, uploadDate: '2026-03-15' },
      medicalCert:     { class: 2, certNumber: 'MED-1212000', expiry: daysFrom(340), uploaded: true, uploadDate: '2026-03-16' },
      pilotCert:       { certNumber: 'CPL-1212000', certType: 'Commercial ASEL AMEL, Instrument', uploaded: true },
      irCert:          { certNumber: 'IR-1212000', uploaded: true },
    },
    hours: {
      total: 1200, dual: 120, soloPIC: 1080, pic: 1080,
      xc_dual: 25, xc_solo: 320, xc_pic: 340,
      night_dual: 15, night_pic: 85,
      instrument: 95, dual_cfii: 48,
    },
    blockHoursPurchased: 5,
    blockHoursUsed:      2,
    clubMember:          false,
    dpe: { status: 'not_started', scheduledDate: null, dpeId: null, tasks: [] },
  },
]

// ── Weekly Schedule ───────────────────────────────────────────────────────────
// Week of 2026-03-30 (Mon) to 2026-04-04 (Sat)
// dayIdx:  0=Mon 3/30, 1=Tue 3/31, 2=Wed 4/1, 3=Thu 4/2, 4=Fri 4/3, 5=Sat 4/4
// Slots span the booking + its duration (e.g. slot:'0900' duration:2 → occupies 0900 + 1000)
// Aircraft allocation: ac-002 (C172S) = IFR / glass primary; ac-003 (Cherokee) = VFR basics
// type: dual_lesson | solo | ground | sim_lesson | club_flight

export const SCHEDULE_DAYS  = ['Mon 3/30', 'Tue 3/31', 'Wed 4/1', 'Thu 4/2', 'Fri 4/3', 'Sat 4/4']
export const SCHEDULE_SLOTS = ['0700', '0800', '0900', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700']

export const mockBookings = [
  // ── Monday ──────────────────────────────────────────────────────────────────
  { id: 'bk-001', day: 0, slot: '0900', duration: 2, studentId: 'std-001', cfiId: 'prs-017', aircraftId: 'ac-002', type: 'dual_lesson', title: 'Checkride Prep — Maneuvers' },
  { id: 'bk-002', day: 0, slot: '1300', duration: 1, studentId: 'std-002', cfiId: 'prs-018', aircraftId: 'ac-003', type: 'dual_lesson', title: 'Lesson 4 — Stalls & Traffic Pattern' },
  { id: 'bk-003', day: 0, slot: '1500', duration: 1, studentId: null,      cfiId: null,       aircraftId: 'ac-002', type: 'club_flight', title: 'Club — Omar Khalid' },

  // ── Tuesday ──────────────────────────────────────────────────────────────────
  { id: 'bk-004', day: 1, slot: '0800', duration: 2, studentId: 'std-003', cfiId: 'prs-001', aircraftId: 'ac-002', type: 'dual_lesson', title: 'IFR Lesson — ILS + Missed Approach' },
  { id: 'bk-005', day: 1, slot: '1000', duration: 1, studentId: 'std-001', cfiId: null,       aircraftId: 'ac-002', type: 'solo',        title: 'Emily — Solo Pattern Work' },
  { id: 'bk-006', day: 1, slot: '1400', duration: 2, studentId: 'std-004', cfiId: 'prs-001', aircraftId: 'ac-001', type: 'dual_lesson', title: 'Commercial — Chandelles & Lazy 8s' },

  // ── Wednesday ────────────────────────────────────────────────────────────────
  { id: 'bk-007', day: 2, slot: '0900', duration: 1, studentId: 'std-001', cfiId: 'prs-017', aircraftId: null,     type: 'ground',      title: 'Mock Oral Exam — Emily' },
  { id: 'bk-008', day: 2, slot: '1100', duration: 2, studentId: 'std-002', cfiId: 'prs-018', aircraftId: 'ac-003', type: 'dual_lesson', title: 'Lesson 5 — Basic Maneuvers' },
  { id: 'bk-009', day: 2, slot: '1400', duration: 1, studentId: null,      cfiId: null,       aircraftId: 'ac-002', type: 'club_flight', title: 'Club — Marcus Davis' },

  // ── Thursday ─────────────────────────────────────────────────────────────────
  { id: 'bk-010', day: 3, slot: '0800', duration: 2, studentId: 'std-003', cfiId: 'prs-001', aircraftId: 'ac-002', type: 'dual_lesson', title: 'IFR — RNAV/GPS Approaches' },
  { id: 'bk-011', day: 3, slot: '1200', duration: 2, studentId: 'std-001', cfiId: 'prs-017', aircraftId: 'ac-002', type: 'dual_lesson', title: 'Checkride Prep — Short/Soft Field' },

  // ── Friday ───────────────────────────────────────────────────────────────────
  { id: 'bk-012', day: 4, slot: '0800', duration: 2, studentId: 'std-004', cfiId: 'prs-001', aircraftId: 'ac-001', type: 'dual_lesson', title: 'Commercial — Night XC (dual)' },
  { id: 'bk-013', day: 4, slot: '1000', duration: 1, studentId: 'std-002', cfiId: null,       aircraftId: 'ac-003', type: 'solo',        title: 'Tyler — First Solo (pending CFI sign-off)' },
  { id: 'bk-014', day: 4, slot: '1400', duration: 1, studentId: null,      cfiId: null,       aircraftId: 'ac-002', type: 'club_flight', title: 'Club — Anika Patel' },

  // ── Saturday ─────────────────────────────────────────────────────────────────
  { id: 'bk-015', day: 5, slot: '0800', duration: 3, studentId: 'std-001', cfiId: 'prs-017', aircraftId: 'ac-002', type: 'dual_lesson', title: 'Full Checkride Mock Practical' },
  { id: 'bk-016', day: 5, slot: '1200', duration: 2, studentId: 'std-003', cfiId: 'prs-001', aircraftId: 'ac-002', type: 'dual_lesson', title: 'IFR — Partial Panel + Holds' },
  { id: 'bk-017', day: 5, slot: '1500', duration: 1, studentId: null,      cfiId: null,       aircraftId: 'ac-003', type: 'club_flight', title: 'Club — Fiona Weston' },
]
