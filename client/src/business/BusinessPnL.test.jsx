import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BusinessPnL } from './BusinessPnL'
import { mockMonthly, mockKpiSeries, SKU_LIST, BU_LIST, MONTHS, SEASONAL_IDX } from './mockBusiness'

function Wrap({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('mockBusiness', () => {
  it('generates 15 months of data', () => {
    expect(mockMonthly).toHaveLength(15)
    expect(MONTHS[0]).toBe('2025-01')
    expect(MONTHS[14]).toBe('2026-03')
  })

  it('all monthly revenue is positive', () => {
    mockMonthly.forEach(m => {
      expect(m.totalRevenue).toBeGreaterThan(0)
      expect(m.totalCogs).toBeGreaterThan(0)
      expect(m.grossProfit).toBeGreaterThan(0)
    })
  })

  it('summer months have higher revenue than winter', () => {
    const jul = mockMonthly.find(m => m.month === '2025-07')
    const jan = mockMonthly.find(m => m.month === '2025-01')
    expect(jul.totalRevenue).toBeGreaterThan(jan.totalRevenue)
  })

  it('gross margin percent is between 20% and 60%', () => {
    mockMonthly.forEach(m => {
      expect(m.grossMarginPct).toBeGreaterThan(20)
      expect(m.grossMarginPct).toBeLessThan(60)
    })
  })

  it('SKU_LIST has 10 items with top 8 having highest revenue', () => {
    expect(SKU_LIST).toHaveLength(10)
    const m = mockMonthly[6]  // July 2025
    const sorted = SKU_LIST.map(s => ({ id: s.id, rev: m.skus[s.id]?.revenue ?? 0 }))
      .sort((a, b) => b.rev - a.rev)
    // top 8 SKUs by design should dominate
    const top8Rev = sorted.slice(0, 8).reduce((s, r) => s + r.rev, 0)
    const total   = sorted.reduce((s, r) => s + r.rev, 0)
    expect(top8Rev / total).toBeGreaterThan(0.9)
  })

  it('seasonal index for July is the highest', () => {
    const vals = Object.entries(SEASONAL_IDX)
    const max = vals.reduce((best, [mm, v]) => v > best[1] ? [mm, v] : best, ['01', 0])
    expect(max[0]).toBe('07')
  })

  it('mockKpiSeries has matching length and positive values', () => {
    expect(mockKpiSeries).toHaveLength(15)
    mockKpiSeries.forEach(k => {
      expect(k.visits).toBeGreaterThan(0)
      expect(k.avgTicket).toBeGreaterThan(0)
      expect(k.rampUtilPct).toBeGreaterThan(0)
    })
  })
})

describe('BusinessPnL page', () => {
  it('renders heading and KPI strip', () => {
    render(<Wrap><BusinessPnL /></Wrap>)
    expect(screen.getByText('Business P&L')).toBeInTheDocument()
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Gross Profit/i).length).toBeGreaterThan(0)
  })

  it('period buttons are present', () => {
    render(<Wrap><BusinessPnL /></Wrap>)
    expect(screen.getByRole('button', { name: 'MTD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'QTD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'YTD' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'T12M' })).toBeInTheDocument()
  })

  it('switches to Revenue by SKU tab', async () => {
    const user = userEvent.setup()
    render(<Wrap><BusinessPnL /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Revenue by SKU' }))
    expect(screen.getByRole('button', { name: /Top 8/i })).toBeInTheDocument()
  })

  it('switches to KPIs tab', async () => {
    const user = userEvent.setup()
    render(<Wrap><BusinessPnL /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'KPIs' }))
    expect(screen.getByText(/Revenue per Visit/i)).toBeInTheDocument()
    expect(screen.getByText(/Gross Margin/i)).toBeInTheDocument()
  })

  it('switches to Forecast tab', async () => {
    const user = userEvent.setup()
    render(<Wrap><BusinessPnL /></Wrap>)
    await user.click(screen.getByRole('button', { name: 'Forecast' }))
    expect(screen.getAllByText(/Forecast/i).length).toBeGreaterThan(1)
    expect(screen.getByText(/Seasonal Index/i)).toBeInTheDocument()
  })

  it('shows all four BU names in overview P&L table', () => {
    render(<Wrap><BusinessPnL /></Wrap>)
    expect(screen.getByText('Fuel Sales')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Ground Services')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
  })
})
