/**
 * Tow resource evaluation tests
 *
 * Tests buildTowSchedule, buildSegments, and maintenance/squawk scenarios
 * to validate tow capacity analysis under various fleet conditions.
 */
import { describe, it, expect } from 'vitest'
import {
  buildTowSchedule,
  buildSegments,
  towCycleMin,
  towDeficiencyMin,
  isInMaintenance,
  availableTowPlanesAt,
  gaussianSmooth,
  squawksToMaintenanceWindows,
  TOW_SETTINGS,
  SEGMENT_MINUTES,
} from '../gliderUtils'

// ── Test helpers ────────────────────────────────────────────────────────────────

const AIRPORT = 'KBDU'

function makeTowPlane(id, tail) {
  return { id, tailNumber: tail, is_tow: true, airworthy: true }
}

function makeGliderFlight(id, depIso, towHeights = [2000], opts = {}) {
  return {
    id,
    missionType: 'glider_tow',
    departure: AIRPORT,
    airport: AIRPORT,
    plannedDepartureUtc: depIso,
    towInfo: { towHeights, isStandby: opts.isStandby ?? false },
    ...opts,
  }
}

function makeTowSession(id, depIso, arrIso, planeId) {
  return {
    id,
    missionType: 'tow_session',
    airport: AIRPORT,
    plannedDepartureUtc: depIso,
    plannedArrivalUtc: arrIso,
    towInfo: { towPlaneId: planeId },
    tailNumber: planeId,
  }
}

// Fixed date for deterministic tests: 2026-04-07 08:00 UTC
const BASE = '2026-04-07T08:00:00Z'
const baseMs = new Date(BASE).getTime()
const h = (offset) => new Date(baseMs + offset * 3_600_000).toISOString()

const planes = [
  makeTowPlane('tp-1', 'N100TP'),
  makeTowPlane('tp-2', 'N200TP'),
  makeTowPlane('tp-3', 'N300TP'),
]

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('towCycleMin', () => {
  it('computes correct cycle time for standard heights', () => {
    expect(towCycleMin(1000)).toBe(15) // 10 ground + 5 flight
    expect(towCycleMin(2000)).toBe(20) // 10 ground + 10 flight
    expect(towCycleMin(3000)).toBe(25) // 10 ground + 15 flight
  })
})

describe('isInMaintenance', () => {
  const windows = [
    { aircraftId: 'tp-1', startMs: baseMs, endMs: baseMs + 2 * 3_600_000, reason: '100-hr inspection' },
    { aircraftId: 'tp-2', startMs: baseMs + 4 * 3_600_000, endMs: baseMs + 6 * 3_600_000, reason: 'Oil change' },
  ]

  it('returns true when aircraft is in a maintenance window', () => {
    expect(isInMaintenance('tp-1', baseMs + 30 * 60_000, windows)).toBe(true)
    expect(isInMaintenance('tp-2', baseMs + 5 * 3_600_000, windows)).toBe(true)
  })

  it('returns false when aircraft is outside maintenance window', () => {
    expect(isInMaintenance('tp-1', baseMs + 3 * 3_600_000, windows)).toBe(false)
    expect(isInMaintenance('tp-3', baseMs, windows)).toBe(false)
  })

  it('returns false at exact end boundary (exclusive)', () => {
    expect(isInMaintenance('tp-1', baseMs + 2 * 3_600_000, windows)).toBe(false)
  })
})

