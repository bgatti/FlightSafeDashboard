/**
 * Client aircraft store — non-fleet aircraft that use this airport.
 * Shared across FBO, Glider Ops, and Maintenance.
 *
 * A "client aircraft" is any aircraft not in the operator's own fleet:
 *   - Own gliders brought for tow services
 *   - Transient aircraft for fuel, hangar, maintenance
 *   - Based tenants (hangared here, flagged as based)
 *
 * Each record is keyed by tail number (primary identifier).
 * Owner/operator contacts accumulate on the record.
 */

const STORAGE_KEY = 'flightsafe_clients'
const EVENT       = 'flightsafe:clients'

/** Seed client aircraft — always present, merged with user-added */
const SEED_CLIENTS = [
  { id: 'cli-seed-001', tailNumber: 'N412GL', ownerName: 'Weber, J.',    phone: '(303) 555-0171', email: 'jweber@example.com',  makeModel: 'Schweizer SGS 2-33A', icaoType: 'S33',  fboCategory: 'glider',        fuelType: null,          basedHere: true,  notes: 'Hangar 4 — regular weekender' },
  { id: 'cli-seed-002', tailNumber: 'N88KS',  ownerName: 'Kim, S.',      phone: '(720) 555-0234', email: 'skim@example.com',    makeModel: 'Schempp-Hirth Discus 2b', icaoType: 'DIS2', fboCategory: 'glider',   fuelType: null,          basedHere: true,  notes: 'Competition glider — handle with care' },
  { id: 'cli-seed-003', tailNumber: 'N27PG',  ownerName: 'Peters, G.',   phone: '(303) 555-0399', email: null,                  makeModel: 'Schleicher ASK 21',    icaoType: 'AS21', fboCategory: 'glider',        fuelType: null,          basedHere: false, notes: null },
  { id: 'cli-seed-004', tailNumber: 'N531TP', ownerName: 'Andrews, M.',  phone: '(720) 555-0412', email: 'mandrews@example.com', makeModel: 'Cessna 182T',         icaoType: 'C182', fboCategory: 'piston_single', fuelType: 'avgas_100ll', basedHere: true,  notes: 'Based tenant — Hangar 2' },
  { id: 'cli-seed-005', tailNumber: 'N900TX', ownerName: 'Rockwell LLC', phone: '(303) 555-0500', email: 'ops@rockwell.example', makeModel: 'Beechcraft King Air 350', icaoType: 'BE35', fboCategory: 'turboprop_twin', fuelType: 'jet_a',  basedHere: false, notes: 'Frequent transient — prefers south ramp' },
  { id: 'cli-seed-006', tailNumber: 'N77FX',  ownerName: 'Dunn, R.',     phone: null,              email: 'rdunn@example.com',   makeModel: 'Cirrus SR22',          icaoType: 'SR22', fboCategory: 'piston_single', fuelType: 'avgas_100ll', basedHere: false, notes: null },
]

function getAll() {
  let user = []
  try { user = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { /* */ }
  // Merge: user records override seed by tailNumber
  const userTails = new Set(user.map((c) => c.tailNumber))
  return [...user, ...SEED_CLIENTS.filter((s) => !userTails.has(s.tailNumber))]
}

export function getClients() { return getAll() }

/**
 * Upsert a client aircraft by tail number.
 * If the tail already exists, merge new info (contacts, etc.) without overwriting.
 *
 * @param {object} data
 * @param {string} data.tailNumber    — registration (required)
 * @param {string} [data.ownerName]   — owner / operator name
 * @param {string} [data.phone]
 * @param {string} [data.email]
 * @param {string} [data.makeModel]   — e.g. 'Schweizer SGS 2-33A'
 * @param {string} [data.icaoType]    — e.g. 'S33'
 * @param {string} [data.fboCategory] — piston_single | piston_twin | turboprop_single | turboprop_twin | jet_light | jet_midsize | jet_heavy | glider
 * @param {string} [data.fuelType]    — avgas_100ll | jet_a | mogas | null
 * @param {boolean} [data.basedHere]  — true if hangared / based at this airport
 * @param {string} [data.notes]
 */
export function upsertClient(data) {
  const tail = data.tailNumber?.trim().toUpperCase()
  if (!tail) return
  const all = getAll()
  const idx = all.findIndex((c) => c.tailNumber === tail)

  if (idx >= 0) {
    // Merge — keep existing values where new ones are undefined
    const existing = all[idx]
    all[idx] = {
      ...existing,
      ownerName:   data.ownerName   ?? existing.ownerName,
      phone:       data.phone       ?? existing.phone,
      email:       data.email       ?? existing.email,
      makeModel:   data.makeModel   ?? existing.makeModel,
      icaoType:    data.icaoType    ?? existing.icaoType,
      fboCategory: data.fboCategory ?? existing.fboCategory,
      fuelType:    data.fuelType    !== undefined ? data.fuelType : existing.fuelType,
      basedHere:   data.basedHere   !== undefined ? data.basedHere : existing.basedHere,
      notes:       data.notes       ?? existing.notes,
      lastSeen:    new Date().toISOString(),
    }
  } else {
    all.unshift({
      id:          `cli-${Date.now()}`,
      tailNumber:  tail,
      ownerName:   data.ownerName ?? null,
      phone:       data.phone ?? null,
      email:       data.email ?? null,
      makeModel:   data.makeModel ?? null,
      icaoType:    data.icaoType ?? null,
      fboCategory: data.fboCategory ?? 'glider',
      fuelType:    data.fuelType ?? null,
      basedHere:   data.basedHere ?? false,
      notes:       data.notes ?? null,
      createdAt:   new Date().toISOString(),
      lastSeen:    new Date().toISOString(),
    })
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** Look up a client by tail number */
export function findClientByTail(tailNumber) {
  return getAll().find((c) => c.tailNumber === tailNumber?.trim().toUpperCase()) ?? null
}

export function subscribeClients(fn) {
  const handler = () => fn(getAll())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
