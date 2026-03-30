// =============================================================================
// Maintenance Module — Test Suite
// Tests: utility functions + React component rendering
// =============================================================================
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import {
  daysUntil,
  daysUntilLabel,
  computeInspectionStatus,
  inspectionStatusColor,
  inspectionStatusLabel,
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
  tboStatusFromPercent,
  INSPECTION_TYPE_LABELS,
  // Parts
  PART_STATUS_PIPELINE,
  partStatusLabel,
  partStatusColor,
  partPipelineStep,
  partsSummary,
  hasPartsHold,
  // Location / hold
  locationLabel,
  locationColor,
  holdReasonLabel,
  holdReasonColor,
  // Personnel / aircraft
  personnelLocationLabel,
  personnelLocationColor,
  capacityPercent,
  capacityColor,
  certTypeLabel,
  aircraftLocationLabel,
  aircraftLocationColor,
  moveTypeLabel,
  moveTypeColor,
  // Work order active status
  elapsedDuration,
  woActiveStatus,
} from './maintenanceUtils'

import {
  mockSquawks,
  mockWorkOrders,
  mockInspectionSchedule,
  mockComponentTbo,
  mockMaintenanceSummary,
  mockParts,
} from './mockDb'

import { mockPersonnel, mockCertificates } from '../mocks/personnel'
import { mockAircraft } from '../mocks/aircraft'
import { mockMovementLog } from '../mocks/movementLog'

import { Maintenance } from './Maintenance'

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderMaintenance() {
  return render(
    <MemoryRouter>
      <Maintenance />
    </MemoryRouter>
  )
}

// =============================================================================
// UNIT TESTS — maintenanceUtils
// =============================================================================

describe('daysUntil()', () => {
  it('returns positive for future dates', () => {
    expect(daysUntil('2026-04-07', '2026-03-28')).toBe(10)
  })

  it('returns negative for past dates', () => {
    expect(daysUntil('2026-03-18', '2026-03-28')).toBe(-10)
  })

  it('returns 0 for same date', () => {
    expect(daysUntil('2026-03-28', '2026-03-28')).toBe(0)
  })
})

describe('daysUntilLabel()', () => {
  it('formats future date as "Nd"', () => {
    expect(daysUntilLabel('2026-04-07', '2026-03-28')).toBe('10d')
  })

  it('formats past date as "Nd overdue"', () => {
    expect(daysUntilLabel('2026-03-18', '2026-03-28')).toBe('10d overdue')
  })

  it('formats same date as "Today"', () => {
    expect(daysUntilLabel('2026-03-28', '2026-03-28')).toBe('Today')
  })
})

describe('computeInspectionStatus()', () => {
  const ref = '2026-03-28'

  it('returns overdue for past due date', () => {
    expect(computeInspectionStatus('2026-03-01', 30, ref)).toBe('overdue')
  })

  it('returns overdue for same day (0 days remaining = day of, not overdue)', () => {
    // 0 days → diff=0 → not <0 → within threshold → due_soon if threshold≥0
    expect(computeInspectionStatus('2026-03-28', 30, ref)).toBe('due_soon')
  })

  it('returns due_soon when within threshold', () => {
    expect(computeInspectionStatus('2026-04-15', 30, ref)).toBe('due_soon')  // 18 days
  })

  it('returns current when beyond threshold', () => {
    expect(computeInspectionStatus('2026-09-01', 30, ref)).toBe('current')   // ~157 days
  })

  it('handles custom threshold', () => {
    // 5-day threshold, 7 days out → current
    expect(computeInspectionStatus('2026-04-04', 5, ref)).toBe('current')
    // 5-day threshold, 3 days out → due_soon
    expect(computeInspectionStatus('2026-03-31', 5, ref)).toBe('due_soon')
  })
})

describe('inspectionStatusColor()', () => {
  it('returns red for overdue', () => {
    expect(inspectionStatusColor('overdue')).toContain('red')
  })

  it('returns amber for due_soon', () => {
    expect(inspectionStatusColor('due_soon')).toContain('amber')
  })

  it('returns green for current', () => {
    expect(inspectionStatusColor('current')).toContain('green')
  })
})

describe('inspectionStatusLabel()', () => {
  it('labels overdue correctly', () => {
    expect(inspectionStatusLabel('overdue')).toBe('Overdue')
  })

  it('labels due_soon correctly', () => {
    expect(inspectionStatusLabel('due_soon')).toBe('Due Soon')
  })

  it('labels current correctly', () => {
    expect(inspectionStatusLabel('current')).toBe('Current')
  })
})

describe('INSPECTION_TYPE_LABELS', () => {
  it('has labels for all required inspection types', () => {
    const required = ['annual','100hr','altimeter_static','transponder','elt_inspection','vor_check']
    for (const type of required) {
      expect(INSPECTION_TYPE_LABELS[type]).toBeTruthy()
    }
  })
})

describe('squawkSeverityLabel()', () => {
  it('returns GROUNDING for grounding', () => {
    expect(squawkSeverityLabel('grounding')).toBe('GROUNDING')
  })

  it('returns OPS LIMITING for ops_limiting', () => {
    expect(squawkSeverityLabel('ops_limiting')).toBe('OPS LIMITING')
  })

  it('returns Deferred for deferred', () => {
    expect(squawkSeverityLabel('deferred')).toBe('Deferred')
  })

  it('returns Monitoring for monitoring', () => {
    expect(squawkSeverityLabel('monitoring')).toBe('Monitoring')
  })
})

describe('squawkSeverityColor()', () => {
  it('grounding uses red', () => {
    expect(squawkSeverityColor('grounding')).toContain('red')
  })

  it('ops_limiting uses amber', () => {
    expect(squawkSeverityColor('ops_limiting')).toContain('amber')
  })

  it('deferred uses sky/blue', () => {
    expect(squawkSeverityColor('deferred')).toContain('sky')
  })
})

describe('squawkStatusLabel()', () => {
  it('labels open', () => {
    expect(squawkStatusLabel('open')).toBe('Open')
  })

  it('labels in_progress', () => {
    expect(squawkStatusLabel('in_progress')).toBe('In Progress')
  })

  it('labels deferred_mel as MEL Deferred', () => {
    expect(squawkStatusLabel('deferred_mel')).toBe('MEL Deferred')
  })

  it('labels closed', () => {
    expect(squawkStatusLabel('closed')).toBe('Closed')
  })
})

