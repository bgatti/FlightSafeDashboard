import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { useUiStore } from '../../../stores/uiStore'

// Reset Zustand store before each test
beforeEach(() => {
  useUiStore.setState({ sidebarOpen: true })
})

function renderSidebar(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Sidebar />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  test('renders all 5 main navigation links with text', () => {
    renderSidebar()
    expect(screen.getByText('SMS Overview')).toBeInTheDocument()
    expect(screen.getByText('Flights')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Compliance Center')).toBeInTheDocument()
    expect(screen.getByText('Pilot Reports')).toBeInTheDocument()
  })

  test('renders Settings link', () => {
    renderSidebar()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('nav has aria-label "Main navigation"', () => {
    renderSidebar()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })

  test('active route "/" highlights SMS Overview link', () => {
    renderSidebar('/')
    const link = screen.getByText('SMS Overview').closest('a')
    expect(link.className).toMatch(/sky-400/)
  })

  test('active route "/flights" highlights Flights link', () => {
    renderSidebar('/flights')
    const link = screen.getByText('Flights').closest('a')
    expect(link.className).toMatch(/sky-400/)
  })

  test('inactive links do not have active highlight', () => {
    renderSidebar('/')
    const inactiveLink = screen.getByText('Flights').closest('a')
    expect(inactiveLink.className).not.toMatch(/sky-400/)
  })

  test('collapse button has aria-label "Collapse sidebar"', () => {
    renderSidebar()
    expect(screen.getByRole('button', { name: /Collapse sidebar/i })).toBeInTheDocument()
  })

  test('clicking collapse button toggles sidebarOpen', async () => {
    const user = userEvent.setup()
    renderSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(true)
    await user.click(screen.getByRole('button', { name: /Collapse sidebar/i }))
    expect(useUiStore.getState().sidebarOpen).toBe(false)
  })

  test('when collapsed, nav labels are hidden', () => {
    useUiStore.setState({ sidebarOpen: false })
    renderSidebar()
    expect(screen.queryByText('SMS Overview')).not.toBeInTheDocument()
  })
})
