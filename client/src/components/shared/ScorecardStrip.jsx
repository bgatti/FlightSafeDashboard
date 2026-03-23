import { getRiskLevel } from '../../lib/riskColors'

/**
 * A single KPI scorecard tile — big number, label, trend arrow, target.
 */
export function ScorecardTile({ spi }) {
  const level = RISK_LEVELS[spi.status] ?? RISK_LEVELS.low
  const onTarget = spi.lowerIsBetter
    ? spi.actual <= spi.target
    : spi.actual >= spi.target

  return (
    <div
      className={[
        'bg-surface-card border rounded-lg p-3 flex flex-col gap-1',
        level.borderClass,
      ].join(' ')}
      data-testid={`scorecard-tile-${spi.label.replace(/\s+/g, '-').toLowerCase()}`}
      aria-label={`${spi.label}: ${spi.actual}${spi.unit}`}
    >
      <span className="text-slate-400 text-xs leading-tight">{spi.label}</span>
      <div className="flex items-end gap-1.5">
        <span className={`font-mono font-bold text-xl ${level.textClass}`}>
          {spi.actual}
        </span>
        <span className="text-slate-500 text-xs mb-0.5">{spi.unit}</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <span>Target: {spi.target}{spi.unit}</span>
        <span className={onTarget ? 'text-green-400' : 'text-red-400'}>
          {onTarget ? '✓' : '✗'}
        </span>
      </div>
    </div>
  )
}

// Need RISK_LEVELS here directly (not getRiskLevel — we have the string key)
import { RISK_LEVELS } from '../../lib/riskColors'

/**
 * Horizontal strip of SPI scorecard tiles.
 * @param {object[]} spis - Array of SPI objects from mockSpiTargets
 */
export function ScorecardStrip({ spis }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3"
      data-testid="scorecard-strip"
      aria-label="Safety Performance Indicators"
    >
      {spis.map((spi) => (
        <ScorecardTile key={spi.label} spi={spi} />
      ))}
    </div>
  )
}
