/**
 * FlightTimeline — Gantt-style SVG timeline for all displayed flights.
 *
 * Shows a horizontal time grid with one row per aircraft. Each flight is a
 * colored bar sized by estimated block time. Implied repositioning gaps are
 * shown as dashed bars. A "NOW" marker tracks the current time when it falls
 * inside the displayed range.
 */
import { useMemo } from 'react'
import { estimateFlightDuration, estimateEta, CRUISE_SPEEDS_KTS } from '../../lib/flightCalc'

// ─── Layout constants ─────────────────────────────────────────────────────────

const SVG_W    = 900   // viewBox width (scales to 100%)
const LABEL_W  = 82    // px for the tail / type label column
const TLINE_W  = SVG_W - LABEL_W  // usable timeline width
const HEADER_H = 22   // px for tick labels
const ROW_H    = 34   // px per aircraft row
const BAR_Y    = 7    // bar top offset within row
const BAR_H    = 20   // bar height

// ─── Risk colour helpers ──────────────────────────────────────────────────────

function barFill(flight) {
  const ratio = flight.riskSnapshot?.ratioToBaseline
    ?? (flight.riskScore ? flight.riskScore / 25 : null)
  if (flight.missionType === 'positioning' && ratio == null) return ['#1e3a5f', '#3b82f6', '#93c5fd']
  if (!ratio) return ['#1e293b', '#475569', '#94a3b8']
  if (ratio >= 4)   return ['#4c1d95', '#a855f7', '#e9d5ff']
  if (ratio >= 2)   return ['#7f1d1d', '#ef4444', '#fca5a5']
  if (ratio >= 1.5) return ['#7c2d12', '#f97316', '#fed7aa']
  if (ratio >= 1)   return ['#713f12', '#eab308', '#fef08a']
  return               ['#14532d', '#22c55e', '#bbf7d0']
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function getFlightEta(flight) {
  const kts = CRUISE_SPEEDS_KTS[flight.aircraftType] ?? 150
  const est  = estimateFlightDuration(flight.departure, flight.arrival, kts, 15)
  return est ? estimateEta(new Date(flight.plannedDepartureUtc), est.totalHours) : null
}

function tickInterval(rangeH) {
  if (rangeH <= 6)   return 1
  if (rangeH <= 12)  return 2
  if (rangeH <= 36)  return 3
  if (rangeH <= 72)  return 6
  if (rangeH <= 168) return 12
  return 24
}

function generateTicks(startMs, endMs) {
  const rangeH     = (endMs - startMs) / 3_600_000
  const intervalH  = tickInterval(rangeH)
  const intervalMs = intervalH * 3_600_000
  const first      = Math.ceil(startMs / intervalMs) * intervalMs
  const ticks      = []
  for (let t = first; t <= endMs; t += intervalMs) ticks.push(t)
  return { ticks, intervalH }
}

function fmtTick(ms, intervalH, multiDay) {
  const d = new Date(ms)
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  if (multiDay && intervalH >= 12) {
    const mo = d.toUTCString().slice(8, 11)
    const dy = d.getUTCDate()
    return `${dy} ${mo} ${hh}Z`
  }
  return `${hh}:${mm}Z`
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Props:
 *   flights      – the tab-filtered flight list (real flights only)
 *   impliedRepos – visible implied repositioning gaps
 *   selectedId   – currently selected flight id
 *   onSelect     – (flightId) => void
 */
export function FlightTimeline({ flights, impliedRepos = [], selectedId, onSelect }) {

  const { rangeStart, rangeEnd, groups, nowMs, ticks, intervalH, multiDay } = useMemo(() => {
    if (!flights.length) return {}

    let minMs = Infinity
    let maxMs = -Infinity

    // Gather dep + eta for every flight
    const infoMap = {}
    for (const f of flights) {
      const depMs = new Date(f.plannedDepartureUtc).getTime()
      const eta   = getFlightEta(f)
      const etaMs = eta ? eta.getTime() : depMs + 3_600_000  // fallback 1h
      if (depMs < minMs) minMs = depMs
      if (etaMs > maxMs) maxMs = etaMs
      infoMap[f.id] = { flight: f, depMs, etaMs }
    }

    // Extend range to cover implied repos
    for (const r of impliedRepos) {
      const ws = new Date(r.windowStart).getTime()
      const we = new Date(r.windowEnd).getTime()
      if (ws < minMs) minMs = ws
      if (we > maxMs) maxMs = we
    }

    // 30-min padding each side
    const PAD   = 30 * 60_000
    const rStart = minMs - PAD
    const rEnd   = maxMs + PAD

    // Build tail-keyed groups, preserving first-seen order
    const tailOrder = []
    const byTail    = {}
    for (const info of Object.values(infoMap)) {
      const tail = info.flight.tailNumber
      if (!byTail[tail]) {
        tailOrder.push(tail)
        byTail[tail] = {
          tail,
          aircraftType: info.flight.aircraftType,
          flights: [],
          repos:   [],
        }
      }
      byTail[tail].flights.push(info)
    }

    // Sort flights within each tail by departure
    for (const g of Object.values(byTail)) {
      g.flights.sort((a, b) => a.depMs - b.depMs)
    }

    // Assign repos to their tail groups
    for (const r of impliedRepos) {
      if (byTail[r.tailNumber]) byTail[r.tailNumber].repos.push(r)
    }

    const rangeH   = (rEnd - rStart) / 3_600_000
    const { ticks, intervalH } = generateTicks(rStart, rEnd)
    const multiDay = rangeH > 20

    return {
      rangeStart: rStart,
      rangeEnd:   rEnd,
      groups:     tailOrder.map((t) => byTail[t]),
      nowMs:      Date.now(),
      ticks,
      intervalH,
      multiDay,
    }
  }, [flights, impliedRepos])

  if (!rangeStart || !groups?.length) return null

  const rangeDuration = rangeEnd - rangeStart
  /** Convert a timestamp (ms) to an SVG x coordinate within the timeline area */
  const toX = (ms) =>
    LABEL_W + Math.max(0, Math.min(1, (ms - rangeStart) / rangeDuration)) * TLINE_W

  const nowInRange = nowMs >= rangeStart && nowMs <= rangeEnd
  const nowX       = toX(nowMs)

  const svgH = HEADER_H + groups.length * ROW_H + 6

  return (
    <div className="bg-slate-900/70 border border-surface-border rounded-xl overflow-hidden">
      <div className="px-3 pt-2.5 pb-0 text-[10px] text-slate-600 uppercase tracking-widest">
        Schedule · {groups.length} aircraft · {flights.length} flight{flights.length !== 1 ? 's' : ''}
      </div>

      {/* Horizontally scrollable on very narrow screens */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${svgH}`}
          width="100%"
          height={svgH}
          style={{ display: 'block', minWidth: 420 }}
          aria-label="Flight schedule timeline"
        >
          {/* ── Background ── */}
          <rect width={SVG_W} height={svgH} fill="#0d1117" />

          {/* ── Vertical grid lines (span full height) ── */}
          {ticks.map((t) => {
            const x = toX(t)
            return (
              <line
                key={t}
                x1={x} y1={HEADER_H - 4}
                x2={x} y2={svgH}
                stroke="#1e293b" strokeWidth="1"
              />
            )
          })}

          {/* ── Tick labels ── */}
          {ticks.map((t) => {
            const x = toX(t)
            return (
              <text
                key={t}
                x={x} y={13}
                textAnchor="middle"
                fill="#475569"
                fontSize="8"
                fontFamily="ui-monospace, monospace"
              >
                {fmtTick(t, intervalH, multiDay)}
              </text>
            )
          })}

          {/* ── NOW marker ── */}
          {nowInRange && (
            <>
              <line
                x1={nowX} y1={0}
                x2={nowX} y2={svgH}
                stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.6"
              />
              <text
                x={nowX} y={10}
                textAnchor="middle"
                fill="#ef4444"
                fontSize="7"
                fontFamily="ui-monospace, monospace"
              >
                NOW
              </text>
            </>
          )}

          {/* ── Label column separator ── */}
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgH} stroke="#1e293b" strokeWidth="1" />

          {/* ── Aircraft rows ── */}
          {groups.map((group, gi) => {
            const rowY = HEADER_H + gi * ROW_H

            return (
              <g key={group.tail}>
                {/* Row divider */}
                <line
                  x1={0} y1={rowY}
                  x2={SVG_W} y2={rowY}
                  stroke="#1e293b" strokeWidth="0.5"
                />

                {/* Tail label */}
                <text
                  x={LABEL_W - 6} y={rowY + ROW_H / 2 - 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                >
                  {group.tail}
                </text>
                <text
                  x={LABEL_W - 6} y={rowY + ROW_H / 2 + 7}
                  textAnchor="end"
                  fill="#475569"
                  fontSize="7"
                  fontFamily="ui-monospace, monospace"
                >
                  {group.aircraftType}
                </text>

                {/* ── Implied repo bars (dashed) ── */}
                {group.repos.map((r) => {
                  const x1 = toX(new Date(r.windowStart).getTime())
                  const x2 = toX(new Date(r.windowEnd).getTime())
                  const bw  = x2 - x1
                  if (bw < 2) return null
                  const infeasible = r.feasible === false
                  return (
                    <g key={r.id}>
                      <rect
                        x={x1} y={rowY + BAR_Y}
                        width={bw} height={BAR_H}
                        rx="2"
                        fill={infeasible ? '#450a0a' : '#0f172a'}
                        fillOpacity="0.8"
                        stroke={infeasible ? '#ef4444' : '#475569'}
                        strokeWidth="1"
                        strokeDasharray="4 2"
                      />
                      {bw > 38 && (
                        <text
                          x={x1 + 4} y={rowY + BAR_Y + 13}
                          fill={infeasible ? '#fca5a5' : '#64748b'}
                          fontSize="7"
                          fontFamily="ui-monospace, monospace"
                        >
                          {r.fromAirport}→{r.toAirport}
                          {infeasible ? ' ⚠' : ''}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* ── Flight bars ── */}
                {group.flights.map(({ flight, depMs, etaMs }) => {
                  const x1 = toX(depMs)
                  const x2 = Math.max(x1 + 4, toX(etaMs))
                  const bw  = x2 - x1
                  const [fill, stroke, textFill] = barFill(flight)
                  const isSel   = flight.id === selectedId
                  const label   = `${flight.departure}→${flight.arrival}`
                  const subLabel = flight.pic ?? ''

                  return (
                    <g
                      key={flight.id}
                      onClick={() => onSelect?.(flight.id)}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      aria-label={`${flight.tailNumber} ${label}`}
                    >
                      {/* Selection ring */}
                      {isSel && (
                        <rect
                          x={x1 - 2} y={rowY + BAR_Y - 2}
                          width={bw + 4} height={BAR_H + 4}
                          rx="4"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Bar body */}
                      <rect
                        x={x1} y={rowY + BAR_Y}
                        width={bw} height={BAR_H}
                        rx="2"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="0.5"
                        opacity={isSel ? 1 : 0.85}
                      />

                      {/* Departure tick */}
                      <line
                        x1={x1} y1={rowY + BAR_Y}
                        x2={x1} y2={rowY + BAR_Y + BAR_H}
                        stroke={stroke}
                        strokeWidth="1.5"
                      />

                      {/* Route label */}
                      {bw > 28 && (
                        <text
                          x={x1 + 4} y={rowY + BAR_Y + 12}
                          fill={textFill}
                          fontSize="7.5"
                          fontFamily="ui-monospace, monospace"
                          fontWeight="500"
                        >
                          {label}
                        </text>
                      )}

                      {/* PIC sub-label */}
                      {bw > 60 && subLabel && (
                        <text
                          x={x1 + 4} y={rowY + BAR_Y + 19}
                          fill={textFill}
                          fontSize="6"
                          fontFamily="ui-sans-serif, sans-serif"
                          opacity="0.7"
                        >
                          {subLabel}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
