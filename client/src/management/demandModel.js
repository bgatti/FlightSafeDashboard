// =============================================================================
// Demand Forecasting — OLS Regression Model
// Features: day-of-week (sin/cos), seasonal month (sin/cos), is_weekend,
//           is_friday, weather_score
// Trained at module load on 365 days of synthetic historical ops data.
// Prediction: daily airport operations count (arrivals + departures combined)
// =============================================================================

// ── Matrix math (pure JS, no deps) ───────────────────────────────────────────

function matMul(A, B) {
  const m = A.length, n = A[0].length, p = B[0].length
  const C = Array.from({ length: m }, () => new Float64Array(p))
  for (let i = 0; i < m; i++)
    for (let k = 0; k < n; k++) {
      if (A[i][k] === 0) continue
      for (let j = 0; j < p; j++)
        C[i][j] += A[i][k] * B[k][j]
    }
  return C
}

function matTranspose(A) {
  const m = A.length, n = A[0].length
  const T = Array.from({ length: n }, () => new Float64Array(m))
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      T[j][i] = A[i][j]
  return T
}

function matInverse(A) {
  const n = A.length
  const aug = A.map((row, i) => {
    const id = new Array(n).fill(0)
    id[i] = 1
    return [...row, ...id]
  })
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-12) throw new Error('Singular matrix in OLS')
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j]
    }
  }
  return aug.map(row => row.slice(n))
}

// ── Feature encoding ──────────────────────────────────────────────────────────
// [intercept, sin_dow, cos_dow, sin_month, cos_month, is_weekend, is_friday, weather_score]
export const FEATURE_NAMES = [
  'Intercept', 'DoW sin', 'DoW cos', 'Season sin', 'Season cos',
  'Is Weekend', 'Is Friday', 'Weather Score',
]
const N_FEATURES = FEATURE_NAMES.length

export function encodeFeatures(date, weatherScore) {
  const dow   = date.getDay()   // 0=Sun … 6=Sat
  const month = date.getMonth() // 0=Jan … 11=Dec
  return [
    1,
    Math.sin(2 * Math.PI * dow   / 7),
    Math.cos(2 * Math.PI * dow   / 7),
    Math.sin(2 * Math.PI * month / 12),
    Math.cos(2 * Math.PI * month / 12),
    (dow === 0 || dow === 6) ? 1 : 0,
    dow === 5 ? 1 : 0,
    weatherScore,
  ]
}

// ── Training data generation (deterministic, no Math.random) ─────────────────
// True signal: base + DoW effect + seasonal + weather effect + structured noise
const DOW_EFFECT_TRUE   = [3, -2, -1, -1, 0, 4, 2]       // Sun–Sat
const MONTH_EFFECT_TRUE = [-4, -3, -1, 1, 3, 5, 6, 5, 3, 2, 0, -3]  // Jan–Dec (summer peak)
const BASE_OPS = 18
const WEATHER_COEF_TRUE = 8

export function generateTrainingData(nDays = 365) {
  const start = new Date('2025-04-01')
  const rows  = []
  for (let i = 0; i < nDays; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const dow   = date.getDay()
    const month = date.getMonth()
    const wScore = Math.max(0.1, Math.min(1.0,
      0.70
      + Math.cos(2 * Math.PI * month / 12) * 0.15
      + Math.sin(i * 1.7 + 0.5) * 0.10
      + Math.cos(i * 2.9 + 1.3) * 0.08
    ))
    const noise = Math.sin(i * 3.7 + 1.3) * 2.2 + Math.cos(i * 1.9) * 1.5
    const ops = Math.max(0, Math.round(
      BASE_OPS + DOW_EFFECT_TRUE[dow] + MONTH_EFFECT_TRUE[month]
      + wScore * WEATHER_COEF_TRUE + noise
    ))
    rows.push({ date, weatherScore: wScore, ops })
  }
  return rows
}

// ── OLS training ──────────────────────────────────────────────────────────────
function trainOLS(trainingRows) {
  const n  = trainingRows.length
  const Xd = trainingRows.map(r => encodeFeatures(r.date, r.weatherScore))
  const yd = trainingRows.map(r => r.ops)

  const Xt  = matTranspose(Xd)
  const XtX = matMul(Xt, Xd)
  const Xty = matMul(Xt, yd.map(v => [v]))
  const inv = matInverse(XtX)
  const betaMat = matMul(inv, Xty)
  const beta = betaMat.map(row => row[0])

  const yHat = Xd.map(row => row.reduce((s, xi, i) => s + xi * beta[i], 0))
  const yMean = yd.reduce((s, v) => s + v, 0) / n
  const ssTot = yd.reduce((s, v) => s + (v - yMean) ** 2, 0)
  const ssRes = yd.reduce((s, v, i) => s + (v - yHat[i]) ** 2, 0)
  const r2   = 1 - ssRes / ssTot
  const rmse = Math.sqrt(ssRes / n)
  const mae  = yd.reduce((s, v, i) => s + Math.abs(v - yHat[i]), 0) / n

  // Store a sample of training points for residual plot (every 5th day)
  const residualSample = trainingRows
    .filter((_, i) => i % 5 === 0)
    .map((r, idx) => ({ actual: r.ops, fitted: Math.round(yHat[idx * 5]) }))

  return { beta, r2, rmse, mae, n, trainingRows, residualSample }
}

// ── Singleton trained model (runs once at module load) ────────────────────────
const _trainingData = generateTrainingData(365)
export const MODEL = trainOLS(_trainingData)

