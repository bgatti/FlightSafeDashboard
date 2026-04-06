import { Router } from 'express'
import crypto from 'crypto'
import { getDb, parseJsonFields } from '../db/index.js'

export const invoicesRouter = Router()

const js = (v) => v == null ? null : typeof v === 'string' ? v : JSON.stringify(v)

function deserialize(row) {
  return parseJsonFields(row, 'line_items')
}

// GET /api/invoices
invoicesRouter.get('/', (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT * FROM invoices ORDER BY date DESC, created_at DESC').all().map(deserialize))
})

// GET /api/invoices/find?date=...&clientId=...
invoicesRouter.get('/find', (req, res) => {
  const db = getDb()
  const { date, clientId } = req.query
  const row = db.prepare(
    "SELECT * FROM invoices WHERE date = ? AND client_id = ? AND status != 'paid' LIMIT 1"
  ).get(date, clientId)
  if (row) return res.json(deserialize(row))

  // Return a template for a new invoice (not persisted yet)
  res.json({
    id:        crypto.randomUUID(),
    date,
    clientId,
    status:    'open',
    lineItems: [],
    total:     0,
    _new:      true,
  })
})

// POST /api/invoices
invoicesRouter.post('/', (req, res) => {
  const db = getDb()
  const id = req.body.id ?? crypto.randomUUID()
  db.prepare(`
    INSERT INTO invoices (id, date, tail_number, client_name, client_id, status, line_items, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.body.date, req.body.tailNumber ?? null, req.body.clientName ?? req.body.client ?? null,
    req.body.clientId ?? null, req.body.status ?? 'open',
    js(req.body.lineItems ?? []), req.body.total ?? 0
  )
  req.app.get('broadcast')('invoices', 'create', id)
  res.status(201).json(deserialize(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)))
})

// PATCH /api/invoices/:id
invoicesRouter.patch('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })

  const setClauses = []
  const params = []
  if (req.body.status)    { setClauses.push('status = ?');     params.push(req.body.status) }
  if (req.body.lineItems) { setClauses.push('line_items = ?'); params.push(js(req.body.lineItems)) }
  if (req.body.total != null) { setClauses.push('total = ?');  params.push(req.body.total) }
  if (setClauses.length === 0) return res.json(deserialize(existing))

  params.push(req.params.id)
  db.prepare(`UPDATE invoices SET ${setClauses.join(', ')} WHERE id = ?`).run(...params)
  req.app.get('broadcast')('invoices', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)))
})

// POST /api/invoices/:id/line-items
invoicesRouter.post('/:id/line-items', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })

  const inv = deserialize(existing)
  const items = inv.line_items ?? []
  const item = req.body

  // Deduplicate by flightId + type
  const exists = items.some((li) => li.flightId === item.flightId && li.type === item.type)
  if (!exists) {
    items.push(item)
    const total = items.reduce((s, li) => s + (li.amount ?? 0), 0)
    db.prepare('UPDATE invoices SET line_items = ?, total = ? WHERE id = ?').run(
      JSON.stringify(items), total, req.params.id
    )
  }
  req.app.get('broadcast')('invoices', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)))
})

// PATCH /api/invoices/:id/pay
invoicesRouter.patch('/:id/pay', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Invoice not found' })

  db.prepare("UPDATE invoices SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(req.params.id)
  req.app.get('broadcast')('invoices', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id)))
})
