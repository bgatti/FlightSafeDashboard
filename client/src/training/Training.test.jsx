import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Training } from './Training'
import {
  mockStudents, mockClubMembers, mockDpeContacts, PROGRAMS, BLOCK_PACKAGES, CLUB_CONFIG,
} from './mockTraining'
import {
  expiryStatus, expiryLabel,
  blockDiscountPct, effectiveRate, applyClubDiscount,
  requirementProgress, metRequirementCount, stageProgress,
  tasksComplete, isCheckrideReady,
  clubEligibilityIssues,
} from './trainingUtils'

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
  test('all 3 programs defined', () => {
    expect(Object.keys(PROGRAMS)).toHaveLength(3)
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
