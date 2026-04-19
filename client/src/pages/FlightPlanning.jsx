import { useState, useEffect, useCallback, useRef } from 'react'
import { mockAircraft, EQUIPMENT_FLAGS, RISK_PROFILE_FLAGS } from '../mocks/aircraft'
import { TerrainProfile, CeilingRiskBar, computeMEA } from '../components/shared/TerrainProfile'
import { PilotPanel, AvailabilityChip } from '../components/shared/PilotPanel'
import { addFlight, extractRiskItems, getAllFlights } from '../store/flights'
import { PART_91_TYPES } from '../mocks/flights'
import { estimateFlightDuration, estimateEta } from '../lib/flightCalc'
import { mockPersonnel } from '../mocks/personnel'
import { mockStudents, mockClubMembers } from '../training/mockTraining'
import { getAircraftPhoto } from '../portal/portalConstants'
import { useAircraftStars } from '../hooks/useAircraftStars'
import {
  getTowAvailability,
  towCycleMin,
  timeAloftMin,
  TOW_HEIGHTS,
  TOW_SETTINGS,
  towColorCss,
  fmtTime,
} from '../glider/gliderUtils'

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

const WEATHER     = import.meta.env.VITE_WEATHER_URL || '/weather-api'
const AIRSAFE     = '/airsafe-api'
const KNOWN_RISKS = '/known-risks'
const PILOT_RISK  = '/pilot-risk'

// ── Part 91 op-type smart defaults ───────────────────────────────────────────
// Types where passengers are never carried — pax auto-resets to 0 on selection.
const ZERO_PAX_TYPES = new Set([
  'glider_tow', 'post_maintenance', 'ferry', 'positioning',
  'test_flight', 'check_flight', 'aerial_work', 'glider_rental',
])

// Default notes pre-filled when selecting an op type (only when notes field is empty
// or still shows the previous op type's default).
const OP_TYPE_NOTES = {
  sightseeing:      'Sightseeing air tour — §91.147 commercial air tour',
  glider_tow:       'Glider aerotow — §91.309; tow pilot PIC, release at altitude',
  glider_rental:    'Glider rental — student/club member PIC; FAA glider certificate required',
  rental:           'Aircraft rental — renter-pilot PIC; valid pilot certificate and currency required',
  post_maintenance: 'Post-maintenance functional check flight — §91.407; verify all repaired systems',
  ferry:            'Ferry flight — aircraft repositioned to maintenance/sale/storage destination',
  positioning:      'Aircraft repositioning — no passengers; return to base or operator',
  test_flight:      'Aircraft test flight — §91.305; test area; reduced risk of injury to persons on ground',
  personal:         'Personal/recreational flight — pilot currency and medical confirmed',
  check_flight:     'Proficiency/check flight — §91.1; BFR or recurrent training',
  aerial_work:      'Aerial work / photography — §91.1; low-altitude maneuvering awareness',
}

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

// ─── Local tow-pilot assessment builder ───────────────────────────────────────
// PilotRisk doesn't hold tow-endorsement data, so for glider_tow ops we build
// assessments locally from mockPersonnel instead of calling the API.

function buildTowAssessment(p) {
  const today = new Date()
  const disqualifiers = []
  const factors = []

  if (p.medicalExpiry && new Date(p.medicalExpiry) < today) {
    disqualifiers.push({ id: 'medical_expired', label: `Medical expired ${p.medicalExpiry}` })
  } else if (p.medicalExpiry) {
    const daysLeft = Math.round((new Date(p.medicalExpiry) - today) / 86_400_000)
    if (daysLeft < 30) factors.push({ id: 'medical_expiring', label: `Medical expires in ${daysLeft}d`, severity: 'warning' })
  }

  if (p.lastFlightReview) {
    const reviewAge = Math.round((today - new Date(p.lastFlightReview)) / 86_400_000)
    if (reviewAge > 730) {
      disqualifiers.push({ id: 'flight_review_expired', label: `Flight review expired (${Math.round(reviewAge / 30)}mo ago)` })
    } else if (reviewAge > 600) {
      factors.push({ id: 'flight_review_due_soon', label: `Flight review due within 4 months`, severity: 'caution' })
    }
  }

  const disqualified = disqualifiers.length > 0
  const riskScore    = disqualified ? 95 : factors.length > 0 ? 35 : 15
  const riskLabel    = disqualified ? 'Disqualified' : factors.length > 0 ? 'Low-Med' : 'Low'

  return {
    pilotId:            p.id,
    name:               p.name,
    certType:           p.certType ?? 'Unknown',
    medicalClass:       p.medicalClass ?? 3,
    riskScore,
    riskLabel,
    disqualified,
    disqualifiers,
    factors,
    tolInType90d:       '—',
    hoursInType:        0,
    totalHours:         (p.flightHoursYtd ?? 0) * 5,
    licenses:           [{ type: p.certType ?? 'Unknown', ratings: [] }],
    endorsements:       ['tow_certified', p.taildragherEndorsement ? 'tailwheel' : null].filter(Boolean),
    ifrCurrencyExpiry:  p.ifrCurrencyExpiry  ?? null,
    nightCurrencyExpiry: p.nightCurrencyExpiry ?? null,
    medicalExpiry:      p.medicalExpiry      ?? null,
    lastFlightReview:   p.lastFlightReview   ?? null,
    hoursByCategory:    {},
  }
}

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

// ─── Weight & fuel constants ───────────────────────────────────────────────────

const FAA_AVG_WEIGHT_LBS = 190   // FAA AC 120-27F standard adult (summer, incl. carry-on)
const FAA_AVG_BAG_LBS   = 30    // FAA AC 120-27F standard checked baggage
const AVGAS_LBS_PER_GAL  = 6.0
const JET_A_LBS_PER_GAL  = 6.7

/**
 * Per-aircraft weight status assessment.
 * @param flightContext  Optional { flightHrs, isNight } — when provided, checks post-flight
 *                       fuel reserve against FAA minimums (30 min day / 45 min night).
 * @returns {{ status: 'ok'|'caution'|'critical', label: string, detail: string } | null}
 *   null = aircraft lacks weight data
 */
