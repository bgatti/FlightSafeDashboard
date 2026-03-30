// =============================================================================
// Maintenance Utility Functions — pure, side-effect-free
// All date math is relative to a referenceDate (default: today).
// =============================================================================

const TODAY         = '2026-03-28'            // project reference date
const REF_DATETIME  = '2026-03-28T11:00:00'   // reference "now" for elapsed-time calculations

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Days between two ISO date strings. Positive = isoDate is in the future. */
export function daysUntil(isoDate, referenceDate = TODAY) {
  const ref  = new Date(referenceDate)
  const due  = new Date(isoDate)
  return Math.round((due - ref) / 86_400_000)
}

/**
 * Human-readable days label.
 *   +5  → "5d"
 *   -3  → "3d overdue"
 *   0   → "Today"
 */
export function daysUntilLabel(isoDate, referenceDate = TODAY) {
  const diff = daysUntil(isoDate, referenceDate)
  if (diff === 0) return 'Today'
  if (diff < 0)  return `${Math.abs(diff)}d overdue`
  return `${diff}d`
}

// ─── Inspection helpers ───────────────────────────────────────────────────────

/**
 * Compute inspection status from the next due date.
 * @param {string} nextDueDate   ISO date
 * @param {number} thresholdDays warn if due within N days
 * @param {string} referenceDate ISO date (default TODAY)
 * @returns {'overdue'|'due_soon'|'current'}
 */
export function computeInspectionStatus(nextDueDate, thresholdDays = 30, referenceDate = TODAY) {
  const diff = daysUntil(nextDueDate, referenceDate)
  if (diff < 0)               return 'overdue'
  if (diff <= thresholdDays)  return 'due_soon'
  return 'current'
}

export function inspectionStatusColor(status) {
  if (status === 'overdue')   return 'text-red-400'
  if (status === 'due_soon')  return 'text-amber-400'
  return 'text-green-400'
}

export function inspectionStatusBg(status) {
  if (status === 'overdue')   return 'bg-red-400/10 border-red-400/40 text-red-400'
  if (status === 'due_soon')  return 'bg-amber-400/10 border-amber-400/40 text-amber-400'
  return 'bg-green-400/10 border-green-400/40 text-green-400'
}

export function inspectionStatusLabel(status) {
  if (status === 'overdue')   return 'Overdue'
  if (status === 'due_soon')  return 'Due Soon'
  return 'Current'
}

// ─── Inspection type labels ───────────────────────────────────────────────────

export const INSPECTION_TYPE_LABELS = {
  annual:           'Annual Inspection',
  '100hr':          '100-Hour Inspection',
  altimeter_static: 'Altimeter / Static System',
  transponder:      'Transponder Check',
  elt_inspection:   'ELT Inspection',
  elt_battery:      'ELT Battery',
  vor_check:        'VOR Check (30-day)',
  pitot_static:     'Pitot-Static System',
}

// ─── Squawk helpers ───────────────────────────────────────────────────────────

export function squawkSeverityLabel(severity) {
  switch (severity) {
    case 'grounding':    return 'GROUNDING'
    case 'ops_limiting': return 'OPS LIMITING'
    case 'deferred':     return 'Deferred'
    case 'monitoring':   return 'Monitoring'
    default:             return severity
  }
}

export function squawkSeverityColor(severity) {
  switch (severity) {
    case 'grounding':    return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'ops_limiting': return 'text-amber-400 border-amber-400/40 bg-amber-400/10'
    case 'deferred':     return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    case 'monitoring':   return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    default:             return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
  }
}

export function squawkStatusLabel(status) {
  switch (status) {
    case 'open':         return 'Open'
    case 'in_progress':  return 'In Progress'
    case 'deferred_mel': return 'MEL Deferred'
    case 'closed':       return 'Closed'
    default:             return status
  }
}

export function squawkStatusColor(status) {
  switch (status) {
    case 'open':         return 'text-red-400'
    case 'in_progress':  return 'text-amber-400'
    case 'deferred_mel': return 'text-sky-400'
    case 'closed':       return 'text-green-400'
    default:             return 'text-slate-400'
  }
}

