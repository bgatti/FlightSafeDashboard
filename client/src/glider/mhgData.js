// Mile High Gliding — static data & mock operational state

export const MHG_INFO = {
  name: 'Mile High Gliding',
  tagline: 'Soar the Rocky Mountains',
  address: '5534 Independence Rd, Boulder, CO 80301',
  airport: 'Boulder Municipal Airport (KBDU)',
  phone: '(303) 527-1122',
  email: 'fly@milehighgliding.com',
  website: 'https://www.milehighgliding.com',
  facebook: 'https://www.facebook.com/milehighgliding/',
  instagram: 'https://www.instagram.com/milehigh.gliding/',
  established: 1998,
  hours: 'Mon, Tue, Thu–Sun · Year-round, weather permitting',
  bestFlying: '9 AM – 11:30 AM smoothest · Afternoon thermals stronger',
  metarUrl: 'https://aviationweather.gov/data/metar/?id=KBDU&hours=6',
  webcamUrl: 'https://weathercams.faa.gov/map/-105.22583,39.8594,10/airport/BDU/details/weather',
  windyUrl: 'https://www.windy.com/airport/KBDU',
}

export const MHG_FLEET = [
  {
    id: 'sgs-2-32-a',
    type: 'Schweizer SGS 2-32',
    tailNumber: 'N3032',
    seats: 2,
    wing: 'Mid-wing',
    role: 'Scenic rides · Aerobatics · Spin training',
    notes: 'Previous world record holder — high-performance sailplane',
    status: 'airworthy',
    maxGross: 1430,
    emptyWeight: 850,
    maxPayload: 580,
    wingSpan: '57 ft',
    glideRatio: '34:1',
    vne: 150,
    img: 'schweizer-2-32',
  },
  {
    id: 'sgs-2-32-b',
    type: 'Schweizer SGS 2-32',
    tailNumber: 'N4032',
    seats: 2,
    wing: 'Mid-wing',
    role: 'Scenic rides · Aerobatics',
    notes: 'Fleet workhorse for premium flights',
    status: 'airworthy',
    maxGross: 1430,
    emptyWeight: 850,
    maxPayload: 580,
    wingSpan: '57 ft',
    glideRatio: '34:1',
    vne: 150,
    img: 'schweizer-2-32',
  },
  {
    id: 'sgs-2-33-a',
    type: 'Schweizer SGS 2-33',
    tailNumber: 'N2733',
    seats: 2,
    wing: 'High-wing',
    role: 'Primary trainer',
    notes: 'Most popular training glider in the USA',
    status: 'airworthy',
    maxGross: 1040,
    emptyWeight: 600,
    maxPayload: 440,
    wingSpan: '51 ft',
    glideRatio: '22:1',
    vne: 98,
    img: 'schweizer-2-33',
  },
  {
    id: 'sgs-2-33-b',
    type: 'Schweizer SGS 2-33',
    tailNumber: 'N2833',
    seats: 2,
    wing: 'High-wing',
    role: 'Training · Scenic backup',
    notes: 'Dual-use trainer / scenic aircraft',
    status: 'maintenance',
    maxGross: 1040,
    emptyWeight: 600,
    maxPayload: 440,
    wingSpan: '51 ft',
    glideRatio: '22:1',
    vne: 98,
    img: 'schweizer-2-33',
  },
  {
    id: 'sgs-1-34',
    type: 'Schweizer SGS 1-34',
    tailNumber: 'N1534',
    seats: 1,
    wing: 'High-wing',
    role: 'Solo rental',
    notes: 'Available for rated glider pilots',
    status: 'airworthy',
    maxGross: 700,
    emptyWeight: 440,
    maxPayload: 260,
    wingSpan: '49 ft',
    glideRatio: '33:1',
    vne: 130,
    img: 'schweizer-1-34',
  },
]

export const MHG_TOW_PLANES = [
  { id: 'pawnee-1', type: 'Piper PA-25 Pawnee', tailNumber: 'N8025', status: 'flying', role: 'Primary tow' },
  { id: 'pawnee-2', type: 'Piper PA-25 Pawnee', tailNumber: 'N8125', status: 'standby', role: 'Primary tow' },
  { id: 'supercub', type: 'Piper PA-18 Super Cub (180 hp)', tailNumber: 'N4718', status: 'standby', role: 'Lighter tows / backup' },
]

