// ADS-B proxy routes
// Queries our aircraft table for ICAO hex codes, then fetches from external ADS-B service.
// Our app decides which aircraft are interesting — the ADS-B server is a dumb position feed.

import { Router } from 'express'
import { getDb } from '../db/index.js'

export const adsbRouter = Router()

const ADSB_BASE = process.env.ADSB_BASE_URL || 'https://web-app-production-fedf.up.railway.app'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch JSON from the ADS-B service */
async function adsbFetch(path, params = {}) {
  const url = new URL(path, ADSB_BASE)
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v)
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ADS-B service ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Get all aircraft from our DB that have an ICAO hex code */
function getTrackedAircraft() {
  const db = getDb()
  return db.prepare(
    `SELECT id, tail_number, icao_hex, make_model, icao_type, operator,
            fbo_category, airworthy, is_tow, glider
     FROM (
       SELECT a.*,
         CASE WHEN a.make_model LIKE '%Pawnee%' OR a.make_model LIKE '%Cub%' THEN 1 ELSE 0 END as is_tow,
         CASE WHEN a.fbo_category = 'glider' THEN 1 ELSE 0 END as glider
       FROM aircraft a
     )
     WHERE icao_hex IS NOT NULL`
  ).all()
}

/** Build comma-separated ICAO list for the upstream query */
function icaoFilter(aircraft) {
  return aircraft.map((a) => a.icao_hex).join(',')
}

