import { useState, useEffect, useMemo, useRef } from 'react'
import {
  FRNAA_INFO, FRNAA_AIRPORTS, FRNAA_SCHOOLS, FRNAA_WINGS_EVENTS,
  FRNAA_FLEET, FRNAA_TIERS, FRNAA_BOARD, REMEDIATION_STAGES,
  FRNAA_UNLEADED_INFO,
  getExcursionsForTail, getLeaderboard,
  getMostImproved, getAirportRankings, getBasedAircraftLeaderboard,
} from './frnaaData'
import { fetchLeaderboard, fetchMissions } from '../lib/noiseApi'

/* ═══════════════════════════════════════════════════════════
   Airport Impact District — Visitor Portal
   Full-screen, hash-routed public site + admin dashboard
   ═══════════════════════════════════════════════════════════ */

/* ─── Real aerial photos of the Front Range. Verified CC licenses
       on Wikimedia Commons. First non-empty entry is used as the
       hero backdrop; SVG silhouette is the fallback. ─── */
const FRONT_RANGE_PHOTOS = [
  {
    // Taken from a United 757 passing over Denver, Nov 2011.
    // Ethereal high-altitude aerial, snow-capped Front Range under broken clouds.
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Front_Range_of_the_Rockies_from_United_793_%286305381628%29.jpg',
    credit: 'Photo: Front Range from United 793 / Wikimedia Commons (CC BY-SA 2.0)',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Aerial_view_of_the_Rockies.JPG',
    credit: 'Photo: Aerial view of the Colorado Rockies / Wikimedia Commons (CC BY-SA 2.5)',
  },
]

/* ─── Layered SVG of the Front Range profile (Longs Peak / Mt
       Meeker / Twin Sisters sweeping down toward Denver). Pure
       CSS/SVG so nothing depends on an external host. ─── */
function FrontRangeBackdrop({ className = '', intensity = 'full', photoIndex = 0 }) {
  const photo = FRONT_RANGE_PHOTOS[photoIndex]
  if (photo) {
    // Much lighter scrims so the Front Range photo actually shows through.
    // Intensity "full" = hero (photo front and center);
    // "subtle" = closing CTA (more readability weight).
    const scrim = intensity === 'subtle'
      ? 'from-slate-950/55 via-slate-950/35 to-slate-950/75'
      : 'from-slate-950/35 via-slate-950/10 to-slate-950/75'
    return (
      <div className={`absolute inset-0 ${className}`}>
        <div
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{
            backgroundImage: `url("${photo.url}")`,
            filter: 'saturate(1.05) contrast(1.08) brightness(1.02)',
          }}
        />
        {/* Readability gradient only — no heavy color wash */}
        <div className={`absolute inset-0 bg-gradient-to-b ${scrim}`} />
        <div className="absolute bottom-1 right-2 text-[9px] text-slate-400/70 font-mono tracking-wide">
          {photo.credit}
        </div>
      </div>
    )
  }
  const starOpacity = intensity === 'subtle' ? 0.3 : 0.6
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {/* Dawn sky gradient — deep violet → sky blue → warm horizon */}
          <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="#0c1020" />
            <stop offset="40%" stopColor="#1e2b4a" />
            <stop offset="75%" stopColor="#2d3a5f" />
            <stop offset="92%" stopColor="#d97f4e" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f4a261" stopOpacity="0.35" />
          </linearGradient>
          {/* Atmospheric haze behind far peaks */}
          <linearGradient id="far" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3c4868" />
            <stop offset="100%" stopColor="#1f2840" />
          </linearGradient>
          <linearGradient id="mid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e263d" />
            <stop offset="100%" stopColor="#0f1424" />
          </linearGradient>
          <linearGradient id="near" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0b1020" />
            <stop offset="100%" stopColor="#050810" />
          </linearGradient>
          {/* Soft sun glow on the horizon (south-west of KBDU) */}
          <radialGradient id="sun" cx="18%" cy="78%" r="35%">
            <stop offset="0%" stopColor="#fbbf77" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#f4a261" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#f4a261" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky */}
        <rect width="1600" height="900" fill="url(#sky)" />
        <rect width="1600" height="900" fill="url(#sun)" />

        {/* Stars */}
        {Array.from({ length: 60 }).map((_, i) => {
          const x = (i * 97) % 1600
          const y = (i * 53) % 400
          const r = (i % 3) * 0.4 + 0.6
          return <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={starOpacity * (0.4 + (i % 5) / 5)} />
        })}

        {/* Farthest ridge — Continental Divide haze */}
        <path
          fill="url(#far)"
          d="M0,560 L80,520 L160,540 L240,500 L320,480 L400,510 L480,470 L560,490 L640,460 L720,475 L800,440 L880,460 L960,430 L1040,455 L1120,420 L1200,450 L1280,430 L1360,465 L1440,440 L1520,475 L1600,455 L1600,900 L0,900 Z"
        />

        {/* Mid ridge — Longs Peak (14,259') + Mt Meeker dominant on the left */}
        <path
          fill="url(#mid)"
          d="M0,640
             L60,620 L120,600 L180,560 L220,480
             L260,380
             L300,300
             L340,240
             L380,280
             L420,360
             L460,420
             L500,460 L540,500 L580,470 L620,520 L660,490
             L700,540 L740,510 L780,560 L820,530
             L860,580 L900,550 L940,600 L980,570
             L1020,610 L1060,580 L1100,620 L1140,590
             L1180,625 L1220,600 L1260,640 L1300,615
             L1340,650 L1380,625 L1420,660 L1460,640
             L1500,670 L1540,655 L1600,680
             L1600,900 L0,900 Z"
        />

        {/* Label the two signature peaks */}
        <g opacity="0.28" fill="#94a3b8" fontFamily="ui-monospace, monospace" fontSize="11">
          <text x="300" y="285" textAnchor="middle">LONGS PEAK · 14,259′</text>
          <text x="420" y="348" textAnchor="middle">MT MEEKER · 13,916′</text>
        </g>

        {/* Near ridge — foothills rolling toward the plains */}
        <path
          fill="url(#near)"
          d="M0,740
             L80,720 L160,735 L240,700 L320,720 L400,690 L480,715
             L560,680 L640,705 L720,675 L800,700 L880,680 L960,710
             L1040,685 L1120,715 L1200,690 L1280,720 L1360,695 L1440,725 L1520,700 L1600,730
             L1600,900 L0,900 Z"
        />

        {/* Thin flight path arcing across the sky (subtle) */}
        <path
          d="M120,220 Q 800,90 1520,260"
          fill="none"
          stroke="#7dd3fc"
          strokeOpacity="0.18"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <circle cx="1520" cy="260" r="2.5" fill="#7dd3fc" opacity="0.6" />
      </svg>
    </div>
  )
}

/* Sections are all anchor targets on the single long page */
/* Nav entries — one per "issue" plus structural anchors.
   `path` entries navigate instead of scrolling. */
/* Nav order follows a positive → negative → positive rhythm so
   the page alternates between what airports give the community
   and the challenges being addressed. */
const SECTIONS = [
  { id: 'home',         label: 'Home' },
  { id: 'missions',     label: 'Air Missions' },
  { id: 'noise',        label: 'Noise' },
  { id: 'emergency',    label: 'First Responders' },
  { id: 'disaster',     label: 'Disaster' },
  { id: 'soaring',      label: 'Soaring & Skydiving' },
  { id: 'fuel',         label: 'New Fuel' },
  { id: 'universities', label: 'Universities' },
  { id: 'children',     label: 'Children' },
  { id: 'training',     label: 'Training' },
  { id: 'careers',      label: 'Careers' },
  { id: 'family',       label: 'Family' },
  { id: 'report',       label: 'Report Noise', path: '/noise' },
  { id: 'about',        label: 'About Us' },
]

/* Smooth scroll to an anchor id, accounting for both window and the portal
   main's overflow:auto scroll container. */
