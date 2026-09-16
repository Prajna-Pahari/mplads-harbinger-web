// Utility helpers

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return '—'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
  return `₹${val.toLocaleString('en-IN')}`
}

export function fmtPct(val: number | null | undefined, decimals = 1): string {
  if (val == null) return '—'
  return `${val.toFixed(decimals)}%`
}

export function fmtDate(val: string | null | undefined): string {
  if (!val) return '—'
  try {
    return new Date(val).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return val
  }
}

export function riskColor(level: string | undefined): string {
  switch (level?.toUpperCase()) {
    case 'HIGH': return 'badge-high'
    case 'MEDIUM': return 'badge-medium'
    case 'LOW': return 'badge-low'
    default: return 'badge-soft'
  }
}

export function riskTextColor(level: string | undefined): string {
  switch (level?.toUpperCase()) {
    case 'HIGH': return 'text-risk-high'
    case 'MEDIUM': return 'text-risk-medium'
    case 'LOW': return 'text-risk-low'
    default: return 'text-muted'
  }
}

export function scoreColor(score: number): string {
  if (score >= 70) return '#b30000'
  if (score >= 40) return '#c2410c'
  return '#15803d'
}

export function reviewStatusColor(status: string): string {
  switch (status) {
    case 'UNREVIEWED': return 'bg-field text-muted'
    case 'UNDER REVIEW': return 'bg-blue-50 text-blue-700'
    case 'INVESTIGATING': return 'bg-amber-50 text-amber-700'
    case 'VERIFIED CONCERN': return 'bg-risk-high-bg text-risk-high'
    case 'FALSE POSITIVE': return 'bg-canvas-soft text-muted'
    case 'RESOLVED': return 'bg-risk-low-bg text-risk-low'
    case 'ESCALATED': return 'bg-purple-50 text-purple-700'
    default: return 'bg-canvas-soft text-muted'
  }
}

export function truncate(str: string | null | undefined, n = 40): string {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}
