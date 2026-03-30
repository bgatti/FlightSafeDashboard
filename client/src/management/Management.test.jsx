// =============================================================================
// Management Module — Tests: ML model math + UI rendering
// =============================================================================
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Management } from './Management'
import {
  MODEL, predict, encodeFeatures, generateTrainingData,
  DOW_PARTIAL, MONTH_PARTIAL, hourlyProfile, FEATURE_NAMES,
  predictGroupDemand,
} from './demandModel'
import { WEATHER_FORECAST, SCHEDULE, SHIFT_DEFS, shiftCapacity } from './mockManagement'

function Wrap({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

// ── demandModel — training data ───────────────────────────────────────────────

describe('demandModel — training data', () => {
  const data = generateTrainingData(365)

  it('generates 365 rows', () => {
    expect(data).toHaveLength(365)
  })

  it('all ops values are non-negative integers', () => {
    data.forEach(r => {
      expect(r.ops).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(r.ops)).toBe(true)
    })
  })

  it('all weather scores are in [0.1, 1.0]', () => {
    data.forEach(r => {
      expect(r.weatherScore).toBeGreaterThanOrEqual(0.1)
      expect(r.weatherScore).toBeLessThanOrEqual(1.0)
    })
  })
})

// ── demandModel — OLS model ───────────────────────────────────────────────────

describe('demandModel — OLS model', () => {
  it('returns beta array of length 8', () => {
    expect(MODEL.beta).toHaveLength(FEATURE_NAMES.length)
  })

  it('R² is above 0.65 (cyclical features explain majority of variance)', () => {
    expect(MODEL.r2).toBeGreaterThan(0.65)
  })

  it('RMSE is below 5 ops', () => {
    expect(MODEL.rmse).toBeLessThan(5)
  })

  it('weather coefficient is positive', () => {
    const idx = FEATURE_NAMES.indexOf('Weather Score')
    expect(MODEL.beta[idx]).toBeGreaterThan(0)
  })

  it('has residual sample for scatter plot', () => {
    expect(MODEL.residualSample.length).toBeGreaterThan(10)
    MODEL.residualSample.forEach(r => {
      expect(r.actual).toBeGreaterThanOrEqual(0)
      expect(r.fitted).toBeGreaterThanOrEqual(0)
    })
  })
})

// ── demandModel — encodeFeatures ─────────────────────────────────────────────

describe('demandModel — encodeFeatures', () => {
  it('returns array of length 8', () => {
    expect(encodeFeatures(new Date('2026-04-06'), 0.9)).toHaveLength(8)
  })

  it('first element is 1 (intercept)', () => {
    expect(encodeFeatures(new Date('2026-04-06'), 0.9)[0]).toBe(1)
  })

  it('weekend flag is 1 for Sunday', () => {
    const sun = new Date('2026-04-05')  // Sunday
    expect(encodeFeatures(sun, 0.9)[5]).toBe(1)
  })

  it('friday flag is 1 for Friday', () => {
    const fri = new Date('2026-04-03T12:00:00')  // Friday (noon avoids UTC-offset day shift)
    expect(encodeFeatures(fri, 0.9)[6]).toBe(1)
  })
})

// ── demandModel — predict ─────────────────────────────────────────────────────

describe('demandModel — predict', () => {
  it('returns mean/low/high all non-negative', () => {
    const r = predict(new Date('2026-04-06'), 0.95)
    expect(r.mean).toBeGreaterThanOrEqual(0)
    expect(r.low).toBeGreaterThanOrEqual(0)
    expect(r.high).toBeGreaterThanOrEqual(r.mean)
  })

  it('VFR predicts more ops than IFR (same weekday)', () => {
    const d = new Date('2026-04-06')
    expect(predict(d, 0.95).mean).toBeGreaterThan(predict(d, 0.35).mean)
  })

  it('Friday predicts more ops than Monday (same weather)', () => {
    const fri = predict(new Date('2026-04-03T12:00:00'), 0.95)
    const mon = predict(new Date('2026-03-30T12:00:00'), 0.95)
    expect(fri.mean).toBeGreaterThan(mon.mean)
  })
})

// ── demandModel — partial effects ─────────────────────────────────────────────

describe('demandModel — partial effects', () => {
  it('DOW_PARTIAL has 7 entries', () => {
    expect(DOW_PARTIAL).toHaveLength(7)
  })

  it('MONTH_PARTIAL has 12 entries', () => {
    expect(MONTH_PARTIAL).toHaveLength(12)
  })

  it('summer months predict more ops than winter', () => {
    const jul = MONTH_PARTIAL.find(m => m.month === 'Jul')
    const jan = MONTH_PARTIAL.find(m => m.month === 'Jan')
    expect(jul.predicted).toBeGreaterThan(jan.predicted)
  })
})

// ── demandModel — hourlyProfile ───────────────────────────────────────────────

describe('demandModel — hourlyProfile', () => {
  it('returns 24-element array', () => {
    expect(hourlyProfile(new Date('2026-04-06'), 20, 0.95)).toHaveLength(24)
  })

  it('overnight hours (1–5) are near zero', () => {
    const p = hourlyProfile(new Date('2026-04-06'), 20, 0.95)
    for (let h = 1; h <= 5; h++) expect(p[h]).toBeLessThanOrEqual(1)
  })
})

// ── mockManagement ────────────────────────────────────────────────────────────

describe('mockManagement', () => {
  it('WEATHER_FORECAST has 14 days', () => {
    expect(WEATHER_FORECAST).toHaveLength(14)
  })

  it('all weather categories are valid', () => {
    const valid = new Set(['VFR', 'MVFR', 'IFR', 'LIFR'])
    WEATHER_FORECAST.forEach(w => expect(valid.has(w.category)).toBe(true))
  })

  it('SCHEDULE has 16 employees', () => {
    expect(SCHEDULE).toHaveLength(16)
  })

  it('each employee has exactly 14 shifts', () => {
    SCHEDULE.forEach(p => expect(p.shifts).toHaveLength(14))
  })

  it('all shifts are valid codes', () => {
    const valid = new Set(Object.keys(SHIFT_DEFS))
    SCHEDULE.forEach(p => p.shifts.forEach(s => expect(valid.has(s)).toBe(true)))
  })

  it('shiftCapacity: Off=0, Standby=0.5, active=1', () => {
    expect(shiftCapacity('O')).toBe(0)
    expect(shiftCapacity('S')).toBe(0.5)
    expect(shiftCapacity('D')).toBe(1)
    expect(shiftCapacity('M')).toBe(1)
    expect(shiftCapacity('A')).toBe(1)
  })
})

// ── predictGroupDemand ────────────────────────────────────────────────────────

describe('predictGroupDemand', () => {
  const date = new Date('2026-04-06T12:00:00')  // Monday VFR

  it('returns all four group keys', () => {
    const r = predictGroupDemand(date, 0.95, 20)
    expect(r).toHaveProperty('flightOps')
    expect(r).toHaveProperty('operations')
    expect(r).toHaveProperty('maintenance')
    expect(r).toHaveProperty('fbo')
  })

  it('flightOps: crewHrs scales with ops', () => {
    const lo = predictGroupDemand(date, 0.95, 10).flightOps
    const hi = predictGroupDemand(date, 0.95, 30).flightOps
    expect(hi.crewHrs).toBeGreaterThan(lo.crewHrs)
  })

  it('maintenance: IFR adds weather hours', () => {
    const vfr = predictGroupDemand(date, 0.95, 20).maintenance
    const ifr = predictGroupDemand(date, 0.30, 20).maintenance
    expect(ifr.weather).toBeGreaterThan(vfr.weather)
    expect(ifr.total).toBeGreaterThan(vfr.total)
  })

  it('operations: safety activates on IFR', () => {
    const vfr = predictGroupDemand(date, 0.95, 18).operations
    const ifr = predictGroupDemand(date, 0.30, 18).operations
    expect(ifr.safetyActivated).toBe(true)
    expect(vfr.safetyActivated).toBe(false)
  })

  it('operations: safety activates on high ops (≥23)', () => {
    const busy = predictGroupDemand(date, 0.95, 25).operations
    expect(busy.safetyActivated).toBe(true)
  })

  it('fbo: jetAGal and avgasGal are positive', () => {
    const r = predictGroupDemand(date, 0.95, 20).fbo
    expect(r.jetAGal).toBeGreaterThan(0)
    expect(r.avgasGal).toBeGreaterThan(0)
    expect(r.serviceEvents).toBeGreaterThan(0)
  })

  it('fbo: arrivals are ~half of ops', () => {
    const r = predictGroupDemand(date, 0.95, 20).fbo
    expect(r.arrivals).toBe(10)
  })
})

// ── Management page ───────────────────────────────────────────────────────────

describe('Management page', () => {
  it('renders heading', () => {
    render(<Wrap><Management /></Wrap>)
    expect(screen.getByText('Operations Management')).toBeInTheDocument()
  })

  it('all eight tabs are present', () => {
    render(<Wrap><Management /></Wrap>)
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Demand Forecast' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Weather Outlook' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ML Model' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Flight Ops' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Operations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Maintenance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'FBO' })).toBeInTheDocument()
  })

  it('schedule tab shows employee names', () => {
    render(<Wrap><Management /></Wrap>)
    expect(screen.getByText('James Smith')).toBeInTheDocument()
    expect(screen.getByText('Rosa Mendez')).toBeInTheDocument()
  })

  it('switches to Demand Forecast tab', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Demand Forecast' }))
    expect(screen.getByText(/Predicted Daily Operations/i)).toBeInTheDocument()
  })

  it('switches to Weather Outlook tab', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Weather Outlook' }))
    expect(screen.getByText(/Weather Score vs Predicted/i)).toBeInTheDocument()
  })

  it('switches to ML Model tab', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'ML Model' }))
    expect(screen.getByText(/Model Architecture/i)).toBeInTheDocument()
  })

  it('Flight Ops tab shows crew-hours chart section', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Flight Ops' }))
    expect(screen.getAllByText(/Crew-Hours/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Carlos Rivera/i).length).toBeGreaterThan(0)
  })

  it('Operations tab shows coverage chart section', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getAllByText(/Coverage-Hours/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Alex Torres/i).length).toBeGreaterThan(0)
  })

  it('Maintenance tab shows stacked shop-hours chart', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Maintenance' }))
    expect(screen.getAllByText(/Shop-Hours Demand/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/T\. Huang/i).length).toBeGreaterThan(0)
  })

  it('FBO tab shows service events and fuel volume', async () => {
    const user = userEvent.setup()
    render(<Wrap><Management /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'FBO' }))
    expect(screen.getAllByText(/Service Events vs/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Devon Park/i).length).toBeGreaterThan(0)
  })
})
