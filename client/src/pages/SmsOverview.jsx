import { useState } from 'react'
import { SafetyComms } from './SafetyComms'
import { ComplianceCenter } from './ComplianceCenter'
import { mockSmsPillars, mockPaveStatus } from '../mocks/smsOverview'
import { mockSpiTargets, mockKpiTimeSeries, mockHeatMapData, mockHazards } from '../mocks/riskRegister'
import { mockTrainingKpi } from '../mocks/personnel'
import { mockFleetSummary } from '../mocks/aircraft'
import { mockCommsSummary } from '../mocks/safetyComms'
import { StatusIndicator } from '../components/shared/StatusIndicator'
import { PaveBadge } from '../components/shared/PaveBadge'
import { RiskBadge } from '../components/shared/RiskBadge'
import { RiskHeatMap } from '../components/shared/RiskHeatMap'
import { KpiTrendChart } from '../components/shared/KpiTrendChart'
import { ScorecardStrip } from '../components/shared/ScorecardStrip'
import { LeadLagPanel } from '../components/shared/LeadLagPanel'

// ─── Pillar 1: Safety Policy ──────────────────────────────────────────────────

function PolicyPillar() {
  return (
    <section
      className="bg-surface-card border border-surface-border rounded-lg p-5"
      aria-labelledby="pillar-policy"
      data-testid="pillar-policy"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider">Pillar 1</p>
          <h2 id="pillar-policy" className="text-slate-100 font-bold text-base">Safety Policy</h2>
        </div>
        <StatusIndicator level="medium" label="Status" size="sm" />
      </div>

      <dl className="space-y-2 text-xs mb-4">
        <div className="flex justify-between">
          <dt className="text-slate-400">Accountable Executive</dt>
          <dd className="text-slate-200">Director of Operations — K. Walsh</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Safety Manager</dt>
          <dd className="text-slate-200">Jordan Lee</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Safety Policy signed</dt>
          <dd className="text-slate-200">2025-01-10 ✓</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Next management review</dt>
          <dd className="text-amber-400 font-mono">2026-07-15 (118d)</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Safety objectives</dt>
          <dd className="text-slate-200">4 / 6 met</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Non-punitive reporting</dt>
          <dd className="text-green-400">Published ✓</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Emergency Response Plan</dt>
          <dd className="text-green-400">Current ✓</dd>
        </div>
      </dl>

      <div className="border-t border-surface-border pt-3 flex flex-wrap gap-1">
        <span className="text-slate-500 text-xs mr-1">PAVE exposure:</span>
        {['P', 'A', 'V', 'E'].map((k) => (
          <PaveBadge key={k} dimension={k} score={mockSmsPillars[0].paveBreakdown[k]} />
        ))}
      </div>
    </section>
  )
}

// ─── Pillar 2: Safety Risk Management ────────────────────────────────────────

