/**
 * Acknowledgment store — tracks risk-item sign-offs by role.
 *
 * Structure in localStorage (key: 'flightsafe_acks'):
 * {
 *   [flightId]: {
 *     [riskItemId]: {
 *       crew:       { by: 'prs-001', name: 'Smith, J.', at: ISO },  // PIC
 *       supervisor: { by: 'prs-003', name: 'Davis, M.', at: ISO },  // Chief pilot or SO
 *     }
 *   }
 * }
 */

const STORAGE_KEY = 'flightsafe_acks'
const EVENT = 'flightsafe:ack-changed'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** Get all acks for a specific flight. */
export function getFlightAcks(flightId) {
  return load()[flightId] ?? {}
}

/** Acknowledge a risk item. role = 'crew' | 'supervisor' */
export function setAck(flightId, riskItemId, role, pilotId, pilotName) {
  const data = load()
  if (!data[flightId]) data[flightId] = {}
  if (!data[flightId][riskItemId]) data[flightId][riskItemId] = {}
  data[flightId][riskItemId][role] = { by: pilotId, name: pilotName, at: new Date().toISOString() }
  save(data)
}

/** Remove an acknowledgment. */
export function removeAck(flightId, riskItemId, role) {
  const data = load()
  if (data[flightId]?.[riskItemId]?.[role]) {
    delete data[flightId][riskItemId][role]
    save(data)
  }
}

/** Subscribe to ack changes. Returns unsubscribe fn. */
export function subscribeAcks(fn) {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

/** Count acks for a flight: { crew, supervisor, total } */
export function countAcks(flightId, totalItems) {
  const acksForFlight = load()[flightId] ?? {}
  let crew = 0, supervisor = 0
  for (const itemAcks of Object.values(acksForFlight)) {
    if (itemAcks.crew)       crew++
    if (itemAcks.supervisor) supervisor++
  }
  return { crew, supervisor, total: totalItems, crewComplete: crew >= totalItems, supervisorComplete: supervisor >= totalItems }
}
