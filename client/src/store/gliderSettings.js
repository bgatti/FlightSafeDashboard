// Glider region settings — persisted to localStorage

const STORAGE_KEY = 'flightsafe:gliderSettings'

const DEFAULTS = {
  baseAirport:      'KBDU',       // Boulder Municipal
  altTafAirport:    'KBJC',       // Rocky Mountain Metro — alternate TAF source
  regionName:       'Front Range Soaring',
  // Bounding box: mountains west of Boulder → foothills
  regionBounds: {
    north: 40.25,
    south: 39.85,
    west: -105.70,
    east: -105.20,
  },
  // Centre point for AIRMET/SIGMET area query
  regionCenter: { lat: 40.02, lon: -105.45 },
  regionRadiusNm:   40,           // nautical miles from centre for met queries
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}

function save(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('flightsafe:gliderSettings'))
}

export function getGliderSettings() { return load() }

export function updateGliderSettings(partial) {
  const next = { ...load(), ...partial }
  save(next)
  return next
}

export function resetGliderSettings() {
  save({ ...DEFAULTS })
  return { ...DEFAULTS }
}

export function subscribeGliderSettings(fn) {
  const handler = () => fn(load())
  window.addEventListener('flightsafe:gliderSettings', handler)
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) handler() })
  return () => {
    window.removeEventListener('flightsafe:gliderSettings', handler)
    window.removeEventListener('storage', handler)
  }
}

export const GLIDER_SETTINGS_DEFAULTS = DEFAULTS
