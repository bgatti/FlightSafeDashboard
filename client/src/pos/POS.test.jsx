import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { buildLineItems, buildBills, POS } from './POS'

// ── Shared test fixtures ──────────────────────────────────────────────────────

const AC_BARON = {
  tail: 'N12345', makeModel: 'Beechcraft Baron 58',
  fuelType: 'avgas_100ll', turboprop: false, fboCategory: 'piston_twin',
  state: 'being_serviced',
  serviceActive: 'fueling', servicesNeeded: ['fueling', 'tie_down'], servicesDone: [],
  fuelGal: 60, readyAtMs: null, parkedAtMs: null, serviceStartMs: null,
}

const AC_CARAVAN = {
  tail: 'N55555', makeModel: 'Cessna Grand Caravan',
  fuelType: 'jet_a', turboprop: true, fboCategory: 'turboprop_single',
  state: 'ready',
  serviceActive: null, servicesNeeded: ['fueling', 'tie_down'], servicesDone: ['fueling', 'tie_down'],
  fuelGal: 90, readyAtMs: 1743170400000, parkedAtMs: null, serviceStartMs: null,
}

const AC_CITATION = {
  tail: 'N88801', makeModel: 'Cessna Citation CJ2+',
  fuelType: 'jet_a', turboprop: false, fboCategory: 'jet_light',
  state: 'taxiing_out',
  serviceActive: null, servicesNeeded: ['fueling', 'gpu', 'catering', 'hangaring'], servicesDone: ['fueling', 'gpu', 'catering', 'hangaring'],
  fuelGal: 150, readyAtMs: 1743170200000, parkedAtMs: null, serviceStartMs: null,
}

const AC_INBOUND = {
  tail: 'N99001', makeModel: 'Piper Seneca V',
  fuelType: 'avgas_100ll', turboprop: false, fboCategory: 'piston_twin',
  state: 'approach',
  serviceActive: null, servicesNeeded: ['fueling'], servicesDone: [],
  fuelGal: 50, readyAtMs: null, parkedAtMs: null, serviceStartMs: null,
}

const AC_CREW_CAR = {
  tail: 'N77701', makeModel: 'King Air B200',
  fuelType: 'jet_a', turboprop: true, fboCategory: 'turboprop_twin',
  state: 'parked',
  serviceActive: null, servicesNeeded: ['fueling', 'crew_car'], servicesDone: ['fueling', 'crew_car'],
  fuelGal: 120, readyAtMs: null, parkedAtMs: null, serviceStartMs: null,
}

function makeSim(aircraft) {
  return { type: 'SIM_STATE', running: true, simTimeMs: 1743170400000, aircraft, resources: [], staff: [] }
}

vi.mock('../hooks/useSimBroadcast', () => ({
  useSimBroadcast: vi.fn(() => null),
}))

// ── buildLineItems — unit tests ───────────────────────────────────────────────

describe('buildLineItems — fueling', () => {
  test('Avgas: correct rate and amount', () => {
    const items = buildLineItems(AC_BARON)
    const fuel = items.find(l => l.key === 'fueling')
    expect(fuel).toBeTruthy()
    expect(fuel.label).toBe('Avgas 100LL')
    expect(fuel.detail).toContain('60 gal')
    expect(fuel.detail).toContain('$7.50')
    expect(fuel.amount).toBeCloseTo(450.00)
  })

  test('Jet-A: correct rate and amount', () => {
    const items = buildLineItems(AC_CARAVAN)
    const fuel = items.find(l => l.key === 'fueling')
    expect(fuel.label).toBe('Jet-A')
    expect(fuel.amount).toBeCloseTo(90 * 5.80)
  })

  test('marks active service as inProgress', () => {
    const items = buildLineItems(AC_BARON)
    const fuel = items.find(l => l.key === 'fueling')
    expect(fuel.inProgress).toBe(true)
  })

  test('completed service is not inProgress', () => {
    const items = buildLineItems(AC_CARAVAN)
    const fuel = items.find(l => l.key === 'fueling')
    expect(fuel.inProgress).toBe(false)
  })

  test('zero fuelGal when field missing', () => {
    const ac = { ...AC_BARON, fuelGal: undefined }
    const items = buildLineItems(ac)
    const fuel = items.find(l => l.key === 'fueling')
    expect(fuel.amount).toBe(0)
  })
})

