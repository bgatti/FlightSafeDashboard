/* ═══════════════════════════════════════════════════════════
   Airport Impact District (AID) — demo data
   ═══════════════════════════════════════════════════════════ */

export const FRNAA_INFO = {
  name: 'Airport Impact District',
  short: 'AID',
  tagline: 'We take noise seriously.',
  email: 'info@dfaid.org',
  phone: '(303) 555-0142',
  founded: 2026,
  incorporated: 'Colorado voluntary association',
}

/* ─── BOARD OF DIRECTORS ─── */
export const FRNAA_BOARD = [
  {
    id: 'chair',
    name: 'Andrew McKenna',
    role: 'Chair',
    affiliation: 'Journeys Aviation · KBDU',
    bio: 'Flight school owner and Boulder-based CFI. Leads AID\'s cross-field coordination and stands up the regional WINGS cadence.',
    ratings: 'CFI/CFII/MEI · Commercial ASEL/AMEL/Instrument',
  },
  {
    id: 'vice-chair',
    name: 'Linda Foster',
    role: 'Vice Chair · Training Liaison',
    affiliation: 'Mile High Flight School · KBJC',
    bio: 'Senior CFI responsible for integrating voluntary-compliance reminders into the training pattern at the busiest field in the region.',
    ratings: 'CFI/CFII · Commercial ASEL/Instrument',
  },
  {
    id: 'secretary',
    name: 'Maria Vasquez',
    role: 'Secretary · Operator Liaison',
    affiliation: 'Platinum Aviation · KEIK',
    bio: 'Operations manager at Erie. Liaison between AID and noise-sensitive residential groups around rapidly-growing Front Range fields.',
    ratings: 'Commercial ASEL/Instrument · Ground Instructor',
  },
  {
    id: 'treasurer',
    name: 'Dave Kowalski',
    role: 'Treasurer · Private Owner Seat',
    affiliation: 'Private owner · KBDU',
    bio: 'Hangar tenant and multi-aircraft owner. Represents independent pilots and owner-operators in AID governance.',
    ratings: 'Commercial ASEL/AMEL/Instrument · Tailwheel',
  },
  {
    id: 'airport-rep',
    name: 'Jake Rosen',
    role: 'Airport Liaison',
    affiliation: 'Rocky Mountain Metro (KBJC)',
    bio: 'Jeffco-side representative. Coordinates with airport administration on voluntary data sharing and Fly Quiet alignment.',
    ratings: 'Commercial ASEL/Instrument',
  },
  {
    id: 'club-rep',
    name: 'Emily Carter',
    role: 'Club Liaison',
    affiliation: 'Boulder Flying Club · KBDU',
    bio: 'Club scheduler and PPL candidate. Champions deep integration of voluntary reminders into club scheduling software.',
    ratings: 'Private ASEL (in training)',
  },
]

