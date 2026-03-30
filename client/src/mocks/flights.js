// Seed flight data for Alpha Flight Ops — KBDU
// Part 135 on-demand charter operations, Rocky Mountain base
// Terrain profiles match the sim engine charter routes

const now = Date.now()
const h = (n) => new Date(now + n * 3_600_000).toISOString()

function mkProfile(points) { return points }

// ── Terrain profiles (KBDU-origin, matching flightSimEngine routes) ───────────

const TERRAIN_KBDU_KASE = mkProfile([
  { distNm:  0, elevFt: 5288,  label: 'KBDU' },
  { distNm: 15, elevFt: 7500 },
  { distNm: 25, elevFt: 9200,  label: 'Front Range' },
  { distNm: 40, elevFt: 11800 },
  { distNm: 55, elevFt: 13800, label: 'Continental Divide' },
  { distNm: 70, elevFt: 12400 },
  { distNm: 85, elevFt: 10200 },
  { distNm: 95, elevFt: 7820,  label: 'KASE' },
])

const TERRAIN_KBDU_KTEX = mkProfile([
  { distNm:   0, elevFt: 5288,  label: 'KBDU' },
  { distNm:  30, elevFt: 7800 },
  { distNm:  60, elevFt: 10200, label: 'Black Canyon' },
  { distNm:  90, elevFt: 12400 },
  { distNm: 120, elevFt: 13200, label: 'San Juan Range' },
  { distNm: 150, elevFt: 11600 },
  { distNm: 165, elevFt: 9800 },
  { distNm: 175, elevFt: 9070,  label: 'KTEX' },
])

const TERRAIN_KBDU_KLXV = mkProfile([
  { distNm:  0, elevFt: 5288,  label: 'KBDU' },
  { distNm: 15, elevFt: 7200 },
  { distNm: 30, elevFt: 9400,  label: 'Arapahoe Basin' },
  { distNm: 45, elevFt: 10800 },
  { distNm: 55, elevFt: 12600, label: 'Mosquito Range' },
  { distNm: 65, elevFt: 9927,  label: 'KLXV' },
])

const TERRAIN_KBDU_KCOS = mkProfile([
  { distNm:  0, elevFt: 5288, label: 'KBDU' },
  { distNm: 20, elevFt: 6200 },
  { distNm: 40, elevFt: 7100, label: 'Palmer Divide' },
  { distNm: 60, elevFt: 6600 },
  { distNm: 85, elevFt: 6187, label: 'KCOS' },
])

const TERRAIN_KASE_KBDU = mkProfile([
  { distNm:  0, elevFt: 7820,  label: 'KASE' },
  { distNm: 10, elevFt: 10200 },
  { distNm: 25, elevFt: 12400 },
  { distNm: 40, elevFt: 13800, label: 'Continental Divide' },
  { distNm: 55, elevFt: 11800 },
  { distNm: 70, elevFt: 9200,  label: 'Front Range' },
  { distNm: 80, elevFt: 7500 },
  { distNm: 95, elevFt: 5288,  label: 'KBDU' },
])

const TERRAIN_KBDU_KEGE = mkProfile([
  { distNm:   0, elevFt: 5288,  label: 'KBDU' },
  { distNm:  20, elevFt: 7400 },
  { distNm:  40, elevFt: 9200,  label: 'Vail Pass' },
  { distNm:  60, elevFt: 10800, label: 'Battle Mountain' },
  { distNm:  80, elevFt: 8800 },
  { distNm: 100, elevFt: 6548,  label: 'KEGE' },
])

// ── Seed flights ──────────────────────────────────────────────────────────────

