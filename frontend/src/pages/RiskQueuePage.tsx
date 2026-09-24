import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import { api } from '../lib/api'
import { fmtCurrency, fmtPct, truncate } from '../lib/utils'
import { RiskBadge, RiskScore, ReviewStatusBadge, LoadingState, ErrorState, FilterPill } from '../components/UI'
import type { PaginatedQueue, Dataset } from '../types'

export default function RiskQueuePage() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<PaginatedQueue | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [activeDataset, setActiveDataset] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.datasets.list().then((ds: unknown) => {
      const datasets = ds as Dataset[]
      setDatasets(datasets)
      if (datasets[0]) setActiveDataset(datasets[0].id)
    })
  }, [])

  useEffect(() => {
    if (activeDataset === undefined && datasets.length === 0) return
    setLoading(true)
    api.riskQueue({
      dataset_id: activeDataset,
      risk_level: riskFilter || undefined,
      review_status: reviewFilter || undefined,
      page,
      page_size: 20,
    }).then((res: unknown) => {
      setQueue(res as PaginatedQueue)
      setError(null)
    }).catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeDataset, riskFilter, reviewFilter, page])

  if (loading && !queue) return <div className="container py-12 sm:py-20"><LoadingState label="Loading prioritised risk queue…" /></div>
  if (error) return <div className="container py-12 sm:py-20"><ErrorState message={error} /></div>

  const q = queue?.queue || []

  return (
    <div className="container-wide py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">PRIORITISED TRIAGE</p>
          <h1 className="font-heading-3 text-ink flex items-center gap-2.5 flex-wrap">
            <span>Risk Queue</span>
            <span className="badge badge-high text-[11px] sm:text-[12px]">{queue?.total ?? 0} flagged</span>
          </h1>
          <p className="text-muted text-[13px] sm:text-[14px] mt-1">Sorted strictly by anomaly risk score — highest first. Focus investigations here.</p>
        </div>
        <button onClick={() => setPage(1)} className="btn-soft btn-sm gap-1.5 self-start sm:self-auto">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filters: Responsive Pills */}
      <div className="flex flex-col gap-3 mb-6 p-3 sm:p-4 bg-canvas-soft rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="font-label text-muted mr-1.5 text-[10px] sm:text-[11px] uppercase flex-shrink-0">Risk:</span>
          <FilterPill label="All Risk" active={!riskFilter} onClick={() => { setRiskFilter(''); setPage(1) }} />
          {['HIGH', 'MEDIUM', 'LOW'].map(lvl => (
            <FilterPill key={lvl} label={lvl} active={riskFilter === lvl} onClick={() => { setRiskFilter(riskFilter === lvl ? '' : lvl); setPage(1) }} />
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 border-t border-hairline-soft pt-2">
          <span className="font-label text-muted mr-1.5 text-[10px] sm:text-[11px] uppercase flex-shrink-0">Review:</span>
          <FilterPill label="All Statuses" active={!reviewFilter} onClick={() => { setReviewFilter(''); setPage(1) }} />
          {['UNREVIEWED', 'UNDER REVIEW', 'INVESTIGATING', 'VERIFIED CONCERN'].map(s => (
            <FilterPill key={s} label={s} active={reviewFilter === s} onClick={() => { setReviewFilter(reviewFilter === s ? '' : s); setPage(1) }} />
          ))}
        </div>
      </div>

      {/* Queue table */}
      {loading ? (
        <LoadingState label="Refreshing queue…" />
      ) : q.length === 0 ? (
        <div className="py-16 sm:py-20 text-center text-muted card">
          <TrendingUp size={36} className="mx-auto mb-3 text-hairline" />
          <p className="font-semibold text-ink text-sm sm:text-base">No works match the selected filters.</p>
          <p className="text-muted text-xs mt-1">Try resetting the risk or review status filters above.</p>
        </div>
      ) : (
        <>
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project</th>
                  <th>State</th>
                  <th>Category</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Triggered Risk Signals</th>
                  <th>Exposure</th>
                  <th>Review Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {q.map((project, i) => {
                  const rank = (page - 1) * 20 + i + 1
                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      style={{ cursor: 'pointer' }}
                      className={rank <= 3 ? 'bg-risk-high-bg/35' : ''}
                    >
                      <td>
                        <span className={`font-bold text-[14px] sm:text-[15px] ${rank <= 3 ? 'text-risk-high' : 'text-muted'}`}>
                          #{rank}
                        </span>
                      </td>
                      <td>
                        <div className="min-w-[160px]">
                          <p className="font-medium text-[13px] text-ink">{truncate(project.project_name, 28) || '—'}</p>
                          <p className="font-mono text-[11px] text-muted">{project.project_id}</p>
                        </div>
                      </td>
                      <td className="text-muted text-[12px]">{project.state || '—'}</td>
                      <td className="text-muted text-[12px]">{truncate(project.category, 18) || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <RiskScore score={project.final_score} size="sm" />
                          <span className="font-bold text-[14px]" style={{ color: project.final_score && project.final_score >= 70 ? '#b30000' : project.final_score && project.final_score >= 40 ? '#c2410c' : '#15803d' }}>
                            {project.final_score?.toFixed(1) ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td><RiskBadge level={project.risk_level} /></td>
                      <td>
                        <div className="text-[12px] font-medium text-ink max-w-[200px] truncate">
                          {project.primary_signal && project.primary_signal !== 'None' ? project.primary_signal : '—'}
                        </div>
                      </td>
                      <td className="text-[12px] font-medium text-ink">
                        {fmtCurrency(project.sanctioned_amount)}
                      </td>
                      <td><ReviewStatusBadge status={project.review_status} /></td>
                      <td>
                        <ExternalLink size={13} className="text-muted" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {queue && queue.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <p className="font-caption text-muted text-[11px] sm:text-[12px]">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, queue.total)} of {queue.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-soft btn-sm !px-3"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="font-body-sm text-ink px-2 text-xs font-semibold">{page} / {queue.pages}</span>
                <button
                  className="btn-soft btn-sm !px-3"
                  disabled={page === queue.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