/* ─── PARTICIPATING AIRPORTS ─── */
export const FRNAA_AIRPORTS = [
  {
    id: 'KLMO', icao: 'KLMO', name: 'Vance Brand',
    city: 'Longmont, CO',
    description: 'Non-towered GA field in the foothills. Noise-sensitive residential areas north and east of the field.',
    abatement: 'Right traffic 29 over Union Reservoir. Depart runway heading to 1000 AGL before turns. Avoid overflight of Pinewood Springs.',
    basedCount: 182,
    compliance: 91,
    noiseExcursionsMTD: 14,
    tracksUrl: 'https://noise.longmontcolorado.gov',
    policyUrl: 'https://longmontcolorado.gov/airport/airport-noise-improvement-project/',
    complianceLastMonth: 86,
    tier: 'committed',
    unleaded: { status: 'planned', eta: '2026 Q4', fuel: null, since: null },
    photo: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Vance_Brand_Airport_-_USGS_24_April_2002.jpg',
    photoCredit: 'USGS aerial image (2002) · Wikimedia Commons (public domain)',
  },
  {
    id: 'KEIK', icao: 'KEIK', name: 'Erie Municipal',
    city: 'Erie, CO',
    description: 'Rapidly growing residential community on all sides. One of the most politically sensitive GA fields in the region.',
    abatement: 'Maintain pattern altitude until abeam numbers. No closed traffic before 8am Sat/Sun. Avoid Vista Ridge neighborhood.',
    basedCount: 147,
    compliance: 86,
    noiseExcursionsMTD: 31,
    tracksUrl: 'https://noise.erieco.gov',
    policyUrl: 'https://www.erieco.gov/2308/Standard-Airport-Operating-Procedures',
    complianceLastMonth: 79,
    tier: 'participating',
    unleaded: { status: 'planned', eta: '2027', fuel: null, since: null },
    photo: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Erie_Municipal_Airport.JPG',
    photoCredit: 'Wikimedia Commons · CC BY 4.0',
  },
  {
    id: 'KBDU', icao: 'KBDU', name: 'Boulder Municipal',
    city: 'Boulder, CO',
    description: 'Glider operations coexist with powered traffic. High noise sensitivity; active citizen monitoring group.',
    abatement: 'Left traffic 26, right traffic 08. Climb to 6500 MSL before turning on course. Avoid Gunbarrel, N. Boulder, and Niwot.',
    basedCount: 204,
    compliance: 88,
    noiseExcursionsMTD: 22,
    tracksUrl: 'https://bouldercolorado.gov/airport/noise',
    policyUrl: 'https://bouldercolorado.gov/services/aircraft-noise',
    complianceLastMonth: 85,
    tier: 'committed',
    unleaded: { status: 'planned', eta: '2026 Q4', fuel: 'UL94', since: null },
    photo: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Boulder_Municipal_Airport.JPG',
    photoCredit: 'Wikimedia Commons · CC BY 4.0',
  },
  {
    id: 'KBJC', icao: 'KBJC', name: 'Rocky Mountain Metro',
    city: 'Broomfield, CO',
    description: 'Towered reliever airport with heavy training activity. Noise abatement corridors over open space preferred.',
    abatement: 'Jeffco NA corridors: use JeffCo 1/Jeffco 2 departures. No training pattern work before 7am. Avoid Candelas and Leyden Rock.',
    basedCount: 386,
    compliance: 93,
    noiseExcursionsMTD: 19,
    tracksUrl: 'https://jeffco.us/airport/noise',
    policyUrl: 'https://www.jeffco.us/1687/Voluntary-Noise-Abatement',
    complianceLastMonth: 90,
    tier: 'committed',
    unleaded: { status: 'available', eta: null, fuel: 'UL94', since: '2026-02', supplier: 'Sheltair / Swift Fuels' },
    photo: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Rocky_Mountain_Metropolitan_Airport.JPG',
    photoCredit: 'Wikimedia Commons · CC BY 4.0',
  },
  {
    id: 'KFNL', icao: 'KFNL', name: 'Northern Colorado Regional',
    city: 'Fort Collins / Loveland, CO',
    description: 'Joint-use regional airport with growing commercial, training, and transient GA activity.',
    abatement: 'Runway 15/33 preferred. Climb straight out to 6500 MSL. Avoid overflight of Berthoud and Johnstown residential.',
    basedCount: 271,
    compliance: 89,
    noiseExcursionsMTD: 18,
    tracksUrl: 'https://flynoco.com/noise',
    policyUrl: 'https://www.flynoco.com/pilots/runway-information/',
    complianceLastMonth: 88,
    tier: 'participating',
    unleaded: { status: 'evaluating', eta: null, fuel: null, since: null },
    photo: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Northern_Colorado_Regional_Airport.JPG',
    photoCredit: 'Wikimedia Commons · CC BY 4.0',
  },
  {
    id: 'KAPA', icao: 'KAPA', name: 'Centennial',
    city: 'Englewood, CO',
    description: 'Busiest GA reliever in the region. Long-standing Fly Quiet program with an active community noise roundtable.',
    abatement: 'Follow published Fly Quiet departures. Avoid overflight of Heritage Eagle Bend, Southshore, and Parker Vista. No training pattern work before 0700 local.',
    basedCount: 412,
    compliance: 94,
    noiseExcursionsMTD: 17,
    tracksUrl: 'https://centennialairportnoise.com/',
    policyUrl: 'https://centennialairport.com/noise-abatement-guidelines',
    complianceLastMonth: 91,
    tier: 'committed',
    unleaded: { status: 'available', eta: null, fuel: 'UL94', since: '2023', supplier: 'Swift Fuels' },
    photo: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Centennial_Airport.JPG',
    photoCredit: 'Wikimedia Commons · CC BY 4.0',
  },
]

