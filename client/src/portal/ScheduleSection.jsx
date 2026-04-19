import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAircraftStars } from '../hooks/useAircraftStars'
import { getAircraftByOperator } from '../mocks/aircraft'
import { mockAircraft } from '../mocks/aircraft'
import { mockPersonnel } from '../mocks/personnel'
import { addServiceRequest } from '../store/serviceRequests'
import { addFlight, updateFlight as updateStoreFlight, getAllFlights, subscribe } from '../store/flights'
import { mockStudents, PROGRAMS, mockBookings, SCHEDULE_DAYS, SCHEDULE_SLOTS } from '../training/mockTraining'
import {
  requirementProgress, metRequirementCount, stageProgress, isCheckrideReady,
  recommendLessons, expiryStatus, expiryLabel, EXPIRY_COLOR, EXPIRY_BG,
  DPE_STATUS_LABEL, DPE_STATUS_COLOR, DPE_STATUS_BG,
  BOOKING_TYPE_COLORS, BOOKING_TYPE_LABELS, WEATHER_FIT_COLORS, WEATHER_FIT_LABELS,
  calcTrainingWB, wbStatusLevel, WB_STATUS, LESSON_TEMPLATES,
} from '../training/trainingUtils'
import { STATUS_COLOR, getAircraftPhoto } from './portalConstants'
import { PortalIcon, IcMaint, IcDual, IcSolo, IcGround, IcShield } from './icons'
import { towDeficiencyMin, towCycleMin, TOW_SETTINGS } from '../glider/gliderUtils'

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