// ─── Work Order helpers ───────────────────────────────────────────────────────

export function workOrderPriorityLabel(priority) {
  switch (priority) {
    case 'aog':       return 'AOG'
    case 'urgent':    return 'Urgent'
    case 'routine':   return 'Routine'
    case 'scheduled': return 'Scheduled'
    default:          return priority
  }
}

export function workOrderPriorityColor(priority) {
  switch (priority) {
    case 'aog':       return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'urgent':    return 'text-amber-400 border-amber-400/40 bg-amber-400/10'
    case 'routine':   return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    case 'scheduled': return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    default:          return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
  }
}

export function workOrderStatusLabel(status) {
  switch (status) {
    case 'open':           return 'Open'
    case 'in_progress':    return 'In Progress'
    case 'parts_on_order': return 'Parts On Order'
    case 'completed':      return 'Completed'
    case 'deferred':       return 'Deferred'
    case 'cancelled':      return 'Cancelled'
    default:               return status
  }
}

export function workOrderStatusColor(status) {
  switch (status) {
    case 'open':           return 'text-red-400'
    case 'in_progress':    return 'text-amber-400'
    case 'parts_on_order': return 'text-sky-400'
    case 'completed':      return 'text-green-400'
    case 'deferred':       return 'text-slate-500'
    case 'cancelled':      return 'text-slate-600'
    default:               return 'text-slate-400'
  }
}

// ─── Component TBO helpers ────────────────────────────────────────────────────

/**
 * Compute component life as a percentage of TBO.
 * @param {number} currentAirframeHours  Current airframe hobbs
 * @param {number} hoursAtInstall        Airframe hours when component was installed
 * @param {number} tboHours              Manufacturer TBO in hours
 * @returns {number} 0–100+ (can exceed 100 if overdue)
 */
export function tboLifePercent(currentAirframeHours, hoursAtInstall, tboHours) {
  if (tboHours <= 0) return 0
  const hoursSinceInstall = currentAirframeHours - hoursAtInstall
  return Math.round((hoursSinceInstall / tboHours) * 100)
}

/**
 * Hours remaining until TBO.
 */
export function tboHoursRemaining(currentAirframeHours, hoursAtInstall, tboHours) {
  return Math.round(tboHours - (currentAirframeHours - hoursAtInstall))
}

export function tboLifeColor(pct) {
  if (pct >= 100)  return '#ef4444'  // red
  if (pct >= 85)   return '#f59e0b'  // amber
  if (pct >= 70)   return '#eab308'  // yellow
  return '#22c55e'                   // green
}

export function tboStatusFromPercent(pct) {
  if (pct >= 100)  return 'overdue'
  if (pct >= 85)   return 'due_soon'
  if (pct >= 70)   return 'monitoring'
  return 'normal'
}

// ─── Parts helpers ────────────────────────────────────────────────────────────

// Ordered pipeline for display (progress tracking)
export const PART_STATUS_PIPELINE = [
  'not_ordered',
  'ordered',
  'in_transit',
  'arrived',
  'installed',
]

export function partStatusLabel(status) {
  switch (status) {
    case 'not_ordered':  return 'Not Ordered'
    case 'ordered':      return 'Ordered'
    case 'in_transit':   return 'In Transit'
    case 'arrived':      return 'Arrived'
    case 'installed':    return 'Installed'
    case 'backordered':  return 'Backordered'
    case 'cancelled':    return 'Cancelled'
    default:             return status
  }
}

export function partStatusColor(status) {
  switch (status) {
    case 'not_ordered':  return 'text-slate-500 border-slate-500/40 bg-slate-500/10'
    case 'ordered':      return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    case 'in_transit':   return 'text-amber-400 border-amber-400/40 bg-amber-400/10'
    case 'arrived':      return 'text-green-400 border-green-400/40 bg-green-400/10'
    case 'installed':    return 'text-purple-400 border-purple-400/40 bg-purple-400/10'
    case 'backordered':  return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'cancelled':    return 'text-slate-600 border-slate-600/40 bg-slate-600/10'
    default:             return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
  }
}

