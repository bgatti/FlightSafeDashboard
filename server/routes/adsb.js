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
