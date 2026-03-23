import { useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

// ─── Aviation calculations ────────────────────────────────────────────────────

// FAA/ICAO MEA: max terrain + 1000 ft non-mountainous, 2000 ft mountainous (≥5000 ft)
// rounded up to next 100 ft
export function computeMEA(maxElevFt) {
  if (maxElevFt == null) return null
  const clearance = maxElevFt >= 5000 ? 2000 : 1000
  return Math.ceil((maxElevFt + clearance) / 100) * 100
}

// Cloud ceiling (lowest BKN/OVC layer, ft AGL) from METAR object
function cloudCeilingAgl(metar) {
  if (!metar) return null
  const layers = (metar.sky_condition ?? [])
    .filter((s) => s.sky_cover === 'BKN' || s.sky_cover === 'OVC')
    .map((s) => parseInt(s.cloud_base_ft_agl ?? 99999))
  return layers.length ? Math.min(...layers) : null
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, mea }) {
  if (!active || !payload?.length) return null
  const elev = payload[0]?.value
  const pt   = payload[0]?.payload
  return (
    <div className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 font-mono mb-1">
        {Math.round(label)} nm{pt?.label ? ` — ${pt.label}` : ''}
      </p>
      {elev != null && <p className="text-amber-300">Terrain: {elev.toLocaleString()} ft MSL</p>}
      {elev == null && <p className="text-slate-500 italic">No data (ocean / outside coverage)</p>}
      {mea && elev != null && (
        <p className="text-slate-500 mt-0.5">MEA clearance: +{(mea - elev).toLocaleString()} ft</p>
      )}
    </div>
  )
}

// ─── Ceiling risk bar (re-exported for aircraft cards) ────────────────────────