function assessWeightStatus(aircraft, totalPaxLbs, totalBagLbs, flightContext = null) {
  if (!aircraft.emptyWeightLbs || !aircraft.maxGrossWeightLbs) return null
  const fuelDensity    = aircraft.fuelType === 'jet_a' ? JET_A_LBS_PER_GAL : AVGAS_LBS_PER_GAL
  const usefulLoad     = aircraft.maxGrossWeightLbs - aircraft.emptyWeightLbs
  const crewLbs        = FAA_AVG_WEIGHT_LBS   // single-pilot estimate
  const payload        = totalPaxLbs + totalBagLbs
  const totalOccupants = payload + crewLbs
  const availForFuel   = usefulLoad - totalOccupants
  const pct            = Math.round(totalOccupants / usefulLoad * 100)

  // Hard overweight — no fuel can be loaded
  if (totalOccupants > usefulLoad) {
    return { status: 'critical', label: 'Overweight', detail: `${(totalOccupants - usefulLoad).toLocaleString()} lbs over useful load (incl. crew)` }
  }

  if (aircraft.fuelCapacityGal && aircraft.fuelBurnGalHr) {
    const actualFuelGal = Math.min(aircraft.fuelCapacityGal, availForFuel / fuelDensity)
    const enduranceHrs  = actualFuelGal / aircraft.fuelBurnGalHr

    // Post-flight reserve check (when flight duration is known)
    if (flightContext?.flightHrs > 0) {
      const reserveMin = flightContext.isNight ? 45 : 30
      const remHrs     = enduranceHrs - flightContext.flightHrs
      const remMin     = Math.round(remHrs * 60)
      if (remMin < reserveMin) {
        return {
          status: 'critical',
          label:  'Below reserve',
          detail: `${formatHours(remHrs)} remaining after flight — below ${reserveMin} min ${flightContext.isNight ? 'night' : 'day'} VFR reserve`,
        }
      }
    }

    // Static checks when no route is entered yet
    const reserveFuelLbs = (aircraft.fuelBurnGalHr * 0.5) * fuelDensity  // 30 min
    if (availForFuel < reserveFuelLbs) {
      return { status: 'critical', label: 'Insufficient fuel capacity', detail: `Only ${Math.round(actualFuelGal)} gal usable after occupant weight` }
    }
    if (enduranceHrs < 1) {
      return { status: 'caution', label: 'Low endurance', detail: `Max ${formatHours(enduranceHrs)} endurance with this payload` }
    }
  }

  // Marginal — 2× payload would exceed useful load
  if (2 * payload > usefulLoad) {
    return { status: 'caution', label: 'Weight marginal', detail: `${pct}% of useful load — verify before scheduling` }
  }
  return { status: 'ok', label: 'Weight OK', detail: `${pct}% of useful load (${(usefulLoad - totalOccupants).toLocaleString()} lbs for fuel)` }
}

function formatHours(hrs) {
  if (hrs == null) return '—'
  const h = Math.floor(Math.abs(hrs))
  const m = Math.round((Math.abs(hrs) - h) * 60)
  return `${hrs < 0 ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`
}

/**
 * Calculate weight breakdown and fuel endurance for one pilot combination.
 * Returns null when aircraft lacks fuel data.
 */
function parseHHMM(str) {
  if (!str) return 0
  const [h, m] = String(str).split(':')
  return (parseInt(h) || 0) + (parseInt(m) || 0) / 60
}

function calcWeightFuel({ aircraft, picWeightLbs, sicWeightLbs = 0, paxWeights = [], bagLbs = 0, dept, arr, depTime, manualFlightHrs }) {
  if (!aircraft.fuelCapacityGal || !aircraft.fuelBurnGalHr || !aircraft.emptyWeightLbs || !aircraft.maxGrossWeightLbs) return null

  const fuelDensity   = aircraft.fuelType === 'jet_a' ? JET_A_LBS_PER_GAL : AVGAS_LBS_PER_GAL
  const maxFuelLbs    = aircraft.fuelCapacityGal * fuelDensity
  const crewLbs       = picWeightLbs + sicWeightLbs
  const paxTotalLbs   = paxWeights.reduce((s, w) => s + (parseInt(w) || FAA_AVG_WEIGHT_LBS), 0)
  const payloadLbs    = crewLbs + paxTotalLbs + (parseInt(bagLbs) || 0)
  const usefulLoad    = aircraft.maxGrossWeightLbs - aircraft.emptyWeightLbs
  const availForFuel  = usefulLoad - payloadLbs
  const actualFuelLbs = Math.min(maxFuelLbs, Math.max(0, availForFuel))
  const actualFuelGal = actualFuelLbs / fuelDensity
  const enduranceHrs  = actualFuelGal / aircraft.fuelBurnGalHr

  const manualHrs   = parseHHMM(manualFlightHrs)
  const flightEst   = manualHrs > 0 ? null : estimateFlightDuration(dept, arr, aircraft.cruiseSpeedKts)
  const flightHrs   = manualHrs > 0 ? manualHrs : (flightEst?.totalHours ?? 0)
  const remHrs      = enduranceHrs - flightHrs
  const remMin      = Math.round(remHrs * 60)

  // Night: departure local hour < 6 or >= 20
  const depHour = depTime?.date ? depTime.date.getHours() : null
  const isNight = depHour != null && (depHour < 6 || depHour >= 20)
  const reserveMin = isNight ? 45 : 30

  const fuelColor =
    remMin < 0             ? 'text-red-500'    :
    remMin < reserveMin    ? 'text-red-400'    :
    remMin < reserveMin * 2 ? 'text-yellow-400' : 'text-green-400'

  const fuelBg =
    remMin < 0             ? 'bg-red-500/15 border-red-500/40'    :
    remMin < reserveMin    ? 'bg-red-500/10 border-red-400/30'    :
    remMin < reserveMin * 2 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/25'

  return {
    crewLbs, paxTotalLbs, payloadLbs, usefulLoad, availForFuel,
    actualFuelLbs, actualFuelGal, enduranceHrs,
    flightHrs, remHrs, remMin,
    isNight, reserveMin, fuelColor, fuelBg,
    overweight: payloadLbs > usefulLoad,
    fuelShortfall: availForFuel < 0 ? Math.round(-availForFuel) : 0,
    tripCostDollars: flightHrs > 0 ? Math.round(flightHrs * aircraft.opCostPerHour) : null,
  }
}

// ─── Tow Configuration Panel (for glider aircraft) ────────────────────────────

const TOW_AVAIL_COLORS = {
  green:  { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30',  bar: 'bg-green-500',  label: 'Available — 50%+ spare' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', bar: 'bg-yellow-500', label: 'Tight — at capacity' },
  red:    { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    bar: 'bg-red-500',    label: 'Overloaded — standby' },
}

