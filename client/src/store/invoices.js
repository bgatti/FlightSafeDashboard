/**
 * Glider operations invoice store — API-backed with sync cache.
 * Same interface as the original localStorage store.
 */

import { apiClient } from '../lib/apiClient'

const EVENT = 'flightsafe:invoices'

let _cache = null
let _loading = false

async function refresh() {
  if (_loading) return
  _loading = true
  try {
    const { data } = await apiClient.get('/invoices')
    _cache = data
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch (e) {
    console.warn('invoices.refresh failed:', e.message)
  } finally {
    _loading = false
  }
}

refresh()
setInterval(refresh, 15_000)

function getAll() {
  if (!_cache) refresh()
  return _cache ?? []
}

export function getInvoices() { return getAll() }

export function upsertInvoice(invoice) {
  // Optimistic
  if (_cache) {
    const idx = _cache.findIndex((i) => i.id === invoice.id)
    if (idx >= 0) _cache[idx] = invoice
    else _cache.unshift(invoice)
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  if (invoice._new) {
    const { _new, ...data } = invoice
    apiClient.post('/invoices', data).then(refresh).catch((e) => console.warn('upsertInvoice failed:', e.message))
  } else {
    apiClient.patch(`/invoices/${invoice.id}`, invoice).then(refresh).catch((e) => console.warn('upsertInvoice failed:', e.message))
  }
}

export function findOrCreateInvoice(date, clientId, clientName, tailNumber) {
  const all = getAll()
  const existing = all.find((i) => i.date === date && (i.clientId ?? i.client_id) === clientId && i.status !== 'paid')
  if (existing) return existing
  return {
    id:         `inv-${Date.now()}`,
    date,
    tailNumber,
    client:     clientName,
    clientId,
    status:     'open',
    lineItems:  [],
    total:      0,
    _new:       true,
  }
}

export function addLineItem(invoiceId, item) {
  if (_cache) {
    const inv = _cache.find((i) => i.id === invoiceId)
    if (inv) {
      const items = inv.lineItems ?? inv.line_items ?? []
      const exists = items.some((li) => li.flightId === item.flightId && li.type === item.type)
      if (!exists) {
        items.push(item)
        inv.lineItems = items
        inv.line_items = items
        inv.total = items.reduce((s, li) => s + (li.amount ?? 0), 0)
      }
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.post(`/invoices/${invoiceId}/line-items`, item).then(refresh).catch((e) => console.warn('addLineItem failed:', e.message))
}

export function markPaid(invoiceId) {
  if (_cache) {
    const inv = _cache.find((i) => i.id === invoiceId)
    if (inv) { inv.status = 'paid'; inv.paidAt = new Date().toISOString() }
  }
  window.dispatchEvent(new CustomEvent(EVENT))
  apiClient.patch(`/invoices/${invoiceId}/pay`).then(refresh).catch((e) => console.warn('markPaid failed:', e.message))
}

export function subscribeInvoices(fn) {
  const handler = () => fn(getAll())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
