#!/usr/bin/env node
// ============================================================================
// Mile High Gliding — MCP Server
// Exposes tools & resources for visitors, customers, and staff.
// Auth tier determines available capabilities per session.
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getDb, parseJsonFields } from '../db/index.js'
import {
  TOW_SETTINGS, TOW_HEIGHTS,
  buildTowSchedule, towDeficiencyMin, promoteStandbyReservations,
  towCycleMin, timeAloftMin,
} from '../lib/gliderUtils.js'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Static Data (mirrors mhgData.js)
// ---------------------------------------------------------------------------
const MHG_INFO = {
  name: 'Mile High Gliding',
  tagline: 'Soar the Rocky Mountains',
  address: '5534 Independence Rd, Boulder, CO 80301',
  airport: 'KBDU',
  airportName: 'Boulder Municipal Airport',
  phone: '(303) 527-1122',
  email: 'fly@milehighgliding.com',
  website: 'https://www.milehighgliding.com',
  established: 1998,
  hours: 'Mon, Tue, Thu–Sun · Year-round, weather permitting',
  bestFlying: '9 AM – 11:30 AM smoothest · Afternoon thermals stronger',
  fieldElevation: '5,288 ft MSL',
  runway: '08/26',
}

const EXPERIENCE_PACKAGES = [
  { id: 'boulder-view',  name: 'Boulder View',     price: 175, duration: '~15 min', altitude: '8,000 ft',  description: 'See the City of Boulder from cruising altitude — glide over CU and Downtown.' },
  { id: 'discovery',     name: 'Discovery Flight',  price: 245, duration: '~25 min', altitude: '10,600 ft', description: 'Mile High altitude with YOU at the controls. Our instructor backs you up while you experience the thrill of soaring.', featured: true },
  { id: 'mountain-top',  name: 'Mountain Top',      price: 275, duration: '~20 min', altitude: '9,000 ft',  description: 'Soar over the iconic Flatirons — Bear Peak, Green Mountain, and Mount Sanitas.' },
  { id: 'mile-high',     name: 'Mile High',         price: 300, duration: '~30 min', altitude: '10,600 ft', description: 'Our most popular flight. Soar along the Continental Divide with Longs Peak and the Flatirons in full view.', popular: true },
  { id: 'adventure',     name: 'Adventure',         price: 500, duration: '~45 min+', altitude: 'Custom',   description: 'Specialized soaring experience tailored to you — the best soaring ride over the Rockies.' },
]

const RESTRICTIONS = {
  maxPassengerWeight: 300,
  seatWidth: 28,
  minAge: 5,
  minHeight: '4\'10"',
}

const TRAINING_PROGRAMS = [
  { id: 'discovery', name: 'Discovery Flight', price: 245, description: 'First glider experience — ground brief, aircraft familiarization, you fly!' },
  { id: 'ground', name: 'Ground Instruction', pricePerHour: 65, description: 'Aircraft tour, runway orientation, basic mechanics, rules & regs' },
  { id: 'flight', name: 'Flight Instruction', pricePerHour: 65, description: 'Stick-and-rudder fundamentals with certified glider instructors. Rental + tow extra.' },
  { id: 'soaring', name: 'Soaring Techniques', pricePerHour: 65, description: 'Advanced thermal and mountain wave soaring' },
  { id: 'spin', name: 'Spin Training / Upset Recovery', pricePerHour: 65, description: 'Specialized endorsement in the Schweizer 2-32' },
  { id: 'bfr', name: 'Flight Review (BFR)', price: 245, description: '1 hr ground + 1 hr flight for licensed pilots' },
]

// Map package IDs to appropriate tow heights based on altitude targets
// Field elevation KBDU ≈ 5,288 ft MSL; heights are AGL release altitude
const PACKAGE_TOW_HEIGHTS = {
  'boulder-view':  2000,   //  8,000 ft MSL → ~2,700 AGL → 2k scenic tow
  'discovery':     4000,   // 10,600 ft MSL → ~5,300 AGL → 4k mountain tow
  'mountain-top':  4000,   //  9,000 ft MSL → ~3,700 AGL → 4k mountain tow
  'mile-high':     5000,   // 10,600 ft MSL → ~5,300 AGL → 5k mountain tow
  'adventure':     5000,   // custom / highest
}

