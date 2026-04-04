import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  JB_INFO, JB_STAFF, JB_MEMBERSHIP, JB_INSTRUCTION_RATES,
  JB_INSURANCE, JB_FUEL, JB_FBO_SERVICES, JB_TRAINING, JB_GALLERY,
  JB_RESOURCES, getJBTodayOps,
} from './journeysBoulderData'
import { getAircraftByOperator } from '../mocks/aircraft'
import { mockAircraft } from '../mocks/aircraft'
import { mockPersonnel } from '../mocks/personnel'
import { addSquawk, getSquawks, subscribeSquawks } from '../store/squawks'
import { addServiceRequest, getServiceRequests } from '../store/serviceRequests'
import { addFlight, updateFlight as updateStoreFlight, getAllFlights, subscribe } from '../store/flights'
import { mockStudents, PROGRAMS, mockBookings, SCHEDULE_DAYS, SCHEDULE_SLOTS } from '../training/mockTraining'
import {
  requirementProgress, metRequirementCount, stageProgress, isCheckrideReady,
  recommendLessons, expiryStatus, expiryLabel, EXPIRY_COLOR, EXPIRY_BG,
  DPE_STATUS_LABEL, DPE_STATUS_COLOR, DPE_STATUS_BG,
  BOOKING_TYPE_COLORS, BOOKING_TYPE_LABELS, WEATHER_FIT_COLORS, WEATHER_FIT_LABELS,
  calcTrainingWB, wbStatusLevel, WB_STATUS, LESSON_TEMPLATES,
} from '../training/trainingUtils'

/* ═══════════════════════════════════════════════════════════
   Journeys Aviation — Full-Screen Client-Facing Portal
   ═══════════════════════════════════════════════════════════ */

const fmt$ = (n) => n != null ? `$${n}` : 'Call'
const STATUS_COLOR = {
  airworthy:   { bg: 'bg-green-400/15', border: 'border-green-400/30', text: 'text-green-400', dot: 'bg-green-400', label: 'Airworthy' },
  maintenance: { bg: 'bg-amber-400/15', border: 'border-amber-400/30', text: 'text-amber-400', dot: 'bg-amber-400', label: 'In Maintenance' },
  grounded:    { bg: 'bg-red-400/15',   border: 'border-red-400/30',   text: 'text-red-400',   dot: 'bg-red-400',   label: 'Grounded' },
}

// Normalize route separators: space, comma, dash, >, period → arrow
function normalizeRoute(raw) {
  return raw
    .toUpperCase()
    .replace(/\s*[→>]+\s*/g, ' → ')          // already arrows — clean spacing
    .replace(/\s*[-–—,.;/\\|]+\s*/g, ' → ')  // common separators → arrow
    .replace(/\s{2,}/g, ' → ')               // multiple spaces → arrow
    .replace(/(→\s*)+/g, '→ ')               // collapse repeated arrows
    .replace(/^\s*→\s*/, '')                  // trim leading arrow
    .trim()
}

const RENTAL_PDF = 'http://journeysaviation.com/uploads/1/3/2/8/132898297/aircraft_rental_price_list_12.1.2023.pdf'
const WB_CALC_URL = 'https://www.journeysaviation.com/aircraft-fleet.html'

/* ─── PERSONAS (login-as for testing) ─── */
const PERSONAS = [
  // PPL student — beginner, Stage 1
  { id: 'student-1', name: 'Tyler Mason', role: 'student', label: 'Student Pilot (PPL)', email: 'tyler@example.com',
    aircraft: ['N52993', 'N12JA'], hours: 7.2, weightLbs: 178, preferredCfis: ['prs-018', 'prs-017'],
    cert: 'student', ratings: [], endorsements: [], program: 'private_pilot',
  },
  // PPL holder — enrolled in Instrument Rating, Stage 1
  { id: 'student-2', name: 'Maria Vasquez', role: 'student', label: 'PPL → Instrument Rating', email: 'maria@example.com',
    aircraft: ['N733JM', 'N3547L', 'N6694E'], hours: 310, weightLbs: 145, preferredCfis: ['prs-017'],
    cert: 'private', ratings: ['asel'], endorsements: ['hp'], program: 'instrument_rating',
  },
  // PPL+IR holder — enrolled in Commercial, Stage 2
  { id: 'student-3', name: 'Jake Rosen', role: 'student', label: 'PPL+IR → Commercial', email: 'jake@example.com',
    aircraft: ['N6694E', 'N3547L', 'N401SS'], hours: 238.5, weightLbs: 190, preferredCfis: ['prs-001'],
    cert: 'private', ratings: ['asel', 'instrument'], endorsements: ['hp', 'complex'], program: 'commercial_pilot',
  },
  // CPL+ME holder — tailwheel endorsement + maintenance client
  { id: 'mx-client-1', name: 'Dave Kowalski', role: 'mx_client', label: 'CPL/ME — Tailwheel + MX Client', email: 'dave@example.com',
    hours: 1200, weightLbs: 195, preferredCfis: ['prs-018'],
    cert: 'commercial', ratings: ['asel', 'amel', 'instrument'], endorsements: ['hp', 'complex'],
    program: 'private_pilot', // using PPL program for endorsement scheduling
    ownedAircraft: [
      { tail: 'N789DK', type: 'Cessna 182Q Skylane', agents: ['Dave Kowalski', 'Lisa Kowalski'] },
      { tail: 'N421PB', type: 'Piper PA-28-180 Cherokee', agents: ['Dave Kowalski'] },
    ],
  },
  // PPL student — nearly done, Stage 5 checkride prep
  { id: 'student-5', name: 'Emily Carter', role: 'student', label: 'PPL Stage 5 (Checkride)', email: 'emily@example.com',
    aircraft: ['N733JM', 'N52993'], hours: 42.8, weightLbs: 135, preferredCfis: ['prs-017'],
    cert: 'student', ratings: [], endorsements: [], program: 'private_pilot',
  },
  // CFI
  { id: 'cfi-1', name: 'Linda Foster', role: 'cfi', label: 'CFI / CFII', email: 'linda@journeysaviation.com',
    aircraft: [], hours: 3200, weightLbs: 147, personnelId: 'prs-017',
    cert: 'commercial', ratings: ['asel', 'instrument', 'cfi', 'cfii'], endorsements: ['hp', 'complex', 'tailwheel'],
  },
  { id: 'admin-1', name: 'Andrew McKenna', role: 'admin', label: 'Admin / Owner', email: 'andrew@journeysaviation.com',
    aircraft: [], hours: 1000, weightLbs: 185,
    cert: 'commercial', ratings: ['asel', 'amel', 'instrument'], endorsements: ['hp'],
  },
]

/* ─── CFI session types with requirements ─── */
// minCert: minimum pilot certificate to book this session
// requiresRating: pilot must hold this rating (or be training for it)
// requiresCfii: CFI must have CFII
// requiresMei: CFI must have MEI
// requiresIfrAc: aircraft must be IFR certified
// requiresMultiAc: aircraft must be multi-engine
// requiresHpAc: aircraft must be high-performance
// requiresTwAc: aircraft must be taildragger
// requiresComplexAc: aircraft must be complex
// forStudent: show to student pilots (pre-PPL training)
const CFI_SESSION_TYPES = [
  // ── Student pilot sessions (flight type — dual/solo selected separately) ──
  { id: 'pattern',       label: 'Pattern Work',    duration: 1,   desc: 'Takeoffs, landings, go-arounds, short/soft field.',   minCert: 'student', forStudent: true, area: 'pattern', allowSolo: true },
  { id: 'practice-area', label: 'Practice Area',   duration: 2,   desc: 'Steep turns, slow flight, stalls, ground reference.', minCert: 'student', forStudent: true, area: 'practice', allowSolo: true },
  { id: 'local',         label: 'Local Flight',    duration: 2,   desc: 'Pilotage, dead reckoning, radio nav within 25 nm.',   minCert: 'student', forStudent: true, area: 'local', allowSolo: true },
  { id: 'xc',            label: 'Cross-Country',   duration: 3,   desc: 'Navigation, fuel planning, diversions, towered airports.', minCert: 'student', forStudent: true, area: 'xc', xc: true, allowSolo: true },
  { id: 'night',         label: 'Night Flight',    duration: 2,   desc: '3 takeoffs/landings to full stop required for PPL.',   minCert: 'student', forStudent: true, area: 'local' },
  { id: 'stage-check',   label: 'Stage Check',     duration: 2,   desc: 'Progress evaluation by chief/senior CFI — not your assigned instructor.', minCert: 'student', forStudent: true, requiresStageCheckAuth: true },
  { id: 'checkride-prep', label: 'Checkride Prep', duration: 2,   desc: 'Mock practical test — oral + flight with your CFI.',   minCert: 'student', forStudent: true },

  // ── PPL+ sessions ──
  { id: 'bfr', label: 'Flight Review (BFR)', duration: 2, desc: '1 hr ground + 1 hr flight. Required every 24 months.', minCert: 'private' },
  { id: 'currency', label: 'Currency / Proficiency', duration: 1, desc: 'Stay sharp — pattern work, maneuvers, or emergencies.', minCert: 'private' },
  { id: 'night', label: 'Night Currency', duration: 1, desc: '3 takeoffs and landings to a full stop after dark.', minCert: 'private' },
  { id: 'mountain', label: 'Mountain Flying', duration: 2, desc: 'Density altitude, canyon winds, terrain awareness.', minCert: 'private' },

  // ── Endorsement / checkout sessions ──
  { id: 'hp-checkout', label: 'High-Performance Checkout', duration: 2, desc: 'C182 checkout — endorsement for >200 hp engines.', minCert: 'private', requiresHpAc: true },
  { id: 'tailwheel', label: 'Tailwheel Endorsement', duration: 2, desc: 'Conventional gear training in the Citabria 7ECA.', minCert: 'private', requiresTwAc: true },
  { id: 'complex', label: 'Complex Checkout', duration: 2, desc: 'Retractable gear, CS prop, and flaps endorsement.', minCert: 'private', requiresComplexAc: true },

  // ── IFR sessions (require CFII + IFR aircraft) ──
  { id: 'ipc', label: 'Instrument Proficiency Check', duration: 2, desc: 'Get current on instruments — approaches, holds, partial panel.', minCert: 'private', requiresRating: 'instrument', requiresCfii: true, requiresIfrAc: true },
  { id: 'ifr-practice', label: 'IFR Practice / Hood Work', duration: 2, desc: 'Instrument approaches, holds, and procedures under the hood.', minCert: 'private', requiresCfii: true, requiresIfrAc: true },
  { id: 'ifr-xc', label: 'IFR Cross-Country', duration: 3, desc: 'File and fly an IFR flight plan with your CFII.', minCert: 'private', requiresCfii: true, requiresIfrAc: true, xc: true },

  // ── Commercial / advanced ──
  { id: 'commercial-maneuvers', label: 'Commercial Maneuvers', duration: 2, desc: 'Chandelles, lazy 8s, steep spirals, 8s on pylons.', minCert: 'private', requiresRating: 'commercial_training' },
]

// Certificate hierarchy for filtering
const CERT_LEVEL = { student: 0, private: 1, commercial: 2, atp: 3 }

// Determine which sessions a user qualifies for
function getAvailableSessions(user, aircraft) {
  const userLevel = CERT_LEVEL[user.cert] ?? 0
  const userRatings = user.ratings || []

  return CFI_SESSION_TYPES.filter((s) => {
    // Certificate level check
    const reqLevel = CERT_LEVEL[s.minCert] ?? 0
    if (userLevel < reqLevel) return false

    // Student-only sessions hidden from rated pilots (unless explicitly forStudent)
    if (s.forStudent && userLevel > 0 && s.id !== 'xc-dual' && s.id !== 'xc-solo' && s.id !== 'checkride-prep') return false

    // Rating requirements — allow if pilot has it OR is training toward it
    if (s.requiresRating === 'instrument' && !userRatings.includes('instrument') && userLevel > 0) return false
    // commercial_training: open to anyone with PPL working on commercial
    if (s.requiresRating === 'commercial_training' && userLevel < 1) return false

    // Aircraft capability checks (only when aircraft is selected)
    if (aircraft) {
      if (s.requiresIfrAc && !aircraft.equipment?.ifrCertified) return false
      if (s.requiresMultiAc && !aircraft.riskProfile?.multiEngine) return false
      if (s.requiresHpAc && !aircraft.riskProfile?.highPerformance) return false
      if (s.requiresTwAc && !aircraft.riskProfile?.taildragger) return false
      if (s.requiresComplexAc && !aircraft.riskProfile?.complexAircraft) return false
    }

    return true
  })
}

// Build a suitability message for an aircraft
function aircraftSuitabilityMessage(ac) {
  if (!ac) return null
  const capabilities = []
  const limitations = []

  capabilities.push('VFR training')
  if (ac.equipment?.ifrCertified) capabilities.push('IFR training')
  if (ac.equipment?.autopilot) capabilities.push('autopilot practice')
  if (ac.equipment?.glassPanel) capabilities.push('glass cockpit')
  if (ac.riskProfile?.highPerformance) capabilities.push('high-performance')
  if (ac.riskProfile?.taildragger) capabilities.push('tailwheel')
  if (ac.riskProfile?.complexAircraft) capabilities.push('complex operations')
  if (ac.riskProfile?.multiEngine) capabilities.push('multi-engine')

  if (!ac.equipment?.ifrCertified) limitations.push('not IFR certified')
  if (!ac.riskProfile?.multiEngine) limitations.push('single-engine only')
  if (ac.soloInsuranceReq === 'Dual instruction only') limitations.push('dual instruction only — no solo')
  if (ac.soloInsuranceReq === 'Private') limitations.push('Private certificate required for solo')

  return { capabilities, limitations }
}

// Check if a CFI is qualified for a given session
function cfiQualifiedForSession(cfi, session) {
  if (!cfi.cfiCert) return false
  if (session?.requiresCfii && !(cfi.cfiRatings || []).includes('CFII')) return false
  if (session?.requiresMei && !(cfi.cfiRatings || []).includes('MEI')) return false
  // Stage checks require chief pilot, senior CFI, or ATP-level
  if (session?.requiresStageCheckAuth) {
    if (!cfi.isChiefPilot && cfi.certType !== 'ATP' && !(cfi.cfiRatings || []).includes('CFII')) return false
  }
  return true
}

// Find best CFI for a session type
function bestCfiForSession(session, cfiList, preferredCfis) {
  if (!session) return null
  const qualified = cfiList.filter((c) => cfiQualifiedForSession(c, session))
  // Prefer preferred CFIs first
  qualified.sort((a, b) => (preferredCfis.includes(a.id) ? 0 : 1) - (preferredCfis.includes(b.id) ? 0 : 1))
  return qualified[0]?.id || null
}