/** Enrich upstream aircraft data with our local metadata */
function enrichWithLocal(upstream, localMap) {
  if (!upstream) return upstream
  const local = localMap[upstream.icao?.toLowerCase()]
  if (!local) return upstream
  return {
    ...upstream,
    aircraft_id: local.id,
    tail: local.tail_number,
    make_model: local.make_model,
    icao_type: local.icao_type,
    operator: local.operator,
    is_tow: !!local.is_tow,
    is_glider: !!local.glider,
    airworthy: !!local.airworthy,
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/adsb/live — live positions for our tracked fleet
adsbRouter.get('/live', async (req, res) => {
  try {
    const tracked = getTrackedAircraft()
    if (tracked.length === 0) return res.json({ aircraft: [] })

    const localMap = Object.fromEntries(tracked.map((a) => [a.icao_hex.toLowerCase(), a]))
    const data = await adsbFetch('/api/adsb/live', { icao: icaoFilter(tracked) })

    const aircraft = (data.aircraft || []).map((ac) => enrichWithLocal(ac, localMap))
    res.json({ aircraft })
  } catch (err) {
    console.error('ADS-B live error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// GET /api/adsb/active-tow — current tow plane state with ETAs
adsbRouter.get('/active-tow', async (req, res) => {
  try {
    const tracked = getTrackedAircraft()
    const localMap = Object.fromEntries(tracked.map((a) => [a.icao_hex.toLowerCase(), a]))

    const data = await adsbFetch('/api/adsb/active-tow')
    const towPlanes = (data.tow_planes || [])
      .filter((tp) => localMap[tp.icao?.toLowerCase()])
      .map((tp) => enrichWithLocal(tp, localMap))

    res.json({ tow_planes: towPlanes })
  } catch (err) {
    console.error('ADS-B active-tow error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// GET /api/adsb/track/:icao — full track for one aircraft
adsbRouter.get('/track/:icao', async (req, res) => {
  try {
    const { icao } = req.params
    // Verify this ICAO belongs to one of our aircraft
    const tracked = getTrackedAircraft()
    const local = tracked.find((a) => a.icao_hex.toLowerCase() === icao.toLowerCase())
    if (!local) return res.status(404).json({ error: 'Aircraft not in fleet' })

    const data = await adsbFetch(`/api/adsb/track/${icao}`, { since: req.query.since })
    res.json({ ...data, aircraft_id: local.id, tail: local.tail_number })
  } catch (err) {
    console.error('ADS-B track error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// GET /api/adsb/flights — historical tow cycles for our aircraft
adsbRouter.get('/flights', async (req, res) => {
  try {
    const tracked = getTrackedAircraft()
    const localMap = Object.fromEntries(tracked.map((a) => [a.icao_hex.toLowerCase(), a]))

    // Pass through query params (tail, from, to) — but remap tail→icao if needed
    const params = { ...req.query }
    if (params.tail) {
      const match = tracked.find((a) => a.tail_number === params.tail)
      if (!match) return res.json({ flights: [] })
    }

    const data = await adsbFetch('/api/adsb/flights', params)
    const flights = (data.flights || [])
      .filter((f) => localMap[f.icao?.toLowerCase()])
      .map((f) => ({ ...f, ...enrichWithLocal(f, localMap) }))

    res.json({ flights })
  } catch (err) {
    console.error('ADS-B flights error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// GET /api/adsb/flights/:id/track — position track for a historical flight
adsbRouter.get('/flights/:id/track', async (req, res) => {
  try {
    const data = await adsbFetch(`/api/adsb/flights/${req.params.id}/track`)
    res.json(data)
  } catch (err) {
    console.error('ADS-B flight track error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// GET /api/adsb/stats — aggregated tow performance stats
adsbRouter.get('/stats', async (req, res) => {
  try {
    const data = await adsbFetch('/api/adsb/stats', req.query)
    res.json(data)
  } catch (err) {
    console.error('ADS-B stats error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// ── Airport geometry ─────────────────────────────────────────────────────────
const FIELD = { lat: 40.0394, lon: -105.2258, elev: 5288, rwyHdg: 8 }
const DEG2RAD = Math.PI / 180
const R_NM = 3440.065

function haversineNm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG2RAD
  const dLon = (lon2 - lon1) * DEG2RAD
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2
  return 2 * R_NM * Math.asin(Math.sqrt(a))
}

function bearingTo(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * DEG2RAD
  const y = Math.sin(dLon) * Math.cos(lat2 * DEG2RAD)
  const x = Math.cos(lat1 * DEG2RAD) * Math.sin(lat2 * DEG2RAD) -
    Math.sin(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function bearingFromField(lat, lon) {
  return bearingTo(FIELD.lat, FIELD.lon, lat, lon)
}

function bearingToField(lat, lon) {
  return bearingTo(lat, lon, FIELD.lat, FIELD.lon)
}

function compassLabel(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

/** Classify an aircraft relative to the airport */
function classifyAircraft(ac) {
  if (ac.lat == null || ac.lon == null) return null
  const dist = haversineNm(ac.lat, ac.lon, FIELD.lat, FIELD.lon)
  const altAgl = (ac.alt_ft ?? FIELD.elev) - FIELD.elev
  const gs = ac.gs_kts ?? 0
  const vs = ac.vs_fpm ?? 0
  const trackToField = bearingToField(ac.lat, ac.lon)
  const acTrack = ac.track_deg ?? 0
  // How close is the aircraft's track to pointing at the field?
  let trackDiff = Math.abs(acTrack - trackToField)
  if (trackDiff > 180) trackDiff = 360 - trackDiff

  const bearing = bearingFromField(ac.lat, ac.lon)
  const compassDir = compassLabel(bearing)

  // Age of data
  const dataAgeS = ac.last_seen_s ?? 0

  const base = {
    icao: ac.icao, tail: ac.tail, lat: ac.lat, lon: ac.lon,
    alt_ft: ac.alt_ft, alt_agl: Math.round(altAgl),
    gs_kts: gs, vs_fpm: vs, track_deg: acTrack,
    dist_nm: Math.round(dist * 10) / 10,
    bearing: Math.round(bearing),
    compass: compassDir,
    data_age_s: dataAgeS,
  }

  // On ground
  if (gs < 30 && altAgl < 200 && dist < 2) {
    return { ...base, phase: 'on_ground', eta_min: null }
  }
  // Taxiing
  if (gs >= 5 && gs < 40 && altAgl < 150 && dist < 1.5) {
    return { ...base, phase: 'taxiing', eta_min: null }
  }
  // In pattern (close, low, moderate speed)
  if (dist < 2.5 && altAgl < 1500 && altAgl > 100 && gs > 40 && gs < 130) {
    return { ...base, phase: 'pattern', eta_min: Math.round(dist / Math.max(gs, 40) * 60) }
  }
  // Practice area (within ~8nm, below 3000 AGL, not climbing fast, not pointed at field)
  if (dist < 8 && dist > 2 && altAgl < 3000 && altAgl > 200 && trackDiff > 40 && vs > -500) {
    return { ...base, phase: 'practice_area', eta_min: null }
  }
  // Departing (climbing, heading away from field)
  if (altAgl > 200 && vs > 200 && trackDiff > 60 && dist < 15) {
    return { ...base, phase: 'departing', eta_min: null }
  }
  // Inbound — heading toward field
  if (trackDiff < 40 && dist > 1.5 && dist < 50 && gs > 30 && vs <= 300) {
    const etaMin = gs > 0 ? Math.round(dist / gs * 60) : null
    return { ...base, phase: 'inbound', eta_min: etaMin }
  }
  // En route (far out, tracked aircraft)
  if (dist > 8) {
    const etaMin = (trackDiff < 50 && gs > 30) ? Math.round(dist / gs * 60) : null
    return { ...base, phase: 'en_route', eta_min: etaMin }
  }
  // Nearby but unclassified
  return { ...base, phase: 'nearby', eta_min: null }
}

// GET /api/adsb/airport-ops — classify all aircraft relative to KBDU
adsbRouter.get('/airport-ops', async (req, res) => {
  try {
    const tracked = getTrackedAircraft()
    const localMap = Object.fromEntries(tracked.map((a) => [a.icao_hex.toLowerCase(), a]))

    // Get ALL aircraft from ADS-B feed (not just fleet)
    const data = await adsbFetch('/api/adsb/live')
    const allAircraft = data.aircraft || []

    const based = []       // our fleet aircraft
    const inbound = []     // aircraft heading toward field
    const pattern = []     // in the pattern
    const departing = []   // departing
    const practiceArea = [] // maneuvering nearby

    for (const ac of allAircraft) {
      // Skip very stale data (> 5 min)
      if (ac.last_seen_s > 300) continue

      const classified = classifyAircraft(ac)
      if (!classified) continue

      // Enrich with local fleet data if known
      const local = localMap[ac.icao?.toLowerCase()]
      if (local) {
        classified.aircraft_id = local.id
        classified.tail = local.tail_number
        classified.make_model = local.make_model
        classified.icao_type = local.icao_type
        classified.operator = local.operator
        classified.is_based = true
        classified.is_tow = !!local.is_tow
        classified.is_glider = !!local.glider
      } else {
        classified.is_based = false
      }

      switch (classified.phase) {
        case 'on_ground':
        case 'taxiing':
          if (classified.is_based) based.push(classified)
          break
        case 'pattern':
          pattern.push(classified)
          break
        case 'inbound':
          inbound.push(classified)
          break
        case 'departing':
          if (classified.is_based) departing.push(classified)
          break
        case 'practice_area':
          practiceArea.push(classified)
          break
        case 'en_route':
          // Only list en_route if it's a based aircraft or clearly heading here
          if (classified.is_based || classified.eta_min != null) {
            inbound.push(classified)
          }
          break
      }
    }

    // Sort inbound by ETA (soonest first)
    inbound.sort((a, b) => (a.eta_min ?? 999) - (b.eta_min ?? 999))

    res.json({
      airport: 'KBDU',
      timestamp: new Date().toISOString(),
      based,
      inbound,
      pattern,
      departing,
      practice_area: practiceArea,
      counts: {
        based: based.length,
        inbound: inbound.length,
        pattern: pattern.length,
        departing: departing.length,
        practice_area: practiceArea.length,
        total_tracked: allAircraft.filter((ac) => ac.last_seen_s <= 300).length,
      },
    })
  } catch (err) {
    console.error('ADS-B airport-ops error:', err.message)
    res.status(502).json({ error: 'ADS-B service unavailable', detail: err.message })
  }
})

// GET /api/adsb/fleet — return our tracked aircraft list (what we send to ADS-B)
adsbRouter.get('/fleet', (_req, res) => {
  const tracked = getTrackedAircraft()
  res.json({
    aircraft: tracked.map((a) => ({
      id: a.id,
      tail: a.tail_number,
      icao: a.icao_hex,
      type: a.icao_type,
      make_model: a.make_model,
      operator: a.operator,
      is_tow: !!a.is_tow,
      is_glider: !!a.glider,
    })),
  })
})
