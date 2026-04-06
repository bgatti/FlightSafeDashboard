/**
 * Client aircraft store — API-backed with sync cache.
 * Same interface as the original localStorage store.
 */

import { apiClient } from '../lib/apiClient'

const EVENT = 'flightsafe:clients'

let _cache = null
let _loading = false

async function refresh() {
  if (_loading) return
  _loading = true
  try {
    const { data } = await apiClient.get('/clients')
    _cache = data
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch (e) {
    console.warn('clients.refresh failed:', e.message)
  } finally {
    _loading = false
  }
}

refresh()
setInterval(refresh, 15_000)

function getAll() {
  if (!_cache) refresh()
  return _cache ?? []
}

export function getClients() { return getAll() }

export function upsertClient(data) {
  const tail = data.tailNumber?.trim().toUpperCase()
  if (!tail) return
  // Optimistic update
  if (_cache) {
    const idx = _cache.findIndex((c) => (c.tailNumber ?? c.tail_number) === tail)
    if (idx >= 0) {
      _cache[idx] = { ..._cache[idx], ...data, lastSeen: new Date().toISOString() }
    } else {
      _cache.unshift({ id: `cli-${Date.now()}`, ...data, tailNumber: tail, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString() })
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.post('/clients', data).then(refresh).catch((e) => console.warn('upsertClient failed:', e.message))
}

export function findClientByTail(tailNumber) {
  const t = tailNumber?.trim().toUpperCase()
  return getAll().find((c) => (c.tailNumber ?? c.tail_number) === t) ?? null
}

export function subscribeClients(fn) {
  const handler = () => fn(getAll())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
