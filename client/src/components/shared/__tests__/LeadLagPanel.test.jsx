import { render, screen } from '@testing-library/react'
import { LeadLagPanel } from '../LeadLagPanel'

const leading = [
  { label: 'Training compliance', value: 78,  unit: '%',  trend:  1, trendGood: true  },
  { label: 'Report rate',         value: 4,   unit: '',   trend: -1, trendGood: false },
]

const lagging = [
  { label: 'Accidents YTD',       value: 0,   unit: '',   trend:  0, trendGood: null  },
  { label: 'Open CAs',            value: 2,   unit: '',   trend: -1, trendGood: true  },
]

describe('LeadLagPanel', () => {
  test('renders with data-testid', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    expect(screen.getByTestId('lead-lag-panel')).toBeInTheDocument()
  })

  test('renders "Leading Indicators" heading', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    expect(screen.getByText(/Leading Indicators/i)).toBeInTheDocument()
  })

  test('renders "Lagging Indicators" heading', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    expect(screen.getByText(/Lagging Indicators/i)).toBeInTheDocument()
  })

  test('renders all leading indicator labels', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    leading.forEach((item) => expect(screen.getByText(item.label)).toBeInTheDocument())
  })

  test('renders all lagging indicator labels', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    lagging.forEach((item) => expect(screen.getByText(item.label)).toBeInTheDocument())
  })

  test('positive trend renders ▲ arrow', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    // Training compliance has trend > 0
    expect(screen.getAllByText('▲').length).toBeGreaterThanOrEqual(1)
  })

  test('negative trend renders ▼ arrow', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    expect(screen.getAllByText('▼').length).toBeGreaterThanOrEqual(1)
  })

  test('zero trend renders — dash', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  test('each row has aria-label', () => {
    render(<LeadLagPanel leading={leading} lagging={lagging} />)
    const rows = document.querySelectorAll('li[aria-label]')
    expect(rows.length).toBe(leading.length + lagging.length)
  })
})