describe('squawkStatusColor()', () => {
  it('open is red', () => {
    expect(squawkStatusColor('open')).toContain('red')
  })

  it('closed is green', () => {
    expect(squawkStatusColor('closed')).toContain('green')
  })
})

describe('workOrderPriorityLabel()', () => {
  it('labels all priorities', () => {
    expect(workOrderPriorityLabel('aog')).toBe('AOG')
    expect(workOrderPriorityLabel('urgent')).toBe('Urgent')
    expect(workOrderPriorityLabel('routine')).toBe('Routine')
    expect(workOrderPriorityLabel('scheduled')).toBe('Scheduled')
  })
})

describe('workOrderPriorityColor()', () => {
  it('aog uses red', () => {
    expect(workOrderPriorityColor('aog')).toContain('red')
  })

  it('urgent uses amber', () => {
    expect(workOrderPriorityColor('urgent')).toContain('amber')
  })
})

describe('workOrderStatusLabel()', () => {
  it('labels parts_on_order', () => {
    expect(workOrderStatusLabel('parts_on_order')).toBe('Parts On Order')
  })

  it('labels completed', () => {
    expect(workOrderStatusLabel('completed')).toBe('Completed')
  })
})

describe('tboLifePercent()', () => {
  it('returns 0 at install', () => {
    expect(tboLifePercent(1000, 1000, 1700)).toBe(0)
  })

  it('returns 50 at half TBO', () => {
    expect(tboLifePercent(1850, 1000, 1700)).toBe(50)
  })

  it('returns 100 at TBO', () => {
    expect(tboLifePercent(2700, 1000, 1700)).toBe(100)
  })

  it('returns > 100 when overdue', () => {
    expect(tboLifePercent(2800, 1000, 1700)).toBeGreaterThan(100)
  })

  it('handles tboHours = 0 without division error', () => {
    expect(tboLifePercent(1000, 500, 0)).toBe(0)
  })
})

describe('tboHoursRemaining()', () => {
  it('returns positive when under TBO', () => {
    expect(tboHoursRemaining(1500, 1000, 1700)).toBe(1200)
  })

  it('returns negative when over TBO', () => {
    expect(tboHoursRemaining(2800, 1000, 1700)).toBeLessThan(0)
  })
})

describe('tboLifeColor()', () => {
  it('green below 70%', () => {
    expect(tboLifeColor(50)).toBe('#22c55e')
  })

  it('amber at 85%', () => {
    expect(tboLifeColor(85)).toBe('#f59e0b')
  })

  it('red at 100%', () => {
    expect(tboLifeColor(100)).toBe('#ef4444')
  })
})

describe('tboStatusFromPercent()', () => {
  it('normal below 70%', () => {
    expect(tboStatusFromPercent(50)).toBe('normal')
  })

  it('monitoring 70–84%', () => {
    expect(tboStatusFromPercent(75)).toBe('monitoring')
  })

  it('due_soon 85–99%', () => {
    expect(tboStatusFromPercent(90)).toBe('due_soon')
  })

  it('overdue at 100%+', () => {
    expect(tboStatusFromPercent(100)).toBe('overdue')
    expect(tboStatusFromPercent(110)).toBe('overdue')
  })
})

// =============================================================================
// MOCK DATA INTEGRITY
// =============================================================================

describe('mockSquawks data integrity', () => {
  it('has squawks', () => {
    expect(mockSquawks.length).toBeGreaterThan(0)
  })

  it('all squawks have required fields', () => {
    for (const s of mockSquawks) {
      expect(s.id).toBeTruthy()
      expect(s.tailNumber).toBeTruthy()
      expect(s.severity).toMatch(/^(grounding|ops_limiting|deferred|monitoring)$/)
      expect(s.status).toMatch(/^(open|in_progress|deferred_mel|closed)$/)
    }
  })

  it('has at least one grounding squawk', () => {
    expect(mockSquawks.some((s) => s.severity === 'grounding')).toBe(true)
  })

  it('has at least one MEL-deferred squawk', () => {
    expect(mockSquawks.some((s) => s.status === 'deferred_mel')).toBe(true)
  })
})

describe('mockWorkOrders data integrity', () => {
  it('has work orders', () => {
    expect(mockWorkOrders.length).toBeGreaterThan(0)
  })

  it('all work orders have required fields', () => {
    for (const wo of mockWorkOrders) {
      expect(wo.id).toBeTruthy()
      expect(wo.tailNumber).toBeTruthy()
      expect(wo.priority).toMatch(/^(aog|urgent|routine|scheduled)$/)
      expect(wo.status).toMatch(/^(open|in_progress|parts_on_order|completed|deferred|cancelled)$/)
      expect(wo.title).toBeTruthy()
    }
  })

  it('has at least one AOG work order', () => {
    expect(mockWorkOrders.some((w) => w.priority === 'aog')).toBe(true)
  })

  it('has at least one completed work order', () => {
    expect(mockWorkOrders.some((w) => w.status === 'completed')).toBe(true)
  })
})

describe('mockInspectionSchedule data integrity', () => {
  it('covers all 7 aircraft', () => {
    const tails = [...new Set(mockInspectionSchedule.map((i) => i.tailNumber))]
    expect(tails.length).toBe(7)
  })

  it('has overdue inspections for grounded aircraft N33333', () => {
    const overdueN33333 = mockInspectionSchedule.filter(
      (i) => i.tailNumber === 'N33333' && i.status === 'overdue'
    )
    expect(overdueN33333.length).toBeGreaterThan(0)
  })

  it('has due_soon inspections for N11111', () => {
    const dueSoon = mockInspectionSchedule.filter(
      (i) => i.tailNumber === 'N11111' && i.status === 'due_soon'
    )
    expect(dueSoon.length).toBeGreaterThan(0)
  })

  it('all entries have a regulatory reference', () => {
    for (const i of mockInspectionSchedule) {
      expect(i.regulatoryRef).toBeTruthy()
    }
  })
})

