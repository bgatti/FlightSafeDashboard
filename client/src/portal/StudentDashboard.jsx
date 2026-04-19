import { useState, useEffect, useRef, useMemo } from 'react'
import { useAircraftStars } from '../hooks/useAircraftStars'
import { getAircraftByOperator, mockAircraft } from '../mocks/aircraft'
import { mockPersonnel } from '../mocks/personnel'
import { addSquawk, getSquawks, subscribeSquawks } from '../store/squawks'
import { addServiceRequest, getServiceRequests } from '../store/serviceRequests'
import { addFlight, updateFlight as updateStoreFlight, getAllFlights, subscribe } from '../store/flights'
import { mockStudents, PROGRAMS, mockBookings, SCHEDULE_DAYS } from '../training/mockTraining'
import {
  requirementProgress, metRequirementCount, stageProgress, isCheckrideReady,
  recommendLessons, expiryStatus, expiryLabel, EXPIRY_COLOR, EXPIRY_BG,
  DPE_STATUS_LABEL, DPE_STATUS_COLOR, DPE_STATUS_BG,
  BOOKING_TYPE_COLORS, BOOKING_TYPE_LABELS, WEATHER_FIT_COLORS, WEATHER_FIT_LABELS,
  calcTrainingWB, wbStatusLevel, WB_STATUS, LESSON_TEMPLATES,
} from '../training/trainingUtils'
import { STATUS_COLOR, getAircraftPhoto, fmt$ } from './portalConstants'
import { PortalIcon } from './icons'
import { IcMaint, IcDual, IcSolo, IcGround, IcShield } from './icons'
import { SquawkPanel } from './SquawkPanel'
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

/* ─── Glider ACS task areas (FAA-S-ACS-8B) ─── */
const GLIDER_ACS = {
  dual: [
    { id: 'gacs-preflight', area: 'I', label: 'Preflight Preparation', tasks: ['Pilot Qualifications', 'Airworthiness Requirements', 'Weather Information', 'Performance & Limitations', 'Operation of Systems', 'Aeromedical Factors', 'Aeronautical Decision Making'] },
    { id: 'gacs-preflight-proc', area: 'II', label: 'Preflight Procedures', tasks: ['Assembly & Rigging', 'Ground Handling', 'Preflight Inspection', 'Cockpit Management', 'Tow Equipment Check'] },
    { id: 'gacs-airport-ops', area: 'III', label: 'Airport Operations', tasks: ['Communications', 'Traffic Patterns', 'Runway Incursion Avoidance'] },
    { id: 'gacs-launches', area: 'IV', label: 'Launches & Landings', tasks: ['Normal Aerotow Launch', 'Abnormal Aerotow Procedures', 'Aerotow Boxcar Position', 'Normal Landing', 'Slips to Landing', 'Downwind Landing'] },
    { id: 'gacs-performance', area: 'V', label: 'Performance Maneuvers', tasks: ['Steep Turns', 'Minimum Sink Airspeed', 'Speed-to-Fly'] },
    { id: 'gacs-soaring', area: 'VI', label: 'Soaring Techniques', tasks: ['Thermal Soaring', 'Ridge Soaring', 'Wave Recognition', 'Thermaling Entry & Centering'] },
    { id: 'gacs-slow', area: 'VII', label: 'Slow Flight & Stalls', tasks: ['Maneuvering During Slow Flight', 'Stalls — Straight Ahead', 'Stalls — Turning', 'Spin Awareness'] },
    { id: 'gacs-emergency', area: 'VIII', label: 'Emergency Operations', tasks: ['Rope / Tow Failure — Low Altitude', 'Rope / Tow Failure — High Altitude', 'Off-Field Landing Selection', 'Emergency Equipment & Signals', 'Inadvertent Cloud Entry'] },
    { id: 'gacs-postflight', area: 'IX', label: 'Postflight Procedures', tasks: ['After Landing & Securing', 'Logbook & Documentation'] },
  ],
  solo: [
    { id: 'gsolo-pattern', label: 'Pattern Solo', tasks: ['3 pattern tows to landing', 'Accuracy landings within 200 ft'], minFlights: 1 },
    { id: 'gsolo-soaring', label: 'Solo Soaring', tasks: ['Thermaling solo flight', 'Maintain altitude ≥15 min'], minFlights: 2 },
    { id: 'gsolo-xc', label: 'Solo Cross-Country', tasks: ['Turnpoint XC ≥25 nm', 'Pre-declared goal flight'], minFlights: 1 },
  ],
  ground: [
    { id: 'goral-regs', label: 'Regulations (14 CFR)', tasks: ['Part 61 — Pilot Certificates', 'Part 91 — General Operating Rules', 'NTSB 830 — Accident Reporting'] },
    { id: 'goral-weather', label: 'Soaring Weather', tasks: ['Thermal formation & triggers', 'Ridge lift & wave conditions', 'METAR/TAF interpretation', 'Soaring forecasts (SkySight / RASP)', 'Density altitude effects'] },
    { id: 'goral-performance', label: 'Glider Performance', tasks: ['Polar curves & L/D ratio', 'Weight & balance calculations', 'Speed-to-fly theory', 'Ballast considerations'] },
    { id: 'goral-systems', label: 'Glider Systems', tasks: ['Flight controls & spoilers/dive brakes', 'Release mechanisms', 'Variometer & total energy', 'Pitot-static system', 'Emergency parachute'] },
    { id: 'goral-airspace', label: 'Airspace & Navigation', tasks: ['Airspace classification', 'VFR cloud clearance & visibility', 'Sectional chart reading', 'GPS & turnpoint navigation'] },
    { id: 'goral-adm', label: 'ADM & Human Factors', tasks: ['Aeronautical decision making', 'Risk management (PAVE, IMSAFE)', 'CRM in tow operations', 'Spatial disorientation', 'Hypoxia at altitude'] },
  ],
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
// Glider lesson → ACS task mappings
const GLIDER_LESSON_ACS_MAP = {
  'Glider Intro — Controls & Straight-&-Level':    ['Preflight Inspection', 'Cockpit Management', 'Normal Aerotow Launch', 'Normal Landing'],
  'Aerotow Procedures & Traffic Pattern':           ['Normal Aerotow Launch', 'Abnormal Aerotow Procedures', 'Traffic Patterns', 'Communications'],
  'Stalls & Spin Awareness':                        ['Maneuvering During Slow Flight', 'Stalls — Straight Ahead', 'Stalls — Turning', 'Spin Awareness'],
  'Soaring Techniques — Ridge & Thermal':           ['Thermal Soaring', 'Ridge Soaring', 'Thermaling Entry & Centering', 'Minimum Sink Airspeed'],
  'Pattern & Off-Field Landing Planning':           ['Traffic Patterns', 'Off-Field Landing Selection', 'Slips to Landing', 'Accuracy landings within 200 ft'],
  'Pre-Solo Ground — Regulations & Weather':        ['Pilot Qualifications', 'Airworthiness Requirements', 'Thermal formation & triggers', 'Aeronautical Decision Making'],
  'First Solo — Pattern Tows':                      ['Normal Aerotow Launch', 'Normal Landing', 'Traffic Patterns', 'Communications'],
  'Solo Soaring Practice':                          ['Thermal Soaring', 'Thermaling Entry & Centering', 'Maintain altitude ≥15 min'],
  'Glider Systems & Aerotow Orientation':           ['Preflight Inspection', 'Tow Equipment Check', 'Normal Aerotow Launch', 'Cockpit Management'],
  'Pattern Work & Spot Landings':                   ['Traffic Patterns', 'Normal Landing', 'Slips to Landing', 'Accuracy landings within 200 ft'],
  'Soaring Skills — Thermal Centering':             ['Thermal Soaring', 'Thermaling Entry & Centering', 'Speed-to-Fly'],
  'Emergency Off-Field Procedures':                 ['Rope / Tow Failure — Low Altitude', 'Rope / Tow Failure — High Altitude', 'Off-Field Landing Selection', 'Emergency Equipment & Signals'],
  'Mock Oral Exam — Glider ACS':                    ['Pilot Qualifications', 'Airworthiness Requirements', 'Performance & Limitations', 'Aeronautical Decision Making'],
  'Mock Practical — Add-On Checkride':              ['Steep Turns', 'Stalls — Straight Ahead', 'Slips to Landing', 'Off-Field Landing Selection', 'Thermaling Entry & Centering'],
}

// Fallback: generic items for any lesson not in the map
const GENERIC_ACS = ['Preflight Assessment', 'Normal T&L', 'Communications', 'After Landing', 'Parking & Securing']
const GLIDER_GENERIC_ACS = ['Preflight Inspection', 'Normal Aerotow Launch', 'Normal Landing', 'Communications', 'After Landing & Securing']

/** Pick ACS constant set based on program */
export function getAcsForProgram(programId) {
  if (programId?.startsWith('glider_')) return GLIDER_ACS
  return PPL_ACS
}

/** Pick lesson-ACS map based on program */
export function getLessonAcsMap(programId) {
  if (programId?.startsWith('glider_')) return GLIDER_LESSON_ACS_MAP
  return LESSON_ACS_MAP
}

/** Pick generic fallback ACS tasks based on program */
export function getGenericAcs(programId) {
  if (programId?.startsWith('glider_')) return GLIDER_GENERIC_ACS
  return GENERIC_ACS
}

/* ─── RECENT FLIGHT BOX (unclosed flights — post-flight logging) ─── */
/* ── Inline SVG icons for noise status ── */
const MedalIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M8.5 14 6 22l6-3 6 3-2.5-8" />
    <path d="m9 6 1.5 2L12 7l1.5 1L15 6" strokeWidth="1.2" />
  </svg>
)

const NoiseIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor" opacity="0.25" stroke="currentColor" />
    <path d="M14 8.5a4 4 0 0 1 0 7" />
    <path d="M17 6a8 8 0 0 1 0 12" />
    <line x1="21" y1="3" x2="3" y2="21" strokeWidth="2" opacity="0.7" />
  </svg>
)

function NoiseStatusStrip({ data, loading, tail }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface/50 px-3 py-2.5 mt-2">
        <div className="w-4 h-4 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
        <span className="text-slate-500 text-xs">Checking noise status for {tail}…</span>
      </div>
    )
  }

  if (!data) return null

  const isClean = data.total_offenses === 0
  const hasViolations = data.total_offenses > 0

  const daysSinceText = (() => {
    if (!isClean) return null
    const scores = JSON.parse(localStorage.getItem('noise_scores') || '{}')
    const prev = scores[tail]
    if (prev?.daysSinceLastOffense != null && prev.daysSinceLastOffense > 0) return `${prev.daysSinceLastOffense} days`
    return null
  })()

  if (isClean) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 mt-2">
        <MedalIcon className="w-7 h-7 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-emerald-400 text-xs font-semibold leading-tight">Noise Compliant</div>
          <div className="text-emerald-300/60 text-[10px] leading-tight mt-0.5">
            {daysSinceText ? `${daysSinceText} since last incursion` : 'No noise offenses on record'}
            {data.tracks_seen > 0 && <span className="text-slate-600"> · {data.tracks_seen} tracks reviewed</span>}
          </div>
        </div>
      </div>
    )
  }

  if (hasViolations) {
    const severity = data.worst === 'red' ? 'r' : data.worst === 'yellow' ? 'y' : 'o'
    const styles = {
      r: { border: 'border-red-400/25', bg: 'bg-red-500/5', text: 'text-red-400', dot: 'bg-red-400' },
      y: { border: 'border-amber-400/25', bg: 'bg-amber-500/5', text: 'text-amber-400', dot: 'bg-amber-400' },
      o: { border: 'border-orange-400/25', bg: 'bg-orange-500/5', text: 'text-orange-400', dot: 'bg-orange-400' },
    }[severity]

    return (
      <div className={`rounded-xl border ${styles.border} ${styles.bg} px-3 py-2.5 mt-2 space-y-2`}>
        <div className="flex items-center gap-2.5">
          <NoiseIcon className={`w-6 h-6 ${styles.text} shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className={`${styles.text} text-xs font-semibold leading-tight`}>
              {data.total_offenses} Noise Offense{data.total_offenses !== 1 ? 's' : ''}
            </div>
            <div className="text-slate-500 text-[10px] leading-tight mt-0.5">
              {tail} · worst: <span className={`${styles.text} font-medium`}>{data.worst}</span>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${styles.dot} animate-pulse`} />
        </div>

        {data.offenses?.slice(0, 2).map((o, i) => (
          <div key={i} className="flex items-center justify-between text-[10px] border-t border-white/5 pt-1.5">
            <span className="text-slate-400 truncate">{o.date} · {o.zone}</span>
            <span className={`${o.worst === 'red' ? 'text-red-400' : 'text-amber-400'} font-medium shrink-0 ml-2`}>
              {o.points}pts · {o.peakAlt?.toLocaleString()}ft
            </span>
          </div>
        ))}

        {data.landing_url && (
          <a href={data.landing_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-sky-400 hover:text-sky-300 text-[11px] font-medium pt-1 transition-colors">
            View Full Report
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
          </a>
        )}
      </div>
    )
  }

  return null
}

export function RecentFlightBox({ user, operator = 'journeys' }) {
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
    if (f._source !== `${operator}_portal` && f.operator !== operator) return false
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
        <RecentFlightCard key={f.id} flight={f} user={user} squawks={squawks} operator={operator} />
      ))}
    </div>
  )
}