/* ─── UNLEADED AVGAS ROLLOUT ───
   Colorado HB 24-1235 (2024) required five airports — Boulder, Longmont/Vance
   Brand, Centennial, Rocky Mountain Metropolitan, and Erie — to submit phase-out
   plans by Jan 1, 2026 and completely phase out 100LL by 2030. Centennial was
   the first to offer Swift UL94 in 2023; Rocky Mountain Metro followed in
   Feb 2026 via Sheltair. Boulder targets late 2026; Longmont and Erie have
   submitted plans but not yet stood up the dedicated tank + truck required
   to deliver UL94 alongside 100LL. G100UL (GAMI) is not yet deployed in
   Colorado as of spring 2026.
   Fleet-eligibility figures (STC count, % of piston fleet) are from Swift Fuels. */
export const FRNAA_UNLEADED_INFO = {
  colorado_deadline: 2030,
  colorado_law: 'Colorado HB 24-1235 (2024)',
  mandated_airports: ['KLMO', 'KEIK', 'KBDU', 'KBJC', 'KAPA'],
  primary_fuel: 'Swift Fuels UL94',
  alt_fuel: 'GAMI G100UL (not yet deployed in CO)',
  // Swift Fuels published figures
  stc_approved_aircraft: 130000,
  fleet_eligible_pct: 66,
  // Regional demo figures
  fleet_actively_using_pct: 18,
  delivered_volume_pct: 11,
}

/* ─── ENGAGEMENT TIERS ───
   Voluntary levels of participation. No implied priority, ranking, or
   consequence — these describe how involved a member has chosen to be.
     member        = registered with AID. Tail numbers on file. Receives
                     voluntary excursion reminders and the newsletter.
     participating = actively engaged. Sends reps to WINGS events. Posts
                     voluntary procedures in every cockpit / dispatch area.
     committed     = "Committed to Noise Reduction". Fleet ADS-B equipped,
                     voluntary reminders integrated into scheduling software,
                     hosts WINGS events at the home field. */
export const FRNAA_TIERS = {
  member: {
    id: 'member',
    label: 'Member',
    short: 'Member',
    tone: 'slate',
    description: 'Registered with AID. Tail numbers on file. Receives voluntary excursion reminders.',
  },
  participating: {
    id: 'participating',
    label: 'Participating',
    short: 'Participating',
    tone: 'sky',
    description: 'Actively engaged with AID. Sends representatives to WINGS events and posts voluntary procedures.',
  },
  committed: {
    id: 'committed',
    label: 'Committed to Noise Reduction',
    short: 'Committed',
    tone: 'emerald',
    description: 'Fleet ADS-B equipped, voluntary reminders integrated into scheduling software, hosts WINGS events at home field.',
  },
}

/* ─── FLIGHT SCHOOLS & CLUBS ───
   `photoQuery` is the search term used to fetch a representative Wikipedia
   thumbnail for each organization. Real businesses get their own name;
   fictional ones get a signature aircraft type they're likely to operate. */