// Lesson plan tow profiles — from trainingUtils.js syllabus
// Tow cycle = 10 min ground + 5 min per 1000 ft
// Pattern (1000 ft) = 15 min · Scenic (2000 ft) = 20 min · Mountain (4000 ft) = 30 min
const LESSON_TOW_PROFILES = {
  'gpp-1-1': { heights: [2000, 2000] },                   // Intro — 2 scenic tows
  'gpp-1-2': { heights: [1000, 1000, 1000, 1000] },       // Aerotow & Pattern — 4 pattern tows
  'gpp-1-3': { heights: [4000, 4000] },                   // Stalls & Spin — 2 mountain tows
  'gpp-2-1': { heights: [4000] },                         // Soaring Techniques — 1 mountain tow
  'gpp-2-2': { heights: [1000, 1000, 2000] },             // Pattern & Off-Field — 2 pattern + 1 scenic
  'gpp-3-1': { heights: [1000, 1000, 1000, 1000] },       // First Solo — 4 pattern tows
  'gpp-3-2': { heights: [4000] },                         // Solo Soaring — 1 mountain tow
  'gpp-4-2': { heights: [2000, 2000, 4000] },             // Mock Practical — 2 scenic + 1 mountain
  'gao-1-1': { heights: [2000, 2000] },                   // Add-On Orientation — 2 scenic
}

// ---------------------------------------------------------------------------
// Session State
// ---------------------------------------------------------------------------
let session = {
  tier: 'public',        // public | customer | staff
  userId: null,          // persona/client email or personnel id
  userName: null,
  role: null,            // visitor | student | renter | cfi | pilot | mechanic | dispatcher
  clientId: null,        // client_aircraft.id for customers
  personnelId: null,     // personnel.id for staff
}

/** Returns an MCP error response if auth is insufficient, or null if OK. */
function checkAuth(minTier) {
  const levels = { public: 0, customer: 1, staff: 2 }
  if (levels[session.tier] >= levels[minTier]) return null
  const actions = { customer: 'Use the login tool with your email first.', staff: 'Use the staff_login tool with your personnel ID.' }
  return {
    content: [{ type: 'text', text: `Access denied. This requires ${minTier}-level access (current: ${session.tier}). ${actions[minTier] || 'Please log in.'}` }],
    isError: true,
  }
}

// ---------------------------------------------------------------------------
// DB Helpers
// ---------------------------------------------------------------------------
const JSON_FLIGHT_FIELDS = ['waypoints', 'passengers', 'risk_snapshot', 'tow_info', 'terrain_profile', 'metadata', 'maneuvers_covered']

function flightSummary(row) {
  if (!row) return null
  const f = parseJsonFields(row, ...JSON_FLIGHT_FIELDS)
  return {
    id: f.id,
    date: f.planned_departure_utc,
    status: f.status,
    aircraft: f.tail_number,
    aircraftType: f.aircraft_type,
    departure: f.departure || f.airport,
    arrival: f.arrival,
    pilot: f.pic,
    missionType: f.mission_type || f.part91_type,
    towInfo: f.tow_info,
    totalHours: f.total_hours,
    categoryClass: f.category_class,
  }
}

function getFlightsForAirport(airport = 'KBDU') {
  const db = getDb()
  const rows = db.prepare(
    `SELECT * FROM flights
     WHERE (departure = ? OR airport = ?) AND status IN ('scheduled','completed')
     ORDER BY planned_departure_utc ASC`
  ).all(airport, airport)
  return rows.map(r => parseJsonFields(r, ...JSON_FLIGHT_FIELDS))
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: 'mile-high-gliding',
  version: '1.0.0',
  capabilities: { tools: {}, resources: {} },
})

// ============================= PUBLIC TOOLS ================================

server.tool(
  'get_info',
  'Get Mile High Gliding contact info, location, hours, and airport details. Start here for general questions about the business.',
  {},
  async () => ({ content: [{ type: 'text', text: JSON.stringify(MHG_INFO, null, 2) }] })
)

server.tool(
  'get_experience_packages',
  'Browse available glider ride packages with pricing, duration, and altitude. Call this when a visitor asks about rides, prices, or what flights are offered. Returns package IDs needed for book_flight.',
  {},
  async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        packages: EXPERIENCE_PACKAGES,
        restrictions: RESTRICTIONS,
        note: 'All flights depart from Boulder Municipal Airport (KBDU). Prices include tow fee. Weather permitting.',
      }, null, 2),
    }],
  })
)

