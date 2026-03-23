import { SEVERITY_LABELS, PROBABILITY_LABELS } from '../../mocks/riskRegister'

// Cell color by risk zone
function cellColor(p, s) {
  const idx = p * s
  if (p === 0 || s === 0) return 'bg-transparent'
  if (idx >= 12) return 'bg-red-500/80'
  if (idx >= 5)  return 'bg-amber-400/70'
  return 'bg-green-500/60'
}

function cellTextColor(p, s) {
  const idx = p * s
  if (p === 0 || s === 0) return ''
  if (idx >= 12) return 'text-red-100'
  if (idx >= 5)  return 'text-amber-950'
  return 'text-green-950'
}

/**
 * ICAO 5×5 risk matrix heat map.
 * Displays hazard counts in each probability × severity cell.
 *
 * @param {number[][]} heatMapData - 6×6 array (1-indexed), heatMapData[prob][sev] = count
 * @param {object[]} [hazards] - Optional list for click interaction
 * @param {function} [onCellClick] - Called with (probability, severity) on cell click
 */
export function RiskHeatMap({ heatMapData, hazards = [], onCellClick }) {
  return (
    <div
      className="bg-surface-card border border-surface-border rounded-lg p-4"
      data-testid="risk-heat-map"
      aria-label="ICAO 5×5 Risk Matrix"
    >
      <div className="flex items-start gap-4">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center pt-6 pb-0" style={{ width: 20 }}>
          <span
            className="text-slate-400 text-xs tracking-widest"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            PROBABILITY →
          </span>
        </div>

        <div className="flex-1">
          {/* Grid — probability rows 5 (top=frequent) → 1 (bottom=improbable) */}
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `80px repeat(5, 1fr)` }}>

            {/* Header row — severity labels */}
            <div className="col-span-1" />
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className="text-center text-xs text-slate-500 pb-1 leading-tight"
                style={{ fontSize: '10px' }}
              >
                {SEVERITY_LABELS[s]}
              </div>
            ))}

            {/* Data rows — prob 5 down to 1 */}
            {[5, 4, 3, 2, 1].map((p) => (
              <>
                {/* Row label */}
                <div
                  key={`label-${p}`}
                  className="flex items-center justify-end pr-2 text-slate-500 leading-tight"
                  style={{ fontSize: '10px', minHeight: 36 }}
                >
                  {PROBABILITY_LABELS[p]}
                </div>

                {/* Cells */}
                {[1, 2, 3, 4, 5].map((s) => {
                  const count = heatMapData?.[p]?.[s] ?? 0
                  const isClickable = count > 0 && onCellClick
                  return (
                    <button
                      key={`${p}-${s}`}
                      className={[
                        'rounded flex items-center justify-center font-mono font-bold text-sm',
                        'transition-opacity border border-black/10',
                        cellColor(p, s),
                        cellTextColor(p, s),
                        isClickable ? 'cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-white/30' : 'cursor-default',
                      ].join(' ')}
                      style={{ minHeight: 36 }}
                      onClick={() => isClickable && onCellClick(p, s)}
                      aria-label={`${PROBABILITY_LABELS[p]} probability, ${SEVERITY_LABELS[s]} severity: ${count} hazard${count !== 1 ? 's' : ''}`}
                      disabled={!isClickable}
                    >
                      {count > 0 ? count : ''}
                    </button>
                  )
                })}
              </>
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center text-xs text-slate-400 tracking-widest mt-2 ml-20">
            SEVERITY →
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 ml-20">
            {[
              { color: 'bg-green-500/60',  label: 'Acceptable' },
              { color: 'bg-amber-400/70',  label: 'Mitigable' },
              { color: 'bg-red-500/80',    label: 'Unacceptable' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1 text-xs text-slate-400">
                <span className={`w-3 h-3 rounded ${color} inline-block`} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
