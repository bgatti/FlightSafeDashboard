/**
 * SVG route map — continental US with airport markers and route lines.
 * No external map library required.
 */

// ─── Airport coordinate database ─────────────────────────────────────────────
// [lat, lon] — approximate centroids
const AIRPORTS = {
  KATL: [33.64, -84.43], KBOS: [42.36, -71.01], KBWI: [39.18, -76.67],
  KCLT: [35.22, -80.94], KDAL: [32.85, -96.85], KDCA: [38.85, -77.04],
  KDEN: [39.86, -104.67], KDFW: [32.90, -97.04], KDTW: [42.21, -83.35],
  KEWR: [40.69, -74.17],  KFAT: [36.78, -119.72], KIAH: [29.98, -95.34],
  KJFK: [40.64, -73.78], KLAS: [36.08, -115.15], KLAX: [33.94, -118.41],
  KMDW: [41.79, -87.75], KMIA: [25.80, -80.28],  KMSP: [44.88, -93.22],
  KOAK: [37.72, -122.22], KORD: [41.98, -87.90],  KPDX: [45.59, -122.60],
  KPHX: [33.44, -112.01], KPIT: [40.49, -80.23],  KSEA: [47.45, -122.31],
  KSFO: [37.62, -122.38], KSLC: [40.79, -111.98], KSTL: [38.75, -90.37],
  KTPA: [27.98, -82.53],  KASE: [39.22, -106.87], KBFL: [35.43, -119.06],
  KSNA: [33.68, -117.87], KFLL: [26.07, -80.15],  KDAL: [32.85, -96.85],
}

const W = 640, H = 280
const LAT_MIN = 24, LAT_MAX = 50, LON_MIN = -125, LON_MAX = -65

function project(lat, lon) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H
  return [Math.round(x), Math.round(y)]
}

function riskStroke(riskScore) {
  if (!riskScore) return '#475569'
  if (riskScore >= 85) return '#a855f7'
  if (riskScore >= 70) return '#ef4444'
  if (riskScore >= 40) return '#f59e0b'
  return '#22c55e'
}

function trendArrow(trend) {
  if (trend === 'increasing') return '↑'
  if (trend === 'decreasing') return '↓'
  return ''
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RouteMap({ flights = [], selectedId, onSelect }) {
  // Collect all airports referenced by visible flights
  const mentionedAirports = new Set()
  flights.forEach((f) => {
    mentionedAirports.add(f.departure)
    mentionedAirports.add(f.arrival)
  })

  return (
    <div className="bg-slate-900/80 border border-surface-border rounded-xl overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: 'block' }}
        aria-label="Route map"
      >
        {/* Background */}
        <rect width={W} height={H} fill="#0d1117" />

        {/* Subtle latitude grid lines */}
        {[25, 30, 35, 40, 45, 50].map((lat) => {
          const [, y] = project(lat, -95)
          return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="#1e293b" strokeWidth="0.5" />
        })}
        {[-120, -110, -100, -90, -80, -70].map((lon) => {
          const [x] = project(35, lon)
          return <line key={lon} x1={x} y1={0} x2={x} y2={H} stroke="#1e293b" strokeWidth="0.5" />
        })}

        {/* Route lines */}
        {flights.map((f) => {
          const from = AIRPORTS[f.departure]
          const to   = AIRPORTS[f.arrival]
          if (!from || !to) return null
          const [x1, y1] = project(...from)
          const [x2, y2] = project(...to)
          const stroke    = riskStroke(f.riskScore)
          const isSelected = f.id === selectedId
          const trend = f.riskSnapshot?.riskTrend

          // Curved route (quadratic bezier — arc northward)
          const mx = (x1 + x2) / 2
          const my = Math.min(y1, y2) - 30
          const d  = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`

          return (
            <g key={f.id} onClick={() => onSelect?.(f.id)} style={{ cursor: 'pointer' }}>
              {/* Glow for selected */}
              {isSelected && (
                <path d={d} fill="none" stroke={stroke} strokeWidth="6" strokeOpacity={0.25} strokeLinecap="round" />
              )}
              <path
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeOpacity={isSelected ? 1 : 0.7}
                strokeLinecap="round"
                strokeDasharray={f.status === 'active' ? undefined : '5 3'}
              />
              {/* Direction arrow at midpoint */}
              <circle
                cx={mx}
                cy={my + 10}
                r="2.5"
                fill={stroke}
                opacity={0.8}
              />
              {/* Trend badge on route */}
              {trend && trend !== 'stable' && (
                <text x={mx + 5} y={my + 8} fontSize="8" fill={trend === 'increasing' ? '#ef4444' : '#22c55e'}>
                  {trendArrow(trend)}
                </text>
              )}
            </g>
          )
        })}

        {/* Airport markers */}
        {Array.from(mentionedAirports).map((code) => {
          const coords = AIRPORTS[code]
          if (!coords) return null
          const [x, y] = project(...coords)
          return (
            <g key={code}>
              <circle cx={x} cy={y} r="4" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="2" fill="#94a3b8" />
              <text
                x={x + 6}
                y={y + 4}
                fontSize="8"
                fill="#94a3b8"
                style={{ userSelect: 'none', fontFamily: 'monospace' }}
              >
                {code.slice(1)}  {/* strip K prefix for readability */}
              </text>
            </g>
          )
        })}

        {/* Legend */}
        {[
          { color: '#22c55e',  label: 'Low' },
          { color: '#f59e0b',  label: 'Moderate' },
          { color: '#ef4444',  label: 'High' },
          { color: '#a855f7',  label: 'Critical' },
        ].map(({ color, label }, i) => (
          <g key={label} transform={`translate(${W - 86}, ${H - 62 + i * 13})`}>
            <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" />
            <text x="20" y="8" fontSize="8" fill="#64748b">{label}</text>
          </g>
        ))}

        {/* Compass */}
        <text x={W - 10} y={14} fontSize="9" fill="#334155" textAnchor="end">N↑</text>
      </svg>
    </div>
  )
}
