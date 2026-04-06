import { Router } from 'express'
import { getDb } from '../db/index.js'

export const pricingRouter = Router()

// GET /api/pricing — all pricing grouped by category
pricingRouter.get('/', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM pricing ORDER BY category, key').all()
  const grouped = {}
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = {}
    grouped[r.category][r.key] = r.value
  }
  res.json(grouped)
})

// GET /api/pricing/:category
pricingRouter.get('/:category', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM pricing WHERE category = ? ORDER BY key').all(req.params.category)
  if (rows.length === 0) return res.status(404).json({ error: 'Category not found' })
  const pricing = {}
  for (const r of rows) pricing[r.key] = r.value
  res.json(pricing)
})

// PATCH /api/pricing/:category — update pricing values
pricingRouter.patch('/:category', (req, res) => {
  const db = getDb()
  const upsert = db.prepare(
    'INSERT INTO pricing (category, key, value) VALUES (?, ?, ?) ON CONFLICT(category, key) DO UPDATE SET value = excluded.value'
  )

  const tx = db.transaction((entries) => {
    for (const [k, v] of Object.entries(entries)) {
      if (typeof v === 'number') {
        upsert.run(req.params.category, k, v)
      }
    }
  })
  tx(req.body)

  req.app.get('broadcast')('pricing', 'update', req.params.category)
  // Return updated category
  const rows = db.prepare('SELECT * FROM pricing WHERE category = ? ORDER BY key').all(req.params.category)
  const pricing = {}
  for (const r of rows) pricing[r.key] = r.value
  res.json(pricing)
})