/** Index of a status in the pipeline (for progress display). -1 for branch statuses. */
export function partPipelineStep(status) {
  return PART_STATUS_PIPELINE.indexOf(status)
}

/**
 * Summarise a list of parts for a work order into a short status string.
 * e.g. "3 parts — 1 arrived, 1 in transit, 1 ordered"
 */
export function partsSummary(parts) {
  if (!parts || parts.length === 0) return null
  const counts = {}
  for (const p of parts) {
    counts[p.status] = (counts[p.status] ?? 0) + 1
  }
  const installed    = counts.installed    ?? 0
  const arrived      = counts.arrived      ?? 0
  const inTransit    = counts.in_transit   ?? 0
  const ordered      = counts.ordered      ?? 0
  const notOrdered   = counts.not_ordered  ?? 0
  const backordered  = counts.backordered  ?? 0

  if (installed === parts.length) return `All ${parts.length} installed`
  const frags = []
  if (backordered > 0)  frags.push(`${backordered} backordered`)
  if (notOrdered > 0)   frags.push(`${notOrdered} not yet ordered`)
  if (ordered > 0)      frags.push(`${ordered} ordered`)
  if (inTransit > 0)    frags.push(`${inTransit} in transit`)
  if (arrived > 0)      frags.push(`${arrived} arrived`)
  if (installed > 0)    frags.push(`${installed} installed`)
  return `${parts.length} part${parts.length !== 1 ? 's' : ''} — ${frags.join(', ')}`
}

/** True if any part is blocking work (backordered, or not yet arrived for in-progress WO). */
export function hasPartsHold(parts) {
  if (!parts || parts.length === 0) return false
  return parts.some((p) => p.status === 'backordered' || p.status === 'ordered' || p.status === 'in_transit')
}

// ─── Work Order location helpers ──────────────────────────────────────────────

export function locationLabel(location) {
  switch (location) {
    case 'hangar':          return 'Hangar'
    case 'ramp':            return 'Ramp'
    case 'maintenance_bay': return 'Maint. Bay'
    case 'remote':          return 'Remote'
    case 'shop':            return 'Shop'
    default:                return location ?? '—'
  }
}

export function locationColor(location) {
  switch (location) {
    case 'maintenance_bay': return 'text-amber-400 border-amber-400/40 bg-amber-400/10'
    case 'hangar':          return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    case 'ramp':            return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    case 'remote':          return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'shop':            return 'text-purple-400 border-purple-400/40 bg-purple-400/10'
    default:                return 'text-slate-500 border-slate-500/40 bg-slate-500/10'
  }
}

// ─── Work Order hold-reason helpers ───────────────────────────────────────────

export function holdReasonLabel(reason) {
  switch (reason) {
    case 'queued':              return 'Queued'
    case 'awaiting_hangar':     return 'Awaiting Hangar Space'
    case 'awaiting_tech':       return 'Awaiting Technician'
    case 'parts_hold':          return 'Waiting on Parts'
    case 'priority_hold':       return 'Priority Hold'
    case 'awaiting_approval':   return 'Awaiting Approval'
    case 'weather':             return 'Weather Hold'
    case 'deferred_ops':        return 'Deferred — Ops'
    default:                    return reason ?? null
  }
}

export function holdReasonColor(reason) {
  switch (reason) {
    case 'queued':              return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    case 'awaiting_hangar':     return 'text-amber-400 border-amber-400/40 bg-amber-400/10'
    case 'awaiting_tech':       return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    case 'parts_hold':          return 'text-orange-400 border-orange-400/40 bg-orange-400/10'
    case 'priority_hold':       return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'awaiting_approval':   return 'text-purple-400 border-purple-400/40 bg-purple-400/10'
    case 'weather':             return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    case 'deferred_ops':        return 'text-slate-500 border-slate-500/40 bg-slate-500/10'
    default:                    return 'text-slate-500 border-slate-500/40 bg-slate-500/10'
  }
}

