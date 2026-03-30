// =============================================================================
// Training Module — 7 tabs
// Overview | Students | CFIs | Schedule | Programs | Flying Club | DPE
// =============================================================================

import { useState } from 'react'
import {
  mockStudents, mockClubMembers, mockBookings, mockDpeContacts,
  PROGRAMS, BLOCK_PACKAGES, CLUB_CONFIG, SCHEDULE_DAYS, SCHEDULE_SLOTS,
} from './mockTraining'
import { mockPersonnel } from '../mocks/personnel'
import { mockAircraft } from '../mocks/aircraft'
import {
  expiryStatus, expiryLabel, EXPIRY_COLOR, EXPIRY_BG,
  blockDiscountPct, effectiveRate,
  requirementProgress, metRequirementCount, stageProgress,
  tasksComplete, isCheckrideReady,
  clubEligibilityIssues,
  BOOKING_TYPE_COLORS, BOOKING_TYPE_LABELS,
  DPE_STATUS_LABEL, DPE_STATUS_COLOR, DPE_STATUS_BG,
  recommendLessons,
  WEATHER_FIT_COLORS, WEATHER_FIT_LABELS,
} from './trainingUtils'

// ── Shared layout helpers ─────────────────────────────────────────────────────

const TABS = ['Overview', 'Students', 'CFIs', 'Schedule', 'Programs', 'Flying Club', 'DPE']

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-surface-border mb-6 overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={[
            'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
            active === t
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
      {children}
    </h3>
  )
}

function KpiTile({ label, value, sub, subColor = 'text-slate-500', alert }) {
  return (
    <div className={`bg-surface-card border rounded-lg p-3 text-center flex-1 min-w-[120px] ${
      alert ? 'border-amber-400/40' : 'border-surface-border'
    }`}>
      <p className={`font-mono font-bold text-xl ${alert ? 'text-amber-400' : 'text-slate-100'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  )
}

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {children}
    </span>
  )
}

function DocBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${EXPIRY_BG[status] ?? 'bg-slate-700/30 border-slate-600'}`}>
      <span className={EXPIRY_COLOR[status] ?? 'text-slate-400'}>{label}</span>
    </span>
  )
}

