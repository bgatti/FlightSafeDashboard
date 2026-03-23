/**
 * Leading vs Lagging indicators panel — two-column split.
 * Leading indicators are proactive/predictive (training rates, reporting rates).
 * Lagging indicators are reactive/historical (accident counts, incident rates).
 *
 * @param {object[]} leading - Array of { label, value, unit, trend, status }
 * @param {object[]} lagging - Array of { label, value, unit, trend, status }
 */
export function LeadLagPanel({ leading, lagging }) {
  return (
    <div
      className="bg-surface-card border border-surface-border rounded-lg overflow-hidden"
      data-testid="lead-lag-panel"
    >
      <div className="grid grid-cols-2">
        {/* Leading */}
        <div className="p-4 border-r border-surface-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Leading Indicators
            </h3>
            <span className="text-slate-500 text-xs">(proactive)</span>
          </div>
          <ul className="space-y-2">
            {leading.map((item) => (
              <IndicatorRow key={item.label} item={item} />
            ))}
          </ul>
        </div>

        {/* Lagging */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Lagging Indicators
            </h3>
            <span className="text-slate-500 text-xs">(reactive)</span>
          </div>
          <ul className="space-y-2">
            {lagging.map((item) => (
              <IndicatorRow key={item.label} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function IndicatorRow({ item }) {
  const trendColor = item.trendGood === true
    ? 'text-green-400'
    : item.trendGood === false
    ? 'text-red-400'
    : 'text-slate-400'

  const trendArrow = item.trend > 0 ? '▲' : item.trend < 0 ? '▼' : '—'

  return (
    <li
      className="flex items-center justify-between text-xs"
      aria-label={`${item.label}: ${item.value}${item.unit ?? ''}`}
    >
      <span className="text-slate-400 truncate flex-1 mr-2">{item.label}</span>
      <span className="font-mono text-slate-200 font-semibold mr-1.5">
        {item.value}{item.unit ? <span className="text-slate-500 font-normal">{item.unit}</span> : null}
      </span>
      <span className={`${trendColor} text-xs flex-shrink-0`} aria-hidden="true">
        {trendArrow}
      </span>
    </li>
  )
}
