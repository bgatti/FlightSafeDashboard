import { useState, useEffect, useCallback, useRef } from 'react'
import { mockAircraft, EQUIPMENT_FLAGS, RISK_PROFILE_FLAGS } from '../mocks/aircraft'
import { TerrainProfile, CeilingRiskBar, computeMEA } from '../components/shared/TerrainProfile'
import { PilotPanel, AvailabilityChip } from '../components/shared/PilotPanel'
import { addFlight, extractRiskItems } from '../store/flights'
import { estimateFlightDuration, estimateEta } from '../lib/flightCalc'

// ─── Departure time picker ─────────────────────────────────────────────────────

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Return the next occurrence of a given weekday (0=Sun…6=Sat) at hh:mm UTC
function nextWeekday(targetDow, hour = 14) {
  const now = new Date()
  const todayDow = now.getUTCDay()
  let delta = targetDow - todayDow
  if (delta < 0 || (delta === 0 && now.getUTCHours() >= hour)) delta += 7
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + delta)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}

function presetToDate(preset, ampm) {
  const hour = ampm === 'AM' ? 9 : 14
  const now = new Date()
  if (preset === 'asap') return null
  if (preset === 'today') {
    const d = new Date(now)
    d.setUTCHours(hour, 0, 0, 0)
    return d
  }
  if (preset === 'tomorrow') {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(hour, 0, 0, 0)
    return d
  }
  if (typeof preset === 'number') return nextWeekday(preset, hour)
  return null
}

function formatDisplayTime(date) {
  if (!date) return 'ASAP'
  return date.toUTCString().replace(' GMT', 'Z').slice(5)   // e.g. "21 Mar 2026 14:00:00Z"
}

