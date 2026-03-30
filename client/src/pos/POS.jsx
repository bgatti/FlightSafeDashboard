// =============================================================================
// Point of Sale — FBO Aircraft Billing
// Bills derived from live sim state; sorted by urgency to depart.
// =============================================================================

import { useState, useMemo } from 'react'
import { useSimBroadcast } from '../hooks/useSimBroadcast'
import { calcFuelFee, fuelFeePerGal } from '../fbo/fboUtils'
import { FEE_SCHEDULE } from '../fbo/mockDb'

// ── Pricing helpers ────────────────────────────────────────────────────────────

function getRampFee(fboCategory) {
  return FEE_SCHEDULE.find(f => f.serviceType === 'ramp_fee' && f.category === fboCategory)?.feePerUnit ?? 0
}

function getRampWaiverGal(fboCategory) {
  const notes = FEE_SCHEDULE.find(f => f.serviceType === 'ramp_fee' && f.category === fboCategory)?.notes ?? ''
  return parseInt(notes.match(/≥\s*(\d+)\s*gal/)?.[1] ?? '0')
}

function getHangarFee(fboCategory) {
  return FEE_SCHEDULE.find(f => f.serviceType === 'hangar_fee' && f.category === fboCategory)?.feePerUnit ?? 0
}

const SVC_LABEL = {
  fueling: 'Fuel', tie_down: 'Tie-Down', cleaning: 'Interior Detail',
  gpu: 'Ground Power (GPU)', catering: 'Catering Coordination',
  crew_car: 'Crew Car', hangaring: 'Hangar',
}

export function buildLineItems(ac) {
  const allSvcs = [...(ac.servicesDone ?? []), ...(ac.serviceActive ? [ac.serviceActive] : [])]
  const fuelGal  = ac.fuelGal ?? 0
  const hasFuel  = allSvcs.includes('fueling')
  const items    = []

  for (const svc of allSvcs) {
    const inProgress = ac.serviceActive === svc

    if (svc === 'fueling') {
      const rate = fuelFeePerGal(ac.fuelType)
      items.push({
        key: 'fueling', label: ac.fuelType === 'jet_a' ? 'Jet-A' : 'Avgas 100LL',
        detail: `${fuelGal} gal × $${rate.toFixed(2)}`,
        amount: calcFuelFee(ac.fuelType, fuelGal), inProgress,
      })
      continue
    }

    if (svc === 'hangaring') {
      items.push({
        key: 'hangaring', label: 'Hangar', detail: '1 night',
        amount: getHangarFee(ac.fboCategory), inProgress,
      })
      continue
    }

    if (svc === 'gpu') {
      items.push({ key: 'gpu', label: 'Ground Power (GPU)', detail: '1 hr est.', amount: 50, inProgress })
      continue
    }

    if (svc === 'crew_car') {
      const waived = hasFuel && fuelGal >= 50
      items.push({
        key: 'crew_car', label: 'Crew Car',
        detail: waived ? 'Complimentary w/ fuel' : 'Day use',
        amount: 0, inProgress,
      })
      continue
    }

    if (svc === 'tie_down') { items.push({ key: svc, label: 'Tie-Down',             detail: '1 day', amount: 10,  inProgress }); continue }
    if (svc === 'cleaning')  { items.push({ key: svc, label: 'Interior Detail',      detail: null,    amount: 150, inProgress }); continue }
    if (svc === 'catering')  { items.push({ key: svc, label: 'Catering Coordination',detail: null,    amount: 25,  inProgress }); continue }
  }

  // Ramp fee (waived with sufficient fuel; not charged if hangaring)
  const hasHangar = allSvcs.includes('hangaring')
  if (!hasHangar) {
    const rampFee   = getRampFee(ac.fboCategory)
    const waiverGal = getRampWaiverGal(ac.fboCategory)
    const waived    = hasFuel && fuelGal >= waiverGal
    items.push({
      key: 'ramp_fee', label: 'Ramp Fee',
      detail: waived ? `Waived (fuel ≥${waiverGal} gal)` : '1 day',
      amount: waived ? 0 : rampFee, inProgress: false, waived,
    })
  }

  return items
}

// Sort order: most urgent to settle bill first
const DEPART_RANK = { taxiing_out: 0, ready: 1, being_serviced: 2, parked: 3, taxiing_in: 4, approach: 5 }