function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ─────────────────────────────────────────────────────────── */
/*  NAV — translucent blur over the hero photo                 */
/* ─────────────────────────────────────────────────────────── */
function Nav({ onRegister }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/40 border-b border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center gap-6">
        <button onClick={() => scrollToSection('home')} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white font-black text-[11px] shadow-lg">
            AID
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-sm leading-tight group-hover:text-sky-300 transition-colors drop-shadow">Airport Impact</div>
            <div className="text-slate-300 text-[10px] leading-tight drop-shadow">District</div>
          </div>
        </button>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {SECTIONS.map((s) => (
            s.path ? (
              <a
                key={s.id}
                href={s.path}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-amber-200 hover:text-amber-100 hover:bg-amber-500/10 border border-amber-400/30 hover:border-amber-400/60 transition-colors drop-shadow"
              >
                {s.label} ↗
              </a>
            ) : (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors drop-shadow"
              >
                {s.label}
              </button>
            )
          ))}
        </nav>
        <div className="flex-1" />
        <button
          onClick={onRegister}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-sky-500/90 hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20"
        >
          + Register Aircraft
        </button>
      </div>
    </header>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  TIER BADGE — three levels of engagement                    */
/* ─────────────────────────────────────────────────────────── */
function TierBadge({ tier, size = 'sm' }) {
  const t = FRNAA_TIERS[tier]
  if (!t) return null
  if (tier === 'committed') {
    // Mini word cluster — matches the hero rhythm
    const sizing = size === 'lg'
      ? { line1: 'text-[13px]', line2: 'text-[15px]' }
      : { line1: 'text-[10px]', line2: 'text-[12px]' }
    return (
      <div className="flex-shrink-0 text-right font-black leading-[0.82] tracking-tight">
        <div className={`text-white whitespace-nowrap ${sizing.line1}`}>Committed to</div>
        <div className={`bg-gradient-to-r from-sky-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent whitespace-nowrap ${sizing.line2}`}>
          Noise Reduction
        </div>
      </div>
    )
  }
  const tones = {
    sky:   'bg-sky-500/15 border-sky-500/40 text-sky-200',
    slate: 'bg-white/5 border-white/20 text-slate-300',
  }
  return (
    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full border text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap ${tones[t.tone] || tones.slate}`}>
      {t.short}
    </span>
  )
}

/* ─── Unleaded Avgas availability badge ─── */
function UnleadedBadge({ unleaded }) {
  if (!unleaded) return null
  if (unleaded.status === 'available') {
    return (
      <span
        title={`${unleaded.fuel} available since ${unleaded.since}${unleaded.supplier ? ` · ${unleaded.supplier}` : ''}`}
        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {unleaded.fuel}
      </span>
    )
  }
  if (unleaded.status === 'planned') {
    return (
      <span
        title={`Unleaded fuel planned for ${unleaded.eta}`}
        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-400/40 bg-sky-500/10 text-sky-200 text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap"
      >
        UL {unleaded.eta}
      </span>
    )
  }
  return (
    <span
      title="Evaluating unleaded fuel options"
      className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-slate-400 text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap"
    >
      UL evaluating
    </span>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  HOME                                                       */
/* ─────────────────────────────────────────────────────────── */

/* ─── Mini Gallery — 3 panels across, diagonal wipe transition ───
   The wipe looks like a single diagonal line sweeping across the combined
   width of all three panels (achieved by applying a single clip-path to
   a 3-column grid overlay that spans the full gallery width). */
function MiniGallery({ items, interval = 5000, wipeDuration = 1400, aspect = 'aspect-[3/1]' }) {
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    if (!items || items.length < 3) return
    const t = setInterval(() => setCycle((c) => c + 1), interval)
    return () => clearInterval(t)
  }, [interval, items])

  if (!items || items.length === 0) return null
  const len = items.length

  // Each cycle advances by 3. Trio resolved by ((cycle + offset) * 3 + i) mod len.
  const trio = (c) => [0, 1, 2].map((i) => items[((c * 3) % len + i + len) % len])
  // Base = what was "current" at the start of this cycle; Top = incoming trio
  const baseTrio = cycle === 0 ? trio(0) : trio(cycle - 1)
  const topTrio  = trio(cycle)

  return (
    <div className={`relative ${aspect} w-full overflow-hidden rounded-2xl`}>
      {/* Base layer — previous trio stays visible while the next wipes in on top */}
      <div className="absolute inset-0 grid grid-cols-3 gap-2">
        {baseTrio.map((item, i) => (
          <div key={`b-${cycle}-${i}`} className="relative overflow-hidden rounded-xl bg-slate-900 border border-white/10">
            <img src={item.url} alt={item.alt || ''} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            {item.label && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <div className="text-white text-[10px] font-semibold uppercase tracking-wider drop-shadow">{item.label}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Overlay layer — keyed on cycle so it remounts and re-runs the wipe animation */}
      <WipeLayer key={`top-${cycle}`} trio={topTrio} wipeDuration={wipeDuration} />
    </div>
  )
}

/* The wipe layer — mounts with clip-path collapsed (hidden), then on next
   frame applies the "shown" clip-path so the CSS transition plays out.
   One clip-path, 3-column grid → appears as a single diagonal sweeping
   across all three panels. */
function WipeLayer({ trio, wipeDuration }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    let raf1, raf2
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealed(true))
    })
    return () => {
      if (raf1) cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [])

  // Hidden: a thin zero-area polygon on the right edge
  // Shown : full coverage with a trailing bottom-left (the diagonal)
  const hiddenClip = 'polygon(120% 0%, 120% 0%, 120% 100%, 120% 100%)'
  const shownClip  = 'polygon(0% 0%, 100% 0%, 100% 100%, -40% 100%)'

  return (
    <div
      className="absolute inset-0 grid grid-cols-3 gap-2 will-change-[clip-path]"
      style={{
        clipPath: revealed ? shownClip : hiddenClip,
        transition: `clip-path ${wipeDuration}ms cubic-bezier(0.65, 0, 0.35, 1)`,
      }}
    >
      {trio.map((item, i) => (
        <div key={i} className="relative overflow-hidden rounded-xl bg-slate-900 border border-white/10">
          <img src={item.url} alt={item.alt || ''} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          {item.label && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
              <div className="text-white text-[10px] font-semibold uppercase tracking-wider drop-shadow">{item.label}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Aircraft photo fetch (Wikipedia thumbnails, cached) ───
   Same approach NoiseStudio uses: query the MediaWiki API with the model
   string and pull the first pageimage thumbnail. Results are cached by
   model across the whole module so the leaderboard only fetches each
   distinct model once per page load, and in-flight requests are shared. */
const wikiPhotoCache = new Map()
const wikiPhotoPromises = new Map()

/* Fetch a Wikipedia thumbnail for any search query. When `suffix` is set
   (default " aircraft") it's appended — use '' for general-purpose queries. */
async function fetchWikiPhoto(query, suffix = '') {
  if (!query) return null
  const key = query + suffix
  if (wikiPhotoCache.has(key)) return wikiPhotoCache.get(key)
  if (wikiPhotoPromises.has(key)) return wikiPhotoPromises.get(key)

  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=pageimages&pithumbsize=320&generator=search&gsrlimit=1' +
    '&gsrsearch=' + encodeURIComponent(key)

  const p = fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const pages = data?.query?.pages
      if (!pages) return null
      const first = Object.values(pages)[0]
      return first?.thumbnail?.source || null
    })
    .catch(() => null)
    .then((result) => {
      wikiPhotoCache.set(key, result)
      wikiPhotoPromises.delete(key)
      return result
    })

  wikiPhotoPromises.set(key, p)
  return p
}

/* Aircraft-specific wrapper — appends " aircraft" so model lookups hit the right articles */
function fetchAircraftPhoto(model) {
  return fetchWikiPhoto(model, ' aircraft')
}

/* Representative Wikipedia search terms per category — used when a row
   doesn't carry a specific aircraft model (e.g. aggregated by category). */
const CATEGORY_REPRESENTATIVES = {
  highwing:     'Cessna 172',
  lowwing:      'Piper PA-28',
  twin:         'Beechcraft Baron',
  helicopter:   'Robinson R44',
  experimental: 'Van\'s RV-7',
}

/* Hook: fetch a Wikipedia thumbnail for a given query.
   `suffix` defaults to ' aircraft' for model lookups; pass '' for general queries. */
function useWikiPhoto(query, suffix = ' aircraft') {
  const key = query ? query + suffix : null
  const [url, setUrl] = useState(() => wikiPhotoCache.get(key) ?? null)
  useEffect(() => {
    if (!query) { setUrl(null); return }
    if (wikiPhotoCache.has(key)) { setUrl(wikiPhotoCache.get(key)); return }
    let cancelled = false
    fetchWikiPhoto(query, suffix).then((res) => { if (!cancelled) setUrl(res) })
    return () => { cancelled = true }
  }, [key])
  return url
}

/* Convenience alias for aircraft-specific lookups */
function useAircraftPhoto(model) {
  return useWikiPhoto(model, ' aircraft')
}

/* Generic Wikipedia-photo component for non-aircraft queries
   (flight schools, clubs, fuel suppliers, etc). Falls back to a soft
   gradient tile when nothing is found. */
function OrgPhoto({ query, alt = '', className = 'w-full h-full object-cover' }) {
  const url = useWikiPhoto(query, '')
  if (url) {
    return <img src={url} alt={alt} loading="lazy" className={className} />
  }
  return (
    <div className={`w-full h-full bg-gradient-to-br from-sky-900/40 to-emerald-900/30 flex items-center justify-center text-slate-500 text-[9px] font-semibold uppercase tracking-wider`}>
      ✈
    </div>
  )
}

/* Aircraft photo with silhouette fallback. Shows the photo when loaded,
   otherwise renders the category silhouette. */
function AircraftPhoto({ model, category, className = '', silhouetteClass = '' }) {
  const query = model || CATEGORY_REPRESENTATIVES[category] || null
  const photoUrl = useAircraftPhoto(query)
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={model}
        loading="lazy"
        className={`object-cover ${className}`}
      />
    )
  }
  return (
    <div className={`flex items-center justify-center text-emerald-200 ${className}`}>
      <AircraftSilhouette category={category} className={silhouetteClass} />
    </div>
  )
}

/* Category silhouettes — small inline SVGs so nothing depends on remote assets */
function AircraftSilhouette({ category, className = '' }) {
  const common = { fill: 'currentColor', stroke: 'none' }
  switch (category) {
    case 'helicopter':
      return (
        <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
          <rect x="4" y="2" width="56" height="1.2" {...common} />
          <ellipse cx="32" cy="20" rx="14" ry="5" {...common} />
          <rect x="31" y="4" width="2" height="12" {...common} />
          <rect x="42" y="20" width="18" height="1.6" {...common} />
          <circle cx="26" cy="28" r="2" {...common} />
          <circle cx="38" cy="28" r="2" {...common} />
          <rect x="24" y="27" width="16" height="1" {...common} />
        </svg>
      )
    case 'twin':
      return (
        <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
          <ellipse cx="32" cy="18" rx="20" ry="3" {...common} />
          <rect x="6" y="16" width="52" height="1.5" {...common} />
          <rect x="14" y="14" width="4" height="8" {...common} />
          <rect x="46" y="14" width="4" height="8" {...common} />
          <polygon points="28,10 36,10 34,18 30,18" {...common} />
          <polygon points="52,14 60,14 58,22 54,22" {...common} />
        </svg>
      )
    case 'experimental':
      return (
        <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
          <ellipse cx="32" cy="18" rx="22" ry="2.5" {...common} />
          <polygon points="10,14 54,14 50,22 14,22" {...common} />
          <polygon points="28,8 36,8 35,14 29,14" {...common} />
          <polygon points="50,22 58,26 52,26" {...common} />
        </svg>
      )
    case 'lowwing':
      return (
        <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
          <ellipse cx="32" cy="18" rx="22" ry="2.8" {...common} />
          <polygon points="8,20 56,20 52,26 12,26" {...common} />
          <polygon points="28,10 36,10 34,18 30,18" {...common} />
          <polygon points="50,24 58,28 52,28" {...common} />
          <rect x="14" y="17" width="36" height="1.5" {...common} />
        </svg>
      )
    case 'highwing':
    default:
      return (
        <svg viewBox="0 0 64 36" className={className} aria-hidden="true">
          <polygon points="8,12 56,12 52,16 12,16" {...common} />
          <rect x="30" y="16" width="4" height="2" {...common} />
          <ellipse cx="32" cy="22" rx="22" ry="2.8" {...common} />
          <polygon points="50,24 58,28 52,28" {...common} />
          <rect x="20" y="24" width="4" height="4" {...common} />
          <rect x="40" y="24" width="4" height="4" {...common} />
        </svg>
      )
  }
}

/* ─── Gallery photo resolver — converts search queries into {url, alt, label}
       items for MiniGallery. Fetches all queries in parallel (with cache). ─── */
function usePhotoGallery(items) {
  const [resolved, setResolved] = useState([])
  const keyRef = useRef(null)
  const key = items?.map((i) => i.query).join('|')
  useEffect(() => {
    if (!items || items.length === 0) { setResolved([]); return }
    if (key === keyRef.current) return
    keyRef.current = key
    let cancelled = false
    Promise.all(items.map(async (item) => {
      const url = await fetchWikiPhoto(item.query) // no " aircraft" suffix
      return url ? { url, alt: item.alt || item.query, label: item.label } : null
    })).then((results) => {
      if (!cancelled) setResolved(results.filter(Boolean))
    })
    return () => { cancelled = true }
  }, [key])
  return resolved
}

/* ─── Repeating section template: Issue → KPI → Gallery → Discussion → Leaderboard ─── */
function IssueSection({ id, eyebrow, title, kpiValue, kpiLabel, kpiAccent = 'text-emerald-300', galleryItems, children, leaderboard }) {
  return (
    <section id={id} className="max-w-7xl mx-auto px-5 py-14 scroll-mt-20 space-y-6">
      <SectionHeader eyebrow={eyebrow} title={title} />

      {/* Single hero KPI */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 inline-flex items-baseline gap-3">
        <div className={`text-4xl md:text-5xl font-black tabular-nums leading-none ${kpiAccent}`}>{kpiValue}</div>
        <div className="text-slate-400 text-sm">{kpiLabel}</div>
      </div>

      {/* Mini gallery — only renders if we have 3+ resolved images */}
      {galleryItems && galleryItems.length >= 3 && (
        <MiniGallery items={galleryItems} interval={6000} wipeDuration={1400} aspect="aspect-[3/1]" />
      )}

      {/* Discussion — prose content passed as children */}
      {children && (
        <div className="bg-surface-card border border-surface-border rounded-2xl p-6 md:p-8 text-slate-300 text-sm leading-relaxed">
          {children}
        </div>
      )}

      {/* Leaderboard — themed content passed as render prop */}
      {leaderboard}
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   AIR MISSIONS — live from /api/noise/missions
   Shows today's interesting flights (training, medevac, heli ops)
   ═══════════════════════════════════════════════════════════ */

function AirMissionsSection() {
  const [missions, setMissions] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchMissions()
      .then((d) => { if (!cancelled) setMissions(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  if (error || !missions) return null

  const interesting = Object.entries(missions.categories || {})
    .filter(([key]) => key !== 'unknown' && MISSION_DISPLAY[key])
    .sort((a, b) => b[1].count - a[1].count)

  if (interesting.length === 0) return null

  return (
    <section id="missions" className="max-w-7xl mx-auto px-5 py-10 scroll-mt-20">
      <SectionHeader
        eyebrow={new Date(missions.date).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        title="Today's Air Missions"
      />

      <div className="mt-5 space-y-2">
        {interesting.map(([key, cat]) => {
          const d = MISSION_DISPLAY[key]
          return (
            <div key={key} className="flex items-center gap-4 bg-surface-card border border-surface-border rounded-xl px-4 py-3.5 hover:bg-white/5 transition-colors">
              {/* Photo from the relevant gallery section */}
              {d.photo && (
                <div className="flex-shrink-0 w-16 h-11 rounded-lg overflow-hidden border border-white/10 bg-slate-900 hidden sm:block">
                  <img src={d.photo} alt={d.label} loading="lazy" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Count + label — reversed: number first, big */}
              <div className="flex items-baseline gap-2 flex-1 min-w-0">
                <div className={`text-3xl md:text-4xl font-black tabular-nums leading-none ${d.tone}`}>
                  {cat.count}
                </div>
                <div className="text-white text-sm md:text-base font-semibold truncate">
                  {d.label}
                </div>
              </div>

              {/* Sample tails */}
              <div className="hidden md:flex flex-wrap gap-1 flex-shrink-0 max-w-[14rem] justify-end">
                {cat.aircraft.slice(0, 3).map((ac) => (
                  <span key={ac.tail} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400">
                    {ac.tail}
                  </span>
                ))}
                {cat.aircraft.length > 3 && (
                  <span className="text-slate-500 text-[10px] py-0.5">+{cat.aircraft.length - 3}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════
   LIVE LEADERBOARD HOOK — fetches from the Railway-deployed API
   ═══════════════════════════════════════════════════════════ */
function useLiveLeaderboard({ by = 'tail', days = 90, limit = 20 }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const key = `${by}:${days}:${limit}`
  useEffect(() => {
    let cancelled = false
    setError(null)
    fetchLeaderboard({ by, days, limit })
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [key])
  return { data, error }
}

/* ═══════════════════════════════════════════════════════════
   ISSUE SECTIONS — each follows the rhythm:
   Issue → KPI → Gallery → Discussion → Leaderboard
   ═══════════════════════════════════════════════════════════ */

/* 1. NOISE — wired to the live Railway leaderboard API */
function NoiseIssue({ onAirportDrill }) {
  const schools = useLiveLeaderboard({ by: 'school', days: 365, limit: 10 })
  const bases   = useLiveLeaderboard({ by: 'base',   days: 90,  limit: 10 })
  const tails   = useLiveLeaderboard({ by: 'tail',   days: 180, limit: 5 })

  const gallery = FRNAA_AIRPORTS.filter((a) => a.photo).map((a) => ({
    url: a.photo, alt: `${a.icao} · ${a.name}`, label: `${a.icao} · ${a.city}`,
  }))

  const totalCleanNm = bases.data?.entries?.reduce((s, e) => s + (e.clean_nm || 0), 0) || 0
  const totalFlights = bases.data?.entries?.reduce((s, e) => s + (e.flights || 0), 0) || 0
  const airportLookup = Object.fromEntries(FRNAA_AIRPORTS.map((a) => [a.icao, a]))

  return (
    <IssueSection
      id="noise"
      eyebrow="Noise Abatement"
      title="We take noise seriously"
      kpiValue={totalCleanNm > 0 ? `${Math.round(totalCleanNm).toLocaleString()} nm` : '—'}
      kpiLabel={totalFlights > 0 ? `clean miles across ${totalFlights.toLocaleString()} flights (90 days)` : 'loading live data…'}
      galleryItems={gallery}
      leaderboard={
        <div className="space-y-6">
          {/* Schools — real data */}
          <div>
            <div className="mb-3">
              <div className="text-white text-sm font-bold">Schools — most clean miles (1 year)</div>
            </div>
            {schools.error && <div className="text-rose-300 text-xs p-3 bg-rose-500/10 rounded-lg">{schools.error}</div>}
            {schools.data && (
              <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                {schools.data.entries.map((e, i) => (
                  <div key={e.name} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-surface-border' : ''} hover:bg-white/5`}>
                    <span className="w-6 text-center text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-bold truncate">{e.name}</div>
                      <div className="text-slate-500 text-[10px]">{e.flights} flights · {e.excursion_nm.toFixed(0)} nm excursions</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-emerald-300 text-lg font-black tabular-nums leading-none">{Math.round(e.clean_nm).toLocaleString()}</div>
                      <div className="text-slate-500 text-[9px] uppercase tracking-wider">clean nm</div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold tabular-nums ${e.clean_pct >= 99 ? 'bg-emerald-500/15 text-emerald-300' : e.clean_pct >= 95 ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {e.clean_pct}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Airports — real data */}
          <div>
            <div className="text-white text-sm font-bold mb-3">Airports — most clean miles (90 days)</div>
            {bases.error && <div className="text-rose-300 text-xs p-3 bg-rose-500/10 rounded-lg">{bases.error}</div>}
            {bases.data && (
              <div className="space-y-1.5">
                {bases.data.entries.map((e, i) => {
                  const ap = airportLookup[e.name]
                  return (
                    <div
                      key={e.name}
                      onClick={() => ap && onAirportDrill(e.name)}
                      role={ap ? 'button' : undefined}
                      tabIndex={ap ? 0 : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 bg-surface-card border border-surface-border rounded-lg ${ap ? 'hover:border-sky-500/50 cursor-pointer' : ''}`}
                    >
                      <span className="w-5 text-center text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                      {ap?.photo && <img src={ap.photo} alt={e.name} className="w-12 h-8 rounded object-cover border border-white/10 hidden sm:block" loading="lazy" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-xs font-bold">{e.name}{ap ? ` · ${ap.name}` : ''}</div>
                        <div className="text-slate-500 text-[10px]">{e.flights} flights · {e.excursion_nm.toFixed(0)} nm excursions</div>
                        {ap && <div className="flex items-center gap-1.5 mt-0.5"><TierBadge tier={ap.tier} /><UnleadedBadge unleaded={ap.unleaded} /></div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-emerald-300 text-lg font-black tabular-nums leading-none">{Math.round(e.clean_nm).toLocaleString()}</div>
                        <div className="text-slate-500 text-[9px] uppercase tracking-wider">clean nm</div>
                      </div>
                      <div className={`px-2 py-0.5 rounded text-[10px] font-bold tabular-nums ${e.clean_pct >= 99 ? 'bg-emerald-500/15 text-emerald-300' : e.clean_pct >= 95 ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {e.clean_pct}%
                      </div>
                      {ap && <a href={`/noise?airport=${e.name}`} onClick={(ev) => ev.stopPropagation()} className="text-amber-200 text-[10px] font-semibold px-2 py-1 rounded bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/20">📣</a>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top tails — real data */}
          {tails.data && tails.data.entries.length > 0 && (
            <div>
              <div className="text-white text-sm font-bold mb-3">Top aircraft — most clean miles (6 months)</div>
              <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
                {tails.data.entries.map((e, i) => (
                  <div key={e.name} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-surface-border' : ''} hover:bg-white/5`}>
                    <span className="w-6 text-center text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                    <div className="flex-shrink-0 w-14 h-10 rounded overflow-hidden bg-slate-900 border border-white/10">
                      <AircraftPhoto model={e.type} category="highwing" className="w-full h-full" silhouetteClass="w-10 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-bold font-mono">{e.name}</div>
                      <div className="text-slate-500 text-[10px] truncate">{e.type || '—'}{e.school ? ` · ${e.school}` : ''}{e.base ? ` · ${e.base}` : ''}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-emerald-300 text-lg font-black tabular-nums leading-none">{Math.round(e.clean_nm).toLocaleString()}</div>
                      <div className="text-slate-500 text-[9px] uppercase tracking-wider">clean nm</div>
                    </div>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold tabular-nums ${e.clean_pct >= 99 ? 'bg-emerald-500/15 text-emerald-300' : e.clean_pct >= 95 ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {e.clean_pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data provenance */}
          {bases.data && (
            <div className="text-slate-600 text-[10px] text-right">
              Live data · generated {new Date(bases.data.generated_at).toLocaleString()} · {bases.data.window.from} to {bases.data.window.to}
            </div>
          )}
        </div>
      }
    >
      <p>
        Most noise excursions in the Airport Impact District are attributable to visiting aircraft from neighboring fields.
        AID closes that loop — routing voluntary reminders directly to the pilot-in-command,
        regardless of where they're based. Everything we do is voluntary. We measure every flight, acknowledge
        every excursion, and show our work.
      </p>
    </IssueSection>
  )
}

/* ─── Pre-verified Wikimedia Commons gallery photos ─── */
const GALLERY = {
  responders: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/STARS_AW139_helicopter_landing_in_Pincher_Creek.jpg', label: 'Air Ambulance' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Eurocopter_EC145_-_N885AL-01.jpg', label: 'Medevac' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/St._Vincent_Medical_Center%27s_LifeFlight_helicopter_located_at_KUSE.JPG', label: 'LifeFlight' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/An_MH-60S_Knighthawk_helicopter_assigned_to_the_%E2%80%9CLonghorns%E2%80%9D_of_Helicopter_Search_and_Rescue_%28SAR%29_Squadron%2C_practices_pinnacle_landings_and_extractions_during_a_mountain_flying_SAR_training_event._%2851112227815%29.jpg', label: 'Mountain SAR' },
  ],
  disaster: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Colorado_National_Guard_flood_response_%289801156885%29.jpg', label: 'Chinook · Larimer County' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Operation_Centennial_Raging_Waters_130917-Z-BR512-160.jpg', label: 'Operation Centennial' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Colorado_Floods_2013_%289778029483%29.jpg', label: 'Boulder County · 2013' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Nebraska_Task_Force_1_Conducts_Search_and_Rescue_Operations.jpg', label: 'Jamestown SAR' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Ft._Lupton%2C_Colo.%2C_flood_area_%28DVIDS_1023828%29.jpg', label: 'Fort Lupton aerial' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/4/40/C-130_drops_retardant_on_a_section_of_the_Waldo_Canyon_fire.jpg', label: 'Waldo Canyon Fire · C-130' },
  ],
  fuel: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Cessna_P210N_Refueling.JPG', label: 'Refueling' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Kleinflugzeug_betanken_004.JPG', label: 'Avgas Delivery' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Berkeley-Airport_Fuel.jpg', label: 'Fuel Operations' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Flugplatz_St._Michaelisdonn_%E2%80%93_AVGAS100LL.jpg', label: '100LL Station' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Gravity_refuelling_of_a_Cessna_206_on_a_farm_%28Namibia%29.jpg', label: 'Cessna 206 Fueling' },
  ],
  soaring: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/ASH-25_In_Action_-_panoramio.jpg', label: 'ASH-25 Soaring' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/White_Plane_On_White_Clouds_-_panoramio.jpg', label: 'Glider in Clouds' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Tandem_Parachute_%2816216919464%29.jpg', label: 'Tandem Jump' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/5/54/Saut_en_parachute_tandem_%C3%A0_Sion.jpg', label: 'Freefall · Swiss Alps' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/6/61/Parachute_Landing_at_Sunset_Over_Open_Field.jpg', label: 'Landing at Sunset' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Eta_open_class_sailplane.JPG', label: 'Open-Class Sailplane' },
  ],
  schools: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Cessna172InstructorAndStudent.png', label: 'Instructor & Student' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Fly_Level_Flight_School_Cessna_172_at_Clinceni_Aerodrome%2C_Romania.jpg', label: 'Flight School 172' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Cessna_152-T_Cockpit.jpg', label: 'Trainer Cockpit' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Flight_Training_College_Cessna_152_ZS-PAW_%2826005455570%29.jpg', label: 'Training Ramp' },
  ],
  training: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Flight_training_cockpit_5.jpg', label: 'Instrument Training' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/3/34/DA42_simulator.jpg', label: 'DA42 Simulator' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Royal_Air_Force_King_Air_B200_Training_Aircraft_MOD_45153009.jpg', label: 'Multi-Engine' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Glidercockpit.JPG', label: 'Glider Instruments' },
  ],
  children: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Boy_gets_to_try_out_aircraft_simulator.jpg', label: 'Pilot for a Day' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/%27Mighty_Eagles%27_welcome_local_boy_130325-F-EP111-059.jpg', label: 'Cockpit Visit' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Make_a_Wish_visit_to_Kodiak_130724-G-KL864-804.jpg', label: 'Make-A-Wish · AK' },
  ],
  family: [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/AirVenture_at_Oshkosh_2023_%28NHQ20230724ARMD01%29.jpg', label: 'EAA AirVenture' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/a/af/AirVenture_at_Oshkosh_2023_%28NHQ20230726ARMD02%29.jpg', label: 'AirVenture · Day 3' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/5/59/Pitt_Meadows_Airport_Days_2018-06-02_016-LR_%2840744795360%29.jpg', label: 'Airport Day Fly-In' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Air_show_crowd_taking_a_look_at_C-17_Globemaster_III_at_2009_Avalon_Airshow.jpg', label: 'Community Airshow' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Defense.gov_photo_essay_120714-F-RP755-350.jpg', label: 'Red Arrows Display' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/6/61/Defense.gov_photo_essay_120715-F-RP755-375.jpg', label: 'Wingwalkers' },
  ],
}

