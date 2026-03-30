// =============================================================================
// Aircraft Lease Mock Data — per-aircraft lease relationships
// Lease period: Apr 2025 – Mar 2026 (12 months, T12M window)
// Lease types: dry_lease | wet_lease_acmi | leaseback
//
// Maintenance Reserve (MR): $/hr escrowed each flight hour → covers mx costs
// Engine Reserve (ER): $/hr escrowed for turbine overhaul (PT6A TBO ~3,600 hrs)
// Utilization %: flownYTD / contractedYTD × 100
// =============================================================================

// ─── 12-month window Apr 2025 → Mar 2026 ─────────────────────────────────────
export const LEASE_MONTHS = [
  { key: '2025-04', label: 'Apr', seasonal: 1.00 },
  { key: '2025-05', label: 'May', seasonal: 1.08 },
  { key: '2025-06', label: 'Jun', seasonal: 1.25 },
  { key: '2025-07', label: 'Jul', seasonal: 1.30 },
  { key: '2025-08', label: 'Aug', seasonal: 1.28 },
  { key: '2025-09', label: 'Sep', seasonal: 1.10 },
  { key: '2025-10', label: 'Oct', seasonal: 1.05 },
  { key: '2025-11', label: 'Nov', seasonal: 0.88 },
  { key: '2025-12', label: 'Dec', seasonal: 0.84 },
  { key: '2026-01', label: 'Jan', seasonal: 0.80 },
  { key: '2026-02', label: 'Feb', seasonal: 0.85 },
  { key: '2026-03', label: 'Mar', seasonal: 0.93 },  // partial month — through Mar 29
]

// ─── Lease type labels ────────────────────────────────────────────────────────
export const LEASE_TYPE_LABELS = {
  dry_lease:      'Dry Lease',
  wet_lease_acmi: 'Wet Lease / ACMI',
  leaseback:      'Leaseback',
}

export const LEASE_TYPE_COLORS = {
  dry_lease:      'text-sky-400 bg-sky-400/10 border-sky-400/30',
  wet_lease_acmi: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  leaseback:      'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
}

// ─── Debit categories ─────────────────────────────────────────────────────────
export const DEBIT_CATEGORIES = {
  inspection_100hr:    '100-Hr Inspection',
  annual:              'Annual Inspection',
  ad_compliance:       'AD Compliance',
  unscheduled:         'Unscheduled Repair',
  engine_hot_section:  'Engine Hot Section',
  engine_trend:        'Engine Trend Check',
  prop_overhaul:       'Propeller / De-Ice',
}

// ─── Lease records ────────────────────────────────────────────────────────────
// monthlyContracted: programmatic (contractedPerYear / 12 × seasonal), rounded
// monthlyFlown:      actual hours flown — reflects utilization factor + events

