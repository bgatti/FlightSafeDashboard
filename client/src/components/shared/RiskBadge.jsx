import { getRiskLevel } from '../../lib/riskColors'

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
}

/**
 * Displays a risk score as a colored badge with a text level label.
 * Always renders both the score and the label — never color-only (WCAG AA).
 *
 * @param {number} score - Risk score 0–100
 * @param {'sm'|'md'|'lg'} [size='md']
 */
export function RiskBadge({ score, size = 'md' }) {
  const level = getRiskLevel(score)
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded font-semibold font-mono border',
        level.bgClass,
        level.textClass,
        level.borderClass,
        sizeClasses[size],
      ].join(' ')}
      aria-label={`Risk level ${level.label}, score ${score}`}
    >
      <span aria-hidden="true">{score}</span>
      <span>{level.label}</span>
    </span>
  )
}
