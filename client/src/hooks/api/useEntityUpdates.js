// SSE subscription for entity-change events from the server.
// Invalidates React Query caches when data is modified externally (MCP, other tabs).

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const ENTITY_TO_QUERY_KEY = {
  flights:            ['flights'],
  clients:            ['clients'],
  squawks:            ['squawks'],
  invoices:           ['invoices'],
  'service-requests': ['service-requests'],
  acks:               ['acks'],
  settings:           ['glider-settings'],
  pricing:            ['pricing'],
}

export function useEntityUpdates() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/updates')

    es.onmessage = (event) => {
      try {
        const { entity } = JSON.parse(event.data)
        const key = ENTITY_TO_QUERY_KEY[entity]
        if (key) qc.invalidateQueries({ queryKey: key })
      } catch { /* ignore malformed events */ }
    }

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    }

    return () => es.close()
  }, [qc])
}
