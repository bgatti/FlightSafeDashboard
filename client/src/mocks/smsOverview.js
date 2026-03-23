export const mockSmsPillars = [
  {
    id: 'policy',
    title: 'Safety Policy',
    smsNumber: '1',
    statusLevel: 'medium',
    metrics: [
      { label: 'Policy last reviewed', value: '2026-01-15' },
      { label: 'Next review due', value: '2026-07-15' },
      { label: 'Safety objectives met', value: '4 / 6' },
    ],
    paveBreakdown: { P: 30, A: 25, V: 40, E: 55 },
  },
  {
    id: 'risk',
    title: 'Risk Management',
    smsNumber: '2',
    statusLevel: 'high',
    metrics: [
      { label: 'Open hazards', value: '7' },
      { label: 'Active risk controls', value: '12' },
      { label: 'Risk register age', value: '14 days' },
    ],
    paveBreakdown: { P: 50, A: 35, V: 72, E: 60 },
  },
  {
    id: 'assurance',
    title: 'Safety Assurance',
    smsNumber: '3',
    statusLevel: 'low',
    metrics: [
      { label: 'Next audit in', value: '18 days' },
      { label: 'Open findings', value: '2' },
      { label: 'Compliance rate (12m)', value: '94%' },
    ],
    paveBreakdown: { P: 20, A: 18, V: 25, E: 30 },
  },
  {
    id: 'promotion',
    title: 'Safety Promotion',
    smsNumber: '4',
    statusLevel: 'medium',
    metrics: [
      { label: 'Disclosure reports (30d)', value: '4' },
      { label: 'NASA ASRS filed (YTD)', value: '2' },
      { label: 'Training compliance', value: '78%' },
    ],
    paveBreakdown: { P: 45, A: 22, V: 33, E: 50 },
  },
]

export const mockPaveStatus = [
  {
    key: 'P',
    label: 'Pilot',
    score: 48,
    summary: '2 near currency',
    detail: 'PIC duty avg 7.2h',
    realtime: [
      { label: 'Crew on duty', value: '3 of 5 pilots' },
      { label: 'Near currency expiry', value: '2 pilots (IFR < 30d)' },
      { label: 'Max duty time today', value: '9.5h (Smith, J.)' },
    ],
    historic: [
      { label: 'Disclosure reports (90d)', value: '3 — all P category' },
      { label: 'Training completion', value: '78%' },
      { label: 'Incident involvement (1yr)', value: '0' },
    ],
  },
  {
    key: 'A',
    label: 'Aircraft',
    score: 22,
    summary: 'MEL: 1 open squawk',
    detail: '0 AOG last 90d',
    realtime: [
      { label: 'Airworthy aircraft', value: '4 of 5' },
      { label: 'MEL items open', value: '1 (N22222 — nav light)' },
      { label: 'Open squawks', value: '1' },
    ],
    historic: [
      { label: 'AOG events (90d)', value: '0' },
      { label: 'Recurring squawks (1yr)', value: '2 (altimeter discrepancy)' },
      { label: 'Last 100hr/annual', value: 'All current' },
    ],
  },
  {
    key: 'V',
    label: 'enVironment',
    score: 76,
    summary: '2 active SIGMETs',
    detail: 'AIRMET Sierra on route',
    realtime: [
      { label: 'Active SIGMETs', value: '2 (Convective + Turbulence)' },
      { label: 'Active AIRMETs', value: '1 (Sierra — IFR conds)' },
      { label: 'Worst flight category', value: 'IFR (KLAX)' },
    ],
    historic: [
      { label: 'Weather accidents (AirSafe)', value: '12 similar (2010–2024)' },
      { label: 'Seasonal risk trend', value: '▲ Spring convective season' },
      { label: 'Route IMC frequency', value: 'KPHX→KLAX: 18% of ops' },
    ],
  },
  {
    key: 'E',
    label: 'External',
    score: 55,
    summary: 'Schedule pressure',
    detail: '1 hard departure',
    realtime: [
      { label: 'Hard departures today', value: '1 (N12345 pax connecting)' },
      { label: 'Active TFRs on routes', value: '0' },
      { label: 'Alternates available', value: 'All routes have alternate' },
    ],
    historic: [
      { label: 'E-category reports (1yr)', value: '4 (pressure-related)' },
      { label: 'Go/no-go overrides (1yr)', value: '1' },
      { label: 'Compliance findings (E)', value: '0 open' },
    ],
  },
]
