import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Training } from './Training'
import {
  mockStudents, mockClubMembers, mockDpeContacts, mockBookings, PROGRAMS, BLOCK_PACKAGES, CLUB_CONFIG,
} from './mockTraining'
import {
  expiryStatus, expiryLabel,
  blockDiscountPct, effectiveRate, applyClubDiscount,
  requirementProgress, metRequirementCount, stageProgress,
  tasksComplete, isCheckrideReady,
  clubEligibilityIssues,
  LESSON_TEMPLATES, WEATHER_14DAY,
  aircraftFitsLesson, cfiFitsLesson,
  isSlotOccupied, findNextAvailableSlot,
  recommendLessons, weatherFit,
  studentFlightFrequency,
  calcTrainingWB, wbStatusLevel,
} from './trainingUtils'
import { mockPersonnel } from '../mocks/personnel'
import { mockAircraft } from '../mocks/aircraft'

// ─── Render helper ─────────────────────────────────────────────────────────────

function renderTraining() {
  return render(<MemoryRouter><Training /></MemoryRouter>)
}

// ─── trainingUtils — expiryStatus ─────────────────────────────────────────────

describe('expiryStatus', () => {
  test('past date returns expired', () => {
    expect(expiryStatus('2020-01-01')).toBe('expired')
  })
  test('date within 30 days returns expiring', () => {
    expect(expiryStatus('2026-04-05')).toBe('expiring')  // 7 days from 2026-03-29
  })
  test('date > 30 days away returns current', () => {
    expect(expiryStatus('2027-01-01')).toBe('current')
  })
  test('null returns null', () => {
    expect(expiryStatus(null)).toBeNull()
  })
})

describe('expiryLabel', () => {
  test('returns dashes for null', () => {
    expect(expiryLabel(null)).toBe('—')
  })
  test('past date returns Expired X days ago', () => {
    const label = expiryLabel('2026-03-20')
    expect(label).toMatch(/Expired \d+ days? ago/)
  })
  test('future date returns Expires in X days', () => {
    const label = expiryLabel('2026-04-10')
    expect(label).toMatch(/Expires in \d+ days?/)
  })
})

// ─── trainingUtils — block discount ───────────────────────────────────────────

describe('blockDiscountPct', () => {
  test('below 10 hours returns 0%', () => {
    expect(blockDiscountPct(5)).toBe(0)
  })
  test('exactly 10 hours returns 5%', () => {
    expect(blockDiscountPct(10)).toBe(5)
  })
  test('20 hours returns 10%', () => {
    expect(blockDiscountPct(20)).toBe(10)
  })
  test('40 hours returns 15%', () => {
    expect(blockDiscountPct(40)).toBe(15)
  })
  test('50 hours still returns 15% (max tier)', () => {
    expect(blockDiscountPct(50)).toBe(15)
  })
})

describe('effectiveRate', () => {
  test('applies block discount when better than club', () => {
    // 40h block = 15%, club = 10% → block wins
    const rate = effectiveRate(185, 40, true)
    expect(rate).toBe(Math.round(185 * 0.85 * 100) / 100)
  })
  test('applies club discount when better than block', () => {
    // 0h block = 0%, club = 10% → club wins
    const rate = effectiveRate(185, 0, true)
    expect(rate).toBe(Math.round(185 * 0.90 * 100) / 100)
  })
  test('no discounts returns base rate', () => {
    expect(effectiveRate(185, 0, false)).toBe(185)
  })
})

describe('applyClubDiscount', () => {
  test('applies 10% discount', () => {
    expect(applyClubDiscount(185)).toBe(Math.round(185 * 0.9 * 100) / 100)
  })
})

// ─── trainingUtils — program progress ─────────────────────────────────────────