export function CeilingRiskBar({ mea, serviceCeiling, cloudCeilingAglFt, stationElevFt }) {
  if (!mea || !serviceCeiling) return null

  const usedPct   = Math.min(100, Math.round((mea / serviceCeiling) * 100))
  const marginFt  = serviceCeiling - mea

  const cloudMsl  = cloudCeilingAglFt != null && stationElevFt != null
    ? cloudCeilingAglFt + stationElevFt
    : null
  const cloudBelowMea = cloudMsl != null && cloudMsl < mea

  const riskColor =
    usedPct >= 90 ? 'bg-red-500'
    : usedPct >= 75 ? 'bg-orange-400'
    : usedPct >= 60 ? 'bg-yellow-400'
    : 'bg-green-400'

  const riskLabel =
    usedPct >= 90 ? 'Critical'
    : usedPct >= 75 ? 'High'
    : usedPct >= 60 ? 'Moderate'
    : 'Low'

  const riskText =
    usedPct >= 90 ? 'text-red-400'
    : usedPct >= 75 ? 'text-orange-400'
    : usedPct >= 60 ? 'text-yellow-400'
    : 'text-green-400'

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">MEA vs service ceiling</span>
        <span className={`font-semibold ${riskText}`}>
          {riskLabel} — {usedPct}% of ceiling used
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`${riskColor} h-full transition-all`} style={{ width: `${usedPct}%` }} />
      </div>
      <div className="flex justify-between text-slate-500">
        <span>MEA {mea.toLocaleString()} ft</span>
        <span>
          Service ceiling {serviceCeiling.toLocaleString()} ft
          {marginFt > 0 && (
            <span className="text-slate-600 ml-1">(+{marginFt.toLocaleString()} ft margin)</span>
          )}
        </span>
      </div>
      {cloudBelowMea && (
        <p className="text-red-400 bg-red-400/10 border border-red-500/20 rounded px-2 py-1 mt-0.5">
          ⚠ Cloud ceiling (~{cloudMsl?.toLocaleString()} ft MSL) may be below MEA —
          IMC likely enroute
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TerrainProfile({ routeData, deptWeather, onMetrics }) {
  const elev    = routeData?.elevation
  const profile = elev?.profile ?? []

  // Airport elevations come from resolved station data
  const deptElevFt = routeData?.stations?.departure?.elevFt ?? null
  const arrElevFt  = routeData?.stations?.arrival?.elevFt   ?? null

  // Max terrain and MEA
  const maxElevFt = elev?.maxElevFt ?? null
  const mea       = computeMEA(maxElevFt)

  // Estimated ILS CAT-I DA: arrival airport elevation + 200 ft HAT
  const approachDA = arrElevFt != null ? arrElevFt + 200 : null

  // Cloud ceiling from departure METAR
  const deptMetar  = deptWeather?.metar?.[0] ?? null
  const cloudAglFt = cloudCeilingAgl(deptMetar)

  // Cloud ceiling in MSL = AGL + departure airport elevation
  const cloudMslFt    = cloudAglFt != null && deptElevFt != null ? cloudAglFt + deptElevFt : null
  const cloudBelowMea = cloudMslFt != null && mea != null && cloudMslFt < mea

  // Emit metrics to parent for use in aircraft cards
  useEffect(() => {
    if (!onMetrics) return
    onMetrics({ mea, approachDA, cloudAglFt, deptElevFt })
  }, [mea, approachDA, cloudAglFt, deptElevFt])

  if (!routeData) return null

  // Chart data — filter out null elevFt (open ocean / no USGS coverage)
  const chartData = profile.map((pt) => ({
    nm:         Math.round(pt.distNm * 10) / 10,
    elevFt:     pt.elevFt != null && pt.elevFt > -900 ? pt.elevFt : null,
    label:      pt.label ?? null,
    isWaypoint: pt.isWaypoint,
  }))

  // Peak point for vertical marker
  const peakPt = chartData.reduce(
    (best, pt) => (pt.elevFt != null && (best == null || pt.elevFt > best.elevFt) ? pt : best),
    null
  )

  const totalNm   = elev?.routeDistNm ?? chartData[chartData.length - 1]?.nm ?? 0
  const hasData   = chartData.some((p) => p.elevFt != null)
  const elevError = elev?.error ?? null

  // Y-axis ceiling
  const yMax = Math.ceil(
    Math.max(mea ?? 0, cloudMslFt ?? 0, maxElevFt ?? 0, 5000) / 5000
  ) * 5000 + 3000

  return (
    <div
      className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col gap-5"
      data-testid="terrain-profile"
    >
      {/* ── Header + stats ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Terrain Profile — Enroute</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {routeData.request?.departure} → {routeData.request?.arrival}
            {totalNm > 0 && ` · ${Math.round(totalNm)} nm`}
            {' · '}USGS 3DEP
          </p>
        </div>

        <div className="flex gap-5 flex-wrap">
          {maxElevFt != null && (
            <Stat label="Max terrain" value={`${maxElevFt.toLocaleString()} ft`} color="text-amber-400" />
          )}
          {mea != null && (
            <Stat
              label="MEA"
              value={`${mea.toLocaleString()} ft`}
              color="text-orange-400"
              note={maxElevFt != null ? `+${(mea - maxElevFt).toLocaleString()} ft clearance` : null}
            />
          )}
          {approachDA != null && (
            <Stat label="Est. ILS DA" value={`${approachDA.toLocaleString()} ft`} color="text-sky-400" note="CAT I, 200 ft HAT" />
          )}
          {deptElevFt != null && (
            <Stat label="Dept elev" value={`${deptElevFt.toLocaleString()} ft`} color="text-slate-400" />
          )}
          {cloudAglFt != null && (
            <Stat
              label="Cloud ceiling"
              value={`${cloudAglFt.toLocaleString()} ft AGL`}
              color={cloudBelowMea ? 'text-red-400' : 'text-blue-400'}
              note={cloudBelowMea ? '⚠ below MEA' : `~${cloudMslFt?.toLocaleString()} ft MSL`}
            />
          )}
        </div>
      </div>

      {/* ── Error from FlightSafeWeather ── */}
      {elevError && (
        <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-500/20 rounded px-3 py-2">
          Partial terrain data: {elevError}
        </p>
      )}

      {/* ── Chart ── */}
      {!hasData ? (
        <div className="h-20 flex items-center justify-center text-slate-500 text-sm">
          No terrain data returned for this route.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#92400e" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#78350f" stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="nm"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v) => `${v} nm`}
              interval="preserveStartEnd"
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              domain={[0, yMax]}
              width={38}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip mea={mea} />} />

            {/* Terrain */}
            <Area
              type="monotone"
              dataKey="elevFt"
              stroke="#92400e"
              fill="url(#terrainGrad)"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              name="Terrain"
            />

            {/* MEA */}
            {mea != null && (
              <ReferenceLine
                y={mea}
                stroke="#f97316"
                strokeDasharray="8 4"
                strokeWidth={1.5}
                label={{ value: `MEA ${mea.toLocaleString()} ft`, fill: '#f97316', fontSize: 10, position: 'insideTopRight' }}
              />
            )}

            {/* Cloud ceiling (approx MSL) */}
            {cloudMslFt != null && (
              <ReferenceLine
                y={cloudMslFt}
                stroke={cloudBelowMea ? '#ef4444' : '#60a5fa'}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{
                  value: `Cloud ~${cloudMslFt.toLocaleString()} ft MSL`,
                  fill: cloudBelowMea ? '#ef4444' : '#60a5fa', fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />
            )}

            {/* Approach DA */}
            {approachDA != null && (
              <ReferenceLine
                y={approachDA}
                stroke="#38bdf8"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: `DA ${approachDA} ft`, fill: '#38bdf8', fontSize: 10, position: 'insideBottomRight' }}
              />
            )}

            {/* Peak terrain vertical */}
            {peakPt != null && (
              <ReferenceLine
                x={peakPt.nm}
                stroke="#fbbf24"
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{ value: `Peak ${peakPt.elevFt?.toLocaleString()} ft`, fill: '#fbbf24', fontSize: 9, position: 'insideTop' }}
              />
            )}

            {/* Waypoint vertical markers */}
            {chartData
              .filter((p) => p.isWaypoint && p.label && p.nm > 0 && p.nm < totalNm - 1)
              .map((p) => (
                <ReferenceLine
                  key={p.nm}
                  x={p.nm}
                  stroke="#475569"
                  strokeWidth={1}
                  label={{ value: p.label, fill: '#64748b', fontSize: 9, position: 'top' }}
                />
              ))}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* ── Legend ── */}
      {hasData && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 border-t border-surface-border pt-3">
          <LegendSwatch color="#78350f" label="Terrain (USGS 3DEP)" />
          {mea         && <LegendSwatch color="#f97316" dash label={`MEA ${mea.toLocaleString()} ft`} />}
          {cloudMslFt  && <LegendSwatch color={cloudBelowMea ? '#ef4444' : '#60a5fa'} dash label={`Cloud ~${cloudMslFt.toLocaleString()} ft MSL`} />}
          {approachDA  && <LegendSwatch color="#38bdf8" dash label={`Est. DA ${approachDA} ft`} />}
          {peakPt      && <LegendSwatch color="#fbbf24" dash label="Peak terrain" />}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stat({ label, value, color, note }) {
  return (
    <div className="text-center min-w-[72px]">
      <div className={`text-base font-mono font-bold leading-tight ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {note && <div className={`text-xs opacity-70 ${color}`}>{note}</div>}
    </div>
  )
}

function LegendSwatch({ color, dash, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="8">
        <line
          x1="0" y1="4" x2="20" y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dash ? '4 2' : 'none'}
        />
      </svg>
      <span>{label}</span>
    </div>
  )
}
