import { Router } from 'express'
import { getDb } from '../db/index.js'

export const settingsRouter = Router()

const GLIDER_DEFAULTS = {
  baseAirport:    'KBDU',
  altTafAirport:  'KBJC',
  regionName:     'Front Range Soaring',
  regionBounds:   { north: 40.25, south: 39.85, west: -105.70, east: -105.20 },
  regionCenter:   { lat: 40.02, lon: -105.45 },
  regionRadiusNm: 40,
}

function loadGliderSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('baseAirport','altTafAirport','regionName','regionBounds','regionCenter','regionRadiusNm')").all()
  const settings = { ...GLIDER_DEFAULTS }
  for (const r of rows) {
    try { settings[r.key] = JSON.parse(r.value) } catch { settings[r.key] = r.value }
  }
  return settings
}

// GET /api/settings/glider
settingsRouter.get('/glider', (_req, res) => {
  const db = getDb()
  res.json(loadGliderSettings(db))
})

// PATCH /api/settings/glider
settingsRouter.patch('/glider', (req, res) => {
  const db = getDb()
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )

  const tx = db.transaction((partial) => {
    for (const [k, v] of Object.entries(partial)) {
      if (k in GLIDER_DEFAULTS) {
        upsert.run(k, JSON.stringify(v))
      }
    }
  })
  tx(req.body)

  req.app.get('broadcast')('settings', 'update', 'glider')
  res.json(loadGliderSettings(db))
})

// DELETE /api/settings/glider — reset to defaults
settingsRouter.delete('/glider', (req, res) => {
  const db = getDb()
  const keys = Object.keys(GLIDER_DEFAULTS)
  db.prepare(`DELETE FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).run(...keys)
  req.app.get('broadcast')('settings', 'reset', 'glider')
  res.json(GLIDER_DEFAULTS)
})