describe('requirementProgress', () => {
  test('returns one entry per requirement', () => {
    const s = mockStudents[0]  // Emily — PPL
    const reqs = requirementProgress(s, 'private_pilot')
    expect(reqs.length).toBe(PROGRAMS.private_pilot.requirements.length)
  })
  test('pct is capped at 100', () => {
    const s = mockStudents[2]  // Priya — IR, has 68 XC PIC vs min 50
    const reqs = requirementProgress(s, 'instrument_rating')
    const xc = reqs.find((r) => r.id === 'xc_pic')
    expect(xc.pct).toBe(100)
  })
  test('met count is positive for advanced student', () => {
    expect(metRequirementCount(mockStudents[0], 'private_pilot')).toBeGreaterThan(0)
  })
})

describe('stageProgress', () => {
  test('stage 1 of 5 returns 0%', () => {
    const s = mockStudents[1]  // Tyler — stage 1
    expect(stageProgress(s, 'private_pilot')).toBe(0)
  })
  test('stage 5 of 5 returns 80%', () => {
    const s = mockStudents[0]  // Emily — stage 5 of 5
    expect(stageProgress(s, 'private_pilot')).toBe(80)
  })
})

// ─── trainingUtils — DPE readiness ────────────────────────────────────────────

describe('isCheckrideReady', () => {
  test('returns false when tasks is empty', () => {
    expect(isCheckrideReady({ dpe: { tasks: [] } })).toBe(false)
  })
  test('returns false when any task incomplete', () => {
    const s = mockStudents.find((s) => s.dpe.tasks.some((t) => !t.done))
    expect(isCheckrideReady(s)).toBe(false)
  })
  test('tasksComplete counts done tasks', () => {
    const tasks = [{ done: true }, { done: false }, { done: true }]
    expect(tasksComplete(tasks)).toBe(2)
  })
})

// ─── trainingUtils — flying club ──────────────────────────────────────────────

describe('clubEligibilityIssues', () => {
  test('returns empty for fully compliant member', () => {
    const m = mockClubMembers.find((m) => m.duesCurrent && m.bfrCurrent && m.medicalCurrent && m.rentersUploaded)
    expect(clubEligibilityIssues(m)).toHaveLength(0)
  })
  test('returns issue for overdue dues', () => {
    const m = mockClubMembers.find((m) => !m.duesCurrent)
    const issues = clubEligibilityIssues(m)
    expect(issues.some((i) => i.toLowerCase().includes('dues'))).toBe(true)
  })
  test('returns issue for missing renters insurance', () => {
    const m = mockClubMembers.find((m) => !m.rentersUploaded)
    const issues = clubEligibilityIssues(m)
    expect(issues.some((i) => i.toLowerCase().includes('insurance'))).toBe(true)
  })
  test('returns BFR issue when not current', () => {
    const m = mockClubMembers.find((m) => !m.bfrCurrent)
    const issues = clubEligibilityIssues(m)
    expect(issues.some((i) => i.toLowerCase().includes('bfr'))).toBe(true)
  })
})

// ─── mock data integrity ──────────────────────────────────────────────────────

describe('mockStudents data integrity', () => {
  test('all students have a valid program', () => {
    mockStudents.forEach((s) => {
      expect(PROGRAMS[s.program]).toBeDefined()
    })
  })
  test('all students have docs object', () => {
    mockStudents.forEach((s) => {
      expect(s.docs).toBeDefined()
      expect(s.docs.governmentId).toBeDefined()
      expect(s.docs.insurance).toBeDefined()
    })
  })
  test('all students have hours object', () => {
    mockStudents.forEach((s) => {
      expect(s.hours).toBeDefined()
      expect(typeof s.hours.total).toBe('number')
    })
  })
  test('DPE tasks arrays are non-null', () => {
    mockStudents.forEach((s) => {
      expect(Array.isArray(s.dpe.tasks)).toBe(true)
    })
  })
})

