/**
 * Acknowledgment store — API-backed with sync cache.
 * Same interface as the original localStorage store.
 */

import { apiClient } from '../lib/apiClient'

const EVENT = 'flightsafe:ack-changed'

let _cache = {}  // { [flightId]: { [riskItemId]: { crew: {...}, supervisor: {...} } } }

async function loadFlight(flightId) {
  try {
    const { data } = await apiClient.get(`/acks/flight/${flightId}`)
    _cache[flightId] = data
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch { /* silent */ }
}

export function getFlightAcks(flightId) {
  if (!_cache[flightId]) loadFlight(flightId)
  return _cache[flightId] ?? {}
}

export function setAck(flightId, riskItemId, role, pilotId, pilotName) {
  // Optimistic
  if (!_cache[flightId]) _cache[flightId] = {}
  if (!_cache[flightId][riskItemId]) _cache[flightId][riskItemId] = {}
  _cache[flightId][riskItemId][role] = { by: pilotId, name: pilotName, at: new Date().toISOString() }
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.post('/acks', { flightId, riskItemId, role, pilotId, pilotName }).catch((e) => console.warn('setAck failed:', e.message))
}

export function removeAck(flightId, riskItemId, role) {
  if (_cache[flightId]?.[riskItemId]?.[role]) {
    delete _cache[flightId][riskItemId][role]
    window.dispatchEvent(new CustomEvent(EVENT))
  }
  apiClient.delete(`/acks/${flightId}/${riskItemId}/${role}`).catch((e) => console.warn('removeAck failed:', e.message))
}

export function subscribeAcks(fn) {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

export function countAcks(flightId, totalItems) {
  const acksForFlight = _cache[flightId] ?? {}
  let crew = 0, supervisor = 0
  for (const itemAcks of Object.values(acksForFlight)) {
    if (itemAcks.crew) crew++
    if (itemAcks.supervisor) supervisor++
  }
  return { crew, supervisor, total: totalItems, crewComplete: crew >= totalItems, supervisorComplete: supervisor >= totalItems }
}
