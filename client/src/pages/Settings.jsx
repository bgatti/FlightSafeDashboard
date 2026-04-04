import { useState, useCallback, useEffect } from 'react'
import { getGliderSettings, updateGliderSettings, resetGliderSettings, subscribeGliderSettings, GLIDER_SETTINGS_DEFAULTS } from '../store/gliderSettings'

// ─── Service registry ─────────────────────────────────────────────────────────

const SERVICES = [
  {
    id:      'weather',
    name:    'FlightSafeWeather',
    port:    3000,
    url:     '/weather-api/api/flight-weather',
    method:  'POST',
    body:    JSON.stringify({ dept: 'KBDU', arr: 'KDEN' }),
    okCodes: [200, 400, 422],
    desc:    'Route corridor weather — METARs, TAFs, AIRMETs, SIGMETs, winds aloft, elevation profile',
    used:    'Flight Planning',
  },
  {
    id:      'airsafe',
    name:    'AirSafe',
    port:    5000,
    url:     '/airsafe-api/query',
    method:  'POST',
    body:    JSON.stringify({ narrative: 'health check', top_k: 1 }),
    okCodes: [200, 400, 422],
    desc:    'NTSB accident similarity search — Swiss Cheese risk scoring by aircraft type and narrative',
    used:    'Flight Planning',
  },
  {
    id:      'known-risks',
    name:    'KnownRisks',
    port:    5001,
    url:     '/known-risks/api/assess',
    method:  'POST',
    body:    JSON.stringify({ factors: [] }),
    okCodes: [200, 400, 422],
    desc:    'Exposure-adjusted risk correction — 21 factors across 7 categories',
    used:    'Flight Planning',
  },
  {
    id:      'pilot-risk',
    name:    'PilotRisk',
    port:    5002,
    url:     '/pilot-risk/api/assess-crew',
    method:  'POST',
    body:    JSON.stringify({ aircraft: [{ icaoType: 'C172', tailNumber: 'N67890' }], conditions: { isIFR: false, isNight: false, hasPassengers: true } }),
    okCodes: [200, 400, 422],
    desc:    'Pilot currency, medical, recency, and type-experience scoring per tail number',
    used:    'Flight Planning',
  },
]

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS = {
  idle:     { dot: 'bg-slate-500',  text: 'text-slate-400',  label: '—'       },
  checking: { dot: 'bg-sky-400 animate-pulse', text: 'text-sky-400', label: 'Checking…' },
  up:       { dot: 'bg-green-500',  text: 'text-green-400',  label: 'UP'      },
  down:     { dot: 'bg-red-500',    text: 'text-red-400',    label: 'DOWN'    },
  error:    { dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'ERROR'   },
}

async function probeService(svc) {
  const t0 = performance.now()
  try {
    const res = await fetch(svc.url, {
      method:  svc.method,
      headers: { 'Content-Type': 'application/json' },
      body:    svc.body,
      signal:  AbortSignal.timeout(5000),
    })
    const ms = Math.round(performance.now() - t0)
    if (svc.okCodes.includes(res.status)) {
      return { status: 'up', ms, detail: `HTTP ${res.status}` }
    }
    return { status: 'error', ms, detail: `HTTP ${res.status}` }
  } catch (err) {
    const ms = Math.round(performance.now() - t0)
    const detail = err?.name === 'TimeoutError'
      ? 'Timed out (5s)'
      : err?.message?.includes('fetch') || err?.cause?.code === 'ECONNREFUSED'
        ? 'Connection refused — service not running'
        : (err?.message ?? 'Unknown error')
    return { status: 'down', ms, detail }
  }
}

// ─── Service row ──────────────────────────────────────────────────────────────