server.tool(
  'get_fleet',
  'View the glider and tow plane fleet with specs and current airworthiness. Use when visitors ask about the aircraft or what they will fly in.',
  {},
  async () => {
    const db = getDb()
    const gliders = db.prepare(
      `SELECT tail_number, make_model, airworthy, passenger_capacity,
              max_gross_weight_lbs, empty_weight_lbs, total_airframe_hours
       FROM aircraft WHERE operator = 'mhg' AND (icao_type LIKE '%glid%' OR make_model LIKE '%Schweizer%')
       ORDER BY tail_number`
    ).all()
    const towPlanes = db.prepare(
      `SELECT tail_number, make_model, airworthy, total_airframe_hours
       FROM aircraft WHERE operator = 'mhg' AND (make_model LIKE '%Pawnee%' OR make_model LIKE '%Cub%')
       ORDER BY tail_number`
    ).all()
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          gliders: gliders.map(g => ({
            ...g,
            airworthy: !!g.airworthy,
            usefulLoad: g.max_gross_weight_lbs && g.empty_weight_lbs
              ? Math.round(g.max_gross_weight_lbs - g.empty_weight_lbs) : null,
          })),
          towPlanes: towPlanes.map(t => ({ ...t, airworthy: !!t.airworthy })),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'get_pricing',
  'Get current rates for tows, glider rental, and instruction',
  {},
  async () => {
    const db = getDb()
    const rows = db.prepare(`SELECT key, value, label FROM pricing WHERE category = 'glider' ORDER BY key`).all()
    const pricing = {}
    for (const r of rows) pricing[r.key] = { value: r.value, label: r.label }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          rates: pricing,
          towHeights: TOW_HEIGHTS,
          note: 'Tow minimum applies. Rental and instruction billed per hour.',
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'check_availability',
  'Check tow plane availability and estimated wait for a date/time window. Call this BEFORE book_flight so you can advise the visitor on the best time slot.',
  { date: z.string().describe('Date in YYYY-MM-DD format'), hour: z.number().optional().describe('Hour of day (0-23), defaults to current hour') },
  async ({ date, hour }) => {
    const h = hour ?? new Date().getHours()
    const windowStart = new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime()
    const windowEnd = windowStart + 60 * 60 * 1000 // 1 hour window

    const flights = getFlightsForAirport('KBDU')
    const deficiency = towDeficiencyMin(flights, 'KBDU', windowStart, windowEnd)
    const schedule = buildTowSchedule(flights, 'KBDU')

    // Count tows in this window
    const towsInWindow = schedule.filter(s => s.actualStartMs >= windowStart && s.actualStartMs < windowEnd).length
    const isOperating = h >= 8 && h < 18

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          date,
          hour: h,
          isOperating,
          capacity: deficiency,
          towsScheduled: towsInWindow,
          maxTowsPerHour: TOW_SETTINGS.towsPerHour,
          recommendation: !isOperating
            ? 'Operations run 8 AM – 6 PM. Please choose a time during operating hours.'
            : deficiency.color === 'green'
              ? 'Good availability — book anytime in this window.'
              : deficiency.color === 'yellow'
                ? 'Moderate load — booking recommended to guarantee your slot.'
                : 'High demand — you may be placed on standby. Consider an earlier or later time.',
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'get_field_conditions',
  'Get current field conditions — operating status, active tow planes, queue, thermal forecast',
  {},
  async () => {
    const hour = new Date().getHours()
    const isOperating = hour >= 8 && hour < 18

    // Count today's scheduled flights
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    const scheduled = db.prepare(
      `SELECT COUNT(*) as n FROM flights
       WHERE (departure = 'KBDU' OR airport = 'KBDU')
         AND status = 'scheduled'
         AND planned_departure_utc LIKE ?`
    ).get(`${today}%`)

    // Count airworthy tow planes
    const towReady = db.prepare(
      `SELECT COUNT(*) as n FROM aircraft
       WHERE operator = 'mhg' AND airworthy = 1
         AND (make_model LIKE '%Pawnee%' OR make_model LIKE '%Cub%')`
    ).get()

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          isOperating,
          operatingHours: '8 AM – 6 PM',
          towPlanesReady: towReady.n,
          scheduledFlightsToday: scheduled.n,
          thermalForecast: hour >= 11 && hour <= 16 ? 'Good' : hour >= 9 ? 'Moderate' : 'Calm',
          bestTimes: { smooth: '9 AM – 11:30 AM', thermals: '11 AM – 4 PM' },
          fieldElevation: '5,288 ft MSL',
          runway: '08/26',
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'get_instructors',
  'View available flight instructors and their qualifications',
  {},
  async () => {
    const db = getDb()
    const instructors = db.prepare(
      `SELECT id, name, role, role_label, cfi_ratings, flight_hours_ytd, specializations, years_experience
       FROM personnel
       WHERE (role LIKE '%instructor%' OR role LIKE '%cfi%' OR cfi_cert IS NOT NULL)
         AND department = 'Operations'
       ORDER BY name`
    ).all()
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(instructors.map(i => ({
          ...parseJsonFields(i, 'cfi_ratings', 'specializations'),
        })), null, 2),
      }],
    }
  }
)

server.tool(
  'get_training_programs',
  'Browse flight training options — discovery flights, private pilot, add-on ratings, flight reviews. Use this when a visitor asks about learning to fly or getting a glider rating.',
  {},
  async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        programs: TRAINING_PROGRAMS,
        gliderRentalPerHour: 85,
        towFees: 'Tow fees apply per launch (see get_pricing)',
        typicalTimeline: {
          privateGlider: '30–40 flights over 3–6 months',
          addOnRating: '10–20 flights for powered-pilot add-on',
          flightReview: '1 session (1 hr ground + 1 hr flight)',
        },
        note: 'All instruction at Boulder Municipal Airport (KBDU). Call to discuss a training plan.',
      }, null, 2),
    }],
  })
)

