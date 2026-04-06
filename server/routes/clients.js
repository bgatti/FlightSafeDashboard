import { Router } from 'express'
import crypto from 'crypto'
import { getDb } from '../db/index.js'

export const clientsRouter = Router()

function deserialize(row) {
  if (!row) return row
  return {
    ...row,
    tailNumber:  row.tail_number,
    ownerName:   row.owner_name,
    makeModel:   row.make_model,
    icaoType:    row.icao_type,
    fboCategory: row.fbo_category,
    fuelType:    row.fuel_type,
    basedHere:   !!row.based_here,
    lastSeen:    row.last_seen,
    createdAt:   row.created_at,
  }
}

// GET /api/clients
clientsRouter.get('/', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM client_aircraft ORDER BY last_seen DESC, created_at DESC').all()
  res.json(rows.map(deserialize))
})

// GET /api/clients/tail/:tailNumber
clientsRouter.get('/tail/:tailNumber', (req, res) => {
  const db = getDb()
  const tail = req.params.tailNumber.trim().toUpperCase()
  const row = db.prepare('SELECT * FROM client_aircraft WHERE tail_number = ?').get(tail)
  if (!row) return res.status(404).json({ error: 'Client aircraft not found' })
  res.json(deserialize(row))
})

// POST /api/clients — upsert by tail number
clientsRouter.post('/', (req, res) => {
  const db = getDb()
  const tail = req.body.tailNumber?.trim().toUpperCase()
  if (!tail) return res.status(400).json({ error: 'tailNumber is required' })

  const existing = db.prepare('SELECT * FROM client_aircraft WHERE tail_number = ?').get(tail)

  if (existing) {
    // Merge — keep existing values where new ones are undefined
    db.prepare(`
      UPDATE client_aircraft SET
        owner_name   = COALESCE(?, owner_name),
        phone        = COALESCE(?, phone),
        email        = COALESCE(?, email),
        make_model   = COALESCE(?, make_model),
        icao_type    = COALESCE(?, icao_type),
        fbo_category = COALESCE(?, fbo_category),
        fuel_type    = CASE WHEN ? IS NOT NULL THEN ? ELSE fuel_type END,
        based_here   = CASE WHEN ? IS NOT NULL THEN ? ELSE based_here END,
        notes        = COALESCE(?, notes),
        last_seen    = datetime('now')
      WHERE tail_number = ?
    `).run(
      req.body.ownerName ?? null,
      req.body.phone ?? null,
      req.body.email ?? null,
      req.body.makeModel ?? null,
      req.body.icaoType ?? null,
      req.body.fboCategory ?? null,
      req.body.fuelType !== undefined ? req.body.fuelType : null, req.body.fuelType !== undefined ? req.body.fuelType : null,
      req.body.basedHere !== undefined ? 1 : null, req.body.basedHere !== undefined ? (req.body.basedHere ? 1 : 0) : null,
      req.body.notes ?? null,
      tail
    )
    req.app.get('broadcast')('clients', 'update', existing.id)
    res.json(deserialize(db.prepare('SELECT * FROM client_aircraft WHERE tail_number = ?').get(tail)))
  } else {
    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO client_aircraft (
        id, tail_number, owner_name, phone, email, make_model,
        icao_type, fbo_category, fuel_type, based_here, notes, last_seen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id, tail,
      req.body.ownerName ?? null, req.body.phone ?? null, req.body.email ?? null,
      req.body.makeModel ?? null, req.body.icaoType ?? null,
      req.body.fboCategory ?? 'glider', req.body.fuelType ?? null,
      req.body.basedHere ? 1 : 0, req.body.notes ?? null
    )
    req.app.get('broadcast')('clients', 'create', id)
    res.status(201).json(deserialize(db.prepare('SELECT * FROM client_aircraft WHERE id = ?').get(id)))
  }
})

// PATCH /api/clients/:id
clientsRouter.patch('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM client_aircraft WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Client not found' })

  const fields = ['owner_name', 'phone', 'email', 'make_model', 'icao_type', 'fbo_category', 'fuel_type', 'based_here', 'notes']
  const map = {
    owner_name: req.body.ownerName, phone: req.body.phone, email: req.body.email,
    make_model: req.body.makeModel, icao_type: req.body.icaoType, fbo_category: req.body.fboCategory,
    fuel_type: req.body.fuelType, based_here: req.body.basedHere != null ? (req.body.basedHere ? 1 : 0) : undefined,
    notes: req.body.notes,
  }

  const setClauses = []
  const params = []
  for (const f of fields) {
    if (map[f] !== undefined) { setClauses.push(`${f} = ?`); params.push(map[f]) }
  }
  if (setClauses.length === 0) return res.json(deserialize(existing))

  params.push(req.params.id)
  db.prepare(`UPDATE client_aircraft SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
  req.app.get('broadcast')('clients', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM client_aircraft WHERE id = ?').get(req.params.id)))
})