export const FRNAA_SCHOOLS = [
  { id: 'twin-peaks',   name: 'Twin Peaks Aviation',        airport: 'KLMO', type: 'school', fleet: 7,  pilots: 42,  tier: 'committed',     photoQuery: 'Cessna 172 flight training' },
  { id: 'longmont-aero',name: 'Longmont Aeroflight',        airport: 'KLMO', type: 'school', fleet: 4,  pilots: 28,  tier: 'participating', photoQuery: 'Piper Cherokee trainer' },
  { id: 'platinum',     name: 'Platinum Aviation',          airport: 'KEIK', type: 'school', fleet: 6,  pilots: 51,  tier: 'committed',     photoQuery: 'Cirrus SR20' },
  { id: 'erie-fc',      name: 'Erie Flight Center',         airport: 'KEIK', type: 'school', fleet: 5,  pilots: 37,  tier: 'participating', photoQuery: 'Cessna 152 trainer' },
  { id: 'journeys',     name: 'Journeys Aviation',          airport: 'KBDU', type: 'school', fleet: 9,  pilots: 64,  tier: 'committed',     photoQuery: 'Diamond DA40' },
  { id: 'specialty',    name: 'Specialty Flight Training',  airport: 'KBDU', type: 'school', fleet: 3,  pilots: 22,  tier: 'participating', photoQuery: 'Beechcraft Bonanza' },
  { id: 'mhfs',         name: 'Mile High Flight School',    airport: 'KBJC', type: 'school', fleet: 12, pilots: 88,  tier: 'committed',     photoQuery: 'Cessna 172 flight school' },
  { id: 'metro-av',     name: 'Metro Aviation',             airport: 'KBJC', type: 'school', fleet: 8,  pilots: 53,  tier: 'committed',     photoQuery: 'Piper Seminole' },
  { id: 'denver-ft',    name: 'Denver Flight Training',     airport: 'KBJC', type: 'school', fleet: 15, pilots: 112, tier: 'committed',     photoQuery: 'Cessna 172S trainer' },
  { id: 'aims',         name: 'Aims Community College Aviation', airport: 'KFNL', type: 'school', fleet: 14, pilots: 96, tier: 'committed',  photoQuery: 'Cessna 172 college aviation program' },
  { id: 'mtn-air',      name: 'Mountain Air Flight Center', airport: 'KFNL', type: 'school', fleet: 6,  pilots: 41,  tier: 'member',        photoQuery: 'Cessna 182 backcountry' },
  { id: 'atp-centennial', name: 'ATP Flight School',        airport: 'KAPA', type: 'school', fleet: 18, pilots: 128, tier: 'committed',    photoQuery: 'ATP Flight School' },
  { id: 'wings-over',   name: 'Wings Over the Rockies',     airport: 'KAPA', type: 'school', fleet: 9,  pilots: 62,  tier: 'committed',    photoQuery: 'Wings Over the Rockies Air and Space Museum' },

  { id: 'boulder-fc',   name: 'Boulder Flying Club',        airport: 'KBDU', type: 'club',   fleet: 4,  pilots: 36,  tier: 'committed',     photoQuery: 'Piper Archer' },
  { id: 'denver-fc',    name: 'Denver Flying Club',         airport: 'KBJC', type: 'club',   fleet: 5,  pilots: 48,  tier: 'participating', photoQuery: 'Cessna 172 club' },
  { id: 'noco-fc',      name: 'Northern Colorado Flying Club', airport: 'KFNL', type: 'club', fleet: 3,  pilots: 29, tier: 'participating', photoQuery: 'Piper Warrior' },
  { id: 'longs-peak',   name: 'Longs Peak Aero Club',       airport: 'KLMO', type: 'club',   fleet: 2,  pilots: 19,  tier: 'member',        photoQuery: 'Cessna 150' },
]

/* ─── WINGS EVENTS ─── */
export const FRNAA_WINGS_EVENTS = [
  { id: 'w1', date: '2026-04-22', time: '18:30', airport: 'KBDU', title: 'Neighborly Skies — Boulder Patterns & Gunbarrel Corridor', host: 'Journeys Aviation', rsvps: 42 },
  { id: 'w2', date: '2026-05-06', time: '19:00', airport: 'KEIK', title: 'Erie Residential Growth: What Has Changed in 5 Years', host: 'Erie Flight Center',   rsvps: 68 },
  { id: 'w3', date: '2026-05-20', time: '18:00', airport: 'KBJC', title: 'Jeffco Corridors, Candelas, and the Training Pattern', host: 'Mile High Flight School', rsvps: 91 },
  { id: 'w4', date: '2026-06-03', time: '18:30', airport: 'KLMO', title: 'Vance Brand — Right Traffic 29 Best Practices',      host: 'Twin Peaks Aviation',    rsvps: 31 },
  { id: 'w5', date: '2026-06-17', time: '19:00', airport: 'KFNL', title: 'NoCo: Berthoud / Johnstown Avoidance & New Corridors',host: 'Aims Aviation',          rsvps: 55 },
  { id: 'w6', date: '2026-07-01', time: '18:30', airport: 'KAPA', title: 'Centennial Fly Quiet + UL94 — Three Years In',       host: 'ATP Flight School',      rsvps: 104 },
]

