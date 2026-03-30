// =============================================================================
// Training Module — utility functions
// =============================================================================

import { PROGRAMS, BLOCK_PACKAGES, CLUB_CONFIG } from './mockTraining'

// ── Date / expiry helpers ─────────────────────────────────────────────────────

const TODAY = new Date('2026-03-29')

/** Return 'expired' | 'expiring' | 'current' for a date string (or null). */
export function expiryStatus(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const diffDays = Math.round((d - TODAY) / 86_400_000)
  if (diffDays < 0)   return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'current'
}

/** Return a human-readable relative label, e.g. "Expires in 14 days" or "Expired 3 days ago". */
export function expiryLabel(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diffDays = Math.round((d - TODAY) / 86_400_000)
  if (diffDays === 0)  return 'Expires today'
  if (diffDays > 0)    return `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`
  return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`
}

export const EXPIRY_COLOR = {
  expired:  'text-risk-high',
  expiring: 'text-amber-400',
  current:  'text-emerald-400',
}

export const EXPIRY_BG = {
  expired:  'bg-risk-high/10 border-risk-high/30',
  expiring: 'bg-amber-400/10 border-amber-400/30',
  current:  'bg-emerald-400/10 border-emerald-400/30',
}

// ── Discount helpers ──────────────────────────────────────────────────────────

/** Block hour discount percentage for a given number of pre-purchased hours. */
export function blockDiscountPct(hours) {
  const pkg = [...BLOCK_PACKAGES].reverse().find((p) => hours >= p.hours)
  return pkg ? pkg.discountPct : 0
}

/** Apply club member discount to a rate.  Returns discounted rate. */
export function applyClubDiscount(ratePerHr) {
  return Math.round(ratePerHr * (1 - CLUB_CONFIG.hourlyDiscountPct / 100) * 100) / 100
}

/** Effective hourly rate after best discount (block or club, not stacked). */
export function effectiveRate(baseRate, blockHrs, isClubMember) {
  const blockPct = blockDiscountPct(blockHrs)
  const clubPct  = isClubMember ? CLUB_CONFIG.hourlyDiscountPct : 0
  const bestPct  = Math.max(blockPct, clubPct)
  return Math.round(baseRate * (1 - bestPct / 100) * 100) / 100
}

// ── Program progress ──────────────────────────────────────────────────────────

/**
 * Returns an array of requirement objects with `actual` and `pct` filled in.
 * Handles both PPL and IR/CPL hour schemas.
 */
export function requirementProgress(student, programId) {
  const program = PROGRAMS[programId]
  if (!program) return []
  const h = student.hours || {}
  const actual = {
    total:      h.total       ?? 0,
    dual:       h.dual        ?? 0,
    solo:       h.soloPIC     ?? 0,
    xc_dual:    h.xc_dual     ?? 0,
    xc_solo:    h.xc_solo     ?? 0,
    night_dual: h.night_dual  ?? 0,
    instrument: h.instrument  ?? 0,
    xc_pic:     h.xc_pic      ?? 0,
    dual_cfii:  h.dual_cfii   ?? 0,
    pic:        h.pic         ?? 0,
    night_pic:  h.night_pic   ?? 0,
  }
  return program.requirements.map((req) => {
    const got = actual[req.id] ?? 0
    return { ...req, actual: got, pct: Math.min(100, Math.round((got / req.min) * 100)) }
  })
}

/** Count how many requirements are fully met. */
export function metRequirementCount(student, programId) {
  const reqs = requirementProgress(student, programId)
  return reqs.filter((r) => r.actual >= r.min).length
}

/** Overall stage completion percentage (based on current stage vs total stages). */
export function stageProgress(student, programId) {
  const program = PROGRAMS[programId]
  if (!program) return 0
  return Math.round(((student.currentStage - 1) / program.stages.length) * 100)
}

// ── DPE readiness ─────────────────────────────────────────────────────────────

/** Count completed tasks. */
export function tasksComplete(tasks) {
  return tasks.filter((t) => t.done).length
}

/** True if all DPE tasks are done. */
export function isCheckrideReady(student) {
  if (!student.dpe?.tasks?.length) return false
  return student.dpe.tasks.every((t) => t.done)
}

// ── Flying club eligibility ───────────────────────────────────────────────────

/**
 * Returns an array of issues preventing club flight.
 * Empty array = eligible.
 */
export function clubEligibilityIssues(member) {
  const issues = []
  if (!member.duesCurrent)      issues.push('Dues overdue')
  if (!member.bfrCurrent)       issues.push('BFR not current')
  if (!member.medicalCurrent)   issues.push('Medical not current')
  if (!member.rentersUploaded)  issues.push("Renter's insurance not on file")
  return issues
}

// ── Booking helpers ───────────────────────────────────────────────────────────

export const BOOKING_TYPE_COLORS = {
  dual_lesson:  'bg-sky-400/20 border-sky-400/40 text-sky-300',
  solo:         'bg-emerald-400/20 border-emerald-400/40 text-emerald-300',
  ground:       'bg-violet-400/20 border-violet-400/40 text-violet-300',
  sim_lesson:   'bg-amber-400/20 border-amber-400/40 text-amber-300',
  club_flight:  'bg-slate-400/20 border-slate-400/40 text-slate-300',
}

export const BOOKING_TYPE_LABELS = {
  dual_lesson:  'Dual',
  solo:         'Solo',
  ground:       'Ground',
  sim_lesson:   'Sim',
  club_flight:  'Club',
}

// ── Program status badge ──────────────────────────────────────────────────────

export const DPE_STATUS_LABEL = {
  not_started: 'Not Started',
  pending:     'Pending',
  ready:       'Ready',
  scheduled:   'Scheduled',
  complete:    'Complete',
}

export const DPE_STATUS_COLOR = {
  not_started: 'text-slate-400',
  pending:     'text-amber-400',
  ready:       'text-sky-400',
  scheduled:   'text-emerald-400',
  complete:    'text-emerald-400',
}

export const DPE_STATUS_BG = {
  not_started: 'bg-slate-400/10 border-slate-400/30',
  pending:     'bg-amber-400/10 border-amber-400/30',
  ready:       'bg-sky-400/10 border-sky-400/30',
  scheduled:   'bg-emerald-400/10 border-emerald-400/30',
  complete:    'bg-emerald-400/10 border-emerald-400/30',
}

// =============================================================================
// Lesson Recommendation Engine
// =============================================================================

// ── 14-day weather forecast (deterministic, from 2026-03-30) ─────────────────
// dayIdx: 0=Mon 3/30 … 5=Sat 4/4, 6=Sun (closed), 7=Mon 4/6 … 12=Sat 4/11

export const WEATHER_14DAY = {
  0:  { condition: 'vmc',          icon: '☀️',  ceiling: 'CAVU',    vis: '10+ sm', wind: '7kt',   label: 'Clear & calm' },
  1:  { condition: 'vmc',          icon: '🌤',  ceiling: 'SCT050',  vis: '10 sm',  wind: '12kt',  label: 'Scattered, good vis' },
  2:  { condition: 'marginal_vmc', icon: '🌥',  ceiling: 'BKN025',  vis: '4 sm',   wind: '16kt',  label: 'Low overcast / haze' },
  3:  { condition: 'vmc',          icon: '☀️',  ceiling: 'FEW030',  vis: '10 sm',  wind: '9kt',   label: 'Mostly clear' },
  4:  { condition: 'imc',          icon: '🌧',  ceiling: 'OVC005',  vis: '1 sm',   wind: '22kt',  label: 'IMC · rain · low ceilings' },
  5:  { condition: 'vmc',          icon: '🌤',  ceiling: 'SCT040',  vis: '10 sm',  wind: '8kt',   label: 'Improving, scattered' },
  // Day 6 = Sunday, no operations
  7:  { condition: 'vmc',          icon: '☀️',  ceiling: 'CAVU',    vis: '10+ sm', wind: '5kt',   label: 'CAVU · excellent' },
  8:  { condition: 'vmc',          icon: '☀️',  ceiling: 'FEW040',  vis: '10 sm',  wind: '10kt',  label: 'Light winds, clear' },
  9:  { condition: 'marginal_vmc', icon: '🌦',  ceiling: 'BKN020',  vis: '3 sm',   wind: '18kt',  label: 'Marginal, scattered showers' },
  10: { condition: 'vmc',          icon: '🌤',  ceiling: 'SCT060',  vis: '10 sm',  wind: '7kt',   label: 'Scattered, good vis' },
  11: { condition: 'vmc',          icon: '☀️',  ceiling: 'CAVU',    vis: '10+ sm', wind: '4kt',   label: 'Perfect flying day' },
  12: { condition: 'imc',          icon: '⛈',  ceiling: 'OVC010',  vis: '2 sm',   wind: '25kt',  label: 'Low IMC · gusty' },
}

// Day index → display date label (Mon 3/30 = 0)
const WEEK_START_MS = new Date('2026-03-30').getTime()
export function dayLabel(dayIdx) {
  const d = new Date(WEEK_START_MS + dayIdx * 86_400_000)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

/** Weather fitness for a lesson type.
 *  Returns 'good' | 'marginal' | 'poor'
 */
export function weatherFit(weather, lessonTemplate) {
  if (!weather) return 'good'
  const { condition } = weather
  if (lessonTemplate.type === 'ground') return 'good'  // ground is always fine
  if (!lessonTemplate.preferVmc) {
    // Instrument lesson — any weather fine; IMC is actually best
    return 'good'
  }
  // VFR lesson
  if (condition === 'vmc')          return 'good'
  if (condition === 'marginal_vmc') return 'marginal'
  return 'poor'  // imc
}

export const WEATHER_FIT_COLORS = {
  good:     'text-emerald-400',
  marginal: 'text-amber-400',
  poor:     'text-risk-high',
}

export const WEATHER_FIT_LABELS = {
  good:     'Good fit',
  marginal: 'Marginal',
  poor:     'Not suitable',
}

// ── Lesson templates ─────────────────────────────────────────────────────────
//
// requiresCfii:       true  → CFI must hold CFII rating
// requiresIfrAircraft:true  → aircraft must have ifrCertified===true
// requiresComplex:    true  → aircraft must have complexAircraft===true (Baron/Seneca)
// requiresMulti:      true  → aircraft must have multiEngine===true (Baron)
// preferVmc:          true  → lesson is degraded or cancelled in IMC (VFR lesson)
//                     false → instrument / ground — weather doesn't restrict it

export const LESSON_TEMPLATES = {
  private_pilot: {
    1: [
      { id: 'ppl-1-1', title: 'Intro & Basic Airmanship',          type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'ppl-1-2', title: 'Traffic Pattern & T&Ls',            type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'ppl-1-3', title: 'Emergency Procedures — Forced Ldg', type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'ppl-1-4', title: 'Pre-Solo Ground Review',            type: 'ground',      requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 1.0 },
    ],
    2: [
      { id: 'ppl-2-1', title: 'Slow Flight & Power-Off Stalls',    type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'ppl-2-2', title: 'Steep Turns & S-Turns / Pylons',    type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'ppl-2-3', title: 'Short / Soft Field T&Ls',           type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
    ],
    3: [
      { id: 'ppl-3-1', title: 'Pre-Solo Dual Check',                type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'ppl-3-2', title: 'First Solo — Pattern T&Ls',          type: 'solo',        requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.0 },
      { id: 'ppl-3-3', title: 'Solo Cross-Country Preparation',     type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 2.0 },
    ],
    4: [
      { id: 'ppl-4-1', title: 'Dual Night — Patterns & XC',         type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 2.0 },
      { id: 'ppl-4-2', title: 'Hood Work — Instrument Fundamentals', type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 1.5 },
      { id: 'ppl-4-3', title: 'Solo Night XC (>100nm roundtrip)',    type: 'solo',        requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 2.5 },
    ],
    5: [
      { id: 'ppl-5-1', title: 'Mock Oral Exam',                      type: 'ground',      requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ppl-5-2', title: 'Mock Practical — Full Maneuvers',      type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 2.0 },
      { id: 'ppl-5-3', title: '8710 Review & IACRA Finalization',     type: 'ground',      requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 1.0 },
    ],
  },

  instrument_rating: {
    1: [
      { id: 'ir-1-1', title: 'Attitude Instrument Flying',           type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ir-1-2', title: 'VOR/NDB Tracking & Interception',      type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ir-1-3', title: 'Holding Patterns & Procedure Turns',   type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ir-1-4', title: 'Partial Panel & Unusual Attitudes',    type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 1.5 },
    ],
    2: [
      { id: 'ir-2-1', title: 'ILS Approach — Full Procedure',        type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ir-2-2', title: 'RNAV/GPS Approach (LPV & LNAV)',       type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ir-2-3', title: 'VOR/DME Approach & Circle-to-Land',    type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'ir-2-4', title: 'Missed Approach & Alternate Planning', type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
    ],
    3: [
      { id: 'ir-3-1', title: 'IFR Cross-Country ≥250nm',             type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 4.0 },
      { id: 'ir-3-2', title: 'Mock IFR Practical Test',              type: 'dual_lesson', requiresCfii: true, requiresIfrAircraft: true,  requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 3.0 },
      { id: 'ir-3-3', title: 'CFII Sign-Offs & IACRA Submission',    type: 'ground',      requiresCfii: true, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 1.0 },
    ],
  },

  commercial_pilot: {
    1: [
      { id: 'cpl-1-1', title: 'Chandelles & Lazy 8s',               type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'cpl-1-2', title: 'Eights-on-Pylons',                    type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'cpl-1-3', title: 'Commercial Precision T&Ls',           type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
    ],
    2: [
      { id: 'cpl-2-1', title: 'Complex Endorsement — Retract Gear',  type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: true,  requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'cpl-2-2', title: 'High-Performance Endorsement Flight', type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: true,  requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
      { id: 'cpl-2-3', title: 'Complex Aircraft Solo Practice',      type: 'solo',        requiresCfii: false, requiresIfrAircraft: false, requiresComplex: true,  requiresMulti: false, preferVmc: true,  durationHr: 1.5 },
    ],
    3: [
      { id: 'cpl-3-1', title: 'Dual Night XC (1 of 2)',              type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 3.0 },
      { id: 'cpl-3-2', title: 'Dual Night XC (2 of 2)',              type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 3.0 },
      { id: 'cpl-3-3', title: 'Solo Night T&Ls (5 hrs total)',       type: 'solo',        requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: true,  durationHr: 2.0 },
    ],
    4: [
      { id: 'cpl-4-1', title: 'Mock Oral Exam',                      type: 'ground',      requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 2.0 },
      { id: 'cpl-4-2', title: 'Mock Commercial Practical',           type: 'dual_lesson', requiresCfii: false, requiresIfrAircraft: false, requiresComplex: true,  requiresMulti: false, preferVmc: true,  durationHr: 3.0 },
      { id: 'cpl-4-3', title: 'IACRA & Endorsement Finalization',    type: 'ground',      requiresCfii: false, requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false, preferVmc: false, durationHr: 1.0 },
    ],
  },
}

// ── Aircraft capability helpers ───────────────────────────────────────────────

/** True if the aircraft meets all requirements of a lesson template. */
export function aircraftFitsLesson(aircraft, template) {
  if (!aircraft?.airworthy) return false
  if (template.requiresIfrAircraft && !aircraft.equipment?.ifrCertified) return false
  if (template.requiresComplex    && !aircraft.riskProfile?.complexAircraft) return false
  if (template.requiresMulti      && !aircraft.riskProfile?.multiEngine)     return false
  return true
}

/** Warning flags for a matched aircraft — open squawks, MEL, open ADs. */
export function aircraftWarnings(aircraft) {
  const w = []
  if (aircraft.melItemsOpen?.length)   w.push(`MEL: ${aircraft.melItemsOpen[0].item}`)
  if (aircraft.openSquawks?.some(s => s.status === 'grounding')) w.push('Grounding squawk')
  if (aircraft.airworthinessDirectives?.some(a => a.status === 'open')) w.push('Open AD')
  return w
}

// ── CFI capability helpers ─────────────────────────────────────────────────────

/** True if the CFI (personnel record) can instruct for this lesson template. */
export function cfiFitsLesson(cfi, template) {
  if (!cfi?.cfiCert) return false
  if (template.requiresCfii && !cfi.cfiRatings?.includes('CFII')) return false
  if (template.requiresMulti && !cfi.cfiRatings?.includes('MEI'))  return false
  return true
}

// ── Slot availability ─────────────────────────────────────────────────────────

import { SCHEDULE_SLOTS } from './mockTraining'

/**
 * Returns true if any booking occupies (day, slot) for the given entityId.
 * entityField: 'aircraftId' | 'cfiId' | 'studentId'
 */
export function isSlotOccupied(bookings, day, slot, entityField, entityId) {
  if (!entityId) return false
  const slotIdx = SCHEDULE_SLOTS.indexOf(slot)
  return bookings.some((b) => {
    if (b[entityField] !== entityId) return false
    if (b.day !== day) return false
    const bIdx = SCHEDULE_SLOTS.indexOf(b.slot)
    return slotIdx >= bIdx && slotIdx < bIdx + b.duration
  })
}

/**
 * Find the next available (dayIdx, slot) where student + CFI + aircraft are all free,
 * honoring student preferences where possible.
 *
 * Searches days 0–12 (skipping Sunday index 6).
 * Returns { dayIdx, slot, dateLabel, weather } or null.
 */
export function findNextAvailableSlot(bookings, studentId, cfiId, aircraftId, preferences = {}) {
  const { preferredSlots = [], preferredDays = [], weatherMin = 'any' } = preferences
  const SEARCH_DAYS = [0,1,2,3,4,5,7,8,9,10,11,12]

  // Two passes: first try preferred days/slots, then any day/slot
  for (const strict of [true, false]) {
    for (const dayIdx of SEARCH_DAYS) {
      if (strict && preferredDays.length > 0 && !preferredDays.includes(dayIdx % 7)) continue

      const wx = WEATHER_14DAY[dayIdx]
      if (!wx) continue // Sunday or beyond range

      for (const slot of SCHEDULE_SLOTS) {
        if (strict && preferredSlots.length > 0 && !preferredSlots.includes(slot)) continue

        // Check weather acceptability
        if (weatherMin === 'vmc' && wx.condition === 'imc') continue

        // Check all three resources are free
        const studentBusy  = isSlotOccupied(bookings, dayIdx, slot, 'studentId',  studentId)
        const cfiBusy      = cfiId     ? isSlotOccupied(bookings, dayIdx, slot, 'cfiId',      cfiId)     : false
        const aircraftBusy = aircraftId ? isSlotOccupied(bookings, dayIdx, slot, 'aircraftId', aircraftId) : false

        if (!studentBusy && !cfiBusy && !aircraftBusy) {
          return { dayIdx, slot, dateLabel: dayLabel(dayIdx), weather: wx }
        }
      }
    }
  }
  return null
}

// ── Recommendation engine ─────────────────────────────────────────────────────

/**
 * Generate up to 3 lesson recommendations for a student.
 *
 * Logic:
 * 1. Pick lesson templates for current stage (wrap to next stage if fewer than 3 in current).
 * 2. For each template, select best matching aircraft and CFI from student's assigned resources.
 *    Falls back to fleet-wide search if assigned resources don't match requirements.
 * 3. Find next available slot honoring student preferences.
 * 4. Compute weather fit.
 *
 * @param {object}   student        — mockStudents entry
 * @param {object[]} allPersonnel   — full mockPersonnel array
 * @param {object[]} allAircraft    — full mockAircraft array
 * @param {object[]} bookings       — mockBookings array
 * @returns {Array}  up to 3 recommendation objects
 */
export function recommendLessons(student, allPersonnel, allAircraft, bookings) {
  const programTemplates = LESSON_TEMPLATES[student.program]
  if (!programTemplates) return []

  // Build ordered list of lesson templates: current stage first, then next stage
  const stageNow  = programTemplates[student.currentStage]    ?? []
  const stageNext = programTemplates[student.currentStage + 1] ?? []
  const candidates = [...stageNow, ...stageNext].slice(0, 5) // up to 5 candidates to pick 3 from

  const results = []

  for (const template of candidates) {
    if (results.length >= 3) break

    // ── Select aircraft ────────────────────────────────────────────────────────
    // Prefer aircraft from student's assignedAircraftIds; fall back to fleet.
    const candidateAircraft = [
      ...student.assignedAircraftIds.map(id => allAircraft.find(a => a.id === id)).filter(Boolean),
      ...allAircraft.filter(a => !student.assignedAircraftIds.includes(a.id)),
    ]

    let chosenAircraft = null
    // Ground lessons don't need aircraft
    if (template.type !== 'ground') {
      chosenAircraft = candidateAircraft.find(a => aircraftFitsLesson(a, template)) ?? null
      if (!chosenAircraft && template.type !== 'ground') {
        // No matching aircraft available — still show the lesson but flag it
      }
    }

    // ── Select CFI ─────────────────────────────────────────────────────────────
    // For solo flights, no CFI needed in the booking slot (they fly alone).
    let chosenCfi = null
    if (template.type !== 'solo') {
      const assignedCfi = allPersonnel.find(p => p.id === student.assignedCfiId)
      if (assignedCfi && cfiFitsLesson(assignedCfi, template)) {
        chosenCfi = assignedCfi
      } else {
        // Find another qualified CFI
        chosenCfi = allPersonnel.find(p => p.id !== student.assignedCfiId && cfiFitsLesson(p, template)) ?? null
      }
    }

    // ── Find available slot ────────────────────────────────────────────────────
    const slot = findNextAvailableSlot(
      bookings,
      student.id,
      template.type !== 'solo' ? chosenCfi?.id ?? null : null,
      chosenAircraft?.id ?? null,
      student.preferences,
    )

    // ── Compute weather fit ────────────────────────────────────────────────────
    const wx  = slot?.weather ?? null
    const fit = weatherFit(wx, template)

    // ── Build reason string ────────────────────────────────────────────────────
    const reason = buildReason(student, template, chosenAircraft, chosenCfi)

    // ── Aircraft warnings ──────────────────────────────────────────────────────
    const acWarnings = chosenAircraft ? aircraftWarnings(chosenAircraft) : []

    results.push({ template, aircraft: chosenAircraft, cfi: chosenCfi, slot, wx, fit, reason, acWarnings })
  }

  return results
}

function buildReason(student, template, aircraft, cfi) {
  const parts = []
  const prog = PROGRAMS[student.program]
  if (prog) {
    const stage = prog.stages.find(s => s.number === student.currentStage)
    if (stage) parts.push(`Stage ${student.currentStage}: ${stage.title}`)
  }
  if (template.requiresCfii)        parts.push('CFII required' + (cfi ? ` — ${cfi.name} (${cfi.cfiRatings?.join('/')})` : ' — none available'))
  if (template.requiresIfrAircraft) parts.push('IFR aircraft required' + (aircraft ? ` — ${aircraft.tailNumber} (${aircraft.makeModel})` : ' — none matched'))
  if (template.requiresComplex)     parts.push('Complex endorsement aircraft' + (aircraft ? ` — ${aircraft.tailNumber}` : ' — none matched'))
  return parts.join(' · ')
}