function ServiceRow({ svc, result, onCheck }) {
  const s = STATUS[result?.status ?? 'idle']
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-100">{svc.name}</span>
              <span className="text-[10px] font-mono text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                :{svc.port}
              </span>
              {result?.status && (
                <span className={`text-xs font-bold ${s.text}`}>{s.label}</span>
              )}
              {result?.ms != null && (
                <span className="text-[10px] text-slate-600 font-mono">{result.ms}ms</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{svc.desc}</p>
          </div>
        </div>

        <button
          onClick={onCheck}
          disabled={result?.status === 'checking'}
          className="text-xs px-3 py-1.5 rounded border border-sky-500/40 text-sky-400
                     hover:bg-sky-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                     flex-shrink-0"
        >
          {result?.status === 'checking' ? 'Checking…' : '↺ Check'}
        </button>
      </div>

      {/* Detail row */}
      {result?.detail && (
        <div className={`text-xs font-mono px-3 py-1.5 rounded border ${
          result.status === 'up'
            ? 'border-green-500/20 bg-green-500/5 text-green-400'
            : result.status === 'error'
              ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400'
              : 'border-red-500/20 bg-red-500/5 text-red-400'
        }`}>
          {result.detail}
        </div>
      )}

      <div className="text-[10px] text-slate-600">
        Used by: {svc.used} · Proxy: <span className="font-mono">{svc.url.replace(/\/[^/]+$/, '')}</span> → <span className="font-mono">localhost:{svc.port}</span>
      </div>
    </div>
  )
}

// ─── Settings page ────────────────────────────────────────────────────────────

export function Settings() {
  const [results, setResults] = useState({})   // { [svc.id]: { status, ms, detail } }

  const setOne = useCallback((id, partial) => {
    setResults((prev) => ({ ...prev, [id]: { ...prev[id], ...partial } }))
  }, [])

  async function checkOne(svc) {
    setOne(svc.id, { status: 'checking', ms: null, detail: null })
    const r = await probeService(svc)
    setOne(svc.id, r)
  }

  async function checkAll() {
    SERVICES.forEach((svc) => setOne(svc.id, { status: 'checking', ms: null, detail: null }))
    await Promise.all(SERVICES.map(async (svc) => {
      const r = await probeService(svc)
      setOne(svc.id, r)
    }))
  }

  const statuses   = SERVICES.map((s) => results[s.id]?.status)
  const anyDown    = statuses.some((s) => s === 'down' || s === 'error')
  const allUp      = statuses.length > 0 && statuses.every((s) => s === 'up')
  const anyChecked = statuses.some(Boolean)

  return (
    <div className="flex flex-col gap-8" data-testid="settings">

      {/* ── System Health ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">System Health</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Backend services proxied through Vite dev server. All must be running for full Flight Planning functionality.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Summary badge */}
            {anyChecked && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                allUp
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : anyDown
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
              }`}>
                {allUp ? '● All services up' : anyDown ? '● Service(s) down' : '● Degraded'}
              </span>
            )}

            <button
              onClick={checkAll}
              disabled={statuses.some((s) => s === 'checking')}
              className="px-4 py-2 rounded border border-sky-500/50 bg-sky-500/10 text-sky-300 text-sm
                         hover:bg-sky-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Check All Services
            </button>
          </div>
        </div>

        {/* Service rows */}
        <div className="flex flex-col gap-3">
          {SERVICES.map((svc) => (
            <ServiceRow
              key={svc.id}
              svc={svc}
              result={results[svc.id] ?? null}
              onCheck={() => checkOne(svc)}
            />
          ))}
        </div>

        {/* Help text */}
        <div className="rounded-lg border border-surface-border bg-surface-card px-4 py-3 text-xs text-slate-500 flex flex-col gap-1">
          <span className="font-semibold text-slate-400">Starting services</span>
          <div className="font-mono flex flex-col gap-0.5 mt-1">
            <span><span className="text-slate-600">:3000</span>  cd C:\Users\Benja\FlightSafeWeather &amp;&amp; npm start</span>
            <span><span className="text-slate-600">:5000</span>  cd C:\Users\Benja\AirSafe &amp;&amp; python app.py</span>
            <span><span className="text-slate-600">:5001</span>  cd C:\Users\Benja\KnownRisks &amp;&amp; npm start</span>
            <span><span className="text-slate-600">:5002</span>  cd C:\Users\Benja\PilotRisk &amp;&amp; npm start</span>
          </div>
          <span className="mt-1">Or run <span className="font-mono text-slate-400">node check-services.js</span> from the project root for a quick terminal check.</span>
        </div>
      </section>

      {/* ── Glider Region ── */}
      <GliderRegionSettings />

      {/* ── Placeholder for future settings sections ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-100">Application</h2>
        <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-xs text-slate-500 italic">
          Display preferences, risk thresholds, and tow settings — coming soon.
        </div>
      </section>
    </div>
  )
}

// ─── Glider Region Settings ──────────────────────────────────────────────────

const FIELD_CLS = 'w-full px-2 py-1.5 rounded border border-surface-border bg-surface-card text-xs text-slate-200 focus:outline-none focus:border-sky-500/60'

function GliderRegionSettings() {
  const [gs, setGs] = useState(getGliderSettings)

  useEffect(() => subscribeGliderSettings(setGs), [])

  const set = (key, val) => setGs(updateGliderSettings({ [key]: val }))
  const setBound = (key, val) => {
    const n = parseFloat(val)
    if (isNaN(n)) return
    setGs(updateGliderSettings({ regionBounds: { ...gs.regionBounds, [key]: n } }))
  }
  const setCenter = (key, val) => {
    const n = parseFloat(val)
    if (isNaN(n)) return
    setGs(updateGliderSettings({ regionCenter: { ...gs.regionCenter, [key]: n } }))
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Glider Region</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Soaring area for weather queries — AIRMETs, SIGMETs, winds aloft, and ceiling data are fetched for this region.
          </p>
        </div>
        <button
          onClick={() => setGs(resetGliderSettings())}
          className="text-xs px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          Reset Defaults
        </button>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-4">
        {/* Airports row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Region Name</label>
            <input className={FIELD_CLS} value={gs.regionName} onChange={(e) => set('regionName', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Base Airport (METAR)</label>
            <input className={FIELD_CLS + ' font-mono'} value={gs.baseAirport} maxLength={4}
              onChange={(e) => set('baseAirport', e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Alternate TAF Airport</label>
            <input className={FIELD_CLS + ' font-mono'} value={gs.altTafAirport} maxLength={4}
              onChange={(e) => set('altTafAirport', e.target.value.toUpperCase())} />
          </div>
        </div>

        {/* Bounding box */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Soaring Region Bounds</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['north', 'south', 'west', 'east'].map((k) => (
              <div key={k}>
                <label className="text-[10px] text-slate-600 capitalize">{k}</label>
                <input className={FIELD_CLS + ' font-mono'} type="number" step="0.01"
                  value={gs.regionBounds[k]} onChange={(e) => setBound(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* Centre + radius */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Centre Lat</label>
            <input className={FIELD_CLS + ' font-mono'} type="number" step="0.01"
              value={gs.regionCenter.lat} onChange={(e) => setCenter('lat', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Centre Lon</label>
            <input className={FIELD_CLS + ' font-mono'} type="number" step="0.01"
              value={gs.regionCenter.lon} onChange={(e) => setCenter('lon', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Radius (nm)</label>
            <input className={FIELD_CLS + ' font-mono'} type="number" min={5} max={200}
              value={gs.regionRadiusNm} onChange={(e) => set('regionRadiusNm', parseInt(e.target.value) || 40)} />
          </div>
        </div>

        <div className="text-[10px] text-slate-600">
          Default: mountains west of Boulder (KBDU) · TAF from Rocky Mountain Metro (KBJC) ·{' '}
          {gs.regionBounds.north}°N – {gs.regionBounds.south}°S · {gs.regionBounds.west}°W – {gs.regionBounds.east}°E
        </div>
      </div>
    </section>
  )
}
