// =============================================================================
// FBO Utility Functions — DEFCON Risk Scoring Engine
// =============================================================================
//
// DEFCON Risk Model:
//   riskScore = baseTaskRisk + fuelConfusionRisk + experienceRisk + weatherRisk
//   Score 1–10, mapped to DEFCON 1 (critical/stop) through DEFCON 5 (normal).
//
// Fuel confusion background (user requirement):
//   • Avgas 100LL nozzle is SMALLER — can accidentally enter a Jet-A filler port.
//   • Jet-A nozzle is LARGER — physically CANNOT enter an Avgas filler port.
//   • Therefore: Avgas-into-turbine is the dangerous misfueling direction.
//   • Turboprops with propellers (Caravan, King Air, TBM, Pilatus PC-12) are the
//     highest-confusion aircraft — they look like piston planes but burn Jet-A.
//     Low-experience staff may see a propeller and reach for the Avgas hose.
// =============================================================================

// ─── Base task risk (0–4 scale) ───────────────────────────────────────────────
export const BASE_TASK_RISK = {
  fueling:          4,  // Wrong fuel = engine destruction or fire
  oxygen_service:   3,  // 1,800 PSI O₂ — ignition and explosion risk
  tow:              3,  // Aircraft movement — collision, gear, prop strike
  repositioning:    3,  // Same hazard profile as tow
  preheat:          2,  // Combustion heater adjacent to fuel-laden aircraft
  gpu:              2,  // Electrical transient / reverse-polarity damage
  hangaring:        2,  // Clearance — wing, vertical stab, hangar door
  tie_down:         1,  // Chain tension, chocks, FOD removal
  cleaning:         1,  // Chemical contact with control surfaces / avionics
  lavatory_service: 1,
  catering:         1,
  ramp_fee:         0,  // Administrative — no ground activity
  hangar_fee:       0,
  transportation:   0,  // Administrative coordination, no ground activity risk
}

// ─── Fuel confusion risk (added only for fueling tasks) ───────────────────────
/**
 * Returns the fuel-confusion risk addend (0–5) for a given aircraft.
 *
 * Logic:
 *   • Jet-A turboprop with propeller: +5 — aircraft looks like a piston, staff
 *     may reach for avgas hose; avgas nozzle IS small enough to enter jet filler.
 *   • Jet-A pure jet (no prop):       +1 — distinctive appearance; nozzle
 *     geometry still provides some physical protection.
 *   • Avgas piston:                   +2 — standard, but avgas is
 *     the smaller nozzle and staff must confirm correct grade (100LL vs Mogas).
 *   • Null / unknown aircraft:        +0 — score without this factor.
 */
export function fuelConfusionRisk(aircraft) {
  if (!aircraft) return 0
  const { fuelType, riskProfile } = aircraft
  if (fuelType === 'jet_a') {
    // Turboprop with propeller: looks like piston — MAXIMUM confusion risk
    if (riskProfile?.jetFuelInPropAircraft || riskProfile?.turboprop) return 5
    // True jet aircraft: distinctive appearance, large nozzle
    return 1
  }
  // Avgas aircraft: confirm correct grade; Jet-A nozzle cannot physically enter avgas port
  return 2
}

// ─── Experience risk delta (0–4) ──────────────────────────────────────────────
/**
 * Additional risk from low line-service experience.
 * Less experienced staff are more likely to make fuel-type errors and
 * miss pre-service checks (chocks, bonding wire, bonnet cap verification).
 */
export function experienceRisk(yearsExperience) {
  if (yearsExperience == null) return 3   // unknown — treat as moderate
  if (yearsExperience < 1)    return 4
  if (yearsExperience < 3)    return 3
  if (yearsExperience < 7)    return 2
  if (yearsExperience < 15)   return 1
  return 0
}