/* Mission categories → photo from the relevant gallery section */
const MISSION_DISPLAY = {
  medivac:          { label: 'medevac flights',              photo: GALLERY.responders[0]?.url, tone: 'text-rose-300' },
  medivac_possible: { label: 'possible medevac flights',     photo: GALLERY.responders[1]?.url, tone: 'text-rose-200' },
  training:         { label: 'training flights',             photo: GALLERY.schools[0]?.url,    tone: 'text-sky-300' },
  helicopter_ops:   { label: 'helicopter operations',        photo: GALLERY.responders[3]?.url, tone: 'text-amber-300' },
  law_enforcement:  { label: 'law enforcement flights',      photo: GALLERY.disaster[5]?.url,   tone: 'text-amber-200' },
  firefighting:     { label: 'aerial firefighting sorties',  photo: GALLERY.disaster[5]?.url,   tone: 'text-orange-300' },
}

/* 2. FIRST RESPONDERS — medevac, patient transfer, fire, SAR */
function EmergencyIssue() {
  return (
    <IssueSection
      id="emergency"
      eyebrow="First Responders"
      title="Flights that protect life"
      kpiValue="1,840"
      kpiLabel="medevac, fire, and search-and-rescue flights across the District this year"
      kpiAccent="text-amber-300"
      galleryItems={GALLERY.responders}
      leaderboard={
        <div className="space-y-2">
          <div className="text-white text-sm font-bold">Life-safety missions by type</div>
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            {[
              { type: 'Medevac & patient transfer', count: 1120, icon: '🚑', note: 'Air ambulance, organ transport, inter-facility' },
              { type: 'Wildfire & aerial firefighting', count: 340, icon: '🔥', note: 'Tanker drops, aerial recon, crew transport' },
              { type: 'Search & rescue', count: 215, icon: '🔍', note: 'Mountain SAR, missing persons, Civil Air Patrol' },
              { type: 'Law enforcement & public safety', count: 165, icon: '🛡️', note: 'Pursuit support, accident recon, disaster survey' },
            ].map((m, i) => (
              <div key={m.type} className={`flex items-center gap-4 px-4 py-3.5 ${i > 0 ? 'border-t border-surface-border' : ''}`}>
                <span className="text-2xl flex-shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-bold">{m.type}</div>
                  <div className="text-slate-500 text-[10px]">{m.note}</div>
                </div>
                <div className="text-amber-300 text-xl font-black tabular-nums">{m.count.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <p>
        General aviation airports aren't just for training and recreation — they are critical
        life-safety infrastructure. Medevac helicopters, patient-transfer flights, aerial
        firefighting tankers, and search-and-rescue missions launch from AID member fields
        every day. These flights operate under the same voluntary noise procedures as everyone
        else, but when a life is on the line, the community understands. The District tracks
        emergency operations separately so the public can see the full picture of what their
        local airport does for the region.
      </p>
    </IssueSection>
  )
}

function DisasterIssue() {
  return (
    <IssueSection
      id="disaster"
      eyebrow="Disaster Response"
      title="When the Front Range floods"
      kpiValue="2,378"
      kpiLabel="aerial evacuations during the 2013 Front Range flood"
      kpiAccent="text-amber-300"
      galleryItems={GALLERY.disaster}
      leaderboard={
        <div className="space-y-2">
          <div className="text-white text-sm font-bold">September 2013 — by the numbers</div>
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            {[
              { stat: '18,000+', label: 'People evacuated', note: 'Largest domestic evacuation since Hurricane Katrina', icon: '🏘️' },
              { stat: '2,378', label: 'Military aerial evacuations', note: '62 by hoist from isolated mountain communities', icon: '🚁' },
              { stat: '21', label: 'Helicopters deployed', note: 'Army, National Guard, and private operators', icon: '✈️' },
              { stat: '681', label: 'Troops mobilized', note: 'Operation Centennial Raging Waters', icon: '🎖️' },
              { stat: '1,882', label: 'Structures destroyed', note: '16,000+ additional structures damaged', icon: '🏚️' },
              { stat: '9.08"', label: 'Rain in one day', note: 'Boulder County, September 12, 2013', icon: '🌧️' },
            ].map((m, i) => (
              <div key={m.label} className={`flex items-center gap-4 px-4 py-3.5 ${i > 0 ? 'border-t border-surface-border' : ''}`}>
                <span className="text-2xl flex-shrink-0">{m.icon}</span>
                <div className="flex-shrink-0 min-w-[4.5rem]">
                  <div className="text-amber-300 text-xl font-black tabular-nums leading-none">{m.stat}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-bold">{m.label}</div>
                  <div className="text-slate-500 text-[10px]">{m.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p>
          On September 11, 2013, a week of unprecedented rain triggered catastrophic flooding
          along the entire Colorado Front Range — from Colorado Springs to Fort Collins. Boulder
          County recorded over nine inches in a single day. Roads washed out, mountain communities
          were cut off, and 18,000 people were evacuated in what became the largest domestic
          evacuation since Hurricane Katrina.
        </p>
        <p>
          When the rain briefly relented on September 13, military and private helicopters began
          lifting stranded residents out of Jamestown, Lyons, Left Hand Canyon, and dozens of other
          isolated communities. <span className="text-white font-semibold">Operation Centennial
          Raging Waters</span> — the military response — deployed 21 helicopters and 681 troops,
          completing 2,378 aerial evacuations, 62 of them by hoist from rooftops and hillsides.
        </p>
        <p>
          General aviation airports across the Airport Impact served as staging areas, fuel stops,
          and coordination hubs for that response. The aircraft that fly from AID member fields
          are not just trainers and weekend travelers — they are the same aircraft, the same pilots,
          and the same infrastructure that the region depends on when disaster strikes. That is why
          these airports matter, and why the communities around them should know the people who
          operate from them.
        </p>
      </div>
    </IssueSection>
  )
}

/* 3. NEW FUEL */
function FuelIssue({ unleadedFlights30 }) {
  return (
    <IssueSection
      id="fuel"
      eyebrow="New Fuel"
      title="Getting the lead out"
      kpiValue={unleadedFlights30.toLocaleString()}
      kpiLabel="unleaded flights last month"
      kpiAccent="text-emerald-300"
      galleryItems={GALLERY.fuel}
      leaderboard={
        <div className="space-y-2">
          <div className="text-white text-sm font-bold">Airport UL status</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {FRNAA_AIRPORTS.map((a) => (
              <div key={a.icao} className="flex items-center gap-3 px-3 py-2.5 bg-surface-card border border-surface-border rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="text-white text-xs font-bold">{a.icao} · {a.name}</div>
                </div>
                <UnleadedBadge unleaded={a.unleaded} />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <p>
        Colorado HB 24-1235 (2024) requires five Airport Impact airports to phase out 100LL by 2030.
        Centennial was first to deliver <span className="text-emerald-300 font-semibold">Swift UL94</span> in 2023;
        Rocky Mountain Metro followed in February 2026. Each field needs a dedicated tank, a dedicated truck,
        and a trained line crew before it can offer unleaded alongside 100LL. The District tracks the build-out
        and publishes progress publicly.
      </p>
    </IssueSection>
  )
}

/* SOARING & SKYDIVING — world-class air sports on the Front Range */
function SoaringIssue() {
  return (
    <IssueSection
      id="soaring"
      eyebrow="Soaring & Skydiving"
      title="World-class air sports, right here"
      kpiValue="1M+"
      kpiLabel="total skydives at Mile-Hi Skydiving since 1995"
      kpiAccent="text-sky-300"
      galleryItems={GALLERY.soaring}
      leaderboard={
        <div className="space-y-2">
          <div className="text-white text-sm font-bold">District air-sports operators</div>
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            {[
              {
                name: 'Soaring Society of Boulder',
                base: 'KBDU',
                type: 'Glider club',
                highlight: 'IGC-OLC World League Vice Champion · 700+ mile motorless flights · 44,100 ft altitude record',
              },
              {
                name: 'Mile High Gliding',
                base: 'KBDU',
                type: 'Commercial glider rides',
                highlight: 'Scenic flights along the Flatirons and Continental Divide for the public',
              },
              {
                name: 'Mile-Hi Skydiving Center',
                base: 'KLMO',
                type: 'Skydiving',
                highlight: "Colorado's largest DZ · 35,000+ jumps/year · USPA National Championships host",
              },
              {
                name: 'Civil Air Patrol Glider Program',
                base: 'Multiple',
                type: 'Youth cadet gliders',
                highlight: 'Colorado Wing cadet orientation flights at District fields',
              },
            ].map((op, i) => (
              <div key={op.name} className={`px-4 py-3.5 ${i > 0 ? 'border-t border-surface-border' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-xs font-bold">{op.name}</div>
                    <div className="text-slate-500 text-[10px]">{op.type} · {op.base}</div>
                  </div>
                </div>
                <div className="text-sky-200 text-[11px] mt-1.5 leading-relaxed">{op.highlight}</div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p>
          The Denver Foothills sit on one of the most favorable soaring environments in the world.
          The eastern slope of the Front Range generates powerful thermals that combine with prevailing
          westerly winds to create optimal conditions for long, fast, motorless flights — over 700
          miles in a single flight, and as high as 44,100 feet above sea level.
        </p>
        <p>
          The <span className="text-white font-semibold">Soaring Society of Boulder</span>, based
          at KBDU since 1959, competes globally in the IGC-OLC World League — a multinational
          decentralized race among roughly 1,000 glider clubs worldwide. Boulder routinely scores
          among the top 10 clubs on the planet and has been crowned Vice Champion of the world.
        </p>
        <p>
          At KLMO, <span className="text-white font-semibold">Mile-Hi Skydiving Center</span> is
          Colorado's top-ranked and largest skydiving facility — over 35,000 jumps per year, nearly
          one million total skydives since 1995, and twice host of the USPA National Canopy Piloting
          Championships. Their aircraft fly to 18,000 feet for one of the longest free-falls in the state.
        </p>
        <p>
          These are not niche operations. Soaring and skydiving are part of the working identity of
          District airports — and a reason the public travels from across the country to visit them.
        </p>
      </div>
    </IssueSection>
  )
}

/* 4. AIRPORTS ARE UNIVERSITIES */
function UniversitiesIssue() {
  const totalSchools = FRNAA_SCHOOLS.filter((s) => s.type === 'school').length
  const totalPilots = FRNAA_SCHOOLS.reduce((a, b) => a + b.pilots, 0)
  return (
    <IssueSection
      id="universities"
      eyebrow="Airports are Universities"
      title="Where careers take off"
      kpiValue={totalSchools}
      kpiLabel={`flight schools training ${totalPilots.toLocaleString()} pilots`}
      kpiAccent="text-sky-300"
      galleryItems={GALLERY.schools}
      leaderboard={<MembersPage />}
    >
      <p>
        Every airport in the District is a working campus. Flight schools, clubs, and Part 141 programs
        produce the next generation of commercial pilots, CFIs, mechanics, and dispatchers — right here in
        the Airport Impact. The District helps each school integrate voluntary noise-abatement procedures
        directly into their training syllabi and scheduling software.
      </p>
    </IssueSection>
  )
}

/* 5. PILOT TRAINING */
function TrainingIssue() {
  const totalPilots = FRNAA_SCHOOLS.reduce((a, b) => a + b.pilots, 0)
  const totalFleet = FRNAA_SCHOOLS.reduce((a, b) => a + b.fleet, 0)
  return (
    <IssueSection
      id="training"
      eyebrow="Pilot Training"
      title="From first solo to left seat"
      kpiValue={totalPilots.toLocaleString()}
      kpiLabel={`active student & club pilots across ${totalFleet} aircraft`}
      kpiAccent="text-sky-300"
      galleryItems={GALLERY.training}
      leaderboard={<WingsPage />}
    >
      <p>
        Training is the moment a pilot's habits form. AID works with every enrolled school and club to ensure
        that noise-awareness is part of the training culture from day one — not an afterthought bolted on at
        checkride prep. WINGS events, cross-field familiarization flights, and integrated scheduling reminders
        make voluntary noise procedures as routine as the ATIS check.
      </p>
    </IssueSection>
  )
}

/* 6. INSPIRE CHILDREN */
function ChildrenIssue() {
  return (
    <IssueSection
      id="children"
      eyebrow="Inspire Children"
      title="The next generation of the flying community"
      kpiValue="2,400+"
      kpiLabel="Young Eagles flights across the District this year"
      kpiAccent="text-amber-300"
      galleryItems={GALLERY.children}
    >
      <p>
        Every child who visits a AID airport sees the flying community at its best — pilots who fly
        quietly, operators who care about their neighbors, and airports that welcome the public. Young
        Eagles events, STEM field trips, cockpit tours, and Wings Over the Rockies programs make our
        airports places of wonder, not places of complaint. The District coordinates these efforts so
        that every member field has a youth program, and every youth program reinforces the message:
        we take noise seriously because we take our community seriously.
      </p>
    </IssueSection>
  )
}

/* AVIATION CAREERS — how to start */
function CareersIssue() {
  const gallery = usePhotoGallery([
    { query: 'airline pilot cockpit career', label: 'Airline Captain' },
    { query: 'aircraft mechanic maintenance', label: 'A&P Mechanic' },
    { query: 'air traffic controller tower', label: 'ATC' },
    { query: 'aircraft dispatcher flight plan', label: 'Dispatcher' },
    { query: 'aviation management airport', label: 'Airport Mgmt' },
    { query: 'drone UAS pilot commercial', label: 'UAS Pilot' },
  ])
  return (
    <IssueSection
      id="careers"
      eyebrow="Start Your Aviation Career"
      title="From the ramp to the flight deck"
      kpiValue="67,000"
      kpiLabel="new airline pilots needed in the U.S. by 2030 (Boeing forecast)"
      kpiAccent="text-sky-300"
      galleryItems={gallery.length >= 3 ? gallery : GALLERY.training}
      leaderboard={
        <div className="space-y-2">
          <div className="text-white text-sm font-bold mb-3">Career paths that start at your local airport</div>
          <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            {[
              { path: 'Private Pilot → Commercial → ATP', time: '2–4 years', entry: 'Discovery flight ($200–300)', note: 'The classic airline path. Start at any District flight school.' },
              { path: 'Certified Flight Instructor (CFI)', time: '1–2 years after PPL', entry: 'Commercial certificate + CFI checkride', note: 'Build hours teaching. Every school in the District hires CFIs.' },
              { path: 'A&P Mechanic', time: '18–24 months', entry: 'FAA Part 147 program or on-the-job', note: 'Massive demand. Aims Community College (KFNL) runs a Part 147 program.' },
              { path: 'Air Traffic Control', time: 'FAA Academy (Oklahoma City)', entry: 'CTI program or prior experience', note: 'Entry-level pay ~$50k, experienced controllers earn $100k+.' },
              { path: 'Aircraft Dispatcher', time: '5–6 week certificate', entry: 'FAA written + practical', note: 'Dispatchers share legal responsibility with the captain for every flight.' },
              { path: 'Drone / UAS Pilot', time: 'Part 107 in weeks', entry: 'FAA knowledge test ($175)', note: 'Commercial drone work in surveying, inspection, agriculture, film.' },
              { path: 'Airport Management', time: 'Degree + AAAE certification', entry: 'Internship at a District airport', note: 'Run the field. Every airport in the District has management staff.' },
            ].map((c, i) => (
              <div key={c.path} className={`px-4 py-3.5 ${i > 0 ? 'border-t border-surface-border' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-xs font-bold">{c.path}</div>
                    <div className="text-slate-400 text-[10px] mt-0.5">{c.note}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sky-300 text-xs font-semibold">{c.time}</div>
                    <div className="text-slate-500 text-[10px]">{c.entry}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <p>
        The aviation industry needs people — pilots, mechanics, controllers, dispatchers, managers,
        drone operators. Every career on this list starts at a general aviation airport like the ones
        in this District. A discovery flight costs less than a pair of concert tickets. An A&P mechanic
        program takes 18 months and leads to a job market with near-zero unemployment. A Part 107 drone
        certificate takes weeks. The hardest part of any aviation career is deciding to start.
      </p>
    </IssueSection>
  )
}

/* 7. FUN FOR THE FAMILY */
function FamilyIssue() {
  return (
    <IssueSection
      id="family"
      eyebrow="Fun for the Family"
      title="Your airport is your neighbor"
      kpiValue={FRNAA_WINGS_EVENTS.length}
      kpiLabel="upcoming community & WINGS events"
      kpiAccent="text-emerald-300"
      galleryItems={GALLERY.family}
      leaderboard={
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          {FRNAA_WINGS_EVENTS.map((e, i) => (
            <div key={e.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-surface-border' : ''}`}>
              <div className="flex-shrink-0 w-10 text-center bg-sky-500/10 border border-sky-500/30 rounded py-1">
                <div className="text-sky-300 text-[9px] font-semibold uppercase">{new Date(e.date).toLocaleString('en', { month: 'short' })}</div>
                <div className="text-white text-sm font-black leading-none">{new Date(e.date).getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-bold truncate">{e.title}</div>
                <div className="text-slate-400 text-[10px] truncate">{e.time} · {e.airport} · {e.host}</div>
              </div>
              <div className="text-emerald-300 text-xs font-bold tabular-nums">{e.rsvps} RSVPs</div>
            </div>
          ))}
        </div>
      }
    >
      <p>
        Airports are public infrastructure — and the best way to keep them public is to make them
        fun. Fly-in breakfasts, WINGS nights, open-cockpit weekends, and community days turn
        neighbors into advocates. The District coordinates the calendar across every member field
        so there's always something happening, always a reason to visit, and always a conversation
        about why this airport matters.
      </p>
    </IssueSection>
  )
}

function Home({ onRegister }) {
  const totalFlightsYTD = FRNAA_FLEET.reduce((a, b) => a + b.flightsYTD, 0)
  const totalExcursionsYTD = FRNAA_FLEET.reduce((a, b) => a + b.excursionsYTD, 0)
  const cleanFlightsYTD = totalFlightsYTD - totalExcursionsYTD
  const totalFlights30 = FRNAA_FLEET.reduce((a, b) => a + b.flights30, 0)
  const totalExcursions30 = FRNAA_FLEET.reduce((a, b) => a + b.excursions30, 0)
  const quietFlights30 = totalFlights30 - totalExcursions30
  const unleadedFlights30 = Math.round(quietFlights30 * FRNAA_UNLEADED_INFO.fleet_actively_using_pct / 100)
  const leaderboard = useMemo(() => getLeaderboard(10), [])
  const airportRankings = useMemo(() => getAirportRankings(), [])
  const [airportDrill, setAirportDrill] = useState(null)

  return (
    <div>
      {/* Fixed-to-viewport photo backdrop at z-0 — stays put while the page rolls over it */}
      <div className="fixed top-0 left-0 right-0 h-screen z-0 pointer-events-none">
        <FrontRangeBackdrop />
      </div>

      {/* Hero — transparent container at z-10 so the fixed photo shows through */}
      <section id="home" className="relative z-10 min-h-[540px] flex items-center bg-transparent">
        {/* Soft legibility scrim only at top + bottom edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/55 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-5 py-12 w-full text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Airport Impact District · We take noise seriously
          </div>

          {/* Three-line word cluster — same font, size, and spacing throughout.
              Only color varies: white / gradient / slate-200. */}
          <h1 className="font-black leading-[0.82] tracking-tight text-[clamp(1.75rem,5vw,4.25rem)] drop-shadow-2xl">
            <span className="block text-white whitespace-nowrap">Committed to</span>
            <span className="block whitespace-nowrap bg-gradient-to-r from-sky-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">
              aircraft noise abatement
            </span>
            <span className="block text-slate-200 whitespace-nowrap">Join us</span>
          </h1>

          <div className="flex flex-wrap gap-3 mt-6 justify-center">
            <button
              onClick={onRegister}
              className="px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm shadow-2xl shadow-emerald-500/30 transition-colors"
            >
              Join us today →
            </button>
            <button
              onClick={() => scrollToSection('leaderboard')}
              className="px-6 py-3.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 backdrop-blur-sm transition-colors"
            >
              See the Leaderboard
            </button>
            <a
              href="/noise"
              className="px-6 py-3.5 rounded-lg bg-white/5 hover:bg-white/15 text-amber-100 font-semibold text-sm border border-amber-400/40 backdrop-blur-sm transition-colors"
            >
              Report a Noise Excursion
            </a>
          </div>

          <p className="text-slate-200 text-sm md:text-base mt-6 max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
            <span className="text-emerald-300 font-bold tabular-nums">{cleanFlightsYTD.toLocaleString()}</span> clean flights
            across the Front Range this year — published by tail number, airport by airport.
            The fastest way to earn public trust is to measure every flight and show our work.
          </p>
        </div>
      </section>

      {/* Everything below the hero sits on a TRANSLUCENT layer at z-20 so the
          fixed Front Range photo stays vaguely visible as the page rolls over it.
          The frnaa-glass class turns every .bg-surface-card descendant into a
          frosted panel with backdrop-blur. */}
      <style>{`
        .frnaa-glass .bg-surface-card  { background-color: rgb(15 23 42 / 0.62) !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .frnaa-glass .bg-surface       { background-color: transparent !important; }
        .frnaa-glass .border-surface-border { border-color: rgb(255 255 255 / 0.10) !important; }
      `}</style>
      <div className="frnaa-glass relative z-20 border-t border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/25 via-slate-950/40 to-slate-950/55 pointer-events-none" />
        <div className="relative">

      {/* ═══════════════════════════════════════════════════════════
         ISSUE SECTIONS — repeating rhythm:
         Issue → KPI → Gallery → Discussion → Leaderboard
         ═══════════════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════
         Positive → Negative → Positive rhythm
         ═══════════════════════════════════════════════════════════ */}

      {/* + Air Missions (positive — live, today's heroes) */}
      <AirMissionsSection />

      {/* − Noise (negative — the core challenge, pushed up) */}
      <NoiseIssue onAirportDrill={setAirportDrill} />

      {/* + First Responders (positive — life safety) */}
      <EmergencyIssue />

      {/* − Disaster (negative — but heroic framing) */}
      <DisasterIssue />

      {/* + Soaring & Skydiving (positive — world class) */}
      <SoaringIssue />

      {/* − New Fuel (negative — environmental problem being solved) */}
      <FuelIssue unleadedFlights30={unleadedFlights30} />

      {/* + Universities (positive — education) */}
      <UniversitiesIssue />

      {/* + Children (positive — inspiration) */}
      <ChildrenIssue />

      {/* + Training (positive — career development) */}
      <TrainingIssue />

      {/* + Careers (positive — start your aviation career) */}
      <CareersIssue />

      {/* + Family (positive — community) */}
      <FamilyIssue />

      {/* ─── I SUPPORT AVIATION ─── */}
      <section id="support" className="max-w-7xl mx-auto px-5 py-14 scroll-mt-20">
        <SectionHeader eyebrow="Community" title="I support aviation" />
        <div className="mt-6 bg-surface-card border border-surface-border rounded-2xl p-6 md:p-8">
          <p className="text-white text-base md:text-lg font-semibold leading-relaxed">
            Airports are hospitals, schools, fire stations, and playgrounds — all in one. If you
            value what general aviation brings to the Denver Foothills, let your voice be heard.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <div className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Sign the pledge</div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Add your name to a public list of community members who support the continued
                operation of general aviation airports in the District. No cost, no obligation —
                just a signal that the community values its airports.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); alert('Thank you for your support! (Demo)') }} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Your name"
                  required
                  className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors">
                  Sign
                </button>
              </form>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <div className="text-sky-300 text-xs font-bold uppercase tracking-wider">Tell your representatives</div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Your city council, county commissioners, and state legislators make decisions about
                airport land use, noise policy, and funding. A short email from a constituent matters
                more than you think.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="https://bouldercolorado.gov/city-council" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200 text-xs font-semibold hover:bg-sky-500/25 transition-colors">Boulder Council</a>
                <a href="https://www.longmontcolorado.gov/government/city-council" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200 text-xs font-semibold hover:bg-sky-500/25 transition-colors">Longmont Council</a>
                <a href="https://www.jeffco.us/1702/Board-of-County-Commissioners" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200 text-xs font-semibold hover:bg-sky-500/25 transition-colors">Jeffco Commissioners</a>
                <a href="https://leg.colorado.gov/" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200 text-xs font-semibold hover:bg-sky-500/25 transition-colors">CO Legislature</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ABOUT US + CHARTER ─── */}
      <section>
        <CharterPage />
      </section>

        {/* Closing CTA — same fixed photo showing through the translucent layer */}
        <section className="relative border-t border-white/10 min-h-[520px] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/45 to-slate-950/70 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-5 py-12 text-center w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-[10px] font-semibold uppercase tracking-[0.15em] mb-4 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Join us today
          </div>

          {/* Exact copy of the top hero word cluster. */}
          <h2 className="font-black leading-[0.82] tracking-tight text-[clamp(1.75rem,5vw,4.25rem)] drop-shadow-2xl">
            <span className="block text-white whitespace-nowrap">Committed to</span>
            <span className="block whitespace-nowrap bg-gradient-to-r from-sky-300 via-emerald-300 to-sky-300 bg-clip-text text-transparent">
              aircraft noise abatement
            </span>
            <span className="block text-slate-200 whitespace-nowrap">Join us</span>
          </h2>

          <p className="text-slate-300 text-sm md:text-base mt-6 max-w-xl mx-auto leading-relaxed drop-shadow-lg">
            Register your tail in under a minute. Fly with ADS-B. Acknowledge excursion reminders
            when they arrive. That's the commitment — and the whole Front Range flying community
            is counting on it.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <button
              onClick={onRegister}
              className="px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm shadow-2xl shadow-emerald-500/30 transition-colors"
            >
              Join us today →
            </button>
            <button
              onClick={() => scrollToSection('charter')}
              className="px-6 py-3.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 backdrop-blur-sm transition-colors"
            >
              Read the Charter
            </button>
            <button
              onClick={() => scrollToSection('leaderboard')}
              className="px-6 py-3.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-sm border border-white/10 backdrop-blur-sm transition-colors"
            >
              See the Leaderboard
            </button>
          </div>
        </div>
        </section>
        </div>{/* end inner .relative wrapper */}
      </div>{/* end translucent middle layer */}

      {airportDrill && (
        <AirportDrillDownModal
          icao={airportDrill}
          onClose={() => setAirportDrill(null)}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  AIRPORT DRILL-DOWN MODAL                                   */
/* ─────────────────────────────────────────────────────────── */
function AirportDrillDownModal({ icao, onClose }) {
  const airport = FRNAA_AIRPORTS.find((a) => a.icao === icao)
  const ranking = useMemo(() => getAirportRankings().find((r) => r.icao === icao), [icao])
  const based = useMemo(() => getBasedAircraftLeaderboard(icao, 12), [icao])
  if (!airport || !ranking) return null
  const tone = complianceTone(ranking.complianceWeighted)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — uses the airport's own photo if available, otherwise the generic Front Range backdrop */}
        <div className="relative p-5 border-b border-surface-border overflow-hidden min-h-[140px]">
          {airport.photo ? (
            <div
              className="absolute inset-0 bg-cover bg-center scale-105"
              style={{ backgroundImage: `url("${airport.photo}")`, filter: 'saturate(1.05) contrast(1.05)' }}
            />
          ) : (
            <FrontRangeBackdrop intensity="subtle" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/40" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">{airport.icao}</div>
              <div className="text-white font-black text-2xl truncate">{airport.name}</div>
              <div className="text-slate-300 text-xs">{airport.city}</div>
              <div className="flex items-center gap-2 mt-3">
                <span className={`px-2.5 py-1 rounded ${tone.bg} ${tone.border} border ${tone.text} font-bold text-sm`}>
                  {ranking.complianceWeighted}% compliant
                </span>
                <span className="text-slate-400 text-[11px]">
                  {ranking.totalFlights.toLocaleString()} flights YTD · {ranking.fleetSize} based
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white w-8 h-8 rounded-md hover:bg-white/10 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto">
          {/* Prominent policy link + report-noise action */}
          <div className="p-5 border-b border-surface-border space-y-3">
            <a
              href={airport.policyUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-sky-500/20 to-emerald-500/10 border-2 border-sky-500/40 hover:from-sky-500/30 hover:border-sky-400 transition-colors group"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-sky-500/25 border border-sky-400/40 flex items-center justify-center text-2xl">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">Read the official noise abatement policy</div>
                <div className="text-sky-200 text-xs mt-0.5 truncate">
                  Published on the {airport.name} website →
                </div>
              </div>
              <div className="text-sky-300 font-bold text-lg flex-shrink-0 group-hover:translate-x-0.5 transition-transform">↗</div>
            </a>
            <a
              href={`/noise?airport=${airport.icao}`}
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/10 border-2 border-amber-400/40 hover:from-amber-500/30 hover:border-amber-400 transition-colors group"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-amber-500/25 border border-amber-400/40 flex items-center justify-center text-2xl">
                📣
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">Report a noise concern near {airport.name}</div>
                <div className="text-amber-200 text-xs mt-0.5 truncate">
                  Opens the noise tool pre-centered on {airport.city}
                </div>
              </div>
              <div className="text-amber-300 font-bold text-lg flex-shrink-0 group-hover:translate-x-0.5 transition-transform">↗</div>
            </a>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-sky-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Voluntary Procedures (summary)</div>
              <div className="text-slate-200 text-xs leading-relaxed">{airport.abatement}</div>
            </div>
          </div>

          {/* Based aircraft leaderboard */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white text-sm font-bold">Top based aircraft — compliance leaderboard</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">YTD</div>
            </div>
            <div className="space-y-1.5">
              {based.map((f, i) => {
                const t = complianceTone(f.compliance)
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                return (
                  <div key={f.tail} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                    <div className="w-6 text-center flex-shrink-0">
                      {medal ? <span className="text-base">{medal}</span> : <span className="text-slate-500 text-[11px] font-mono">#{i + 1}</span>}
                    </div>
                    <div className="flex-shrink-0 w-10 h-7 rounded overflow-hidden bg-sky-500/10 border border-white/10">
                      <AircraftPhoto
                        model={f.model}
                        category={f.category}
                        className="w-full h-full"
                        silhouetteClass="w-7 h-4"
                      />
                    </div>
                    <div className="font-mono text-white text-xs font-bold min-w-[4.5rem]">{f.tail}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 text-xs truncate">{f.model}</div>
                      <div className="text-slate-500 text-[10px] truncate">{f.operator}</div>
                    </div>
                    <div className={`flex-shrink-0 px-2.5 py-1 rounded ${t.bg} ${t.border} border text-right min-w-[4.5rem]`}>
                      <div className={`${t.text} text-sm font-black leading-none tabular-nums`}>
                        {(f.flightsYTD - f.excursionsYTD).toLocaleString()}
                      </div>
                      <div className="text-slate-500 text-[9px] uppercase tracking-wider mt-0.5">quiet YTD</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent = 'sky' }) {
  const ring = accent === 'emerald' ? 'from-emerald-500/20 to-emerald-500/0'
    : accent === 'amber' ? 'from-amber-500/20 to-amber-500/0'
    : 'from-sky-500/20 to-sky-500/0'
  const text = accent === 'emerald' ? 'text-emerald-300'
    : accent === 'amber' ? 'text-amber-300'
    : 'text-sky-300'
  return (
    <div className={`relative overflow-hidden bg-surface-card border border-surface-border rounded-xl p-4`}>
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${ring} blur-2xl`} />
      <div className="relative">
        <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
        <div className={`text-3xl font-black mt-1 ${text}`}>{value}</div>
        <div className="text-slate-500 text-[11px] mt-0.5">{sub}</div>
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, sub }) {
  return (
    <div>
      <div className="text-sky-400 text-[10px] font-semibold uppercase tracking-wider">{eyebrow}</div>
      <h2 className="text-white text-2xl font-bold mt-1">{title}</h2>
      {sub && <p className="text-slate-400 text-sm mt-1 max-w-2xl">{sub}</p>}
    </div>
  )
}

function FeatureTile({ icon, title, body }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-sky-500/40 transition-colors">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-white font-bold text-sm">{title}</div>
      <p className="text-slate-400 text-xs mt-2 leading-relaxed">{body}</p>
    </div>
  )
}

function complianceTone(pct) {
  if (pct >= 92) return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300', bar: 'bg-emerald-400' }
  if (pct >= 85) return { bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     text: 'text-sky-300',     bar: 'bg-sky-400' }
  if (pct >= 75) return { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-300',   bar: 'bg-amber-400' }
  return                { bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    text: 'text-rose-300',    bar: 'bg-rose-400' }
}

function AirportCard({ a }) {
  const tone = complianceTone(a.compliance)
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 hover:border-sky-500/40 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono text-slate-500">{a.icao}</div>
          <div className="text-white font-bold text-base truncate">{a.name}</div>
          <div className="text-slate-400 text-xs">{a.city}</div>
        </div>
        <div className={`px-2 py-1 rounded-md ${tone.bg} ${tone.border} border`}>
          <div className={`${tone.text} text-[10px] font-semibold uppercase tracking-wider`}>Compliance</div>
          <div className={`${tone.text} text-lg font-black leading-none text-right`}>{a.compliance}%</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${tone.bar}`} style={{ width: `${a.compliance}%` }} />
      </div>
      <p className="text-slate-400 text-[11px] mt-3 leading-relaxed line-clamp-2">{a.description}</p>
      <div className="mt-3 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-white text-sm font-bold">{a.basedCount}</div>
          <div className="text-slate-500 text-[9px] uppercase tracking-wider">Based</div>
        </div>
        <div>
          <div className="text-white text-sm font-bold">{a.noiseExcursionsMTD}</div>
          <div className="text-slate-500 text-[9px] uppercase tracking-wider">Excur. MTD</div>
        </div>
        <div>
          <div className="text-emerald-300 text-sm font-bold">ACTIVE</div>
          <div className="text-slate-500 text-[9px] uppercase tracking-wider">Status</div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  AIRPORTS PAGE                                              */
/* ─────────────────────────────────────────────────────────── */
function AirportsPage() {
  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <SectionHeader
        eyebrow="Participating Airports"
        title="Noise abatement procedures, by field"
        sub="Every AID member airport publishes its voluntary procedures and shares operational data with the district. Visiting pilots can preview procedures before they depart."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {FRNAA_AIRPORTS.map((a) => {
          const tone = complianceTone(a.compliance)
          return (
            <div key={a.id} className="bg-surface-card border border-surface-border rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-slate-500 text-xs font-mono">{a.icao}</div>
                  <div className="text-white font-bold text-lg">{a.name}</div>
                  <div className="text-slate-400 text-xs">{a.city}</div>
                </div>
                <div className={`px-3 py-2 rounded-lg ${tone.bg} ${tone.border} border text-right`}>
                  <div className={`${tone.text} text-xs font-semibold`}>{a.compliance}% compliant</div>
                  <div className="text-slate-400 text-[10px]">{a.noiseExcursionsMTD} excursions MTD</div>
                </div>
              </div>
              <p className="text-slate-300 text-xs mt-3 leading-relaxed">{a.description}</p>
              <div className="mt-3 bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-sky-300 text-[10px] font-semibold uppercase tracking-wider mb-1">Voluntary Procedures</div>
                <div className="text-slate-200 text-xs leading-relaxed">{a.abatement}</div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{a.basedCount} based aircraft</span>
                <a href={a.tracksUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300">
                  Public noise tracks ↗
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  SCHOOLS & CLUBS                                            */
/* ─────────────────────────────────────────────────────────── */
function MembersPage() {
  const grouped = useMemo(() => {
    const g = {}
    FRNAA_AIRPORTS.forEach((a) => { g[a.icao] = { airport: a, schools: [], clubs: [] } })
    FRNAA_SCHOOLS.forEach((m) => {
      const bucket = grouped_push(g, m)
      if (bucket) bucket.push(m)
    })
    return g
  }, [])
  function grouped_push(g, m) {
    const entry = g[m.airport]
    if (!entry) return null
    return m.type === 'club' ? entry.clubs : entry.schools
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <SectionHeader
        eyebrow="Enrolled Member Organizations"
        title="Schools, clubs, and operators"
        sub="Enrolled members agree to a shared voluntary standard: fleet tails registered, ADS-B active, and a plan for integrating compliance reminders into flight operations."
      />
      <div className="space-y-5 mt-6">
        {Object.values(grouped).map(({ airport, schools, clubs }) => (
          <div key={airport.icao} className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-slate-500 text-[10px] font-mono">{airport.icao}</div>
                <div className="text-white font-bold text-base">{airport.name}</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-300 text-sm font-bold">{schools.length + clubs.length} members</div>
                <div className="text-slate-500 text-[10px]">{schools.length} schools · {clubs.length} clubs</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[...schools, ...clubs].map((m) => (
                <div key={m.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-2.5">
                  <div className="flex-shrink-0 w-14 h-10 rounded-md overflow-hidden border border-white/10 bg-slate-900">
                    <OrgPhoto query={m.photoQuery} alt={m.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-xs font-semibold truncate">{m.name}</div>
                    <div className="text-slate-500 text-[10px] uppercase tracking-wider truncate">
                      {m.type === 'club' ? 'Flying Club' : 'Flight School'} · {m.pilots} pilots · {m.fleet} a/c
                    </div>
                  </div>
                  <TierBadge tier={m.tier} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  WINGS EVENTS                                               */
/* ─────────────────────────────────────────────────────────── */
function WingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <SectionHeader
        eyebrow="FAA WINGS Events"
        title="Regional noise abatement cross-communication"
        sub="AID hosts quarterly WINGS events at every member airport, where pilots, schools, and administrators review noise excursion patterns and encourage voluntary participation. FAA WINGS credit available for participants."
      />
      <div className="space-y-3 mt-6">
        {FRNAA_WINGS_EVENTS.map((e) => (
          <div key={e.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center gap-4 hover:border-sky-500/40 transition-colors">
            <div className="flex-shrink-0 w-14 text-center bg-sky-500/10 border border-sky-500/30 rounded-lg py-2">
              <div className="text-sky-300 text-[10px] font-semibold uppercase">{new Date(e.date).toLocaleString('en', { month: 'short' })}</div>
              <div className="text-white text-xl font-black leading-none mt-0.5">{new Date(e.date).getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm">{e.title}</div>
              <div className="text-slate-400 text-xs mt-0.5">
                {e.time} · {e.airport} · hosted by {e.host}
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-emerald-300 font-bold text-sm">{e.rsvps}</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">RSVPs</div>
            </div>
            <button className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors">
              RSVP
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  CHARTER                                                    */
/* ─────────────────────────────────────────────────────────── */
function CharterPage() {
  return (
    <div className="max-w-7xl mx-auto px-5 py-12">
      {/* ─── ABOUT US panel ─── */}
      <div id="about" className="scroll-mt-20" />
      <SectionHeader eyebrow="About Us" title="Who runs the District" />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left card: the association snapshot */}
        <div className="lg:col-span-1 bg-surface-card border border-surface-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white font-black text-sm shadow-lg">
              AID
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Airport Impact</div>
              <div className="text-slate-400 text-[11px] leading-tight">District</div>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500 uppercase text-[9px] tracking-wider">Founded</dt>
              <dd className="text-slate-200 font-semibold">{FRNAA_INFO.founded}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500 uppercase text-[9px] tracking-wider">Structure</dt>
              <dd className="text-slate-200 font-semibold text-right">{FRNAA_INFO.incorporated}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500 uppercase text-[9px] tracking-wider">Airports</dt>
              <dd className="text-slate-200 font-semibold">{FRNAA_AIRPORTS.length} Airport Impact fields</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500 uppercase text-[9px] tracking-wider">Members</dt>
              <dd className="text-slate-200 font-semibold">{FRNAA_SCHOOLS.length} schools & clubs</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500 uppercase text-[9px] tracking-wider">Contact</dt>
              <dd className="text-sky-300 font-semibold">{FRNAA_INFO.email}</dd>
            </div>
          </dl>
          <p className="mt-4 text-slate-400 text-xs leading-relaxed">
            A volunteer board of pilots, operators, and airport representatives governs the District.
            The board is elected annually by participating member organizations.
          </p>
        </div>

        {/* Right: board members grid */}
        <div className="lg:col-span-2 bg-surface-card border border-surface-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-bold text-sm">Board of Directors</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">2026 Term</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FRNAA_BOARD.map((m) => (
              <div key={m.id} className="bg-white/5 border border-white/10 rounded-lg p-3.5">
                <div className="flex items-start gap-3">
                  {/* Initials avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-sky-500/30 to-emerald-500/20 border border-white/10 flex items-center justify-center text-sky-200 font-bold text-xs">
                    {m.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm leading-tight">{m.name}</div>
                    <div className="text-sky-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{m.role}</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{m.affiliation}</div>
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed mt-2.5">{m.bio}</p>
                <div className="text-slate-500 text-[10px] font-mono mt-2 pt-2 border-t border-white/5">
                  {m.ratings}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CHARTER ─── */}
      <div id="charter" className="mt-12 scroll-mt-20">
        <SectionHeader eyebrow="Charter" title="Why this association exists" />
      </div>
      <div className="mt-6 bg-surface-card border border-surface-border rounded-2xl p-6 md:p-8 space-y-5 text-slate-300 text-sm leading-relaxed">
        <p>
          <span className="text-sky-300 font-semibold">We take noise seriously.</span> The Denver
          Foothills Airport Impact District is a voluntary association of pilots, flight schools,
          operators, clubs, and airport administrators who share a single working premise: that
          a well-informed flying community is the most effective way to address noise concerns at
          our home fields.
        </p>
        <p>
          A majority of noise excursions are attributable to visiting aircraft from other Denver
          Foothills airports. The District exists to close that loop — by collecting voluntary
          procedures from every member field and routing voluntary reminders directly to the
          pilot-in-command, regardless of where they are based.
        </p>
        <p className="text-white font-semibold text-base">
          Everything we do is voluntary. There are no enforcement powers, no rankings, no penalties.
        </p>

        <h3 className="text-white text-base font-bold pt-4">What the District does</h3>
        <ul className="space-y-2 pl-5 list-disc marker:text-sky-400">
          <li>Hosts regular WINGS events at each participating airport to share noise excursion patterns and refresh voluntary procedures.</li>
          <li>Collects, collates, and distributes information about voluntary noise abatement across the Airport Impact.</li>
          <li>Supports voluntary enrollment in noise monitoring programs across the region.</li>
          <li>Supports integration of voluntary reminders into operations software for clubs and schools where multiple pilots share a single aircraft.</li>
          <li>Offers a self-directed remediation ladder — view the incursion on the map, load the abatement KML, take an online refresher, attend a WINGS event, fly with a qualified pilot — that any PIC can opt into at any time.</li>
        </ul>

        <h3 className="text-white text-base font-bold pt-4">What members do</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MemberObligation
            title="Airports"
            text="Member airports publish their voluntary procedures, share operational data with the District, and host WINGS events where the flying community can learn each other's noise-sensitive areas."
          />
          <MemberObligation
            title="Pilots"
            text="Participating pilots provide their tail numbers, fly with ADS-B, and maintain a valid email address so that voluntary reminders can reach them directly."
          />
          <MemberObligation
            title="Operators"
            text="Participating operators register their fleet, fly with ADS-B, and integrate voluntary reminders into their scheduling software so that every pilot who flies a shared aircraft sees the same information."
          />
        </div>
      </div>
    </div>
  )
}

function MemberObligation({ title, text }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4">
      <div className="text-sky-300 text-[10px] font-semibold uppercase tracking-wider">{title}</div>
      <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">{text}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  ADMIN PAGE — fake login, leaderboard, search/report        */
/* ─────────────────────────────────────────────────────────── */
function AdminPage() {
  const [auth, setAuth] = useState(null) // { airport, name }
  if (!auth) return <AdminLogin onLogin={setAuth} />
  return <AdminDashboard auth={auth} onLogout={() => setAuth(null)} />
}

function AdminLogin({ onLogin }) {
  const [airport, setAirport] = useState('KBDU')
  const [name, setName] = useState('')
  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white font-black text-sm mb-4">
          AID
        </div>
        <h2 className="text-white text-xl font-bold">AID Administrator Portal</h2>
        <p className="text-slate-400 text-xs mt-1">Airport administrators and compliance officers only.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); onLogin({ airport, name: name || 'Demo Administrator' }) }}
          className="mt-6 space-y-3"
        >
          <div>
            <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Airport</label>
            <select
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
              className="w-full mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none"
            >
              {FRNAA_AIRPORTS.map((a) => (
                <option key={a.icao} value={a.icao}>{a.icao} — {a.name}</option>
              ))}
              <option value="ALL">All AID airports (regional view)</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Your Name</label>
            <input
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            Sign In (Demo)
          </button>
          <p className="text-slate-600 text-[10px] text-center">
            This is a demo. Any credentials will work.
          </p>
        </form>
      </div>
    </div>
  )
}

function AdminDashboard({ auth, onLogout }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [sortBy, setSortBy] = useState('excursions_desc')

  const scoped = useMemo(() => {
    return auth.airport === 'ALL'
      ? FRNAA_FLEET
      : FRNAA_FLEET.filter((f) => f.airport === auth.airport)
  }, [auth.airport])

  const sorted = useMemo(() => {
    const arr = [...scoped]
    if (sortBy === 'compliance_desc') arr.sort((a, b) => b.compliance - a.compliance)
    else if (sortBy === 'compliance_asc') arr.sort((a, b) => a.compliance - b.compliance)
    else if (sortBy === 'excursions_desc') arr.sort((a, b) => b.excursions30 - a.excursions30)
    else if (sortBy === 'flights_desc') arr.sort((a, b) => b.flights30 - a.flights30)
    return arr
  }, [scoped, sortBy])

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted
    const q = query.trim().toUpperCase()
    return sorted.filter((f) =>
      f.tail.includes(q) ||
      f.operator.toUpperCase().includes(q) ||
      f.model.toUpperCase().includes(q)
    )
  }, [sorted, query])

  const airportInfo = FRNAA_AIRPORTS.find((a) => a.icao === auth.airport)
  const avgCompliance = scoped.length
    ? Math.round(scoped.reduce((a, b) => a + b.compliance, 0) / scoped.length * 10) / 10
    : 0
  const totalExcursions = scoped.reduce((a, b) => a + b.excursions30, 0)
  const adsbPct = scoped.length
    ? Math.round(scoped.filter((f) => f.adsb).length / scoped.length * 100)
    : 0
  const enrolledPct = scoped.length
    ? Math.round(scoped.filter((f) => f.enrolled).length / scoped.length * 100)
    : 0

  return (
    <div className="max-w-7xl mx-auto px-5 py-8">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-sky-400 text-[10px] font-semibold uppercase tracking-wider">Administrator Dashboard</div>
          <h2 className="text-white text-2xl font-bold mt-0.5">
            {auth.airport === 'ALL' ? 'All AID Airports' : `${auth.airport} · ${airportInfo?.name}`}
          </h2>
          <div className="text-slate-500 text-xs mt-0.5">Signed in as {auth.name}</div>
        </div>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-surface-border"
        >
          Sign Out
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Based Aircraft" value={scoped.length} sub={`${scoped.filter((f) => f.enrolled).length} enrolled in AID`} />
        <StatCard label="Avg. Compliance" value={`${avgCompliance}%`} sub="Rolling 30-day" accent="emerald" />
        <StatCard label="Noise Excursions (30d)" value={totalExcursions} sub="Across scoped fleet" accent="amber" />
        <StatCard label="ADS-B Equipped" value={`${adsbPct}%`} sub={`${enrolledPct}% program-enrolled`} />
      </div>

      {/* Leaderboard + search */}
      <div className="bg-surface-card border border-surface-border rounded-xl">
        <div className="flex items-center gap-3 p-4 border-b border-surface-border">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by tail, operator, or model…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200"
          >
            <option value="compliance_desc">Best compliance</option>
            <option value="compliance_asc">Worst compliance</option>
            <option value="excursions_desc">Most excursions</option>
            <option value="flights_desc">Most flights</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-semibold">#</th>
                <th className="text-left px-4 py-2 font-semibold">Tail</th>
                <th className="text-left px-4 py-2 font-semibold">Airport</th>
                <th className="text-left px-4 py-2 font-semibold">Model</th>
                <th className="text-left px-4 py-2 font-semibold">Operator</th>
                <th className="text-right px-4 py-2 font-semibold">Flights (30d)</th>
                <th className="text-right px-4 py-2 font-semibold">Excursions</th>
                <th className="text-center px-4 py-2 font-semibold" title="Issued · Acknowledged · Current stage">PIC Follow-up</th>
                <th className="text-right px-4 py-2 font-semibold">Compliance</th>
                <th className="text-center px-4 py-2 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 40).map((f, i) => {
                const tone = complianceTone(f.compliance)
                const events = getExcursionsForTail(f.tail)
                const issued = events.length
                const ack = events.filter((e) => e.acknowledged).length
                const remed = events.filter((e) => e.remediationComplete).length
                const openEvents = events.filter((e) => !e.remediationComplete)
                const currentStage = openEvents.length > 0
                  ? openEvents.reduce((hi, e) => (STAGE_ORDER_IDX[e.remediationStage] > STAGE_ORDER_IDX[hi] ? e.remediationStage : hi), 'A')
                  : null
                const stageTone = !currentStage ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  : STAGE_ORDER_IDX[currentStage] >= 5 ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                  : STAGE_ORDER_IDX[currentStage] >= 3 ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : STAGE_ORDER_IDX[currentStage] >= 2 ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  :                                       'bg-sky-500/20 border-sky-400/50 text-sky-200'
                return (
                  <tr
                    key={f.tail}
                    onClick={() => setSelected(f)}
                    className="border-t border-surface-border hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-white font-semibold text-xs">{f.tail}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{f.airport}</td>
                    <td className="px-4 py-2.5 text-slate-300 text-xs">{f.model}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{f.operator}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 text-xs">{f.flights30}</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <span className={f.excursions30 > 3 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>{f.excursions30}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {issued === 0 ? (
                        <span className="text-slate-600">—</span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5" title={`${issued} issued · ${ack} acknowledged · ${remed} remediation closed`}>
                          <span className="text-slate-400 tabular-nums text-[11px]">
                            <span className="text-sky-300 font-semibold">{issued}</span>
                            <span className="opacity-50">·</span>
                            <span className="text-emerald-300 font-semibold">{ack}</span>
                            <span className="opacity-50">·</span>
                            <span className="text-emerald-200 font-semibold">{remed}</span>
                          </span>
                          <span className={`inline-block px-1.5 py-0.5 rounded border font-bold text-[10px] ${stageTone}`}>
                            {currentStage ? currentStage : '✓'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded ${tone.bg} ${tone.border} border ${tone.text} font-bold text-[11px]`}>
                        {f.compliance}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="inline-flex gap-1">
                        <span title="ADS-B" className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${f.adsb ? 'bg-sky-500/15 text-sky-300' : 'bg-rose-500/15 text-rose-300'}`}>ADS-B</span>
                        <span title="Enrolled" className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${f.enrolled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'}`}>ENR</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No aircraft match your search.</div>
          )}
          {filtered.length > 40 && (
            <div className="p-3 text-center text-slate-500 text-xs border-t border-surface-border">
              Showing top 40 of {filtered.length} matches. Refine search to narrow results.
            </div>
          )}
        </div>
      </div>

      {selected && <ComplianceReportModal tail={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ComplianceReportModal({ tail, onClose }) {
  const events = useMemo(() => getExcursionsForTail(tail.tail), [tail.tail])
  const tone = complianceTone(tail.compliance)
  const issuedCount = events.filter((e) => e.issued).length
  const ackCount = events.filter((e) => e.acknowledged).length
  const remediatedCount = events.filter((e) => e.remediationComplete).length
  // Current stage: the highest stage reached in the open (not-yet-remediated) events
  const openEvents = events.filter((e) => !e.remediationComplete)
  const currentStageId = openEvents.length > 0
    ? openEvents.reduce((hi, e) => STAGE_ORDER_IDX[e.remediationStage] > STAGE_ORDER_IDX[hi] ? e.remediationStage : hi, 'A')
    : null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-surface-border flex items-start justify-between gap-4">
          <div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Compliance Report</div>
            <div className="flex items-center gap-3 mt-1">
              <div className="font-mono text-white font-black text-2xl">{tail.tail}</div>
              <span className={`px-2 py-1 rounded ${tone.bg} ${tone.border} border ${tone.text} font-bold text-xs`}>
                {tail.compliance}% compliance
              </span>
            </div>
            <div className="text-slate-400 text-xs mt-1">
              {tail.model} · {tail.operator} · Based {tail.airport}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white w-8 h-8 rounded-md hover:bg-white/10 text-lg leading-none">×</button>
        </div>

        {/* Issued / acknowledged / remediation summary */}
        <div className="p-5 grid grid-cols-3 gap-3 border-b border-surface-border">
          <MiniStat label="Issued" value={issuedCount} accent={issuedCount > 0 ? 'sky' : 'slate'} />
          <MiniStat label="Acknowledged" value={`${ackCount}/${issuedCount || 0}`} accent={ackCount === issuedCount && issuedCount > 0 ? 'emerald' : 'amber'} />
          <MiniStat
            label="Remediation"
            value={currentStageId ? `Stage ${currentStageId}` : (issuedCount > 0 ? '✓ Closed' : '—')}
            accent={!currentStageId ? 'emerald' : STAGE_ORDER_IDX[currentStageId] >= 4 ? 'amber' : 'slate'}
          />
        </div>

        {/* Remediation ladder visualization */}
        {events.length > 0 && (
          <div className="px-5 py-4 border-b border-surface-border bg-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white text-[11px] font-bold uppercase tracking-wider">Remediation Ladder</div>
              <div className="text-slate-500 text-[10px]">{remediatedCount} of {issuedCount} closed</div>
            </div>
            <RemediationLadder events={events} />
          </div>
        )}

        <div className="p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-white text-sm font-bold">Noise Excursion History</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">Last 30 days</div>
          </div>
          {events.length === 0 ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-emerald-300 text-xs">
              ✓ No noise excursions recorded. This aircraft is in full voluntary compliance — thank you.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e, i) => {
                const sev = e.severity === 'significant' ? 'rose' : e.severity === 'moderate' ? 'amber' : 'sky'
                const classes = sev === 'rose' ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : sev === 'amber' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
                const stage = REMEDIATION_STAGES[e.remediationStage]
                const stageTone = stage.tone === 'rose'    ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                                : stage.tone === 'amber'   ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                                : stage.tone === 'emerald' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                                :                             'bg-sky-500/20 border-sky-400/40 text-sky-200'
                return (
                  <div key={i} className={`border rounded-lg p-3 ${classes}`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold">{e.date} {e.time}</span>
                      <span className="uppercase tracking-wider font-bold">{e.severity}</span>
                    </div>
                    <div className="text-sm mt-1">{e.reason}</div>
                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] opacity-80">{e.airport} ·</span>
                      <span className="text-[10px] opacity-80">
                        {e.acknowledged ? '✓ Acknowledged by PIC' : '⏳ Pending acknowledgement'}
                      </span>
                      <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${stageTone}`}>
                        <span className="font-black">{e.remediationStage}</span>
                        <span className="opacity-90">· {stage.short}</span>
                        {e.remediationComplete && <span className="ml-0.5">✓</span>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surface-border flex items-center justify-between bg-white/5">
          <div className="text-slate-400 text-[11px]">
            Issued: <span className="text-white font-semibold">{issuedCount}</span> ·
            Acknowledged: <span className="text-emerald-300 font-semibold">{ackCount}</span> ·
            Remediation complete: <span className="text-emerald-300 font-semibold">{remediatedCount}</span>
          </div>
          <button className="px-3 py-1.5 text-xs font-semibold rounded-md bg-sky-500 text-white hover:bg-sky-400">
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

const STAGE_ORDER_IDX = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }

/* Visual ladder: six stages A→F with per-stage counts (open vs closed) */
function RemediationLadder({ events }) {
  const stages = ['A', 'B', 'C', 'D', 'E', 'F']
  const counts = Object.fromEntries(stages.map((s) => [s, { open: 0, closed: 0 }]))
  for (const e of events) {
    const bucket = counts[e.remediationStage]
    if (e.remediationComplete) bucket.closed += 1
    else bucket.open += 1
  }
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {stages.map((s) => {
        const stage = REMEDIATION_STAGES[s]
        const { open, closed } = counts[s]
        const total = open + closed
        const active = total > 0
        const allClosed = total > 0 && open === 0
        const toneBase = stage.tone === 'rose'    ? 'rose'
                       : stage.tone === 'amber'   ? 'amber'
                       : stage.tone === 'emerald' ? 'emerald'
                       :                             'sky'
        const inactive = 'bg-white/5 border-white/10 text-slate-500'
        const activeClasses =
          allClosed               ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' :
          toneBase === 'rose'     ? 'bg-rose-500/20 border-rose-400/50 text-rose-200' :
          toneBase === 'amber'    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' :
          toneBase === 'emerald'  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' :
                                    'bg-sky-500/20 border-sky-400/50 text-sky-200'
        return (
          <div
            key={s}
            className={`relative border rounded-md px-1.5 py-2 text-center ${active ? activeClasses : inactive}`}
            title={stage.label}
          >
            <div className="text-sm font-black leading-none">{s}</div>
            <div className="text-[9px] leading-tight mt-1 opacity-85 line-clamp-2 min-h-[1.8em]">
              {stage.short}
            </div>
            {total > 0 && (
              <div className="text-[10px] font-bold mt-1 tabular-nums">
                {closed > 0 && <span className="text-emerald-300">{closed}✓</span>}
                {closed > 0 && open > 0 && <span className="opacity-50"> · </span>}
                {open > 0 && <span>{open}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MiniStat({ label, value, accent = 'slate' }) {
  const text = accent === 'amber' ? 'text-amber-300'
    : accent === 'emerald' ? 'text-emerald-300'
    : 'text-white'
  return (
    <div>
      <div className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{label}</div>
      <div className={`text-lg font-black mt-0.5 ${text}`}>{value}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  REGISTER AIRCRAFT MODAL                                    */
/* ─────────────────────────────────────────────────────────── */
function RegisterAircraftModal({ onClose }) {
  const [tail, setTail] = useState('')
  const [email, setEmail] = useState('')
  const [airport, setAirport] = useState('KBDU')
  const [operator, setOperator] = useState('')
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true)
  const [adsb, setAdsb] = useState(true)
  const [done, setDone] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setDone(true)
  }

  return (
    <ModalShell onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-white text-xl font-bold">Aircraft registered</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Thank you. <span className="font-mono text-white">{tail.toUpperCase()}</span> is now enrolled
            in the AID voluntary program. Noise excursion reminders will be routed directly
            to {email} within minutes of any detected excursion.
          </p>
          <button
            onClick={onClose}
            className="mt-6 px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <h3 className="text-white text-xl font-bold">Register an Aircraft</h3>
          <p className="text-slate-400 text-xs mt-1">
            Enroll a tail in the AID voluntary program. Excursion reminders go directly
            to the registered email.
          </p>
          <div className="mt-5 space-y-3">
            <Field label="Tail Number *">
              <input
                type="text"
                required
                placeholder="N12345"
                value={tail}
                onChange={(e) => setTail(e.target.value)}
                className="modal-input font-mono uppercase"
              />
            </Field>
            <Field label="Contact Email *">
              <input
                type="email"
                required
                placeholder="pilot@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="modal-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Home Airport">
                <select value={airport} onChange={(e) => setAirport(e.target.value)} className="modal-input">
                  {FRNAA_AIRPORTS.map((a) => (
                    <option key={a.icao} value={a.icao}>{a.icao} — {a.name}</option>
                  ))}
                  <option value="OTHER">Other / Transient</option>
                </select>
              </Field>
              <Field label="Operator / Club (optional)">
                <input
                  type="text"
                  placeholder="Boulder Flying Club"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="modal-input"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-slate-300 text-xs cursor-pointer">
              <input type="checkbox" checked={adsb} onChange={(e) => setAdsb(e.target.checked)} className="accent-sky-500" />
              Aircraft is ADS-B Out equipped
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-xs cursor-pointer">
              <input type="checkbox" checked={subscribeNewsletter} onChange={(e) => setSubscribeNewsletter(e.target.checked)} className="accent-sky-500" />
              Subscribe to the AID newsletter
            </label>
          </div>

          <button
            type="submit"
            className="w-full mt-5 bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            Register Aircraft
          </button>
          <p className="text-slate-600 text-[10px] text-center mt-3">
            Demo form · no data leaves your browser
          </p>
        </form>
      )}
    </ModalShell>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  REGISTER NOISE COMPLAINT MODAL                             */
/* ─────────────────────────────────────────────────────────── */
function ComplaintModal({ onClose }) {
  const [where, setWhere] = useState('')
  const [airport, setAirport] = useState('KBDU')
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16))
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [subscribeThis, setSubscribeThis] = useState(true)
  const [subscribeAll, setSubscribeAll] = useState(false)
  const [done, setDone] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setDone(true)
  }

  return (
    <ModalShell onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <div className="text-5xl mb-3">📣</div>
          <h3 className="text-white text-xl font-bold">Complaint received</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Thank you. AID has logged this noise concern and will cross-reference it with ADS-B
            tracks for {airport} during the reported window. If a matching aircraft is identified, a
            voluntary reminder will be sent to the pilot-in-command.
          </p>
          {email && (
            <p className="text-slate-500 text-xs mt-3">
              We will follow up with you at {email} once the investigation is complete.
            </p>
          )}
          <button
            onClick={onClose}
            className="mt-6 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">📣</span>
            <h3 className="text-white text-xl font-bold">Report a Noise Excursion</h3>
          </div>
          <p className="text-slate-400 text-xs">
            Help AID route a voluntary reminder to the pilot-in-command. All fields help
            us correlate the event with ADS-B data.
          </p>
          <div className="mt-5 space-y-3">
            <Field label="Location / Address / Neighborhood *">
              <input
                type="text"
                required
                placeholder="5200 Block, Gunbarrel Ave, Boulder"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                className="modal-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Likely Departure Airport">
                <select value={airport} onChange={(e) => setAirport(e.target.value)} className="modal-input">
                  {FRNAA_AIRPORTS.map((a) => (
                    <option key={a.icao} value={a.icao}>{a.icao}</option>
                  ))}
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </Field>
              <Field label="Date & Time *">
                <input
                  type="datetime-local"
                  required
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="modal-input"
                />
              </Field>
            </div>
            <Field label="What did you hear? (optional)">
              <textarea
                rows="3"
                placeholder="Low propeller aircraft circling, engine straining…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="modal-input resize-none"
              />
            </Field>
            <Field label="Contact email (optional)">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="modal-input"
              />
            </Field>
            {email && (
              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-slate-300 text-xs cursor-pointer">
                  <input type="checkbox" checked={subscribeThis} onChange={(e) => setSubscribeThis(e.target.checked)} className="accent-amber-500" />
                  Notify me of the outcome of this complaint
                </label>
                <label className="flex items-center gap-2 text-slate-300 text-xs cursor-pointer">
                  <input type="checkbox" checked={subscribeAll} onChange={(e) => setSubscribeAll(e.target.checked)} className="accent-amber-500" />
                  Subscribe to the AID newsletter
                </label>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full mt-5 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            Submit Complaint
          </button>
          <p className="text-slate-600 text-[10px] text-center mt-3">
            AID is 100% voluntary — reports drive voluntary reminders, not enforcement actions.
          </p>
        </form>
      )}
    </ModalShell>
  )
}

function ModalShell({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      {/* shared input style */}
      <style>{`
        .modal-input {
          width: 100%;
          background: rgb(15 23 42 / 0.5);
          border: 1px solid rgb(51 65 85);
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.8125rem;
          color: rgb(226 232 240);
          outline: none;
        }
        .modal-input:focus { border-color: rgb(56 189 248); }
        .modal-input::placeholder { color: rgb(100 116 139); }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  FOOTER                                                     */
/* ─────────────────────────────────────────────────────────── */
/* ─── Sticky bottom CTA bar — always visible ─── */
function StickyActions() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-7xl mx-auto px-5 pb-4 flex justify-center gap-3 pointer-events-auto">
        <a
          href="/noise"
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-amber-500/90 hover:bg-amber-400 text-white font-semibold text-sm shadow-2xl shadow-amber-500/40 backdrop-blur-md transition-colors"
        >
          Report Noise
        </a>
        <button
          onClick={() => scrollToSection('support')}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-white font-semibold text-sm shadow-2xl shadow-emerald-500/40 backdrop-blur-md transition-colors"
        >
          I Support Aviation
        </button>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="border-t border-surface-border mt-12 bg-surface-card/50">
      <div className="max-w-7xl mx-auto px-5 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white font-black text-[10px]">AID</div>
            <div className="text-white font-bold text-sm">Airport Impact District</div>
          </div>
          <p className="text-slate-500 text-xs mt-3 leading-relaxed max-w-xs">
            {FRNAA_INFO.tagline}
          </p>
        </div>
        <div>
          <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-2">Member Airports</div>
          <ul className="space-y-1">
            {FRNAA_AIRPORTS.map((a) => (
              <li key={a.icao} className="text-slate-500 text-xs">
                <span className="font-mono text-slate-400">{a.icao}</span> · {a.name}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-2">Contact</div>
          <div className="text-slate-500 text-xs">{FRNAA_INFO.email}</div>
          <div className="text-slate-500 text-xs">{FRNAA_INFO.phone}</div>
          <div className="text-slate-600 text-[10px] mt-4">
            © {new Date().getFullYear()} AID · Demo portal · Not a real organization (yet)
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  ROOT                                                       */
/* ─────────────────────────────────────────────────────────── */
export function FrontRangeNoise() {
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      const el = document.getElementById(hash)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }), 50)
    }
  }, [])

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Nav onRegister={() => setShowRegister(true)} />
      <Home onRegister={() => setShowRegister(true)} />
      <Footer />
      <StickyActions />
      {showRegister && <RegisterAircraftModal onClose={() => setShowRegister(false)} />}
    </div>
  )
}