describe('PROGRAMS data integrity', () => {
  test('all 6 programs defined (3 powered + 3 glider)', () => {
    expect(Object.keys(PROGRAMS)).toHaveLength(6)
  })
  test('each program has stages and requirements', () => {
    Object.values(PROGRAMS).forEach((p) => {
      expect(p.stages.length).toBeGreaterThan(0)
      expect(p.requirements.length).toBeGreaterThan(0)
      expect(p.wetRatePerHr).toBeGreaterThan(0)
      expect(p.instructorRatePerHr).toBeGreaterThan(0)
    })
  })
})

describe('BLOCK_PACKAGES', () => {
  test('discounts are increasing with hours', () => {
    const sorted = [...BLOCK_PACKAGES].sort((a, b) => a.hours - b.hours)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].discountPct).toBeGreaterThan(sorted[i - 1].discountPct)
    }
  })
})

describe('CLUB_CONFIG', () => {
  test('has positive dues and discount', () => {
    expect(CLUB_CONFIG.monthlyDues).toBeGreaterThan(0)
    expect(CLUB_CONFIG.hourlyDiscountPct).toBeGreaterThan(0)
  })
})

describe('mockDpeContacts', () => {
  test('each DPE authorizes at least one program', () => {
    mockDpeContacts.forEach((d) => {
      expect(d.authorizes.length).toBeGreaterThan(0)
      d.authorizes.forEach((a) => expect(PROGRAMS[a]).toBeDefined())
    })
  })
})

// ─── LESSON_TEMPLATES ─────────────────────────────────────────────────────────

describe('LESSON_TEMPLATES', () => {
  test('each program has templates for all stages', () => {
    Object.entries(LESSON_TEMPLATES).forEach(([progId, stages]) => {
      const prog = PROGRAMS[progId]
      expect(prog).toBeDefined()
      prog.stages.forEach((s) => {
        expect(stages[s.number]).toBeDefined()
        expect(stages[s.number].length).toBeGreaterThan(0)
      })
    })
  })

  test('IR templates all require CFII', () => {
    Object.values(LESSON_TEMPLATES.instrument_rating).flat()
      .filter(t => t.type !== 'ground')
      .forEach(t => expect(t.requiresCfii).toBe(true))
  })

  test('complex-endorsement lessons require complex aircraft', () => {
    LESSON_TEMPLATES.commercial_pilot[2].forEach(t => {
      if (t.type !== 'solo') expect(t.requiresComplex).toBe(true)
    })
  })
})

// ─── WEATHER_14DAY ────────────────────────────────────────────────────────────

describe('WEATHER_14DAY', () => {
  test('has entry for each operational day (no Sunday index 6)', () => {
    [0,1,2,3,4,5,7,8,9,10,11,12].forEach(d => {
      expect(WEATHER_14DAY[d]).toBeDefined()
    })
    expect(WEATHER_14DAY[6]).toBeUndefined()
  })

  test('all entries have condition, icon, label', () => {
    Object.values(WEATHER_14DAY).forEach(w => {
      expect(w.condition).toBeDefined()
      expect(w.icon).toBeDefined()
      expect(w.label).toBeDefined()
    })
  })
})

// ─── weatherFit ───────────────────────────────────────────────────────────────

describe('weatherFit', () => {
  test('ground lesson is always good', () => {
    const groundTemplate = { type: 'ground', preferVmc: false }
    expect(weatherFit({ condition: 'imc' }, groundTemplate)).toBe('good')
  })

  test('VMC + VFR lesson = good', () => {
    expect(weatherFit({ condition: 'vmc' }, { preferVmc: true })).toBe('good')
  })

  test('IMC + VFR lesson = poor', () => {
    expect(weatherFit({ condition: 'imc' }, { preferVmc: true })).toBe('poor')
  })

  test('marginal_vmc + VFR lesson = marginal', () => {
    expect(weatherFit({ condition: 'marginal_vmc' }, { preferVmc: true })).toBe('marginal')
  })

  test('instrument lesson in any weather = good', () => {
    ['vmc', 'marginal_vmc', 'imc'].forEach(cond => {
      expect(weatherFit({ condition: cond }, { preferVmc: false })).toBe('good')
    })
  })
})