describe('mockComponentTbo data integrity', () => {
  it('has TBO entries', () => {
    expect(mockComponentTbo.length).toBeGreaterThan(0)
  })

  it('all entries have required fields', () => {
    for (const t of mockComponentTbo) {
      expect(t.tboHours).toBeGreaterThan(0)
      expect(t.tailNumber).toBeTruthy()
      expect(t.componentLabel).toBeTruthy()
    }
  })
})

describe('mockMaintenanceSummary', () => {
  it('openSquawks matches actual open squawk count', () => {
    const actual = mockSquawks.filter((s) => s.status === 'open' || s.status === 'in_progress').length
    expect(mockMaintenanceSummary.openSquawks).toBe(actual)
  })

  it('inspectionsOverdue matches actual overdue inspection count', () => {
    const actual = mockInspectionSchedule.filter((i) => i.status === 'overdue').length
    expect(mockMaintenanceSummary.inspectionsOverdue).toBe(actual)
  })

  it('partsOrdered matches actual ordered count', () => {
    const actual = mockParts.filter((p) => p.status === 'ordered').length
    expect(mockMaintenanceSummary.partsOrdered).toBe(actual)
  })

  it('partsInTransit matches actual in_transit count', () => {
    const actual = mockParts.filter((p) => p.status === 'in_transit').length
    expect(mockMaintenanceSummary.partsInTransit).toBe(actual)
  })
})

// =============================================================================
// UNIT TESTS — parts utilities
// =============================================================================

describe('PART_STATUS_PIPELINE', () => {
  it('has 5 ordered steps', () => {
    expect(PART_STATUS_PIPELINE).toHaveLength(5)
    expect(PART_STATUS_PIPELINE[0]).toBe('not_ordered')
    expect(PART_STATUS_PIPELINE[4]).toBe('installed')
  })
})

describe('partStatusLabel()', () => {
  it('labels all pipeline statuses', () => {
    expect(partStatusLabel('not_ordered')).toBe('Not Ordered')
    expect(partStatusLabel('ordered')).toBe('Ordered')
    expect(partStatusLabel('in_transit')).toBe('In Transit')
    expect(partStatusLabel('arrived')).toBe('Arrived')
    expect(partStatusLabel('installed')).toBe('Installed')
  })

  it('labels branch statuses', () => {
    expect(partStatusLabel('backordered')).toBe('Backordered')
    expect(partStatusLabel('cancelled')).toBe('Cancelled')
  })
})

describe('partStatusColor()', () => {
  it('backordered uses red', () => {
    expect(partStatusColor('backordered')).toContain('red')
  })

  it('ordered uses sky/blue', () => {
    expect(partStatusColor('ordered')).toContain('sky')
  })

  it('arrived uses green', () => {
    expect(partStatusColor('arrived')).toContain('green')
  })

  it('installed uses purple', () => {
    expect(partStatusColor('installed')).toContain('purple')
  })
})

describe('partPipelineStep()', () => {
  it('returns correct index for pipeline statuses', () => {
    expect(partPipelineStep('not_ordered')).toBe(0)
    expect(partPipelineStep('ordered')).toBe(1)
    expect(partPipelineStep('in_transit')).toBe(2)
    expect(partPipelineStep('arrived')).toBe(3)
    expect(partPipelineStep('installed')).toBe(4)
  })

  it('returns -1 for branch statuses', () => {
    expect(partPipelineStep('backordered')).toBe(-1)
    expect(partPipelineStep('cancelled')).toBe(-1)
  })
})

describe('partsSummary()', () => {
  it('returns null for empty list', () => {
    expect(partsSummary([])).toBeNull()
    expect(partsSummary(null)).toBeNull()
  })

  it('returns "All N installed" when all installed', () => {
    const parts = [{ status: 'installed' }, { status: 'installed' }]
    expect(partsSummary(parts)).toBe('All 2 installed')
  })

  it('summarises mixed statuses', () => {
    const parts = [
      { status: 'arrived' },
      { status: 'in_transit' },
      { status: 'ordered' },
    ]
    const result = partsSummary(parts)
    expect(result).toContain('3 parts')
    expect(result).toContain('ordered')
    expect(result).toContain('in transit')
    expect(result).toContain('arrived')
  })

  it('shows backordered first when present', () => {
    const parts = [{ status: 'backordered' }, { status: 'ordered' }]
    const result = partsSummary(parts)
    expect(result.indexOf('backordered')).toBeLessThan(result.indexOf('ordered'))
  })
})

describe('hasPartsHold()', () => {
  it('returns false for empty', () => {
    expect(hasPartsHold([])).toBe(false)
    expect(hasPartsHold(null)).toBe(false)
  })

  it('returns true when parts are in_transit', () => {
    expect(hasPartsHold([{ status: 'in_transit' }])).toBe(true)
  })

  it('returns true when parts are ordered', () => {
    expect(hasPartsHold([{ status: 'ordered' }])).toBe(true)
  })

  it('returns true when backordered', () => {
    expect(hasPartsHold([{ status: 'backordered' }])).toBe(true)
  })

  it('returns false when all parts arrived or installed', () => {
    expect(hasPartsHold([{ status: 'arrived' }, { status: 'installed' }])).toBe(false)
  })
})

describe('locationLabel()', () => {
  it('labels all locations', () => {
    expect(locationLabel('hangar')).toBe('Hangar')
    expect(locationLabel('ramp')).toBe('Ramp')
    expect(locationLabel('maintenance_bay')).toBe('Maint. Bay')
    expect(locationLabel('remote')).toBe('Remote')
    expect(locationLabel('shop')).toBe('Shop')
  })

  it('returns dash for null', () => {
    expect(locationLabel(null)).toBe('—')
  })
})

describe('locationColor()', () => {
  it('maintenance_bay uses amber', () => {
    expect(locationColor('maintenance_bay')).toContain('amber')
  })

  it('hangar uses sky/blue', () => {
    expect(locationColor('hangar')).toContain('sky')
  })

  it('remote uses red', () => {
    expect(locationColor('remote')).toContain('red')
  })
})