// ─── Personnel helpers ────────────────────────────────────────────────────────
// NOTE on FAA supervision: 14 CFR 43.3(d) requires that maintenance be performed
// by or under the direct supervision of a certificated A&P mechanic. This is a
// task-level designation that changes per work order — it is NOT organizational
// hierarchy.  The work order supervisorId identifies the A&P responsible for
// supervising that specific task and signing off the work per 14 CFR 43.9.
// For annual/100hr inspections, 14 CFR 65.95 requires an IA (Inspection
// Authorization) for return-to-service sign-off.

/**
 * Human-readable label for a person's physical location.
 * on_prem | off_site | on_leave | in_flight
 */
export function personnelLocationLabel(location) {
  switch (location) {
    case 'on_prem':   return 'On Premises'
    case 'off_site':  return 'Off Site'
    case 'on_leave':  return 'On Leave'
    case 'in_flight': return 'In Flight'
    default:          return location ?? '—'
  }
}

export function personnelLocationColor(location) {
  switch (location) {
    case 'on_prem':   return 'text-green-400 border-green-400/40 bg-green-400/10'
    case 'off_site':  return 'text-amber-400 border-amber-400/40 bg-amber-400/10'
    case 'on_leave':  return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    case 'in_flight': return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    default:          return 'text-slate-500 border-slate-500/40 bg-slate-500/10'
  }
}

/**
 * Capacity utilisation as a percentage.
 * @param {number} assigned  Hours committed this week
 * @param {number} capacity  Total weekly capacity
 */
export function capacityPercent(assigned, capacity) {
  if (!capacity || capacity <= 0) return 0
  return Math.min(Math.round((assigned / capacity) * 100), 100)
}

/** Tailwind color class for a capacity bar fill. */
export function capacityColor(pct) {
  if (pct >= 90) return 'bg-red-400'
  if (pct >= 70) return 'bg-amber-400'
  return 'bg-green-400'
}

/** Normalised short label for a mechanic's certificate type. */
export function certTypeLabel(certType) {
  if (!certType) return null
  if (certType.includes('IA'))     return 'A&P/IA'
  if (certType.includes('A&P'))    return 'A&P'
  if (certType.includes('Avionics') || certType.includes('AVN')) return 'Avionics'
  return certType
}

// ─── Aircraft location helpers ────────────────────────────────────────────────

/** Label for an aircraft's physical location (same enum as work order location). */
export function aircraftLocationLabel(location) {
  switch (location) {
    case 'hangar':          return 'Hangar'
    case 'ramp':            return 'Ramp'
    case 'maintenance_bay': return 'Maint. Bay'
    case 'remote':          return 'Remote'
    case 'shop':            return 'Shop'
    case 'in_flight':       return 'In Flight'
    default:                return location ?? '—'
  }
}

export function aircraftLocationColor(location) {
  switch (location) {
    case 'maintenance_bay': return 'text-red-400 border-red-400/40 bg-red-400/10'
    case 'hangar':          return 'text-sky-400 border-sky-400/40 bg-sky-400/10'
    case 'ramp':            return 'text-slate-400 border-slate-400/40 bg-slate-400/10'
    case 'remote':          return 'text-orange-400 border-orange-400/40 bg-orange-400/10'
    case 'shop':            return 'text-purple-400 border-purple-400/40 bg-purple-400/10'
    case 'in_flight':       return 'text-green-400 border-green-400/40 bg-green-400/10'
    default:                return 'text-slate-500 border-slate-500/40 bg-slate-500/10'
  }
}

// ─── Movement log helpers ─────────────────────────────────────────────────────

export function moveTypeLabel(moveType) {
  switch (moveType) {
    case 'ground_tow':   return 'Ground Tow'
    case 'flight':       return 'Flight'
    case 'repositioned': return 'Repositioned'
    case 'ferry':        return 'Ferry Flight'
    default:             return moveType ?? '—'
  }
}

