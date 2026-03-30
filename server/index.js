// FlightSafe API Server — port 4000
// Proxied from Vite dev server at /api

import express from 'express'
import { appendFile, readFile, writeFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, 'data')
const LOG_FILE  = join(DATA_DIR, 'sim_events.jsonl')

await mkdir(DATA_DIR, { recursive: true })

const app = express()
app.use(express.json({ limit: '2mb' }))

// ── In-memory sim state + SSE fan-out ────────────────────────────────────────
// Sim tab pushes state here every ~500ms via POST /api/sim/state.
// Subscriber tabs (FBO, etc.) connect to GET /api/sim/stream and receive every
// push instantly via Server-Sent Events — no polling, no tab-coupling.
let simStateStore = null
const sseClients  = new Set()

function fanOut(payload) {
  const line = `data: ${JSON.stringify(payload)}\n\n`
  for (const res of sseClients) {
    try { res.write(line) } catch (_) { sseClients.delete(res) }
  }
}

// ── POST /api/sim/state ───────────────────────────────────────────────────────
app.post('/api/sim/state', (req, res) => {
  simStateStore = { ...req.body, serverTs: Date.now() }
  fanOut(simStateStore)
  res.json({ ok: true })
})

// ── GET /api/sim/stream  (Server-Sent Events) ─────────────────────────────────
// Client opens this once; server pushes every time sim posts new state.
app.get('/api/sim/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.flushHeaders()

  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))

  // Send current state immediately so a late-joining tab is up to date
  if (simStateStore) res.write(`data: ${JSON.stringify(simStateStore)}\n\n`)
})

// ── GET /api/sim/state ────────────────────────────────────────────────────────
app.get('/api/sim/state', (_req, res) => {
  res.json(simStateStore?.running ? simStateStore : null)
})

// ── POST /api/sim/events ─────────────────────────────────────────────────────
// Body: array of event objects { id, time, type, message, tail, severity }
// Appends each as a newline-delimited JSON record.
app.post('/api/sim/events', async (req, res) => {
  const events = req.body
  if (!Array.isArray(events) || events.length === 0) {
    return res.json({ ok: true, saved: 0 })
  }
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await appendFile(LOG_FILE, lines)
  res.json({ ok: true, saved: events.length })
})

// ── GET /api/sim/events ──────────────────────────────────────────────────────
// Returns all persisted events as a JSON array, oldest first.
app.get('/api/sim/events', async (_req, res) => {
  try {
    const raw    = await readFile(LOG_FILE, 'utf8')
    const events = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    res.json(events)
  } catch {
    res.json([])
  }
})

// ── DELETE /api/sim/events ───────────────────────────────────────────────────
// Clears the log file (used by sim reset).
app.delete('/api/sim/events', async (_req, res) => {
  await writeFile(LOG_FILE, '')
  res.json({ ok: true })
})

app.listen(4000, () => {
  console.log('FlightSafe API server listening on http://localhost:4000')
  console.log(`Event log: ${LOG_FILE}`)
})
