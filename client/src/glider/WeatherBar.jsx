import { useState, useEffect, useCallback } from 'react'
import { getGliderSettings, subscribeGliderSettings } from '../store/gliderSettings'

const WEATHER = '/weather-api'
const DAY_START_HOUR = 7
const NUM_HOURS      = 13   // 07:00–19:00  — matches violin chart

// ─── METAR helpers (new API shape) ───────────────────────────────────────────

function metarCat(m) {
  if (!m) return null
  return m.flightCategory ?? m.fltCat ?? null
}

function metarCeiling(m) {
  if (!m) return null
  const layers = (m.clouds ?? m.parsed?.clouds ?? [])
    .filter((l) => l.cover === 'BKN' || l.cover === 'OVC')
    .sort((a, b) => (a.base ?? a.baseFt ?? 99999) - (b.base ?? b.baseFt ?? 99999))
  if (layers.length === 0) return null
  return layers[0].base != null ? layers[0].base * 100 : layers[0].baseFt ?? null
}

function metarWind(m) {
  if (!m) return null
  const p = m.parsed?.wind
  if (p) {
    const dir = p.variable ? 'VRB' : String(p.direction).padStart(3, '0')
    return `${dir}/${p.speed}${p.gust ? `G${p.gust}` : ''}kt`
  }
  const dir = m.wdir != null ? String(m.wdir).padStart(3, '0') : 'VRB'
  return `${dir}/${m.wspd ?? 0}${m.wgst ? `G${m.wgst}` : ''}kt`
}

function metarVis(m) {
  if (!m) return null
  if (m.parsed?.visibility) {
    const v = m.parsed.visibility
    return `${v.plus ? 'P' : ''}${v.value}${v.unit}`
  }
  return m.visib != null ? `${m.visib}SM` : null
}

