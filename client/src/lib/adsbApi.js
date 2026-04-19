// ADS-B client API — fetches from our server proxy (which handles fleet filtering)
import { apiClient } from './apiClient.js'

/** Live positions for all fleet aircraft with ICAO hex codes */
export async function fetchLivePositions() {
  const { data } = await apiClient.get('/adsb/live')
  return data.aircraft || []
}

/** Current tow plane state: phase, altitude, ETAs */
export async function fetchActiveTow() {
  const { data } = await apiClient.get('/adsb/active-tow')
  return data.tow_planes || []
}

/** Full track + phases for one aircraft */
export async function fetchTrack(icao, since) {
  const params = since ? { since } : {}
  const { data } = await apiClient.get(`/adsb/track/${icao}`, { params })
  return data
}

/** Historical tow cycle records */
export async function fetchFlights({ tail, from, to } = {}) {
  const { data } = await apiClient.get('/adsb/flights', { params: { tail, from, to } })
  return data.flights || []
}

/** Aggregated tow performance statistics */
export async function fetchStats(groupBy) {
  const params = groupBy ? { group_by: groupBy } : {}
  const { data } = await apiClient.get('/adsb/stats', { params })
  return data.groups || []
}

/** Our fleet aircraft that have ICAO hex codes (for display/config) */
export async function fetchFleet() {
  const { data } = await apiClient.get('/adsb/fleet')
  return data.aircraft || []
}

// ── Glider return estimation ─────────────────────────────────────────────────

const FIELD_ELEV_FT = 5288  // KBDU
const FIELD_LAT = 40.0394
const FIELD_LON = -105.2258

/** Haversine distance in nautical miles */
function distNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065 // Earth radius in NM
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Estimate minutes until a glider returns to the field.
 * Uses altitude (sink rate) and distance (glide ratio) as independent estimates,
 * returns the longer of the two (conservative).
 * @param {object} ac — live ADS-B position { lat, lon, alt_ft, gs_kts, vs_fpm }
 * @returns {{ estMinutes: number, altAgl: number, distNm: number, method: string } | null}
 */
export function estimateGliderReturn(ac) {
  if (!ac || ac.alt_ft == null || ac.lat == null) return null
  const altAgl = ac.alt_ft - FIELD_ELEV_FT
  if (altAgl < 200) return null // already in pattern

  const dist = distNm(ac.lat, ac.lon, FIELD_LAT, FIELD_LON)

  // Time by altitude: assume 200 fpm avg sink (thermaling + cruise)
  const sinkRate = ac.vs_fpm != null && ac.vs_fpm < -50 ? Math.abs(ac.vs_fpm) : 200
  const minByAlt = altAgl / sinkRate

  // Time by distance: use ground speed if available, else assume 45 kts
  const speed = ac.gs_kts > 10 ? ac.gs_kts : 45
  const minByDist = (dist / speed) * 60

  const estMinutes = Math.max(minByAlt, minByDist)
  const method = minByDist > minByAlt ? 'distance' : 'altitude'

  return { estMinutes: Math.round(estMinutes), altAgl: Math.round(altAgl), distNm: Math.round(dist * 10) / 10, method }
}

// ── Polling hook helper ──────────────────────────────────────────────────────

const POLL_INTERVAL = 5_000 // 5 seconds — matches ADS-B update cadence

/**
 * Start polling active tow state. Returns a cleanup function.
 * @param {(towPlanes: object[]) => void} onUpdate
 * @param {number} [interval]
 */
export function pollActiveTow(onUpdate, interval = POLL_INTERVAL) {
  let active = true

  async function tick() {
    if (!active) return
    try {
      const towPlanes = await fetchActiveTow()
      if (active) onUpdate(towPlanes)
    } catch (err) {
      console.warn('ADS-B poll failed:', err.message)
    }
    if (active) setTimeout(tick, interval)
  }

  tick()
  return () => { active = false }
}

/**
 * Poll both tow planes and all fleet live positions. Returns cleanup function.
 * @param {(state: { towPlanes: object[], livePositions: object[] }) => void} onUpdate
 * @param {number} [interval]
 */
export function pollAdsbState(onUpdate, interval = POLL_INTERVAL) {
  let active = true

  async function tick() {
    if (!active) return
    try {
      const [towPlanes, livePositions] = await Promise.all([
        fetchActiveTow(),
        fetchLivePositions(),
      ])
      if (active) onUpdate({ towPlanes, livePositions, error: null })
    } catch (err) {
      console.warn('ADS-B poll failed:', err.message)
      if (active) onUpdate({ towPlanes: [], livePositions: [], error: err.message })
    }
    if (active) setTimeout(tick, interval)
  }

  tick()
  return () => { active = false }
}
