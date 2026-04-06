import { Router } from 'express'
import crypto from 'crypto'
import { getDb, parseJsonFields, stringifyJsonFields } from '../db/index.js'

export const flightsRouter = Router()

const JSON_FIELDS = ['waypoints', 'passengers', 'risk_snapshot', 'tow_info', 'terrain_profile', 'metadata', 'maneuvers_covered']

function deserialize(row) {
  if (!row) return row
  const parsed = parseJsonFields(row, ...JSON_FIELDS)
  const extra = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {}
  return {
    ...parsed,
    ...extra,
    tailNumber:          parsed.tail_number,
    aircraftType:        parsed.aircraft_type,
    plannedDepartureUtc: parsed.planned_departure_utc,
    plannedArrivalUtc:   parsed.planned_arrival_utc,
    picId:               parsed.pic_id,
    sicId:               parsed.sic_id,
    missionType:         parsed.mission_type,
    part91Type:          parsed.part91_type,
    riskScore:           parsed.risk_score,
    riskP:               parsed.risk_p,
    riskA:               parsed.risk_a,
    riskV:               parsed.risk_v,
    riskE:               parsed.risk_e,
    riskSnapshot:        parsed.risk_snapshot,
    towInfo:             parsed.tow_info,
    terrainProfile:      parsed.terrain_profile,
    createdAt:           parsed.created_at,
    updatedAt:           parsed.updated_at,
    // IACRA logbook fields
    totalHours:          parsed.total_hours,
    picHours:            parsed.pic_hours,
    sicHours:            parsed.sic_hours,
    dualHours:           parsed.dual_hours,
    dualGivenHours:      parsed.dual_given_hours,
    soloHours:           parsed.solo_hours,
    nightHours:          parsed.night_hours,
    instrumentHours:     parsed.instrument_hours,
    instrumentActual:    !!parsed.instrument_actual,
    crossCountry:        !!parsed.cross_country,
    crossCountryHours:   parsed.cross_country_hours,
    groundHours:         parsed.ground_hours,
    categoryClass:       parsed.category_class,
    flightPurpose:       parsed.flight_purpose,
    stageName:           parsed.stage_name,
    maneuversCovered:    parsed.maneuvers_covered,
    endorsementType:     parsed.endorsement_type,
    state:               parsed.state,
  }
}