/* ─── BASED AIRCRAFT (synthetic compliance roster) ─── */
/* Deterministic pseudo-random so the demo is stable */
function rand(seed) {
  let x = seed
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280 }
}

const AIRCRAFT_MODELS = [
  'Cessna 172S', 'Cessna 172N', 'Cessna 152', 'Cessna 182P', 'Cessna 182T',
  'Piper PA-28-161', 'Piper PA-28-180', 'Piper PA-32R', 'Cirrus SR20', 'Cirrus SR22',
  'Diamond DA40', 'Diamond DA20', 'Beechcraft A36', 'Beechcraft B55', 'Mooney M20J',
  'Robinson R44', 'Bell 206', 'Van\'s RV-6', 'Van\'s RV-10', 'Grumman AA-5',
]

const OPERATORS = [
  'Private Owner', 'Twin Peaks Aviation', 'Platinum Aviation', 'Journeys Aviation',
  'Mile High Flight School', 'Metro Aviation', 'Denver Flight Training',
  'Boulder Flying Club', 'Denver Flying Club', 'Northern Colorado Flying Club',
  'Erie Flight Center', 'Specialty Flight Training', 'Aims Community College',
  'Mountain Air Flight Center', 'Longs Peak Aero Club',
]

function pick(arr, r) { return arr[Math.floor(r() * arr.length)] }

/* Map a model name to a broad silhouette category (for photo icons) */
export function getAircraftCategory(model) {
  if (!model) return 'highwing'
  if (/Robinson|Bell|R\d{2}/.test(model)) return 'helicopter'
  if (/B55|Baron|Seneca|Seminole|Twin/.test(model)) return 'twin'
  if (/RV-/.test(model)) return 'experimental'
  if (/Cessna 1[57]2|Cessna 150|C1[57]2/.test(model)) return 'highwing'
  if (/Cessna 18[02]|C18[02]/.test(model)) return 'highwing'
  if (/Piper|PA-|Cirrus|Diamond|Mooney|Beech|Grumman|AA-/.test(model)) return 'lowwing'
  return 'highwing'
}

const PURPOSES = [
  { id: 'flight_training', label: 'Flight Training',      weight: 5 },
  { id: 'personal',        label: 'Personal Flying',      weight: 4 },
  { id: 'club_rental',     label: 'Club Rental',          weight: 3 },
  { id: 'discovery',       label: 'Discovery Flights',    weight: 2 },
  { id: 'currency',        label: 'Currency & Proficiency', weight: 2 },
  { id: 'checkride_prep',  label: 'Checkride Prep',       weight: 2 },
  { id: 'aerial_photo',    label: 'Aerial Photography',   weight: 1 },
  { id: 'backcountry',     label: 'Backcountry & Mountain', weight: 1 },
  { id: 'maint_test',      label: 'Maintenance Test',     weight: 1 },
]

/* Weighted purpose picker tied to operator type so the mix feels real */
function pickPurpose(operator, r) {
  if (/Club/.test(operator))                                   return 'club_rental'
  if (/Flight School|Training|Aims/.test(operator) && r() > 0.25) return 'flight_training'
  if (/Aviation/.test(operator) && r() > 0.5)                  return 'flight_training'
  if (/Private/.test(operator))                                return r() > 0.3 ? 'personal' : 'currency'
  // weighted pool
  const pool = []
  PURPOSES.forEach((p) => { for (let i = 0; i < p.weight; i++) pool.push(p.id) })
  return pool[Math.floor(r() * pool.length)]
}

