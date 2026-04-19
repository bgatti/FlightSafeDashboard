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
  // Backfill icao_hex from mock data for any existing aircraft missing it
  const backfill = db.prepare("UPDATE aircraft SET icao_hex = ? WHERE id = ? AND icao_hex IS NULL")
  for (const a of mockAircraft) {
    if (a.icaoHex) backfill.run(a.icaoHex, a.id)
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