function ProgressBar({ pct, color = 'bg-sky-400' }) {
  return (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

function getPerson(id) { return mockPersonnel.find((p) => p.id === id) }
function getAircraft(id) { return mockAircraft.find((a) => a.id === id) }
function getStudent(id) { return mockStudents.find((s) => s.id === id) }
function getDpe(id) { return mockDpeContacts.find((d) => d.id === id) }

// CFI personnel = those with a cfiCert field
const cfiPersonnel = mockPersonnel.filter((p) => p.cfiCert)

// ═════════════════════════════════════════════════════════════════════════════
// TAB: Overview
// ═════════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const totalStudents  = mockStudents.length
  const activeStudents = mockStudents.filter((s) => s.status === 'active').length
  const scheduled      = mockStudents.filter((s) => s.dpe?.status === 'scheduled').length
  const ready          = mockStudents.filter((s) => s.dpe?.status === 'ready').length

  // Expiring docs alerts
  const docAlerts = []
  mockStudents.forEach((s) => {
    Object.entries(s.docs).forEach(([key, doc]) => {
      if (!doc?.expiry) return
      const st = expiryStatus(doc.expiry)
      if (st === 'expired' || st === 'expiring') {
        docAlerts.push({ student: s.name, field: key, expiry: doc.expiry, status: st })
      }
    })
  })

  const clubActive = mockClubMembers.filter((m) => m.duesCurrent).length
  const clubIssues = mockClubMembers.filter((m) => clubEligibilityIssues(m).length > 0).length

  const activeCfis = cfiPersonnel.length

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div>
        <SectionTitle>Training Operations</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <KpiTile label="Active Students"    value={activeStudents}  sub={`of ${totalStudents} enrolled`} />
          <KpiTile label="CFIs on Staff"      value={activeCfis}      sub="incl. Part 135 dual-role" />
          <KpiTile label="Checkrides Sched."  value={scheduled}       sub={ready > 0 ? `+${ready} ready` : 'none ready'} subColor="text-sky-400" />
          <KpiTile label="Club Members"       value={mockClubMembers.length} sub={`${clubActive} dues current`} subColor="text-emerald-400" />
          <KpiTile label="Doc Alerts"         value={docAlerts.length} alert={docAlerts.length > 0} sub={docAlerts.length > 0 ? 'action required' : 'all clear'} subColor={docAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          {clubIssues > 0 && <KpiTile label="Club Issues" value={clubIssues} alert sub="eligibility flags" subColor="text-amber-400" />}
        </div>
      </div>

      {/* Doc alerts */}
      {docAlerts.length > 0 && (
        <div>
          <SectionTitle>Document Alerts</SectionTitle>
          <div className="space-y-2">
            {docAlerts.map((a, i) => {
              const fieldLabels = {
                governmentId: 'Government ID', insurance: 'Renter\'s Insurance',
                medicalCert: 'Medical Certificate', pilotCert: 'Pilot Certificate',
                studentPilotCert: 'Student Pilot Cert', knowledgeTest: 'Knowledge Test',
              }
              return (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${EXPIRY_BG[a.status]}`}>
                  <span className="text-slate-200">{a.student} — <span className="text-slate-400">{fieldLabels[a.field] ?? a.field}</span></span>
                  <span className={EXPIRY_COLOR[a.status]}>{expiryLabel(a.expiry)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Student snapshot */}
      <div>
        <SectionTitle>Student Snapshot</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mockStudents.map((s) => {
            const prog   = PROGRAMS[s.program]
            const stagePct = stageProgress(s, s.program)
            const cfi    = getPerson(s.assignedCfiId)
            return (
              <div key={s.id} className="bg-surface-card border border-surface-border rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-slate-100 font-medium text-sm">{s.name}</p>
                    <p className="text-slate-500 text-xs">{prog?.name} · Stage {s.currentStage}/{prog?.stages.length}</p>
                  </div>
                  <Badge className={DPE_STATUS_BG[s.dpe.status]}>
                    <span className={DPE_STATUS_COLOR[s.dpe.status]}>{DPE_STATUS_LABEL[s.dpe.status]}</span>
                  </Badge>
                </div>
                <ProgressBar pct={stagePct} />
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                  <span>{s.hours.total?.toFixed(1)} hrs logged</span>
                  <span>CFI: {cfi?.name ?? '—'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: Students
// ═════════════════════════════════════════════════════════════════════════════

function StudentsTab() {
  const [selected, setSelected] = useState(mockStudents[0].id)
  const student = mockStudents.find((s) => s.id === selected)
  const program = PROGRAMS[student?.program]
  const cfi     = getPerson(student?.assignedCfiId)
  const reqs    = requirementProgress(student, student?.program)
  const metCount = metRequirementCount(student, student?.program)

  const DOC_FIELDS = [
    { key: 'governmentId',     label: 'Government ID',       showExpiry: true  },
    { key: 'insurance',        label: "Renter's Insurance",  showExpiry: true  },
    { key: 'medicalCert',      label: 'Medical Certificate', showExpiry: true  },
    { key: 'studentPilotCert', label: 'Student Pilot Cert',  showExpiry: false },
    { key: 'pilotCert',        label: 'Pilot Certificate',   showExpiry: false },
    { key: 'irCert',           label: 'Instrument Rating',   showExpiry: false },
    { key: 'knowledgeTest',    label: 'Knowledge Test',      showExpiry: false },
  ]

  return (
    <div className="flex gap-4">
      {/* Roster list */}
      <div className="w-48 shrink-0 space-y-1">
        <SectionTitle>Roster</SectionTitle>
        {mockStudents.map((s) => {
          const hasAlert = Object.values(s.docs).some((d) => {
            const st = expiryStatus(d?.expiry)
            return st === 'expired' || st === 'expiring'
          })
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={[
                'w-full text-left px-3 py-2 rounded text-sm transition-colors border',
                selected === s.id
                  ? 'bg-sky-400/10 border-sky-400/40 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/5',
              ].join(' ')}
            >
              <span className="block font-medium truncate">{s.name}</span>
              <span className="block text-xs text-slate-500 truncate">{PROGRAMS[s.program]?.name.split(' ').slice(0, 2).join(' ')}</span>
              {hasAlert && <span className="text-xs text-amber-400">⚠ Doc alert</span>}
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {student && (
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-slate-100 font-semibold text-lg">{student.name}</h2>
              <p className="text-slate-400 text-sm">{student.email} · {student.phone}</p>
              <p className="text-slate-500 text-xs mt-0.5">Enrolled {student.enrolledDate} · {program?.name} · Stage {student.currentStage}/{program?.stages.length}</p>
            </div>
            <div className="flex gap-2">
              <Badge className={DPE_STATUS_BG[student.dpe.status]}>
                <span className={DPE_STATUS_COLOR[student.dpe.status]}>{DPE_STATUS_LABEL[student.dpe.status]}</span>
              </Badge>
              {student.clubMember && (
                <Badge className="bg-violet-400/10 border-violet-400/30 text-violet-300">Club Member</Badge>
              )}
            </div>
          </div>

          {/* Documents */}
          <div>
            <SectionTitle>Required Documents</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DOC_FIELDS.map(({ key, label, showExpiry }) => {
                const doc = student.docs[key]
                if (!doc) return null
                const status = showExpiry ? expiryStatus(doc.expiry) : null
                return (
                  <div key={key} className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${
                    status ? EXPIRY_BG[status] : 'bg-surface-card border-surface-border'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={doc.uploaded ? 'text-emerald-400' : 'text-slate-600'}>
                        {doc.uploaded ? '📎' : '○'}
                      </span>
                      <span className="text-slate-200">{label}</span>
                      {doc.certNumber && <span className="text-slate-500 text-xs">{doc.certNumber}</span>}
                      {doc.score      && <span className="text-slate-500 text-xs">Score: {doc.score}</span>}
                    </div>
                    {showExpiry && doc.expiry && (
                      <span className={`text-xs ${EXPIRY_COLOR[status]}`}>{expiryLabel(doc.expiry)}</span>
                    )}
                    {!showExpiry && (
                      <span className="text-xs text-slate-500">{doc.issueDate || doc.certType || (doc.dateTaken && `Taken ${doc.dateTaken}`) || '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hours progress */}
          <div>
            <SectionTitle>Hour Requirements ({metCount}/{reqs.length} met)</SectionTitle>
            <div className="space-y-2">
              {reqs.map((req) => (
                <div key={req.id}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={req.actual >= req.min ? 'text-emerald-400' : 'text-slate-400'}>
                      {req.actual >= req.min ? '✓ ' : ''}{req.label}
                    </span>
                    <span className="text-slate-400 font-mono">{req.actual.toFixed(1)} / {req.min} {req.unit}</span>
                  </div>
                  <ProgressBar pct={req.pct} color={req.actual >= req.min ? 'bg-emerald-400' : 'bg-sky-400'} />
                </div>
              ))}
            </div>
          </div>

          {/* Block purchase + assigned resources */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionTitle>Block Purchase</SectionTitle>
              <div className="bg-surface-card border border-surface-border rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Purchased</span>
                  <span className="text-slate-100 font-mono">{student.blockHoursPurchased} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Used</span>
                  <span className="text-slate-100 font-mono">{student.blockHoursUsed.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining</span>
                  <span className="text-sky-400 font-mono">{(student.blockHoursPurchased - student.blockHoursUsed).toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-surface-border">
                  <span className="text-slate-400">Block discount</span>
                  <span className="text-emerald-400">{blockDiscountPct(student.blockHoursPurchased)}% off</span>
                </div>
              </div>
            </div>
            <div>
              <SectionTitle>Assigned Resources</SectionTitle>
              <div className="bg-surface-card border border-surface-border rounded-lg p-3 space-y-1 text-sm">
                <div><span className="text-slate-400 text-xs">Default CFI</span>
                  <p className="text-slate-200">{cfi ? cfi.name : '—'}</p>
                  {cfi && <p className="text-slate-500 text-xs">{cfi.cfiRatings?.join(' · ')}</p>}
                </div>
                <div className="pt-1"><span className="text-slate-400 text-xs">Default Aircraft</span>
                  {student.assignedAircraftIds.map((id) => {
                    const ac = getAircraft(id)
                    return ac && (
                      <p key={id} className="text-slate-200 text-xs">
                        {ac.tailNumber} — {ac.makeModel}
                        {ac.riskProfile?.complexAircraft && <span className="ml-1 text-amber-400">Complex</span>}
                        {ac.riskProfile?.multiEngine     && <span className="ml-1 text-sky-400">Multi</span>}
                        {ac.equipment?.ifrCertified      && <span className="ml-1 text-violet-400">IFR</span>}
                      </p>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Next 3 lesson recommendations */}
          <NextLessonsPanel student={student} />
        </div>
      )}
    </div>
  )
}

// ── Next 3 Lessons Panel ──────────────────────────────────────────────────────

function NextLessonsPanel({ student }) {
  const recommendations = recommendLessons(student, mockPersonnel, mockAircraft, mockBookings)

  if (!recommendations.length) return null

  return (
    <div>
      <SectionTitle>Proposed Next 3 Lessons</SectionTitle>
      <p className="text-slate-500 text-xs -mt-2 mb-3">
        Based on program stage, hour gaps, CFI availability, aircraft requirements, and {student.preferences?.weatherMin === 'any' ? 'any' : 'VMC'} weather preference.
      </p>
      <div className="space-y-3">
        {recommendations.map((rec, i) => {
          const { template, aircraft, cfi, slot, wx, fit, reason, acWarnings } = rec
          const typeColor  = BOOKING_TYPE_COLORS[template.type] ?? 'bg-slate-400/20 border-slate-400/40 text-slate-300'
          const fitColor   = WEATHER_FIT_COLORS[fit]
          const fitLabel   = WEATHER_FIT_LABELS[fit]

          return (
            <div key={template.id} className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border/60">
                <span className="text-slate-500 text-xs font-mono">#{i + 1}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${typeColor}`}>
                  {BOOKING_TYPE_LABELS[template.type]}
                </span>
                <p className="text-slate-100 font-medium text-sm flex-1">{template.title}</p>
                <span className="text-slate-500 text-xs">{template.durationHr}h</span>
              </div>

              {/* Body */}
              <div className="grid grid-cols-3 gap-0 divide-x divide-surface-border/60 text-xs">
                {/* CFI column */}
                <div className="px-3 py-2">
                  <p className="text-slate-500 mb-1">Instructor</p>
                  {template.type === 'solo' ? (
                    <p className="text-slate-400 italic">Solo — no CFI</p>
                  ) : cfi ? (
                    <>
                      <p className="text-slate-200">{cfi.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cfi.cfiRatings?.map(r => (
                          <span key={r} className={`px-1.5 py-0.5 rounded text-xs border ${
                            r === 'CFII' ? 'bg-violet-400/10 border-violet-400/30 text-violet-300' :
                            r === 'MEI'  ? 'bg-amber-400/10  border-amber-400/30  text-amber-300'  :
                                           'bg-sky-400/10    border-sky-400/30    text-sky-300'
                          }`}>{r}</span>
                        ))}
                        {['pilot_pic','pilot_sic'].includes(cfi.role) && (
                          <span className="px-1.5 py-0.5 rounded text-xs border bg-amber-400/10 border-amber-400/30 text-amber-300">135</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-risk-high">No qualified CFI</p>
                  )}
                </div>

                {/* Aircraft column */}
                <div className="px-3 py-2">
                  <p className="text-slate-500 mb-1">Aircraft</p>
                  {template.type === 'ground' ? (
                    <p className="text-slate-400 italic">Ground — no aircraft</p>
                  ) : aircraft ? (
                    <>
                      <p className="text-slate-200">{aircraft.tailNumber}</p>
                      <p className="text-slate-500">{aircraft.makeModel}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {aircraft.equipment?.ifrCertified      && <span className="px-1.5 py-0.5 rounded text-xs border bg-sky-400/10    border-sky-400/30    text-sky-300">IFR</span>}
                        {aircraft.riskProfile?.complexAircraft  && <span className="px-1.5 py-0.5 rounded text-xs border bg-amber-400/10  border-amber-400/30  text-amber-300">Complex</span>}
                        {aircraft.riskProfile?.multiEngine      && <span className="px-1.5 py-0.5 rounded text-xs border bg-emerald-400/10 border-emerald-400/30 text-emerald-300">Multi</span>}
                        {aircraft.equipment?.glassPanel         && <span className="px-1.5 py-0.5 rounded text-xs border bg-violet-400/10  border-violet-400/30  text-violet-300">Glass</span>}
                      </div>
                      {acWarnings.length > 0 && (
                        <p className="text-amber-400 mt-1">⚠ {acWarnings[0]}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-risk-high">No matching aircraft</p>
                  )}
                </div>

                {/* Slot + weather column */}
                <div className="px-3 py-2">
                  <p className="text-slate-500 mb-1">Next Opportunity</p>
                  {slot ? (
                    <>
                      <p className="text-slate-200">{slot.dateLabel}</p>
                      <p className="text-slate-400">{slot.slot.replace(/(\d{2})(\d{2})/, '$1:$2')}</p>
                      {wx && (
                        <div className="mt-1">
                          <p className="text-slate-300">{wx.icon} {wx.label}</p>
                          <p className="text-slate-500">{wx.ceiling} · {wx.vis} · {wx.wind}</p>
                          <p className={`mt-0.5 font-medium ${fitColor}`}>{fitLabel}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500">No slot found (next 2 weeks)</p>
                  )}
                </div>
              </div>

              {/* Reason footer */}
              {reason && (
                <div className="px-3 py-1.5 bg-slate-800/30 border-t border-surface-border/40">
                  <p className="text-slate-500 text-xs">{reason}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: CFIs
// ═════════════════════════════════════════════════════════════════════════════

function CfisTab() {
  const assignedMap = {}
  mockStudents.forEach((s) => {
    if (!assignedMap[s.assignedCfiId]) assignedMap[s.assignedCfiId] = []
    assignedMap[s.assignedCfiId].push(s.name)
  })

  return (
    <div className="space-y-4">
      <SectionTitle>CFI Roster — Combined Part 61 / Part 135</SectionTitle>
      <p className="text-slate-500 text-xs -mt-2 mb-2">
        Instructors listed below hold CFI/CFII/MEI ratings. Those also qualified as Part 135 crew are marked accordingly.
      </p>
      <div className="space-y-3">
        {cfiPersonnel.map((p) => {
          const isPart135 = ['pilot_pic', 'pilot_sic'].includes(p.role)
          const students  = assignedMap[p.id] ?? []
          const medSt     = expiryStatus(p.medicalExpiry)
          return (
            <div key={p.id} className="bg-surface-card border border-surface-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-slate-100 font-semibold">{p.name}</p>
                  <p className="text-slate-400 text-xs">{p.roleLabel} · {p.department}</p>
                  <p className="text-slate-500 text-xs font-mono mt-0.5">{p.certificateNumber}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {p.cfiRatings?.map((r) => (
                    <Badge key={r} className="bg-sky-400/10 border-sky-400/30 text-sky-300">{r}</Badge>
                  ))}
                  {isPart135 && (
                    <Badge className="bg-amber-400/10 border-amber-400/30 text-amber-300">Part 135</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                <div>
                  <p className="text-slate-500">CFI Certificate</p>
                  <p className="text-slate-200 font-mono">{p.cfiCert}</p>
                </div>
                <div>
                  <p className="text-slate-500">Medical</p>
                  <p className={EXPIRY_COLOR[medSt] ?? 'text-slate-400'}>
                    Class {p.medicalClass} · {expiryLabel(p.medicalExpiry)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Active Students</p>
                  {students.length > 0
                    ? students.map((n) => <p key={n} className="text-slate-200">{n}</p>)
                    : <p className="text-slate-500">None assigned</p>
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: Schedule
// ═════════════════════════════════════════════════════════════════════════════

function ScheduleTab() {
  const [filterDay,      setFilterDay]      = useState(null)
  const [filterAircraft, setFilterAircraft] = useState(null)  // aircraftId or null
  const [filterCfi,      setFilterCfi]      = useState(null)  // personnelId or null

  const SLOT_H = 40

  // Unique aircraft and CFIs that actually appear in bookings
  const bookingAircraftIds = [...new Set(mockBookings.map(b => b.aircraftId).filter(Boolean))]
  const bookingCfiIds      = [...new Set(mockBookings.map(b => b.cfiId).filter(Boolean))]

  function visibleBookings(dayIdx, slot) {
    return mockBookings.filter((b) => {
      if (b.day !== dayIdx || b.slot !== slot) return false
      if (filterAircraft && b.aircraftId !== filterAircraft) return false
      if (filterCfi      && b.cfiId      !== filterCfi)      return false
      return true
    })
  }

  // When a filter is active, highlight days that have matching bookings
  function dayHasMatches(dayIdx) {
    return mockBookings.some(b => {
      if (b.day !== dayIdx) return false
      if (filterAircraft && b.aircraftId !== filterAircraft) return false
      if (filterCfi      && b.cfiId      !== filterCfi)      return false
      return true
    })
  }

  function filterBtn(active, onClick, children) {
    return (
      <button onClick={onClick}
        className={`text-xs px-3 py-1 rounded border transition-colors ${
          active ? 'bg-sky-400/10 border-sky-400/40 text-sky-400' : 'border-surface-border text-slate-400 hover:text-slate-200'
        }`}>{children}</button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header + legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <SectionTitle>Week of Mar 30 – Apr 4, 2026</SectionTitle>
        <div className="flex gap-1 ml-auto flex-wrap">
          {Object.entries(BOOKING_TYPE_LABELS).map(([k, v]) => (
            <span key={k} className={`text-xs px-2 py-0.5 rounded border ${BOOKING_TYPE_COLORS[k]}`}>{v}</span>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-start">
        {/* Day filter */}
        <div className="flex gap-1 flex-wrap">
          {filterBtn(filterDay === null, () => setFilterDay(null), 'All Days')}
          {SCHEDULE_DAYS.map((d, i) => {
            const hasMatch = (filterAircraft || filterCfi) ? dayHasMatches(i) : true
            return (
              <button key={d} onClick={() => setFilterDay(i === filterDay ? null : i)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  filterDay === i
                    ? 'bg-sky-400/10 border-sky-400/40 text-sky-400'
                    : hasMatch
                      ? 'border-surface-border text-slate-400 hover:text-slate-200'
                      : 'border-surface-border/30 text-slate-600'
                }`}>{d}</button>
            )
          })}
        </div>

        {/* Aircraft filter */}
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-slate-500 text-xs">Aircraft:</span>
          {filterBtn(filterAircraft === null, () => setFilterAircraft(null), 'All')}
          {bookingAircraftIds.map(id => {
            const ac = getAircraft(id)
            if (!ac) return null
            return (
              <button key={id} onClick={() => setFilterAircraft(id === filterAircraft ? null : id)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${filterAircraft === id ? 'bg-sky-400/10 border-sky-400/40 text-sky-400' : 'border-surface-border text-slate-400 hover:text-slate-200'}`}>
                {ac.tailNumber}
              </button>
            )
          })}
        </div>

        {/* CFI filter */}
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-slate-500 text-xs">CFI:</span>
          {filterBtn(filterCfi === null, () => setFilterCfi(null), 'All')}
          {bookingCfiIds.map(id => {
            const p = getPerson(id)
            if (!p) return null
            return (
              <button key={id} onClick={() => setFilterCfi(id === filterCfi ? null : id)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${filterCfi === id ? 'bg-sky-400/10 border-sky-400/40 text-sky-400' : 'border-surface-border text-slate-400 hover:text-slate-200'}`}>
                {p.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active filter summary */}
      {(filterAircraft || filterCfi) && (
        <div className="flex gap-2 text-xs">
          {filterAircraft && (
            <span className="bg-sky-400/10 border border-sky-400/30 text-sky-300 px-2 py-0.5 rounded">
              {getAircraft(filterAircraft)?.tailNumber} — {getAircraft(filterAircraft)?.makeModel}
              <button onClick={() => setFilterAircraft(null)} className="ml-1 text-slate-400 hover:text-slate-200">✕</button>
            </span>
          )}
          {filterCfi && (
            <span className="bg-sky-400/10 border border-sky-400/30 text-sky-300 px-2 py-0.5 rounded">
              CFI: {getPerson(filterCfi)?.name}
              <button onClick={() => setFilterCfi(null)} className="ml-1 text-slate-400 hover:text-slate-200">✕</button>
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="text-left text-slate-500 py-1 pr-3 w-14">Time</th>
              {SCHEDULE_DAYS.map((d, i) => (
                (filterDay === null || filterDay === i) &&
                <th key={d} className="text-slate-400 py-1 px-2 text-center font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_SLOTS.map((slot) => (
              <tr key={slot} className="border-t border-surface-border/40">
                <td className="text-slate-600 py-1 pr-3 align-top font-mono">{slot}</td>
                {SCHEDULE_DAYS.map((d, dayIdx) => {
                  if (filterDay !== null && filterDay !== dayIdx) return null
                  const bkgs = visibleBookings(dayIdx, slot)
                  return (
                    <td key={d} className="px-1 py-1 align-top" style={{ minWidth: 120 }}>
                      {bkgs.map((b) => {
                        const student = b.studentId  ? getStudent(b.studentId)    : null
                        const cfi     = b.cfiId      ? getPerson(b.cfiId)         : null
                        const ac      = b.aircraftId ? getAircraft(b.aircraftId)  : null
                        return (
                          <div key={b.id} className={`rounded border px-2 py-1 mb-1 ${BOOKING_TYPE_COLORS[b.type]}`}
                            style={{ minHeight: SLOT_H * b.duration - 4 }}>
                            <p className="font-medium leading-tight truncate">{b.title}</p>
                            {student && <p className="text-slate-400 truncate">{student.name}</p>}
                            {cfi     && <p className="text-slate-500 truncate">CFI: {cfi.name.split(' ')[0]}</p>}
                            {ac      && <p className="text-slate-500 truncate">{ac.tailNumber}</p>}
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: Programs
// ═════════════════════════════════════════════════════════════════════════════

function ProgramsTab() {
  const [activeProgram, setActiveProgram] = useState('private_pilot')
  const prog = PROGRAMS[activeProgram]

  return (
    <div className="space-y-6">
      {/* Program selector */}
      <div className="grid grid-cols-3 gap-3">
        {Object.values(PROGRAMS).map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProgram(p.id)}
            className={[
              'p-4 rounded-lg border text-left transition-colors',
              activeProgram === p.id
                ? 'bg-sky-400/10 border-sky-400/40'
                : 'bg-surface-card border-surface-border hover:border-sky-400/30',
            ].join(' ')}
          >
            <p className="text-2xl mb-1">{p.icon}</p>
            <p className={`font-semibold text-sm ${activeProgram === p.id ? 'text-sky-400' : 'text-slate-100'}`}>{p.name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{p.reg}</p>
            <p className="text-emerald-400 text-xs mt-1 font-mono">from ${p.typicalCost.min.toLocaleString()}</p>
          </button>
        ))}
      </div>

      {/* Selected program detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stages */}
        <div>
          <SectionTitle>{prog.name} — Course Stages</SectionTitle>
          <div className="space-y-2">
            {prog.stages.map((s) => (
              <div key={s.number} className="bg-surface-card border border-surface-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-sky-400/20 border border-sky-400/40 text-sky-400 text-xs flex items-center justify-center font-bold">{s.number}</span>
                  <p className="text-slate-200 font-medium text-sm">{s.title}</p>
                  <span className="ml-auto text-slate-500 text-xs">{s.minHours} hrs min</span>
                </div>
                <div className="flex flex-wrap gap-1 pl-8">
                  {s.objectives.map((o) => (
                    <span key={o} className="text-xs bg-slate-700/40 text-slate-400 px-2 py-0.5 rounded">{o}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing + block packages */}
        <div className="space-y-4">
          <div>
            <SectionTitle>Base Pricing</SectionTitle>
            <div className="bg-surface-card border border-surface-border rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Aircraft wet rate</span>
                <span className="text-slate-100 font-mono">${prog.wetRatePerHr}/hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Instructor rate</span>
                <span className="text-slate-100 font-mono">${prog.instructorRatePerHr}/hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Combined rate</span>
                <span className="text-sky-400 font-mono">${prog.wetRatePerHr + prog.instructorRatePerHr}/hr</span>
              </div>
              <div className="flex justify-between border-t border-surface-border pt-2">
                <span className="text-slate-400">Typical total ({prog.typicalHours.avg} hrs avg)</span>
                <span className="text-slate-100 font-mono">${prog.typicalCost.avg.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <SectionTitle>Block Purchase Packages</SectionTitle>
            <div className="space-y-2">
              {BLOCK_PACKAGES.map((pkg) => {
                const discountedAcRate = Math.round(prog.wetRatePerHr * (1 - pkg.discountPct / 100))
                const totalSaved = Math.round(prog.wetRatePerHr * pkg.discountPct / 100 * pkg.hours)
                return (
                  <div key={pkg.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm ${
                    pkg.popular ? 'bg-sky-400/5 border-sky-400/30' : 'bg-surface-card border-surface-border'
                  }`}>
                    <div>
                      <p className="text-slate-200 font-medium">{pkg.label}
                        {pkg.popular && <span className="ml-2 text-xs text-sky-400">★ Popular</span>}
                      </p>
                      <p className="text-slate-500 text-xs">${discountedAcRate}/hr aircraft · save ${totalSaved} total</p>
                    </div>
                    <span className="text-emerald-400 font-bold">{pkg.discountPct}% off</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <SectionTitle>FAR Requirements Summary</SectionTitle>
            <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="text-left text-slate-500 px-3 py-2">Requirement</th>
                    <th className="text-right text-slate-500 px-3 py-2">Minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {prog.requirements.map((r) => (
                    <tr key={r.id} className="border-b border-surface-border/40 last:border-0">
                      <td className="px-3 py-1.5 text-slate-300">{r.label}</td>
                      <td className="px-3 py-1.5 text-slate-400 text-right font-mono">{r.min} {r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: Flying Club
// ═════════════════════════════════════════════════════════════════════════════

function FlyingClubTab() {
  const activeMembers   = mockClubMembers.filter((m) => m.duesCurrent)
  const flaggedMembers  = mockClubMembers.filter((m) => clubEligibilityIssues(m).length > 0)
  const monthlyRevenue  = activeMembers.length * CLUB_CONFIG.monthlyDues
  const discountedRate  = Math.round(185 * (1 - CLUB_CONFIG.hourlyDiscountPct / 100))

  return (
    <div className="space-y-6">
      {/* Config / KPIs */}
      <div>
        <SectionTitle>{CLUB_CONFIG.name}</SectionTitle>
        <div className="flex flex-wrap gap-3 mb-4">
          <KpiTile label="Total Members"  value={mockClubMembers.length} />
          <KpiTile label="Dues Current"   value={activeMembers.length} subColor="text-emerald-400" sub={`$${CLUB_CONFIG.monthlyDues}/mo`} />
          <KpiTile label="Eligibility Issues" value={flaggedMembers.length} alert={flaggedMembers.length > 0} sub={flaggedMembers.length > 0 ? 'cannot fly' : 'all clear'} />
          <KpiTile label="Monthly Dues Revenue" value={`$${monthlyRevenue.toLocaleString()}`} subColor="text-emerald-400" sub="est." />
          <KpiTile label="Member Aircraft Rate" value={`$${discountedRate}/hr`} sub={`${CLUB_CONFIG.hourlyDiscountPct}% off $185`} subColor="text-sky-400" />
        </div>

        <div className="flex flex-wrap gap-2 text-xs mb-4">
          <span className="bg-surface-card border border-surface-border px-2 py-1 rounded text-slate-300">
            Init fee: <strong>${CLUB_CONFIG.initFee}</strong>
          </span>
          <span className="bg-surface-card border border-surface-border px-2 py-1 rounded text-slate-300">
            Monthly dues: <strong>${CLUB_CONFIG.monthlyDues}</strong>
          </span>
          <span className="bg-surface-card border border-surface-border px-2 py-1 rounded text-slate-300">
            Eligible aircraft: {CLUB_CONFIG.eligibleAircraft.map(id => getAircraft(id)?.tailNumber).join(', ')}
          </span>
          {CLUB_CONFIG.requiresMedical  && <span className="bg-surface-card border border-surface-border px-2 py-1 rounded text-slate-400">Requires: Medical</span>}
          {CLUB_CONFIG.requiresBfr      && <span className="bg-surface-card border border-surface-border px-2 py-1 rounded text-slate-400">Requires: BFR current</span>}
          {CLUB_CONFIG.requiresRenters  && <span className="bg-surface-card border border-surface-border px-2 py-1 rounded text-slate-400">Requires: Renter's insurance</span>}
        </div>
      </div>

      {/* Member roster */}
      <div>
        <SectionTitle>Member Roster</SectionTitle>
        <div className="bg-surface-card border border-surface-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-slate-500">
                <th className="text-left px-3 py-2">Member</th>
                <th className="text-left px-3 py-2">Since</th>
                <th className="text-center px-3 py-2">Dues</th>
                <th className="text-center px-3 py-2">BFR</th>
                <th className="text-center px-3 py-2">Medical</th>
                <th className="text-center px-3 py-2">Insurance</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockClubMembers.map((m) => {
                const issues = clubEligibilityIssues(m)
                const ok = issues.length === 0
                return (
                  <tr key={m.id} className="border-b border-surface-border/40 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-200">{m.name}</td>
                    <td className="px-3 py-2 text-slate-400">{m.memberSince}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={m.duesCurrent ? 'text-emerald-400' : 'text-risk-high'}>
                        {m.duesCurrent ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={m.bfrCurrent ? 'text-emerald-400' : 'text-risk-high'}>
                        {m.bfrCurrent ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={m.medicalCurrent ? 'text-emerald-400' : 'text-risk-high'}>
                        {m.medicalCurrent ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={m.rentersUploaded ? 'text-emerald-400' : 'text-risk-high'}>
                        {m.rentersUploaded ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {ok
                        ? <Badge className="bg-emerald-400/10 border-emerald-400/30 text-emerald-400">Eligible</Badge>
                        : <Badge className="bg-risk-high/10 border-risk-high/30 text-risk-high">
                            {issues[0]}{issues.length > 1 ? ` +${issues.length - 1}` : ''}
                          </Badge>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB: DPE — Checkride Scheduling
// ═════════════════════════════════════════════════════════════════════════════

function DpeTab() {
  const [selected, setSelected] = useState(mockStudents[0].id)
  const [tasks, setTasks]       = useState(() => {
    // Build a map of studentId -> mutable tasks
    const map = {}
    mockStudents.forEach((s) => {
      map[s.id] = s.dpe.tasks.map((t) => ({ ...t }))
    })
    return map
  })

  const student  = mockStudents.find((s) => s.id === selected)
  const dpe      = getDpe(student?.dpe?.dpeId)
  const myTasks  = tasks[selected] ?? []
  const doneCount = myTasks.filter((t) => t.done).length
  const ready     = myTasks.length > 0 && doneCount === myTasks.length

  function toggleTask(tid) {
    setTasks((prev) => ({
      ...prev,
      [selected]: prev[selected].map((t) => t.id === tid ? { ...t, done: !t.done } : t),
    }))
  }

  return (
    <div className="flex gap-4">
      {/* Student picker */}
      <div className="w-48 shrink-0 space-y-1">
        <SectionTitle>Students</SectionTitle>
        {mockStudents.map((s) => {
          const t = tasks[s.id] ?? []
          const done = t.filter((x) => x.done).length
          const allDone = t.length > 0 && done === t.length
          return (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={[
                'w-full text-left px-3 py-2 rounded text-sm transition-colors border',
                selected === s.id ? 'bg-sky-400/10 border-sky-400/40 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/5',
              ].join(' ')}
            >
              <span className="block font-medium truncate">{s.name}</span>
              <span className="block text-xs text-slate-500">{done}/{t.length} tasks</span>
              {allDone && <span className="text-xs text-emerald-400">✓ Ready</span>}
            </button>
          )
        })}
      </div>

      {/* Detail */}
      {student && (
        <div className="flex-1 min-w-0 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-slate-100 font-semibold text-lg">{student.name}</h2>
              <p className="text-slate-400 text-sm">{PROGRAMS[student.program]?.name}</p>
            </div>
            <Badge className={DPE_STATUS_BG[student.dpe.status]}>
              <span className={DPE_STATUS_COLOR[student.dpe.status]}>{DPE_STATUS_LABEL[student.dpe.status]}</span>
            </Badge>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Checkride readiness</span>
              <span className="text-slate-400 font-mono">{doneCount}/{myTasks.length} tasks complete</span>
            </div>
            <ProgressBar pct={myTasks.length > 0 ? (doneCount / myTasks.length) * 100 : 0}
              color={ready ? 'bg-emerald-400' : 'bg-sky-400'} />
          </div>

          {/* Task checklist */}
          {myTasks.length > 0 && (
            <div>
              <SectionTitle>Scheduling Checklist</SectionTitle>
              <div className="space-y-1.5">
                {myTasks.map((t) => (
                  <label key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ${
                    t.done
                      ? 'bg-emerald-400/5 border-emerald-400/20'
                      : 'bg-surface-card border-surface-border hover:border-sky-400/30'
                  }`}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => toggleTask(t.id)}
                      className="w-4 h-4 accent-sky-400 cursor-pointer"
                    />
                    <span className={`text-sm ${t.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {t.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* DPE contacts */}
          <div>
            <SectionTitle>Available DPEs</SectionTitle>
            <div className="space-y-2">
              {mockDpeContacts
                .filter((d) => d.authorizes.includes(student.program))
                .map((d) => {
                  const isCurrent = student.dpe.dpeId === d.id
                  return (
                    <div key={d.id} className={`bg-surface-card border rounded-lg p-3 ${
                      isCurrent ? 'border-sky-400/40' : 'border-surface-border'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-slate-100 font-medium">{d.name}
                            {isCurrent && <span className="ml-2 text-xs text-sky-400">← Assigned</span>}
                          </p>
                          <p className="text-slate-400 text-xs">{d.location}</p>
                        </div>
                        <span className="text-emerald-400 font-mono text-sm">${d.typicalFee}</span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        <span>📞 {d.phone}</span>
                        <span>✉ {d.email}</span>
                        <span>Next available: <span className="text-slate-300">{d.availableNextDate}</span></span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {d.authorizes.map((a) => (
                          <Badge key={a} className="bg-slate-700/40 border-slate-600 text-slate-400">
                            {PROGRAMS[a]?.name.split(' ').slice(0, 2).join(' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>

          {/* Scheduled checkride notice */}
          {student.dpe.scheduledDate && (
            <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg p-3">
              <p className="text-emerald-400 font-medium text-sm">Checkride Scheduled</p>
              <p className="text-slate-300 text-sm">{student.dpe.scheduledDate} with {dpe?.name ?? 'DPE'} at {dpe?.location ?? '—'}</p>
            </div>
          )}

          {/* One-click prompt */}
          {ready && !student.dpe.scheduledDate && (
            <div className="bg-sky-400/5 border border-sky-400/20 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sky-400 font-medium text-sm">All requirements met — ready to schedule</p>
                <p className="text-slate-400 text-xs">Contact DPE to confirm date and submit IACRA</p>
              </div>
              <button className="bg-sky-400/20 hover:bg-sky-400/30 border border-sky-400/40 text-sky-300 text-sm px-4 py-2 rounded transition-colors">
                Contact DPE →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Root export
// ═════════════════════════════════════════════════════════════════════════════

export function Training() {
  const [activeTab, setActiveTab] = useState('Overview')

  return (
    <div className="space-y-0">
      <div className="mb-2">
        <h1 className="text-slate-100 font-bold text-xl">Pilot Training</h1>
        <p className="text-slate-400 text-sm">Students · CFIs · Schedule · Programs · Flying Club · DPE Checkrides</p>
      </div>
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Overview'     && <OverviewTab />}
      {activeTab === 'Students'     && <StudentsTab />}
      {activeTab === 'CFIs'         && <CfisTab />}
      {activeTab === 'Schedule'     && <ScheduleTab />}
      {activeTab === 'Programs'     && <ProgramsTab />}
      {activeTab === 'Flying Club'  && <FlyingClubTab />}
      {activeTab === 'DPE'          && <DpeTab />}
    </div>
  )
}
