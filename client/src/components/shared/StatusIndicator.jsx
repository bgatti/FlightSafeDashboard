import { RISK_LEVELS } from '../../lib/riskColors'

const icons = {
  low:      '✓',
  medium:   '!',
  high:     '⚠',
  critical: '⛔',
}

/**
 * Generic RAG status indicator — dot icon + label + level text.
 * Never color-only: always shows an icon character AND the level word (WCAG AA).
 *
 * @param {'low'|'medium'|'high'|'critical'} level
 * @param {string} label - Descriptive label for what is being measured
 * @param {'sm'|'md'} [size='md']
 */
export function StatusIndicator({ level, label, size = 'md' }) {
  const cfg = RISK_LEVELS[level] ?? RISK_LEVELS.low
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const iconSize = size === 'sm' ? 'w-4 h-4 text-xs' : 'w-5 h-5 text-sm'

  return (
    <span
      className="inline-flex items-center gap-1.5"
      role="status"
      aria-label={`${label}: ${cfg.label}`}
    >
      <span
        className={[
          'rounded-full inline-flex items-center justify-center font-bold flex-shrink-0',
          iconSize,
          cfg.bgClass,
          cfg.textClass,
        ].join(' ')}
        aria-hidden="true"
      >
        {icons[level] ?? icons.low}
      </span>
      <span className={`${textSize} text-slate-300`}>{label}</span>
      <span className={`text-xs font-semibold ${cfg.textClass}`}>
        {cfg.label}
      </span>
    </span>
  )
}
