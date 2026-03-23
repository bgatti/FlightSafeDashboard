import { render, screen } from '@testing-library/react'
import { KpiTrendChart } from '../KpiTrendChart'
import { mockKpiTimeSeries } from '../../../mocks/riskRegister'

// Recharts uses SVG — mock ResizeObserver for jsdom
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe('KpiTrendChart', () => {
  test('renders with data-testid', () => {
    render(<KpiTrendChart kpiData={mockKpiTimeSeries.incidentRate} />)
    expect(screen.getByTestId('kpi-trend-chart')).toBeInTheDocument()
  })

  test('renders KPI label', () => {
    render(<KpiTrendChart kpiData={mockKpiTimeSeries.incidentRate} />)
    expect(screen.getByText(mockKpiTimeSeries.incidentRate.label)).toBeInTheDocument()
  })

  test('renders "vs same period last year" subtitle', () => {
    render(<KpiTrendChart kpiData={mockKpiTimeSeries.incidentRate} />)
    expect(screen.getByText(/vs same period last year/i)).toBeInTheDocument()
  })

  test('renders the latest value as the big number', () => {
    const data = mockKpiTimeSeries.incidentRate
    const latest = data.thisYear[data.thisYear.length - 1].toString()
    render(<KpiTrendChart kpiData={data} />)
    expect(screen.getByText(latest)).toBeInTheDocument()
  })

  test('renders YoY delta with arrow', () => {
    render(<KpiTrendChart kpiData={mockKpiTimeSeries.trainingCompliance} />)
    // Should have up or down arrow
    const delta = document.querySelector('[aria-label*="Year-over-year"]')
    expect(delta).toBeInTheDocument()
  })

  test('renders null without crashing when kpiData is null', () => {
    const { container } = render(<KpiTrendChart kpiData={null} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders training compliance chart', () => {
    render(<KpiTrendChart kpiData={mockKpiTimeSeries.trainingCompliance} />)
    expect(screen.getByText(mockKpiTimeSeries.trainingCompliance.label)).toBeInTheDocument()
  })

  test('accepts optional className prop', () => {
    const { container } = render(
      <KpiTrendChart kpiData={mockKpiTimeSeries.disclosureRate} className="my-custom-class" />
    )
    expect(container.firstChild.className).toMatch(/my-custom-class/)
  })
})
