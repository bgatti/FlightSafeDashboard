import { NavLink } from 'react-router-dom'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore, MAINTENANCE_PERSONNEL } from '../../stores/authStore'

const NAV_ITEMS = [
  { to: '/',            label: 'SMS Overview',      icon: '🏠' },
  { to: '/plan',        label: 'Flight Planning',   icon: '🛫' },
  { to: '/flights',     label: 'Flights',           icon: '🗺️' },
  { divider: true },
  { to: '/maintenance', label: 'Maintenance',        icon: '🔧' },
  { to: '/fbo',         label: 'FBO Operations',     icon: '⛽' },
  { to: '/pos',         label: 'Point of Sale',      icon: '🧾' },
  { to: '/business',    label: 'Business P&L',       icon: '📊' },
  { to: '/leases',      label: 'Leases',              icon: '📄' },
  { to: '/training',    label: 'Pilot Training',     icon: '🎓' },
  { to: '/glider-ops', label: 'Glider Ops',          icon: '🪂' },
  { to: '/mile-high-gliding', label: 'Mile High Gliding', icon: '🏔️' },
  { to: '/journeys-boulder', label: 'Journeys Aviation', icon: '🛩️' },
  { to: '/management',  label: 'Management',         icon: '📋' },
  { to: '/sim',         label: 'Simulation',         icon: '🎮' },
  { divider: true },
  { to: '/reports',     label: 'Pilot Reports',     icon: '📝' },
]

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const loginAs = useAuthStore((s) => s.loginAs)
  const logout = useAuthStore((s) => s.logout)

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

      {/* Persona Switcher */}
      <div className="px-2 py-3 border-b border-surface-border">
        {sidebarOpen ? (
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide px-1">Logged in as</div>
            <div className="bg-surface-card border border-surface-border rounded-lg p-2">
              <div className="text-xs text-slate-200 font-semibold">{user.name}</div>
              <div className="text-[10px] text-slate-400 capitalize">
                {user.role}
                {user.certType && <span className="text-sky-400 ml-1">({user.certType})</span>}
              </div>
              {user.canReturnToService && (
                <div className="text-[10px] text-green-400 mt-0.5">IA — can sign RTS</div>
              )}
            </div>
            <select
              value={user.personnelId ?? ''}
              onChange={(e) => {
                if (e.target.value === '') logout()
                else loginAs(e.target.value)
              }}
              className="w-full text-xs bg-surface-card border border-surface-border text-slate-300 rounded px-2 py-1.5"
              aria-label="Switch persona"
            >
              <option value="">Alex Torres (Dispatcher)</option>
              <optgroup label="Maintenance Personnel">
                {MAINTENANCE_PERSONNEL.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.roleLabel}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span
              className="text-base cursor-help"
              title={`${user.name} (${user.role})`}
              aria-label={`Logged in as ${user.name}`}
            >
              {user.role === 'maintenance' ? '🔧' : '👤'}
            </span>
          </div>
        )}
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