export function buildBills(simState) {
  if (!simState?.aircraft?.length) return []
  return simState.aircraft
    .filter(ac => ac.state !== 'departed')
    .map(ac => {
      const lineItems = buildLineItems(ac)
      const total     = lineItems.reduce((s, l) => s + l.amount, 0)
      return { id: ac.tail, tail: ac.tail, makeModel: ac.makeModel, fboCategory: ac.fboCategory, fuelType: ac.fuelType, state: ac.state, readyAtMs: ac.readyAtMs ?? null, lineItems, total }
    })
    .sort((a, b) => {
      const ra = DEPART_RANK[a.state] ?? 9
      const rb = DEPART_RANK[b.state] ?? 9
      if (ra !== rb) return ra - rb
      return (a.readyAtMs ?? Infinity) - (b.readyAtMs ?? Infinity)
    })
}

// ── Checkout modal ─────────────────────────────────────────────────────────────

const CARD_NETWORKS = { '4': 'VISA', '5': 'MC', '3': 'AMEX', '6': 'DISC' }

function cardNetwork(num) { return CARD_NETWORKS[num?.[0]] ?? null }

function fmtCardInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function fmtExpiry(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits
}

function CheckoutModal({ bill, onClose, onPaid }) {
  const [phase,      setPhase]     = useState('form')   // form | processing | approved
  const [cardNum,    setCardNum]   = useState('')
  const [expiry,     setExpiry]    = useState('')
  const [cvv,        setCvv]       = useState('')
  const [nameOnCard, setName]      = useState('')
  const [authCode,   setAuthCode]  = useState('')

  const network = cardNetwork(cardNum.replace(/\s/g, ''))
  const canPay  = cardNum.replace(/\s/g, '').length >= 15 && expiry.length === 5 && cvv.length >= 3 && nameOnCard.trim()

  function handlePay() {
    if (!canPay) return
    setPhase('processing')
    setTimeout(() => {
      setAuthCode(String(Math.floor(100000 + Math.random() * 900000)))
      setPhase('approved')
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <div className="text-sm font-bold text-slate-100">Checkout — {bill.tail}</div>
            <div className="text-xs text-slate-400">{bill.makeModel}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        {phase === 'form' && (
          <>
            {/* Bill summary */}
            <div className="px-5 py-3 space-y-1 border-b border-slate-800">
              {bill.lineItems.filter(l => l.amount > 0 || l.waived).map(l => (
                <div key={l.key} className="flex justify-between text-xs">
                  <span className={l.waived ? 'text-slate-500 line-through' : 'text-slate-300'}>
                    {l.label}{l.detail ? <span className="text-slate-500 ml-1">— {l.detail}</span> : null}
                  </span>
                  <span className={l.waived ? 'text-slate-500' : 'text-slate-200'}>
                    {l.waived ? 'WAIVED' : `$${l.amount.toFixed(2)}`}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-slate-700">
                <span className="text-sm font-bold text-slate-100">Total</span>
                <span className="text-sm font-bold text-sky-400">${bill.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Card form */}
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Name on Card</label>
                <input
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  placeholder="J. Smith"
                  value={nameOnCard}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Card Number</label>
                <div className="relative">
                  <input
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                    placeholder="0000 0000 0000 0000"
                    value={cardNum}
                    onChange={e => setCardNum(fmtCardInput(e.target.value))}
                  />
                  {network && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{network}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">Expiry</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={e => setExpiry(fmtExpiry(e.target.value))}
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-slate-500 block mb-1">CVV</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                    placeholder="•••"
                    maxLength={4}
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <button
                onClick={handlePay}
                disabled={!canPay}
                className={`w-full py-2.5 rounded font-bold text-sm transition-colors ${
                  canPay
                    ? 'bg-sky-600 hover:bg-sky-500 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Pay ${bill.total.toFixed(2)}
              </button>
            </div>
          </>
        )}

        {phase === 'processing' && (
          <div className="px-5 py-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-slate-400">Processing payment…</div>
          </div>
        )}

        {phase === 'approved' && (
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center text-3xl">✓</div>
            <div className="text-lg font-bold text-green-400">APPROVED</div>
            <div className="text-2xl font-bold text-slate-100">${bill.total.toFixed(2)}</div>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>{bill.tail} — {bill.makeModel}</div>
              <div className="font-mono text-slate-400">AUTH: {authCode}</div>
              <div>{new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</div>
            </div>
            <button
              onClick={() => { onPaid(bill.id); onClose() }}
              className="mt-2 px-6 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── State badge ────────────────────────────────────────────────────────────────

const STATE_BADGE = {
  approach:       { label: 'Inbound',   cls: 'bg-sky-500/20 text-sky-300' },
  taxiing_in:     { label: 'Taxiing In',cls: 'bg-sky-500/20 text-sky-300' },
  parked:         { label: 'On Ramp',   cls: 'bg-slate-600/50 text-slate-300' },
  being_serviced: { label: 'In Service',cls: 'bg-amber-500/20 text-amber-300' },
  ready:          { label: 'Ready',     cls: 'bg-green-500/20 text-green-300' },
  taxiing_out:    { label: 'Departing', cls: 'bg-rose-500/20 text-rose-300' },
}

// ── Main POS component ─────────────────────────────────────────────────────────

export function POS() {
  const simState = useSimBroadcast()
  const [search,     setSearch]     = useState('')
  const [paidIds,    setPaidIds]    = useState(new Set())
  const [checkout,   setCheckout]   = useState(null)   // bill object | null
  const [expanded,   setExpanded]   = useState(new Set())

  const bills = useMemo(() => buildBills(simState), [simState])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bills.filter(b =>
      !q || b.tail.toLowerCase().includes(q) || b.makeModel.toLowerCase().includes(q)
    )
  }, [bills, search])

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Point of Sale</h1>
          <p className="text-xs text-slate-500">Aircraft billing — sorted by departure urgency</p>
        </div>
        <div className="text-xs text-slate-500">
          {bills.length} aircraft on ramp
          {paidIds.size > 0 && <span className="ml-2 text-green-400">{paidIds.size} settled</span>}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
        <input
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500 placeholder-slate-600"
          placeholder="Search tail or aircraft…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {!simState?.running && (
        <div className="text-center py-16 text-slate-600">
          <div className="text-4xl mb-3">🧾</div>
          <div className="text-sm font-medium">No active session</div>
          <div className="text-xs mt-1">Start the simulation to generate live bills</div>
        </div>
      )}

      {simState?.running && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-600 text-sm">No aircraft match your search</div>
      )}

      {/* Bill list */}
      <div className="space-y-2">
        {filtered.map(bill => {
          const paid    = paidIds.has(bill.id)
          const isOpen  = expanded.has(bill.id)
          const badge   = STATE_BADGE[bill.state] ?? { label: bill.state, cls: 'bg-slate-700 text-slate-400' }
          const urgent  = bill.state === 'taxiing_out' || bill.state === 'ready'

          return (
            <div
              key={bill.id}
              className={`rounded-lg border transition-colors ${
                paid
                  ? 'border-slate-700/40 bg-slate-800/30 opacity-60'
                  : urgent
                    ? 'border-amber-600/40 bg-slate-800/80'
                    : 'border-slate-700/60 bg-slate-800/60'
              }`}
            >
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Urgency indicator */}
                <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                  paid ? 'bg-green-600/40' : urgent ? 'bg-amber-500' : 'bg-slate-600'
                }`} />

                {/* Tail + model */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-100 text-sm">{bill.tail}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>
                    {paid && <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">PAID</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{bill.makeModel}</div>
                </div>

                {/* Total */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-base font-bold ${paid ? 'text-slate-500' : 'text-slate-100'}`}>
                    ${bill.total.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-600">{bill.lineItems.length} items</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleExpand(bill.id)}
                    className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                  >
                    {isOpen ? '▲' : '▼'}
                  </button>
                  {!paid && (
                    <button
                      onClick={() => setCheckout(bill)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                        urgent
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-sky-700 hover:bg-sky-600 text-white'
                      }`}
                    >
                      Checkout
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded line items */}
              {isOpen && (
                <div className="px-4 pb-3 border-t border-slate-700/50">
                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="text-slate-600">
                        <th className="text-left font-medium pb-1">Service</th>
                        <th className="text-left font-medium pb-1 hidden sm:table-cell">Detail</th>
                        <th className="text-right font-medium pb-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {bill.lineItems.map(l => (
                        <tr key={l.key} className={l.waived ? 'text-slate-600' : 'text-slate-300'}>
                          <td className="py-1">
                            {l.label}
                            {l.inProgress && (
                              <span className="ml-1.5 text-amber-400 text-xs">● in progress</span>
                            )}
                          </td>
                          <td className="py-1 text-slate-500 hidden sm:table-cell">{l.detail ?? '—'}</td>
                          <td className="py-1 text-right font-mono">
                            {l.waived ? <span className="text-slate-600">WAIVED</span> : `$${l.amount.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-600">
                        <td colSpan={2} className="pt-2 font-bold text-slate-200">Total</td>
                        <td className="pt-2 text-right font-bold font-mono text-sky-400">${bill.total.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Checkout modal */}
      {checkout && (
        <CheckoutModal
          bill={checkout}
          onClose={() => setCheckout(null)}
          onPaid={id => setPaidIds(prev => new Set([...prev, id]))}
        />
      )}
    </div>
  )
}
