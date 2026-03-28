/**
 * Flight calculation utilities — distance, duration, ETA.
 * Uses great-circle (haversine) distance and per-type cruise speeds.
 */

// ─── Airport coordinate database [lat, lon] ───────────────────────────────────
// Shared reference — keep in sync with RouteMap.jsx
export const AIRPORT_COORDS = {
  KATL: [33.64, -84.43],  KBOS: [42.36, -71.01],  KBWI: [39.18, -76.67],
  KCLT: [35.22, -80.94],  KDAL: [32.85, -96.85],  KDCA: [38.85, -77.04],
  KDEN: [39.86, -104.67], KDFW: [32.90, -97.04],  KDTW: [42.21, -83.35],
  KEWR: [40.69, -74.17],  KFAT: [36.78, -119.72], KIAH: [29.98, -95.34],
  KJFK: [40.64, -73.78],  KLAS: [36.08, -115.15], KLAX: [33.94, -118.41],
  KMDW: [41.79, -87.75],  KMIA: [25.80, -80.28],  KMSP: [44.88, -93.22],
  KOAK: [37.72, -122.22], KORD: [41.98, -87.90],  KPDX: [45.59, -122.60],
  KPHX: [33.44, -112.01], KPIT: [40.49, -80.23],  KSEA: [47.45, -122.31],
  KSFO: [37.62, -122.38], KSLC: [40.79, -111.98], KSTL: [38.75, -90.37],
  KTPA: [27.98, -82.53],  KASE: [39.22, -106.87], KBFL: [35.43, -119.06],
  KSNA: [33.68, -117.87], KFLL: [26.07, -80.15],
}

/**
 * Per-type cruise speed in knots (TAS at typical cruise altitude).
 * Used to estimate flight duration when no flight plan is available.
 */
export const CRUISE_SPEEDS_KTS = {
  BE58: 200,
  C172: 122,
  C172N: 120,
  PA28: 115,
  C208: 175,
  PA44: 160,
  DA42: 185,
  SR22: 185,
  PC12: 270,
}

const RAD = Math.PI / 180
const EARTH_RADIUS_NM = 3440.065

/** Great-circle distance in nautical miles */
export function haversineNm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD
  const dLon = (lon2 - lon1) * RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a))
}

/**
 * Distance in nm between two airport ICAO codes.
 * Returns null if either airport is unknown.
 */
export function routeDistNm(depIcao, arrIcao) {
  const from = AIRPORT_COORDS[depIcao?.toUpperCase()]
  const to   = AIRPORT_COORDS[arrIcao?.toUpperCase()]
  if (!from || !to) return null
  return Math.round(haversineNm(...from, ...to))
}

/**
 * Estimate flight duration.
 *
 * @param {string}  depIcao        - departure airport ICAO
 * @param {string}  arrIcao        - arrival airport ICAO
 * @param {number}  cruiseKts      - aircraft cruise speed (knots TAS)
 * @param {number}  [taxiMinutes]  - ground/taxi/TOL overhead in minutes (default 15)
 * @returns {{ distNm, flightHours, totalHours, taxiMinutes }} or null if airports unknown
 */
export function estimateFlightDuration(depIcao, arrIcao, cruiseKts, taxiMinutes = 15) {
  if (!cruiseKts || cruiseKts <= 0) return null
  const dist = routeDistNm(depIcao, arrIcao)
  if (!dist) return null
  const flightHours = dist / cruiseKts
  const totalHours  = flightHours + taxiMinutes / 60
  return {
    distNm:      dist,
    flightHours: Math.round(flightHours * 100) / 100,
    totalHours:  Math.round(totalHours  * 100) / 100,
    taxiMinutes,
  }
}

/**
 * Estimate ETA given a departure UTC date and flight duration hours.
 * Returns a Date object.
 */
export function estimateEta(departureUtc, totalHours) {
  if (!departureUtc || !totalHours) return null
  const dep = departureUtc instanceof Date ? departureUtc : new Date(departureUtc)
  return new Date(dep.getTime() + totalHours * 3_600_000)
}

/** Format hours as "h:mm" string */
export function formatHours(h) {
  if (h == null) return '—'
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`
}