// ─── Weather risk delta (0–5) ─────────────────────────────────────────────────
// Rain: water contamination in open fuel ports; slippery ramp.
// Wind: aircraft door and control surface damage during tow; ramp aircraft exposed.
// Lightning: STOP — NFPA 407 / IATA AHM requires cessation of all fueling.
export const WEATHER_RISK = {
  clear:         0,
  overcast:      0,
  fog:           1,  // Low-visibility tow / marshalling
  light_rain:    2,
  heavy_rain:    3,
  high_wind:     2,
  thunderstorm:  5,  // STOP — all ramp ops
  ice:           3,  // Traction loss, aircraft sliding
  snow:          2,
}

// ─── Composite risk score ─────────────────────────────────────────────────────
/**
 * Compute a composite 1–10 risk score for an FBO service task.
 * @param {{ serviceType: string, aircraft: object|null, assignee: object|null, weatherCondition: string }} p
 */
export function computeRiskScore({ serviceType, aircraft, assignee, weatherCondition }) {
  const base       = BASE_TASK_RISK[serviceType] ?? 2
  const fuelConf   = serviceType === 'fueling' ? fuelConfusionRisk(aircraft) : 0
  const expDelta   = experienceRisk(assignee?.yearsExperience)
  const wxDelta    = WEATHER_RISK[weatherCondition] ?? 0
  return Math.min(base + fuelConf + expDelta + wxDelta, 10)
}

// ─── DEFCON level (1 = most critical, 5 = safest) ────────────────────────────
export function defconLevel(score) {
  if (score >= 9) return 1
  if (score >= 7) return 2
  if (score >= 5) return 3
  if (score >= 3) return 4
  return 5
}

export const DEFCON_LABELS = {
  1: 'CRITICAL',
  2: 'ELEVATED',
  3: 'CAUTION',
  4: 'MONITOR',
  5: 'NORMAL',
}

export function defconLabel(level) {
  return DEFCON_LABELS[level] ?? 'UNKNOWN'
}