function TowPanel({ airport, depMs, config, onChange, allFlights }) {
  const { numTows, towHeights } = config

  function setNum(n) {
    const clipped = Math.max(1, Math.min(4, n))
    onChange({
      numTows: clipped,
      towHeights: clipped > towHeights.length
        ? [...towHeights, ...Array(clipped - towHeights.length).fill(2000)]
        : towHeights.slice(0, clipped),
    })
  }

  function setHeight(i, h) {
    const next = [...towHeights]
    next[i] = h
    onChange({ numTows, towHeights: next })
  }

  const avail   = getTowAvailability(allFlights, airport, depMs, towHeights)
  const avCfg   = TOW_AVAIL_COLORS[avail.color]

  return (
    <div className="flex flex-col gap-4 bg-sky-500/5 border border-sky-500/20 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-sky-400 uppercase tracking-wide">Aerotow Configuration</span>
        <span className="text-[10px] text-slate-500">§91.309</span>
      </div>

      {/* Number of tows */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Number of tows</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setNum(numTows - 1)}
              className="w-7 h-7 rounded border border-surface-border text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors text-sm">−</button>
            <span className="w-6 text-center font-mono text-slate-100 text-sm">{numTows}</span>
            <button onClick={() => setNum(numTows + 1)}
              className="w-7 h-7 rounded border border-surface-border text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors text-sm">+</button>
          </div>
        </div>

        {/* Per-tow heights */}
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Tow heights</span>
          <div className="flex flex-col gap-1.5">
            {towHeights.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-10">Tow {i + 1}</span>
                <div className="flex gap-1">
                  {TOW_HEIGHTS.map((ft) => (
                    <button key={ft} onClick={() => setHeight(i, ft)}
                      className={`px-2 py-0.5 rounded border text-xs transition-colors ${
                        h === ft
                          ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                          : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                      }`}>
                      {(ft / 1000).toFixed(0)}k ft
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-600">
                  ~{towCycleMin(h)} min tow · ~{timeAloftMin(h)} min aloft
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Availability indicator — only shown if there are tows in the first 15 min */}
      {avail.hasTowsInWindow ? (
        <div className={`rounded border px-3 py-2 flex flex-col gap-1.5 ${avCfg.border} ${avCfg.bg}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-xs font-medium flex items-center gap-1.5 ${avCfg.text}`}>
              <span className={`w-2 h-2 rounded-full ${avCfg.bar}`} />
              {avCfg.label}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {avail.reservedMin}/{avail.capacityMin} min in 30-min window
            </span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${avCfg.bar}`}
              style={{ width: `${Math.min(100, avail.reservedMin / avail.capacityMin * 100)}%` }} />
          </div>
          {avail.isStandby && (
            <p className="text-[10px] text-yellow-300">
              ⚠ Tow window overloaded — this reservation will be added as <strong>standby</strong>.
              See Glider Ops for confirmed slot times.
            </p>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-slate-600">
          No competing tows in first 15 min of departure window — capacity check deferred.
          Settings: {TOW_SETTINGS.groundTimeMin} min ground · {TOW_SETTINGS.minutesPer1000ft} min/1000 ft
        </div>
      )}
    </div>
  )
}

function AircraftRiskCard({
  aircraft, airSafeResult, loading, error, terrainMetrics,
  knownRiskAssessment, loadingKnown,
  pilotAssessments, loadingPilots, pilotRiskError, onRetryPilots,
  flightConditions, onSchedule, onScheduleReturn, isScheduled, scheduledEta,
  towConfig, onTowChange, allFlights, missionType,
  starRating = 0, onSetStar,
}) {
  const [expanded, setExpanded] = useState(false)
  const { ratio, rate, label, color, mode } = riskFromAirSafe(
    airSafeResult?.results,
    airSafeResult?.risk_clusters,
  )
  const clusters = airSafeResult?.risk_clusters ?? []
  const photo = getAircraftPhoto(aircraft.makeModel)

  const inspColors = {
    current: 'text-green-400',
    due_soon: 'text-yellow-400',
    overdue: 'text-red-400',
  }

  return (
    <div className={`border rounded-lg transition-colors overflow-hidden ${
      !aircraft.airworthy
        ? 'border-red-500/40 opacity-60'
        : expanded ? 'border-sky-500/40' : 'border-surface-border'
    }`}>
      {/* Main row — with aircraft photo background */}
      <div
        role="button"
        tabIndex={0}
        className="relative w-full text-left px-4 py-3 flex items-center gap-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* Aircraft photo underlay — same pattern as calendar cells */}
        {photo && (
          <img src={photo} alt="" loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none" />
        )}
        <div className={`absolute inset-0 ${photo ? 'bg-gradient-to-r from-surface-card via-surface-card/90 to-transparent' : 'bg-surface-card'} pointer-events-none`} />

        {/* Star rating */}
        {onSetStar && (
          <div className="relative z-[1] flex gap-0 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3].map((s) => (
              <button key={s} onClick={() => onSetStar(aircraft.tailNumber, starRating === s ? 0 : s)}
                className={`text-sm leading-none transition-all hover:scale-125 ${s <= starRating ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}>★</button>
            ))}
          </div>
        )}

        {/* Airworthy dot */}
        <span
          className={`relative z-[1] w-2 h-2 rounded-full flex-shrink-0 ${aircraft.airworthy ? 'bg-green-400' : 'bg-red-500'}`}
          title={aircraft.airworthy ? 'Airworthy' : 'Not airworthy'}
        />

        {/* Tail + ICAO type */}
        <div className="relative z-[1] flex-shrink-0 w-20">
          <div className="text-sm font-mono font-bold text-slate-100">{aircraft.tailNumber}</div>
          <div className="text-xs text-slate-500">{aircraft.icaoType}</div>
        </div>

        {/* Make/model + aircraft type category */}
        <div className="relative z-[1] flex-1 min-w-0">
          <div className="text-sm text-slate-300 truncate">{aircraft.makeModel}</div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${inspColors[aircraft.inspectionStatus] ?? 'text-slate-400'}`}>
              Insp: {aircraft.inspectionStatus.replace('_', ' ')}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              aircraft.equipment?.ifrCertified
                ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                : 'bg-slate-700/50 text-slate-400 border-slate-600'
            }`}>
              {aircraft.equipment?.ifrCertified ? 'IFR' : 'VFR only'}
            </span>
          </div>
        </div>

        {/* Capacity */}
        <div className="relative z-[1] flex-shrink-0 text-center w-16">
          <div className="text-sm text-slate-300">{aircraft.passengerCapacity} seats</div>
          <div className="text-xs text-slate-500">capacity</div>
        </div>

        {/* Weight status */}
        {(() => {
          const fc         = flightConditions ?? {}
          const paxLbs     = fc.paxWeights?.reduce((s,w) => s + (parseInt(w) || FAA_AVG_WEIGHT_LBS), 0) ?? 0
          const bagLbs     = fc.bagWeightLbs ?? 0
          const manualHrs  = parseHHMM(fc.manualFlightHrs)
          const flightEst  = manualHrs > 0 ? null : estimateFlightDuration(fc.dept, fc.arr, aircraft.cruiseSpeedKts)
          const flightHrs  = manualHrs > 0 ? manualHrs : (flightEst?.totalHours ?? 0)
          const depHour    = fc.depTime?.date?.getHours() ?? null
          const isNight    = depHour != null && (depHour < 6 || depHour >= 20)
          const ws = assessWeightStatus(aircraft, paxLbs, bagLbs, flightHrs > 0 ? { flightHrs, isNight } : null)
          if (!ws) return <div className="relative z-[1] flex-shrink-0 w-8" />
          const cfg = {
            ok:       { color: 'text-green-300',  bg: 'bg-green-500/25',  border: 'border-green-500/50'  },
            caution:  { color: 'text-yellow-300', bg: 'bg-yellow-500/25', border: 'border-yellow-500/50' },
            critical: { color: 'text-red-300',    bg: 'bg-red-500/40',    border: 'border-red-500/70'    },
          }[ws.status]
          return (
            <div className="relative z-[1] flex-shrink-0 text-center w-8" title={`${ws.label} — ${ws.detail}`}>
              <span className={`text-sm px-1 py-0.5 rounded border ${cfg.color} ${cfg.bg} ${cfg.border}`}>⚖</span>
            </div>
          )
        })()}

        {/* Capability chips + MEL — fixed width so columns align across cards */}
        <div className="relative z-[1] hidden md:flex flex-wrap gap-1 flex-shrink-0 w-48">
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
          {/* VFR-only badge now shown inline with make/model */}
          {aircraft.riskProfile?.multiEngine && aircraft.singleEngineCeiling && (
            (() => {
              // Compare OEI ceiling against DA (decision altitude) — the critical threshold
              // for a single-engine missed approach. Fall back to MEA only when DA is unknown.
              const da         = terrainMetrics?.approachDA
              const mea        = terrainMetrics?.mea
              const benchmark  = da ?? mea   // DA is preferred; MEA is en-route fallback
              const oei        = aircraft.singleEngineCeiling
              const critical   = benchmark != null && oei < benchmark
              const hasData    = benchmark != null
              const label      = da != null ? 'vs DA' : mea != null ? 'vs MEA' : null
              return (
                <span
                  title={da != null
                    ? `OEI ceiling ${oei.toLocaleString()} ft vs approach DA ${da.toLocaleString()} ft`
                    : mea != null
                      ? `OEI ceiling ${oei.toLocaleString()} ft vs MEA ${mea.toLocaleString()} ft`
                      : `Single-engine ceiling ${oei.toLocaleString()} ft`}
                  className={`text-xs px-1.5 py-0.5 rounded border font-mono ${
                    critical
                      ? 'bg-red-500/10 text-red-400 border-red-500/30'
                      : hasData
                        ? 'bg-green-400/10 text-green-400 border-green-500/20'
                        : 'bg-slate-700/50 text-slate-400 border-slate-600'
                  }`}>
                  OEI {oei.toLocaleString()}ft{critical ? ' ⚠' : ''}{label ? ` · ${label}` : ''}
                </span>
              )
            })()
          )}
          {aircraft.melItemsOpen?.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-500/20">
              MEL {aircraft.melItemsOpen.length}
            </span>
          )}
        </div>

        {/* Trip cost + fuel remaining chip */}
        {(() => {
          const fc  = flightConditions ?? {}
          const wf  = calcWeightFuel({
            aircraft,
            picWeightLbs:  FAA_AVG_WEIGHT_LBS,
            sicWeightLbs:  0,
            paxWeights:    fc.paxWeights ?? [],
            bagLbs:        fc.bagWeightLbs ?? 0,
            dept:          fc.dept,
            arr:           fc.arr,
            depTime:       fc.depTime,
            manualFlightHrs: fc.manualFlightHrs,
          })

          if (!wf) {
            // Aircraft lacks fuel data — show hourly rate only
            return (
              <>
                <div className="relative z-[1] flex-shrink-0 text-center w-20">
                  <div className="text-sm font-mono text-slate-400">—</div>
                  <div className="text-[10px] text-slate-500">fuel rem</div>
                </div>
                <div className="relative z-[1] flex-shrink-0 text-center w-20">
                  <div className="text-sm font-mono text-slate-300">${aircraft.opCostPerHour.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">per hour</div>
                </div>
              </>
            )
          }

          const hasRoute = wf.flightHrs > 0
          const endHrs   = aircraft.fuelCapacityGal / aircraft.fuelBurnGalHr

          return (
            <>
              {/* Fuel remaining column */}
              <div className="relative z-[1] flex-shrink-0 text-center w-20"
                title={`Max endurance ${formatHours(endHrs)}`}>
                <div className={`text-sm font-mono font-semibold ${wf.fuelColor}`}>
                  {wf.remMin < 0 ? '⚠ ' : ''}{formatHours(hasRoute ? wf.remHrs : endHrs)}
                </div>
                <div className="text-[10px] text-slate-500">{hasRoute ? 'fuel rem' : 'endurance'}</div>
              </div>
              {/* Trip cost column */}
              <div className="relative z-[1] flex-shrink-0 text-center w-20">
                <div className="text-sm font-mono text-slate-300">
                  {wf.tripCostDollars != null ? `$${wf.tripCostDollars.toLocaleString()}` : `$${aircraft.opCostPerHour.toLocaleString()}`}
                </div>
                <div className="text-[10px] text-slate-500">{wf.tripCostDollars != null ? 'est. trip' : 'per hour'}</div>
              </div>
            </>
          )
        })()}

        {/* Combined risk score */}
        <div className="relative z-[1] flex-shrink-0 w-40 flex flex-col gap-1">
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
        <div className="relative z-[1] flex-shrink-0 w-32 hidden md:block" onClick={(e) => e.stopPropagation()}>
          <AvailabilityChip assessments={pilotAssessments} />
        </div>

        {/* Schedule button */}
        <div className="relative z-[1] flex-shrink-0 w-20 text-center">
          {isScheduled ? (
            <span className="text-xs px-2 py-1 rounded border border-green-500/30 text-green-400 bg-green-400/10">
              ✓ Scheduled
            </span>
          ) : (
            <button
              className="text-xs px-2 py-1 rounded border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
              title="Schedule this flight"
            >
              Schedule
            </button>
          )}
        </div>

        <span className="relative z-[1] text-slate-500 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

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

          {/* Tow configuration — glider aircraft only */}
          {aircraft.needs_tow && towConfig && (
            <TowPanel
              airport={flightConditions?.dept || aircraft.assignedBase || 'KBDU'}
              depMs={flightConditions?.depTime?.date
                ? flightConditions.depTime.date.getTime()
                : Date.now() + 3_600_000}
              config={towConfig}
              onChange={onTowChange}
              allFlights={allFlights ?? []}
            />
          )}

          {/* Pilot availability + schedule (fuel calc merged in) */}
          <PilotPanel
            aircraft={aircraft}
            pilotAssessments={pilotAssessments}
            loading={loadingPilots}
            pilotRiskError={pilotRiskError}
            onRetryPilots={onRetryPilots}
            flightConditions={flightConditions}
            departureTime={flightConditions?.depTime?.date ?? null}
            pilotFuelMap={(() => {
              if (!aircraft.fuelCapacityGal) return null
              const { dept, arr, depTime, paxWeights: paxWts = [], bagWeightLbs: bagLbs = 0, manualFlightHrs: manualHrs } = flightConditions ?? {}
              const pilotList = pilotAssessments?.length > 0
                ? pilotAssessments
                : mockPersonnel
                    .filter(p => p.role === 'pilot_pic' || p.role === 'pilot_sic')
                    .map(p => ({ pilotId: p.id, name: p.name }))
              return Object.fromEntries(
                pilotList.map(a => {
                  const person = mockPersonnel.find(p => p.id === a.pilotId)
                  const picWt  = person?.weightLbs ?? FAA_AVG_WEIGHT_LBS
                  return [a.pilotId, calcWeightFuel({ aircraft, picWeightLbs: picWt, paxWeights: paxWts, bagLbs, dept, arr, depTime, manualFlightHrs: manualHrs })]
                })
              )
            })()}
            onSchedule={onSchedule}
            onScheduleReturn={onScheduleReturn}
            isScheduled={isScheduled}
            scheduledEta={scheduledEta}
            missionType={missionType}
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
  const [stars, setStar] = useAircraftStars()
  const [planningTab,     setPlanningTab]     = useState('135')   // '135' | '91'
  // ── Part 91 specific state ──────────────────────────────────────────────────
  const [opType,          setOpType]          = useState(PART_91_TYPES[0].id)
  const [notes91,         setNotes91]         = useState('')
  // ── Shared state (PAX / weight / timing) ─────────────────────────────────
  const [paxWeights,      setPaxWeights]      = useState([FAA_AVG_WEIGHT_LBS])
  const [paxBags,         setPaxBags]         = useState([FAA_AVG_BAG_LBS])  // per-pax baggage lbs
  const [paxNames,        setPaxNames]        = useState([''])               // per-pax full names
  const [weightVerified,  setWeightVerified]  = useState(false)
  const [manualFlightHrs, setManualFlightHrs] = useState('')   // H:MM string for circular flights
  // ── Shared state (used by both Part 135 and Part 91 pipelines) ────────────
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
  const [pilotRiskError, setPilotRiskError] = useState(null)  // string | null
  const [loadingPilots,  setLoadingPilots]  = useState(false)
  const [scheduledMap,   setScheduledMap]   = useState({})    // { [ac.id]: true }
  const [scheduledEtas,  setScheduledEtas]  = useState({})    // { [ac.id]: Date }
  const [towConfigs,     setTowConfigs]     = useState({})    // { [ac.id]: { numTows, towHeights } }
  const [rentalPicId,    setRentalPicId]    = useState(null)  // for rental / glider_rental op types
  const [allFlights,     setAllFlights]     = useState(() => getAllFlights())

  const [loadingDept,  setLoadingDept]  = useState(false)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [errors, setErrors] = useState({})

  // ── Derived flags (needed before effects) ────────────────────────────────────
  const isTowOp = planningTab === '91' && opType === 'glider_tow'

  const scheduleMissionType =
    opType === 'glider_tow'   ? 'tow'
    : opType === 'reposition' ? 'positioning'
    : opType === 'training'   ? 'training'
    : 'charter'

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
    const approachDA  = terrainMet?.approachDA ?? null   // set by TerrainProfile after terrain load
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
          // OEI vs DA is the critical check — can the aircraft execute a missed approach
          // on one engine? MEA is retained as an en-route obstacle-clearance flag only.
          oeiBelowDA:          approachDA != null && ac.singleEngineCeiling != null
            ? ac.singleEngineCeiling < approachDA
            : false,
          oeiBelowMEA:         mea != null && ac.singleEngineCeiling != null
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
    setPilotRiskError(null)

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
        setPilotRiskError(null)
      } else {
        setPilotRiskError(`HTTP ${res.status}`)
      }
    } catch (err) {
      const reason = err?.message?.includes('fetch')
        ? 'PilotRisk service unreachable (port 5002)'
        : (err?.message ?? 'Unknown error')
      setPilotRiskError(reason)
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

  // ── Keep allFlights fresh (used by tow capacity check) ──────────────────────
  useEffect(() => {
    const handler = () => setAllFlights(getAllFlights())
    window.addEventListener('flightsafe:scheduled', handler)
    return () => window.removeEventListener('flightsafe:scheduled', handler)
  }, [])

  // ── Reactive risk pipeline: runs whenever pax + route + weather are all ready ──
  // Clears stale aircraft data whenever the route changes.
  useEffect(() => {
    setAircraftRisks({})
    setKnownRisks(null)
    setTerrainMetrics(null)
    setPilotRisks(null)
    setPilotRiskError(null)
    setScheduledMap({})
  }, [dept, arr])

  useEffect(() => {
    const n        = parseInt(pax) || 0
    const zeroPaxOp = planningTab === '91' && ZERO_PAX_TYPES.has(opType)
    // Need pax ≥ 1 OR be a zero-pax Part 91 op type
    if (n < 1 && !zeroPaxOp) return
    if (!dept || !arr || !routeData || !deptWeather) return

    // For zero-pax Part 91 ops, eligible aircraft matches what eligibleAircraft shows:
    // glider_tow → is_tow; all others → all airworthy
    const eligible = zeroPaxOp
      ? mockAircraft.filter((ac) => ac.airworthy && (isTowOp ? ac.is_tow : true))
      : mockAircraft.filter((ac) => ac.airworthy && (ac.passengerCapacity ?? 0) >= n)
    if (!eligible.length) return

    let cancelled = false
    ;(async () => {
      const airSafeResults = await fetchAirSafeRisks(eligible, routeData, deptWeather)
      if (cancelled) return
      await fetchKnownRisks(eligible, airSafeResults, null, routeData, deptWeather)
      if (cancelled) return
      if (isTowOp) {
        // PilotRisk doesn't hold tow-endorsement data — build assessments locally
        const towPilots = mockPersonnel.filter(
          (p) => p.towCertified && p.taildragherEndorsement && p.role?.startsWith('pilot_')
        )
        const assessments = towPilots.map(buildTowAssessment)
        const byTail = Object.fromEntries(eligible.map((ac) => [ac.tailNumber, assessments]))
        setPilotRisks(byTail)
        setLoadingPilots(false)
      } else {
        await fetchPilotRisks(eligible, routeData, deptWeather, depTime)
      }
    })()

    return () => { cancelled = true }
  }, [dept, arr, pax, planningTab, opType, isTowOp, routeData, deptWeather, depTime, fetchAirSafeRisks, fetchKnownRisks, fetchPilotRisks])

  // ── Schedule a flight from the plan page ─────────────────────────────────
  function handleScheduleFlight(aircraft, picId, sicId, missionType, overridePicId) {
    picId = overridePicId ?? picId
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
      passengerNames:      paxNames.filter(Boolean),
      missionType:         planningTab === '91' ? opType : missionType,
      part:                planningTab,
      ...(planningTab === '91' && {
        part91Type:    opType,
        paxWeightLbs:  paxWeights.reduce((s, w) => s + (parseInt(w) || FAA_AVG_WEIGHT_LBS), 0),
        bagWeightLbs:  totalBagLbs,
        notes:         notes91 || undefined,
      }),
      ...(aircraft.needs_tow && towConfigs[aircraft.id] && {
        airport:  dept || aircraft.assignedBase,
        towInfo:  {
          ...towConfigs[aircraft.id],
          isStandby: getTowAvailability(
            allFlights,
            dept || aircraft.assignedBase,
            depTime.date ? depTime.date.getTime() : Date.now() + 3_600_000,
            towConfigs[aircraft.id].towHeights,
          ).isStandby,
        },
      }),
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
  // ── Default Part 91 departure/arrival to base airport on tab switch ─────────
  const BASE_AIRPORT = mockAircraft[0]?.assignedBase ?? 'KBDU'

  useEffect(() => {
    if (planningTab === '91') {
      const newDept = dept || BASE_AIRPORT
      const newArr  = arr  || BASE_AIRPORT
      if (!dept) { setDept(newDept); fetchDeptWeather(newDept) }
      if (!arr)  {
        setArr(newArr)
        if (newDept.length >= 3) fetchRouteWeather(newDept, newArr, depTime.date)
      }
      if (ZERO_PAX_TYPES.has(opType)) {
        setPax('0'); setPaxWeights([]); setPaxBags([]); setPaxNames([])
      } else if (!pax || pax === '') {
        setPax('1'); setPaxWeights([FAA_AVG_WEIGHT_LBS])
      }
      if (!notes91) setNotes91(OP_TYPE_NOTES[opType] ?? '')
    }
  }, [planningTab])  // eslint-disable-line react-hooks/exhaustive-deps

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
    const n = parseInt(val.replace(/\D/g, '')) || 0
    setPax(String(n))
    setPaxWeights((prev) => n > prev.length ? [...prev, ...Array(n - prev.length).fill(FAA_AVG_WEIGHT_LBS)] : prev.slice(0, n))
    setPaxBags((prev)    => n > prev.length ? [...prev, ...Array(n - prev.length).fill(FAA_AVG_BAG_LBS)]    : prev.slice(0, n))
    setPaxNames((prev)   => n > prev.length ? [...prev, ...Array(n - prev.length).fill('')]                 : prev.slice(0, n))
    setWeightVerified(false)
  }

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalBagLbs = paxBags.reduce((s, b) => s + (parseInt(b) || 0), 0)
  const totalPaxLbs = paxWeights.reduce((s, w) => s + (parseInt(w) || FAA_AVG_WEIGHT_LBS), 0)

  // Weight criticality: flag the form section if any eligible aircraft is caution or critical
  const weightCritical = paxWeights.length > 0 && mockAircraft
    .filter((ac) => (ac.passengerCapacity ?? 0) >= paxWeights.length)
    .some((ac) => {
      const ws = assessWeightStatus(ac, totalPaxLbs, totalBagLbs)
      return ws && ws.status !== 'ok'
    })

  // Quick duration presets per Part 91 op type (most common durations)
  const QUICK_DURATIONS = {
    sightseeing:      ['0:30', '0:45', '1:00'],
    glider_tow:       ['0:20', '0:30', '0:45'],
    post_maintenance: ['0:30', '1:00', '1:30'],
    ferry:            ['1:30', '2:00', '3:00'],
    positioning:      ['1:00', '1:30', '2:00'],
    test_flight:      ['1:00', '1:30', '2:00'],
    personal:         ['1:00', '1:30', '2:00'],
    check_flight:     ['0:45', '1:00', '1:30'],
    aerial_work:      ['1:00', '1:30', '2:00'],
  }
  const quickDurations = QUICK_DURATIONS[opType] ?? ['1:00', '1:30', '2:00']

  // ── Derived data ─────────────────────────────────────────────────────────
  const paxCount = parseInt(pax) || 0
  const eligibleAircraft = isTowOp
    ? mockAircraft.filter((ac) => ac.is_tow).sort((a, b) => {
        if (a.airworthy !== b.airworthy) return b.airworthy - a.airworthy
        return (stars[b.tailNumber] || 0) - (stars[a.tailNumber] || 0)
      })
    : paxCount > 0
      ? mockAircraft.filter((ac) => (ac.passengerCapacity ?? 0) >= paxCount).sort((a, b) => {
          // sort: starred first, then airworthy, then by airsafe similarity asc (lower risk first)
          const starDiff = (stars[b.tailNumber] || 0) - (stars[a.tailNumber] || 0)
          if (starDiff !== 0) return starDiff
          if (a.airworthy !== b.airworthy) return b.airworthy - a.airworthy
          const aScore = aircraftRisks[a.id]?.result?.results?.reduce((s, r) => s + r.score, 0) ?? 0
          const bScore = aircraftRisks[b.id]?.result?.results?.reduce((s, r) => s + r.score, 0) ?? 0
          return aScore - bScore
        })
      : []

  // Group by IFR / VFR capability
  const ifrAircraft = eligibleAircraft.filter((ac) => ac.equipment?.ifrCertified)
  const vfrAircraft = eligibleAircraft.filter((ac) => !ac.equipment?.ifrCertified)

  const arrMetar = Array.isArray(routeData?.metars?.data)
    ? routeData.metars.data.find((m) => m.station_id === arr || m.station_id?.endsWith(arr.slice(-3)))
    : null
  const arrTaf = Array.isArray(routeData?.tafs?.data)
    ? routeData.tafs.data.filter((t) => t.station_id === arr || t.station_id?.endsWith(arr.slice(-3)))
    : null
  const deptMetar = deptWeather?.metar?.[0] ?? null
  const deptTaf   = deptWeather?.taf ?? null

  return (
    <div className="flex flex-col gap-6" data-testid="flight-planning">
      {/* ── Header + Tab switcher ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Flight Planning</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {planningTab === '135'
              ? 'Part 135 on-demand charter — live weather, terrain, and NTSB risk scoring.'
              : 'Part 91 general aviation operations — sightseeing, maintenance, ferry, and more.'}
          </p>
        </div>

        {/* Planning mode tabs */}
        <div className="flex items-center gap-1 mt-1">
          {[
            { key: '135', label: 'Part 135 Charter',   color: 'sky'   },
            { key: '91',  label: 'Part 91 Operations', color: 'amber' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setPlanningTab(key)}
              className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                planningTab === key
                  ? color === 'sky'
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Part 91 operation type selector ── */}
      {planningTab === '91' && (
          <div className="bg-surface-card border border-amber-500/20 rounded-xl p-5 flex flex-col gap-4">
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wide">Operation Type</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {PART_91_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const prevDefault = OP_TYPE_NOTES[opType] ?? ''
                    setOpType(t.id)
                    setRentalPicId(null)
                    // Auto-zero pax for crew-only operations
                    if (ZERO_PAX_TYPES.has(t.id)) {
                      handlePaxChange('0')
                    }
                    // Pre-fill notes when empty or still showing previous default
                    if (!notes91 || notes91 === prevDefault) {
                      setNotes91(OP_TYPE_NOTES[t.id] ?? '')
                    }
                  }}
                  className={`text-left rounded-lg px-3 py-2.5 border text-xs transition-colors ${
                    opType === t.id
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{t.reg}</div>
                </button>
              ))}
            </div>
            {(() => {
              const sel = PART_91_TYPES.find((t) => t.id === opType)
              return sel ? (
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Baseline risk multiplier:</span>
                  <span className={`font-mono font-bold ${
                    sel.riskRatio >= 1.5 ? 'text-red-400' :
                    sel.riskRatio >= 1.3 ? 'text-orange-400' :
                    sel.riskRatio >= 1.1 ? 'text-yellow-400' : 'text-green-400'
                  }`}>{sel.riskRatio.toFixed(2)}×</span>
                  <span>→ Base risk score ≈ {Math.round(sel.riskRatio * 25)} (refined by aircraft + weather)</span>
                </div>
              ) : null
            })()}

            {/* Rental / Glider Rental — PIC selector from student + club roster */}
            {(opType === 'rental' || opType === 'glider_rental') && (
              <div className="border-t border-surface-border pt-4 flex flex-col gap-3">
                <div className="text-xs text-amber-400 uppercase tracking-wide">
                  PIC — Select from students or flying club
                  {rentalPicId && <span className="text-green-400 ml-2">✓ Selected</span>}
                </div>

                {/* Students */}
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Flight School Students</div>
                  <div className="flex flex-wrap gap-2">
                    {(mockStudents ?? []).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setRentalPicId(s.id)}
                        className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                          rentalPicId === s.id
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                            : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        {s.name}
                        <span className="text-[10px] text-slate-600 ml-1">· {s.program ?? 'student'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flying club members */}
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Boulder Aviators Club</div>
                  <div className="flex flex-wrap gap-2">
                    {(mockClubMembers ?? []).map((m) => {
                      const issues = !m.duesCurrent || !m.bfrCurrent || !m.medicalCurrent || !m.rentersUploaded
                      return (
                        <button
                          key={m.id}
                          onClick={() => !issues && setRentalPicId(m.id)}
                          disabled={issues}
                          title={issues ? 'Not eligible — dues/BFR/medical/renters issue' : 'Click to select'}
                          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                            issues
                              ? 'border-slate-700 text-slate-600 cursor-not-allowed opacity-50'
                              : rentalPicId === m.id
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                                : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                          }`}
                        >
                          {m.name}
                          {issues && <span className="text-red-500 ml-1">⚠</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
      )}

      {/* ── Unified route + PAX + weight form (shared by Part 135 and 91) ── */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-wrap items-start gap-6">
            <IcaoInput label="Departure" value={dept} onChange={setDept} onCommit={handleDeptCommit} loading={loadingDept} placeholder="KBDU" />
            <div className="text-slate-600 text-lg mt-6">→</div>
            <IcaoInput label="Arrival" value={arr} onChange={setArr} onCommit={handleArrCommit} loading={loadingRoute} placeholder="KBDU" />

            {/* Manual flight time — shown when departure == arrival (circular / local flight) */}
            {dept && arr && dept.toUpperCase() === arr.toUpperCase() && dept.length >= 3 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 uppercase tracking-wide">Flight time (H:MM)</label>
                <input
                  type="text"
                  value={manualFlightHrs}
                  onChange={(e) => setManualFlightHrs(e.target.value)}
                  placeholder="1:30"
                  className="w-20 bg-surface-card border border-sky-500/40 rounded px-3 py-2 text-sm font-mono text-slate-100
                             focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600"
                />
                <div className="flex gap-1 mt-1">
                  {quickDurations.map((d) => (
                    <button
                      key={d}
                      onClick={() => setManualFlightHrs(d)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        manualFlightHrs === d
                          ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                          : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                      }`}
                    >{d}</button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-600">Local / circular flight</div>
              </div>
            )}

            <div className="w-px h-10 bg-surface-border mt-5 hidden sm:block" />

            {/* PAX stepper */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Passengers</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePaxChange(String(Math.max(0,(parseInt(pax)||0)-1)))}
                  className="w-8 h-8 rounded border border-surface-border text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors text-lg leading-none"
                >−</button>
                <span className="w-8 text-center font-mono text-slate-100 text-sm">{parseInt(pax)||0}</span>
                <button
                  onClick={() => handlePaxChange(String(Math.min(20,(parseInt(pax)||0)+1)))}
                  className="w-8 h-8 rounded border border-surface-border text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors text-lg leading-none"
                >+</button>
              </div>
              <div className="text-[10px] text-slate-600">FAA std {FAA_AVG_WEIGHT_LBS} lbs</div>
            </div>

            {/* Per-pax rows: name + weight + baggage */}
            {paxWeights.length > 0 && (
              <div className={`flex flex-col gap-2 rounded-lg p-3 border transition-colors ${
                weightCritical
                  ? 'border-orange-500/50 bg-orange-500/5'
                  : 'border-transparent'
              }`}>
                {weightCritical && (
                  <div className="flex items-center gap-2 text-xs text-orange-400">
                    <span className="text-orange-400">⚠</span>
                    <span>Weight loading marginal — verify with pilot before scheduling</span>
                  </div>
                )}
                <div className="grid grid-cols-[10rem_4rem_4rem] gap-x-2 gap-y-1.5">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Full name</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Wt (lbs)</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Bag (lbs)</div>
                  {paxWeights.map((w, i) => (
                    <>
                      <input
                        key={`name-${i}`}
                        type="text"
                        placeholder={`Passenger ${i + 1}`}
                        value={paxNames[i] ?? ''}
                        onChange={(e) => setPaxNames(prev => { const next=[...prev]; next[i]=e.target.value; return next })}
                        className="bg-surface-card border border-surface-border rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600"
                      />
                      <input
                        key={`wt-${i}`}
                        type="number" min="50" max="450" value={w}
                        onChange={(e) => { setPaxWeights(prev => { const next=[...prev]; next[i]=parseInt(e.target.value)||FAA_AVG_WEIGHT_LBS; return next }); setWeightVerified(false) }}
                        className="w-full bg-surface-card border border-surface-border rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 text-center"
                      />
                      <input
                        key={`bag-${i}`}
                        type="number" min="0" max="200" value={paxBags[i] ?? FAA_AVG_BAG_LBS}
                        onChange={(e) => { setPaxBags(prev => { const next=[...prev]; next[i]=parseInt(e.target.value)||0; return next }); setWeightVerified(false) }}
                        className="w-full bg-surface-card border border-surface-border rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 text-center"
                      />
                    </>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-[10px] text-slate-500 font-mono">
                    {totalPaxLbs.toLocaleString()} pax + {totalBagLbs.toLocaleString()} bag = {(totalPaxLbs + totalBagLbs).toLocaleString()} lbs
                  </div>
                  {weightCritical && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={weightVerified}
                        onChange={(e) => setWeightVerified(e.target.checked)}
                        className="accent-orange-400 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-orange-300">Weight verified</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            <div className="w-px h-10 bg-surface-border mt-5 hidden sm:block" />

            <DepartureTimePicker value={depTime} onChange={handleDepTimeChange} />

            {/* Part 91 notes */}
            {planningTab === '91' && (
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label className="text-xs text-slate-400 uppercase tracking-wide">Notes / Purpose</label>
                <input
                  type="text" value={notes91} onChange={(e) => setNotes91(e.target.value)}
                  placeholder="e.g. Post-annual test flight, fuel system check"
                  className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full placeholder-slate-600"
                />
              </div>
            )}

            {/* Weather status chips */}
            <div className="flex gap-2 flex-wrap items-center mt-5">
              {dept && !loadingDept && deptWeather && <CategoryPill cat={flightCategory(deptMetar)} />}
              {arr  && !loadingRoute && routeData   && <CategoryPill cat={flightCategory(arrMetar)} />}
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

      {/* ── Step 1: Weather ── */}
      {(deptWeather || loadingDept || routeData || loadingRoute) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Step 1 — Weather
          </h2>

          {/* Departure + Arrival side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loadingDept ? (
              <div className="bg-surface-card border border-surface-border rounded-lg p-4 text-xs text-slate-500 animate-pulse">
                Fetching METAR + TAF for {dept}…
              </div>
            ) : deptWeather ? (
              <WeatherCard label={`${dept} Departure`} metar={deptMetar} taf={deptTaf} />
            ) : null}

            {loadingRoute ? (
              <div className="bg-surface-card border border-surface-border rounded-lg p-4 text-xs text-slate-500 animate-pulse">
                Fetching arrival weather…
              </div>
            ) : routeData && arr && arr.toUpperCase() !== dept.toUpperCase() ? (
              <WeatherCard label={`${arr} Arrival`} metar={arrMetar ?? null} taf={arrTaf ?? null} />
            ) : null}
          </div>

          {/* Route corridor banner */}
          {routeData && !loadingRoute && (
            <RouteWeatherBanner routeData={routeData} />
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
      {(paxCount > 0 || isTowOp) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Step 2 — Aircraft Risk Assessment
            </h2>
            <span className="text-xs text-slate-500">
              {isTowOp
                ? `${eligibleAircraft.length} tow aircraft`
                : `${eligibleAircraft.length} aircraft with capacity ≥ ${paxCount} pax`}
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
              {[
                { label: 'IFR Capable', list: ifrAircraft, color: 'text-sky-400', icon: '🔵' },
                { label: 'VFR Only',    list: vfrAircraft, color: 'text-slate-400', icon: '⚪' },
              ].map(({ label: groupLabel, list, color: groupColor }) => list.length > 0 && (
                <div key={groupLabel} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${groupColor}`}>{groupLabel}</span>
                    <span className="text-[10px] text-slate-600">{list.length} aircraft</span>
                    <div className="flex-1 border-t border-surface-border" />
                  </div>
                  {list.map((ac) => {
                    // Seed default tow config for gliders
                    if (ac.needs_tow && !towConfigs[ac.id]) {
                      setTimeout(() => setTowConfigs((prev) =>
                        prev[ac.id] ? prev : { ...prev, [ac.id]: { numTows: 1, towHeights: [2000] } }
                      ), 0)
                    }
                    return (
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
                        flightConditions={{ dept, arr, depTime, paxWeights, bagWeightLbs: totalBagLbs, manualFlightHrs }}
                        onSchedule={(picId, sicId, missionType) => handleScheduleFlight(ac, picId, sicId, missionType)}
                        onScheduleReturn={(opts) => handleScheduleReturn(ac, opts)}
                        isScheduled={scheduledMap[ac.id] ?? false}
                        scheduledEta={scheduledEtas[ac.id] ?? null}
                        towConfig={ac.needs_tow ? (towConfigs[ac.id] ?? { numTows: 1, towHeights: [2000] }) : null}
                        onTowChange={ac.needs_tow
                          ? (cfg) => setTowConfigs((prev) => ({ ...prev, [ac.id]: cfg }))
                          : null}
                        allFlights={allFlights}
                        pilotRiskError={pilotRiskError}
                        onRetryPilots={() => fetchPilotRisks(eligibleAircraft, routeData, deptWeather, depTime)}
                        missionType={scheduleMissionType}
                        starRating={stars[ac.tailNumber] || 0}
                        onSetStar={setStar}
                      />
                    )
                  })}
                </div>
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
            Enter departure and arrival airports, passenger count, and (for Part 91) weights
            to see eligible aircraft with live weather and NTSB risk scores.
          </p>
        </div>
      )}
    </div>
  )
}
