// Shared aircraft silhouette SVGs — category-based planform views.
// Extracted from FlightBar for reuse in FleetCard, FlightRiskList, etc.

function categoriseAircraft(icaoType) {
  if (!icaoType) return 'single'
  const t = icaoType.toUpperCase()
  if (['BE58', 'PA34'].includes(t)) return 'twin'
  if (['C208', 'DHC6'].includes(t)) return 'turboprop'
  if (['S33', 'S32', 'S34', 'G103', 'ASK21', 'DG1000'].includes(t)) return 'glider'
  if (['PA25', 'PA18', 'CIAB'].includes(t)) return 'taildragger'
  if (['ALPT', 'VIRS'].includes(t)) return 'lsa'
  return 'single'
}

export function AircraftSilhouette({ icaoType, className = '' }) {
  const cat = categoriseAircraft(icaoType)
  return (
    <svg viewBox="0 0 64 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {cat === 'twin' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 20h52M32 8l-4 12 4 4 4-4-4-12Z" fill="currentColor" fillOpacity=".12" />
          <path d="M20 14l-12 6 12 6" />
          <path d="M44 14l12 6-12 6" />
          <path d="M28 32l4 4 4-4" />
          <circle cx="16" cy="20" r="2.5" fill="currentColor" fillOpacity=".25" />
          <circle cx="48" cy="20" r="2.5" fill="currentColor" fillOpacity=".25" />
        </g>
      )}
      {cat === 'turboprop' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 18h48M32 6l-3 12 3 6 3-6-3-12Z" fill="currentColor" fillOpacity=".12" />
          <path d="M14 14l-6 4 6 4" />
          <path d="M50 14l6 4-6 4" />
          <path d="M29 34l3 3 3-3" />
          <ellipse cx="32" cy="7" rx="2" ry="3" fill="currentColor" fillOpacity=".2" />
          <line x1="8" y1="18" x2="8" y2="22" />
          <line x1="56" y1="18" x2="56" y2="22" />
        </g>
      )}
      {cat === 'glider' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h60M32 10l-2 10 2 4 2-4-2-10Z" fill="currentColor" fillOpacity=".12" />
          <path d="M28 32l4 5 4-5" />
        </g>
      )}
      {cat === 'taildragger' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 20h44M32 10l-3 10 3 4 3-4-3-10Z" fill="currentColor" fillOpacity=".12" />
          <path d="M22 15l-10 5 10 5" />
          <path d="M42 15l10 5-10 5" />
          <path d="M29 33l3 4 3-4" />
          <circle cx="32" cy="10" r="2" fill="currentColor" fillOpacity=".3" />
        </g>
      )}
      {cat === 'lsa' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 20h36M32 12l-2 8 2 4 2-4-2-8Z" fill="currentColor" fillOpacity=".12" />
          <path d="M24 16l-8 4 8 4" />
          <path d="M40 16l8 4-8 4" />
          <path d="M30 32l2 3 2-3" />
        </g>
      )}
      {cat === 'single' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 20h44M32 8l-3 12 3 4 3-4-3-12Z" fill="currentColor" fillOpacity=".12" />
          <path d="M20 15l-10 5 10 5" />
          <path d="M44 15l10 5-10 5" />
          <path d="M29 33l3 4 3-4" />
          <circle cx="32" cy="9" r="2" fill="currentColor" fillOpacity=".3" />
        </g>
      )}
    </svg>
  )
}

export { categoriseAircraft }
