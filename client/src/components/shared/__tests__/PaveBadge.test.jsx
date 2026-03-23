import { render, screen } from '@testing-library/react'
import { PaveBadge } from '../PaveBadge'

describe('PaveBadge', () => {
  test.each(['P', 'A', 'V', 'E'])('renders bracket letter [%s]', (key) => {
    render(<PaveBadge dimension={key} score={20} />)
    expect(screen.getByText(`[${key}]`)).toBeInTheDocument()
  })

  test('does not show level label by default', () => {
    render(<PaveBadge dimension="P" score={20} />)
    expect(screen.queryByText('LOW')).not.toBeInTheDocument()
  })

  test('showLabel=true appends level text', () => {
    render(<PaveBadge dimension="P" score={20} showLabel />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  test('score 0 renders green color class', () => {
    const { container } = render(<PaveBadge dimension="P" score={0} />)
    expect(container.firstChild.className).toMatch('green')
  })

  test('score 85 renders purple color class', () => {
    const { container } = render(<PaveBadge dimension="V" score={85} />)
    expect(container.firstChild.className).toMatch('purple')
  })

  test('has aria-label containing dimension full name and score', () => {
    render(<PaveBadge dimension="V" score={76} />)
    const el = document.querySelector('[aria-label]')
    expect(el.getAttribute('aria-label')).toMatch(/enVironment/)
    expect(el.getAttribute('aria-label')).toMatch(/76/)
  })

  test('has title attribute with dimension info', () => {
    render(<PaveBadge dimension="A" score={30} />)
    const el = document.querySelector('[title]')
    expect(el.getAttribute('title')).toMatch(/Aircraft/)
    expect(el.getAttribute('title')).toMatch(/30/)
  })
})
