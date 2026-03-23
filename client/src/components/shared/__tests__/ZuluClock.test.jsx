import { render, screen, act } from '@testing-library/react'
import { beforeEach, afterEach } from 'vitest'
import { ZuluClock } from '../ZuluClock'

describe('ZuluClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('renders a <time> element', () => {
    render(<ZuluClock />)
    expect(document.querySelector('time')).toBeInTheDocument()
  })

  test('aria-label contains "Zulu time"', () => {
    render(<ZuluClock />)
    const el = document.querySelector('time')
    expect(el.getAttribute('aria-label')).toMatch(/Zulu time/i)
  })

  test('aria-label contains UTC', () => {
    render(<ZuluClock />)
    const el = document.querySelector('time')
    expect(el.getAttribute('aria-label')).toMatch(/UTC/)
  })

  test('displays "Z" suffix', () => {
    render(<ZuluClock />)
    expect(screen.getByText('Z')).toBeInTheDocument()
  })

  test('does not show LCL by default', () => {
    render(<ZuluClock />)
    expect(screen.queryByText(/LCL/)).not.toBeInTheDocument()
  })

  test('showLocal=true renders LCL suffix', () => {
    render(<ZuluClock showLocal />)
    expect(screen.getByText(/LCL/)).toBeInTheDocument()
  })

  test('clock updates after 1 second', () => {
    // Pin time to a known value
    const fixedDate = new Date('2026-03-21T12:00:00Z')
    vi.setSystemTime(fixedDate)

    render(<ZuluClock />)
    const before = document.querySelector('time').getAttribute('dateTime')

    act(() => {
      vi.advanceTimersByTime(1100)
    })

    const after = document.querySelector('time').getAttribute('dateTime')
    expect(after).not.toBe(before)
  })

  test('displayed time matches HH:mm:ss UTC format', () => {
    vi.setSystemTime(new Date('2026-03-21T14:30:45Z'))
    render(<ZuluClock />)
    expect(screen.getByText('14:30:45')).toBeInTheDocument()
  })
})
