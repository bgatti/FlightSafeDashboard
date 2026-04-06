/**
 * Shared flight store — API-backed with sync cache.
 * Same interface as the original localStorage store, but data flows through
 * the REST API → SQLite. The cache is refreshed on each write and periodically.
 *
 * Consumers call getAllFlights(), addFlight(), updateFlight(), subscribe()
 * exactly as before — no component changes needed.
 */

import { apiClient } from '../lib/apiClient'

const EVENT = 'flightsafe:scheduled'

let _cache = null   // null = not loaded yet
let _loading = false

/** Fetch all flights from the API into the local cache. */
async function refresh() {
  if (_loading) return
  _loading = true
  try {
    const { data } = await apiClient.get('/flights')
    _cache = data
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch (e) {
    console.warn('flights.refresh failed:', e.message)
  } finally {
    _loading = false
  }
}

// Initial load + periodic refresh
refresh()
setInterval(refresh, 15_000)

/** Returns all flights (sync — from cache). */
export function getAllFlights() {
  if (!_cache) refresh()  // trigger async load if cache is empty
  return _cache ?? []
}

/** Add a new scheduled flight. */
export function addFlight(flight) {
  // Optimistic: add to cache immediately
  if (_cache) _cache.unshift(flight)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: flight }))
  // Persist to API
  apiClient.post('/flights', flight).then(refresh).catch((e) => console.warn('addFlight failed:', e.message))
}

/** Update a field on an existing flight. */
export function updateFlight(id, updates) {
  // Optimistic update
  if (_cache) {
    const idx = _cache.findIndex((f) => f.id === id)
    if (idx >= 0) _cache[idx] = { ..._cache[idx], ...updates }
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  // Persist to API
  apiClient.patch(`/flights/${id}`, updates).then(refresh).catch((e) => console.warn('updateFlight failed:', e.message))
}

/** Update just the riskSnapshot (after recalculation). */
export function updateRiskSnapshot(id, newSnapshot) {
  updateFlight(id, { riskSnapshot: newSnapshot })
}

/** Subscribe to flight changes. Returns unsubscribe fn. */
export function subscribe(fn) {
  const handler = () => fn(getAllFlights())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

// ─── Risk item extraction (pure function — no storage dependency) ─────────────

export function extractRiskItems(knownRiskAssessment, weatherSummary, picAssessment) {
  const items = []

  for (const f of knownRiskAssessment?.activeFactors ?? []) {
    const rph = f.statistics?.additionalRiskPerMhr ?? f.additionalRiskPerMhr ?? 0
    items.push({
      id:       f.id,
      label:    f.name,
      category: f.category,
      severity: rph >= 8 ? 'critical' : rph >= 4 ? 'high' : rph >= 1.5 ? 'moderate' : 'low',
      additionalRiskPerMhr: rph,
      source: 'operational',
    })
  }

  const sig = weatherSummary?.sigmetCount ?? 0
  const air = weatherSummary?.airmetCount ?? 0
  const cat = weatherSummary?.flightCategory
  if (sig > 0) items.push({ id: 'wx_sigmet_active', label: `${sig} SIGMET${sig > 1 ? 's' : ''} active on route`, category: 'weather', severity: 'critical', source: 'weather' })
  if (air > 0) items.push({ id: 'wx_airmet_active', label: `${air} AIRMET${air > 1 ? 's' : ''} active on route`, category: 'weather', severity: 'high', source: 'weather' })
  if (cat === 'LIFR') items.push({ id: 'wx_lifr', label: 'LIFR conditions at departure', category: 'weather', severity: 'critical', source: 'weather' })
  else if (cat === 'IFR') items.push({ id: 'wx_ifr', label: 'IFR conditions at departure', category: 'weather', severity: 'high', source: 'weather' })

  for (const f of picAssessment?.disqualifiers ?? []) {
    items.push({ id: `pilot_${f.id}`, label: `PIC: ${f.label}`, category: 'pilot', severity: 'critical', source: 'pilot' })
  }
  for (const f of picAssessment?.factors ?? []) {
    items.push({ id: `pilot_${f.id}`, label: `PIC: ${f.label}`, category: 'pilot', severity: f.severity === 'warning' ? 'high' : 'moderate', source: 'pilot' })
  }

  return items
}