export const mockFlights = [
  // Active charter — N55555 Grand Caravan airborne to Aspen
  {
    id: 'flt-001',
    callsign: 'N55555',
    tailNumber: 'N55555',
    aircraftType: 'C208',
    departure: 'KBDU',
    arrival: 'KASE',
    waypoints: [],
    plannedDepartureUtc: h(-0.6),
    status: 'active',
    pic: 'Smith, J.',
    picId: 'prs-001',
    sic: 'Jones, R.',
    sicId: 'prs-002',
    passengers: 4,
    missionType: 'charter',
    riskScore: 56,
    riskP: 50, riskA: 39, riskV: 62, riskE: 46,
    riskSnapshot: {
      capturedAt: h(-0.7),
      lastCheckedAt: h(-0.7),
      ratioToBaseline: 1.40,
      riskTrend: 'stable',
      riskDelta: 0,
      weatherSummary: { flightCategory: 'VFR', sigmetCount: 0, airmetCount: 1, windKts: 14, visibilitySm: 10 },
      terrainProfile: { profile: TERRAIN_KBDU_KASE, maxElevFt: 13800, routeDistNm: 95 },
      riskItems: [
        { id: 'op_high_terrain',   label: 'Terrain above 12,000 ft MSL — Continental Divide', category: 'terrain',     severity: 'critical' },
        { id: 'op_ifr_mtn',        label: 'IFR over mountainous terrain',                       category: 'operational', severity: 'moderate' },
        { id: 'wx_airmet_active',  label: '1 AIRMET active on route',                            category: 'weather',     severity: 'high'     },
        { id: 'op_135_charter',    label: 'Part 135 on-demand charter',                          category: 'operational', severity: 'low'      },
      ],
    },
  },

  // Planned charter — N12345 Baron to Telluride this afternoon
  {
    id: 'flt-002',
    callsign: 'N12345',
    tailNumber: 'N12345',
    aircraftType: 'BE58',
    departure: 'KBDU',
    arrival: 'KTEX',
    waypoints: [],
    plannedDepartureUtc: h(2.5),
    status: 'planned',
    pic: 'Davis, M.',
    picId: 'prs-003',
    sic: 'Patel, A.',
    sicId: 'prs-004',
    passengers: 3,
    missionType: 'charter',
    riskScore: 56,
    riskP: 49, riskA: 39, riskV: 62, riskE: 46,
    riskSnapshot: {
      capturedAt: h(-0.25),
      lastCheckedAt: h(-0.25),
      ratioToBaseline: 1.40,
      riskTrend: 'stable',
      riskDelta: 0,
      weatherSummary: { flightCategory: 'VFR', sigmetCount: 0, airmetCount: 0, windKts: 10, visibilitySm: 10 },
      terrainProfile: { profile: TERRAIN_KBDU_KTEX, maxElevFt: 13200, routeDistNm: 175 },
      riskItems: [
        { id: 'op_high_terrain',   label: 'Terrain above 12,000 ft MSL — San Juan Range', category: 'terrain',     severity: 'critical' },
        { id: 'op_ifr_mtn',        label: 'IFR over mountainous terrain',                  category: 'operational', severity: 'moderate' },
        { id: 'op_135_charter',    label: 'Part 135 on-demand charter',                    category: 'operational', severity: 'low'      },
      ],
    },
  },

  // Planned ferry / dead head — N55555 returning from Aspen
  {
    id: 'flt-003',
    callsign: 'N55555',
    tailNumber: 'N55555',
    aircraftType: 'C208',
    departure: 'KASE',
    arrival: 'KBDU',
    waypoints: [],
    plannedDepartureUtc: h(0.8),
    status: 'planned',
    pic: 'Smith, J.',
    picId: 'prs-001',
    sic: 'Jones, R.',
    sicId: 'prs-002',
    passengers: 0,
    missionType: 'ferry',
    riskScore: 42,
    riskP: 37, riskA: 29, riskV: 46, riskE: 34,
    riskSnapshot: {
      capturedAt: h(-0.7),
      lastCheckedAt: h(-0.7),
      ratioToBaseline: 1.05,
      riskTrend: 'stable',
      riskDelta: 0,
      weatherSummary: { flightCategory: 'VFR', sigmetCount: 0, airmetCount: 0, windKts: 12, visibilitySm: 10 },
      terrainProfile: { profile: TERRAIN_KASE_KBDU, maxElevFt: 13800, routeDistNm: 95 },
      riskItems: [
        { id: 'op_ferry_return',  label: 'Ferry / dead-head — crew only, no pax',         category: 'operational', severity: 'low'  },
        { id: 'op_mtn_terrain',   label: 'Rocky Mountain terrain on return leg',           category: 'terrain',     severity: 'high' },
      ],
    },
  },

  // Planned charter — N44444 Seneca to Leadville tomorrow morning
  {
    id: 'flt-004',
    callsign: 'N44444',
    tailNumber: 'N44444',
    aircraftType: 'PA34',
    departure: 'KBDU',
    arrival: 'KLXV',
    waypoints: [],
    plannedDepartureUtc: h(14),
    status: 'planned',
    pic: 'Davis, M.',
    picId: 'prs-003',
    sic: null,
    sicId: null,
    passengers: 2,
    missionType: 'charter',
    riskScore: 50,
    riskP: 44, riskA: 35, riskV: 55, riskE: 41,
    riskSnapshot: {
      capturedAt: h(-0.1),
      lastCheckedAt: h(-0.1),
      ratioToBaseline: 1.25,
      riskTrend: 'stable',
      riskDelta: 0,
      weatherSummary: { flightCategory: 'VFR', sigmetCount: 0, airmetCount: 0, windKts: 8, visibilitySm: 10 },
      terrainProfile: { profile: TERRAIN_KBDU_KLXV, maxElevFt: 12600, routeDistNm: 65 },
      riskItems: [
        { id: 'op_high_terrain',  label: 'Terrain above 12,000 ft MSL — Mosquito Range', category: 'terrain',     severity: 'critical' },
        { id: 'op_ifr_mtn',       label: 'IFR over mountainous terrain',                  category: 'operational', severity: 'moderate' },
        { id: 'op_135_charter',   label: 'Part 135 on-demand charter',                    category: 'operational', severity: 'low'      },
      ],
    },
  },

  // Completed charter — N67890 Skyhawk to Colorado Springs (earlier today)
  {
    id: 'flt-005',
    callsign: 'N67890',
    tailNumber: 'N67890',
    aircraftType: 'C172',
    departure: 'KBDU',
    arrival: 'KCOS',
    waypoints: [],
    plannedDepartureUtc: h(-4),
    status: 'completed',
    pic: 'Smith, J.',
    picId: 'prs-001',
    sic: null,
    sicId: null,
    passengers: 1,
    missionType: 'charter',
    riskScore: 33,
    riskP: 29, riskA: 23, riskV: 36, riskE: 27,
    riskSnapshot: {
      capturedAt: h(-4.2),
      lastCheckedAt: h(-4.2),
      ratioToBaseline: 0.83,
      riskTrend: 'stable',
      riskDelta: 0,
      weatherSummary: { flightCategory: 'VFR', sigmetCount: 0, airmetCount: 0, windKts: 6, visibilitySm: 10 },
      terrainProfile: { profile: TERRAIN_KBDU_KCOS, maxElevFt: 7100, routeDistNm: 85 },
      riskItems: [
        { id: 'op_135_charter',  label: 'Part 135 on-demand charter', category: 'operational', severity: 'low' },
      ],
    },
  },

  // Planned charter — N12345 Baron to Eagle/Vail
  {
    id: 'flt-006',
    callsign: 'N12345',
    tailNumber: 'N12345',
    aircraftType: 'BE58',
    departure: 'KBDU',
    arrival: 'KEGE',
    waypoints: [],
    plannedDepartureUtc: h(6),
    status: 'planned',
    pic: 'Davis, M.',
    picId: 'prs-003',
    sic: null,
    sicId: null,
    passengers: 2,
    missionType: 'charter',
    riskScore: 44,
    riskP: 39, riskA: 31, riskV: 48, riskE: 36,
    riskSnapshot: {
      capturedAt: h(-0.1),
      lastCheckedAt: h(-0.1),
      ratioToBaseline: 1.10,
      riskTrend: 'stable',
      riskDelta: 0,
      weatherSummary: { flightCategory: 'VFR', sigmetCount: 0, airmetCount: 0, windKts: 10, visibilitySm: 10 },
      terrainProfile: { profile: TERRAIN_KBDU_KEGE, maxElevFt: 10800, routeDistNm: 100 },
      riskItems: [
        { id: 'op_mtn_terrain',  label: 'High terrain — Vail Pass corridor',  category: 'terrain',     severity: 'high' },
        { id: 'op_ifr_mtn',      label: 'IFR over mountainous terrain',        category: 'operational', severity: 'moderate' },
        { id: 'op_135_charter',  label: 'Part 135 on-demand charter',          category: 'operational', severity: 'low' },
      ],
    },
  },
]