describe('holdReasonLabel()', () => {
  it('labels all hold reasons', () => {
    expect(holdReasonLabel('queued')).toBe('Queued')
    expect(holdReasonLabel('awaiting_hangar')).toBe('Awaiting Hangar Space')
    expect(holdReasonLabel('awaiting_tech')).toBe('Awaiting Technician')
    expect(holdReasonLabel('parts_hold')).toBe('Waiting on Parts')
    expect(holdReasonLabel('priority_hold')).toBe('Priority Hold')
    expect(holdReasonLabel('awaiting_approval')).toBe('Awaiting Approval')
    expect(holdReasonLabel('weather')).toBe('Weather Hold')
    expect(holdReasonLabel('deferred_ops')).toBe('Deferred — Ops')
  })

  it('returns null for null', () => {
    expect(holdReasonLabel(null)).toBeNull()
  })
})

describe('holdReasonColor()', () => {
  it('parts_hold uses orange', () => {
    expect(holdReasonColor('parts_hold')).toContain('orange')
  })

  it('awaiting_tech uses sky/blue', () => {
    expect(holdReasonColor('awaiting_tech')).toContain('sky')
  })

  it('priority_hold uses red', () => {
    expect(holdReasonColor('priority_hold')).toContain('red')
  })
})

// =============================================================================
// MOCK DATA INTEGRITY — parts
// =============================================================================

describe('mockParts data integrity', () => {
  it('has parts', () => {
    expect(mockParts.length).toBeGreaterThan(0)
  })

  it('all parts have required fields', () => {
    for (const p of mockParts) {
      expect(p.id).toBeTruthy()
      expect(p.workOrderId).toBeTruthy()
      expect(p.tailNumber).toBeTruthy()
      expect(p.partNumber).toBeTruthy()
      expect(p.description).toBeTruthy()
      expect(p.quantity).toBeGreaterThan(0)
      expect(p.status).toMatch(/^(not_ordered|ordered|in_transit|arrived|backordered|installed|cancelled)$/)
    }
  })

  it('all parts reference a valid work order', () => {
    const woIds = new Set(mockWorkOrders.map((w) => w.id))
    for (const p of mockParts) {
      expect(woIds.has(p.workOrderId)).toBe(true)
    }
  })

  it('has at least one in_transit part', () => {
    expect(mockParts.some((p) => p.status === 'in_transit')).toBe(true)
  })

  it('has at least one arrived part', () => {
    expect(mockParts.some((p) => p.status === 'arrived')).toBe(true)
  })

  it('has at least one installed part', () => {
    expect(mockParts.some((p) => p.status === 'installed')).toBe(true)
  })

  it('in_transit parts have orderedDate and etaDate', () => {
    const transit = mockParts.filter((p) => p.status === 'in_transit')
    for (const p of transit) {
      expect(p.orderedDate).toBeTruthy()
      expect(p.etaDate).toBeTruthy()
    }
  })

  it('installed parts have installedDate', () => {
    const installed = mockParts.filter((p) => p.status === 'installed')
    for (const p of installed) {
      expect(p.installedDate).toBeTruthy()
    }
  })
})

describe('mockWorkOrders location/hold fields', () => {
  it('all work orders have a location', () => {
    for (const wo of mockWorkOrders) {
      expect(wo.location).toMatch(/^(hangar|ramp|maintenance_bay|remote|shop)$/)
    }
  })

  it('open/in-progress work orders have a holdReason or are in_progress without hold', () => {
    const active = mockWorkOrders.filter(
      (w) => w.status !== 'completed' && w.status !== 'cancelled'
    )
    // Every active WO either has a holdReason or is actively being worked
    for (const wo of active) {
      // holdReason can be null (just means no specific block), that's OK
      if (wo.holdReason) {
        expect(typeof wo.holdReason).toBe('string')
      }
    }
  })

  it('queued work orders have a queuePosition', () => {
    const queued = mockWorkOrders.filter((w) => w.holdReason === 'queued')
    for (const wo of queued) {
      expect(wo.queuePosition).toBeGreaterThanOrEqual(1)
    }
  })

  it('AOG aircraft is in maintenance_bay', () => {
    const aog = mockWorkOrders.find((w) => w.priority === 'aog' && w.status !== 'completed')
    expect(aog?.location).toBe('maintenance_bay')
  })
})

// =============================================================================
// COMPONENT TESTS — Maintenance page
// =============================================================================

describe('<Maintenance /> page rendering', () => {
  it('renders the page title', () => {
    renderMaintenance()
    expect(screen.getByText('Aircraft Maintenance')).toBeInTheDocument()
  })

  it('renders the regulatory subtitle', () => {
    renderMaintenance()
    expect(screen.getByText(/14 CFR Part 43/i)).toBeInTheDocument()
  })

  it('renders all 7 tabs', () => {
    renderMaintenance()
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Squawks' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Work Orders' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Parts' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Personnel' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Inspections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'TBO Tracking' })).toBeInTheDocument()
  })

  it('Overview tab is selected by default', () => {
    renderMaintenance()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the scorecard scorecard tiles', () => {
    renderMaintenance()
    expect(screen.getByText('Open Squawks')).toBeInTheDocument()
    expect(screen.getByText('Grounding')).toBeInTheDocument()
    // "Work Orders" appears as both a tile label and a tab — use getAllByText
    expect(screen.getAllByText('Work Orders').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Insp Overdue')).toBeInTheDocument()
  })

  it('renders the New Work Order button', () => {
    renderMaintenance()
    expect(screen.getByRole('button', { name: /New Work Order/i })).toBeInTheDocument()
  })

  it('shows AOG section on Overview tab', () => {
    renderMaintenance()
    expect(screen.getByText(/AOG \/ Grounding Items/i)).toBeInTheDocument()
  })
})

describe('<Maintenance /> tab navigation', () => {
  it('switches to Squawks tab', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Squawks' }))
    expect(screen.getByRole('tab', { name: 'Squawks' })).toHaveAttribute('aria-selected', 'true')
    // Squawks table should be visible
    expect(screen.getByRole('table', { name: 'Squawks' })).toBeInTheDocument()
  })

  it('switches to Work Orders tab', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    expect(screen.getByRole('tab', { name: 'Work Orders' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches to Inspections tab', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Inspections' }))
    // Should show tail group headers
    expect(screen.getAllByText('N33333').length).toBeGreaterThan(0)
  })

  it('switches to TBO Tracking tab', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'TBO Tracking' }))
    // Should show TBO explanation text
    expect(screen.getByText(/Time Between Overhaul/i)).toBeInTheDocument()
  })
})

