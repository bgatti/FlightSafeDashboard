/**
 * Service request store — tracks FBO service requests for client aircraft.
 * Persisted to localStorage, displayed in Clients and FBO modules.
 *
 * Schema mirrors FBO mockServiceOrders for cross-module compatibility.
 */

const STORAGE_KEY = 'flightsafe_service_requests'
const EVENT       = 'flightsafe:service_requests'

function getUserRequests() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function getServiceRequests() { return getUserRequests() }

export function addServiceRequest(req) {
  const all = getUserRequests()
  all.unshift(req)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function updateServiceRequest(id, updates) {
  const all = getUserRequests()
  const idx = all.findIndex((r) => r.id === id)
  if (idx < 0) return
  all[idx] = { ...all[idx], ...updates }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeServiceRequests(fn) {
  const handler = () => fn(getUserRequests())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
