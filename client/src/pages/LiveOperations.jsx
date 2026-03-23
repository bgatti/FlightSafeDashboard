import { ZuluClock } from '../components/shared/ZuluClock'
import { RiskBadge } from '../components/shared/RiskBadge'
import { mockFlightStrips, mockSigmets, mockAirmets } from '../mocks/liveOperations'
import { useUiStore } from '../stores/uiStore'

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single flight strip card in the tray below the map.
 */
export function FlightStrip({ flight, isSelected, onSelect }) {
  return (
    <button
      className={[
        'flex-shrink-0 w-44 text-left rounded-lg border p-3 transition-colors',
        isSelected
          ? 'border-sky-400 bg-sky-400/10'
          : 'border-surface-border bg-surface-card hover:border-slate-500',
      ].join(' ')}
      onClick={() => onSelect(flight.id)}
      aria-pressed={isSelected}
      aria-label={`Flight ${flight.callsign}, route ${flight.route}, status ${flight.status}`}
      data-testid={`flight-strip-${flight.id}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-100 font-bold text-sm font-mono">
          {flight.callsign}
        </span>
        <RiskBadge score={flight.riskScore} size="sm" />
      </div>
      <div className="text-slate-400 text-xs font-mono">{flight.route}</div>
      <div className="text-slate-500 text-xs mt-1">{flight.status}</div>
    </button>
  )
}

/**
 * Horizontal scrolling tray of flight strip cards.
 */
export function FlightStripTray({ flights }) {
  const selectedId = useUiStore((s) => s.selectedFlightId)
  const setSelectedFlight = useUiStore((s) => s.setSelectedFlight)

  return (
    <section
      aria-label="Active flight strips"
      className="mt-4 flex gap-3 overflow-x-auto pb-2"
    >
      {flights.map((f) => (
        <FlightStrip
          key={f.id}
          flight={f}
          isSelected={selectedId === f.id}
          onSelect={setSelectedFlight}
        />
      ))}
    </section>
  )
}

/**
 * Map controls toolbar — layer toggles, window selector.
 */
export function MapControls() {
  const lookaheadHours = useUiStore((s) => s.lookaheadHours)
  const setLookaheadHours = useUiStore((s) => s.setLookaheadHours)
  const activeMapLayers = useUiStore((s) => s.activeMapLayers)
  const toggleMapLayer = useUiStore((s) => s.toggleMapLayer)

  const layers = [
    { key: 'flights', label: 'Flights' },
    { key: 'sigmets', label: 'SIGMETs' },
    { key: 'airmets', label: 'AIRMETs' },
  ]

  return (
    <div className="flex items-center gap-4 flex-wrap" data-testid="map-controls">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs">Window:</span>
        <select
          className="bg-surface-card border border-surface-border text-slate-200 text-xs rounded px-2 py-1"
          value={lookaheadHours}
          onChange={(e) => setLookaheadHours(Number(e.target.value))}
          aria-label="Lookahead window in hours"
        >
          {[2, 4, 6, 8, 12].map((h) => (
            <option key={h} value={h}>{h}h</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs">Layers:</span>
        {layers.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleMapLayer(key)}
            className={[
              'text-xs px-2 py-1 rounded border transition-colors',
              activeMapLayers.includes(key)
                ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                : 'border-surface-border text-slate-400 hover:border-slate-500',
            ].join(' ')}
            aria-pressed={activeMapLayers.includes(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Weather summary badges */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs bg-red-400/20 text-red-400 border border-red-400 rounded px-2 py-0.5">
          SIGMETs: {mockSigmets.features.length}
        </span>
        <span className="text-xs bg-amber-400/20 text-amber-400 border border-amber-400 rounded px-2 py-0.5">
          AIRMETs: {mockAirmets.features.length}
        </span>
      </div>
    </div>
  )
}

/**
 * Map placeholder — Leaflet will replace this in Phase 2.
 */
export function MapPlaceholder() {
  return (
    <div
      className="relative bg-slate-800 border border-surface-border rounded-lg flex items-center justify-center"
      style={{ minHeight: '420px' }}
      aria-label="Operations map — loading"
      data-testid="map-placeholder"
    >
      <div className="text-center text-slate-500">
        <div className="text-4xl mb-3" aria-hidden="true">🗺️</div>
        <p className="text-sm font-semibold">Interactive Map</p>
        <p className="text-xs mt-1">Leaflet.js integration — Phase 2</p>
        <div className="mt-4 text-xs space-y-1 text-left inline-block">
          {mockSigmets.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-400/60 inline-block" aria-hidden="true" />
              <span className="text-red-300">{f.properties.hazard}</span>
              <span className="text-slate-500">{f.properties.validFrom}–{f.properties.validTo}</span>
            </div>
          ))}
          {mockAirmets.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-400/60 inline-block" aria-hidden="true" />
              <span className="text-amber-300">{f.properties.hazard}</span>
              <span className="text-slate-500">{f.properties.validFrom}–{f.properties.validTo}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LiveOperations() {
  const lookaheadHours = useUiStore((s) => s.lookaheadHours)
  const activeCount = mockFlightStrips.filter((f) => f.status === 'En Route').length

  return (
    <div data-testid="page-live-operations">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-slate-100 font-bold text-lg">Live Operations</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Active: {activeCount} · Planned (≤{lookaheadHours}h): {mockFlightStrips.length - activeCount}
          </p>
        </div>
        <ZuluClock showLocal />
      </div>

      <MapControls />

      <div className="mt-3">
        <MapPlaceholder />
      </div>

      <FlightStripTray flights={mockFlightStrips} />
    </div>
  )
}