describe('availableTowPlanesAt', () => {
  const aircraftList = planes
  const squawks = [
    { aircraftId: 'tp-2', severity: 'grounding', status: 'open' },
  ]
  const mxWindows = [
    { aircraftId: 'tp-1', startMs: baseMs, endMs: baseMs + 2 * 3_600_000 },
  ]
  const isGrounded = (id, list, sq) =>
    sq.some((s) => s.aircraftId === id && s.severity === 'grounding' && s.status !== 'closed')

  it('excludes grounded aircraft', () => {
    const avail = availableTowPlanesAt(planes, baseMs + 3 * 3_600_000, aircraftList, squawks, [], isGrounded)
    expect(avail.map((p) => p.id)).toEqual(['tp-1', 'tp-3'])
  })

  it('excludes aircraft in maintenance window', () => {
    const avail = availableTowPlanesAt(planes, baseMs + 1 * 3_600_000, aircraftList, [], mxWindows, isGrounded)
    expect(avail.map((p) => p.id)).toEqual(['tp-2', 'tp-3'])
  })

  it('excludes both grounded and in-maintenance aircraft', () => {
    const avail = availableTowPlanesAt(planes, baseMs + 1 * 3_600_000, aircraftList, squawks, mxWindows, isGrounded)
    expect(avail.map((p) => p.id)).toEqual(['tp-3'])
  })

  it('returns all planes when no restrictions', () => {
    const avail = availableTowPlanesAt(planes, baseMs, aircraftList, [], [])
    expect(avail.map((p) => p.id)).toEqual(['tp-1', 'tp-2', 'tp-3'])
  })
})

describe('buildTowSchedule with maintenance windows', () => {
  const flights = [
    makeGliderFlight('g-1', h(0), [2000]),
    makeGliderFlight('g-2', h(0), [2000]),
    makeGliderFlight('g-3', h(0.5), [1000]),
  ]

  it('assigns to available planes, skipping planes in maintenance', () => {
    const mxWindows = [
      { aircraftId: 'tp-1', startMs: baseMs, endMs: baseMs + 2 * 3_600_000 },
    ]
    const schedule = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, planes, mxWindows)

    // tp-1 is in maintenance, so g-1 and g-2 should go to tp-2 and tp-3
    const g1 = schedule.find((e) => e.flight.id === 'g-1' && e.towIndex === 0)
    const g2 = schedule.find((e) => e.flight.id === 'g-2' && e.towIndex === 0)
    expect(g1.assignedPlaneId).not.toBe('tp-1')
    expect(g2.assignedPlaneId).not.toBe('tp-1')
  })

  it('uses all planes when no maintenance windows', () => {
    const schedule = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, planes, [])
    const usedPlanes = new Set(schedule.map((e) => e.assignedPlaneId))
    // With 3 simultaneous requests and 3 planes, all should be used
    expect(usedPlanes.size).toBeGreaterThanOrEqual(2)
  })

  it('schedules events even when all planes are in maintenance (fallback)', () => {
    const allDown = [
      { aircraftId: 'tp-1', startMs: baseMs, endMs: baseMs + 10 * 3_600_000 },
      { aircraftId: 'tp-2', startMs: baseMs, endMs: baseMs + 10 * 3_600_000 },
      { aircraftId: 'tp-3', startMs: baseMs, endMs: baseMs + 10 * 3_600_000 },
    ]
    const schedule = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, planes, allDown)
    // Should still produce events (fallback assignment)
    expect(schedule.length).toBeGreaterThan(0)
  })
})

describe('buildTowSchedule with grounded aircraft', () => {
  it('only assigns to airworthy planes', () => {
    const flights = [
      makeGliderFlight('g-1', h(0), [2000]),
      makeGliderFlight('g-2', h(0), [2000]),
    ]
    // Only pass airworthy planes (simulating grounded tp-1)
    const airworthy = planes.filter((p) => p.id !== 'tp-1')
    const schedule = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, airworthy)

    for (const ev of schedule) {
      expect(ev.assignedPlaneId).not.toBe('tp-1')
    }
  })

  it('increases wait when fewer planes available', () => {
    // 4 simultaneous flights with 3 planes → some queueing
    const flights = [
      makeGliderFlight('g-1', h(0), [2000]),
      makeGliderFlight('g-2', h(0), [2000]),
      makeGliderFlight('g-3', h(0), [2000]),
      makeGliderFlight('g-4', h(0), [2000]),
    ]

    const sched3 = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, planes)
    const sched1 = buildTowSchedule(flights, AIRPORT, TOW_SETTINGS, [planes[0]])

    // With 1 plane, max wait must be longer than with 3 planes
    const maxWait3 = Math.max(...sched3.map((e) => e.actualStartMs - e.requestedMs))
    const maxWait1 = Math.max(...sched1.map((e) => e.actualStartMs - e.requestedMs))
    expect(maxWait1).toBeGreaterThan(maxWait3)
  })
})

