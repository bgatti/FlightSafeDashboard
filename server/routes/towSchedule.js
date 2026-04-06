import { Router } from 'express'
import { getDb, parseJsonFields } from '../db/index.js'
import { buildTowSchedule, towDeficiencyMin, promoteStandbyReservations, TOW_SETTINGS } from '../lib/gliderUtils.js'

export const towScheduleRouter = Router()

function loadFlights(db, airport) {
  let sql = 'SELECT * FROM flights WHERE 1=1'
  const params = []
  if (airport) {
    sql += ' AND (departure = ? OR airport = ?)'
    params.push(airport, airport)
  }
  const rows = db.prepare(sql).all(...params)
  return rows.map((r) => parseJsonFields(r, 'tow_info', 'risk_snapshot', 'terrain_profile', 'metadata', 'waypoints', 'passengers'))
}

// GET /api/tow-schedule/compute?airport=KBDU
towScheduleRouter.get('/compute', (req, res) => {
  const db = getDb()
  const airport = req.query.airport ?? 'KBDU'
  const flights = loadFlights(db, airport)
  const schedule = buildTowSchedule(flights, airport, TOW_SETTINGS)
  res.json(schedule.map(({ flight, ...rest }) => ({ ...rest, flightId: flight.id })))
})

// GET /api/tow-schedule/deficiency?airport=KBDU&start=...&end=...
towScheduleRouter.get('/deficiency', (req, res) => {
  const db = getDb()
  const airport      = req.query.airport ?? 'KBDU'
  const windowStartMs = parseInt(req.query.start, 10)
  const windowEndMs   = parseInt(req.query.end, 10)

  if (isNaN(windowStartMs) || isNaN(windowEndMs)) {
    return res.status(400).json({ error: 'start and end query params required (epoch ms)' })
  }

  const flights = loadFlights(db, airport)
  const result  = towDeficiencyMin(flights, airport, windowStartMs, windowEndMs, TOW_SETTINGS)
  res.json(result)
})

// POST /api/tow-schedule/promote-standby
towScheduleRouter.post('/promote-standby', (req, res) => {
  const db = getDb()
  const airport = req.body.airport ?? 'KBDU'
  const flights = loadFlights(db, airport)

  const promotedIds = promoteStandbyReservations(flights, airport, TOW_SETTINGS)

  // Persist promotions to DB
  if (promotedIds.length > 0) {
    const updateStmt = db.prepare('UPDATE flights SET tow_info = ?, updated_at = datetime(\'now\') WHERE id = ?')
    const tx = db.transaction(() => {
      for (const id of promotedIds) {
        const flight = flights.find((f) => f.id === id)
        if (flight) {
          updateStmt.run(JSON.stringify(flight.tow_info), id)
        }
      }
    })
    tx()

    const broadcast = req.app.get('broadcast')
    for (const id of promotedIds) broadcast('flights', 'update', id)
  }

  res.json({ promoted: promotedIds, count: promotedIds.length })
})
