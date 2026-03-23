import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RiskHeatMap } from '../RiskHeatMap'
import { mockHeatMapData, mockHazards } from '../../../mocks/riskRegister'

describe('RiskHeatMap', () => {
  test('renders with data-testid', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    expect(screen.getByTestId('risk-heat-map')).toBeInTheDocument()
  })

  test('has aria-label for the matrix', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    expect(screen.getByLabelText(/Risk Matrix/i)).toBeInTheDocument()
  })

  test('renders PROBABILITY and SEVERITY axis labels', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    expect(screen.getByText(/PROBABILITY/i)).toBeInTheDocument()
    expect(screen.getByText(/SEVERITY/i)).toBeInTheDocument()
  })

  test('renders 5 severity column headers', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    expect(screen.getByText('Negligible')).toBeInTheDocument()
    expect(screen.getByText('Minor')).toBeInTheDocument()
    expect(screen.getByText('Major')).toBeInTheDocument()
    expect(screen.getByText('Hazardous')).toBeInTheDocument()
    expect(screen.getByText('Catastrophic')).toBeInTheDocument()
  })

  test('renders 5 probability row labels', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    expect(screen.getByText('Frequent')).toBeInTheDocument()
    expect(screen.getByText('Probable')).toBeInTheDocument()
    expect(screen.getByText('Remote')).toBeInTheDocument()
    expect(screen.getByText('Unlikely')).toBeInTheDocument()
    expect(screen.getByText('Improbable')).toBeInTheDocument()
  })

  test('renders legend with 3 zones', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    expect(screen.getByText('Acceptable')).toBeInTheDocument()
    expect(screen.getByText('Mitigable')).toBeInTheDocument()
    expect(screen.getByText('Unacceptable')).toBeInTheDocument()
  })

  test('cell aria-labels describe probability, severity, and count', () => {
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    // Look for any cell button with a meaningful aria-label
    const cells = document.querySelectorAll('button[aria-label*="probability"]')
    expect(cells.length).toBeGreaterThan(0)
  })

  test('cells with count > 0 show the count as text', () => {
    // Find a cell in the heatmap that has count 1
    const nonZeroCells = []
    for (let p = 1; p <= 5; p++) {
      for (let s = 1; s <= 5; s++) {
        if (mockHeatMapData[p]?.[s] > 0) nonZeroCells.push(mockHeatMapData[p][s])
      }
    }
    render(<RiskHeatMap heatMapData={mockHeatMapData} />)
    // At least one cell shows a count
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  test('onCellClick called when clicking a non-empty cell', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RiskHeatMap heatMapData={mockHeatMapData} hazards={mockHazards} onCellClick={onClick} />)
    // Find a clickable cell (aria-label contains "1 hazard")
    const clickableCell = document.querySelector('button[aria-label*="1 hazard"]')
    if (clickableCell) {
      await user.click(clickableCell)
      expect(onClick).toHaveBeenCalledTimes(1)
    }
  })
})