// ─── aircraftFitsLesson ───────────────────────────────────────────────────────

describe('aircraftFitsLesson', () => {
  const baron  = mockAircraft.find(a => a.id === 'ac-001')  // Baron 58 — complex, multi, IFR
  const c172s  = mockAircraft.find(a => a.id === 'ac-002')  // C172S — IFR, not complex
  const c172n  = mockAircraft.find(a => a.id === 'ac-005')  // C172N — GROUNDED, not IFR

  test('Baron fits complex lesson', () => {
    expect(aircraftFitsLesson(baron, { requiresIfrAircraft: false, requiresComplex: true, requiresMulti: false })).toBe(true)
  })
  test('C172S fits IFR lesson', () => {
    expect(aircraftFitsLesson(c172s, { requiresIfrAircraft: true, requiresComplex: false, requiresMulti: false })).toBe(true)
  })
  test('C172S does not fit complex lesson', () => {
    expect(aircraftFitsLesson(c172s, { requiresIfrAircraft: false, requiresComplex: true, requiresMulti: false })).toBe(false)
  })
  test('grounded aircraft never fits', () => {
    expect(aircraftFitsLesson(c172n, { requiresIfrAircraft: false, requiresComplex: false, requiresMulti: false })).toBe(false)
  })
})

// ─── cfiFitsLesson ────────────────────────────────────────────────────────────

describe('cfiFitsLesson', () => {
  const james  = mockPersonnel.find(p => p.id === 'prs-001')  // CFI/CFII/MEI
  const linda  = mockPersonnel.find(p => p.id === 'prs-017')  // CFI/CFII
  const greg   = mockPersonnel.find(p => p.id === 'prs-018')  // CFI only

  test('CFII lesson: James fits', () => {
    expect(cfiFitsLesson(james, { requiresCfii: true, requiresMulti: false })).toBe(true)
  })
  test('CFII lesson: Linda fits', () => {
    expect(cfiFitsLesson(linda, { requiresCfii: true, requiresMulti: false })).toBe(true)
  })
  test('CFII lesson: Greg does not fit (no CFII)', () => {
    expect(cfiFitsLesson(greg, { requiresCfii: true, requiresMulti: false })).toBe(false)
  })
  test('non-CFII lesson: Greg fits', () => {
    expect(cfiFitsLesson(greg, { requiresCfii: false, requiresMulti: false })).toBe(true)
  })
  test('non-CFI person never fits', () => {
    const mech = mockPersonnel.find(p => p.role === 'mechanic')
    expect(cfiFitsLesson(mech, { requiresCfii: false, requiresMulti: false })).toBe(false)
  })
})

// ─── isSlotOccupied ───────────────────────────────────────────────────────────

describe('isSlotOccupied', () => {
  test('returns true for exact slot match', () => {
    expect(isSlotOccupied(mockBookings, 0, '0900', 'studentId', 'std-001')).toBe(true)
  })
  test('returns true for slot within a multi-hour booking', () => {
    // bk-001: Emily, day 0, slot 0900, duration 2 → occupies 0900 + 1000
    expect(isSlotOccupied(mockBookings, 0, '1000', 'studentId', 'std-001')).toBe(true)
  })
  test('returns false outside booking window', () => {
    expect(isSlotOccupied(mockBookings, 0, '1100', 'studentId', 'std-001')).toBe(false)
  })
  test('returns false for null entityId', () => {
    expect(isSlotOccupied(mockBookings, 0, '0900', 'cfiId', null)).toBe(false)
  })
})

// ─── studentFlightFrequency ───────────────────────────────────────────────────

