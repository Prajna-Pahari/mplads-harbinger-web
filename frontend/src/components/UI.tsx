// Shared UI components
import React from 'react'
import { cn, riskColor, scoreColor, reviewStatusColor } from '../lib/utils'

// ─── RiskBadge ───────────────────────────────────────────────────────────────
export function RiskBadge({ level }: { level?: string }) {
  return (
    <span className={cn('badge', riskColor(level))}>
      {level || '—'}
    </span>
  )
}

// ─── RiskScore ───────────────────────────────────────────────────────────────
export function RiskScore({ score, size = 'md' }: { score?: number; size?: 'sm' | 'md' | 'lg' }) {
  const s = score ?? 0
  const color = scoreColor(s)
  const sizes = { sm: 36, md: 50, lg: 64 }
  const fontSizes = { sm: 12, md: 16, lg: 22 }
  const dim = sizes[size]
  const fs = fontSizes[size]

  return (
    <div
      style={{
        width: dim, height: dim, borderRadius: '50%',
        border: `2.5px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: fs, fontWeight: 700, flexShrink: 0,
      }}
    >
      {s.toFixed(0)}
    </div>
  )
}

// ─── ReviewStatusBadge ────────────────────────────────────────────────────────
export function ReviewStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('badge', reviewStatusColor(status || ''))}>
      {status || 'UNREVIEWED'}
    </span>
  )
}

// ─── LoadingState ─────────────────────────────────────────────────────────────
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 gap-4 text-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2.5 h-2.5 bg-ink rounded-full"
            style={{ animation: `bounce 0.9s ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <p className="text-muted text-xs sm:text-sm font-medium">{label}</p>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4 gap-3 text-center">
      {icon && <div className="text-hairline text-4xl sm:text-5xl mb-1">{icon}</div>}
      <p className="font-bold text-ink text-[15px] sm:text-[16px]">{title}</p>
      {description && <p className="text-muted text-xs sm:text-sm max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ─── ErrorState ───────────────────────────────────────────────────────────────
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 gap-3 text-center">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-risk-high-bg flex items-center justify-center">
        <span className="text-risk-high text-lg sm:text-xl font-bold">!</span>
      </div>
      <p className="font-semibold text-ink text-xs sm:text-sm max-w-md">{message}</p>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastFn: ((msg: string, type?: 'success' | 'error') => void) | null = null

export function setToastFn(fn: (msg: string, type?: 'success' | 'error') => void) {
  _toastFn = fn
}

export function toast(msg: string, type: 'success' | 'error' = 'success') {
  _toastFn?.(msg, type)
}

export function ToastContainer() {
  const [toasts, setToasts] = React.useState<{ id: number; msg: string; type: string }[]>([])

  React.useEffect(() => {
    setToastFn((msg, type = 'success') => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, msg, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
    })
  }, [])

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-[999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'card py-3 px-4 text-xs sm:text-sm font-medium shadow-lg animate-slide-up flex items-center gap-2 pointer-events-auto',
            t.type === 'error' ? 'border-risk-high text-risk-high bg-white' : 'text-ink bg-white'
          )}
          style={{ borderRadius: 16, maxWidth: 360 }}
        >
          <span className={t.type === 'error' ? 'text-risk-high font-bold' : 'text-risk-low font-bold'}>
            {t.type === 'error' ? '✕' : '✓'}
          </span>
          <span className="flex-1 leading-snug">{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up z-10 shadow-2xl !p-5 sm:!p-6">
        {title && (
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-hairline-soft">
            <h3 className="font-bold text-[16px] sm:text-[18px]">{title}</h3>
            <button
              onClick={onClose}
              className="btn-soft btn-sm !p-0 w-8 h-8 rounded-full flex items-center justify-center"
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = '#141414', height = 4 }: {
  value: number; max?: number; color?: string; height?: number
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full bg-canvas-soft rounded-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: string; accent?: string
}) {
  return (
    <div className="py-3 sm:py-5 px-0">
      <p className="font-label text-muted mb-1 text-[11px] sm:text-[12px] uppercase">{label}</p>
      <p className={cn('font-bold text-[22px] sm:text-[28px] leading-tight', accent ? `text-${accent}` : 'text-ink')}>
        {value}
      </p>
      {sub && <p className="font-caption text-muted mt-1 text-[11px] sm:text-[12px]">{sub}</p>}
    </div>
  )
}

// ─── SectionHeader ───────────────────────────────────────────────────────────
export function SectionHeader({ label, title, description }: {
  label?: string; title: string; description?: string
}) {
  return (
    <div className="mb-6 sm:mb-10">
      {label && (
        <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">{label}</p>
      )}
      <h2 className="font-heading-3 text-ink mb-2">{title}</h2>
      {description && (
        <p className="font-body-lg text-muted max-w-2xl text-sm sm:text-base">{description}</p>
      )}
    </div>
  )
}

// ─── FilterPill ───────────────────────────────────────────────────────────────
export function FilterPill({ label, active, onClick }: {
  label: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all whitespace-nowrap min-h-[32px]',
        active
          ? 'bg-ink text-white border-ink'
          : 'bg-white text-muted border-hairline hover:border-ink hover:text-ink'
      )}
    >
      {label}
    </button>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <div className={cn('border-t border-hairline-soft', className)} />
}