// ============================ AUTH TOOLS ====================================

server.tool(
  'login',
  'Log in as a customer by email to unlock booking, flight history, and invoices. Any email works — known clients get personalized data, new visitors get a session. Required before book_flight, my_flights, my_invoices, cancel_flight, or reschedule_flight.',
  { email: z.string().email().describe('Your email address on file with Mile High Gliding') },
  async ({ email }) => {
    const db = getDb()

    // Check client_aircraft for owner email
    const client = db.prepare('SELECT * FROM client_aircraft WHERE email = ?').get(email)
    if (client) {
      session = {
        tier: 'customer', userId: email, userName: client.owner_name,
        role: 'renter', clientId: client.id, personnelId: null,
      }
      return { content: [{ type: 'text', text: `Welcome back, ${client.owner_name}! You're logged in as a customer. You can now book flights, view your history, and manage invoices.` }] }
    }

    // Check personnel (for staff who might also be customers)
    const person = db.prepare('SELECT * FROM personnel WHERE LOWER(name) = LOWER(?) OR id = ?').get(email, email)
    if (person) {
      session = {
        tier: 'customer', userId: email, userName: person.name,
        role: 'student', clientId: null, personnelId: person.id,
      }
      return { content: [{ type: 'text', text: `Welcome, ${person.name}! Logged in as a customer. Use staff_login for staff access.` }] }
    }

    // New visitor — create a lightweight session
    session = {
      tier: 'customer', userId: email, userName: email.split('@')[0],
      role: 'visitor', clientId: null, personnelId: null,
    }
    return { content: [{ type: 'text', text: `Welcome! We've started a session for ${email}. You can browse packages and book a ride.` }] }
  }
)

server.tool(
  'staff_login',
  'Log in as staff (pilot, instructor, mechanic) for operations access',
  { personnelId: z.string().describe('Your personnel ID (e.g., prs-017)') },
  async ({ personnelId }) => {
    const db = getDb()
    const person = db.prepare('SELECT * FROM personnel WHERE id = ?').get(personnelId)
    if (!person) {
      return { content: [{ type: 'text', text: `Personnel ID "${personnelId}" not found. Contact operations for your ID.` }], isError: true }
    }
    session = {
      tier: 'staff', userId: personnelId, userName: person.name,
      role: person.role, clientId: null, personnelId: person.id,
    }
    return { content: [{ type: 'text', text: `Staff login: ${person.name} (${person.role_label || person.role}). Full operations access enabled.` }] }
  }
)

server.tool(
  'whoami',
  'Check current login status and permissions',
  {},
  async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        tier: session.tier,
        name: session.userName,
        role: session.role,
        capabilities: session.tier === 'public'
          ? ['Browse packages', 'Check availability', 'View fleet', 'Get pricing']
          : session.tier === 'customer'
            ? ['All public tools', 'Book flights', 'View my flights', 'View my invoices', 'Cancel reservations']
            : ['All tools', 'Tow schedule', 'Log flights', 'Manage squawks', 'Create invoices', 'Manage clients'],
      }, null, 2),
    }],
  })
)

server.tool(
  'logout',
  'Log out and return to public access',
  {},
  async () => {
    const name = session.userName
    session = { tier: 'public', userId: null, userName: null, role: null, clientId: null, personnelId: null }
    return { content: [{ type: 'text', text: name ? `Goodbye, ${name}! Logged out. Back to public access.` : 'Already logged out.' }] }
  }
)

// ========================== CUSTOMER TOOLS =================================

