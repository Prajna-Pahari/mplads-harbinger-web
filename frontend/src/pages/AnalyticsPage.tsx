import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Download, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts'
import { api } from '../lib/api'
import { fmtPct, fmtCurrency } from '../lib/utils'
import { LoadingState, ErrorState, SectionHeader } from '../components/UI'
import type { AnalyticsSummary, Dataset } from '../types'

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.datasets.list(), api.analytics.summary()])
      .then(([ds, sum]) => {
        setDatasets(ds as Dataset[])
        setSummary(sum as AnalyticsSummary)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="container py-12 sm:py-20"><LoadingState label="Loading analytics…" /></div>
  if (error) return <div className="container py-12 sm:py-20"><ErrorState message={error} /></div>

  // State risk data for grouped bar
  const stateRiskMap: Record<string, Record<string, number>> = {}
  ;(summary?.state_risk || []).forEach(sr => {
    if (!stateRiskMap[sr.state]) stateRiskMap[sr.state] = { HIGH: 0, MEDIUM: 0, LOW: 0 }
    stateRiskMap[sr.state][sr.risk_level] = sr.cnt
  })
  const stateRiskData = Object.entries(stateRiskMap).map(([state, counts]) => ({ state, ...counts }))

  // Financial vs progress by state
  const stateFinData = Object.entries(
    (summary?.scatter_data || []).reduce((acc, p) => {
      const state = p.project_id.split('-')[1] || 'Other'
      if (!acc[state]) acc[state] = { state, fin: [], prog: [] }
      acc[state].fin.push(p.financial_utilisation)
      acc[state].prog.push(p.physical_progress)
      return acc
    }, {} as Record<string, { state: string; fin: number[]; prog: number[] }>)
  ).map(([, v]) => ({
    state: v.state,
    avg_fin: Math.round(v.fin.reduce((a, b) => a + b, 0) / v.fin.length),
    avg_prog: Math.round(v.prog.reduce((a, b) => a + b, 0) / v.prog.length),
  }))

  return (
    <div className="container-wide py-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">INSIGHTS & PATTERNS</p>
          <h1 className="font-heading-3 text-ink">Analytics</h1>
          <p className="text-muted text-[13px] sm:text-[14px] mt-1">{summary?.total_projects ?? 0} works analysed · {datasets[0]?.name || 'Demo Dataset'}</p>
        </div>
        <button onClick={() => api.export.projects()} className="btn-outline btn-sm gap-1.5 self-start sm:self-auto">
          <Download size={13} /> Export All Data
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Works', value: summary?.total_projects },
          { label: 'High Risk Works', value: summary?.high_risk, accent: 'text-risk-high' },
          { label: 'Total Sanctioned', value: fmtCurrency(summary?.total_sanctioned ?? 0) },
          { label: 'Avg Utilisation', value: fmtPct(summary?.avg_financial_utilisation) },
        ].map(item => (
          <div key={item.label} className="card-soft !p-4 sm:!p-5">
            <p className="font-label text-muted mb-1 text-[10px] sm:text-[11px] uppercase">{item.label}</p>
            <p className={`font-bold text-[20px] sm:text-[26px] leading-tight ${item.accent || 'text-ink'}`}>{item.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Risk by State */}
      {stateRiskData.length > 0 ? (
        <div className="card !p-4 sm:!p-6 mb-6 sm:mb-8">
          <SectionHeader title="Risk Distribution by State" label="GEOGRAPHIC BREAKDOWN" />
          <div className="w-full h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateRiskData} barSize={16} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="state" tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar dataKey="HIGH" fill="#b30000" radius={[4, 4, 0, 0]} name="High" />
                <Bar dataKey="MEDIUM" fill="#c2410c" radius={[4, 4, 0, 0]} name="Medium" />
                <Bar dataKey="LOW" fill="#15803d" radius={[4, 4, 0, 0]} name="Low" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card mb-8 py-8 text-center text-muted text-sm">Location breakdown unavailable for this dataset.</div>
      )}

      {/* Financial vs Progress by State */}
      <div className="card !p-4 sm:!p-6 mb-6 sm:mb-8">
        <SectionHeader title="Average Financial vs Progress by State" label="FINANCIAL EFFICIENCY" />
        {stateFinData.length > 0 ? (
          <div className="w-full h-[240px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateFinData} barSize={18} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="state" tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12 }} formatter={(v: number) => `${v}%`} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar dataKey="avg_fin" fill="#141414" radius={[4, 4, 0, 0]} name="Avg Fin Utilisation" />
                <Bar dataKey="avg_prog" fill="#15803d" radius={[4, 4, 0, 0]} name="Avg Progress" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="text-muted text-sm py-4">No regional data available.</p>}
      </div>

      {/* Score Distribution */}
      <div className="card !p-4 sm:!p-6 mb-6 sm:mb-8">
        <SectionHeader title="Risk Score Distribution" label="FREQUENCY DISTRIBUTION" />
        <div className="w-full h-[200px] sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary?.score_distribution || []} barSize={20} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 12 }} />
              <Bar dataKey="count" name="Projects" fill="#141414" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Signals Grid */}
      <div className="card !p-4 sm:!p-6">
        <SectionHeader title="Triggered Signals Overview" label="ANOMALY FREQUENCY" />
        {(summary?.signals || []).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {(summary?.signals || []).map(sig => (
              <div key={sig.signal_type} className="p-4 bg-canvas-soft rounded-2xl">
                <p className="font-semibold text-[13px] text-ink mb-1">{sig.signal_type}</p>
                <p className="text-2xl font-bold text-ink">{sig.cnt}</p>
                <p className="text-muted text-[11px] mt-1">flagged projects</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm py-4 text-center">No anomaly signals recorded in active dataset.</p>
        )}
      </div>
    </div>
  )
}
