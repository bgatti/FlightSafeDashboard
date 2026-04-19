// FlightSafe Database — SQLite via better-sqlite3
// Initializes on first call to getDb(). Schema DDL is idempotent (CREATE IF NOT EXISTS).
// Seeds data on first run when aircraft table is empty.

import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { seed } from './seed.js'
import { mockAircraft } from '../../client/src/mocks/aircraft.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'flightsafe.db')

let db

export function getDb() {
  if (db) return db

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema DDL (idempotent — all CREATE IF NOT EXISTS)
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  db.exec(schema)

  // Migrations — add columns that may not exist in older databases
  const cols = db.prepare("PRAGMA table_info(aircraft)").all().map((c) => c.name)
  if (!cols.includes('icao_hex')) {
    db.exec("ALTER TABLE aircraft ADD COLUMN icao_hex TEXT")
  }

  // Re-sync aircraft table from mock data — ensures real tails replace fictitious ones.
  // Checks if the fleet has changed by comparing a known tail; if stale, wipes and re-seeds.
  const probe = db.prepare("SELECT tail_number FROM aircraft WHERE id = 'ssb-001'").get()
  if (!probe || probe.tail_number !== 'N4593Y') {
    console.log('Fleet data stale — re-seeding aircraft table...')
    db.exec("DELETE FROM aircraft")
    const js = (v) => v == null ? null : JSON.stringify(v)
    const bool = (v) => v ? 1 : 0
    const ins = db.prepare(`INSERT INTO aircraft (
      id, operator, tail_number, make_model, icao_type, icao_hex, passenger_capacity,
      op_cost_per_hour, fuel_capacity_gal, fuel_burn_gal_hr, empty_weight_lbs,
      max_gross_weight_lbs, cruise_speed_kts, service_ceiling, year, serial_number,
      airworthy, inspection_status, total_airframe_hours, last_annual_date,
      next_annual_due, last_100hr_date, next_100hr_due, last_flight_date,
      assigned_base, current_location, fuel_type, fbo_category,
      equipment, risk_profile, weight_balance
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    const tx = db.transaction(() => {
      for (const a of mockAircraft) {
        ins.run(
          a.id, a.operator ?? null, a.tailNumber, a.makeModel, a.icaoType, a.icaoHex ?? null, a.passengerCapacity ?? null,
          a.opCostPerHour ?? null, a.fuelCapacityGal ?? null, a.fuelBurnGalHr ?? null, a.emptyWeightLbs ?? null,
          a.maxGrossWeightLbs ?? null, a.cruiseSpeedKts ?? null, a.serviceCeiling ?? null, a.year ?? null, a.serialNumber ?? null,
          bool(a.airworthy), a.inspectionStatus ?? 'current', a.totalAirframeHours ?? null, a.lastAnnualDate ?? null,
          a.nextAnnualDue ?? null, a.last100hrDate ?? null, a.next100hrDue ?? null, a.lastFlightDate ?? null,
          a.assignedBase ?? null, a.currentLocation ?? 'ramp', a.fuelType ?? null, a.fboCategory ?? null,
          js(a.equipment), js(a.riskProfile), js(a.weightBalance)
        )
      }
    })
    tx()
    console.log(`Aircraft table re-seeded: ${mockAircraft.length} aircraft.`)
  }

  // Seed if the database is fresh (no aircraft rows)
  const { n } = db.prepare('SELECT COUNT(*) as n FROM aircraft').get()
  if (n === 0) {
    console.log('Seeding database...')
    seed(db)
    console.log('Database seeded.')
  }

  return db
}

/** Helper: parse JSON columns on a row, returning null for missing/invalid JSON */
export function parseJsonFields(row, ...fields) {
  if (!row) return row
  const out = { ...row }
  for (const f of fields) {
    if (out[f] && typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f]) } catch { /* leave as string */ }
    }
  }
  return out
}

/** Helper: stringify JSON fields for insertion */
export function stringifyJsonFields(obj, ...fields) {
  const out = { ...obj }
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null && typeof out[f] !== 'string') {
      out[f] = JSON.stringify(out[f])
    }
  }
  return out
}