server.tool(
  'book_flight',
  'Book a glider ride or lesson. Requires customer login (call login first). Recommend calling check_availability and get_experience_packages before booking so you can suggest the best slot and confirm the package choice.',
  {
    packageId: z.string().describe('Package ID: boulder-view, discovery, mountain-top, mile-high, or adventure'),
    date: z.string().describe('Preferred date (YYYY-MM-DD)'),
    time: z.string().optional().describe('Preferred time (HH:MM), defaults to 10:00'),
    passengers: z.number().optional().describe('Number of passengers (default 1, max 1 for glider)'),
    name: z.string().optional().describe('Passenger name (uses login name if omitted)'),
    weight: z.number().optional().describe('Passenger weight in lbs (required for weight & balance)'),
    notes: z.string().optional().describe('Special requests or notes'),
  },
  async ({ packageId, date, time, passengers, name, weight, notes }) => {
    const denied = checkAuth('customer'); if (denied) return denied

    const pkg = EXPERIENCE_PACKAGES.find(p => p.id === packageId)
    if (!pkg) {
      return { content: [{ type: 'text', text: `Unknown package "${packageId}". Use get_experience_packages to see options.` }], isError: true }
    }

    if (weight && weight > RESTRICTIONS.maxPassengerWeight) {
      return { content: [{ type: 'text', text: `Weight limit is ${RESTRICTIONS.maxPassengerWeight} lbs for glider flights. Please call us to discuss options.` }], isError: true }
    }

    const t = time || '10:00'
    const departureUtc = `${date}T${t}:00Z`
    const towHeight = PACKAGE_TOW_HEIGHTS[pkg.id] || 3000
    const passengerName = name || session.userName || 'Guest'

    // Check availability
    const windowStart = new Date(departureUtc).getTime()
    const windowEnd = windowStart + 60 * 60 * 1000
    const flights = getFlightsForAirport('KBDU')
    const { isStandby, color } = towDeficiencyMin(flights, 'KBDU', windowStart, windowEnd)

    const db = getDb()
    const flightId = crypto.randomUUID()

    db.prepare(`
      INSERT INTO flights (
        id, source, departure, airport, planned_departure_utc,
        status, pic, passengers, mission_type, part91_type,
        tow_info, metadata, category_class
      ) VALUES (
        @id, 'user', 'KBDU', 'KBDU', @planned_departure_utc,
        @status, @pic, @passengers, 'glider_tow', 'glider_tow',
        @tow_info, @metadata, 'Glider'
      )
    `).run({
      id: flightId,
      planned_departure_utc: departureUtc,
      status: isStandby ? 'standby' : 'scheduled',
      pic: null,
      passengers: JSON.stringify({ count: passengers || 1, names: [passengerName], weight }),
      tow_info: JSON.stringify({ towHeights: [towHeight], isStandby, airport: 'KBDU' }),
      metadata: JSON.stringify({
        package: pkg.id,
        packageName: pkg.name,
        price: pkg.price,
        bookedBy: session.userId,
        bookedByName: session.userName,
        notes: notes || null,
      }),
    })

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          confirmation: isStandby ? 'STANDBY' : 'CONFIRMED',
          flightId,
          package: pkg.name,
          price: `$${pkg.price}`,
          date,
          time: t,
          towHeight: `${towHeight} ft`,
          passenger: passengerName,
          status: isStandby
            ? 'High demand — you are on the standby list. We will promote you when a slot opens.'
            : `Confirmed! Arrive 30 minutes early at ${MHG_INFO.address}.`,
          capacityColor: color,
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'my_flights',
  'View your upcoming and past flights. Requires customer login.',
  { status: z.enum(['all', 'scheduled', 'completed', 'cancelled']).optional().describe('Filter by status (default: all)') },
  async ({ status }) => {
    const denied = checkAuth('customer'); if (denied) return denied

    const db = getDb()
    let sql = `SELECT * FROM flights WHERE
      (metadata LIKE ? OR pic = ? OR passengers LIKE ?)
      AND (departure = 'KBDU' OR airport = 'KBDU')`
    const params = [`%${session.userId}%`, session.userName, `%${session.userName}%`]

    if (status && status !== 'all') {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY planned_departure_utc DESC LIMIT 50'

    const rows = db.prepare(sql).all(...params)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          user: session.userName,
          flightCount: rows.length,
          flights: rows.map(flightSummary),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'my_invoices',
  'View your invoices and payment status. Requires customer login.',
  { status: z.enum(['all', 'open', 'paid']).optional().describe('Filter: all, open, or paid') },
  async ({ status }) => {
    const denied = checkAuth('customer'); if (denied) return denied

    const db = getDb()
    let sql = `SELECT * FROM invoices WHERE (client_name LIKE ? OR client_id = ?)`
    const params = [`%${session.userName}%`, session.userId]

    if (status && status !== 'all') {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY date DESC LIMIT 50'

    const rows = db.prepare(sql).all(...params)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          user: session.userName,
          invoices: rows.map(r => {
            const inv = parseJsonFields(r, 'line_items')
            return {
              id: inv.id, date: inv.date, status: inv.status,
              total: inv.total, lineItems: inv.line_items,
              paidAt: inv.paid_at,
            }
          }),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'cancel_flight',
  'Cancel an upcoming reservation. Requires customer login. Consider suggesting reschedule_flight instead if the customer wants a different time.',
  { flightId: z.string().describe('The flight ID to cancel') },
  async ({ flightId }) => {
    const denied = checkAuth('customer'); if (denied) return denied

    const db = getDb()
    const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flightId)
    if (!flight) {
      return { content: [{ type: 'text', text: 'Flight not found.' }], isError: true }
    }

    const meta = flight.metadata ? JSON.parse(flight.metadata) : {}
    if (meta.bookedBy !== session.userId && flight.pic !== session.userName) {
      return { content: [{ type: 'text', text: 'You can only cancel your own flights.' }], isError: true }
    }

    if (flight.status === 'completed') {
      return { content: [{ type: 'text', text: 'Cannot cancel a completed flight.' }], isError: true }
    }

    db.prepare(`UPDATE flights SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(flightId)

    return { content: [{ type: 'text', text: `Flight ${flightId} cancelled. If you paid in advance, a refund will be processed.` }] }
  }
)

server.tool(
  'reschedule_flight',
  'Change the date or time of an existing reservation. Requires customer login. Use this instead of cancel + rebook.',
  {
    flightId: z.string().describe('The flight ID to reschedule'),
    date: z.string().describe('New date (YYYY-MM-DD)'),
    time: z.string().optional().describe('New time (HH:MM), keeps original if omitted'),
  },
  async ({ flightId, date, time }) => {
    const denied = checkAuth('customer'); if (denied) return denied

    const db = getDb()
    const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flightId)
    if (!flight) return { content: [{ type: 'text', text: 'Flight not found.' }], isError: true }

    const meta = flight.metadata ? JSON.parse(flight.metadata) : {}
    if (meta.bookedBy !== session.userId && flight.pic !== session.userName) {
      return { content: [{ type: 'text', text: 'You can only reschedule your own flights.' }], isError: true }
    }
    if (flight.status === 'completed' || flight.status === 'cancelled') {
      return { content: [{ type: 'text', text: `Cannot reschedule a ${flight.status} flight.` }], isError: true }
    }

    // Preserve original time if not provided
    const origTime = flight.planned_departure_utc ? flight.planned_departure_utc.slice(11, 16) : '10:00'
    const t = time || origTime
    const newDepartureUtc = `${date}T${t}:00Z`

    // Check availability at new time
    const windowStart = new Date(newDepartureUtc).getTime()
    const windowEnd = windowStart + 60 * 60 * 1000
    const flights = getFlightsForAirport('KBDU')
    const { isStandby, color } = towDeficiencyMin(flights, 'KBDU', windowStart, windowEnd)

    const towInfo = flight.tow_info ? JSON.parse(flight.tow_info) : {}
    db.prepare(`
      UPDATE flights SET planned_departure_utc = ?, status = ?, tow_info = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newDepartureUtc, isStandby ? 'standby' : 'scheduled', JSON.stringify({ ...towInfo, isStandby }), flightId)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          flightId,
          newDate: date,
          newTime: t,
          status: isStandby ? 'STANDBY — high demand at this time' : 'CONFIRMED',
          capacityColor: color,
        }, null, 2),
      }],
    }
  }
)

