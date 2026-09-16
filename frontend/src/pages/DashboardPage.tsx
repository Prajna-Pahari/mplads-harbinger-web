import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Download, Filter, ChevronLeft, ChevronRight, ExternalLink, Shield } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Legend
} from 'recharts'
import { api } from '../lib/api'
import { fmtCurrency, fmtPct, truncate } from '../lib/utils'
import { RiskBadge, RiskScore, LoadingState, EmptyState, ErrorState, ReviewStatusBadge, StatCard, SectionHeader, FilterPill, ProgressBar } from '../components/UI'
import type { AnalyticsSummary, PaginatedProjects, Dataset } from '../types'

const RISK_COLORS = { HIGH: '#b30000', MEDIUM: '#c2410c', LOW: '#15803d' }
const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW']

export default function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null)
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [projects, setProjects] = useState<PaginatedProjects | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [riskFilter, setRiskFilter] = useState<string>('')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const ds = await api.datasets.list() as Dataset[]
      setDatasets(ds)
      const active = ds[0] || null
      setActiveDataset(active)

      const [sum, projs] = await Promise.all([
        api.analytics.summary(active?.id) as Promise<AnalyticsSummary>,
        api.projects.list({
          dataset_id: active?.id,
          risk_level: riskFilter || undefined,
          search: search || undefined,
          page,
          page_size: 15,
        }) as Promise<PaginatedProjects>,
      ])
      setSummary(sum)
      setProjects(projs)
      setError(null)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [riskFilter, search, page])

  useEffect(() => { load() }, [load])

  const handleExport = () => api.export.projects(activeDataset?.id)

  if (loading && !summary) return <div className="container py-12 sm:py-20"><LoadingState label="Loading dashboard…" /></div>
  if (error) return <div className="container py-12 sm:py-20"><ErrorState message={error} /></div>

  const riskDist = [
    { name: 'High', value: summary?.high_risk || 0, color: RISK_COLORS.HIGH },
    { name: 'Medium', value: summary?.medium_risk || 0, color: RISK_COLORS.MEDIUM },
    { name: 'Low', value: summary?.low_risk || 0, color: RISK_COLORS.LOW },
  ]

  return (
    <div className="container-wide py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">RISK INTELLIGENCE OVERVIEW</p>
          <h1 className="font-heading-3 text-ink">Dashboard</h1>
          {activeDataset && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5 sm:mt-2">
              <span className="badge badge-soft text-[10px] sm:text-[11px]">{activeDataset.dataset_type === 'demo' ? '⚠ SYNTHETIC DEMO' : 'ACTIVE DATASET'}</span>
              <span className="text-muted text-[12px] sm:text-[13px] font-medium">{activeDataset.name}</span>
              <span className="text-faint text-[11px] sm:text-[12px]">({activeDataset.row_count} records)</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} className="btn-soft btn-sm gap-1.5 flex-1 sm:flex-initial">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleExport} className="btn-outline btn-sm gap-1.5 flex-1 sm:flex-initial">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Demo banner */}
      {activeDataset?.dataset_type === 'demo' && (
        <div className="mb-6 px-3.5 py-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2">
            <span className="text-amber-700 text-[13px] font-semibold flex-shrink-0">⚠ Demonstration Dataset:</span>
            <span className="text-amber-800 text-[12px] sm:text-[13px] leading-relaxed">
              Displaying baseline demonstration data. Monitor risk signals and review flagged works.
            </span>
          </div>
          <button onClick={() => navigate('/risk-queue')} className="btn-primary btn-sm !bg-amber-800 text-white w-full sm:w-auto flex-shrink-0">
            View Risk Queue
          </button>
        </div>
      )}

      {/* Responsive KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5 sm:gap-3 mb-8">
        <div className="card !p-3 sm:!p-4 bg-canvas-soft border-transparent">
          <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px]">TOTAL WORKS</p>
          <p className="font-bold text-[20px] sm:text-[26px] text-ink leading-tight">{summary?.total_projects ?? '—'}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-risk-high-bg border-transparent">
          <p className="font-label text-risk-high mb-1 text-[10px] sm:text-[11px]">HIGH RISK</p>
          <p className="font-bold text-[20px] sm:text-[26px] text-risk-high leading-tight">{summary?.high_risk ?? '—'}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-risk-medium-bg border-transparent">
          <p className="font-label text-risk-medium mb-1 text-[10px] sm:text-[11px]">MEDIUM RISK</p>
          <p className="font-bold text-[20px] sm:text-[26px] text-risk-medium leading-tight">{summary?.medium_risk ?? '—'}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-risk-low-bg border-transparent">
          <p className="font-label text-risk-low mb-1 text-[10px] sm:text-[11px]">LOW RISK</p>
          <p className="font-bold text-[20px] sm:text-[26px] text-risk-low leading-tight">{summary?.low_risk ?? '—'}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-canvas-soft border-transparent col-span-2 sm:col-span-1">
          <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px]">NEEDS REVIEW</p>
          <p className="font-bold text-[20px] sm:text-[26px] text-ink leading-tight">{summary?.requires_review ?? '—'}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-white hidden sm:block">
          <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px]">SANCTIONED</p>
          <p className="font-bold text-[15px] sm:text-[18px] text-ink leading-tight">{fmtCurrency(summary?.total_sanctioned ?? 0)}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-white hidden sm:block">
          <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px]">EXPENDITURE</p>
          <p className="font-bold text-[15px] sm:text-[18px] text-ink leading-tight">{fmtCurrency(summary?.total_expenditure ?? 0)}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-white hidden md:block">
          <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px]">AVG UTILISATION</p>
          <p className="font-bold text-[16px] sm:text-[20px] text-ink leading-tight">{fmtPct(summary?.avg_financial_utilisation)}</p>
        </div>
        <div className="card !p-3 sm:!p-4 bg-white hidden md:block">
          <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px]">AVG PROGRESS</p>
          <p className="font-bold text-[16px] sm:text-[20px] text-ink leading-tight">{fmtPct(summary?.avg_physical_progress)}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {/* Risk Distribution Pie */}
        <div className="card !p-4 sm:!p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold text-[14px] text-ink">Risk Distribution</p>
              <p className="font-caption text-muted">Tap segment to filter</p>
            </div>
            {riskFilter && (
              <button onClick={() => setRiskFilter('')} className="btn-soft btn-sm text-[11px] !h-6 !px-2">
                Clear filter
              </button>
            )}
          </div>
          <div className="w-full h-[180px] sm:h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  onClick={(d) => setRiskFilter(riskFilter === d.name.toUpperCase() ? '' : d.name.toUpperCase())}
                  style={{ cursor: 'pointer' }}
                >
                  {riskDist.map(entry => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      opacity={!riskFilter || riskFilter === entry.name.toUpperCase() ? 1 : 0.25}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} works`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around pt-2 border-t border-hairline-soft">
            {riskDist.map(d => (
              <button
                key={d.name}
                onClick={() => setRiskFilter(riskFilter === d.name.toUpperCase() ? '' : d.name.toUpperCase())}
                className="flex flex-col items-center gap-0.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-canvas-soft"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="font-caption text-muted text-[11px]">{d.name}</span>
                </div>
                <span className="font-bold text-[14px] text-ink">{d.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Score Distribution Bar Chart */}
        <div className="card !p-4 sm:!p-5">
          <p className="font-bold text-[14px] text-ink mb-0.5">Score Distribution</p>
          <p className="font-caption text-muted mb-3">Frequency by risk score band</p>
          <div className="w-full h-[200px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.score_distribution || []} barSize={14} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12 }} />
                <Bar dataKey="count" fill="#141414" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Triggered Signals */}
        <div className="card !p-4 sm:!p-5 md:col-span-2 lg:col-span-1">
          <p className="font-bold text-[14px] text-ink mb-0.5">Triggered Signals</p>
          <p className="font-caption text-muted mb-3">Alerts by anomaly type</p>
          <div className="flex flex-col gap-3">
            {(summary?.signals || []).map(sig => {
              const total = (summary?.signals || []).reduce((a, b) => a + b.cnt, 0)
              const pct = total ? Math.round((sig.cnt / total) * 100) : 0
              return (
                <div key={sig.signal_type}>
                  <div className="flex justify-between items-center mb-1 text-[12px]">
                    <span className="font-medium text-ink truncate pr-2">{sig.signal_type}</span>
                    <span className="text-muted font-semibold">{sig.cnt} <span className="text-faint font-normal">({pct}%)</span></span>
                  </div>
                  <ProgressBar value={sig.cnt} max={total || 1} color="#141414" height={5} />
                </div>
              )
            })}
            {(!summary?.signals || summary.signals.length === 0) && (
              <p className="text-muted text-xs py-4 text-center">No anomalies triggered yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Scatter Plot (Financial vs Physical Progress) */}
      <div className="card !p-4 sm:!p-6 mb-8">
        <div className="mb-3">
          <p className="font-bold text-[15px] text-ink">Financial Utilisation vs Physical Progress</p>
          <p className="font-caption text-muted">Upper-left quadrant indicates potential financial-progress mismatch · Tap node to view</p>
        </div>
        <div className="w-full h-[240px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number" dataKey="financial_utilisation" name="Financial Util" unit="%"
                tick={{ fontSize: 10, fill: '#707070' }} axisLine={false}
                label={{ value: 'Fin. Util (%)', position: 'insideBottom', offset: -10, fontSize: 10, fill: '#707070' }}
              />
              <YAxis
                type="number" dataKey="physical_progress" name="Physical Progress" unit="%"
                tick={{ fontSize: 10, fill: '#707070' }} axisLine={false}
                label={{ value: 'Progress (%)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#707070' }}
              />
              <Tooltip
                cursor={{ stroke: '#e0e0e0' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="card !p-2.5 text-[11px] shadow-lg" style={{ minWidth: 150 }}>
                      <p className="font-semibold text-ink mb-1 truncate">{d.project_name || d.project_id}</p>
                      <p className="text-muted">Financial: <span className="text-ink font-semibold">{fmtPct(d.financial_utilisation)}</span></p>
                      <p className="text-muted">Progress: <span className="text-ink font-semibold">{fmtPct(d.physical_progress)}</span></p>
                      <p className="text-muted">Risk Score: <span className="text-ink font-semibold">{d.final_score?.toFixed(1)}</span></p>
                    </div>
                  )
                }}
              />
              {RISK_LEVELS.map(level => (
                <Scatter
                  key={level}
                  name={level}
                  data={(summary?.scatter_data || []).filter(d => d.risk_level === level)}
                  fill={RISK_COLORS[level as keyof typeof RISK_COLORS]}
                  opacity={0.8}
                  onClick={(d) => navigate(`/project/${d.id}`)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Table */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="font-bold text-[16px] text-ink">Project Records</p>
            <p className="font-caption text-muted">{projects?.total ?? 0} works found</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Risk level filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <FilterPill label="All" active={!riskFilter} onClick={() => { setRiskFilter(''); setPage(1) }} />
              {RISK_LEVELS.map(lvl => (
                <FilterPill
                  key={lvl}
                  label={lvl}
                  active={riskFilter === lvl}
                  onClick={() => { setRiskFilter(riskFilter === lvl ? '' : lvl); setPage(1) }}
                />
              ))}
            </div>
            {/* Search */}
            <input
              className="input text-xs sm:text-sm h-8 w-full sm:w-44 !py-1 !px-3"
              placeholder="Search works…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ borderRadius: 9999 }}
            />
          </div>
        </div>

        {/* Scrollable table container */}
        <div className="table-scroll-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Name</th>
                <th>State</th>
                <th>Category</th>
                <th>Risk Level</th>
                <th>Score</th>
                <th>Fin. Util.</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Review</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="py-12 text-center text-muted text-sm">Loading records…</td></tr>
              ) : projects?.projects.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-muted text-sm">No projects match the selected criteria.</td></tr>
              ) : (
                projects?.projects.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="font-mono text-[11px] text-muted font-medium">{p.project_id}</td>
                    <td className="font-medium text-[13px]">{truncate(p.project_name, 28) || '—'}</td>
                    <td className="text-[12px] text-muted">{p.state || '—'}</td>
                    <td className="text-[12px] text-muted">{truncate(p.category, 18) || '—'}</td>
                    <td><RiskBadge level={p.risk_level} /></td>
                    <td>
                      <span className="font-bold text-[14px]" style={{ color: p.final_score && p.final_score >= 70 ? '#b30000' : p.final_score && p.final_score >= 40 ? '#c2410c' : '#15803d' }}>
                        {p.final_score?.toFixed(1) ?? '—'}
                      </span>
                    </td>
                    <td className="text-[12px]">{fmtPct(p.financial_utilisation)}</td>
                    <td className="text-[12px]">{fmtPct(p.physical_progress)}</td>
                    <td><span className="badge badge-soft text-[10px]">{p.status || '—'}</span></td>
                    <td><ReviewStatusBadge status={p.review_status} /></td>
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
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, projects.total)} of {projects.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-soft btn-sm !px-3"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="font-body-sm text-ink px-2 text-xs font-semibold">{page} / {projects.pages}</span>
              <button
                className="btn-soft btn-sm !px-3"
                disabled={page === projects.pages}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