/* ─── LOGIN MODAL ─── */
function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const handleSubmit = (e) => { e.preventDefault(); onLogin({ id: 'custom', name: email.split('@')[0], role: 'renter', label: 'Member', email, aircraft: [], hours: 0 }) }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white mb-1">Welcome to Journeys</h3>
        <p className="text-slate-400 text-xs mb-5">Students, renters, and maintenance clients — sign in to access your portal</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
          <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">Sign In</button>
        </form>

        {/* Login-as personas for testing */}
        <div className="mt-5 pt-4 border-t border-surface-border">
          <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-2">Quick Login (Testing)</p>
          <div className="space-y-1.5">
            {PERSONAS.map((p) => (
              <button key={p.id} onClick={() => onLogin(p)}
                className="w-full flex items-center justify-between bg-surface border border-surface-border rounded-lg px-3 py-2 text-left hover:border-sky-400/40 transition-colors group">
                <div>
                  <div className="text-slate-200 text-xs font-medium group-hover:text-white">{p.name}</div>
                  <div className="text-slate-500 text-[10px]">{p.label}</div>
                </div>
                <span className="text-sky-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-[10px] text-center mt-3">New? Call {JB_INFO.phone} to set up an account</p>
      </div>
    </div>
  )
}

/* ─── MINI-GALLERY STRIP (3 rotating images with crossfade) ─── */
const GALLERY_GRADIENTS = [
  'from-sky-600 to-blue-800', 'from-amber-500 to-orange-700', 'from-emerald-500 to-teal-700',
  'from-purple-500 to-indigo-700', 'from-rose-500 to-pink-700', 'from-cyan-500 to-sky-700',
  'from-blue-500 to-indigo-800', 'from-teal-400 to-emerald-700', 'from-indigo-500 to-purple-800',
  'from-sky-400 to-blue-700', 'from-amber-400 to-red-600', 'from-green-500 to-teal-800',
  'from-blue-400 to-sky-800', 'from-violet-500 to-purple-700', 'from-orange-400 to-amber-700',
  'from-cyan-400 to-blue-700',
]

// Track which image IDs are currently shown across all strips to avoid dupes
let _activeStripImages = new Set()

function MiniGalleryStrip({ category }) {
  // Seeded shuffle unique to this category so each strip shows different images
  const seed = useRef(Math.floor(Math.random() * 100))
  const items = useMemo(() => {
    let pool = category ? JB_GALLERY.filter((g) => g.category === category) : [...JB_GALLERY]
    if (pool.length < 3) pool = [...JB_GALLERY]
    // Deterministic-ish shuffle based on seed so different strips diverge
    pool.sort((a, b) => ((a.id * 7 + seed.current) % 13) - ((b.id * 7 + seed.current) % 13))
    return pool
  }, [category])

  const [offset, setOffset] = useState(() => seed.current % Math.max(items.length - 2, 1))
  useEffect(() => {
    const id = setInterval(() => setOffset((o) => (o + 1) % Math.max(items.length - 2, 1)), 5000 + seed.current * 50) // stagger timing
    return () => clearInterval(id)
  }, [items.length])

  // Pick 3 that aren't already shown in another strip
  const candidates = []
  for (let i = 0; candidates.length < 3 && i < items.length; i++) {
    const img = items[(offset + i) % items.length]
    if (!_activeStripImages.has(img.id) || candidates.length + (items.length - i) <= 3) candidates.push(img)
  }
  // Update active tracker
  useEffect(() => {
    const ids = candidates.map((c) => c.id)
    ids.forEach((id) => _activeStripImages.add(id))
    return () => ids.forEach((id) => _activeStripImages.delete(id))
  })
  const visible = candidates

  return (
    <div className="py-6 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-3">
        {visible.map((img, i) => (
          <div key={`${img.id}-${offset}-${i}`} className="relative aspect-[16/7] rounded-xl overflow-hidden animate-[fadeIn_1s_ease-in-out]">
            {img.img ? (
              <img src={img.img} alt={img.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${GALLERY_GRADIENTS[(img.id - 1 + offset) % GALLERY_GRADIENTS.length]} transition-all duration-1000`}>
                <div className="absolute inset-0 opacity-25">
                  <div className="absolute top-[25%] left-[15%] w-[50%] h-[2px] bg-white/40 rounded-full rotate-[-3deg]" />
                  <div className="absolute top-[45%] left-[25%] w-[35%] h-[1.5px] bg-white/25 rounded-full rotate-[1deg]" />
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white text-[10px] font-medium leading-tight">{img.alt}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── MAINTENANCE SECTION (logged-in only) ─── */
function MaintenanceSection({ user }) {
  // Logged-in users have squawk on fleet cards and status in My Fleet — just show brief info
  if (user) return null

  // Non-logged-in: show services overview
  return (
    <section id="sec-maintenance" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/30 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Aircraft Maintenance</h2>
          <p className="text-slate-400">A&P, IA, and Rotax iRMT certified · ROTAX iRC</p>
        </div>
        <div className="max-w-lg mx-auto bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔧</div>
          <h3 className="text-white font-bold text-lg mb-2">Full-Service Maintenance Shop</h3>
          <p className="text-slate-400 text-sm mb-4">Annual, 100-hour, conditional & pre-buy inspections. Rotax Independent Repair Centre. SLSA maintenance and repair.</p>
          <div className="grid grid-cols-2 gap-3 mb-6 text-xs">
            <div className="bg-surface border border-surface-border rounded-xl p-3">
              <div className="text-white font-semibold">Maintenance</div>
              <div className="text-sky-400">{JB_INFO.maintenancePhone}</div>
            </div>
            <div className="bg-surface border border-surface-border rounded-xl p-3">
              <div className="text-white font-semibold">FBO</div>
              <div className="text-sky-400">{JB_INFO.phone}</div>
            </div>
          </div>
          <p className="text-slate-500 text-xs">Sign in to report squawks, schedule inspections, and track maintenance status for your aircraft.</p>
        </div>
      </div>
    </section>
  )
}

/* ─── SCHEDULE SECTION (inline, below fleet, full-width, mobile-first) ─── */

// Half-hour slot grid
const HALF_HOUR_SLOTS = []
for (let h = 7; h <= 17; h++) {
  HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  if (h < 17) HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
}

function slotLabel(slot) {
  const [h, m] = slot.split(':').map(Number)
  const ampm = h >= 12 ? 'p' : 'a'
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h
  return m === 0 ? `${hr}${ampm}` : `${hr}:${m}${ampm}`
}

// Check if a booking occupies a given half-hour cell
function slotOccupied(bookings, dayIdx, slot, field, id) {
  if (!id) return false
  const si = HALF_HOUR_SLOTS.indexOf(slot)
  return bookings.some((b) => {
    if (b[field] !== id) return false
    if ((b.dayIdx ?? b.day) !== dayIdx) return false
    // Convert legacy hourly slots → half-hour index
    const bSlot = b.slot.includes(':') ? b.slot : `${b.slot.slice(0,2)}:${b.slot.slice(2) || '00'}`
    const bsi = HALF_HOUR_SLOTS.indexOf(bSlot)
    if (bsi < 0) return false
    const bLen = (b.duration || 1) * 2 // half-hour units
    return si >= bsi && si < bsi + bLen
  })
}

function ScheduleSection({ user, selectedAircraft, onSelectAircraft, onClearAircraft, proposedLessons = [] }) {
  const cfiList = mockPersonnel.filter((p) => p.cfiCert)
  const fleet = getAircraftByOperator('journeys')
  const preferredCfis = user.preferredCfis || []
  // Merge persona owned aircraft with any added via localStorage
  const [extraOwned, setExtraOwned] = useState(() => { try { return JSON.parse(localStorage.getItem(`journeys_owned_${user.id}`) || '[]') } catch { return [] } })
  const ownedAircraft = [...(user.ownedAircraft || []), ...extraOwned.filter((a) => !(user.ownedAircraft || []).some((o) => o.tail === a.tail))]
  const [newOwnTail, setNewOwnTail] = useState('')
  const [newOwnType, setNewOwnType] = useState('')
  const [newOwnFuel, setNewOwnFuel] = useState('100LL')
  const [newOwnServices, setNewOwnServices] = useState({})

  const BOOKINGS_KEY = `journeys_bookings_${user.id}`
  const loadBookings = () => { try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]') } catch { return [] } }

  const [acMode, setAcMode] = useState(selectedAircraft ? 'fleet' : 'fleet')
  const [ownTail, setOwnTail] = useState(ownedAircraft[0]?.tail || '')
  const [sessionType, setSessionType] = useState('')
  const [flightMode, setFlightMode] = useState('dual') // 'dual' | 'solo' | 'ground'
  // Default to first preferred CFI
  // 'preferred' = any preferred CFI, '' = any CFI, or specific id
  const [selectedCfi, setSelectedCfi] = useState(preferredCfis.length > 0 ? 'preferred' : '')
  const [durationHalfHours, setDurationHalfHours] = useState(4)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next, -1 = prev
  const [stars] = useAircraftStars(user?.id)
  const [bookings, setBookings] = useState(loadBookings)
  const [editingBooking, setEditingBooking] = useState(null)
  const [skippedProposals, setSkippedProposals] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [xcRoute, setXcRoute] = useState('KBDU')
  const [xcFuelGal, setXcFuelGal] = useState('')

  // Persist bookings to localStorage whenever they change
  useEffect(() => { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings)) }, [bookings, BOOKINGS_KEY])

  useEffect(() => { if (selectedAircraft) setAcMode('fleet') }, [selectedAircraft])

  const durationHrs = durationHalfHours / 2
  const session = CFI_SESSION_TYPES.find((s) => s.id === sessionType)

  // Proposed lessons for students (breathing on calendar)
  const studentData = useMemo(() => mockStudents.find((s) => s.name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())), [user.name])
  // Compute proposed lessons — NOT memoized to avoid stale cache
  const proposed = (() => {
    if (!studentData || user.cert !== 'student') return []
    const now = new Date()
    const dow = now.getDay()
    const todayIdx = dow === 0 ? 6 : dow - 1 // Mon=0..Sat=5, Sun=6
    const nowHour = now.getHours()

    // Block all past slots in the training module's search space
    const pastSkips = new Set()
    const SLOTS = ['0700','0800','0900','1000','1100','1200','1300','1400','1500','1600','1700']
    for (let d = 0; d <= 12; d++) {
      if (d === 6) continue
      const mappedDay = d >= 7 ? d - 7 : d
      if (d < 7 && mappedDay < todayIdx) { SLOTS.forEach((s) => pastSkips.add(`${d}:${s}`)); continue }
      if (d < 7 && mappedDay === todayIdx) { SLOTS.filter((s) => parseInt(s.slice(0, 2), 10) <= nowHour).forEach((s) => pastSkips.add(`${d}:${s}`)) }
    }

    const recs = recommendLessons(studentData, mockPersonnel, mockAircraft, mockBookings, pastSkips)

    // Hard filter: only future slots (belt + suspenders)
    return recs.filter((r) => {
      if (!r.slot) return false
      const di = r.slot.dayIdx
      const slotHour = parseInt((r.slot.slot || '0000').slice(0, 2), 10)
      // Map training dayIdx to real date
      const realDay = di >= 7 ? di - 7 : di
      if (di < 7 && realDay < todayIdx) return false
      if (di < 7 && realDay === todayIdx && slotHour <= nowHour) return false
      // Night flights: must start no earlier than 1 hour before sunset
      // Sunset approximation for Boulder (40°N) by day of year
      const isNight = r.template.title?.toLowerCase().includes('night')
      if (isNight) {
        const jan1 = new Date(now.getFullYear(), 0, 1)
        const dayOfYear = Math.floor((now - jan1) / 86400000)
        // Simplified sunset hour for 40°N latitude (Boulder)
        // Ranges from ~17:00 (Dec 21) to ~20:30 (Jun 21)
        const sunsetHour = 17.0 + 3.5 * Math.sin(((dayOfYear - 80) / 365) * 2 * Math.PI)
        const earliestNight = Math.floor(sunsetHour) - 1
        if (slotHour < earliestNight) return false
      }
      return true
    }).slice(0, 3)
  })()

  // Gather ALL bookings for conflict detection:
  // 1. Training module mock bookings (instructor schedule)
  // 2. This user's new bookings
  // 3. Other users' persisted bookings (all journeys_bookings_* keys)
  // 4. Flights from the shared store → converted to booking shape
  const otherUserBookings = useMemo(() => {
    const all = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('journeys_bookings_') && key !== BOOKINGS_KEY) {
        try { all.push(...JSON.parse(localStorage.getItem(key) || '[]')) } catch {}
      }
    }
    return all
  }, [BOOKINGS_KEY, bookings]) // re-scan when own bookings change (proxy for "something changed")

  // Convert shared flights to booking-shaped records for conflict detection
  const flightBookings = useMemo(() => {
    return getAllFlights()
      .filter((f) => f.status === 'planned' || f.status === 'active')
      .filter((f) => f._source === 'journeys_portal' || f.operator === 'journeys')
      .map((f) => {
        const dt = new Date(f.plannedDepartureUtc)
        const dow = dt.getDay() // 0=Sun..6=Sat
        const dayIdx = dow === 0 ? -1 : dow - 1
        const hh = String(dt.getHours()).padStart(2, '0')
        const mm = String(dt.getMinutes()).padStart(2, '0')
        return {
          dayIdx,
          slot: `${hh}:${mm}`,
          duration: f._duration || 1,
          cfiId: f.picId,
          aircraftId: f._bookingId ? null : (fleet.find((a) => a.tailNumber === f.tailNumber)?.id || null), // avoid double-counting own bookings
          studentId: f.sicId || f._bookingId,
          id: f.id,
        }
      })
      .filter((b) => b.dayIdx >= 0)
  }, [bookings, fleet])

  const allBookings = [...mockBookings, ...bookings, ...otherUserBookings, ...flightBookings]
  const activeAircraftId = acMode === 'fleet' && selectedAircraft ? selectedAircraft.id : null

  // Check if selected aircraft is airworthy
  const acAirworthy = selectedAircraft ? selectedAircraft.airworthy : true
  const acInspectionDue = selectedAircraft?.inspectionStatus === 'due_soon' || selectedAircraft?.inspectionStatus === 'overdue'

  const adjustDuration = (delta) => setDurationHalfHours((d) => Math.max(2, Math.min(8, d + delta))) // 1–4 hrs

  // Availability check per half-hour cell.
  // Returns { free, cfis[], soloOk, effectiveDur } where effectiveDur is the
  // max half-hours available (may be < requested duration if a booking cuts it short).
  const getSlotInfo = useCallback((dayIdx, slot) => {
    const si0 = HALF_HOUR_SLOTS.indexOf(slot)
    const requestedDur = durationHalfHours

    // How many consecutive half-hours is the aircraft free from this slot?
    let acFreeSlots = requestedDur
    if (activeAircraftId) {
      acFreeSlots = 0
      for (let h = 0; h < requestedDur; h++) {
        const si = si0 + h
        if (si >= HALF_HOUR_SLOTS.length) break
        if (slotOccupied(allBookings, dayIdx, HALF_HOUR_SLOTS[si], 'aircraftId', activeAircraftId)) break
        acFreeSlots++
      }
      if (acFreeSlots === 0) return { free: false, cfis: [], reason: 'aircraft', effectiveDur: 0 }
    }

    // Find CFIs free for at least 1 half-hour from this slot (up to acFreeSlots)
    // Also check W&B: if a specific CFI + student exceeds aircraft max gross, exclude that CFI
    const maxDur = acFreeSlots
    const studentW = user.weightLbs || 170
    if (acMode === 'ground' || acMode === 'own' || (acMode === 'fleet' && selectedAircraft)) {
      const targets = (selectedCfi === 'preferred' ? cfiList.filter((c) => preferredCfis.includes(c.id))
        : selectedCfi ? cfiList.filter((c) => c.id === selectedCfi)
        : cfiList
      ).filter((c) => cfiQualifiedForSession(c, activeSession)) // filter by lesson requirements (CFII/MEI/stage check)
      const available = []
      for (const cfi of targets) {
        // W&B check per-CFI when aircraft is selected
        if (activeAircraftId && selectedAircraft?.weightBalance && flightMode !== 'solo') {
          const wb = selectedAircraft.weightBalance
          const occupants = studentW + (cfi.weightLbs || 170)
          const fuelLbs = Math.round(Math.min((durationHrs + 0.5) * (selectedAircraft.fuelBurnGalHr || 8), selectedAircraft.fuelCapacityGal || 50) * (wb.fuelWeightPerGal || 6))
          const total = wb.emptyWeightLbs + occupants + fuelLbs
          if (total > wb.maxGrossLbs) continue // this CFI is too heavy for this aircraft
        }
        let cfiFree = 0
        for (let h = 0; h < maxDur; h++) {
          const si = si0 + h
          if (si >= HALF_HOUR_SLOTS.length) break
          if (slotOccupied(allBookings, dayIdx, HALF_HOUR_SLOTS[si], 'cfiId', cfi.id)) break
          cfiFree++
        }
        if (cfiFree > 0) available.push({ ...cfi, _freeSlots: cfiFree })
      }
      available.sort((a, b) => (preferredCfis.includes(a.id) ? 0 : 1) - (preferredCfis.includes(b.id) ? 0 : 1))
      const bestDur = available.length > 0 ? Math.max(...available.map((c) => c._freeSlots)) : maxDur
      const canSolo = (acMode === 'fleet' && isSolo) || (acMode === 'fleet' && !sessionType && flightMode === 'solo')
      return { free: true, cfis: available, soloOk: canSolo, effectiveDur: Math.min(bestDur, maxDur) }
    }
    return { free: true, cfis: [], soloOk: isSolo && acMode === 'fleet', effectiveDur: maxDur }
  }, [activeAircraftId, allBookings, cfiList, durationHalfHours, selectedCfi, preferredCfis, acMode, sessionType, selectedAircraft])

  const isSolo = flightMode === 'solo' || session?.solo
  const activeSession = CFI_SESSION_TYPES.find((s) => s.id === sessionType)

  // Auto-pick cheapest green aircraft from student's preferred list, then fleet
  const getAutoPick = useCallback(() => {
    if (selectedAircraft || acMode === 'ground' || acMode === 'own') return null
    const sw = user.weightLbs || 170
    const weightPool = selectedCfi === 'preferred' && preferredCfis.length > 0
      ? cfiList.filter((c) => preferredCfis.includes(c.id))
      : selectedCfi && selectedCfi !== 'preferred'
        ? cfiList.filter((c) => c.id === selectedCfi)
        : cfiList
    const cw = Math.min(...weightPool.map((c) => c.weightLbs || 170))
    const prefTails = user.aircraft || []
    const scored = fleet
      .filter((ac) => ac.airworthy && ac.fboCategory !== 'sim')
      .map((ac) => {
        const wb = ac.weightBalance
        if (!wb?.maxGrossLbs || !wb?.emptyWeightLbs) return { ac, ok: true, margin: 999, rate: ac.rentalRates?.member || 999 }
        const occ = flightMode === 'solo' ? sw : sw + cw
        const fuelLbs = Math.round(Math.min((durationHrs + 0.5) * (ac.fuelBurnGalHr || 8), ac.fuelCapacityGal || 50) * (wb.fuelWeightPerGal || 6))
        const margin = wb.maxGrossLbs - wb.emptyWeightLbs - occ - fuelLbs
        return { ac, ok: margin >= 0, margin, rate: ac.rentalRates?.member || 999 }
      })
      .filter((s) => s.ok)
      .sort((a, b) => {
        const aP = prefTails.includes(a.ac.tailNumber) ? 0 : 1
        const bP = prefTails.includes(b.ac.tailNumber) ? 0 : 1
        if (aP !== bP) return aP - bP
        return a.rate - b.rate
      })
    return scored[0]?.ac || null
  }, [selectedAircraft, acMode, fleet, cfiList, user, flightMode, durationHrs])

  const buildLabel = (cfiId) => {
    const cfi = cfiList.find((c) => c.id === cfiId)
    const parts = []
    const autoAc = getAutoPick()
    if (selectedAircraft) parts.push(selectedAircraft.tailNumber)
    else if (acMode === 'own' && ownTail) parts.push(ownTail)
    else if (acMode === 'ground') parts.push('Ground')
    else if (autoAc) parts.push(autoAc.tailNumber)
    if (session) parts.push(session.label)
    if (isSolo && !cfiId) parts.push('Solo')
    else if (!session && cfiId) parts.push('Dual')
    else if (!session && !cfiId) parts.push('Solo')
    if (cfi) parts.push(`w/ ${cfi.name}`)
    return parts.join(' — ')
  }

  const handleBook = (dayIdx, slot, cfiId, effectiveDur) => {
    // Use effective duration if available (shorter when blocked), else requested
    const actualHalfHours = effectiveDur || durationHalfHours
    const actualHrs = actualHalfHours / 2
    // Auto-pick aircraft if none selected
    const bookAircraft = selectedAircraft || (acMode === 'fleet' ? getAutoPick() : null)
    const bookAircraftId = bookAircraft?.id || null
    const bookAircraftLabel = bookAircraft?.tailNumber || (acMode === 'own' ? ownTail : acMode === 'ground' ? 'Ground' : null)
    const label = buildLabel(cfiId)
    const booking = {
      id: `bk-ja-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dayIdx, slot, duration: actualHrs, weekOffset,
      cfiId: cfiId || null,
      aircraftId: bookAircraftId,
      aircraftLabel: bookAircraftLabel,
      type: sessionType || (acMode === 'ground' ? 'ground' : (isSolo && !cfiId) ? 'solo' : 'dual_lesson'),
      flightMode: isSolo ? 'solo' : 'dual',
      title: label,
      studentId: user.id,
      notes: '',
      standby: acMode === 'fleet' && selectedAircraft && !selectedAircraft.airworthy,
      xcRoute: session?.xc ? normalizeRoute(xcRoute) : null,
      xcFuelGal: session?.xc ? (xcFuelGal || (selectedAircraft?.fuelCapacityGal ?? 'Full')) : null,
    }
    setBookings((prev) => [...prev, booking])

    // Publish to the shared flight store if this booking has an aircraft
    const ac = bookAircraft || (acMode === 'own' && ownTail ? { tailNumber: ownTail, makeModel: ownedAircraft.find((a) => a.tail === ownTail)?.type || ownTail } : null)
    const tail = ac?.tailNumber || bookAircraftLabel
    const hasFlight = tail && tail !== 'Ground' && tail !== 'GND'
    if (hasFlight) {
      const cfi = cfiId ? cfiList.find((c) => c.id === cfiId) : null
      // Build a departure time from dayIdx + slot
      // Compute real date from schedule dayIdx relative to current week's Monday
      const now = new Date()
      const todayDow = now.getDay() // 0=Sun..6=Sat
      const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow
      const baseDate = new Date(now)
      baseDate.setDate(now.getDate() + mondayOffset + weekOffset * 7 + dayIdx)
      const [hh, mm] = slot.split(':').map(Number)
      baseDate.setHours(hh, mm, 0, 0)

      const flightRecord = {
        id: `flt-ja-${booking.id}`,
        callsign: tail,
        tailNumber: tail,
        aircraftType: ac?.icaoType || ac?.makeModel || '',
        departure: 'KBDU',
        arrival: booking.xcRoute ? normalizeRoute(booking.xcRoute).split('→').map((s) => s.trim()).pop() || 'KBDU' : 'KBDU',
        waypoints: booking.xcRoute ? normalizeRoute(booking.xcRoute).split('→').map((s) => s.trim()) : [],
        plannedDepartureUtc: baseDate.toISOString(),
        status: 'planned',
        pic: cfi ? cfi.name : user.name,
        picId: cfi ? cfi.id : user.id,
        sic: cfi ? user.name : null,
        sicId: cfi ? user.id : null,
        passengers: 0,
        missionType: booking.type === 'solo' ? 'training_solo' : booking.type === 'dual_lesson' ? 'training_dual' : booking.type,
        part: '61',
        operator: 'journeys',
        riskScore: null,
        riskP: null, riskA: null, riskV: null, riskE: null,
        riskSnapshot: null,
        _source: 'journeys_portal',
        _bookingId: booking.id,
        _duration: actualHrs,
        _sessionLabel: label,
      }
      addFlight(flightRecord)
    }

    setToast(`✓ ${label} — ${SCHEDULE_DAYS[dayIdx]} ${slot}`)
    setTimeout(() => setToast(null), 3500)
  }

  const updateBooking = (id, updates) => setBookings((prev) => prev.map((b) => b.id === id ? { ...b, ...updates } : b))
  const removeBooking = (id) => {
    // Cancel corresponding flight in shared store
    updateStoreFlight(`flt-ja-${id}`, { status: 'cancelled' })
    setBookings((prev) => prev.filter((b) => b.id !== id))
    setEditingBooking(null)
  }

  const userExisting = mockBookings.filter((b) => b.studentId === user.id || (user.personnelId && b.cfiId === user.personnelId))

  return (
    <section id="sec-schedule" className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-b from-blue-950/50 via-surface to-surface">
      <div className="max-w-6xl mx-auto">
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-xl text-base font-medium animate-[fadeIn_0.3s_ease]">
            {toast}
          </div>
        )}

        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Schedule</h2>
          <p className="text-slate-400 text-base sm:text-lg">Book lessons, check flights, currency, and ground school</p>
        </div>

        {/* ═══ CASCADING FUNNEL: Mode → CFI → Lesson → Aircraft → Calendar ═══ */}

        {/* ── Step 1: Dual / Solo / Ground ── */}
        {(() => {
          const studentData = mockStudents.find((s) => s.name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())) || mockStudents[1]
          const canSolo = studentData?.hours?.soloPIC > 0
          const programKey = user.program || (user.cert === 'student' ? 'private_pilot' : (user.ratings?.includes('instrument') ? 'instrument_rating' : 'private_pilot'))
          const templates = LESSON_TEMPLATES[programKey] || {}
          const allLessons = Object.entries(templates).flatMap(([stage, lessons]) => lessons.map((l) => ({ ...l, stage: Number(stage) })))
          const dualLessons = allLessons.filter((l) => l.type === 'dual_lesson')
          const soloLessons = allLessons.filter((l) => l.type === 'solo')
          const groundLessons = allLessons.filter((l) => l.type === 'ground')
          const currentStage = studentData?.currentStage || 1

          // Selected CFI object
          const selCfi = selectedCfi && selectedCfi !== 'preferred' ? cfiList.find((c) => c.id === selectedCfi) : null
          const prefCfiList = cfiList.filter((c) => preferredCfis.includes(c.id))
          // Weight: use specific CFI weight, or lightest from preferred list, or lightest from all
          const cfiWeight = selCfi?.weightLbs
            || (selectedCfi === 'preferred' && prefCfiList.length > 0 ? Math.min(...prefCfiList.map((c) => c.weightLbs || 170)) : null)
            || Math.min(...cfiList.map((c) => c.weightLbs || 170))
          const studentWeight = user.weightLbs || 170

          // Lesson template for current selection
          const lessonTemplate = sessionType ? allLessons.find((l) => l.id === sessionType) : null
          const lessonDur = lessonTemplate?.durationHr || durationHrs
          const isXc = lessonTemplate?.title?.includes('XC') || lessonTemplate?.title?.includes('Cross-Country')
          const fuelHoursNeeded = lessonDur + (isXc ? 0.75 : 0.5)

          // CFI capabilities affect which lessons are grayed
          const cfiHasCfii = selCfi ? (selCfi.cfiRatings || []).includes('CFII') : true // if no CFI selected, don't gray
          const cfiHasMei = selCfi ? (selCfi.cfiRatings || []).includes('MEI') : true

          // Score aircraft
          const statusOrder = { green: 0, yellow: 1, red: 2, unqualified: 3 }
          const scoredAircraft = fleet.map((ac) => {
            const wb = ac.weightBalance; const rates = ac.rentalRates || {}
            if (!ac.airworthy) return { ac, status: 'red', reason: 'Not airworthy', rate: rates.member || 999, stars: stars[ac.tailNumber] || 0 }
            if (ac.fboCategory === 'sim') return { ac, status: 'unqualified', reason: 'Sim', rate: rates.member || 999, stars: 0 }
            // Capability gray-out based on selected lesson
            if (lessonTemplate?.requiresIfrAircraft && !ac.equipment?.ifrCertified) return { ac, status: 'unqualified', reason: 'Not IFR', rate: rates.member || 999, stars: stars[ac.tailNumber] || 0 }
            if (lessonTemplate?.requiresComplex && !ac.riskProfile?.complexAircraft) return { ac, status: 'unqualified', reason: 'Not complex', rate: rates.member || 999, stars: stars[ac.tailNumber] || 0 }
            if (lessonTemplate?.requiresMulti && !ac.riskProfile?.multiEngine) return { ac, status: 'unqualified', reason: 'Not multi', rate: rates.member || 999, stars: stars[ac.tailNumber] || 0 }
            if (!wb?.maxGrossLbs || !wb?.emptyWeightLbs) return { ac, status: 'yellow', reason: 'No W&B', rate: rates.member || 999, stars: stars[ac.tailNumber] || 0 }
            const occ = flightMode === 'solo' ? studentWeight : studentWeight + cfiWeight
            const fuelLbs = Math.round(Math.min(fuelHoursNeeded * (ac.fuelBurnGalHr || 8), ac.fuelCapacityGal || 50) * (wb.fuelWeightPerGal || 6))
            const margin = wb.maxGrossLbs - wb.emptyWeightLbs - occ - fuelLbs
            if (margin < 0) return { ac, status: 'red', reason: `Over ${Math.abs(margin)}`, rate: rates.member || 999, margin, stars: stars[ac.tailNumber] || 0 }
            if (margin < 50) return { ac, status: 'yellow', reason: `${margin} lbs`, rate: rates.member || 999, margin, stars: stars[ac.tailNumber] || 0 }
            return { ac, status: 'green', reason: `+${margin}`, rate: rates.member || 999, margin, stars: stars[ac.tailNumber] || 0 }
          })
          // Sort: starred first (3★ > 2★ > 1★), then green/yellow/red, then cheapest
          const sorted = [...scoredAircraft].sort((a, b) => (b.stars - a.stars) || statusOrder[a.status] - statusOrder[b.status] || a.rate - b.rate)
          const qualified = sorted.filter((s) => s.status !== 'unqualified')
          const unqualified = sorted.filter((s) => s.status === 'unqualified')
          const autoPick = qualified.find((s) => s.status === 'green') || qualified.find((s) => s.status === 'yellow')

          // Checkride/currency tab shows special session types, not syllabus lessons
          const checkrideSessions = [
            { id: 'stage-check', title: 'Stage Check', type: 'dual_lesson', durationHr: 2, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, requiresStageCheckAuth: true, stage: 0, desc: 'Progress evaluation by chief/senior CFI' },
            { id: 'checkride-prep', title: 'Checkride Prep (Flight)', type: 'dual_lesson', durationHr: 2, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, stage: 0, desc: 'Mock practical — maneuvers + procedures' },
            { id: 'mock-oral', title: 'Mock Oral Exam', type: 'ground', durationHr: 2, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, stage: 0, desc: 'Simulated oral with your CFI' },
            { id: 'proficiency', title: 'Proficiency Flight', type: 'dual_lesson', durationHr: 1.5, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, stage: 0, desc: 'Sharpen skills — maneuvers, landings, emergencies' },
            { id: 'currency-day', title: 'Day Currency', type: 'dual_lesson', durationHr: 1, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, stage: 0, desc: '3 T&Ls to stay current as PIC with passengers' },
            { id: 'currency-night', title: 'Night Currency', type: 'dual_lesson', durationHr: 1.5, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, stage: 0, desc: '3 night T&Ls to full stop — required every 90 days' },
            { id: 'ipc-check', title: 'Instrument Proficiency Check', type: 'dual_lesson', durationHr: 2, requiresCfii: true, requiresIfrAircraft: true, requiresComplex: false, requiresMulti: false, stage: 0, desc: 'IPC — approaches, holds, partial panel with CFII' },
            { id: 'bfr-check', title: 'Flight Review (BFR)', type: 'dual_lesson', durationHr: 2, requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, stage: 0, desc: '1 hr ground + 1 hr flight — required every 24 months' },
          ]
          const tabLessons = flightMode === 'solo' ? soloLessons : flightMode === 'ground' ? groundLessons : flightMode === 'checkride' ? checkrideSessions : dualLessons

          return (
            <>
              {/* ── Step 1: Dual / Solo / Ground / Checkride ── */}
              <div className="flex gap-1 mb-5 bg-surface-card border border-surface-border rounded-xl p-1">
                {[
                  { id: 'dual', label: '👨‍✈️ Dual', desc: 'With CFI' },
                  { id: 'solo', label: '🧑‍✈️ Solo', desc: 'Endorsed' },
                  { id: 'ground', label: '📚 Ground', desc: 'No aircraft' },
                  { id: 'checkride', label: '✅ Check', desc: 'Eval / Currency' },
                ].map((t) => (
                  <button key={t.id} onClick={() => { setFlightMode(t.id); setSessionType(''); if (t.id === 'ground') setAcMode('ground'); else setAcMode('fleet') }}
                    className={`flex-1 py-3 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      flightMode === t.id ? (t.id === 'solo' ? 'bg-amber-500/20 text-amber-400' : t.id === 'ground' ? 'bg-purple-500/20 text-purple-400' : t.id === 'checkride' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400') : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {t.label}
                    <div className="text-[10px] font-normal opacity-60">{t.desc}</div>
                  </button>
                ))}
              </div>

              {flightMode === 'solo' && !canSolo && (
                <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 mb-4 text-amber-400 text-xs">⏳ Pre-solo — complete Stage 3 first.</div>
              )}

              {/* ── Step 2: CFI (grayed if solo, shown for dual + ground) ── */}
              {(flightMode === 'dual' || flightMode === 'ground' || flightMode === 'checkride') && (
                <div className="mb-5">
                  <label className="text-slate-400 text-xs block mb-2">
                    Instructor
                    {selectedCfi === 'preferred' && <span className="text-sky-400 ml-1">— Preferred ({prefCfiList.length} · lightest {Math.min(...prefCfiList.map((c) => c.weightLbs || 170))} lbs)</span>}
                    {selCfi && <span className="text-sky-400 ml-1">— {selCfi.name} ({selCfi.weightLbs} lbs)</span>}
                  </label>
                  <select value={selectedCfi} onChange={(e) => setSelectedCfi(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                    {preferredCfis.length > 0 && (
                      <option value="preferred">★ Preferred CFIs ({prefCfiList.map((c) => c.name.split(' ')[0]).join(', ')})</option>
                    )}
                    <option value="">Any CFI</option>
                    {preferredCfis.length > 0 && <optgroup label="Specific Preferred">
                      {prefCfiList.map((c) => (
                        <option key={c.id} value={c.id}>★ {c.name} — {c.weightLbs} lbs — {(c.cfiRatings || []).join(', ')}</option>
                      ))}
                    </optgroup>}
                    <optgroup label="All Instructors">
                      {cfiList.filter((c) => !preferredCfis.includes(c.id)).map((c) => (
                        <option key={c.id} value={c.id}>{c.name} — {c.weightLbs} lbs — {(c.cfiRatings || []).join(', ')}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* ── Step 3: Lesson ── */}
              <div className="mb-5">
                <label className="text-slate-400 text-xs block mb-2">
                  {flightMode === 'checkride' ? 'Evaluation / Currency' : 'Lesson'}
                </label>
                <div className="space-y-1">
                  {tabLessons.map((lesson) => {
                    const hasSyllabus = lesson.stage > 0
                    const done = hasSyllabus && lesson.stage < currentStage
                    const isCurrent = hasSyllabus && lesson.stage === currentStage
                    const selected = sessionType === lesson.id
                    const needsCfii = lesson.requiresCfii && !cfiHasCfii
                    const needsMei = lesson.requiresMulti && !cfiHasMei
                    const grayed = needsCfii || needsMei

                    return (
                      <button key={lesson.id} disabled={grayed} onClick={() => {
                          setSessionType(lesson.id)
                          setDurationHalfHours(Math.round(lesson.durationHr * 2))
                          if (flightMode !== 'solo') { const best = bestCfiForSession(lesson, cfiList, preferredCfis); if (best && (!selectedCfi || selectedCfi === 'preferred')) setSelectedCfi(best) }
                          if (lesson.type === 'ground') setAcMode('ground')
                          else if (acMode === 'ground') setAcMode('fleet')
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${
                          grayed ? 'opacity-30 cursor-not-allowed border-surface-border'
                          : selected ? 'bg-sky-500/15 border-sky-400 ring-1 ring-sky-400/20'
                          : done ? 'bg-green-400/5 border-green-400/15 opacity-60'
                          : isCurrent ? 'bg-surface-card border-sky-400/20'
                          : 'bg-surface border-surface-border hover:border-slate-500'
                        }`}>
                        {hasSyllabus ? (
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            done ? 'bg-green-400/20 text-green-400' : isCurrent ? 'bg-sky-400/20 text-sky-400' : 'bg-surface border border-surface-border text-slate-600'
                          }`}>{done ? '✓' : lesson.stage}</span>
                        ) : (
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                            selected ? 'bg-emerald-400/20 text-emerald-400' : 'bg-surface border border-surface-border text-slate-500'
                          }`}>{lesson.type === 'ground' ? '📚' : '✅'}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold truncate ${done ? 'text-green-400/80' : selected ? 'text-sky-400' : 'text-slate-200'}`}>{lesson.title}</div>
                          <div className="text-[10px] text-slate-500">
                            {lesson.durationHr} hr
                            {lesson.requiresCfii ? ' · CFII' : ''}
                            {lesson.requiresIfrAircraft ? ' · IFR ac' : ''}
                            {lesson.requiresComplex ? ' · Complex' : ''}
                            {lesson.requiresStageCheckAuth ? ' · Chief/Senior CFI' : ''}
                            {lesson.desc ? ` — ${lesson.desc}` : ''}
                          </div>
                        </div>
                        {done && <span className="text-green-400/60 text-[10px]">Done</span>}
                        {grayed && <span className="text-red-400/60 text-[10px]">{needsCfii ? 'Needs CFII' : 'Needs MEI'}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Step 4: Aircraft (starred first, color-coded, grayed if incompatible) ── */}
              {flightMode !== 'ground' && (
                <div className="mb-5">
                  <label className="text-slate-400 text-xs block mb-2">
                    Aircraft <span className="text-slate-600 text-[10px]">({studentWeight}{flightMode !== 'solo' ? `+${cfiWeight}` : ''} lbs · {lessonDur}hr fuel)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* Own aircraft — show registered, or add new */}
                    {ownedAircraft.map((a) => (
                      <button key={a.tail} onClick={() => { setAcMode('own'); setOwnTail(a.tail); onClearAircraft?.() }}
                        className={`px-3 py-2 rounded-xl text-xs transition-all border ${acMode === 'own' && ownTail === a.tail ? 'ring-2 ring-purple-400 bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-surface border-surface-border text-slate-400 hover:border-purple-400/30'}`}>
                        <div className="font-semibold">🛩️ {a.tail}</div>
                        <div className="text-[10px] opacity-70">{a.type}</div>
                      </button>
                    ))}
                    <button onClick={() => { setAcMode('own'); setOwnTail(''); onClearAircraft?.() }}
                      className={`px-3 py-2 rounded-xl text-xs transition-all border ${acMode === 'own' && !ownTail ? 'ring-2 ring-purple-400 bg-purple-500/20 border-purple-400 text-purple-300' : 'bg-surface border-dashed border-purple-400/30 text-purple-400/60 hover:border-purple-400/50'}`}>
                      <div className="font-semibold">+ Own Aircraft</div>
                    </button>

                    {/* Fleet aircraft */}
                    {qualified.map(({ ac, status, reason, rate, stars: s }) => {
                      const isSelected = selectedAircraft?.id === ac.id
                      const colorMap = { green: 'bg-green-400/10 border-green-400/25 text-green-400', yellow: 'bg-amber-400/10 border-amber-400/25 text-amber-400', red: 'bg-red-400/10 border-red-400/25 text-red-400' }
                      return (
                        <button key={ac.id} onClick={() => { setAcMode('fleet'); onSelectAircraft?.(ac) }}
                          className={`px-3 py-2 rounded-xl text-xs transition-all border ${isSelected ? 'ring-2 ring-sky-400 bg-sky-500/20 border-sky-400 text-sky-300' : colorMap[status]}`}>
                          <div className="font-semibold flex items-center gap-1">
                            {s > 0 && <span className="text-amber-400 text-[9px]">{'★'.repeat(s)}</span>}
                            {ac.tailNumber}
                          </div>
                          <div className="text-[10px] opacity-70">${rate}/hr · {reason}</div>
                        </button>
                      )
                    })}
                    {/* Grayed unqualified */}
                    {unqualified.map(({ ac, reason, rate, stars: s }) => (
                      <div key={ac.id} className="px-3 py-2 rounded-xl text-xs border border-surface-border opacity-25 cursor-not-allowed">
                        <div className="font-semibold text-slate-500">{s > 0 && <span className="text-amber-400/50 text-[9px]">{'★'.repeat(s)}</span>} {ac.tailNumber}</div>
                        <div className="text-[10px] text-slate-600">{reason}</div>
                      </div>
                    ))}
                  </div>

                  {/* Own aircraft registration form */}
                  {acMode === 'own' && !ownTail && (
                    <div className="mt-3 bg-purple-400/5 border border-purple-400/20 rounded-xl p-4 space-y-3">
                      <div className="text-purple-400 text-xs font-semibold">Register Aircraft</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-purple-400/70 text-[10px]">Tail Number</label>
                          <input type="text" placeholder="N12345" value={newOwnTail} onChange={(e) => setNewOwnTail(e.target.value.toUpperCase())}
                            className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-purple-400 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-purple-400/70 text-[10px]">Type</label>
                          <input type="text" placeholder="Cessna 172" value={newOwnType} onChange={(e) => setNewOwnType(e.target.value)}
                            className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-purple-400 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-purple-400/70 text-[10px]">Fuel Type</label>
                          <select value={newOwnFuel} onChange={(e) => setNewOwnFuel(e.target.value)}
                            className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-purple-400 focus:outline-none">
                            <option value="100LL">100LL</option>
                            <option value="Jet-A">Jet-A</option>
                            <option value="Jet-A+Prist">Jet-A + Prist</option>
                            <option value="MoGas">MoGas</option>
                            <option value="UL94">UL94</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-purple-400/70 text-[10px] block mb-1">Default Services (quick-order)</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: 'fuel', label: '⛽ Top-off fuel', default: true },
                            { id: 'tiedown', label: '🔗 Tie-down' },
                            { id: 'hangar', label: '🏠 Hangar' },
                            { id: 'preheat', label: '🔥 Preheat' },
                            { id: 'lavatory', label: '🚻 Lavatory' },
                            { id: 'oxygen', label: '💨 O₂ service' },
                            { id: 'deice', label: '❄️ De-ice' },
                            { id: 'gpu', label: '🔌 GPU' },
                            { id: 'cleaning', label: '🧽 Cleaning' },
                            { id: 'catering', label: '🍽️ Catering' },
                            { id: 'transport', label: '🚗 Transport' },
                          ].map((svc) => (
                            <button key={svc.id} type="button"
                              onClick={() => setNewOwnServices((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                              className={`px-2 py-1 rounded text-[10px] transition-all border ${
                                newOwnServices[svc.id] || svc.default ? 'bg-purple-400/20 border-purple-400/40 text-purple-300' : 'bg-surface border-surface-border text-slate-500 hover:border-slate-400'
                              }`}>
                              {svc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button disabled={!newOwnTail.trim()} onClick={() => {
                          const tail = newOwnTail.trim()
                          const type = newOwnType.trim() || tail
                          const services = Object.keys(newOwnServices).filter((k) => newOwnServices[k])
                          const key = `journeys_owned_${user.id}`
                          const existing = JSON.parse(localStorage.getItem(key) || '[]')
                          if (!existing.some((a) => a.tail === tail)) {
                            existing.push({ tail, type, fuelType: newOwnFuel, defaultServices: services, agents: [user.name] })
                            localStorage.setItem(key, JSON.stringify(existing))
                            setExtraOwned(existing)
                          }
                          addServiceRequest({
                            id: `sr-own-${Date.now()}`, type: 'client_aircraft_registration',
                            tailNumber: tail, aircraftType: type,
                            requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0],
                            notes: `New: ${tail} (${type}). Fuel: ${newOwnFuel}. Services: ${services.join(', ') || 'none'}. Owner: ${user.name}.`,
                            status: 'requested', operator: 'journeys',
                          })
                          setOwnTail(tail)
                          setNewOwnTail(''); setNewOwnType(''); setNewOwnFuel('100LL'); setNewOwnServices({})
                        }}
                        className="w-full bg-purple-500 hover:bg-purple-400 disabled:bg-slate-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                        Register Aircraft
                      </button>
                    </div>
                  )}

                  {!selectedAircraft && acMode !== 'own' && autoPick && (
                    <p className="text-slate-600 text-[10px] mt-1">Auto: {autoPick.ac.tailNumber} ${autoPick.rate}/hr</p>
                  )}
                </div>
              )}

              {/* Duration adjuster */}
              <div className="flex items-center gap-4 mb-5">
                <span className="text-slate-500 text-xs">Duration:</span>
                <button onClick={() => adjustDuration(-1)} className="w-7 h-7 rounded-full bg-surface border border-surface-border text-slate-300 hover:text-white text-sm font-bold transition-all">−</button>
                <span className="text-white font-bold text-lg w-12 text-center">{durationHrs}<span className="text-slate-500 text-xs ml-0.5">hr</span></span>
                <button onClick={() => adjustDuration(1)} className="w-7 h-7 rounded-full bg-surface border border-surface-border text-slate-300 hover:text-white text-sm font-bold transition-all">+</button>
              </div>
            </>
          )
        })()}

        {/* ── XC fields (when cross-country selected) ── */}
        {session?.xc && (
          <div className="bg-surface-card border border-sky-400/20 rounded-2xl p-5 mb-6 sm:mb-8">
            <h4 className="text-white font-bold text-sm mb-3">Cross-Country Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Route</label>
                <input type="text" value={xcRoute} onChange={(e) => setXcRoute(e.target.value)}
                  onBlur={(e) => setXcRoute(normalizeRoute(e.target.value))}
                  placeholder="KBDU KCOS KPUB KBDU"
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-base text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
                <p className="text-slate-600 text-[10px] mt-1">Type airport codes separated by spaces or commas</p>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Fuel (gallons)</label>
                <input type="number" value={xcFuelGal} onChange={(e) => setXcFuelGal(e.target.value)}
                  placeholder={selectedAircraft ? `Full tanks (${selectedAircraft.fuelCapacityGal} gal)` : 'Full tanks'}
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-base text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
                <p className="text-slate-600 text-[10px] mt-1">Leave blank for full fuel · Enter gallons to depart with less</p>
              </div>
            </div>
            {session.solo && <p className="text-amber-400 text-xs mt-3">Solo XC — instructor endorsement required before departure</p>}
          </div>
        )}

        {/* ── Step 5: Calendar with week navigation ── */}
        {(() => {
          const ROW_H = 36
          const HEADER_H = 44
          const totalRows = HALF_HOUR_SLOTS.length
          const gridH = totalRows * ROW_H

          // Compute week days based on weekOffset
          const now = new Date()
          const todayDow = now.getDay()
          const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow
          const weekMonday = new Date(now)
          weekMonday.setDate(now.getDate() + mondayOffset + weekOffset * 7)
          const weekDays = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(weekMonday)
            d.setDate(weekMonday.getDate() + i)
            return { date: d, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) }
          })
          const todayDayIdx = weekOffset === 0 ? (todayDow === 0 ? -1 : todayDow - 1) : -1

          // Current time line (only for current week)
          const nowH = now.getHours()
          const nowM = now.getMinutes()
          const nowMinutes = nowH * 60 + nowM
          const gridStartMin = 7 * 60
          const gridEndMin = 17.5 * 60
          const nowPx = weekOffset === 0 && nowMinutes >= gridStartMin && nowMinutes <= gridEndMin
            ? ((nowMinutes - gridStartMin) / 30) * ROW_H : null

          return (
            <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
              <div className="min-w-[700px] px-4 sm:px-0">
                {/* Week navigation + day headers */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setWeekOffset((w) => w - 1)} className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded transition-colors">← Prev</button>
                  <div className="text-slate-300 text-xs font-semibold">
                    {weekDays[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[5].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {weekOffset === 0 && <span className="text-sky-400 ml-1">(This week)</span>}
                  </div>
                  <button onClick={() => setWeekOffset((w) => w + 1)} className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded transition-colors">Next →</button>
                </div>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: '60px repeat(6, 1fr)', height: HEADER_H }}>
                  <div />
                  {weekDays.map((d, i) => (
                    <div key={i} className={`flex items-center justify-center text-xs sm:text-sm font-semibold rounded-lg ${
                      i === todayDayIdx ? 'bg-sky-500/20 text-sky-300' : 'text-slate-300'
                    }`}>{d.label}{i === todayDayIdx ? ' ●' : ''}</div>
                  ))}
                </div>

                {/* Grid body */}
                <div className="grid gap-0.5" style={{ gridTemplateColumns: '60px repeat(6, 1fr)' }}>
                  {/* Time labels column */}
                  <div className="relative" style={{ height: gridH }}>
                    {/* Current time marker on time axis */}
                    {nowPx != null && (
                      <div className="absolute right-0 z-20 pointer-events-none" style={{ top: nowPx - 6 }}>
                        <div className="text-red-500 text-[9px] font-bold leading-none">NOW</div>
                      </div>
                    )}
                    {HALF_HOUR_SLOTS.map((slot) => {
                      const isHour = slot.endsWith(':00')
                      return (
                        <div key={slot} className={`flex items-center px-1 font-mono text-xs ${isHour ? 'text-slate-300 font-medium' : 'text-slate-600'}`}
                          style={{ height: ROW_H }}>
                          {slotLabel(slot)}
                        </div>
                      )
                    })}
                  </div>

                  {/* Day columns — each is relative so booking blocks can be absolutely positioned */}
                  {weekDays.map((_, dayIdx) => {
                    // Find bookings in this day column
                    const dayBookings = bookings.filter((b) => b.dayIdx === dayIdx && (b.weekOffset ?? 0) === weekOffset)
                    // mockBookings are always weekOffset 0
                    const mockDayBookings = weekOffset === 0 ? mockBookings.filter((b) => (b.dayIdx ?? b.day) === dayIdx) : []
                    const isToday = dayIdx === todayDayIdx

                    return (
                      <div key={dayIdx} className={`relative ${isToday ? 'bg-sky-400/[0.04]' : ''}`} style={{ height: gridH }}>
                        {/* Current time line */}
                        {isToday && nowPx != null && (
                          <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowPx }}>
                            <div className="h-0.5 bg-red-500 w-full" />
                            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                          </div>
                        )}
                        {/* Background grid cells (availability / bookable slots) */}
                        {HALF_HOUR_SLOTS.map((slot, si) => {
                          const isHour = slot.endsWith(':00')
                          // Is this half-hour cell underneath one of our booking blocks?
                          const covered = dayBookings.some((b) => {
                            const bsi = HALF_HOUR_SLOTS.indexOf(b.slot)
                            const bEnd = bsi + Math.round(b.duration * 2)
                            return si >= bsi && si < bEnd
                          })
                          // Skip rendering anything under our own blocks
                          if (covered) {
                            return (
                              <div key={slot} className={`absolute left-0 right-0 ${isHour ? 'border-t border-surface-border/30' : ''}`}
                                style={{ top: si * ROW_H, height: ROW_H }} />
                            )
                          }
                          const info = getSlotInfo(dayIdx, slot)
                          const preferred = info.cfis.find((c) => preferredCfis.includes(c.id))

                          return (
                            <div key={slot} className={`absolute left-0 right-0 px-0.5 flex items-center ${isHour ? 'border-t border-surface-border/30' : ''}`}
                              style={{ top: si * ROW_H, height: ROW_H }}>
                              {!info.free ? (
                                <div className="w-full h-[calc(100%-2px)] rounded-md text-center flex items-center justify-center text-[10px] bg-red-400/6 text-red-400/25">
                                  {info.reason === 'aircraft' ? '✗' : ''}
                                </div>
                              ) : info.cfis.length > 0 ? (
                                <button onClick={() => handleBook(dayIdx, slot, preferred?.id || info.cfis[0]?.id, info.effectiveDur)}
                                  title={`${info.cfis.map((c) => c.name).join(', ')} · ${info.effectiveDur / 2} hr avail`}
                                  className={`w-full h-[calc(100%-2px)] rounded-md transition-all cursor-pointer ${
                                    preferred ? 'bg-green-400/12 hover:bg-green-400/25 border border-green-400/20'
                                              : 'bg-sky-400/10 hover:bg-sky-400/20 border border-sky-400/15'
                                  }`} />
                              ) : info.soloOk ? (
                                <button onClick={() => handleBook(dayIdx, slot, null, info.effectiveDur)}
                                  title={`Solo · ${info.effectiveDur / 2} hr avail`}
                                  className="w-full h-[calc(100%-2px)] rounded-md transition-all cursor-pointer bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/15" />
                              ) : (
                                <div className="w-full h-[calc(100%-2px)] rounded-md flex items-center justify-center text-[10px] text-slate-800">·</div>
                              )}
                            </div>
                          )
                        })}

                        {/* Booking overlay blocks — absolutely positioned, spanning full duration */}
                        {dayBookings.map((bk) => {
                          const bsi = HALF_HOUR_SLOTS.indexOf(bk.slot)
                          if (bsi < 0) return null
                          const spanHalfHours = Math.round(bk.duration * 2)
                          const top = bsi * ROW_H
                          const height = spanHalfHours * ROW_H - 2
                          const cfi = cfiList.find((c) => c.id === bk.cfiId)
                          const sessionLabel = CFI_SESSION_TYPES.find((s) => s.id === bk.type)?.label
                          const isShort = spanHalfHours <= 2

                          const isStandby = bk.standby
                          const blockBg = isStandby ? 'bg-amber-500/20 border-2 border-amber-400/40' : 'bg-green-500/20 border-2 border-green-400/40'
                          const blockShadow = isStandby ? 'shadow-amber-900/20' : 'shadow-green-900/20'
                          const textPrimary = isStandby ? 'text-amber-200' : 'text-green-200'
                          const textSecondary = isStandby ? 'text-amber-300/80' : 'text-green-300/80'
                          const textTertiary = isStandby ? 'text-amber-400/60' : 'text-green-400/60'

                          return (
                            <button key={bk.id} onClick={() => setEditingBooking(bk.id)}
                              className={`absolute left-0.5 right-0.5 rounded-lg ${blockBg} text-left px-2.5 hover:brightness-125 transition-all z-10 overflow-hidden flex flex-col justify-center animate-[fadeIn_0.3s_ease] shadow-lg ${blockShadow}`}
                              style={{ top, height }}>
                              {isStandby && <div className="text-amber-400 text-[8px] font-bold uppercase tracking-wider">STANDBY</div>}
                              <div className={`${textPrimary} text-xs sm:text-sm font-bold leading-tight truncate`}>
                                {bk.aircraftLabel || 'GND'}
                              </div>
                              <div className={`${textSecondary} text-[10px] sm:text-xs leading-tight truncate`}>
                                {cfi ? cfi.name : 'SOLO'}
                              </div>
                              {!isShort && (
                                <>
                                  {sessionLabel && <div className={`${textTertiary} text-[9px] sm:text-[10px] leading-tight truncate`}>{sessionLabel}</div>}
                                  <div className={`${textTertiary} text-[8px] sm:text-[9px] mt-0.5`}>{slotLabel(bk.slot)} · {bk.duration} hr</div>
                                </>
                              )}
                            </button>
                          )
                        })}

                        {/* Proposed lesson blocks — breathing with skip/accept */}
                        {proposed.filter((rec) => {
                          if (!rec.slot) return false
                          if (skippedProposals.has(rec.template.id)) return false
                          const recDayIdx = rec.slot.dayIdx
                          const recWeek = recDayIdx >= 7 ? 1 : 0
                          const recGridDay = recDayIdx >= 7 ? recDayIdx - 7 : recDayIdx
                          if (recWeek !== weekOffset || recGridDay !== dayIdx) return false
                          const recSlotN = rec.slot?.slot?.includes(':') ? rec.slot.slot : `${rec.slot?.slot?.slice(0,2)}:${rec.slot?.slot?.slice(2) || '00'}`
                          return !dayBookings.some((b) => b.slot === recSlotN)
                        }).map((rec, ri) => {
                          const recSlot = rec.slot?.slot
                          const recSlotNorm = recSlot?.includes(':') ? recSlot : `${recSlot?.slice(0,2)}:${recSlot?.slice(2) || '00'}`
                          const rsi = HALF_HOUR_SLOTS.indexOf(recSlotNorm)
                          if (rsi < 0) return null
                          const spanH = Math.round((rec.template.durationHr || 1) * 2)
                          const top = rsi * ROW_H
                          const height = Math.max(spanH * ROW_H - 2, 60) // min height for buttons
                          return (
                            <div key={`prop-${ri}`}
                              className="absolute left-0.5 right-0.5 rounded-lg bg-sky-400/8 border border-dashed border-sky-400/30 text-left px-2 py-1 z-[5] animate-breathe overflow-hidden flex flex-col justify-between"
                              style={{ top, height }}>
                              <div>
                                <div className="text-sky-300/80 text-[10px] font-semibold truncate">{rec.template.title}</div>
                                <div className="text-sky-400/40 text-[8px]">{rec.cfi?.name?.split(' ')[0] || 'CFI'} · {rec.aircraft?.tailNumber || ''} · {rec.template.durationHr}hr</div>
                              </div>
                              <div className="flex gap-1 mt-0.5">
                                <button onClick={() => setSkippedProposals((s) => new Set([...s, rec.template.id]))}
                                  className="text-[8px] text-slate-500 hover:text-white bg-surface/80 border border-surface-border px-1.5 py-0.5 rounded transition-colors">Skip</button>
                                <button onClick={() => handleBook(dayIdx, recSlotNorm, rec.cfi?.id, spanH)}
                                  className="text-[8px] text-sky-400 hover:text-white bg-sky-400/15 border border-sky-400/25 px-1.5 py-0.5 rounded transition-colors font-medium">Accept</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 sm:gap-5 justify-center mb-8 text-[10px] sm:text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-400/20 border border-green-400/30" /> Preferred</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-400/15 border border-sky-400/15" /> CFI</span>
          {acMode === 'fleet' && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400/15 border border-amber-400/15" /> Solo</span>}
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400/10" /> Busy</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500/25 border border-green-400/30" /> Yours</span>
        </div>

        {/* ── Flight Log (IACRA categories) ── */}
        {(() => {
          // Gather all flights for this user from the store
          const allFlights = getAllFlights()
          const myFlights = allFlights.filter((f) =>
            (f.picId === user.id || f.sicId === user.id || f._source === 'journeys_portal') &&
            (f.operator === 'journeys' || f._source === 'journeys_portal')
          ).sort((a, b) => new Date(b.plannedDepartureUtc) - new Date(a.plannedDepartureUtc))

          if (myFlights.length === 0 && bookings.length === 0) return null

          // IACRA categories
          const categories = [
            { id: 'dual', label: 'Dual Received', filter: (f) => f.missionType === 'training_dual' || f.type === 'dual_lesson', icon: '👨‍✈️' },
            { id: 'solo', label: 'Solo / PIC', filter: (f) => f.missionType === 'training_solo' || f.type === 'solo', icon: '🧑‍✈️' },
            { id: 'xc', label: 'Cross-Country', filter: (f) => f.waypoints?.length > 1 || f._sessionLabel?.includes('XC') || f._sessionLabel?.includes('Cross'), icon: '🗺️' },
            { id: 'night', label: 'Night', filter: (f) => f._sessionLabel?.toLowerCase()?.includes('night'), icon: '🌙' },
            { id: 'instrument', label: 'Instrument', filter: (f) => f._sessionLabel?.toLowerCase()?.includes('instrument') || f._sessionLabel?.toLowerCase()?.includes('hood') || f._sessionLabel?.toLowerCase()?.includes('ifr'), icon: '☁️' },
            { id: 'ground', label: 'Ground Training', filter: (f) => f.missionType === 'ground' || f.type === 'ground', icon: '📚' },
          ]

          // Also include pending bookings as "scheduled"
          const pendingBookings = bookings.filter((b) => !myFlights.some((f) => f._bookingId === b.id))

          return (
            <div className="mt-8">
              <h3 className="text-white text-xl sm:text-2xl font-bold mb-4">Flight Log</h3>

              {/* Pending bookings (upcoming, not yet flown) */}
              {pendingBookings.length > 0 && (
                <div className="bg-sky-400/5 border border-sky-400/15 rounded-2xl p-4 mb-4">
                  <h4 className="text-sky-400 text-[10px] font-bold uppercase tracking-wide mb-2">Scheduled ({pendingBookings.length})</h4>
                  <div className="space-y-1">
                    {pendingBookings.map((b) => (
                      <button key={b.id} onClick={() => setEditingBooking(b.id)}
                        className="w-full flex items-center justify-between text-left bg-surface/30 rounded-lg px-3 py-2 hover:bg-surface/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-400" />
                          <span className="text-slate-200 text-xs">{b.title}</span>
                        </div>
                        <span className="text-slate-500 text-[10px]">{b.duration}hr</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* IACRA categories */}
              {categories.map((cat) => {
                const catFlights = myFlights.filter(cat.filter)
                if (catFlights.length === 0) return null
                const totalHrs = catFlights.reduce((sum, f) => sum + (f._duration || f._postFlight?.hobbsTime ? parseFloat(f._postFlight?.hobbsTime || f._duration || 0) : 0), 0)
                return (
                  <details key={cat.id} className="mb-2 group">
                    <summary className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl px-4 py-3 cursor-pointer hover:border-slate-500 transition-colors list-none">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-white text-sm font-semibold">{cat.label}</span>
                        <span className="text-slate-500 text-xs">({catFlights.length} flights)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sky-400 text-sm font-bold">{totalHrs.toFixed(1)} hr</span>
                        <span className="text-slate-600 text-xs group-open:rotate-90 transition-transform">▸</span>
                      </div>
                    </summary>
                    <div className="mt-1 ml-4 border-l-2 border-surface-border pl-3 space-y-1 pb-2">
                      {catFlights.map((f) => {
                        const dep = new Date(f.plannedDepartureUtc)
                        const pf = f._postFlight
                        const hrs = pf?.hobbsTime || f._duration || '—'
                        const rating = pf?.rating ? '★'.repeat(pf.rating) + '☆'.repeat(5 - pf.rating) : null
                        const acsCount = pf?.acsResults ? Object.values(pf.acsResults).filter(Boolean).length : 0
                        return (
                          <div key={f.id} className="bg-surface/30 rounded-lg px-3 py-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${f.status === 'closed' ? 'bg-green-400' : f.status === 'planned' ? 'bg-sky-400' : 'bg-slate-500'}`} />
                                <span className="text-slate-200 font-medium">{f._sessionLabel || f.tailNumber}</span>
                              </div>
                              <span className="text-slate-500">{dep.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                              <span>{f.tailNumber}</span>
                              {f.pic && <span>PIC: {f.pic}</span>}
                              <span className="text-sky-400 font-medium">{hrs} hr</span>
                              {pf?.tachStart && pf?.tachEnd && <span>Tach: {pf.tachStart}→{pf.tachEnd}</span>}
                              {acsCount > 0 && <span className="text-green-400">{acsCount} ACS ✓</span>}
                              {rating && <span className="text-amber-400">{rating}</span>}
                              {f.status === 'planned' && <span className="text-sky-400">Scheduled</span>}
                            </div>
                            {pf?.route && <div className="text-[10px] text-sky-400/60 mt-0.5">Route: {pf.route}</div>}
                            {pf?.flightNotes && <div className="text-[10px] text-slate-500 mt-0.5 italic">"{pf.flightNotes}"</div>}
                            {f.waypoints?.length > 1 && (
                              <div className="text-[10px] text-sky-400/60 mt-0.5">{f.waypoints.join(' → ')}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )
              })}
            </div>
          )
        })()}

        {/* ── Edit/Modify booking popup ── */}
        {editingBooking && (() => {
          const bk = bookings.find((b) => b.id === editingBooking)
          if (!bk) { setEditingBooking(null); return null }
          const cfi = cfiList.find((c) => c.id === bk.cfiId)
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingBooking(null)}>
              <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{bk.title}</h3>
                    <p className="text-slate-400 text-sm">{SCHEDULE_DAYS[bk.dayIdx]} {slotLabel(bk.slot)}</p>
                  </div>
                  <button onClick={() => setEditingBooking(null)} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
                </div>

                <div className="space-y-4">
                  {/* Summary */}
                  <div className="bg-surface border border-surface-border rounded-xl p-3 space-y-1 text-sm">
                    {bk.aircraftLabel && <div className="flex justify-between"><span className="text-slate-500">Aircraft</span><span className="text-slate-200">{bk.aircraftLabel}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-200 capitalize">{bk.type.replace(/_/g, ' ')}</span></div>
                    {cfi && <div className="flex justify-between"><span className="text-slate-500">Instructor</span><span className="text-sky-400">{cfi.name}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">When</span><span className="text-slate-200">{SCHEDULE_DAYS[bk.dayIdx]} {slotLabel(bk.slot)}</span></div>
                  </div>

                  {/* Duration adjuster */}
                  <div>
                    <label className="text-slate-400 text-xs block mb-2">Duration</label>
                    <div className="flex items-center gap-4">
                      <button onClick={() => updateBooking(bk.id, { duration: Math.max(0.5, bk.duration - 0.5) })}
                        className="w-10 h-10 rounded-full bg-surface border border-surface-border text-slate-300 hover:text-white hover:border-sky-400 text-lg font-bold transition-all">−</button>
                      <div className="text-white text-2xl font-bold w-16 text-center">{bk.duration} <span className="text-slate-500 text-sm">hr</span></div>
                      <button onClick={() => updateBooking(bk.id, { duration: Math.min(4, bk.duration + 0.5) })}
                        className="w-10 h-10 rounded-full bg-surface border border-surface-border text-slate-300 hover:text-white hover:border-sky-400 text-lg font-bold transition-all">+</button>
                    </div>
                  </div>

                  {/* XC fields (if cross-country booking) */}
                  {bk.xcRoute != null && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 text-xs block mb-1.5">Route</label>
                        <input type="text" value={bk.xcRoute || ''} onChange={(e) => updateBooking(bk.id, { xcRoute: e.target.value })}
                          onBlur={(e) => updateBooking(bk.id, { xcRoute: normalizeRoute(e.target.value) })}
                          placeholder="KBDU KCOS KBDU"
                          className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs block mb-1.5">Fuel (gal)</label>
                        <input type="number" value={bk.xcFuelGal || ''} placeholder="Full" onChange={(e) => updateBooking(bk.id, { xcFuelGal: e.target.value })}
                          className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-slate-400 text-xs block mb-1.5">Notes</label>
                    <textarea rows={2} value={bk.notes || ''} placeholder="Special requests, lesson focus, equipment needs..."
                      onChange={(e) => updateBooking(bk.id, { notes: e.target.value })}
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => removeBooking(bk.id)}
                      className="flex-1 border border-red-400/40 text-red-400 hover:bg-red-400/10 py-2.5 rounded-xl text-sm font-medium transition-colors">
                      Cancel Booking
                    </button>
                    <button onClick={() => setEditingBooking(null)}
                      className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </section>
  )
}

/* ─── TOP NAV ─── */
function TopNav({ onSection, user, onLoginClick, onLogout }) {
  const hasOwnAircraft = (user?.ownedAircraft?.length > 0) || (() => { try { return JSON.parse(localStorage.getItem(`journeys_owned_${user?.id}`) || '[]').length > 0 } catch { return false } })()
  const navItems = !user
    ? ['fleet', 'training', 'fbo', 'operations', 'gallery', 'about']
    : user.role === 'student'
      ? [...(hasOwnAircraft ? ['my-aircraft'] : []), 'schedule', 'fleet', 'operations']
      : user.role === 'mx_client'
        ? ['my-aircraft', 'fleet', 'fbo', 'operations', 'about']
        : user.role === 'cfi'
          ? ['schedule', 'fleet', 'operations']
          : [...(hasOwnAircraft ? ['my-aircraft'] : []), 'schedule', 'fleet', 'fbo', 'operations', 'about']

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight">Journeys Aviation</span>
          <div className="hidden md:flex items-center gap-4">
            {navItems.map((s) => {
              const labels = { 'my-aircraft': 'My Aircraft', fleet: 'Fleet', schedule: 'Schedule', training: 'Training', maintenance: 'Maintenance', fbo: 'FBO', operations: 'Ops', gallery: 'Gallery', about: 'About' }
              return (
                <button key={s} onClick={() => onSection(s)} className="text-white/70 hover:text-white text-xs uppercase tracking-wide transition-colors">{labels[s] || s}</button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={`tel:${JB_INFO.phone.replace(/[^\d]/g, '')}`} className="text-white/70 hover:text-white text-xs transition-colors hidden sm:block">
            {JB_INFO.phone}
          </a>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sky-300 text-xs hidden sm:block">{user.name}</span>
              <span className="text-slate-500 text-[10px] hidden lg:block">({user.label})</span>
              <button onClick={onLogout} className="text-white/60 hover:text-white text-xs underline">Sign out</button>
            </div>
          ) : (
            <button onClick={onLoginClick}
              className="bg-white/10 hover:bg-white/20 text-white text-xs px-4 py-1.5 rounded-lg border border-white/20 transition-all">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ─── HERO ─── */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center">
      {/* Cinematic sky gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-blue-950 to-indigo-950">
        {/* Animated cloud layers */}
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-[15%] left-[5%] w-64 h-20 bg-white/25 rounded-full blur-3xl animate-[drift_22s_linear_infinite]" />
          <div className="absolute top-[25%] left-[35%] w-80 h-24 bg-white/15 rounded-full blur-3xl animate-[drift_35s_linear_infinite_reverse]" />
          <div className="absolute top-[10%] right-[8%] w-48 h-16 bg-white/20 rounded-full blur-2xl animate-[drift_28s_linear_infinite]" />
          <div className="absolute top-[35%] left-[65%] w-56 h-18 bg-white/10 rounded-full blur-3xl animate-[drift_40s_linear_infinite_reverse]" />
        </div>
        {/* Mountain silhouette */}
        <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 1400 260" preserveAspectRatio="none">
          <path d="M0,260 L0,180 L80,140 L160,160 L260,80 L350,120 L440,50 L530,95 L600,30 L700,85 L780,55 L880,100 L960,40 L1050,80 L1140,60 L1240,110 L1320,75 L1400,120 L1400,260 Z" fill="rgba(15,23,42,0.5)" />
          <path d="M0,260 L0,200 L120,175 L240,195 L360,140 L480,170 L600,120 L720,155 L840,130 L960,160 L1080,140 L1200,170 L1320,150 L1400,175 L1400,260 Z" fill="rgba(15,23,42,0.8)" />
        </svg>
        {/* Stars */}
        <div className="absolute top-[5%] left-[18%] w-1 h-1 bg-white/40 rounded-full" />
        <div className="absolute top-[8%] left-[42%] w-0.5 h-0.5 bg-white/30 rounded-full" />
        <div className="absolute top-[3%] left-[67%] w-1 h-1 bg-white/25 rounded-full" />
        <div className="absolute top-[12%] left-[85%] w-0.5 h-0.5 bg-white/35 rounded-full" />
        <div className="absolute top-[6%] left-[55%] w-0.5 h-0.5 bg-white/20 rounded-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

      <div className="relative z-10 text-center px-6 max-w-3xl">
        <div className="text-sky-300/70 text-xs uppercase tracking-[0.4em] mb-3">Boulder Municipal Airport (KBDU) · Est. 2019</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight leading-[1.1]">
          Learn to Fly<br />at Boulder
        </h1>
        <p className="text-white/60 text-lg md:text-xl mb-8 max-w-xl mx-auto leading-relaxed">
          Flight school, aircraft rental, FBO services, and aircraft maintenance at the base of the Rocky Mountains.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href={`tel:${JB_INFO.phone.replace(/[^\d]/g, '')}`}
            className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-sky-500/25 hover:shadow-sky-400/30 hover:scale-105">
            Book a Discovery Flight
          </a>
          <a href={JB_INFO.website} target="_blank" rel="noopener noreferrer"
            className="border-2 border-white/30 hover:border-white/60 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all backdrop-blur-sm hover:bg-white/10">
            Visit Website ↗
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-6 justify-center text-white/50 text-xs">
          <span>✈️ 12 aircraft</span>
          <span>🏔️ Mountain flying</span>
          <span>🎓 All certificates & ratings</span>
          <span>⛽ 100LL & Jet-A</span>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/40">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      </div>
    </section>
  )
}

/* ─── FLEET W&B CALCULATOR ─── */

// Compute fuel weight for a given aircraft based on user's fuel mode
function computeFuelForAircraft(ac, fuelMode, fuelHours, fuelMiles) {
  const burn = ac.fuelBurnGalHr || 0
  const kts = ac.cruiseSpeedKts || 100
  const lbsPerGal = ac.weightBalance?.fuelWeightPerGal || 6
  const maxGal = ac.fuelCapacityGal || 0

  let gallonsNeeded = 0
  if (fuelMode === 'hours') {
    gallonsNeeded = (Number(fuelHours) || 0) * burn
  } else {
    // miles → nautical miles → hours → gallons
    const nm = (Number(fuelMiles) || 0) / 1.151
    const hours = nm / kts
    gallonsNeeded = hours * burn
  }
  // Add 45 min VFR reserve
  const reserve = burn * 0.75
  const totalGal = gallonsNeeded + reserve
  const cappedGal = Math.min(totalGal, maxGal)
  const fuelLbs = Math.round(cappedGal * lbsPerGal)
  const exceedsTanks = totalGal > maxGal

  return { gallonsNeeded: Math.round(gallonsNeeded * 10) / 10, reserveGal: Math.round(reserve * 10) / 10, totalGal: Math.round(totalGal * 10) / 10, cappedGal: Math.round(cappedGal * 10) / 10, fuelLbs, exceedsTanks, maxGal }
}

function evaluateAircraft(ac, frontLbs, aftLbs, fuelInfo) {
  const wb = ac.weightBalance || {}
  if (!wb.maxGrossLbs || !wb.emptyWeightLbs) return { status: 'unknown', msg: 'No W&B data' }
  const empty = wb.emptyWeightLbs
  const gross = wb.maxGrossLbs
  const totalWt = empty + frontLbs + aftLbs + fuelInfo.fuelLbs
  const margin = gross - totalWt
  const usefulLoad = gross - empty
  const stationIssues = []
  const stations = wb.stations || {}
  if (stations.frontSeats?.maxWeightLbs && frontLbs > stations.frontSeats.maxWeightLbs) stationIssues.push(`Front seats: ${frontLbs} > ${stations.frontSeats.maxWeightLbs} max`)
  if (stations.aftSeats?.maxWeightLbs && aftLbs > stations.aftSeats.maxWeightLbs) stationIssues.push(`Aft seats: ${aftLbs} > ${stations.aftSeats.maxWeightLbs} max`)

  if (fuelInfo.exceedsTanks) stationIssues.push(`Fuel needed ${fuelInfo.totalGal} gal > ${fuelInfo.maxGal} gal capacity`)

  if (margin < 0) return { status: 'over', msg: `${Math.abs(margin)} lbs over gross`, totalWt, margin, usefulLoad, stationIssues }
  if (margin < 50) return { status: 'tight', msg: `Only ${margin} lbs margin`, totalWt, margin, usefulLoad, stationIssues }
  if (stationIssues.length > 0) return { status: 'warn', msg: `${margin} lbs margin — see warnings`, totalWt, margin, usefulLoad, stationIssues }
  return { status: 'ok', msg: `${margin} lbs margin`, totalWt, margin, usefulLoad, stationIssues }
}

const EVAL_STYLE = {
  ok:      { ring: 'ring-green-400/40', bg: 'bg-green-400/8', border: 'border-green-400/30', badge: 'bg-green-400/20 text-green-400', label: '✓ Good' },
  tight:   { ring: 'ring-amber-400/40', bg: 'bg-amber-400/8', border: 'border-amber-400/30', badge: 'bg-amber-400/20 text-amber-400', label: '⚠ Tight' },
  warn:    { ring: 'ring-amber-400/40', bg: 'bg-amber-400/8', border: 'border-amber-400/30', badge: 'bg-amber-400/20 text-amber-400', label: '⚠ Check' },
  over:    { ring: 'ring-red-400/40',   bg: 'bg-red-400/8',   border: 'border-red-400/30',   badge: 'bg-red-400/20 text-red-400',     label: '✗ Over' },
  unknown: { ring: '',                  bg: 'bg-surface-card', border: 'border-surface-border', badge: 'bg-slate-400/20 text-slate-400', label: '—' },
}

// Aircraft star preference (persisted per user)
function useAircraftStars(userId) {
  const key = `journeys_stars_${userId}`
  const [stars, setStars] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } })
  const setStar = (tailNumber, rating) => {
    const next = { ...stars, [tailNumber]: rating }
    setStars(next)
    localStorage.setItem(key, JSON.stringify(next))
  }
  return [stars, setStar]
}

/* ─── MY FLEET (for owners — shows above Journeys fleet) ─── */
/* ─── SQUAWK PANEL (full-width, inline, mobile-friendly) ─── */
function SquawkPanel({ tailNumber, user, onClose }) {
  const [severity, setSeverity] = useState('monitoring')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const allSquawks = getSquawks()
  const recentSquawks = allSquawks.filter((s) => s.tailNumber === tailNumber).slice(0, 8)
  const openSquawks = recentSquawks.filter((s) => s.status !== 'closed')
  const closedSquawks = recentSquawks.filter((s) => s.status === 'closed').slice(0, 3)

  const handleSubmit = () => {
    if (!description.trim()) return
    addSquawk({
      id: `sqk-${Date.now()}`, tailNumber,
      reportedBy: user.name,
      reportedDate: new Date().toISOString().split('T')[0],
      reportedAt: new Date().toISOString(),
      description: description.trim(), severity, status: 'open',
      melReference: null, melExpiryDate: null, airframeHours: null,
      resolvedDate: null, resolvedBy: null, resolutionNotes: null, workOrderId: null,
    })
    setSubmitted(true)
    setTimeout(() => { setSubmitted(false); setDescription(''); setSeverity('monitoring') }, 2000)
  }

  return (
    <section id="sec-squawk" className="py-10 px-4 sm:px-6 bg-gradient-to-b from-amber-950/20 via-surface to-surface animate-[fadeIn_0.3s_ease]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">🔧 Squawk — {tailNumber}</h2>
            <p className="text-slate-400 text-sm">
              {(getAircraftByOperator('journeys').find((a) => a.tailNumber === tailNumber) || mockAircraft.find((a) => a.tailNumber === tailNumber))?.makeModel || 'Aircraft'}
              {' '}· Report an issue or review squawks
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none transition-colors">×</button>
        </div>

        {/* Recent squawks for this aircraft */}
        {openSquawks.length > 0 && (
          <div className="mb-6">
            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-2">Open ({openSquawks.length})</h3>
            <div className="space-y-1.5">
              {openSquawks.map((s) => (
                <div key={s.id} className={`flex items-start gap-3 text-sm rounded-xl px-4 py-3 border ${
                  s.severity === 'grounding' ? 'bg-red-400/8 border-red-400/20' : s.severity === 'ops_limiting' ? 'bg-amber-400/8 border-amber-400/20' : 'bg-surface border-surface-border'
                }`}>
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                    s.severity === 'grounding' ? 'bg-red-400' : s.severity === 'ops_limiting' ? 'bg-amber-400' : s.severity === 'deferred' ? 'bg-yellow-400' : 'bg-slate-400'
                  }`} />
                  <div className="flex-1">
                    <div className="text-slate-200">{s.description}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.reportedDate} · {s.severity} · {s.reportedBy}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {closedSquawks.length > 0 && (
          <details className="mb-6">
            <summary className="text-green-400/60 text-xs cursor-pointer mb-1">Recent resolved ({closedSquawks.length})</summary>
            {closedSquawks.map((s) => (
              <div key={s.id} className="text-xs text-slate-600 px-4 py-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                {s.description} — {s.resolvedDate || s.reportedDate}
              </div>
            ))}
          </details>
        )}

        {/* Submit form */}
        {submitted ? (
          <div className="bg-green-400/10 border border-green-400/20 rounded-2xl p-6 text-center animate-[fadeIn_0.3s_ease]">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-green-400 font-semibold">Squawk submitted for {tailNumber}</div>
            <div className="text-slate-500 text-xs mt-1">Maintenance will review within 24 hours</div>
          </div>
        ) : (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-bold text-base">New Squawk</h3>

            {/* Severity */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { v: 'grounding', l: 'Grounding', color: 'red' },
                { v: 'ops_limiting', l: 'Ops Limiting', color: 'amber' },
                { v: 'deferred', l: 'Deferred / MEL', color: 'yellow' },
                { v: 'monitoring', l: 'Monitoring', color: 'slate' },
              ].map((s) => (
                <button key={s.v} onClick={() => setSeverity(s.v)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all border ${
                    severity === s.v
                      ? `bg-${s.color}-400/20 border-${s.color}-400/40 text-${s.color}-400`
                      : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'
                  }`}>
                  {s.l}
                </button>
              ))}
            </div>

            {/* Description */}
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue — what did you observe? When? During what phase of flight?"
              className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-400 focus:outline-none resize-none" />

            {/* Submit */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">Reporting as {user.name}</span>
              <div className="flex gap-2">
                <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-4 py-2.5 rounded-xl border border-surface-border transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={!description.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors">
                  Submit Squawk
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function MyFleetSection({ user, onSquawk }) {
  const extraOwned = (() => { try { return JSON.parse(localStorage.getItem(`journeys_owned_${user?.id}`) || '[]') } catch { return [] } })()
  const owned = [...(user?.ownedAircraft || []), ...extraOwned.filter((a) => !(user?.ownedAircraft || []).some((o) => o.tail === a.tail))]
  if (owned.length === 0) return null
  const allSquawks = getSquawks()
  const allServiceReqs = getServiceRequests()

  return (
    <section id="sec-my-aircraft" className="py-12 px-6 bg-gradient-to-b from-purple-950/20 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">My Aircraft</h2>
          <p className="text-slate-400 text-sm">{owned.length} registered · Maintenance: {JB_INFO.maintenancePhone}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {owned.map((ac) => {
            const openSquawks = allSquawks.filter((s) => s.tailNumber === ac.tail && s.status !== 'closed')
            const closedSquawks = allSquawks.filter((s) => s.tailNumber === ac.tail && s.status === 'closed')
            const reqs = allServiceReqs.filter((r) => r.tailNumber === ac.tail)
            const scheduled = reqs.filter((r) => r.status === 'requested' || r.status === 'scheduled')
            const inProgress = reqs.filter((r) => ['in_progress', 'parts_on_order', 'diagnosis', 'awaiting_parts'].includes(r.status))
            const completed = reqs.filter((r) => r.status === 'completed')
            const hasGrounding = openSquawks.some((s) => s.severity === 'grounding')
            const totalItems = openSquawks.length + scheduled.length + inProgress.length

            return (
              <div key={ac.tail} className={`bg-surface-card border rounded-2xl p-5 ${hasGrounding ? 'border-red-400/30' : 'border-purple-400/20'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white text-lg font-bold">🛩️ {ac.tail}</div>
                    <div className="text-slate-400 text-xs">{ac.type}</div>
                    {ac.agents && <div className="text-slate-500 text-[10px] mt-0.5">{ac.agents.join(', ')}</div>}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    hasGrounding ? 'bg-red-400/20 text-red-400' : openSquawks.length > 0 ? 'bg-amber-400/20 text-amber-400' : 'bg-green-400/20 text-green-400'
                  }`}>
                    {hasGrounding ? 'GROUNDED' : openSquawks.length > 0 ? `${openSquawks.length} squawk${openSquawks.length > 1 ? 's' : ''}` : 'Clean'}
                  </span>
                </div>

                {/* Open squawks */}
                {openSquawks.map((s) => (
                  <details key={s.id} className={`rounded-lg mb-1 border ${s.severity === 'grounding' ? 'bg-red-400/8 border-red-400/20' : 'bg-amber-400/5 border-amber-400/15'}`}>
                    <summary className="flex items-start gap-2 text-xs px-3 py-2 cursor-pointer">
                      <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${s.severity === 'grounding' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <span className="text-slate-200 flex-1">{s.description}</span>
                      <span className={`text-[10px] font-medium ${s.severity === 'grounding' ? 'text-red-400' : 'text-amber-400'}`}>{s.severity}</span>
                    </summary>
                    <div className="px-3 pb-2 text-[10px] text-slate-500 space-y-0.5 ml-4">
                      <div>Reported: {s.reportedDate} by {s.reportedBy}</div>
                      {s.melReference && <div>MEL: {s.melReference} · Expires: {s.melExpiryDate || 'N/A'}</div>}
                      {s.workOrderId && <div>Work Order: {s.workOrderId}</div>}
                      {s.airframeHours && <div>Airframe hours: {s.airframeHours}</div>}
                    </div>
                  </details>
                ))}

                {/* Scheduled */}
                {scheduled.map((r) => (
                  <details key={r.id} className="rounded-lg mb-1 border bg-sky-400/5 border-sky-400/15">
                    <summary className="flex items-center gap-2 text-xs px-3 py-2 cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span className="text-slate-200 flex-1 capitalize">{r.type?.replace(/_/g, ' ')}</span>
                      <span className="text-sky-400 text-[10px]">{r.preferredDate || 'Requested'}</span>
                    </summary>
                    <div className="px-3 pb-2 text-[10px] text-slate-500 space-y-0.5 ml-4">
                      <div>Requested: {r.requestedDate} by {r.requestedBy}</div>
                      {r.description && <div>Details: {r.description}</div>}
                      {r.notes && <div>Notes: {r.notes}</div>}
                    </div>
                  </details>
                ))}

                {/* In-progress */}
                {inProgress.map((r) => (
                  <details key={r.id} className="rounded-lg mb-1 border bg-amber-400/5 border-amber-400/15">
                    <summary className="flex items-center justify-between text-xs px-3 py-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-slate-200 capitalize">{r.type?.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-amber-400 text-[10px] font-medium capitalize">{r.status?.replace(/_/g, ' ')}</span>
                    </summary>
                    <div className="px-3 pb-2 text-[10px] text-slate-500 space-y-0.5 ml-4">
                      <div>Requested: {r.requestedDate} by {r.requestedBy}</div>
                      {r.description && <div>Details: {r.description}</div>}
                      {r.notes && <div>Notes: {r.notes}</div>}
                      <div>Status: <span className="text-amber-400 capitalize">{r.status?.replace(/_/g, ' ')}</span></div>
                    </div>
                  </details>
                ))}

                {/* Closed squawks */}
                {closedSquawks.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-green-400/60 text-[10px] cursor-pointer">Resolved squawks ({closedSquawks.length})</summary>
                    <div className="mt-1 space-y-0.5">
                      {closedSquawks.map((s) => (
                        <details key={s.id} className="rounded-lg border border-green-400/10 bg-green-400/[0.03]">
                          <summary className="flex items-center gap-2 text-[10px] text-slate-500 px-3 py-1.5 cursor-pointer">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                            <span className="flex-1">{s.description}</span>
                            <span className="text-green-400/50">{s.resolvedDate || s.reportedDate}</span>
                          </summary>
                          <div className="px-3 pb-1.5 text-[10px] text-slate-600 space-y-0.5 ml-4">
                            <div>Reported: {s.reportedDate} by {s.reportedBy}</div>
                            {s.resolvedBy && <div>Resolved: {s.resolvedDate} by {s.resolvedBy}</div>}
                            {s.resolutionNotes && <div>Resolution: {s.resolutionNotes}</div>}
                            {s.workOrderId && <div>Work Order: {s.workOrderId}</div>}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                )}

                {/* Completed service requests */}
                {completed.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-green-400/60 text-[10px] cursor-pointer">Completed maintenance ({completed.length})</summary>
                    <div className="mt-1 space-y-0.5">
                      {completed.map((r) => (
                        <details key={r.id} className="rounded-lg border border-green-400/10 bg-green-400/[0.03]">
                          <summary className="flex items-center gap-2 text-[10px] text-slate-500 px-3 py-1.5 cursor-pointer">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400/40" />
                            <span className="flex-1 capitalize">{r.type?.replace(/_/g, ' ')}</span>
                            <span className="text-green-400/50">{r.requestedDate}</span>
                          </summary>
                          <div className="px-3 pb-1.5 text-[10px] text-slate-600 space-y-0.5 ml-4">
                            <div>Requested: {r.requestedDate} by {r.requestedBy}</div>
                            {r.description && <div>Details: {r.description}</div>}
                            {r.notes && <div>Notes: {r.notes}</div>}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                )}

                {totalItems === 0 && closedSquawks.length === 0 && completed.length === 0 && (
                  <p className="text-slate-600 text-[10px]">No maintenance history</p>
                )}

                {/* Action buttons + quick services */}
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => { onSquawk?.(ac.tail); setTimeout(() => document.getElementById('sec-squawk')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
                      className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded-xl text-[10px] font-medium transition-all border border-amber-500/20">
                      🔧 Squawk
                    </button>
                    <button onClick={() => {
                        addServiceRequest({ id: `sr-mx-${Date.now()}`, type: 'annual_inspection', tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator: 'journeys', notes: `Annual inspection for ${ac.tail} (${ac.type})` })
                        alert('Annual inspection requested for ' + ac.tail)
                      }}
                      className="flex-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 py-2 rounded-xl text-[10px] font-medium transition-all border border-sky-500/20">
                      📋 Annual
                    </button>
                    <button onClick={() => {
                        addServiceRequest({ id: `sr-mx-${Date.now()}`, type: '100hr_inspection', tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator: 'journeys', notes: `100-hour inspection for ${ac.tail} (${ac.type})` })
                        alert('100-hr inspection requested for ' + ac.tail)
                      }}
                      className="flex-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 py-2 rounded-xl text-[10px] font-medium transition-all border border-sky-500/20">
                      📋 100hr
                    </button>
                  </div>
                  {/* Quick FBO services */}
                  <details>
                    <summary className="text-slate-400 text-[10px] cursor-pointer hover:text-slate-200">⛽ Quick Service Order {ac.fuelType ? `(${ac.fuelType})` : ''}</summary>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[
                        { id: 'fuel', label: `⛽ ${ac.fuelType || '100LL'} top-off` },
                        { id: 'tiedown', label: '🔗 Tie-down' },
                        { id: 'hangar', label: '🏠 Hangar' },
                        { id: 'preheat', label: '🔥 Preheat' },
                        { id: 'lavatory', label: '🚻 Lav' },
                        { id: 'oxygen', label: '💨 O₂' },
                        { id: 'deice', label: '❄️ De-ice' },
                        { id: 'gpu', label: '🔌 GPU' },
                        { id: 'cleaning', label: '🧽 Clean' },
                      ].map((svc) => {
                        const isDefault = (ac.defaultServices || []).includes(svc.id)
                        return (
                          <button key={svc.id} onClick={() => {
                              addServiceRequest({ id: `sr-svc-${Date.now()}-${svc.id}`, type: svc.id, tailNumber: ac.tail, requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0], status: 'requested', operator: 'journeys', notes: `${svc.label} for ${ac.tail}` })
                            }}
                            className={`px-2 py-1 rounded text-[10px] transition-all border ${isDefault ? 'bg-purple-400/15 border-purple-400/30 text-purple-300' : 'bg-surface border-surface-border text-slate-500 hover:border-slate-400 hover:text-slate-200'}`}>
                            {svc.label}
                          </button>
                        )
                      })}
                    </div>
                  </details>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function FleetSection({ user, onBookAircraft, onSquawk, squawkVersion }) {
  const fleet = getAircraftByOperator('journeys')
  const [expanded, setExpanded] = useState(null)
  const [stars, setStar] = useAircraftStars(user?.id)
  // Live squawk data for each aircraft
  const allSquawks = getSquawks()
  const squawksByTail = useMemo(() => {
    const map = {}
    fleet.forEach((ac) => {
      map[ac.tailNumber] = allSquawks.filter((s) => s.tailNumber === ac.tailNumber && s.status !== 'closed')
    })
    return map
  }, [fleet, allSquawks, squawkVersion])
  const [frontSeats, setFrontSeats] = useState('')
  const [aftSeats, setAftSeats] = useState('')
  const [fuelMode, setFuelMode] = useState('hours')  // 'hours' | 'miles'
  const [fuelHours, setFuelHours] = useState('3')
  const [fuelMiles, setFuelMiles] = useState('')

  const frontLbs = Number(frontSeats) || 0
  const aftLbs = Number(aftSeats) || 0
  const hasInput = frontLbs > 0 || aftLbs > 0

  return (
    <section id="sec-fleet" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Aircraft Fleet & Weight Balance</h2>
          <p className="text-slate-400">{fleet.length} aircraft — enter your mission below to see which aircraft work</p>
          <div className="flex gap-3 justify-center mt-4">
            <a href={RENTAL_PDF} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
              Rental Price List PDF ↗
            </a>
            <a href={WB_CALC_URL} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
              W&B Calculator (Excel) ↗
            </a>
          </div>
        </div>

        {/* ── Universal W&B Input Form ── */}
        <div className="bg-surface-card border border-sky-400/20 rounded-2xl p-6 mb-8 shadow-lg shadow-sky-500/5">
          <h3 className="text-white font-bold text-sm mb-4">Mission Planner — Enter your load, see which aircraft fit</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Front Seats (lbs)</label>
              <input type="number" placeholder="e.g. 340" value={frontSeats} onChange={(e) => setFrontSeats(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              <div className="text-slate-600 text-[10px] mt-1">Pilot + front passenger</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Rear Seats (lbs)</label>
              <input type="number" placeholder="e.g. 0" value={aftSeats} onChange={(e) => setAftSeats(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              <div className="text-slate-600 text-[10px] mt-1">Rear passengers (0 for 2-seat)</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Fuel — {fuelMode === 'hours' ? 'Hours' : 'Distance (mi)'}</label>
              {fuelMode === 'hours' ? (
                <input type="number" placeholder="3" value={fuelHours} onChange={(e) => setFuelHours(e.target.value)} step="0.5" min="0"
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              ) : (
                <input type="number" placeholder="e.g. 200" value={fuelMiles} onChange={(e) => setFuelMiles(e.target.value)} min="0"
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
              )}
              <div className="text-slate-600 text-[10px] mt-1">+ 45 min VFR reserve auto-added</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1.5">Fuel Mode</label>
              <div className="flex gap-2 h-[46px]">
                <button onClick={() => setFuelMode('hours')}
                  className={`flex-1 rounded-xl text-sm font-medium transition-all ${fuelMode === 'hours' ? 'bg-sky-500 text-white' : 'bg-surface border border-surface-border text-slate-400 hover:text-white'}`}>
                  Hours
                </button>
                <button onClick={() => setFuelMode('miles')}
                  className={`flex-1 rounded-xl text-sm font-medium transition-all ${fuelMode === 'miles' ? 'bg-sky-500 text-white' : 'bg-surface border border-surface-border text-slate-400 hover:text-white'}`}>
                  Miles
                </button>
              </div>
              <div className="text-slate-600 text-[10px] mt-1">{fuelMode === 'hours' ? 'Flight time at cruise' : 'Statute miles one-way'}</div>
            </div>
          </div>
          {hasInput && (
            <div className="mt-4 pt-3 border-t border-surface-border flex flex-wrap gap-4 text-xs text-slate-400">
              <span>Front: <strong className="text-slate-200">{frontLbs} lbs</strong></span>
              <span>Rear: <strong className="text-slate-200">{aftLbs} lbs</strong></span>
              <span>Fuel: <strong className="text-slate-200">{fuelMode === 'hours' ? `${fuelHours || 0} hrs` : `${fuelMiles || 0} mi`} + 45 min reserve</strong></span>
            </div>
          )}
        </div>

        {/* ── Fleet cards — colored by W&B evaluation ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {fleet.map((ac) => {
            const wb = ac.weightBalance || {}
            const rates = ac.rentalRates || {}
            const rp = ac.riskProfile || {}
            const fuelInfo = computeFuelForAircraft(ac, fuelMode, fuelHours, fuelMiles)
            const evaluation = hasInput ? evaluateAircraft(ac, frontLbs, aftLbs, fuelInfo) : null
            const es = evaluation ? EVAL_STYLE[evaluation.status] : EVAL_STYLE.unknown
            const usefulLoad = wb.maxGrossLbs && wb.emptyWeightLbs ? wb.maxGrossLbs - wb.emptyWeightLbs : null
            const stationEntries = wb.stations ? Object.entries(wb.stations) : []
            const open = expanded === ac.id

            // Live grounding check from squawks
            const acSquawks = squawksByTail[ac.tailNumber] || []
            const hasGroundingSquawk = acSquawks.some((s) => s.severity === 'grounding')
            const isGrounded = !ac.airworthy || hasGroundingSquawk
            const openSquawkCount = acSquawks.length

            // Use evaluation-based styling when user has input, otherwise default airworthy style
            const cardBg = hasInput && evaluation ? es.bg : (isGrounded ? 'bg-red-400/8' : 'bg-surface-card')
            const cardBorder = hasInput && evaluation ? es.border : (isGrounded ? 'border-red-400/30' : 'border-surface-border')
            const cardRing = hasInput && evaluation ? `ring-1 ${es.ring}` : ''

            return (
              <div key={ac.id} onClick={() => setExpanded(open ? null : ac.id)}
                className={`${cardBg} border ${cardBorder} ${cardRing} rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]`}>

                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-white text-base font-bold">{ac.makeModel}</div>
                    <div className="text-slate-400 text-xs">{ac.tailNumber} · {ac.passengerCapacity + 1} seats{ac.year ? ` · ${ac.year}` : ''}</div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    {/* Star preference rating */}
                    {user && (
                      <div className="flex gap-0 mb-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        {[1, 2, 3].map((s) => (
                          <button key={s} onClick={() => setStar(ac.tailNumber, (stars[ac.tailNumber] || 0) === s ? 0 : s)}
                            className={`text-sm leading-none transition-all hover:scale-125 ${s <= (stars[ac.tailNumber] || 0) ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500'}`}>★</button>
                        ))}
                      </div>
                    )}
                    {rates.member != null && (
                      <div className="text-green-400 font-bold text-lg">${rates.member}</div>
                    )}
                    {hasInput && evaluation ? (
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${es.badge}`}>{es.label}</span>
                    ) : (
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`w-2 h-2 rounded-full ${isGrounded ? 'bg-red-400' : openSquawkCount > 0 ? 'bg-amber-400' : 'bg-green-400'}`} />
                        <span className={`text-[10px] font-medium ${isGrounded ? 'text-red-400' : openSquawkCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          {isGrounded ? 'GROUNDED' : openSquawkCount > 0 ? `${openSquawkCount} squawk${openSquawkCount > 1 ? 's' : ''}` : 'Airworthy'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* W&B evaluation summary — prominent when input is active */}
                {hasInput && evaluation && evaluation.status !== 'unknown' && (
                  <div className={`rounded-lg p-2.5 mb-3 text-xs ${es.bg} border ${es.border}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Gross: <strong className="text-white">{evaluation.totalWt?.toLocaleString()} / {wb.maxGrossLbs?.toLocaleString()} lbs</strong></span>
                      <span className={`font-bold ${evaluation.margin >= 0 ? (evaluation.margin < 50 ? 'text-amber-400' : 'text-green-400') : 'text-red-400'}`}>
                        {evaluation.margin >= 0 ? `+${evaluation.margin}` : evaluation.margin} lbs
                      </span>
                    </div>
                    <div className="text-slate-500 text-[10px] mt-1">
                      Fuel: {fuelInfo.cappedGal} gal ({fuelInfo.fuelLbs} lbs) incl. 45 min reserve
                      {fuelInfo.exceedsTanks && <span className="text-red-400 ml-1">— exceeds {fuelInfo.maxGal} gal tank capacity!</span>}
                    </div>
                    {evaluation.stationIssues.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {evaluation.stationIssues.map((iss, i) => (
                          <div key={i} className="text-amber-400 text-[10px]">⚠ {iss}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rate details */}
                {rates.member != null && (
                  <div className="text-slate-500 text-[10px] mb-2">
                    Member ${rates.member} · Pre-pay ${rates.prepay} · Non-mbr ${rates.nonMember} / {rates.unit || 'hr'}
                  </div>
                )}

                {/* Equipment tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {ac.equipment?.ifrCertified && <span className="text-[9px] bg-sky-400/15 text-sky-400 px-1.5 py-0.5 rounded">IFR</span>}
                  {ac.equipment?.autopilot && <span className="text-[9px] bg-sky-400/15 text-sky-400 px-1.5 py-0.5 rounded">AP</span>}
                  {ac.equipment?.glassPanel && <span className="text-[9px] bg-sky-400/15 text-sky-400 px-1.5 py-0.5 rounded">Glass</span>}
                  {ac.equipment?.adsbOut && <span className="text-[9px] bg-slate-400/15 text-slate-400 px-1.5 py-0.5 rounded">ADS-B</span>}
                  {rp.highPerformance && <span className="text-[9px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded">HP</span>}
                  {rp.taildragger && <span className="text-[9px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded">TW</span>}
                  {ac.soloInsuranceReq && <span className="text-[9px] bg-slate-400/15 text-slate-500 px-1.5 py-0.5 rounded">Solo: {ac.soloInsuranceReq}</span>}
                </div>

                {/* Compact specs line */}
                <div className="text-slate-500 text-[10px]">
                  {ac.cruiseSpeedKts} kts · {ac.fuelBurnGalHr} gal/hr · {ac.fuelCapacityGal} gal
                  {usefulLoad && ` · ${usefulLoad} lbs useful`}
                </div>

                {/* Expanded detail */}
                {open && wb.maxGrossLbs && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3" onClick={(e) => e.stopPropagation()}>
                    {/* Open squawks */}
                    {acSquawks.length > 0 && (
                      <div className="mb-3">
                        <h4 className={`text-[10px] uppercase tracking-wide mb-1 ${hasGroundingSquawk ? 'text-red-400 font-bold' : 'text-amber-400'}`}>
                          {hasGroundingSquawk ? '⚠ GROUNDED' : 'Open Squawks'} ({acSquawks.length})
                        </h4>
                        {acSquawks.map((s) => (
                          <div key={s.id} className={`text-[10px] px-2 py-1 rounded mb-0.5 border ${s.severity === 'grounding' ? 'bg-red-400/10 border-red-400/20 text-red-300' : 'bg-amber-400/5 border-amber-400/15 text-slate-300'}`}>
                            {s.description} <span className="text-slate-500">· {s.severity} · {s.reportedDate}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wide">Full Weight & Balance</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Empty wt:</span> <span className="text-slate-200">{wb.emptyWeightLbs?.toLocaleString()} lbs</span></div>
                      <div><span className="text-slate-500">Max gross:</span> <span className="text-slate-200">{wb.maxGrossLbs?.toLocaleString()} lbs</span></div>
                      <div><span className="text-slate-500">Useful load:</span> <span className="text-slate-200">{usefulLoad} lbs</span></div>
                      <div><span className="text-slate-500">Fuel capacity:</span> <span className="text-slate-200">{ac.fuelCapacityGal} gal</span></div>
                      <div><span className="text-slate-500">Burn rate:</span> <span className="text-slate-200">{ac.fuelBurnGalHr} gal/hr</span></div>
                      <div><span className="text-slate-500">Cruise:</span> <span className="text-slate-200">{ac.cruiseSpeedKts} kts TAS</span></div>
                    </div>
                    {rp.notes && <div className="text-slate-500 text-[10px] italic">{rp.notes}</div>}
                    {stationEntries.length > 0 && (
                      <div className="space-y-0.5">
                        <h4 className="text-slate-500 text-[10px] uppercase tracking-wide">Loading Stations</h4>
                        {stationEntries.map(([name, st]) => (
                          <div key={name} className="flex justify-between text-[10px]">
                            <span className="text-slate-400">{name}</span>
                            <span className="text-slate-300">{st.arm != null ? `Arm ${st.arm}" · ` : ''}{st.maxWeightLbs ? `Max ${st.maxWeightLbs} lbs` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {wb.cgLimits && <div className="text-[10px] text-slate-500">CG range: {wb.cgLimits.forwardIn}" – {wb.cgLimits.aftIn}"</div>}
                    {/* Squawk button inside expanded view */}
                    {user && (
                      <button onClick={(e) => { e.stopPropagation(); onSquawk?.(ac.tailNumber); setTimeout(() => document.getElementById('sec-squawk')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
                        className="mt-2 w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 py-2 rounded-xl text-xs transition-all border border-amber-500/20">
                        🔧 Report Squawk — {ac.tailNumber}
                      </button>
                    )}
                  </div>
                )}

                {/* Book button */}
                {user && !isGrounded && ac.fboCategory !== 'sim' && (
                  <button onClick={(e) => {
                      e.stopPropagation()
                      onBookAircraft?.(ac)
                      setTimeout(() => document.getElementById('sec-schedule')?.scrollIntoView({ behavior: 'smooth' }), 100)
                    }}
                    className="mt-3 w-full bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-all border border-sky-500/30 hover:border-sky-500">
                    Book {ac.tailNumber} →
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">W&B values are type-cert typical — consult aircraft POH for actual. Fuel calculation assumes cruise burn + 45 min VFR reserve.</p>
      </div>
    </section>
  )
}

/* ─── TRAINING SECTION ─── */
function TrainingSection() {
  return (
    <section id="sec-training" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/50 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Flight Training</h2>
          <p className="text-slate-400">Private through Commercial, Instrument, Multi-Engine, Mountain Flying, and more</p>
        </div>

        {/* Instruction rates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {[JB_INSTRUCTION_RATES.primary, JB_INSTRUCTION_RATES.advanced, JB_INSTRUCTION_RATES.specialty].map((r) => (
            <div key={r.label} className="bg-surface-card border border-surface-border rounded-2xl p-6 text-center">
              <div className="text-sky-400 font-bold text-3xl mb-1">${r.rate}<span className="text-sky-400/50 text-base font-normal">/hr</span></div>
              <div className="text-white text-sm font-semibold">{r.label}</div>
            </div>
          ))}
        </div>

        {/* Programs grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {JB_TRAINING.map((pgm) => (
            <div key={pgm.id} className="bg-surface-card border border-surface-border rounded-2xl p-5 hover:border-sky-400/30 transition-colors">
              <h3 className="text-white text-sm font-bold mb-1">{pgm.name}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{pgm.desc}</p>
            </div>
          ))}
        </div>

        {/* Membership & insurance */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-r from-sky-900/50 to-indigo-900/50 border border-sky-400/20 rounded-2xl p-8">
            <h3 className="text-white text-xl font-bold mb-4">Membership</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sky-400 font-bold text-2xl">${JB_MEMBERSHIP.standard.monthly}<span className="text-sky-400/50 text-sm">/mo</span></div>
                <div className="text-slate-300 text-xs">Standard · or ${JB_MEMBERSHIP.standard.annual}/yr</div>
              </div>
              <div>
                <div className="text-green-400 font-bold text-2xl">${JB_MEMBERSHIP.discounted.monthly}<span className="text-green-400/50 text-sm">/mo</span></div>
                <div className="text-slate-300 text-xs">Discounted</div>
                <div className="text-slate-500 text-[10px] mt-1">{JB_MEMBERSHIP.discounted.note}</div>
              </div>
            </div>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-8">
            <h3 className="text-white text-xl font-bold mb-3">Renter's Insurance</h3>
            <p className="text-slate-400 text-xs mb-3">{JB_INSURANCE.note}</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center"><div className="text-white font-bold">${JB_INSURANCE.liability / 1000}K</div><div className="text-slate-500 text-[10px]">Liability</div></div>
              <div className="text-center"><div className="text-white font-bold">${JB_INSURANCE.medical / 1000}K</div><div className="text-slate-500 text-[10px]">Medical</div></div>
              <div className="text-center"><div className="text-white font-bold">${JB_INSURANCE.physicalDamage / 1000}K</div><div className="text-slate-500 text-[10px]">Physical Dmg</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {JB_INSURANCE.providers.map((p) => (
                <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-lg px-3 py-1.5 transition-colors hover:bg-sky-400/10">{p.name} ↗</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── FBO SECTION ─── */
function FBOSection() {
  return (
    <section id="sec-fbo" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">FBO Services & Fuel</h2>
          <p className="text-slate-400">{JB_FUEL.brand} fuels · Heated hangars · Full-service maintenance</p>
        </div>

        {/* Fuel prices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {JB_FUEL.types.map((f) => (
            <div key={f.type} className="bg-surface-card border border-surface-border rounded-2xl p-6 text-center">
              <div className="text-white text-lg font-bold mb-2">{f.type}</div>
              {f.selfServe && <div className="text-green-400 font-bold text-2xl">${f.selfServe}<span className="text-green-400/50 text-sm">/{f.unit}</span></div>}
              {f.selfServe && <div className="text-slate-500 text-xs">Self-serve</div>}
              {f.fullServe && <div className={`${f.selfServe ? 'text-sky-400 text-sm mt-1' : 'text-sky-400 font-bold text-2xl'}`}>${f.fullServe}/{f.unit} full-serve</div>}
            </div>
          ))}
        </div>

        {/* Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          {JB_FBO_SERVICES.map((svc) => (
            <div key={svc} className="flex items-start gap-3 text-sm">
              <span className="text-sky-400 mt-0.5">+</span>
              <span className="text-slate-300">{svc}</span>
            </div>
          ))}
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-3">FBO & Flight School</h3>
            <div className="space-y-1.5 text-sm text-slate-300">
              <div>{JB_INFO.address}</div>
              <div>Phone: <span className="text-sky-400">{JB_INFO.phone}</span></div>
              <div>Email: <span className="text-sky-400">{JB_INFO.email}</span></div>
              <div>Hours: {JB_INFO.hours}</div>
              <div>UNICOM: {JB_INFO.radioFreq}</div>
              <div className="text-slate-500 text-xs mt-2">{JB_INFO.groundTransport}</div>
            </div>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-3">Aircraft Maintenance</h3>
            <div className="space-y-1.5 text-sm text-slate-300">
              <div>Phone: <span className="text-sky-400">{JB_INFO.maintenancePhone}</span></div>
              <div>A&P, IA, Rotax iRMT Series 9 certified</div>
              <div>ROTAX Independent Repair Centre (iRC)</div>
              <div>SLSA maintenance and repair</div>
              <div>Annual, 100-hr, conditional & pre-buy inspections</div>
              <div className="text-slate-500 text-xs mt-2">EV charging available (Class II)</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── OPERATIONS ─── */
function OperationsSection() {
  const [ops, setOps] = useState(getJBTodayOps)
  useEffect(() => { const id = setInterval(() => setOps(getJBTodayOps()), 60000); return () => clearInterval(id) }, [])

  return (
    <section id="sec-operations" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 flex items-center justify-center gap-3">
            <span className={`w-3 h-3 rounded-full ${ops.isOpen ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            Field Conditions
          </h2>
          <p className="text-slate-400">{ops.isOpen ? 'FBO open — aircraft available' : 'FBO closed — check back during business hours'}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Field', value: ops.fieldElevation, icon: '⛰️' },
            { label: 'Runway', value: ops.runwayInUse, icon: '🛬' },
            { label: 'Wind', value: `${ops.windDir} @ ${ops.windSpeed}`, icon: '💨' },
            { label: 'Temp', value: ops.temp, icon: '🌡️' },
            { label: 'Density Alt', value: ops.densityAltitude, icon: '📏' },
            { label: 'Visibility', value: ops.visibility, icon: '👁️' },
            { label: 'Cloud Base', value: ops.cloudBase, icon: '☁️' },
            { label: 'Sunset', value: ops.nextSunset, icon: '🌅' },
          ].map((item) => (
            <div key={item.label} className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wide">{item.label}</div>
              <div className="text-white text-sm font-bold mt-1">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {[
            { label: 'METAR / TAF', url: JB_INFO.metarUrl },
            { label: 'FAA WeatherCam', url: JB_INFO.webcamUrl },
            { label: 'Windy Forecast', url: JB_INFO.windyUrl },
            { label: 'AirNav (KBDU)', url: JB_INFO.airnav },
          ].map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300 border border-sky-400/30 rounded-xl px-4 py-2 transition-colors hover:bg-sky-400/10">
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── GALLERY ─── */
function GallerySection() {
  const [filter, setFilter] = useState('all')
  const cats = ['all', ...new Set(JB_GALLERY.map((g) => g.category))]
  const filtered = filter === 'all' ? JB_GALLERY : JB_GALLERY.filter((g) => g.category === filter)
  const gradients = [
    'from-sky-600 to-blue-800', 'from-amber-500 to-orange-700', 'from-emerald-500 to-teal-700',
    'from-purple-500 to-indigo-700', 'from-rose-500 to-pink-700', 'from-cyan-500 to-sky-700',
    'from-blue-500 to-indigo-800', 'from-teal-400 to-emerald-700', 'from-indigo-500 to-purple-800',
    'from-sky-400 to-blue-700', 'from-amber-400 to-red-600', 'from-green-500 to-teal-800',
    'from-blue-400 to-sky-800', 'from-violet-500 to-purple-700', 'from-orange-400 to-amber-700',
    'from-cyan-400 to-blue-700',
  ]

  return (
    <section id="sec-gallery" className="py-20 px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Gallery</h2>
        </div>
        <div className="flex gap-2 justify-center mb-6">
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`text-xs px-4 py-1.5 rounded-full transition-colors capitalize ${filter === c ? 'bg-sky-500 text-white' : 'bg-surface-card border border-surface-border text-slate-400 hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <div key={img.id} className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer">
              {img.img ? (
                <img src={img.img} alt={img.alt} loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${gradients[(img.id - 1) % gradients.length]} transition-transform group-hover:scale-110 duration-500`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-xs font-medium">{img.alt}</p>
                <span className="text-white/50 text-[10px] capitalize">{img.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── TEAM ─── */
function TeamSection() {
  return (
    <section id="sec-about" className="py-20 px-6 bg-gradient-to-b from-surface to-surface-card/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">About Journeys Aviation</h2>
          <p className="text-slate-400 max-w-lg mx-auto">{JB_INFO.mission}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {JB_STAFF.map((person) => (
            <div key={person.name} className="bg-surface-card border border-surface-border rounded-2xl p-6 flex gap-4 items-start">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {person.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <div className="text-white font-bold">{person.name}</div>
                <div className="text-sky-400 text-[10px] uppercase tracking-wide mb-1">{person.role}</div>
                <div className="text-slate-400 text-xs leading-relaxed">{person.bio}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Start Flying CTA */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 left-[20%] w-40 h-12 bg-white/40 rounded-full blur-2xl" />
              <div className="absolute bottom-4 right-[25%] w-56 h-14 bg-white/30 rounded-full blur-3xl" />
            </div>
          </div>
          <div className="relative z-10 px-8 py-12 text-center">
            <h3 className="text-3xl font-bold text-white mb-3">Ready to Fly?</h3>
            <p className="text-sky-100/80 text-base mb-6 max-w-lg mx-auto">
              Book a Discovery Flight — an introductory lesson with you at the controls over Boulder and the Rockies. No experience needed.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href={`tel:${JB_INFO.phone.replace(/[^\d]/g, '')}`}
                className="bg-white text-sky-700 font-bold px-8 py-4 rounded-xl text-sm hover:bg-sky-50 transition-colors shadow-xl">
                Call {JB_INFO.phone}
              </a>
              <a href={`mailto:${JB_INFO.email}?subject=Discovery%20Flight%20Inquiry`}
                className="border-2 border-white/50 text-white font-bold px-8 py-4 rounded-xl text-sm hover:bg-white/10 transition-colors">
                Email Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── STUDENT DASHBOARD (shown first when student logged in) ─── */

/* ─── RECENT FLIGHT BOX (unclosed flights — post-flight logging) ─── */
function RecentFlightBox({ user }) {
  const [flights, setFlights] = useState(() => getAllFlights())
  const [squawks, setSquawks] = useState(() => getSquawks())

  useEffect(() => {
    const unsub1 = subscribe((f) => setFlights(f))
    const unsub2 = subscribeSquawks((s) => setSquawks(s))
    return () => { unsub1(); unsub2() }
  }, [])

  // Find recent unclosed flights for this user (planned or active, within last 24 hrs or upcoming today)
  const now = Date.now()
  const recentWindow = 24 * 3600_000
  const myFlights = flights.filter((f) => {
    if (f.status === 'closed' || f.status === 'cancelled') return false
    if (f._source !== 'journeys_portal' && f.operator !== 'journeys') return false
    const isMyFlight = f.picId === user.id || f.sicId === user.id || f._bookingId
    if (!isMyFlight) return false
    const depTime = new Date(f.plannedDepartureUtc).getTime()
    return depTime > now - recentWindow && depTime < now + recentWindow
  }).sort((a, b) => new Date(b.plannedDepartureUtc) - new Date(a.plannedDepartureUtc))

  if (myFlights.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">Recent & Upcoming Reservations</h2>
      {myFlights.map((f) => (
        <RecentFlightCard key={f.id} flight={f} user={user} squawks={squawks} />
      ))}
    </div>
  )
}

function RecentFlightCard({ flight, user, squawks }) {
  const [expanded, setExpanded] = useState(false)
  const [tachStart, setTachStart] = useState('')
  const [tachEnd, setTachEnd] = useState('')
  const [hobbsStart, setHobbsStart] = useState('')
  const [hobbsEnd, setHobbsEnd] = useState('')
  const [rating, setRating] = useState(0) // 1-5 stars
  const [noSquawks, setNoSquawks] = useState(false)
  const [showSquawkForm, setShowSquawkForm] = useState(false)
  const [squawkDesc, setSquawkDesc] = useState('')
  const [squawkSeverity, setSquawkSeverity] = useState('monitoring')
  const [closed, setClosed] = useState(false)

  const depTime = new Date(flight.plannedDepartureUtc)
  const isPast = depTime.getTime() < Date.now()
  const acSquawks = squawks.filter((s) => s.tailNumber === flight.tailNumber && s.status !== 'closed').slice(0, 5)

  const handleSquawkSubmit = () => {
    if (!squawkDesc.trim()) return
    addSquawk({
      id: `sqk-pf-${Date.now()}`,
      tailNumber: flight.tailNumber,
      reportedBy: user.name,
      reportedDate: new Date().toISOString().split('T')[0],
      reportedAt: new Date().toISOString(),
      description: squawkDesc.trim(),
      severity: squawkSeverity,
      status: 'open',
      melReference: null, melExpiryDate: null, airframeHours: null,
      resolvedDate: null, resolvedBy: null, resolutionNotes: null, workOrderId: null,
      _flightId: flight.id,
    })
    setSquawkDesc('')
    setShowSquawkForm(false)
  }

  const handleClose = () => {
    updateStoreFlight(flight.id, {
      status: 'closed',
      _postFlight: {
        tachStart: tachStart || null, tachEnd: tachEnd || null,
        hobbsStart: hobbsStart || null, hobbsEnd: hobbsEnd || null,
        hobbsTime: hobbsStart && hobbsEnd ? (parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1) : null,
        rating,
        noSquawks,
        closedBy: user.name,
        closedAt: new Date().toISOString(),
      },
    })
    setClosed(true)
  }

  if (closed) {
    return (
      <div className="bg-green-400/8 border border-green-400/20 rounded-2xl p-4 flex items-center gap-3 animate-[fadeIn_0.3s_ease]">
        <span className="text-xl">✅</span>
        <div>
          <div className="text-green-400 font-semibold text-sm">Flight closed — {flight.tailNumber}</div>
          <div className="text-green-400/60 text-xs">{flight._sessionLabel || flight.callsign} · {hobbsStart && hobbsEnd ? `${(parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)} Hobbs` : 'No times logged'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 transition-all ${isPast ? 'bg-amber-500/8 border-amber-400/25' : 'bg-sky-500/8 border-sky-400/25'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isPast ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`} />
          <div>
            <div className="text-white font-bold text-base">{flight.tailNumber} — {flight._sessionLabel || flight.missionType}</div>
            <div className="text-slate-400 text-xs">
              {depTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {depTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {flight.pic && ` · PIC: ${flight.pic}`}
              {flight._duration && ` · ${flight._duration} hr`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isPast ? 'bg-amber-400/20 text-amber-400' : 'bg-sky-400/20 text-sky-400'}`}>
            {isPast ? 'Ready to Close' : 'Upcoming'}
          </span>
          <span className="text-slate-500 text-sm">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
          {/* Tach & Hobbs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-slate-500 text-xs block mb-1">Tach Start</label>
              <input type="number" step="0.1" placeholder="e.g. 4521.3" value={tachStart} onChange={(e) => setTachStart(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1">Tach End</label>
              <input type="number" step="0.1" placeholder="e.g. 4523.1" value={tachEnd} onChange={(e) => setTachEnd(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1">Hobbs Start</label>
              <input type="number" step="0.1" placeholder="e.g. 1120.5" value={hobbsStart} onChange={(e) => setHobbsStart(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1">Hobbs End</label>
              <input type="number" step="0.1" placeholder="e.g. 1122.3" value={hobbsEnd} onChange={(e) => setHobbsEnd(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
            </div>
          </div>
          {hobbsStart && hobbsEnd && parseFloat(hobbsEnd) > parseFloat(hobbsStart) && (
            <div className="text-sky-400 text-sm font-medium">Hobbs time: {(parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)} hrs</div>
          )}

          {/* Rate the flight */}
          <div>
            <label className="text-slate-500 text-xs block mb-1.5">Rate this flight</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)}
                  className={`text-2xl transition-all hover:scale-110 ${star <= rating ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>
                  ★
                </button>
              ))}
              {rating > 0 && <span className="text-slate-500 text-xs ml-2 self-center">{['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}</span>}
            </div>
          </div>

          {/* Squawk section */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-slate-400 text-sm font-semibold">Aircraft Squawks — {flight.tailNumber}</label>
              {acSquawks.length > 0 && <span className="text-amber-400 text-xs">{acSquawks.length} open</span>}
            </div>

            {/* Recent squawks for this aircraft */}
            {acSquawks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {acSquawks.map((s) => (
                  <div key={s.id} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
                    s.severity === 'grounding' ? 'bg-red-400/10 border-red-400/20 text-red-300'
                    : s.severity === 'ops_limiting' ? 'bg-amber-400/10 border-amber-400/20 text-amber-300'
                    : 'bg-surface border-surface-border text-slate-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      s.severity === 'grounding' ? 'bg-red-400' : s.severity === 'ops_limiting' ? 'bg-amber-400' : 'bg-slate-400'
                    }`} />
                    <div>
                      <div className="font-medium">{s.description}</div>
                      <div className="text-slate-500 text-[10px]">{s.reportedDate} · {s.reportedBy} · {s.severity}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No squawks / add squawk toggle */}
            <div className="flex gap-2">
              <button onClick={() => { setNoSquawks(true); setShowSquawkForm(false) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  noSquawks ? 'bg-green-400/15 border-green-400/30 text-green-400' : 'bg-surface border-surface-border text-slate-400 hover:border-green-400/30'
                }`}>
                ✓ No squawks
              </button>
              <button onClick={() => { setShowSquawkForm(true); setNoSquawks(false) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  showSquawkForm ? 'bg-amber-400/15 border-amber-400/30 text-amber-400' : 'bg-surface border-surface-border text-slate-400 hover:border-amber-400/30'
                }`}>
                ⚠ Report squawk
              </button>
            </div>

            {/* Squawk form */}
            {showSquawkForm && (
              <div className="mt-3 p-4 rounded-xl border border-amber-400/30 bg-amber-500/5 space-y-3 animate-[fadeIn_0.3s_ease]">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'grounding', l: 'Grounding', c: 'border-red-400/40 text-red-400' },
                    { v: 'ops_limiting', l: 'Ops Limiting', c: 'border-amber-400/40 text-amber-400' },
                    { v: 'deferred', l: 'Deferred', c: 'border-yellow-400/40 text-yellow-400' },
                    { v: 'monitoring', l: 'Monitoring', c: 'border-slate-400/40 text-slate-400' },
                  ].map((s) => (
                    <button key={s.v} onClick={() => setSquawkSeverity(s.v)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        squawkSeverity === s.v ? 'bg-sky-500/20 border-sky-400 text-sky-400' : `bg-surface ${s.c}`
                      }`}>{s.l}</button>
                  ))}
                </div>
                <textarea rows={2} placeholder="Describe the issue..." value={squawkDesc} onChange={(e) => setSquawkDesc(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
                <button onClick={handleSquawkSubmit} disabled={!squawkDesc.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  Submit Squawk
                </button>
              </div>
            )}
          </div>

          {/* Close flight button */}
          <button onClick={handleClose}
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2">
            Close Flight{hobbsStart && hobbsEnd ? ` — ${(parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)} Hobbs` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── PPL ACS task areas (FAA-S-ACS-6B) ─── */
const PPL_ACS = {
  dual: [
    { id: 'acs-preflight', area: 'I', label: 'Preflight Preparation', tasks: ['Pilot Qualifications', 'Airworthiness Requirements', 'Weather Information', 'Cross-Country Flight Planning', 'National Airspace System', 'Performance & Limitations', 'Operation of Systems', 'Human Factors', 'Aeronautical Decision Making'] },
    { id: 'acs-preflight-proc', area: 'II', label: 'Preflight Procedures', tasks: ['Preflight Assessment', 'Flight Deck Management', 'Engine Starting', 'Taxiing', 'Before Takeoff Check'] },
    { id: 'acs-airport-ops', area: 'III', label: 'Airport & Seaplane Base Operations', tasks: ['Communications', 'Traffic Patterns', 'Runway Incursion Avoidance'] },
    { id: 'acs-takeoffs', area: 'IV', label: 'Takeoffs, Landings & Go-Arounds', tasks: ['Normal T&L', 'Short-Field Takeoff & Climb', 'Short-Field Approach & Landing', 'Soft-Field Takeoff & Climb', 'Soft-Field Approach & Landing', 'Forward Slip to Landing', 'Go-Around / Rejected Landing'] },
    { id: 'acs-performance', area: 'V', label: 'Performance & Ground Reference Maneuvers', tasks: ['Steep Turns', 'Ground Reference Maneuvers'] },
    { id: 'acs-nav', area: 'VI', label: 'Navigation', tasks: ['Pilotage & Dead Reckoning', 'Navigation Systems & Radar Services', 'Diversion', 'Lost Procedures'] },
    { id: 'acs-slow', area: 'VII', label: 'Slow Flight & Stalls', tasks: ['Maneuvering During Slow Flight', 'Power-Off Stalls', 'Power-On Stalls', 'Spin Awareness'] },
    { id: 'acs-instrument', area: 'VIII', label: 'Basic Instrument Maneuvers', tasks: ['Straight-and-Level Flight', 'Constant Airspeed Climbs', 'Constant Airspeed Descents', 'Turns to Headings', 'Recovery from Unusual Attitudes', 'Radio Communications / Navigation'] },
    { id: 'acs-emergency', area: 'IX', label: 'Emergency Operations', tasks: ['Emergency Descent', 'Emergency Approach & Landing', 'Systems & Equipment Malfunctions', 'Emergency Equipment & Survival Gear'] },
    { id: 'acs-night', area: 'X', label: 'Night Operations', tasks: ['Night Preparation', 'Night Flight'] },
    { id: 'acs-postflight', area: 'XI', label: 'Postflight Procedures', tasks: ['After Landing', 'Parking & Securing'] },
  ],
  solo: [
    { id: 'solo-pattern', label: 'Pattern Solo', tasks: ['3 T&Ls at home airport', 'Normal landings', 'Go-around demonstrated'], minFlights: 1 },
    { id: 'solo-practice', label: 'Practice Area Solo', tasks: ['Maneuvers in practice area', 'Emergency procedures review before flight'], minFlights: 2 },
    { id: 'solo-xc-short', label: 'Solo XC (short)', tasks: ['XC flight ≥50nm from departure', 'Full stop landing at 2+ airports'], minFlights: 1 },
    { id: 'solo-xc-long', label: 'Solo XC (long)', tasks: ['Total distance ≥150nm', '≥3 points with full-stop landings', 'One leg ≥50nm straight-line'], minFlights: 1 },
    { id: 'solo-night', label: 'Night Solo', tasks: ['10 night T&Ls at towered airport', '3 to full stop', '100nm night XC'], minFlights: 1 },
  ],
  ground: [
    { id: 'oral-regs', label: 'Regulations (14 CFR)', tasks: ['Part 61 — Pilot Certificates', 'Part 91 — General Operating Rules', 'NTSB 830 — Accident Reporting', 'AIM — Aeronautical Information Manual'] },
    { id: 'oral-weather', label: 'Weather', tasks: ['Weather theory & hazards', 'METAR/TAF interpretation', 'Graphical forecasts', 'PIREPs & SIGMETs/AIRMETs', 'Weather decision making'] },
    { id: 'oral-performance', label: 'Performance & Limitations', tasks: ['Weight & balance calculations', 'Density altitude effects', 'Takeoff/landing distance charts', 'Climb/cruise performance'] },
    { id: 'oral-systems', label: 'Aircraft Systems', tasks: ['Powerplant', 'Electrical system', 'Vacuum/pressure system', 'Pitot-static system', 'Fuel system', 'Flight instruments'] },
    { id: 'oral-airspace', label: 'Airspace & Navigation', tasks: ['Airspace classification', 'VFR cloud clearance & visibility', 'Chart reading', 'Navigation systems (VOR, GPS)', 'Flight plan filing'] },
    { id: 'oral-adm', label: 'ADM & Human Factors', tasks: ['Aeronautical decision making', 'Risk management (PAVE, IMSAFE)', 'CRM / Single-pilot CRM', 'Spatial disorientation', 'Hypoxia & hyperventilation'] },
    { id: 'oral-xc', label: 'Cross-Country Planning', tasks: ['Route selection', 'Fuel planning & reserves', 'Diversion procedures', 'Lost procedures', 'VFR flight plan'] },
  ],
}

// Map lesson template titles → relevant ACS tasks for the close-lesson checklist
const LESSON_ACS_MAP = {
  'Intro & Basic Airmanship':          ['Preflight Assessment', 'Flight Deck Management', 'Engine Starting', 'Taxiing', 'Straight-and-Level Flight'],
  'Traffic Pattern & T&Ls':            ['Traffic Patterns', 'Normal T&L', 'Go-Around / Rejected Landing', 'Communications'],
  'Emergency Procedures — Forced Ldg': ['Emergency Descent', 'Emergency Approach & Landing', 'Systems & Equipment Malfunctions'],
  'Pre-Solo Ground Review':            ['Pilot Qualifications', 'Airworthiness Requirements', 'Operation of Systems', 'Aeronautical Decision Making'],
  'Slow Flight & Power-Off Stalls':    ['Maneuvering During Slow Flight', 'Power-Off Stalls', 'Spin Awareness'],
  'Steep Turns & S-Turns / Pylons':    ['Steep Turns', 'Ground Reference Maneuvers'],
  'Short / Soft Field T&Ls':           ['Short-Field Takeoff & Climb', 'Short-Field Approach & Landing', 'Soft-Field Takeoff & Climb', 'Soft-Field Approach & Landing'],
  'Pre-Solo Dual Check':               ['Normal T&L', 'Go-Around / Rejected Landing', 'Emergency Approach & Landing', 'Maneuvering During Slow Flight'],
  'First Solo — Pattern T&Ls':         ['Normal T&L', 'Traffic Patterns', 'Communications'],
  'Solo Cross-Country Preparation':    ['Cross-Country Flight Planning', 'Pilotage & Dead Reckoning', 'Navigation Systems & Radar Services', 'Diversion'],
  'Dual Night — Patterns & XC':        ['Night Preparation', 'Night Flight', 'Normal T&L'],
  'Hood Work — Instrument Fundamentals': ['Straight-and-Level Flight', 'Constant Airspeed Climbs', 'Constant Airspeed Descents', 'Turns to Headings', 'Recovery from Unusual Attitudes'],
  'Mock Oral Exam':                    ['Pilot Qualifications', 'Weather Information', 'Performance & Limitations', 'National Airspace System', 'Aeronautical Decision Making'],
  'Mock Practical — Full Maneuvers':   ['Steep Turns', 'Power-Off Stalls', 'Power-On Stalls', 'Short-Field Approach & Landing', 'Soft-Field Takeoff & Climb', 'Forward Slip to Landing'],
}
// Fallback: generic items for any lesson not in the map
const GENERIC_ACS = ['Preflight Assessment', 'Normal T&L', 'Communications', 'After Landing', 'Parking & Securing']

function LessonClosePanel({ flight, user, onClose }) {
  const [tachStart, setTachStart] = useState('')
  const [tachEnd, setTachEnd] = useState('')
  const [hobbsStart, setHobbsStart] = useState('')
  const [hobbsEnd, setHobbsEnd] = useState('')
  const [rating, setRating] = useState(0)
  const [acsChecks, setAcsChecks] = useState({})
  const [noSquawks, setNoSquawks] = useState(false)
  const [showSquawkForm, setShowSquawkForm] = useState(false)
  const [squawkDesc, setSquawkDesc] = useState('')
  const [squawkSeverity, setSquawkSeverity] = useState('monitoring')
  const [route, setRoute] = useState(flight.waypoints?.join(' → ') || '')
  const [flightNotes, setFlightNotes] = useState('')
  const [closed, setClosed] = useState(false)

  // Find ACS items for this lesson
  const lessonTitle = flight._sessionLabel?.split('—')[1]?.trim() || flight._sessionLabel || ''
  const acsItems = LESSON_ACS_MAP[lessonTitle] || LESSON_ACS_MAP[Object.keys(LESSON_ACS_MAP).find((k) => lessonTitle.includes(k))] || GENERIC_ACS

  const allChecked = acsItems.every((item) => acsChecks[item])

  const handleSquawkSubmit = () => {
    if (!squawkDesc.trim()) return
    addSquawk({
      id: `sqk-cl-${Date.now()}`, tailNumber: flight.tailNumber,
      reportedBy: user.name, reportedDate: new Date().toISOString().split('T')[0],
      reportedAt: new Date().toISOString(), description: squawkDesc.trim(),
      severity: squawkSeverity, status: 'open',
      melReference: null, melExpiryDate: null, airframeHours: null,
      resolvedDate: null, resolvedBy: null, resolutionNotes: null, workOrderId: null,
      _flightId: flight.id,
    })
    setSquawkDesc('')
    setShowSquawkForm(false)
    setNoSquawks(false)
  }

  const handleClose = () => {
    updateStoreFlight(flight.id, {
      status: 'closed',
      _postFlight: {
        tachStart: tachStart || null, tachEnd: tachEnd || null,
        hobbsStart: hobbsStart || null, hobbsEnd: hobbsEnd || null,
        hobbsTime: hobbsStart && hobbsEnd ? (parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1) : null,
        rating, noSquawks,
        acsResults: acsChecks,
        acsAllMet: allChecked,
        route: route || null,
        flightNotes: flightNotes || null,
        closedBy: user.name, closedAt: new Date().toISOString(),
      },
    })
    setClosed(true)
    setTimeout(() => onClose?.(), 2000)
  }

  if (closed) {
    return (
      <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-4 text-center animate-[fadeIn_0.3s_ease]">
        <span className="text-green-400 font-semibold text-sm">✓ Lesson closed{hobbsStart && hobbsEnd ? ` — ${(parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)} Hobbs` : ''}</span>
      </div>
    )
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-4 animate-[fadeIn_0.3s_ease]">
      <h4 className="text-white font-bold text-sm">Close Lesson — {flight._sessionLabel || flight.tailNumber}</h4>

      {/* Tach & Hobbs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Tach Start', val: tachStart, set: setTachStart },
          { label: 'Tach End', val: tachEnd, set: setTachEnd },
          { label: 'Hobbs Start', val: hobbsStart, set: setHobbsStart },
          { label: 'Hobbs End', val: hobbsEnd, set: setHobbsEnd },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-slate-600 text-[10px]">{f.label}</label>
            <input type="number" step="0.1" placeholder="0.0" value={f.val} onChange={(e) => f.set(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
          </div>
        ))}
      </div>
      {hobbsStart && hobbsEnd && parseFloat(hobbsEnd) > parseFloat(hobbsStart) && (
        <div className="text-sky-400 text-xs">Hobbs: {(parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)} hrs</div>
      )}

      {/* Route & Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-slate-500 text-[10px]">Route</label>
          <input type="text" value={route} onChange={(e) => setRoute(e.target.value)}
            onBlur={(e) => setRoute(normalizeRoute(e.target.value))}
            placeholder="KBDU local" className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
        </div>
        <div>
          <label className="text-slate-500 text-[10px]">Notes / Debrief</label>
          <input type="text" value={flightNotes} onChange={(e) => setFlightNotes(e.target.value)}
            placeholder="What we worked on..." className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
        </div>
      </div>

      {/* ACS Standards checklist */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-slate-400 text-xs font-semibold">ACS Standards — Meets Standards?</label>
          <button onClick={() => {
              const all = {}; acsItems.forEach((i) => { all[i] = !allChecked }); setAcsChecks(all)
            }} className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors">
            {allChecked ? 'Uncheck all' : 'Check all'}
          </button>
        </div>
        <div className="space-y-1">
          {acsItems.map((item) => (
            <label key={item} className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" checked={!!acsChecks[item]}
                onChange={(e) => setAcsChecks((prev) => ({ ...prev, [item]: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-slate-600 bg-surface text-sky-500 focus:ring-sky-400/30" />
              <span className={`text-xs ${acsChecks[item] ? 'text-green-400' : 'text-slate-400 group-hover:text-slate-200'}`}>{item}</span>
            </label>
          ))}
        </div>
        {acsItems.length > 0 && (
          <div className={`text-[10px] mt-1 ${allChecked ? 'text-green-400' : 'text-slate-600'}`}>
            {Object.values(acsChecks).filter(Boolean).length}/{acsItems.length} standards met
          </div>
        )}
      </div>

      {/* Rating */}
      <div>
        <label className="text-slate-400 text-xs block mb-1">Rate this lesson</label>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} className={`text-xl transition-all hover:scale-110 ${s <= rating ? 'text-amber-400' : 'text-slate-700'}`}>★</button>
          ))}
          {rating > 0 && <span className="text-slate-500 text-[10px] ml-1 self-center">{['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}</span>}
        </div>
      </div>

      {/* Squawk */}
      <div>
        <div className="flex gap-2">
          <button onClick={() => { setNoSquawks(true); setShowSquawkForm(false) }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${noSquawks ? 'bg-green-400/15 border-green-400/30 text-green-400' : 'border-surface-border text-slate-500 hover:border-green-400/30'}`}>
            ✓ No squawks
          </button>
          <button onClick={() => { setShowSquawkForm(true); setNoSquawks(false) }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${showSquawkForm ? 'bg-amber-400/15 border-amber-400/30 text-amber-400' : 'border-surface-border text-slate-500 hover:border-amber-400/30'}`}>
            ⚠ Report squawk
          </button>
        </div>
        {showSquawkForm && (
          <div className="mt-2 p-3 rounded-lg border border-amber-400/30 bg-amber-500/5 space-y-2">
            <div className="grid grid-cols-4 gap-1">
              {[{ v: 'grounding', l: 'Ground' }, { v: 'ops_limiting', l: 'Ops Lim' }, { v: 'deferred', l: 'Defer' }, { v: 'monitoring', l: 'Monitor' }].map((s) => (
                <button key={s.v} onClick={() => setSquawkSeverity(s.v)}
                  className={`py-1 rounded text-[10px] font-medium border transition-all ${squawkSeverity === s.v ? 'bg-sky-500/20 border-sky-400 text-sky-400' : 'border-surface-border text-slate-500'}`}>{s.l}</button>
              ))}
            </div>
            <textarea rows={2} placeholder="Describe issue..." value={squawkDesc} onChange={(e) => setSquawkDesc(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
            <button onClick={handleSquawkSubmit} disabled={!squawkDesc.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors">Submit Squawk</button>
          </div>
        )}
      </div>

      {/* Close button */}
      <button onClick={handleClose}
        className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
        Close Lesson{hobbsStart && hobbsEnd ? ` — ${(parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)} Hobbs` : ''}
      </button>
    </div>
  )
}

function StudentDashboard({ user }) {
  const student = useMemo(() => {
    const byName = mockStudents.find((s) => s.name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()))
    return byName || mockStudents.find((s) => s.id === 'std-002') || mockStudents[0]
  }, [user.name])

  const program = PROGRAMS[student.program]
  const cfi = mockPersonnel.find((p) => p.id === student.assignedCfiId)
  const reqs = requirementProgress(student, student.program)
  const metCount = metRequirementCount(student, student.program)
  const progress = stageProgress(student, student.program)
  const [acsTab, setAcsTab] = useState('dual')
  const [closingFlightId, setClosingFlightId] = useState(null)
  const [toast, setToast] = useState(null)

  // Lesson recommendations
  const [skippedSlots, setSkippedSlots] = useState(new Set())
  const [acceptedBookings, setAcceptedBookings] = useState([])
  const [acceptedIds, setAcceptedIds] = useState(new Set())

  const allBookings = [...mockBookings, ...acceptedBookings]
  // Keep all recommendations visible (accepted ones show as "Scheduled")
  const allRecommendations = recommendLessons(student, mockPersonnel, mockAircraft, allBookings, skippedSlots)

  // Active / upcoming lessons from all flights
  const [flights, setFlights] = useState(() => getAllFlights())
  useEffect(() => { const u = subscribe((f) => setFlights(f)); return u }, [])

  // Collect ACS "meets standards" from all closed flights for this user
  const acsMet = useMemo(() => {
    const met = new Set()
    flights.forEach((f) => {
      if (f.status !== 'closed') return
      const isMine = f.picId === user.id || f.sicId === user.id || f._bookingId
      if (!isMine) return
      const results = f._postFlight?.acsResults
      if (results) {
        Object.entries(results).forEach(([task, passed]) => { if (passed) met.add(task) })
      }
    })
    return met
  }, [flights, user.id])

  const now = Date.now()
  const ACTIVE_WINDOW = 60 * 60_000 // 1 hour
  const activeFlights = flights.filter((f) => {
    if (f.status === 'closed' || f.status === 'cancelled') return false
    if (f._source !== 'journeys_portal' && f.operator !== 'journeys') return false
    const isMine = f.picId === user.id || f.sicId === user.id || f._bookingId
    if (!isMine) return false
    const dep = new Date(f.plannedDepartureUtc).getTime()
    const end = dep + (f._duration || 1) * 3600_000
    return dep <= now + ACTIVE_WINDOW && end >= now - 30 * 60_000 // starting within 1hr or not yet finished
  })

  // Scheduled (upcoming, not active)
  const scheduledFlights = flights.filter((f) => {
    if (f.status !== 'planned') return false
    if (f._source !== 'journeys_portal' && f.operator !== 'journeys') return false
    const isMine = f.picId === user.id || f.sicId === user.id || f._bookingId
    if (!isMine) return false
    const dep = new Date(f.plannedDepartureUtc).getTime()
    return dep > now + ACTIVE_WINDOW
  }).sort((a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc))

  const handleAccept = (rec) => {
    if (!rec.slot) return
    const booking = {
      id: `bk-ja-${Date.now()}`, studentId: student.id, cfiId: rec.cfi?.id,
      aircraftId: rec.aircraft?.id, type: rec.template.type,
      title: rec.template.title, dayIdx: rec.slot.dayIdx, slot: rec.slot.slot,
      durationHr: rec.template.durationHr,
    }
    setAcceptedBookings((prev) => [...prev, booking])
    setAcceptedIds((prev) => new Set([...prev, rec.template.id]))
    setToast(`✓ ${rec.template.title} booked`)
    setTimeout(() => setToast(null), 3000)
  }

  // Solo endorsement: student has solo hours logged
  const canSolo = student.hours.soloPIC > 0

  // Simulated completion counts (in real app would come from logbook)
  const completedLessons = useMemo(() => {
    const counts = {}
    const templates = LESSON_TEMPLATES[student.program] || {}
    Object.values(templates).flat().forEach((t) => {
      // Stages up to currentStage - 1 are "completed"
      counts[t.id] = 0
    })
    for (let stage = 1; stage < student.currentStage; stage++) {
      (templates[stage] || []).forEach((t) => { counts[t.id] = (counts[t.id] || 0) + 1 })
    }
    return counts
  }, [student.program, student.currentStage])

  const DOC_FIELDS = [
    { key: 'governmentId', label: 'Gov ID', showExpiry: true },
    { key: 'insurance', label: 'Insurance', showExpiry: true },
    { key: 'medicalCert', label: 'Medical', showExpiry: true },
    { key: 'studentPilotCert', label: 'Student Cert', showExpiry: false },
    { key: 'knowledgeTest', label: 'Knowledge Test', showExpiry: false },
  ]

  return (
    <section className="pt-20 pb-8 px-4 sm:px-6 bg-surface">
      <div className="max-w-6xl mx-auto">
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-medium animate-[fadeIn_0.3s_ease]">
            {toast}
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Welcome, {student.name.split(' ')[0]}</h1>
            <p className="text-slate-400 text-sm">{program?.name} · Stage {student.currentStage}/{program?.stages?.length || '?'}
              {cfi && <span className="text-slate-500"> · {cfi.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {student.dpe && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DPE_STATUS_BG[student.dpe.status]} ${DPE_STATUS_COLOR[student.dpe.status]}`}>
                {DPE_STATUS_LABEL[student.dpe.status]}
              </span>
            )}
            <div className="text-right">
              <div className="text-white font-bold text-lg">{student.hours.total} hrs</div>
              <div className="text-slate-600 text-[10px]">{canSolo ? '✓ Solo endorsed' : 'Pre-solo'}</div>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-2 bg-surface-card border border-surface-border rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-slate-500">{Math.round(progress)}% complete</span>
            <span className="text-slate-500">{metCount}/{reqs.length} hour reqs met</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ══ LEFT: Lessons ══ */}
          <div className="lg:col-span-2 space-y-4">

            {/* Proposed next lessons — show as cards with accept/skip */}
            <h2 className="text-white font-bold text-base">Proposed Lessons</h2>
            {allRecommendations.slice(0, 3).map((rec, i) => {
              const isAccepted = acceptedIds.has(rec.template.id)
              return (
                <div key={`prop-${i}`} className={`rounded-xl p-3 flex items-center justify-between transition-all border ${
                  isAccepted ? 'bg-green-400/8 border-green-400/20' : 'bg-surface-card/50 border-surface-border/50 animate-breathe'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${isAccepted ? 'bg-green-400' : 'bg-sky-400/60 animate-pulse'}`} />
                    <div>
                      <div className={`text-sm font-medium ${isAccepted ? 'text-green-400' : 'text-slate-200'}`}>{rec.template.title}</div>
                      <div className="text-slate-500 text-xs">
                        {rec.template.durationHr} hr · {rec.cfi?.name || 'TBD'}
                        {rec.slot && ` · ${SCHEDULE_DAYS[rec.slot.dayIdx]} ${rec.slot.slot}`}
                        {rec.aircraft && ` · ${rec.aircraft.tailNumber}`}
                      </div>
                    </div>
                  </div>
                  {isAccepted ? (
                    <span className="text-green-400 text-[10px] font-semibold">✓ Scheduled</span>
                  ) : (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleSkip(rec)} className="text-[10px] text-slate-500 hover:text-white border border-surface-border px-2 py-1 rounded-lg transition-colors">Skip</button>
                      <button onClick={() => handleAccept(rec)} className="text-[10px] text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-1 rounded-lg hover:bg-sky-400/20 transition-colors font-medium">Accept</button>
                    </div>
                  )}
                </div>
              )
            })}
            {allRecommendations.length === 0 && (
              <div className="bg-surface-card border border-surface-border rounded-xl p-4 text-center text-slate-500 text-xs">No lessons to propose right now</div>
            )}

            {/* + Schedule button */}
            <button onClick={() => document.getElementById('sec-schedule')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full border-2 border-dashed border-slate-700 hover:border-sky-400/40 rounded-xl py-3 text-slate-400 hover:text-sky-400 text-sm font-medium transition-colors">
              + Schedule a Lesson
            </button>
          </div>

          {/* ══ RIGHT: ACS + Hours + Docs ══ */}
          <div className="space-y-4">
            {/* ACS Progress — Dual / Solo / Ground tabs */}
            <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
              <div className="flex border-b border-surface-border">
                {[
                  { id: 'dual', label: 'Dual', icon: '👨‍✈️' },
                  { id: 'solo', label: 'Solo', icon: '🧑‍✈️' },
                  { id: 'ground', label: 'Ground', icon: '📚' },
                ].map((t) => (
                  <button key={t.id} onClick={() => setAcsTab(t.id)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${acsTab === t.id ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-400/5' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                {acsTab === 'dual' && PPL_ACS.dual.map((area) => {
                  const areaDone = area.tasks.filter((t) => acsMet.has(t)).length
                  return (
                    <div key={area.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-slate-400 text-[10px] uppercase tracking-wide">Area {area.area} — {area.label}</div>
                        <div className={`text-[10px] ${areaDone === area.tasks.length ? 'text-green-400' : 'text-slate-600'}`}>{areaDone}/{area.tasks.length}</div>
                      </div>
                      <div className="space-y-0.5">
                        {area.tasks.map((task) => {
                          const done = acsMet.has(task) || student.currentStage > PPL_ACS.dual.indexOf(area) + 1
                          return (
                            <div key={task} className="flex items-center gap-2 text-xs py-0.5">
                              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] ${done ? 'bg-green-400/20 text-green-400' : 'bg-surface border border-surface-border text-slate-600'}`}>
                                {done ? '✓' : ''}
                              </span>
                              <span className={done ? 'text-slate-300' : 'text-slate-500'}>{task}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {acsTab === 'solo' && (
                  <>
                    <div className={`text-xs font-medium px-3 py-2 rounded-lg ${canSolo ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'}`}>
                      {canSolo ? '✓ Solo endorsed — can fly solo' : '⏳ Pre-solo — complete Stage 3 dual requirements first'}
                    </div>
                    {PPL_ACS.solo.map((item) => {
                      const tasksDone = item.tasks.filter((t) => acsMet.has(t)).length
                      const done = tasksDone === item.tasks.length || (item.id === 'solo-pattern' && student.hours.soloPIC > 0)
                      return (
                        <div key={item.id} className={`rounded-lg border p-3 ${done ? 'bg-green-400/5 border-green-400/20' : 'border-surface-border'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold ${done ? 'text-green-400' : 'text-slate-300'}`}>{item.label}</span>
                            <span className="text-[10px] text-slate-500">{done ? '✓ Done' : `${tasksDone}/${item.tasks.length}`}</span>
                          </div>
                          <div className="space-y-0.5">
                            {item.tasks.map((t) => {
                              const tDone = acsMet.has(t)
                              return (
                                <div key={t} className={`text-[10px] flex items-center gap-1.5 ${tDone ? 'text-green-400/80' : 'text-slate-500'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tDone ? 'bg-green-400' : 'bg-slate-600'}`} />
                                  {t}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
                {acsTab === 'ground' && PPL_ACS.ground.map((area) => {
                  const tasksDone = area.tasks.filter((t) => acsMet.has(t)).length
                  return (
                    <div key={area.id} className={`rounded-lg border p-3 ${tasksDone === area.tasks.length ? 'border-green-400/20 bg-green-400/5' : 'border-surface-border'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className={`text-xs font-semibold ${tasksDone === area.tasks.length ? 'text-green-400' : 'text-slate-300'}`}>{area.label}</div>
                        <div className={`text-[10px] ${tasksDone === area.tasks.length ? 'text-green-400' : 'text-slate-600'}`}>{tasksDone}/{area.tasks.length}</div>
                      </div>
                      <div className="space-y-0.5">
                        {area.tasks.map((t) => {
                          const tDone = acsMet.has(t)
                          return (
                            <div key={t} className={`text-[10px] flex items-center gap-1.5 ${tDone ? 'text-green-400/80' : 'text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${tDone ? 'bg-green-400' : 'bg-slate-600'}`} />
                              {t}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hour requirements — compact */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
              <h3 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Hours ({metCount}/{reqs.length} met)</h3>
              <div className="space-y-1.5">
                {reqs.map((r) => {
                  const pct = r.pct ?? Math.min(100, Math.round((r.actual / r.min) * 100))
                  const met = r.actual >= r.min
                  return (
                    <div key={r.label} className="flex items-center gap-2">
                      <div className="flex-1 text-[10px] text-slate-400 truncate">{r.label}</div>
                      <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${met ? 'bg-green-400' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={`text-[10px] w-14 text-right ${met ? 'text-green-400' : 'text-slate-500'}`}>{r.actual}/{r.min}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Documents — compact */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
              <h3 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Documents</h3>
              <div className="space-y-1">
                {DOC_FIELDS.map((df) => {
                  const doc = student.docs[df.key]
                  if (!doc) return null
                  const es = df.showExpiry ? expiryStatus(doc.expiry) : null
                  return (
                    <div key={df.key} className="flex items-center justify-between text-[10px]">
                      <span className={es ? EXPIRY_COLOR[es] : 'text-slate-400'}>{df.label}</span>
                      <span className={`${es ? EXPIRY_COLOR[es] : 'text-slate-600'}`}>{doc.uploaded ? '✓' : '—'} {df.showExpiry && doc.expiry ? expiryLabel(doc.expiry) : doc.score ? `Score: ${doc.score}` : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Block hours — compact */}
            {student.blockHoursPurchased > 0 && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Block Hours</span>
                  <span className="text-green-400">{(student.blockHoursPurchased - student.blockHoursUsed).toFixed(1)} remaining</span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(student.blockHoursUsed / student.blockHoursPurchased) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── FOOTER ─── */
function FooterSection() {
  return (
    <footer className="bg-surface-card border-t border-surface-border py-12 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h4 className="text-white font-bold text-lg mb-2">Journeys Aviation</h4>
          <p className="text-slate-400 text-sm leading-relaxed">{JB_INFO.address}</p>
          <p className="text-slate-400 text-sm">{JB_INFO.airport}</p>
          <p className="text-slate-400 text-sm mt-2">{JB_INFO.hours}</p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-2">Contact</h4>
          <p className="text-slate-300 text-sm">FBO: {JB_INFO.phone}</p>
          <p className="text-slate-300 text-sm">Maintenance: {JB_INFO.maintenancePhone}</p>
          <p className="text-slate-300 text-sm">{JB_INFO.email}</p>
          <div className="flex gap-3 mt-3">
            <a href={JB_INFO.facebook} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">Facebook</a>
            <a href={JB_INFO.linkedin} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">LinkedIn</a>
            <a href={JB_INFO.yelp} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">Yelp</a>
            <a href={JB_INFO.website} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-sm hover:text-sky-300">Website</a>
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold mb-2">Resources</h4>
          <div className="space-y-1">
            {JB_RESOURCES.slice(0, 6).map((r) => (
              <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-400 text-sm block transition-colors">{r.label} ↗</a>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-surface-border text-center text-slate-600 text-xs">
        © {new Date().getFullYear()} Journeys Aviation, Inc. · Boulder, Colorado · KBDU
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE — Full-screen client portal
   ═══════════════════════════════════════════════════════════ */
const JB_USER_KEY = 'journeys_user'

export function JourneysBoulder() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(JB_USER_KEY)) } catch { return null }
  })
  const [showLogin, setShowLogin] = useState(false)
  const [bookingAircraft, setBookingAircraft] = useState(null)
  const [squawkTail, setSquawkTail] = useState(null)
  const [squawkVersion, setSquawkVersion] = useState(0) // bumped when squawk submitted to re-render panels
  useEffect(() => { const u = subscribeSquawks(() => setSquawkVersion((v) => v + 1)); return u }, [])

  const isStudent = user?.role === 'student'

  const scrollTo = (id) => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogin = (persona) => {
    setUser(persona)
    localStorage.setItem(JB_USER_KEY, JSON.stringify(persona))
    setShowLogin(false)
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <TopNav onSection={scrollTo} user={user} onLoginClick={() => setShowLogin(true)} onLogout={() => { setUser(null); localStorage.removeItem(JB_USER_KEY) }} />

      {isStudent ? (
        <>
          <StudentDashboard user={user} />
          {user && <ScheduleSection user={user} selectedAircraft={bookingAircraft} onSelectAircraft={setBookingAircraft} onClearAircraft={() => setBookingAircraft(null)} />}
          {user && <MyFleetSection key={squawkVersion} user={user} onSquawk={setSquawkTail} />}
          <MiniGalleryStrip category="fleet" />
          <FleetSection user={user} onBookAircraft={setBookingAircraft} onSquawk={setSquawkTail} squawkVersion={squawkVersion} />
          {squawkTail && user && <SquawkPanel tailNumber={squawkTail} user={user} onClose={() => setSquawkTail(null)} />}
          <MiniGalleryStrip category="scenery" />
          <OperationsSection />
          <FooterSection />
        </>
      ) : (
        <>
          <HeroSection />
          {user && <div className="px-4 sm:px-6 pb-6"><div className="max-w-6xl mx-auto"><RecentFlightBox user={user} /></div></div>}
          {user && <MyFleetSection key={squawkVersion} user={user} onSquawk={setSquawkTail} />}
          <MiniGalleryStrip category="fleet" />
          <FleetSection user={user} onBookAircraft={setBookingAircraft} onSquawk={setSquawkTail} squawkVersion={squawkVersion} />
          {squawkTail && user && <SquawkPanel tailNumber={squawkTail} user={user} onClose={() => setSquawkTail(null)} />}
          {user && <ScheduleSection user={user} selectedAircraft={bookingAircraft} onSelectAircraft={setBookingAircraft} onClearAircraft={() => setBookingAircraft(null)} />}
          <MiniGalleryStrip category="training" />
          <TrainingSection />
          <MiniGalleryStrip category="fbo" />
          <MaintenanceSection user={user} />
          <MiniGalleryStrip category="fbo" />
          <FBOSection />
          <MiniGalleryStrip category="scenery" />
          <OperationsSection />
          <MiniGalleryStrip category="flights" />
          <GallerySection />
          <TeamSection />
          <FooterSection />
        </>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
    </div>
  )
}