// ============================ STAFF TOOLS ==================================

server.tool(
  'view_tow_schedule',
  'View today\'s tow schedule with assignments and timing. Staff only.',
  { date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today') },
  async ({ date }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const d = date || new Date().toISOString().slice(0, 10)
    const db = getDb()
    const rows = db.prepare(
      `SELECT * FROM flights
       WHERE (departure = 'KBDU' OR airport = 'KBDU')
         AND planned_departure_utc LIKE ?
         AND status IN ('scheduled', 'standby')
       ORDER BY planned_departure_utc ASC`
    ).all(`${d}%`)

    const flights = rows.map(r => parseJsonFields(r, ...JSON_FLIGHT_FIELDS))
    const schedule = buildTowSchedule(flights, 'KBDU')

    // Hourly breakdown
    const hourly = {}
    for (const s of schedule) {
      const h = new Date(s.actualStartMs).getHours()
      if (!hourly[h]) hourly[h] = { hour: h, tows: 0, totalCycleMin: 0 }
      hourly[h].tows++
      hourly[h].totalCycleMin += towCycleMin(s.heightFt)
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          date: d,
          totalTows: schedule.length,
          schedule: schedule.map(s => ({
            flightId: s.flight.id,
            pilot: s.flight.pic,
            aircraft: s.flight.tail_number,
            towHeight: s.heightFt,
            requestedTime: new Date(s.requestedMs).toISOString(),
            actualStart: new Date(s.actualStartMs).toISOString(),
            actualEnd: new Date(s.actualEndMs).toISOString(),
            cycleMinutes: towCycleMin(s.heightFt),
            assignedPlane: s.assignedPlaneId || null,
          })),
          hourlyLoad: Object.values(hourly),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'view_daily_flights',
  'View all flights for a given day. Staff only.',
  {
    date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today'),
    status: z.string().optional().describe('Filter by status'),
  },
  async ({ date, status }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const d = date || new Date().toISOString().slice(0, 10)
    const db = getDb()
    let sql = `SELECT * FROM flights
       WHERE (departure = 'KBDU' OR airport = 'KBDU')
         AND planned_departure_utc LIKE ?`
    const params = [`${d}%`]

    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY planned_departure_utc ASC'

    const rows = db.prepare(sql).all(...params)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          date: d,
          count: rows.length,
          flights: rows.map(flightSummary),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'log_flight',
  'Record a completed flight with logbook details. Staff only. Pass flightId="new" to create a walk-in flight, or pass an existing flight ID to mark a reservation as completed.',
  {
    flightId: z.string().describe('Existing flight ID to update, or "new" to create'),
    tailNumber: z.string().optional().describe('Aircraft tail number'),
    pic: z.string().optional().describe('Pilot in command name'),
    passenger: z.string().optional().describe('Passenger name'),
    towHeight: z.number().optional().describe('Tow height in feet'),
    totalHours: z.number().optional().describe('Total flight time in hours'),
    dualHours: z.number().optional().describe('Dual instruction hours'),
    notes: z.string().optional().describe('Flight notes'),
  },
  async ({ flightId, tailNumber, pic, passenger, towHeight, totalHours, dualHours, notes }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const db = getDb()

    if (flightId === 'new') {
      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO flights (id, source, departure, airport, status, tail_number, pic,
          passengers, mission_type, part91_type, tow_info, total_hours, dual_hours,
          category_class, planned_departure_utc, metadata)
        VALUES (@id, 'user', 'KBDU', 'KBDU', 'completed', @tail_number, @pic,
          @passengers, 'glider_tow', 'glider_tow', @tow_info, @total_hours, @dual_hours,
          'Glider', datetime('now'), @metadata)
      `).run({
        id,
        tail_number: tailNumber || null,
        pic: pic || session.userName,
        passengers: passenger ? JSON.stringify({ count: 1, names: [passenger] }) : null,
        tow_info: JSON.stringify({ towHeights: [towHeight || 2000], airport: 'KBDU' }),
        total_hours: totalHours || null,
        dual_hours: dualHours || null,
        metadata: JSON.stringify({ loggedBy: session.userId, notes }),
      })
      return { content: [{ type: 'text', text: `Flight logged: ${id}` }] }
    }

    // Update existing flight
    const existing = db.prepare('SELECT * FROM flights WHERE id = ?').get(flightId)
    if (!existing) return { content: [{ type: 'text', text: 'Flight not found.' }], isError: true }

    const updates = {}
    if (tailNumber) updates.tail_number = tailNumber
    if (pic) updates.pic = pic
    if (totalHours != null) updates.total_hours = totalHours
    if (dualHours != null) updates.dual_hours = dualHours
    updates.status = 'completed'

    const setClauses = Object.keys(updates).map(k => `${k} = @${k}`)
    setClauses.push("updated_at = datetime('now')")
    updates.id = flightId

    db.prepare(`UPDATE flights SET ${setClauses.join(', ')} WHERE id = @id`).run(updates)
    return { content: [{ type: 'text', text: `Flight ${flightId} updated and marked completed.` }] }
  }
)

server.tool(
  'create_squawk',
  'Report an aircraft discrepancy (squawk). Staff only. Grounding-severity squawks automatically mark the aircraft unairworthy.',
  {
    tailNumber: z.string().describe('Aircraft tail number'),
    description: z.string().describe('Description of the discrepancy'),
    severity: z.enum(['grounding', 'ops_limiting', 'deferred', 'monitoring']).describe('Severity level'),
  },
  async ({ tailNumber, description, severity }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const db = getDb()
    const id = crypto.randomUUID()
    db.prepare(`
      INSERT INTO squawks (id, tail_number, reported_by, reported_date, description, severity, status)
      VALUES (?, ?, ?, date('now'), ?, ?, 'open')
    `).run(id, tailNumber, session.userName, description, severity)

    // If grounding, update aircraft
    if (severity === 'grounding') {
      db.prepare(`UPDATE aircraft SET airworthy = 0, updated_at = datetime('now') WHERE tail_number = ?`).run(tailNumber)
    }

    return { content: [{ type: 'text', text: `Squawk ${id} created (${severity}). ${severity === 'grounding' ? '⚠ Aircraft grounded.' : ''}` }] }
  }
)

server.tool(
  'view_squawks',
  'View open squawks, optionally filtered by aircraft. Staff only.',
  {
    tailNumber: z.string().optional().describe('Filter by tail number'),
    status: z.enum(['open', 'in_progress', 'deferred_mel', 'closed', 'all']).optional(),
  },
  async ({ tailNumber, status }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const db = getDb()
    let sql = 'SELECT * FROM squawks WHERE 1=1'
    const params = []

    if (tailNumber) { sql += ' AND tail_number = ?'; params.push(tailNumber) }
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status) }
    else if (!status) { sql += " AND status != 'closed'" }

    sql += ' ORDER BY reported_date DESC LIMIT 100'
    const rows = db.prepare(sql).all(...params)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          count: rows.length,
          squawks: rows.map(s => ({
            id: s.id, tailNumber: s.tail_number, severity: s.severity,
            status: s.status, description: s.description,
            reportedBy: s.reported_by, reportedDate: s.reported_date,
            melReference: s.mel_reference,
          })),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'create_invoice',
  'Generate an invoice for a flight or service. Staff only. Use get_pricing first to look up current rates for tow, rental, and instruction line items.',
  {
    clientName: z.string().describe('Client name'),
    tailNumber: z.string().optional().describe('Aircraft tail number'),
    lineItems: z.array(z.object({
      type: z.string().describe('Line item type (tow, rental, instruction, etc.)'),
      description: z.string(),
      amount: z.number(),
    })).describe('Invoice line items'),
  },
  async ({ clientName, tailNumber, lineItems }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const db = getDb()
    const id = crypto.randomUUID()
    const total = lineItems.reduce((sum, li) => sum + li.amount, 0)

    db.prepare(`
      INSERT INTO invoices (id, date, tail_number, client_name, status, line_items, total)
      VALUES (?, date('now'), ?, ?, 'open', ?, ?)
    `).run(id, tailNumber || null, clientName, JSON.stringify(lineItems), total)

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          invoiceId: id,
          client: clientName,
          total: `$${total.toFixed(2)}`,
          lineItems,
          status: 'open',
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'manage_clients',
  'View or search client aircraft records. Staff only.',
  { search: z.string().optional().describe('Search by tail number, owner name, or email') },
  async ({ search }) => {
    const denied = checkAuth('staff'); if (denied) return denied

    const db = getDb()
    let sql = 'SELECT * FROM client_aircraft'
    const params = []

    if (search) {
      sql += ' WHERE tail_number LIKE ? OR owner_name LIKE ? OR email LIKE ?'
      const term = `%${search}%`
      params.push(term, term, term)
    }
    sql += ' ORDER BY owner_name LIMIT 50'

    const rows = db.prepare(sql).all(...params)
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          count: rows.length,
          clients: rows.map(c => ({
            id: c.id, tailNumber: c.tail_number, owner: c.owner_name,
            phone: c.phone, email: c.email, makeModel: c.make_model,
            basedHere: !!c.based_here,
          })),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  'promote_standby',
  'Promote standby reservations when tow capacity opens. Staff only.',
  {},
  async () => {
    const denied = checkAuth('staff'); if (denied) return denied

    const db = getDb()
    const flights = getFlightsForAirport('KBDU')
    const promoted = promoteStandbyReservations(flights, 'KBDU')

    // Persist promotions
    for (const fid of promoted) {
      const f = flights.find(fl => fl.id === fid)
      if (f) {
        db.prepare(`
          UPDATE flights SET status = 'scheduled', tow_info = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify({ ...f.tow_info, isStandby: false }), fid)
      }
    }

    return {
      content: [{
        type: 'text',
        text: promoted.length > 0
          ? `Promoted ${promoted.length} standby reservation(s): ${promoted.join(', ')}`
          : 'No standby reservations eligible for promotion right now.',
      }],
    }
  }
)

// ============================= RESOURCES ===================================

server.resource(
  'mhg-info',
  'mhg://info',
  { description: 'Mile High Gliding business info — address, hours, contact, airport' },
  async () => ({ contents: [{ uri: 'mhg://info', text: JSON.stringify(MHG_INFO, null, 2), mimeType: 'application/json' }] })
)

server.resource(
  'mhg-packages',
  'mhg://packages',
  { description: 'Experience packages with pricing' },
  async () => ({ contents: [{ uri: 'mhg://packages', text: JSON.stringify(EXPERIENCE_PACKAGES, null, 2), mimeType: 'application/json' }] })
)

server.resource(
  'mhg-restrictions',
  'mhg://restrictions',
  { description: 'Passenger restrictions (weight, age, height)' },
  async () => ({ contents: [{ uri: 'mhg://restrictions', text: JSON.stringify(RESTRICTIONS, null, 2), mimeType: 'application/json' }] })
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Mile High Gliding MCP server running on stdio')
}

main().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