function SrmPillar() {
  const openHazards  = mockHazards.filter((h) => h.status === 'open')
  const redHazards   = openHazards.filter((h) => h.riskZone === 'red')
  const yellowHazards= openHazards.filter((h) => h.riskZone === 'yellow')

  return (
    <section
      className="bg-surface-card border border-surface-border rounded-lg p-5"
      aria-labelledby="pillar-srm"
      data-testid="pillar-srm"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider">Pillar 2</p>
          <h2 id="pillar-srm" className="text-slate-100 font-bold text-base">Safety Risk Management</h2>
        </div>
        <StatusIndicator level="high" label="Status" size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <p className="font-mono font-bold text-2xl text-red-400">{redHazards.length}</p>
          <p className="text-xs text-slate-400">Unacceptable</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-bold text-2xl text-amber-400">{yellowHazards.length}</p>
          <p className="text-xs text-slate-400">Mitigable</p>
        </div>
        <div className="text-center">
          <p className="font-mono font-bold text-2xl text-green-400">
            {mockHazards.filter((h) => h.status === 'mitigated').length}
          </p>
          <p className="text-xs text-slate-400">Mitigated</p>
        </div>
      </div>

      {/* Top open hazards */}
      <div className="space-y-1.5 mb-4">
        {openHazards.slice(0, 3).map((h) => (
          <div key={h.id} className="flex items-start gap-2 text-xs">
            <span className={[
              'flex-shrink-0 rounded px-1 py-0.5 font-bold text-xs font-mono',
              h.riskZone === 'red'    ? 'bg-red-400/20 text-red-400'    :
              h.riskZone === 'yellow' ? 'bg-amber-400/20 text-amber-400' :
              'bg-green-400/20 text-green-400',
            ].join(' ')}>
              {h.probability}×{h.severity}
            </span>
            <PaveBadge dimension={h.paveCategory} score={h.probability * h.severity * 10} />
            <span className="text-slate-300 leading-tight">{h.title}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-border pt-3 flex flex-wrap gap-1">
        <span className="text-slate-500 text-xs mr-1">PAVE exposure:</span>
        {['P', 'A', 'V', 'E'].map((k) => (
          <PaveBadge key={k} dimension={k} score={mockSmsPillars[1].paveBreakdown[k]} />
        ))}
      </div>
    </section>
  )
}

// ─── Pillar 3: Safety Assurance ───────────────────────────────────────────────

function SafetyAssurancePillar() {
  return (
    <section
      className="bg-surface-card border border-surface-border rounded-lg p-5"
      aria-labelledby="pillar-sa"
      data-testid="pillar-sa"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider">Pillar 3</p>
          <h2 id="pillar-sa" className="text-slate-100 font-bold text-base">Safety Assurance</h2>
        </div>
        <StatusIndicator level="low" label="Status" size="sm" />
      </div>

      <dl className="space-y-2 text-xs mb-4">
        <div className="flex justify-between">
          <dt className="text-slate-400">Next internal audit</dt>
          <dd className="text-slate-200">2026-04-08 (18d)</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Open audit findings</dt>
          <dd className="text-amber-400 font-mono">2</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Compliance rate (12m)</dt>
          <dd className="text-green-400">94%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Open corrective actions</dt>
          <dd className="text-amber-400 font-mono">2</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">SPI monitoring</dt>
          <dd className="text-green-400">7 KPIs tracked ✓</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Investigation process</dt>
          <dd className="text-green-400">Documented ✓</dd>
        </div>
      </dl>

      <div className="border-t border-surface-border pt-3 flex flex-wrap gap-1">
        <span className="text-slate-500 text-xs mr-1">PAVE exposure:</span>
        {['P', 'A', 'V', 'E'].map((k) => (
          <PaveBadge key={k} dimension={k} score={mockSmsPillars[2].paveBreakdown[k]} />
        ))}
      </div>
    </section>
  )
}

// ─── Pillar 4: Safety Promotion ───────────────────────────────────────────────

function SafetyPromotionPillar() {
  return (
    <section
      className="bg-surface-card border border-surface-border rounded-lg p-5"
      aria-labelledby="pillar-promotion"
      data-testid="pillar-promotion"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider">Pillar 4</p>
          <h2 id="pillar-promotion" className="text-slate-100 font-bold text-base">Safety Promotion</h2>
        </div>
        <StatusIndicator level="medium" label="Status" size="sm" />
      </div>

      <dl className="space-y-2 text-xs mb-4">
        <div className="flex justify-between">
          <dt className="text-slate-400">SMS training current</dt>
          <dd className={mockTrainingKpi.smsTrainingCurrent === mockTrainingKpi.totalPersonnel ? 'text-green-400' : 'text-amber-400'}>
            {mockTrainingKpi.smsTrainingCurrent}/{mockTrainingKpi.totalPersonnel} personnel
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Training compliance</dt>
          <dd className="text-amber-400 font-mono">78%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Toolbox talks (30d)</dt>
          <dd className="text-slate-200">{mockCommsSummary.toolboxTalksLast30d} / {mockCommsSummary.toolboxTalksTarget} target</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Safety bulletins (YTD)</dt>
          <dd className="text-green-400">{mockCommsSummary.bulletinsYtd} distributed</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Disclosure reports (30d)</dt>
          <dd className="text-green-400">{mockCommsSummary.debriefsLast30d} — healthy ↗</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">NASA ASRS (YTD)</dt>
          <dd className="text-slate-200">{mockCommsSummary.nasaSubmittedYtd} submitted · {mockCommsSummary.nasaPendingYtd} pending</dd>
        </div>
      </dl>

      <div className="border-t border-surface-border pt-3 flex flex-wrap gap-1">
        <span className="text-slate-500 text-xs mr-1">PAVE exposure:</span>
        {['P', 'A', 'V', 'E'].map((k) => (
          <PaveBadge key={k} dimension={k} score={mockSmsPillars[3].paveBreakdown[k]} />
        ))}
      </div>
    </section>
  )
}

// ─── PAVE Status Strip ────────────────────────────────────────────────────────

export function PaveCard({ dim }) {
  return (
    <div
      className="bg-surface-card border border-surface-border rounded-lg p-3 flex flex-col gap-2"
      data-testid={`pave-card-${dim.key}`}
    >
      <div className="flex items-center justify-between">
        <PaveBadge dimension={dim.key} score={dim.score} showLabel />
        <RiskBadge score={dim.score} size="sm" />
      </div>
      <p className="text-slate-400 text-xs">{dim.summary}</p>

      <details open>
        <summary className="text-xs text-sky-400 cursor-pointer select-none">Real-time</summary>
        <dl className="mt-1 space-y-1">
          {dim.realtime.map((r) => (
            <div key={r.label} className="flex flex-col">
              <dt className="text-slate-500 text-xs">{r.label}</dt>
              <dd className="text-slate-300 text-xs font-mono">{r.value}</dd>
            </div>
          ))}
        </dl>
      </details>

      <details>
        <summary className="text-xs text-slate-500 cursor-pointer select-none">Historic</summary>
        <dl className="mt-1 space-y-1">
          {dim.historic.map((r) => (
            <div key={r.label} className="flex flex-col">
              <dt className="text-slate-500 text-xs">{r.label}</dt>
              <dd className="text-slate-300 text-xs font-mono">{r.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const leadingIndicators = [
  { label: 'Training compliance',      value: 78,  unit: '%',      trend: -4,  trendGood: false },
  { label: 'Disclosure reports (30d)', value: 4,   unit: '',       trend: 1,   trendGood: true  },
  { label: 'Toolbox talks (30d)',      value: 3,   unit: '',       trend: 0,   trendGood: null  },
  { label: 'Audit resolution rate',    value: 94,  unit: '%',      trend: 2,   trendGood: true  },
  { label: 'NASA ASRS filed (YTD)',    value: 2,   unit: '',       trend: 1,   trendGood: true  },
]

const laggingIndicators = [
  { label: 'Accidents (YTD)',          value: 0,   unit: '',       trend: 0,   trendGood: null  },
  { label: 'Serious incidents (YTD)',  value: 0,   unit: '',       trend: 0,   trendGood: null  },
  { label: 'Incidents (YTD)',          value: 2,   unit: '',       trend: 1,   trendGood: false },
  { label: 'Open corrective actions',  value: 2,   unit: '',       trend: -1,  trendGood: true  },
  { label: 'Open audit findings',      value: 2,   unit: '',       trend: -1,  trendGood: true  },
]

const SMS_TABS = ['Overview', 'Safety Comms', 'Compliance Center']

export function SmsOverview() {
  const [activeTab, setActiveTab] = useState('Overview')

  return (
    <div data-testid="page-sms-overview" className="space-y-6">

      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-100 font-bold text-lg">SMS Overview</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            ICAO 4-Pillar Safety Management System · Alpha Flight Ops — KDFW · Part 135
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Accountable Executive: K. Walsh</p>
          <p>Safety Manager: Jordan Lee</p>
          <p className="text-amber-400">FAA Part 5 compliance due: 2027-05-27</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-surface-border flex gap-0" role="tablist" aria-label="SMS sections">
        {SMS_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setActiveTab(t)}
            className={[
              'px-4 py-2 text-sm border-b-2 transition-colors',
              activeTab === t
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-600',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'Safety Comms' && <SafetyComms embedded />}
      {activeTab === 'Compliance Center' && <ComplianceCenter embedded />}
      {activeTab === 'Overview' && <>

      {/* SPI Scorecard strip */}
      <section aria-label="Safety Performance Indicators">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          Safety Performance Indicators (SPIs vs Targets)
        </h2>
        <ScorecardStrip spis={mockSpiTargets} />
      </section>

      {/* Four Pillars */}
      <section aria-label="SMS Four Pillars">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          Four Pillars
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <PolicyPillar />
          <SrmPillar />
          <SafetyAssurancePillar />
          <SafetyPromotionPillar />
        </div>
      </section>

      {/* P.A.V.E. Strip */}
      <section aria-label="P.A.V.E. Status">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          P.A.V.E. Live Status
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mockPaveStatus.map((dim) => (
            <PaveCard key={dim.key} dim={dim} />
          ))}
        </div>
      </section>

      {/* Risk Heat Map + Leading/Lagging side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section aria-label="Risk Matrix">
          <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
            Risk Matrix (ICAO 5×5) — Open Hazards
          </h2>
          <RiskHeatMap heatMapData={mockHeatMapData} hazards={mockHazards} />
        </section>

        <section aria-label="Leading and Lagging Indicators">
          <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
            Leading vs Lagging Indicators
          </h2>
          <LeadLagPanel leading={leadingIndicators} lagging={laggingIndicators} />
        </section>
      </div>

      {/* KPI trend charts — 4 charts in a 2×2 grid */}
      <section aria-label="KPI Trend Charts">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          KPI Trends — This Year vs Last Year
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiTrendChart
            kpiData={mockKpiTimeSeries.incidentRate}
            target={mockSpiTargets.find((s) => s.label === 'Incident Rate')?.target}
          />
          <KpiTrendChart
            kpiData={mockKpiTimeSeries.trainingCompliance}
            target={mockSpiTargets.find((s) => s.label === 'Training Compliance')?.target}
          />
          <KpiTrendChart
            kpiData={mockKpiTimeSeries.disclosureRate}
            target={mockSpiTargets.find((s) => s.label === 'Disclosure Reports')?.target}
          />
          <KpiTrendChart
            kpiData={mockKpiTimeSeries.auditScore}
            target={mockSpiTargets.find((s) => s.label === 'Audit Resolution')?.target}
          />
        </div>
      </section>
      </>}

    </div>
  )
}
