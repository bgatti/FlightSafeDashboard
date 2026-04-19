import { useState, useEffect, useRef } from 'react'
import { WeatherBar } from './WeatherBar'
import { getAllFlights, addFlight, updateFlight } from '../store/flights'
import { getSquawks, addSquawk, resolveSquawk, isAircraftGrounded, subscribeSquawks } from '../store/squawks'
import { getInvoices, findOrCreateInvoice, upsertInvoice, addLineItem, markPaid, subscribeInvoices } from '../store/invoices'
import { getClients, upsertClient, findClientByTail, subscribeClients } from '../store/clients'
import { addServiceRequest } from '../store/serviceRequests'
import { mockAircraft } from '../mocks/aircraft'
import { pollAdsbState, estimateGliderReturn } from '../lib/adsbApi'
import { mockPersonnel } from '../mocks/personnel'
import { mockStudents, mockClubMembers } from '../training/mockTraining'
import {
  buildTowSchedule,
  computeTowReservations,
  computePeriodWaits,
  towDeficiencyMin,
  isTowFlight,
  towColorCss,
  fmtTime,
  TOW_SETTINGS,
  TOW_HEIGHTS,
  towCycleMin,
  timeAloftMin,
  buildSegments,
  gaussianSmooth,
  violinPath,
  isInMaintenance,
  squawksToMaintenanceWindows,
  densityAltitude,
  towCycleMinDA,
  towClimbRate,
  planeSegmentFt,
  towPrice,
  gliderTowDemandFactor,
  TOW_PLANE_CLIMB,
  TOW_PLANE_PROFILE,
  SEGMENT_MINUTES,
} from './gliderUtils'
// Mini flight-type icons — clean SVG silhouettes, purpose-built for small card headers
const FiDual = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <circle cx="5" cy="4" r="2" /><path d="M1 12c0-2 2-3.5 4-3.5s4 1.5 4 3.5" />
    <circle cx="11" cy="4" r="2" /><path d="M8 12c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5" opacity="0.5" />
  </svg>
)
const FiSolo = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <circle cx="8" cy="4" r="2.5" /><path d="M3 14c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
  </svg>
)
const FiScenic = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" className={className} fill="currentColor">
    <path d="M0 14 L4 6 L7 10 L10 4 L16 14 Z" opacity="0.7" />
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** useState that persists to sessionStorage — survives tab switches within a session */
function useStickyState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch { return defaultValue }
  })
  const set = (v) => {
    const next = typeof v === 'function' ? v(value) : v
    setValue(next)
    sessionStorage.setItem(key, JSON.stringify(next))
  }
  return [value, set]
}

const AIRPORT = 'KBDU'

// ─── Glider Services Pricing ─────────────────────────────────────────────────
const GLIDER_PRICING = {
  gliderRentalPerHr:  85,    // $ per hour — club glider wet rental
  instructionPerHr:   65,    // $ per hour — dual instruction
}
// towPrice is imported from gliderUtils: $15 hookup + $16 per 1,000 ft

function todayStartMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function fmtPeriodLabel(startMs) {
  return new Date(startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

const WAIT_LABELS = {
  blue:   'No wait',
  green:  '≤5 min',
  yellow: '≤10 min',
  red:    '>10 min',
}

const AVAILABILITY_COLORS = {
  green:  { bar: 'bg-green-500',  text: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10',  label: 'Tow available — 50%+ spare capacity' },
  yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', label: 'Tow tight — at or near capacity' },
  red:    { bar: 'bg-red-500',    text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10',    label: 'Insufficient tow — standby only' },
}

// ─── Violin (butterfly) chart — hourly tow load ───────────────────────────────

const PLANE_PALETTE = [
  { bg: 'bg-violet-500',  hex: '#8b5cf6' },
  { bg: 'bg-emerald-500', hex: '#10b981' },
  { bg: 'bg-orange-400',  hex: '#fb923c' },
]

const DAY_START_HOUR = 7
const NUM_HOURS      = 13   // 07:00–19:00

/** Estimate glider session end time when no explicit arrival is stored. */
function estimateSessionEndMs(f) {
  if (f.plannedArrivalUtc) return new Date(f.plannedArrivalUtc).getTime()
  const heights = f.towInfo?.towHeights ?? []
  const aloftMs = heights.reduce((s, h) => s + timeAloftMin(h) * 60_000, 0)
  return new Date(f.plannedDepartureUtc).getTime() + Math.max(aloftMs, 90 * 60_000)
}

/**
 * @param {object[]} flights
 * @param {object}   [schedCtx] — pilot schedule context for schedule-based supply
 *   { towPilots, planes, baseOverrides, adjustments, noShows }
 */
function buildHourBuckets(flights, schedCtx) {
  const now      = new Date()
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const baseMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAY_START_HOUR, 0, 0, 0).getTime()

  // Demand: tow-cycle minutes placed at departure hour (not queue-resolved)
  const towFlights = flights.filter((f) => isTowFlight(f, AIRPORT))

  // Supply: tow duty blocks — tow plane committed time, keyed by tow plane id
  const dutyBlocks = flights.filter(
    (f) => f.missionType === 'tow_session' || f.part91Type === 'tow_session'
  )

  return Array.from({ length: NUM_HOURS }, (_, i) => {
    const startMs = baseMs + i * 3_600_000
    const endMs   = startMs + 3_600_000
    const hour    = DAY_START_HOUR + i
    const label   = `${String(hour).padStart(2, '0')}`
    let reservedMin = 0
    let standbyMin  = 0
    let supplyMin   = 0
    const byPlane   = {}   // supply minutes per tow-plane id
    let schedSupplyMin = 0 // pilot-schedule-based supply

    // ── Demand (top half) — tow cycle minutes at departure hour ──────────────
    for (const f of towFlights) {
      const depMs = new Date(f.plannedDepartureUtc).getTime()
      if (depMs < startMs || depMs >= endMs) continue
      const heights = f.towInfo?.towHeights ?? [2000]
      const cycleMin = heights.reduce((sum, h) => sum + towCycleMin(h), 0)
      if (f.towInfo?.isStandby) standbyMin  += cycleMin
      else                       reservedMin += cycleMin
    }

    // ── Supply from duty blocks ──────────────────────────────────────────────
    for (const db of dutyBlocks) {
      const dbStart    = new Date(db.plannedDepartureUtc).getTime()
      const dbEnd      = new Date(db.plannedArrivalUtc).getTime()
      const overlapMin = Math.max(0, (Math.min(dbEnd, endMs) - Math.max(dbStart, startMs)) / 60_000)
      if (overlapMin <= 0) continue
      const pid = db.towInfo?.towPlaneId ?? db.tailNumber ?? '_pool'
      byPlane[pid] = (byPlane[pid] ?? 0) + overlapMin
      supplyMin += overlapMin
    }

    // ── Supply from pilot schedule (if context provided) ────────────────────
    // This is the primary supply source — pilots on schedule × airworthy planes
    if (schedCtx) {
      // Shifts: AM 8:00-12:30, PM 12:30-17:00. Hour 7 = before shift, 17+ = after shift
      const block = hour >= 8 && hour < 13 ? 'am' : hour >= 13 && hour < 17 ? 'pm' : null
      if (block) {
        const avail = schedCtx.towPilots.filter((p) =>
          effectiveBlocksForDate(p, today, schedCtx.baseOverrides, schedCtx.adjustments, schedCtx.noShows).has(block)
        )
        const { matched, assignments } = maxPilotPlaneMatching(avail, schedCtx.planes)
        schedSupplyMin = matched * 60

        // Populate byPlane from matched assignments (plane → pilot)
        // Only add if no duty block already covers this plane in this hour
        for (const [planeId] of Object.entries(assignments)) {
          if (!byPlane[planeId]) {
            byPlane[planeId] = 60  // full hour of availability
            supplyMin += 60
          }
        }
      }
    }

    return { startMs, endMs, label, reservedMin, standbyMin, supplyMin, schedSupplyMin, byPlane }
  })
}

// Tow capacity → column background color
// green: supply covers reserved + standby · yellow: covers reserved but not standby · red: insufficient for reserved
function towCapacityBg(h) {
  const totalDemand = h.reservedMin + h.standbyMin
  const supply = Math.max(h.supplyMin, h.schedSupplyMin ?? 0)
  if (totalDemand === 0 && supply === 0) return null
  if (supply >= totalDemand) return 'rgba(34,197,94,0.07)'     // green — surplus
  if (supply >= h.reservedMin) return 'rgba(234,179,8,0.07)'   // yellow — covers reserved only
  return 'rgba(239,68,68,0.07)'                                 // red — deficit
}

function TowViolinChart({ flights, previewFlight = null, schedCtx = null, squawks = [], mxWindows = [], onConfirmStandby = null, date = null, compact = false, wwCountAm: _wwAm, wwCountPm: _wwPm }) {
  const [selectedSeg, setSelectedSeg] = useState(null)
  const [popoverPos, setPopoverPos]   = useState({ x: 0, y: 0 })
  const [selectedPlane, setSelectedPlane] = useState(null)  // planeId for performance card
  const [planeSegIdx, setPlaneSegIdx]     = useState(0)     // which segment was clicked
  const [planePopPos, setPlanePopPos]     = useState({ x: 0, y: 0 })
  const refDate = date ?? new Date()
  const wwCountAm = _wwAm ?? wwCountForBlock(refDate, 'am', getWwBaseOverrides(), getWwAdjustments())
  const wwCountPm = _wwPm ?? wwCountForBlock(refDate, 'pm', getWwBaseOverrides(), getWwAdjustments())

  // Build pilot schedule functions for pilot-constrained supply
  const segSchedCtx = schedCtx ? {
    towPilots: schedCtx.towPilots,
    effectiveBlocksFn: (pilot, date) =>
      effectiveBlocksForDate(pilot, date, schedCtx.baseOverrides, schedCtx.adjustments, schedCtx.noShows),
    matchingFn: maxPilotPlaneMatching,
  } : null

  // Auto-generate maintenance windows from closed grounding squawks (historical unavailability)
  const implicitMx = squawksToMaintenanceWindows(squawks, mockAircraft)
  const allMxWindows = [...mxWindows, ...implicitMx]

  // Build 20-minute segments with maintenance/grounding + pilot awareness
  const segments = buildSegments({
    flights,
    airport: AIRPORT,
    towPlanes: ALL_TOW_AIRCRAFT,
    aircraftList: mockAircraft,
    squawks,
    mxWindows: allMxWindows,
    isGroundedFn: isAircraftGrounded,
    schedCtx: segSchedCtx,
    date: refDate,
  })

  // Extract raw demand arrays by tow type (stacked: pattern → scenic → mountain)
  const rawPattern  = segments.map((s) => s.demandByType.pattern)
  const rawScenic   = segments.map((s) => s.demandByType.scenic)
  const rawMountain = segments.map((s) => s.demandByType.mountain)
  const rawStandby  = segments.map((s) => s.standbyFt)
  const rawDemand   = segments.map((s) => s.reservedFt + s.standbyFt)

  // Per-plane supply arrays
  const planeSupply = {}
  for (const ac of ALL_TOW_AIRCRAFT) {
    planeSupply[ac.id] = segments.map((s) => s.byPlane[ac.id] ?? 0)
  }
  const rawTotalSupply = segments.map((s) =>
    Object.values(s.byPlane).reduce((sum, v) => sum + v, 0)
  )

  // Gaussian smooth: σ = 0.5 segments ≈ 10-minute ramp (single inflection)
  // Monotone cubic hermite spline prevents overshoot/oscillation
  const DEMAND_SIGMA   = 0.5
  const SUPPLY_SIGMA   = 0.5
  const smoothPattern  = gaussianSmooth(rawPattern, DEMAND_SIGMA)
  const smoothScenic   = gaussianSmooth(rawScenic, DEMAND_SIGMA)
  const smoothMountain = gaussianSmooth(rawMountain, DEMAND_SIGMA)
  const smoothStandby  = gaussianSmooth(rawStandby, DEMAND_SIGMA)
  const smoothDemand   = gaussianSmooth(rawDemand, DEMAND_SIGMA)
  const smoothPlane    = {}
  for (const ac of ALL_TOW_AIRCRAFT) {
    smoothPlane[ac.id] = gaussianSmooth(planeSupply[ac.id], SUPPLY_SIGMA)
  }
  const smoothTotalSupply = gaussianSmooth(rawTotalSupply, SUPPLY_SIGMA)

  // Scale
  const maxDemand = Math.max(1, ...smoothDemand)
  const maxSupply = Math.max(1, ...smoothTotalSupply)
  const MAX_MIN   = Math.max(maxDemand, maxSupply, SEGMENT_MINUTES)

  const nowDate = new Date()
  const isToday = refDate.toDateString() === nowDate.toDateString()

  // Grounded aircraft rows — one per grounded or recently-grounded plane
  const groundedRows = (() => {
    const dayBaseMs = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), DAY_START_HOUR, 0, 0, 0).getTime()
    const dayEndMs  = dayBaseMs + NUM_HOURS * 3_600_000
    const rows = []

    // Currently grounded (open squawk) — bar from report time to end of day
    for (const ac of ALL_TOW_AIRCRAFT) {
      if (!isAircraftGrounded(ac.id, mockAircraft, squawks)) continue
      const gSquawk = squawks.find((s) =>
        (s.aircraftId === ac.id || s.tailNumber === ac.tailNumber || s.tail_number === ac.tailNumber) &&
        s.severity === 'grounding' && s.status !== 'closed'
      )
      const reportMs = gSquawk?.reportedAt ? new Date(gSquawk.reportedAt).getTime()
        : gSquawk?.reportedDate ? new Date(gSquawk.reportedDate).getTime() : dayBaseMs
      rows.push({
        tail: ac.tailNumber,
        startFrac: Math.max(0, (reportMs - dayBaseMs) / (dayEndMs - dayBaseMs)),
        endFrac: 1,
        label: 'GROUNDED',
        ongoing: true,
      })
    }

    // Resolved today (closed grounding squawk with implicit mx window) — bar from report to resolve
    for (const w of allMxWindows) {
      if (w.endMs <= dayBaseMs || w.startMs >= dayEndMs) continue
      const ac = ALL_TOW_AIRCRAFT.find((a) => a.id === w.aircraftId)
      if (!ac || isAircraftGrounded(ac.id, mockAircraft, squawks)) continue  // skip still-grounded (already shown)
      rows.push({
        tail: ac.tailNumber,
        startFrac: Math.max(0, (w.startMs - dayBaseMs) / (dayEndMs - dayBaseMs)),
        endFrac: Math.min(1, (w.endMs - dayBaseMs) / (dayEndMs - dayBaseMs)),
        label: w.reason?.slice(0, 25) ?? 'WAS GROUNDED',
        ongoing: false,
      })
    }
    return rows
  })()

  // Chart dimensions — scaled by mode
  // Compact: narrower SVG so curves fill more vertical space at the same rendered height
  const SVG_W      = compact ? 400 : 800
  const LABEL_COL  = compact ? 12 : 40
  const CHART_W    = SVG_W - LABEL_COL
  const SECTION_H  = compact ? 80 : 65
  const CENTRE_H   = compact ? 6 : 18
  const WW_H       = compact ? 0 : 28
  const GND_ROW_H  = compact ? 0 : 18
  const GND_H      = compact ? 0 : groundedRows.length * GND_ROW_H
  const SVG_H      = SECTION_H * 2 + CENTRE_H + WW_H + GND_H

  const n = segments.length

  // NOW line
  const nowMinutes  = (nowDate.getHours() - DAY_START_HOUR) * 60 + nowDate.getMinutes()
  const totalMinutes = NUM_HOURS * 60
  const nowFrac     = nowMinutes / totalMinutes
  const showNow     = isToday && nowFrac >= 0 && nowFrac <= 1
  const nowX        = LABEL_COL + nowFrac * CHART_W

  // Hour tick positions
  const hourTicks = Array.from({ length: NUM_HOURS + 1 }, (_, i) => ({
    x: LABEL_COL + (i * 60 / totalMinutes) * CHART_W,
    label: `${String(DAY_START_HOUR + i).padStart(2, '0')}`,
  }))

  // Demand type colours
  const DEMAND_TYPES = [
    { key: 'pattern',  smooth: smoothPattern,  fill: 'rgba(56,189,248,0.6)',  label: 'Pattern (≤1k ft)' },
    { key: 'scenic',   smooth: smoothScenic,   fill: 'rgba(139,92,246,0.55)', label: 'Scenic (2k ft)' },
    { key: 'mountain', smooth: smoothMountain, fill: 'rgba(244,63,94,0.55)',  label: 'Mountain (≥3k ft)' },
  ]

  // Build stacked demand paths (pattern on bottom, mountain on top)
  const centreY = SECTION_H

  /** Monotone cubic hermite spline path — no overshoot/oscillation */
  function monotonePath(pts) {
    if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x} ${pts[0].y}` : ''
    // Compute tangent slopes with Fritsch-Carlson monotone method
    const m = new Array(pts.length).fill(0)
    const delta = []
    for (let i = 0; i < pts.length - 1; i++) {
      delta.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x))
    }
    m[0] = delta[0]
    m[pts.length - 1] = delta[delta.length - 1]
    for (let i = 1; i < pts.length - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) { m[i] = 0 }
      else { m[i] = (delta[i - 1] + delta[i]) / 2 }
    }
    // Clamp to monotone
    for (let i = 0; i < delta.length; i++) {
      if (Math.abs(delta[i]) < 1e-10) { m[i] = 0; m[i + 1] = 0; continue }
      const a = m[i] / delta[i], b = m[i + 1] / delta[i]
      const s = a * a + b * b
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * delta[i]; m[i + 1] = t * b * delta[i] }
    }
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = (pts[i + 1].x - pts[i].x) / 3
      d += ` C ${pts[i].x + dx} ${pts[i].y + m[i] * dx}, ${pts[i + 1].x - dx} ${pts[i + 1].y - m[i + 1] * dx}, ${pts[i + 1].x} ${pts[i + 1].y}`
    }
    return d
  }

  function smoothCurvePath(values, baseValues) {
    if (n === 0) return ''
    const dx = CHART_W / n
    const topPts = values.map((v, i) => ({
      x: LABEL_COL + i * dx + dx / 2,
      y: centreY - (v / MAX_MIN) * SECTION_H,
    }))
    const botPts = baseValues.map((v, i) => ({
      x: LABEL_COL + i * dx + dx / 2,
      y: centreY - (v / MAX_MIN) * SECTION_H,
    }))

    // Forward along top, then back along bottom
    const fwd = monotonePath(topPts)
    const rev = [...botPts].reverse()
    const revPath = monotonePath(rev)

    // Combine: forward path + line to last bottom point + reversed bottom path + close
    return fwd + ` L ${rev[0].x} ${rev[0].y} ` + revPath.replace(/^M [^ ]+ [^ ]+/, '') + ' Z'
  }

  // Stacked cumulative: pattern, +scenic, +mountain
  const cumBase     = new Array(n).fill(0)
  const cumPattern  = smoothPattern.map((v, i) => cumBase[i] + v)
  const cumScenic   = smoothScenic.map((v, i) => cumPattern[i] + v)
  const cumMountain = smoothMountain.map((v, i) => cumScenic[i] + v)

  const demandPaths = [
    { ...DEMAND_TYPES[0], d: smoothCurvePath(cumPattern, cumBase) },
    { ...DEMAND_TYPES[1], d: smoothCurvePath(cumScenic, cumPattern) },
    { ...DEMAND_TYPES[2], d: smoothCurvePath(cumMountain, cumScenic) },
  ]

  // Standby overlay on top of the stack
  const cumWithStandby = smoothStandby.map((v, i) => cumMountain[i] + v)
  const standbyPath = smoothCurvePath(cumWithStandby, cumMountain)

  // Supply paths per plane (bottom, growing downward from centre)
  const supplyBase = centreY + CENTRE_H
  // Per-plane cumulative bands (for label y-positioning)
  const planeBands = {}  // planeId → { midY: number[] } — vertical midpoint per segment
  const planePathData = (() => {
    const cumulative = new Array(n).fill(0)
    const dx = CHART_W / n
    return ALL_TOW_AIRCRAFT.map((ac, pi) => {
      const prevCum = [...cumulative]
      const thisCum = smoothPlane[ac.id].map((v, i) => {
        cumulative[i] += v
        return cumulative[i]
      })

      const topPts = thisCum.map((v, i) => ({
        x: LABEL_COL + i * dx + dx / 2,
        y: supplyBase + (v / MAX_MIN) * SECTION_H,
      }))
      const botPts = prevCum.map((v, i) => ({
        x: LABEL_COL + i * dx + dx / 2,
        y: supplyBase + (v / MAX_MIN) * SECTION_H,
      }))

      // Store band midpoints for label positioning
      planeBands[ac.id] = topPts.map((tp, i) => (tp.y + botPts[i].y) / 2)

      const fwd = monotonePath(topPts)
      const rev = [...botPts].reverse()
      const revPath = monotonePath(rev)
      const d = fwd + ` L ${rev[0].x} ${rev[0].y} ` + revPath.replace(/^M [^ ]+ [^ ]+/, '') + ' Z'
      return { ac, pi, d }
    })
  })()

  // Maintenance window rects on the supply side
  const mxRects = allMxWindows.map((w) => {
    const dayBaseMs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), DAY_START_HOUR, 0, 0, 0).getTime()
    const dayEndMs  = dayBaseMs + NUM_HOURS * 3_600_000
    if (w.endMs <= dayBaseMs || w.startMs >= dayEndMs) return null
    const x1 = LABEL_COL + Math.max(0, (w.startMs - dayBaseMs) / (totalMinutes * 60_000)) * CHART_W
    const x2 = LABEL_COL + Math.min(1, (w.endMs - dayBaseMs) / (totalMinutes * 60_000)) * CHART_W
    const acIdx = ALL_TOW_AIRCRAFT.findIndex((a) => a.id === w.aircraftId)
    return { x: x1, width: x2 - x1, reason: w.reason ?? 'Maintenance', tail: ALL_TOW_AIRCRAFT[acIdx]?.tailNumber ?? '?' }
  }).filter(Boolean)

  // Capacity background bands (per-segment)
  const capacityBands = (() => {
    const dx = CHART_W / n
    return segments.map((seg, i) => {
      const totalDemand = seg.reservedFt + seg.standbyFt
      const supply = Object.values(seg.byPlane).reduce((s, v) => s + v, 0)
      if (totalDemand === 0 && supply === 0) return null
      let fill
      if (supply >= totalDemand) fill = 'rgba(34,197,94,0.06)'
      else if (supply >= seg.reservedFt) fill = 'rgba(234,179,8,0.06)'
      else fill = 'rgba(239,68,68,0.06)'
      return { x: LABEL_COL + i * dx, width: dx, fill }
    }).filter(Boolean)
  })()

  // Tow pilot + aircraft assignment labels (deduped — only where they change)
  const assignmentLabels = (() => {
    const schedule = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, ALL_TOW_AIRCRAFT.filter((a) => !isAircraftGrounded(a.id, mockAircraft, squawks)), allMxWindows)
    if (schedule.length === 0) return []
    const sorted = [...schedule].sort((a, b) => a.actualStartMs - b.actualStartMs)

    const dayBaseMs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), DAY_START_HOUR, 0, 0, 0).getTime()
    const labels = []
    let lastKey = null
    for (const ev of sorted) {
      const plane = mockAircraft.find((a) => a.id === ev.assignedPlaneId)
      const fullName = ev.flight.towInfo?.towPilotName ?? ev.flight.pic ?? ''
      const pilot = fullName.split(/[, ]+/)[0]?.split(' ')[0] || ''
      const tail  = plane?.tailNumber ?? '?'
      const key   = `${tail}|${pilot}`
      if (key !== lastKey) {
        const frac = (ev.actualStartMs - dayBaseMs) / (totalMinutes * 60_000)
        if (frac >= 0 && frac <= 1) {
          labels.push({ x: LABEL_COL + frac * CHART_W, tail, pilot, key })
        }
        lastKey = key
      }
    }
    return labels
  })()

  // Supply band labels — each pilot-plane pair is tracked independently.
  // A label is only printed when THAT pair first appears, not when other pairs change.
  const pilotLabels = (() => {
    const dx = CHART_W / n
    const labels = []
    const lastSeen = {}  // planeId → "pilotName" last printed

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const availIds = seg.availablePlaneIds
      if (availIds.length === 0) continue

      // Build pilot map from assignments
      const pilotMap = {}
      for (const a of (seg.pilotAssignments ?? [])) {
        pilotMap[a.planeId] = a.pilotName.split(' ')[0]
      }

      // Check each plane independently — only label if THIS plane's state changed
      let cumVal = 0
      for (const pid of availIds) {
        const ac = ALL_TOW_AIRCRAFT.find((a) => a.id === pid)
        if (!ac) continue
        const val = seg.byPlane[pid] ?? 0
        const bottomY = supplyBase + (cumVal / MAX_MIN) * SECTION_H
        cumVal += val
        const topY = supplyBase + (cumVal / MAX_MIN) * SECTION_H

        const pilot = pilotMap[pid] ?? ''
        const key = `${pid}:${pilot}`
        if (key === lastSeen[pid]) continue  // no change for THIS plane
        lastSeen[pid] = key

        if (topY - bottomY < 3) continue
        const midY = (bottomY + topY) / 2
        labels.push({
          x: LABEL_COL + i * dx + dx / 2,
          y: midY,
          text: pilot ? `${pilot} ${ac.tailNumber}` : ac.tailNumber,
          planeId: pid,
          segIdx: i,
        })
      }
    }
    return labels
  })()

  // Wing walker names resolved per-segment via schedule (using wwEffectiveBlocks)
  const wwBaseOvLocal = getWwBaseOverrides()
  const wwAdjLocal    = getWwAdjustments()
  const allWingWalkers = mockPersonnel.filter((p) => p.wingWalker)

  /** Get scheduled wing walker names for a segment */
  function wwNamesForSegment(seg) {
    const segDate = new Date(seg.startMs)
    const hourFrac = segDate.getHours() + segDate.getMinutes() / 60
    const block = hourFrac >= 8 && hourFrac < 12.5 ? 'am' : hourFrac >= 12.5 && hourFrac < 17 ? 'pm' : null
    if (!block) return []
    return allWingWalkers
      .filter((ww) => wwEffectiveBlocks(ww, segDate, wwBaseOvLocal, wwAdjLocal).has(block))
      .map((ww) => ww.name.split(' ')[0])
  }

  // Wing walker data per segment: count + names
  const wwData = segments.map((seg) => {
    const names = wwNamesForSegment(seg)
    return { count: names.length, names }
  })
  const maxWw = Math.max(...wwData.map((w) => w.count), 1)

  // Wing walker labels (individual, deduped — show each name at staggered heights)
  const wwLabels = (() => {
    const dx = CHART_W / n
    const labels = []
    let lastKey = null
    for (let i = 0; i < wwData.length; i++) {
      const key = wwData[i].names.sort().join(',')
      if (key !== lastKey) {
        wwData[i].names.forEach((name, j) => {
          labels.push({
            x: LABEL_COL + i * dx + dx / 2,
            name,
            rank: j,  // for vertical staggering
          })
        })
        lastKey = key
      }
    }
    return labels
  })()

  // Clickable standby segments
  const standbySegments = segments
    .map((seg, i) => seg.standbyFlights.length > 0 ? { idx: i, flights: seg.standbyFlights, startMs: seg.startMs } : null)
    .filter(Boolean)

  const empty = segments.every((s) => s.reservedFt === 0 && s.standbyFt === 0 && Object.keys(s.byPlane).length === 0)

  // Date label for compact mode
  const dayLabel = refDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="flex flex-col gap-3">
      {/* Header + legend */}
      {!compact && <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Tow Load
        </span>
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'rgba(56,189,248,0.6)' }} />Pattern
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'rgba(139,92,246,0.55)' }} />Scenic
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: 'rgba(244,63,94,0.55)' }} />Mountain
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-yellow-400/80 inline-block" />Standby
          </span>
        </div>
      </div>}

      {/* Compact date label */}
      {compact && (
        <div className="text-xs text-slate-300 font-semibold text-center truncate">
          {dayLabel}
        </div>
      )}

      {/* SVG violin chart */}
      <div className="relative"
        onKeyDown={(e) => { if (e.key === 'Escape') setSelectedSeg(null) }}
        tabIndex={-1}
      >
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        style={{ minHeight: compact ? 120 : 160 }}
        preserveAspectRatio="xMidYMid meet"
        onClick={(e) => {
          // Click on empty area dismisses popover
          if (e.target.tagName === 'svg') setSelectedSeg(null)
        }}
      >
        {/* Capacity background bands */}
        {capacityBands.map((b, i) => (
          <rect key={i} x={b.x} y={0} width={b.width} height={SECTION_H * 2 + CENTRE_H} fill={b.fill} />
        ))}

        {/* Hour grid lines */}
        {compact
          ? (() => {
              // Compact: just a single light vertical line at noon
              const noonHour = 12
              const noonX = LABEL_COL + ((noonHour - DAY_START_HOUR) * 60 / totalMinutes) * CHART_W
              return <line x1={noonX} y1={0} x2={noonX} y2={SVG_H} stroke="rgba(148,163,184,0.15)" strokeWidth={0.5} />
            })()
          : hourTicks.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={0} x2={t.x} y2={SVG_H} stroke="rgba(148,163,184,0.15)" strokeWidth={0.5} />
                <text x={t.x} y={centreY + CENTRE_H / 2 + 3} textAnchor="middle"
                  className="fill-slate-500" style={{ fontSize: 9 }}>
                  {t.label}
                </text>
              </g>
            ))
        }

        {/* Centre line */}
        <line x1={LABEL_COL} y1={centreY} x2={SVG_W} y2={centreY} stroke="rgba(148,163,184,0.3)" strokeWidth={0.5} />
        <line x1={LABEL_COL} y1={supplyBase} x2={SVG_W} y2={supplyBase} stroke="rgba(148,163,184,0.3)" strokeWidth={0.5} />

        {/* Half-height guidelines */}
        <line x1={LABEL_COL} y1={centreY - SECTION_H / 2} x2={SVG_W} y2={centreY - SECTION_H / 2}
          stroke="rgba(148,163,184,0.08)" strokeWidth={0.5} strokeDasharray="4 4" />
        <line x1={LABEL_COL} y1={supplyBase + SECTION_H / 2} x2={SVG_W} y2={supplyBase + SECTION_H / 2}
          stroke="rgba(148,163,184,0.08)" strokeWidth={0.5} strokeDasharray="4 4" />

        {/* Demand violin — stacked by tow type: pattern (blue), scenic (violet), mountain (rose) */}
        {demandPaths.map((dp) => dp.d && <path key={dp.key} d={dp.d} fill={dp.fill} />)}
        {/* Standby overlay (yellow, on top of reserved stack) */}
        {standbyPath && <path d={standbyPath} fill="rgba(234,179,8,0.35)" />}

        {/* Demand segment hit zones — click to show reservation cards (full mode only) */}
        {!compact && segments.map((seg, i) => {
          const dx = CHART_W / n
          const x  = LABEL_COL + i * dx
          const df = seg.demandFlights ?? []
          if (df.length === 0) return null
          return (
            <rect
              key={`dem-${i}`}
              x={x} y={0} width={dx} height={centreY}
              fill={selectedSeg === i ? 'rgba(56,189,248,0.08)' : 'transparent'}
              className="cursor-pointer"
              onClick={(e) => {
                if (selectedSeg === i) { setSelectedSeg(null); return }
                const rect = e.currentTarget.closest('svg').getBoundingClientRect()
                setPopoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                setSelectedSeg(i)
              }}
            />
          )
        })}

        {/* Supply violin — stacked per plane (skip grounded), clickable for performance card */}
        {planePathData.map(({ ac, pi, d }) => {
          const grounded = isAircraftGrounded(ac.id, mockAircraft, squawks)
          if (grounded) return null
          return <path key={ac.id} d={d}
            fill={PLANE_PALETTE[pi % PLANE_PALETTE.length].hex} opacity={0.6}
            className={compact ? '' : 'cursor-pointer'}
            onClick={compact ? undefined : (e) => {
              e.stopPropagation()
              const svg = e.currentTarget.closest('svg')
              const rect = svg.getBoundingClientRect()
              const svgX = (e.clientX - rect.left) / rect.width * SVG_W
              const segIdx = Math.floor((svgX - LABEL_COL) / (CHART_W / n))
              setPlanePopPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
              setPlaneSegIdx(Math.max(0, Math.min(n - 1, segIdx)))
              setSelectedPlane(selectedPlane === ac.id ? null : ac.id)
              setSelectedSeg(null)
            }}
          />
        })}

        {/* Refuelling indicators — gas pump icon where a plane is offline */}
        {!compact && (() => {
          const dx = CHART_W / n
          const icons = []
          for (let si = 0; si < segments.length; si++) {
            const seg = segments[si]
            for (const pid of seg.availablePlaneIds) {
              const fs = seg.planeFuel?.[pid]
              if (!fs?.refuelling) continue
              const x = LABEL_COL + si * dx + dx / 2
              icons.push(
                <g key={`fuel-${pid}-${si}`} transform={`translate(${x - 5}, ${supplyBase + 2})`}>
                  {/* Gas pump icon */}
                  <rect x={1} y={2} width={6} height={7} rx={0.5} fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="0.6" />
                  <rect x={2} y={3} width={4} height={2.5} rx={0.3} fill="rgba(59,130,246,0.4)" />
                  <path d="M7 3.5 L8.5 2.5 L8.5 6 L7 5.5" fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="0.5" />
                  <line x1={3} y1={1} x2={5} y2={1} stroke="rgba(59,130,246,0.5)" strokeWidth="0.6" />
                  <text x={4.5} y={14} textAnchor="middle"
                    className="fill-sky-400" style={{ fontSize: 5 }}>
                    {mockAircraft.find((a) => a.id === pid)?.tailNumber?.slice(-4) ?? ''}
                  </text>
                </g>
              )
            }
          }
          return icons
        })()}

        {/* Pilot + plane labels inside each plane's colored supply band — clickable */}
        {pilotLabels.map((lbl, i) => (
          <text key={`pilot-${i}`} x={lbl.x + 3} y={lbl.y}
            className="fill-white cursor-pointer"
            style={{ fontSize: compact ? 12 : 7.5, fontFamily: 'inherit', fontWeight: 600 }}
            dominantBaseline="middle"
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.closest('svg').getBoundingClientRect()
              setPlanePopPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
              setPlaneSegIdx(lbl.segIdx ?? 0)
              setSelectedPlane(selectedPlane === lbl.planeId ? null : lbl.planeId)
              setSelectedSeg(null)
            }}>
            {lbl.text}
          </text>
        ))}

        {/* NOW line */}
        {showNow && (
          <g>
            <line x1={nowX} y1={0} x2={nowX} y2={SVG_H} stroke="rgba(251,191,36,0.9)" strokeWidth={1.5} />
            <text x={nowX + 2} y={8} className="fill-yellow-400" style={{ fontSize: 6.5, fontWeight: 600 }}>
              now
            </text>
          </g>
        )}

        {/* Section labels */}
        {!compact && <>
          <text x={4} y={centreY / 2 + 3} className="fill-slate-500"
            style={{ fontSize: 7.5, fontWeight: 600 }}>Demand</text>
          <text x={4} y={supplyBase + SECTION_H / 2 + 3} className="fill-slate-500"
            style={{ fontSize: 7.5, fontWeight: 600 }}>Supply</text>
        </>}
        {/* Scale — ft/min (segment totals ÷ segment minutes) */}
        {!compact && (() => {
          const ftPerMin = Math.round(MAX_MIN / SEGMENT_MINUTES)
          return <>
            <text x={LABEL_COL - 2} y={8} textAnchor="end" className="fill-slate-600" style={{ fontSize: 7 }}>
              {ftPerMin} ft/m
            </text>
            <text x={LABEL_COL - 2} y={SECTION_H * 2 + CENTRE_H - 2} textAnchor="end" className="fill-slate-600" style={{ fontSize: 7 }}>
              {ftPerMin} ft/m
            </text>
          </>
        })()}

        {/* Wing walker row — smoothed violin + deduped name labels (full mode only) */}
        {!compact && (() => {
          const dx = CHART_W / n
          const wwY = SECTION_H * 2 + CENTRE_H  // fixed position: right after supply section
          // Smooth the wing walker counts the same way as other curves
          const rawWw = wwData.map((w) => w.count)
          const smoothWw = gaussianSmooth(rawWw, DEMAND_SIGMA)
          // Build monotone path for WW violin (grows downward from top of WW row)
          const wwPts = smoothWw.map((v, i) => ({
            x: LABEL_COL + i * dx + dx / 2,
            y: wwY + (v / maxWw) * WW_H,
          }))
          const wwBasePts = smoothWw.map((_, i) => ({
            x: LABEL_COL + i * dx + dx / 2,
            y: wwY,
          }))
          const wwFwd = monotonePath(wwPts)
          const wwRev = [...wwBasePts].reverse()
          const wwRevPath = monotonePath(wwRev)
          const wwPath = wwPts.length >= 2
            ? wwFwd + ` L ${wwRev[0].x} ${wwRev[0].y} ` + wwRevPath.replace(/^M [^ ]+ [^ ]+/, '') + ' Z'
            : ''

          return (
            <g>
              <line x1={LABEL_COL} y1={wwY} x2={SVG_W} y2={wwY} stroke="rgba(148,163,184,0.2)" strokeWidth={0.5} />
              <text x={LABEL_COL - 4} y={wwY + WW_H / 2 + 3} textAnchor="end"
                className="fill-slate-500" style={{ fontSize: 7, fontWeight: 600 }}>
                Wing Walk
              </text>
              {wwPath && <path d={wwPath} fill="rgba(148,163,184,0.25)" />}
              {/* Wing walker name labels (individual, staggered) */}
              {wwLabels.map((lbl, i) => (
                <text key={`ww-${i}`} x={lbl.x + 2} y={wwY + 9 + lbl.rank * 8}
                  className="fill-slate-400"
                  style={{ fontSize: 7, fontFamily: 'inherit' }}>
                  {lbl.name}
                </text>
              ))}
            </g>
          )
        })()}

        {/* Grounded / was-grounded rows — below wing walkers (full mode only) */}
        {!compact && groundedRows.map((row, ri) => {
          const rowY = SVG_H - GND_H + ri * GND_ROW_H
          const x1 = LABEL_COL + row.startFrac * CHART_W
          const x2 = LABEL_COL + row.endFrac * CHART_W
          const barW = Math.max(2, x2 - x1)
          return (
            <g key={`gnd-${ri}`}>
              {ri === 0 && (
                <line x1={LABEL_COL} y1={rowY} x2={SVG_W} y2={rowY}
                  stroke="rgba(239,68,68,0.2)" strokeWidth={0.5} />
              )}
              <text x={LABEL_COL - 4} y={rowY + GND_ROW_H / 2 + 3} textAnchor="end"
                className="fill-red-400" style={{ fontSize: 7.5, fontFamily: 'inherit', fontWeight: 600 }}>
                {row.tail}
              </text>
              <rect x={x1} y={rowY + 2} width={barW} height={GND_ROW_H - 4}
                rx={2}
                fill={row.ongoing ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.12)'}
                stroke={row.ongoing ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.35)'}
                strokeWidth={0.5}
                strokeDasharray={row.ongoing ? undefined : '3 2'}
              />
              <text x={x1 + 4} y={rowY + GND_ROW_H / 2 + 3}
                className={row.ongoing ? 'fill-red-300' : 'fill-red-400/60'}
                style={{ fontSize: 7, fontFamily: 'inherit', fontWeight: 500 }}>
                {row.label}
              </text>
              {row.startFrac > 0.01 && (
                <text x={x1 + 1} y={rowY + GND_ROW_H - 1}
                  className="fill-red-500/40" style={{ fontSize: 6 }}>
                  {new Date(new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), DAY_START_HOUR).getTime() + row.startFrac * NUM_HOURS * 3_600_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </text>
              )}
              {row.endFrac < 0.99 && (
                <text x={x2 - 1} y={rowY + GND_ROW_H - 1} textAnchor="end"
                  className="fill-red-500/40" style={{ fontSize: 6 }}>
                  {new Date(new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), DAY_START_HOUR).getTime() + row.endFrac * NUM_HOURS * 3_600_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Click-outside backdrop to dismiss popovers (full mode only) */}
      {!compact && (selectedSeg !== null || selectedPlane) && (
        <div className="fixed inset-0 z-10" onClick={() => { setSelectedSeg(null); setSelectedPlane(null) }} />
      )}

      {/* Floating tow plane performance card */}
      {!compact && selectedPlane && (() => {
        const ac = mockAircraft.find((a) => a.id === selectedPlane)
        const prof = TOW_PLANE_PROFILE[selectedPlane]
        if (!ac || !prof) return null
        // Use the clicked segment for context
        const clickedSeg = segments[planeSegIdx] ?? segments[0]
        const segTime = clickedSeg?.label ?? ''
        // Find pilot assigned to this plane
        const pilotAssign = clickedSeg?.pilotAssignments?.find((a) => a.planeId === selectedPlane)
          ?? segments.find((s) => s.pilotAssignments?.some((a) => a.planeId === selectedPlane))?.pilotAssignments?.find((a) => a.planeId === selectedPlane)
        const pilotObj = pilotAssign ? mockPersonnel.find((p) => p.name === pilotAssign.pilotName) : null
        // Fuel state at clicked segment
        const fs = clickedSeg?.planeFuel?.[selectedPlane]
        // DA — use a rough estimate (15°C at field elev = ISA, adjust if weather available)
        const estDA = TOW_SETTINGS.fieldElevFt + 1500  // typical summer DA offset at KBDU
        const climbISA = towClimbRate(selectedPlane)
        const climbDA  = towClimbRate(selectedPlane, estDA, fs?.fuelGal)
        const fuelPct  = fs?.fuelPct ?? 100
        const enduranceHr = (prof.fuelCapGal / prof.fuelBurnGalHr).toFixed(1)
        const fuelWeightLbs = Math.round((fs?.fuelGal ?? prof.fuelCapGal) * TOW_SETTINGS.fuelWeightLbsPerGal)
        const pilotWt = prof.pilotWeightLbs
        const totalWt = prof.emptyWeightLbs + pilotWt + fuelWeightLbs
        // Default glider (2-33A dual)
        const defGliderWt = 575 + 170 + 170  // empty + pilot + instructor
        const segFtISA = planeSegmentFt(selectedPlane)
        const segFtDA  = planeSegmentFt(selectedPlane, estDA, TOW_SETTINGS, fs?.fuelGal)

        return (
          <div
            className="absolute z-30 w-80 rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-sm shadow-xl p-4 flex flex-col gap-3"
            style={{ left: planePopPos.x, top: planePopPos.y }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-200">{ac.tailNumber} — {ac.makeModel}</div>
                <div className="text-[10px] text-slate-400">
                  {pilotObj ? pilotObj.name : 'No pilot assigned'}{segTime ? ` · ${segTime}` : ''}
                </div>
              </div>
              <button onClick={() => setSelectedPlane(null)}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-1">x</button>
            </div>

            {/* Weight breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <span className="text-slate-500">Empty weight</span>
              <span className="text-slate-300 text-right">{prof.emptyWeightLbs.toLocaleString()} lbs</span>
              <span className="text-slate-500">Pilot</span>
              <span className="text-slate-300 text-right">{pilotWt} lbs</span>
              <span className="text-slate-500">Fuel ({fuelPct}%)</span>
              <span className="text-slate-300 text-right">{fuelWeightLbs} lbs</span>
              <span className="text-slate-500 font-semibold border-t border-slate-700/40 pt-1">Tow plane total</span>
              <span className="text-slate-200 font-semibold text-right border-t border-slate-700/40 pt-1">{totalWt.toLocaleString()} lbs</span>
              <span className="text-slate-500">Default glider (2-33A dual)</span>
              <span className="text-slate-300 text-right">{defGliderWt} lbs</span>
              <span className="text-slate-500 font-semibold">Combined on tow</span>
              <span className="text-slate-200 font-semibold text-right">{(totalWt + defGliderWt).toLocaleString()} lbs</span>
            </div>

            {/* Fuel bar */}
            <div className="flex items-center gap-2">
              <svg width={14} height={14} viewBox="0 0 12 12" className="text-sky-400 flex-shrink-0">
                <rect x={1} y={2.5} width={6} height={7} rx={0.7} fill="none" stroke="currentColor" strokeWidth="0.8" />
                <rect x={2} y={3.5} width={4} height={2.5} rx={0.3} fill="currentColor" opacity="0.4" />
                <path d="M7 4 L9 3 L9 7 L7 6.5" fill="none" stroke="currentColor" strokeWidth="0.6" />
                <line x1={3} y1={1.5} x2={5} y2={1.5} stroke="currentColor" strokeWidth="0.8" />
              </svg>
              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${fuelPct > 30 ? 'bg-sky-500' : fuelPct > 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${fuelPct}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 w-12 text-right">{prof.fuelCapGal} gal</span>
            </div>
            <div className="text-[10px] text-slate-500">
              {prof.fuelBurnGalHr} gal/hr · {enduranceHr} hr endurance · refuel {TOW_SETTINGS.refuelTimeMin} min
            </div>

            {/* Performance */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] border-t border-slate-700/40 pt-2">
              <span className="text-slate-500">Climb rate (ISA)</span>
              <span className="text-slate-300 text-right">{climbISA} ft/min</span>
              <span className="text-slate-500">Climb rate (DA {estDA.toLocaleString()})</span>
              <span className="text-slate-300 text-right">{climbDA} ft/min</span>
              <span className="text-slate-500">Capacity/segment (ISA)</span>
              <span className="text-slate-300 text-right">{segFtISA.toLocaleString()} ft</span>
              <span className="text-slate-500">Capacity/segment (DA)</span>
              <span className={`text-right font-semibold ${segFtDA < segFtISA * 0.8 ? 'text-yellow-400' : 'text-slate-200'}`}>
                {segFtDA.toLocaleString()} ft
              </span>
              <span className="text-slate-500">Max gross</span>
              <span className="text-slate-300 text-right">{prof.maxGrossLbs.toLocaleString()} lbs</span>
            </div>

            {/* Tow time to altitude — with default glider at current DA */}
            <div className="border-t border-slate-700/40 pt-2">
              <div className="text-[10px] text-slate-500 mb-1.5">
                Time to altitude (DA {estDA.toLocaleString()} ft · 2-33A dual {defGliderWt} lbs)
              </div>
              <div className="flex gap-2">
                {[1000, 2000, 3000, 4000].map((ht) => {
                  const mins = (ht / climbDA).toFixed(1)
                  const price = towPrice(ht)
                  return (
                    <div key={ht} className="flex-1 text-center rounded bg-slate-800/60 border border-slate-700/30 px-1 py-1.5">
                      <div className="text-[10px] text-slate-400">{ht / 1000}k ft</div>
                      <div className="text-xs text-slate-200 font-semibold">{mins} min</div>
                      <div className="text-[9px] text-green-400/70">${price}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Floating flight cards at click position — reuses full FlightCard with billing */}
      {!compact && selectedSeg !== null && (() => {
        const seg = segments[selectedSeg]
        const df = seg?.demandFlights ?? []
        if (df.length === 0) return null
        return (
            <div
              className="absolute z-30 w-[420px] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-sm shadow-xl p-3 flex flex-col gap-2"
              style={{ left: popoverPos.x, top: popoverPos.y }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                  {seg.label} — {df.length} reservation{df.length !== 1 ? 's' : ''}
                </span>
                <button onClick={() => setSelectedSeg(null)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 px-1">
                  x
                </button>
              </div>
              {df.map((f) => (
                <FlightCard key={f.id} f={f} />
              ))}
            </div>
        )
      })()}
      </div>


      {!compact && empty && (
        <p className="text-[10px] text-slate-600 italic -mt-1">
          Add reservations to populate the load chart.
        </p>
      )}
    </div>
  )
}

// ─── Gantt chart ──────────────────────────────────────────────────────────────

// Status-based colors: reserved, standby, billed
const GANTT_STATUS = {
  reserved: { bar: 'bg-sky-500',    text: 'text-white',      border: 'border-sky-400' },
  standby:  { bar: 'bg-yellow-400', text: 'text-slate-900',  border: 'border-yellow-300' },
  billed:   { bar: 'bg-green-500',  text: 'text-white',      border: 'border-green-400' },
}

function evStatus(ev) {
  if (ev.flight.status === 'billed')          return 'billed'
  if (ev.flight.towInfo?.isStandby)           return 'standby'
  return 'reserved'
}

function evDelay(ev) {
  if (ev.towIndex !== 0) return 0
  return Math.max(0, Math.round((ev.actualStartMs - ev.requestedMs) / 60_000))
}

const LABEL_W = 112   // px — fixed left label column
const ROW_H   = 30    // px — row height

function TowGantt({ flights, squawks = [], mxWindows = [] }) {
  const [view, setView] = useStickyState('glider_ganttView', 'daily')  // daily | weekly | monthly
  const [selectedFlight, setSelectedFlight] = useState(null)
  const [ganttPopPos, setGanttPopPos] = useState({ x: 0, y: 0 })

  // Time-aware grounding: convert closed grounding squawks to maintenance windows
  const implicitMx = squawksToMaintenanceWindows(squawks, mockAircraft)
  const allMx = [...mxWindows, ...implicitMx]

  const availablePlanes = ALL_TOW_AIRCRAFT.filter((a) => !isAircraftGrounded(a.id, mockAircraft, squawks))
  const groundedPlanes  = ALL_TOW_AIRCRAFT.filter((a) => isAircraftGrounded(a.id, mockAircraft, squawks))
  const schedule = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, availablePlanes.length > 0 ? availablePlanes : undefined, allMx)

  const now   = Date.now()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── Time window by view ────────────────────────────────────────────────
  let windowStart, windowEnd, tickInterval, tickFmt
  if (view === 'daily') {
    windowStart = new Date(today).setHours(DAY_START_HOUR, 0, 0, 0)
    windowEnd   = windowStart + NUM_HOURS * 3_600_000
    tickInterval = 30 * 60_000       // 30 min
    tickFmt = (d) => fmtTime(d)
  } else if (view === 'weekly') {
    const dayOfWeek = (today.getDay() + 6) % 7
    const monday = new Date(today.getTime() - dayOfWeek * 86_400_000)
    monday.setHours(DAY_START_HOUR, 0, 0, 0)
    windowStart = monday.getTime()
    windowEnd   = windowStart + 7 * 24 * 3_600_000
    tickInterval = 24 * 3_600_000    // 1 day
    tickFmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
  } else {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    windowStart = monthStart.getTime()
    windowEnd   = monthEnd.getTime()
    tickInterval = 7 * 24 * 3_600_000 // 1 week
    tickFmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const rangeMs = windowEnd - windowStart
  const lp = (ms) => Math.max(0, Math.min(100, ((ms - windowStart) / rangeMs) * 100))
  const wp = (s, e) => Math.max(0.3, ((e - s) / rangeMs) * 100)

  // Tick grid
  const firstTick = Math.ceil(windowStart / tickInterval) * tickInterval
  const ticks = []
  for (let t = firstTick; t <= windowEnd; t += tickInterval) ticks.push(t)

  // NOW position
  const nowPct  = lp(now)
  const showNow = now >= windowStart && now <= windowEnd

  // Filter schedule to visible window
  const visibleSchedule = schedule.filter((ev) => ev.actualStartMs < windowEnd && ev.actualEndMs > windowStart)

  // ── Tow plane rows — grouped by assigned plane (from multi-plane scheduler) ──
  const towPlaneMap = {}
  for (const ev of visibleSchedule) {
    const tpId = ev.assignedPlaneId ?? ev.flight.towInfo?.towPlaneId ?? 'pool'
    ;(towPlaneMap[tpId] ??= []).push(ev)
  }

  // ── Glider rows ───────────────────────────────────────────────────────────
  const seen = new Set()
  const gliderFlights = visibleSchedule
    .filter((ev) => { if (seen.has(ev.flight.id)) return false; seen.add(ev.flight.id); return true })
    .map((ev) => ev.flight)

  function TickGrid() {
    return (
      <>
        {ticks.map((t) => (
          <div key={t} className="absolute top-0 bottom-0 w-px bg-slate-700/30" style={{ left: `${lp(t)}%` }} />
        ))}
        {showNow && (
          <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${nowPct}%`, background: 'rgba(251,191,36,0.8)' }} />
        )}
      </>
    )
  }

  function GanttRow({ label, sublabel, standby, children }) {
    return (
      <div className={`flex items-center ${standby ? 'opacity-50' : ''}`}>
        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="flex-shrink-0 pr-3 flex flex-col justify-center">
          <span className="text-xs font-mono font-semibold text-slate-200 truncate leading-tight">{label}</span>
          {sublabel && <span className="text-[9px] text-slate-500 truncate leading-tight">{sublabel}</span>}
        </div>
        <div
          className="relative flex-1 rounded bg-slate-800/50 border border-slate-700/40 overflow-hidden"
          style={{ height: ROW_H }}
        >
          <TickGrid />
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-x-auto relative"
      onKeyDown={(e) => { if (e.key === 'Escape') setSelectedFlight(null) }}
      tabIndex={-1}
    >
      {/* ── View toggle ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {['daily', 'weekly', 'monthly'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {visibleSchedule.length === 0 && (
          <span className="text-[10px] text-slate-500 italic">No tow events in this view</span>
        )}
      </div>

      {/* ── Time axis ── */}
      <div className="flex mb-1">
        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="flex-shrink-0" />
        <div className="relative flex-1 h-5">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute text-[9px] font-mono text-slate-500 -translate-x-1/2 select-none"
              style={{ left: `${lp(t)}%` }}
            >
              {tickFmt(new Date(t))}
            </span>
          ))}
          {/* NOW marker on time axis */}
          {showNow && (
            <span
              className="absolute text-[9px] font-semibold text-yellow-400 -translate-x-1/2 select-none"
              style={{ left: `${nowPct}%`, top: -2 }}
            >
              NOW
            </span>
          )}
        </div>
      </div>

      {/* ── Section label: Tow Planes ── */}
      <div className="flex items-center mb-0.5">
        <div style={{ width: LABEL_W }} className="flex-shrink-0" />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Tow Planes</span>
      </div>

      {Object.entries(towPlaneMap).map(([tpId, events]) => {
        const ac      = mockAircraft.find((a) => a.id === tpId)
        const label   = ac?.tailNumber ?? 'Pool'
        const sublabel = ac ? ac.makeModel.replace('Piper ', '') : 'Unassigned'
        return (
          <GanttRow key={tpId} label={label} sublabel={sublabel}>
            {events.map((ev, i) => {
              const st      = evStatus(ev)
              const c       = GANTT_STATUS[st]
              const delay   = evDelay(ev)
              const gldrLbl = ev.flight.ownAircraft ? 'Own' : (ev.flight.tailNumber ?? '?')
              return (
                <div key={i}>
                  {/* Delay line: reserved time → actual start */}
                  {delay > 0 && (
                    <div
                      title={`Delay: ${delay} min`}
                      className="absolute border-l-2 border-dashed border-amber-500/50 bg-amber-500/10"
                      style={{ left: `${lp(ev.requestedMs)}%`, width: `${wp(ev.requestedMs, ev.actualStartMs)}%`, top: 10, bottom: 10 }}
                    />
                  )}
                  <div
                    title={`Towing ${gldrLbl} · Tow ${ev.towIndex + 1} · ${ev.heightFt.toLocaleString()} ft · ${towCycleMin(ev.heightFt)} min${delay ? ` · ${delay}m delay` : ''} · ${st}`}
                    className={`absolute rounded flex items-center justify-center overflow-hidden cursor-pointer ${c.bar}`}
                    style={{ left: `${lp(ev.actualStartMs)}%`, width: `${wp(ev.actualStartMs, ev.actualEndMs)}%`, top: 3, bottom: 3 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.closest('.flex.flex-col').getBoundingClientRect()
                      setGanttPopPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                      setSelectedFlight(selectedFlight?.id === ev.flight.id ? null : ev.flight)
                    }}
                  >
                    <span className={`text-[9px] font-mono ${c.text} truncate px-0.5 pointer-events-none`}>
                      {gldrLbl}
                    </span>
                  </div>
                </div>
              )
            })}
          </GanttRow>
        )
      })}

      {/* ── Grounded tow planes — time-aware bars ── */}
      {/* Currently grounded (open squawk): bar from squawk report to end of window */}
      {groundedPlanes.map((ac) => {
        const gSquawk = squawks.find((s) =>
          (s.aircraftId === ac.id || s.tailNumber === ac.tailNumber) &&
          s.severity === 'grounding' && s.status !== 'closed'
        )
        const reportStr = gSquawk?.reportedAt ?? gSquawk?.reportedDate
        const startMs = reportStr ? new Date(reportStr).getTime() : windowStart
        const barStart = Math.max(startMs, windowStart)
        return (
          <GanttRow key={`grnd-${ac.id}`} label={ac.tailNumber} sublabel="GROUNDED">
            <div className="absolute rounded bg-red-500/20 border border-red-500/40"
              style={{ left: `${lp(barStart)}%`, right: '0%', top: 3, bottom: 3 }} />
            {startMs >= windowStart && startMs <= windowEnd && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-10"
                style={{ left: `${lp(startMs)}%` }} />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[9px] font-semibold text-red-400 bg-slate-800/80 px-2 rounded">
                GROUNDED
              </span>
            </div>
          </GanttRow>
        )
      })}
      {/* Was-grounded (closed squawk / resolved): bar from report to resolution */}
      {allMx.filter((w) => {
        const ac = ALL_TOW_AIRCRAFT.find((a) => a.id === w.aircraftId)
        if (!ac) return false
        if (isAircraftGrounded(ac.id, mockAircraft, squawks)) return false  // shown above
        return w.endMs > windowStart && w.startMs < windowEnd
      }).map((w, i) => {
        const ac = ALL_TOW_AIRCRAFT.find((a) => a.id === w.aircraftId)
        const barStart = Math.max(w.startMs, windowStart)
        const barEnd   = Math.min(w.endMs, windowEnd)
        const startLabel = w.startMs >= windowStart ? fmtTime(new Date(w.startMs)) : ''
        const endLabel   = w.endMs <= windowEnd ? fmtTime(new Date(w.endMs)) : ''
        return (
          <GanttRow key={`mx-${i}`} label={ac.tailNumber} sublabel="was grounded">
            <div className="absolute rounded bg-red-500/10 border border-dashed border-red-500/30"
              style={{ left: `${lp(barStart)}%`, width: `${wp(barStart, barEnd)}%`, top: 3, bottom: 3 }}
              title={`Grounded ${startLabel}–${endLabel}`} />
            {w.startMs >= windowStart && w.startMs <= windowEnd && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/50"
                style={{ left: `${lp(w.startMs)}%` }} />
            )}
            {w.endMs >= windowStart && w.endMs <= windowEnd && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-green-500/50"
                style={{ left: `${lp(w.endMs)}%` }} />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[9px] text-red-400/60 bg-slate-800/80 px-2 rounded">
                {startLabel}{startLabel && endLabel ? ' – ' : ''}{endLabel}
              </span>
            </div>
          </GanttRow>
        )
      })}

      {/* ── Connector strip: tow plane ↔ glider association ── */}
      <div className="flex my-1">
        <div style={{ width: LABEL_W }} className="flex-shrink-0" />
        <div className="relative flex-1" style={{ height: 14 }}>
          {visibleSchedule.map((ev, i) => {
            const st = evStatus(ev)
            const c  = GANTT_STATUS[st]
            return (
              <div
                key={i}
                title={`${ev.flight.ownAircraft ? 'Own' : ev.flight.tailNumber} ↔ ${mockAircraft.find((a) => a.id === ev.assignedPlaneId)?.tailNumber ?? '?'}`}
                className={`absolute h-full opacity-60 ${c.bar}`}
                style={{ left: `${lp(ev.actualStartMs)}%`, width: Math.max(2, wp(ev.actualStartMs, ev.actualEndMs)) + '%' }}
              />
            )
          })}
        </div>
      </div>

      {/* ── Section label: Glider Reservations ── */}
      <div className="flex items-center mb-0.5">
        <div style={{ width: LABEL_W }} className="flex-shrink-0" />
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Glider Reservations</span>
      </div>

      {gliderFlights.map((flight) => {
        const evs      = visibleSchedule.filter((e) => e.flight.id === flight.id)
        const label    = flight.ownAircraft ? `Own ${flight.tailNumber}` : (flight.tailNumber ?? '—')
        const sublabel = flight.pic ?? ''
        const isStandby = flight.towInfo?.isStandby ?? false
        return (
          <GanttRow key={flight.id} label={label} sublabel={sublabel} standby={isStandby}>
            {evs.map((ev, i) => {
              const st    = evStatus(ev)
              const c     = GANTT_STATUS[st]
              const delay = evDelay(ev)

              // Aloft gap: after tow ends → glider lands
              const aloftEndMs = ev.actualStartMs + timeAloftMin(ev.heightFt) * 60_000
              // Tow plane label for association
              const towPlaneTail = mockAircraft.find((a) => a.id === ev.assignedPlaneId)?.tailNumber

              return (
                <div key={i}>
                  {/* Delay line: reserved time → actual start */}
                  {delay > 0 && (
                    <div
                      title={`Delay: ${delay} min from reserved time`}
                      className="absolute border-l-2 border-dashed border-amber-500/50 bg-amber-500/10"
                      style={{ left: `${lp(ev.requestedMs)}%`, width: `${wp(ev.requestedMs, ev.actualStartMs)}%`, top: 10, bottom: 10 }}
                    />
                  )}
                  <div
                    title={`Tow ${ev.towIndex + 1}: ${ev.heightFt.toLocaleString()} ft · ${towCycleMin(ev.heightFt)} min · ${st}${towPlaneTail ? ` · tow plane ${towPlaneTail}` : ''}${delay ? ` · ${delay}m delay` : ''}`}
                    className={`absolute rounded flex items-center justify-center overflow-hidden cursor-pointer ${c.bar}`}
                    style={{ left: `${lp(ev.actualStartMs)}%`, width: `${wp(ev.actualStartMs, ev.actualEndMs)}%`, top: 3, bottom: 3 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.closest('.flex.flex-col').getBoundingClientRect()
                      setGanttPopPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                      setSelectedFlight(selectedFlight?.id === ev.flight.id ? null : ev.flight)
                    }}
                  >
                    <span className={`text-[9px] font-mono ${c.text} truncate px-0.5 pointer-events-none`}>
                      {ev.heightFt / 1000}k↑{towPlaneTail ? ` ${towPlaneTail}` : ''}
                    </span>
                  </div>
                  <div
                    title={`Aloft: ${timeAloftMin(ev.heightFt)} min`}
                    className="absolute rounded border border-dashed border-sky-500/40 bg-sky-500/10"
                    style={{ left: `${lp(ev.actualEndMs)}%`, width: `${wp(ev.actualEndMs, aloftEndMs)}%`, top: 7, bottom: 7 }}
                  />
                </div>
              )
            })}
          </GanttRow>
        )
      })}

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-4 h-2.5 rounded-sm bg-sky-500" />Reserved
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-4 h-2.5 rounded-sm bg-yellow-400" />Standby
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-4 h-2.5 rounded-sm bg-green-500" />Billed
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-4 h-2.5 rounded-sm border border-dashed border-sky-500/40 bg-sky-500/10" />
          Aloft
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-4 h-2.5 rounded-sm border-l-2 border-dashed border-amber-500/50 bg-amber-500/10" />
          Delay
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-4 h-2.5 rounded-sm bg-red-500/15 border border-red-500/30" />
          Grounded
        </span>
      </div>

      {/* Click-outside backdrop */}
      {selectedFlight && (
        <div className="fixed inset-0 z-10" onClick={() => setSelectedFlight(null)} />
      )}
      {/* Floating FlightCard popover */}
      {selectedFlight && (
        <div
          className="absolute z-30 w-[420px] max-h-[70vh] overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-sm shadow-xl p-3 flex flex-col gap-2"
          style={{ left: ganttPopPos.x, top: ganttPopPos.y }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
              {selectedFlight.tailNumber ?? selectedFlight.tail_number}
            </span>
            <button onClick={() => setSelectedFlight(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-1">x</button>
          </div>
          <FlightCard f={selectedFlight} />
        </div>
      )}
    </div>
  )
}

// ─── Tow reservation card ─────────────────────────────────────────────────────

function TowCard({ res }) {
  const isStandby  = res.isStandby
  const heights    = res.towInfo?.towHeights ?? [2000]
  const waitColor  = res.waitColor ?? 'slate'
  const avail      = AVAILABILITY_COLORS[res.windowColor ?? (isStandby ? 'red' : 'green')]

  const acLabel = res.ownAircraft
    ? 'Own Aircraft'
    : mockAircraft.find((a) => a.tailNumber === res.tailNumber)?.makeModel ?? res.tailNumber

  return (
    <div className={`rounded-lg border p-4 flex flex-col gap-3 transition-opacity ${
      isStandby ? 'opacity-50 border-dashed' : 'border-surface-border'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {isStandby && (
            <span className="text-xs px-2 py-0.5 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 font-medium">
              STANDBY
            </span>
          )}
          <span className="text-sm font-mono font-bold text-slate-100">
            {res.ownAircraft ? '(Own Aircraft)' : res.tailNumber}
          </span>
          <span className="text-xs text-slate-400">{acLabel}</span>
          <span className="text-xs text-slate-500">
            Glider PIC: {res.pic ?? '—'}
          </span>
          {res.towInfo?.towPlaneTail && (
            <span className="text-xs text-slate-500">
              · Tow: {res.towInfo.towPlaneTail}
            </span>
          )}
          {res.towInfo?.towPilotName && (
            <span className="text-xs text-slate-500">
              · {res.towInfo.towPilotName}
            </span>
          )}
        </div>

        {/* Wait badge */}
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${towColorCss(waitColor)}`}>
          {res.waitMin === 0 ? 'No wait' : res.waitMin != null ? `+${res.waitMin} min wait` : '—'}
        </span>
      </div>

      {/* Tow slots */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">Requested</div>
          <div className="font-mono text-slate-300">
            {fmtTime(new Date(res.plannedDepartureUtc))}
          </div>
        </div>
        <div>
          <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">
            Tow 1 slot
          </div>
          <div className={`font-mono font-medium ${res.waitMin === 0 ? 'text-sky-400' : res.waitMin <= 5 ? 'text-green-400' : res.waitMin <= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
            {fmtTime(res.firstSlot)}
          </div>
        </div>

        {heights.map((h, i) => (
          <div key={i}>
            <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">
              Tow {i + 1} height
            </div>
            <div className="text-slate-300 font-mono">{h.toLocaleString()} ft</div>
          </div>
        ))}

        {res.secondSlot && (
          <div>
            <div className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">Tow 2 slot</div>
            <div className="font-mono text-sky-400">{fmtTime(res.secondSlot)}</div>
          </div>
        )}
      </div>

      {/* Standby notice */}
      {isStandby && (
        <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          This reservation is on <strong>standby</strong>. The tow window is overloaded.
          Tow will be confirmed when a slot opens — earliest slot shown above.
        </div>
      )}
    </div>
  )
}

// ─── 15-min period grid ───────────────────────────────────────────────────────

function PeriodGrid({ periods, wwCountAm = 0, wwCountPm = 0 }) {
  const activePeriods = periods.filter((p) => p.count > 0)
  if (activePeriods.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">No tow activity scheduled today.</p>
    )
  }

  const COLOR_BG = {
    blue:   'bg-sky-500',
    green:  'bg-green-500',
    yellow: 'bg-yellow-500',
    red:    'bg-red-500',
  }
  const COLOR_TEXT = {
    blue:   'text-sky-300',
    green:  'text-green-300',
    yellow: 'text-yellow-300',
    red:    'text-red-300',
  }

  // 12:30 PM boundary in ms from start of day
  const PM_START_HOUR = 12.5

  return (
    <div className="flex flex-col gap-2">
      {/* Legend + wing walker summary */}
      <div className="flex gap-4 text-xs text-slate-500 flex-wrap items-center">
        {Object.entries(WAIT_LABELS).map(([c, lbl]) => (
          <span key={c} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-sm ${COLOR_BG[c] ?? 'bg-slate-500'}`} />
            {lbl}
          </span>
        ))}
        <span className="border-l border-surface-border pl-3 flex items-center gap-1.5">
          <span className="text-amber-400">🚶 Wing Walkers:</span>
          <span className={`font-mono ${wwCountAm > 0 ? 'text-amber-300' : 'text-red-400'}`}>AM {wwCountAm}</span>
          <span className={`font-mono ${wwCountPm > 0 ? 'text-amber-300' : 'text-red-400'}`}>PM {wwCountPm}</span>
        </span>
      </div>

      {/* Active periods only */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
        {periods.map((p, i) => {
          if (!p.color) return null
          const periodHour = new Date(p.start).getHours() + new Date(p.start).getMinutes() / 60
          const ww = periodHour >= 8 && periodHour < PM_START_HOUR ? wwCountAm : periodHour >= PM_START_HOUR && periodHour < 17 ? wwCountPm : 0
          return (
            <div
              key={i}
              title={`${fmtPeriodLabel(p.start)} — avg wait ${p.avgWait === 0 ? 'none' : `${p.avgWait} min`} (${p.count} tow${p.count !== 1 ? 's' : ''}) · ${ww} wing walker${ww !== 1 ? 's' : ''}`}
              className={`rounded border text-center px-1 py-2 text-[10px] border-transparent ${COLOR_BG[p.color] ?? 'bg-slate-700'}/20`}
            >
              <div className={`font-mono font-medium ${COLOR_TEXT[p.color] ?? 'text-slate-400'}`}>
                {fmtPeriodLabel(p.start)}
              </div>
              <div className="text-slate-500 mt-0.5">{p.count} tow{p.count !== 1 ? 's' : ''}</div>
              <div className={`font-medium ${COLOR_TEXT[p.color] ?? 'text-slate-400'}`}>
                {p.avgWait === 0 ? 'no wait' : `+${p.avgWait}m`}
              </div>
              <div className={`mt-0.5 ${ww > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                🚶{ww}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── New reservation form ─────────────────────────────────────────────────────

const GLIDER_AIRCRAFT = mockAircraft.filter((a) => a.glider && a.airworthy)
const TOW_AIRCRAFT    = mockAircraft.filter((a) => a.is_tow && a.airworthy)
const ALL_TOW_AIRCRAFT = mockAircraft.filter((a) => a.is_tow)

// ─── Tow pilot currency checks ────────────────────────────────────────────────
const _today = new Date()

function towPilotCurrencyIssues(p) {
  const issues = []
  if (p.medicalExpiry && new Date(p.medicalExpiry) < _today) {
    issues.push('Medical expired')
  }
  if (p.lastFlightReview) {
    const reviewAgeDays = Math.round((_today - new Date(p.lastFlightReview)) / 86_400_000)
    if (reviewAgeDays > 730) issues.push('Flight review expired')
  }
  return issues   // empty = current
}

const WING_WALKERS       = mockPersonnel.filter((p) => p.wingWalker)
const TOW_PILOTS_ALL     = mockPersonnel.filter((p) => p.towCertified)
const TOW_PILOTS_CURRENT = TOW_PILOTS_ALL.filter((p) => towPilotCurrencyIssues(p).length === 0)
const TOW_PILOTS_LAPSED  = TOW_PILOTS_ALL.filter((p) => towPilotCurrencyIssues(p).length > 0)

// Keep a flat array for lookups (handleSubmit etc.)
const TOW_PILOTS = TOW_PILOTS_ALL

// ─── Glider PIC candidate list ────────────────────────────────────────────────
// Three sources, each tagged so the dropdown can show grouped labels.
const GLIDER_STUDENTS = mockStudents
  .filter((s) => s.program?.startsWith('glider_') && s.status === 'active')
  .map((s) => ({ id: `std-${s.id}`, name: s.name, source: 'student' }))

const GLIDER_CLUB_MEMBERS = mockClubMembers
  .filter((m) => m.gliderRating && m.duesCurrent)
  .map((m) => ({ id: `cm-${m.id}`, name: m.name, source: 'club' }))

const GLIDER_PERSONNEL = mockPersonnel
  .filter((p) => p.gliderRating)
  .map((p) => ({ id: `prs-${p.id}`, name: p.name, source: 'personnel' }))

// Deduplicate: personnel who are also club members appear once (as personnel)
const personnelIds = new Set(GLIDER_PERSONNEL.map((p) => p.id.replace('prs-prs-', 'prs-')))
const dedupedClub  = GLIDER_CLUB_MEMBERS.filter((m) => {
  const cm = mockClubMembers.find((c) => `cm-${c.id}` === m.id)
  return !cm?.personnelId || !GLIDER_PERSONNEL.some((p) => p.id === `prs-${cm.personnelId}`)
})

const GLIDER_PICS = [...GLIDER_STUDENTS, ...dedupedClub, ...GLIDER_PERSONNEL]

// Glider instructors — personnel with glider rating who hold a CFI/CFII certificate
const GLIDER_INSTRUCTORS = mockPersonnel.filter(
  (p) => p.gliderRating && (p.role === 'cfi' || p.cfiRatings?.length > 0)
)

/**
 * After a new tow duty block is added, promote standby glider reservations
 * (earliest first) until the duty block supply is saturated.
 */
function promoteStandbyReservations(allFlights) {
  const WINDOW = 30 * 60_000
  const standbys = allFlights
    .filter((f) => f.towInfo?.isStandby && isTowFlight(f, AIRPORT))
    .sort((a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc))

  // Work on a mutable copy so earlier promotions affect later checks
  let working = allFlights.map((f) =>
    f.towInfo ? { ...f, towInfo: { ...f.towInfo } } : f
  )

  for (const standby of standbys) {
    const depMs = new Date(standby.plannedDepartureUtc).getTime()
    const idx   = working.findIndex((f) => f.id === standby.id)
    if (idx === -1) continue

    // Tentatively promote
    working[idx].towInfo.isStandby = false
    const result = towDeficiencyMin(working, AIRPORT, depMs, depMs + WINDOW)

    if (result.isStandby) {
      // Doesn't fit — revert
      working[idx].towInfo.isStandby = true
    } else {
      // Fits — persist promotion
      updateFlight(standby.id, { towInfo: { ...standby.towInfo, isStandby: false } })
    }
  }
}

function NewReservationPanel({ flights, onScheduled, schedCtx = null, clients = [] }) {
  // ── Shared ────────────────────────────────────────────────────────────────
  const [reservationType, setReservationType] = useState('glider_session') // 'glider_session' | 'tow_session'
  const [depOffset,       setDepOffset]       = useState(60)   // minutes from now
  const [submitted,       setSubmitted]       = useState(false)

  // ── Glider session ────────────────────────────────────────────────────────
  const [acId,          setAcId]          = useState('own')   // 'own' | ac.id | 'none'
  const [ownTail,       setOwnTail]       = useState('')       // tail number when acId === 'own'
  const [picId,         setPicId]         = useState(GLIDER_PICS[0]?.id ?? 'other')
  const [picOther,      setPicOther]      = useState('')       // free text when picId === 'other'
  const [instructorId,  setInstructorId]  = useState('')      // '' = solo / PIC only
  const [needsTow,       setNeedsTow]       = useState(true)   // false = self-launch
  const [numTows,        setNumTows]        = useState(1)
  const [towHeights,     setTowHeights]     = useState([2000])
  const [confirmStandby, setConfirmStandby] = useState(true)  // user confirms standby intent
  const [gliderDuration, setGliderDuration] = useState(1.5)  // hours — default 90 min

  // ── Tow session (tow plane duty block, may span multiple fuel stops) ──────
  const [sessionTowPlaneId, setSessionTowPlaneId] = useState(ALL_TOW_AIRCRAFT[0]?.id ?? '')
  const [sessionTowPilotId, setSessionTowPilotId] = useState(TOW_PILOTS_CURRENT[0]?.id ?? '')
  const [sessionDuration,   setSessionDuration]   = useState(2)
  const [sessionNotes,      setSessionNotes]      = useState('')

  const depMs   = Date.now() + depOffset * 60_000
  const depDate = new Date(depMs)
  const WINDOW  = 30 * 60_000   // 30-minute evaluation window

  // Single tow capacity check — used for both the indicator and submit logic
  const towAvail = towDeficiencyMin(flights, AIRPORT, depMs, depMs + WINDOW)
  const avCfg    = AVAILABILITY_COLORS[towAvail.color]

  // Tow plane & pilot conflict checks for duty block form
  const blockEndMs         = depMs + sessionDuration * 3_600_000
  const selectedTowAc      = ALL_TOW_AIRCRAFT.find((a) => a.id === sessionTowPlaneId) ?? null
  const towAcConflicts     = selectedTowAc
    ? flights.filter((f) => {
        if (f.tailNumber !== selectedTowAc.tailNumber) return false
        const fStart = new Date(f.plannedDepartureUtc).getTime()
        const fEnd   = f.plannedArrivalUtc ? new Date(f.plannedArrivalUtc).getTime() : fStart + 3_600_000
        return fStart < blockEndMs && fEnd > depMs
      })
    : []
  const towPilotConflicts  = sessionTowPilotId
    ? flights.filter((f) => {
        if (f.picId !== sessionTowPilotId && f.sicId !== sessionTowPilotId) return false
        const fStart = new Date(f.plannedDepartureUtc).getTime()
        const fEnd   = f.plannedArrivalUtc ? new Date(f.plannedArrivalUtc).getTime() : fStart + 3_600_000
        return fStart < blockEndMs && fEnd > depMs
      })
    : []

  // Glider aircraft conflict check — is the selected club aircraft already booked at depMs?
  const selectedAc      = GLIDER_AIRCRAFT.find((a) => a.id === acId) ?? null
  const sessionEstEndMs = depMs + gliderDuration * 3_600_000
  const acConflicts = selectedAc
    ? flights.filter((f) => {
        if (f.tailNumber !== selectedAc.tailNumber) return false
        const fStart = new Date(f.plannedDepartureUtc).getTime()
        const fEnd   = estimateSessionEndMs(f)
        return fStart < sessionEstEndMs && fEnd > depMs
      })
    : []
  const acAvailable = acConflicts.length === 0

  function setNumTowsAndHeights(n) {
    setNumTows(n)
    setTowHeights((prev) => {
      if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(2000)]
      return prev.slice(0, n)
    })
  }

  function setHeight(i, h) {
    setTowHeights((prev) => prev.map((v, idx) => (idx === i ? h : v)))
  }

  function handleSubmit() {
    if (reservationType === 'tow_session') {
      const towPlane = TOW_AIRCRAFT.find((a) => a.id === sessionTowPlaneId) ?? null
      const towPilot = TOW_PILOTS.find((p) => p.id === sessionTowPilotId)   ?? null
      const newFlt = {
        id:                  `flt-tow-session-${Date.now()}`,
        callsign:            towPlane?.tailNumber ?? 'TOW',
        tailNumber:          towPlane?.tailNumber ?? 'TOW',
        aircraftType:        towPlane?.icaoType ?? 'TOW',
        departure:           AIRPORT,
        arrival:             AIRPORT,
        airport:             AIRPORT,
        plannedDepartureUtc: depDate.toISOString(),
        plannedArrivalUtc:   new Date(depMs + sessionDuration * 3_600_000).toISOString(),
        status:              'planned',
        pic:                 towPilot?.name ?? '—',
        picId:               sessionTowPilotId || null,
        sic:                 null,
        sicId:               null,
        passengers:          0,
        missionType:         'tow_session',
        part:                '91',
        part91Type:          'tow_session',
        riskScore:           10,
        notes:               sessionNotes,
        towInfo: {
          towPlaneId:        sessionTowPlaneId,
          towPlaneTail:      towPlane?.tailNumber ?? null,
          towPilotId:        sessionTowPilotId,
          towPilotName:      towPilot?.name ?? null,
          sessionDurationHr: sessionDuration,
          isStandby:         false,
        },
      }
      addFlight(newFlt)
      // After adding a duty block, promote standby glider reservations that now fit
      // (addFlight already persisted newFlt, so getAllFlights() includes it)
      promoteStandbyReservations(getAllFlights())
      setSubmitted(true)
      onScheduled?.()
      return
    }

    // ── Glider session ───────────────────────────────────────────────────────
    const ac         = (acId === 'own' || acId === 'none') ? null : mockAircraft.find((a) => a.id === acId)
    const ownTailUp  = ownTail.trim().toUpperCase()
    const gliderPic  = GLIDER_PICS.find((p) => p.id === picId)
    const picName    = picId === 'other' ? (picOther || '—') : (gliderPic?.name ?? '—')
    const instructor = instructorId ? mockPersonnel.find((p) => p.id === instructorId) : null
    const isDual     = !!instructor

    // Save outside client aircraft to shared client store
    if (acId === 'own' && ownTailUp) {
      upsertClient({ tailNumber: ownTailUp, ownerName: picName !== '—' ? picName : null, fboCategory: 'glider' })
    }

    const newFlt = {
      id:                  `flt-glider-${Date.now()}`,
      callsign:            ac?.tailNumber ?? (acId === 'none' ? 'SELF' : ownTailUp || 'OWN-ACFT'),
      tailNumber:          ac?.tailNumber ?? (acId === 'none' ? 'SELF' : ownTailUp || 'OWN'),
      aircraftType:        ac?.icaoType   ?? 'GLIDER',
      departure:           AIRPORT,
      arrival:             AIRPORT,
      airport:             AIRPORT,
      plannedDepartureUtc: depDate.toISOString(),
      plannedArrivalUtc:   new Date(depMs + gliderDuration * 3_600_000).toISOString(),
      status:              'planned',
      pic:                 isDual ? (instructor?.name ?? '—') : picName,
      picId:               isDual ? instructorId : (picId !== 'other' ? picId : null),
      sic:                 isDual ? picName : null,
      sicId:               isDual ? (picId !== 'other' ? picId : null) : null,
      passengers:          0,
      missionType:         needsTow ? (isDual ? 'training' : 'glider_tow') : 'glider_flight',
      part:                '91',
      part91Type:          needsTow ? (isDual ? 'glider_dual' : 'glider_tow') : 'glider_flight',
      ownAircraft:         acId === 'own',
      riskScore:           needsTow ? 22 : 15,
      riskSnapshot: {
        capturedAt:      new Date().toISOString(),
        lastCheckedAt:   new Date().toISOString(),
        ratioToBaseline: 1.15,
        riskTrend:       'stable',
        riskDelta:       0,
        weatherSummary:  null,
        terrainProfile:  null,
        riskItems: needsTow
          ? [{ id: 'op_glider_tow', label: 'Glider aerotow — §91.309', category: 'operational', severity: 'low' }]
          : [{ id: 'op_glider_self', label: 'Self-launch glider flight', category: 'operational', severity: 'low' }],
      },
      // Tow request — records what tows are needed; tow plane assigned separately
      towInfo: needsTow ? {
        numTows,
        towHeights,
        isStandby:    towAvail.isStandby,
        // No tow plane/pilot — assigned via separate tow duty block reservation
        towPlaneId:   null,
        towPlaneTail: null,
        towPilotId:   null,
        towPilotName: null,
      } : null,
    }
    addFlight(newFlt)
    setSubmitted(true)
    onScheduled?.()
  }

  if (submitted) {
    const sessionPlane = TOW_AIRCRAFT.find((a) => a.id === sessionTowPlaneId) ?? null
    const msg = reservationType === 'tow_session'
      ? `Tow block scheduled — ${sessionDuration}h for ${sessionPlane?.tailNumber}.`
      : needsTow
        ? `Glider scheduled. ${towAvail.isStandby ? 'Tow on standby — promoted when a duty block covers this window.' : 'Tow confirmed.'}`
        : 'Glider scheduled (self-launch).'
    return (
      <>
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <TowViolinChart flights={flights} schedCtx={schedCtx} />
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400 flex items-center justify-between">
          <span>{msg}</span>
          <button
            onClick={() => setSubmitted(false)}
            className="text-xs text-green-300 hover:text-green-100 underline underline-offset-2"
          >
            + Another
          </button>
        </div>
      </>
    )
  }

  // Synthetic preview flight — mirrors what would be submitted, drives the ghost in the violin
  const previewFlight = reservationType === 'tow_session'
    ? {
        id: '__preview__',
        missionType: 'tow_session',
        part91Type:  'tow_session',
        departure:   AIRPORT,
        airport:     AIRPORT,
        plannedDepartureUtc: depDate.toISOString(),
        plannedArrivalUtc:   new Date(depMs + sessionDuration * 3_600_000).toISOString(),
        towInfo: { towPlaneId: sessionTowPlaneId },
      }
    : needsTow
      ? {
          id: '__preview__',
          missionType: 'glider_tow',
          part91Type:  'glider_tow',
          departure:   AIRPORT,
          airport:     AIRPORT,
          plannedDepartureUtc: depDate.toISOString(),
          plannedArrivalUtc:   new Date(depMs + gliderDuration * 3_600_000).toISOString(),
          towInfo: { towHeights, numTows, isStandby: false },
        }
      : null   // self-launch — no tow impact to preview

  return (
    <>
    {/* Violin chart — always visible while booking, ghost shows potential impact */}
    <div className="bg-surface-card border border-surface-border rounded-xl p-4">
      <TowViolinChart flights={flights} previewFlight={previewFlight} schedCtx={schedCtx} />
    </div>

    <div className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col gap-5">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New Reservation</div>

      {/* Reservation type toggle */}
      <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg self-start">
        {[
          { key: 'glider_session', label: 'Glider Session' },
          { key: 'tow_session',    label: 'Tow Plane Duty Block' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setReservationType(key)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              reservationType === key
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tow Plane Duty Block form ── */}
      {reservationType === 'tow_session' && (
        <>
          <p className="text-xs text-slate-500 -mt-2">
            Schedule a tow plane for a duty block.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tow Plane */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Tow Plane</label>
              {ALL_TOW_AIRCRAFT.length === 0 ? (
                <div className="text-xs text-amber-400 py-2">No tow aircraft in fleet</div>
              ) : (
                <select
                  value={sessionTowPlaneId}
                  onChange={(e) => setSessionTowPlaneId(e.target.value)}
                  className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {ALL_TOW_AIRCRAFT.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.tailNumber} — {a.makeModel}{!a.airworthy ? ' (GROUNDED)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {/* Aircraft status + conflict indicator */}
              {selectedTowAc && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {!selectedTowAc.airworthy && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
                      {selectedTowAc.tailNumber} is grounded — not airworthy
                    </div>
                  )}
                  {selectedTowAc.airworthy && towAcConflicts.length === 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-400" />
                      {selectedTowAc.tailNumber} available
                    </div>
                  )}
                  {towAcConflicts.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
                      {selectedTowAc.tailNumber} already scheduled — {towAcConflicts.length} conflict{towAcConflicts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tow Pilot */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Tow Pilot</label>
              {TOW_PILOTS_CURRENT.length === 0 ? (
                <div className="text-xs text-amber-400 py-2">No tow-certified pilots with current currency</div>
              ) : (
                <select
                  value={sessionTowPilotId}
                  onChange={(e) => setSessionTowPilotId(e.target.value)}
                  className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {TOW_PILOTS_CURRENT.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.certType ?? 'Pilot'}
                    </option>
                  ))}
                </select>
              )}
              {/* Pilot conflict indicator */}
              {sessionTowPilotId && (
                <div className="mt-0.5">
                  {towPilotConflicts.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
                      Pilot already scheduled — {towPilotConflicts.length} conflict{towPilotConflicts.length !== 1 ? 's' : ''}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-400" />
                      Pilot available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Block Start */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Block Start — in</label>
              <div className="flex gap-2 flex-wrap">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDepOffset(m)}
                    className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                      depOffset === m
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                        : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {fmtTime(depDate)} local
              </div>
            </div>

            {/* Block Duration */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Block Duration</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 6, 8].map((h) => (
                  <button
                    key={h}
                    onClick={() => setSessionDuration(h)}
                    className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                      sessionDuration === h
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                        : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {fmtTime(depDate)} — {fmtTime(new Date(blockEndMs))} local
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Notes (optional)</label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="e.g. Club fly day, competition support…"
                className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600"
              />
            </div>
          </div>

          {/* Show standby tow count in this block's window */}
          {(() => {
            const blockStart = depMs
            const blockEnd   = depMs + sessionDuration * 3_600_000
            const willPromote = flights.filter((f) => {
              if (!f.towInfo?.isStandby || !isTowFlight(f, AIRPORT)) return false
              const fMs = new Date(f.plannedDepartureUtc).getTime()
              return fMs >= blockStart && fMs < blockEnd
            })
            const allTowsInWindow = flights.filter((f) => {
              if (!isTowFlight(f, AIRPORT)) return false
              const fMs = new Date(f.plannedDepartureUtc).getTime()
              return fMs >= blockStart && fMs < blockEnd
            })
            const totalTows = allTowsInWindow.reduce((n, f) => n + (f.towInfo?.numTows ?? f.towInfo?.towHeights?.length ?? 1), 0)
            return (
              <div className={`flex flex-col gap-2 rounded-lg border px-3 py-3 text-xs ${
                willPromote.length > 0
                  ? 'border-green-500/30 bg-green-500/10 text-green-300'
                  : 'border-surface-border bg-slate-800/40 text-slate-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${willPromote.length > 0 ? 'bg-green-400' : 'bg-slate-500'}`} />
                  {willPromote.length > 0 ? (
                    <span>
                      This block will promote <strong>{willPromote.length}</strong> standby tow{willPromote.length !== 1 ? 's' : ''} to confirmed:
                      <span className="ml-1 font-mono">
                        {willPromote.map((f) => f.ownAircraft ? 'Own Acft' : f.tailNumber).join(', ')}
                      </span>
                    </span>
                  ) : (
                    <span>{totalTows > 0 ? `${totalTows} tow${totalTows !== 1 ? 's' : ''} in this window — none on standby` : 'No tow requests in this window'}</span>
                  )}
                </div>
                {willPromote.length > 0 && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmStandby}
                      onChange={(e) => setConfirmStandby(e.target.checked)}
                      className="mt-0.5 accent-green-400"
                    />
                    <span>Confirm {willPromote.length} tow{willPromote.length !== 1 ? 's' : ''} on standby — I have capacity to cover them</span>
                  </label>
                )}
              </div>
            )
          })()}

          <button
            onClick={handleSubmit}
            disabled={
              !sessionTowPlaneId || !sessionTowPilotId ||
              (selectedTowAc && !selectedTowAc.airworthy) ||
              towAcConflicts.length > 0 ||
              towPilotConflicts.length > 0 ||
              (() => {
                const blockStart = depMs
                const blockEnd   = depMs + sessionDuration * 3_600_000
                const willPromote = flights.filter((f) => {
                  if (!f.towInfo?.isStandby || !isTowFlight(f, AIRPORT)) return false
                  const fMs = new Date(f.plannedDepartureUtc).getTime()
                  return fMs >= blockStart && fMs < blockEnd
                })
                return willPromote.length > 0 && !confirmStandby
              })()
            }
            className="self-start px-5 py-2 rounded border border-sky-500/50 bg-sky-500/15 text-sky-300 text-sm
                       hover:bg-sky-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Schedule Tow Block
          </button>
        </>
      )}

      {/* ── Glider Session form ── */}
      {reservationType === 'glider_session' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Glider PIC */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Glider PIC</label>
              <select
                value={picId}
                onChange={(e) => setPicId(e.target.value)}
                className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {GLIDER_STUDENTS.length > 0 && (
                  <optgroup label="Glider Students">
                    {GLIDER_STUDENTS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
                {dedupedClub.length > 0 && (
                  <optgroup label="Club Members">
                    {dedupedClub.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
                {GLIDER_PERSONNEL.length > 0 && (
                  <optgroup label="Personnel">
                    {GLIDER_PERSONNEL.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Other">
                  <option value="other">Other / Visitor…</option>
                </optgroup>
              </select>
              {picId === 'other' && (
                <input
                  type="text"
                  value={picOther}
                  onChange={(e) => setPicOther(e.target.value)}
                  placeholder="Last, First"
                  className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600 mt-1"
                />
              )}
            </div>

            {/* Aircraft */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Aircraft</label>
              <select
                value={acId}
                onChange={(e) => setAcId(e.target.value)}
                className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="own">Own Aircraft</option>
                {GLIDER_AIRCRAFT.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.tailNumber} — {a.makeModel}
                  </option>
                ))}
                <option value="none">None (self-launch / motorglider)</option>
              </select>
              {/* Own aircraft — tail number input with client autocomplete */}
              {acId === 'own' && (() => {
                const filtered = ownTail.length >= 1
                  ? clients.filter((c) => c.tailNumber.startsWith(ownTail.toUpperCase()))
                  : []
                const match = ownTail.length >= 2 ? findClientByTail(ownTail) : null
                return (
                  <div className="flex flex-col gap-1 mt-1">
                    <input
                      type="text"
                      value={ownTail}
                      onChange={(e) => setOwnTail(e.target.value.toUpperCase())}
                      placeholder="Tail number (e.g. N1234G)"
                      className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600"
                    />
                    {filtered.length > 0 && !match && (
                      <div className="flex gap-1 flex-wrap">
                        {filtered.slice(0, 6).map((c) => (
                          <button
                            key={c.tailNumber}
                            type="button"
                            onClick={() => setOwnTail(c.tailNumber)}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 font-mono"
                          >
                            {c.tailNumber} {c.ownerName && <span className="text-slate-500">({c.ownerName})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {match && (
                      <div className="text-[10px] text-green-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {match.ownerName ?? 'Known aircraft'}
                        {match.makeModel && <span className="text-slate-500">· {match.makeModel}</span>}
                        {match.basedHere && <span className="text-sky-400 ml-1">BASED</span>}
                      </div>
                    )}
                  </div>
                )
              })()}
              {/* Aircraft availability indicator */}
              {selectedAc && (
                <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${acAvailable ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${acAvailable ? 'bg-green-400' : 'bg-red-400'}`} />
                  {acAvailable
                    ? `${selectedAc.tailNumber} available at this time`
                    : `${selectedAc.tailNumber} already reserved — ${acConflicts.length} conflict${acConflicts.length !== 1 ? 's' : ''}`}
                </div>
              )}
            </div>

            {/* Instructor (optional) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Instructor <span className="text-slate-600 normal-case">(leave blank for solo / PIC)</span></label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="bg-surface-card border border-surface-border rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">— Solo / No Instructor —</option>
                {GLIDER_INSTRUCTORS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.certType ?? 'CFI'}
                  </option>
                ))}
              </select>
            </div>

            {/* Departure offset */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Departure — in</label>
              <div className="flex gap-2 flex-wrap">
                {[30, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDepOffset(m)}
                    className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                      depOffset === m
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                        : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {fmtTime(depDate)} local
              </div>
            </div>

            {/* Session Duration */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Session Duration</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 1.5, 2, 3, 4].map((h) => (
                  <button
                    key={h}
                    onClick={() => setGliderDuration(h)}
                    className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                      gliderDuration === h
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                        : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* Needs tow toggle */}
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-xs text-slate-400 uppercase tracking-wide">Aerotow</label>
              <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg self-start">
                {[
                  { v: true,  label: 'Needs Tow' },
                  { v: false, label: 'Self-Launch' },
                ].map(({ v, label }) => (
                  <button
                    key={String(v)}
                    onClick={() => setNeedsTow(v)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      needsTow === v
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Tow request (conditional) ── */}
          {needsTow && (
            <div className="border border-surface-border rounded-lg p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tow Request</div>
                <div className="text-[10px] text-slate-600">Tow plane assignment is a separate reservation</div>
              </div>

              <div className="flex items-center gap-4">
                {/* Number of tows */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 uppercase tracking-wide">Number of tows</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNumTowsAndHeights(Math.max(1, numTows - 1))}
                      className="w-8 h-8 rounded border border-surface-border text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors"
                    >−</button>
                    <span className="w-8 text-center font-mono text-slate-100">{numTows}</span>
                    <button
                      onClick={() => setNumTowsAndHeights(Math.min(6, numTows + 1))}
                      className="w-8 h-8 rounded border border-surface-border text-slate-300 hover:border-sky-500/40 hover:text-sky-300 transition-colors"
                    >+</button>
                  </div>
                </div>
              </div>

              {/* Per-tow height selectors */}
              <div className="flex flex-col gap-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Tow heights</div>
                <div className="flex flex-col gap-2">
                  {towHeights.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-500 w-12">Tow {i + 1}</span>
                      <div className="flex gap-1 flex-wrap">
                        {TOW_HEIGHTS.map((ft) => (
                          <button
                            key={ft}
                            onClick={() => setHeight(i, ft)}
                            className={`px-3 py-1 rounded border text-xs transition-colors ${
                              h === ft
                                ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                                : 'border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            {ft.toLocaleString()} ft
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-600">~{towCycleMin(h)} min tow plane time</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tow availability */}
              <div className={`rounded-lg border px-4 py-3 flex flex-col gap-2 ${avCfg.border} ${avCfg.bg}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${avCfg.bar}`} />
                    <span className={`text-xs font-medium ${avCfg.text}`}>{avCfg.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {towAvail.demandMin} min demand · {towAvail.supplyMin} min supply (30-min window)
                  </span>
                </div>
                {/* Demand vs supply bar */}
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${avCfg.bar}`}
                    style={{ width: `${Math.min(100, towAvail.supplyMin > 0 ? (towAvail.demandMin / towAvail.supplyMin) * 100 : 0)}%` }}
                  />
                </div>
                {towAvail.isStandby && (
                  <div className="text-xs text-yellow-300 flex items-start gap-1.5">
                    <span className="mt-0.5">⚠</span>
                    <span>Tow capacity is saturated for this window — {numTows} tow{numTows !== 1 ? 's' : ''} will be added as standby and promoted automatically when a tow duty block covers this window.</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-600">
                  Supply from scheduled duty blocks · {TOW_SETTINGS.minutesPer1000ft} min/1000 ft per tow
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={
              (picId === 'other' ? !picOther.trim() : !picId) ||
              !acAvailable
            }
            className="self-start px-5 py-2 rounded border border-sky-500/50 bg-sky-500/15 text-sky-300 text-sm
                       hover:bg-sky-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {needsTow
              ? (towAvail.isStandby ? 'Schedule Glider (Standby)' : 'Schedule Glider (and Tow)')
              : 'Schedule Glider'}
          </button>
        </>
      )}
    </div>
    </>
  )
}

// ─── Flights Tab (per-tow billing + actual hours) ────────────────────────────

function FlightCard({ f }) {
  const [expanded, setExpanded] = useState(false)
  const [actualHours, setActualHours] = useState('')
  const [extraHeight, setExtraHeight] = useState(2000)

  const cancelled    = f.status === 'cancelled'
  const noShow       = f.status === 'no_show'
  const heights      = f.towInfo?.towHeights ?? []
  const billedTows   = f.towInfo?.billedTows ?? []
  const billedHours  = f.towInfo?.billedHours ?? null
  const isStandby    = f.towInfo?.isStandby
  const isClubGlider = !f.ownAircraft && f.tailNumber !== 'OWN' && f.tailNumber !== 'SELF'
  const isDual       = !!f.sic
  const allTowsBilled = heights.length > 0 && billedTows.length >= heights.length
  const hoursBilled   = billedHours != null
  const fullyBilled   = allTowsBilled && (!isClubGlider || hoursBilled)
  const nextTowIdx    = billedTows.length
  const totalTowCost  = heights.reduce((s, h) => s + towPrice(h), 0)

  const todayStr = new Date().toISOString().split('T')[0]

  function billTow(towIdx) {
    const h = heights[towIdx]
    const price = towPrice(h)
    const clientName = f.pic ?? '—'
    const clientId   = f.picId ?? f.id
    const inv = findOrCreateInvoice(todayStr, clientId, clientName, f.tailNumber)
    upsertInvoice(inv)
    addLineItem(inv.id, {
      type: 'tow', flightId: f.id,
      description: `Tow ${towIdx + 1} to ${h.toLocaleString()} ft`,
      qty: 1, rate: price, amount: price,
    })
    updateFlight(f.id, { towInfo: { ...f.towInfo, billedTows: [...billedTows, towIdx] } })
  }

  function billExtraTow() {
    const h = extraHeight
    const price = towPrice(h)
    const clientName = f.pic ?? '—'
    const clientId   = f.picId ?? f.id
    const newIdx = heights.length
    const inv = findOrCreateInvoice(todayStr, clientId, clientName, f.tailNumber)
    upsertInvoice(inv)
    addLineItem(inv.id, {
      type: 'tow', flightId: f.id,
      description: `Tow ${newIdx + 1} to ${h.toLocaleString()} ft (additional)`,
      qty: 1, rate: price, amount: price,
    })
    updateFlight(f.id, {
      towInfo: { ...f.towInfo, towHeights: [...heights, h], numTows: heights.length + 1, billedTows: [...billedTows, newIdx] },
    })
  }

  function billHours() {
    const hrs = parseFloat(actualHours)
    if (!hrs || hrs <= 0) return
    const clientName = f.pic ?? '—'
    const clientId   = f.picId ?? f.id
    const inv = findOrCreateInvoice(todayStr, clientId, clientName, f.tailNumber)
    upsertInvoice(inv)
    if (isClubGlider) {
      addLineItem(inv.id, {
        type: 'rental', flightId: f.id,
        description: `Glider rental — ${hrs}h (${f.tailNumber})`,
        qty: hrs, rate: GLIDER_PRICING.gliderRentalPerHr, amount: Math.round(hrs * GLIDER_PRICING.gliderRentalPerHr * 100) / 100,
      })
    }
    if (isDual) {
      addLineItem(inv.id, {
        type: 'instruction', flightId: f.id,
        description: `Dual instruction — ${hrs}h`,
        qty: hrs, rate: GLIDER_PRICING.instructionPerHr, amount: Math.round(hrs * GLIDER_PRICING.instructionPerHr * 100) / 100,
      })
    }
    updateFlight(f.id, { towInfo: { ...f.towInfo, billedHours: hrs }, status: 'billed' })
  }

  // Auto-mark billed when all tows done and no rental/instruction needed
  if (allTowsBilled && !isClubGlider && !isDual && f.status !== 'billed' && !cancelled && !noShow) {
    updateFlight(f.id, { status: 'billed' })
  }

  // Status badge
  const badge = cancelled ? { text: 'CANCELLED', cls: 'border-slate-500/40 text-slate-500' }
    : noShow    ? { text: 'NO-SHOW',   cls: 'border-orange-500/40 bg-orange-500/10 text-orange-400' }
    : fullyBilled ? { text: 'BILLED', cls: 'border-green-500/40 bg-green-500/10 text-green-400' }
    : isStandby ? { text: 'STANDBY',  cls: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' }
    : null

  // Summary line: tow progress
  const towSummary = heights.length > 0
    ? `${billedTows.length}/${heights.length} tows · $${totalTowCost}`
    : 'Self-launch'

  return (
    <div className={`bg-surface-card border rounded-lg transition-opacity ${
      cancelled || noShow ? 'opacity-40 border-dashed border-surface-border'
        : fullyBilled ? 'border-green-500/30'
        : 'border-surface-border'
    }`}>
      {/* ── Compact summary line ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] text-slate-600 w-4">{expanded ? '▾' : '▸'}</span>
        <span className="text-xs font-mono text-slate-500 w-12">{fmtTime(new Date(f.plannedDepartureUtc))}</span>
        {badge && <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${badge.cls}`}>{badge.text}</span>}
        <span className="text-xs font-mono font-bold text-slate-100">{f.tailNumber}</span>
        <span className="text-[10px] text-slate-400 truncate" title={isDual ? `Instructor: ${f.pic} · Student: ${f.sic}` : `PIC: ${f.pic}`}>
          {isDual ? '🎓👤' : f.sic ? '👤👤' : '👤'}{' '}{f.pic}{isDual ? ` + ${f.sic}` : ''}
        </span>
        <span className="text-[10px] text-slate-500 ml-auto flex-shrink-0">{towSummary}</span>
        {hoursBilled && <span className="text-[9px] text-green-400 flex-shrink-0">{billedHours}h</span>}

        {/* Quick bill button — next unbilled tow */}
        {!cancelled && !noShow && !allTowsBilled && nextTowIdx < heights.length && (
          <button
            onClick={(e) => { e.stopPropagation(); billTow(nextTowIdx) }}
            className="flex-shrink-0 px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors text-[9px]"
          >
            Bill Tow {nextTowIdx + 1} · ${towPrice(heights[nextTowIdx])}
          </button>
        )}

        {/* Extra tow — always visible when all tows billed */}
        {allTowsBilled && !cancelled && !noShow && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-0.5">
              {TOW_HEIGHTS.map((h) => (
                <button key={h} onClick={() => setExtraHeight(h)}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono ${extraHeight === h ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                  {h / 1000}k
                </button>
              ))}
            </div>
            <button onClick={billExtraTow}
              className="px-2 py-0.5 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 text-[9px] whitespace-nowrap">
              + Tow ${towPrice(extraHeight)}
            </button>
          </div>
        )}

        {/* Hours billing — inline when tows done but hours not billed */}
        {(isClubGlider || isDual) && allTowsBilled && !cancelled && !noShow && !hoursBilled && (
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <input type="number" step="0.1" min="0.1" value={actualHours} onChange={(e) => setActualHours(e.target.value)}
              placeholder="hrs" className="bg-surface-card border border-surface-border rounded px-1.5 py-0.5 text-[9px] text-slate-100 font-mono w-12 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600" />
            <button onClick={billHours} disabled={!actualHours || parseFloat(actualHours) <= 0}
              className="px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 text-[9px] disabled:opacity-40 whitespace-nowrap">
              Bill {actualHours || '—'}h{isClubGlider ? ' rental' : ''}{isDual ? ' +instr' : ''}
            </button>
          </div>
        )}

        {/* Restore for cancelled/no-show */}
        {(cancelled || noShow) && (
          <button
            onClick={(e) => { e.stopPropagation(); updateFlight(f.id, { status: 'planned' }) }}
            className="flex-shrink-0 text-[9px] px-2 py-0.5 rounded border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-colors"
          >
            Restore
          </button>
        )}
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-surface-border pt-2">
          {/* Per-tow rows */}
          {heights.length > 0 && (
            <div className="flex flex-col gap-1">
              {heights.map((h, i) => {
                const isBilled = billedTows.includes(i)
                const isNext   = i === nextTowIdx && !cancelled && !noShow
                return (
                  <div key={i} className={`flex items-center justify-between text-[10px] rounded px-2 py-1 ${
                    isBilled ? 'bg-green-500/5 border border-green-500/20' : 'border border-surface-border'
                  }`}>
                    <span className={isBilled ? 'text-green-400' : 'text-slate-400'}>
                      Tow {i + 1}: {h.toLocaleString()} ft · {towCycleMin(h)} min
                      {isBilled && ' ✓'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-300">${towPrice(h)}</span>
                      {isNext && (
                        <button onClick={() => billTow(i)} className="px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 text-[10px]">
                          Bill
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Extra tow standby */}
              {allTowsBilled && !cancelled && !noShow && (
                <div className="flex items-center justify-between text-[10px] rounded px-2 py-1 border border-dashed border-yellow-500/30 bg-yellow-500/5">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">Extra tow</span>
                    <div className="flex gap-0.5">
                      {TOW_HEIGHTS.map((h) => (
                        <button key={h} onClick={() => setExtraHeight(h)}
                          className={`px-1 py-0.5 rounded text-[9px] font-mono ${extraHeight === h ? 'bg-yellow-500/20 text-yellow-300' : 'text-slate-500'}`}>
                          {h / 1000}k
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-yellow-300">${towPrice(extraHeight)}</span>
                    <button onClick={billExtraTow} className="px-2 py-0.5 rounded border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 text-[10px]">
                      Bill
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hours billing */}
          {(isClubGlider || isDual) && !cancelled && !noShow && !hoursBilled && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-500">
                {isClubGlider ? `Rental $${GLIDER_PRICING.gliderRentalPerHr}/hr` : ''}
                {isClubGlider && isDual ? ' + ' : ''}
                {isDual ? `Instr $${GLIDER_PRICING.instructionPerHr}/hr` : ''}
              </span>
              <input type="number" step="0.1" min="0.1" value={actualHours} onChange={(e) => setActualHours(e.target.value)}
                placeholder="hrs" className="bg-surface-card border border-surface-border rounded px-1.5 py-0.5 text-[10px] text-slate-100 font-mono w-14 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600" />
              {actualHours && parseFloat(actualHours) > 0 && (
                <span className="font-mono text-slate-300">
                  ${((isClubGlider ? GLIDER_PRICING.gliderRentalPerHr : 0) + (isDual ? GLIDER_PRICING.instructionPerHr : 0) * parseFloat(actualHours)).toFixed(0)}
                </span>
              )}
              <button onClick={billHours} disabled={!actualHours || parseFloat(actualHours) <= 0}
                className="px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 text-[10px] disabled:opacity-40">
                Bill {actualHours || '—'}h
              </button>
            </div>
          )}

          {hoursBilled && (
            <div className="text-[10px] text-green-400">{billedHours}h billed
              {isClubGlider && ` · $${(billedHours * GLIDER_PRICING.gliderRentalPerHr).toFixed(2)} rental`}
              {isDual && ` · $${(billedHours * GLIDER_PRICING.instructionPerHr).toFixed(2)} instruction`}
            </div>
          )}

          {/* Actions */}
          {!cancelled && !noShow && !fullyBilled && (
            <div className="flex gap-2">
              <button onClick={() => updateFlight(f.id, { status: 'no_show' })}
                className="text-[10px] px-2 py-0.5 rounded border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20">No-Show</button>
              <button onClick={() => updateFlight(f.id, { status: 'cancelled' })}
                className="text-[10px] px-2 py-0.5 rounded border border-slate-500/40 text-slate-500 hover:text-slate-300">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FlightsTab({ flights }) {
  const [filter, setFilter] = useStickyState('glider_flightsFilter', 'today')   // today | now | week
  const [offset, setOffset] = useState(0)          // day/week offset from current

  const nowMs = Date.now()
  const NOW_WINDOW = 30 * 60_000  // 30 minutes

  // Compute window boundaries
  let windowStart, windowEnd, windowLabel
  if (filter === 'now') {
    windowStart = nowMs - NOW_WINDOW
    windowEnd   = nowMs + NOW_WINDOW
    windowLabel = 'Now'
  } else if (filter === 'week') {
    const d = new Date()
    const dayOfWeek = (d.getDay() + 6) % 7
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek + offset * 7)
    mon.setHours(0, 0, 0, 0)
    windowStart = mon.getTime()
    windowEnd   = windowStart + 7 * 86_400_000
    windowLabel = `Week of ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  } else {
    const d = new Date()
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
    day.setHours(0, 0, 0, 0)
    windowStart = day.getTime()
    windowEnd   = windowStart + 86_400_000
    windowLabel = offset === 0 ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const isGliderFlight = (f) => isTowFlight(f, AIRPORT) || f.missionType === 'glider_flight'

  // Filter flights to window
  const windowFlights = flights.filter((f) => {
    if (!isGliderFlight(f)) return false
    const depMs = new Date(f.plannedDepartureUtc).getTime()
    const endMs = f.plannedArrivalUtc ? new Date(f.plannedArrivalUtc).getTime() : depMs + 90 * 60_000
    // Flight overlaps window if it departs before window ends and ends after window starts
    return depMs < windowEnd && endMs > windowStart
  }).sort((a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc))

  // NOW detection: departing in next 30 min, underway, or finished in last 30 min
  function isNowFlight(f) {
    const depMs = new Date(f.plannedDepartureUtc).getTime()
    const endMs = f.plannedArrivalUtc ? new Date(f.plannedArrivalUtc).getTime() : depMs + 90 * 60_000
    return depMs <= nowMs + NOW_WINDOW && endMs >= nowMs - NOW_WINDOW
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {['today', 'now', 'week'].map((v) => (
            <button
              key={v}
              onClick={() => { setFilter(v); setOffset(0) }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                filter === v
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v === 'today' ? 'Today' : v === 'now' ? 'Now' : 'Week'}
            </button>
          ))}
        </div>

        {/* Navigation arrows */}
        {filter !== 'now' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((v) => v - 1)}
              className="text-slate-400 hover:text-slate-200 text-sm px-2"
            >‹</button>
            <span className="text-xs text-slate-300 min-w-[120px] text-center">{windowLabel}</span>
            <button
              onClick={() => setOffset((v) => v + 1)}
              className="text-slate-400 hover:text-slate-200 text-sm px-2"
            >›</button>
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline underline-offset-2"
              >
                {filter === 'today' ? 'Today' : 'This week'}
              </button>
            )}
          </div>
        )}

        <span className="text-[10px] text-slate-500">{windowFlights.length} flight{windowFlights.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Flight cards */}
      {windowFlights.length === 0 && (
        <p className="text-sm text-slate-500 italic">No glider flights in this window.</p>
      )}
      {windowFlights.map((f) => {
        const isNow = isNowFlight(f)
        return (
          <div key={f.id} className={isNow ? 'rounded-xl ring-1 ring-yellow-500/30 bg-yellow-500/[0.03] p-1' : ''}>
            {isNow && (
              <div className="flex items-center gap-1.5 px-3 py-1 text-[9px] text-yellow-400 font-semibold uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Active
              </div>
            )}
            <FlightCard f={f} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Pilot Schedule ──────────────────────────────────────────────────────────

const DAYS        = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const BLOCK_LABEL = { am: '8:00 – 12:30', pm: '12:30 – 5:00' }
const BLOCK_MIN   = { am: 270, pm: 270 }  // 4.5 hours each

const BASE_SCHED_KEY  = 'flightsafe_tow_base_sched'
const SCHED_ADJ_KEY   = 'flightsafe_tow_sched_adj'
const NOSHOW_KEY      = 'flightsafe_pilot_noshows'
const WW_BASE_KEY     = 'flightsafe_ww_base_sched'
const WW_ADJ_KEY      = 'flightsafe_ww_sched_adj'

function getNoShows() {
  try { return JSON.parse(localStorage.getItem(NOSHOW_KEY) || '[]') } catch { return [] }
}
function saveNoShows(ns) { localStorage.setItem(NOSHOW_KEY, JSON.stringify(ns)) }

function getBaseOverrides() {
  try { return JSON.parse(localStorage.getItem(BASE_SCHED_KEY) || '{}') } catch { return {} }
}
function saveBaseOverrides(o) { localStorage.setItem(BASE_SCHED_KEY, JSON.stringify(o)) }

function getSchedAdjustments() {
  try { return JSON.parse(localStorage.getItem(SCHED_ADJ_KEY) || '[]') } catch { return [] }
}
function saveSchedAdjustments(a) { localStorage.setItem(SCHED_ADJ_KEY, JSON.stringify(a)) }

// Wing walker schedule storage
function getWwBaseOverrides() {
  try { return JSON.parse(localStorage.getItem(WW_BASE_KEY) || '{}') } catch { return {} }
}
function saveWwBaseOverrides(o) { localStorage.setItem(WW_BASE_KEY, JSON.stringify(o)) }
function getWwAdjustments() {
  try { return JSON.parse(localStorage.getItem(WW_ADJ_KEY) || '[]') } catch { return [] }
}
function saveWwAdjustments(a) { localStorage.setItem(WW_ADJ_KEY, JSON.stringify(a)) }

/** Resolve base schedule for a pilot: mock default merged with localStorage overrides */
function resolvedBase(pilot, overrides) {
  const mock = pilot.towBaseSchedule ?? {}
  const ov   = overrides[pilot.id]
  if (!ov) return mock
  const merged = {}
  for (const d of DAYS) merged[d] = ov[d] ?? mock[d] ?? []
  return merged
}

/** Resolve base schedule for a wing walker */
function resolvedWwBase(ww, overrides) {
  const mock = ww.wingWalkerBaseSchedule ?? {}
  const ov   = overrides[ww.id]
  if (!ov) return mock
  const merged = {}
  for (const d of DAYS) merged[d] = ov[d] ?? mock[d] ?? []
  return merged
}

/** Effective blocks for a wing walker on a date (base + adjustments) */
function wwEffectiveBlocks(ww, date, wwBaseOv, wwAdj) {
  const dayOfWeek = DAYS[(date.getDay() + 6) % 7]
  const base = new Set(resolvedWwBase(ww, wwBaseOv)[dayOfWeek] ?? [])
  const dk = date.toISOString().split('T')[0]
  for (const adj of wwAdj) {
    if (adj.pilotId !== ww.id || adj.date !== dk) continue
    if (adj.type === 'add')    base.add(adj.block)
    if (adj.type === 'remove') base.delete(adj.block)
  }
  return base
}

/** Count wing walkers available for a date/block */
function wwCountForBlock(date, block, wwBaseOv, wwAdj) {
  return WING_WALKERS.filter((ww) => wwEffectiveBlocks(ww, date, wwBaseOv, wwAdj).has(block)).length
}

/**
 * Maximum bipartite matching — pilots → planes they can fly.
 */
function maxPilotPlaneMatching(pilots, planes) {
  const planeMatch = {}
  function tryAssign(pilotId, checkouts, visited) {
    for (const acId of checkouts) {
      if (visited.has(acId)) continue
      visited.add(acId)
      if (!planeMatch[acId] || tryAssign(planeMatch[acId], pilots.find((p) => p.id === planeMatch[acId])?.towCheckouts ?? [], visited)) {
        planeMatch[acId] = pilotId
        return true
      }
    }
    return false
  }
  let matched = 0
  for (const p of pilots) {
    const valid = (p.towCheckouts ?? []).filter((ac) => planes.some((pl) => pl.id === ac))
    if (valid.length && tryAssign(p.id, valid, new Set())) matched++
  }
  return { matched, assignments: planeMatch }
}

/** Effective blocks for a pilot on a specific date (base + adjustments - no-shows) */
function effectiveBlocksForDate(pilot, date, baseOverrides, adjustments, noShows = []) {
  const dayOfWeek = DAYS[(date.getDay() + 6) % 7]
  const base = new Set(resolvedBase(pilot, baseOverrides)[dayOfWeek] ?? [])
  const dk = date.toISOString().split('T')[0]
  for (const adj of adjustments) {
    if (adj.pilotId !== pilot.id || adj.date !== dk) continue
    if (adj.type === 'add')    base.add(adj.block)
    if (adj.type === 'remove') base.delete(adj.block)
  }
  // Remove no-show blocks
  for (const ns of noShows) {
    if (ns.pilotId !== pilot.id || ns.date !== dk) continue
    if (ns.block === 'all') { base.delete('am'); base.delete('pm') }
    else base.delete(ns.block)
  }
  return base
}

function PilotSchedule({ squawks }) {
  const [view, setView]               = useStickyState('glider_pilotSchedView', 'base')  // 'base' | 'month'
  const [baseOverrides, setBaseOv]    = useState(getBaseOverrides)
  const [adjustments, setAdjustments] = useState(getSchedAdjustments)
  const [noShows, setNoShows]         = useState(getNoShows)
  const [wwBaseOv, setWwBaseOv]       = useState(getWwBaseOverrides)
  const [wwAdj, setWwAdj]             = useState(getWwAdjustments)
  const [monthOffset, setMonthOffset] = useState(0)  // 0 = current month

  const towPilots = mockPersonnel.filter((p) => p.towCertified)
  const airworthyPlanes = ALL_TOW_AIRCRAFT.filter((a) => !isAircraftGrounded(a.id, mockAircraft, squawks))

  function toggleNoShow(pilotId, date, block) {
    const dk = date.toISOString().split('T')[0]
    const exists = noShows.some((ns) => ns.pilotId === pilotId && ns.date === dk && (ns.block === block || ns.block === 'all'))
    let next
    if (exists) {
      next = noShows.filter((ns) => !(ns.pilotId === pilotId && ns.date === dk && (ns.block === block || ns.block === 'all')))
    } else {
      next = [...noShows, { pilotId, date: dk, block }]
    }
    setNoShows(next)
    saveNoShows(next)
  }

  // ── Base schedule helpers ───────────────────────────────────────────────────
  function toggleBase(pilotId, day, block) {
    const pilot = towPilots.find((p) => p.id === pilotId)
    const cur = resolvedBase(pilot, baseOverrides)
    const blocks = cur[day] ?? []
    const has = blocks.includes(block)
    const next = has ? blocks.filter((b) => b !== block) : [...blocks, block]
    const updated = { ...baseOverrides, [pilotId]: { ...resolvedBase(pilot, baseOverrides), [day]: next } }
    setBaseOv(updated)
    saveBaseOverrides(updated)
  }

  // ── Month calendar helpers ──────────────────────────────────────────────────
  const now       = new Date()
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay  = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const startPad  = (firstDay.getDay() + 6) % 7  // Mon=0
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()

  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0]

  function calDate(cellIdx) {
    const d = cellIdx - startPad + 1
    if (d < 1 || d > daysInMonth) return null
    return new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)
  }

  function toggleCalAdj(pilotId, date, block) {
    const dk = date.toISOString().split('T')[0]
    const pilot = towPilots.find((p) => p.id === pilotId)
    const dayOfWeek = DAYS[(date.getDay() + 6) % 7]
    const baseHas = (resolvedBase(pilot, baseOverrides)[dayOfWeek] ?? []).includes(block)
    const existing = adjustments.some((a) => a.pilotId === pilotId && a.date === dk && a.block === block)

    let next = adjustments.filter((a) => !(a.pilotId === pilotId && a.date === dk && a.block === block))
    if (!existing) {
      next.push({ pilotId, date: dk, block, type: baseHas ? 'remove' : 'add' })
    }
    setAdjustments(next)
    saveSchedAdjustments(next)
  }

  // ── Wing walker schedule helpers ──────────────────────────────────────────
  function toggleWwBase(wwId, day, block) {
    const ww = WING_WALKERS.find((w) => w.id === wwId)
    const cur = resolvedWwBase(ww, wwBaseOv)
    const blocks = cur[day] ?? []
    const has = blocks.includes(block)
    const next = has ? blocks.filter((b) => b !== block) : [...blocks, block]
    const updated = { ...wwBaseOv, [wwId]: { ...resolvedWwBase(ww, wwBaseOv), [day]: next } }
    setWwBaseOv(updated)
    saveWwBaseOverrides(updated)
  }

  function toggleWwAdj(wwId, date, block) {
    const dk = date.toISOString().split('T')[0]
    const ww = WING_WALKERS.find((w) => w.id === wwId)
    const dayOfWeek = DAYS[(date.getDay() + 6) % 7]
    const baseHas = (resolvedWwBase(ww, wwBaseOv)[dayOfWeek] ?? []).includes(block)
    const existing = wwAdj.some((a) => a.pilotId === wwId && a.date === dk && a.block === block)
    let next = wwAdj.filter((a) => !(a.pilotId === wwId && a.date === dk && a.block === block))
    if (!existing) {
      next.push({ pilotId: wwId, date: dk, block, type: baseHas ? 'remove' : 'add' })
    }
    setWwAdj(next)
    saveWwAdjustments(next)
  }

  function dayCapacityForDate(date) {
    const results = {}
    for (const block of ['am', 'pm']) {
      const avail = towPilots.filter((p) => effectiveBlocksForDate(p, date, baseOverrides, adjustments, noShows).has(block))
      const { matched } = maxPilotPlaneMatching(avail, airworthyPlanes)
      const ww = wwCountForBlock(date, block, wwBaseOv, wwAdj)
      results[block] = { pilots: avail.length, matched, towMin: matched * BLOCK_MIN[block], wingWalkers: ww }
    }
    return results
  }

  // Total cells = pad + days, rounded up to full weeks
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7

  return (
    <div className="flex flex-col gap-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 self-start">
        {[
          { key: 'base',  label: 'Base Schedule' },
          { key: 'month', label: 'Monthly Calendar' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === key
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── BASE SCHEDULE ── */}
      {view === 'base' && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-slate-500">
            Recurring weekly availability — click to toggle AM/PM blocks
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-slate-400 uppercase tracking-wide text-[10px] pb-2 pr-4 whitespace-nowrap">Pilot</th>
                  <th className="text-left text-slate-400 uppercase tracking-wide text-[10px] pb-2 pr-2 whitespace-nowrap">Aircraft</th>
                  {DAYS.map((d, di) => (
                    <th key={d} colSpan={2} className="text-center text-[10px] uppercase tracking-wide text-slate-400 pb-2 px-1">
                      {DAY_LABELS[di]}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th colSpan={2} />
                  {DAYS.flatMap((d) => [
                    <th key={`${d}-am-h`} className="text-[7px] text-slate-600 font-normal pb-1 px-0.5" title={BLOCK_LABEL.am}>8–12:30</th>,
                    <th key={`${d}-pm-h`} className="text-[7px] text-slate-600 font-normal pb-1 px-0.5" title={BLOCK_LABEL.pm}>12:30–5</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {towPilots.map((pilot) => {
                  const base = resolvedBase(pilot, baseOverrides)
                  const checkoutTails = (pilot.towCheckouts ?? [])
                    .map((acId) => ALL_TOW_AIRCRAFT.find((a) => a.id === acId))
                    .filter(Boolean)
                  return (
                    <tr key={pilot.id} className="border-t border-surface-border">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <div className="text-slate-200 font-medium">{pilot.name}</div>
                        <div className="text-[10px] text-slate-500">{pilot.certType}</div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-1 flex-wrap">
                          {checkoutTails.map((a) => (
                            <span key={a.id} className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${a.airworthy ? 'bg-slate-700/60 text-slate-300' : 'bg-red-500/10 text-red-400 line-through'}`}>
                              {a.tailNumber}
                            </span>
                          ))}
                        </div>
                      </td>
                      {DAYS.map((day) =>
                        ['am', 'pm'].map((block) => {
                          const active = (base[day] ?? []).includes(block)
                          return (
                            <td key={`${day}-${block}`} className="px-0.5 py-2">
                              <button
                                onClick={() => toggleBase(pilot.id, day, block)}
                                title={`${pilot.name} · ${day.toUpperCase()} ${block.toUpperCase()} (${BLOCK_LABEL[block]})`}
                                className={`w-full h-6 rounded text-[9px] font-medium transition-colors ${
                                  active
                                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    : 'bg-slate-800/30 text-slate-600 border border-transparent hover:border-slate-600'
                                }`}
                              >
                                {active ? '●' : ''}
                              </button>
                            </td>
                          )
                        })
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Wing Walker schedule */}
          <div className="mt-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Wing Walkers</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-slate-400 uppercase tracking-wide text-[10px] pb-2 pr-4 whitespace-nowrap">Name</th>
                    {DAYS.map((d, di) => (
                      <th key={d} colSpan={2} className="text-center text-[10px] uppercase tracking-wide text-slate-400 pb-2 px-1">
                        {DAY_LABELS[di]}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th />
                    {DAYS.flatMap((d) => [
                      <th key={`${d}-am-ww`} className="text-[7px] text-slate-600 font-normal pb-1 px-0.5">AM</th>,
                      <th key={`${d}-pm-ww`} className="text-[7px] text-slate-600 font-normal pb-1 px-0.5">PM</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {WING_WALKERS.map((ww) => {
                    const base = resolvedWwBase(ww, wwBaseOv)
                    return (
                      <tr key={ww.id} className="border-t border-surface-border">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <div className="text-slate-200 font-medium">{ww.name}</div>
                          <div className="text-[10px] text-slate-500">{ww.roleLabel}</div>
                        </td>
                        {DAYS.map((day) =>
                          ['am', 'pm'].map((block) => {
                            const active = (base[day] ?? []).includes(block)
                            return (
                              <td key={`${day}-${block}`} className="px-0.5 py-2">
                                <button
                                  onClick={() => toggleWwBase(ww.id, day, block)}
                                  title={`${ww.name} · ${day.toUpperCase()} ${block.toUpperCase()}`}
                                  className={`w-full h-6 rounded text-[9px] font-medium transition-colors ${
                                    active
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-slate-800/30 text-slate-600 border border-transparent hover:border-slate-600'
                                  }`}
                                >
                                  {active ? '●' : ''}
                                </button>
                              </td>
                            )
                          })
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY CALENDAR ── */}
      {view === 'month' && (
        <div className="flex flex-col gap-4">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMonthOffset((v) => v - 1)} className="text-slate-400 hover:text-slate-200 text-sm px-2">‹</button>
            <span className="text-sm font-semibold text-slate-200 min-w-[140px] text-center">{monthName}</span>
            <button onClick={() => setMonthOffset((v) => v + 1)} className="text-slate-400 hover:text-slate-200 text-sm px-2">›</button>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[10px] text-slate-500 hover:text-slate-300 underline underline-offset-2">Today</button>
            )}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-surface-border rounded-lg overflow-hidden">
            {/* Day headers */}
            {DAY_LABELS.map((d) => (
              <div key={d} className="bg-surface-card text-center text-[10px] text-slate-500 uppercase tracking-wide py-1.5">{d}</div>
            ))}

            {/* Day cells */}
            {Array.from({ length: totalCells }, (_, ci) => {
              const date = calDate(ci)
              if (!date) return <div key={ci} className="bg-surface-card/50 min-h-[80px]" />

              const dk      = date.toISOString().split('T')[0]
              const isToday = dk === todayStr
              const cap     = dayCapacityForDate(date)
              const dayAdjs = adjustments.filter((a) => a.date === dk)

              return (
                <div key={ci} className={`bg-surface-card min-h-[80px] p-1.5 flex flex-col gap-1 ${isToday ? 'ring-1 ring-inset ring-sky-500/50' : ''}`}>
                  <div className={`text-[10px] font-mono ${isToday ? 'text-sky-400 font-bold' : 'text-slate-400'}`}>
                    {date.getDate()}
                  </div>
                  {/* AM / PM capacity */}
                  {['am', 'pm'].map((block) => {
                    const c = cap[block]
                    const hasAdj = dayAdjs.some((a) => a.block === block)
                    const color = c.matched === 0 ? 'text-slate-600 bg-slate-800/20'
                      : c.matched >= airworthyPlanes.length ? 'text-green-400 bg-green-500/10'
                      : 'text-yellow-400 bg-yellow-500/10'
                    return (
                      <div key={block} className={`flex items-center justify-between rounded px-1 py-0.5 text-[9px] ${color}`}>
                        <span className="uppercase font-medium">{block}</span>
                        <span className="font-mono flex items-center gap-1">
                          {c.matched}/{airworthyPlanes.length}
                          {c.wingWalkers > 0 && <span className="text-amber-300" title={`${c.wingWalkers} wing walker${c.wingWalkers !== 1 ? 's' : ''}`}>🚶{c.wingWalkers}</span>}
                          {c.wingWalkers === 0 && <span className="text-red-400" title="No wing walker">🚶0</span>}
                          {hasAdj && <span className="ml-0.5 text-amber-400">*</span>}
                        </span>
                      </div>
                    )
                  })}
                  {/* Pilot + wing walker initials */}
                  <div className="flex gap-0.5 flex-wrap mt-auto">
                    {towPilots.map((p) => {
                      const eff = effectiveBlocksForDate(p, date, baseOverrides, adjustments, noShows)
                      if (eff.size === 0) return null
                      const pAdj = dayAdjs.filter((a) => a.pilotId === p.id)
                      const initials = p.name.split(/[\s,]+/).filter(Boolean).map((w) => w[0]).join('')
                      return (
                        <span
                          key={p.id}
                          title={`${p.name}: ${[...eff].join('+').toUpperCase()}${pAdj.length ? ' (adjusted)' : ''}`}
                          className={`text-[8px] px-1 rounded ${pAdj.length ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/40 text-slate-400'}`}
                        >
                          {initials}
                        </span>
                      )
                    })}
                    {WING_WALKERS.map((ww) => {
                      const eff = wwEffectiveBlocks(ww, date, wwBaseOv, wwAdj)
                      if (eff.size === 0) return null
                      const initials = ww.name.split(/[\s,]+/).filter(Boolean).map((w) => w[0]).join('')
                      return (
                        <span
                          key={ww.id}
                          title={`${ww.name} (WW): ${[...eff].join('+').toUpperCase()}`}
                          className="text-[8px] px-1 rounded bg-amber-500/15 text-amber-400"
                        >
                          {initials}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Adjustment editor for selected pilots */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Schedule Changes</div>
            <div className="text-xs text-slate-500">Click a pilot's cell below to add or remove them from a specific date.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[10px] text-slate-400 uppercase pb-1 pr-3">Pilot</th>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)
                      const isToday = d.toISOString().split('T')[0] === todayStr
                      return (
                        <th key={i} className={`text-center text-[8px] pb-1 px-0 min-w-[18px] ${isToday ? 'text-sky-400' : 'text-slate-600'}`}>
                          {i + 1}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {towPilots.map((pilot) => (
                    ['am', 'pm'].map((block) => (
                      <tr key={`${pilot.id}-${block}`} className={block === 'am' ? 'border-t border-surface-border' : ''}>
                        {block === 'am' ? (
                          <td rowSpan={2} className="pr-3 py-1 whitespace-nowrap align-middle">
                            <div className="text-slate-200 font-medium text-[10px]">{pilot.name}</div>
                          </td>
                        ) : null}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)
                          const dk = d.toISOString().split('T')[0]
                          const isNoShow = noShows.some((ns) => ns.pilotId === pilot.id && ns.date === dk && (ns.block === block || ns.block === 'all'))
                          const eff = effectiveBlocksForDate(pilot, d, baseOverrides, adjustments, noShows)
                          const active = eff.has(block)
                          const dayOfWeek = DAYS[(d.getDay() + 6) % 7]
                          const baseHas = (resolvedBase(pilot, baseOverrides)[dayOfWeek] ?? []).includes(block)
                          const isAdded   = active && !baseHas
                          const isRemoved = !active && baseHas
                          return (
                            <td key={i} className="px-0 py-0.5">
                              <button
                                onClick={() => toggleCalAdj(pilot.id, d, block)}
                                onContextMenu={(e) => { e.preventDefault(); toggleNoShow(pilot.id, d, block) }}
                                className={`w-full h-3.5 rounded-sm text-[7px] font-bold transition-colors ${
                                  isNoShow  ? 'bg-orange-500/30 border border-orange-500/50 text-orange-300' :
                                  isAdded   ? 'bg-green-500/30 border border-green-500/40' :
                                  isRemoved ? 'bg-red-500/20 border border-dashed border-red-500/30' :
                                  active    ? 'bg-sky-500/25' :
                                              'bg-slate-800/20 hover:bg-slate-700/30'
                                }`}
                                title={`${pilot.name} · ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${block.toUpperCase()}${isNoShow ? ' — NO SHOW' : isAdded ? ' — extra' : isRemoved ? ' — off' : ''}\nLeft-click: schedule · Right-click: no-show`}
                              >
                                {isNoShow ? 'NS' : ''}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ))}
                  {/* Wing walker rows */}
                  <tr><td colSpan={daysInMonth + 1} className="pt-3 pb-1 text-[10px] text-amber-400 font-semibold uppercase tracking-wide border-t border-amber-500/20">Wing Walkers</td></tr>
                  {WING_WALKERS.map((ww) => (
                    ['am', 'pm'].map((block) => (
                      <tr key={`${ww.id}-${block}`} className={block === 'am' ? 'border-t border-surface-border' : ''}>
                        {block === 'am' ? (
                          <td rowSpan={2} className="pr-3 py-1 whitespace-nowrap align-middle">
                            <div className="text-amber-300 font-medium text-[10px]">{ww.name}</div>
                          </td>
                        ) : null}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)
                          const dk = d.toISOString().split('T')[0]
                          const eff = wwEffectiveBlocks(ww, d, wwBaseOv, wwAdj)
                          const active = eff.has(block)
                          const dayOfWeek = DAYS[(d.getDay() + 6) % 7]
                          const baseHas = (resolvedWwBase(ww, wwBaseOv)[dayOfWeek] ?? []).includes(block)
                          const isAdded   = active && !baseHas
                          const isRemoved = !active && baseHas
                          return (
                            <td key={i} className="px-0 py-0.5">
                              <button
                                onClick={() => toggleWwAdj(ww.id, d, block)}
                                className={`w-full h-3.5 rounded-sm text-[7px] font-bold transition-colors ${
                                  isAdded   ? 'bg-green-500/30 border border-green-500/40' :
                                  isRemoved ? 'bg-red-500/20 border border-dashed border-red-500/30' :
                                  active    ? 'bg-amber-500/20' :
                                              'bg-slate-800/20 hover:bg-slate-700/30'
                                }`}
                                title={`${ww.name} (WW) · ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${block.toUpperCase()}${isAdded ? ' — extra' : isRemoved ? ' — off' : ''}`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 text-[10px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-sky-500/25" />Base</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-green-500/30 border border-green-500/40" />Extra</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-500/20 border border-dashed border-red-500/30" />Off</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-orange-500/30 border border-orange-500/50 text-[7px] font-bold text-orange-300 flex items-center justify-center">NS</span>No-show</span>
              <span className="text-slate-600">Left-click: schedule · Right-click: no-show</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 4-day forecast row ──────────────────────────────────────────────────────

function ForecastRow({ flights, schedCtx, squawks }) {
  const [offset, setOffset] = useState(0)
  const [expandedDay, setExpandedDay] = useState(null)  // Date object or null
  const expandedRef = useRef(null)
  const today = new Date()

  function selectDay(futureDate) {
    // Clicking the same day just switches — never collapses
    setExpandedDay(futureDate)
    // Scroll to the expanded panel after React renders it
    setTimeout(() => expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOffset((v) => Math.max(0, v - 4))}
          disabled={offset === 0}
          className="text-slate-500 hover:text-slate-300 disabled:opacity-20 text-sm px-1 flex-shrink-0"
        >‹</button>
        <div className="grid grid-cols-4 gap-2 flex-1 min-w-0">
          {[1, 2, 3, 4].map((d) => {
            const dayOff = offset + d
            const futureDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOff)
            const isSelected = expandedDay?.getTime() === futureDate.getTime()
            return (
              <div key={dayOff}
                className={`bg-surface-card border rounded-lg p-2 min-w-0 cursor-pointer transition-colors ${
                  isSelected ? 'border-sky-500/50 ring-1 ring-sky-500/20' : 'border-surface-border hover:border-sky-500/30'
                }`}
                onClick={() => selectDay(futureDate)}
              >
                <TowViolinChart
                  flights={flights}
                  schedCtx={schedCtx}
                  squawks={squawks}
                  mxWindows={[]}
                  date={futureDate}
                  compact
                />
              </div>
            )
          })}
        </div>
        <button
          onClick={() => setOffset((v) => v + 4)}
          className="text-slate-500 hover:text-slate-300 text-sm px-1 flex-shrink-0"
        >›</button>
      </div>

      {/* Expanded day — full violin as inline panel */}
      {expandedDay && (
        <div ref={expandedRef} className="bg-surface-card border border-sky-500/30 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-300 mb-2">
            {expandedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <TowViolinChart
            flights={flights}
            schedCtx={schedCtx}
            squawks={squawks}
            mxWindows={[]}
            date={expandedDay}
          />
        </div>
      )}
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function GliderOps() {
  const [flights,      setFlights]      = useState([])
  const [squawks,      setSquawks]      = useState(getSquawks)
  const [invoices,     setInvoices]     = useState(getInvoices)
  const [clients,      setClients]      = useState(getClients)
  const [activeTab,    setActiveTab]    = useStickyState('glider_activeTab', 'board')
  const [showSettings, setShowSettings] = useState(false)
  const [squawkFormFor, setSquawkFormFor] = useState(null)
  const [adsbTowState, setAdsbTowState] = useState([])      // live tow plane state from ADS-B
  const [adsbLivePositions, setAdsbLivePositions] = useState([])  // all fleet live positions
  const [adsbStatus, setAdsbStatus] = useState('connecting') // 'connecting' | 'live' | 'unavailable'

  useEffect(() => {
    setFlights(getAllFlights())
    const handler = () => setFlights(getAllFlights())
    window.addEventListener('flightsafe:scheduled', handler)
    const unsubSqk = subscribeSquawks(setSquawks)
    const unsubInv = subscribeInvoices(setInvoices)
    const unsubCli = subscribeClients(setClients)
    const stopAdsb = pollAdsbState(({ towPlanes, livePositions, error }) => {
      if (error) {
        setAdsbStatus('unavailable')
      } else {
        setAdsbStatus('live')
        setAdsbTowState(towPlanes)
        setAdsbLivePositions(livePositions)
      }
    })
    return () => { window.removeEventListener('flightsafe:scheduled', handler); unsubSqk(); unsubInv(); unsubCli(); stopAdsb() }
  }, [])

  // Schedule context for violin supply
  const schedCtx = {
    towPilots:      mockPersonnel.filter((p) => p.towCertified),
    planes:         ALL_TOW_AIRCRAFT.filter((a) => !isAircraftGrounded(a.id, mockAircraft, squawks)),
    baseOverrides:  getBaseOverrides(),
    adjustments:    getSchedAdjustments(),
    noShows:        getNoShows(),
  }

  // Wing walker counts for today
  const _wwBaseOv = getWwBaseOverrides()
  const _wwAdj    = getWwAdjustments()
  const _today    = new Date()
  const wwCountAm = wwCountForBlock(_today, 'am', _wwBaseOv, _wwAdj)
  const wwCountPm = wwCountForBlock(_today, 'pm', _wwBaseOv, _wwAdj)

  const reservations  = computeTowReservations(flights, AIRPORT)
  const dayStart      = todayStartMs()
  const periods       = computePeriodWaits(reservations, dayStart)
  const activePeriods = periods.filter((p) => p.count > 0)

  const confirmed = reservations.filter((r) => !r.isStandby)
  const standby   = reservations.filter((r) => r.isStandby)

  return (
    <div className="flex flex-col gap-6" data-testid="glider-ops">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Glider Operations</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Tow scheduling, capacity management, and wait time analysis for {AIRPORT}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Summary chips */}
          <span className="text-xs px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-400">
            {confirmed.length} confirmed
          </span>
          {standby.length > 0 && (
            <span className="text-xs px-2 py-1 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
              {standby.length} standby
            </span>
          )}
          <button
            onClick={() => setActiveTab('new')}
            className="text-xs px-3 py-1.5 rounded border border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition-colors"
          >
            + New Reservation
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="text-xs px-3 py-1.5 rounded border border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-wrap gap-6 text-xs">
          <div className="text-slate-400 uppercase tracking-wide text-[10px] w-full">
            Tow Settings — read only (edit in gliderUtils.js)
          </div>
          {[
            { label: 'Tows / hour',           value: TOW_SETTINGS.towsPerHour,        unit: 'tows' },
            { label: 'Hookup time',              value: TOW_SETTINGS.hookupTimeMin,      unit: 'min' },
            { label: 'Tow time / 1,000 ft',   value: TOW_SETTINGS.minutesPer1000ft,   unit: 'min' },
            { label: 'Aloft time / 1,000 ft', value: TOW_SETTINGS.timeAloftPer1000ft, unit: 'min' },
          ].map(({ label, value, unit }) => (
            <div key={label}>
              <div className="text-slate-500">{label}</div>
              <div className="text-slate-200 font-mono mt-0.5">{value} {unit}</div>
            </div>
          ))}
          <div className="w-full text-slate-600 text-[10px]">
            Tow cycle examples — 1000 ft: {TOW_SETTINGS.hookupTimeMin + TOW_SETTINGS.minutesPer1000ft} min ·
            2000 ft: {TOW_SETTINGS.hookupTimeMin + 2 * TOW_SETTINGS.minutesPer1000ft} min ·
            3000 ft: {TOW_SETTINGS.hookupTimeMin + 3 * TOW_SETTINGS.minutesPer1000ft} min
          </div>
        </div>
      )}

      {/* Tabs */}
      {(() => {
        const allGliders = mockAircraft.filter((a) => a.glider)
        const gliderGrounded  = allGliders.filter((a) => isAircraftGrounded(a.id, mockAircraft, squawks)).length
        const gliderAirworthy = allGliders.length - gliderGrounded
        const allTow = ALL_TOW_AIRCRAFT
        const towGrounded  = allTow.filter((a) => isAircraftGrounded(a.id, mockAircraft, squawks)).length
        const towAirworthy = allTow.length - towGrounded
        const tabs = [
          { key: 'board',   label: 'Tow Board' },
          { key: 'flights', label: 'Flights' },
          { key: 'gantt',   label: 'Gantt' },
          { key: 'periods', label: 'Wait Grid' },
          { key: 'pilots',  label: 'Pilot Schedule' },
          { key: 'services', label: 'Services' },
          { key: 'invoices', label: `Invoices${invoices.length ? ` (${invoices.length})` : ''}` },
          { key: 'clients', label: `Clients${(() => { const n = clients.filter((c) => c.fboCategory === 'glider').length; return n ? ` (${n})` : '' })()}` },
          {
            key: 'gliders',
            label: <span className="flex items-center gap-1.5">
              Gliders
              <span className="flex gap-0.5">
                {Array.from({ length: gliderAirworthy }, (_, i) => (
                  <span key={`g${i}`} className="w-1.5 h-1.5 rounded-full bg-green-400" />
                ))}
                {Array.from({ length: gliderGrounded }, (_, i) => (
                  <span key={`gr${i}`} className="w-1.5 h-1.5 rounded-full bg-red-400" />
                ))}
              </span>
            </span>,
          },
          {
            key: 'tow_fleet',
            label: <span className="flex items-center gap-1.5">
              Tow Planes
              <span className="flex gap-0.5">
                {Array.from({ length: towAirworthy }, (_, i) => (
                  <span key={`t${i}`} className="w-1.5 h-1.5 rounded-full bg-green-400" />
                ))}
                {Array.from({ length: towGrounded }, (_, i) => (
                  <span key={`tr${i}`} className="w-1.5 h-1.5 rounded-full bg-red-400" />
                ))}
              </span>
            </span>,
          },
        ]
        return (
          <div className="flex items-center gap-1 border-b border-surface-border pb-2">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-1.5 rounded text-sm transition-colors ${
                  activeTab === key
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* ── Tow Board ── */}
      {activeTab === 'board' && (
        <div className="flex flex-col gap-6">
          <WeatherBar />

          {/* ── ADS-B Live Status ── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status indicator — always visible */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-semibold ${
              adsbStatus === 'live' ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : adsbStatus === 'connecting' ? 'border-slate-500/30 bg-slate-500/10 text-slate-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${adsbStatus === 'connecting' ? 'animate-pulse' : ''}`} />
              {adsbStatus === 'live' ? 'ADS-B' : adsbStatus === 'connecting' ? 'ADS-B connecting' : 'ADS-B unavailable'}
            </div>

            {/* Tow plane pills */}
            {adsbTowState.map((tp) => {
              const phaseLabel = { climbing_on_tow: 'Climbing', descending: 'Descending', on_ground: 'On ground', taxiing: 'Taxiing' }
              const phaseBg = { climbing_on_tow: 'bg-sky-500/15 border-sky-500/30', descending: 'bg-amber-500/15 border-amber-500/30', on_ground: 'bg-slate-500/15 border-slate-500/30', taxiing: 'bg-slate-500/15 border-slate-500/30' }
              const phaseText = { climbing_on_tow: 'text-sky-400', descending: 'text-amber-400', on_ground: 'text-slate-400', taxiing: 'text-slate-400' }
              return (
                <div key={tp.icao} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${phaseBg[tp.phase] ?? 'bg-slate-500/15 border-slate-500/30'}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${tp.phase === 'climbing_on_tow' || tp.phase === 'descending' ? 'animate-pulse' : ''} ${phaseText[tp.phase] ?? 'text-slate-400'}`} />
                  <span className="text-xs font-mono font-bold text-slate-200">{tp.tail}</span>
                  <span className={`text-[10px] font-semibold ${phaseText[tp.phase] ?? 'text-slate-400'}`}>
                    {phaseLabel[tp.phase] ?? tp.phase}
                  </span>
                  {tp.current_alt_ft != null && (
                    <span className="text-[10px] text-slate-400">{tp.current_alt_ft.toLocaleString()} ft</span>
                  )}
                  {tp.climb_rate_fpm != null && tp.phase === 'climbing_on_tow' && (
                    <span className="text-[10px] text-sky-400">{tp.climb_rate_fpm} fpm</span>
                  )}
                  {tp.est_available_ts && (
                    <span className="text-[10px] text-green-400">
                      avail {new Date(tp.est_available_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Gliders aloft */}
            {adsbLivePositions
              .filter((ac) => ac.is_glider && ac.alt_ft > 5488)
              .map((ac) => {
                const ret = estimateGliderReturn(ac)
                return (
                  <div key={ac.icao} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-violet-500/15 border-violet-500/30">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-slate-200">{ac.tail}</span>
                    <span className="text-[10px] text-violet-300">{ac.alt_ft.toLocaleString()} ft</span>
                    {ret && (
                      <span className="text-[10px] text-slate-400">
                        ~{ret.estMinutes} min · {ret.distNm} nm out
                      </span>
                    )}
                    {ac.vs_fpm != null && ac.vs_fpm !== 0 && (
                      <span className={`text-[10px] ${ac.vs_fpm > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                        {ac.vs_fpm > 0 ? '+' : ''}{ac.vs_fpm} fpm
                      </span>
                    )}
                  </div>
                )
              })}

            {/* No tow planes tracked message */}
            {adsbStatus === 'live' && adsbTowState.length === 0 && (
              <span className="text-[10px] text-slate-500">No tow planes reporting</span>
            )}
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <TowViolinChart
              flights={flights}
              schedCtx={schedCtx}
              squawks={squawks}
              mxWindows={[]}
              onConfirmStandby={(f) => {
                updateFlight(f.id, { towInfo: { ...f.towInfo, isStandby: false } })
              }}
            />
          </div>

          {/* 4-day forecast row — compact violin charts */}
          <ForecastRow flights={flights} schedCtx={schedCtx} squawks={squawks} />

          {standby.length > 0 && (() => {
            // Check each standby to see if it can now be supported
            const WINDOW = 30 * 60_000
            const supportable = []
            const unsupportable = []
            for (const r of standby) {
              const depMs = new Date(r.plannedDepartureUtc).getTime()
              // Build a working set where this standby is tentatively promoted
              const working = flights.map((f) =>
                f.id === r.id
                  ? { ...f, towInfo: { ...f.towInfo, isStandby: false } }
                  : f
              )
              const result = towDeficiencyMin(working, AIRPORT, depMs, depMs + WINDOW)
              if (!result.isStandby) {
                supportable.push(r)
              } else {
                unsupportable.push(r)
              }
            }

            function confirmReservation(r) {
              const orig = flights.find((f) => f.id === r.id)
              if (orig) updateFlight(r.id, { towInfo: { ...orig.towInfo, isStandby: false } })
            }

            return (
              <div className="flex flex-col gap-3">
                {/* Supportable — can now be confirmed */}
                {supportable.length > 0 && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 flex flex-col gap-2">
                    <div className="text-xs text-green-400 font-semibold uppercase tracking-wide">
                      {supportable.length} Standby — capacity now available
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {supportable.map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded border border-green-500/40 text-green-300">
                            {r.ownAircraft ? 'Own Acft' : r.tailNumber}
                            {r.towInfo?.towPlaneTail ? ` → ${r.towInfo.towPlaneTail}` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {r.pic}{r.towInfo?.towHeights?.[0] ? ` · ${r.towInfo.towHeights[0].toLocaleString()} ft` : ''}
                          </span>
                          <button
                            onClick={() => confirmReservation(r)}
                            className="ml-auto inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Confirm
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unsupportable — still waiting */}
                {unsupportable.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 flex flex-col gap-2">
                    <div className="text-xs text-yellow-400 font-semibold uppercase tracking-wide">
                      {unsupportable.length} Standby — pending tow capacity
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {unsupportable.map((r) => (
                        <span key={r.id} className="text-xs font-mono px-2 py-0.5 rounded border border-yellow-500/40 text-yellow-300">
                          {r.ownAircraft ? 'Own Acft' : r.tailNumber}
                          {r.towInfo?.towPlaneTail ? ` → ${r.towInfo.towPlaneTail}` : ''}
                          <span className="text-[10px] text-yellow-400/60 ml-1">{r.pic}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {reservations.length === 0 && (
            <p className="text-sm text-slate-500 italic">No tow reservations for {AIRPORT} today.</p>
          )}
        </div>
      )}

      {/* ── Gantt ── */}
      {activeTab === 'gantt' && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4">
          <TowGantt flights={flights} squawks={squawks} />
        </div>
      )}

      {/* ── Wait Grid ── */}
      {activeTab === 'periods' && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-slate-500">
            Average wait time per 15-minute period · airport {AIRPORT} ·{' '}
            {activePeriods.length} active period{activePeriods.length !== 1 ? 's' : ''} today
          </div>
          <PeriodGrid periods={periods} wwCountAm={wwCountAm} wwCountPm={wwCountPm} />
        </div>
      )}

      {/* ── Pilot Schedule ── */}
      {activeTab === 'pilots' && <PilotSchedule squawks={squawks} />}

      {/* ── New Reservation ── */}
      {activeTab === 'new' && (
        <NewReservationPanel
          flights={flights}
          schedCtx={schedCtx}
          clients={clients}
          onScheduled={() => {
            setFlights(getAllFlights())
          }}
        />
      )}

      {/* ── Flights ── */}
      {activeTab === 'flights' && <FlightsTab flights={flights} />}

      {/* ── Glider Fleet ── */}
      {activeTab === 'gliders' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {mockAircraft.filter((a) => a.glider).map((a) => {
            const grounded = isAircraftGrounded(a.id, mockAircraft, squawks)
            const acSquawks = squawks.filter((s) =>
              (s.aircraftId === a.id || s.tailNumber === a.tailNumber) && s.status !== 'closed'
            )
            const recentClosed = squawks.filter((s) =>
              (s.aircraftId === a.id || s.tailNumber === a.tailNumber) && s.status === 'closed'
            ).slice(0, 3)
            return (
              <div key={a.id} className="bg-surface-card border border-surface-border rounded-lg px-4 py-3 flex flex-col gap-1">
                <div className="text-sm font-mono font-bold text-slate-100">{a.tailNumber}</div>
                <div className="text-xs text-slate-400">{a.makeModel}</div>
                <div className={`text-xs ${grounded ? 'text-red-400' : 'text-green-400'}`}>
                  {grounded ? '● Grounded' : '● Airworthy'}
                </div>
                {a.needs_tow && <div className="text-[10px] text-sky-500">Requires aerotow</div>}
                {acSquawks.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[10px] text-amber-400 font-semibold">{acSquawks.length} open squawk{acSquawks.length !== 1 ? 's' : ''}</div>
                    {acSquawks.map((s) => (
                      <div key={s.id} className="text-[10px] text-amber-300/80 pl-2 border-l border-amber-500/30 truncate" title={s.description}>
                        {s.severity === 'grounding' ? '⛔ ' : '⚠ '}{s.description}
                      </div>
                    ))}
                  </div>
                )}
                {recentClosed.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[10px] text-slate-500 font-semibold">Recent</div>
                    {recentClosed.map((s) => (
                      <div key={s.id} className="text-[10px] text-slate-500 pl-2 border-l border-slate-700 truncate flex items-center gap-1" title={`${s.description} — ${s.resolvedBy ?? ''}`}>
                        <span className="text-green-500">✓</span>
                        <span className="truncate">{s.description}</span>
                        {s.resolvedDate && <span className="text-slate-600 shrink-0">{s.resolvedDate}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setSquawkFormFor(squawkFormFor === a.id ? null : a.id)}
                  className="self-start text-[10px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 mt-1 transition-colors"
                >
                  + Add Squawk
                </button>
                {squawkFormFor === a.id && (
                  <SquawkForm aircraftId={a.id} onDone={() => setSquawkFormFor(null)} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tow Plane Fleet ── */}
      {activeTab === 'tow_fleet' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ALL_TOW_AIRCRAFT.map((a) => {
            const grounded = isAircraftGrounded(a.id, mockAircraft, squawks)
            const acSquawks = squawks.filter((s) =>
              (s.aircraftId === a.id || s.tailNumber === a.tailNumber) && s.status !== 'closed'
            )
            const recentClosed = squawks.filter((s) =>
              (s.aircraftId === a.id || s.tailNumber === a.tailNumber) && s.status === 'closed'
            ).slice(0, 3)
            const todayTows = reservations.filter((r) => !r.isStandby && r.towInfo?.towPlaneId === a.id).length
            const inspColor = a.inspectionStatus === 'current' ? 'text-green-400'
                            : a.inspectionStatus === 'due_soon' ? 'text-yellow-400' : 'text-red-400'
            // Live ADS-B state for this tow plane (matched by icaoHex or tail)
            const adsb = adsbTowState.find((tp) =>
              (a.icaoHex && tp.icao?.toLowerCase() === a.icaoHex.toLowerCase()) ||
              tp.tail === a.tailNumber
            )
            const adsbPhaseLabel = {
              climbing_on_tow: 'Climbing on tow',
              descending: 'Descending',
              on_ground: 'On ground',
              taxiing: 'Taxiing',
            }
            const adsbPhaseColor = {
              climbing_on_tow: 'text-sky-400',
              descending: 'text-amber-400',
              on_ground: 'text-slate-400',
              taxiing: 'text-slate-400',
            }
            return (
              <div key={a.id} className="bg-surface-card border border-surface-border rounded-lg px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-mono font-bold text-slate-100">{a.tailNumber}</span>
                  <span className={`text-[10px] font-semibold ${grounded ? 'text-red-400' : 'text-green-400'}`}>
                    {grounded ? '● Grounded' : '● Airworthy'}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{a.makeModel.replace('Piper ', '')}</div>
                {adsb && (
                  <div className={`text-[10px] font-semibold ${adsbPhaseColor[adsb.phase] ?? 'text-slate-400'} flex items-center gap-1.5`}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {adsbPhaseLabel[adsb.phase] ?? adsb.phase}
                    {adsb.current_alt_ft != null && ` · ${adsb.current_alt_ft.toLocaleString()} ft`}
                    {adsb.climb_rate_fpm != null && adsb.phase === 'climbing_on_tow' && ` · ${adsb.climb_rate_fpm} fpm`}
                    {adsb.est_available_ts && ` · avail ${new Date(adsb.est_available_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                )}
                <div className={`text-[10px] ${inspColor}`}>
                  Insp: {a.inspectionStatus.replace('_', ' ')}
                  {a.next100hrDue && ` · 100hr ${a.next100hrDue}`}
                </div>
                <div className="text-[10px] text-slate-500">
                  {a.currentLocation ?? 'ramp'}
                  {todayTows > 0 && <span className="ml-2 text-sky-400">{todayTows} tow{todayTows !== 1 ? 's' : ''} today</span>}
                </div>
                {acSquawks.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[10px] text-amber-400 font-semibold">{acSquawks.length} open squawk{acSquawks.length !== 1 ? 's' : ''}</div>
                    {acSquawks.map((s) => (
                      <div key={s.id} className="text-[10px] text-amber-300/80 pl-2 border-l border-amber-500/30 truncate" title={s.description}>
                        {s.severity === 'grounding' ? '⛔ ' : '⚠ '}{s.description}
                      </div>
                    ))}
                  </div>
                )}
                {recentClosed.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-[10px] text-slate-500 font-semibold">Recent</div>
                    {recentClosed.map((s) => (
                      <div key={s.id} className="text-[10px] text-slate-500 pl-2 border-l border-slate-700 truncate flex items-center gap-1" title={`${s.description} — ${s.resolvedBy ?? ''}`}>
                        <span className="text-green-500">✓</span>
                        <span className="truncate">{s.description}</span>
                        {s.resolvedDate && <span className="text-slate-600 shrink-0">{s.resolvedDate}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setSquawkFormFor(squawkFormFor === a.id ? null : a.id)}
                  className="self-start text-[10px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 mt-1 transition-colors"
                >
                  + Add Squawk
                </button>
                {squawkFormFor === a.id && (
                  <SquawkForm aircraftId={a.id} onDone={() => setSquawkFormFor(null)} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Services ── */}
      {activeTab === 'services' && (
        <div className="flex flex-col gap-5">
          <div className="text-xs text-slate-500">Pricing for glider operations services at {AIRPORT}</div>

          {/* Tow rates */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Aerotow Rates</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {TOW_HEIGHTS.map((h) => (
                <div key={h} className="flex flex-col gap-0.5 rounded-lg border border-surface-border p-3">
                  <div className="text-sm font-mono font-bold text-slate-100">{h.toLocaleString()} ft</div>
                  <div className="text-lg font-mono font-bold text-green-400">${towPrice(h)}</div>
                  <div className="text-[10px] text-slate-500">{towCycleMin(h)} min tow time</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-600">
              ${TOW_SETTINGS.towBaseFee} hookup + ${TOW_SETTINGS.towPer1000ftFee}/1,000 ft
            </div>
          </div>

          {/* Rental & instruction */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Glider Rental</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {GLIDER_AIRCRAFT.map((a) => (
                <div key={a.id} className="rounded-lg border border-surface-border p-3 flex flex-col gap-1">
                  <div className="text-sm font-mono font-bold text-slate-100">{a.tailNumber}</div>
                  <div className="text-xs text-slate-400">{a.makeModel}</div>
                  <div className="text-lg font-mono font-bold text-green-400">${GLIDER_PRICING.gliderRentalPerHr}/hr</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Training Programs</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-surface-border p-3">
                <div className="text-sm font-semibold text-slate-100">Dual Instruction</div>
                <div className="text-lg font-mono font-bold text-green-400 mt-1">${GLIDER_PRICING.instructionPerHr}/hr</div>
                <div className="text-[10px] text-slate-500 mt-1">CFI time billed per session · instructor acts as PIC</div>
              </div>
              <div className="rounded-lg border border-surface-border p-3">
                <div className="text-sm font-semibold text-slate-100">Glider Private Pilot</div>
                <div className="text-xs text-slate-400 mt-1">Rental + instruction + tows</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Typical: 20-40 flights · $2,200 – $3,800 total
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoices ── */}
      {activeTab === 'invoices' && (
        <div className="flex flex-col gap-1">
          {invoices.length === 0 && <p className="text-sm text-slate-500 italic">No invoices yet — bill a flight to create one.</p>}
          {invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} />)}
        </div>
      )}

      {/* ── Clients ── */}
      {activeTab === 'clients' && <ClientsTab clients={clients.filter((c) => c.fboCategory === 'glider')} />}
    </div>
  )
}

// ─── Clients Tab ─────────────────────────────────────────────────────────────

const FBO_CATEGORIES = [
  { value: 'glider',          label: 'Glider' },
  { value: 'piston_single',   label: 'Piston Single' },
  { value: 'piston_twin',     label: 'Piston Twin' },
  { value: 'turboprop_single', label: 'Turboprop Single' },
  { value: 'turboprop_twin',  label: 'Turboprop Twin' },
  { value: 'jet_light',       label: 'Light Jet' },
  { value: 'jet_midsize',     label: 'Midsize Jet' },
  { value: 'jet_heavy',       label: 'Heavy Jet' },
]

const FUEL_TYPES = [
  { value: '',             label: 'None / N/A' },
  { value: 'avgas_100ll',  label: 'Avgas 100LL' },
  { value: 'jet_a',        label: 'Jet-A' },
  { value: 'mogas',        label: 'Mogas' },
]

function ClientsTab({ clients }) {
  const [showForm, setShowForm] = useState(false)
  const [tail, setTail]           = useState('')
  const [ownerName, setOwner]     = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [makeModel, setMake]      = useState('')
  const [icaoType, setIcao]       = useState('')
  const [fboCategory, setCat]     = useState('glider')
  const [fuelType, setFuel]       = useState('')
  const [basedHere, setBased]     = useState(false)
  const [notes, setNotes]         = useState('')

  function handleSubmit() {
    if (!tail.trim()) return
    upsertClient({
      tailNumber: tail, ownerName: ownerName || null,
      phone: phone || null, email: email || null,
      makeModel: makeModel || null, icaoType: icaoType || null,
      fboCategory, fuelType: fuelType || null, basedHere, notes: notes || null,
    })
    setTail(''); setOwner(''); setPhone(''); setEmail(''); setMake(''); setIcao('')
    setCat('glider'); setFuel(''); setBased(false); setNotes('')
    setShowForm(false)
  }

  const based   = clients.filter((c) => c.basedHere)
  const transient = clients.filter((c) => !c.basedHere)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Non-fleet aircraft — own gliders, maintenance, FBO services</div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] px-3 py-1 rounded border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Aircraft'}
        </button>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Tail Number *</label>
              <input value={tail} onChange={(e) => setTail(e.target.value.toUpperCase())}
                placeholder="N1234G" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Owner / Operator</label>
              <input value={ownerName} onChange={(e) => setOwner(e.target.value)}
                placeholder="Last, First" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Make / Model</label>
              <input value={makeModel} onChange={(e) => setMake(e.target.value)}
                placeholder="Schweizer SGS 2-33A" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">ICAO Type</label>
              <input value={icaoType} onChange={(e) => setIcao(e.target.value.toUpperCase())}
                placeholder="S33" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600 w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Category</label>
              <select value={fboCategory} onChange={(e) => setCat(e.target.value)}
                className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none">
                {FBO_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Fuel Type</label>
              <select value={fuelType} onChange={(e) => setFuel(e.target.value)}
                className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none">
                {FUEL_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(303) 555-0100" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 uppercase">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="pilot@example.com" className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={basedHere} onChange={(e) => setBased(e.target.checked)} className="accent-sky-500" />
                <span className="text-xs text-slate-300">Based here</span>
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 uppercase">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hangar 3, preferred fuel truck access from south…"
              className="bg-surface-card border border-surface-border rounded px-2 py-1.5 text-sm text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder-slate-600" />
          </div>
          <button onClick={handleSubmit} disabled={!tail.trim()}
            className="self-start text-xs px-4 py-1.5 rounded border border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-40">
            Save Aircraft
          </button>
        </div>
      )}

      {/* Based aircraft */}
      {based.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Based Aircraft</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {based.map((c) => <ClientCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {/* Transient / visiting */}
      {transient.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Transient / Visiting</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {transient.map((c) => <ClientCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {clients.length === 0 && !showForm && (
        <p className="text-sm text-slate-500 italic">No client aircraft registered. Add one or schedule an own-aircraft glider flight.</p>
      )}
    </div>
  )
}

const CLIENT_SERVICE_TYPES = [
  { value: 'fueling',          label: 'Fueling' },
  { value: 'tie_down',         label: 'Tie-Down' },
  { value: 'hangaring',        label: 'Hangaring' },
  { value: 'tow',              label: 'Repositioning / Tow' },
  { value: 'preheat',          label: 'Engine Pre-Heat' },
  { value: 'gpu',              label: 'Ground Power (GPU)' },
  { value: 'oxygen_service',   label: 'O\u2082 Service' },
  { value: 'cleaning',         label: 'Cleaning / Detail' },
  { value: 'lavatory_service', label: 'Lavatory Service' },
  { value: 'catering',         label: 'Catering' },
  { value: 'transportation',   label: 'Transportation' },
]

function ClientCard({ c }) {
  const [showSquawk, setShowSquawk]   = useState(false)
  const [showService, setShowService] = useState(false)
  const fuelLabel = FUEL_TYPES.find((f) => f.value === c.fuelType)?.label
  const catLabel  = FBO_CATEGORIES.find((f) => f.value === c.fboCategory)?.label

  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono font-bold text-slate-100">{c.tailNumber}</span>
        {c.basedHere && <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium">BASED</span>}
      </div>
      {c.makeModel && <div className="text-xs text-slate-400">{c.makeModel}</div>}
      {c.ownerName && <div className="text-xs text-slate-300">{c.ownerName}</div>}
      <div className="flex gap-2 flex-wrap text-[10px] text-slate-500 mt-0.5">
        {catLabel && <span>{catLabel}</span>}
        {fuelLabel && <span>· {fuelLabel}</span>}
        {c.icaoType && <span>· {c.icaoType}</span>}
      </div>
      {(c.phone || c.email) && (
        <div className="text-[10px] text-slate-500 mt-0.5">
          {c.phone}{c.phone && c.email && ' · '}{c.email}
        </div>
      )}
      {c.notes && <div className="text-[10px] text-slate-600 italic mt-0.5">{c.notes}</div>}
      {c.lastSeen && <div className="text-[9px] text-slate-600 mt-0.5">Last seen {c.lastSeen.split('T')[0]}</div>}

      {/* Action buttons */}
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => { setShowSquawk(!showSquawk); setShowService(false) }}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            showSquawk
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
              : 'border-surface-border text-slate-500 hover:text-amber-400 hover:border-amber-500/30'
          }`}
        >
          Report Squawk
        </button>
        <button
          onClick={() => { setShowService(!showService); setShowSquawk(false) }}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            showService
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
              : 'border-surface-border text-slate-500 hover:text-sky-400 hover:border-sky-500/30'
          }`}
        >
          Request Service
        </button>
      </div>

      {showSquawk && <ClientSquawkForm client={c} onDone={() => setShowSquawk(false)} />}
      {showService && <ClientServiceForm client={c} onDone={() => setShowService(false)} />}
    </div>
  )
}

function ClientSquawkForm({ client, onDone }) {
  const [reportedBy, setReportedBy]   = useState(client.ownerName || '')
  const [description, setDescription] = useState('')
  const [grounding, setGrounding]     = useState(false)

  function handleSubmit() {
    if (!description.trim()) return
    addSquawk({
      id:               `sqk-cli-${Date.now()}`,
      tailNumber:       client.tailNumber,
      aircraftId:       null,
      reportedBy:       reportedBy || client.ownerName || '—',
      reportedDate:     new Date().toISOString().split('T')[0],
      reportedAt:       new Date().toISOString(),
      description:      description.trim(),
      severity:         grounding ? 'grounding' : 'monitoring',
      status:           'open',
      melReference:     null,
      melExpiryDate:    null,
      airframeHours:    null,
      resolvedDate:     null,
      resolvedBy:       null,
      resolutionNotes:  null,
      workOrderId:      null,
    })
    onDone()
  }

  return (
    <div className="flex flex-col gap-2 mt-1 p-2 rounded border border-amber-500/30 bg-amber-500/5">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Reported By</label>
        <input value={reportedBy} onChange={(e) => setReportedBy(e.target.value)}
          placeholder="Owner / reporter name"
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Description *</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          rows={2} placeholder="Describe the discrepancy..."
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600 resize-none" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={grounding} onChange={(e) => setGrounding(e.target.checked)} className="accent-red-500" />
        <span className="text-[10px] text-red-400 font-medium">GROUND this aircraft</span>
      </label>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!description.trim()}
          className="text-[10px] px-3 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
          Submit Squawk
        </button>
        <button onClick={onDone} className="text-[10px] px-3 py-1 text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function ClientServiceForm({ client, onDone }) {
  const defaultService = 'fueling'
  const [serviceType, setServiceType] = useState(defaultService)
  const [fuelType, setFuelType]       = useState(client.fuelType || '')
  const [notes, setNotes]             = useState('')

  function handleSubmit() {
    addServiceRequest({
      id:              `svc-cli-${Date.now()}`,
      tailNumber:      client.tailNumber,
      serviceType,
      fuelType:        serviceType === 'fueling' ? (fuelType || null) : null,
      fuelQuantityGal: null,
      assignedTo:      null,
      weatherCondition: null,
      status:          'pending',
      priority:        'normal',
      requestedAt:     new Date().toISOString(),
      requestedBy:     client.ownerName || null,
      completedAt:     null,
      fee:             null,
      crossModule:     null,
      crossModuleRef:  null,
      notes:           notes || null,
    })
    onDone()
  }

  const serviceLabel = CLIENT_SERVICE_TYPES.find((s) => s.value === serviceType)?.label || serviceType

  return (
    <div className="flex flex-col gap-2 mt-1 p-2 rounded border border-sky-500/30 bg-sky-500/5">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Service</label>
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500">
          {CLIENT_SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {serviceType === 'fueling' && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase">Fuel Type</label>
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}
            className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500">
            {FUEL_TYPES.filter((f) => f.value).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-slate-400 uppercase">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={serviceType === 'fueling' ? 'e.g. Top-off, tabs only...' : `Notes for ${serviceLabel}...`}
          className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-600" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit}
          className="text-[10px] px-3 py-1 rounded border border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors">
          Submit Request
        </button>
        <button onClick={onDone} className="text-[10px] px-3 py-1 text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// ─── Invoice Row ─────────────────────────────────────────────────────────────

function InvoiceRow({ inv }) {
  const [expanded, setExpanded] = useState(false)
  const isPaid = inv.status === 'paid'
  const itemCount = inv.lineItems.length
  const towCount  = inv.lineItems.filter((li) => li.type === 'tow').length
  const hasFlight = inv.lineItems.some((li) => li.type === 'rental' || li.type === 'instruction')

  return (
    <div className={`bg-surface-card border rounded-lg transition-opacity ${isPaid ? 'border-green-500/30 opacity-60' : 'border-surface-border'}`}>
      {/* Summary line */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[10px] text-slate-600 w-4">{expanded ? '▾' : '▸'}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
          isPaid ? 'border-green-500/40 bg-green-500/10 text-green-400' : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
        }`}>{isPaid ? 'PAID' : 'OPEN'}</span>
        <span className="text-xs font-semibold text-slate-100">{inv.client}</span>
        {inv.tailNumber && <span className="text-[10px] font-mono text-slate-400">{inv.tailNumber}</span>}
        <span className="text-[10px] text-slate-500">{inv.date}</span>
        <span className="text-[10px] text-slate-500 ml-auto">
          {towCount > 0 && `${towCount} tow${towCount !== 1 ? 's' : ''}`}
          {hasFlight && (towCount > 0 ? ' + flight' : 'flight')}
          {` · ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
        </span>
        <span className="text-xs font-mono font-bold text-green-400">${inv.total.toFixed(2)}</span>
        {!isPaid && (
          <button
            onClick={(e) => { e.stopPropagation(); markPaid(inv.id) }}
            className="flex-shrink-0 text-[9px] px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            Pay
          </button>
        )}
      </div>

      {/* Expanded line items */}
      {expanded && (
        <div className="px-3 pb-2 flex flex-col gap-1 border-t border-surface-border pt-2">
          {inv.lineItems.map((li, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  li.type === 'tow' ? 'bg-sky-500/10 text-sky-400' :
                  li.type === 'rental' ? 'bg-violet-500/10 text-violet-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>{li.type}</span>
                <span className="text-slate-300">{li.description}</span>
              </div>
              <span className="font-mono text-slate-200">${li.amount.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-surface-border pt-1 mt-1">
            <span className="text-xs text-slate-400">Total</span>
            <span className="text-xs font-mono font-bold text-green-400">${inv.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Squawk Form ─────────────────────────────────────────────────────────────

function SquawkForm({ aircraftId, onDone }) {
  const [reportedBy, setReportedBy] = useState('')
  const [description, setDescription] = useState('')
  const [grounded, setGrounded] = useState(false)

  const ac     = mockAircraft.find((a) => a.id === aircraftId)
  const pilots = mockPersonnel.filter((p) => p.towCertified || p.gliderRating || p.role === 'pilot_pic')

  function handleSubmit() {
    if (!description.trim()) return
    const reporter = mockPersonnel.find((p) => p.id === reportedBy)
    addSquawk({
      // Maintenance-compatible fields (matches maintenance/mockDb.js schema)
      id:               `sqk-${Date.now()}`,
      tailNumber:       ac?.tailNumber ?? '—',
      aircraftId,
      reportedBy:       reporter?.name ?? reportedBy ?? '—',
      reportedDate:     new Date().toISOString().split('T')[0],
      reportedAt:       new Date().toISOString(),
      description:      description.trim(),
      severity:         grounded ? 'grounding' : 'monitoring',
      status:           'open',
      melReference:     null,
      melExpiryDate:    null,
      airframeHours:    ac?.totalAirframeHours ?? null,
      resolvedDate:     null,
      resolvedBy:       null,
      resolutionNotes:  null,
      workOrderId:      null,
    })
    onDone()
  }

  return (
    <div className="flex flex-col gap-2 mt-1 p-2 rounded border border-amber-500/30 bg-amber-500/5">
      <select
        value={reportedBy}
        onChange={(e) => setReportedBy(e.target.value)}
        className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[10px] text-slate-100"
      >
        <option value="">— Reported by —</option>
        {pilots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the issue…"
        rows={2}
        className="bg-surface-card border border-surface-border rounded px-2 py-1 text-[10px] text-slate-100 placeholder-slate-600 resize-none"
      />
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={grounded} onChange={(e) => setGrounded(e.target.checked)} className="accent-red-500" />
        <span className={`text-[10px] font-medium ${grounded ? 'text-red-400' : 'text-slate-400'}`}>GROUND this aircraft</span>
      </label>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={!description.trim()} className="text-[10px] px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 disabled:opacity-40">
          Submit Squawk
        </button>
        <button onClick={onDone} className="text-[10px] px-2.5 py-1 text-slate-500 hover:text-slate-300">Cancel</button>
      </div>
    </div>
  )
}