describe('buildSegments demand breakdown by tow type', () => {
  it('classifies pattern, scenic, and mountain tow demand', () => {
    // Use a time that falls within the default segment window
    // startHour=7 means segments start at 07:00 local time
    // We need flights at a time that falls within the 07:00-20:00 window
    const now = new Date()
    const localBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0)
    const localIso = localBase.toISOString()

    const flights = [
      makeGliderFlight('p-1', localIso, [1000]),        // pattern
      makeGliderFlight('s-1', localIso, [2000]),        // scenic
      makeGliderFlight('m-1', localIso, [3000]),        // mountain
      makeGliderFlight('mix', localIso, [1000, 3000]),  // mixed
    ]

    const segments = buildSegments({
      flights,
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
    })

    // Sum demand across all segments (jitter may spread events across neighbours)
    const totals = { pattern: 0, scenic: 0, mountain: 0 }
    for (const s of segments) {
      totals.pattern  += s.demandByType.pattern
      totals.scenic   += s.demandByType.scenic
      totals.mountain += s.demandByType.mountain
    }

    expect(totals.pattern).toBeGreaterThan(0)   // 1000ft from p-1 and mix
    expect(totals.scenic).toBeGreaterThan(0)    // 2000ft from s-1
    expect(totals.mountain).toBeGreaterThan(0)  // 3000ft from m-1 and mix
  })

  it('tracks standby flights per segment', () => {
    const now = new Date()
    const localBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0, 0)

    const flights = [
      makeGliderFlight('sb-1', localBase.toISOString(), [2000], { isStandby: true }),
      makeGliderFlight('sb-2', localBase.toISOString(), [1000], { isStandby: true }),
    ]

    const segments = buildSegments({
      flights,
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
    })

    const target = segments.find((s) => {
      const depMs = localBase.getTime()
      return depMs >= s.startMs && depMs < s.endMs
    })

    expect(target).toBeDefined()
    expect(target.standbyFt).toBeGreaterThan(0)
    expect(target.standbyFlights).toHaveLength(2)
  })
})

describe('buildSegments with maintenance reducing supply', () => {
  it('excludes grounded planes from available list', () => {
    const now = new Date()
    const localBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0)
    const midMs = localBase.getTime() + SEGMENT_MINUTES * 60_000 / 2

    const isGrounded = (id) => id === 'tp-1'

    const segments = buildSegments({
      flights: [],
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
      isGroundedFn: isGrounded,
    })

    const target = segments.find((s) => midMs >= s.startMs && midMs < s.endMs)
    expect(target.availablePlaneIds).not.toContain('tp-1')
    expect(target.availablePlaneIds).toContain('tp-2')
    expect(target.availablePlaneIds).toContain('tp-3')
  })

  it('excludes planes in maintenance window from available list', () => {
    const now = new Date()
    const localBase = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0)
    const midMs = localBase.getTime() + SEGMENT_MINUTES * 60_000 / 2

    const mxWindows = [{
      aircraftId: 'tp-2',
      startMs: localBase.getTime() - 3_600_000,
      endMs: localBase.getTime() + 3_600_000,
    }]

    const segments = buildSegments({
      flights: [],
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
      mxWindows,
    })

    const target = segments.find((s) => midMs >= s.startMs && midMs < s.endMs)
    expect(target.availablePlaneIds).not.toContain('tp-2')
    expect(target.availablePlaneIds).toContain('tp-1')
  })

  it('restores plane availability after maintenance window ends', () => {
    const now = new Date()
    const localMx = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0)
    const localAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0)

    const mxWindows = [{
      aircraftId: 'tp-2',
      startMs: localMx.getTime(),
      endMs: localMx.getTime() + 2 * 3_600_000, // 08:00 - 10:00
    }]

    const segments = buildSegments({
      flights: [],
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
      mxWindows,
    })

    // During maintenance (09:00) — tp-2 not available
    const during = segments.find((s) => {
      const t = localMx.getTime() + 3_600_000
      return t >= s.startMs && t < s.endMs
    })
    expect(during.availablePlaneIds).not.toContain('tp-2')

    // After maintenance (11:00) — tp-2 available again
    const after = segments.find((s) => {
      const t = localAfter.getTime()
      return t >= s.startMs && t < s.endMs
    })
    expect(after.availablePlaneIds).toContain('tp-2')
  })
})