// ─── Tailwind-safe color class bundles ────────────────────────────────────────
// Dynamic class generation is unsafe in Tailwind (purges unused classes).
// All classes are explicitly listed here.
export function defconClasses(level) {
  const map = {
    1: { text: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/40',    badge: 'bg-red-900/40 text-red-300',    dot: 'bg-red-400' },
    2: { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/40', badge: 'bg-orange-900/40 text-orange-300', dot: 'bg-orange-400' },
    3: { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/40', badge: 'bg-yellow-900/40 text-yellow-300', dot: 'bg-yellow-400' },
    4: { text: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/40',    badge: 'bg-sky-900/40 text-sky-300',    dot: 'bg-sky-400' },
    5: { text: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/40',  badge: 'bg-green-900/40 text-green-300', dot: 'bg-green-400' },
  }
  return map[level] ?? map[5]
}

// ─── Contextual risk warnings ──────────────────────────────────────────────────
/**
 * Returns an array of warning objects for display alongside a service order.
 * @returns {{ code: string, level: 'critical'|'warning'|'info', message: string }[]}
 */
export function riskWarnings({ serviceType, aircraft, assignee, weatherCondition }) {
  const warnings = []

  if (serviceType === 'fueling') {
    if (aircraft?.riskProfile?.jetFuelInPropAircraft || aircraft?.riskProfile?.turboprop) {
      warnings.push({
        code: 'FUEL_CONFUSION_TURBOPROP',
        level: 'critical',
        message:
          'TURBOPROP — this aircraft has a propeller but burns Jet-A, not Avgas. ' +
          'Avgas nozzle is smaller and CAN enter the Jet-A filler port. ' +
          'Verify fuel type placard before opening filler cap. Senior staff must verify.',
      })
    }
    if (aircraft?.fuelType === 'avgas_100ll') {
      warnings.push({
        code: 'AVGAS_CONFIRM',
        level: 'info',
        message:
          'Avgas 100LL (blue dye). Confirm you have the Avgas hose — NOT the Jet-A hose. ' +
          'Jet-A nozzle is large and will not fit, but confirm visually before adding fuel.',
      })
    }
  }

  if (assignee != null && (assignee.yearsExperience ?? 99) < 2) {
    const exp = assignee.yearsExperience == null ? 'unknown' : `${assignee.yearsExperience} yr`
    warnings.push({
      code: 'LOW_EXPERIENCE',
      level: 'warning',
      message:
        `Assigned staff experience: ${exp}. ` +
        'Supervisor co-sign required for all fueling operations. ' +
        'Confirm fuel type and cap condition with senior staff before starting.',
    })
  }

  if (weatherCondition === 'thunderstorm') {
    warnings.push({
      code: 'LIGHTNING_STOP',
      level: 'critical',
      message:
        'THUNDERSTORM ACTIVE — all ramp and fueling operations must cease immediately. ' +
        'NFPA 407 / IATA AHM: no fueling within 50 ft of lightning activity. ' +
        'Move staff to shelter. Do not resume until all-clear issued.',
    })
  }

  if (weatherCondition === 'light_rain' || weatherCondition === 'heavy_rain') {
    warnings.push({
      code: 'RAIN_FUEL_CONTAMINATION',
      level: 'warning',
      message:
        'Rain present — keep fuel filler caps closed except during active fueling. ' +
        'Immediately resecure cap after fill and visually inspect fuel for water (cloudiness). ' +
        'Sumping required after any rain exposure to open ports.',
    })
  }

  if (
    (weatherCondition === 'high_wind') &&
    (serviceType === 'tow' || serviceType === 'repositioning')
  ) {
    warnings.push({
      code: 'WIND_TOW_RISK',
      level: 'warning',
      message:
        'High wind advisory — aircraft doors and control surfaces are vulnerable during tow. ' +
        'Secure all cabin doors, cowlings, and baggage compartments before tow commences. ' +
        'Use additional wing-walker if gusts exceed 20 kts.',
    })
  }

  if (serviceType === 'preheat') {
    warnings.push({
      code: 'PREHEAT_FIRE_PROXIMITY',
      level: 'info',
      message:
        'Engine pre-heat: position combustion heater per manufacturer guidance — ' +
        'never against cowling or against aircraft structure. ' +
        'Assign a fire watch. Maintenance should inspect oil condition before engine start.',
    })
  }

  return warnings
}

// ─── Label helpers ─────────────────────────────────────────────────────────────
export function serviceTypeLabel(type) {
  const map = {
    fueling:          'Fueling',
    tow:              'Tow / Reposition',
    repositioning:    'Repositioning',
    tie_down:         'Tie-Down',
    cleaning:         'Cleaning',
    hangaring:        'Hangar In/Out',
    preheat:          'Engine Pre-Heat',
    gpu:              'Ground Power (GPU)',
    oxygen_service:   'Oxygen Service',
    lavatory_service: 'Lavatory Service',
    catering:         'Catering',
    ramp_fee:         'Ramp Fee',
    hangar_fee:       'Hangar Fee',
    transportation:   'Transportation',
  }
  return map[type] ?? type
}

export function fuelTypeLabel(fuelType) {
  const map = {
    avgas_100ll: 'Avgas 100LL',
    jet_a:       'Jet-A',
    mogas:       'Mogas',
  }
  return map[fuelType] ?? fuelType ?? '—'
}

export function fboCategoryLabel(category) {
  const map = {
    piston_single:    'Piston Single',
    piston_twin:      'Piston Twin',
    turboprop_single: 'Turboprop Single',
    turboprop_twin:   'Turboprop Twin',
    jet_light:        'Light Jet',
    jet_midsize:      'Mid-Size Jet',
    jet_heavy:        'Heavy Jet',
  }
  return map[category] ?? category
}

export function serviceStatusLabel(status) {
  const map = {
    pending:     'Pending',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
    on_hold:     'On Hold',
  }
  return map[status] ?? status
}

export function serviceStatusColor(status) {
  const map = {
    pending:     'text-amber-400',
    in_progress: 'text-sky-400',
    completed:   'text-green-400',
    cancelled:   'text-slate-500',
    on_hold:     'text-orange-400',
  }
  return map[status] ?? 'text-slate-400'
}

export function arrivalStatusLabel(status) {
  const map = {
    confirmed: 'Confirmed',
    inbound:   'Inbound',
    arrived:   'Arrived',
    departed:  'Departed',
    cancelled: 'Cancelled',
    no_show:   'No Show',
  }
  return map[status] ?? status
}

export function weatherLabel(condition) {
  const map = {
    clear:         'Clear',
    overcast:      'Overcast',
    fog:           'Fog',
    light_rain:    'Light Rain',
    heavy_rain:    'Heavy Rain',
    high_wind:     'High Wind',
    thunderstorm:  'Thunderstorm',
    ice:           'Icing',
    snow:          'Snow',
  }
  return map[condition] ?? condition
}

export function weatherColor(condition) {
  const map = {
    clear:         'text-green-400',
    overcast:      'text-slate-400',
    fog:           'text-slate-400',
    light_rain:    'text-yellow-400',
    heavy_rain:    'text-orange-400',
    high_wind:     'text-orange-400',
    thunderstorm:  'text-red-400',
    ice:           'text-sky-300',
    snow:          'text-sky-300',
  }
  return map[condition] ?? 'text-slate-400'
}

// ─── Score breakdown string ────────────────────────────────────────────────────
/** Human-readable score breakdown for display. */
export function riskBreakdown({ serviceType, aircraft, assignee, weatherCondition }) {
  const base     = BASE_TASK_RISK[serviceType] ?? 2
  const fuelConf = serviceType === 'fueling' ? fuelConfusionRisk(aircraft) : 0
  const exp      = experienceRisk(assignee?.yearsExperience)
  const wx       = WEATHER_RISK[weatherCondition] ?? 0
  return { base, fuelConf, exp, wx, total: Math.min(base + fuelConf + exp + wx, 10) }
}

// ─── Arrival time / ADS-B helpers ─────────────────────────────────────────────
// Reference "now" for mock data (project reference date + typical midday time).
export const FBO_NOW = '2026-03-28T15:30:00Z'

/**
 * Minutes between now and the ETA ISO string.
 * Positive = arrival is in the future. Negative = past/overdue.
 */
export function minutesUntilEta(etaIso, nowIso = FBO_NOW) {
  return Math.round((new Date(etaIso).getTime() - new Date(nowIso).getTime()) / 60000)
}

/**
 * Human-readable countdown label.
 *   2h 15m → "in 2h 15m"
 *   45m    → "in 45m"
 *   -5m    → "5m ago"
 *   arrived/past by more than 30m → "Arrived"
 */
export function timeUntilLabel(etaIso, nowIso = FBO_NOW) {
  const mins = minutesUntilEta(etaIso, nowIso)
  if (mins <= -30) return 'Arrived'
  if (mins < 0)    return `${Math.abs(mins)}m ago`
  if (mins < 60)   return `in ${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`
}

/**
 * Difference in minutes between the reserved (scheduled) ETA and the
 * ADS-B-reported expected time.
 * Positive = aircraft is running late. Negative = aircraft is running early.
 * Returns null if either value is missing.
 */
export function etaDelayMinutes(reservedIso, adsbExpectedIso) {
  if (!reservedIso || !adsbExpectedIso) return null
  return Math.round(
    (new Date(adsbExpectedIso).getTime() - new Date(reservedIso).getTime()) / 60000
  )
}

/**
 * Returns a delay flag object if the ADS-B offset exceeds the threshold (default 10 min).
 * Returns null if within threshold or no data.
 * { minutes, late: bool, label: string, color: string }
 */
export function etaDelayFlag(reservedIso, adsbExpectedIso, thresholdMinutes = 10) {
  const delta = etaDelayMinutes(reservedIso, adsbExpectedIso)
  if (delta === null || Math.abs(delta) < thresholdMinutes) return null
  return {
    minutes: Math.abs(delta),
    late:    delta > 0,
    label:   delta > 0 ? `${delta}m late` : `${Math.abs(delta)}m early`,
    color:   delta > 0 ? 'text-orange-400' : 'text-green-400',
    bgColor: delta > 0 ? 'bg-orange-900/30 border-orange-400/30' : 'bg-green-900/20 border-green-400/20',
  }
}

/** Format an ISO datetime string as "HH:MM Z" for display. */
export function formatEtaTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toISOString().slice(11, 16) + ' Z'
}

// ─── Fee helpers ───────────────────────────────────────────────────────────────
export function fuelFeePerGal(fuelType) {
  return fuelType === 'jet_a' ? 5.80 : 7.50
}

export function calcFuelFee(fuelType, gallons) {
  return +(fuelFeePerGal(fuelType) * gallons).toFixed(2)
}

// ─── Transportation service types ─────────────────────────────────────────────
export const TRANSPORT_TYPE_LABELS = {
  crew_car:       'Crew Car',
  rental_vehicle: 'Rental Vehicle',
  limo:           'Limousine',
  uber:           'Uber / Rideshare',
  shuttle:        'Airport Shuttle',
  taxi:           'Taxi',
}

export function transportTypeLabel(type) {
  return TRANSPORT_TYPE_LABELS[type] ?? type ?? '—'
}

export const CREW_CAR_STATUS_PIPELINE    = ['not_requested','reserved','cleaned','filled','checked_out','returned','cancelled']
export const TRANSPORT_STATUS_PIPELINE   = ['not_requested','reserved','requested','on_site','on_ramp','departed','cancelled']
export const CATERING_STATUS_PIPELINE    = ['not_ordered','ordered','in_transport','present','loaded','cancelled']

export function crewCarStatusLabel(status) {
  return {
    not_requested: 'Not Requested',
    reserved:      'Reserved',
    cleaned:       'Cleaned',
    filled:        'Filled',
    checked_out:   'Checked Out',
    returned:      'Returned',
    cancelled:     'Cancelled',
  }[status] ?? status
}

export function transportStatusLabel(status) {
  return {
    not_requested: 'Not Requested',
    reserved:      'Reserved',
    requested:     'Requested',
    on_site:       'On Site',
    on_ramp:       'On Ramp',
    departed:      'Departed',
    cancelled:     'Cancelled',
    later:         'Later',
  }[status] ?? status
}

export function cateringStatusLabel(status) {
  return {
    not_ordered:  'Not Ordered',
    ordered:      'Ordered',
    in_transport: 'In Transit',
    present:      'Present',
    loaded:       'Loaded',
    cancelled:    'Cancelled',
  }[status] ?? status
}

/**
 * Returns a status dot color for a service.
 * 'green' = on schedule · 'amber' = needs attention · 'red' = late/overdue · 'grey' = not yet relevant
 * @param {string} status - current status of the service
 * @param {number} minsUntilOp - minutes until the aircraft operation (+ = future, - = past)
 */
export function serviceStatusDot(status, minsUntilOp) {
  const terminal = ['completed','returned','loaded','departed']
  if (terminal.includes(status)) return 'green'
  if (status === 'cancelled') return 'grey'

  const notStarted = ['not_requested','not_ordered','not_started']
  if (notStarted.includes(status)) {
    if (minsUntilOp > 120) return 'grey'
    if (minsUntilOp > 30)  return 'amber'
    return 'red'
  }
  // Active/in-progress state
  if (minsUntilOp < -30) return 'amber'
  return 'green'
}

export function dotColorClass(dot) {
  return dot === 'green' ? 'bg-green-400' :
         dot === 'amber' ? 'bg-amber-400' :
         dot === 'red'   ? 'bg-red-400'   : 'bg-slate-500'
}

export function dotTextClass(dot) {
  return dot === 'green' ? 'text-green-400' :
         dot === 'amber' ? 'text-amber-400' :
         dot === 'red'   ? 'text-red-400'   : 'text-slate-500'
}