describe('studentFlightFrequency', () => {
  test('returns lessonsPerWeek >= 1 for each student', () => {
    mockStudents.forEach(s => {
      const { lessonsPerWeek } = studentFlightFrequency(s.id, mockBookings)
      expect(lessonsPerWeek).toBeGreaterThanOrEqual(1)
    })
  })
  test('dayGap is at least 1 and at most 7', () => {
    mockStudents.forEach(s => {
      const { dayGap } = studentFlightFrequency(s.id, mockBookings)
      expect(dayGap).toBeGreaterThanOrEqual(1)
      expect(dayGap).toBeLessThanOrEqual(7)
    })
  })
  test('student with more flight days has a smaller or equal dayGap', () => {
    // Emily (std-001) flies more often than Derek (std-004) per mock schedule
    const { dayGap: emilyGap  } = studentFlightFrequency('std-001', mockBookings)
    const { dayGap: derekGap  } = studentFlightFrequency('std-004', mockBookings)
    expect(emilyGap).toBeLessThanOrEqual(derekGap)
  })
})

// ─── findNextAvailableSlot ────────────────────────────────────────────────────

describe('findNextAvailableSlot', () => {
  test('returns a slot object with dayIdx, slot, dateLabel, weather', () => {
    const result = findNextAvailableSlot(mockBookings, 'std-001', 'prs-017', 'ac-002', {})
    expect(result).not.toBeNull()
    expect(result.dayIdx).toBeDefined()
    expect(result.slot).toBeDefined()
    expect(result.dateLabel).toBeDefined()
    expect(result.weather).toBeDefined()
  })

  test('respects VMC preference — skips IMC days', () => {
    const result = findNextAvailableSlot(mockBookings, 'std-002', 'prs-018', 'ac-003', { weatherMin: 'vmc' })
    expect(result).not.toBeNull()
    expect(result.weather.condition).not.toBe('imc')
  })

  test('any-weather preference can land on IMC day', () => {
    const result = findNextAvailableSlot(mockBookings, 'std-003', 'prs-001', 'ac-002', { weatherMin: 'any' })
    expect(result).not.toBeNull()
    expect(WEATHER_14DAY[result.dayIdx]).toBeDefined()
  })

  test('minDayIdx prevents returning earlier days', () => {
    const result = findNextAvailableSlot(mockBookings, 'std-002', 'prs-018', 'ac-003', {}, new Set(), 5)
    expect(result).not.toBeNull()
    expect(result.dayIdx).toBeGreaterThanOrEqual(5)
  })

  test('skipSlotKeys causes that slot to be skipped', () => {
    // Find the first free slot, then verify skipping it returns a different result
    const first = findNextAvailableSlot(mockBookings, 'std-002', 'prs-018', 'ac-003', {})
    expect(first).not.toBeNull()
    const skipSet = new Set([`${first.dayIdx}:${first.slot}`])
    const second  = findNextAvailableSlot(mockBookings, 'std-002', 'prs-018', 'ac-003', {}, skipSet)
    expect(second).not.toBeNull()
    // Must differ from first
    expect(`${second.dayIdx}:${second.slot}`).not.toBe(`${first.dayIdx}:${first.slot}`)
  })
})

// ─── recommendLessons ────────────────────────────────────────────────────────