function DepartureTimePicker({ value, onChange }) {
  // value: { preset: 'asap'|'today'|'tomorrow'|0-6|'custom', ampm: 'AM'|'PM', date: Date|null }
  const calRef = useRef(null)
  const { preset, ampm, date } = value

  function setPreset(p) {
    const d = p === 'custom' ? date : presetToDate(p, ampm)
    onChange({ preset: p, ampm, date: d })
  }

  function setAmPm(ap) {
    if (preset === 'custom') { onChange({ ...value, ampm: ap }); return }
    const d = presetToDate(preset, ap)
    onChange({ preset, ampm: ap, date: d })
  }

  function handleCalendarChange(e) {
    if (!e.target.value) return
    const d = new Date(e.target.value)        // local time from datetime-local
    onChange({ preset: 'custom', ampm, date: d })
  }

  // formatted ISO for datetime-local input default
  const calDefault = date
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : ''

  const btnBase = 'px-2 py-1 rounded text-xs border transition-colors select-none cursor-pointer'
  const active  = 'bg-sky-500/20 border-sky-500/50 text-sky-300'
  const inactive = 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-slate-400 uppercase tracking-wide">Departure time</span>

      <div className="flex flex-wrap items-center gap-2">
        {/* Quick presets */}
        {['asap', 'today', 'tomorrow'].map((p) => (
          <button key={p} onClick={() => setPreset(p)}
            className={`${btnBase} ${preset === p ? active : inactive}`}>
            {p === 'asap' ? 'ASAP' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}

        {/* Day-of-week */}
        <div className="flex rounded border border-surface-border overflow-hidden">
          {DAY_LABELS.map((lbl, dow) => (
            <button key={dow} onClick={() => setPreset(dow)}
              className={`px-2 py-1 text-xs border-r last:border-r-0 border-surface-border transition-colors ${
                preset === dow ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {lbl}
            </button>
          ))}
        </div>

        {/* AM / PM */}
        <div className="flex rounded border border-surface-border overflow-hidden">
          {['AM', 'PM'].map((ap) => (
            <button key={ap} onClick={() => setAmPm(ap)}
              className={`px-3 py-1 text-xs border-r last:border-r-0 border-surface-border transition-colors ${
                ampm === ap ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-slate-200'
              }`}>
              {ap}
            </button>
          ))}
        </div>

        {/* Calendar icon → hidden datetime-local */}
        <button
          onClick={() => calRef.current?.showPicker?.() ?? calRef.current?.click()}
          title="Pick exact date & time"
          className={`${btnBase} ${preset === 'custom' ? active : inactive}`}
          aria-label="Open calendar"
        >
          📅
        </button>
        <input
          ref={calRef}
          type="datetime-local"
          value={calDefault}
          onChange={handleCalendarChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {/* Resolved time display */}
      <div className="text-xs text-slate-500">
        Departure:{' '}
        <span className="text-slate-300 font-mono">{formatDisplayTime(date)}</span>
        {preset !== 'asap' && ampm && preset !== 'custom' && (
          <span className="text-slate-600 ml-1">({ampm})</span>
        )}
      </div>
    </div>
  )
}

const WEATHER     = '/weather-api'
const AIRSAFE     = '/airsafe-api'
const KNOWN_RISKS = '/known-risks'
const PILOT_RISK  = '/pilot-risk'

// ─── Flight category helpers ───────────────────────────────────────────────────

function flightCategory(metar) {
  if (!metar) return null
  if (metar.flight_category) return metar.flight_category
  const ceiling = (metar.sky_condition || [])
    .filter((s) => s.sky_cover === 'BKN' || s.sky_cover === 'OVC')
    .map((s) => parseInt(s.cloud_base_ft_agl ?? 99999))
    .sort((a, b) => a - b)[0] ?? 99999
  const vis = parseFloat(metar.visibility_statute_mi ?? 99)
  if (ceiling < 500 || vis < 1) return 'LIFR'
  if (ceiling < 1000 || vis < 3) return 'IFR'
  if (ceiling < 3000 || vis < 5) return 'MVFR'
  return 'VFR'
}

const CATEGORY_COLORS = {
  VFR:  'text-green-400  bg-green-400/10  border-green-500/30',
  MVFR: 'text-blue-400   bg-blue-400/10   border-blue-500/30',
  IFR:  'text-red-400    bg-red-400/10    border-red-500/30',
  LIFR: 'text-purple-400 bg-purple-400/10 border-purple-500/30',
}

function CategoryPill({ cat }) {
  if (!cat) return null
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${CATEGORY_COLORS[cat] ?? 'text-slate-400'}`}>
      {cat}
    </span>
  )
}

// ─── Weather narrative builder (for AirSafe query) ────────────────────────────

function buildNarrative(dept, arr, aircraft, deptWeather, routeData) {
  const parts = [`Flight from ${dept} to ${arr} in ${aircraft.makeModel}.`]

  const deptMetar = deptWeather?.metar?.[0]
  if (deptMetar) {
    const cat = flightCategory(deptMetar)
    parts.push(`Departure conditions: ${cat ?? 'unknown'}.`)
    if (deptMetar.raw_text) parts.push(`METAR: ${deptMetar.raw_text.slice(0, 80)}.`)
  }

  if (routeData) {
    const sigmets = routeData.sigmets?.route?.features?.length ?? 0
    const airmets = routeData.airmets?.route?.features?.length ?? 0
    if (sigmets > 0) parts.push(`${sigmets} SIGMET(s) active along route.`)
    if (airmets > 0) parts.push(`${airmets} AIRMET(s) active along route.`)

    const arrMetar = routeData.metars?.data?.find(
      (m) => m.station_id === arr || m.station_id?.includes(arr)
    )
    if (arrMetar) {
      const cat = flightCategory(arrMetar)
      parts.push(`Arrival conditions: ${cat ?? 'unknown'}.`)
    }
  }

  return parts.join(' ')
}

// ─── AirSafe risk scoring (new Swiss Cheese model) ───────────────────────────
//
// risk_clusters[].recent_rate is now in accidents / million flight hours (acc/Mhr)
// Baseline for an average flight: ~9.74 acc/Mhr (from AirSafe RiskScorer)
//
// Estimated mission rate = Σ(cluster.recent_rate × cluster.match_count) / total_matches
// Risk ratio = estimated_rate / baseline

const AIRSAFE_BASELINE = 9.74   // acc/Mhr — average random flight

function riskFromAirSafe(results, clusters) {
  // ── Primary path: cluster-based acc/Mhr scoring (new API) ────────────────
  if (clusters?.length) {
    const totalMatches = clusters.reduce((s, c) => s + (c.match_count ?? 0), 0)
    if (totalMatches > 0) {
      const weightedRate = clusters.reduce(
        (s, c) => s + (c.recent_rate ?? 0) * (c.match_count ?? 0) / totalMatches, 0
      )
      const ratio = weightedRate / AIRSAFE_BASELINE
      const label =
        ratio < 1.0  ? 'Below baseline' :
        ratio < 1.5  ? 'Elevated'       :
        ratio < 2.5  ? 'High risk'      : 'Critical'
      const color =
        ratio < 1.0  ? 'text-green-400'  :
        ratio < 1.5  ? 'text-yellow-400' :
        ratio < 2.5  ? 'text-orange-400' : 'text-red-400'
      return { ratio, rate: weightedRate, label, color, mode: 'rate' }
    }
  }

  // ── Fallback: similarity-based (old API or no clusters) ──────────────────
  if (!results?.length) return { ratio: null, rate: null, label: 'No data', color: 'text-slate-400', mode: 'none' }
  const avgSim = results.reduce((s, r) => s + (r.score ?? 0), 0) / results.length
  const ratio  = avgSim / 0.35   // normalise: 0.35 similarity ≈ 1× baseline
  const label  =
    avgSim < 0.35 ? 'Below baseline' :
    avgSim < 0.55 ? 'Elevated'       :
    avgSim < 0.70 ? 'High risk'      : 'Critical'
  const color  =
    avgSim < 0.35 ? 'text-green-400'  :
    avgSim < 0.55 ? 'text-yellow-400' :
    avgSim < 0.70 ? 'text-orange-400' : 'text-red-400'
  return { ratio, rate: null, label, color, mode: 'similarity' }
}

// ─── Swiss Cheese cluster visualization ──────────────────────────────────────

function SwissCheesePanel({ clusters, rate, ratio }) {
  if (!clusters?.length) return null

  const TREND_ARROW = { declining: '↓', increasing: '↑', stable: '→' }
  const TREND_COLOR = { declining: 'text-green-400', increasing: 'text-red-400', stable: 'text-slate-400' }

  // Max rate for bar scaling
  const maxRate = Math.max(...clusters.map((c) => c.recent_rate ?? 0), AIRSAFE_BASELINE)

  const ratioColor =
    ratio < 1.0  ? 'text-green-400'  :
    ratio < 1.5  ? 'text-yellow-300' :
    ratio < 2.5  ? 'text-orange-400' : 'text-red-400'

  return (
    <div className="flex flex-col gap-3">
      {/* Header: total risk vs baseline */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-slate-500 uppercase tracking-wide">NTSB Swiss Cheese Risk</span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">
            Baseline <span className="text-slate-300 font-mono">{AIRSAFE_BASELINE} acc/Mhr</span>
          </span>
          {rate != null && (
            <span className="text-slate-500">
              Mission est. <span className="text-slate-300 font-mono">{rate.toFixed(1)} acc/Mhr</span>
            </span>
          )}
          {ratio != null && (
            <span className={`font-bold font-mono ${ratioColor}`}>
              {ratio.toFixed(2)}× baseline
            </span>
          )}
        </div>
      </div>

      {/* Baseline reference bar */}
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className="w-20 flex-shrink-0 text-right">Baseline</span>
        <div className="flex-1 h-1 bg-slate-700 rounded">
          <div
            className="h-full bg-slate-500 rounded"
            style={{ width: `${Math.round((AIRSAFE_BASELINE / maxRate) * 100)}%` }}
          />
        </div>
        <span className="w-16 font-mono">{AIRSAFE_BASELINE} /Mhr</span>
      </div>

      {/* Cluster rows */}
      {clusters.map((c, i) => {
        const barPct   = maxRate > 0 ? Math.round(((c.recent_rate ?? 0) / maxRate) * 100) : 0
        const trend    = c.trend_direction ?? 'stable'
        const barColor =
          (c.recent_rate ?? 0) > AIRSAFE_BASELINE * 2 ? 'bg-red-500'    :
          (c.recent_rate ?? 0) > AIRSAFE_BASELINE      ? 'bg-orange-400' :
          'bg-yellow-500'

        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-20 flex-shrink-0 text-right text-slate-400 truncate" title={c.name}>
              {c.name}
            </span>
            <div className="flex-1 h-3 bg-slate-800 rounded relative overflow-hidden" title={`${c.recent_rate?.toFixed(1)} acc/Mhr`}>
              {/* Baseline marker */}
              <div
                className="absolute top-0 bottom-0 w-px bg-slate-500 opacity-50"
                style={{ left: `${Math.round((AIRSAFE_BASELINE / maxRate) * 100)}%` }}
              />
              <div className={`h-full ${barColor} rounded transition-all`} style={{ width: `${barPct}%` }} />
            </div>
            <span className="w-16 font-mono text-slate-300 flex-shrink-0">
              {(c.recent_rate ?? 0).toFixed(1)} /Mhr
            </span>
            <span className={`w-12 flex-shrink-0 ${TREND_COLOR[trend] ?? 'text-slate-400'}`}>
              {TREND_ARROW[trend] ?? '?'} {Math.abs(c.pct_change_per_decade ?? 0).toFixed(0)}%
            </span>
            <span className="text-slate-600 flex-shrink-0">{c.match_count}✕</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function IcaoInput({ label, value, onChange, onCommit, loading, placeholder = 'KXXX' }) {
  const ref = useRef(null)
  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); onCommit(value.toUpperCase()) }
  }
  function handleBlur() {
    if (value.trim().length >= 3) onCommit(value.toUpperCase())
  }
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          type="text"
          maxLength={4}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-28 bg-surface-card border border-surface-border rounded px-3 py-2 text-sm font-mono text-slate-100
                     focus:outline-none focus:ring-1 focus:ring-sky-500 uppercase placeholder-slate-600"
        />
        {loading && (
          <span className="absolute right-2 top-2.5 text-sky-400 text-xs animate-pulse">…</span>
        )}
      </div>
    </div>
  )
}

function WeatherCard({ label, metar, taf }) {
  const cat = flightCategory(metar)
  const wind = metar
    ? `${String(metar.wind_dir_degrees ?? 'VRB').padStart(3, '0')}/${metar.wind_speed_kt ?? 0}kt${metar.wind_gust_kt ? `G${metar.wind_gust_kt}` : ''}`
    : null
  const vis = metar?.visibility_statute_mi != null ? `${metar.visibility_statute_mi}SM` : null
  const temp = metar?.temp_c != null ? `${metar.temp_c}°C` : null
  const wx   = metar?.wx_string || null
  const raw  = metar?.raw_text ?? null

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <CategoryPill cat={cat} />
      </div>

      {!metar && (
        <p className="text-xs text-slate-500 italic">No METAR available</p>
      )}

      {metar && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          {wind && <div><span className="text-slate-500">Wind </span><span className="text-slate-200">{wind}</span></div>}
          {vis  && <div><span className="text-slate-500">Vis </span><span className="text-slate-200">{vis}</span></div>}
          {temp && <div><span className="text-slate-500">Temp </span><span className="text-slate-200">{temp}</span></div>}
          {wx   && <div className="col-span-3"><span className="text-slate-500">WX </span><span className="text-yellow-300">{wx}</span></div>}
        </div>
      )}

      {raw && (
        <details className="group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 select-none">
            Raw METAR
          </summary>
          <p className="mt-1 font-mono text-xs text-slate-400 break-all leading-relaxed">{raw}</p>
        </details>
      )}

      {taf && taf[0] && (
        <details className="group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 select-none">
            TAF
          </summary>
          <p className="mt-1 font-mono text-xs text-slate-400 break-all leading-relaxed">
            {taf[0].raw_text ?? JSON.stringify(taf[0]).slice(0, 200)}
          </p>
        </details>
      )}
    </div>
  )
}

function RouteWeatherBanner({ routeData }) {
  if (!routeData) return null

  const sigmets = routeData.sigmets?.route?.features ?? []
  const airmets = routeData.airmets?.route?.features ?? []

  const sigmetTypes = [...new Set(
    sigmets.map((f) => f.properties?.hazard || f.properties?.airsigmet_type || 'SIGMET')
  )]
  const airmetTypes = [...new Set(
    airmets.map((f) => f.properties?.hazard || f.properties?.airsigmet_type || 'AIRMET')
  )]

  const hasSigmets = sigmets.length > 0
  const hasAirmets = airmets.length > 0

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Route Corridor</span>
        <span className="text-xs text-slate-500">50 nm base buffer</span>
        {routeData.request?.departureTime && (
          <span className="text-xs text-sky-400 font-mono">
            dep {new Date(routeData.request.departureTime).toUTCString().slice(5, 22)}Z
          </span>
        )}
        {routeData.corridor?.bufferNm && routeData.corridor.bufferNm !== 50 && (
          <span className="text-xs text-slate-500">
            → expanded to {routeData.corridor.bufferNm} nm
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* Route strip */}
        <div className="flex items-center gap-2 text-sm font-mono min-w-0 flex-1">
          <span className="text-sky-400 font-bold">{routeData.request?.departure}</span>
          <div className="flex-1 h-px bg-surface-border relative min-w-8">
            {hasSigmets && (
              <span className="absolute -top-2 left-1/3 text-red-400 text-xs">⚡</span>
            )}
            {hasAirmets && (
              <span className="absolute -top-2 left-2/3 text-yellow-400 text-xs">⚠</span>
            )}
          </div>
          <span className="text-sky-400 font-bold">{routeData.request?.arrival}</span>
        </div>

        {/* Hazard chips */}
        <div className="flex gap-2 flex-wrap">
          {hasSigmets ? (
            <span className="text-xs px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400">
              {sigmets.length} SIGMET{sigmets.length > 1 ? 's' : ''} — {sigmetTypes.join(', ')}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400">
              No SIGMETs
            </span>
          )}
          {hasAirmets ? (
            <span className="text-xs px-2 py-0.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
              {airmets.length} AIRMET{airmets.length > 1 ? 's' : ''} — {airmetTypes.join(', ')}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400">
              No AIRMETs
            </span>
          )}
        </div>
      </div>

      {/* Winds aloft summary */}
      {routeData.windsAloft?.data?.length > 0 && (
        <div className="flex gap-3 flex-wrap text-xs text-slate-400">
          <span className="text-slate-500 uppercase tracking-wide text-xs">Winds aloft</span>
          {routeData.windsAloft.data.slice(0, 4).map((w, i) => (
            <span key={i}>{w.altitude}: <span className="text-slate-300">{w.wind}</span></span>
          ))}
        </div>
      )}
    </div>
  )
}

const CATEGORY_COLORS_KR = {
  weather_icing:    'text-blue-300   border-blue-500/30  bg-blue-500/10',
  weather_convective:'text-orange-300 border-orange-500/30 bg-orange-500/10',
  weather_visibility:'text-purple-300 border-purple-500/30 bg-purple-500/10',
  weather_wind:     'text-yellow-300 border-yellow-500/30 bg-yellow-500/10',
  terrain:          'text-amber-300  border-amber-500/30  bg-amber-500/10',
  aircraft:         'text-red-300    border-red-500/30    bg-red-500/10',
  operations:       'text-slate-300  border-slate-500/30  bg-slate-500/10',
}

function KnownRiskPanel({ assessment, loading }) {
  if (loading) return (
    <div className="text-xs text-slate-500 animate-pulse">Assessing known risks…</div>
  )
  if (!assessment) return (
    <div className="text-xs text-slate-500 italic">Known risks unavailable — check server on :5001</div>
  )

  const { activeFactors, summary, dominantFactor } = assessment

  const gapPct = Math.round((summary.coverageGap ?? 0) * 100)
  const totalColor =
    summary.ratioToBaseline < 1.5  ? 'text-green-400'  :
    summary.ratioToBaseline < 2.5  ? 'text-yellow-400' :
    summary.ratioToBaseline < 4.0  ? 'text-orange-400' : 'text-red-400'

  return (
    <div className="flex flex-col gap-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
        <span className="text-slate-500 uppercase tracking-wide">Known-Risk Exposure Model</span>
        <div className="flex gap-3 flex-wrap">
          <span className="text-slate-500">
            NTSB data <span className="text-slate-300 font-mono">{summary.accidentData_accMhr.toFixed(1)}</span>
          </span>
          <span className="text-slate-500">+</span>
          <span className="text-orange-300 font-mono">
            {summary.knownRiskAddition_accMhr.toFixed(1)} known exposure
          </span>
          <span className="text-slate-500">=</span>
          <span className={`font-bold font-mono ${totalColor}`}>
            {summary.total_accMhr.toFixed(1)} acc/Mhr · {summary.ratioToBaseline.toFixed(2)}× baseline
          </span>
        </div>
      </div>

      {/* Coverage gap bar */}
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between text-slate-500">
          <span>Risk composition</span>
          <span className="text-orange-300">{gapPct}% of total risk not captured in NTSB accident data</span>
        </div>
        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden flex">
          <div
            className="bg-sky-500 h-full"
            style={{ width: `${100 - gapPct}%` }}
            title="NTSB accident-data risk"
          />
          <div
            className="bg-orange-400 h-full"
            style={{ width: `${gapPct}%` }}
            title="Known exposure risk (avoidance bias correction)"
          />
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-sky-500 mr-1" />NTSB accident data</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1" />Known exposure (avoided but present)</span>
        </div>
      </div>

      {/* Active risk factors */}
      {activeFactors.length === 0 ? (
        <p className="text-xs text-green-400">No additional known-risk factors active for this flight profile.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-500 uppercase tracking-wide">
            Active known-risk factors ({activeFactors.length})
          </div>
          {activeFactors
            .sort((a, b) => b.additionalRiskPerMhr - a.additionalRiskPerMhr)
            .map((f) => {
              const colors = CATEGORY_COLORS_KR[f.category] ?? 'text-slate-300 border-slate-600 bg-slate-800'
              const addPct  = summary.total_accMhr > 0
                ? Math.round((f.additionalRiskPerMhr / summary.total_accMhr) * 100)
                : 0
              return (
                <div key={f.id} className={`border rounded-lg p-3 text-xs ${colors}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold">{f.name}</span>
                      <span className="text-xs opacity-75">{f.description?.slice(0, 120)}…</span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="font-mono font-bold">+{f.additionalRiskPerMhr.toFixed(1)}</div>
                      <div className="opacity-70">acc/Mhr</div>
                      <div className="opacity-60">{addPct}% of total</div>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="flex gap-3 mt-2 pt-2 border-t border-white/10 flex-wrap opacity-80">
                    <span>Encounter {Math.round(f.statistics.encounterRatePerFlight * 100)}%/flight</span>
                    <span>Avoidance {Math.round(f.statistics.pilotAvoidanceRate * 100)}%</span>
                    <span>When not avoided: {f.statistics.accidentRateWhenExposed_accMhr} acc/Mhr</span>
                    {f.statistics.asrsIncidentsPer1000Encounters && (
                      <span>ASRS: {f.statistics.asrsIncidentsPer1000Encounters}/1k encounters</span>
                    )}
                  </div>
                  {/* Mitigations */}
                  {f.mitigations?.length > 0 && (
                    <div className="mt-2 flex flex-col gap-0.5">
                      {f.mitigations.map((m, i) => (
                        <span key={i} className="opacity-70">• {m}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

function EquipmentPanel({ equipment = {}, riskProfile = {} }) {
  const riskColors = { high: 'border-red-500/40 text-red-300', caution: 'border-yellow-500/40 text-yellow-300', neutral: 'border-slate-600 text-slate-300' }

  return (
    <div className="flex flex-col gap-3">
      {/* Safety equipment */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Safety Equipment</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EQUIPMENT_FLAGS).map(([key, def]) => {
            const has = equipment[key]
            if (has === undefined) return null
            return (
              <span
                key={key}
                title={def.note}
                className={`text-xs px-2 py-0.5 rounded border ${
                  has
                    ? def.riskReducing
                      ? 'border-green-500/40 bg-green-500/10 text-green-300'
                      : 'border-slate-600 bg-slate-800 text-slate-300'
                    : 'border-slate-700 bg-slate-900 text-slate-600 line-through'
                }`}
              >
                {def.icon} {def.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Operational risk flags */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Operational Characteristics</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(RISK_PROFILE_FLAGS).map(([key, def]) => {
            const val = riskProfile[key]
            if (!val) return null
            const colors = riskColors[def.riskLevel] ?? riskColors.neutral
            return (
              <span
                key={key}
                title={def.note}
                className={`text-xs px-2 py-0.5 rounded border bg-slate-800/60 ${colors}`}
              >
                {def.icon} {def.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      {riskProfile.notes && (
        <p className="text-xs text-slate-500 italic border-l-2 border-slate-700 pl-2">
          {riskProfile.notes}
        </p>
      )}
    </div>
  )
}

function AircraftRiskCard({
  aircraft, airSafeResult, loading, error, terrainMetrics,
  knownRiskAssessment, loadingKnown,
  pilotAssessments, loadingPilots,
  flightConditions, onSchedule, onScheduleReturn, isScheduled, scheduledEta,
}) {
  const [expanded, setExpanded] = useState(false)
  const { ratio, rate, label, color, mode } = riskFromAirSafe(
    airSafeResult?.results,
    airSafeResult?.risk_clusters,
  )
  const clusters = airSafeResult?.risk_clusters ?? []

  const inspColors = {
    current: 'text-green-400',
    due_soon: 'text-yellow-400',
    overdue: 'text-red-400',
  }

  return (
    <div className={`bg-surface-card border rounded-lg transition-colors ${
      !aircraft.airworthy
        ? 'border-red-500/40 opacity-60'
        : expanded ? 'border-sky-500/40' : 'border-surface-border'
    }`}>
      {/* Main row */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-4"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Airworthy dot */}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${aircraft.airworthy ? 'bg-green-400' : 'bg-red-500'}`}
          title={aircraft.airworthy ? 'Airworthy' : 'Not airworthy'}
        />

        {/* Tail + model */}
        <div className="flex-shrink-0 w-20">
          <div className="text-sm font-mono font-bold text-slate-100">{aircraft.tailNumber}</div>
          <div className="text-xs text-slate-500">{aircraft.icaoType}</div>
        </div>

        {/* Make/model */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-300 truncate">{aircraft.makeModel}</div>
          <div className={`text-xs ${inspColors[aircraft.inspectionStatus] ?? 'text-slate-400'}`}>
            Insp: {aircraft.inspectionStatus.replace('_', ' ')}
          </div>
        </div>

        {/* Capacity */}
        <div className="flex-shrink-0 text-center w-16">
          <div className="text-sm text-slate-300">{aircraft.passengerCapacity} seats</div>
          <div className="text-xs text-slate-500">capacity</div>
        </div>

        {/* Key capability chips */}
        <div className="hidden md:flex gap-1 flex-shrink-0">
          {aircraft.equipment?.fiki && (
            <span title="FIKI — Flight Into Known Icing" className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">❄️ FIKI</span>
          )}
          {aircraft.riskProfile?.multiEngine && (
            <span title="Multi-engine" className="text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">✈️ Multi</span>
          )}
          {aircraft.riskProfile?.jetFuelInPropAircraft && (
            <span title="Burns Jet-A — confirm availability" className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">⛽ Jet-A</span>
          )}
          {aircraft.riskProfile?.turbocharged && (
            <span title="Turbocharged" className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20">📈 TC</span>
          )}
          {!aircraft.equipment?.ifrCertified && (
            <span title="Not IFR certified" className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">VFR only</span>
          )}
          {/* OEI ceiling chip — only for twins */}
          {aircraft.riskProfile?.multiEngine && aircraft.singleEngineCeiling && (
            <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded border font-mono ${
              terrainMetrics?.mea && aircraft.singleEngineCeiling < terrainMetrics.mea
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : terrainMetrics?.mea
                  ? 'bg-green-400/10 text-green-400 border-green-500/20'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600'
            }`}>
              OEI {aircraft.singleEngineCeiling.toLocaleString()}ft
              {terrainMetrics?.mea && aircraft.singleEngineCeiling < terrainMetrics.mea ? ' ⚠' : ''}
            </span>
          )}
        </div>

        {/* MEL */}
        {aircraft.melItemsOpen?.length > 0 && (
          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-500/20">
            MEL {aircraft.melItemsOpen.length}
          </span>
        )}

        {/* Op cost */}
        <div className="flex-shrink-0 text-center w-20">
          <div className="text-sm text-slate-300">${aircraft.opCostPerHour.toLocaleString()}</div>
          <div className="text-xs text-slate-500">per hour</div>
        </div>

        {/* Combined risk score */}
        <div className="flex-shrink-0 w-40 flex flex-col gap-1">
          {loading ? (
            <span className="text-xs text-slate-500 animate-pulse">Querying AirSafe…</span>
          ) : error ? (
            <span className="text-xs text-red-400">AirSafe unavailable</span>
          ) : ratio == null ? (
            <span className="text-xs text-slate-500">—</span>
          ) : (() => {
            const kr = knownRiskAssessment?.summary
            const displayRatio = kr ? kr.ratioToBaseline : ratio
            const displayLabel =
              displayRatio < 1.0 ? 'Below baseline' :
              displayRatio < 1.5 ? 'Elevated'       :
              displayRatio < 2.5 ? 'High risk'      : 'Critical'
            const displayColor =
              displayRatio < 1.0 ? 'text-green-400'  :
              displayRatio < 1.5 ? 'text-yellow-400' :
              displayRatio < 2.5 ? 'text-orange-400' : 'text-red-400'
            return (
              <>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${displayColor}`}>{displayLabel}</span>
                  <span className={`text-xs font-mono ${displayColor}`}>{displayRatio.toFixed(2)}×</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  {kr ? (
                    // Stacked bar: NTSB (blue) + exposure (orange)
                    <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${Math.min(100, Math.round((displayRatio / 4) * 100))}%` }}>
                      <div className="h-full bg-blue-400" style={{ width: `${Math.round((kr.accidentData_accMhr / kr.total_accMhr) * 100)}%` }} />
                      <div className="h-full bg-orange-400" style={{ width: `${Math.round((kr.knownRiskAddition_accMhr / kr.total_accMhr) * 100)}%` }} />
                    </div>
                  ) : (
                    <div
                      className={`h-full rounded-full transition-all ${
                        ratio < 1.0 ? 'bg-green-400' : ratio < 1.5 ? 'bg-yellow-400' : ratio < 2.5 ? 'bg-orange-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.round((ratio / 4) * 100))}%` }}
                    />
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {kr ? (
                    <span>
                      <span className="text-blue-300">{kr.accidentData_accMhr.toFixed(1)}</span>
                      <span className="text-slate-600"> + </span>
                      <span className="text-orange-300">{kr.knownRiskAddition_accMhr.toFixed(1)}</span>
                      <span className="text-slate-600"> = </span>
                      <span className={displayColor}>{kr.total_accMhr.toFixed(1)} acc/Mhr</span>
                    </span>
                  ) : (
                    mode === 'rate' && rate != null
                      ? `${rate.toFixed(1)} acc/Mhr · ${airSafeResult?.results?.length ?? 0} matches`
                      : `${airSafeResult?.results?.length ?? 0} similar accidents`
                  )}
                </div>
              </>
            )
          })()}
        </div>

        {/* Pilot availability chip */}
        <div className="flex-shrink-0 hidden md:block" onClick={(e) => e.stopPropagation()}>
          <AvailabilityChip assessments={pilotAssessments} />
        </div>

        {/* Schedule button */}
        {isScheduled ? (
          <span className="flex-shrink-0 text-xs px-2 py-1 rounded border border-green-500/30 text-green-400 bg-green-400/10">
            ✓ Scheduled
          </span>
        ) : (
          <button
            className="flex-shrink-0 text-xs px-2 py-1 rounded border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-colors"
            onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            title="Schedule this flight"
          >
            Schedule
          </button>
        )}

        <span className="text-slate-500 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-border pt-3 flex flex-col gap-4">
          {/* Ceiling risk */}
          {terrainMetrics?.mea && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Terrain / Ceiling Analysis</div>
              <CeilingRiskBar
                mea={terrainMetrics.mea}
                serviceCeiling={aircraft.serviceCeiling}
                cloudCeilingAglFt={terrainMetrics.cloudAglFt}
                stationElevFt={terrainMetrics.deptElevFt}
              />
              {terrainMetrics.approachDA != null && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Est. destination ILS DA: {terrainMetrics.approachDA.toLocaleString()} ft MSL
                  {aircraft.serviceCeiling
                    ? ` · ${Math.round((terrainMetrics.approachDA / aircraft.serviceCeiling) * 100)}% of ceiling`
                    : ''}
                </p>
              )}
            </div>
          )}

          {/* Swiss Cheese risk breakdown */}
          {clusters.length > 0 && (
            <SwissCheesePanel clusters={clusters} rate={rate} ratio={ratio} />
          )}

          {/* Top similar accidents */}
          {airSafeResult?.results?.slice(0, 3).map((acc, i) => {
            const mf          = acc.matched_features ?? {}
            const weatherFlags = mf.weather_flags ?? acc.weather_flags ?? []
            const interactions = mf.interactions ?? []
            const structSim    = mf.structured_score ?? acc.structured_score
            const tfidfSim     = mf.tfidf_score      ?? acc.tfidf_score
            return (
              <div key={i} className="border border-surface-border rounded p-3 text-xs flex flex-col gap-2">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-slate-400">{acc.ntsb_no}</span>
                  <span className="text-slate-500">{acc.date}</span>
                  {acc.phase && <span className="text-slate-500 capitalize">{acc.phase.replace(/_/g, ' ')}</span>}
                  {acc.outcome && <span className="text-red-300 font-medium">{acc.outcome}</span>}
                  {acc.aircraft_category && (
                    <span className="text-slate-600 capitalize">{acc.aircraft_category}</span>
                  )}
                  {/* Similarity scores */}
                  <div className="ml-auto flex gap-2 text-xs">
                    {structSim != null && (
                      <span className="text-slate-500" title="Structured feature similarity">
                        struct <span className="text-slate-300">{Math.round(structSim * 100)}%</span>
                      </span>
                    )}
                    {tfidfSim != null && (
                      <span className="text-slate-500" title="Narrative text similarity">
                        text <span className="text-slate-300">{Math.round(tfidfSim * 100)}%</span>
                      </span>
                    )}
                    <span className="text-sky-400">
                      overall {Math.round((acc.score ?? 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Weather flags + interactions */}
                {(weatherFlags.length > 0 || interactions.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {weatherFlags.map((f) => (
                      <span key={f} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs">
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {interactions.map((f) => (
                      <span key={f} className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs">
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-slate-400 leading-relaxed">{acc.summary ?? acc.narrative?.slice(0, 200)}</p>
                {acc.probable_cause && (
                  <p className="text-slate-500 italic">Cause: {acc.probable_cause.slice(0, 140)}…</p>
                )}
                {acc.carol_url && (
                  <a href={acc.carol_url} target="_blank" rel="noopener noreferrer"
                    className="text-sky-500 hover:underline self-start">
                    NTSB docket →
                  </a>
                )}
              </div>
            )
          })}

          {/* Known-risk exposure assessment */}
          <KnownRiskPanel assessment={knownRiskAssessment} loading={loadingKnown} />

          {/* Pilot availability + schedule */}
          <PilotPanel
            aircraft={aircraft}
            pilotAssessments={pilotAssessments}
            loading={loadingPilots}
            flightConditions={flightConditions}
            departureTime={flightConditions?.depTime?.date ?? null}
            onSchedule={onSchedule}
            onScheduleReturn={onScheduleReturn}
            isScheduled={isScheduled}
            scheduledEta={scheduledEta}
          />

          {/* Equipment + risk profile */}
          <EquipmentPanel equipment={aircraft.equipment} riskProfile={aircraft.riskProfile} />

          {/* Aircraft squawks and MEL details */}
          {(aircraft.openSquawks?.length > 0 || aircraft.melItemsOpen?.length > 0) && (
            <div className="flex flex-col gap-1">
              {aircraft.melItemsOpen.map((m, i) => (
                <div key={i} className="text-xs text-yellow-300">MEL {m.category}: {m.item} (expires {m.expiryDate})</div>
              ))}
              {aircraft.openSquawks.map((s, i) => (
                <div key={i} className={`text-xs ${s.status === 'grounding' ? 'text-red-400' : 'text-orange-300'}`}>
                  Squawk: {s.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function FlightPlanning() {
  const [dept, setDept] = useState('')
  const [arr,  setArr]  = useState('')
  const [pax,  setPax]  = useState('')
  const [depTime, setDepTime] = useState({ preset: 'asap', ampm: 'AM', date: null })

  const [deptWeather,    setDeptWeather]    = useState(null)   // { metar[], taf[] }
  const [routeData,      setRouteData]      = useState(null)   // full flight-weather response
  const [aircraftRisks,  setAircraftRisks]  = useState({})    // { [acId]: { result, loading, error } }
  const [terrainMetrics, setTerrainMetrics] = useState(null)  // { mea, approachDA, cloudAglFt, deptElevFt }
  const [knownRisks,     setKnownRisks]     = useState(null)  // KnownRiskAssessment per aircraft
  const [loadingKnown,   setLoadingKnown]   = useState(false)
  const [pilotRisks,     setPilotRisks]     = useState(null)  // { [tailNumber]: PilotAssessment[] }
  const [loadingPilots,  setLoadingPilots]  = useState(false)
  const [scheduledMap,   setScheduledMap]   = useState({})    // { [ac.id]: true }
  const [scheduledEtas,  setScheduledEtas]  = useState({})    // { [ac.id]: Date }

  const [loadingDept,  setLoadingDept]  = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [errors, setErrors] = useState({})

  // ── Fetch departure weather ──────────────────────────────────────────────────
  const fetchDeptWeather = useCallback(async (icao) => {
    if (icao.length < 3) return
    setLoadingDept(true)
    setErrors((e) => ({ ...e, dept: null }))
    try {
      const [metarRes, tafRes] = await Promise.all([
        fetch(`${WEATHER}/api/metar/${icao}`),
        fetch(`${WEATHER}/api/taf/${icao}`),
      ])
      const metar = metarRes.ok ? await metarRes.json() : []
      const taf   = tafRes.ok  ? await tafRes.json()  : []
      setDeptWeather({ metar: Array.isArray(metar) ? metar : [metar], taf: Array.isArray(taf) ? taf : [taf] })
    } catch (err) {
      setErrors((e) => ({ ...e, dept: 'FlightSafeWeather unavailable — check server on :3000' }))
    } finally {
      setLoadingDept(false)
    }
  }, [])

  // ── Fetch route + arrival weather ─────────────────────────────────────────
  const fetchRouteWeather = useCallback(async (deptIcao, arrIcao, departureDate) => {
    if (deptIcao.length < 3 || arrIcao.length < 3) return
    setLoadingRoute(true)
    setErrors((e) => ({ ...e, route: null }))
    try {
      const body = { departure: deptIcao, arrival: arrIcao }
      if (departureDate) body.departureTime = departureDate.toISOString()
      const res = await fetch(`${WEATHER}/api/flight-weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setRouteData(await res.json())
    } catch (err) {
      setErrors((e) => ({ ...e, route: 'Route weather unavailable — check server on :3000' }))
    } finally {
      setLoadingRoute(false)
    }
  }, [])

  // ── Query KnownRisks API per aircraft ────────────────────────────────────
  const fetchKnownRisks = useCallback(async (eligibleAc, airSafeResults, terrainMet, routeDat, deptWx) => {
    if (!dept || !arr || !eligibleAc.length) return
    setLoadingKnown(true)

    const deptMetar = deptWx?.metar?.[0] ?? null
    const cloudAgl  = deptMetar
      ? (deptMetar.sky_condition ?? [])
          .filter((s) => s.sky_cover === 'BKN' || s.sky_cover === 'OVC')
          .map((s) => parseInt(s.cloud_base_ft_agl ?? 99999))
          .sort((a, b) => a - b)[0] ?? null
      : null
    const cat = deptMetar?.flight_category ?? null

    const sigmets = routeDat?.sigmets?.route?.features ?? []
    const airmets = routeDat?.airmets?.route?.features  ?? []
    const sigmetTypes = [...new Set(sigmets.map((f) => f.properties?.hazard ?? f.properties?.airsigmet_type ?? 'SIGMET'))]
    const airmetTypes = [...new Set(airmets.map((f) => f.properties?.hazard ?? f.properties?.airsigmet_type ?? 'AIRMET'))]

    // Arrival ceiling from routeData metars
    const arrMetar = routeDat?.metars?.data?.find((m) => m.station_id === arr || m.station_id?.endsWith(arr.slice(-3)))
    const arrCeilingLayers = (arrMetar?.sky_condition ?? [])
      .filter((s) => s.sky_cover === 'BKN' || s.sky_cover === 'OVC')
      .map((s) => parseInt(s.cloud_base_ft_agl ?? 99999))
    const arrCeiling = arrCeilingLayers.length ? Math.min(...arrCeilingLayers) : null

    // ── Terrain from routeData (populated by FlightSafeWeather USGS 3DEP) ──
    const maxElevFt   = routeDat?.elevation?.maxElevFt ?? null
    const deptElevFt  = routeDat?.stations?.departure?.elevFt ?? null
    const arrElevFt   = routeDat?.stations?.arrival?.elevFt   ?? null
    const mea         = computeMEA(maxElevFt)
    const highestAirportFt = Math.max(deptElevFt ?? 0, arrElevFt ?? 0)
    // Mountainous: peak terrain rises >2000 ft above both airports (genuine crossing)
    const isMountainousRoute = maxElevFt != null && deptElevFt != null && arrElevFt != null
      ? maxElevFt > Math.max(deptElevFt, arrElevFt) + 2000
      : false
    // Density altitude at departure: elev + (actualTemp - ISA_temp) * 120 ft/°C
    // ISA_temp(h) = 15 − h/1000 * 2  (°C)
    const deptTempC = deptWx?.metar?.[0]?.temp_c ?? null
    const densityAltitudeFt = deptElevFt != null && deptTempC != null
      ? Math.round(deptElevFt + (deptTempC - (15 - deptElevFt / 1000 * 2)) * 120)
      : (deptElevFt ?? null)

    const results = {}
    await Promise.allSettled(
      eligibleAc.map(async (ac) => {
        const asScore = airSafeResults[ac.id]?.result
        const profile = {
          departure: dept,
          arrival:   arr,
          // Aircraft
          aircraft_fiki:            ac.equipment?.fiki                   ?? false,
          aircraft_ifrCertified:    ac.equipment?.ifrCertified           ?? false,
          aircraft_autopilot:       ac.equipment?.autopilot              ?? false,
          aircraft_multiEngine:     ac.riskProfile?.multiEngine          ?? false,
          aircraft_jetFuelRequired: ac.riskProfile?.jetFuelInPropAircraft ?? false,
          aircraft_turboprop:       ac.riskProfile?.turboprop          ?? false,
          // Weather
          sigmetCount:      sigmets.length,
          sigmetType:       sigmetTypes,
          airsigmetType:    airmetTypes,
          flightCondition:  cat,
          arrivalCeiling_ft: arrCeiling,
          // Terrain — pulled directly from routeData, not backed out from MEA
          maxTerrainFt:       maxElevFt,
          meaVsCeilingPct:    mea && ac.serviceCeiling
            ? Math.round((mea / ac.serviceCeiling) * 100)
            : null,
          isMountainousRoute,
          departureElevFt:    deptElevFt,
          arrivalElevFt:      arrElevFt,
          highestAirportFt:   highestAirportFt > 0 ? highestAirportFt : null,
          oeiBelowMEA:        mea != null && ac.singleEngineCeiling != null
            ? ac.singleEngineCeiling < mea
            : false,
          oeiBelowArrivalElev: arrElevFt != null && ac.singleEngineCeiling != null
            ? ac.singleEngineCeiling < arrElevFt + 500
            : false,
          // Operations
          nightFlight:        false,   // TODO: derive from depTime
          singlePilot:        true,    // assume single pilot for planning
          densityAltitudeFt,
          dutyHours:          4,
          timeOfDay:          'day',
          // AirSafe scores for blending
          airsafeBaselineAccMhr: 9.74,
          airsafeAccidentAccMhr: asScore?.risk_clusters?.length
            ? asScore.risk_clusters.reduce((s, c) => s + (c.recent_rate ?? 0) * (c.match_count ?? 0), 0) /
              Math.max(1, asScore.risk_clusters.reduce((s, c) => s + (c.match_count ?? 0), 0))
            : 9.74,
        }

        try {
          const res = await fetch(`${KNOWN_RISKS}/api/assess`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
          })
          results[ac.id] = res.ok ? await res.json() : null
        } catch {
          results[ac.id] = null
        }
      })
    )

    setKnownRisks(results)
    setLoadingKnown(false)
  }, [dept, arr])

  // ── Query PilotRisk API for all eligible aircraft ─────────────────────────
  const fetchPilotRisks = useCallback(async (eligibleAc, routeDat, deptWx, currentDepTime) => {
    if (!dept || !arr || !eligibleAc.length) return

    setLoadingPilots(true)

    // Derive flight conditions
    const deptMetar = deptWx?.metar?.[0] ?? null
    const cat       = deptMetar?.flight_category ?? null
    const isIFR     = cat === 'IFR' || cat === 'LIFR'
    const h         = currentDepTime?.date ? currentDepTime.date.getUTCHours() : new Date().getUTCHours()
    const isNight   = h >= 22 || h < 6

    const aircraft = eligibleAc.map((ac) => ({ icaoType: ac.icaoType, tailNumber: ac.tailNumber }))

    try {
      const res = await fetch(`${PILOT_RISK}/api/assess-crew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aircraft,
          conditions: { isIFR, isNight, hasPassengers: true },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPilotRisks(data.byTail ?? null)
      }
    } catch {
      // PilotRisk unavailable — fail silently
    } finally {
      setLoadingPilots(false)
    }
  }, [dept, arr])

  // ── Query AirSafe for eligible aircraft → returns fresh results map ──────
  // Takes the eligible array directly so the caller controls filtering.
  // Updates state incrementally as results stream in AND returns the final map.
  const fetchAirSafeRisks = useCallback(async (eligible, currentRouteData, currentDeptWeather) => {
    if (!eligible.length || !dept || !arr) return {}

    // Show loading spinners immediately
    setAircraftRisks(
      Object.fromEntries(eligible.map((ac) => [ac.id, { result: null, loading: true, error: null }]))
    )

    const freshResults = {}
    await Promise.allSettled(
      eligible.map(async (ac) => {
        const narrative = buildNarrative(dept, arr, ac, currentDeptWeather, currentRouteData)
        try {
          const res = await fetch(`${AIRSAFE}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              departure: dept,
              arrival: arr,
              aircraft: ac.makeModel,
              narrative,
              phase_of_flight: 'enroute',
              top_k: 10,
            }),
          })
          const result = res.ok ? await res.json() : null
          freshResults[ac.id] = { result, loading: false, error: res.ok ? null : `HTTP ${res.status}` }
          setAircraftRisks((prev) => ({ ...prev, [ac.id]: freshResults[ac.id] }))
        } catch {
          freshResults[ac.id] = { result: null, loading: false, error: 'AirSafe unavailable — check server on :5000' }
          setAircraftRisks((prev) => ({ ...prev, [ac.id]: freshResults[ac.id] }))
        }
      })
    )
    return freshResults
  }, [dept, arr])

  // ── Reactive risk pipeline: runs whenever pax + route + weather are all ready ──
  // Clears stale aircraft data whenever the route changes.
  useEffect(() => {
    setAircraftRisks({})
    setKnownRisks(null)
    setTerrainMetrics(null)
    setPilotRisks(null)
    setScheduledMap({})
  }, [dept, arr])

  useEffect(() => {
    const n = parseInt(pax)
    if (!n || n < 1 || !dept || !arr || !routeData || !deptWeather) return

    const eligible = mockAircraft.filter((ac) => ac.airworthy && (ac.passengerCapacity ?? 0) >= n)
    if (!eligible.length) return

    let cancelled = false
    ;(async () => {
      const airSafeResults = await fetchAirSafeRisks(eligible, routeData, deptWeather)
      if (cancelled) return
      await fetchKnownRisks(eligible, airSafeResults, null, routeData, deptWeather)
      if (cancelled) return
      await fetchPilotRisks(eligible, routeData, deptWeather, depTime)
    })()

    return () => { cancelled = true }
  }, [dept, arr, pax, routeData, deptWeather, depTime, fetchAirSafeRisks, fetchKnownRisks, fetchPilotRisks])

  // ── Schedule a flight from the plan page ─────────────────────────────────
  function handleScheduleFlight(aircraft, picId, sicId, missionType) {
    const crew = pilotRisks?.[aircraft.tailNumber] ?? []
    const pic  = crew.find((a) => a.pilotId === picId)
    const sic  = crew.find((a) => a.pilotId === sicId)

    // Derive flight risk scores from existing assessments
    const knownSummary  = knownRisks?.[aircraft.id]?.summary
    const combinedRatio = knownSummary?.ratioToBaseline ?? 1.0
    const riskScore     = Math.min(100, Math.round(combinedRatio * 25))

    const picRiskP = pic ? Math.min(100, pic.riskScore) : 50
    const riskA    = aircraft.inspectionStatus === 'current' ? 15
                   : aircraft.inspectionStatus === 'due_soon' ? 50 : 85
    const sigmets  = routeData?.sigmets?.route?.features ?? []
    const airmets  = routeData?.airmets?.route?.features  ?? []
    const riskV    = sigmets.length > 0 ? 75 : airmets.length > 0 ? 45 : 25
    const riskE    = 30

    // ── Build rich riskSnapshot ──────────────────────────────────────────────
    const deptMetar = deptWeather?.metar?.[0] ?? null
    const flightCategory = deptMetar?.flight_category ?? null
    const windKts = deptMetar?.wind_speed_kt ?? 0
    const visSm   = deptMetar?.visibility_statute_mi ?? 10

    const weatherSummary = {
      flightCategory,
      sigmetCount: sigmets.length,
      airmetCount: airmets.length,
      windKts,
      visibilitySm: visSm,
    }

    const picAssessment = pic ? { factors: pic.factors ?? [], disqualifiers: pic.disqualifiers ?? [] } : null
    const riskItems = extractRiskItems(knownSummary, weatherSummary, picAssessment)

    const terrainProfile = routeData?.elevation
      ? { profile: routeData.elevation.profile ?? [], maxElevFt: routeData.elevation.maxElevFt }
      : null

    const now = new Date().toISOString()
    const riskSnapshot = {
      capturedAt:      now,
      lastCheckedAt:   now,
      ratioToBaseline: combinedRatio,
      riskTrend:       'stable',
      riskDelta:       0,
      activeFactors:   knownSummary?.activeFactors ?? [],
      weatherSummary,
      terrainProfile,
      riskItems,
      // Stored for recalculation (the profile fields needed to re-query KnownRisks)
      knownRiskProfile: knownRisks?.[aircraft.id]?.profile ?? null,
    }

    const newFlight = {
      id:                  `flt-${Date.now()}`,
      callsign:            aircraft.tailNumber,
      tailNumber:          aircraft.tailNumber,
      aircraftType:        aircraft.icaoType,
      departure:           dept,
      arrival:             arr,
      waypoints:           [],
      plannedDepartureUtc: depTime.date ? depTime.date.toISOString() : new Date(Date.now() + 3_600_000).toISOString(),
      status:              'planned',
      pic:                 pic ? `${pic.name.split(' ')[1]}, ${pic.name[0]}.` : picId,
      picId,
      sic:                 sic ? `${sic.name.split(' ')[1]}, ${sic.name[0]}.` : null,
      sicId:               sicId ?? null,
      passengers:          parseInt(pax) || 0,
      missionType,
      riskScore,
      riskP: picRiskP,
      riskA,
      riskV,
      riskE,
      riskSnapshot,
    }

    addFlight(newFlight)
    setScheduledMap((prev) => ({ ...prev, [aircraft.id]: true }))

    // Compute and store ETA for return trip offer
    const depDate = depTime.date ? depTime.date : new Date(Date.now() + 3_600_000)
    const estDur  = estimateFlightDuration(dept, arr, aircraft.cruiseSpeedKts, 15)
    const eta     = estimateEta(depDate, estDur?.totalHours)
    if (eta) {
      setScheduledEtas((prev) => ({ ...prev, [aircraft.id]: eta }))
    }
  }

  function handleScheduleReturn(aircraft, { returnDep, returnArr, returnDepTime, missionType: retMission }) {
    const newFlight = {
      id:                  `flt-${Date.now()}`,
      callsign:            aircraft.tailNumber,
      tailNumber:          aircraft.tailNumber,
      aircraftType:        aircraft.icaoType,
      departure:           returnDep,
      arrival:             returnArr,
      waypoints:           [],
      plannedDepartureUtc: returnDepTime.toISOString(),
      status:              'planned',
      pic:                 null,
      picId:               null,
      sic:                 null,
      sicId:               null,
      passengers:          0,
      missionType:         retMission,
      riskScore:           10,
      riskSnapshot: {
        capturedAt:      new Date().toISOString(),
        lastCheckedAt:   new Date().toISOString(),
        ratioToBaseline: 0.8,
        riskTrend:       'stable',
        riskDelta:       0,
        weatherSummary:  null,
        terrainProfile:  null,
        riskItems:       [],
      },
    }
    addFlight(newFlight)
  }

  // ── Event handlers ──────────────────────────────────────────────────────
  function handleDeptCommit(icao) {
    setDept(icao)
    if (icao.length >= 3) fetchDeptWeather(icao)
  }

  function handleArrCommit(icao) {
    setArr(icao)
    if (icao.length >= 3 && dept.length >= 3) fetchRouteWeather(dept, icao, depTime.date)
  }

  function handleDepTimeChange(newTime) {
    setDepTime(newTime)
    if (dept.length >= 3 && arr.length >= 3) fetchRouteWeather(dept, arr, newTime.date)
  }

  function handlePaxChange(val) {
    setPax(val.replace(/\D/g, ''))
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const paxCount = parseInt(pax) || 0
  const eligibleAircraft = paxCount > 0
    ? mockAircraft.filter((ac) => (ac.passengerCapacity ?? 0) >= paxCount).sort((a, b) => {
        // sort: airworthy first, then by airsafe similarity asc (lower risk first)
        if (a.airworthy !== b.airworthy) return b.airworthy - a.airworthy
        const aScore = aircraftRisks[a.id]?.result?.results?.reduce((s, r) => s + r.score, 0) ?? 0
        const bScore = aircraftRisks[b.id]?.result?.results?.reduce((s, r) => s + r.score, 0) ?? 0
        return aScore - bScore
      })
    : []

  const arrMetar = routeData?.metars?.data?.find(
    (m) => m.station_id === arr || m.station_id?.endsWith(arr.slice(-3))
  )
  const arrTaf = routeData?.tafs?.data?.filter(
    (t) => t.station_id === arr || t.station_id?.endsWith(arr.slice(-3))
  )
  const deptMetar = deptWeather?.metar?.[0] ?? null
  const deptTaf   = deptWeather?.taf ?? null

  return (
    <div className="flex flex-col gap-6" data-testid="flight-planning">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Flight Planning</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Select route and passenger count to assess aircraft options with live weather and NTSB accident history.
        </p>
      </div>

      {/* ── Planning form ── */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-wrap items-end gap-6">
        <IcaoInput
          label="Departure"
          value={dept}
          onChange={setDept}
          onCommit={handleDeptCommit}
          loading={loadingDept}
          placeholder="KDFW"
        />

        <div className="text-slate-600 text-lg self-center pb-1">→</div>

        <IcaoInput
          label="Arrival"
          value={arr}
          onChange={setArr}
          onCommit={handleArrCommit}
          loading={loadingRoute}
          placeholder="KBOS"
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 uppercase tracking-wide">Passengers</label>
          <input
            type="number"
            min="1"
            max="20"
            value={pax}
            onChange={(e) => handlePaxChange(e.target.value)}
            placeholder="0"
            className="w-20 bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100
                       focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-surface-border self-end mb-1 hidden sm:block" />

        <DepartureTimePicker value={depTime} onChange={handleDepTimeChange} />

        {/* Status chips */}
        <div className="flex gap-2 flex-wrap self-center pb-0.5">
          {dept && !loadingDept && deptWeather && (
            <CategoryPill cat={flightCategory(deptMetar)} />
          )}
          {arr && !loadingRoute && routeData && (
            <CategoryPill cat={flightCategory(arrMetar)} />
          )}
          {loadingDept  && <span className="text-xs text-slate-500 animate-pulse">Fetching dept weather…</span>}
          {loadingRoute && <span className="text-xs text-slate-500 animate-pulse">Fetching route weather…</span>}
        </div>
      </div>

      {/* ── Errors ── */}
      {(errors.dept || errors.route) && (
        <div className="flex flex-col gap-2">
          {errors.dept  && <p className="text-xs text-red-400 bg-red-400/10 border border-red-500/20 rounded px-3 py-2">{errors.dept}</p>}
          {errors.route && <p className="text-xs text-red-400 bg-red-400/10 border border-red-500/20 rounded px-3 py-2">{errors.route}</p>}
        </div>
      )}

      {/* ── Step 1: Departure weather ── */}
      {(deptWeather || loadingDept) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Step 1 — Departure Weather
          </h2>
          {loadingDept ? (
            <div className="bg-surface-card border border-surface-border rounded-lg p-4 text-xs text-slate-500 animate-pulse">
              Fetching METAR + TAF for {dept}…
            </div>
          ) : (
            <WeatherCard label={`${dept} Departure`} metar={deptMetar} taf={deptTaf} />
          )}
        </section>
      )}

      {/* ── Step 2: Route + arrival weather ── */}
      {(routeData || loadingRoute) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Step 2 — Route &amp; Arrival Weather
          </h2>
          {loadingRoute ? (
            <div className="bg-surface-card border border-surface-border rounded-lg p-4 text-xs text-slate-500 animate-pulse">
              Computing route corridor and fetching weather…
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-3">
                <RouteWeatherBanner routeData={routeData} />
              </div>
              <WeatherCard label={`${dept} Departure`} metar={deptMetar} taf={deptTaf} />
              <div />
              <WeatherCard label={`${arr} Arrival`} metar={arrMetar ?? null} taf={arrTaf ?? null} />
            </div>
          )}
        </section>
      )}

      {/* ── Terrain profile (shown as soon as route data is ready) ── */}
      {routeData && !loadingRoute && (
        <TerrainProfile
          routeData={routeData}
          deptWeather={deptWeather}
          onMetrics={setTerrainMetrics}
        />
      )}

      {/* ── Step 3: Aircraft risk assessment ── */}
      {paxCount > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Step 3 — Aircraft Risk Assessment
            </h2>
            <span className="text-xs text-slate-500">
              {eligibleAircraft.length} aircraft with capacity ≥ {paxCount} pax
            </span>
          </div>

          {eligibleAircraft.length === 0 ? (
            <div className="bg-surface-card border border-surface-border rounded-lg p-6 text-center text-slate-500 text-sm">
              No airworthy aircraft in fleet can carry {paxCount} passengers.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {!dept || !arr ? (
                <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-500/20 rounded px-3 py-2">
                  Enter departure and arrival to include AirSafe accident analysis.
                </p>
              ) : null}
              {eligibleAircraft.map((ac) => (
                <AircraftRiskCard
                  key={ac.id}
                  aircraft={ac}
                  airSafeResult={aircraftRisks[ac.id]?.result ?? null}
                  loading={aircraftRisks[ac.id]?.loading ?? false}
                  error={aircraftRisks[ac.id]?.error ?? null}
                  terrainMetrics={terrainMetrics}
                  knownRiskAssessment={knownRisks?.[ac.id] ?? null}
                  loadingKnown={loadingKnown}
                  pilotAssessments={pilotRisks?.[ac.tailNumber] ?? null}
                  loadingPilots={loadingPilots}
                  flightConditions={{ dept, arr, depTime }}
                  onSchedule={(picId, sicId, missionType) => handleScheduleFlight(ac, picId, sicId, missionType)}
                  onScheduleReturn={(opts) => handleScheduleReturn(ac, opts)}
                  isScheduled={scheduledMap[ac.id] ?? false}
                  scheduledEta={scheduledEtas[ac.id] ?? null}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Empty state ── */}
      {!dept && !arr && !pax && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="text-4xl">✈️</span>
          <p className="text-slate-400 text-sm max-w-sm">
            Enter a departure and arrival airport (ICAO codes) to pull live weather.
            Then enter passenger count to see eligible aircraft with NTSB risk scores.
          </p>
        </div>
      )}
    </div>
  )
}
