import { useState, useEffect, useRef } from 'react'
import { getSquawks, subscribeSquawks, isAircraftGrounded, resolveSquawk } from '../store/squawks'
import { useAuthStore } from '../stores/authStore'
import { activeCertsForPerson, hasActiveIA } from '../mocks/personnel'
import {
  mockWorkOrders,
  mockInspectionSchedule,
  mockMaintenanceRecords,
  mockComponentTbo,
  mockMaintenanceSummary,
  mockParts,
} from './mockDb'
import { mockPersonnel, mockCertificates } from '../mocks/personnel'
import { mockAircraft }  from '../mocks/aircraft'
import { mockMovementLog, movementsForTail } from '../mocks/movementLog'
import {
  daysUntilLabel,
  inspectionStatusColor,
  inspectionStatusBg,
  inspectionStatusLabel,
  INSPECTION_TYPE_LABELS,
  squawkSeverityLabel,
  squawkSeverityColor,
  squawkStatusLabel,
  squawkStatusColor,
  workOrderPriorityLabel,
  workOrderPriorityColor,
  workOrderStatusLabel,
  workOrderStatusColor,
  tboLifePercent,
  tboHoursRemaining,
  tboLifeColor,
  CURRENT_AIRFRAME_HOURS,
  // Parts
  PART_STATUS_PIPELINE,
  partStatusLabel,
  partStatusColor,
  partPipelineStep,
  partsSummary,
  // Location / hold
  locationLabel,
  locationColor,
  holdReasonLabel,
  holdReasonColor,
  // Work order active status
  woActiveStatus,
  // Personnel / aircraft location
  personnelLocationLabel,
  personnelLocationColor,
  capacityPercent,
  capacityColor,
  certTypeLabel,
  aircraftLocationLabel,
  aircraftLocationColor,
  moveTypeLabel,
  moveTypeColor,
} from './maintenanceUtils'

// ─── Personnel lookup helpers ─────────────────────────────────────────────────

/** Look up a personnel record by ID. */
function getPerson(id) {
  return mockPersonnel.find((p) => p.id === id) ?? null
}

/** Look up a certificate record by ID. */
function getCert(id) {
  return mockCertificates.find((c) => c.id === id) ?? null
}

/** Look up aircraft registry record by tail number. */
function getAircraft(tailNumber) {
  return mockAircraft.find((a) => a.tailNumber === tailNumber) ?? null
}

/** Collect all open (non-completed) work orders for a tail number. */
function openWosForTail(tailNumber) {
  return mockWorkOrders.filter(
    (w) => w.tailNumber === tailNumber && w.status !== 'completed' && w.status !== 'cancelled'
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h3 className="text-slate-400 text-xs uppercase tracking-wider mb-2">{children}</h3>
  )
}

function ScoreTile({ label, value, color = 'text-slate-100', sub }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg p-3 text-center">
      <p className={`font-mono font-bold text-2xl ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Badge({ children, colorClasses }) {
  return (
    <span className={`text-xs border rounded px-1.5 py-0.5 font-semibold ${colorClasses}`}>
      {children}
    </span>
  )
}

// ─── Personnel assignment display ────────────────────────────────────────────

/**
 * Compact inline badge showing a person's name, cert type, and location dot.
 * Used inside work order cards.
 */
function PersonBadge({ personId, label = 'Assigned' }) {
  const person = getPerson(personId)
  if (!person) return <span className="text-slate-500 text-xs italic">Unknown ({personId})</span>
  const cert = certTypeLabel(person.certType)
  const isOnPrem = person.currentLocation === 'on_prem'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnPrem ? 'bg-green-400' : 'bg-amber-400'}`}
        title={personnelLocationLabel(person.currentLocation)}
      />
      <span className="text-slate-200">{person.name}</span>
      {cert && <span className="text-slate-500">{cert}</span>}
    </span>
  )
}

/**
 * Work order personnel block — shows who is performing and who is supervising.
 * The supervising A&P is the 14 CFR 43.3(d) responsible mechanic for this task;
 * this may differ from the performing mechanic's default organisational supervisor.
 * Shows the specific certificate (number + status) per 14 CFR 43.9(a)(3).
 */
function WoPersonnelRow({ wo }) {
  const hasAssigned  = wo.assignedPersonnelIds?.length > 0
  const supervisorId = wo.supervisorId
  const supervisor   = supervisorId ? getPerson(supervisorId) : null
  const supCert      = wo.supervisorCertificateId ? getCert(wo.supervisorCertificateId) : null

  // If the supervisor is also the only assigned person, don't duplicate
  const performingIds = (wo.assignedPersonnelIds ?? []).filter((id) => id !== supervisorId)
  const supervisorIsAlsoPerforming =
    supervisorId && wo.assignedPersonnelIds?.includes(supervisorId) && performingIds.length === 0

  if (!hasAssigned && !supervisorId) {
    return <span className="text-slate-500 text-xs italic">⚠ Unassigned</span>
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
      {/* Performing — warn if nobody assigned */}
      {!supervisorIsAlsoPerforming && performingIds.length === 0 && (
        <span className="text-amber-400 italic">⚠ No technician assigned</span>
      )}
      {(supervisorIsAlsoPerforming || performingIds.length > 0) && (
        <span className="text-slate-500">
          Performing:{' '}
          {supervisorIsAlsoPerforming ? (
            <PersonBadge personId={supervisorId} />
          ) : (
            performingIds.map((id) => <PersonBadge key={id} personId={id} />)
          )}
        </span>
      )}

      {/* Supervising A&P (14 CFR 43.3) — only show separately when different from performer */}
      {supervisor && !supervisorIsAlsoPerforming && (
        <span className="text-slate-500">
          Supervising A&P (43.3):{' '}
          <PersonBadge personId={supervisorId} />
          {supervisor.canReturnToService && (
            <span className="ml-1 text-sky-500">(IA)</span>
          )}
        </span>
      )}

      {/* Certificate reference — 14 CFR 43.9(a)(3) */}
      {supCert && (
        <span className={`font-mono ${
          supCert.status === 'active'
            ? 'text-slate-500'
            : 'text-red-400 font-semibold'
        }`}
          title={`Certificate status: ${supCert.status}`}
        >
          {supCert.certType.replace('_and_', '&')} #{supCert.certificateNumber}
          {supCert.status !== 'active' && ` ⚠ ${supCert.status.toUpperCase()}`}
        </span>
      )}
    </div>
  )
}

// ─── Parts pipeline step track ────────────────────────────────────────────────

/**
 * Horizontal pipeline showing where a single part stands in its lifecycle.
 * not_ordered → ordered → in_transit → arrived → installed
 */
function PartPipelineBar({ status }) {
  const currentStep = partPipelineStep(status)
  const isBranch    = currentStep === -1  // backordered or cancelled

  return (
    <div className="flex items-center gap-0.5" aria-label={`Part status: ${partStatusLabel(status)}`}>
      {PART_STATUS_PIPELINE.map((step, i) => {
        const past    = !isBranch && i < currentStep
        const current = !isBranch && i === currentStep
        return (
          <div key={step} className="flex items-center gap-0.5">
            {i > 0 && (
              <div className={`h-px w-4 ${past || current ? 'bg-sky-400/60' : 'bg-slate-700'}`} />
            )}
            <div
              title={partStatusLabel(step)}
              className={[
                'w-2 h-2 rounded-full transition-colors',
                current ? 'bg-sky-400 ring-2 ring-sky-400/40'
                  : past ? 'bg-sky-400/50'
                  : 'bg-slate-700',
              ].join(' ')}
            />
          </div>
        )
      })}
      {isBranch && (
        <Badge colorClasses={partStatusColor(status)}>{partStatusLabel(status)}</Badge>
      )}
    </div>
  )
}

/**
 * Expandable parts list for a work order card.
 */