describe('recommendLessons', () => {
  test('returns up to 3 recommendations for each student', () => {
    mockStudents.forEach(s => {
      const recs = recommendLessons(s, mockPersonnel, mockAircraft, mockBookings)
      expect(recs.length).toBeGreaterThan(0)
      expect(recs.length).toBeLessThanOrEqual(3)
    })
  })

  test('all proposals with slots are on different days', () => {
    mockStudents.forEach(s => {
      const recs = recommendLessons(s, mockPersonnel, mockAircraft, mockBookings)
      const days = recs.filter(r => r.slot).map(r => r.slot.dayIdx)
      const uniqueDays = new Set(days)
      expect(uniqueDays.size).toBe(days.length)
    })
  })

  test('skipping a slot produces a different set of proposals', () => {
    const student = mockStudents.find(s => s.program === 'private_pilot' && s.currentStage === 1)
    const first = recommendLessons(student, mockPersonnel, mockAircraft, mockBookings)
    const firstSlotKey = first[0]?.slot ? `${first[0].slot.dayIdx}:${first[0].slot.slot}` : null
    if (!firstSlotKey) return // skip if no slot found
    const skipSet = new Set([firstSlotKey])
    const second = recommendLessons(student, mockPersonnel, mockAircraft, mockBookings, skipSet)
    const secondSlotKey = second[0]?.slot ? `${second[0].slot.dayIdx}:${second[0].slot.slot}` : null
    expect(secondSlotKey).not.toBe(firstSlotKey)
  })

  test('IR student (Priya) gets CFII-holding instructor', () => {
    const priya = mockStudents.find(s => s.program === 'instrument_rating')
    const recs  = recommendLessons(priya, mockPersonnel, mockAircraft, mockBookings)
    const dualRecs = recs.filter(r => r.template.type !== 'solo' && r.template.type !== 'ground')
    dualRecs.forEach(rec => {
      if (rec.cfi) expect(rec.cfi.cfiRatings).toContain('CFII')
    })
  })

  test('IR student gets IFR-equipped aircraft for flight lessons', () => {
    const priya = mockStudents.find(s => s.program === 'instrument_rating')
    const recs  = recommendLessons(priya, mockPersonnel, mockAircraft, mockBookings)
    recs.filter(r => r.template.requiresIfrAircraft).forEach(rec => {
      if (rec.aircraft) expect(rec.aircraft.equipment.ifrCertified).toBe(true)
    })
  })

  test('commercial stage-2 student gets complex aircraft for complex lessons', () => {
    const derek = mockStudents.find(s => s.program === 'commercial_pilot')
    // Temporarily set stage to 2 to test complex matching
    const fakeDerek = { ...derek, currentStage: 2 }
    const recs = recommendLessons(fakeDerek, mockPersonnel, mockAircraft, mockBookings)
    recs.filter(r => r.template.requiresComplex).forEach(rec => {
      if (rec.aircraft) expect(rec.aircraft.riskProfile.complexAircraft).toBe(true)
    })
  })

  test('each recommendation has a slot or null (not undefined)', () => {
    mockStudents.forEach(s => {
      const recs = recommendLessons(s, mockPersonnel, mockAircraft, mockBookings)
      recs.forEach(r => {
        expect(r.slot === null || typeof r.slot === 'object').toBe(true)
      })
    })
  })

  test('grounded aircraft is never recommended', () => {
    mockStudents.forEach(s => {
      const recs = recommendLessons(s, mockPersonnel, mockAircraft, mockBookings)
      recs.forEach(r => {
        if (r.aircraft) expect(r.aircraft.airworthy).toBe(true)
      })
    })
  })
})

// ─── calcTrainingWB ───────────────────────────────────────────────────────────

describe('calcTrainingWB', () => {
  const c172s   = mockAircraft.find(a => a.id === 'ac-002')  // C172S
  const cherokee= mockAircraft.find(a => a.id === 'ac-003')  // Cherokee

  test('returns null for aircraft without weightBalance', () => {
    const noWb = { ...c172s, weightBalance: undefined }
    expect(calcTrainingWB(noWb, 150, 170)).toBeNull()
  })

  test('C172S dual flight — typical weights — is within limits', () => {
    const wb = calcTrainingWB(c172s, 135, 192)  // Emily + James
    expect(wb).not.toBeNull()
    expect(wb.ok).toBe(true)
    expect(wb.overweight).toBe(false)
    expect(wb.cgOk).toBe(true)
  })

  test('Cherokee dual flight — within limits', () => {
    const wb = calcTrainingWB(cherokee, 178, 168)  // Tyler + Greg
    expect(wb).not.toBeNull()
    expect(wb.ok).toBe(true)
  })

  test('totalWeightLbs includes empty + occupants + fuel + baggage', () => {
    const wb = calcTrainingWB(c172s, 135, 192, 30, 20)
    const expected = 1663 + 135 + 192 + (30 * 6.0) + 20  // 2190 lbs
    expect(wb.totalWeightLbs).toBe(Math.round(expected))
  })

  test('overweight flag set when total exceeds maxGross', () => {
    // Force overweight: 3 heavy occupants worth
    const wb = calcTrainingWB(c172s, 400, 400, 53, 200)
    expect(wb.overweight).toBe(true)
    expect(wb.overweightBy).toBeGreaterThan(0)
  })

  test('solo flight: cfiWeightLbs=0 reduces total weight', () => {
    const dual = calcTrainingWB(c172s, 178, 168)
    const solo = calcTrainingWB(c172s, 178, 0)
    expect(solo.totalWeightLbs).toBe(dual.totalWeightLbs - 168)
  })
})