describe('buildLineItems — ramp fee', () => {
  test('ramp fee applied when below waiver threshold', () => {
    // piston_twin: waived with ≥30 gal avgas; Baron buys 60 gal → waived
    const items = buildLineItems({ ...AC_BARON, fuelGal: 10 })
    const ramp = items.find(l => l.key === 'ramp_fee')
    expect(ramp.amount).toBe(35)   // piston_twin ramp fee
    expect(ramp.waived).toBeFalsy()
  })

  test('ramp fee waived when fuel purchase meets threshold', () => {
    const items = buildLineItems(AC_BARON)  // 60 gal ≥ 30 gal threshold
    const ramp = items.find(l => l.key === 'ramp_fee')
    expect(ramp.amount).toBe(0)
    expect(ramp.waived).toBe(true)
  })

  test('turboprop_single ramp fee is $75', () => {
    const items = buildLineItems({ ...AC_CARAVAN, fuelGal: 10 })  // below 50 gal threshold
    const ramp = items.find(l => l.key === 'ramp_fee')
    expect(ramp.amount).toBe(75)
  })

  test('ramp fee omitted when hangaring', () => {
    const items = buildLineItems(AC_CITATION)
    expect(items.find(l => l.key === 'ramp_fee')).toBeUndefined()
  })
})

describe('buildLineItems — other services', () => {
  test('tie_down is $10', () => {
    const items = buildLineItems(AC_CARAVAN)
    expect(items.find(l => l.key === 'tie_down')?.amount).toBe(10)
  })

  test('gpu is $50', () => {
    const items = buildLineItems(AC_CITATION)
    expect(items.find(l => l.key === 'gpu')?.amount).toBe(50)
  })

  test('catering is $25', () => {
    const items = buildLineItems(AC_CITATION)
    expect(items.find(l => l.key === 'catering')?.amount).toBe(25)
  })

  test('hangaring uses fee schedule by category (jet_light = $175)', () => {
    const items = buildLineItems(AC_CITATION)
    expect(items.find(l => l.key === 'hangaring')?.amount).toBe(175)
  })

  test('crew_car is $0 with ≥50 gal fuel', () => {
    const items = buildLineItems(AC_CREW_CAR)   // 120 gal ≥ 50
    const cc = items.find(l => l.key === 'crew_car')
    expect(cc.amount).toBe(0)
    expect(cc.detail).toContain('Complimentary')
  })

  test('crew_car $0 regardless (no charge for day use either)', () => {
    const ac = { ...AC_CREW_CAR, fuelGal: 0 }
    const items = buildLineItems(ac)
    const cc = items.find(l => l.key === 'crew_car')
    expect(cc.amount).toBe(0)
  })
})

// ── buildBills — sort order ────────────────────────────────────────────────────