export function moveTypeColor(moveType) {
  switch (moveType) {
    case 'ground_tow':   return 'text-amber-400'
    case 'flight':       return 'text-sky-400'
    case 'repositioned': return 'text-slate-400'
    case 'ferry':        return 'text-purple-400'
    default:             return 'text-slate-500'
  }
}

// ─── Work order active status ─────────────────────────────────────────────────

/**
 * Elapsed time string from a past ISO datetime to the reference "now".
 * e.g.  '2026-03-20T09:15:00' → '8d 1h'
 */
export function elapsedDuration(startedAt, refDatetime = REF_DATETIME) {
  if (!startedAt) return null
  const diffMs  = new Date(refDatetime).getTime() - new Date(startedAt).getTime()
  if (diffMs <= 0) return null
  const totalMins = Math.floor(diffMs / 60000)
  const days  = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins  = totalMins % 60
  if (days > 0)  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return mins  > 0 ? `${hours}h ${mins}m` : `${hours}h`
  return `${mins}m`
}

/**
 * Returns a descriptive status object for an open work order.
 * Priority: accruingHours (active) → parts_on_order (parts ETA) →
 *           awaiting_tech (scheduledDate) → queued → unassigned → waiting.
 *
 * @param {object} wo       - work order record
 * @param {object[]} allParts - full parts array (to look up ETAs by workOrderId)
 * @param {string} refDate  - ISO date for daysUntil calculations (default TODAY)
 * @returns {{ type: string, label: string, color: string } | null}
 *   null for completed / cancelled orders.
 */
export function woActiveStatus(wo, allParts = [], refDate = TODAY) {
  if (wo.status === 'completed' || wo.status === 'cancelled') return null

  // Active labor
  if (wo.accruingHours) {
    const dur = elapsedDuration(wo.startedAt)
    return {
      type:  'active',
      label: dur ? `Active ${dur}` : 'Active',
      color: 'text-amber-400',
    }
  }

  // Waiting on parts
  if (wo.status === 'parts_on_order') {
    const pending = allParts.filter(
      (p) => p.workOrderId === wo.id &&
             (p.status === 'ordered' || p.status === 'in_transit') &&
             p.etaDate
    )
    if (pending.length > 0) {
      const soonest = [...pending].sort((a, b) => a.etaDate.localeCompare(b.etaDate))[0]
      const days    = daysUntil(soonest.etaDate, refDate)
      if (days < 0)  return { type: 'parts_overdue', label: 'Parts overdue',   color: 'text-red-400' }
      if (days === 0) return { type: 'parts_today',  label: 'Parts today',      color: 'text-green-400' }
      return           { type: 'parts',             label: `Parts in ${days}d`, color: 'text-sky-400' }
    }
    return { type: 'parts', label: 'Parts on order', color: 'text-sky-400' }
  }

  // Awaiting tech with a known scheduled date
  if (wo.holdReason === 'awaiting_tech' && wo.scheduledDate) {
    const days = daysUntil(wo.scheduledDate, refDate)
    if (days <= 0) return { type: 'tech_due',  label: 'Tech on-site',    color: 'text-green-400' }
    return           { type: 'tech',           label: `Tech in ${days}d`, color: 'text-sky-400' }
  }

  // Queued (with or without queue position)
  if (wo.holdReason === 'queued') {
    const pos = wo.queuePosition != null ? ` #${wo.queuePosition}` : ''
    return { type: 'queued', label: `Queue${pos}`, color: 'text-slate-400' }
  }

  // No technician assigned
  if (!wo.assignedPersonnelIds || wo.assignedPersonnelIds.length === 0) {
    return { type: 'unassigned', label: '⚠ Unassigned', color: 'text-amber-400' }
  }

  return { type: 'waiting', label: 'Waiting', color: 'text-slate-500' }
}

// ─── Aircraft hours lookup ────────────────────────────────────────────────────
// Maps tail numbers to current airframe hours (from aircraft registry mock).
export const CURRENT_AIRFRAME_HOURS = {
  'N12345': 2840,
  'N67890': 1120,
  'N11111': 3415,
  'N22222': 5220,
  'N33333': 6810,
  'N44444': 2105,
  'N55555': 1890,
}
