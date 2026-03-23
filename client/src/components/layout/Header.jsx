import { ZuluClock } from '../shared/ZuluClock'
import { useUiStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { mockSmsPillars } from '../../mocks/smsOverview'

const ROLE_COLORS = {
  dispatcher:     'bg-sky-400/20 text-sky-400',
  safety_officer: 'bg-purple-400/20 text-purple-400',
  pilot:          'bg-green-400/20 text-green-400',
  admin:          'bg-amber-400/20 text-amber-400',
}

function AlertBadge() {
  const alertCount = mockSmsPillars.filter(
    (p) => p.statusLevel === 'high' || p.statusLevel === 'critical'
  ).length

  if (alertCount === 0) return null

  return (
    <span
      className="inline-flex items-center gap-1 bg-red-400/20 text-red-400 border border-red-400 rounded px-2 py-0.5 text-xs font-semibold"
      aria-label={`${alertCount} active alert${alertCount > 1 ? 's' : ''}`}
    >
      <span aria-hidden="true">⚠</span>
      <span>{alertCount}</span>
    </span>
  )
}

export function Header() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const roleClass = ROLE_COLORS[user.role] ?? ROLE_COLORS.dispatcher

  return (
    <div className="flex items-center gap-4 w-full">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="text-slate-400 hover:text-slate-100 p-1 rounded transition-colors flex-shrink-0"
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* Org name */}
      <span className="text-slate-100 font-semibold text-sm truncate">
        Alpha Flight Ops — KDFW
      </span>

      <div className="flex items-center gap-4 ml-auto flex-shrink-0">
        <ZuluClock showLocal />
        <AlertBadge />
        {/* User role badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold border ${roleClass} border-current`}
          aria-label={`Signed in as ${user.name}, role: ${user.role}`}
        >
          <span>{user.name}</span>
          <span className="opacity-60">·</span>
          <span className="capitalize">{user.role.replace('_', ' ')}</span>
        </span>
      </div>
    </div>
  )
}
