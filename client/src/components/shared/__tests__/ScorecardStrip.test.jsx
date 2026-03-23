import { render, screen } from '@testing-library/react'
import { ScorecardStrip, ScorecardTile } from '../ScorecardStrip'
import { mockSpiTargets } from '../../../mocks/riskRegister'

describe('ScorecardTile', () => {
  const spi = mockSpiTargets[0] // Accident Rate: actual=0, target=0, status=low

  test('renders the spi label', () => {
    render(<ScorecardTile spi={spi} />)
    expect(screen.getByText(spi.label)).toBeInTheDocument()
  })

  test('renders the actual value', () => {
    render(<ScorecardTile spi={spi} />)
    expect(screen.getByText(String(spi.actual))).toBeInTheDocument()
  })

  test('has aria-label with label and value', () => {
    render(<ScorecardTile spi={spi} />)
    const tile = screen.getByTestId(`scorecard-tile-${spi.label.replace(/\s+/g, '-').toLowerCase()}`)
    expect(tile.getAttribute('aria-label')).toMatch(spi.label)
  })

  test('shows target value', () => {
    render(<ScorecardTile spi={spi} />)
    expect(screen.getByText(/Target/)).toBeInTheDocument()
  })

  test('shows green checkmark when on target', () => {
    const onTargetSpi = { ...spi, actual: 0, target: 0, lowerIsBetter: true }
    render(<ScorecardTile spi={onTargetSpi} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  test('shows red X when off target', () => {
    const offTargetSpi = { ...spi, actual: 2, target: 0, lowerIsBetter: true }
    render(<ScorecardTile spi={offTargetSpi} />)
    expect(screen.getByText('✗')).toBeInTheDocument()
  })
})

describe('ScorecardStrip', () => {
  test('renders a tile for each SPI', () => {
    render(<ScorecardStrip spis={mockSpiTargets} />)
    expect(screen.getByTestId('scorecard-strip')).toBeInTheDocument()
    expect(screen.getAllByRole('generic').length).toBeGreaterThanOrEqual(mockSpiTargets.length)
  })

  test('has aria-label', () => {
    render(<ScorecardStrip spis={mockSpiTargets} />)
    expect(screen.getByLabelText(/Safety Performance Indicators/i)).toBeInTheDocument()
  })

  test('renders all SPI labels from mock data', () => {
    render(<ScorecardStrip spis={mockSpiTargets} />)
    for (const spi of mockSpiTargets) {
      expect(screen.getByText(spi.label)).toBeInTheDocument()
    }
  })
})
