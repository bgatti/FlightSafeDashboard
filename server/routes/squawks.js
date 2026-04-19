import { Router } from 'express'
import crypto from 'crypto'
import { getDb } from '../db/index.js'

export const squawksRouter = Router()

function deserialize(row) {
  if (!row) return row
  return {
    ...row,
    tailNumber:      row.tail_number,
    reportedBy:      row.reported_by,
    reportedDate:    row.reported_date,
    melReference:    row.mel_reference,
    melExpiryDate:   row.mel_expiry_date,
    airframeHours:   row.airframe_hours,
    resolvedDate:    row.resolved_date,
    resolvedBy:      row.resolved_by,
    resolutionNotes: row.resolution_notes,
    workOrderId:     row.work_order_id,
  }
}

// GET /api/squawks
squawksRouter.get('/', (req, res) => {
  const db = getDb()
  const { status, tailNumber, severity } = req.query
  let sql = 'SELECT * FROM squawks WHERE 1=1'
  const params = []
  if (status)     { sql += ' AND status = ?';      params.push(status) }
  if (tailNumber) { sql += ' AND tail_number = ?';  params.push(tailNumber) }
  if (severity)   { sql += ' AND severity = ?';     params.push(severity) }
  sql += ' ORDER BY reported_date DESC'
  res.json(db.prepare(sql).all(...params).map(deserialize))
})

// POST /api/squawks
squawksRouter.post('/', (req, res) => {
  const db = getDb()
  const id = req.body.id ?? crypto.randomUUID()
  db.prepare(`
    INSERT INTO squawks (
      id, tail_number, reported_by, reported_date, description,
      severity, status, mel_reference, mel_expiry_date, airframe_hours,
      resolved_date, resolved_by, resolution_notes, work_order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.body.tailNumber, req.body.reportedBy, req.body.reportedDate, req.body.description,
    req.body.severity, req.body.status ?? 'open',
    req.body.melReference ?? null, req.body.melExpiryDate ?? null, req.body.airframeHours ?? null,
    req.body.resolvedDate ?? null, req.body.resolvedBy ?? null, req.body.resolutionNotes ?? null,
    req.body.workOrderId ?? null
  )
  req.app.get('broadcast')('squawks', 'create', id)
  res.status(201).json(deserialize(db.prepare('SELECT * FROM squawks WHERE id = ?').get(id)))
})

// PATCH /api/squawks/:id/resolve
squawksRouter.patch('/:id/resolve', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM squawks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Squawk not found' })

  db.prepare(`
    UPDATE squawks SET
      status = 'closed',
      resolved_date = ?,
      resolved_by = ?,
      resolution_notes = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    req.body.resolvedBy ?? null,
    req.body.resolutionNotes ?? null,
    req.params.id
  )
  req.app.get('broadcast')('squawks', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM squawks WHERE id = ?').get(req.params.id)))
})

// GET /api/squawks/grounded/:tailNumber
squawksRouter.get('/grounded/:tailNumber', (req, res) => {
  const db = getDb()
  const tail = req.params.tailNumber

  // Check aircraft airworthy flag
  const ac = db.prepare('SELECT airworthy FROM aircraft WHERE tail_number = ?').get(tail)
  if (ac && !ac.airworthy) return res.json({ grounded: true, reason: 'aircraft_unairworthy' })

  // Check for unresolved grounding squawks
  const sqk = db.prepare(
    "SELECT COUNT(*) as n FROM squawks WHERE tail_number = ? AND severity = 'grounding' AND status != 'closed'"
  ).get(tail)

  res.json({ grounded: sqk.n > 0, reason: sqk.n > 0 ? 'grounding_squawk' : null })
})