export function getPurposeLabel(id) {
  return PURPOSES.find((p) => p.id === id)?.label || id
}

function buildFleet() {
  const fleet = []
  const r = rand(42)
  for (let i = 0; i < 140; i++) {
    const tail = 'N' + Math.floor(100 + r() * 9900) + 'ABCDEFGHJKLMN'[Math.floor(r() * 13)]
    const airport = FRNAA_AIRPORTS[Math.floor(r() * FRNAA_AIRPORTS.length)].icao
    const model = pick(AIRCRAFT_MODELS, r)
    const operator = pick(OPERATORS, r)
    const flights30 = Math.floor(10 + r() * 80)
    const excursions30 = Math.floor(r() * r() * 8) // weighted low
    const compliance = Math.round(((flights30 - excursions30) / flights30) * 100 * 10) / 10
    const adsb = r() > 0.08
    const enrolled = r() > 0.15
    // YTD figures (Jan 1 → today) — roughly 3.5× the 30-day rolling window
    const flightsYTD = Math.floor(flights30 * (3 + r() * 1.5))
    const excursionsYTD = Math.floor(excursions30 * (2.5 + r() * 2))
    // "Clean streak" = consecutive flights with no excursion
    const cleanStreak = excursions30 === 0
      ? Math.floor(flightsYTD * (0.6 + r() * 0.4))
      : Math.floor(r() * 25)
    const purpose = pickPurpose(operator, r)
    const category = getAircraftCategory(model)
    // Previous 30-day window: pretend last month was slightly worse most of the time
    // (so MoM shows improvement) but with some regressions for realism.
    const drift = (r() - 0.35) * 8 // roughly -2.8 … +5.2
    const complianceLastMonth = Math.max(0, Math.min(100,
      Math.round((compliance - drift) * 10) / 10))
    const complianceDelta = Math.round((compliance - complianceLastMonth) * 10) / 10
    fleet.push({
      tail, airport, model, operator, category, purpose,
      flights30, excursions30, compliance, adsb, enrolled,
      complianceLastMonth, complianceDelta,
      flightsYTD, excursionsYTD, cleanStreak,
      lastFlight: `2026-04-${String(Math.floor(1 + r() * 12)).padStart(2, '0')}`,
      pic: ['D. Kowalski','L. Foster','M. Vasquez','T. Mason','E. Carter','J. Rosen','A. McKenna','R. Singh','K. Nguyen','P. Ortega'][Math.floor(r() * 10)],
    })
  }
  return fleet
}

/* ─── LEADERBOARD: top (category × purpose × operator) groups by clean flights YTD ─── */
export function getLeaderboard(limit = 10) {
  const buckets = new Map()
  for (const f of FRNAA_FLEET) {
    if (!f.enrolled || !f.adsb) continue
    const key = `${f.category}|${f.purpose}|${f.operator}`
    const clean = f.flightsYTD - f.excursionsYTD
    const existing = buckets.get(key)
    if (existing) {
      existing.cleanFlights += clean
      existing.totalFlights += f.flightsYTD
      existing.excursions += f.excursionsYTD
      existing.tailCount += 1
    } else {
      buckets.set(key, {
        key,
        category: f.category,
        purpose: f.purpose,
        purposeLabel: getPurposeLabel(f.purpose),
        operator: f.operator,
        airport: f.airport,
        model: f.model,
        cleanFlights: clean,
        totalFlights: f.flightsYTD,
        excursions: f.excursionsYTD,
        tailCount: 1,
      })
    }
  }
  return [...buckets.values()]
    .map((b) => ({ ...b, compliance: Math.round((b.cleanFlights / b.totalFlights) * 1000) / 10 }))
    .sort((a, b) => b.cleanFlights - a.cleanFlights)
    .slice(0, limit)
}

/* ─── MOST IMPROVED: biggest month-over-month compliance gains
       aggregated by (category × purpose), weighted by flight volume ─── */
