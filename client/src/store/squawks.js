/**
 * Unified squawk store — API-backed with sync cache.
 * Same interface as the original localStorage store.
 */

import { apiClient } from '../lib/apiClient'
import { mockAircraft } from '../mocks/aircraft'

const EVENT = 'flightsafe:squawks'

let _cache = null
let _loading = false

async function refresh() {
  if (_loading) return
  _loading = true
  try {
    const { data } = await apiClient.get('/squawks')
    _cache = data
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch (e) {
    console.warn('squawks.refresh failed:', e.message)
  } finally {
    _loading = false
  }
}

refresh()
setInterval(refresh, 15_000)

export function getSquawks() {
  if (!_cache) refresh()
  return _cache ?? []
}

export function addSquawk(sqk) {
  if (_cache) _cache.unshift(sqk)
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.post('/squawks', sqk).then(refresh).catch((e) => console.warn('addSquawk failed:', e.message))
}

export function resolveSquawk(id, resolvedBy, resolutionNotes) {
  if (_cache) {
    const idx = _cache.findIndex((s) => s.id === id)
    if (idx >= 0) _cache[idx] = { ..._cache[idx], status: 'closed', resolvedBy, resolutionNotes }
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.patch(`/squawks/${id}/resolve`, { resolvedBy, resolutionNotes }).then(refresh).catch((e) => console.warn('resolveSquawk failed:', e.message))
}

/**
 * True if mock data says unairworthy OR an unresolved grounding squawk exists.
 * Pure function — works with both aircraftId and tailNumber.
 */
export function isAircraftGrounded(aircraftId, aircraftList, squawks) {
  const list = aircraftList ?? mockAircraft
  const ac = list.find((a) => a.id === aircraftId)
  if (ac && !ac.airworthy) return true
  return (squawks ?? getSquawks()).some((s) =>
    (s.aircraftId === aircraftId || s.tailNumber === ac?.tailNumber || s.tail_number === ac?.tailNumber) &&
    s.severity === 'grounding' &&
    s.status !== 'closed'
  )
}

export function subscribeSquawks(fn) {
  const handler = () => fn(getSquawks())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