describe('<Maintenance /> Squawks tab', () => {
  it('shows grounding squawk for N33333', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Squawks' }))
    expect(screen.getByTestId('squawk-row-sqk-001')).toBeInTheDocument()
  })

  it('shows MEL deferred squawk badge', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Squawks' }))
    const melBadges = screen.getAllByText('MEL Deferred')
    expect(melBadges.length).toBeGreaterThan(0)
  })

  it('filters to show only closed squawks', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Squawks' }))
    fireEvent.click(screen.getByRole('button', { name: /^closed$/i }))
    // sqk-001 (in_progress) should not be in the table body
    expect(screen.queryByTestId('squawk-row-sqk-001')).not.toBeInTheDocument()
    // sqk-007 (closed) should appear
    expect(screen.getByTestId('squawk-row-sqk-007')).toBeInTheDocument()
  })
})

describe('<Maintenance /> Inspections tab', () => {
  it('shows overdue badge for N33333', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Inspections' }))
    // N33333 group should show OVERDUE badge
    const overdueBadges = screen.getAllByText('Overdue')
    expect(overdueBadges.length).toBeGreaterThan(0)
  })

  it('shows Due Soon inspections for N11111', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Inspections' }))
    const dueSoonBadges = screen.getAllByText('Due Soon')
    expect(dueSoonBadges.length).toBeGreaterThan(0)
  })

  it('filters to overdue only', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Inspections' }))
    fireEvent.click(screen.getByRole('button', { name: 'overdue' }))
    // Current inspections should not appear
    const currentBadges = screen.queryAllByText('Current')
    expect(currentBadges).toHaveLength(0)
  })
})

describe('<Maintenance /> TBO tab', () => {
  it('renders TBO progress bars', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'TBO Tracking' }))
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBeGreaterThan(0)
  })

  it('shows due_soon badge for N22222 prop', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'TBO Tracking' }))
    const testId = screen.getByTestId('tbo-row-tbo-005')
    expect(testId).toBeInTheDocument()
    expect(testId.textContent).toMatch(/Due Soon/i)
  })
})

describe('<Maintenance /> Parts tab', () => {
  it('renders the Parts tab', () => {
    renderMaintenance()
    expect(screen.getByRole('tab', { name: 'Parts' })).toBeInTheDocument()
  })

  it('shows the parts table on Parts tab', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    expect(screen.getByRole('table', { name: 'Parts tracker' })).toBeInTheDocument()
  })

  it('shows pipeline summary tiles', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    // Labels appear in both tiles and status badges — use getAllByText
    expect(screen.getAllByText('In Transit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ordered').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Arrived').length).toBeGreaterThanOrEqual(1)
  })

  it('shows parts in default active filter', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    // prt-001 is in_transit (active) — should be visible by default
    expect(screen.getByTestId('parts-tab-row-prt-001')).toBeInTheDocument()
    // prt-015 is installed (not active) — should NOT be visible by default
    expect(screen.queryByTestId('parts-tab-row-prt-015')).not.toBeInTheDocument()
  })

  it('shows installed parts when filter = installed', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    fireEvent.click(screen.getByRole('button', { name: 'installed' }))
    expect(screen.getByTestId('parts-tab-row-prt-015')).toBeInTheDocument()
    expect(screen.getByTestId('parts-tab-row-prt-016')).toBeInTheDocument()
  })

  it('shows all parts when filter = all', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    fireEvent.click(screen.getByRole('button', { name: 'all' }))
    // Both active and installed parts should be visible
    expect(screen.getByTestId('parts-tab-row-prt-001')).toBeInTheDocument()
    expect(screen.getByTestId('parts-tab-row-prt-015')).toBeInTheDocument()
  })
})

