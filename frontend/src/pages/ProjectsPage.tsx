import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, NavLink } from 'react-router-dom'
import { Download, ExternalLink, RefreshCw, Filter, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { fmtCurrency, fmtPct, truncate } from '../lib/utils'
import { RiskBadge, ReviewStatusBadge, LoadingState, ErrorState, FilterPill } from '../components/UI'
import type { PaginatedProjects, Dataset } from '../types'

const STATES = ['Rajasthan','Uttar Pradesh','Maharashtra','Karnataka','Tamil Nadu','West Bengal','Gujarat','Madhya Pradesh','Haryana','Punjab','Odisha','Andhra Pradesh','Telangana']
const CATEGORIES = ['Roads & Paths','Community Infrastructure','Sanitation & Drainage','Education','Health','Electricity','Water Conservation','Drinking Water','Infrastructure','Parks & Gardens','Sports & Recreation','Security Infrastructure']
const STATUS_OPTIONS = ['Ongoing','Completed','Stalled','Abandoned']

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [projects, setProjects] = useState<PaginatedProjects | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [riskLevel, setRiskLevel] = useState('')
  const [state, setState] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ds = await api.datasets.list() as Dataset[]
      setDatasets(ds)
      const result = await api.projects.list({
        dataset_id: ds[0]?.id,
        risk_level: riskLevel || undefined,
        state: state || undefined,
        category: category || undefined,
        status: status || undefined,
        search: search || undefined,
        page, page_size: 20,
      }) as PaginatedProjects
      setProjects(result)
      setError(null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [riskLevel, state, category, status, search, page])

  useEffect(() => { load() }, [load])

  if (error) return <div className="container py-12 sm:py-20"><ErrorState message={error} /></div>

  return (
    <div className="container-wide py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">ALL WORKS</p>
          <h1 className="font-heading-3 text-ink">Projects Directory</h1>
          <p className="text-muted text-[13px] sm:text-[14px] mt-1">{projects?.total ?? 0} total works in database</p>
        </div>
        <div className="flex items-center gap-2">
          <NavLink to="/csv-analyzer" className="btn-primary btn-sm gap-1.5 flex-1 sm:flex-initial no-underline">
            <Upload size={13} /> Import CSV
          </NavLink>
          <button onClick={() => api.export.projects(datasets[0]?.id)} className="btn-outline btn-sm gap-1.5 flex-1 sm:flex-initial">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Responsive Filters Form */}
      <div className="card-soft !p-4 sm:!p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-muted" />
          <span className="font-label text-ink uppercase tracking-wider text-xs">Filter & Search</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-2 md:col-span-2 lg:col-span-2">
            <label className="font-label text-muted block mb-1">SEARCH</label>
            <input
              className="input text-xs sm:text-sm"
              placeholder="Search by ID, name, district…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label className="font-label text-muted block mb-1">RISK LEVEL</label>
            <select className="select text-xs sm:text-sm" value={riskLevel} onChange={e => { setRiskLevel(e.target.value); setPage(1) }}>
              <option value="">All Levels</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label className="font-label text-muted block mb-1">STATE</label>
            <select className="select text-xs sm:text-sm" value={state} onChange={e => { setState(e.target.value); setPage(1) }}>
              <option value="">All States</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="font-label text-muted block mb-1">CATEGORY</label>
            <select className="select text-xs sm:text-sm" value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="font-label text-muted block mb-1">STATUS</label>
              <select className="select text-xs sm:text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              onClick={() => { setRiskLevel(''); setState(''); setCategory(''); setStatus(''); setSearch(''); setPage(1) }}
              className="btn-soft btn-sm self-end h-10 px-3"
              title="Reset filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState label="Loading projects…" />
      ) : (
        <>
          <div className="table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Name</th>
                  <th>State / District</th>
                  <th>Category</th>
                  <th>Risk Score</th>
                  <th>Risk Level</th>
                  <th>Fin. Util.</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Sanctioned</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects?.projects.length === 0 ? (
                  <tr><td colSpan={12} className="py-12 text-center text-muted text-sm">No projects match the selected filters.</td></tr>
                ) : (
                  projects?.projects.map(p => (
                    <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{ cursor: 'pointer' }}>
                      <td className="font-mono text-[11px] text-muted font-medium">{p.project_id}</td>
                      <td className="font-medium text-[13px]">{truncate(p.project_name, 26) || '—'}</td>
                      <td className="text-[12px] text-muted">{[p.state, p.district].filter(Boolean).join(', ') || '—'}</td>
                      <td className="text-[12px] text-muted">{truncate(p.category, 16) || '—'}</td>
                      <td className="font-bold text-[14px]" style={{ color: p.final_score && p.final_score >= 70 ? '#b30000' : p.final_score && p.final_score >= 40 ? '#c2410c' : '#15803d' }}>
                        {p.final_score?.toFixed(1) ?? '—'}
                      </td>
                      <td><RiskBadge level={p.risk_level} /></td>
                      <td className="text-[12px]">{fmtPct(p.financial_utilisation)}</td>
                      <td className="text-[12px]">{fmtPct(p.physical_progress)}</td>
                      <td><span className="badge badge-soft text-[10px]">{p.status || '—'}</span></td>
                      <td><ReviewStatusBadge status={p.review_status} /></td>
                      <td className="text-[12px] font-medium text-ink">{fmtCurrency(p.sanctioned_amount)}</td>
                      <td>
                        <ExternalLink size={13} className="text-muted" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {projects && projects.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <p className="font-caption text-muted text-[11px] sm:text-[12px]">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, projects.total)} of {projects.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-soft btn-sm !px-3"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span className="font-body-sm text-ink px-2 text-xs font-semibold">{page} / {projects.pages}</span>
                <button
                  className="btn-soft btn-sm !px-3"
                  disabled={page === projects.pages}
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
