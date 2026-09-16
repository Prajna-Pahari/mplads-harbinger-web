import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { fmtDate } from '../lib/utils'
import { RiskBadge, ReviewStatusBadge, LoadingState, ErrorState, FilterPill, Modal } from '../components/UI'
import type { Review } from '../types'

const REVIEW_STATUSES = [
  'UNREVIEWED', 'UNDER REVIEW', 'INVESTIGATING', 'VERIFIED CONCERN', 'FALSE POSITIVE', 'RESOLVED', 'ESCALATED'
]

export default function ReviewsPage() {
  const navigate = useNavigate()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [comment, setComment] = useState('')
  const [reviewer, setReviewer] = useState('Reviewer')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    api.reviews.list({ status: statusFilter || undefined })
      .then(r => { setReviews(r as Review[]); setError(null) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  const handleUpdate = async () => {
    if (!selectedReview) return
    setSubmitting(true)
    try {
      await api.reviews.update(selectedReview.id, {
        status: newStatus || selectedReview.status,
        comment: comment || undefined,
        author: reviewer,
      })
      setSelectedReview(null)
      setComment('')
      load()
    } catch (e) { /* handle */ }
    finally { setSubmitting(false) }
  }

  if (loading && reviews.length === 0) return <div className="container py-12 sm:py-20"><LoadingState label="Loading reviews…" /></div>
  if (error) return <div className="container py-12 sm:py-20"><ErrorState message={error} /></div>

  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">GOVERNANCE & DECISION WORKFLOW</p>
        <h1 className="font-heading-3 text-ink">Reviews Management</h1>
        <p className="text-muted text-[13px] sm:text-[14px] mt-1">
          Track official review decisions, add inspection findings, and manage verification status.
        </p>
      </div>

      {/* Responsive Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-6">
        <FilterPill label="All" active={!statusFilter} onClick={() => setStatusFilter('')} />
        {REVIEW_STATUSES.map(s => (
          <FilterPill key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)} />
        ))}
      </div>

      {/* Table */}
      <div className="table-scroll-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>State</th>
              <th>Risk Score</th>
              <th>Risk Level</th>
              <th>Review Status</th>
              <th>Assigned To</th>
              <th>Last Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-muted text-sm">No reviews match the selected filter.</td></tr>
            ) : (
              reviews.map(r => (
                <tr key={r.id}>
                  <td>
                    <button
                      onClick={() => navigate(`/project/${r.project_id}`)}
                      className="font-medium text-[13px] text-ink hover:underline text-left block max-w-[200px] truncate"
                    >
                      {(r as any).project_name || `Project #${r.project_id}`}
                    </button>
                    <p className="font-mono text-[11px] text-muted">{(r as any).project_id_str || ''}</p>
                  </td>
                  <td className="text-muted text-[12px]">{(r as any).state || '—'}</td>
                  <td className="font-bold text-[14px]">{(r as any).final_score?.toFixed(1) || '—'}</td>
                  <td><RiskBadge level={(r as any).risk_level} /></td>
                  <td><ReviewStatusBadge status={r.status} /></td>
                  <td className="text-muted text-[12px]">{r.assigned_to || '—'}</td>
                  <td className="text-muted text-[12px]">{fmtDate(r.updated_at)}</td>
                  <td>
                    <button
                      onClick={() => { setSelectedReview(r); setNewStatus(r.status) }}
                      className="btn-soft btn-sm !px-3"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Update Modal */}
      <Modal open={!!selectedReview} onClose={() => setSelectedReview(null)} title="Update Review Decision">
        {selectedReview && (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-canvas-soft rounded-2xl">
              <p className="font-label text-muted mb-0.5 uppercase text-[10px]">TARGET PROJECT</p>
              <p className="font-semibold text-ink text-[14px]">{(selectedReview as any).project_name || `#${selectedReview.project_id}`}</p>
            </div>
            <div>
              <label className="font-label text-muted block mb-1.5 uppercase text-[11px]">DECISION STATUS</label>
              <select className="select text-sm" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {REVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="font-label text-muted block mb-1.5 uppercase text-[11px]">REVIEWER</label>
              <input className="input text-sm" value={reviewer} onChange={e => setReviewer(e.target.value)} />
            </div>
            <div>
              <label className="font-label text-muted block mb-1.5 uppercase text-[11px]">COMMENTS & FINDINGS</label>
              <textarea
                className="input min-h-[90px] resize-none text-sm"
                style={{ borderRadius: 16 }}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add verification notes, inspection findings, or decision justification…"
              />
            </div>
            <p className="font-caption text-muted italic text-[11px] leading-relaxed">
              Decisions are logged to the permanent audit trail with timestamp and reviewer identity.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button onClick={handleUpdate} disabled={submitting} className="btn-primary flex-1 w-full">
                {submitting ? 'Updating…' : 'Save Review Decision'}
              </button>
              <button onClick={() => setSelectedReview(null)} className="btn-soft w-full sm:w-auto">Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
