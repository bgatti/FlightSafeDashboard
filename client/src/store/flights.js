/**
 * Shared flight store — backed by localStorage so scheduled flights
 * survive page navigation and are visible in Flights page.
 */

import { mockFlights } from '../mocks/flights'

const STORAGE_KEY = 'flightsafe_scheduled'
const EVENT = 'flightsafe:scheduled'

function getScheduled() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

/** Returns all flights: user-scheduled (newest first) + mock seed. */
export function getAllFlights() {
  return [...getScheduled(), ...mockFlights]
}

/** Add a new scheduled flight (with optional riskSnapshot). */
export function addFlight(flight) {
  const existing = getScheduled()
  existing.unshift(flight)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: flight }))
}

/** Update a field on an existing user-scheduled flight. */
export function updateFlight(id, updates) {
  const flights = getScheduled()
  const idx = flights.findIndex((f) => f.id === id)
  if (idx === -1) return
  flights[idx] = { ...flights[idx], ...updates }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flights))
  window.dispatchEvent(new CustomEvent(EVENT))
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

// ─── Risk item extraction ─────────────────────────────────────────────────────

/**
 * Extract flat list of checkable risk items from planning data.
 * Called at scheduling time and after recalculation.
 */
export function extractRiskItems(knownRiskAssessment, weatherSummary, picAssessment) {
  const items = []

  // ── Operational / terrain factors from KnownRisks ──
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

  // ── Weather ──
  const sig = weatherSummary?.sigmetCount ?? 0
  const air = weatherSummary?.airmetCount ?? 0
  const cat = weatherSummary?.flightCategory
  if (sig > 0) {
    items.push({ id: 'wx_sigmet_active', label: `${sig} SIGMET${sig > 1 ? 's' : ''} active on route`, category: 'weather', severity: 'critical', source: 'weather' })
  }
  if (air > 0) {
    items.push({ id: 'wx_airmet_active', label: `${air} AIRMET${air > 1 ? 's' : ''} active on route`, category: 'weather', severity: 'high', source: 'weather' })
  }
  if (cat === 'LIFR') {
    items.push({ id: 'wx_lifr', label: 'LIFR conditions at departure', category: 'weather', severity: 'critical', source: 'weather' })
  } else if (cat === 'IFR') {
    items.push({ id: 'wx_ifr', label: 'IFR conditions at departure', category: 'weather', severity: 'high', source: 'weather' })
  }

  // ── Pilot (PIC) risk factors ──
  for (const f of picAssessment?.disqualifiers ?? []) {
    items.push({ id: `pilot_${f.id}`, label: `PIC: ${f.label}`, category: 'pilot', severity: 'critical', source: 'pilot' })
  }
  for (const f of picAssessment?.factors ?? []) {
    items.push({
      id: `pilot_${f.id}`,
      label: `PIC: ${f.label}`,
      category: 'pilot',
      severity: f.severity === 'warning' ? 'high' : 'moderate',
      source: 'pilot',
    })
  }

  return items
}
