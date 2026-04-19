import { useState, useEffect } from 'react'
import { mockAircraft } from '../mocks/aircraft'
import { mockStudents } from '../training/mockTraining'
import { addSquawk } from '../store/squawks'
import { updateFlight as updateStoreFlight } from '../store/flights'

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

/** Pick lesson-ACS map based on program */
function getLessonAcsMap(programId) {
  if (programId?.startsWith('glider_')) return GLIDER_LESSON_ACS_MAP
  return LESSON_ACS_MAP
}

/** Pick generic fallback ACS tasks based on program */
function getGenericAcs(programId) {
  if (programId?.startsWith('glider_')) return GLIDER_GENERIC_ACS
  return GENERIC_ACS
}

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
      <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface/50 px-3 py-2">
        <div className="w-4 h-4 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
        <span className="text-slate-500 text-xs">Checking noise status for {tail}…</span>
      </div>
    )
  }

  if (!data) return null

  const isClean = data.total_offenses === 0
  const hasViolations = data.total_offenses > 0

  // Days since last offense from stored scores
  const daysSinceText = (() => {
    if (!isClean) return null
    const scores = JSON.parse(localStorage.getItem('noise_scores') || '{}')
    const prev = scores[tail]
    if (prev?.daysSinceLastOffense != null && prev.daysSinceLastOffense > 0) return `${prev.daysSinceLastOffense} days`
    return null
  })()

  if (isClean) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5">
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
      <div className={`rounded-lg border ${styles.border} ${styles.bg} px-3 py-2.5 space-y-2`}>
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

  const [noiseData, setNoiseData] = useState(null)
  const [noiseLoading, setNoiseLoading] = useState(false)

  // Fetch noise offenses on mount so it's visible before close
  const tail = flight.tailNumber || flight.callsign
  useEffect(() => {
    if (!tail || tail === 'SIM') return
    setNoiseLoading(true)
    fetch(`http://localhost:5174/api/offenses?tail=${encodeURIComponent(tail)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setNoiseData(data)
          // Store for scoring
          const key = `noise_offenses_${tail}`
          const history = JSON.parse(localStorage.getItem(key) || '[]')
          history.push({ fetchedAt: new Date().toISOString(), flightId: flight.id, ...data })
          localStorage.setItem(key, JSON.stringify(history))
          // Update aggregate score
          const scoreKey = 'noise_scores'
          const scores = JSON.parse(localStorage.getItem(scoreKey) || '{}')
          scores[tail] = {
            lastChecked: new Date().toISOString(),
            totalOffenses: data.total_offenses,
            worst: data.worst,
            tracksSeen: data.tracks_seen,
            daysSinceLastOffense: data.total_offenses === 0
              ? (scores[tail]?.daysSinceLastOffense || null)
              : 0,
          }
          localStorage.setItem(scoreKey, JSON.stringify(scores))
        }
      })
      .catch(() => {})
      .finally(() => setNoiseLoading(false))
  }, [tail])

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
  }

  if (closed) {
    const isClean = noiseData && noiseData.total_offenses === 0
    const hasViolations = noiseData && noiseData.total_offenses > 0

    // Calculate days since last offense from stored history
    const daysSinceText = (() => {
      if (!isClean) return null
      const scores = JSON.parse(localStorage.getItem('noise_scores') || '{}')
      const prev = scores[tail]
      if (prev?.daysSinceLastOffense != null && prev.daysSinceLastOffense > 0) return `${prev.daysSinceLastOffense} days`
      return 'all clear'
    })()

    return (
      <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-4 space-y-3 animate-[fadeIn_0.3s_ease]">
        <div className="text-center">
          <span className="text-green-400 font-semibold text-sm">✓ Lesson closed{billableTime ? ` — ${billableTime} ${billingLabel}` : ''}{isGlider && numLaunches ? ` · ${numLaunches} launch${numLaunches > 1 ? 'es' : ''}` : ''}</span>
        </div>

        {/* Noise compliance section */}
        {noiseLoading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-1">
            <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            Checking noise compliance…
          </div>
        )}

        {isClean && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-400/20 rounded-lg px-3 py-2">
            <MedalIcon className="w-7 h-7 text-emerald-400 shrink-0" />
            <div>
              <div className="text-emerald-400 text-xs font-semibold">Noise Compliant</div>
              <div className="text-emerald-300/70 text-[10px]">
                {tail} — {daysSinceText ? `${daysSinceText} since last incursion` : 'no noise offenses on record'}
                {noiseData.tracks_seen > 0 && ` · ${noiseData.tracks_seen} tracks reviewed`}
              </div>
            </div>
          </div>
        )}

        {hasViolations && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2 space-y-2">
            <div className="flex items-center gap-2.5">
              <NoiseIcon className={`w-6 h-6 shrink-0 ${noiseData.worst === 'red' ? 'text-red-400' : noiseData.worst === 'yellow' ? 'text-amber-400' : 'text-orange-400'}`} />
              <span className="text-red-400 text-xs font-semibold">
                {noiseData.total_offenses} Noise Offense{noiseData.total_offenses !== 1 ? 's' : ''} — {tail}
              </span>
            </div>
            {noiseData.offenses?.slice(0, 3).map((o, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] px-1">
                <span className="text-slate-400">{o.date} — {o.zone}</span>
                <span className={`font-medium ${o.worst === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                  {o.points} pts · {o.peakAlt?.toLocaleString()} ft
                </span>
              </div>
            ))}
            {noiseData.offenses?.length > 3 && (
              <div className="text-slate-500 text-[10px] px-1">+ {noiseData.offenses.length - 3} more</div>
            )}
            {noiseData.landing_url && (
              <a href={noiseData.landing_url} target="_blank" rel="noopener noreferrer"
                className="block text-center text-sky-400 hover:text-sky-300 text-[11px] font-medium mt-1 transition-colors">
                View Details →
              </a>
            )}
          </div>
        )}

        {!noiseLoading && !noiseData && tail !== 'SIM' && (
          <div className="text-slate-600 text-[10px] text-center">Noise data unavailable</div>
        )}

        <button onClick={() => onClose?.()} className="w-full text-slate-500 hover:text-slate-300 text-xs py-1 transition-colors">
          Dismiss
        </button>
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

      {/* Noise compliance status */}
      {tail && tail !== 'SIM' && (
        <NoiseStatusStrip data={noiseData} loading={noiseLoading} tail={tail} />
      )}

      {/* Close button */}
      <button onClick={handleClose}
        className="w-full bg-green-500 hover:bg-green-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
        Close Lesson{billableTime ? ` — ${billableTime} ${billingLabel}` : ''}{isGlider && numLaunches ? ` · ${numLaunches} tow${numLaunches > 1 ? 's' : ''}` : ''}
      </button>
    </div>
  )
}
