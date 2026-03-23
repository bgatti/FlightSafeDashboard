// Risk register — hazards, risk matrix position (probability × severity), mitigations
// ICAO 5×5 risk matrix:
//   severity:     1=Negligible  2=Minor  3=Major  4=Hazardous  5=Catastrophic
//   probability:  1=Improbable  2=Unlikely  3=Remote  4=Probable  5=Frequent
// Risk index = probability × severity
//   Green (Acceptable):   ≤4
//   Yellow (Mitigable):   5–11
//   Red (Unacceptable):   ≥12

export const SEVERITY_LABELS = ['', 'Negligible', 'Minor', 'Major', 'Hazardous', 'Catastrophic']
export const PROBABILITY_LABELS = ['', 'Improbable', 'Unlikely', 'Remote', 'Probable', 'Frequent']

function riskZone(p, s) {
  const idx = p * s
  if (idx >= 12) return 'red'
  if (idx >= 5)  return 'yellow'
  return 'green'
}

export const mockHazards = [
  {
    id: 'haz-001',
    title: 'Night IMC approach without current alternates',
    paveCategory: 'V',
    probability: 3,   // Remote
    severity: 4,      // Hazardous
    riskZone: riskZone(3, 4),
    status: 'open',
    mitigations: [
      'Require filed alternate with VMC weather',
      'Brief crew on missed approach hold-and-reattempt protocol',
    ],
    identifiedDate: '2026-03-15',
    owner: 'Jordan Lee',
    linkedReport: 'RPT-046',
  },
  {
    id: 'haz-002',
    title: 'Pilot fatigue — high duty hour accumulation',
    paveCategory: 'P',
    probability: 4,   // Probable
    severity: 4,      // Hazardous
    riskZone: riskZone(4, 4),
    status: 'open',
    mitigations: [
      'Daily duty time tracking in dispatch system',
      'Mandatory 10hr rest period enforced by software',
      'Fatigue self-reporting non-punitive policy published',
    ],
    identifiedDate: '2026-02-28',
    owner: 'Alex Torres',
    linkedReport: 'RPT-046',
  },
  {
    id: 'haz-003',
    title: 'Convective weather encounter en route — SIGMET active',
    paveCategory: 'V',
    probability: 3,   // Remote
    severity: 5,      // Catastrophic
    riskZone: riskZone(3, 5),
    status: 'open',
    mitigations: [
      'Mandatory route weather brief before departure',
      'SIGMET deviation authority delegated to PIC without ATC approval',
      'Real-time weather in cockpit (XM WX)',
    ],
    identifiedDate: '2026-03-10',
    owner: 'Jordan Lee',
    linkedReport: null,
  },
  {
    id: 'haz-004',
    title: 'Aircraft annual/100hr inspection overdue (N11111)',
    paveCategory: 'A',
    probability: 2,   // Unlikely
    severity: 4,      // Hazardous
    riskZone: riskZone(2, 4),
    status: 'open',
    mitigations: [
      'Inspection scheduled for within 14 days',
      'Additional pre-flight inspection items added to checklist',
    ],
    identifiedDate: '2026-03-18',
    owner: 'Tyler Brooks',
    linkedReport: 'RPT-045',
  },
  {
    id: 'haz-005',
    title: 'Commercial pressure to dispatch into marginal weather',
    paveCategory: 'E',
    probability: 3,   // Remote
    severity: 4,      // Hazardous
    riskZone: riskZone(3, 4),
    status: 'open',
    mitigations: [
      'Published go/no-go authority rests with PIC — non-negotiable',
      'Safety manager briefed on all delayed/cancelled flights',
      'External pressure pilot report non-punitive process in place',
    ],
    identifiedDate: '2026-02-28',
    owner: 'Jordan Lee',
    linkedReport: 'RPT-044',
  },
  {
    id: 'haz-006',
    title: 'MEL item (pitot heat) limiting IFR operations',
    paveCategory: 'A',
    probability: 2,   // Unlikely
    severity: 3,      // Major
    riskZone: riskZone(2, 3),
    status: 'mitigated',
    mitigations: [
      'Operations limited to VMC until MEL repaired',
      'N67890 dispatched VMC-only pending repair',
    ],
    identifiedDate: '2026-03-16',
    owner: 'Diane Wu',
    linkedReport: null,
  },
  {
    id: 'haz-007',
    title: 'Expired pilot currency — night operations (R. Jones)',
    paveCategory: 'P',
    probability: 4,   // Probable
    severity: 3,      // Major
    riskZone: riskZone(4, 3),
    status: 'open',
    mitigations: [
      'Jones restricted from night operations pending currency flights',
      'Currency flights scheduled for this week',
    ],
    identifiedDate: '2026-03-21',
    owner: 'Alex Torres',
    linkedReport: null,
  },
]

