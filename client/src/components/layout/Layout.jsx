import { useLocation } from 'react-router-dom'
import { useUiStore } from '../../stores/uiStore'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { AppRoutes } from '../../router'

/** Routes that render as full-screen portals (no sidebar / header) */
const PORTAL_ROUTES = ['/mile-high-gliding', '/journeys-boulder', '/mile-hi-skydiving']

export function Layout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const { pathname } = useLocation()
  const isPortal = PORTAL_ROUTES.some((r) => pathname.startsWith(r))

  if (isPortal) {
    return (
      <main className="h-screen overflow-auto bg-surface" id="main-content">
        <AppRoutes />
      </main>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={[
          'flex-shrink-0 transition-all duration-200',
          'bg-surface-card border-r border-surface-border',
          sidebarOpen ? 'w-60' : 'w-16',
        ].join(' ')}
        aria-label="Sidebar"
      >
        <Sidebar />
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 flex-shrink-0 bg-surface-card border-b border-surface-border flex items-center px-4">
          <Header />
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-auto p-6 bg-surface"
          id="main-content"
        >
          <AppRoutes />
        </main>
      </div>
    </div>
  )
}
