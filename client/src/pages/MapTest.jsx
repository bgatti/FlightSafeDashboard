import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchActiveExcursions, fetchOffenseSegments, KLASS_COLORS } from '../lib/noiseApi'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

const OSM_ATTR = '&copy; OpenStreetMap contributors'
const CARTO_ATTR = '&copy; OpenStreetMap &copy; CARTO'

// Built-in style presets. `labels` layer is optional (monochrome no-label bases).
const STYLES = {
  'carto-dark': {
    label: 'CARTO Dark Matter',
    base: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    labels: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR,
    defaults: { brightness: 100, contrast: 100, saturation: 0, invert: 0 },
    bg: '#0a0a0a',
  },
  'carto-light': {
    label: 'CARTO Positron',
    base: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    labels: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR,
    defaults: { brightness: 100, contrast: 100, saturation: 0, invert: 0 },
    bg: '#f5f5f5',
  },
  'carto-voyager': {
    label: 'CARTO Voyager',
    base: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
    labels: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    attribution: CARTO_ATTR,
    defaults: { brightness: 100, contrast: 100, saturation: 100, invert: 0 },
    bg: '#eef3f7',
  },
  'osm': {
    label: 'OpenStreetMap',
    base: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    labels: null,
    attribution: OSM_ATTR,
    defaults: { brightness: 100, contrast: 100, saturation: 100, invert: 0 },
    bg: '#aad3df',
  },
  'osm-mono': {
    label: 'OSM Monochrome',
    base: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    labels: null,
    attribution: OSM_ATTR,
    defaults: { brightness: 105, contrast: 95, saturation: 0, invert: 0 },
    bg: '#dadada',
  },
  'esri-satellite': {
    label: 'Esri Satellite',
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labels: null,
    attribution: 'Tiles &copy; Esri',
    defaults: { brightness: 100, contrast: 100, saturation: 100, invert: 0 },
    bg: '#000',
  },
  'esri-topo': {
    label: 'Esri Topographic',
    base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    labels: null,
    attribution: 'Tiles &copy; Esri',
    defaults: { brightness: 100, contrast: 100, saturation: 100, invert: 0 },
    bg: '#e8e8e8',
  },
}

const FALLBACK = { lat: 39.9086, lng: -105.1172, label: 'KBJC · Rocky Mountain Metro' }

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Query Overpass for nearby named highways, then find the node shared between
 * two differently-named ways that is closest to our point. That's the nearest
 * cross street / intersection.
 */
const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
]