/** Degrees → 8-point compass quadrant */
function dirQuadrant(deg) {
  if (deg == null) return 'VRB'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

const CAT_BG = {
  VFR:  'bg-green-500',
  MVFR: 'bg-yellow-500',
  IFR:  'bg-red-500',
  LIFR: 'bg-fuchsia-500',
}
const CAT_STYLE = {
  VFR:  'border-green-500/40 bg-green-500/15 text-green-400',
  MVFR: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-400',
  IFR:  'border-red-500/40 bg-red-500/15 text-red-400',
  LIFR: 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-400',
}

// ─── TAF period → hourly buckets ─────────────────────────────────────────────

/** Parse DDHH string (e.g. "0314") into { day, hour } */
function parseDDHH(s) {
  if (!s || s.length < 4) return null
  return { day: parseInt(s.slice(0, 2), 10), hour: parseInt(s.slice(2, 4), 10) }
}

/** Convert DDHH to a comparable integer for the current month. */
function ddhhToOrd(s) {
  const p = parseDDHH(s)
  return p ? p.day * 100 + p.hour : 0
}

function periodCat(p) {
  if (!p) return null
  const ceil = (p.clouds ?? [])
    .filter((c) => c.cover === 'BKN' || c.cover === 'OVC')
    .map((c) => c.baseFt ?? 99999)
    .sort((a, b) => a - b)[0] ?? Infinity
  const vis = p.visibility?.value ?? 99
  if (ceil < 500 || vis < 1) return 'LIFR'
  if (ceil < 1000 || vis < 3) return 'IFR'
  if (ceil < 3000 || vis < 5) return 'MVFR'
  return 'VFR'
}

function periodWind(p) {
  if (!p?.wind) return null
  const w = p.wind
  const dir = w.variable ? 'VRB' : String(w.direction).padStart(3, '0')
  return `${dir}/${w.speed}${w.gust ? `G${w.gust}` : ''}`
}

function periodWindSpd(p) { return p?.wind?.speed ?? null }
function periodGust(p) { return p?.wind?.gust ?? null }
function periodWindDir(p) { return p?.wind?.variable ? null : p?.wind?.direction ?? null }

function periodCeil(p) {
  if (!p) return null
  const layers = (p.clouds ?? [])
    .filter((c) => c.cover === 'BKN' || c.cover === 'OVC')
    .sort((a, b) => (a.baseFt ?? 99999) - (b.baseFt ?? 99999))
  return layers.length > 0 ? layers[0].baseFt : null
}

function periodMaxCover(p) {
  if (!p?.clouds?.length) return 'CLR'
  const rank = { CLR: 0, SKC: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 4 }
  let best = 'CLR'
  for (const c of p.clouds) {
    if ((rank[c.cover] ?? 0) > (rank[best] ?? 0)) best = c.cover
  }
  return best
}

/** Find prevailing TAF period for a given UTC ordinal (day*100 + hour). */
function prevailingAt(periods, ord) {
  let best = periods[0] ?? null
  for (const p of periods) {
    // TEMPO / PROB overlay the prevailing — we track them separately
    if (p.type === 'TEMPO' || p.type === 'PROB30' || p.type === 'PROB40') continue
    const fromOrd = ddhhToOrd(p.from)
    if (fromOrd <= ord) best = p
  }
  return best
}

/** Find any TEMPO / PROB period active at a given UTC ordinal. */
function tempoAt(periods, ord) {
  for (const p of periods) {
    if (p.type !== 'TEMPO' && p.type !== 'PROB30' && p.type !== 'PROB40') continue
    const fromOrd = ddhhToOrd(p.from)
    const toOrd   = ddhhToOrd(p.to)
    if (ord >= fromOrd && ord < toOrd) return p
  }
  return null
}

// Weather symbol mapping — phenomena code → short emoji-free symbol
const WX_SYM = {
  RA: '/', DZ: ',', SN: '*', SG: '*', PL: '!', GR: '!', GS: '!',
  TS: '\u26A1', FG: '\u2588', BR: '\u2591', HZ: '\u2591', FU: '\u2591',
  VA: '\u25B2', DU: '\u25B2', SA: '\u25B2', FC: '\u0192', SQ: '\u25A0',
  TSRA: '\u26A1/', TSSN: '\u26A1*', FZRA: '/', FZDZ: ',',
  BLSN: '*\u2192', DRSN: '*~', BLDU: '\u25B2\u2192',
}

function wxSymbol(codes) {
  if (!codes?.length) return null
  return codes.map((c) => {
    const stripped = c.replace(/^[-+]/, '')
    return WX_SYM[stripped] ?? c
  }).join('')
}

function wxIntensity(codes) {
  if (!codes?.length) return null
  for (const c of codes) {
    if (c.startsWith('+')) return 'heavy'
    if (c.startsWith('-')) return 'light'
  }
  return 'moderate'
}

// Cloud cover → visual representation
const COVER_GLYPHS = {
  CLR: '\u25CB',     // ○  empty circle
  SKC: '\u25CB',     // ○
  FEW: '\u25D4',     // ◔  quarter
  SCT: '\u25D1',     // ◑  half
  BKN: '\u25D5',     // ◕  three-quarter
  OVC: '\u25CF',     // ●  filled
  VV:  '\u25A0',     // ■  obscured
}

/**
 * Build 13 hourly weather buckets from TAF periods.
 * Falls back to altTaf when primary has no periods.
 * Current hour uses live METAR.
 */
function buildHourlyWeather(primaryTaf, altTaf, metar) {
  const taf = (primaryTaf?.parsed?.periods?.length) ? primaryTaf : altTaf
  const periods = taf?.parsed?.periods ?? []
  const tafSrc  = taf === altTaf ? 'ALT TAF' : 'TAF'

  const now = new Date()
  const currentHour = now.getHours()
  const todayDD = now.getUTCDate()
  // Offset: local hour → UTC hour (approximate from JS timezone offset)
  const tzOffsetH = Math.round(now.getTimezoneOffset() / 60)

  return Array.from({ length: NUM_HOURS }, (_, i) => {
    const hour    = DAY_START_HOUR + i
    const isPast  = hour < currentHour
    const isCurr  = hour === currentHour
    const hourUtc = (hour + tzOffsetH + 24) % 24
    const dayUtc  = hour + tzOffsetH >= 24 ? todayDD + 1 : todayDD
    const ord     = dayUtc * 100 + hourUtc

    // Current hour → live METAR
    if (isCurr && metar) {
      const cover = periodMaxCover({ clouds: metar.parsed?.clouds ?? metar.clouds ?? [] })
      return {
        hour, isPast, isCurrent: true,
        cat:    metarCat(metar),
        wind:   metarWind(metar),
        windSpd: metar.parsed?.wind?.speed ?? metar.wspd ?? null,
        gust:    metar.parsed?.wind?.gust ?? metar.wgst ?? null,
        windDir: metar.parsed?.wind?.direction ?? metar.wdir ?? null,
        ceil:    metarCeiling(metar),
        vis:     metarVis(metar),
        wx:      metar.parsed?.weather ?? [],
        cover,
        src:     'METAR',
        tempo:   null,
      }
    }

    // TAF
    const prev  = prevailingAt(periods, ord)
    const tempo = tempoAt(periods, ord)

    return {
      hour, isPast, isCurrent: false,
      cat:     prev ? periodCat(prev) : null,
      wind:    prev ? periodWind(prev) : null,
      windSpd: periodWindSpd(prev),
      gust:    periodGust(prev),
      windDir: periodWindDir(prev),
      ceil:    prev ? periodCeil(prev) : null,
      vis:     prev?.visibility ? `${prev.visibility.plus ? 'P' : ''}${prev.visibility.value}` : null,
      wx:      prev?.weather ?? [],
      cover:   prev ? periodMaxCover(prev) : 'CLR',
      src:     tafSrc,
      tempo:   tempo ? {
        wx:    tempo.weather ?? [],
        cover: periodMaxCover(tempo),
        cat:   periodCat(tempo),
        vis:   tempo.visibility ? `${tempo.visibility.plus ? 'P' : ''}${tempo.visibility.value}` : null,
      } : null,
    }
  })
}

// ─── Geo filter + dedup ──────────────────────────────────────────────────────

/** Does any coordinate in a GeoJSON geometry fall within a lat/lon bounding box? */
function featureInBounds(feature, bounds) {
  if (!feature?.geometry?.coordinates) return false
  const { north, south, west, east } = bounds
  const coords = flattenCoords(feature.geometry.coordinates)
  return coords.some(([lon, lat]) => lat >= south && lat <= north && lon >= west && lon <= east)
}

function flattenCoords(arr) {
  if (typeof arr[0] === 'number') return [arr]           // [lon,lat]
  if (Array.isArray(arr[0]) && typeof arr[0][0] === 'number') return arr  // [[lon,lat],…]
  return arr.flatMap(flattenCoords)                       // nested rings / multi
}

/** Deduplicate GeoJSON features by raw text or hazard+type combo. */
function dedup(features) {
  const seen = new Set()
  return features.filter((f) => {
    const key = f.properties?.rawAirSigmet
      ?? f.properties?.raw
      ?? `${f.properties?.hazard ?? ''}|${f.properties?.airsigmet_type ?? ''}|${f.id ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── WeatherBar ──────────────────────────────────────────────────────────────

export function WeatherBar() {
  const [gs, setGs]           = useState(getGliderSettings)
  const [baseMetar, setBase]  = useState(null)
  const [baseTaf, setBaseTaf] = useState(null)
  const [altTaf, setAltTaf]   = useState(null)
  const [winds, setWinds]     = useState(null)    // winds-aloft response
  const [allAirmets, setAllAirmets] = useState([])
  const [allSigmets, setAllSigmets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [lastRefresh, setLast] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => subscribeGliderSettings(setGs), [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const s = getGliderSettings()
    try {
      const [metarRes, baseTafRes, altTafRes, windsRes, airmetsRes, sigmetsRes] = await Promise.all([
        fetch(`${WEATHER}/api/metar/${s.baseAirport}`).catch(() => null),
        fetch(`${WEATHER}/api/taf/${s.baseAirport}`).catch(() => null),
        fetch(`${WEATHER}/api/taf/${s.altTafAirport}`).catch(() => null),
        fetch(`${WEATHER}/api/winds-aloft?region=slc`).catch(() => null),
        fetch(`${WEATHER}/api/airmets`).catch(() => null),
        fetch(`${WEATHER}/api/sigmets`).catch(() => null),
      ])
      if (metarRes?.ok) {
        const d = await metarRes.json()
        setBase(Array.isArray(d?.data) ? d.data[0] : Array.isArray(d) ? d[0] : d)
      }
      if (baseTafRes?.ok) {
        const d = await baseTafRes.json()
        setBaseTaf(Array.isArray(d?.data) ? d.data[0] : Array.isArray(d) ? d[0] : d)
      }
      if (altTafRes?.ok) {
        const d = await altTafRes.json()
        setAltTaf(Array.isArray(d?.data) ? d.data[0] : Array.isArray(d) ? d[0] : d)
      }
      if (windsRes?.ok) setWinds(await windsRes.json())
      if (airmetsRes?.ok) {
        const d = await airmetsRes.json()
        const regional = (d?.features ?? []).filter((f) => featureInBounds(f, s.regionBounds))
        setAllAirmets(dedup(regional))
      }
      if (sigmetsRes?.ok) {
        const d = await sigmetsRes.json()
        const regional = (d?.features ?? []).filter((f) => featureInBounds(f, s.regionBounds))
        setAllSigmets(dedup(regional))
      }
      setLast(new Date())
    } catch {
      setError('Weather unavailable — check :3000')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh(); const id = setInterval(refresh, 10 * 60_000); return () => clearInterval(id) }, [refresh])

  // ── Derived ────────────────────────────────────────────────────────────────
  const cat      = metarCat(baseMetar)
  const wind     = metarWind(baseMetar)
  const ceil     = metarCeiling(baseMetar)
  const vis      = metarVis(baseMetar)
  const temp     = baseMetar?.temp != null ? `${baseMetar.temp}°C` : (baseMetar?.parsed?.temperature != null ? `${baseMetar.parsed.temperature}°C` : null)
  const dewpt    = baseMetar?.dewp != null ? `/${baseMetar.dewp}°C` : (baseMetar?.parsed?.dewpoint != null ? `/${baseMetar.parsed.dewpoint}°C` : '')
  const altim    = baseMetar?.parsed?.altimeter ? `A${baseMetar.parsed.altimeter.value.toFixed(2)}` : (baseMetar?.altim != null ? `A${(baseMetar.altim / 33.8639).toFixed(2)}` : null)

  const sigmetTypes = [...new Set(allSigmets.map((f) => f.properties?.hazard ?? f.properties?.airsigmet_type ?? 'SIGMET'))]
  const airmetTypes = [...new Set(allAirmets.map((f) => f.properties?.hazard ?? f.properties?.airsigmet_type ?? 'AIRMET'))]

  // Winds aloft — find station closest to base airport
  // Prefer a station matching the base ICAO (strip K prefix), else first
  const baseId3 = gs.baseAirport.replace(/^K/, '')
  const windsStation = winds?.stations?.find((s) => s.stationId === baseId3)
    ?? winds?.stations?.[0] ?? null
  const windsValid = winds?.validTime ?? null
  // Glider-relevant altitudes: surface through FL180
  const ALOFT_ALTS = ['18000', '12000', '9000', '6000', '3000']
  const aloftRows = ALOFT_ALTS.map((alt) => {
    const w = windsStation?.winds?.[alt]
    return { alt: Number(alt), label: Number(alt) >= 18000 ? 'FL180' : `${Number(alt)/1000}k`, w }
  }).filter((r) => r.w)

  // Hourly weather strip — falls back to alt TAF if primary has no periods
  const hourly = buildHourlyWeather(baseTaf, altTaf, baseMetar)

  // NOW line
  const nowDate    = new Date()
  const nowMinutes = (nowDate.getHours() - DAY_START_HOUR) * 60 + nowDate.getMinutes()
  const totalMin   = NUM_HOURS * 60
  const nowPct     = Math.min(100, Math.max(0, (nowMinutes / totalMin) * 100))
  const showNow    = nowMinutes >= 0 && nowMinutes <= totalMin

  // TAF periods for detail panel
  const baseTafPeriods = baseTaf?.parsed?.periods ?? []
  const altTafPeriods  = altTaf?.parsed?.periods ?? []

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">

      {/* ── Thin summary strip ── */}
      {/* Uses the EXACT same flex layout as the violin chart:
          40px left gutter → flex-1 columns (gap:1, minWidth:24) → 4px right spacer.
          Winds aloft + badges float in an overlay so they don't affect column widths. */}
      <div className="relative">
        <div className="flex gap-0 overflow-x-auto py-1.5">

          {/* Left gutter — 40px, same as violin y-axis labels */}
          <div
            className="flex items-center justify-end pr-1.5 flex-shrink-0"
            style={{ width: 40 }}
          >
            {cat ? (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded border leading-none ${CAT_STYLE[cat]}`}>{cat}</span>
            ) : (
              <span className="text-[9px] text-slate-600">WX</span>
            )}
          </div>

          {/* ── Hourly columns — identical flex container to violin ── */}
          <div className="relative flex flex-1 min-w-0" style={{ gap: 1 }}>
            {/* NOW line */}
            {showNow && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-10"
                style={{ left: `${nowPct}%`, width: 1.5, background: 'rgba(251,191,36,0.7)' }}
              />
            )}
            {hourly.map((h, i) => {
              const c = h.cat
              const bg = c ? (CAT_BG[c] ?? 'bg-slate-700') : 'bg-slate-800/40'
              const opacity = h.isPast ? 'opacity-30' : h.isCurrent ? 'opacity-100' : 'opacity-70'
              const ceilVal = h.ceil
              const sym    = wxSymbol(h.wx)
              const tSym   = h.tempo ? wxSymbol(h.tempo.wx) : null
              const cover  = COVER_GLYPHS[h.cover] ?? COVER_GLYPHS.CLR
              const tCover = h.tempo ? (COVER_GLYPHS[h.tempo.cover] ?? null) : null
              const int    = wxIntensity(h.wx)
              const wxColor = int === 'heavy' ? 'text-red-400' : int === 'moderate' ? 'text-amber-400' : 'text-sky-400'
              const arrow = h.windDir != null ? String.fromCodePoint(0x2191) : null
              const arrowRot = h.windDir != null ? (h.windDir + 180) % 360 : 0

              return (
                <div
                  key={i}
                  className={`flex flex-col items-center flex-1 min-w-0 rounded-sm overflow-hidden ${opacity}`}
                  style={{ minWidth: 24 }}
                  title={[
                    `${String(h.hour).padStart(2, '0')}:00`,
                    h.cat,
                    h.wind,
                    `ceil ${ceilVal != null ? `${ceilVal}ft` : 'CLR'}`,
                    `vis ${h.vis ?? '?'}`,
                    h.cover,
                    h.wx?.length ? h.wx.join(' ') : null,
                    h.tempo ? `TEMPO: ${h.tempo.wx.join(' ')} ${h.tempo.cover}` : null,
                    `(${h.src})`,
                  ].filter(Boolean).join(' · ')}
                >
                  {/* Category color band */}
                  <div className={`w-full h-1.5 ${bg}`} />

                  {/* Symbolic column */}
                  <div className="flex flex-col items-center py-0.5 gap-0 w-full min-h-[36px] justify-center">
                    <span className={`text-[10px] leading-none ${
                      h.cover === 'OVC' || h.cover === 'VV' ? 'text-slate-300' :
                      h.cover === 'BKN' ? 'text-slate-400' :
                      h.cover === 'SCT' ? 'text-slate-500' : 'text-slate-600'
                    }`}>{cover}</span>

                    {sym ? (
                      <span className={`text-[10px] leading-none ${wxColor}`}>{sym}</span>
                    ) : (
                      arrow && <span
                        className="text-[9px] text-slate-500 leading-none inline-block"
                        style={{ transform: `rotate(${arrowRot}deg)` }}
                      >{arrow}</span>
                    )}

                    {h.tempo && (tSym || tCover) && (
                      <span className="text-[7px] text-amber-500/60 leading-none" title="TEMPO">
                        {tSym ?? tCover}
                      </span>
                    )}

                    <span className={`text-[7px] font-mono leading-none ${
                      (h.gust ?? 0) >= 25 ? 'text-red-400' :
                      (h.windSpd ?? 0) >= 15 ? 'text-yellow-400' : 'text-slate-500'
                    }`}>
                      {h.windSpd != null ? `${h.windSpd}${h.gust ? `G${h.gust}` : ''}` : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right spacer — 4px, same as violin */}
          <div style={{ width: 4 }} className="flex-shrink-0" />
        </div>

        {/* ── Overlay: winds aloft + badges (absolute, right-aligned, no layout impact) ── */}
        <div className="absolute top-0 right-0 bottom-0 flex items-center gap-1.5 pr-2 pointer-events-none">

          {/* Winds aloft vertical panel */}
          {aloftRows.length > 0 && (
            <div
              className="flex flex-col gap-0 bg-surface-card/90 backdrop-blur-sm border-l border-surface-border pl-1.5 pr-1 py-0.5 rounded-l pointer-events-auto"
              title={`Winds Aloft — ${windsStation?.stationId ?? '?'}`}
            >
              {aloftRows.map((r) => {
                const spd = r.w.speed
                const spdColor = spd == null ? 'text-slate-600'
                  : spd >= 40 ? 'text-red-400'
                  : spd >= 25 ? 'text-yellow-400'
                  : spd >= 15 ? 'text-slate-300' : 'text-slate-500'
                const quad = dirQuadrant(r.w.dir)
                return (
                  <div key={r.alt} className="flex items-center gap-0.5 leading-none" title={r.w.display ?? r.w.raw}>
                    <span className="text-[7px] text-slate-600 font-mono w-6 text-right">{r.label}</span>
                    <span className="text-[8px] text-slate-500 w-5 text-center">{quad}</span>
                    <span className={`text-[8px] font-mono font-bold w-5 text-right ${spdColor}`}>
                      {spd ?? '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Badges + controls */}
          <div className="flex items-center gap-1 pointer-events-auto bg-surface-card/90 backdrop-blur-sm rounded-l px-1 py-0.5">
            {allSigmets.length > 0 && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded border border-red-500/40 bg-red-500/15 text-red-400 leading-none whitespace-nowrap">
                {allSigmets.length}S
              </span>
            )}
            {allAirmets.length > 0 && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded border border-yellow-500/40 bg-yellow-500/15 text-yellow-400 leading-none whitespace-nowrap">
                {allAirmets.length}A
              </span>
            )}
            {loading && <span className="text-[8px] text-sky-400 animate-pulse">…</span>}
            <button
              onClick={(e) => { e.stopPropagation(); refresh() }}
              disabled={loading}
              className="text-[9px] px-1 py-0.5 rounded border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-colors disabled:opacity-40"
              title="Refresh weather"
            >↺</button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-all px-1"
              title={expanded ? 'Collapse' : 'Expand weather details'}
            >
              <span className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[9px] text-red-400 bg-red-500/5 px-4 py-1 border-t border-red-500/10">{error}</div>
      )}

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="border-t border-surface-border px-4 py-3 flex flex-col gap-3">

          {/* Current conditions summary */}
          {baseMetar && (
            <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono text-slate-300">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide not-italic">{gs.baseAirport}</span>
              <span>{wind}</span>
              <span className="text-slate-600">·</span>
              <span className={ceil == null ? 'text-green-400' : ceil >= 3000 ? 'text-green-400' : ceil >= 1000 ? 'text-yellow-400' : 'text-red-400'}>
                {ceil != null ? `${ceil.toLocaleString()}ft` : 'CLR'}
              </span>
              <span className="text-slate-600">·</span>
              <span>{vis}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">{temp}{dewpt}</span>
              {altim && <><span className="text-slate-600">·</span><span className="text-slate-400">{altim}</span></>}
              {baseMetar.parsed?.weather?.length > 0 && (
                <span className="text-amber-400">{baseMetar.parsed.weather.join(' ')}</span>
              )}
              {lastRefresh && (
                <span className="text-[9px] text-slate-600 ml-auto">
                  {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* Winds aloft */}
          {windsStation && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Winds Aloft</span>
                <span className="text-[9px] text-slate-600 font-mono">{windsStation.stationId}</span>
                {windsValid && <span className="text-[8px] text-slate-600 font-mono">{windsValid.slice(0, 50)}</span>}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(windsStation.winds ?? {}).map(([alt, w]) => (
                  <div key={alt} className="rounded border border-surface-border px-2 py-1 flex flex-col items-center gap-0">
                    <span className="text-[8px] text-slate-500 font-mono">{Number(alt) >= 18000 ? `FL${Number(alt)/100}` : `${alt}′`}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-200">{w.display ?? w.raw}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAFs side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TafSummary label={`${gs.baseAirport} TAF`} taf={baseTaf} periods={baseTafPeriods} />
            <TafSummary label={`${gs.altTafAirport} TAF (alt)`} taf={altTaf} periods={altTafPeriods} />
          </div>

          {/* SIGMET / AIRMET details */}
          {(allSigmets.length > 0 || allAirmets.length > 0) && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                Advisories — {allSigmets.length} SIGMET{allSigmets.length !== 1 ? 's' : ''} · {allAirmets.length} AIRMET{allAirmets.length !== 1 ? 's' : ''}
              </span>
              {allSigmets.map((f, i) => (
                <div key={`s${i}`} className="text-[10px] rounded border border-red-500/20 bg-red-500/5 px-3 py-1 text-red-300 font-mono">
                  <span className="font-bold text-red-400 mr-1.5">SIGMET</span>
                  {f.properties?.hazard ?? f.properties?.airsigmet_type ?? ''}
                  {f.properties?.rawAirSigmet && (
                    <span className="text-red-400/50 ml-1.5">{f.properties.rawAirSigmet.slice(0, 140)}</span>
                  )}
                </div>
              ))}
              {allAirmets.map((f, i) => (
                <div key={`a${i}`} className="text-[10px] rounded border border-yellow-500/20 bg-yellow-500/5 px-3 py-1 text-yellow-300 font-mono">
                  <span className="font-bold text-yellow-400 mr-1.5">AIRMET</span>
                  {f.properties?.hazard ?? f.properties?.airsigmet_type ?? ''}
                  {f.properties?.rawAirSigmet && (
                    <span className="text-yellow-400/50 ml-1.5">{f.properties.rawAirSigmet.slice(0, 140)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Raw METAR */}
          {(baseMetar?.rawOb ?? baseMetar?.parsed?.raw) && (
            <div className="text-[9px] font-mono text-slate-500 bg-slate-800/40 rounded px-3 py-1.5 break-all">
              {baseMetar.rawOb ?? baseMetar.parsed.raw}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAF Summary Card ────────────────────────────────────────────────────────

function TafSummary({ label, taf, periods }) {
  if (!taf) {
    return (
      <div className="rounded border border-surface-border px-3 py-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
        <p className="text-[10px] text-slate-600 italic mt-0.5">No TAF available</p>
      </div>
    )
  }

  return (
    <div className="rounded border border-surface-border px-3 py-1.5 flex flex-col gap-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      {periods.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {periods.slice(0, 6).map((p, i) => {
            const w = p.wind
              ? `${p.wind.variable ? 'VRB' : String(p.wind.direction).padStart(3, '0')}/${p.wind.speed}${p.wind.gust ? `G${p.wind.gust}` : ''}kt`
              : null
            const v = p.visibility ? `${p.visibility.plus ? 'P' : ''}${p.visibility.value}${p.visibility.unit}` : null
            const cover = (p.clouds ?? []).map((c) => `${c.cover}${c.baseFt != null ? Math.round(c.baseFt / 100) : ''}`).join(' ')
            return (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="font-bold text-slate-500 w-10">{p.type}</span>
                <span className="text-slate-600 font-mono w-12">{p.from}–{p.to}</span>
                {w && <span className="font-mono text-slate-300">{w}</span>}
                {v && <span>{v}</span>}
                {cover && <span className="text-slate-500">{cover}</span>}
                {p.weather?.length > 0 && <span className="text-amber-400">{p.weather.join(' ')}</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-[10px] font-mono text-slate-500 break-all">
          {taf.rawTAF ?? taf.parsed?.raw ?? '—'}
        </div>
      )}
    </div>
  )
}