export function getMostImproved(limit = 5) {
  const buckets = new Map()
  for (const f of FRNAA_FLEET) {
    if (!f.enrolled || !f.adsb) continue
    const key = `${f.category}|${f.purpose}`
    const weight = f.flights30
    const existing = buckets.get(key)
    if (existing) {
      existing.weightSum += weight
      existing.deltaSum += f.complianceDelta * weight
      existing.thisSum += f.compliance * weight
      existing.prevSum += f.complianceLastMonth * weight
      existing.tailCount += 1
      existing.flights30 += f.flights30
    } else {
      buckets.set(key, {
        key,
        category: f.category,
        purpose: f.purpose,
        purposeLabel: getPurposeLabel(f.purpose),
        weightSum: weight,
        deltaSum: f.complianceDelta * weight,
        thisSum: f.compliance * weight,
        prevSum: f.complianceLastMonth * weight,
        tailCount: 1,
        flights30: f.flights30,
      })
    }
  }
  return [...buckets.values()]
    .filter((b) => b.tailCount >= 2 && b.flights30 >= 50)
    .map((b) => {
      const compliance     = Math.round((b.thisSum / b.weightSum) * 10) / 10
      const complianceLast = Math.round((b.prevSum / b.weightSum) * 10) / 10
      // Convert % compliance into absolute quiet-flight counts.
      // Last month's volume is approximated as this-month's flights30.
      const cleanThisMonth = Math.round(b.flights30 * compliance     / 100)
      const cleanLastMonth = Math.round(b.flights30 * complianceLast / 100)
      return {
        key: b.key,
        category: b.category,
        purpose: b.purpose,
        purposeLabel: b.purposeLabel,
        tailCount: b.tailCount,
        flights30: b.flights30,
        compliance,
        complianceLast,
        cleanThisMonth,
        cleanLastMonth,
        cleanDelta: cleanThisMonth - cleanLastMonth,
      }
    })
    .sort((a, b) => b.cleanDelta - a.cleanDelta)
    .slice(0, limit)
}

/* ─── AIRPORT RANKINGS: regional ranked stack of airports by
       weighted compliance across their based fleet ─── */
export function getAirportRankings() {
  return FRNAA_AIRPORTS.map((a) => {
    const based = FRNAA_FLEET.filter((f) => f.airport === a.icao)
    const totalFlights = based.reduce((s, f) => s + f.flightsYTD, 0)
    const excursions = based.reduce((s, f) => s + f.excursionsYTD, 0)
    const compliance = totalFlights
      ? Math.round(((totalFlights - excursions) / totalFlights) * 1000) / 10
      : 0
    const flights30 = based.reduce((s, f) => s + f.flights30, 0)
    const excursions30 = based.reduce((s, f) => s + f.excursions30, 0)
    const delta = Math.round((a.compliance - a.complianceLastMonth) * 10) / 10
    return {
      ...a,
      fleetSize: based.length,
      totalFlights,
      excursions,
      cleanFlights: totalFlights - excursions,
      complianceWeighted: compliance,
      flights30,
      excursions30,
      delta,
    }
  }).sort((a, b) => b.cleanFlights - a.cleanFlights)
}

/* ─── PIC-notification workflow per school/club ───
   For every noise excursion attributed to a member organization's fleet,
   AID tracks three stages of follow-up:
     1. Informed        — reminder delivered to the PIC
     2. Acknowledged    — PIC has confirmed receipt / read the reminder
     3. Remediation     — root-cause remediation complete (procedure
                          review, briefing with CFI, ops-software update, etc.)
   Remediation is a strict subset of acknowledged, which is a strict subset
   of informed, which is ≤ total excursions. */
