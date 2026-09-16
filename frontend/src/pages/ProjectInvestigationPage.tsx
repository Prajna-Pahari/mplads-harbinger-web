import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Calendar, DollarSign, TrendingUp, Clock, Users, MessageSquare, Shield, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import { fmtCurrency, fmtPct, fmtDate, riskTextColor } from '../lib/utils'
import { RiskBadge, RiskScore, ReviewStatusBadge, LoadingState, ErrorState, ProgressBar, Modal } from '../components/UI'
import type { Project, RiskAlert, Review, AuditLog } from '../types'

const REVIEW_STATUSES = [
  'UNREVIEWED', 'UNDER REVIEW', 'INVESTIGATING', 'VERIFIED CONCERN',
  'FALSE POSITIVE', 'RESOLVED', 'ESCALATED',
]

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'financial', label: 'Financial' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'risk', label: 'Risk Analysis' },
  { id: 'peers', label: 'Peer Group' },
  { id: 'review', label: 'Review & Actions' },
  { id: 'audit', label: 'Audit Trail' },
]

export default function ProjectInvestigationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [peers, setPeers] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Review state
  const [reviewStatus, setReviewStatus] = useState('')
  const [comment, setComment] = useState('')
  const [reviewer, setReviewer] = useState('Reviewer')
  const [submitting, setSubmitting] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.projects.get(Number(id)) as Promise<Project>,
      api.projects.peers(Number(id)) as Promise<{ peers: Project[] }>,
    ]).then(([proj, peerData]) => {
      setProject(proj)
      setReviewStatus(proj.review_status || 'UNREVIEWED')
      setPeers(peerData.peers || [])
      setError(null)
    }).catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  const submitReview = async () => {
    if (!project?.review_id) return
    setSubmitting(true)
    try {
      await api.reviews.update(project.review_id, {
        status: reviewStatus,
        comment: comment || undefined,
        author: reviewer,
      })
      setReviewMsg('✓ Review successfully updated.')
      setComment('')
      // Reload
      const updated = await api.projects.get(Number(id)) as Project
      setProject(updated)
    } catch (e) {
      setReviewMsg('✕ Failed to update review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="container py-12 sm:py-20"><LoadingState label="Loading project investigation details…" /></div>
  if (error || !project) return <div className="container py-12 sm:py-20"><ErrorState message={error || 'Project not found'} /></div>

  // Score bar data
  const scoreData = [
    { label: 'Schedule Deviation', score: project.schedule_score || 0, weight: '35%' },
    { label: 'Financial vs Progress', score: project.financial_score || 0, weight: '40%' },
    { label: 'Peer Outlier', score: project.peer_score || 0, weight: '25%' },
  ]

  // Peer stats
  const peerFin = peers.filter(p => p.financial_utilisation != null).map(p => p.financial_utilisation!)
  const peerProg = peers.filter(p => p.physical_progress != null).map(p => p.physical_progress!)
  const median = (arr: number[]) => {
    if (!arr.length) return null
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }

  return (
    <div className="container-wide py-6 sm:py-8">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="btn-soft btn-sm gap-1.5 mb-4 sm:mb-6">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Responsive Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6 sm:mb-8 card !p-4 sm:!p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
          <RiskScore score={project.final_score} size="lg" />
          <div className="min-w-0">
            <p className="font-mono text-muted text-xs sm:text-[13px] font-semibold tracking-wider mb-1">{project.project_id}</p>
            <h1 className="font-heading-3 text-ink mb-2 leading-snug">{project.project_name || 'Untitled Project'}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge level={project.risk_level} />
              <ReviewStatusBadge status={project.review_status} />
              <span className="badge badge-soft text-[11px]">{project.status || '—'}</span>
              {project.state && (
                <span className="text-muted text-[12px] sm:text-[13px]">
                  {[project.district, project.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Human-in-the-loop notice */}
        <div className="bg-canvas-soft rounded-2xl p-3.5 sm:p-4 lg:max-w-xs border border-hairline-soft w-full lg:w-auto">
          <div className="flex items-center gap-1.5 mb-1 text-ink font-semibold text-[12px]">
            <Shield size={14} />
            <span>HUMAN-IN-THE-LOOP</span>
          </div>
          <p className="text-muted text-[11px] sm:text-[12px] leading-relaxed">
            AI flags statistical & rule anomalies. Officials inspect verified evidence and decide action.
          </p>
        </div>
      </div>

      {/* Swipeable Tabs Bar */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar border-b border-hairline-soft pb-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 sm:px-4 py-2 text-[12px] sm:text-[13px] font-semibold rounded-full transition-all whitespace-nowrap min-h-[36px] flex items-center
              ${activeTab === tab.id
                ? 'bg-ink text-white shadow-sm'
                : 'bg-canvas-soft text-muted hover:text-ink hover:bg-hairline'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ─────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[15px] mb-4 text-ink">Project Details</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
              {[
                ['Project ID', project.project_id],
                ['Category', project.category],
                ['State', project.state],
                ['District', project.district],
                ['Constituency', project.constituency],
                ['Current Status', project.status],
                ['Planned Duration', project.planned_duration ? `${project.planned_duration} months` : '—'],
                ['Elapsed Time', project.elapsed_months ? `${project.elapsed_months} months` : '—'],
              ].map(([k, v]) => (
                <div key={String(k)} className="border-b border-hairline-soft sm:border-0 pb-2 sm:pb-0">
                  <dt className="font-label text-muted text-[11px] uppercase">{k}</dt>
                  <dd className="font-medium text-[13px] sm:text-[14px] text-ink mt-0.5">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[15px] mb-4 text-ink">Composite Risk Breakdown</p>
            <div className="flex flex-col gap-4">
              {scoreData.map(s => (
                <div key={s.label}>
                  <div className="flex justify-between items-center mb-1 text-[13px]">
                    <span className="font-medium text-ink">{s.label} <span className="text-muted text-xs">({s.weight})</span></span>
                    <span className="font-bold" style={{ color: s.score >= 70 ? '#b30000' : s.score >= 40 ? '#c2410c' : '#15803d' }}>
                      {s.score.toFixed(1)} / 100
                    </span>
                  </div>
                  <ProgressBar value={s.score} max={100} color={s.score >= 70 ? '#b30000' : s.score >= 40 ? '#c2410c' : '#15803d'} height={6} />
                </div>
              ))}
              <div className="border-t border-hairline-soft pt-3 flex justify-between items-center">
                <span className="font-bold text-[14px] text-ink">Weighted Composite Score</span>
                <span className="font-bold text-[22px]" style={{ color: project.final_score && project.final_score >= 70 ? '#b30000' : project.final_score && project.final_score >= 40 ? '#c2410c' : '#15803d' }}>
                  {project.final_score?.toFixed(1) ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Financial Tab ──────────────────────────────── */}
      {activeTab === 'financial' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[15px] mb-4 text-ink">Financial Breakdown</p>
            <dl className="flex flex-col gap-3">
              {[
                ['Sanctioned Amount', fmtCurrency(project.sanctioned_amount)],
                ['Released Amount', fmtCurrency(project.released_amount)],
                ['Actual Expenditure', fmtCurrency(project.expenditure)],
                ['Financial Utilisation', fmtPct(project.financial_utilisation)],
                ['Physical Progress', fmtPct(project.physical_progress)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between items-center border-b border-hairline-soft pb-2.5">
                  <dt className="text-muted text-[13px]">{k}</dt>
                  <dd className="font-semibold text-[13px] sm:text-[14px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[15px] mb-4 text-ink">Utilisation vs Physical Progress</p>
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5 text-[13px]">
                  <span className="text-muted">Financial Utilisation</span>
                  <span className="font-bold text-ink">{fmtPct(project.financial_utilisation)}</span>
                </div>
                <ProgressBar value={project.financial_utilisation || 0} max={100} color="#141414" height={8} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5 text-[13px]">
                  <span className="text-muted">Physical Progress</span>
                  <span className="font-bold text-emerald-700">{fmtPct(project.physical_progress)}</span>
                </div>
                <ProgressBar value={project.physical_progress || 0} max={100} color="#15803d" height={8} />
              </div>

              {project.financial_utilisation != null && project.physical_progress != null &&
               project.financial_utilisation - project.physical_progress > 15 && (
                <div className="bg-risk-high-bg rounded-2xl p-3.5 mt-2 border border-red-200/50">
                  <p className="font-caption text-risk-high font-medium leading-relaxed">
                    ⚠ Financial utilisation exceeds physical progress by {(project.financial_utilisation - project.physical_progress).toFixed(1)}%.
                    This signals potential funds release ahead of ground execution.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Timeline Tab ──────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="card !p-4 sm:!p-6 max-w-2xl">
          <p className="font-bold text-[15px] mb-6 text-ink">Project Timeline & Milestones</p>
          <div className="flex flex-col gap-6 relative">
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-hairline-soft" />
            {[
              { label: 'Sanctioned / Start Date', val: fmtDate(project.start_date), done: !!project.start_date },
              { label: 'Expected Completion', val: project.expected_completion ? fmtDate(project.expected_completion) : 'Not recorded in dataset', done: !!project.expected_completion, warn: project.expected_completion && new Date(project.expected_completion) < new Date() && !project.actual_completion },
              { label: 'Actual Completion', val: project.actual_completion ? fmtDate(project.actual_completion) : project.status === 'Completed' ? 'Completed (Date unavailable)' : 'Not yet completed', done: !!project.actual_completion },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                  ${item.done ? 'bg-ink text-white' : 'bg-canvas-soft border border-hairline text-muted'}`}>
                  <Calendar size={15} />
                </div>
                <div>
                  <p className="font-semibold text-[13px] text-ink">{item.label}</p>
                  <p className={`text-[13px] mt-0.5 ${(item as any).warn ? 'text-risk-high font-semibold' : 'text-muted'}`}>{item.val}</p>
                  {(item as any).warn && <p className="font-caption text-risk-high mt-1 font-semibold">⚠ Project is overdue past scheduled timeline</p>}
                </div>
              </div>
            ))}
          </div>

          {project.planned_duration && project.elapsed_months && (
            <div className="mt-8 p-4 bg-canvas-soft rounded-2xl border border-hairline-soft">
              <p className="font-label text-muted mb-2 uppercase">Duration Tracking</p>
              <div className="flex justify-between items-center mb-1.5 text-[13px]">
                <span className="font-medium text-ink">Elapsed: {project.elapsed_months}m of {project.planned_duration}m planned</span>
                <span className="font-bold">{Math.round((project.elapsed_months / project.planned_duration) * 100)}%</span>
              </div>
              <ProgressBar
                value={project.elapsed_months}
                max={Math.max(project.planned_duration, project.elapsed_months)}
                color={project.elapsed_months > project.planned_duration ? '#b30000' : '#141414'}
                height={6}
              />
              {project.elapsed_months > project.planned_duration && (
                <p className="font-caption text-risk-high mt-2 font-semibold">
                  ⚠ Schedule Overrun: {project.elapsed_months - project.planned_duration} months past planned duration
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Risk Tab ──────────────────────────────────── */}
      {activeTab === 'risk' && (
        <div className="flex flex-col gap-6">
          {/* Debug Calculation */}
          <div className="card bg-canvas-soft border-hairline-soft !p-4 sm:!p-5">
            <p className="font-bold text-[14px] mb-2 text-ink">Risk Engine Calculation Trace</p>
            <div className="font-mono text-[11px] sm:text-[12px] text-muted flex flex-col gap-1 overflow-x-auto">
              <p>Schedule Score: {project.schedule_score?.toFixed(1) || '0'} × 35% = {((project.schedule_score || 0) * 0.35).toFixed(2)}</p>
              <p>Financial Score: {project.financial_score?.toFixed(1) || '0'} × 40% = {((project.financial_score || 0) * 0.40).toFixed(2)}</p>
              <p>Peer Score: {project.peer_score?.toFixed(1) || '0'} × 25% = {((project.peer_score || 0) * 0.25).toFixed(2)}</p>
              <p className="border-t border-hairline-soft mt-1 pt-1 font-semibold text-ink">
                Final Score: {project.final_score?.toFixed(2) || '0'} → Level: {project.risk_level || 'UNKNOWN'}
              </p>
            </div>
          </div>

          {/* WHY FLAGGED */}
          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[16px] text-ink mb-1">WHY FLAGGED?</p>
            <p className="font-caption text-muted mb-4 sm:mb-6">Evidence-based explanation for each triggered signal.</p>
            {project.alerts && project.alerts.length > 0 ? (
              <div className="flex flex-col gap-4">
                {project.alerts.map((alert, i) => (
                  <div key={alert.id || i} className="border border-hairline-soft rounded-2xl p-4 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-canvas-soft flex items-center justify-center flex-shrink-0">
                          <span className="font-bold text-[11px] text-ink">{String(i + 1).padStart(2, '0')}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-[13px] text-ink">{alert.rule_name}</p>
                          <p className="font-caption text-muted">{alert.rule_id} · {alert.signal_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className={`badge ${alert.severity === 'HIGH' ? 'badge-high' : 'badge-medium'}`}>{alert.severity}</span>
                        <span className="font-caption text-muted font-bold">+{alert.score_contribution} pts</span>
                      </div>
                    </div>

                    <p className="font-body-sm text-muted mb-3 leading-relaxed">{alert.explanation}</p>

                    {/* Evidence Grid */}
                    <div className="bg-canvas-soft rounded-xl p-3">
                      <p className="font-label text-muted mb-2 uppercase text-[10px]">VERIFIED EVIDENCE</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(alert.evidence || {}).map(([k, v]) => (
                          <div key={k} className="p-1.5">
                            <p className="font-caption text-muted text-[11px] capitalize">{k.replace(/_/g, ' ')}</p>
                            <p className="font-semibold text-[12px] sm:text-[13px] text-ink">{String(v)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted text-sm">
                No risk signals triggered for this project.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Peers Tab ─────────────────────────────────── */}
      {activeTab === 'peers' && (
        <div className="flex flex-col gap-6">
          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[16px] text-ink mb-1">Peer Group Comparison</p>
            <p className="font-caption text-muted mb-5">
              Compared with similar works in category: <span className="font-semibold text-ink">{project.category}</span>
            </p>

            {peers.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {[
                    { label: 'Financial Utilisation', proj: fmtPct(project.financial_utilisation), peer: fmtPct(median(peerFin)), flag: project.financial_utilisation != null && median(peerFin) != null && Math.abs(project.financial_utilisation - median(peerFin)!) > 20 },
                    { label: 'Physical Progress', proj: fmtPct(project.physical_progress), peer: fmtPct(median(peerProg)), flag: false },
                    { label: 'Risk Score', proj: project.final_score?.toFixed(1) || '—', peer: `${(peers.reduce((a, b) => a + (b.final_score || 0), 0) / peers.length).toFixed(1)} avg`, flag: false },
                    { label: 'Elapsed Duration', proj: project.elapsed_months ? `${project.elapsed_months}m` : '—', peer: `${Math.round(peers.reduce((a, b) => a + (b.elapsed_months || 0), 0) / peers.length)}m avg`, flag: false },
                  ].map(item => (
                    <div key={item.label} className={`p-4 rounded-2xl ${item.flag ? 'bg-risk-high-bg border border-red-200/50' : 'bg-canvas-soft'}`}>
                      <p className="font-label text-muted mb-2 text-[10px] uppercase">{item.label}</p>
                      <div className="flex gap-4 items-baseline">
                        <div>
                          <p className="font-caption text-muted text-[10px]">THIS WORK</p>
                          <p className={`font-bold text-[18px] ${item.flag ? 'text-risk-high' : 'text-ink'}`}>{item.proj}</p>
                        </div>
                        <div>
                          <p className="font-caption text-muted text-[10px]">PEER MEDIAN</p>
                          <p className="font-semibold text-[14px] text-muted">{item.peer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="table-scroll-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Project ID</th>
                        <th>State</th>
                        <th>Fin. Util.</th>
                        <th>Progress</th>
                        <th>Risk Score</th>
                        <th>Risk Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peers.map(p => (
                        <tr key={p.id}>
                          <td className="font-mono text-[11px]">{p.project_id}</td>
                          <td>{p.state || '—'}</td>
                          <td>{fmtPct(p.financial_utilisation)}</td>
                          <td>{fmtPct(p.physical_progress)}</td>
                          <td className="font-bold">{p.final_score?.toFixed(1) || '—'}</td>
                          <td><RiskBadge level={p.risk_level} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-muted text-sm py-6 text-center">No comparable peer group projects found in this dataset.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Review Tab ────────────────────────────────── */}
      {activeTab === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[16px] mb-4 text-ink">Update Review Status & Action</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="font-label text-muted block mb-1.5 uppercase text-[11px]">REVIEW STATUS</label>
                <select className="select text-sm" value={reviewStatus} onChange={e => setReviewStatus(e.target.value)}>
                  {REVIEW_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-label text-muted block mb-1.5 uppercase text-[11px]">REVIEWER NAME</label>
                <input className="input text-sm" value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Enter reviewer name" />
              </div>

              <div>
                <label className="font-label text-muted block mb-1.5 uppercase text-[11px]">COMMENTS & FINDINGS</label>
                <textarea
                  className="input min-h-[90px] resize-none text-sm"
                  style={{ borderRadius: 16 }}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Record findings, ground verification details, or action decision rationale…"
                />
              </div>

              <button
                onClick={submitReview}
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? 'Submitting…' : 'Record Review Action'}
              </button>

              {reviewMsg && (
                <p className={`font-semibold text-sm ${reviewMsg.includes('Failed') ? 'text-risk-high' : 'text-risk-low'}`}>
                  {reviewMsg}
                </p>
              )}

              <p className="font-caption text-muted border-t border-hairline-soft pt-3 text-[11px] leading-relaxed">
                Officials verify ground evidence and determine follow-up actions. The system never records definitive fraud automatically.
              </p>
            </div>
          </div>

          <div className="card !p-4 sm:!p-6">
            <p className="font-bold text-[16px] mb-4 text-ink">Review & Investigation Log</p>
            {project.audit_history && project.audit_history.filter(a => a.review_id).length > 0 ? (
              <div className="flex flex-col gap-3">
                {project.audit_history.filter(a => a.review_id).map(log => (
                  <div key={log.id} className="flex gap-3 border-b border-hairline-soft pb-3 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-canvas-soft flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={14} className="text-muted" />
                    </div>
                    <div>
                      <p className="font-semibold text-[13px] text-ink">{log.action}</p>
                      <p className="font-caption text-muted mt-0.5">{log.details}</p>
                      <p className="font-caption text-faint mt-1">{fmtDate(log.created_at)} · {log.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm py-4 text-center">No previous review entries for this project.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Audit Tab ─────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="card !p-4 sm:!p-6 max-w-2xl">
          <p className="font-bold text-[16px] mb-4 text-ink">Full Audit Trail</p>
          {project.audit_history && project.audit_history.length > 0 ? (
            <div className="flex flex-col gap-0">
              {project.audit_history.map((log, i) => (
                <div key={log.id} className="flex gap-3 border-b border-hairline-soft py-3 last:border-0">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-ink flex-shrink-0 mt-1" />
                    {i < project.audit_history!.length - 1 && <div className="w-0.5 bg-hairline-soft flex-1 mt-1" />}
                  </div>
                  <div className="pb-1">
                    <p className="font-semibold text-[13px] text-ink">{log.action}</p>
                    {log.details && <p className="font-caption text-muted mt-0.5">{log.details}</p>}
                    <p className="font-caption text-faint mt-1">{fmtDate(log.created_at)} · {log.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm py-4">No audit logs available for this project.</p>
          )}
        </div>
      )}
    </div>
  )
}
