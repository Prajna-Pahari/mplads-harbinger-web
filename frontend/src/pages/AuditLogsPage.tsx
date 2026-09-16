import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { fmtDate } from '../lib/utils'
import { LoadingState, ErrorState } from '../components/UI'
import type { AuditLog } from '../types'

const ACTION_COLORS: Record<string, string> = {
  'Dataset Ingested': 'bg-blue-50 text-blue-700 border border-blue-200/50',
  'CSV Uploaded': 'bg-purple-50 text-purple-700 border border-purple-200/50',
  'Validation Completed': 'bg-canvas-soft text-muted border border-hairline',
  'Review Status Changed': 'bg-amber-50 text-amber-700 border border-amber-200/50',
  'Settings Updated': 'bg-canvas-soft text-muted border border-hairline',
  'Dataset Deleted': 'bg-risk-high-bg text-risk-high border border-red-200/50',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.auditLogs({ limit: 100 })
      .then(r => { setLogs(r as AuditLog[]); setError(null) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="container py-12 sm:py-20"><LoadingState label="Loading system audit log…" /></div>
  if (error) return <div className="container py-12 sm:py-20"><ErrorState message={error} /></div>

  return (
    <div className="container py-6 sm:py-10 max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">TRANSPARENCY & COMPLIANCE</p>
        <h1 className="font-heading-3 text-ink">System Audit Log</h1>
        <p className="text-muted text-[13px] sm:text-[14px] mt-1">
          Chronological, immutable trail of all automated analysis, file uploads, parameter updates, and official reviews.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-muted text-sm">No audit log entries recorded yet.</p>
        </div>
      ) : (
        <div className="card !p-4 sm:!p-6">
          <div className="flex flex-col gap-0">
            {logs.map((log, i) => (
              <div key={log.id} className={`flex gap-3 sm:gap-4 py-3.5 sm:py-4 ${i < logs.length - 1 ? 'border-b border-hairline-soft' : ''}`}>
                {/* Timeline connector */}
                <div className="flex flex-col items-center gap-0 pt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-ink flex-shrink-0" />
                  {i < logs.length - 1 && <div className="w-0.5 bg-hairline-soft flex-1 mt-1" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`badge text-[10px] ${ACTION_COLORS[log.action] || 'badge-soft'}`}>
                      {log.action}
                    </span>
                    <span className="font-caption text-muted text-[11px]">by <span className="font-semibold text-ink">{log.actor}</span></span>
                  </div>
                  {log.details && (
                    <p className="font-body-sm text-muted text-xs sm:text-sm break-words mt-0.5">{log.details}</p>
                  )}
                  <p className="font-caption text-faint text-[11px] mt-1">{fmtDate(log.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