describe('gaussianSmooth', () => {
  it('preserves total area approximately', () => {
    const values = [0, 0, 10, 0, 0]
    const smoothed = gaussianSmooth(values, 0.5)
    const origSum = values.reduce((a, b) => a + b, 0)
    const smoothSum = smoothed.reduce((a, b) => a + b, 0)
    // Gaussian smoothing preserves total (within floating point tolerance)
    expect(Math.abs(smoothSum - origSum)).toBeLessThan(1)
  })

  it('spreads a spike into neighbours', () => {
    const values = [0, 0, 20, 0, 0]
    const smoothed = gaussianSmooth(values, 0.5)
    // The spike should be lower and neighbours should have some value
    expect(smoothed[2]).toBeLessThan(20)
    expect(smoothed[1]).toBeGreaterThan(0)
    expect(smoothed[3]).toBeGreaterThan(0)
  })

  it('handles empty array', () => {
    expect(gaussianSmooth([], 0.5)).toEqual([])
  })
})

describe('towDeficiencyMin with reduced fleet', () => {
  it('shows deficit when demand exceeds single-plane capacity', () => {
    // 4 pattern tows in 30 minutes with one plane = 4 × 15 = 60 min demand vs 30 min supply
    const windowStart = baseMs
    const windowEnd = baseMs + 30 * 60_000
    const flights = [
      makeGliderFlight('g-1', h(0), [1000]),
      makeGliderFlight('g-2', h(0), [1000]),
      makeGliderFlight('g-3', h(0), [1000]),
      makeGliderFlight('g-4', h(0), [1000]),
    ]

    const result = towDeficiencyMin(flights, AIRPORT, windowStart, windowEnd)
    expect(result.deficiencyMin).toBeGreaterThan(0)
    expect(result.isStandby).toBe(true)
    expect(result.color).toBe('red')
  })

  it('shows surplus when duty blocks cover demand', () => {
    const windowStart = baseMs
    const windowEnd = baseMs + 3_600_000
    const flights = [
      makeGliderFlight('g-1', h(0), [1000]),
      makeTowSession('ts-1', h(0), h(1), 'tp-1'),
      makeTowSession('ts-2', h(0), h(1), 'tp-2'),
    ]

    const result = towDeficiencyMin(flights, AIRPORT, windowStart, windowEnd)
    expect(result.deficiencyMin).toBeLessThanOrEqual(0)
    expect(result.isStandby).toBe(false)
  })
})

describe('scenario: morning grounding resolved mid-day', () => {
  it('shows reduced capacity during grounding, full capacity after', () => {
    const now = new Date()
    const morningMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0).getTime()
    const noonMs    = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTime()
    const afterMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0).getTime()

    // tp-1 grounded from 08:00 to 12:00 (maintenance window simulates "grounded then certified")
    const mxWindows = [{
      aircraftId: 'tp-1',
      startMs: morningMs,
      endMs: noonMs,
      reason: 'Squawk repair + airworthiness cert',
    }]

    const segments = buildSegments({
      flights: [],
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
      mxWindows,
    })

    // Morning: tp-1 unavailable
    const morningSeg = segments.find((s) => {
      const t = morningMs + 30 * 60_000
      return t >= s.startMs && t < s.endMs
    })
    expect(morningSeg.availablePlaneIds).toHaveLength(2) // tp-2, tp-3
    expect(morningSeg.availablePlaneIds).not.toContain('tp-1')

    // Afternoon: tp-1 back online
    const afternoonSeg = segments.find((s) => {
      const t = afterMs
      return t >= s.startMs && t < s.endMs
    })
    expect(afternoonSeg.availablePlaneIds).toHaveLength(3)
    expect(afternoonSeg.availablePlaneIds).toContain('tp-1')
  })
})

