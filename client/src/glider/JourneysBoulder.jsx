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
import { addServiceRequest } from '../store/serviceRequests'
import { addFlight, updateFlight as updateStoreFlight, getAllFlights, subscribe } from '../store/flights'
import { mockStudents, PROGRAMS, mockBookings, SCHEDULE_DAYS, SCHEDULE_SLOTS } from '../training/mockTraining'
import {
  requirementProgress, metRequirementCount, stageProgress, isCheckrideReady,
  recommendLessons, expiryStatus, expiryLabel, EXPIRY_COLOR, EXPIRY_BG,
  DPE_STATUS_LABEL, DPE_STATUS_COLOR, DPE_STATUS_BG,
  BOOKING_TYPE_COLORS, BOOKING_TYPE_LABELS, WEATHER_FIT_COLORS, WEATHER_FIT_LABELS,
  calcTrainingWB, wbStatusLevel, WB_STATUS,
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
  { id: 'student-1', name: 'Tyler Mason', role: 'student', label: 'Student Pilot', email: 'tyler@example.com',
    aircraft: ['N52993', 'N12JA'], hours: 28, weightLbs: 175, preferredCfis: ['prs-018', 'prs-017'],
    cert: 'student', ratings: [], endorsements: [],
  },
  { id: 'renter-1', name: 'Maria Vasquez', role: 'renter', label: 'Private Pilot / Renter', email: 'maria@example.com',
    aircraft: ['N733JM', 'N3547L', 'N401SS'], hours: 310, weightLbs: 145,
    cert: 'private', ratings: ['asel'], endorsements: ['hp'],
  },
  { id: 'renter-2', name: 'Jake Rosen', role: 'renter', label: 'Instrument-Rated Private', email: 'jake@example.com',
    aircraft: ['N6694E', 'N3547L'], hours: 480, weightLbs: 190,
    cert: 'private', ratings: ['asel', 'instrument'], endorsements: ['hp', 'complex'],
  },
  { id: 'mx-client-1', name: 'Dave Kowalski', role: 'mx_client', label: 'Maintenance Client / Owner', email: 'dave@example.com',
    hours: 1200, weightLbs: 195,
    cert: 'commercial', ratings: ['asel', 'amel', 'instrument'], endorsements: ['hp', 'complex', 'tailwheel'],
    ownedAircraft: [
      { tail: 'N789DK', type: 'Cessna 182Q Skylane', agents: ['Dave Kowalski', 'Lisa Kowalski'] },
      { tail: 'N421PB', type: 'Piper PA-28-180 Cherokee', agents: ['Dave Kowalski'] },
    ],
  },
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

function MiniGalleryStrip({ category, shuffle = true }) {
  const items = useMemo(() => {
    let pool = category ? JB_GALLERY.filter((g) => g.category === category) : [...JB_GALLERY]
    if (pool.length < 3) pool = [...JB_GALLERY] // fallback to all
    if (shuffle) pool.sort(() => Math.random() - 0.5)
    return pool
  }, [category, shuffle])

  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setOffset((o) => (o + 1) % Math.max(items.length - 2, 1)), 5000)
    return () => clearInterval(id)
  }, [items.length])

  const visible = [items[offset % items.length], items[(offset + 1) % items.length], items[(offset + 2) % items.length]]

  return (
    <div className="py-6 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-3">
        {visible.map((img, i) => (
          <div key={`${img.id}-${offset}-${i}`} className="relative aspect-[16/7] rounded-xl overflow-hidden animate-[fadeIn_1s_ease-in-out]">
            <div className={`absolute inset-0 bg-gradient-to-br ${GALLERY_GRADIENTS[(img.id - 1 + offset) % GALLERY_GRADIENTS.length]} transition-all duration-1000`}>
              <div className="absolute inset-0 opacity-25">
                <div className="absolute top-[25%] left-[15%] w-[50%] h-[2px] bg-white/40 rounded-full rotate-[-3deg]" />
                <div className="absolute top-[45%] left-[25%] w-[35%] h-[1.5px] bg-white/25 rounded-full rotate-[1deg]" />
              </div>
            </div>
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
  const fleet = getAircraftByOperator('journeys')
  const [tab, setTab] = useState('squawk')
  const [squawkForm, setSquawkForm] = useState({ tailNumber: '', severity: 'monitoring', description: '' })
  const [annualForm, setAnnualForm] = useState({ tailNumber: '', preferredDate: '', notes: '' })
  const [mxForm, setMxForm] = useState({ tailNumber: '', serviceType: 'annual', description: '', preferredDate: '' })
  const [submitted, setSubmitted] = useState(null) // 'squawk' | 'annual' | 'mx'

  const ownedTails = (user.ownedAircraft || []).map((a) => a.tail)
  const tailOptions = [...ownedTails, ...fleet.map((a) => a.tailNumber)]

  const handleSquawk = (e) => {
    e.preventDefault()
    addSquawk({
      id: `sqk-ja-${Date.now()}`,
      tailNumber: squawkForm.tailNumber,
      reportedBy: user.name,
      reportedDate: new Date().toISOString().split('T')[0],
      description: squawkForm.description,
      severity: squawkForm.severity,
      status: 'open',
      melReference: null, melExpiryDate: null, airframeHours: null,
      resolvedDate: null, resolvedBy: null, resolutionNotes: null, workOrderId: null,
    })
    setSubmitted('squawk')
    setSquawkForm({ tailNumber: '', severity: 'monitoring', description: '' })
  }

  const handleAnnual = (e) => {
    e.preventDefault()
    addServiceRequest({
      id: `sr-ja-${Date.now()}`,
      type: 'annual_inspection',
      tailNumber: annualForm.tailNumber,
      requestedBy: user.name,
      requestedDate: new Date().toISOString().split('T')[0],
      preferredDate: annualForm.preferredDate,
      notes: annualForm.notes,
      status: 'requested',
      operator: 'journeys',
    })
    setSubmitted('annual')
    setAnnualForm({ tailNumber: '', preferredDate: '', notes: '' })
  }

  const handleMx = (e) => {
    e.preventDefault()
    addServiceRequest({
      id: `sr-ja-${Date.now()}`,
      type: mxForm.serviceType,
      tailNumber: mxForm.tailNumber,
      requestedBy: user.name,
      requestedDate: new Date().toISOString().split('T')[0],
      preferredDate: mxForm.preferredDate,
      description: mxForm.description,
      status: 'requested',
      operator: 'journeys',
    })
    setSubmitted('mx')
    setMxForm({ tailNumber: '', serviceType: 'annual', description: '', preferredDate: '' })
  }

  if (submitted) {
    const msgs = {
      squawk: 'Squawk submitted! Our maintenance team will review it within 24 hours.',
      annual: 'Annual inspection request submitted! We\'ll confirm scheduling within 48 hours.',
      mx: 'Maintenance request submitted! We\'ll contact you to confirm details.',
    }
    return (
      <section id="sec-maintenance" className="py-20 px-6 bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-md mx-auto text-center py-12">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-white mb-2">Request Received</h3>
            <p className="text-slate-300 text-sm mb-6">{msgs[submitted]}</p>
            <button onClick={() => setSubmitted(null)} className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-2 rounded-xl text-sm transition-colors">Submit Another</button>
          </div>
        </div>
      </section>
    )
  }

  const tabs = [
    { id: 'squawk', label: 'Report a Squawk', icon: '🔧' },
    { id: 'annual', label: 'Schedule Annual', icon: '📋' },
    { id: 'mx', label: 'Maintenance Request', icon: '🛠️' },
  ]

  return (
    <section id="sec-maintenance" className="py-20 px-6 bg-gradient-to-b from-surface via-surface-card/30 to-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Aircraft Maintenance</h2>
          <p className="text-slate-400">A&P, IA, and Rotax iRMT certified · Submit requests below</p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-2 justify-center mb-8">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-surface-card border border-surface-border text-slate-400 hover:text-white'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="max-w-lg mx-auto">
          {/* Squawk form */}
          {tab === 'squawk' && (
            <form onSubmit={handleSquawk} className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Report a Squawk</h3>
                <p className="text-slate-400 text-xs">Report a mechanical issue, discrepancy, or concern</p>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Aircraft</label>
                <select required value={squawkForm.tailNumber} onChange={(e) => setSquawkForm((f) => ({ ...f, tailNumber: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                  <option value="">Select aircraft</option>
                  {tailOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Severity</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'grounding', l: 'Grounding', c: 'border-red-400/40 text-red-400' },
                    { v: 'ops_limiting', l: 'Ops Limiting', c: 'border-amber-400/40 text-amber-400' },
                    { v: 'deferred', l: 'Deferred / MEL', c: 'border-yellow-400/40 text-yellow-400' },
                    { v: 'monitoring', l: 'Monitoring', c: 'border-slate-400/40 text-slate-400' },
                  ].map((s) => (
                    <button type="button" key={s.v} onClick={() => setSquawkForm((f) => ({ ...f, severity: s.v }))}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                        squawkForm.severity === s.v ? `bg-sky-500/20 border-sky-400 text-sky-400` : `bg-surface ${s.c} hover:bg-surface-card`
                      }`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Description</label>
                <textarea required rows={3} placeholder="Describe the issue..." value={squawkForm.description}
                  onChange={(e) => setSquawkForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500 text-[10px]">Reporting as: {user.name}</span>
                <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">Submit Squawk</button>
              </div>
            </form>
          )}

          {/* Schedule annual */}
          {tab === 'annual' && (
            <form onSubmit={handleAnnual} className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Schedule Annual Inspection</h3>
                <p className="text-slate-400 text-xs">Annual, 100-hour, conditional, or pre-buy — we'll coordinate timing</p>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Aircraft</label>
                <select required value={annualForm.tailNumber} onChange={(e) => setAnnualForm((f) => ({ ...f, tailNumber: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                  <option value="">Select aircraft</option>
                  {tailOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Preferred Date</label>
                <input type="date" required value={annualForm.preferredDate} onChange={(e) => setAnnualForm((f) => ({ ...f, preferredDate: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Notes (optional)</label>
                <textarea rows={2} placeholder="Any specific concerns, AD compliance, etc." value={annualForm.notes}
                  onChange={(e) => setAnnualForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
              </div>
              <div className="bg-surface border border-surface-border rounded-xl p-3 text-xs text-slate-400 space-y-1">
                <div>📞 Maintenance: <span className="text-sky-400">{JB_INFO.maintenancePhone}</span></div>
                <div>✓ A&P and IA on staff · Rotax iRMT certified</div>
                <div>✓ ROTAX Independent Repair Centre (iRC)</div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500 text-[10px]">Requesting as: {user.name}</span>
                <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">Request Annual</button>
              </div>
            </form>
          )}

          {/* General maintenance request */}
          {tab === 'mx' && (
            <form onSubmit={handleMx} className="bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Submit Maintenance Request</h3>
                <p className="text-slate-400 text-xs">Oil change, avionics install, pre-buy inspection, or any service</p>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Aircraft</label>
                <select required value={mxForm.tailNumber} onChange={(e) => setMxForm((f) => ({ ...f, tailNumber: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                  <option value="">Select aircraft</option>
                  {tailOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Service Type</label>
                <select value={mxForm.serviceType} onChange={(e) => setMxForm((f) => ({ ...f, serviceType: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                  <option value="annual">Annual Inspection</option>
                  <option value="100hr">100-Hour Inspection</option>
                  <option value="conditional">Conditional Inspection</option>
                  <option value="prebuy">Pre-Buy Inspection</option>
                  <option value="oil_change">Oil Change</option>
                  <option value="avionics">Avionics Install / Repair</option>
                  <option value="engine">Engine Work</option>
                  <option value="airframe">Airframe Repair</option>
                  <option value="rotax">Rotax Service</option>
                  <option value="slsa">SLSA Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Description</label>
                <textarea required rows={3} placeholder="Describe the work needed..." value={mxForm.description}
                  onChange={(e) => setMxForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Preferred Date (optional)</label>
                <input type="date" value={mxForm.preferredDate} onChange={(e) => setMxForm((f) => ({ ...f, preferredDate: e.target.value }))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500 text-[10px]">Requesting as: {user.name}</span>
                <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">Submit Request</button>
              </div>
            </form>
          )}
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

function ScheduleSection({ user, selectedAircraft, onClearAircraft }) {
  const cfiList = mockPersonnel.filter((p) => p.cfiCert)
  const fleet = getAircraftByOperator('journeys')
  const preferredCfis = user.preferredCfis || []
  const ownedAircraft = user.ownedAircraft || []

  const BOOKINGS_KEY = `journeys_bookings_${user.id}`
  const loadBookings = () => { try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]') } catch { return [] } }

  const [acMode, setAcMode] = useState(selectedAircraft ? 'fleet' : 'ground')
  const [ownTail, setOwnTail] = useState(ownedAircraft[0]?.tail || '')
  const [sessionType, setSessionType] = useState('')
  const [flightMode, setFlightMode] = useState('dual') // 'dual' | 'solo'
  const [selectedCfi, setSelectedCfi] = useState('')
  const [durationHalfHours, setDurationHalfHours] = useState(4) // default 2 hrs = 4 half-hours
  const [bookings, setBookings] = useState(loadBookings)
  const [editingBooking, setEditingBooking] = useState(null)
  const [toast, setToast] = useState(null)
  const [xcRoute, setXcRoute] = useState('KBDU')
  const [xcFuelGal, setXcFuelGal] = useState('')

  // Persist bookings to localStorage whenever they change
  useEffect(() => { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings)) }, [bookings, BOOKINGS_KEY])

  useEffect(() => { if (selectedAircraft) setAcMode('fleet') }, [selectedAircraft])

  const durationHrs = durationHalfHours / 2
  const session = CFI_SESSION_TYPES.find((s) => s.id === sessionType)

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
    const maxDur = acFreeSlots
    if (acMode === 'ground' || acMode === 'own' || (acMode === 'fleet' && selectedAircraft)) {
      const targets = selectedCfi ? cfiList.filter((c) => c.id === selectedCfi) : cfiList
      const available = []
      for (const cfi of targets) {
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

  const buildLabel = (cfiId) => {
    const cfi = cfiList.find((c) => c.id === cfiId)
    const parts = []
    if (selectedAircraft) parts.push(selectedAircraft.tailNumber)
    else if (acMode === 'own' && ownTail) parts.push(ownTail)
    else if (acMode === 'ground') parts.push('Ground')
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
    const label = buildLabel(cfiId)
    const booking = {
      id: `bk-ja-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dayIdx, slot, duration: actualHrs,
      cfiId: cfiId || null,
      aircraftId: activeAircraftId,
      aircraftLabel: selectedAircraft?.tailNumber || (acMode === 'own' ? ownTail : acMode === 'ground' ? 'Ground' : null),
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
    const ac = selectedAircraft || (acMode === 'own' && ownTail ? { tailNumber: ownTail, makeModel: ownedAircraft.find((a) => a.tail === ownTail)?.type || ownTail } : null)
    const tail = ac?.tailNumber || booking.aircraftLabel
    const hasFlight = tail && tail !== 'Ground' && tail !== 'GND'
    if (hasFlight) {
      const cfi = cfiId ? cfiList.find((c) => c.id === cfiId) : null
      // Build a departure time from dayIdx + slot
      // Compute real date from schedule dayIdx relative to current week's Monday
      const now = new Date()
      const todayDow = now.getDay() // 0=Sun..6=Sat
      const mondayOffset = todayDow === 0 ? -6 : 1 - todayDow
      const baseDate = new Date(now)
      baseDate.setDate(now.getDate() + mondayOffset + dayIdx)
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
          <p className="text-slate-400 text-base sm:text-lg">Book aircraft, CFI sessions, ground school, or fly your own</p>
        </div>

        {/* ── Mode cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button onClick={() => { setAcMode('fleet'); if (!selectedAircraft) onClearAircraft?.() }}
            className={`p-4 sm:p-5 rounded-2xl text-left transition-all border ${acMode === 'fleet' ? 'bg-sky-500/15 border-sky-400 ring-1 ring-sky-400/30' : 'bg-surface-card border-surface-border hover:border-slate-500'}`}>
            <div className="text-xl sm:text-2xl mb-1">✈️</div>
            <div className={`text-sm sm:text-base font-bold ${acMode === 'fleet' ? 'text-sky-400' : 'text-white'}`}>Fleet Aircraft</div>
            <div className="text-xs text-slate-400 mt-0.5">{selectedAircraft ? selectedAircraft.tailNumber : 'Select above ↑'}</div>
          </button>
          <button onClick={() => { setAcMode('ground'); onClearAircraft?.() }}
            className={`p-4 sm:p-5 rounded-2xl text-left transition-all border ${acMode === 'ground' ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/30' : 'bg-surface-card border-surface-border hover:border-slate-500'}`}>
            <div className="text-xl sm:text-2xl mb-1">📚</div>
            <div className={`text-sm sm:text-base font-bold ${acMode === 'ground' ? 'text-amber-400' : 'text-white'}`}>Ground Session</div>
            <div className="text-xs text-slate-400 mt-0.5">No aircraft</div>
          </button>
          <button onClick={() => { setAcMode('own'); onClearAircraft?.() }}
            className={`p-4 sm:p-5 rounded-2xl text-left transition-all border ${acMode === 'own' ? 'bg-purple-500/15 border-purple-400 ring-1 ring-purple-400/30' : 'bg-surface-card border-surface-border hover:border-slate-500'}`}>
            <div className="text-xl sm:text-2xl mb-1">🛩️</div>
            <div className={`text-sm sm:text-base font-bold ${acMode === 'own' ? 'text-purple-400' : 'text-white'}`}>Own Aircraft</div>
            <div className="text-xs text-slate-400 mt-0.5">Bring your plane</div>
          </button>
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-card border border-surface-border">
            <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">Duration</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => adjustDuration(-1)} className="w-9 h-9 rounded-full bg-surface border border-surface-border text-slate-300 hover:text-white hover:border-sky-400 text-lg font-bold transition-all">−</button>
              <div className="text-center min-w-[60px]">
                <div className="text-white text-2xl font-bold">{durationHrs}</div>
                <div className="text-slate-500 text-[10px]">hours</div>
              </div>
              <button onClick={() => adjustDuration(1)} className="w-9 h-9 rounded-full bg-surface border border-surface-border text-slate-300 hover:text-white hover:border-sky-400 text-lg font-bold transition-all">+</button>
            </div>
          </div>
        </div>

        {/* Airworthiness warnings */}
        {acMode === 'fleet' && selectedAircraft && !acAirworthy && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="text-red-400 font-bold text-sm">{selectedAircraft.tailNumber} is not airworthy</div>
              <div className="text-red-400/70 text-xs">Bookings will be flagged as STANDBY pending return to service. Check maintenance status.</div>
            </div>
          </div>
        )}
        {acMode === 'fleet' && selectedAircraft && acAirworthy && acInspectionDue && (
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="text-amber-400 font-bold text-sm">{selectedAircraft.tailNumber} — inspection {selectedAircraft.inspectionStatus === 'overdue' ? 'overdue' : 'due soon'}</div>
              <div className="text-amber-400/70 text-xs">Aircraft may become unavailable. Bookings are subject to change.</div>
            </div>
          </div>
        )}

        {/* Own aircraft selector */}
        {acMode === 'own' && (
          <div className="mb-6">
            {ownedAircraft.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ownedAircraft.map((a) => (
                  <button key={a.tail} onClick={() => setOwnTail(a.tail)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${ownTail === a.tail ? 'bg-purple-500/20 border-purple-400 text-purple-400' : 'bg-surface border-surface-border text-slate-300 hover:border-slate-500'}`}>
                    {a.tail} — {a.type}
                  </button>
                ))}
              </div>
            ) : (
              <input type="text" placeholder="Tail number e.g. N789DK" value={ownTail} onChange={(e) => setOwnTail(e.target.value)}
                className="w-full sm:w-64 bg-surface border border-surface-border rounded-xl px-4 py-3 text-base text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
            )}
          </div>
        )}

        {/* ── Aircraft suitability message ── */}
        {acMode === 'fleet' && selectedAircraft && (() => {
          const suit = aircraftSuitabilityMessage(selectedAircraft)
          if (!suit) return null
          return (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-6 text-sm">
              <div className="text-slate-300">
                <span className="text-white font-semibold">{selectedAircraft.tailNumber}</span> suitable for:{' '}
                <span className="text-green-400">{suit.capabilities.join(', ')}</span>
              </div>
              {suit.limitations.length > 0 && (
                <div className="text-amber-400/70 text-xs mt-1">
                  Limitations: {suit.limitations.join(' · ')}
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Dual / Solo toggle ── */}
        {acMode !== 'ground' && (
          <div className="mb-6">
            <label className="text-slate-400 text-sm block mb-2">Flight Mode</label>
            <div className="flex gap-2">
              <button onClick={() => setFlightMode('dual')}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  flightMode === 'dual' ? 'bg-sky-500/20 border-sky-400 text-sky-400' : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'
                }`}>
                👨‍✈️ Dual (with CFI)
              </button>
              <button onClick={() => setFlightMode('solo')}
                disabled={acMode !== 'fleet' || (activeSession && !activeSession.allowSolo)}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  flightMode === 'solo' ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'
                } disabled:opacity-30 disabled:cursor-not-allowed`}>
                🧑‍✈️ Solo
              </button>
            </div>
            {flightMode === 'solo' && <p className="text-amber-400/70 text-xs mt-1">Solo requires CFI endorsement in logbook before flight.</p>}
          </div>
        )}

        {/* ── Session type + CFI ── */}
        {(() => {
          const availSessions = getAvailableSessions(user, acMode === 'fleet' ? selectedAircraft : null)
          const autoCfi = activeSession ? bestCfiForSession(activeSession, cfiList, preferredCfis) : null

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div>
                <label className="text-slate-400 text-sm block mb-2">
                  Flight Type
                  <span className="text-slate-600 text-xs ml-2">({availSessions.length} for {user.cert === 'student' ? 'student' : user.cert} pilot)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button onClick={() => { setSessionType(''); setSelectedCfi('') }}
                    className={`p-3 rounded-xl text-sm transition-all border ${!sessionType ? 'bg-sky-500/20 border-sky-400 text-sky-400' : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'}`}>
                    <div className="font-semibold">Open</div>
                  </button>
                  {availSessions.map((s) => {
                    const needsCfii = s.requiresCfii
                    const needsSpecialAc = s.requiresHpAc || s.requiresTwAc || s.requiresComplexAc || s.requiresIfrAc
                    return (
                      <button key={s.id} onClick={() => {
                          setSessionType(s.id)
                          // Auto-select best qualified CFI for this session
                          const best = bestCfiForSession(s, cfiList, preferredCfis)
                          if (best) setSelectedCfi(best)
                        }}
                        className={`p-3 rounded-xl text-sm text-left transition-all border ${sessionType === s.id ? 'bg-sky-500/20 border-sky-400 text-sky-400' : 'bg-surface border-surface-border text-slate-300 hover:border-slate-500'}`}>
                        <div className="font-semibold text-xs">{s.label}</div>
                        {(needsCfii || needsSpecialAc) && (
                          <div className="flex gap-1 mt-0.5">
                            {needsCfii && <span className="text-[8px] bg-indigo-400/15 text-indigo-400 px-1 rounded">CFII</span>}
                            {s.requiresHpAc && <span className="text-[8px] bg-amber-400/15 text-amber-400 px-1 rounded">HP</span>}
                            {s.requiresTwAc && <span className="text-[8px] bg-amber-400/15 text-amber-400 px-1 rounded">TW</span>}
                            {s.requiresIfrAc && <span className="text-[8px] bg-sky-400/15 text-sky-400 px-1 rounded">IFR</span>}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                {flightMode === 'dual' ? (
                  <>
                    <label className="text-slate-400 text-sm block mb-2">
                      Instructor
                      {activeSession?.requiresCfii && <span className="text-indigo-400 text-xs ml-1">(CFII required)</span>}
                      {activeSession?.requiresMei && <span className="text-indigo-400 text-xs ml-1">(MEI required)</span>}
                      {activeSession?.requiresStageCheckAuth && <span className="text-amber-400 text-xs ml-1">(Chief / Senior CFI)</span>}
                      {activeSession && !activeSession.requiresCfii && !activeSession.requiresMei && !activeSession.requiresStageCheckAuth && (
                        <span className="text-sky-400/60 text-xs ml-1">— {activeSession.label}</span>
                      )}
                    </label>
                    <select value={selectedCfi || autoCfi || ''} onChange={(e) => setSelectedCfi(e.target.value)}
                      className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-base text-slate-200 focus:border-sky-400 focus:outline-none">
                      <option value="">Any qualified CFI</option>
                      {cfiList.filter((c) => cfiQualifiedForSession(c, activeSession)).map((c) => (
                        <option key={c.id} value={c.id}>{c.name} — {(c.cfiRatings || []).join(', ')}{preferredCfis.includes(c.id) ? ' ★' : ''}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-4 mt-7">
                    <div className="text-amber-400 font-semibold text-sm">Solo Flight</div>
                    <div className="text-amber-400/70 text-xs mt-1">No instructor — all open aircraft slots are bookable. CFI endorsement must be in your logbook.</div>
                  </div>
                )}
              </div>
            </div>
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

        {/* ── Half-hour grid — CSS-grid with absolutely-positioned booking blocks ── */}
        {(() => {
          const ROW_H = 36 // px per half-hour row
          const HEADER_H = 36
          const totalRows = HALF_HOUR_SLOTS.length
          const gridH = totalRows * ROW_H

          // Today highlight: map JS day (0=Sun..6=Sat) → schedule dayIdx (0=Mon..5=Sat)
          const jsDay = new Date().getDay() // 0=Sun..6=Sat
          const todayDayIdx = jsDay === 0 ? -1 : jsDay - 1 // Sun → -1 (not on grid), Mon=0..Sat=5

          // Current time → pixel position within the grid
          const nowH = new Date().getHours()
          const nowM = new Date().getMinutes()
          const nowMinutes = nowH * 60 + nowM
          const gridStartMin = 7 * 60 // 07:00
          const gridEndMin = 17.5 * 60 // 17:30
          const nowPx = nowMinutes >= gridStartMin && nowMinutes <= gridEndMin
            ? ((nowMinutes - gridStartMin) / 30) * ROW_H
            : null

          return (
            <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
              <div className="min-w-[700px] px-4 sm:px-0">
                {/* Day headers */}
                <div className="grid gap-0.5" style={{ gridTemplateColumns: '60px repeat(6, 1fr)', height: HEADER_H }}>
                  <div />
                  {SCHEDULE_DAYS.map((d, i) => (
                    <div key={i} className={`flex items-center justify-center text-xs sm:text-sm font-semibold rounded-lg ${
                      i === todayDayIdx ? 'bg-sky-500/20 text-sky-300' : 'text-slate-300'
                    }`}>{d}{i === todayDayIdx ? ' ●' : ''}</div>
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
                  {SCHEDULE_DAYS.map((_, dayIdx) => {
                    // Find bookings in this day column
                    const dayBookings = bookings.filter((b) => b.dayIdx === dayIdx)
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

        {/* ── Bookings list ── */}
        {(bookings.length > 0 || userExisting.length > 0) && (
          <div className="space-y-4">
            <h3 className="text-white text-xl sm:text-2xl font-bold">Your Schedule</h3>

            {bookings.length > 0 && (
              <div className="bg-green-400/8 border border-green-400/20 rounded-2xl p-4 sm:p-5">
                <h4 className="text-green-400 text-xs font-bold uppercase tracking-wide mb-3">New Bookings</h4>
                <div className="space-y-2">
                  {bookings.map((b) => {
                    const cfi = cfiList.find((c) => c.id === b.cfiId)
                    return (
                      <button key={b.id} onClick={() => setEditingBooking(b.id)}
                        className={`w-full flex items-center justify-between bg-surface/50 border rounded-xl px-4 py-3 text-left transition-colors ${
                          b.standby ? 'border-amber-400/30 hover:border-amber-400/50' : 'border-surface-border hover:border-green-400/40'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.standby ? 'bg-amber-400' : 'bg-green-400'}`} />
                          <div>
                            <div className="text-white text-sm font-medium">
                              {b.standby && <span className="text-amber-400 text-[10px] font-bold uppercase mr-1">STANDBY</span>}
                              {b.title}
                            </div>
                            <div className="text-slate-400 text-xs">
                              {SCHEDULE_DAYS[b.dayIdx]} {slotLabel(b.slot)} · {b.duration} hr
                              {b.xcRoute && <span className="text-sky-400/70"> · {b.xcRoute}</span>}
                              {b.xcFuelGal && <span className="text-slate-500"> · {b.xcFuelGal} gal</span>}
                              {b.notes && <span className="text-slate-500"> · "{b.notes}"</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-sky-400 text-xs flex-shrink-0 ml-2">Edit</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {userExisting.length > 0 && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-4 sm:p-5">
                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-3">Existing Schedule</h4>
                <div className="space-y-2">
                  {userExisting.map((b) => {
                    const cfi = cfiList.find((c) => c.id === b.cfiId)
                    const ac = b.aircraftId ? (fleet.find((a) => a.id === b.aircraftId) || mockAircraft.find((a) => a.id === b.aircraftId)) : null
                    return (
                      <div key={b.id} className="flex items-center gap-3 bg-surface/50 border border-surface-border rounded-xl px-4 py-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 flex-shrink-0" />
                        <div>
                          <div className="text-white text-sm font-medium">{b.title}</div>
                          <div className="text-slate-400 text-xs">
                            {SCHEDULE_DAYS[b.day ?? b.dayIdx]} {b.slot} · {b.duration} hr
                            {ac ? ` · ${ac.tailNumber}` : ''}
                            {cfi ? ` · ${cfi.name}` : ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

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
  const navItems = user
    ? ['fleet', 'schedule', 'training', 'maintenance', 'fbo', 'operations', 'gallery', 'about']
    : ['fleet', 'training', 'fbo', 'operations', 'gallery', 'about']

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight">Journeys Aviation</span>
          <div className="hidden md:flex items-center gap-4">
            {navItems.map((s) => (
              <button key={s} onClick={() => onSection(s)} className="text-white/70 hover:text-white text-xs uppercase tracking-wide transition-colors capitalize">{s}</button>
            ))}
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

function FleetSection({ user, onBookAircraft }) {
  const fleet = getAircraftByOperator('journeys')
  const [expanded, setExpanded] = useState(null)
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

            // Use evaluation-based styling when user has input, otherwise default airworthy style
            const cardBg = hasInput && evaluation ? es.bg : (ac.airworthy ? 'bg-surface-card' : 'bg-red-400/8')
            const cardBorder = hasInput && evaluation ? es.border : (ac.airworthy ? 'border-surface-border' : 'border-red-400/30')
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
                    {rates.member != null && (
                      <div className="text-green-400 font-bold text-lg">${rates.member}</div>
                    )}
                    {/* W&B status badge or airworthy dot */}
                    {hasInput && evaluation ? (
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${es.badge}`}>{es.label}</span>
                    ) : (
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={`w-2 h-2 rounded-full ${ac.airworthy ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className={`text-[10px] font-medium ${ac.airworthy ? 'text-green-400' : 'text-red-400'}`}>{ac.airworthy ? 'Airworthy' : 'Grounded'}</span>
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
                  </div>
                )}

                {/* Select for scheduling */}
                {user && ac.airworthy && ac.fboCategory !== 'sim' && (
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
              <div className={`absolute inset-0 bg-gradient-to-br ${gradients[(img.id - 1) % gradients.length]} transition-transform group-hover:scale-110 duration-500`} />
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

function StudentDashboard({ user }) {
  // Map logged-in persona to a mock student (or default to Tyler Mason — the beginner)
  const student = useMemo(() => {
    const byName = mockStudents.find((s) => s.name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()))
    return byName || mockStudents.find((s) => s.id === 'std-002') || mockStudents[0]
  }, [user.name])

  const program = PROGRAMS[student.program]
  const cfi = mockPersonnel.find((p) => p.id === student.assignedCfiId)
  const reqs = requirementProgress(student, student.program)
  const metCount = metRequirementCount(student, student.program)
  const progress = stageProgress(student, student.program)
  const checkrideReady = isCheckrideReady(student)

  // Lesson recommendations
  const [skippedSlots, setSkippedSlots] = useState(new Set())
  const [acceptedBookings, setAcceptedBookings] = useState([])
  const [acceptedIds, setAcceptedIds] = useState(new Set())
  const [toast, setToast] = useState(null)

  const allBookings = [...mockBookings, ...acceptedBookings]
  const recommendations = recommendLessons(student, mockPersonnel, mockAircraft, allBookings, skippedSlots)
    .filter((r) => !acceptedIds.has(r.template.id))

  const handleSkip = (rec) => {
    if (!rec.slot) return
    setSkippedSlots((prev) => new Set([...prev, `${rec.slot.dayIdx}:${rec.slot.slot}`]))
  }

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
    setToast(`✓ ${rec.template.title} booked — ${SCHEDULE_DAYS[rec.slot.dayIdx]} at ${rec.slot.slot}`)
    setTimeout(() => setToast(null), 4000)
  }

  const DOC_FIELDS = [
    { key: 'governmentId', label: 'Government ID', showExpiry: true },
    { key: 'insurance', label: "Renter's Insurance", showExpiry: true },
    { key: 'medicalCert', label: 'Medical Certificate', showExpiry: true },
    { key: 'studentPilotCert', label: 'Student Pilot Cert', showExpiry: false },
    { key: 'knowledgeTest', label: 'Knowledge Test', showExpiry: false },
  ]

  return (
    <section className="pt-20 pb-12 px-6 bg-surface min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-xl text-sm font-medium animate-[fadeIn_0.3s_ease]">
            {toast}
          </div>
        )}

        {/* ── Header: Welcome + progress overview ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Welcome back, {student.name.split(' ')[0]}</h1>
              <p className="text-slate-400 text-sm mt-1">{program?.name} — Stage {student.currentStage}/{program?.stages?.length || '?'}
                {cfi && <span className="text-slate-500"> · CFI: {cfi.name}</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {student.dpe && (
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${DPE_STATUS_BG[student.dpe.status]} ${DPE_STATUS_COLOR[student.dpe.status]}`}>
                  Checkride: {DPE_STATUS_LABEL[student.dpe.status]}
                </span>
              )}
              <div className="text-right">
                <div className="text-white font-bold text-xl">{student.hours.total} hrs</div>
                <div className="text-slate-500 text-[10px]">Total logged</div>
              </div>
            </div>
          </div>

          {/* Stage progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">Overall progress</span>
              <span className="text-sky-400 font-bold">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-surface-card border border-surface-border rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* ── Two-column: Next Lessons + Hours ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Next Lessons — 2 cols wide */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-white font-bold text-lg">Next Lessons</h2>
            {recommendations.length === 0 && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center text-slate-400">
                No lessons available right now — check back or call {JB_INFO.phone}
              </div>
            )}
            {recommendations.map((rec, i) => {
              const wb = rec.aircraft && student.weightLbs
                ? calcTrainingWB(rec.aircraft, student.weightLbs, cfi?.weightLbs || 180, rec.template.durationHr * (rec.aircraft.fuelBurnGalHr || 8))
                : null
              const wbLevel = wb ? wbStatusLevel(wb) : null
              const wbStyle = wbLevel ? WB_STATUS[wbLevel] : null
              return (
                <div key={i} className="bg-surface-card border border-surface-border rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BOOKING_TYPE_COLORS[rec.template.type] || 'bg-slate-400/20 text-slate-400'}`}>
                          {BOOKING_TYPE_LABELS[rec.template.type] || rec.template.type}
                        </span>
                        <span className="text-white font-bold">{rec.template.title}</span>
                        <span className="text-slate-500 text-xs">{rec.template.durationHr} hr</span>
                      </div>
                      <div className="text-slate-400 text-xs">
                        {rec.cfi && <span>CFI: {rec.cfi.name} · </span>}
                        {rec.aircraft && <span>{rec.aircraft.tailNumber} {rec.aircraft.makeModel} · </span>}
                        {rec.slot && <span>{SCHEDULE_DAYS[rec.slot.dayIdx]} {rec.slot.slot}</span>}
                      </div>
                    </div>
                    {rec.slot?.weather && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${WEATHER_FIT_COLORS[rec.weatherFit] || ''}`}>
                        {WEATHER_FIT_LABELS[rec.weatherFit] || rec.weatherFit}
                      </span>
                    )}
                  </div>

                  {/* W&B bar */}
                  {wb && (
                    <div className={`rounded-lg px-3 py-2 mb-3 text-[10px] border ${wbStyle?.bg || 'bg-surface'} ${wbStyle?.border || 'border-surface-border'}`}>
                      <div className="flex justify-between">
                        <span className="text-slate-400">W&B: {wb.totalWeight} / {wb.maxGross} lbs</span>
                        <span className={wbStyle?.text || 'text-slate-400'}>{wb.totalWeight <= wb.maxGross ? `+${wb.maxGross - wb.totalWeight} margin` : `OVER ${wb.totalWeight - wb.maxGross}`}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleSkip(rec)} className="text-xs text-slate-400 hover:text-white border border-surface-border px-4 py-2 rounded-xl transition-colors">Skip</button>
                    <button onClick={() => handleAccept(rec)} className="text-xs text-white bg-sky-500 hover:bg-sky-400 px-4 py-2 rounded-xl transition-colors font-medium">Accept & Book</button>
                  </div>
                </div>
              )
            })}

            {acceptedBookings.length > 0 && (
              <div className="bg-green-400/8 border border-green-400/20 rounded-2xl p-4">
                <h3 className="text-green-400 text-xs font-bold uppercase tracking-wide mb-2">Booked</h3>
                {acceptedBookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs text-slate-300 py-1">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="font-medium">{b.title}</span>
                    <span className="text-slate-500">{SCHEDULE_DAYS[b.dayIdx]} {b.slot}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar: Hours + Documents */}
          <div className="space-y-6">
            {/* Hour requirements */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-3">Hour Requirements <span className="text-slate-500 text-xs font-normal">({metCount}/{reqs.length} met)</span></h3>
              <div className="space-y-2.5">
                {reqs.map((r) => {
                  const pct = r.pct ?? Math.min(100, Math.round((r.actual / r.min) * 100))
                  const met = r.actual >= r.min
                  return (
                    <div key={r.label}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className={met ? 'text-green-400' : 'text-slate-400'}>{r.label}</span>
                        <span className={met ? 'text-green-400 font-bold' : 'text-slate-300'}>{r.actual}/{r.min} hr</span>
                      </div>
                      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${met ? 'bg-green-400' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Documents */}
            <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-3">Documents</h3>
              <div className="space-y-2">
                {DOC_FIELDS.map((df) => {
                  const doc = student.docs[df.key]
                  if (!doc) return null
                  const es = df.showExpiry ? expiryStatus(doc.expiry) : null
                  return (
                    <div key={df.key} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${es ? EXPIRY_BG[es] : 'bg-surface border-surface-border'}`}>
                      <div>
                        <div className={es ? EXPIRY_COLOR[es] : 'text-slate-300'}>{df.label}</div>
                        {doc.uploaded && <span className="text-green-400 text-[10px]">✓ Uploaded</span>}
                      </div>
                      <div className="text-right">
                        {df.showExpiry && doc.expiry && <div className={`text-[10px] ${es ? EXPIRY_COLOR[es] : 'text-slate-500'}`}>{expiryLabel(doc.expiry)}</div>}
                        {doc.score && <div className="text-sky-400 text-[10px] font-bold">Score: {doc.score}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Block hours */}
            {student.blockHoursPurchased > 0 && (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <h3 className="text-white font-bold text-sm mb-2">Block Hours</h3>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Used</span>
                  <span>{student.blockHoursUsed} / {student.blockHoursPurchased} hrs</span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(student.blockHoursUsed / student.blockHoursPurchased) * 100}%` }} />
                </div>
                <div className="text-green-400 text-[10px] mt-1">{(student.blockHoursPurchased - student.blockHoursUsed).toFixed(1)} hrs remaining</div>
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
          {user && <div className="px-4 sm:px-6 pb-6"><div className="max-w-6xl mx-auto"><RecentFlightBox user={user} /></div></div>}
          <MiniGalleryStrip category="fleet" />
          <FleetSection user={user} onBookAircraft={setBookingAircraft} />
          {user && <ScheduleSection user={user} selectedAircraft={bookingAircraft} onClearAircraft={() => setBookingAircraft(null)} />}
          {user && <MaintenanceSection user={user} />}
          <MiniGalleryStrip category="scenery" />
          <OperationsSection />
          <FooterSection />
        </>
      ) : (
        <>
          <HeroSection />
          {user && <div className="px-4 sm:px-6 pb-6"><div className="max-w-6xl mx-auto"><RecentFlightBox user={user} /></div></div>}
          <MiniGalleryStrip category="fleet" />
          <FleetSection user={user} onBookAircraft={setBookingAircraft} />
          {user && <ScheduleSection user={user} selectedAircraft={bookingAircraft} onClearAircraft={() => setBookingAircraft(null)} />}
          <MiniGalleryStrip category="training" />
          <TrainingSection />
          {user && (
            <>
              <MiniGalleryStrip category="fbo" />
              <MaintenanceSection user={user} />
            </>
          )}
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