describe('buildBills — sorting and filtering', () => {
  const simState = makeSim([AC_BARON, AC_CARAVAN, AC_CITATION, AC_INBOUND])

  test('taxiing_out ranks first', () => {
    const bills = buildBills(simState)
    expect(bills[0].tail).toBe('N88801')   // taxiing_out
  })

  test('ready ranks before being_serviced', () => {
    const bills = buildBills(simState)
    const states = bills.map(b => b.state)
    expect(states.indexOf('ready')).toBeLessThan(states.indexOf('being_serviced'))
  })

  test('inbound (approach) ranks last', () => {
    const bills = buildBills(simState)
    expect(bills[bills.length - 1].state).toBe('approach')
  })

  test('excludes departed aircraft', () => {
    const sim = makeSim([{ ...AC_CARAVAN, state: 'departed' }, AC_BARON])
    const bills = buildBills(sim)
    expect(bills.every(b => b.state !== 'departed')).toBe(true)
    expect(bills.length).toBe(1)
  })

  test('returns empty array for null simState', () => {
    expect(buildBills(null)).toEqual([])
  })

  test('returns empty array when no aircraft', () => {
    expect(buildBills({ aircraft: [] })).toEqual([])
  })

  test('each bill has id, tail, total, lineItems', () => {
    const bills = buildBills(simState)
    for (const b of bills) {
      expect(b.id).toBe(b.tail)
      expect(typeof b.total).toBe('number')
      expect(Array.isArray(b.lineItems)).toBe(true)
    }
  })

  test('totals equal sum of line item amounts', () => {
    const bills = buildBills(simState)
    for (const b of bills) {
      const sum = b.lineItems.reduce((s, l) => s + l.amount, 0)
      expect(b.total).toBeCloseTo(sum)
    }
  })
})

// ── POS component — rendering ──────────────────────────────────────────────────

import { useSimBroadcast } from '../hooks/useSimBroadcast'

describe('<POS /> — empty state', () => {
  test('shows prompt when sim not running', () => {
    useSimBroadcast.mockReturnValue(null)
    render(<POS />)
    expect(screen.getByText(/no active session/i)).toBeTruthy()
  })
})

describe('<POS /> — live sim', () => {
  beforeEach(() => {
    useSimBroadcast.mockReturnValue(makeSim([AC_BARON, AC_CARAVAN, AC_CITATION]))
  })

  test('renders a bill card for each non-departed aircraft', () => {
    render(<POS />)
    expect(screen.getByText('N12345')).toBeTruthy()
    expect(screen.getByText('N55555')).toBeTruthy()
    expect(screen.getByText('N88801')).toBeTruthy()
  })

  test('shows aircraft count in header', () => {
    render(<POS />)
    expect(screen.getByText(/3 aircraft on ramp/i)).toBeTruthy()
  })

  test('Departing badge shown for taxiing_out aircraft', () => {
    render(<POS />)
    expect(screen.getByText('Departing')).toBeTruthy()
  })

  test('Ready badge shown for ready aircraft', () => {
    render(<POS />)
    expect(screen.getByText('Ready')).toBeTruthy()
  })

  test('Checkout button present for each unpaid bill', () => {
    render(<POS />)
    const btns = screen.getAllByRole('button', { name: /checkout/i })
    expect(btns.length).toBe(3)
  })
})

describe('<POS /> — search', () => {
  beforeEach(() => {
    useSimBroadcast.mockReturnValue(makeSim([AC_BARON, AC_CARAVAN, AC_CITATION]))
  })

  test('search by tail filters bills', () => {
    render(<POS />)
    const input = screen.getByPlaceholderText(/search tail/i)
    fireEvent.change(input, { target: { value: 'N12345' } })
    expect(screen.getByText('N12345')).toBeTruthy()
    expect(screen.queryByText('N55555')).toBeNull()
  })

  test('search by model filters bills', () => {
    render(<POS />)
    const input = screen.getByPlaceholderText(/search tail/i)
    fireEvent.change(input, { target: { value: 'Citation' } })
    expect(screen.getByText('N88801')).toBeTruthy()
    expect(screen.queryByText('N12345')).toBeNull()
  })

  test('no-match shows empty message', () => {
    render(<POS />)
    fireEvent.change(screen.getByPlaceholderText(/search tail/i), { target: { value: 'ZZZZZZ' } })
    expect(screen.getByText(/no aircraft match/i)).toBeTruthy()
  })
})