function PartsSection({ workOrderId }) {
  const [expanded, setExpanded] = useState(false)
  const parts = mockParts.filter((p) => p.workOrderId === workOrderId)
  if (parts.length === 0) return null

  const summary = partsSummary(parts)
  const hasBlocking = parts.some(
    (p) => p.status === 'backordered' || p.status === 'ordered' || p.status === 'in_transit'
  )

  return (
    <div className="mt-3 border-t border-surface-border pt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-100 transition-colors w-full text-left"
        aria-expanded={expanded}
      >
        <span className={`font-semibold ${hasBlocking ? 'text-orange-400' : 'text-slate-400'}`}>
          Parts
        </span>
        <span className="text-slate-500">{summary}</span>
        <span className="ml-auto">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {parts.map((part) => (
            <div
              key={part.id}
              className="flex items-start gap-3 text-xs py-1.5 border-b border-surface-border last:border-0"
              data-testid={`part-row-${part.id}`}
            >
              {/* Part number + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-slate-300">{part.partNumber}</span>
                  <span className="text-slate-500">{part.description}</span>
                  {part.quantity > 1 && (
                    <span className="text-slate-600">×{part.quantity}</span>
                  )}
                </div>
                {part.supplier && (
                  <div className="text-slate-600 mt-0.5">{part.supplier}{part.poNumber ? ` · PO: ${part.poNumber}` : ''}</div>
                )}
                {part.notes && (
                  <div className="text-slate-600 mt-0.5 italic">{part.notes}</div>
                )}
              </div>

              {/* Pipeline + ETA */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <PartPipelineBar status={part.status} />
                <Badge colorClasses={partStatusColor(part.status)}>
                  {partStatusLabel(part.status)}
                </Badge>
                {part.etaDate && part.status !== 'arrived' && part.status !== 'installed' && (
                  <span className="text-slate-500 font-mono">ETA {part.etaDate} ({daysUntilLabel(part.etaDate)})</span>
                )}
                {part.arrivedDate && part.status === 'arrived' && (
                  <span className="text-green-400 font-mono">Arrived {part.arrivedDate}</span>
                )}
                {part.installedDate && (
                  <span className="text-purple-400 font-mono">Installed {part.installedDate}</span>
                )}
                {part.unitCost > 0 && (
                  <span className="text-slate-600">${(part.unitCost * part.quantity).toFixed(0)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Fleet Status Board ───────────────────────────────────────────────────────
// Compact table showing every aircraft's current location, open tasks,
// assigned personnel, and whether labor is actively accruing.

function FleetStatusBoard() {
  const [allSquawks, setAllSquawks] = useState(getSquawks)
  useEffect(() => subscribeSquawks(setAllSquawks), [])
  return (
    <div>
      <SectionTitle>Fleet Status Board</SectionTitle>
      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full text-xs" aria-label="Fleet status board">
          <thead>
            <tr className="border-b border-surface-border text-slate-400 uppercase tracking-wide">
              <th className="py-2 px-3 text-left font-medium">Tail</th>
              <th className="py-2 px-3 text-left font-medium">Type</th>
              <th className="py-2 px-3 text-left font-medium">Location</th>
              <th className="py-2 px-3 text-left font-medium">Open Tasks</th>
              <th className="py-2 px-3 text-left font-medium">Assigned Mechanic</th>
              <th className="py-2 px-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockAircraft.map((ac) => {
              const openWos = openWosForTail(ac.tailNumber)
              // For the status cell, use the highest-priority open WO
              const priorityOrder = { aog: 0, urgent: 1, routine: 2, scheduled: 3 }
              const primaryWo = [...openWos].sort(
                (a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
              )[0] ?? null
              const activeStatus = primaryWo ? woActiveStatus(primaryWo, mockParts) : null
              const allAssignedIds = [...new Set(
                openWos.flatMap((w) => w.assignedPersonnelIds ?? [])
              )]
              const lastMove = movementsForTail(ac.tailNumber)[0]
              return (
                <tr
                  key={ac.tailNumber}
                  className="border-b border-surface-border last:border-0 hover:bg-white/5"
                  data-testid={`fleet-status-row-${ac.tailNumber}`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-100">
                    {ac.tailNumber}
                    {isAircraftGrounded(ac.id, mockAircraft, allSquawks) && (
                      <span className="ml-1.5 text-red-400 font-normal">GRND</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{ac.icaoType}</td>
                  <td className="py-2.5 px-3">
                    <Badge colorClasses={aircraftLocationColor(ac.currentLocation)}>
                      {aircraftLocationLabel(ac.currentLocation)}
                    </Badge>
                    {lastMove && (
                      <div className="text-slate-600 mt-0.5">
                        {lastMove.movedAt.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {openWos.length === 0 ? (
                      <span className="text-green-400">None</span>
                    ) : (
                      <div className="space-y-0.5">
                        {openWos.slice(0, 2).map((w) => (
                          <div key={w.id} className="flex items-center gap-1.5">
                            <Badge colorClasses={workOrderPriorityColor(w.priority)}>
                              {workOrderPriorityLabel(w.priority)}
                            </Badge>
                            <span className="text-slate-400 truncate max-w-32">{w.title}</span>
                          </div>
                        ))}
                        {openWos.length > 2 && (
                          <span className="text-slate-500">+{openWos.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {allAssignedIds.length === 0 ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {allAssignedIds.map((id) => (
                          <PersonBadge key={id} personId={id} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {activeStatus ? (
                      <span className={`font-semibold ${activeStatus.color}`}>
                        {activeStatus.type === 'active' ? '● ' : ''}{activeStatus.label}
                      </span>
                    ) : openWos.length > 0 ? (
                      <span className="text-slate-500">Waiting</span>
                    ) : (
                      <span className="text-green-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [allSquawks, setAllSquawks] = useState(getSquawks)
  useEffect(() => subscribeSquawks(setAllSquawks), [])
  const urgentSquawks   = allSquawks.filter((s) => s.severity === 'grounding' && s.status !== 'closed')
  const aogWorkOrders   = mockWorkOrders.filter((w) => w.priority === 'aog' && w.status !== 'completed')
  const urgentWorkOrders = mockWorkOrders.filter(
    (w) => w.priority === 'urgent' && w.status !== 'completed' && w.status !== 'cancelled'
  )
  const overdueInsp     = mockInspectionSchedule.filter((i) => i.status === 'overdue')
  const dueSoonInsp     = mockInspectionSchedule.filter((i) => i.status === 'due_soon')
  const recentRecords   = [...mockMaintenanceRecords]
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Fleet Status Board — always shown */}
      <FleetStatusBoard />

      {/* Urgent / AOG items */}
      {(urgentSquawks.length > 0 || aogWorkOrders.length > 0) && (
        <div>
          <SectionTitle>AOG / Grounding Items</SectionTitle>
          <div className="space-y-2">
            {aogWorkOrders.map((wo) => (
              <div key={wo.id} className="border border-red-400/40 bg-red-400/5 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge colorClasses="text-red-400 border-red-400/40 bg-red-400/10">AOG</Badge>
                  <span className="font-mono text-slate-400 text-xs">{wo.tailNumber}</span>
                  <span className="text-slate-400 text-xs">{wo.id}</span>
                </div>
                <p className="text-slate-100 font-semibold">{wo.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">{wo.notes}</p>
                <div className="mt-1.5">
                  <span className={`text-xs ${workOrderStatusColor(wo.status)}`}>{workOrderStatusLabel(wo.status)}</span>
                  <WoPersonnelRow wo={wo} />
                </div>
              </div>
            ))}
            {urgentSquawks.map((sq) => (
              <div key={sq.id} className="border border-red-400/40 bg-red-400/5 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge colorClasses="text-red-400 border-red-400/40 bg-red-400/10">GROUNDING SQK</Badge>
                  <span className="font-mono text-slate-400 text-xs">{sq.tailNumber}</span>
                </div>
                <p className="text-slate-100">{sq.description}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Reported {sq.reportedDate} by {sq.reportedBy}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgent work orders */}
      {urgentWorkOrders.length > 0 && (
        <div>
          <SectionTitle>Urgent Work Orders</SectionTitle>
          <div className="space-y-2">
            {urgentWorkOrders.map((wo) => (
              <div key={wo.id} className="border border-amber-400/40 bg-amber-400/5 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge colorClasses="text-amber-400 border-amber-400/40 bg-amber-400/10">URGENT</Badge>
                  <span className="font-mono text-slate-400 text-xs">{wo.tailNumber}</span>
                </div>
                <p className="text-slate-100 font-semibold">{wo.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs ${workOrderStatusColor(wo.status)}`}>{workOrderStatusLabel(wo.status)}</span>
                  {wo.notes && <span className="text-slate-500 text-xs">· {wo.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue / due-soon inspections */}
      {(overdueInsp.length > 0 || dueSoonInsp.length > 0) && (
        <div>
          <SectionTitle>Inspection Alerts</SectionTitle>
          <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                  <th className="py-2 px-4 text-left font-medium">Tail</th>
                  <th className="py-2 px-4 text-left font-medium">Inspection</th>
                  <th className="py-2 px-4 text-left font-medium">Due</th>
                  <th className="py-2 px-4 text-left font-medium">Status</th>
                  <th className="py-2 px-4 text-left font-medium">Reg. Ref</th>
                </tr>
              </thead>
              <tbody>
                {[...overdueInsp, ...dueSoonInsp].map((insp) => (
                  <tr key={insp.id} className="border-b border-surface-border last:border-0">
                    <td className="py-2 px-4 font-mono font-bold text-slate-100 text-xs">{insp.tailNumber}</td>
                    <td className="py-2 px-4 text-xs text-slate-300">{INSPECTION_TYPE_LABELS[insp.inspectionType] ?? insp.inspectionType}</td>
                    <td className="py-2 px-4 font-mono text-xs">
                      <span className={inspectionStatusColor(insp.status)}>
                        {insp.nextDueDate} ({daysUntilLabel(insp.nextDueDate)})
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      <Badge colorClasses={inspectionStatusBg(insp.status)}>
                        {inspectionStatusLabel(insp.status)}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-xs text-slate-500 font-mono">{insp.regulatoryRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent maintenance activity */}
      <div>
        <SectionTitle>Recent Maintenance Records</SectionTitle>
        <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                <th className="py-2 px-4 text-left font-medium">Date</th>
                <th className="py-2 px-4 text-left font-medium">Tail</th>
                <th className="py-2 px-4 text-left font-medium">Type</th>
                <th className="py-2 px-4 text-left font-medium">Description</th>
                <th className="py-2 px-4 text-left font-medium">Mechanic</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.map((rec) => (
                <tr key={rec.id} className="border-b border-surface-border last:border-0 hover:bg-white/5">
                  <td className="py-2 px-4 font-mono text-xs text-slate-400">{rec.recordDate}</td>
                  <td className="py-2 px-4 font-mono font-bold text-slate-100 text-xs">{rec.tailNumber}</td>
                  <td className="py-2 px-4 text-xs text-slate-400 capitalize">{rec.type.replace(/_/g, ' ')}</td>
                  <td className="py-2 px-4 text-xs text-slate-300 max-w-xs truncate">{rec.description}</td>
                  <td className="py-2 px-4 text-xs text-slate-500">{rec.mechanicName} · {rec.mechanicCertificate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Return-to-Service Printable Record ───────────────────────────────────────

function RtsPrintRecord({ rtsData, onClose }) {
  const printRef = useRef()

  const S = {
    th:  { border: '1px solid #aaa', padding: '3px 6px', background: '#f3f3f3', fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' },
    td:  { border: '1px solid #aaa', padding: '3px 6px', fontSize: '9px' },
    tbl: { width: '100%', borderCollapse: 'collapse', marginBottom: '6px' },
    hdr: { fontWeight: 'bold', fontSize: '9px', borderBottom: '1.5px solid #111', paddingBottom: '1px', marginTop: '8px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  }

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=1000,height=600')
    win.document.write(`<!DOCTYPE html><html><head><title>RTS — ${rtsData.tailNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 9px; padding: 16px 24px; color: #111; }
        @media print { body { padding: 10px 16px; } @page { size: landscape; margin: 0.4in; } }
      </style></head><body>`)
    win.document.write(el.innerHTML)
    win.document.write('</body></html>')
    win.document.close()
    setTimeout(() => { win.print() }, 300)
  }

  const ac = getAircraft(rtsData.tailNumber)
  const wo = rtsData.workOrderId ? mockWorkOrders.find((w) => w.id === rtsData.workOrderId) : null
  const parts = wo ? mockParts.filter((p) => p.workOrderId === wo.id) : []

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 pt-8 px-4" onClick={onClose}>
      <div
        className="bg-white text-black rounded-lg w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300 bg-gray-50 rounded-t-lg">
          <span className="font-bold text-xs">Return to Service Record — {rtsData.tailNumber}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-1 rounded font-semibold">Print</button>
            <button onClick={onClose} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded">Close</button>
          </div>
        </div>

        {/* Printable content — compact landscape-style layout */}
        <div ref={printRef} style={{ fontFamily: "'Courier New', monospace", padding: '12px 16px', fontSize: '9px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: '4px', marginBottom: '8px' }}>
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>MAINTENANCE RECORD — RETURN TO SERVICE</span>
              <span style={{ marginLeft: '12px', fontSize: '9px', color: '#555' }}>14 CFR 43.9 / 43.11</span>
            </div>
            <div style={{ fontSize: '9px', color: '#555' }}>{new Date().toISOString().split('T')[0]}</div>
          </div>

          {/* Two-column top: Aircraft + Discrepancy side by side */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
            {/* Aircraft */}
            <div style={{ flex: '0 0 36%' }}>
              <div style={S.hdr}>Aircraft</div>
              <table style={S.tbl}><tbody>
                <tr><th style={S.th}>Tail</th><td style={{ ...S.td, fontWeight: 'bold' }}>{rtsData.tailNumber}</td></tr>
                {ac && <tr><th style={S.th}>Type</th><td style={S.td}>{ac.typeDesignation || ac.type}</td></tr>}
                {ac && <tr><th style={S.th}>S/N</th><td style={S.td}>{ac.serialNumber || 'N/A'}</td></tr>}
                <tr><th style={S.th}>Hrs</th><td style={S.td}>{rtsData.airframeHours ?? 'N/A'}</td></tr>
              </tbody></table>
            </div>

            {/* Discrepancy */}
            <div style={{ flex: 1 }}>
              <div style={S.hdr}>Squawk / Discrepancy</div>
              <table style={S.tbl}><tbody>
                <tr>
                  <th style={S.th}>ID</th><td style={S.td}>{rtsData.squawkId}</td>
                  <th style={S.th}>Severity</th><td style={{ ...S.td, fontWeight: 'bold' }}>{rtsData.severity?.toUpperCase()}</td>
                  <th style={S.th}>Reported</th><td style={S.td}>{rtsData.reportedDate} — {rtsData.reportedBy}</td>
                </tr>
                <tr>
                  <th style={S.th}>Desc</th>
                  <td colSpan={5} style={S.td}>{rtsData.description}</td>
                </tr>
                {wo && <tr><th style={S.th}>WO</th><td colSpan={5} style={S.td}>{wo.id} — {wo.title}</td></tr>}
              </tbody></table>
            </div>
          </div>

          {/* Parts row — only if parts exist */}
          {parts.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <div style={S.hdr}>Parts Installed</div>
              <table style={S.tbl}>
                <thead>
                  <tr>
                    <th style={S.th}>P/N</th>
                    <th style={S.th}>Description</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Qty</th>
                    <th style={S.th}>Supplier</th>
                    <th style={S.th}>PO #</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...S.td, fontFamily: 'monospace' }}>{p.partNumber}</td>
                      <td style={S.td}>{p.description}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{p.quantity}</td>
                      <td style={S.td}>{p.supplier}</td>
                      <td style={S.td}>{p.poNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Corrective action + signature — side by side */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Corrective action */}
            <div style={{ flex: 1 }}>
              <div style={S.hdr}>Corrective Action</div>
              <div style={{ border: '1px solid #aaa', padding: '4px 6px', minHeight: '36px', fontSize: '9px' }}>
                {rtsData.resolutionNotes}
              </div>
            </div>

            {/* Certification / signature block */}
            <div style={{ flex: '0 0 36%' }}>
              <div style={S.hdr}>Certification &amp; Approval</div>
              <table style={S.tbl}><tbody>
                <tr><th style={S.th}>Approved By</th><td style={{ ...S.td, fontWeight: 'bold' }}>{rtsData.resolvedBy}</td></tr>
                <tr><th style={S.th}>Cert #</th><td style={S.td}>{rtsData.certificateNumber}</td></tr>
                <tr><th style={S.th}>Cert Type</th><td style={S.td}>{rtsData.certificateType}</td></tr>
                <tr><th style={S.th}>Date</th><td style={S.td}>{rtsData.resolvedDate}</td></tr>
              </tbody></table>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ borderTop: '1px solid #111', paddingTop: '2px', fontSize: '8px', color: '#555' }}>Signature (14 CFR 43.3)</div>
                </div>
                <div style={{ flex: '0 0 80px' }}>
                  <div style={{ borderTop: '1px solid #111', paddingTop: '2px', fontSize: '8px', color: '#555' }}>Date</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '10px', fontSize: '8px', color: '#888', textAlign: 'center', borderTop: '1px solid #ddd', paddingTop: '3px' }}>
            FlightSafe SMS — 14 CFR 43.9(a) / 43.11 — generated {new Date().toISOString().split('T')[0]}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Return-to-Service Approval Modal ─────────────────────────────────────────

function RtsApprovalModal({ squawk, onClose, onApprove }) {
  const user = useAuthStore((s) => s.user)
  const userCerts = activeCertsForPerson(user.personnelId)
  const userHasIA = hasActiveIA(user.personnelId)

  const [selectedCertId, setSelectedCertId] = useState(userCerts[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)

  const selectedCert = mockCertificates.find((c) => c.id === selectedCertId)
  // IA is required for annual / 100hr inspections, NOT for grounding squawk RTS
  // Any A&P can return a grounded aircraft to service per 14 CFR 43.3 / 43.7
  const wo = squawk.workOrderId ? mockWorkOrders.find((w) => w.id === squawk.workOrderId) : null
  const isInspectionRts = wo?.type === 'inspection'
  const needsIA = isInspectionRts
  const canApprove = selectedCert && notes.trim().length > 0 && (!needsIA || userHasIA)

  function handleSubmit(e) {
    e.preventDefault()
    if (!canApprove) {
      setError(needsIA && !userHasIA
        ? 'Annual / 100hr inspection sign-off requires Inspector Authorization (IA).'
        : 'Please fill in all required fields.')
      return
    }
    onApprove({
      squawkId: squawk.id,
      tailNumber: squawk.tailNumber,
      reportedBy: squawk.reportedBy,
      reportedDate: squawk.reportedDate,
      severity: squawk.severity,
      description: squawk.description,
      airframeHours: squawk.airframeHours,
      workOrderId: squawk.workOrderId,
      resolvedDate: new Date().toISOString().split('T')[0],
      resolvedBy: user.name,
      resolutionNotes: notes,
      certificateNumber: selectedCert.certificateNumber,
      certificateType: selectedCert.certType === 'IA' ? 'A&P / IA' : 'A&P',
      certificateId: selectedCert.id,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface-card border border-surface-border rounded-xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-surface-border">
          <h3 className="text-slate-100 font-bold text-sm">Return to Service Approval</h3>
          <p className="text-slate-400 text-xs mt-0.5">14 CFR 43.9 — Maintenance Record Entry</p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Squawk info */}
          <div className="bg-slate-800 border border-surface-border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-100">{squawk.tailNumber}</span>
              <Badge colorClasses={squawkSeverityColor(squawk.severity)}>
                {squawkSeverityLabel(squawk.severity)}
              </Badge>
            </div>
            <p className="text-xs text-slate-300">{squawk.description}</p>
            {squawk.workOrderId && (
              <p className="text-xs text-sky-400">Work Order: {squawk.workOrderId}</p>
            )}
          </div>

          {/* IA warning for inspection sign-offs */}
          {needsIA && !userHasIA && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-xs text-red-400 font-semibold">Inspector Authorization Required</p>
              <p className="text-xs text-red-400/80 mt-0.5">
                This work order is an annual / 100hr inspection. Only mechanics with active IA certification
                can sign off on inspection-based return to service (14 CFR 43.7).
              </p>
            </div>
          )}

          {/* Certificate selection */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Signing Certificate <span className="text-slate-500">(14 CFR 43.9(a)(3))</span>
            </label>
            <select
              value={selectedCertId}
              onChange={(e) => setSelectedCertId(e.target.value)}
              className="w-full text-xs bg-slate-800 border border-surface-border text-slate-200 rounded px-3 py-2"
              required
            >
              {userCerts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.certificateNumber} — {c.certType === 'IA' ? 'Inspector Authorization (IA)' : c.certType.replace(/_/g, ' ')}
                  {c.status !== 'active' ? ` [${c.status.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Resolution notes */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Corrective Action / Resolution Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full text-xs bg-slate-800 border border-surface-border text-slate-200 rounded px-3 py-2 resize-y"
              placeholder="Describe the corrective action taken, parts installed, and inspection results..."
              required
            />
          </div>

          {/* Signing mechanic info */}
          <div className="bg-slate-800 border border-surface-border rounded-lg p-3 text-xs">
            <div className="text-slate-400 text-[10px] uppercase tracking-wide mb-1">Signing As</div>
            <div className="text-slate-200 font-semibold">{user.name}</div>
            <div className="text-slate-400">
              {selectedCert?.certificateNumber} — {selectedCert?.certType === 'IA' ? 'A&P / IA' : selectedCert?.certType?.replace(/_/g, ' ')}
            </div>
            {userHasIA && <div className="text-green-400 mt-0.5">IA authority active — can sign off inspections</div>}
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-4 py-2 rounded border border-surface-border text-slate-400 hover:text-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canApprove}
              className={[
                'text-xs px-4 py-2 rounded font-semibold transition-colors',
                canApprove
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              Approve Return to Service
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tab: Squawks ─────────────────────────────────────────────────────────────

function SquawksTab() {
  const [allSquawks, setAllSquawks] = useState(getSquawks)
  useEffect(() => subscribeSquawks(setAllSquawks), [])
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterTail,   setFilterTail]   = useState('all')

  const user = useAuthStore((s) => s.user)
  const isMx = user.role === 'maintenance'

  // RTS modal state
  const [rtsSquawk, setRtsSquawk] = useState(null)
  // Print record state
  const [printData, setPrintData] = useState(null)

  const tails   = [...new Set(allSquawks.map((s) => s.tailNumber))].sort()
  const visible = allSquawks.filter((s) => {
    const statusOk = filterStatus === 'all'
      ? true
      : filterStatus === 'active'
      ? s.status !== 'closed'
      : s.status === filterStatus
    const tailOk = filterTail === 'all' || s.tailNumber === filterTail
    return statusOk && tailOk
  })

  function handleRtsApprove(rtsData) {
    // Resolve the squawk in the store
    resolveSquawk(rtsData.squawkId, rtsData.resolvedBy, rtsData.resolutionNotes)
    setRtsSquawk(null)
    // Show printable record
    setPrintData(rtsData)
  }

  return (
    <div className="space-y-4">
      {/* Maintenance login hint */}
      {!isMx && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
          <span className="text-amber-400 text-base">🔧</span>
          <div className="text-xs text-amber-300">
            <strong>View-only mode.</strong> Log in as maintenance personnel (sidebar dropdown) to approve aircraft return to service.
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {['active','all','open','in_progress','deferred_mel','closed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={[
                'text-xs px-2.5 py-1 rounded transition-colors capitalize',
                filterStatus === f
                  ? 'bg-sky-500 text-white'
                  : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <select
          value={filterTail}
          onChange={(e) => setFilterTail(e.target.value)}
          className="text-xs bg-surface-card border border-surface-border text-slate-300 rounded px-2 py-1"
          aria-label="Filter by tail number"
        >
          <option value="all">All Aircraft</option>
          {tails.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-500">{visible.length} squawk{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Squawks table */}
      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full" aria-label="Squawks">
          <thead>
            <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
              <th className="py-2 px-4 text-left font-medium">Tail</th>
              <th className="py-2 px-4 text-left font-medium">Severity</th>
              <th className="py-2 px-4 text-left font-medium">Description</th>
              <th className="py-2 px-4 text-left font-medium">Status</th>
              <th className="py-2 px-4 text-left font-medium">Reported</th>
              <th className="py-2 px-4 text-left font-medium">MEL Expiry</th>
              <th className="py-2 px-4 text-left font-medium">Action / Record</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500 text-sm">
                  No squawks match the current filter.
                </td>
              </tr>
            )}
            {visible.map((sq) => (
              <tr
                key={sq.id}
                className="border-b border-surface-border last:border-0 hover:bg-white/5 text-sm"
                data-testid={`squawk-row-${sq.id}`}
              >
                <td className="py-2.5 px-4 font-mono font-bold text-slate-100 text-xs">{sq.tailNumber}</td>
                <td className="py-2.5 px-4">
                  <Badge colorClasses={squawkSeverityColor(sq.severity)}>
                    {squawkSeverityLabel(sq.severity)}
                  </Badge>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-300 max-w-xs">
                  <p className="truncate">{sq.description}</p>
                  {sq.melReference && (
                    <p className="text-sky-400 text-xs mt-0.5">{sq.melReference}</p>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-semibold ${squawkStatusColor(sq.status)}`}>
                    {squawkStatusLabel(sq.status)}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500">
                  <div>{sq.reportedDate}</div>
                  <div className="text-slate-600">{sq.reportedBy}</div>
                </td>
                <td className="py-2.5 px-4 text-xs">
                  {sq.melExpiryDate
                    ? <span className="text-amber-400 font-mono">{sq.melExpiryDate} ({daysUntilLabel(sq.melExpiryDate)})</span>
                    : <span className="text-slate-600">—</span>
                  }
                </td>
                <td className="py-2.5 px-4">
                  {sq.status !== 'closed' ? (
                    isMx ? (
                      <button
                        onClick={() => setRtsSquawk(sq)}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors shadow-sm whitespace-nowrap"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Return to Service
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600 italic">Log in as A&P</span>
                    )
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {sq.resolvedBy && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">
                            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            Certified
                          </span>
                        )}
                      </div>
                      {sq.resolvedBy && (
                        <div className="text-[10px] text-slate-400">{sq.resolvedBy}</div>
                      )}
                      {sq.resolvedDate && (
                        <div className="text-[10px] text-slate-500">{sq.resolvedDate}</div>
                      )}
                      {sq.resolutionNotes && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={sq.resolutionNotes}>
                          {sq.resolutionNotes}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RTS Approval Modal */}
      {rtsSquawk && (
        <RtsApprovalModal
          squawk={rtsSquawk}
          onClose={() => setRtsSquawk(null)}
          onApprove={handleRtsApprove}
        />
      )}

      {/* Printable RTS Record */}
      {printData && (
        <RtsPrintRecord
          rtsData={printData}
          onClose={() => setPrintData(null)}
        />
      )}
    </div>
  )
}

// ─── Tab: Work Orders ─────────────────────────────────────────────────────────

function WorkOrdersTab() {
  const [filterStatus, setFilterStatus] = useState('open')
  const [filterTail,   setFilterTail]   = useState('all')

  const tails   = [...new Set(mockWorkOrders.map((w) => w.tailNumber))].sort()
  const visible = mockWorkOrders.filter((w) => {
    const statusOk = filterStatus === 'open'
      ? w.status !== 'completed' && w.status !== 'cancelled'
      : filterStatus === 'all'
      ? true
      : w.status === filterStatus
    const tailOk = filterTail === 'all' || w.tailNumber === filterTail
    return statusOk && tailOk
  })

  // Sort: aog first, then urgent, then by created date desc
  const priorityOrder = { aog: 0, urgent: 1, routine: 2, scheduled: 3 }
  const sorted = [...visible].sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pd !== 0) return pd
    return b.createdDate.localeCompare(a.createdDate)
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {['open','all','in_progress','parts_on_order','completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={[
                'text-xs px-2.5 py-1 rounded transition-colors capitalize',
                filterStatus === f
                  ? 'bg-sky-500 text-white'
                  : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <select
          value={filterTail}
          onChange={(e) => setFilterTail(e.target.value)}
          className="text-xs bg-surface-card border border-surface-border text-slate-300 rounded px-2 py-1"
          aria-label="Filter work orders by tail number"
        >
          <option value="all">All Aircraft</option>
          {tails.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-500">{sorted.length} work order{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm bg-surface-card border border-surface-border rounded-lg">
            No work orders match the current filter.
          </div>
        )}
        {sorted.map((wo) => (
          <div
            key={wo.id}
            className={[
              'border rounded-lg p-4 text-sm',
              wo.priority === 'aog'
                ? 'border-red-400/40 bg-red-400/5'
                : wo.priority === 'urgent'
                ? 'border-amber-400/30 bg-amber-400/5'
                : 'border-surface-border bg-surface-card',
            ].join(' ')}
            data-testid={`work-order-row-${wo.id}`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge colorClasses={workOrderPriorityColor(wo.priority)}>
                  {workOrderPriorityLabel(wo.priority)}
                </Badge>
                <span className="font-mono text-slate-400 text-xs">{wo.tailNumber}</span>
                <span className="text-slate-600 text-xs">{wo.id}</span>
                <span className="text-slate-500 text-xs capitalize">{wo.type.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Location badge */}
                {wo.location && (
                  <Badge colorClasses={locationColor(wo.location)}>
                    {locationLabel(wo.location)}
                    {wo.queuePosition != null ? ` · Q${wo.queuePosition}` : ''}
                  </Badge>
                )}
                <span className={`text-xs font-semibold whitespace-nowrap ${workOrderStatusColor(wo.status)}`}>
                  {workOrderStatusLabel(wo.status)}
                </span>
              </div>
            </div>

            <p className="text-slate-100 font-semibold mt-2">{wo.title}</p>

            {/* Hold reason banner */}
            {wo.holdReason && wo.status !== 'completed' && wo.status !== 'cancelled' && (
              <div className={`flex items-center gap-1.5 mt-2 text-xs px-2 py-1 rounded border w-fit ${holdReasonColor(wo.holdReason)}`}>
                <span>⏸</span>
                <span className="font-semibold">{holdReasonLabel(wo.holdReason)}</span>
                {wo.holdReason === 'queued' && wo.queuePosition != null && (
                  <span className="opacity-70">— position #{wo.queuePosition} in queue</span>
                )}
              </div>
            )}

            <p className="text-slate-400 text-xs mt-2 leading-relaxed">{wo.description}</p>

            {/* Personnel: performing + supervising A&P (14 CFR 43.3) */}
            <div className="mt-3">
              <WoPersonnelRow wo={wo} />
            </div>

            {/* Work order active status */}
            {wo.status !== 'completed' && wo.status !== 'cancelled' && (() => {
              const s = woActiveStatus(wo, mockParts)
              if (!s) return null
              return (
                <div className={`flex items-center gap-1.5 mt-2 text-xs ${s.color}`}>
                  {s.type === 'active' && <span>●</span>}
                  {s.type !== 'active' && s.type !== 'unassigned' && <span>⏸</span>}
                  <span>{s.label}</span>
                </div>
              )
            })()}

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
              {wo.estimatedHours && (
                <span>Est: <span className="text-slate-400 font-mono">{wo.estimatedHours}h</span></span>
              )}
              {wo.actualHours != null && (
                <span>Actual: <span className="text-slate-400 font-mono">{wo.actualHours}h</span></span>
              )}
              <span>Created: <span className="font-mono text-slate-400">{wo.createdDate}</span></span>
              {wo.completedDate && (
                <span>Completed: <span className="font-mono text-green-400">{wo.completedDate}</span></span>
              )}
              {wo.partsCost > 0 && (
                <span>Parts: <span className="text-slate-400">${wo.partsCost.toFixed(0)}</span></span>
              )}
              {wo.laborCost > 0 && (
                <span>Labor: <span className="text-slate-400">${wo.laborCost.toFixed(0)}</span></span>
              )}
            </div>

            {wo.notes && (
              <p className="text-slate-500 text-xs mt-2 italic border-t border-surface-border pt-2">{wo.notes}</p>
            )}

            {/* Parts section */}
            <PartsSection workOrderId={wo.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Inspections ─────────────────────────────────────────────────────────

const TAIL_ORDER = ['N12345','N67890','N11111','N22222','N33333','N44444','N55555']

function InspectionsTab() {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTail,   setFilterTail]   = useState('all')

  const visible = mockInspectionSchedule.filter((i) => {
    const statusOk = filterStatus === 'all' || i.status === filterStatus
    const tailOk   = filterTail === 'all'   || i.tailNumber === filterTail
    return statusOk && tailOk
  })

  // Group by tail number
  const grouped = {}
  for (const item of visible) {
    if (!grouped[item.tailNumber]) grouped[item.tailNumber] = []
    grouped[item.tailNumber].push(item)
  }
  const orderedTails = TAIL_ORDER.filter((t) => grouped[t])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {['all','overdue','due_soon','current'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={[
                'text-xs px-2.5 py-1 rounded transition-colors capitalize',
                filterStatus === f
                  ? 'bg-sky-500 text-white'
                  : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <select
          value={filterTail}
          onChange={(e) => setFilterTail(e.target.value)}
          className="text-xs bg-surface-card border border-surface-border text-slate-300 rounded px-2 py-1"
          aria-label="Filter inspections by tail number"
        >
          <option value="all">All Aircraft</option>
          {TAIL_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {orderedTails.length === 0 && (
        <div className="text-center py-8 text-slate-500 text-sm bg-surface-card border border-surface-border rounded-lg">
          No inspections match the current filter.
        </div>
      )}

      {orderedTails.map((tail) => (
        <div key={tail} className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <div className="border-b border-surface-border px-4 py-2 flex items-center gap-2">
            <span className="font-mono font-bold text-slate-100 text-sm">{tail}</span>
            {grouped[tail].some((i) => i.status === 'overdue') && (
              <Badge colorClasses="text-red-400 border-red-400/40 bg-red-400/10">OVERDUE</Badge>
            )}
            {!grouped[tail].some((i) => i.status === 'overdue') &&
              grouped[tail].some((i) => i.status === 'due_soon') && (
              <Badge colorClasses="text-amber-400 border-amber-400/40 bg-amber-400/10">Due Soon</Badge>
            )}
          </div>
          <table className="w-full" aria-label={`Inspection schedule for ${tail}`}>
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                <th className="py-2 px-4 text-left font-medium">Inspection</th>
                <th className="py-2 px-4 text-left font-medium">Reg. Ref</th>
                <th className="py-2 px-4 text-left font-medium">Last Done</th>
                <th className="py-2 px-4 text-left font-medium">Next Due</th>
                <th className="py-2 px-4 text-left font-medium">Status</th>
                <th className="py-2 px-4 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {grouped[tail].map((insp) => (
                <tr
                  key={insp.id}
                  className="border-b border-surface-border last:border-0 text-sm"
                  data-testid={`inspection-row-${insp.id}`}
                >
                  <td className="py-2 px-4 text-xs text-slate-300">
                    {INSPECTION_TYPE_LABELS[insp.inspectionType] ?? insp.inspectionType}
                  </td>
                  <td className="py-2 px-4 font-mono text-xs text-slate-500">{insp.regulatoryRef}</td>
                  <td className="py-2 px-4 font-mono text-xs text-slate-400">
                    {insp.lastCompletedDate ?? '—'}
                    {insp.lastCompletedHours != null && (
                      <span className="text-slate-600"> · {insp.lastCompletedHours.toLocaleString()}h</span>
                    )}
                  </td>
                  <td className="py-2 px-4 font-mono text-xs">
                    <span className={inspectionStatusColor(insp.status)}>
                      {insp.nextDueDate}
                    </span>
                    <span className={`text-xs ml-1 ${inspectionStatusColor(insp.status)}`}>
                      ({daysUntilLabel(insp.nextDueDate)})
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    <Badge colorClasses={inspectionStatusBg(insp.status)}>
                      {inspectionStatusLabel(insp.status)}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 text-xs text-slate-500 max-w-xs">{insp.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Parts ───────────────────────────────────────────────────────────────

function PartsTab() {
  const [filterStatus, setFilterStatus] = useState('active')
  const [filterTail,   setFilterTail]   = useState('all')

  const tails   = [...new Set(mockParts.map((p) => p.tailNumber))].sort()

  // Build enriched parts with WO context
  const enriched = mockParts.map((p) => {
    const wo = mockWorkOrders.find((w) => w.id === p.workOrderId)
    return { ...p, wo }
  })

  const ACTIVE_STATUSES = ['not_ordered','ordered','in_transit','arrived','backordered']

  const visible = enriched.filter((p) => {
    const statusOk = filterStatus === 'all'
      ? true
      : filterStatus === 'active'
      ? ACTIVE_STATUSES.includes(p.status)
      : p.status === filterStatus
    const tailOk = filterTail === 'all' || p.tailNumber === filterTail
    return statusOk && tailOk
  })

  // Sort: backordered first, then not_ordered, ordered, in_transit, arrived, installed
  const ORDER = { backordered: 0, not_ordered: 1, ordered: 2, in_transit: 3, arrived: 4, installed: 5, cancelled: 6 }
  const sorted = [...visible].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9))

  // Summary counts for active parts
  const active = enriched.filter((p) => ACTIVE_STATUSES.includes(p.status))
  const counts = {
    backordered: active.filter((p) => p.status === 'backordered').length,
    not_ordered: active.filter((p) => p.status === 'not_ordered').length,
    ordered:     active.filter((p) => p.status === 'ordered').length,
    in_transit:  active.filter((p) => p.status === 'in_transit').length,
    arrived:     active.filter((p) => p.status === 'arrived').length,
  }

  return (
    <div className="space-y-4">
      {/* Pipeline summary tiles */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { key: 'backordered', label: 'Backordered', color: 'text-red-400' },
          { key: 'not_ordered', label: 'Not Ordered', color: 'text-slate-400' },
          { key: 'ordered',     label: 'Ordered',     color: 'text-sky-400' },
          { key: 'in_transit',  label: 'In Transit',  color: 'text-amber-400' },
          { key: 'arrived',     label: 'Arrived',     color: 'text-green-400' },
        ].map((tile) => (
          <button
            key={tile.key}
            onClick={() => setFilterStatus(tile.key)}
            className={[
              'bg-surface-card border rounded-lg p-2.5 text-center transition-colors',
              filterStatus === tile.key ? 'border-sky-400/60' : 'border-surface-border hover:border-slate-600',
            ].join(' ')}
          >
            <p className={`font-mono font-bold text-xl ${tile.color}`}>{counts[tile.key]}</p>
            <p className="text-xs text-slate-400 mt-0.5">{tile.label}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {['active','all','not_ordered','ordered','in_transit','arrived','installed','backordered'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={[
                'text-xs px-2.5 py-1 rounded transition-colors capitalize',
                filterStatus === f
                  ? 'bg-sky-500 text-white'
                  : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <select
          value={filterTail}
          onChange={(e) => setFilterTail(e.target.value)}
          className="text-xs bg-surface-card border border-surface-border text-slate-300 rounded px-2 py-1"
          aria-label="Filter parts by tail number"
        >
          <option value="all">All Aircraft</option>
          {tails.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-500">{sorted.length} part{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Parts table */}
      <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full" aria-label="Parts tracker">
          <thead>
            <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
              <th className="py-2 px-4 text-left font-medium">Tail / WO</th>
              <th className="py-2 px-4 text-left font-medium">Part #</th>
              <th className="py-2 px-4 text-left font-medium">Description</th>
              <th className="py-2 px-4 text-left font-medium">Qty</th>
              <th className="py-2 px-4 text-left font-medium">Pipeline</th>
              <th className="py-2 px-4 text-left font-medium">Status</th>
              <th className="py-2 px-4 text-left font-medium">ETA / Arrived</th>
              <th className="py-2 px-4 text-left font-medium">Supplier / PO</th>
              <th className="py-2 px-4 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-500 text-sm">
                  No parts match the current filter.
                </td>
              </tr>
            )}
            {sorted.map((part) => (
              <tr
                key={part.id}
                className={[
                  'border-b border-surface-border last:border-0 hover:bg-white/5 text-sm',
                  part.status === 'backordered' ? 'bg-red-400/5' : '',
                ].join(' ')}
                data-testid={`parts-tab-row-${part.id}`}
              >
                <td className="py-2.5 px-4 text-xs">
                  <div className="font-mono font-bold text-slate-100">{part.tailNumber}</div>
                  <div className="text-slate-600">{part.workOrderId}</div>
                  {part.wo && (
                    <div className="text-slate-600 max-w-[120px] truncate">{part.wo.title.split(' — ')[0]}</div>
                  )}
                </td>
                <td className="py-2.5 px-4 font-mono text-xs text-slate-300">{part.partNumber}</td>
                <td className="py-2.5 px-4 text-xs text-slate-300 max-w-[200px]">
                  <span className="block truncate">{part.description}</span>
                  {part.notes && <span className="text-slate-600 italic block truncate">{part.notes}</span>}
                </td>
                <td className="py-2.5 px-4 font-mono text-xs text-slate-400 text-center">{part.quantity}</td>
                <td className="py-2.5 px-4">
                  <PartPipelineBar status={part.status} />
                </td>
                <td className="py-2.5 px-4">
                  <Badge colorClasses={partStatusColor(part.status)}>
                    {partStatusLabel(part.status)}
                  </Badge>
                </td>
                <td className="py-2.5 px-4 text-xs font-mono">
                  {part.installedDate ? (
                    <span className="text-purple-400">Inst. {part.installedDate}</span>
                  ) : part.arrivedDate ? (
                    <span className="text-green-400">Arr. {part.arrivedDate}</span>
                  ) : part.etaDate ? (
                    <span className={daysUntilLabel(part.etaDate).includes('overdue') ? 'text-red-400' : 'text-amber-400'}>
                      ETA {part.etaDate} ({daysUntilLabel(part.etaDate)})
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500">
                  {part.supplier && <div>{part.supplier}</div>}
                  {part.poNumber && <div className="font-mono text-slate-600">{part.poNumber}</div>}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-400 text-right font-mono">
                  {part.unitCost > 0 ? `$${(part.unitCost * part.quantity).toFixed(0)}` : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: TBO Tracking ────────────────────────────────────────────────────────

function TboTab() {
  const enriched = mockComponentTbo.map((comp) => {
    const currentHours = CURRENT_AIRFRAME_HOURS[comp.tailNumber] ?? 0
    const pct = tboLifePercent(currentHours, comp.hoursAtInstall, comp.tboHours)
    const remaining = tboHoursRemaining(currentHours, comp.hoursAtInstall, comp.tboHours)
    const hoursSince = currentHours - comp.hoursAtInstall
    return { ...comp, pct, remaining, hoursSince }
  })

  const grouped = {}
  for (const comp of enriched) {
    if (!grouped[comp.tailNumber]) grouped[comp.tailNumber] = []
    grouped[comp.tailNumber].push(comp)
  }
  const orderedTails = TAIL_ORDER.filter((t) => grouped[t])

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        TBO (Time Between Overhaul) is based on manufacturer service instructions.
        Under 14 CFR Part 91 TBO is advisory; mandatory under Parts 121/135.
        Life % = hours since overhaul ÷ TBO hours.
      </p>

      {orderedTails.map((tail) => (
        <div key={tail} className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <div className="border-b border-surface-border px-4 py-2">
            <span className="font-mono font-bold text-slate-100 text-sm">{tail}</span>
          </div>
          <table className="w-full" aria-label={`TBO tracking for ${tail}`}>
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
                <th className="py-2 px-4 text-left font-medium">Component</th>
                <th className="py-2 px-4 text-left font-medium">Serial #</th>
                <th className="py-2 px-4 text-left font-medium">Since O/H</th>
                <th className="py-2 px-4 text-left font-medium">TBO</th>
                <th className="py-2 px-4 text-left font-medium w-40">Life</th>
                <th className="py-2 px-4 text-left font-medium">Remaining</th>
                <th className="py-2 px-4 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {grouped[tail].map((comp) => {
                const color = tboLifeColor(comp.pct)
                return (
                  <tr
                    key={comp.id}
                    className="border-b border-surface-border last:border-0 text-sm"
                    data-testid={`tbo-row-${comp.id}`}
                  >
                    <td className="py-2.5 px-4 text-xs text-slate-300">
                      <p className="font-semibold">{comp.componentLabel}</p>
                      {comp.model && <p className="text-slate-500">{comp.manufacturer} {comp.model}</p>}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{comp.serialNumber ?? '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">
                      {comp.hoursSince.toLocaleString()}h
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">
                      {comp.tboHours.toLocaleString()}h
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden min-w-0">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(comp.pct, 100)}%`,
                              backgroundColor: color,
                            }}
                            role="progressbar"
                            aria-valuenow={comp.pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${comp.componentLabel} TBO life: ${comp.pct}%`}
                          />
                        </div>
                        <span className="font-mono text-xs w-10 text-right" style={{ color }}>
                          {comp.pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs" style={{ color }}>
                      {comp.remaining > 0 ? `${comp.remaining.toLocaleString()}h` : `${Math.abs(comp.remaining)}h OVR`}
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {comp.status === 'due_soon' && (
                        <Badge colorClasses="text-amber-400 border-amber-400/40 bg-amber-400/10">Due Soon</Badge>
                      )}
                      {comp.status === 'overdue' && (
                        <Badge colorClasses="text-red-400 border-red-400/40 bg-red-400/10">Overdue</Badge>
                      )}
                      {comp.status === 'monitoring' && (
                        <Badge colorClasses="text-sky-400 border-sky-400/40 bg-sky-400/10">Monitoring</Badge>
                      )}
                      {comp.status === 'normal' && (
                        <span className="text-green-400">✓ Normal</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Personnel ───────────────────────────────────────────────────────────
// Shows the maintenance team: who is on premises, their active assignments,
// capacity utilisation, certificate status, and supervising relationships.
//
// Per 14 CFR 43.3 the FAA requires traceability to a specific certificate
// (not just a person). Certificates can be acquired, suspended, or revoked
// independently; the certificate status is shown here and on work orders.

function PersonnelTab() {
  const [filter, setFilter] = useState('all')

  // Only maintenance-department personnel
  const maintenanceStaff = mockPersonnel.filter((p) => p.department === 'Maintenance')
  const visible = maintenanceStaff.filter((p) => {
    if (filter === 'all')     return true
    if (filter === 'on_prem') return p.currentLocation === 'on_prem'
    if (filter === 'off')     return p.currentLocation !== 'on_prem'
    if (filter === 'ia')      return p.canReturnToService
    return true
  })

  // Summary counts
  const onPrem   = maintenanceStaff.filter((p) => p.currentLocation === 'on_prem').length
  const offSite  = maintenanceStaff.filter((p) => p.currentLocation !== 'on_prem').length
  const iaCount  = maintenanceStaff.filter((p) => p.canReturnToService).length

  return (
    <div className="space-y-4">
      {/* Regulatory note */}
      <p className="text-xs text-slate-500 border border-surface-border rounded px-3 py-2 bg-surface-card">
        <span className="text-slate-300 font-semibold">14 CFR 43.3(d)</span> — Maintenance must be performed by
        or under the direct supervision of a certificated A&P mechanic. The supervising A&P is a
        task-level designation recorded per work order, not an organisational hierarchy.
        Certificates can be acquired, suspended, or revoked independently of the person record;
        traceability is to the certificate, not the individual.
      </p>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        <span>
          <span className="font-mono font-bold text-green-400">{onPrem}</span>
          <span className="text-slate-400 ml-1">On premises</span>
        </span>
        <span>
          <span className="font-mono font-bold text-amber-400">{offSite}</span>
          <span className="text-slate-400 ml-1">Off site / leave</span>
        </span>
        <span>
          <span className="font-mono font-bold text-sky-400">{iaCount}</span>
          <span className="text-slate-400 ml-1">IA certified</span>
        </span>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-1 flex-wrap">
        {[
          { id: 'all',     label: 'All' },
          { id: 'on_prem', label: 'On Premises' },
          { id: 'off',     label: 'Off Site' },
          { id: 'ia',      label: 'IA Holders' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={[
              'text-xs px-2.5 py-1 rounded transition-colors',
              filter === f.id
                ? 'bg-sky-500 text-white'
                : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-100',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Personnel cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((person) => {
          const supervisor = person.supervisorId ? getPerson(person.supervisorId) : null
          const activeWos = mockWorkOrders.filter(
            (w) => w.status !== 'completed' && w.status !== 'cancelled' &&
                   w.assignedPersonnelIds?.includes(person.id)
          )
          const supervisingWos = mockWorkOrders.filter(
            (w) => w.status !== 'completed' && w.status !== 'cancelled' &&
                   w.supervisorId === person.id &&
                   !w.assignedPersonnelIds?.includes(person.id)
          )
          const pct = person.capacityHoursPerWeek
            ? capacityPercent(person.assignedHoursThisWeek ?? 0, person.capacityHoursPerWeek)
            : null
          const certLabel = certTypeLabel(person.certType)

          return (
            <div
              key={person.id}
              className="bg-surface-card border border-surface-border rounded-lg p-4 space-y-3"
              data-testid={`personnel-card-${person.id}`}
            >
              {/* Name + cert + location */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100 text-sm">{person.name}</p>
                  <p className="text-slate-400 text-xs">{person.roleLabel}</p>
                </div>
                <Badge colorClasses={personnelLocationColor(person.currentLocation)}>
                  {personnelLocationLabel(person.currentLocation)}
                </Badge>
              </div>

              {/* Certificates — each cert shown with status (14 CFR 43.9 traceability) */}
              <div className="space-y-1 text-xs">
                {mockCertificates.filter((c) => c.personnelId === person.id).map((cert) => (
                  <div key={cert.id} className="flex items-center gap-2 flex-wrap">
                    <Badge colorClasses={
                      cert.status !== 'active'
                        ? 'text-red-400 border-red-400/40 bg-red-400/10'
                        : cert.certType === 'IA'
                        ? 'text-sky-400 border-sky-400/40 bg-sky-400/10'
                        : 'text-slate-300 border-slate-400/40 bg-slate-400/10'
                    }>
                      {cert.certType.replace('_and_', '&')}
                      {cert.status !== 'active' && ` · ${cert.status.toUpperCase()}`}
                    </Badge>
                    <span className="font-mono text-slate-500">#{cert.certificateNumber}</span>
                    {cert.issuedDate && (
                      <span className="text-slate-600">since {cert.issuedDate.slice(0, 4)}</span>
                    )}
                  </div>
                ))}
                {person.yearsExperience && (
                  <span className="text-slate-500">{person.yearsExperience}yr experience</span>
                )}
              </div>

              {/* Specializations */}
              {person.specializations?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {person.specializations.map((s) => (
                    <span key={s} className="text-xs text-slate-500 bg-surface border border-surface-border rounded px-1.5 py-0.5 capitalize">
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* Capacity bar */}
              {pct !== null ? (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">Capacity this week</span>
                    <span className={`font-mono font-semibold ${
                      pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-green-400'
                    }`}>
                      {person.assignedHoursThisWeek ?? 0}h / {person.capacityHoursPerWeek}h
                    </span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${capacityColor(pct)}`}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${person.name} capacity: ${pct}%`}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">External contractor — billed per engagement</p>
              )}

              {/* Active assignments */}
              {activeWos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold mb-1">Performing:</p>
                  <div className="space-y-1">
                    {activeWos.map((w) => (
                      <div key={w.id} className="flex items-center gap-2 text-xs">
                        <Badge colorClasses={workOrderPriorityColor(w.priority)}>
                          {workOrderPriorityLabel(w.priority)}
                        </Badge>
                        <span className="text-slate-400 font-mono text-xs">{w.tailNumber}</span>
                        <span className="text-slate-500 truncate">{w.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supervising (different WOs than assigned) */}
              {supervisingWos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 font-semibold mb-1">
                    Supervising A&P <span className="text-slate-500 font-normal">(14 CFR 43.3)</span>:
                  </p>
                  <div className="space-y-1">
                    {supervisingWos.map((w) => (
                      <div key={w.id} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-mono">{w.tailNumber}</span>
                        <span className="text-slate-500 truncate">{w.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Default org supervisor (for scheduling) */}
              {supervisor && (
                <p className="text-xs text-slate-600 border-t border-surface-border pt-2">
                  Org default supervisor: <span className="text-slate-500">{supervisor.name}</span>
                </p>
              )}

              {/* Off-site note */}
              {person.currentLocation !== 'on_prem' && (
                <p className="text-xs text-amber-400 italic">
                  Not on premises — cannot currently supervise tasks
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'squawks',     label: 'Squawks' },
  { id: 'workorders',  label: 'Work Orders' },
  { id: 'parts',       label: 'Parts' },
  { id: 'personnel',   label: 'Personnel' },
  { id: 'inspections', label: 'Inspections' },
  { id: 'tbo',         label: 'TBO Tracking' },
]

export function Maintenance() {
  const [activeTab, setActiveTab] = useState('overview')
  const s = mockMaintenanceSummary

  return (
    <div className="space-y-5" data-testid="page-maintenance">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-100 font-bold text-lg">Aircraft Maintenance</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            FAA 14 CFR Part 43 &amp; 91 — squawks, work orders, inspections, TBO
          </p>
        </div>
        <button className="text-xs bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded font-semibold">
          + New Work Order
        </button>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        <ScoreTile label="Open Squawks"    value={s.openSquawks}         color={s.openSquawks > 0        ? 'text-amber-400' : 'text-green-400'} />
        <ScoreTile label="Grounding"       value={s.groundingSquawks}    color={s.groundingSquawks > 0   ? 'text-red-400'   : 'text-green-400'} />
        <ScoreTile label="MEL Deferred"    value={s.melDeferred}         color={s.melDeferred > 0        ? 'text-sky-400'   : 'text-green-400'} />
        <ScoreTile label="Work Orders"     value={s.workOrdersOpen}      color={s.workOrdersOpen > 0     ? 'text-amber-400' : 'text-green-400'} />
        <ScoreTile label="AOG"             value={s.workOrdersAog}       color={s.workOrdersAog > 0      ? 'text-red-400'   : 'text-green-400'} />
        <ScoreTile label="Parts On Order"  value={s.partsOrdered}        color={s.partsOrdered > 0       ? 'text-sky-400'   : 'text-green-400'} />
        <ScoreTile label="In Transit"      value={s.partsInTransit}      color={s.partsInTransit > 0     ? 'text-amber-400' : 'text-green-400'} />
        <ScoreTile label="Parts Arrived"   value={s.partsArrived}        color={s.partsArrived > 0       ? 'text-green-400' : 'text-slate-400'} />
        <ScoreTile label="Insp Overdue"    value={s.inspectionsOverdue}  color={s.inspectionsOverdue > 0 ? 'text-red-400'   : 'text-green-400'} />
        <ScoreTile label="TBO Due"         value={s.tboOverdue + s.tboDueSoon} color={(s.tboOverdue + s.tboDueSoon) > 0 ? 'text-amber-400' : 'text-green-400'} />
      </div>

      {/* Tab bar */}
      <div className="border-b border-surface-border flex gap-0" role="tablist" aria-label="Maintenance sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-4 py-2 text-sm border-b-2 transition-colors',
              activeTab === tab.id
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-600',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'    && <OverviewTab />}
      {activeTab === 'squawks'     && <SquawksTab />}
      {activeTab === 'workorders'  && <WorkOrdersTab />}
      {activeTab === 'parts'       && <PartsTab />}
      {activeTab === 'personnel'   && <PersonnelTab />}
      {activeTab === 'inspections' && <InspectionsTab />}
      {activeTab === 'tbo'         && <TboTab />}
    </div>
  )
}