export const MHG_FLIGHTS = [
  {
    id: 'boulder-view',
    name: 'Boulder View',
    price: 175,
    duration: '~15 min',
    altitude: '8,000 ft',
    description: 'See the City of Boulder from cruising altitude — glide over the University of Colorado and Downtown.',
    highlights: ['CU Campus', 'Downtown Boulder', 'Foothills panorama'],
  },
  {
    id: 'discovery',
    name: 'Discovery Flight',
    price: 245,
    duration: '~25 min',
    altitude: '10,600 ft',
    description: 'Mile High altitude with YOU at the controls. Our instructor backs you up while you experience the thrill of soaring.',
    highlights: ['You fly the glider', 'Ground briefing included', 'Counts toward training'],
    featured: true,
  },
  {
    id: 'mountain-top',
    name: 'Mountain Top',
    price: 275,
    duration: '~20 min',
    altitude: '9,000 ft',
    description: 'Soar over the iconic Flatirons — Bear Peak, Green Mountain, and Mount Sanitas spread below you.',
    highlights: ['Flatirons close-up', 'Bear Peak', 'Green Mountain', 'Mt Sanitas'],
  },
  {
    id: 'mile-high',
    name: 'Mile High',
    price: 300,
    duration: '~30 min',
    altitude: '10,600 ft',
    description: 'Our most popular flight. Soar along the Continental Divide with Longs Peak and the Flatirons in full view.',
    highlights: ['Continental Divide', 'Longs Peak', 'Flatirons', 'Indian Peaks'],
    popular: true,
  },
  {
    id: 'adventure',
    name: 'Adventure',
    price: 500,
    duration: '~45 min+',
    altitude: 'Custom',
    description: 'A specialized soaring experience tailored to you — by far the best soaring ride over the Rocky Mountains we offer.',
    highlights: ['Custom route', 'Extended flight', 'Aerobatics optional', 'Peak experience'],
  },
]

export const MHG_INSTRUCTION = [
  { id: 'discovery', name: 'Discovery Flight', price: 245, desc: 'First glider experience — ground brief, aircraft familiarization, you fly!' },
  { id: 'ground', name: 'Ground Instruction', price: null, desc: 'Aircraft tour, runway orientation, basic mechanics, rules & regs' },
  { id: 'flight', name: 'Flight Instruction', price: null, desc: 'Stick-and-rudder fundamentals with certified glider instructors' },
  { id: 'soaring', name: 'Soaring Techniques', price: null, desc: 'Advanced thermal and mountain wave soaring' },
  { id: 'spin', name: 'Spin Training / Upset Recovery', price: null, desc: 'Specialized endorsement in the Schweizer 2-32' },
  { id: 'bfr', name: 'Flight Review (BFR)', price: null, desc: '1 hr ground + 1 hr flight for licensed pilots' },
]

export const MHG_STAFF = [
  { name: 'Dan Swenson', role: 'Commercial Pilot', bio: 'Boulder native. First glider ride March 1981. 3,000+ hours in aerobatic ride planes. Local sightseeing specialist.' },
  { name: 'Luke Reivich', role: 'Commercial Pilot', bio: 'Started flying gliders at age 13. Cross-country soaring specialist. Adventure flight expert.' },
  { name: 'Jenna Cooper', role: 'CFIG', bio: 'CU Aerospace Engineering PhD student. Trained at MHG and Harris Hill, Elmira NY. Instruction & scenic rides.' },
  { name: 'Jordon Griffler', role: 'Pilot / Instructor', bio: 'Airplane pilot + flight instructor. Boulder native. Aviation and outdoor recreation.' },
]

export const MHG_TOW_FEES = {
  hookup: 15,
  perThousandFt: 16,
}

export const MHG_RESTRICTIONS = {
  maxPassengerWeight: 300,
  seatWidth: 28,
  minAge: 5,
  minHeight: '4\'10"',
}