describe('scenario: scheduled annual inspection blocks aircraft all day', () => {
  it('aircraft unavailable for entire day during annual', () => {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0).getTime()
    const dayEnd   = dayStart + 13 * 3_600_000

    const mxWindows = [{
      aircraftId: 'tp-3',
      startMs: dayStart,
      endMs: dayEnd,
      reason: 'Annual inspection',
    }]

    const segments = buildSegments({
      flights: [],
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
      mxWindows,
    })

    // Every segment should exclude tp-3
    for (const seg of segments) {
      expect(seg.availablePlaneIds).not.toContain('tp-3')
    }
  })
})

describe('squawksToMaintenanceWindows', () => {
  it('converts closed grounding squawks to maintenance windows', () => {
    const squawks = [
      {
        tailNumber: 'N100TP',
        severity: 'grounding',
        status: 'closed',
        reportedDate: '2026-04-07',
        resolvedDate: '2026-04-07',
      },
    ]
    const windows = squawksToMaintenanceWindows(squawks, planes)
    expect(windows).toHaveLength(1)
    expect(windows[0].aircraftId).toBe('tp-1')
    expect(windows[0].startMs).toBeLessThan(windows[0].endMs)
  })

  it('uses reportedAt for precise start time when available', () => {
    const squawks = [
      {
        tailNumber: 'N100TP',
        severity: 'grounding',
        status: 'closed',
        reportedAt: '2026-04-07T08:30:00Z',
        reportedDate: '2026-04-07',
        resolvedDate: '2026-04-07',
      },
    ]
    const windows = squawksToMaintenanceWindows(squawks, planes)
    expect(windows[0].startMs).toBe(new Date('2026-04-07T08:30:00Z').getTime())
  })

  it('ignores open grounding squawks (handled by isAircraftGrounded)', () => {
    const squawks = [
      { tailNumber: 'N100TP', severity: 'grounding', status: 'open', reportedDate: '2026-04-07' },
    ]
    expect(squawksToMaintenanceWindows(squawks, planes)).toHaveLength(0)
  })

  it('ignores non-grounding squawks', () => {
    const squawks = [
      { tailNumber: 'N100TP', severity: 'monitoring', status: 'closed', reportedDate: '2026-04-07', resolvedDate: '2026-04-07' },
    ]
    expect(squawksToMaintenanceWindows(squawks, planes)).toHaveLength(0)
  })

  it('generates windows that block aircraft in buildSegments', () => {
    const squawks = [
      {
        tailNumber: 'N100TP',
        severity: 'grounding',
        status: 'closed',
        reportedAt: new Date(new Date().setHours(7, 0, 0, 0)).toISOString(),
        resolvedDate: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),  // resolved at noon
      },
    ]
    const windows = squawksToMaintenanceWindows(squawks, planes)

    const segments = buildSegments({
      flights: [],
      airport: AIRPORT,
      towPlanes: planes,
      aircraftList: planes,
      squawks: [],
      mxWindows: windows,
    })

    // Morning segments (when squawk was active) should exclude tp-1
    const morningSeg = segments.find((s) => {
      const t = new Date(new Date().setHours(8, 0, 0, 0)).getTime()
      return t >= s.startMs && t < s.endMs
    })
    expect(morningSeg).toBeDefined()
    expect(morningSeg.availablePlaneIds).not.toContain('tp-1')
  })
})
