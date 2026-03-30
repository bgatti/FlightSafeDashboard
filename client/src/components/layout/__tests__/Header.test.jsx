import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Header } from '../Header'
import { useUiStore } from '../../../stores/uiStore'
import { useAuthStore } from '../../../stores/authStore'

beforeEach(() => {
  useUiStore.setState({ sidebarOpen: true })
  useAuthStore.setState({ user: { name: 'Alex Torres', role: 'dispatcher' } })
})

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  )
}

describe('Header', () => {
  test('renders the org name', () => {
    renderHeader()
    expect(screen.getByText(/Alpha Flight Ops — KBDU/)).toBeInTheDocument()
  })

  test('renders a <time> element (ZuluClock)', () => {
    renderHeader()
    expect(document.querySelector('time')).toBeInTheDocument()
  })

  test('renders user name', () => {
    renderHeader()
    expect(screen.getByText('Alex Torres')).toBeInTheDocument()
  })

  test('renders user role', () => {
    renderHeader()
    expect(screen.getByText('dispatcher')).toBeInTheDocument()
  })

  test('user badge has aria-label with name and role', () => {
    renderHeader()
    const badge = document.querySelector('[aria-label*="Alex Torres"]')
    expect(badge).toBeTruthy()
    expect(badge.getAttribute('aria-label')).toMatch(/dispatcher/)
  })

  test('hamburger button has aria-label "Toggle sidebar"', () => {
    renderHeader()
    expect(screen.getByRole('button', { name: /Toggle sidebar/i })).toBeInTheDocument()
  })

  test('clicking hamburger calls toggleSidebar', async () => {
    const user = userEvent.setup()
    renderHeader()
    const before = useUiStore.getState().sidebarOpen
    await user.click(screen.getByRole('button', { name: /Toggle sidebar/i }))
    expect(useUiStore.getState().sidebarOpen).toBe(!before)
  })

  test('alert badge appears when a pillar is high or critical status', () => {
    // mockSmsPillars has 'risk' pillar at statusLevel='high'
    renderHeader()
    // At least one alert badge should be present
    const badge = screen.queryByLabelText(/active alert/i)
    expect(badge).toBeInTheDocument()
  })

  test('safety_officer role renders purple color class', () => {
    useAuthStore.setState({ user: { name: 'Jordan Lee', role: 'safety_officer' } })
    renderHeader()
    const badge = document.querySelector('[aria-label*="Jordan Lee"]')
    expect(badge.className).toMatch(/purple/)
  })
})
