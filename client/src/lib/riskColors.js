export const RISK_LEVELS = {
  low: {
    key: 'low',
    min: 0,
    max: 39,
    label: 'LOW',
    textClass: 'text-green-400',
    bgClass: 'bg-green-400/20',
    borderClass: 'border-green-400',
    hex: '#22c55e',
    icon: '✓',
  },
  medium: {
    key: 'medium',
    min: 40,
    max: 69,
    label: 'MED',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-400/20',
    borderClass: 'border-amber-400',
    hex: '#f59e0b',
    icon: '!',
  },
  high: {
    key: 'high',
    min: 70,
    max: 84,
    label: 'HIGH',
    textClass: 'text-red-400',
    bgClass: 'bg-red-400/20',
    borderClass: 'border-red-400',
    hex: '#ef4444',
    icon: '⚠',
  },
  critical: {
    key: 'critical',
    min: 85,
    max: 100,
    label: 'CRITICAL',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-400/20',
    borderClass: 'border-purple-400',
    hex: '#a855f7',
    icon: '⛔',
  },
}

/**
 * Return the risk level config for a score 0–100.
 * Scores below 0 treated as LOW; above 100 treated as CRITICAL.
 */
export function getRiskLevel(score) {
  if (score >= 85) return RISK_LEVELS.critical
  if (score >= 70) return RISK_LEVELS.high
  if (score >= 40) return RISK_LEVELS.medium
  return RISK_LEVELS.low
}

export const PAVE_DIMENSIONS = [
  { key: 'P', label: 'Pilot',       fullLabel: 'P — Pilot',              weight: 0.25 },
  { key: 'A', label: 'Aircraft',    fullLabel: 'A — Aircraft',           weight: 0.20 },
  { key: 'V', label: 'enVironment', fullLabel: 'V — enVironment',        weight: 0.40 },
  { key: 'E', label: 'External',    fullLabel: 'E — External Pressures', weight: 0.15 },
]

/**
 * Compute composite PAVE risk score from individual dimension scores.
 * Weights: P=25%, A=20%, V=40%, E=15%
 */
export function computeCompositeRisk({ P, A, V, E }) {
  return Math.round(P * 0.25 + A * 0.20 + V * 0.40 + E * 0.15)
}