function serialize(body) {
  // Collect unknown fields into metadata (like _source, operator, _sessionLabel, _bookingId, etc.)
  const KNOWN = new Set([
    'id', 'source', 'callsign', 'tailNumber', 'tail_number', 'aircraftType', 'aircraft_type',
    'departure', 'arrival', 'airport', 'waypoints', 'plannedDepartureUtc', 'planned_departure_utc',
    'plannedArrivalUtc', 'planned_arrival_utc', 'status', 'pic', 'picId', 'pic_id', 'sic', 'sicId', 'sic_id',
    'passengers', 'missionType', 'mission_type', 'part', 'part91Type', 'part91_type',
    'riskScore', 'risk_score', 'riskP', 'risk_p', 'riskA', 'risk_a', 'riskV', 'risk_v', 'riskE', 'risk_e',
    'riskSnapshot', 'risk_snapshot', 'towInfo', 'tow_info', 'terrainProfile', 'terrain_profile', 'metadata',
    'totalHours', 'total_hours', 'picHours', 'pic_hours', 'sicHours', 'sic_hours',
    'dualHours', 'dual_hours', 'dualGivenHours', 'dual_given_hours', 'soloHours', 'solo_hours',
    'nightHours', 'night_hours', 'instrumentHours', 'instrument_hours', 'instrumentActual', 'instrument_actual',
    'crossCountry', 'cross_country', 'crossCountryHours', 'cross_country_hours', 'groundHours', 'ground_hours',
    'categoryClass', 'category_class', 'flightPurpose', 'flight_purpose', 'stageName', 'stage_name',
    'maneuversCovered', 'maneuvers_covered', 'endorsementType', 'endorsement_type', 'state',
  ])
  const extra = {}
  for (const [k, v] of Object.entries(body)) {
    if (!KNOWN.has(k) && v !== undefined) extra[k] = v
  }
  const existingMeta = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
  const mergedMeta = Object.keys(extra).length > 0 || Object.keys(existingMeta).length > 0
    ? { ...existingMeta, ...extra } : null

  return {
    id:                    body.id ?? crypto.randomUUID(),
    source:                body.source ?? 'user',
    callsign:              body.callsign ?? null,
    tail_number:           body.tailNumber ?? body.tail_number ?? null,
    aircraft_type:         body.aircraftType ?? body.aircraft_type ?? null,
    departure:             body.departure ?? null,
    arrival:               body.arrival ?? null,
    airport:               body.airport ?? null,
    waypoints:             js(body.waypoints),
    planned_departure_utc: body.plannedDepartureUtc ?? body.planned_departure_utc ?? null,
    planned_arrival_utc:   body.plannedArrivalUtc ?? body.planned_arrival_utc ?? null,
    status:                body.status ?? 'scheduled',
    pic:                   body.pic ?? null,
    pic_id:                body.picId ?? body.pic_id ?? null,
    sic:                   body.sic ?? null,
    sic_id:                body.sicId ?? body.sic_id ?? null,
    passengers:            js(body.passengers),
    mission_type:          body.missionType ?? body.mission_type ?? null,
    part:                  body.part ?? null,
    part91_type:           body.part91Type ?? body.part91_type ?? null,
    risk_score:            body.riskScore ?? body.risk_score ?? null,
    risk_p:                body.riskP ?? body.risk_p ?? null,
    risk_a:                body.riskA ?? body.risk_a ?? null,
    risk_v:                body.riskV ?? body.risk_v ?? null,
    risk_e:                body.riskE ?? body.risk_e ?? null,
    risk_snapshot:         js(body.riskSnapshot ?? body.risk_snapshot),
    tow_info:              js(body.towInfo ?? body.tow_info),
    terrain_profile:       js(body.terrainProfile ?? body.terrain_profile),
    metadata:              js(mergedMeta),
    // IACRA logbook fields
    total_hours:           body.totalHours ?? body.total_hours ?? null,
    pic_hours:             body.picHours ?? body.pic_hours ?? null,
    sic_hours:             body.sicHours ?? body.sic_hours ?? null,
    dual_hours:            body.dualHours ?? body.dual_hours ?? null,
    dual_given_hours:      body.dualGivenHours ?? body.dual_given_hours ?? null,
    solo_hours:            body.soloHours ?? body.solo_hours ?? null,
    night_hours:           body.nightHours ?? body.night_hours ?? null,
    instrument_hours:      body.instrumentHours ?? body.instrument_hours ?? null,
    instrument_actual:     body.instrumentActual != null ? (body.instrumentActual ? 1 : 0) : (body.instrument_actual ?? null),
    cross_country:         body.crossCountry != null ? (body.crossCountry ? 1 : 0) : (body.cross_country ?? null),
    cross_country_hours:   body.crossCountryHours ?? body.cross_country_hours ?? null,
    ground_hours:          body.groundHours ?? body.ground_hours ?? null,
    category_class:        body.categoryClass ?? body.category_class ?? null,
    flight_purpose:        body.flightPurpose ?? body.flight_purpose ?? null,
    stage_name:            body.stageName ?? body.stage_name ?? null,
    maneuvers_covered:     js(body.maneuversCovered ?? body.maneuvers_covered),
    endorsement_type:      body.endorsementType ?? body.endorsement_type ?? null,
    state:                 body.state ?? null,
  }
}

const js = (v) => v == null ? null : typeof v === 'string' ? v : JSON.stringify(v)