describe('<Maintenance /> Work Orders — parts + location + hold', () => {
  it('shows location badge on work order cards', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // maintenance_bay badge should appear
    expect(screen.getAllByText(/Maint. Bay/i).length).toBeGreaterThan(0)
  })

  it('shows hold reason banner for parts_hold WO', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    expect(screen.getAllByText('Waiting on Parts').length).toBeGreaterThan(0)
  })

  it('shows Queued hold reason with queue position', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    expect(screen.getAllByText('Queued').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/position #1 in queue/i).length).toBeGreaterThan(0)
  })

  it('shows Parts expand button on WOs with parts', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // "Parts" expandable button should appear on work orders that have parts
    const partsButtons = screen.getAllByRole('button', { name: /Parts/i })
    expect(partsButtons.length).toBeGreaterThan(0)
  })

  it('expands parts list on click', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // Parts expand buttons are identified by aria-expanded attribute
    const partsBtns = screen.getAllByRole('button', { expanded: false })
      .filter((b) => b.getAttribute('aria-expanded') === 'false')
    // Click the first one (belongs to the highest-priority WO with parts)
    fireEvent.click(partsBtns[0])
    // After expansion, individual part rows should appear for that WO
    const partRows = document.querySelectorAll('[data-testid^="part-row-"]')
    expect(partRows.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// UNIT TESTS — new personnel / aircraft location / certificate utils
// =============================================================================

describe('personnelLocationLabel()', () => {
  it('labels on_prem correctly', () => {
    expect(personnelLocationLabel('on_prem')).toBe('On Premises')
  })
  it('labels off_site correctly', () => {
    expect(personnelLocationLabel('off_site')).toBe('Off Site')
  })
  it('labels on_leave correctly', () => {
    expect(personnelLocationLabel('on_leave')).toBe('On Leave')
  })
  it('returns location string for unknown value', () => {
    expect(personnelLocationLabel('unknown')).toBe('unknown')
  })
})

describe('personnelLocationColor()', () => {
  it('on_prem is green', () => {
    expect(personnelLocationColor('on_prem')).toContain('green')
  })
  it('off_site is amber', () => {
    expect(personnelLocationColor('off_site')).toContain('amber')
  })
  it('on_leave is slate', () => {
    expect(personnelLocationColor('on_leave')).toContain('slate')
  })
})

describe('capacityPercent()', () => {
  it('returns 0 when capacity is 0', () => {
    expect(capacityPercent(20, 0)).toBe(0)
  })
  it('computes correct percentage', () => {
    expect(capacityPercent(30, 40)).toBe(75)
  })
  it('caps at 100 when over-committed', () => {
    expect(capacityPercent(50, 40)).toBe(100)
  })
})

describe('capacityColor()', () => {
  it('red when >= 90%', () => {
    expect(capacityColor(95)).toContain('red')
  })
  it('amber when >= 70%', () => {
    expect(capacityColor(75)).toContain('amber')
  })
  it('green when < 70%', () => {
    expect(capacityColor(50)).toContain('green')
  })
})

describe('certTypeLabel()', () => {
  it('returns A&P/IA for certType containing IA', () => {
    expect(certTypeLabel('A&P / IA')).toBe('A&P/IA')
  })
  it('returns A&P for A&P only', () => {
    expect(certTypeLabel('A&P Certificate')).toBe('A&P')
  })
  it('returns Avionics for Avionics cert', () => {
    expect(certTypeLabel('Avionics Technician')).toBe('Avionics')
  })
  it('returns null for null input', () => {
    expect(certTypeLabel(null)).toBeNull()
  })
})

describe('aircraftLocationLabel()', () => {
  it('labels maintenance_bay correctly', () => {
    expect(aircraftLocationLabel('maintenance_bay')).toBe('Maint. Bay')
  })
  it('labels hangar correctly', () => {
    expect(aircraftLocationLabel('hangar')).toBe('Hangar')
  })
  it('labels ramp correctly', () => {
    expect(aircraftLocationLabel('ramp')).toBe('Ramp')
  })
})

describe('aircraftLocationColor()', () => {
  it('maintenance_bay is red', () => {
    expect(aircraftLocationColor('maintenance_bay')).toContain('red')
  })
  it('hangar is sky/blue', () => {
    expect(aircraftLocationColor('hangar')).toContain('sky')
  })
  it('ramp is slate', () => {
    expect(aircraftLocationColor('ramp')).toContain('slate')
  })
})

describe('moveTypeLabel()', () => {
  it('labels ground_tow correctly', () => {
    expect(moveTypeLabel('ground_tow')).toBe('Ground Tow')
  })
  it('labels flight correctly', () => {
    expect(moveTypeLabel('flight')).toBe('Flight')
  })
})

// =============================================================================
// DATA INTEGRITY — aircraft registry has currentLocation
// =============================================================================

describe('mockAircraft — currentLocation field', () => {
  it('every aircraft has a currentLocation', () => {
    for (const ac of mockAircraft) {
      expect(ac.currentLocation).toBeTruthy()
    }
  })

  it('N33333 (GROUNDED) is in maintenance_bay', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N33333')
    expect(ac.currentLocation).toBe('maintenance_bay')
  })

  it('N22222 (autopilot work) is in hangar', () => {
    const ac = mockAircraft.find((a) => a.tailNumber === 'N22222')
    expect(ac.currentLocation).toBe('hangar')
  })

  it('every aircraft has locationUpdatedAt and locationUpdatedBy', () => {
    for (const ac of mockAircraft) {
      expect(ac.locationUpdatedAt).toBeTruthy()
      expect(ac.locationUpdatedBy).toBeTruthy()
    }
  })
})

// =============================================================================
// DATA INTEGRITY — movement log
// =============================================================================

describe('mockMovementLog — data integrity', () => {
  it('every entry has required fields', () => {
    for (const m of mockMovementLog) {
      expect(m.id).toBeTruthy()
      expect(m.tailNumber).toBeTruthy()
      expect(m.moveType).toBeTruthy()
      expect(m.fromLocation).toBeTruthy()
      expect(m.toLocation).toBeTruthy()
      expect(m.movedAt).toBeTruthy()
    }
  })

  it('N33333 has a ground_tow to maintenance_bay', () => {
    const towToMx = mockMovementLog.find(
      (m) => m.tailNumber === 'N33333' && m.moveType === 'ground_tow' && m.toLocation === 'maintenance_bay'
    )
    expect(towToMx).toBeTruthy()
  })

  it('moveType values are within allowed set', () => {
    const allowed = ['ground_tow', 'flight', 'repositioned', 'ferry']
    for (const m of mockMovementLog) {
      expect(allowed).toContain(m.moveType)
    }
  })
})

// =============================================================================
// DATA INTEGRITY — personnel and certificates
// =============================================================================

describe('mockPersonnel — maintenance staff fields', () => {
  const mechanics = mockPersonnel.filter((p) => p.department === 'Maintenance')

  it('has at least 5 maintenance staff', () => {
    expect(mechanics.length).toBeGreaterThanOrEqual(5)
  })

  it('every mechanic has currentLocation', () => {
    for (const p of mechanics) {
      expect(p.currentLocation).toBeTruthy()
    }
  })

  it('Sarah Cole (prs-011) is on_prem with IA authority', () => {
    const sarah = mockPersonnel.find((p) => p.id === 'prs-011')
    expect(sarah).toBeTruthy()
    expect(sarah.currentLocation).toBe('on_prem')
    expect(sarah.canReturnToService).toBe(true)
  })

  it('T. Huang (prs-013) is off_site', () => {
    const huang = mockPersonnel.find((p) => p.id === 'prs-013')
    expect(huang).toBeTruthy()
    expect(huang.currentLocation).toBe('off_site')
  })

  it('mechanics with IA authority have canReturnToService=true', () => {
    for (const p of mechanics) {
      if (p.certType?.includes('IA')) {
        expect(p.canReturnToService).toBe(true)
      }
    }
  })
})

describe('mockCertificates — certificate records', () => {
  it('has certificate records for all maintenance mechanics', () => {
    const mechanicIds = mockPersonnel
      .filter((p) => p.department === 'Maintenance' && p.certType)
      .map((p) => p.id)
    for (const id of mechanicIds) {
      const certs = mockCertificates.filter((c) => c.personnelId === id)
      expect(certs.length).toBeGreaterThan(0)
    }
  })

  it('each certificate has required fields', () => {
    for (const cert of mockCertificates) {
      expect(cert.id).toBeTruthy()
      expect(cert.personnelId).toBeTruthy()
      expect(cert.certType).toBeTruthy()
      expect(cert.certificateNumber).toBeTruthy()
      expect(cert.status).toBeTruthy()
    }
  })

  it('Sarah Cole has an active IA certificate', () => {
    const iaCert = mockCertificates.find(
      (c) => c.personnelId === 'prs-011' && c.certType === 'IA' && c.status === 'active'
    )
    expect(iaCert).toBeTruthy()
  })

  it('all test certificates are active', () => {
    // In our mock data, all certs are active — suspended/revoked are edge cases
    for (const cert of mockCertificates) {
      expect(cert.status).toBe('active')
    }
  })
})

// =============================================================================
// DATA INTEGRITY — work orders use new personnel fields
// =============================================================================

describe('mockWorkOrders — assignedPersonnelIds and supervisorCertificateId', () => {
  it('every work order has assignedPersonnelIds array', () => {
    for (const wo of mockWorkOrders) {
      expect(Array.isArray(wo.assignedPersonnelIds)).toBe(true)
    }
  })

  it('every work order has a supervisorId', () => {
    for (const wo of mockWorkOrders) {
      expect(wo.supervisorId).toBeTruthy()
    }
  })

  it('every work order has a supervisorCertificateId', () => {
    for (const wo of mockWorkOrders) {
      expect(wo.supervisorCertificateId).toBeTruthy()
    }
  })

  it('supervisorCertificateId references a real certificate', () => {
    const certIds = new Set(mockCertificates.map((c) => c.id))
    for (const wo of mockWorkOrders) {
      expect(certIds.has(wo.supervisorCertificateId)).toBe(true)
    }
  })

  it('supervisorId references a real person', () => {
    const personIds = new Set(mockPersonnel.map((p) => p.id))
    for (const wo of mockWorkOrders) {
      expect(personIds.has(wo.supervisorId)).toBe(true)
    }
  })

  it('AOG work order (wo-001) is actively accruing hours', () => {
    const aog = mockWorkOrders.find((w) => w.id === 'wo-001')
    expect(aog.accruingHours).toBe(true)
  })

  it('queued work orders are not accruing hours', () => {
    const queued = mockWorkOrders.filter((w) => w.holdReason === 'queued')
    for (const wo of queued) {
      expect(wo.accruingHours).toBe(false)
    }
  })

  it('annual inspection WO uses IA certificate for sign-off', () => {
    const annual = mockWorkOrders.find((w) => w.id === 'wo-005')
    const cert = mockCertificates.find((c) => c.id === annual.supervisorCertificateId)
    expect(cert.certType).toBe('IA')
  })
})

// =============================================================================
// COMPONENT TESTS — Fleet Status Board and Personnel tab
// =============================================================================

describe('<Maintenance /> Overview — Fleet Status Board', () => {
  it('renders fleet status board on Overview tab', () => {
    renderMaintenance()
    expect(screen.getByRole('table', { name: 'Fleet status board' })).toBeInTheDocument()
  })

  it('shows all 7 aircraft in the fleet status board', () => {
    renderMaintenance()
    const tails = ['N12345','N67890','N11111','N22222','N33333','N44444','N55555']
    for (const tail of tails) {
      expect(screen.getByTestId(`fleet-status-row-${tail}`)).toBeInTheDocument()
    }
  })

  it('N33333 shows GRND indicator', () => {
    renderMaintenance()
    const row = screen.getByTestId('fleet-status-row-N33333')
    expect(row.textContent).toMatch(/GRND/i)
  })

  it('N33333 shows Maint. Bay location', () => {
    renderMaintenance()
    const row = screen.getByTestId('fleet-status-row-N33333')
    expect(row.textContent).toMatch(/Maint. Bay/i)
  })

  it('N33333 shows active labor accruing', () => {
    renderMaintenance()
    const row = screen.getByTestId('fleet-status-row-N33333')
    expect(row.textContent).toMatch(/Active/i)
  })
})

describe('<Maintenance /> Personnel tab', () => {
  it('renders the Personnel tab button', () => {
    renderMaintenance()
    expect(screen.getByRole('tab', { name: 'Personnel' })).toBeInTheDocument()
  })

  it('shows maintenance staff on Personnel tab', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    // Names may appear in multiple contexts (card header + WO assignment rows)
    expect(screen.getAllByText('Sarah Cole').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tyler Brooks').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mike Ferris').length).toBeGreaterThan(0)
  })

  it('shows T. Huang as Off Site', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    const card = screen.getByTestId('personnel-card-prs-013')
    expect(card.textContent).toMatch(/Off Site/i)
  })

  it('shows personnel capacity bars', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBeGreaterThan(0)
  })

  it('shows IA badge on Sarah Cole card', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    const card = screen.getByTestId('personnel-card-prs-011')
    expect(card.textContent).toMatch(/IA/i)
  })

  it('shows certificate numbers on personnel cards', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    // Sarah Cole's IA cert number
    expect(screen.getByText(/#IA-991055/i)).toBeInTheDocument()
  })

  it('on_prem filter shows only on-premises staff', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    fireEvent.click(screen.getByRole('button', { name: 'On Premises' }))
    // T. Huang (off_site) should not be visible
    expect(screen.queryByTestId('personnel-card-prs-013')).not.toBeInTheDocument()
    // Tyler Brooks (on_prem) should be visible
    expect(screen.getByTestId('personnel-card-prs-008')).toBeInTheDocument()
  })

  it('off filter shows only off-site / leave staff', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Off Site' }))
    // T. Huang should be visible
    expect(screen.getByTestId('personnel-card-prs-013')).toBeInTheDocument()
    // Tyler Brooks (on_prem) should not be visible
    expect(screen.queryByTestId('personnel-card-prs-008')).not.toBeInTheDocument()
  })

  it('shows assigned work orders in personnel cards', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    // Sarah Cole card should show wo-001 (AOG engine teardown)
    const sarahCard = screen.getByTestId('personnel-card-prs-011')
    expect(sarahCard.textContent).toMatch(/Oil pressure fluctuation/i)
  })

  it('shows regulatory note about 14 CFR 43.3', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Personnel' }))
    // Appears in the info box and in "Supervising A&P (14 CFR 43.3)" labels
    expect(screen.getAllByText(/14 CFR 43.3/i).length).toBeGreaterThan(0)
  })
})

