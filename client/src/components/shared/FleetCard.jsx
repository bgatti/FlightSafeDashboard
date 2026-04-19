// Unified fleet aircraft card — shared across all portal and ops fleet displays.
// Customization via render-prop slots; core layout (photo, name, tail, status) is consistent.

import { STATUS_COLOR, getAircraftPhoto } from '../../portal/portalConstants'
import { AircraftSilhouette } from './AircraftSilhouette'

/**
 * @param {object}   props
 * @param {object}   props.aircraft       — aircraft data object (any shape)
 * @param {string}   [props.name]         — display name override (defaults to ac.type || ac.makeModel)
 * @param {string}   [props.tail]         — tail override (defaults to ac.tailNumber)
 * @param {string}   [props.acStatus]     — status key override (defaults to ac.status)
 * @param {boolean}  [props.showPhoto]    — show photo underlay (default true)
 * @param {object}   [props.statusColors] — override STATUS_COLOR lookup for this card
 * @param {string}   [props.className]    — extra container classes
 * @param {boolean}  [props.expanded]     — controlled expand state
 * @param {function} [props.onToggle]     — toggle handler
 * @param {function} [props.renderHeaderRight] — (ac) => stars, rate, eval badge, status badge
 * @param {function} [props.renderSpecs]  — (ac) => compact spec line (seats, wing, climb, door)
 * @param {function} [props.renderDetail] — (ac) => expanded body (W&B, squawks, etc.)
 * @param {function} [props.renderActions]— (ac) => action buttons (squawk, book)
 * @param {React.ReactNode} [props.children] — alternative to renderDetail
 */
export function FleetCard({
  aircraft: ac,
  name: nameProp,
  tail: tailProp,
  acStatus: statusProp,
  showPhoto = true,
  statusColors: statusOverride,
  className = '',
  expanded = false,
  onToggle,
  renderHeaderRight,
  renderSpecs,
  renderDetail,
  renderActions,
  children,
}) {
  const displayName = nameProp || ac.type || ac.makeModel || '—'
  const tail = tailProp || ac.tailNumber || ''
  const status = statusProp || ac.status || 'airworthy'
  const sc = statusOverride || STATUS_COLOR[status] || STATUS_COLOR.airworthy
  const photo = showPhoto ? getAircraftPhoto(displayName) : null
  const icaoType = ac.icaoType || ''

  return (
    <div
      onClick={onToggle}
      className={`${sc.bg} border ${sc.border} rounded-2xl overflow-hidden transition-all ${
        onToggle ? 'cursor-pointer hover:scale-[1.01]' : ''
      } ${className}`}
    >
      {/* Photo area — full-width banner or subtle underlay */}
      {showPhoto && (
        <div className="h-28 bg-surface relative">
          {photo ? (
            <img src={photo} alt={displayName} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-card/60">
              <AircraftSilhouette icaoType={icaoType} className="w-24 h-16 text-slate-600" />
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Header: name + right slot */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-white text-base font-bold">{displayName}</div>
            <div className="text-slate-400 text-xs">
              {tail}
              {renderSpecs ? renderSpecs(ac) : null}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {renderHeaderRight ? renderHeaderRight(ac) : (
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
                <span className={`text-xs font-medium ${sc.text}`}>{sc.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Role + notes */}
        {ac.role && <div className="text-slate-300 text-xs mb-1">{ac.role}</div>}
        {ac.notes && <div className="text-slate-500 text-[11px]">{ac.notes}</div>}

        {/* Expanded detail */}
        {expanded && (renderDetail || children) && (
          <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
            {renderDetail ? renderDetail(ac) : children}
          </div>
        )}

        {/* Actions */}
        {renderActions && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            {renderActions(ac)}
          </div>
        )}
      </div>
    </div>
  )
}