describe('wbStatusLevel', () => {
  test('returns ok for a normal training flight', () => {
    const ac = mockAircraft.find(a => a.id === 'ac-002')
    const wb = calcTrainingWB(ac, 135, 192)
    expect(wbStatusLevel(wb)).toBe('ok')
  })

  test('returns no_go when overweight', () => {
    const ac = mockAircraft.find(a => a.id === 'ac-002')
    const wb = calcTrainingWB(ac, 400, 400, 53, 200)
    expect(wbStatusLevel(wb)).toBe('no_go')
  })

  test('returns null for null input', () => {
    expect(wbStatusLevel(null)).toBeNull()
  })
})

// ─── Training component smoke tests ───────────────────────────────────────────

describe('Training component', () => {
  test('renders without crashing', () => {
    renderTraining()
    expect(screen.getByText('Pilot Training')).toBeInTheDocument()
  })

  test('renders all tab buttons', () => {
    renderTraining()
    const tabs = ['Overview', 'Students', 'CFIs', 'Schedule', 'Programs', 'Flying Club', 'DPE']
    tabs.forEach((t) => {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
    })
  })

  test('Overview tab shows KPI tiles', () => {
    renderTraining()
    expect(screen.getByText('Active Students')).toBeInTheDocument()
    expect(screen.getByText('CFIs on Staff')).toBeInTheDocument()
    expect(screen.getByText('Club Members')).toBeInTheDocument()
  })

  test('clicking Students tab shows roster', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'Students' }))
    expect(screen.getByText('Roster')).toBeInTheDocument()
    expect(screen.getByText("Required Documents")).toBeInTheDocument()
  })

  test('clicking CFIs tab shows CFI roster section', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'CFIs' }))
    expect(screen.getByText(/CFI Roster/)).toBeInTheDocument()
  })

  test('clicking Programs tab shows 3 program cards', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'Programs' }))
    expect(screen.getByText('Private Pilot Certificate')).toBeInTheDocument()
    expect(screen.getByText('Instrument Rating Add-On')).toBeInTheDocument()
    expect(screen.getByText('Commercial Pilot Certificate')).toBeInTheDocument()
  })

  test('clicking Flying Club tab shows member roster', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'Flying Club' }))
    expect(screen.getByText('Member Roster')).toBeInTheDocument()
    expect(screen.getByText('Boulder Aviators Club')).toBeInTheDocument()
  })

  test('clicking DPE tab shows scheduling checklist', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'DPE' }))
    expect(screen.getByText('Scheduling Checklist')).toBeInTheDocument()
  })

  test('DPE tab checkboxes are interactive', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'DPE' }))
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    // Toggle one
    const first = checkboxes[0]
    const initialState = first.checked
    fireEvent.click(first)
    expect(first.checked).toBe(!initialState)
  })

  test('Schedule tab renders time slots', () => {
    renderTraining()
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByText('0700')).toBeInTheDocument()
    expect(screen.getByText('0900')).toBeInTheDocument()
  })
})
