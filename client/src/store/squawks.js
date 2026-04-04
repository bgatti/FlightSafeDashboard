/**
 * Unified squawk store — merges maintenance/mockDb.js seed data with
 * user-added squawks from localStorage into a single global list.
 *
 * Schema (matches maintenance/mockDb.js):
 *   id, tailNumber, reportedBy, reportedDate, description,
 *   severity (grounding | ops_limiting | deferred | monitoring),
 *   status (open | in_progress | deferred_mel | closed),
 *   melReference, melExpiryDate, airframeHours,
 *   resolvedDate, resolvedBy, resolutionNotes, workOrderId
 *
 * Extra field for cross-referencing:
 *   aircraftId — links to mockAircraft[].id (optional, not in legacy data)
 */

import { mockSquawks as seedSquawks } from '../maintenance/mockDb'

const STORAGE_KEY = 'flightsafe_squawks'
const EVENT       = 'flightsafe:squawks'

function getUserSquawks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

/** Returns all squawks: seed + user-added, deduplicated by id */
export function getSquawks() {
  const user = getUserSquawks()
  const userIds = new Set(user.map((s) => s.id))
  // User squawks first (newest), then seed squawks not overridden
  return [...user, ...seedSquawks.filter((s) => !userIds.has(s.id))]
}

export function addSquawk(sqk) {
  const user = getUserSquawks()
  user.unshift(sqk)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function resolveSquawk(id, resolvedBy, resolutionNotes) {
  // If it's a seed squawk, copy it into user store with resolved status
  const all  = getSquawks()
  const sqk  = all.find((s) => s.id === id)
  if (!sqk) return
  const resolved = {
    ...sqk,
    status:          'closed',
    resolvedDate:    new Date().toISOString().split('T')[0],
    resolvedBy:      resolvedBy ?? null,
    resolutionNotes: resolutionNotes ?? null,
  }
  const user = getUserSquawks().filter((s) => s.id !== id)
  user.unshift(resolved)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  window.dispatchEvent(new CustomEvent(EVENT))
}

/**
 * True if mock data says unairworthy OR an unresolved grounding squawk exists.
 * Works with both aircraftId and tailNumber for cross-module compatibility.
 */
export function isAircraftGrounded(aircraftId, mockAircraft, squawks) {
  const ac = mockAircraft?.find((a) => a.id === aircraftId)
  if (ac && !ac.airworthy) return true
  return squawks.some((s) =>
    (s.aircraftId === aircraftId || s.tailNumber === ac?.tailNumber) &&
    s.severity === 'grounding' &&
    s.status !== 'closed'
  )
}

export function subscribeSquawks(fn) {
  const handler = () => fn(getSquawks())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