// GET /api/flights — list all flights
flightsRouter.get('/', (req, res) => {
  const db = getDb()
  const { source, status, departure, airport } = req.query
  let sql = 'SELECT * FROM flights WHERE 1=1'
  const params = []
  if (source)    { sql += ' AND source = ?';    params.push(source) }
  if (status)    { sql += ' AND status = ?';    params.push(status) }
  if (departure) { sql += ' AND departure = ?'; params.push(departure) }
  if (airport)   { sql += ' AND (departure = ? OR airport = ?)'; params.push(airport, airport) }
  sql += ' ORDER BY planned_departure_utc ASC, created_at DESC'
  const rows = db.prepare(sql).all(...params)
  res.json(rows.map(deserialize))
})

// GET /api/flights/:id
flightsRouter.get('/:id', (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Flight not found' })
  res.json(deserialize(row))
})

// POST /api/flights — create
flightsRouter.post('/', (req, res) => {
  const db = getDb()
  const data = serialize(req.body)
  db.prepare(`
    INSERT INTO flights (
      id, source, callsign, tail_number, aircraft_type,
      departure, arrival, airport, waypoints, planned_departure_utc,
      planned_arrival_utc, status, pic, pic_id, sic, sic_id,
      passengers, mission_type, part, part91_type,
      risk_score, risk_p, risk_a, risk_v, risk_e,
      risk_snapshot, tow_info, terrain_profile, metadata,
      total_hours, pic_hours, sic_hours, dual_hours, dual_given_hours,
      solo_hours, night_hours, instrument_hours, instrument_actual,
      cross_country, cross_country_hours, ground_hours,
      category_class, flight_purpose, stage_name, maneuvers_covered,
      endorsement_type, state
    ) VALUES (
      @id, @source, @callsign, @tail_number, @aircraft_type,
      @departure, @arrival, @airport, @waypoints, @planned_departure_utc,
      @planned_arrival_utc, @status, @pic, @pic_id, @sic, @sic_id,
      @passengers, @mission_type, @part, @part91_type,
      @risk_score, @risk_p, @risk_a, @risk_v, @risk_e,
      @risk_snapshot, @tow_info, @terrain_profile, @metadata,
      @total_hours, @pic_hours, @sic_hours, @dual_hours, @dual_given_hours,
      @solo_hours, @night_hours, @instrument_hours, @instrument_actual,
      @cross_country, @cross_country_hours, @ground_hours,
      @category_class, @flight_purpose, @stage_name, @maneuvers_covered,
      @endorsement_type, @state
    )
  `).run(data)
  req.app.get('broadcast')('flights', 'create', data.id)
  res.status(201).json(deserialize(db.prepare('SELECT * FROM flights WHERE id = ?').get(data.id)))
})

// PATCH /api/flights/:id — update
flightsRouter.patch('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Flight not found' })

  // Merge new metadata with existing
  let existingMeta = {}
  try { existingMeta = existing.metadata ? JSON.parse(existing.metadata) : {} } catch { /* */ }
  const updates = serialize({ ...req.body, id: req.params.id, metadata: existingMeta })
  const setClauses = []
  const params = {}
  for (const [key, val] of Object.entries(updates)) {
    if (key === 'id') continue
    if (val !== undefined) {
      setClauses.push(`${key} = @${key}`)
      params[key] = val
    }
  }
  if (setClauses.length === 0) return res.json(deserialize(existing))

  setClauses.push("updated_at = datetime('now')")
  params.id = req.params.id
  db.prepare(`UPDATE flights SET ${setClauses.join(', ')} WHERE id = @id`).run(params)
  req.app.get('broadcast')('flights', 'update', req.params.id)
  res.json(deserialize(db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id)))
})

// DELETE /api/flights/:id
flightsRouter.delete('/:id', (req, res) => {
  const db = getDb()
  const result = db.prepare('DELETE FROM flights WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Flight not found' })
  req.app.get('broadcast')('flights', 'delete', req.params.id)
  res.json({ ok: true })
})