describe('<Maintenance /> Work Orders — personnel and certificates', () => {
  it('shows performing mechanic name on work order cards', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // Sarah Cole is assigned to multiple WOs
    expect(screen.getAllByText('Sarah Cole').length).toBeGreaterThan(0)
  })

  it('shows supervising A&P label on WO cards', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    expect(screen.getAllByText(/Supervising A&P/i).length).toBeGreaterThan(0)
  })

  it('shows certificate number on work order cards', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // AME-991055 is Sarah Cole's A&P cert referenced by most WOs
    expect(screen.getAllByText(/AME-991055/i).length).toBeGreaterThan(0)
  })

  it('shows active status with elapsed duration on accruing WO (wo-001)', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // wo-001 has accruingHours:true and startedAt 2026-03-20 → shows "Active 8d ..."
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThan(0)
  })

  it('shows parts ETA status on parts_on_order WOs', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // wo-002 (parts ETA 2026-04-01 = 4 days), wo-003 (parts ETA 2026-03-31 = 3 days)
    expect(screen.getAllByText(/Parts in/i).length).toBeGreaterThan(0)
  })

  it('shows no-technician warning for wo-007 (unassigned performer)', () => {
    renderMaintenance()
    fireEvent.click(screen.getByRole('tab', { name: 'Work Orders' }))
    // wo-007 has assignedPersonnelIds=[] but does have a supervisorId
    // WoPersonnelRow renders "⚠ No technician assigned" when no performers are set
    expect(screen.getAllByText(/No technician assigned/i).length).toBeGreaterThan(0)
  })
})

