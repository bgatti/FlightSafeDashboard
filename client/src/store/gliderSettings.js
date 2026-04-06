/**
 * Glider region settings — API-backed with sync cache.
 * Same interface as the original localStorage store.
 */

import { apiClient } from '../lib/apiClient'

const EVENT = 'flightsafe:gliderSettings'

const DEFAULTS = {
  baseAirport:      'KBDU',
  altTafAirport:    'KBJC',
  regionName:       'Front Range Soaring',
  regionBounds:     { north: 40.25, south: 39.85, west: -105.70, east: -105.20 },
  regionCenter:     { lat: 40.02, lon: -105.45 },
  regionRadiusNm:   40,
}

let _cache = { ...DEFAULTS }

async function refresh() {
  try {
    const { data } = await apiClient.get('/settings/glider')
    _cache = data
    window.dispatchEvent(new Event(EVENT))
  } catch { /* silent — use defaults */ }
}

refresh()

export function getGliderSettings() { return _cache }

export function updateGliderSettings(partial) {
  _cache = { ..._cache, ...partial }
  window.dispatchEvent(new Event(EVENT))
  apiClient.patch('/settings/glider', partial).then(refresh).catch(() => {})
  return _cache
}

export function resetGliderSettings() {
  _cache = { ...DEFAULTS }
  window.dispatchEvent(new Event(EVENT))
  apiClient.delete('/settings/glider').then(refresh).catch(() => {})
  return _cache
}

export function subscribeGliderSettings(fn) {
  const handler = () => fn(_cache)
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', (e) => { if (e.key === 'flightsafe:gliderSettings') handler() })
  return () => {
    window.removeEventListener(EVENT, handler)
  }
}

export const GLIDER_SETTINGS_DEFAULTS = DEFAULTS