describe('<POS /> — expand line items', () => {
  beforeEach(() => {
    useSimBroadcast.mockReturnValue(makeSim([AC_BARON]))
  })

  test('line items hidden by default', () => {
    render(<POS />)
    expect(screen.queryByText('Avgas 100LL')).toBeNull()
  })

  test('expand toggle shows line items', () => {
    render(<POS />)
    const toggle = screen.getByRole('button', { name: '▼' })
    fireEvent.click(toggle)
    // AC_BARON has fueling active + ramp fee (waived); tie_down is pending so not yet billed
    expect(screen.getByText('Avgas 100LL')).toBeTruthy()
    expect(screen.getByText('Ramp Fee')).toBeTruthy()
  })

  test('collapse hides line items again', () => {
    render(<POS />)
    const toggle = screen.getByRole('button', { name: '▼' })
    fireEvent.click(toggle)
    expect(screen.getByText('Avgas 100LL')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '▲' }))
    expect(screen.queryByText('Avgas 100LL')).toBeNull()
  })
})

describe('<POS /> — checkout modal', () => {
  beforeEach(() => {
    useSimBroadcast.mockReturnValue(makeSim([AC_CARAVAN]))
  })

  test('checkout modal opens on button click', () => {
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(screen.getByText(/name on card/i)).toBeTruthy()
    expect(screen.getByText(/card number/i)).toBeTruthy()
  })

  test('Pay button disabled until form is complete', () => {
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    const payBtn = screen.getByRole('button', { name: /pay \$/i })
    expect(payBtn).toBeDisabled()
  })

  test('Pay button enabled when all fields filled', () => {
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    fireEvent.change(screen.getByPlaceholderText('J. Smith'), { target: { value: 'T. Morrison' } })
    fireEvent.change(screen.getByPlaceholderText('0000 0000 0000 0000'), { target: { value: '4111 1111 1111 1111' } })
    fireEvent.change(screen.getByPlaceholderText('MM/YY'), { target: { value: '12/27' } })
    fireEvent.change(screen.getByPlaceholderText('•••'), { target: { value: '123' } })
    expect(screen.getByRole('button', { name: /pay \$/i })).not.toBeDisabled()
  })

  test('VISA detected from card number starting with 4', () => {
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    fireEvent.change(screen.getByPlaceholderText('0000 0000 0000 0000'), { target: { value: '4111111111111111' } })
    expect(screen.getByText('VISA')).toBeTruthy()
  })

  test('shows APPROVED after payment', async () => {
    vi.useFakeTimers()
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    fireEvent.change(screen.getByPlaceholderText('J. Smith'), { target: { value: 'J. Smith' } })
    fireEvent.change(screen.getByPlaceholderText('0000 0000 0000 0000'), { target: { value: '5500 0000 0000 0004' } })
    fireEvent.change(screen.getByPlaceholderText('MM/YY'), { target: { value: '09/28' } })
    fireEvent.change(screen.getByPlaceholderText('•••'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /pay \$/i }))
    await act(async () => { vi.advanceTimersByTime(1600) })
    expect(screen.getByText('APPROVED')).toBeTruthy()
    vi.useRealTimers()
  })

  test('modal closes when backdrop is clicked', () => {
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    expect(screen.getByText(/name on card/i)).toBeTruthy()
    // Click the backdrop (the outer fixed overlay)
    const backdrop = document.querySelector('.fixed.inset-0')
    fireEvent.click(backdrop)
    expect(screen.queryByText(/name on card/i)).toBeNull()
  })

  test('bill marked PAID after approval', async () => {
    vi.useFakeTimers()
    render(<POS />)
    fireEvent.click(screen.getByRole('button', { name: /checkout/i }))
    fireEvent.change(screen.getByPlaceholderText('J. Smith'), { target: { value: 'A. Pilot' } })
    fireEvent.change(screen.getByPlaceholderText('0000 0000 0000 0000'), { target: { value: '4111 1111 1111 1111' } })
    fireEvent.change(screen.getByPlaceholderText('MM/YY'), { target: { value: '06/29' } })
    fireEvent.change(screen.getByPlaceholderText('•••'), { target: { value: '321' } })
    fireEvent.click(screen.getByRole('button', { name: /pay \$/i }))
    await act(async () => { vi.advanceTimersByTime(1600) })
    expect(screen.getByText('APPROVED')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.getByText('PAID')).toBeTruthy()
    vi.useRealTimers()
  })
})