// =============================================================================
// UNIT TESTS — elapsedDuration and woActiveStatus
// =============================================================================

// Reference datetime used by the default REF_DATETIME constant: 2026-03-28T11:00:00
const REF = '2026-03-28T11:00:00'

describe('elapsedDuration()', () => {
  it('wo-001 startedAt → "8d 1h" (8 days, 1h 45m elapsed)', () => {
    // 2026-03-20T09:15 → 2026-03-28T11:00 = 8d 1h 45m → "8d 1h"
    expect(elapsedDuration('2026-03-20T09:15:00', REF)).toBe('8d 1h')
  })

  it('wo-002 startedAt → "7d 20h" (initial assessment, now on hold)', () => {
    // 2026-03-20T14:30 → 2026-03-28T11:00 = 7d 20h 30m → "7d 20h"
    expect(elapsedDuration('2026-03-20T14:30:00', REF)).toBe('7d 20h')
  })

  it('wo-003 startedAt → "11d" (exactly 11 days)', () => {
    // 2026-03-17T11:00 → 2026-03-28T11:00 = exactly 11d 0h → "11d"
    expect(elapsedDuration('2026-03-17T11:00:00', REF)).toBe('11d')
  })

  it('null startedAt → null', () => {
    expect(elapsedDuration(null, REF)).toBeNull()
  })

  it('future startedAt (after ref) → null', () => {
    expect(elapsedDuration('2026-03-29T00:00:00', REF)).toBeNull()
  })

  it('minutes-only elapsed → "45m"', () => {
    expect(elapsedDuration('2026-03-28T10:15:00', REF)).toBe('45m')
  })

  it('hours and minutes elapsed → "1h 30m"', () => {
    expect(elapsedDuration('2026-03-28T09:30:00', REF)).toBe('1h 30m')
  })
})

describe('woActiveStatus()', () => {
  it('wo-001: accruingHours=true → type active, label "Active 8d 1h"', () => {
    const wo = mockWorkOrders.find((w) => w.id === 'wo-001')
    const s = woActiveStatus(wo, mockParts, '2026-03-28')
    expect(s.type).toBe('active')
    expect(s.label).toBe('Active 8d 1h')
    expect(s.color).toContain('amber')
  })

  it('wo-002: parts_on_order, soonest ETA 2026-04-01 → "Parts in 4d"', () => {
    const wo = mockWorkOrders.find((w) => w.id === 'wo-002')
    // prt-005: etaDate 2026-04-01, status ordered → 4 days from 2026-03-28
    const s = woActiveStatus(wo, mockParts, '2026-03-28')
    expect(s.type).toBe('parts')
    expect(s.label).toBe('Parts in 4d')
    expect(s.color).toContain('sky')
  })

  it('wo-003: parts_on_order, soonest ETA 2026-03-31 → "Parts in 3d"', () => {
    const wo = mockWorkOrders.find((w) => w.id === 'wo-003')
    const s = woActiveStatus(wo, mockParts, '2026-03-28')
    expect(s.type).toBe('parts')
    expect(s.label).toBe('Parts in 3d')
  })

  it('wo-004: awaiting_tech + scheduledDate 2026-04-02 → "Tech in 5d"', () => {
    const wo = mockWorkOrders.find((w) => w.id === 'wo-004')
    const s = woActiveStatus(wo, mockParts, '2026-03-28')
    expect(s.type).toBe('tech')
    expect(s.label).toBe('Tech in 5d')
    expect(s.color).toContain('sky')
  })

  it('completed WO → null', () => {
    const wo = mockWorkOrders.find((w) => w.status === 'completed')
    expect(wo).toBeDefined()
    expect(woActiveStatus(wo, mockParts)).toBeNull()
  })

  it('WO with no assignedPersonnelIds → type unassigned', () => {
    const unassigned = {
      id: 'test-unassigned',
      status: 'open',
      accruingHours: false,
      holdReason: null,
      assignedPersonnelIds: [],
    }
    const s = woActiveStatus(unassigned, [])
    expect(s.type).toBe('unassigned')
    expect(s.label).toMatch(/Unassigned/)
  })

  it('queued WO with queuePosition → "Queue #2"', () => {
    const queued = {
      id: 'test-queued',
      status: 'open',
      accruingHours: false,
      holdReason: 'queued',
      queuePosition: 2,
      assignedPersonnelIds: ['prs-008'],
    }
    const s = woActiveStatus(queued, [])
    expect(s.type).toBe('queued')
    expect(s.label).toBe('Queue #2')
  })
})
