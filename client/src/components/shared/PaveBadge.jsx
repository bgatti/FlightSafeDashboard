import { getRiskLevel, PAVE_DIMENSIONS } from '../../lib/riskColors'

/**
 * Displays a single PAVE dimension letter with its risk score.
 * Always shows the bracket-letter plus a title/aria-label — never color-only (WCAG AA).
 *
 * @param {'P'|'A'|'V'|'E'} dimension
 * @param {number} score - Risk score 0–100
 * @param {boolean} [showLabel=false] - If true, appends the level text (LOW/MED/HIGH/CRITICAL)
 */
export function PaveBadge({ dimension, score, showLabel = false }) {
  const level = getRiskLevel(score)
  const dim = PAVE_DIMENSIONS.find((d) => d.key === dimension)

  return (
    <span
      className={[
        'inline-flex items-center gap-0.5 font-mono text-xs font-bold',
        'rounded px-1.5 py-0.5 border',
        level.bgClass,
        level.textClass,
        level.borderClass,
      ].join(' ')}
      title={`${dim.fullLabel}: score ${score} — ${level.label}`}
      aria-label={`${dim.fullLabel} risk: ${level.label}, score ${score}`}
    >
      <span>[{dimension}]</span>
      {showLabel && (
        <span className="ml-1 font-normal">{level.label}</span>
      )}
    </span>
  )
}