export function RecentFlightCard({ flight, user, squawks, operator = 'journeys' }) {
  const [expanded, setExpanded] = useState(false)
  const [tachStart, setTachStart] = useState('')
  const [tachEnd, setTachEnd] = useState('')
  const [hobbsStart, setHobbsStart] = useState('')
  const [hobbsEnd, setHobbsEnd] = useState('')
  const [billingMode, setBillingMode] = useState('hobbs')
  const [realHours, setRealHours] = useState('')
  const [numLaunches, setNumLaunches] = useState(flight.towInfo?.numTows || 1)
  const [towHeight, setTowHeight] = useState(flight.towInfo?.towHeights?.[0] || 2000)
  const [rating, setRating] = useState(0) // 1-5 stars
  const [noSquawks, setNoSquawks] = useState(false)
  const [showSquawkForm, setShowSquawkForm] = useState(false)
  const [squawkDesc, setSquawkDesc] = useState('')
  const [squawkSeverity, setSquawkSeverity] = useState('monitoring')
  const [acsChecks, setAcsChecks] = useState({})
  const [showSafetyReport, setShowSafetyReport] = useState(false)
  const [safetyCategory, setSafetyCategory] = useState('')
  const [safetyNarrative, setSafetyNarrative] = useState('')
  const [safetyItems, setSafetyItems] = useState({})
  const [safetySubmitted, setSafetySubmitted] = useState(false)
  const [pirepTurb, setPirepTurb] = useState('') // NEG, LGT, MOD, SEV
  const [pirepAlt, setPirepAlt] = useState('')
  const [pirepIcing, setPirepIcing] = useState('')
  const [pirepVis, setPirepVis] = useState(false)
  const [pirepWind, setPirepWind] = useState(false)
  const [pirepOther, setPirepOther] = useState('')
  const [closed, setClosed] = useState(false)
  const [noiseData, setNoiseData] = useState(null)
  const [noiseLoading, setNoiseLoading] = useState(false)

  const depTime = new Date(flight.plannedDepartureUtc)
  const isPast = depTime.getTime() < Date.now()
  const acSquawks = squawks.filter((s) => s.tailNumber === flight.tailNumber && s.status !== 'closed').slice(0, 5)

  // Detect glider
  const ac = mockAircraft.find((a) => a.tailNumber === flight.tailNumber || a.tailNumber === flight.callsign)
  const isGlider = ac?.glider || ac?.fboCategory === 'glider' || operator === 'mhg'

  // Fetch noise offenses immediately for Ready-to-Close flights, or when expanded
  const noiseTail = flight.tailNumber || flight.callsign
  useEffect(() => {
    if ((!expanded && !isPast) || !noiseTail || noiseTail === 'SIM') return
    setNoiseLoading(true)
    fetch(`http://localhost:5174/api/offenses?tail=${encodeURIComponent(noiseTail)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setNoiseData(data)
          const key = `noise_offenses_${noiseTail}`
          const history = JSON.parse(localStorage.getItem(key) || '[]')
          history.push({ fetchedAt: new Date().toISOString(), flightId: flight.id, ...data })
          localStorage.setItem(key, JSON.stringify(history))
          const scoreKey = 'noise_scores'
          const scores = JSON.parse(localStorage.getItem(scoreKey) || '{}')
          scores[noiseTail] = {
            lastChecked: new Date().toISOString(),
            totalOffenses: data.total_offenses,
            worst: data.worst,
            tracksSeen: data.tracks_seen,
            daysSinceLastOffense: data.total_offenses === 0
              ? (scores[noiseTail]?.daysSinceLastOffense || null)
              : 0,
          }
          localStorage.setItem(scoreKey, JSON.stringify(scores))
        }
      })
      .catch(() => {})
      .finally(() => setNoiseLoading(false))
  }, [expanded, noiseTail])

  // ACS items for this lesson — check _lessonTitle first, then _sessionLabel
  const lessonTitle = flight._lessonTitle || flight._sessionLabel || ''
  const acsMap = isGlider ? GLIDER_LESSON_ACS_MAP : LESSON_ACS_MAP
  const acsItems = acsMap[lessonTitle] || acsMap[Object.keys(acsMap).find((k) => lessonTitle.includes(k))] || GENERIC_ACS
  const allAcsChecked = acsItems.every((item) => acsChecks[item])
  const getBillableTime = () => {
    if (billingMode === 'hobbs' && hobbsStart && hobbsEnd) return (parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)
    if (billingMode === 'tach' && tachStart && tachEnd) return (parseFloat(tachEnd) - parseFloat(tachStart)).toFixed(1)
    if (billingMode === 'real_hour' && realHours) return parseFloat(realHours).toFixed(1)
    return null
  }
  const billableTime = getBillableTime()
  const billingLabel = billingMode === 'hobbs' ? 'Hobbs' : billingMode === 'tach' ? 'Tach' : 'Real hr'

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
        billingMode,
        tachStart: tachStart || null, tachEnd: tachEnd || null,
        hobbsStart: hobbsStart || null, hobbsEnd: hobbsEnd || null,
        hobbsTime: billableTime,
        realHours: realHours || null,
        numLaunches: isGlider ? numLaunches : null,
        towHeight: isGlider ? towHeight : null,
        rating,
        noSquawks,
        acsResults: acsChecks,
        acsAllMet: allAcsChecked,
        pirep: (pirepTurb || pirepIcing || pirepVis || pirepWind || pirepOther) ? { turbulence: pirepTurb || null, altitude: pirepAlt || null, icing: pirepIcing || null, restrictedVis: pirepVis, shearOrGusts: pirepWind, remarks: pirepOther || null } : null,
        safetyReport: safetySubmitted ? { category: safetyCategory, items: safetyItems, narrative: safetyNarrative } : null,
        closedBy: user.name,
        closedAt: new Date().toISOString(),
      },
    })
    setClosed(true)
  }

  if (closed) {
    const wasCancelled = flight.status === 'cancelled' || (!isPast && closed)
    return (
      <div className={`${wasCancelled ? 'bg-slate-400/8 border-slate-400/20' : 'bg-green-400/8 border-green-400/20'} border rounded-2xl p-4 flex items-center gap-3 animate-[fadeIn_0.3s_ease]`}>
        {(() => { const photo = getAircraftPhoto(ac?.makeModel); return photo ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-card flex-shrink-0">
            <img src={photo} alt={flight.tailNumber} loading="lazy" className="w-full h-full object-cover" />
          </div>
        ) : <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${wasCancelled ? 'border-slate-500 text-slate-500' : 'border-green-400/50 text-green-400'}`}>{wasCancelled ? '—' : '✓'}</span> })()}
        <div>
          <div className={`${wasCancelled ? 'text-slate-400' : 'text-green-400'} font-semibold text-sm`}>{wasCancelled ? 'Cancelled' : 'Flight closed'} — {flight.tailNumber || flight._sessionLabel}</div>
          <div className={`${wasCancelled ? 'text-slate-500' : 'text-green-400/60'} text-xs`}>{flight._sessionLabel || flight.callsign}{billableTime && !wasCancelled ? ` · ${billableTime} ${billingLabel}` : ''}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 transition-all ${isPast ? 'bg-amber-500/8 border-amber-400/25' : 'bg-sky-500/8 border-sky-400/25'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {(() => { const photo = getAircraftPhoto(ac?.makeModel); return photo ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-card flex-shrink-0">
              <img src={photo} alt={flight.tailNumber} loading="lazy" className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className={`w-3 h-3 rounded-full ${isPast ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`} />
          ) })()}
          <div>
            <div className="text-white font-bold text-base">{flight._sessionLabel || `${flight.tailNumber} — ${flight.missionType}`}</div>
            <div className="text-slate-400 text-xs">
              {flight.tailNumber} · {depTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {depTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {flight.pic && ` · PIC: ${flight.pic}`}
              {flight._duration && ` · ${flight._duration} hr`}
              {flight.towInfo?.numTows && ` · ${flight.towInfo.numTows} tow${flight.towInfo.numTows > 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Compact noise indicator on collapsed card */}
          {isPast && !expanded && noiseTail && noiseTail !== 'SIM' && (
            noiseLoading ? (
              <div className="w-4 h-4 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
            ) : noiseData ? (
              noiseData.total_offenses === 0 ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-400/20 rounded-full px-2.5 py-1" title="No noise offenses on record">
                  <MedalIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px] font-semibold">Clean</span>
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
                  noiseData.worst === 'red' ? 'bg-red-500/10 border-red-400/20' : 'bg-amber-500/10 border-amber-400/20'
                }`} title={`${noiseData.total_offenses} noise offense${noiseData.total_offenses !== 1 ? 's' : ''}`}>
                  <NoiseIcon className={`w-3.5 h-3.5 ${noiseData.worst === 'red' ? 'text-red-400' : 'text-amber-400'}`} />
                  <span className={`text-[10px] font-semibold ${noiseData.worst === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                    {noiseData.total_offenses}
                  </span>
                </div>
              )
            ) : null
          )}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isPast ? 'bg-amber-400/20 text-amber-400' : 'bg-sky-400/20 text-sky-400'}`}>
            {isPast ? 'Ready to Close' : 'Upcoming'}
          </span>
          <span className="text-slate-500 text-sm">{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
          {/* Billing mode (gliders) */}
          {isGlider && (
            <div>
              <label className="text-slate-500 text-xs block mb-1.5">Billing Method</label>
              <div className="flex gap-2">
                {[{ id: 'real_hour', l: 'Real Hour' }, { id: 'tach', l: 'Tach' }, { id: 'hobbs', l: 'Hobbs' }].map((m) => (
                  <button key={m.id} onClick={() => setBillingMode(m.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border ${billingMode === m.id ? 'bg-sky-500 text-white border-sky-500' : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'}`}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time inputs */}
          {billingMode === 'real_hour' && isGlider ? (
            <div>
              <label className="text-slate-500 text-xs block mb-1">Flight Time (hours)</label>
              <input type="number" step="0.1" min="0" placeholder="e.g. 0.8" value={realHours} onChange={(e) => setRealHours(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(!isGlider || billingMode === 'tach' ? [
                { label: 'Tach Start', val: tachStart, set: setTachStart, ph: '4521.3' },
                { label: 'Tach End', val: tachEnd, set: setTachEnd, ph: '4523.1' },
              ] : []).concat(!isGlider || billingMode === 'hobbs' ? [
                { label: 'Hobbs Start', val: hobbsStart, set: setHobbsStart, ph: '1120.5' },
                { label: 'Hobbs End', val: hobbsEnd, set: setHobbsEnd, ph: '1122.3' },
              ] : []).map((f) => (
                <div key={f.label}>
                  <label className="text-slate-500 text-xs block mb-1">{f.label}</label>
                  <input type="number" step="0.1" placeholder={`e.g. ${f.ph}`} value={f.val} onChange={(e) => f.set(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none" />
                </div>
              ))}
            </div>
          )}
          {billableTime && <div className="text-sky-400 text-sm font-medium">{billingLabel}: {billableTime} hrs</div>}

          {/* Glider launch tracking */}
          {isGlider && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 text-xs block mb-1">Launches</label>
                <input type="number" min="1" max="10" value={numLaunches} onChange={(e) => setNumLaunches(parseInt(e.target.value) || 1)}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none" />
              </div>
              <div>
                <label className="text-slate-500 text-xs block mb-1">Tow Height (ft AGL)</label>
                <select value={towHeight} onChange={(e) => setTowHeight(parseInt(e.target.value))}
                  className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-sky-400 focus:outline-none">
                  {[1000, 1500, 2000, 2500, 3000, 4000].map((h) => <option key={h} value={h}>{h.toLocaleString()} ft</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ACS Standards checklist */}
          {acsItems.length > 0 && isPast && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-400 text-xs font-semibold">ACS Standards</label>
                <button onClick={() => { const all = {}; acsItems.forEach((t) => { all[t] = !allAcsChecked }); setAcsChecks(all) }}
                  className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors">{allAcsChecked ? 'Uncheck all' : 'Check all'}</button>
              </div>
              <div className="space-y-0.5">
                {acsItems.map((item) => (
                  <label key={item} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={!!acsChecks[item]}
                      onChange={(e) => setAcsChecks((prev) => ({ ...prev, [item]: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded border-slate-600 bg-surface text-sky-500 focus:ring-sky-400/30" />
                    <span className={`text-xs ${acsChecks[item] ? 'text-green-400' : 'text-slate-400 group-hover:text-slate-200'}`}>{item}</span>
                  </label>
                ))}
              </div>
              <div className={`text-[10px] mt-1 ${allAcsChecked ? 'text-green-400' : 'text-slate-600'}`}>
                {Object.values(acsChecks).filter(Boolean).length}/{acsItems.length} meets standards
              </div>
            </div>
          )}

          {/* ACS items preview (when not past — show what will be evaluated) */}
          {acsItems.length > 0 && !isPast && (
            <div>
              <label className="text-slate-500 text-[10px] uppercase tracking-wide">ACS Topics for this lesson</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {acsItems.map((item) => (
                  <span key={item} className="text-[10px] bg-sky-400/10 text-sky-400/70 px-1.5 py-0.5 rounded">{item}</span>
                ))}
              </div>
            </div>
          )}

          {/* Scrub / Cancel (upcoming flights only) */}
          {!isPast && !closed && (
            <div>
              <label className="text-slate-500 text-[10px] uppercase tracking-wide mb-1.5 block">Cancel Reservation</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { reason: 'weather', label: '🌧️ Weather', color: 'sky' },
                  { reason: 'aircraft', label: 'Aircraft Unavailable', color: 'amber' },
                  { reason: 'personal', label: '👤 Personal / Schedule', color: 'slate' },
                  { reason: 'instructor', label: '👨‍✈️ Instructor Unavailable', color: 'purple' },
                ].map((opt) => (
                  <button key={opt.reason} onClick={() => {
                      updateStoreFlight(flight.id, { status: 'cancelled', _cancelReason: opt.reason, _cancelledBy: user.name, _cancelledAt: new Date().toISOString() })
                      setClosed(true)
                    }}
                    className={`text-xs border rounded-xl px-3 py-2 transition-all hover:bg-${opt.color}-400/10 border-${opt.color}-400/20 text-${opt.color}-400`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
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

          {/* PIREP — lightweight pilot report */}
          {isPast && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 text-[10px] uppercase tracking-wide w-full mb-0.5">PIREP</span>
              {/* Turbulence */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10px]">Turb:</span>
                {[
                  { v: 'NEG', l: '−', tip: 'Negative' },
                  { v: 'LGT', l: 'L', tip: 'Light' },
                  { v: 'MOD', l: 'M', tip: 'Moderate' },
                  { v: 'SEV', l: 'S', tip: 'Severe' },
                ].map((t) => (
                  <button key={t.v} title={t.tip} onClick={() => setPirepTurb(pirepTurb === t.v ? '' : t.v)}
                    className={`w-6 h-6 rounded text-[10px] font-bold transition-all ${
                      pirepTurb === t.v
                        ? t.v === 'SEV' ? 'bg-red-400/25 text-red-400 ring-1 ring-red-400/40'
                          : t.v === 'MOD' ? 'bg-amber-400/25 text-amber-400 ring-1 ring-amber-400/40'
                          : t.v === 'LGT' ? 'bg-sky-400/25 text-sky-400 ring-1 ring-sky-400/40'
                          : 'bg-green-400/25 text-green-400 ring-1 ring-green-400/40'
                        : 'bg-surface border border-surface-border text-slate-600 hover:text-slate-300'
                    }`}>{t.l}</button>
                ))}
              </div>
              {/* Altitude */}
              {pirepTurb && pirepTurb !== 'NEG' && (
                <input type="text" placeholder="Alt (e.g. 8500)" value={pirepAlt} onChange={(e) => setPirepAlt(e.target.value)}
                  className="w-20 bg-surface border border-surface-border rounded px-1.5 py-1 text-[10px] text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
              )}
              {/* Icing */}
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[10px]">Ice:</span>
                {['NEG', 'TRC', 'LGT', 'MOD'].map((v) => (
                  <button key={v} onClick={() => setPirepIcing(pirepIcing === v ? '' : v)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                      pirepIcing === v ? 'bg-cyan-400/25 text-cyan-400 ring-1 ring-cyan-400/40' : 'bg-surface border border-surface-border text-slate-600 hover:text-slate-300'
                    }`}>{v}</button>
                ))}
              </div>
              {/* Vis / Wind */}
              <button onClick={() => setPirepVis(!pirepVis)}
                className={`px-2 py-0.5 rounded text-[10px] transition-all ${pirepVis ? 'bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/30' : 'bg-surface border border-surface-border text-slate-600 hover:text-slate-300'}`}>
                🌫️ Vis
              </button>
              <button onClick={() => setPirepWind(!pirepWind)}
                className={`px-2 py-0.5 rounded text-[10px] transition-all ${pirepWind ? 'bg-amber-400/20 text-amber-400 ring-1 ring-amber-400/30' : 'bg-surface border border-surface-border text-slate-600 hover:text-slate-300'}`}>
                💨 Shear
              </button>
              {/* Other */}
              <input type="text" placeholder="Other..." value={pirepOther} onChange={(e) => setPirepOther(e.target.value)}
                className="flex-1 min-w-[80px] bg-surface border border-surface-border rounded px-1.5 py-1 text-[10px] text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
            </div>
          )}

          {/* NASA Report / Airport Issue */}
          {isPast && (
            <div className="border-t border-white/10 pt-4">
              <button onClick={() => setShowSafetyReport(!showSafetyReport)}
                className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl text-xs font-medium transition-all border ${
                  showSafetyReport || safetySubmitted ? 'bg-red-400/10 border-red-400/25 text-red-400' : 'bg-surface border-surface-border text-slate-400 hover:border-red-400/30 hover:text-red-400'
                }`}>
                <span>🛡️ {safetySubmitted ? 'Safety Report Filed' : 'NASA Report / Airport Safety Issue'}</span>
                <span className="text-[10px] opacity-60">{showSafetyReport ? '▾' : '▸'}</span>
              </button>

              {showSafetyReport && !safetySubmitted && (
                <div className="mt-3 bg-red-400/[0.03] border border-red-400/15 rounded-xl p-4 space-y-3 animate-[fadeIn_0.3s_ease]">
                  <p className="text-slate-400 text-[10px]">Report safety-related events per FAA AC 00-46F. NASA ASRS reports provide immunity from FAA certificate action for inadvertent violations reported within 10 days.</p>

                  {/* Category */}
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase tracking-wide block mb-1.5">Event Category</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { id: 'airspace', label: 'Airspace Deviation / Violation' },
                        { id: 'separation', label: 'Loss of Separation / NMAC' },
                        { id: 'runway', label: 'Runway Incursion / Excursion' },
                        { id: 'atc', label: 'ATC Issue / Communication' },
                        { id: 'weather', label: 'Weather Encounter / Windshear' },
                        { id: 'equipment', label: 'Equipment Malfunction In-Flight' },
                        { id: 'bird', label: 'Bird / Wildlife Strike' },
                        { id: 'airport', label: 'Airport Facility / NAVAID Issue' },
                        { id: 'other', label: 'Other Safety Concern' },
                      ].map((cat) => (
                        <button key={cat.id} onClick={() => setSafetyCategory(cat.id)}
                          className={`text-left p-2 rounded-lg text-[10px] transition-all border ${
                            safetyCategory === cat.id ? 'bg-red-400/15 border-red-400/30 text-red-300' : 'bg-surface border-surface-border text-slate-400 hover:border-red-400/20'
                          }`}>{cat.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Common items — quick checkboxes */}
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase tracking-wide block mb-1.5">Observed Issues (check all that apply)</label>
                    <div className="space-y-1">
                      {[
                        { id: 'papi', label: 'PAPI / VASI light malfunction or discrepancy' },
                        { id: 'reil', label: 'REIL / approach lighting inoperative' },
                        { id: 'windsock', label: 'Wind indicator / windsock not visible or damaged' },
                        { id: 'rwycond', label: 'Runway condition (FOD, standing water, ice, cracks)' },
                        { id: 'taxicond', label: 'Taxiway marking / signage faded or missing' },
                        { id: 'congestion', label: 'Traffic congestion / pattern conflict' },
                        { id: 'noise', label: 'Noise abatement procedure concern' },
                        { id: 'freq', label: 'CTAF / frequency congestion or blocked transmission' },
                        { id: 'terrain', label: 'Obstacle / terrain concern on approach or departure' },
                        { id: 'wildlife', label: 'Wildlife on or near runway / movement area' },
                        { id: 'tfrnotam', label: 'TFR / NOTAM discrepancy or not published' },
                        { id: 'uas', label: 'UAS / drone sighting near airport' },
                      ].map((item) => (
                        <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                          <input type="checkbox" checked={!!safetyItems[item.id]}
                            onChange={(e) => setSafetyItems((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-surface text-red-500 focus:ring-red-400/30 mt-0.5" />
                          <span className={`text-xs ${safetyItems[item.id] ? 'text-red-300' : 'text-slate-400 group-hover:text-slate-200'}`}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Narrative */}
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase tracking-wide block mb-1.5">Narrative (describe what happened)</label>
                    <textarea rows={3} value={safetyNarrative} onChange={(e) => setSafetyNarrative(e.target.value)}
                      placeholder="Describe the event: what happened, where, when, contributing factors, and corrective action taken. Include altitude, heading, weather conditions, and phase of flight."
                      className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-red-400 focus:outline-none resize-none" />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-slate-600 text-[10px] max-w-[60%]">
                      Filed by {user.name} · {flight.tailNumber} · KBDU · {new Date().toISOString().split('T')[0]}
                    </div>
                    <button onClick={() => {
                        setSafetySubmitted(true)
                        setShowSafetyReport(false)
                        // Also create a service request for the airport manager
                        addServiceRequest({
                          id: `sr-safety-${Date.now()}`, type: 'safety_report',
                          tailNumber: flight.tailNumber,
                          requestedBy: user.name, requestedDate: new Date().toISOString().split('T')[0],
                          description: safetyNarrative,
                          notes: `Category: ${safetyCategory}. Items: ${Object.keys(safetyItems).filter((k) => safetyItems[k]).join(', ')}. Flight: ${flight._sessionLabel || flight.tailNumber}. Filed per FAA AC 00-46F.`,
                          status: 'requested', operator,
                        })
                      }}
                      disabled={!safetyCategory && !safetyNarrative.trim() && Object.values(safetyItems).filter(Boolean).length === 0}
                      className="bg-red-500 hover:bg-red-400 disabled:bg-slate-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors">
                      File Safety Report
                    </button>
                  </div>

                  <p className="text-slate-600 text-[10px]">
                    For NASA ASRS submission: <a href="https://asrs.arc.nasa.gov/report/electronic.html" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">asrs.arc.nasa.gov ↗</a>
                    {' · '}FSDO reporting: <a href="https://www.faa.gov/about/office_org/field_offices/fsdo" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">faa.gov/fsdo ↗</a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Noise compliance status */}
          {noiseTail && noiseTail !== 'SIM' && (
            <NoiseStatusStrip data={noiseData} loading={noiseLoading} tail={noiseTail} />
          )}

          {/* Close flight button */}
          <button onClick={handleClose}
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2">
            Close Flight{billableTime ? ` — ${billableTime} ${billingLabel}` : ''}{isGlider && numLaunches ? ` · ${numLaunches} tow${numLaunches > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

export function LessonClosePanel({ flight, user, onClose, operator = 'journeys' }) {
  const [tachStart, setTachStart] = useState('')
  const [tachEnd, setTachEnd] = useState('')
  const [hobbsStart, setHobbsStart] = useState('')
  const [hobbsEnd, setHobbsEnd] = useState('')
  // Glider billing: real hour (clock), tach, or no meter
  const [billingMode, setBillingMode] = useState('hobbs') // 'hobbs' | 'tach' | 'real_hour'
  const [realHours, setRealHours] = useState('')
  const [numLaunches, setNumLaunches] = useState(flight.towInfo?.numTows || 1)
  const [towHeight, setTowHeight] = useState(flight.towInfo?.towHeights?.[0] || 2000)
  const [rating, setRating] = useState(0)
  const [acsChecks, setAcsChecks] = useState({})
  const [noSquawks, setNoSquawks] = useState(false)
  const [showSquawkForm, setShowSquawkForm] = useState(false)
  const [squawkDesc, setSquawkDesc] = useState('')
  const [squawkSeverity, setSquawkSeverity] = useState('monitoring')
  const [route, setRoute] = useState(flight.waypoints?.join(' → ') || '')
  const [flightNotes, setFlightNotes] = useState('')
  const [closed, setClosed] = useState(false)

  // Detect glider aircraft (no hobbs on many gliders)
  const ac = mockAircraft.find((a) => a.tailNumber === flight.tailNumber || a.tailNumber === flight.callsign)
  const isGlider = ac?.glider || ac?.fboCategory === 'glider' || operator === 'mhg'

  // Computed billable time
  const getBillableTime = () => {
    if (billingMode === 'hobbs' && hobbsStart && hobbsEnd) return (parseFloat(hobbsEnd) - parseFloat(hobbsStart)).toFixed(1)
    if (billingMode === 'tach' && tachStart && tachEnd) return (parseFloat(tachEnd) - parseFloat(tachStart)).toFixed(1)
    if (billingMode === 'real_hour' && realHours) return parseFloat(realHours).toFixed(1)
    return null
  }
  const billableTime = getBillableTime()
  const billingLabel = billingMode === 'hobbs' ? 'Hobbs' : billingMode === 'tach' ? 'Tach' : 'Real hr'

  // Find ACS items for this lesson — use program-appropriate map
  const lessonStudent = mockStudents.find((s) => s.name.toLowerCase().includes(user?.name?.split(' ')[0]?.toLowerCase()))
  const lessonProgramId = lessonStudent?.program
  const lessonAcsMap = getLessonAcsMap(lessonProgramId)
  const lessonGenericAcs = getGenericAcs(lessonProgramId)
  const lessonTitle = flight._sessionLabel?.split('—')[1]?.trim() || flight._sessionLabel || ''
  const acsItems = lessonAcsMap[lessonTitle] || lessonAcsMap[Object.keys(lessonAcsMap).find((k) => lessonTitle.includes(k))] || lessonGenericAcs

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
        billingMode,
        tachStart: tachStart || null, tachEnd: tachEnd || null,
        hobbsStart: hobbsStart || null, hobbsEnd: hobbsEnd || null,
        hobbsTime: billableTime,
        realHours: realHours || null,
        numLaunches: isGlider ? numLaunches : null,
        towHeight: isGlider ? towHeight : null,
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
        <span className="text-green-400 font-semibold text-sm">✓ Lesson closed{billableTime ? ` — ${billableTime} ${billingLabel}` : ''}{isGlider && numLaunches ? ` · ${numLaunches} launch${numLaunches > 1 ? 'es' : ''}` : ''}</span>
      </div>
    )
  }

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-4 animate-[fadeIn_0.3s_ease]">
      <h4 className="text-white font-bold text-sm">Close Lesson — {flight._sessionLabel || flight.tailNumber}</h4>

      {/* Billing mode selector (gliders show all options, powered defaults to hobbs) */}
      {isGlider && (
        <div>
          <label className="text-slate-500 text-[10px] uppercase tracking-wide block mb-1">Billing Method</label>
          <div className="flex gap-2">
            {[
              { id: 'real_hour', label: 'Real Hour (clock)' },
              { id: 'tach', label: 'Tach Time' },
              { id: 'hobbs', label: 'Hobbs' },
            ].map((m) => (
              <button key={m.id} onClick={() => setBillingMode(m.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${billingMode === m.id ? 'bg-sky-500 text-white border-sky-500' : 'bg-surface border-surface-border text-slate-400 hover:border-slate-500'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time inputs — vary by billing mode */}
      {billingMode === 'real_hour' ? (
        <div>
          <label className="text-slate-600 text-[10px]">Flight Time (hours)</label>
          <input type="number" step="0.1" min="0" placeholder="e.g. 0.8" value={realHours} onChange={(e) => setRealHours(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
          {realHours && <div className="text-sky-400 text-xs mt-1">Billable: {parseFloat(realHours).toFixed(1)} real hrs</div>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {billingMode === 'tach' || !isGlider ? [
            { label: 'Tach Start', val: tachStart, set: setTachStart },
            { label: 'Tach End', val: tachEnd, set: setTachEnd },
          ] : []}
          {billingMode === 'hobbs' || !isGlider ? [
            { label: 'Hobbs Start', val: hobbsStart, set: setHobbsStart },
            { label: 'Hobbs End', val: hobbsEnd, set: setHobbsEnd },
          ] : []}
          {/* For powered aircraft, show all 4 fields */}
          {(!isGlider ? [
            { label: 'Tach Start', val: tachStart, set: setTachStart },
            { label: 'Tach End', val: tachEnd, set: setTachEnd },
            { label: 'Hobbs Start', val: hobbsStart, set: setHobbsStart },
            { label: 'Hobbs End', val: hobbsEnd, set: setHobbsEnd },
          ] : billingMode === 'tach' ? [
            { label: 'Tach Start', val: tachStart, set: setTachStart },
            { label: 'Tach End', val: tachEnd, set: setTachEnd },
          ] : billingMode === 'hobbs' ? [
            { label: 'Hobbs Start', val: hobbsStart, set: setHobbsStart },
            { label: 'Hobbs End', val: hobbsEnd, set: setHobbsEnd },
          ] : []).map((f) => (
            <div key={f.label}>
              <label className="text-slate-600 text-[10px]">{f.label}</label>
              <input type="number" step="0.1" placeholder="0.0" value={f.val} onChange={(e) => f.set(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-700 focus:border-sky-400 focus:outline-none" />
            </div>
          ))}
        </div>
      )}
      {billableTime && <div className="text-sky-400 text-xs">{billingLabel}: {billableTime} hrs</div>}

      {/* Glider launch tracking */}
      {isGlider && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-slate-600 text-[10px]">Launches</label>
            <input type="number" min="1" max="10" value={numLaunches} onChange={(e) => setNumLaunches(parseInt(e.target.value) || 1)}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-sky-400 focus:outline-none" />
          </div>
          <div>
            <label className="text-slate-600 text-[10px]">Tow Height (ft AGL)</label>
            <select value={towHeight} onChange={(e) => setTowHeight(parseInt(e.target.value))}
              className="w-full bg-surface border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-sky-400 focus:outline-none">
              {[1000, 1500, 2000, 2500, 3000, 4000].map((h) => <option key={h} value={h}>{h.toLocaleString()} ft</option>)}
            </select>
          </div>
        </div>
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
        Close Lesson{billableTime ? ` — ${billableTime} ${billingLabel}` : ''}{isGlider && numLaunches ? ` · ${numLaunches} tow${numLaunches > 1 ? 's' : ''}` : ''}
      </button>
    </div>
  )
}

export function StudentDashboard({ user, operator = 'journeys' }) {
  const student = useMemo(() => {
    // Match by studentId first (personas carry this), then by name
    if (user.studentId) {
      const byId = mockStudents.find((s) => s.id === user.studentId)
      if (byId) return byId
    }
    const byName = mockStudents.find((s) => s.name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()))
    return byName || mockStudents.find((s) => s.id === 'std-002') || mockStudents[0]
  }, [user.name, user.studentId])

  // Use user.program when persona specifies one (e.g. glider persona falling back to a PPL student record)
  const effectiveProgram = user.program || student.program
  const program = PROGRAMS[effectiveProgram]
  const programAcs = getAcsForProgram(effectiveProgram)
  const isGliderProgram = effectiveProgram?.startsWith('glider_')
  const cfi = mockPersonnel.find((p) => p.id === student.assignedCfiId)
  const reqs = requirementProgress(student, effectiveProgram)
  const metCount = metRequirementCount(student, effectiveProgram)
  const progress = stageProgress(student, effectiveProgram)
  const [acsTab, setAcsTab] = useState('dual')
  const [closingFlightId, setClosingFlightId] = useState(null)
  const [toast, setToast] = useState(null)

  // Lesson recommendations
  const [skippedSlots, setSkippedSlots] = useState(new Set())
  const [acceptedBookings, setAcceptedBookings] = useState([])
  const [acceptedIds, setAcceptedIds] = useState(new Set())

  // Load user's calendar bookings from localStorage + mockBookings for this student
  const BOOKINGS_KEY_STUDENT = `journeys_bookings_${user.id}`
  const [calendarBookings, setCalendarBookings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY_STUDENT) || '[]') } catch { return [] }
  })
  useEffect(() => {
    // Re-read localStorage periodically in case ScheduleSection adds bookings
    const interval = setInterval(() => {
      try { setCalendarBookings(JSON.parse(localStorage.getItem(BOOKINGS_KEY_STUDENT) || '[]')) } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [BOOKINGS_KEY_STUDENT])

  const myMockBookings = useMemo(() =>
    mockBookings.filter((b) => b.studentId === student.id),
    [student.id])

  const allBookings = [...mockBookings, ...acceptedBookings]
  // Build past-slot skip set so recommendations are always in the future
  const pastSkipSet = useMemo(() => {
    const s = new Set(skippedSlots)
    const d = new Date()
    const dow = d.getDay()
    const todayIdx = dow === 0 ? 6 : dow - 1
    const nowHour = d.getHours()
    const SLOTS = ['0700','0800','0900','1000','1100','1200','1300','1400','1500','1600','1700']
    for (let di = 0; di <= 12; di++) {
      if (di === 6) continue
      const mapped = di >= 7 ? di - 7 : di
      if (di < 7 && mapped < todayIdx) { SLOTS.forEach((sl) => s.add(`${di}:${sl}`)); continue }
      if (di < 7 && mapped === todayIdx) { SLOTS.filter((sl) => parseInt(sl.slice(0, 2), 10) <= nowHour).forEach((sl) => s.add(`${di}:${sl}`)) }
    }
    return s
  }, [skippedSlots])
  const allRecommendations = recommendLessons(student, mockPersonnel, mockAircraft, allBookings, pastSkipSet)

  // Active / upcoming lessons from all flights + squawks for close-out
  const [flights, setFlights] = useState(() => getAllFlights())
  const [squawksForClose, setSquawksForClose] = useState(() => getSquawks())
  useEffect(() => {
    const u1 = subscribe((f) => setFlights(f))
    const u2 = subscribeSquawks((s) => setSquawksForClose(s))
    return () => { u1(); u2() }
  }, [])

  // Collect ACS "meets standards" from all closed flights for this user
  // Collect ACS "meets standards" from closed flights — check BOTH acsResults and _postFlight.acsResults
  const acsMet = useMemo(() => {
    const met = new Set()
    flights.forEach((f) => {
      if (f.status !== 'closed') return
      const isMine = f.picId === user.id || f.sicId === user.id
      if (!isMine) return
      // Check _postFlight.acsResults (from RecentFlightCard close)
      const results = f._postFlight?.acsResults
      if (results) {
        Object.entries(results).forEach(([task, passed]) => { if (passed) met.add(task) })
      }
    })
    // Also check flights closed via LessonClosePanel (same field path)
    return met
  }, [flights, user.id])

  const now = Date.now()
  const ACTIVE_WINDOW = 60 * 60_000 // 1 hour
  // All my flights from the portal (past 7 days + future 14 days)
  const PAST_WINDOW = 7 * 24 * 3600_000
  const FUTURE_WINDOW = 14 * 24 * 3600_000
  const myFlights = flights.filter((f) => {
    if (f.status === 'closed' || f.status === 'cancelled') return false
    if (f._source !== `${operator}_portal` && f.operator !== operator) return false
    // Match by persona ID (picId for solo, sicId for dual) OR by _source match for this operator
    const isMine = f.picId === user.id || f.sicId === user.id || (f._source === `${operator}_portal` && f.sic === user.name) || (f._source === `${operator}_portal` && f.pic === user.name)
    if (!isMine) return false
    const dep = new Date(f.plannedDepartureUtc).getTime()
    return dep > now - PAST_WINDOW && dep < now + FUTURE_WINDOW
  }).sort((a, b) => new Date(a.plannedDepartureUtc) - new Date(b.plannedDepartureUtc))

  const activeFlights = myFlights.filter((f) => {
    const dep = new Date(f.plannedDepartureUtc).getTime()
    const end = dep + (f._duration || 1) * 3600_000
    return dep <= now + ACTIVE_WINDOW && end >= now - 30 * 60_000
  })
  const scheduledFlights = myFlights.filter((f) => {
    const dep = new Date(f.plannedDepartureUtc).getTime()
    return dep > now + ACTIVE_WINDOW
  })

  const handleAccept = (rec) => {
    if (!rec.slot) return
    const ts = Date.now()
    const booking = {
      id: `bk-ja-${ts}`, studentId: student.id, cfiId: rec.cfi?.id,
      aircraftId: rec.aircraft?.id, type: rec.template.type,
      title: rec.template.title, dayIdx: rec.slot.dayIdx, slot: rec.slot.slot,
      durationHr: rec.template.durationHr,
    }
    setAcceptedBookings((prev) => [...prev, booking])
    setAcceptedIds((prev) => new Set([...prev, rec.template.id]))

    // Create a real flight — same shape as the calendar's booking flow
    const slotStr = rec.slot.slot
    const dep = new Date()
    dep.setDate(dep.getDate() + ((rec.slot.dayIdx - (dep.getDay() === 0 ? 6 : dep.getDay() - 1) + 7) % 7 || 7))
    dep.setHours(parseInt(slotStr.slice(0, 2)), parseInt(slotStr.slice(2) || '0'), 0, 0)
    const isDual = rec.template.type?.includes('dual') || rec.template.requiresCFI !== false
    const ac = rec.aircraft
    const isGliderAc = ac?.glider || ac?.needs_tow || ac?.fboCategory === 'glider'
    const towProfile = rec.template.towProfile
    addFlight({
      id: `flt-ja-${ts}`,
      callsign: ac?.tailNumber || user.name,
      tailNumber: ac?.tailNumber || null,
      aircraftType: ac?.icaoType || ac?.makeModel || null,
      departure: 'KBDU',
      arrival: 'KBDU',
      airport: 'KBDU',
      waypoints: [],
      plannedDepartureUtc: dep.toISOString(),
      status: 'planned',
      pic: isDual ? (rec.cfi?.name ?? user.name) : user.name,
      picId: isDual ? (rec.cfi?.id ?? user.id) : user.id,
      sic: isDual ? user.name : null,
      sicId: isDual ? user.id : null,
      passengers: 0,
      missionType: isDual ? 'training_dual' : 'training_solo',
      part: '61',
      operator,
      riskScore: null,
      riskP: null, riskA: null, riskV: null, riskE: null,
      riskSnapshot: null,
      _source: `${operator}_portal`,
      _bookingId: booking.id,
      _sessionLabel: rec.template.title,
      _lessonTemplateId: rec.template.id || null,
      _lessonTitle: rec.template.title,
      _duration: rec.template.durationHr,
      _autoProposed: true,
      ...(isGliderAc ? {
        towInfo: {
          numTows: towProfile?.numTows || 1,
          towHeights: towProfile?.heights || [2000],
          isStandby: false,
        },
      } : {}),
    })

    setToast(`✓ ${rec.template.title} booked`)
    setTimeout(() => setToast(null), 3000)
  }

  // Solo endorsement: student has solo hours logged
  const canSolo = student.hours.soloPIC > 0

  // Simulated completion counts (in real app would come from logbook)
  const completedLessons = useMemo(() => {
    const counts = {}
    const templates = LESSON_TEMPLATES[effectiveProgram] || {}
    Object.values(templates).flat().forEach((t) => {
      // Stages up to currentStage - 1 are "completed"
      counts[t.id] = 0
    })
    for (let stage = 1; stage < student.currentStage; stage++) {
      (templates[stage] || []).forEach((t) => { counts[t.id] = (counts[t.id] || 0) + 1 })
    }
    return counts
  }, [effectiveProgram, student.currentStage])

  const DOC_FIELDS = [
    { key: 'governmentId', label: 'Gov ID', showExpiry: true },
    { key: 'insurance', label: 'Insurance', showExpiry: true },
    { key: 'medicalCert', label: 'Medical', showExpiry: true },
    { key: 'studentPilotCert', label: 'Student Cert', showExpiry: false },
    { key: 'knowledgeTest', label: 'Knowledge Test', showExpiry: false },
  ]

  return (
    <section id="sec-dashboard" className="pt-20 pb-8 px-4 sm:px-6 bg-surface">
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
              <div className="text-white font-bold text-lg">{student.hours.total} hrs{isGliderProgram && student.hours.launches ? ` · ${student.hours.launches} launches` : ''}</div>
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

            {/* ── Unified Reservations: recent + upcoming + proposed, sorted by date ── */}
            {(() => {
              const todayDow = new Date().getDay()
              const mondayOff = todayDow === 0 ? -6 : 1 - todayDow

              // Helper: convert a booking dayIdx + slot to a real timestamp
              const bookingToTime = (b, weekOff = 0) => {
                const d = new Date()
                d.setDate(d.getDate() + mondayOff + weekOff * 7 + (b.dayIdx ?? b.day))
                const [hh, mm] = (b.slot || '09:00').split(':').map(Number)
                d.setHours(hh, mm || 0, 0, 0)
                return d.getTime()
              }

              // Calendar bookings (user-created via ScheduleSection) — dedupe against flights by _bookingId
              const flightBookingIds = new Set(myFlights.map((f) => f._bookingId).filter(Boolean))
              const calendarItems = calendarBookings
                .filter((b) => !flightBookingIds.has(b.id))
                .map((b) => {
                  const t = bookingToTime(b, b.weekOffset || 0)
                  if (t < now - 7 * 24 * 3600_000) return null // skip old
                  const cfiName = b.cfiId ? (mockPersonnel.find((p) => p.id === b.cfiId)?.name || '') : ''
                  return { _kind: t <= now ? 'active' : 'booking', _t: t, booking: b, cfiName }
                }).filter(Boolean)

              // Mock bookings for this student (weekly recurring schedule)
              const mockItems = myMockBookings.map((b) => {
                const t = bookingToTime(b)
                if (t < now) return null // skip past
                const cfiName = b.cfiId ? (mockPersonnel.find((p) => p.id === b.cfiId)?.name || '') : ''
                return { _kind: 'booking', _t: t, booking: b, cfiName }
              }).filter(Boolean)

              // Real flights (all my unclosed flights — past, active, and upcoming)
              const flightItems = myFlights.filter((f) => f && f.id).map((f) => ({
                _kind: new Date(f.plannedDepartureUtc).getTime() <= now ? 'active' : 'upcoming',
                _t: new Date(f.plannedDepartureUtc).getTime(), flight: f,
              }))

              // Count scheduled (non-past) appointments
              const scheduledCount = calendarItems.filter((i) => i._t > now).length
                + mockItems.length
                + flightItems.filter((i) => i._t > now).length
              const hasEnoughScheduled = scheduledCount > 2

              // Only show proposals if student has 2 or fewer scheduled appointments
              const proposedItems = hasEnoughScheduled ? [] : allRecommendations.slice(0, 3).map((rec, i) => {
                if (!rec.slot) return null
                const d = new Date()
                const di = rec.slot.dayIdx
                d.setDate(d.getDate() + mondayOff + (di >= 7 ? di - 7 + 7 : di))
                const slotStr = rec.slot.slot || '0900'
                d.setHours(parseInt(slotStr.slice(0, 2)), parseInt(slotStr.slice(2) || '0'), 0, 0)
                if (d.getTime() < now) return null // never show past proposals
                return { _kind: 'proposed', _t: d.getTime(), rec, i, accepted: acceptedIds.has(rec.template.id) }
              }).filter(Boolean)

              const all = [...flightItems, ...calendarItems, ...mockItems, ...proposedItems].sort((a, b) => a._t - b._t)

              return (
                <>
                  <h2 className="text-white font-bold text-base">Reservations</h2>
                  {all.length === 0 && <div className="bg-surface-card border border-surface-border rounded-xl p-4 text-center text-slate-500 text-xs">No reservations</div>}

                  {all.map((item, idx) => {
                    const dt = new Date(item._t)
                    const dateStr = `${dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

                    if (item._kind === 'proposed') {
                      const { rec, accepted } = item
                      return (
                        <div key={`p-${item.i}`} className={`rounded-xl p-3 flex items-center justify-between transition-all border ${
                          accepted ? 'bg-green-400/8 border-green-400/20' : 'bg-sky-400/[0.04] border-sky-400/15 animate-breathe-slow'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            {(() => { const ph = rec.aircraft ? getAircraftPhoto(rec.aircraft.makeModel) : null; return ph ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-card flex-shrink-0"><img src={ph} alt="" loading="lazy" className="w-full h-full object-cover" /></div>
                            ) : <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${accepted ? 'bg-green-400' : 'bg-sky-400/50'}`} /> })()}
                            <div className="min-w-0">
                              <div className={`text-sm font-medium truncate ${accepted ? 'text-green-400' : 'text-slate-200'}`}>
                                {rec.template.title}
                                {!accepted && <span className="text-sky-400/40 text-[10px] ml-1">Suggested</span>}
                              </div>
                              <div className="text-slate-500 text-xs truncate">{dateStr} · {rec.template.durationHr} hr{rec.cfi ? ` · ${rec.cfi.name}` : ''}{rec.aircraft ? ` · ${rec.aircraft.tailNumber}` : ''}</div>
                            </div>
                          </div>
                          {accepted ? (
                            <span className="text-green-400 text-[10px] font-semibold flex-shrink-0 ml-2">✓ Booked</span>
                          ) : (
                            <div className="flex gap-1.5 flex-shrink-0 ml-2">
                              <button onClick={() => handleSkip(rec)} className="text-[10px] text-slate-500 hover:text-white border border-surface-border px-2 py-1 rounded-lg transition-colors">Skip</button>
                              <button onClick={() => handleAccept(rec)} className="text-[10px] text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-1 rounded-lg hover:bg-sky-400/20 transition-colors font-medium">Accept</button>
                            </div>
                          )}
                        </div>
                      )
                    }

                    // Booking item (from calendar or mock schedule)
                    if (item._kind === 'booking') {
                      const b = item.booking
                      const typeLabel = BOOKING_TYPE_LABELS[b.type] || b.type || 'Lesson'
                      const typeColor = BOOKING_TYPE_COLORS[b.type] || 'sky'
                      return (
                        <div key={b.id} className="rounded-xl p-3 flex items-center justify-between border bg-surface-card border-surface-border">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 bg-${typeColor}-400`} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-200 truncate">{b.title || typeLabel}</div>
                              <div className="text-slate-500 text-xs truncate">{dateStr} · {b.duration} hr{item.cfiName ? ` · ${item.cfiName}` : ''}{b.aircraftLabel ? ` · ${b.aircraftLabel}` : ''}</div>
                            </div>
                          </div>
                          <span className="text-green-400 text-[10px] font-semibold flex-shrink-0 ml-2">Confirmed</span>
                        </div>
                      )
                    }

                    // Real flight — use RecentFlightCard for full close-out capability
                    if (!item.flight) return null
                    return <RecentFlightCard key={item.flight.id} flight={item.flight} user={user} squawks={squawksForClose} />
                  })}

                  {!hasEnoughScheduled && (
                    <button onClick={() => document.getElementById('sec-schedule')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full border-2 border-dashed border-slate-700 hover:border-sky-400/40 rounded-xl py-3 text-slate-400 hover:text-sky-400 text-sm font-medium transition-colors">
                      + Schedule a Lesson
                    </button>
                  )}
                </>
              )
            })()}
          </div>

          {/* ══ RIGHT: ACS + Hours + Docs ══ */}
          <div className="space-y-4">
            {/* ACS Progress — Dual / Solo / Ground tabs */}
            <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
              <div className="flex border-b border-surface-border">
                {[
                  { id: 'dual', label: 'Dual', emoji: '👨‍✈️' },
                  { id: 'solo', label: 'Solo', emoji: '🧑‍✈️' },
                  { id: 'ground', label: 'Ground', emoji: '📚' },
                ].map((t) => (
                  <button key={t.id} onClick={() => setAcsTab(t.id)}
                    className={`flex-1 py-2.5 text-xs font-medium transition-colors ${acsTab === t.id ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-400/5' : 'text-slate-500 hover:text-slate-300'}`}>
                    <PortalIcon emoji={t.emoji} size={14} className="inline-block mr-1" />{t.label}
                  </button>
                ))}
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto space-y-3">
                {acsTab === 'dual' && programAcs.dual.map((area) => {
                  const areaDone = area.tasks.filter((t) => acsMet.has(t)).length
                  return (
                    <div key={area.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-slate-400 text-[10px] uppercase tracking-wide">Area {area.area} — {area.label}</div>
                        <div className={`text-[10px] ${areaDone === area.tasks.length ? 'text-green-400' : 'text-slate-600'}`}>{areaDone}/{area.tasks.length}</div>
                      </div>
                      <div className="space-y-0.5">
                        {area.tasks.map((task) => {
                          const done = acsMet.has(task) || student.currentStage > programAcs.dual.indexOf(area) + 1
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
                    {programAcs.solo.map((item) => {
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
                {acsTab === 'ground' && programAcs.ground.map((area) => {
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
              <h3 className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">{isGliderProgram ? 'Requirements' : 'Hours'} ({metCount}/{reqs.length} met)</h3>
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
