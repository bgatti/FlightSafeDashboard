// SSE entity-change fan-out — broadcasts data mutations to all connected clients.
// Used by React Query hooks to invalidate caches when data changes externally (MCP, other tabs).

import { Router } from 'express'

export const updatesRouter = Router()

const clients = new Set()

/** Broadcast an entity change to all SSE subscribers. */
export function broadcast(entity, action, id) {
  const line = `data: ${JSON.stringify({ entity, action, id, ts: Date.now() })}\n\n`
  for (const res of clients) {
    try { res.write(line) } catch { clients.delete(res) }
  }
}

updatesRouter.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  clients.add(res)
  req.on('close', () => clients.delete(res))

  // Send a heartbeat so the client knows the connection is alive
  res.write(`data: ${JSON.stringify({ entity: 'system', action: 'connected' })}\n\n`)
})
