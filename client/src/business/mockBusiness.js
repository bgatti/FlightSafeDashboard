// =============================================================================
// Business P&L Mock Data — FBO + Maintenance + Training revenue model
// Months Jan 2025 → Mar 2026 (index 0–14). April 2025 (index 3) is seasonal baseline.
// Revenue generated programmatically: base × seasonalFactor × growthTrend × noise
// =============================================================================

import dayjs from 'dayjs'

// ── Seasonal index by month (GA aviation traffic, April = 1.00) ───────────────
export const SEASONAL_IDX = {
  '01': 0.80, '02': 0.85, '03': 0.93, '04': 1.00, '05': 1.08,
  '06': 1.25, '07': 1.30, '08': 1.28, '09': 1.10, '10': 1.05,
  '11': 0.88, '12': 0.84,
}

// ── SKU definitions (sorted by baseline revenue — top 8 + 2 that roll to "Other") ──
// seasonFactor: 1.0 = fully seasonal; 0.0 = flat year-round
export const SKU_LIST = [
  { id: 'jet_a',       label: 'Jet-A Fuel',         bu: 'Fuel Sales',      cogsRate: 0.724, seasonFactor: 1.0, baseRev: 8700 },
  { id: 'maint_labor', label: 'Maintenance Labor',   bu: 'Maintenance',     cogsRate: 0.600, seasonFactor: 0.6, baseRev: 5200 },
  { id: 'avgas',       label: 'Avgas 100LL',         bu: 'Fuel Sales',      cogsRate: 0.733, seasonFactor: 1.0, baseRev: 3750 },
  { id: 'maint_parts', label: 'Maintenance Parts',   bu: 'Maintenance',     cogsRate: 0.750, seasonFactor: 0.6, baseRev: 2800 },
  { id: 'hangar',      label: 'Hangar Rental',       bu: 'Ground Services', cogsRate: 0.300, seasonFactor: 0.4, baseRev: 2400 },
  { id: 'sim',         label: 'Sim Training',        bu: 'Training',        cogsRate: 0.250, seasonFactor: 0.3, baseRev: 1800 },
  { id: 'ramp_fee',    label: 'Ramp Fees',           bu: 'Ground Services', cogsRate: 0.100, seasonFactor: 1.0, baseRev: 1100 },
  { id: 'cleaning',    label: 'Interior Cleaning',   bu: 'Ground Services', cogsRate: 0.350, seasonFactor: 0.9, baseRev: 900  },
  // Indices 8-9: roll into "Other Services" when top8 toggle is on
  { id: 'gpu',         label: 'Ground Power (GPU)',  bu: 'Ground Services', cogsRate: 0.300, seasonFactor: 0.8, baseRev: 700  },
  { id: 'other_svcs',  label: 'Other Services',      bu: 'Ground Services', cogsRate: 0.400, seasonFactor: 0.9, baseRev: 575  },
]

export const BU_LIST = ['Fuel Sales', 'Maintenance', 'Ground Services', 'Training']

export const BU_COLORS = {
  'Fuel Sales':      '#38bdf8',
  'Maintenance':     '#fb923c',
  'Ground Services': '#34d399',
  'Training':        '#a78bfa',
}

// SKU colors: reuse BU color with shading for multiple SKUs in same BU
export const SKU_COLORS = {
  jet_a:       '#38bdf8',
  avgas:       '#0ea5e9',
  maint_labor: '#fb923c',
  maint_parts: '#f97316',
  hangar:      '#34d399',
  ramp_fee:    '#10b981',
  cleaning:    '#6ee7b7',
  gpu:         '#a7f3d0',
  sim:         '#a78bfa',
  other_svcs:  '#64748b',
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function addMonths(yyyyMM, n) {
  const [y, m] = yyyyMM.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Deterministic micro-variance (no Math.random — stable across renders)
function noise(skuIdx, monthIdx) {
  return 1 + Math.sin(skuIdx * 3.7 + monthIdx * 1.9 + 0.5) * 0.06
           + Math.cos(skuIdx * 1.3 + monthIdx * 2.8) * 0.04
}

// ── Generate monthly data ─────────────────────────────────────────────────────
const START = '2025-01'
const COUNT  = 15
const GROWTH = 0.012  // 1.2% compound monthly growth

export const MONTHS = Array.from({ length: COUNT }, (_, i) => addMonths(START, i))

export const mockMonthly = MONTHS.map((month, i) => {
  const mm     = month.slice(5, 7)
  const si     = SEASONAL_IDX[mm]
  const trend  = Math.pow(1 + GROWTH, i)

  const skus = {}
  for (const [skuIdx, sku] of SKU_LIST.entries()) {
    const effectiveSI = 1 + (si - 1) * sku.seasonFactor
    const rev  = Math.round(sku.baseRev * effectiveSI * trend * noise(skuIdx, i))
    const cogs = Math.round(rev * sku.cogsRate)
    skus[sku.id] = { revenue: rev, cogs }
  }

  const totalRevenue = Object.values(skus).reduce((s, v) => s + v.revenue, 0)
  const totalCogs    = Object.values(skus).reduce((s, v) => s + v.cogs, 0)
  const grossProfit  = totalRevenue - totalCogs
  // Budget: flat optimistic projection set at start of year
  const budget = Math.round(29800 * Math.pow(1.008, i))

  return {
    month,
    label: dayjs(month + '-01').format("MMM 'YY"),
    skus,
    totalRevenue,
    totalCogs,
    grossProfit,
    grossMarginPct: Math.round((grossProfit / totalRevenue) * 1000) / 10,
    budget,
  }
})

// ── KPI series ────────────────────────────────────────────────────────────────
export const mockKpiSeries = MONTHS.map((month, i) => {
  const mm      = month.slice(5, 7)
  const si      = SEASONAL_IDX[mm]
  const trend   = Math.pow(1 + GROWTH, i)
  const d       = mockMonthly[i]
  const visits  = Math.round(38 * si * trend * (1 + Math.sin(i * 2.1) * 0.04))
  return {
    month,
    label: d.label,
    visits,
    avgTicket:    Math.round(d.totalRevenue / visits),
    revPerVisit:  Math.round(d.totalRevenue / visits),
    rampUtilPct:  Math.min(Math.round((visits * 1.4) / (8 * 30) * 100), 95),
    grossMarginPct: d.grossMarginPct,
    budget: d.budget,
  }
})