export function getSchoolPicWorkflow(schoolId) {
  const school = FRNAA_SCHOOLS.find((s) => s.id === schoolId)
  if (!school) return null
  // Deterministic pseudo-random from school id so values are stable
  let seed = 0
  for (let i = 0; i < schoolId.length; i++) seed = (seed * 31 + schoolId.charCodeAt(i)) >>> 0
  const r = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  // Scale excursions to fleet size: roughly 0.4–1.2 per airframe this month
  const total = Math.max(0, Math.round(school.fleet * (0.4 + r() * 0.8)))
  // Tier-influenced progression rates. Committed orgs close the loop faster.
  const rates =
    school.tier === 'committed'     ? { inf: 0.98, ack: 0.88, rem: 0.72 } :
    school.tier === 'participating' ? { inf: 0.92, ack: 0.72, rem: 0.48 } :
                                       { inf: 0.80, ack: 0.50, rem: 0.20 }
  const informed     = Math.round(total * rates.inf)
  const acknowledged = Math.round(total * rates.ack)
  const remediated   = Math.round(total * rates.rem)
  return { total, informed, acknowledged, remediated }
}

/* ─── Per-airport aircraft leaderboard ─── */
export function getBasedAircraftLeaderboard(icao, limit = 10) {
  return FRNAA_FLEET
    .filter((f) => f.airport === icao && f.enrolled && f.adsb)
    .sort((a, b) => b.compliance - a.compliance || b.flightsYTD - a.flightsYTD)
    .slice(0, limit)
}

export const FRNAA_FLEET = buildFleet()

/* ─── REMEDIATION LADDER ───
   Voluntary self-directed follow-up actions AID suggests to a PIC after
   a noise excursion. Entirely voluntary — there are no consequences for
   skipping a stage. The ladder simply offers a set of progressively-deeper
   ways for a pilot to re-engage with the voluntary procedures in their
   own time. */
export const REMEDIATION_STAGES = {
  A: { id: 'A', label: 'View the incursion on the map',          short: 'View on map',       tone: 'sky'     },
  B: { id: 'B', label: 'Load the abatement KML into ForeFlight', short: 'KML in ForeFlight', tone: 'sky'     },
  C: { id: 'C', label: 'Online noise abatement refresher',       short: 'Online refresher',  tone: 'emerald' },
  D: { id: 'D', label: 'Attend a WINGS event',                   short: 'WINGS event',       tone: 'emerald' },
  E: { id: 'E', label: 'Airspace awareness flight with a qualified pilot', short: 'Awareness flight', tone: 'emerald' },
}

const STAGE_ORDER = ['A', 'B', 'C', 'D', 'E']

/* A few recent noise excursion events for the admin drill-down */
export function getExcursionsForTail(tail) {
  const r = rand(tail.split('').reduce((a, c) => a + c.charCodeAt(0), 0))
  const fleet = FRNAA_FLEET.find((f) => f.tail === tail)
  if (!fleet) return []
  const events = []
  // Track per-reason repeat count so remediation escalates realistically
  const repeatByReason = {}
  for (let i = 0; i < fleet.excursions30; i++) {
    const reason = pick([
      'Early turn after departure (below 1000 AGL)',
      'Pattern altitude low on downwind',
      'Overflight of noise-sensitive neighborhood',
      'Closed traffic before 0700 local',
      'Departure heading deviation',
    ], r)
    repeatByReason[reason] = (repeatByReason[reason] || 0) + 1
    const stageIdx = Math.min(repeatByReason[reason] - 1, STAGE_ORDER.length - 1)
    const stageId = STAGE_ORDER[stageIdx]
    const issued = true // reminder always sent by AID automation
    const acknowledged = r() > 0.25
    // Remediation is only "complete" if PIC has acknowledged AND has closed
    // out the assigned action (lower completion rate for later stages).
    const remediationComplete = acknowledged && r() > (0.35 + stageIdx * 0.08)
    events.push({
      date: `2026-04-${String(Math.floor(1 + r() * 12)).padStart(2, '0')}`,
      time: `${String(Math.floor(6 + r() * 14)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`,
      airport: fleet.airport,
      reason,
      severity: pick(['minor', 'minor', 'moderate', 'moderate', 'significant'], r),
      issued,
      acknowledged,
      remediationStage: stageId,
      remediationStageLabel: REMEDIATION_STAGES[stageId].label,
      remediationComplete,
    })
  }
  return events
}
