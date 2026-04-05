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

const MHG_CDN = 'https://4d7a9580e910a5227ad3.cdn6.editmysite.com/uploads/b/4d7a9580e910a5227ad31b8f17f245e444d0c04f822164dcfd300a7e2f96ba78'

export const MHG_GALLERY = [
  { id: 1, img: `${MHG_CDN}/PJBJ4573%20Edit-5_1643401088.jpg`, alt: 'Schweizer 2-32 soaring over the Flatirons', category: 'flights' },
  { id: 2, img: `${MHG_CDN}/Jordon%20Cockpit_1647014738.jpg`, alt: 'Discovery flight student at the controls', category: 'instruction' },
  { id: 3, img: `${MHG_CDN}/PJBJ4468%20Edit-5_1643401078.jpg`, alt: 'Glider on the ramp ready for launch', category: 'operations' },
  { id: 4, img: `${MHG_CDN}/Natalie%20big%20smile%20flying_1648157237.jpg`, alt: 'Happy passenger soaring over Boulder', category: 'flights' },
  { id: 5, img: `${MHG_CDN}/20210904_MileHighGlider_KristinaRusch-12_1647018370.jpg`, alt: 'Aerial view of the Rocky Mountain Front Range', category: 'scenery' },
  { id: 6, img: `${MHG_CDN}/44883675304_f76c720546_o_1592667961_1643401058.jpg`, alt: 'Glider silhouette against sunset sky', category: 'scenery' },
  { id: 7, img: `${MHG_CDN}/s658900642949356718_p15_i12_w1200_1643401087.jpeg`, alt: 'Soaring above the Flatirons', category: 'scenery' },
  { id: 8, img: `${MHG_CDN}/48400283806_af4fef99bb_k_1643401059.jpg`, alt: 'Continental Divide panorama from altitude', category: 'scenery' },
  { id: 9, img: `${MHG_CDN}/64832050_10216758199981866_7200207939519381504_o_1592667960_1643401058.jpg`, alt: 'Glider cockpit view over the mountains', category: 'flights' },
  { id: 10, img: `${MHG_CDN}/48058599958_8c0c5c9409_4k_1643401058.jpg`, alt: 'Longs Peak and the Divide in winter', category: 'scenery' },
  { id: 11, img: `${MHG_CDN}/48140484142_7ab4ab8391_k_1643401058.jpg`, alt: 'Sunset over the Indian Peaks from glider', category: 'scenery' },
  { id: 12, img: `${MHG_CDN}/IMG-7914%5B596%5D_1647014740.jpg`, alt: 'Ground crew and glider on a bluebird day', category: 'operations' },
  { id: 13, img: `${MHG_CDN}/5FE3F2E2-6D98-44E9-864B-F504D445244C_1_201_a_1646946794.jpeg`, alt: 'Boulder Valley from the air', category: 'scenery' },
  { id: 14, img: `${MHG_CDN}/20210904_MileHighGlider_KristinaRusch-45_1646945626.jpg`, alt: 'Pre-flight briefing with instructor', category: 'instruction' },
  { id: 15, img: `${MHG_CDN}/IMG-6137_1644166450.jpg`, alt: 'Tow plane launching a glider', category: 'operations' },
  { id: 16, img: `${MHG_CDN}/IMG-4747%5B539%5D_1646407974.jpg`, alt: 'Mountain soaring adventure flight', category: 'flights' },
  { id: 17, img: `${MHG_CDN}/48164221391_b2d980ddb1_4k_1643401058.jpg`, alt: 'Flatirons close-up from Mountain Top flight', category: 'scenery' },
  { id: 18, img: `${MHG_CDN}/20210904_MileHighGlider_KristinaRusch-10_1647018370.jpg`, alt: 'Glider wing over green meadows', category: 'flights' },
  { id: 19, img: `${MHG_CDN}/48458417706_3a107aa439_k_1643401059.jpg`, alt: 'Bear Peak and Green Mountain from 9,000 ft', category: 'scenery' },
  { id: 20, img: `${MHG_CDN}/20210904_MileHighGlider_KristinaRusch-36_1647018465.jpg`, alt: 'Student at the controls during training', category: 'instruction' },
  { id: 21, img: `${MHG_CDN}/20210904_MileHighGlider_KristinaRusch-2_1647018465.jpg`, alt: 'Mile High Gliding ramp operations', category: 'operations' },
  { id: 22, img: `${MHG_CDN}/natalie%20and%20david_1648157237.jpg`, alt: 'Pilot and passenger after a scenic flight', category: 'flights' },
  { id: 23, img: `${MHG_CDN}/IMG_0637_1685451271.jpg`, alt: 'Glider ready on the runway', category: 'operations' },
  { id: 24, img: `${MHG_CDN}/2023-02-07_21-12-38_1675829590.jpg`, alt: 'Winter soaring over snow-capped peaks', category: 'scenery' },
  { id: 25, img: `${MHG_CDN}/IMG_7897_1675829535.jpg`, alt: 'Aerobatic maneuver over Boulder', category: 'flights' },
  { id: 26, img: `${MHG_CDN}/2022-03-24_15-17-18_1648156652.jpg`, alt: 'Spring launch day at Boulder Municipal', category: 'operations' },
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