export const MHG_GALLERY = [
  { id: 1, alt: 'Schweizer 2-32 soaring over the Flatirons', category: 'flights' },
  { id: 2, alt: 'Discovery flight student at the controls', category: 'instruction' },
  { id: 3, alt: 'Pawnee tow plane launching a 2-33', category: 'operations' },
  { id: 4, alt: 'Continental Divide panorama from 10,600 ft', category: 'scenery' },
  { id: 5, alt: 'Sunset over the Indian Peaks from glider cockpit', category: 'scenery' },
  { id: 6, alt: 'Flatirons close-up from Mountain Top flight', category: 'scenery' },
  { id: 7, alt: 'Ground crew prepping the 2-32 for launch', category: 'operations' },
  { id: 8, alt: 'Student solo in the SGS 1-34', category: 'instruction' },
  { id: 9, alt: 'Longs Peak and the Divide in winter', category: 'scenery' },
  { id: 10, alt: 'Aerobatic loop in the 2-32 over Boulder', category: 'flights' },
  { id: 11, alt: 'Mile High Gliding ramp on a bluebird day', category: 'operations' },
  { id: 12, alt: 'Bear Peak and Green Mountain from 9,000 ft', category: 'scenery' },
]

// Personas map to actual mock students/personnel so the training system works.
// studentId links to mockStudents[], personnelId links to mockPersonnel[].
export const MHG_PERSONAS = [
  // Visitor — never flown before, just browsing
  { id: 'visitor-1', name: 'Chris Parker', role: 'visitor', label: 'First-time Visitor',
    email: 'chris@example.com', weightLbs: 185, operator: 'mhg' },
  // Glider PPL student — Stage 2, 8.5 hrs dual
  { id: 'std-005', name: 'Ryan Okada', role: 'student', label: 'Glider PPL Student (Stage 2)',
    email: 'rokada@email.com', weightLbs: 172, hours: 8.5,
    studentId: 'std-005', program: 'glider_private_pilot', operator: 'mhg',
    aircraft: ['ac-008', 'ac-009'], cert: 'student', ratings: [], endorsements: [] },
  // PPL holder adding glider — Stage 3, near checkride
  { id: 'std-006', name: 'Sara Lindstrom', role: 'student', label: 'PPL → Glider Add-On (Stage 3)',
    email: 'slindstrom@email.com', weightLbs: 138, hours: 195,
    studentId: 'std-006', program: 'glider_add_on', operator: 'mhg',
    aircraft: ['ac-009'], cert: 'private', ratings: ['asel'], endorsements: [] },
  // Glider PPL student — club member with glider rating, continuing training
  { id: 'std-010', name: 'Anika Patel', role: 'student', label: 'Glider PPL Student (Stage 2)',
    email: 'anika@example.com', weightLbs: 130, hours: 12.0, operator: 'mhg',
    studentId: 'std-010', program: 'glider_private_pilot',
    aircraft: ['ac-008', 'ac-009'], cert: 'student', ratings: [], endorsements: [] },
  // Rated glider pilot — club renter
  { id: 'renter-1', name: 'Sarah Whitfield', role: 'renter', label: 'Glider Private — Club Renter',
    email: 'sarah@soarboulder.org', weightLbs: 145, hours: 120, operator: 'mhg',
    cert: 'private', ratings: ['glider'], endorsements: [],
    aircraft: ['ac-008', 'ac-009'] },
  // CFI-G instructor (maps to Linda Foster prs-017 who is CFIG)
  { id: 'cfi-1', name: 'Linda Foster', role: 'cfi', label: 'CFIG — Instructor',
    email: 'linda@milehighgliding.com', weightLbs: 147, hours: 3200, operator: 'mhg',
    personnelId: 'prs-017',
    cert: 'commercial', ratings: ['asel', 'instrument', 'cfi', 'cfii', 'cfig'], endorsements: ['hp', 'complex', 'tailwheel'] },
]

// Simulated "today's ops" for the current-operations widget
export function getTodayOps() {
  const hour = new Date().getHours()
  const isOperating = hour >= 8 && hour < 18
  const towsActive = isOperating ? (hour < 12 ? 2 : 1) : 0
  const queueLength = isOperating ? Math.max(0, Math.floor(Math.random() * 4)) : 0
  return {
    isOperating,
    towPlanesActive: towsActive,
    towPlanesTotal: 3,
    estimatedWait: queueLength * 12,
    queueLength,
    nextSunset: '19:22 MDT',
    fieldElevation: '5,288 ft MSL',
    runwayInUse: '08/26',
    windDir: isOperating ? `${220 + Math.floor(Math.random() * 40)}°` : '--',
    windSpeed: isOperating ? `${6 + Math.floor(Math.random() * 10)} kt` : '--',
    temp: isOperating ? `${58 + Math.floor(Math.random() * 15)}°F` : '--',
    thermalForecast: hour >= 11 && hour <= 16 ? 'Good' : hour >= 9 ? 'Moderate' : 'Calm',
  }
}