export const mockLeases = [

  // ── N12345 — Beechcraft Baron 58 ──────────────────────────────────────────
  {
    aircraftId: 'ac-001',
    tailNumber: 'N12345',
    makeModel: 'Beechcraft Baron 58',

    leaseType: 'dry_lease',
    lesseeCompany: 'Rocky Mountain Charter LLC',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'active',
    statusNote: null,
    autoRenew: true,
    securityDeposit: 15000,

    // Rates
    hourlyRate: 1450,           // $/hr billed to lessee (charter rate)
    maintenanceReservePerHr: 65,
    engineReserveApplicable: false,
    engineReservePerHr: 0,

    // Program hours — contracted 400 hrs/yr
    // Monthly target = 400/12 × seasonal ≈ 33.3 × seasonal
    monthlyContracted: [33, 36, 42, 43, 43, 37, 35, 29, 28, 27, 28, 31],
    // Actual: utilization ~0.92, charter demand varies
    monthlyFlown:      [31, 33, 38, 41, 40, 34, 32, 27, 25, 24, 27, 29],

    maintenanceDebits: [
      {
        id: 'ld-001-1',
        yearMonth: '2025-06',
        date: '2025-06-12',
        description: '100-hr inspection — both engines, airframe, systems',
        category: 'inspection_100hr',
        laborHrs: 14,
        laborCost: 1680,
        partsCost: 980,
        total: 2660,
      },
      {
        id: 'ld-001-2',
        yearMonth: '2025-08',
        date: '2025-08-22',
        description: 'Right engine magneto overhaul — Slick 6220 (TBO reached)',
        category: 'unscheduled',
        laborHrs: 6,
        laborCost: 720,
        partsCost: 1130,
        total: 1850,
      },
      {
        id: 'ld-001-3',
        yearMonth: '2025-10',
        date: '2025-10-08',
        description: 'Annual inspection — full airframe, both engines, avionics',
        category: 'annual',
        laborHrs: 22,
        laborCost: 2640,
        partsCost: 1560,
        total: 4200,
      },
      {
        id: 'ld-001-4',
        yearMonth: '2025-10',
        date: '2025-10-10',
        description: 'TKS FIKI fluid pump seal replacement (found during annual)',
        category: 'unscheduled',
        laborHrs: 3,
        laborCost: 360,
        partsCost: 440,
        total: 800,
      },
      {
        id: 'ld-001-5',
        yearMonth: '2026-01',
        date: '2026-01-15',
        description: 'Brake caliper assembly replacement — both main gear',
        category: 'unscheduled',
        laborHrs: 3,
        laborCost: 360,
        partsCost: 620,
        total: 980,
      },
      {
        id: 'ld-001-6',
        yearMonth: '2026-03',
        date: '2026-03-05',
        description: 'AD 2024-02-12 — landing gear actuator lubrication',
        category: 'ad_compliance',
        laborHrs: 3,
        laborCost: 360,
        partsCost: 0,
        total: 360,
      },
    ],
    engineDebits: [],
  },

  // ── N67890 — Cessna 172S Skyhawk ──────────────────────────────────────────
  {
    aircraftId: 'ac-002',
    tailNumber: 'N67890',
    makeModel: 'Cessna 172S Skyhawk',

    leaseType: 'leaseback',
    lesseeCompany: 'Boulder Flight Academy',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'active',
    statusNote: null,
    autoRenew: true,
    securityDeposit: 5000,

    // Rates — Hobbs-based rental
    hourlyRate: 185,
    maintenanceReservePerHr: 25,
    engineReserveApplicable: false,
    engineReservePerHr: 0,

    // Program hours — contracted 600 hrs/yr; flight school runs slightly over (high utilization)
    monthlyContracted: [50, 54, 63, 65, 64, 55, 53, 44, 42, 40, 43, 47],
    monthlyFlown:      [52, 57, 66, 68, 67, 58, 56, 46, 44, 42, 45, 50],

    maintenanceDebits: [
      {
        id: 'ld-002-1',
        yearMonth: '2025-05',
        date: '2025-05-18',
        description: '100-hr inspection — airframe, engine, avionics',
        category: 'inspection_100hr',
        laborHrs: 10,
        laborCost: 1200,
        partsCost: 560,
        total: 1760,
      },
      {
        id: 'ld-002-2',
        yearMonth: '2025-08',
        date: '2025-08-10',
        description: 'Spark plug replacement — all 8 plugs (Champion REM38E)',
        category: 'unscheduled',
        laborHrs: 2,
        laborCost: 240,
        partsCost: 380,
        total: 620,
      },
      {
        id: 'ld-002-3',
        yearMonth: '2025-09',
        date: '2025-09-28',
        description: '100-hr inspection — engine trend analysis, oil change',
        category: 'inspection_100hr',
        laborHrs: 10,
        laborCost: 1200,
        partsCost: 440,
        total: 1640,
      },
      {
        id: 'ld-002-4',
        yearMonth: '2025-11',
        date: '2025-11-06',
        description: 'Annual inspection — full airframe and engine inspection',
        category: 'annual',
        laborHrs: 16,
        laborCost: 1920,
        partsCost: 820,
        total: 2740,
      },
      {
        id: 'ld-002-5',
        yearMonth: '2026-02',
        date: '2026-02-12',
        description: 'Pitot heat element replacement (MEL C resolution) + 100-hr',
        category: 'inspection_100hr',
        laborHrs: 11,
        laborCost: 1320,
        partsCost: 710,
        total: 2030,
      },
    ],
    engineDebits: [],
  },

  // ── N11111 — Piper Cherokee 28 ────────────────────────────────────────────
  {
    aircraftId: 'ac-003',
    tailNumber: 'N11111',
    makeModel: 'Piper Cherokee 28',

    leaseType: 'dry_lease',
    lesseeCompany: 'Front Range Aero Club',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'active',
    statusNote: 'Annual and 100-hr due within 30 days — schedule maintenance',
    autoRenew: false,
    securityDeposit: 4500,

    hourlyRate: 160,
    maintenanceReservePerHr: 30,
    engineReserveApplicable: false,
    engineReservePerHr: 0,

    // Program hours — contracted 350 hrs/yr; lower utilization on older airframe
    monthlyContracted: [29, 32, 37, 38, 37, 32, 31, 26, 24, 23, 25, 27],
    monthlyFlown:      [25, 27, 32, 33, 31, 27, 26, 22, 20, 19, 21, 23],

    maintenanceDebits: [
      {
        id: 'ld-003-1',
        yearMonth: '2025-06',
        date: '2025-06-28',
        description: '100-hr inspection — airframe, engine (TT 3323 hrs)',
        category: 'inspection_100hr',
        laborHrs: 10,
        laborCost: 1200,
        partsCost: 480,
        total: 1680,
      },
      {
        id: 'ld-003-2',
        yearMonth: '2025-09',
        date: '2025-09-14',
        description: 'Brake master cylinder replacement — AD 2021-19-07 reinspection',
        category: 'ad_compliance',
        laborHrs: 4,
        laborCost: 480,
        partsCost: 760,
        total: 1240,
      },
      {
        id: 'ld-003-3',
        yearMonth: '2025-12',
        date: '2025-12-18',
        description: 'Annual inspection — full airframe; altimeter #2 recalibrated',
        category: 'annual',
        laborHrs: 16,
        laborCost: 1920,
        partsCost: 780,
        total: 2700,
      },
      {
        id: 'ld-003-4',
        yearMonth: '2026-01',
        date: '2026-01-25',
        description: 'AD 2024-11-03 — fuel selector valve inspection and rework',
        category: 'ad_compliance',
        laborHrs: 6,
        laborCost: 720,
        partsCost: 960,
        total: 1680,
      },
    ],
    engineDebits: [],
  },

  // ── N22222 — Cessna 208 Caravan ───────────────────────────────────────────
  {
    aircraftId: 'ac-004',
    tailNumber: 'N22222',
    makeModel: 'Cessna 208 Caravan',

    leaseType: 'wet_lease_acmi',
    lesseeCompany: 'Summit Air Charter Inc',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'active',
    statusNote: null,
    autoRenew: true,
    securityDeposit: 40000,

    // Wet/ACMI: operator provides aircraft, crew, insurance, mx
    hourlyRate: 2600,           // $/hr ACMI block rate (crew + fuel + mx included)
    maintenanceReservePerHr: 110,
    engineReserveApplicable: true,  // PT6A-114A engine reserve
    engineReservePerHr: 105,        // $105/hr toward PT6A TBO (~$280k, 3600-hr TBO)

    // Program hours — contracted 500 hrs/yr; ACMI guarantees minimum block
    monthlyContracted: [42, 45, 52, 54, 53, 46, 44, 37, 35, 33, 35, 39],
    monthlyFlown:      [40, 43, 50, 51, 49, 44, 42, 35, 33, 31, 33, 37],

    maintenanceDebits: [
      {
        id: 'ld-004-1',
        yearMonth: '2025-07',
        date: '2025-07-08',
        description: '100-hr inspection — PT6A trend check, airframe, avionics',
        category: 'inspection_100hr',
        laborHrs: 18,
        laborCost: 2160,
        partsCost: 1840,
        total: 4000,
      },
      {
        id: 'ld-004-2',
        yearMonth: '2025-09',
        date: '2025-09-20',
        description: 'AD 2023-06-18 — engine fuel control unit inspection',
        category: 'ad_compliance',
        laborHrs: 8,
        laborCost: 960,
        partsCost: 480,
        total: 1440,
      },
      {
        id: 'ld-004-3',
        yearMonth: '2025-11',
        date: '2025-11-18',
        description: '100-hr inspection — engine borescope, oil analysis (TT 5420 hrs)',
        category: 'inspection_100hr',
        laborHrs: 20,
        laborCost: 2400,
        partsCost: 1600,
        total: 4000,
      },
      {
        id: 'ld-004-4',
        yearMonth: '2026-02',
        date: '2026-02-03',
        description: 'AD 2024-08-05 — propeller de-ice boot replacement (both boots)',
        category: 'prop_overhaul',
        laborHrs: 10,
        laborCost: 1200,
        partsCost: 2600,
        total: 3800,
      },
    ],
    // Engine reserve debits — charged separately against engine reserve fund
    engineDebits: [
      {
        id: 'ld-004-e1',
        yearMonth: '2025-12',
        date: '2025-12-02',
        description: 'PT6A-114A hot section inspection — power turbine, combustor liner',
        category: 'engine_hot_section',
        laborHrs: 40,
        laborCost: 4800,
        partsCost: 14200,
        total: 19000,
      },
      {
        id: 'ld-004-e2',
        yearMonth: '2026-02',
        date: '2026-02-20',
        description: 'PT6A engine trend monitoring — borescope + oil spectrometry',
        category: 'engine_trend',
        laborHrs: 4,
        laborCost: 480,
        partsCost: 220,
        total: 700,
      },
    ],
  },

  // ── N33333 — Cessna 172N (GROUNDED / SUSPENDED) ───────────────────────────
  {
    aircraftId: 'ac-005',
    tailNumber: 'N33333',
    makeModel: 'Cessna 172N Skyhawk',

    leaseType: 'leaseback',
    lesseeCompany: 'Boulder Flight Academy',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'suspended',
    statusNote: 'Grounded 2026-03-20 — oil pressure squawk / overdue annual. Billing suspended. Reserve balance held pending AOG resolution.',
    autoRenew: false,
    securityDeposit: 3500,

    hourlyRate: 150,
    maintenanceReservePerHr: 30,
    engineReserveApplicable: false,
    engineReservePerHr: 0,

    // Program hours — contracted 200 hrs/yr; lower due to aircraft age
    monthlyContracted: [17, 18, 21, 22, 21, 18, 18, 15, 14, 13, 14, 15],
    // Actual: low utilization, then suspended Mar 20 (3 hours early in month only)
    monthlyFlown:      [13, 14, 16, 17, 15, 14, 13, 11, 10, 9, 10, 3],

    maintenanceDebits: [
      {
        id: 'ld-005-1',
        yearMonth: '2025-04',
        date: '2025-04-15',
        description: '100-hr inspection — airframe, engine (TT 6715 hrs)',
        category: 'inspection_100hr',
        laborHrs: 10,
        laborCost: 1200,
        partsCost: 380,
        total: 1580,
      },
      {
        id: 'ld-005-2',
        yearMonth: '2025-08',
        date: '2025-08-28',
        description: 'Spark plug replacement — all 4 plugs, oil change',
        category: 'unscheduled',
        laborHrs: 2,
        laborCost: 240,
        partsCost: 240,
        total: 480,
      },
      {
        id: 'ld-005-3',
        yearMonth: '2025-11',
        date: '2025-11-14',
        description: '100-hr inspection — carburetor overhaul, ELT battery',
        category: 'inspection_100hr',
        laborHrs: 12,
        laborCost: 1440,
        partsCost: 620,
        total: 2060,
      },
      // AOG event — not a reserve debit; flagged separately for visibility
      {
        id: 'ld-005-4',
        yearMonth: '2026-03',
        date: '2026-03-20',
        description: 'AOG — oil pressure fluctuation squawk; billing suspended (not debited)',
        category: 'unscheduled',
        laborHrs: 0,
        laborCost: 0,
        partsCost: 0,
        total: 0,
        aogEvent: true,   // flagged — pending diagnosis, not yet charged to reserve
      },
    ],
    engineDebits: [],
  },

  // ── N44444 — Piper PA-34 Seneca ───────────────────────────────────────────
  {
    aircraftId: 'ac-006',
    tailNumber: 'N44444',
    makeModel: 'Piper PA-34 Seneca',

    leaseType: 'dry_lease',
    lesseeCompany: 'Alpine Medical Transport LLC',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'active',
    statusNote: null,
    autoRenew: true,
    securityDeposit: 20000,

    hourlyRate: 680,
    maintenanceReservePerHr: 55,
    engineReserveApplicable: false,
    engineReservePerHr: 0,

    // Program hours — contracted 300 hrs/yr; corporate/medical, periodic schedule
    monthlyContracted: [25, 27, 31, 33, 32, 28, 26, 22, 21, 20, 21, 23],
    monthlyFlown:      [22, 24, 28, 30, 28, 25, 23, 19, 18, 17, 19, 21],

    maintenanceDebits: [
      {
        id: 'ld-006-1',
        yearMonth: '2025-05',
        date: '2025-05-28',
        description: '100-hr inspection — both engines (TSIO-360-RB), airframe',
        category: 'inspection_100hr',
        laborHrs: 16,
        laborCost: 1920,
        partsCost: 980,
        total: 2900,
      },
      {
        id: 'ld-006-2',
        yearMonth: '2025-08',
        date: '2025-08-12',
        description: 'Left engine turbocharger inspection — wastegate actuator',
        category: 'unscheduled',
        laborHrs: 7,
        laborCost: 840,
        partsCost: 1260,
        total: 2100,
      },
      {
        id: 'ld-006-3',
        yearMonth: '2025-11',
        date: '2025-11-20',
        description: 'Annual inspection — full airframe, both engines, avionics',
        category: 'annual',
        laborHrs: 20,
        laborCost: 2400,
        partsCost: 1640,
        total: 4040,
      },
      {
        id: 'ld-006-4',
        yearMonth: '2026-02',
        date: '2026-02-26',
        description: 'AD 2023-12-04 — fuel line P/N 758-990 re-inspection',
        category: 'ad_compliance',
        laborHrs: 5,
        laborCost: 600,
        partsCost: 850,
        total: 1450,
      },
    ],
    engineDebits: [],
  },

  // ── N55555 — Cessna 208B Grand Caravan ────────────────────────────────────
  {
    aircraftId: 'ac-007',
    tailNumber: 'N55555',
    makeModel: 'Cessna 208B Grand Caravan',

    leaseType: 'wet_lease_acmi',
    lesseeCompany: 'Colorado Mountain Express',
    lessorCompany: 'FlightSafe Operations LLC',
    leaseStart: '2025-04-01',
    leaseEnd: '2026-03-31',
    status: 'active',
    statusNote: null,
    autoRenew: true,
    securityDeposit: 50000,

    // Premium wet lease — best-equipped aircraft in fleet
    hourlyRate: 2950,
    maintenanceReservePerHr: 90,
    engineReserveApplicable: true,  // PT6A-114A engine reserve
    engineReservePerHr: 100,        // $100/hr (newer airframe, lower TBO accumulation)

    // Program hours — contracted 600 hrs/yr; highest utilization aircraft
    monthlyContracted: [50, 54, 63, 65, 64, 55, 53, 44, 42, 40, 43, 47],
    monthlyFlown:      [55, 59, 69, 72, 70, 61, 58, 48, 46, 44, 47, 52],

    maintenanceDebits: [
      {
        id: 'ld-007-1',
        yearMonth: '2025-06',
        date: '2025-06-06',
        description: '100-hr inspection — PT6A trend, TCAS test, full airframe',
        category: 'inspection_100hr',
        laborHrs: 18,
        laborCost: 2160,
        partsCost: 1640,
        total: 3800,
      },
      {
        id: 'ld-007-2',
        yearMonth: '2025-10',
        date: '2025-10-14',
        description: '100-hr inspection — engine borescope, oil analysis (TT 2010 hrs)',
        category: 'inspection_100hr',
        laborHrs: 20,
        laborCost: 2400,
        partsCost: 1800,
        total: 4200,
      },
      {
        id: 'ld-007-3',
        yearMonth: '2026-01',
        date: '2026-01-18',
        description: 'TKS airframe de-ice fluid system service — tank, pump, nozzles',
        category: 'unscheduled',
        laborHrs: 5,
        laborCost: 600,
        partsCost: 1300,
        total: 1900,
      },
      {
        id: 'ld-007-4',
        yearMonth: '2026-03',
        date: '2026-03-10',
        description: '100-hr inspection — full airframe, G1000 NXi update (TT 2110 hrs)',
        category: 'inspection_100hr',
        laborHrs: 22,
        laborCost: 2640,
        partsCost: 2060,
        total: 4700,
      },
    ],
    engineDebits: [
      {
        id: 'ld-007-e1',
        yearMonth: '2025-08',
        date: '2025-08-20',
        description: 'PT6A-114A engine trend monitoring — borescope + oil spectrometry',
        category: 'engine_trend',
        laborHrs: 4,
        laborCost: 480,
        partsCost: 180,
        total: 660,
      },
      {
        id: 'ld-007-e2',
        yearMonth: '2026-02',
        date: '2026-02-14',
        description: 'PT6A power turbine blade inspection — blade tip clearance check',
        category: 'engine_trend',
        laborHrs: 8,
        laborCost: 960,
        partsCost: 840,
        total: 1800,
      },
    ],
  },
]
