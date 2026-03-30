import { NavLink } from 'react-router-dom'
import { useUiStore } from '../../stores/uiStore'

const NAV_ITEMS = [
  { to: '/',            label: 'SMS Overview',      icon: '🏠' },
  { to: '/plan',        label: 'Flight Planning',   icon: '🛫' },
  { to: '/flights',     label: 'Flights',           icon: '🗺️' },
  { divider: true },
  { to: '/personnel',   label: 'Personnel',         icon: '👥' },
  { to: '/aircraft',    label: 'Aircraft Registry', icon: '✈️' },
  { to: '/maintenance', label: 'Maintenance',        icon: '🔧' },
  { to: '/fbo',         label: 'FBO Operations',     icon: '⛽' },
  { to: '/pos',         label: 'Point of Sale',      icon: '🧾' },
  { to: '/business',    label: 'Business P&L',       icon: '📊' },
  { to: '/leases',      label: 'Leases',              icon: '📄' },
  { to: '/training',   label: 'Pilot Training',      icon: '🎓' },
  { to: '/management',  label: 'Management',         icon: '📋' },
  { to: '/sim',         label: 'Simulation',         icon: '🎮' },
  { to: '/comms',       label: 'Safety Comms',       icon: '📡' },
  { divider: true },
  { to: '/compliance',  label: 'Compliance Center', icon: '📁' },
  { to: '/reports',     label: 'Pilot Reports',     icon: '📝' },
]

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Org */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-surface-border">
        {sidebarOpen && (
          <span className="text-sky-400 font-bold text-sm tracking-wide">
            FlightSafe SMS
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="text-slate-400 hover:text-slate-100 p-1 rounded transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '«' : '»'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2" aria-label="Main navigation">
        {NAV_ITEMS.map((item, i) => {
          if (item.divider) {
            return sidebarOpen
              ? <div key={`div-${i}`} className="my-1 border-t border-surface-border" />
              : <div key={`div-${i}`} className="my-1" />
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors',
                  isActive
                    ? 'bg-sky-400/10 text-sky-400 border-l-2 border-sky-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-l-2 border-transparent',
                ].join(' ')
              }
              aria-current={undefined}
            >
              <span className="flex-shrink-0 text-base" aria-hidden="true">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="px-2 pb-4 border-t border-surface-border pt-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              'flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors',
              isActive
                ? 'bg-sky-400/10 text-sky-400 border-l-2 border-sky-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-l-2 border-transparent',
            ].join(' ')
          }
        >
          <span className="flex-shrink-0 text-base" aria-hidden="true">⚙️</span>
          {sidebarOpen && <span>Settings</span>}
        </NavLink>
      </div>
    </div>
  )
}
