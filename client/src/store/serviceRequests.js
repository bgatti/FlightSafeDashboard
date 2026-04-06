/**
 * Service request store — API-backed with sync cache.
 * Same interface as the original localStorage store.
 */

import { apiClient } from '../lib/apiClient'

const EVENT = 'flightsafe:service_requests'

let _cache = null
let _loading = false

async function refresh() {
  if (_loading) return
  _loading = true
  try {
    const { data } = await apiClient.get('/service-requests')
    _cache = data
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch (e) {
    console.warn('serviceRequests.refresh failed:', e.message)
  } finally {
    _loading = false
  }
}

refresh()
setInterval(refresh, 15_000)

export function getServiceRequests() {
  if (!_cache) refresh()
  return _cache ?? []
}

export function addServiceRequest(req) {
  if (_cache) _cache.unshift(req)
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.post('/service-requests', req).then(refresh).catch((e) => console.warn('addServiceRequest failed:', e.message))
}

export function updateServiceRequest(id, updates) {
  if (_cache) {
    const idx = _cache.findIndex((r) => r.id === id)
    if (idx >= 0) _cache[idx] = { ..._cache[idx], ...updates }
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.patch(`/service-requests/${id}`, updates).then(refresh).catch((e) => console.warn('updateServiceRequest failed:', e.message))
}

export function subscribeServiceRequests(fn) {
  const handler = () => fn(getServiceRequests())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
