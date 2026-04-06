import { useState, useEffect } from 'react'
import { mockAircraft } from '../mocks/aircraft'
import { addSquawk, getSquawks, subscribeSquawks } from '../store/squawks'
import { addServiceRequest } from '../store/serviceRequests'
import { updateFlight as updateStoreFlight, getAllFlights, subscribe } from '../store/flights'
import { getAircraftPhoto } from '../portal'

/* ─── ACS task-to-lesson mappings ─── */

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

/* ─── RECENT FLIGHT BOX (unclosed flights — post-flight logging) ─── */
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

  const depTime = new Date(flight.plannedDepartureUtc)
  const isPast = depTime.getTime() < Date.now()
  const acSquawks = (squawks || []).filter((s) => s.tailNumber === flight.tailNumber && s.status !== 'closed').slice(0, 5)

  // Detect glider
  const ac = mockAircraft.find((a) => a.tailNumber === flight.tailNumber || a.tailNumber === flight.callsign)
  const isGlider = ac?.glider || ac?.fboCategory === 'glider' || operator === 'mhg'

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
