import { mockComplianceStatus, mockCompliancePackages } from '../mocks/compliance'
import { StatusIndicator } from '../components/shared/StatusIndicator'
import { getRiskLevel } from '../lib/riskColors'

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single compliance status bar with percentage fill and due-date label.
 */
export function ComplianceStatusBar({ item }) {
  const level = getRiskLevel(
    item.level === 'high' ? 75 : item.level === 'medium' ? 55 : 20
  )

  return (
    <div
      className="flex items-center gap-3"
      data-testid={`compliance-bar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="text-slate-300 text-xs w-24 flex-shrink-0">{item.label}</span>

      {/* Progress bar */}
      <div
        className="flex-1 h-2 bg-surface rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={item.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.label} compliance: ${item.pct}%`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${item.pct}%`, backgroundColor: level.hex }}
        />
      </div>

      <span className="font-mono text-xs w-8 text-right" style={{ color: level.hex }}>
        {item.pct}%
      </span>
      <span className="text-xs text-slate-500 w-16 flex-shrink-0">{item.dueLabel}</span>
      <StatusIndicator level={item.level} label="" size="sm" />
    </div>
  )
}

/**
 * Table of filed compliance packages.
 */
export function CompliancePackageList({ packages }) {
  return (
    <div
      className="bg-surface-card border border-surface-border rounded-lg overflow-hidden"
      data-testid="compliance-package-list"
    >
      <table className="w-full" aria-label="Compliance packages">
        <thead>
          <tr className="border-b border-surface-border text-xs text-slate-400 uppercase tracking-wide">
            <th className="py-2 px-4 text-left font-medium">Package ID</th>
            <th className="py-2 px-4 text-left font-medium">Type</th>
            <th className="py-2 px-4 text-left font-medium">Filed</th>
            <th className="py-2 px-4 text-left font-medium">Status</th>
            <th className="py-2 px-4 text-left font-medium sr-only">Action</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr
              key={pkg.id}
              className="border-b border-surface-border text-sm hover:bg-white/5 transition-colors"
              data-testid={`compliance-row-${pkg.id}`}
            >
              <td className="py-2.5 px-4 font-mono text-slate-100">{pkg.id}</td>
              <td className="py-2.5 px-4 text-slate-300">{pkg.type}</td>
              <td className="py-2.5 px-4 text-slate-400 font-mono text-xs">{pkg.filedAt}</td>
              <td className="py-2.5 px-4">
                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                  <span aria-hidden="true">✓</span>
                  <span className="capitalize">{pkg.status}</span>
                </span>
              </td>
              <td className="py-2.5 px-4">
                <button
                  className="text-xs text-sky-400 border border-sky-400/40 px-2 py-0.5 rounded hover:bg-sky-400/10 transition-colors"
                  aria-label={`View compliance package ${pkg.id}`}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Compliance filing wizard — stub for Phase 2.
 */
export function ComplianceWizardButton() {
  return (
    <button
      className="text-sm bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded transition-colors font-semibold"
      aria-label="File a new compliance package"
      data-testid="btn-file-compliance"
    >
      + File Compliance Package
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ComplianceCenter() {
  return (
    <div data-testid="page-compliance-center">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-slate-100 font-bold text-lg">Compliance Center</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            SMS regulatory compliance status and filing history
          </p>
        </div>
        <ComplianceWizardButton />
      </div>

      {/* Status bars */}
      <section
        className="bg-surface-card border border-surface-border rounded-lg p-5 mb-6"
        aria-label="Compliance status overview"
      >
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-4">
          Compliance Status
        </h2>
        <div className="space-y-3">
          {mockComplianceStatus.map((item) => (
            <ComplianceStatusBar key={item.label} item={item} />
          ))}
        </div>
      </section>

      {/* Package history */}
      <section aria-label="Recent compliance packages">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest mb-3">
          Recent Packages
        </h2>
        <CompliancePackageList packages={mockCompliancePackages} />
      </section>

      {/* Wizard placeholder */}
      <div className="mt-6 p-4 border border-dashed border-surface-border rounded-lg text-center text-slate-500 text-xs">
        6-step compliance wizard (PDF generation) — Phase 2
      </div>
    </div>
  )
}
