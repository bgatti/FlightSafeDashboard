import { Router } from 'express'
import { getDb } from '../db/index.js'

export const acksRouter = Router()

// GET /api/acks/flight/:flightId — all acks for a flight
acksRouter.get('/flight/:flightId', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM acks WHERE flight_id = ?').all(req.params.flightId)

  // Return in the nested format the client expects: { [riskItemId]: { crew: {...}, supervisor: {...} } }
  const nested = {}
  for (const r of rows) {
    if (!nested[r.risk_item_id]) nested[r.risk_item_id] = {}
    nested[r.risk_item_id][r.role] = {
      by:   r.signed_by,
      name: r.signer_name,
      at:   r.signed_at,
    }
  }
  res.json(nested)
})

// POST /api/acks — set an ack
acksRouter.post('/', (req, res) => {
  const db = getDb()
  const { flightId, riskItemId, role, pilotId, pilotName } = req.body
  if (!flightId || !riskItemId || !role) {
    return res.status(400).json({ error: 'flightId, riskItemId, and role are required' })
  }

  db.prepare(`
    INSERT OR REPLACE INTO acks (flight_id, risk_item_id, role, signed_by, signer_name, signed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(flightId, riskItemId, role, pilotId, pilotName)

  req.app.get('broadcast')('acks', 'upsert', flightId)
  res.json({ ok: true })
})

// DELETE /api/acks/:flightId/:riskItemId/:role — remove an ack
acksRouter.delete('/:flightId/:riskItemId/:role', (req, res) => {
  const db = getDb()
  const { flightId, riskItemId, role } = req.params
  db.prepare('DELETE FROM acks WHERE flight_id = ? AND risk_item_id = ? AND role = ?')
    .run(flightId, riskItemId, role)
  req.app.get('broadcast')('acks', 'delete', flightId)
  res.json({ ok: true })
})

// GET /api/acks/flight/:flightId/count — count acks for a flight
acksRouter.get('/flight/:flightId/count', (req, res) => {
  const db = getDb()
  const { flightId } = req.params
  const totalItems = parseInt(req.query.totalItems ?? '0', 10)

  const crew = db.prepare(
    "SELECT COUNT(*) as n FROM acks WHERE flight_id = ? AND role = 'crew'"
  ).get(flightId).n
  const supervisor = db.prepare(
    "SELECT COUNT(*) as n FROM acks WHERE flight_id = ? AND role = 'supervisor'"
  ).get(flightId).n

  res.json({
    crew,
    supervisor,
    total: totalItems,
    crewComplete: crew >= totalItems,
    supervisorComplete: supervisor >= totalItems,
  })
})
