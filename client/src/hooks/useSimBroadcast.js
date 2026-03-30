// Returns live sim state pushed from the server, or null when no sim is active.
//
// Uses Server-Sent Events (EventSource) — the server pushes every time the
// sim tab posts new state, so this hook updates in real-time with zero polling
// lag and no tab-coupling fragility.
//
// The connection is opened once on mount and automatically reconnects if the
// server restarts. On initial connect the server immediately sends the current
// state, so a tab opened mid-sim is fully up to date within one round-trip.

import { useState, useEffect } from 'react'

export function useSimBroadcast() {
  const [simState, setSimState] = useState(null)

  useEffect(() => {
    const source = new EventSource('/api/sim/stream')

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setSimState(data?.running ? data : null)
      } catch (_) {}
    }

    source.onerror = () => {
      // Server unreachable or restarting — clear sim data, EventSource will
      // auto-reconnect and re-send current state when the server is back.
      setSimState(null)
    }

    return () => source.close()
  }, [])

  return simState
}