// Half-hour slot grid — 6 AM to 7 PM local (expanded for glider ops)
const HALF_HOUR_SLOTS = []
for (let h = 6; h <= 19; h++) {
  HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  if (h < 19) HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
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

export function ScheduleSection({ user, selectedAircraft, onSelectAircraft, onClearAircraft, selectedInstructor, onClearInstructor, instructors = [], proposedLessons = [], operator = 'journeys' }) {
  // Build CFI list: real instructors (from portal data) + mock personnel as fallback
  const mockCfis = mockPersonnel.filter((p) => p.cfiCert)
  const realCfis = useMemo(() => instructors.map((inst, i) => {
    const certs = (inst.certifications || []).map((c) => c.toUpperCase())
    const ends = (inst.endorsements || []).map((e) => e.toLowerCase())
    const ratings = []
    if (certs.includes('CFI') || certs.includes('CFIG') || certs.length > 0) ratings.push('CFI')
    if (certs.includes('CFII')) ratings.push('CFII')
    if (certs.includes('CFIG')) ratings.push('CFIG')
    if (certs.includes('MEI')) ratings.push('MEI')
    return {
      id: `inst-${inst.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: inst.name,
      weightLbs: 170,
      role: 'cfi',
      roleLabel: inst.role,
      cfiCert: true,
      cfiRatings: ratings,
      isChiefPilot: ends.some((e) => e.includes('stage check')) || inst.role.toLowerCase().includes('chief'),
      certType: certs.includes('CFII') ? 'Commercial' : 'Commercial',
      photo: inst.photo,
      _realInstructor: inst,
    }
  }), [instructors])
  const cfiList = realCfis.length > 0 ? realCfis : mockCfis
  const fleet = getAircraftByOperator(operator)
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
  const [weekOffset, setWeekOffset] = useState(0)
  const lessonCombosRef = useRef({})
  const [stars] = useAircraftStars()
  const [bookings, setBookings] = useState(loadBookings)
  const [editingBooking, setEditingBooking] = useState(null)
  const [skippedProposals, setSkippedProposals] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [xcRoute, setXcRoute] = useState('KBDU')
  const [xcFuelGal, setXcFuelGal] = useState('')

  // Persist bookings to localStorage whenever they change
  useEffect(() => { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings)) }, [bookings, BOOKINGS_KEY])

  useEffect(() => { if (selectedAircraft) setAcMode('fleet') }, [selectedAircraft])

  // ── Map selected instructor → real CFI record ───────────────────────────
  const selectedCfiRecord = useMemo(() => {
    if (!selectedInstructor) return null
    return cfiList.find((c) => c._realInstructor && c._realInstructor.name === selectedInstructor.name) || null
  }, [selectedInstructor, cfiList])

  // Auto-set selectedCfi when instructor is picked from InstructorsDisplay
  useEffect(() => {
    if (selectedCfiRecord) {
      setSelectedCfi(selectedCfiRecord.id)
      setFlightMode('dual')
    }
  }, [selectedCfiRecord])

  const durationHrs = durationHalfHours / 2
  const session = CFI_SESSION_TYPES.find((s) => s.id === sessionType)

  // ── Instructor-proposed lessons (3 breathing slots when booked via InstructorsDisplay) ──
  const instructorProposed = useMemo(() => {
    if (!selectedCfiRecord) return []
    const cfi = selectedCfiRecord
    const inst = cfi._realInstructor || {}
    const ends = (inst.endorsements || []).map((e) => e.toLowerCase())

    // Filter CFI_SESSION_TYPES to this real instructor's qualifications + aircraft capabilities
    const ac = selectedAircraft
    const qualified = CFI_SESSION_TYPES.filter((s) => {
      if (!cfiQualifiedForSession(cfi, s)) return false
      // If aircraft is selected, also filter by its capabilities
      if (ac) {
        if (s.requiresIfrAc && !ac.equipment?.ifrCertified) return false
        if (s.requiresComplexAc && !ac.riskProfile?.complexAircraft) return false
        if (s.requiresMultiAc && !ac.riskProfile?.multiEngine) return false
        if (s.requiresHpAc && !ac.riskProfile?.highPerformance) return false
        if (s.requiresTwAc && !ac.riskProfile?.tailwheel) return false
      }
      return true
    })

    // Pick 3 diverse lessons: 1 short pattern, 1 medium, 1 specialty (or next available)
    const picks = []
    // Prioritize endorsement-specific lessons for this instructor
    const priority = []
    if (ends.some((e) => e.includes('tailwheel'))) priority.push('tailwheel')
    if ((cfi.cfiRatings || []).includes('CFII')) priority.push('ipc', 'ifr-practice')
    if (ends.some((e) => e.includes('stage check'))) priority.push('stage-check')
    priority.push('pattern', 'practice-area', 'local', 'xc', 'bfr', 'mountain', 'night', 'hp-checkout')

    for (const cat of priority) {
      if (picks.length >= 3) break
      const match = qualified.find((s) => s.id === cat && !picks.some((p) => p.id === s.id))
      if (match) picks.push(match)
    }
    for (const s of qualified) {
      if (picks.length >= 3) break
      if (!picks.some((p) => p.id === s.id)) picks.push(s)
    }

    // Place on calendar: find open slots in next 7 days
    const now = new Date()
    const todayDow = now.getDay()
    const todayIdx = todayDow === 0 ? 6 : todayDow - 1
    const nowHour = now.getHours()
    const results = []
    let nextDay = todayIdx
    const usedSlots = new Set()

    for (const lesson of picks) {
      let placed = false
      for (let d = nextDay; d < 7 && !placed; d++) {
        for (const sl of ['09:00', '10:00', '14:00', '15:00']) {
          const key = `${d}:${sl}`
          if (usedSlots.has(key)) continue
          if (d === todayIdx && parseInt(sl.slice(0, 2), 10) <= nowHour) continue
          usedSlots.add(key)
          results.push({
            template: { id: `inst-${lesson.id}`, title: lesson.label, durationHr: lesson.duration || 1.5, type: 'dual_lesson' },
            cfi: cfi,
            aircraft: null,
            slot: { dayIdx: d, slot: sl, dateLabel: '' },
            _instructorName: inst.name,
          })
          nextDay = d + 1
          placed = true
          break
        }
      }
    }
    return results.slice(0, 3)
  }, [selectedCfiRecord, selectedAircraft])

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
    for (let d = 0; d <= 13; d++) {
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

  // Merge instructor-proposed lessons (from InstructorsDisplay "Book" action) into proposals
  const allProposed = instructorProposed.length > 0 ? instructorProposed : proposed

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
      .filter((f) => f._source === `${operator}_portal` || f.operator === operator)
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

  // ── Tow capacity cache for glider ops ──────────────────────────────
  // Uses towDeficiencyMin from gliderUtils — same logic as GliderOps page.
  // Green = excess capacity, yellow = balanced/tight, red = standby needed.
  // Outside tow pilot hours (before 8 AM / after 6 PM): no capacity.
  const isGliderOp = operator === 'mhg' || operator === 'ssb'
  const towCapacity = useMemo(() => {
    if (!isGliderOp) return null
    const allFlights = getAllFlights()
    const airport = 'KBDU'
    const cap = {}
    for (let d = 0; d < 14; d++) {
      const dayDate = new Date()
      dayDate.setDate(dayDate.getDate() + (d < 7 ? d : d + (weekOffset * 7)))
      dayDate.setHours(0, 0, 0, 0)
      for (let si = 0; si < HALF_HOUR_SLOTS.length; si++) {
        const [h, m] = HALF_HOUR_SLOTS[si].split(':').map(Number)
        const winStart = dayDate.getTime() + h * 3600_000 + m * 60_000
        const winEnd = winStart + 30 * 60_000
        // Tow pilots operate 8 AM – 6 PM
        if (h < 8 || h >= 18) {
          cap[`${d}-${si}`] = { color: 'red', hasTow: false, isStandby: true, demandMin: 0, supplyMin: 0 }
          continue
        }
        const td = towDeficiencyMin(allFlights, airport, winStart, winEnd)
        cap[`${d}-${si}`] = { ...td, hasTow: td.color === 'green' }
      }
    }
    return cap
  }, [isGliderOp, weekOffset])

  // Availability check per half-hour cell.
  // Returns { free, cfis[], soloOk, effectiveDur, towOk, towStandby } where
  // effectiveDur is the max half-hours available (may be < requested duration if a booking cuts it short).
  // For glider ops: towOk = tow plane capacity exists, towStandby = instructor+glider ok but no tow.
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
      if (acFreeSlots === 0) return { free: false, cfis: [], reason: 'aircraft', effectiveDur: 0, towOk: false, towStandby: false }
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

      // ── Glider tow capacity check (uses towDeficiencyMin color: green/yellow/red) ──
      const needsTow = isGliderOp && selectedAircraft?.needs_tow
      let towOk = true
      let towStandby = false
      let towColor = 'green'
      if (needsTow && towCapacity) {
        const tc = towCapacity[`${dayIdx}-${si0}`]
        towColor = tc?.color ?? 'green'
        // green = excess capacity, yellow = balanced/tight, red = overloaded / outside hours
        towOk = towColor === 'green'
        if (towColor !== 'green' && (available.length > 0 || canSolo)) {
          towStandby = true // instructor + glider ready, but tow capacity tight or gone
        }
      }

      return { free: true, cfis: available, soloOk: canSolo, effectiveDur: Math.min(bestDur, maxDur), towOk, towStandby, towColor }
    }
    return { free: true, cfis: [], soloOk: isSolo && acMode === 'fleet', effectiveDur: maxDur, towOk: true, towStandby: false, towColor: 'green' }
  }, [activeAircraftId, allBookings, cfiList, durationHalfHours, selectedCfi, preferredCfis, acMode, sessionType, selectedAircraft, isGliderOp, towCapacity])

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
    // Flight mode prefix
    if (isSolo && !cfiId) parts.push('Solo')
    else if (cfiId) parts.push('Dual')
    else parts.push('Solo')
    // Lesson topic — check CFI_SESSION_TYPES first, then curriculum lesson templates
    if (session) {
      parts.push(session.label)
    } else if (sessionType) {
      const templates = LESSON_TEMPLATES[user.program] || {}
      const allT = Object.values(templates).flat()
      const tmpl = allT.find((t) => t.id === sessionType)
      if (tmpl) parts.push(tmpl.title)
    }
    return parts.join(' — ')
  }

  const handleBook = (dayIdx, slot, cfiId, effectiveDur, standbyOverride = false) => {
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
      standby: standbyOverride || (acMode === 'fleet' && selectedAircraft && !selectedAircraft.airworthy),
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
        operator,
        riskScore: null,
        riskP: null, riskA: null, riskV: null, riskE: null,
        riskSnapshot: null,
        _source: `${operator}_portal`,
        _bookingId: booking.id,
        _duration: actualHrs,
        _sessionLabel: label,
        _lessonTemplateId: sessionType || null,
        _lessonTitle: session?.label || (sessionType ? (Object.values(LESSON_TEMPLATES[user.program] || {}).flat().find((t) => t.id === sessionType)?.title) : null) || null,
        // Glider tow info: derive from lesson template towProfile or defaults
        ...(ac?.glider || ac?.needs_tow ? (() => {
          const tp = activeSession?.towProfile || session?.towProfile
          const heights = tp?.heights || [2000]
          const numTows = tp?.numTows || 1
          return { towInfo: { numTows, towHeights: heights, isStandby: !!standbyOverride }, airport: 'KBDU' }
        })() : {}),
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

        {/* Booking context banner — active CFI (from dropdown or InstructorsDisplay) and/or aircraft */}
        {(() => {
          // Derive active instructor from dropdown state — updates when user changes the select
          const activeCfiObj = selectedCfi && selectedCfi !== 'preferred' ? cfiList.find((c) => c.id === selectedCfi) : null
          const activeInst = activeCfiObj?._realInstructor || (activeCfiObj ? { name: activeCfiObj.name, role: activeCfiObj.roleLabel || 'Instructor', certifications: activeCfiObj.cfiRatings, photo: activeCfiObj.photo } : null)
          const showBanner = activeInst || selectedAircraft
          if (!showBanner) return null
          return (
            <div className="bg-sky-400/10 border border-sky-400/25 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                {activeInst && (
                  <div className="flex items-center gap-3">
                    {activeInst.photo ? (
                      <img src={activeInst.photo} alt={activeInst.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {activeInst.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                    )}
                    <div>
                      <div className="text-white text-sm font-semibold">{activeInst.name}</div>
                      <div className="text-sky-400 text-xs">{activeInst.role}{activeInst.certifications?.length ? ` · ${activeInst.certifications.join(', ')}` : ''}</div>
                    </div>
                    <button onClick={() => { setSelectedCfi(''); onClearInstructor?.() }} className="text-slate-500 hover:text-white text-[10px] ml-1">✕</button>
                  </div>
                )}
                {activeInst && selectedAircraft && <span className="text-slate-600 text-xs">+</span>}
                {selectedAircraft && (
                  <div className="flex items-center gap-3">
                    {(() => { const ph = getAircraftPhoto(selectedAircraft.type || selectedAircraft.makeModel); return ph ? (
                      <img src={ph} alt={selectedAircraft.tailNumber} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{selectedAircraft.tailNumber?.slice(-3)}</div>
                    ) })()}
                    <div>
                      <div className="text-white text-sm font-semibold">{selectedAircraft.tailNumber}</div>
                      <div className="text-sky-400 text-xs">{selectedAircraft.type || selectedAircraft.makeModel}</div>
                    </div>
                    <button onClick={() => onClearAircraft?.()} className="text-slate-500 hover:text-white text-[10px] ml-1">✕</button>
                  </div>
                )}
              </div>
              <div className="text-slate-400 text-xs">
                {activeInst && selectedAircraft ? 'Booking with instructor + aircraft' : activeInst ? 'Booking with instructor' : 'Booking aircraft'}
              </div>
            </div>
          )
        })()}

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

          // Aircraft capabilities — gray out lessons the aircraft can't support
          const acHasIfr = selectedAircraft ? !!selectedAircraft.equipment?.ifrCertified : true
          const acHasComplex = selectedAircraft ? !!selectedAircraft.riskProfile?.complexAircraft : true
          const acHasMulti = selectedAircraft ? !!selectedAircraft.riskProfile?.multiEngine : true
          const acHasHp = selectedAircraft ? !!selectedAircraft.riskProfile?.highPerformance : true
          const acHasTailwheel = selectedAircraft ? !!selectedAircraft.riskProfile?.tailwheel : true

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
                  { id: 'dual', label: 'Dual', desc: 'With CFI', Icon: IcDual },
                  { id: 'solo', label: 'Solo', desc: 'Endorsed', Icon: IcSolo },
                  { id: 'ground', label: 'Ground', desc: 'No aircraft', Icon: IcGround },
                  { id: 'checkride', label: 'Check', desc: 'Eval / Currency', Icon: IcShield },
                ].map((t) => (
                  <button key={t.id} onClick={() => { setFlightMode(t.id); setSessionType(''); if (t.id === 'ground') setAcMode('ground'); else setAcMode('fleet') }}
                    className={`flex-1 py-3 rounded-lg text-xs sm:text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                      flightMode === t.id ? 'bg-white/[0.07] text-slate-100 border border-white/10' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    <t.Icon size={18} stroke={1.25} className={flightMode === t.id ? 'text-slate-200' : 'text-slate-500'} />
                    {t.label}
                    <div className="text-[10px] font-normal text-slate-600">{t.desc}</div>
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

              {/* ── Lesson combo solver: find best aircraft + CFI + slot for each lesson ── */}
              {(() => {
                // Pre-compute combos for all visible lessons (memoized-ish via the IIFE)
                const now = new Date()
                const todayDow = now.getDay()
                const mondayOff = todayDow === 0 ? -6 : 1 - todayDow
                const nowHour = now.getHours()
                const todayDayIdx = todayDow === 0 ? -1 : todayDow - 1

                // Sunset for night lessons
                const jan1 = new Date(now.getFullYear(), 0, 1)
                const dayOfYear = Math.floor((now - jan1) / 86400000)
                const sunsetHour = Math.floor(17.0 + 3.5 * Math.sin(((dayOfYear - 80) / 365) * 2 * Math.PI))

                const statusOrder = { green: 0, yellow: 1, red: 2 }

                lessonCombosRef.current = {}

                tabLessons.forEach((lesson) => {
                  if (lesson.type === 'ground') { lessonCombosRef.current[lesson.id] = { type: 'ground' }; return }

                  const isNight = lesson.title?.toLowerCase().includes('night')
                  const isSoloLesson = lesson.type === 'solo' || flightMode === 'solo'
                  const dur = lesson.durationHr || 1.5
                  const durSlots = Math.round(dur * 2)
                  const fuelHrs = dur + (lesson.title?.includes('XC') ? 0.75 : 0.5)

                  // Rank CFIs: selected first, then preferred, then all, filtered by qualification
                  const rankedCfis = isSoloLesson ? [null] : [
                    ...(selCfi && cfiQualifiedForSession(selCfi, lesson) ? [selCfi] : []),
                    ...prefCfiList.filter((c) => c.id !== selCfi?.id && cfiQualifiedForSession(c, lesson)),
                    ...cfiList.filter((c) => c.id !== selCfi?.id && !preferredCfis.includes(c.id) && cfiQualifiedForSession(c, lesson)),
                  ]
                  if (!isSoloLesson && rankedCfis.length === 0) { lessonCombosRef.current[lesson.id] = null; return }

                  // Rank aircraft: selected first, then starred (3>2>1>0), then cheapest, filtered by equipment
                  const rankedAc = fleet.filter((ac) => {
                    if (!ac.airworthy || ac.fboCategory === 'sim') return false
                    if (lesson.requiresIfrAircraft && !ac.equipment?.ifrCertified) return false
                    if (lesson.requiresComplex && !ac.riskProfile?.complexAircraft) return false
                    if (lesson.requiresMulti && !ac.riskProfile?.multiEngine) return false
                    return true
                  }).sort((a, b) => {
                    // Put selected aircraft first
                    if (selectedAircraft) {
                      if (a.id === selectedAircraft.id) return -1
                      if (b.id === selectedAircraft.id) return 1
                    }
                    const sa = stars[a.tailNumber] || 0, sb = stars[b.tailNumber] || 0
                    if (sb !== sa) return sb - sa
                    return (a.rentalRates?.member || 999) - (b.rentalRates?.member || 999)
                  })

                  let bestCombo = null
                  // Search next 14 days, prioritize first 3
                  for (let dayOff = 0; dayOff < 14 && !bestCombo; dayOff++) {
                    const di = todayDayIdx + dayOff
                    if (di % 7 === 6) continue // skip Sunday (index 6 in 0=Mon scheme... actually Sun is -1 in our scheme)
                    // Map to real day index for slot checking
                    const checkDate = new Date(now)
                    checkDate.setDate(now.getDate() + dayOff)
                    if (checkDate.getDay() === 0) continue // skip Sunday
                    const slotDayIdx = dayOff // relative to today

                    // Determine valid slot range
                    const minSlotHour = (dayOff === 0) ? nowHour + 1 : 7
                    const maxSlotHour = isNight ? 17 : 16
                    const nightMinHour = isNight ? Math.max(sunsetHour - 1, minSlotHour) : minSlotHour

                    for (const cfiCandidate of rankedCfis) {
                      for (const acCandidate of rankedAc) {
                        // W&B check
                        const wb = acCandidate.weightBalance
                        if (wb?.maxGrossLbs && wb?.emptyWeightLbs) {
                          const occ = studentWeight + (cfiCandidate?.weightLbs || 0)
                          const fuelLbs = Math.round(Math.min(fuelHrs * (acCandidate.fuelBurnGalHr || 8), acCandidate.fuelCapacityGal || 50) * (wb.fuelWeightPerGal || 6))
                          if (wb.emptyWeightLbs + occ + fuelLbs > wb.maxGrossLbs) continue
                        }

                        // Find a slot where both CFI and aircraft are free
                        for (let h = (isNight ? nightMinHour : minSlotHour); h <= maxSlotHour; h++) {
                          for (const m of [0, 30]) {
                            const slotStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
                            // Check all half-hour cells for the duration
                            const si0 = HALF_HOUR_SLOTS.indexOf(slotStr)
                            if (si0 < 0 || si0 + durSlots > HALF_HOUR_SLOTS.length) continue
                            let free = true
                            for (let s = 0; s < durSlots && free; s++) {
                              const checkSlot = HALF_HOUR_SLOTS[si0 + s]
                              if (cfiCandidate && slotOccupied(allBookings, slotDayIdx, checkSlot, 'cfiId', cfiCandidate.id)) free = false
                              if (slotOccupied(allBookings, slotDayIdx, checkSlot, 'aircraftId', acCandidate.id)) free = false
                            }
                            if (free) {
                              const margin = wb?.maxGrossLbs ? wb.maxGrossLbs - wb.emptyWeightLbs - studentWeight - (cfiCandidate?.weightLbs || 0) - Math.round(Math.min(fuelHrs * (acCandidate.fuelBurnGalHr || 8), acCandidate.fuelCapacityGal || 50) * (wb?.fuelWeightPerGal || 6)) : 999
                              bestCombo = {
                                ac: acCandidate, cfi: cfiCandidate, slot: slotStr, dayOff,
                                date: new Date(checkDate), rate: acCandidate.rentalRates?.member || 0,
                                margin, stars: stars[acCandidate.tailNumber] || 0,
                                within3: dayOff < 3,
                              }
                              break
                            }
                          }
                          if (bestCombo) break
                        }
                        if (bestCombo) break
                      }
                      if (bestCombo) break
                    }
                  }
                  lessonCombosRef.current[lesson.id] = bestCombo
                })
                return null // render nothing, just compute
              })()}

              {/* ── Step 3: Lesson ── */}
              <div className="mb-5">
                <label className="text-slate-400 text-xs block mb-2">
                  {flightMode === 'checkride' ? 'Evaluation / Currency' : 'Lesson'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {tabLessons.map((lesson) => {
                    const hasSyllabus = lesson.stage > 0
                    const done = hasSyllabus && lesson.stage < currentStage
                    const isCurrent = hasSyllabus && lesson.stage === currentStage
                    const selected = sessionType === lesson.id
                    const needsCfii = lesson.requiresCfii && !cfiHasCfii
                    const needsMei = lesson.requiresMulti && !cfiHasMei
                    const needsIfrAc = lesson.requiresIfrAircraft && !acHasIfr
                    const needsComplexAc = lesson.requiresComplex && !acHasComplex
                    const needsMultiAc = lesson.requiresMulti && !acHasMulti
                    const needsHpAc = lesson.requiresHpAc && !acHasHp
                    const needsTwAc = lesson.requiresTwAc && !acHasTailwheel
                    const grayed = needsCfii || needsMei || needsIfrAc || needsComplexAc || needsMultiAc || needsHpAc || needsTwAc

                    return (
                      <button key={lesson.id} disabled={grayed} onClick={() => {
                          setSessionType(lesson.id)
                          setDurationHalfHours(Math.round(lesson.durationHr * 2))
                          if (flightMode !== 'solo') { const best = bestCfiForSession(lesson, cfiList, preferredCfis); if (best && (!selectedCfi || selectedCfi === 'preferred')) setSelectedCfi(best) }
                          if (lesson.type === 'ground') setAcMode('ground')
                          else if (acMode === 'ground') setAcMode('fleet')
                        }}
                        className={`flex items-start gap-2 p-2.5 rounded-xl text-left transition-all border ${
                          grayed ? 'opacity-30 cursor-not-allowed border-surface-border'
                          : selected ? 'bg-sky-500/15 border-sky-400 ring-1 ring-sky-400/20'
                          : done ? 'bg-green-400/5 border-green-400/15 opacity-60'
                          : isCurrent ? 'bg-surface-card border-sky-400/20'
                          : 'bg-surface border-surface-border hover:border-slate-500'
                        }`}>
                        {hasSyllabus ? (
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                            done ? 'bg-green-400/20 text-green-400' : isCurrent ? 'bg-sky-400/20 text-sky-400' : 'bg-surface border border-surface-border text-slate-600'
                          }`}>{done ? '✓' : lesson.stage}</span>
                        ) : (
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 ${
                            selected ? 'bg-emerald-400/20 text-emerald-400' : 'bg-surface border border-surface-border text-slate-500'
                          }`}>{lesson.type === 'ground' ? 'G' : '—'}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold leading-snug ${done ? 'text-green-400/80' : selected ? 'text-sky-400' : 'text-slate-200'}`}>{lesson.title}</div>
                          {(() => {
                            const combo = lessonCombosRef.current?.[lesson.id]
                            if (combo === null) return <div className="text-[10px] text-red-400/60">No availability</div>
                            if (combo?.type === 'ground') return <div className="text-[10px] text-slate-500">{lesson.durationHr}hr · Ground</div>
                            if (!combo) return <div className="text-[10px] text-slate-500">{lesson.durationHr}hr</div>
                            return (
                              <div className="text-[10px] leading-snug">
                                <span className={combo.within3 ? 'text-green-400/70' : 'text-amber-400/70'}>
                                  {combo.date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })} {combo.slot}
                                </span>
                                <span className="text-slate-600"> · </span>
                                <span className="text-slate-400">{combo.ac.tailNumber}</span>
                                {combo.cfi && <span className="text-slate-500"> · {combo.cfi.name.split(' ')[0]}</span>}
                                <span className="text-slate-600"> · ${combo.rate}/hr</span>
                                {done && <span className="text-green-400/60 ml-1">✓</span>}
                                {grayed && <span className="text-red-400/60 ml-1">{needsCfii ? 'CFII' : needsMei ? 'MEI' : needsIfrAc ? 'IFR A/C' : needsComplexAc ? 'Complex' : needsMultiAc ? 'Multi' : needsHpAc ? 'HP' : needsTwAc ? 'Tailwheel' : ''}</span>}
                              </div>
                            )
                          })()}
                        </div>
                        {/* Aircraft thumbnail */}
                        {(() => {
                          const combo = lessonCombosRef.current?.[lesson.id]
                          if (!combo?.ac) return null
                          const photo = getAircraftPhoto(combo.ac.makeModel)
                          if (!photo) return null
                          return <img src={photo} alt={combo.ac.tailNumber} loading="lazy" className="w-14 h-10 rounded-lg object-cover flex-shrink-0 opacity-70" />
                        })()}
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

                    {/* Fleet aircraft — grouped by IFR / VFR */}
                    {[
                      { label: 'IFR Capable', items: qualified.filter(({ ac }) => ac.equipment?.ifrCertified), color: 'text-sky-400' },
                      { label: 'VFR Only',    items: qualified.filter(({ ac }) => !ac.equipment?.ifrCertified), color: 'text-slate-400' },
                    ].map(({ label: grpLabel, items, color: grpColor }) => items.length > 0 && (
                      <div key={grpLabel} className="w-full flex flex-col gap-2">
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${grpColor}`}>{grpLabel}</span>
                          <div className="flex-1 border-t border-surface-border" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {items.map(({ ac, status, reason, rate, stars: s }) => {
                            const isSelected = selectedAircraft?.id === ac.id
                            const colorMap = { green: 'bg-green-400/10 border-green-400/25 text-green-400', yellow: 'bg-amber-400/10 border-amber-400/25 text-amber-400', red: 'bg-red-400/10 border-red-400/25 text-red-400' }
                            const photo = getAircraftPhoto(ac.makeModel)
                            return (
                              <button key={ac.id} onClick={() => { setAcMode('fleet'); onSelectAircraft?.(ac) }}
                                className={`relative overflow-hidden px-3 py-2 rounded-xl text-xs transition-all border ${isSelected ? 'ring-2 ring-sky-400 bg-sky-500/20 border-sky-400 text-sky-300' : colorMap[status]}`}>
                                {photo && (
                                  <img src={photo} alt="" loading="lazy"
                                    className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none" />
                                )}
                                <div className="relative z-[1]">
                                  <div className="font-semibold flex items-center gap-1">
                                    {s > 0 && <span className="text-amber-400 text-[9px]">{'★'.repeat(s)}</span>}
                                    {ac.tailNumber}
                                  </div>
                                  <div className="text-[10px] opacity-70">{ac.makeModel?.split(' ').slice(0, 2).join(' ')}</div>
                                  <div className="text-[10px] opacity-70">${rate}/hr · {reason}</div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {/* Grayed unqualified */}
                    {unqualified.length > 0 && (
                      <div className="w-full flex flex-col gap-2">
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Unqualified</span>
                          <div className="flex-1 border-t border-surface-border/50" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {unqualified.map(({ ac, reason, rate, stars: s }) => {
                            const photo = getAircraftPhoto(ac.makeModel)
                            return (
                              <div key={ac.id} className="relative overflow-hidden px-3 py-2 rounded-xl text-xs border border-surface-border opacity-25 cursor-not-allowed">
                                {photo && (
                                  <img src={photo} alt="" loading="lazy"
                                    className="absolute inset-0 w-full h-full object-cover opacity-[0.08] pointer-events-none" />
                                )}
                                <div className="relative z-[1]">
                                  <div className="font-semibold text-slate-500">{s > 0 && <span className="text-amber-400/50 text-[9px]">{'★'.repeat(s)}</span>} {ac.tailNumber}</div>
                                  <div className="text-[10px] text-slate-600">{ac.makeModel?.split(' ').slice(0, 2).join(' ')}</div>
                                  <div className="text-[10px] text-slate-600">{reason}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
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
                            status: 'requested', operator,
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
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekMonday)
            d.setDate(weekMonday.getDate() + i)
            return { date: d, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }) }
          })
          const todayDayIdx = weekOffset === 0 ? (todayDow === 0 ? 6 : todayDow - 1) : -1

          // Current time line (only for current week)
          const nowH = now.getHours()
          const nowM = now.getMinutes()
          const nowMinutes = nowH * 60 + nowM
          const gridStartMin = 6 * 60
          const gridEndMin = 19 * 60
          const nowPx = weekOffset === 0 && nowMinutes >= gridStartMin && nowMinutes <= gridEndMin
            ? ((nowMinutes - gridStartMin) / 30) * ROW_H : null

          return (
            <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
              <div className="min-w-[700px] px-4 sm:px-0">
                {/* Week navigation + day headers */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setWeekOffset((w) => w - 1)} className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded transition-colors">← Prev</button>
                  <div className="text-slate-300 text-xs font-semibold">
                    {weekDays[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {weekOffset === 0 && <span className="text-sky-400 ml-1">(This week)</span>}
                  </div>
                  <button onClick={() => setWeekOffset((w) => w + 1)} className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded transition-colors">Next →</button>
                </div>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', height: HEADER_H }}>
                  <div />
                  {weekDays.map((d, i) => (
                    <div key={i} className={`flex items-center justify-center text-xs sm:text-sm font-semibold rounded-lg ${
                      i === todayDayIdx ? 'bg-sky-500/20 text-sky-300' : 'text-slate-300'
                    }`}>{d.label}{i === todayDayIdx ? ' ●' : ''}</div>
                  ))}
                </div>

                {/* Grid body */}
                <div className="grid gap-0.5" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
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
                          // Check if this slot is in the past — render blank if so
                          const [slotH, slotM] = slot.split(':').map(Number)
                          const slotDate = new Date(weekDays[dayIdx].date)
                          slotDate.setHours(slotH, slotM, 0, 0)
                          const isPastSlot = slotDate.getTime() < now.getTime()

                          if (isPastSlot) {
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
                              ) : info.towStandby && info.towColor === 'red' ? (
                                /* Red-ish: outside tow hours or completely overloaded → standby only */
                                <button onClick={() => handleBook(dayIdx, slot, preferred?.id || info.cfis[0]?.id, info.effectiveDur, true)}
                                  title={`Standby — no tow capacity · ${info.cfis.map((c) => c.name).join(', ')} · ${info.effectiveDur / 2} hr`}
                                  className="w-full h-[calc(100%-2px)] rounded-md transition-all cursor-pointer bg-red-400/10 hover:bg-red-400/20 border border-dashed border-red-400/30" />
                              ) : info.towStandby ? (
                                /* Yellow: tow queue tight but some capacity — standby reservation */
                                <button onClick={() => handleBook(dayIdx, slot, preferred?.id || info.cfis[0]?.id, info.effectiveDur, true)}
                                  title={`Standby — tow queue tight · ${info.cfis.map((c) => c.name).join(', ')} · ${info.effectiveDur / 2} hr`}
                                  className="w-full h-[calc(100%-2px)] rounded-md transition-all cursor-pointer bg-amber-400/15 hover:bg-amber-400/30 border border-dashed border-amber-400/40" />
                              ) : info.cfis.length > 0 ? (
                                <button onClick={() => handleBook(dayIdx, slot, preferred?.id || info.cfis[0]?.id, info.effectiveDur)}
                                  title={`${info.cfis.map((c) => c.name).join(', ')} · ${info.effectiveDur / 2} hr avail${isGliderOp && info.towOk ? ' · Tow ✓' : ''}`}
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
                          const topicPart = bk.title?.includes('—') ? bk.title.split('—').slice(1).join('—').trim() : bk.title
                          const isShort = spanHalfHours <= 2
                          const isDual = bk.flightMode === 'dual' || bk.cfiId
                          const isBkSolo = bk.flightMode === 'solo' && !bk.cfiId

                          const isStandby = bk.standby
                          const blockBg = isStandby ? 'bg-amber-500/20 border-2 border-amber-400/40' : 'bg-green-500/20 border-2 border-green-400/40'
                          const blockShadow = isStandby ? 'shadow-amber-900/20' : 'shadow-green-900/20'
                          const textPrimary = isStandby ? 'text-amber-200' : 'text-green-200'
                          const textSecondary = isStandby ? 'text-amber-300/80' : 'text-green-300/80'
                          const textTertiary = isStandby ? 'text-amber-400/60' : 'text-green-400/60'

                          // Aircraft type photo for underlay
                          const bkAc = fleet.find((a) => a.id === bk.aircraftId) || mockAircraft.find((a) => a.tailNumber === bk.aircraftLabel)
                          const bkPhoto = getAircraftPhoto(bkAc?.makeModel || bk.aircraftLabel)

                          return (
                            <button key={bk.id} onClick={() => setEditingBooking(bk.id)}
                              className={`absolute left-0.5 right-0.5 rounded-lg ${blockBg} text-left hover:brightness-125 transition-all z-10 overflow-hidden animate-[fadeIn_0.3s_ease] shadow-lg ${blockShadow}`}
                              style={{ top, height }}>
                              {/* Aircraft photo underlay */}
                              {bkPhoto && (
                                <img src={bkPhoto} alt="" loading="lazy"
                                  className="absolute inset-0 w-full h-full object-cover opacity-[0.12] pointer-events-none" />
                              )}
                              <div className="relative z-[1] px-2 py-1 flex flex-col justify-center h-full">
                              {isStandby && <div className="text-amber-400 text-[9px] font-bold uppercase tracking-wider">STANDBY</div>}
                              <div className="flex items-center gap-1.5">
                                {isDual && <IcDual size={12} stroke={1.5} className={isStandby ? 'text-amber-300/70' : 'text-green-300/70'} />}
                                {isBkSolo && <IcSolo size={12} stroke={1.5} className={isStandby ? 'text-amber-300/70' : 'text-green-300/70'} />}
                                <span className={`${textPrimary} text-xs sm:text-sm font-bold leading-snug ${isShort ? 'truncate' : ''}`}>
                                  {topicPart || bk.title || (bk.aircraftLabel || 'GND')}
                                </span>
                              </div>
                              <div className={`${textSecondary} text-[10px] sm:text-xs leading-snug ${isShort ? 'truncate' : ''}`}>
                                {bk.aircraftLabel || 'GND'}{cfi ? ` · ${cfi.name}` : isBkSolo ? ' · Solo' : ''}
                              </div>
                              {!isShort && (
                                <div className={`${textTertiary} text-[9px] sm:text-[10px] mt-0.5`}>{slotLabel(bk.slot)} · {bk.duration} hr</div>
                              )}
                              </div>
                            </button>
                          )
                        })}

                        {/* Proposed lesson blocks — breathing with skip/accept */}
                        {allProposed.filter((rec) => {
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
                          const propPhoto = rec.aircraft ? getAircraftPhoto(rec.aircraft.makeModel) : null
                          const propIsDual = rec.template.type === 'dual_lesson'
                          return (
                            <div key={`prop-${ri}`}
                              className="absolute left-0.5 right-0.5 rounded-lg bg-sky-400/8 border border-dashed border-sky-400/30 text-left z-[5] animate-breathe-slow overflow-hidden flex flex-col justify-between"
                              style={{ top, height }}>
                              {propPhoto && <img src={propPhoto} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-[0.08] pointer-events-none" />}
                              <div className="relative z-[1] px-2 py-1">
                                <div className="flex items-center gap-1 text-sky-300/80 text-[10px] font-semibold truncate">
                                  {propIsDual ? <IcDual size={10} stroke={1.5} /> : <IcSolo size={10} stroke={1.5} />}
                                  {rec.template.title}
                                </div>
                                <div className="text-sky-400/40 text-[8px]">{rec._instructorName || rec.cfi?.name?.split(' ')[0] || 'CFI'} · {rec.aircraft?.tailNumber || ''} · {rec.template.durationHr}hr</div>
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
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-400/20 border border-green-400/30" /> {isGliderOp ? 'CFI + Glider + Tow' : 'Preferred'}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-sky-400/15 border border-sky-400/15" /> CFI</span>
          {isGliderOp && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400/15 border border-dashed border-amber-400/40" /> Tow tight (standby)</span>}
          {isGliderOp && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400/10 border border-dashed border-red-400/30" /> No tow (standby)</span>}
          {acMode === 'fleet' && !isGliderOp && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400/15 border border-amber-400/15" /> Solo</span>}
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-400/10" /> Busy</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500/25 border border-green-400/30" /> Yours</span>
        </div>


        {/* ── Edit/Modify booking popup ── */}
        {editingBooking && (() => {
          const bk = bookings.find((b) => b.id === editingBooking)
          if (!bk) { setEditingBooking(null); return null }
          const cfi = cfiList.find((c) => c.id === bk.cfiId)
          // Look up lesson template for tow info + full title
          const bkTemplates = LESSON_TEMPLATES[user.program] || {}
          const bkLesson = Object.values(bkTemplates).flat().find((t) => t.id === bk.type) || null
          const bkTopic = bk.title?.includes('—') ? bk.title.split('—').slice(1).join('—').trim() : bk.title
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

                {bk.standby && (
                  <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2 mb-4 text-amber-400 text-xs font-medium">
                    ⚠ Standby — tow capacity not confirmed for this slot
                  </div>
                )}

                <div className="space-y-4">
                  {/* Summary */}
                  <div className="bg-surface border border-surface-border rounded-xl p-3 space-y-1 text-sm">
                    {bkTopic && <div className="flex justify-between"><span className="text-slate-500">Lesson</span><span className="text-white font-semibold">{bkTopic}</span></div>}
                    {bk.aircraftLabel && <div className="flex justify-between"><span className="text-slate-500">Aircraft</span><span className="text-slate-200">{bk.aircraftLabel}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-200 capitalize">{bk.flightMode || bk.type.replace(/_/g, ' ')}</span></div>
                    {cfi && <div className="flex justify-between"><span className="text-slate-500">Instructor</span><span className="text-sky-400">{cfi.name}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">When</span><span className="text-slate-200">{SCHEDULE_DAYS[bk.dayIdx]} {slotLabel(bk.slot)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="text-slate-200">{bk.duration} hr</span></div>
                    {bkLesson?.towProfile && (
                      <div className="flex justify-between"><span className="text-slate-500">Tows</span><span className="text-indigo-400">{bkLesson.towProfile.numTows} × {bkLesson.towProfile.heights.map((h) => `${(h / 1000).toFixed(0)}k`).join(', ')} ft</span></div>
                    )}
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

export { CFI_SESSION_TYPES, CERT_LEVEL, getAvailableSessions, normalizeRoute }