// ── Prediction ────────────────────────────────────────────────────────────────
export function predict(date, weatherScore) {
  const xi   = encodeFeatures(date, weatherScore)
  const mean = xi.reduce((s, x, i) => s + x * MODEL.beta[i], 0)
  const ci   = MODEL.rmse * 1.645   // 90% PI
  return {
    mean:  Math.max(0, Math.round(mean)),
    low:   Math.max(0, Math.round(mean - ci)),
    high:  Math.max(0, Math.round(mean + ci)),
  }
}

// ── Day-of-week partial effect (for display) ──────────────────────────────────
// Hold month=Apr, weather=0.8, compute predicted ops for each dow
export const DOW_PARTIAL = (() => {
  const refDate = new Date('2026-04-01')  // April (month=3)
  const wScore  = 0.80
  const labels  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return Array.from({ length: 7 }, (_, dow) => {
    const d = new Date(refDate)
    d.setDate(refDate.getDate() + (dow - refDate.getDay() + 7) % 7)
    const xi = encodeFeatures(d, wScore)
    return {
      dow: labels[dow],
      predicted: Math.max(0, Math.round(xi.reduce((s, x, i) => s + x * MODEL.beta[i], 0))),
    }
  })
})()

// ── Monthly seasonal partial effect (for display) ─────────────────────────────
// Hold dow=Wed, weather=0.8, compute predicted ops for each month
export const MONTH_PARTIAL = (() => {
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return Array.from({ length: 12 }, (_, m) => {
    const d = new Date(2026, m, 8)  // 8th of each month → Wednesday usually
    // Force to nearest Wednesday
    while (d.getDay() !== 3) d.setDate(d.getDate() + 1)
    const xi = encodeFeatures(d, 0.80)
    return {
      month: labels[m],
      predicted: Math.max(0, Math.round(xi.reduce((s, x, i) => s + x * MODEL.beta[i], 0))),
    }
  })
})()

// ── Hourly time-of-day profile ────────────────────────────────────────────────
// Returns 24-element array: predicted ops per hour summing to ~dailyOps
// GA pattern: weekday bimodal (0900 + 1600); weekend unimodal (1200)
export function hourlyProfile(date, dailyOps, weatherScore) {
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (h >= 1 && h <= 5) return 0.01   // Quiet overnight hours
    let base
    if (isWeekend) {
      base = Math.exp(-0.5 * ((h - 12) / 3.2) ** 2)
    } else {
      const morning   = Math.exp(-0.5 * ((h - 9 ) / 1.8) ** 2) * 1.0
      const afternoon = Math.exp(-0.5 * ((h - 16) / 2.2) ** 2) * 0.85
      base = morning + afternoon
    }
    return Math.max(0, base * (0.5 + weatherScore * 0.5))
  })
  const total = raw.reduce((s, v) => s + v, 0)
  return raw.map(v => Math.max(0, Math.round((v / total) * dailyOps * 10) / 10))
}

// ── Group-specific demand predictions ─────────────────────────────────────────
// Breaks total predicted ops down into workload metrics per employee department.
// All inputs are derived from the same OLS model output (ops = total movements).
//
//  Flight Ops  — crew-hours needed (own-aircraft operations × avg flight time)
//  Operations  — coverage-hours (dispatcher always on; safety officer on risk days)
//  Maintenance — shop-hours (base schedule + ops-driven squawks + weather addend)
//  FBO         — service events (arrivals × services/visit) + fuel volume by type
//
export function predictGroupDemand(date, weatherScore, ops) {
  const isIFR  = weatherScore <= 0.40
  const isMVFR = weatherScore > 0.40 && weatherScore <= 0.72

  // ── Flight Ops ────────────────────────────────────────────────────────────
  // ~42% of movements are own-aircraft departures requiring a crew pair
  const ownFlights  = Math.round(ops * 0.42)
  const crewHrs     = Math.round(ownFlights * 2.5)   // 2.5hr per crew pair (brief+flight+debrief)
  const picsNeeded  = Math.ceil(ownFlights / 3)       // ~3 flights per PIC per day

  // ── Operations ────────────────────────────────────────────────────────────
  const dispatcherHrs   = ops > 0 ? 10 : 4
  const safetyActivated = isIFR || ops >= 23
  const safetyHrs       = safetyActivated ? 8 : 3

  // ── Maintenance ───────────────────────────────────────────────────────────
  const maintScheduled = 16                               // baseline two-mechanic shift
  const maintSquawks   = Math.round(ops * 0.28)           // unscheduled hrs driven by ops
  const maintWeather   = isIFR ? 6 : isMVFR ? 3 : 0      // preheat, AOG, wx inspections
  const maintTotal     = maintScheduled + maintSquawks + maintWeather

  // ── FBO / Ground ──────────────────────────────────────────────────────────
  const arrivals      = Math.round(ops * 0.50)
  const serviceEvents = Math.round(arrivals * 1.25)       // fueling, tie-down, cleaning, gpu …
  // Fuel mix: ~45% turbine aircraft (Jet-A), ~55% piston (Avgas)
  const jetAGal   = Math.round(arrivals * 0.45 * 105)     // 105 gal avg turbine top-off
  const avgasGal  = Math.round(arrivals * 0.55 * 42)      // 42 gal avg piston top-off
  const fboHrsNeeded = Math.round(serviceEvents * 0.45)   // 27 min per service event

  return {
    flightOps:   { ownFlights, crewHrs, picsNeeded },
    operations:  { dispatcherHrs, safetyHrs, safetyActivated },
    maintenance: { total: maintTotal, scheduled: maintScheduled, squawks: maintSquawks, weather: maintWeather },
    fbo:         { arrivals, serviceEvents, jetAGal, avgasGal, hrsNeeded: fboHrsNeeded },
  }
}