// Aggregate data for the 5×5 heat map
// Returns count of hazards at each [probability][severity] cell
export function buildHeatMapData(hazards) {
  // heatMap[prob][sev] = count
  const heatMap = Array.from({ length: 6 }, () => Array(6).fill(0))
  for (const h of hazards) {
    heatMap[h.probability][h.severity]++
  }
  return heatMap
}

export const mockHeatMapData = buildHeatMapData(mockHazards)

// ─── KPI / SPI time-series for charts ────────────────────────────────────────
// 12 months of data — current year and prior year side by side

const KPI_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

export const mockKpiTimeSeries = {
  // Lagging: incidents per 1,000 flight hours
  incidentRate: {
    labels:    KPI_LABELS,
    thisYear:  [0.0, 0.5, 0.0, 1.0, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, 0.5, 1.0],
    lastYear:  [1.0, 0.5, 1.5, 1.0, 2.0, 0.5, 1.0, 0.5, 1.5, 1.0, 0.5, 0.5],
    label: 'Incident Rate (per 1,000 FH)',
    unit: '/1k FH',
    lowerIsBetter: true,
  },

  // Leading: % training current across all personnel
  trainingCompliance: {
    labels:    KPI_LABELS,
    thisYear:  [100, 100, 95, 95, 95, 90, 90, 85, 85, 82, 82, 78],
    lastYear:  [85,  85,  80, 75, 75, 70, 68, 68, 72, 75, 78, 80],
    label: 'Training Compliance %',
    unit: '%',
    lowerIsBetter: false,
  },

  // Leading: voluntary disclosure report rate (reports per month — higher = healthier culture)
  disclosureRate: {
    labels:    KPI_LABELS,
    thisYear:  [2, 1, 3, 2, 4, 2, 3, 2, 5, 3, 4, 4],
    lastYear:  [0, 1, 1, 0, 2, 1, 1, 2, 1, 1, 2, 2],
    label: 'Disclosure Reports / Month',
    unit: 'reports',
    lowerIsBetter: false,
  },

  // Lagging: open corrective actions
  openCorrectiveActions: {
    labels:    KPI_LABELS,
    thisYear:  [0, 1, 2, 1, 2, 3, 3, 4, 2, 3, 3, 2],
    lastYear:  [3, 4, 5, 4, 6, 5, 4, 3, 3, 4, 3, 3],
    label: 'Open Corrective Actions',
    unit: 'items',
    lowerIsBetter: true,
  },

  // Leading: audit score (% findings resolved)
  auditScore: {
    labels:    KPI_LABELS,
    thisYear:  [100, 100, 100, 95, 95, 90, 90, 88, 90, 92, 92, 94],
    lastYear:  [80,  78,  82,  80, 75, 72, 75, 78, 82, 85, 85, 88],
    label: 'Audit Finding Resolution %',
    unit: '%',
    lowerIsBetter: false,
  },
}

// Current-period SPI targets vs actuals for scorecard widgets
export const mockSpiTargets = [
  { label: 'Accident Rate',        actual: 0,   target: 0,    unit: '/1k FH',  lowerIsBetter: true,  status: 'low' },
  { label: 'Serious Incident Rate',actual: 0,   target: 0,    unit: '/1k FH',  lowerIsBetter: true,  status: 'low' },
  { label: 'Incident Rate',        actual: 1.0, target: 0.5,  unit: '/1k FH',  lowerIsBetter: true,  status: 'high' },
  { label: 'Training Compliance',  actual: 78,  target: 95,   unit: '%',       lowerIsBetter: false, status: 'high' },
  { label: 'Disclosure Reports',   actual: 4,   target: 3,    unit: '/month',  lowerIsBetter: false, status: 'low' },
  { label: 'Open CA Items',        actual: 2,   target: 0,    unit: 'items',   lowerIsBetter: true,  status: 'medium' },
  { label: 'Audit Resolution',     actual: 94,  target: 100,  unit: '%',       lowerIsBetter: false, status: 'medium' },
]
