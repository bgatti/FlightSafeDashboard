export const mockComplianceStatus = [
  { label: 'Regulatory',  pct: 78, level: 'medium', dueLabel: 'Due 4/15' },
  { label: 'SMS Manual',  pct: 94, level: 'low',    dueLabel: 'Current' },
  { label: 'Training',    pct: 51, level: 'high',   dueLabel: 'Overdue' },
  { label: 'Maintenance', pct: 88, level: 'low',    dueLabel: 'Current' },
]

export const mockCompliancePackages = [
  { id: 'CP-2026-03', type: 'Quarterly', filedAt: '2026-03-01', status: 'filed' },
  { id: 'CP-2026-02', type: 'Incident',  filedAt: '2026-02-14', status: 'filed' },
  { id: 'CP-2026-01', type: 'Annual',    filedAt: '2026-01-05', status: 'filed' },
  { id: 'CP-2025-12', type: 'Quarterly', filedAt: '2025-12-31', status: 'filed' },
]
