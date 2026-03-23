import { render, screen } from '@testing-library/react'
import { RiskBadge } from '../RiskBadge'

describe('RiskBadge', () => {
  test.each([
    [0,   'LOW'],
    [39,  'LOW'],
    [40,  'MED'],
    [69,  'MED'],
    [70,  'HIGH'],
    [84,  'HIGH'],
    [85,  'CRITICAL'],
    [100, 'CRITICAL'],
  ])('score %i renders level label %s', (score, expectedLabel) => {
    render(<RiskBadge score={score} />)
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  test('renders the score number', () => {
    render(<RiskBadge score={55} />)
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  test('has an aria-label containing score and level', () => {
    render(<RiskBadge score={72} />)
    const el = document.querySelector('[aria-label]')
    expect(el).toBeTruthy()
    expect(el.getAttribute('aria-label')).toMatch(/72/)
    expect(el.getAttribute('aria-label')).toMatch(/HIGH/)
  })

  test('default size is md', () => {
    const { container } = render(<RiskBadge score={10} />)
    expect(container.firstChild.className).toMatch(/px-2/)
  })

  test('sm size applies smaller padding', () => {
    const { container } = render(<RiskBadge score={10} size="sm" />)
    expect(container.firstChild.className).toMatch(/px-1\.5/)
  })

  test('lg size applies larger padding', () => {
    const { container } = render(<RiskBadge score={10} size="lg" />)
    expect(container.firstChild.className).toMatch(/px-3/)
  })

  test.each([
    [0,  'green'],
    [40, 'amber'],
    [70, 'red'],
    [85, 'purple'],
  ])('score %i has correct color class (%s)', (score, colorWord) => {
    const { container } = render(<RiskBadge score={score} />)
    expect(container.firstChild.className).toMatch(colorWord)
  })
})