async function fetchNearestCrossStreet(lat, lng, { signal } = {}) {
  const radius = 400
  const q =
    `[out:json][timeout:10];` +
    `way(around:${radius},${lat},${lng})[highway][name];` +
    `out tags geom;`

  let data = null
  let lastErr = null
  for (const url of OVERPASS_MIRRORS) {
    // Per-mirror timeout so a hung endpoint can't eat the whole budget
    const mirrorCtrl = new AbortController()
    const onAbort = () => mirrorCtrl.abort()
    signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => mirrorCtrl.abort(), 8000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        signal: mirrorCtrl.signal,
      })
      if (!res.ok) { lastErr = new Error(`overpass ${res.status}`); continue }
      data = await res.json()
      break
    } catch (err) {
      // If the outer (tier) signal aborted, stop entirely
      if (signal?.aborted) throw err
      lastErr = err
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  if (!data) throw lastErr ?? new Error('overpass unavailable')
  const ways = data.elements || []

  // Bucket geometry points, tracking which road names touch each point
  const buckets = new Map()
  for (const w of ways) {
    const name = w.tags?.name
    if (!name || !w.geometry) continue
    for (const p of w.geometry) {
      const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`
      let b = buckets.get(key)
      if (!b) {
        b = { lat: p.lat, lng: p.lon, names: new Set() }
        buckets.set(key, b)
      }
      b.names.add(name)
    }
  }

  let best = null
  let bestDist = Infinity
  for (const b of buckets.values()) {
    if (b.names.size < 2) continue
    const d = haversineMeters(lat, lng, b.lat, b.lng)
    if (d < bestDist) {
      bestDist = d
      best = b
    }
  }
  if (!best) return null
  const names = Array.from(best.names).slice(0, 2)
  return { names, distanceMeters: bestDist, lat: best.lat, lng: best.lng }
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L)
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = LEAFLET_JS
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function MapTest() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const baseLayerRef = useRef(null)
  const labelLayerRef = useRef(null)
  const markerRef = useRef(null)
  const areaRef = useRef(null)
  const tracesRef = useRef([])

  const [styleKey, setStyleKey] = useState('carto-dark')
  // Precision tier: 'ip' (~10km city), 'area' (~3km), 'precise' (~1km)
  const [precision, setPrecision] = useState('ip')
  const [showLabels, setShowLabels] = useState(true)
  const [brightness, setBrightness] = useState(STYLES['carto-dark'].defaults.brightness)
  const [contrast, setContrast] = useState(STYLES['carto-dark'].defaults.contrast)
  const [saturation, setSaturation] = useState(STYLES['carto-dark'].defaults.saturation)
  const [invert, setInvert] = useState(STYLES['carto-dark'].defaults.invert)

  const [coords, setCoords] = useState(null)
  const [status, setStatus] = useState('Locating…')
  const [crossStreet, setCrossStreet] = useState(null) // { names, distanceMeters } | null
  const [crossStreetStatus, setCrossStreetStatus] = useState('idle')

  // Noise excursions
  const [activeList, setActiveList] = useState([])
  const [activeStatus, setActiveStatus] = useState('idle') // idle|loading|ok|error
  const [selectedTail, setSelectedTail] = useState(null)
  const [segments, setSegments] = useState(null) // { tail, tracks } | null
  const [segStatus, setSegStatus] = useState('idle')

  const style = STYLES[styleKey]
  const isDarkUI = useMemo(() => ['carto-dark', 'esri-satellite'].includes(styleKey), [styleKey])

  const tileFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) invert(${invert}%)`

  // Init map once
  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, {
        center: [FALLBACK.lat, FALLBACK.lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      })
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)
      mapRef.current = map
    })
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Apply style (swap tile layers)
  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) {
      // Retry until map ready
      const id = setInterval(() => {
        if (window.L && mapRef.current) {
          clearInterval(id)
          applyStyle()
        }
      }, 50)
      return () => clearInterval(id)
    }
    applyStyle()

    function applyStyle() {
      if (baseLayerRef.current) { baseLayerRef.current.remove(); baseLayerRef.current = null }
      if (labelLayerRef.current) { labelLayerRef.current.remove(); labelLayerRef.current = null }
      baseLayerRef.current = window.L.tileLayer(style.base, {
        attribution: style.attribution,
        maxZoom: 19,
      }).addTo(mapRef.current)
      if (style.labels && showLabels) {
        labelLayerRef.current = window.L.tileLayer(style.labels, { maxZoom: 19 }).addTo(mapRef.current)
      }
    }
  }, [styleKey, showLabels, style.base, style.labels, style.attribution])

  // Reset sliders when style changes
  useEffect(() => {
    const d = STYLES[styleKey].defaults
    setBrightness(d.brightness)
    setContrast(d.contrast)
    setSaturation(d.saturation)
    setInvert(d.invert)
  }, [styleKey])

  // Geolocate user: default is a silent, low-precision IP lookup (city-level).
  // Opt-in `precise` toggles the browser Geolocation API (still low-accuracy).
  useEffect(() => {
    let cancelled = false
    let cleanupWatch = null
    async function locate() {
      if (precision !== 'ip' && navigator.geolocation) {
        // Check permission state up front so we can show a clearer prompt message
        let perm = 'prompt'
        try {
          if (navigator.permissions?.query) {
            const r = await navigator.permissions.query({ name: 'geolocation' })
            perm = r.state
          }
        } catch { /* some browsers (Safari) don't support it */ }

        if (perm === 'denied') {
          setStatus('Browser location blocked — using IP')
          ipLookup()
          return
        }

        setStatus(perm === 'granted'
          ? 'Getting browser location…'
          : 'Waiting for browser permission…')
        // Snap grid in degrees (1° lat ≈ 111km):
        //   area:    0.05° ≈ 5.5km grid → ±3km circle
        //   precise: 0.01° ≈ 1.1km grid → ±1km circle
        //   fine:    0.0025° ≈ 0.28km grid → ±0.25km circle
        const cfg = {
          area:    { snap: 20,  radius: 3500, label: 'General area',     hint: '~3km'    },
          precise: { snap: 100, radius: 1500, label: 'Approximate area', hint: '~1km'    },
          fine:    { snap: 400, radius: 250,  label: 'Local area',       hint: '~0.25km' },
        }[precision]
        // Use watchPosition so the request stays open while the user decides.
        // Give a 60s overall window to approve, then fall back to IP.
        let watchId = null
        let settled = false
        const finish = () => {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId)
            watchId = null
          }
          clearTimeout(deadline)
        }
        const deadline = setTimeout(() => {
          if (settled || cancelled) return
          settled = true
          finish()
          setStatus('No response — using IP')
          ipLookup()
        }, 60000)

        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (settled || cancelled) return
            settled = true
            finish()
            const lat = Math.round(pos.coords.latitude * cfg.snap) / cfg.snap
            const lng = Math.round(pos.coords.longitude * cfg.snap) / cfg.snap
            setCoords({ lat, lng, label: cfg.label, radius: cfg.radius, source: 'browser' })
            setStatus(`${cfg.label} — browser (${cfg.hint})`)
          },
          (err) => {
            // PERMISSION_DENIED (1) fires immediately on deny — fall back now.
            // Other errors (timeout, unavailable) also fall back.
            if (settled || cancelled) return
            settled = true
            finish()
            setStatus(err.code === 1 ? 'Permission denied — using IP' : 'Location unavailable — using IP')
            ipLookup()
          },
          {
            enableHighAccuracy: precision === 'fine',
            timeout: 60000,
            maximumAge: 600000,
          },
        )

        // Register the cleanup so cancellation from the effect stops the watch
        cleanupWatch = finish
        return
      }
      ipLookup()
    }

    async function ipLookup() {
      setStatus('Estimating area from IP…')
      // Try several free CORS-enabled IP geolocation providers in turn.
      const providers = [
        {
          url: 'https://get.geojs.io/v1/ip/geo.json',
          parse: (d) => ({
            lat: parseFloat(d.latitude),
            lng: parseFloat(d.longitude),
            city: d.city, region: d.region, country: d.country_code,
          }),
        },
        {
          url: 'https://ipapi.co/json/',
          parse: (d) => ({
            lat: d.latitude, lng: d.longitude,
            city: d.city, region: d.region_code, country: d.country_code,
          }),
        },
        {
          url: 'https://freeipapi.com/api/json',
          parse: (d) => ({
            lat: d.latitude, lng: d.longitude,
            city: d.cityName, region: d.regionName, country: d.countryCode,
          }),
        },
      ]

      for (const p of providers) {
        try {
          const res = await fetch(p.url)
          if (!res.ok) continue
          const data = await res.json()
          if (cancelled) return
          const parsed = p.parse(data)
          if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number' || Number.isNaN(parsed.lat)) continue
          const lat = Math.round(parsed.lat * 10) / 10
          const lng = Math.round(parsed.lng * 10) / 10
          const city = [parsed.city, parsed.region, parsed.country].filter(Boolean).join(', ')
          setCoords({
            lat, lng,
            label: city ? `~ ${city}` : 'Approximate area',
            radius: 10000,
            source: 'ip',
          })
          setStatus('Approximate — IP-based (city level)')
          return
        } catch {
          // try next provider
        }
      }
      if (cancelled) return
      setCoords({ ...FALLBACK, radius: 8000 })
      setStatus('All IP lookups failed — showing default site')
    }

    locate()
    return () => {
      cancelled = true
      if (cleanupWatch) cleanupWatch()
    }
  }, [precision])

  // Look up nearest cross street — only when precision is meaningful
  // (browser tiers), otherwise the coords are too rounded for a useful answer.
  useEffect(() => {
    setCrossStreet(null)
    if (!coords || coords.source !== 'browser') {
      setCrossStreetStatus('idle')
      return
    }
    if (precision !== 'precise' && precision !== 'fine') {
      setCrossStreetStatus('idle')
      return
    }
    const ctrl = new AbortController()
    setCrossStreetStatus('loading')
    fetchNearestCrossStreet(coords.lat, coords.lng, { signal: ctrl.signal })
      .then((result) => {
        if (ctrl.signal.aborted) return
        if (result) {
          setCrossStreet(result)
          setCrossStreetStatus('ok')
        } else {
          setCrossStreetStatus('none')
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setCrossStreetStatus('error')
      })
    return () => ctrl.abort()
  }, [coords, precision])

  // Load the active-excursions list once (group-by-type happens in render)
  useEffect(() => {
    const ctrl = new AbortController()
    setActiveStatus('loading')
    fetchActiveExcursions({ hours: 48, signal: ctrl.signal })
      .then((data) => {
        if (ctrl.signal.aborted) return
        setActiveList(data.active || [])
        setActiveStatus('ok')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setActiveStatus('error')
      })
    return () => ctrl.abort()
  }, [])

  // Load segments for the selected tail
  useEffect(() => {
    if (!selectedTail) {
      setSegments(null)
      setSegStatus('idle')
      return
    }
    const ctrl = new AbortController()
    setSegStatus('loading')
    fetchOffenseSegments({ tail: selectedTail, hours: 48, signal: ctrl.signal })
      .then((data) => {
        if (ctrl.signal.aborted) return
        setSegments(data)
        setSegStatus('ok')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setSegStatus('error')
      })
    return () => ctrl.abort()
  }, [selectedTail])

  // Render/replace segment polylines on the map
  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return
    // Always clear prior traces
    for (const p of tracesRef.current) p.remove()
    tracesRef.current = []
    if (!segments || !segments.tracks?.length) return

    const bounds = L.latLngBounds([])
    for (const track of segments.tracks) {
      for (const seg of track.segments || []) {
        if (!seg.points || seg.points.length < 2) continue
        const latlngs = seg.points.map((p) => [p[0], p[1]])
        const color = KLASS_COLORS[seg.klass] || 'rgba(200,200,200,0.6)'
        const weight = seg.klass === 'red' ? 4 : seg.klass === 'orange' ? 3.5 : seg.klass === 'yellow' ? 3 : 2
        // Glow (soft wide under-stroke)
        const glow = L.polyline(latlngs, {
          color, weight: weight + 6, opacity: 0.18, interactive: false,
        }).addTo(map)
        const line = L.polyline(latlngs, {
          color, weight, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
        }).addTo(map)
        tracesRef.current.push(glow, line)
        latlngs.forEach((ll) => bounds.extend(ll))
      }
    }
    if (bounds.isValid()) {
      map.flyToBounds(bounds.pad(0.2), { duration: 1 })
    }
  }, [segments])

  // Draw general-area circle + soft center dot when coords + map are ready
  useEffect(() => {
    if (!coords) return
    const tryPlace = () => {
      const L = window.L
      const map = mapRef.current
      if (!L || !map) {
        requestAnimationFrame(tryPlace)
        return
      }

      const stroke = isDarkUI ? '#fafafa' : '#171717'
      const fill = isDarkUI ? '#ffffff' : '#000000'

      if (areaRef.current) { areaRef.current.remove(); areaRef.current = null }
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }

      areaRef.current = L.circle([coords.lat, coords.lng], {
        radius: coords.radius ?? 8000,
        color: stroke,
        weight: 1.5,
        opacity: 0.7,
        fillColor: fill,
        fillOpacity: 0.13,
        className: 'area-ring',
        interactive: false,
      }).addTo(map)

      // Pick zoom based on circle radius
      const r = coords.radius ?? 8000
      const zoom = r > 6000 ? 10 : r > 2000 ? 12 : r > 800 ? 13 : 15
      map.flyTo([coords.lat, coords.lng], zoom, { duration: 1.2 })
    }
    tryPlace()
  }, [coords, isDarkUI])

  const panelBase = isDarkUI
    ? 'bg-black/60 border-white/10 text-neutral-100'
    : 'bg-white/75 border-black/10 text-neutral-900'
  const labelColor = isDarkUI ? 'text-neutral-500' : 'text-neutral-500'
  const valueColor = isDarkUI ? 'text-neutral-300' : 'text-neutral-700'

  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: style.bg }}
    >
      <style>{`
        .leaflet-container { background: ${style.bg}; outline: none; }
        .leaflet-tile-pane { filter: ${tileFilter}; }
        .leaflet-control-zoom a {
          background: ${isDarkUI ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)'} !important;
          color: ${isDarkUI ? '#e5e5e5' : '#262626'} !important;
          border: 1px solid ${isDarkUI ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'} !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-zoom a:hover {
          background: ${isDarkUI ? 'rgba(40,40,40,0.95)' : 'rgba(245,245,245,1)'} !important;
        }
        .leaflet-control-attribution {
          background: ${isDarkUI ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)'} !important;
          color: ${isDarkUI ? '#6b7280' : '#525252'} !important;
          font-size: 10px !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-attribution a {
          color: ${isDarkUI ? '#9ca3af' : '#404040'} !important;
        }
        .leaflet-overlay-pane svg path.area-ring {
          animation: areaRingBreathe 3.8s ease-in-out infinite;
        }
        @keyframes areaRingBreathe {
          0%, 100% { stroke-opacity: 0.4; stroke-width: 1.25; }
          50%      { stroke-opacity: 1;   stroke-width: 2.75; }
        }
        .map-select {
          width: 100%;
          background: ${isDarkUI ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.9)'};
          color: ${isDarkUI ? '#f5f5f5' : '#171717'};
          border: 1px solid ${isDarkUI ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'};
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 12px;
          outline: none;
          cursor: pointer;
        }
        .map-slider {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px;
          background: ${isDarkUI ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
          border-radius: 2px;
          outline: none;
        }
        .map-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 14px; height: 14px; border-radius: 9999px;
          background: ${isDarkUI ? '#fafafa' : '#171717'};
          border: 2px solid ${isDarkUI ? '#0a0a0a' : '#ffffff'};
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          cursor: pointer;
        }
        .map-slider::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 9999px;
          background: ${isDarkUI ? '#fafafa' : '#171717'};
          border: 2px solid ${isDarkUI ? '#0a0a0a' : '#ffffff'};
          cursor: pointer;
        }
      `}</style>

      <div ref={containerRef} className="absolute inset-0" />

      {/* Site user card */}
      <div className="absolute top-6 left-6 z-[1000] w-64">
        <div className={`${panelBase} backdrop-blur-md border rounded-lg px-4 py-3 shadow-2xl`}>
          <p className={`text-[10px] uppercase tracking-[0.18em] ${labelColor}`}>Site User · General Area</p>
          <p className="text-sm font-medium mt-0.5">{coords?.label ?? 'Estimating…'}</p>
          <p className={`text-[11px] mt-1 ${labelColor}`}>{status}</p>
          {coords && (
            <p className={`text-[10px] mt-0.5 font-mono ${valueColor}`}>
              ~{coords.lat.toFixed(1)}, {coords.lng.toFixed(1)} · ±{((coords.radius ?? 8000) / 1000).toFixed(2)}km
            </p>
          )}
          {crossStreetStatus !== 'idle' && (
            <div className={`mt-2 pt-2 border-t border-current/10`}>
              <p className={`text-[10px] uppercase tracking-[0.15em] ${labelColor}`}>Nearest Cross Street</p>
              {crossStreetStatus === 'loading' && (
                <p className={`text-[11px] mt-0.5 ${labelColor}`}>Searching nearby roads…</p>
              )}
              {crossStreetStatus === 'ok' && crossStreet && (
                <>
                  <p className="text-[12px] font-medium mt-0.5">
                    {crossStreet.names.join(' & ')}
                  </p>
                  <p className={`text-[10px] font-mono ${valueColor}`}>
                    ≈ {crossStreet.distanceMeters < 1000
                      ? `${Math.round(crossStreet.distanceMeters)} m`
                      : `${(crossStreet.distanceMeters / 1000).toFixed(2)} km`} away
                  </p>
                </>
              )}
              {crossStreetStatus === 'none' && (
                <p className={`text-[11px] mt-0.5 ${labelColor}`}>No nearby intersection found</p>
              )}
              {crossStreetStatus === 'error' && (
                <p className={`text-[11px] mt-0.5 ${labelColor}`}>Lookup failed</p>
              )}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-current/10">
            <p className={`text-[10px] uppercase tracking-[0.15em] ${labelColor} mb-1.5`}>Precision</p>
            <div className={`grid grid-cols-4 gap-1 p-0.5 rounded border ${isDarkUI ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
              {[
                { key: 'ip',      label: 'City',   hint: '±10km'  },
                { key: 'area',    label: 'Area',   hint: '±3km'   },
                { key: 'precise', label: 'Local',  hint: '±1km'   },
                { key: 'fine',    label: 'Fine',   hint: '±0.25km'},
              ].map((opt) => {
                const active = precision === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setPrecision(opt.key)}
                    className={`text-[10px] py-1 rounded transition-colors ${
                      active
                        ? (isDarkUI ? 'bg-white/15 text-white' : 'bg-black/15 text-black')
                        : (isDarkUI ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black')
                    }`}
                    title={opt.hint}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[9px] opacity-70">{opt.hint}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Style + parameters panel */}
      <div className="absolute top-6 right-6 z-[1000] w-72">
        <div className={`${panelBase} backdrop-blur-md border rounded-lg p-4 shadow-2xl space-y-4`}>
          <div>
            <p className={`text-[10px] uppercase tracking-[0.18em] ${labelColor} mb-1.5`}>Map Style</p>
            <select
              className="map-select"
              value={styleKey}
              onChange={(e) => setStyleKey(e.target.value)}
            >
              {Object.entries(STYLES).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </div>

          {style.labels && (
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span className={labelColor}>Show labels</span>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="cursor-pointer"
              />
            </label>
          )}

          <div className="space-y-3 pt-1">
            <p className={`text-[10px] uppercase tracking-[0.18em] ${labelColor}`}>Parameters</p>
            <SliderRow
              label="Brightness" value={brightness} min={50} max={150}
              onChange={setBrightness} suffix="%" labelColor={labelColor} valueColor={valueColor}
            />
            <SliderRow
              label="Contrast" value={contrast} min={50} max={150}
              onChange={setContrast} suffix="%" labelColor={labelColor} valueColor={valueColor}
            />
            <SliderRow
              label="Saturation" value={saturation} min={0} max={200}
              onChange={setSaturation} suffix="%" labelColor={labelColor} valueColor={valueColor}
            />
            <SliderRow
              label="Invert" value={invert} min={0} max={100}
              onChange={setInvert} suffix="%" labelColor={labelColor} valueColor={valueColor}
            />
          </div>

          <button
            className={`w-full text-[11px] uppercase tracking-wider py-1.5 rounded border transition-colors ${
              isDarkUI
                ? 'border-white/10 text-neutral-300 hover:bg-white/5'
                : 'border-black/10 text-neutral-700 hover:bg-black/5'
            }`}
            onClick={() => {
              const d = STYLES[styleKey].defaults
              setBrightness(d.brightness)
              setContrast(d.contrast)
              setSaturation(d.saturation)
              setInvert(d.invert)
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Active Noise Excursions panel */}
      <div className="absolute bottom-6 left-6 z-[1000] w-80 max-h-[55vh] flex flex-col">
        <div className={`${panelBase} backdrop-blur-md border rounded-lg shadow-2xl flex flex-col overflow-hidden`}>
          <div className="px-4 py-3 border-b border-current/10 flex items-center justify-between">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.18em] ${labelColor}`}>Active Noise Excursions</p>
              <p className={`text-[11px] mt-0.5`}>
                {activeStatus === 'loading' && 'Loading…'}
                {activeStatus === 'error' && <span className="text-rose-300">Feed unavailable</span>}
                {activeStatus === 'ok' && (
                  <span className={valueColor}>{activeList.length} aircraft · last 48h</span>
                )}
              </p>
            </div>
            {selectedTail && (
              <button
                onClick={() => setSelectedTail(null)}
                className={`text-[10px] ${labelColor} hover:text-current underline underline-offset-2`}
              >
                clear
              </button>
            )}
          </div>
          <ul className="overflow-y-auto flex-1">
            {activeStatus === 'ok' && activeList.length === 0 && (
              <li className={`px-4 py-3 text-[11px] ${labelColor}`}>No active excursions.</li>
            )}
            {(() => {
              // Group by aircraft type; keep tails under each group
              const groups = new Map()
              for (const a of activeList) {
                const key = a.type || 'Unknown'
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key).push(a)
              }
              const rows = []
              for (const [type, aircraft] of groups.entries()) {
                // Representative worst across the type
                const worst = aircraft.reduce((w, a) => {
                  const sev = { yellow: 1, orange: 2, red: 3 }
                  return sev[a.worst] > sev[w.worst] ? a : w
                }, aircraft[0])
                rows.push({ type, count: aircraft.length, worst: worst.worst, tails: aircraft })
              }
              return rows.map((g) => {
                const dot = KLASS_COLORS[g.worst]
                const expanded = g.tails.some((a) => a.tail === selectedTail)
                return (
                  <li key={g.type} className="border-b border-current/5 last:border-b-0">
                    <div className="px-4 py-2.5 flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{g.type}</div>
                        <div className={`text-[10px] ${labelColor}`}>
                          {g.count} {g.count === 1 ? 'aircraft' : 'aircraft'} · worst: {g.worst}
                        </div>
                      </div>
                    </div>
                    <ul className="pb-1">
                      {g.tails.map((a) => {
                        const active = a.tail === selectedTail
                        return (
                          <li key={a.tail}>
                            <button
                              onClick={() => setSelectedTail(active ? null : a.tail)}
                              className={[
                                'w-full text-left px-4 py-1.5 flex items-center gap-2 text-[11px] transition-colors',
                                active
                                  ? (isDarkUI ? 'bg-white/10' : 'bg-black/10')
                                  : (isDarkUI ? 'hover:bg-white/5' : 'hover:bg-black/5'),
                              ].join(' ')}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: KLASS_COLORS[a.worst] }}
                              />
                              <span className="font-mono">{a.tail}</span>
                              <span className={`ml-auto ${labelColor}`}>
                                {a.counts.red > 0 && <span className="text-rose-400">●{a.counts.red} </span>}
                                {a.counts.orange > 0 && <span className="text-orange-400">●{a.counts.orange} </span>}
                                {a.counts.yellow > 0 && <span className="text-yellow-400">●{a.counts.yellow}</span>}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })
            })()}
          </ul>
          {segStatus === 'loading' && (
            <div className={`px-4 py-2 text-[11px] border-t border-current/10 ${labelColor}`}>Loading traces…</div>
          )}
          {segStatus === 'ok' && segments && (
            <div className="px-4 py-2 text-[11px] border-t border-current/10 flex items-center justify-between">
              <span className={labelColor}>
                {segments.tracks?.length || 0} tracks · <span className="font-mono">{segments.tail}</span>
              </span>
              <a
                href={`/noise-report?tail=${encodeURIComponent(segments.tail)}`}
                className="text-sky-300 hover:text-sky-200 underline underline-offset-2"
              >
                report →
              </a>
            </div>
          )}
          {segStatus === 'error' && (
            <div className={`px-4 py-2 text-[11px] border-t border-current/10 text-rose-300`}>
              Failed to load traces
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SliderRow({ label, value, min, max, onChange, suffix = '', labelColor, valueColor }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className={labelColor}>{label}</span>
        <span className={`font-mono ${valueColor}`}>{value}{suffix}</span>
      </div>
      <input
        type="range"
        className="map-slider"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
