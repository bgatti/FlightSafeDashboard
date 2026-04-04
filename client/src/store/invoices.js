/**
 * Glider operations invoice store — localStorage-backed.
 * Invoices are upserted by date + client (first listed pilot).
 */

const STORAGE_KEY = 'flightsafe_glider_invoices'
const EVENT       = 'flightsafe:invoices'

function getAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function getInvoices() { return getAll() }

export function upsertInvoice(invoice) {
  const all = getAll()
  const idx = all.findIndex((i) => i.id === invoice.id)
  if (idx >= 0) all[idx] = invoice
  else all.unshift(invoice)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** Find or create an invoice for a date + client combo */
export function findOrCreateInvoice(date, clientId, clientName, tailNumber) {
  const all = getAll()
  const existing = all.find((i) => i.date === date && i.clientId === clientId && i.status !== 'paid')
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
  }
}

/** Add a line item to an invoice (deduplicates by flightId + type) */
export function addLineItem(invoiceId, item) {
  const all = getAll()
  const inv = all.find((i) => i.id === invoiceId)
  if (!inv) return
  // Deduplicate
  const exists = inv.lineItems.some((li) => li.flightId === item.flightId && li.type === item.type)
  if (!exists) {
    inv.lineItems.push(item)
    inv.total = inv.lineItems.reduce((s, li) => s + li.amount, 0)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function markPaid(invoiceId) {
  const all = getAll()
  const inv = all.find((i) => i.id === invoiceId)
  if (!inv) return
  inv.status = 'paid'
  inv.paidAt = new Date().toISOString()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeInvoices(fn) {
  const handler = () => fn(getAll())
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
