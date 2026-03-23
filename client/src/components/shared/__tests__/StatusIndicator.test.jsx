import { render, screen } from '@testing-library/react'
import { StatusIndicator } from '../StatusIndicator'

describe('StatusIndicator', () => {
  test.each([
    ['low',      '✓', 'LOW'],
    ['medium',   '!', 'MED'],
    ['high',     '⚠', 'HIGH'],
    ['critical', '⛔', 'CRITICAL'],
  ])('level=%s renders icon %s and label %s', (level, icon, levelLabel) => {
    render(<StatusIndicator level={level} label="Test metric" />)
    expect(screen.getByText(icon)).toBeInTheDocument()
    expect(screen.getByText(levelLabel)).toBeInTheDocument()
  })

  test('renders the label prop text', () => {
    render(<StatusIndicator level="low" label="Audit status" />)
    expect(screen.getByText('Audit status')).toBeInTheDocument()
  })

  test('has role="status"', () => {
    render(<StatusIndicator level="low" label="Test" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  test('aria-label combines label and level', () => {
    render(<StatusIndicator level="high" label="Training compliance" />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toMatch(/Training compliance/)
    expect(el.getAttribute('aria-label')).toMatch(/HIGH/)
  })

  test('icon is aria-hidden', () => {
    const { container } = render(<StatusIndicator level="low" label="Test" />)
    const iconEl = container.querySelector('[aria-hidden="true"]')
    expect(iconEl).toBeInTheDocument()
  })

  test('sm size applies smaller text class', () => {
    const { container } = render(<StatusIndicator level="low" label="T" size="sm" />)
    // Label span should have text-xs
    const labelSpan = container.querySelectorAll('span')[2]
    expect(labelSpan.className).toMatch(/text-xs/)
  })

  test('unknown level falls back to low', () => {
    render(<StatusIndicator level="unknown" label="Fallback" />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })
})
