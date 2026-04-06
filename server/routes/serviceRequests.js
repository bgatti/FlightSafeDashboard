import { Router } from 'express'
import crypto from 'crypto'
import { getDb, parseJsonFields } from '../db/index.js'

export const serviceRequestsRouter = Router()

const js = (v) => v == null ? null : typeof v === 'string' ? v : JSON.stringify(v)

function deserialize(row) {
  return parseJsonFields(row, 'metadata')
}

// GET /api/service-requests
serviceRequestsRouter.get('/', (req, res) => {
  const db = getDb()
  const { status, tailNumber } = req.query
  let sql = 'SELECT * FROM service_requests WHERE 1=1'
  const params = []
  if (status)     { sql += ' AND status = ?';      params.push(status) }
  if (tailNumber) { sql += ' AND tail_number = ?';  params.push(tailNumber) }
  sql += ' ORDER BY created_at DESC'
  res.json(db.prepare(sql).all(...params).map(deserialize))
})

// POST /api/service-requests
serviceRequestsRouter.post('/', (req, res) => {
  const db = getDb()
  const id = req.body.id ?? crypto.randomUUID()
  db.prepare(`
    INSERT INTO service_requests (id, tail_number, type, description, priority, status, requested_by, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.body.tailNumber ?? null, req.body.type ?? null, req.body.description ?? null,
    req.body.priority ?? null, req.body.status ?? 'open',
    req.body.requestedBy ?? null, js(req.body.metadata)
  )
  req.app.get('broadcast')('service-requests', 'create', id)
  res.status(201).json(deserialize(db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id)))
})

// PATCH /api/service-requests/:id
serviceRequestsRouter.patch('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Service request not found' })

  const fields = { status: req.body.status, type: req.body.type, description: req.body.description, priority: req.body.priority }
  const setClauses = []
  const params = []
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { setClauses.push(`${k} = ?`); params.push(v) }
  }
  if (req.body.metadata !== undefined) {
    setClauses.push('metadata = ?')
    params.push(js(req.body.metadata))
  }
  if (setClauses.length === 0) return res.json(deserialize(existing))

  setClauses.push("updated_at = datetime('now')")
  params.push(req.params.id)
  db.prepare(`UPDATE service_requests SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
  req.app.get('broadcast')('service-requests', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM service_requests WHERE id = ?').get(req.params.id)))
})
