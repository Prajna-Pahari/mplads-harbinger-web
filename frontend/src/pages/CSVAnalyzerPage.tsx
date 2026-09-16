import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, CheckCircle2, AlertCircle, Info, ArrowRight, ArrowLeft, RefreshCw, FileText } from 'lucide-react'
import { LoadingState, ProgressBar, ErrorState } from '../components/UI'

const API_HOST = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const BASE = `${API_HOST}/api`

async function csvRequest<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

const csvApi = {
  upload: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/csv/upload`, { method: 'POST', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },
  preview: (sessionId: string, rows = 10) =>
    csvRequest<{ columns: string[]; rows: Record<string, string>[] }>(
      `/csv/${sessionId}/preview?rows=${rows}`
    ),
  validate: (sessionId: string, mapping: Record<string, string | null>) =>
    csvRequest<unknown>(`/csv/${sessionId}/validate`, {
      method: 'POST',
      body: JSON.stringify(mapping),
    }),
  analyze: (sessionId: string) =>
    csvRequest<{ dataset_id: number }>(`/csv/${sessionId}/analyze`, { method: 'POST' }),
  loadDemo: () => csvRequest<{ dataset_id: number }>('/csv/load-demo', { method: 'POST' }),
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

const STEP_LABELS = [
  'Upload', 'Preview', 'Map Columns', 'Validate', 'Normalise', 'Analyse', 'Risk Score', 'Results'
]

const EXPECTED_FIELDS = [
  'project_id', 'project_name', 'state', 'district', 'constituency', 'category',
  'sanctioned_amount', 'released_amount', 'expenditure', 'financial_utilisation',
  'physical_progress', 'start_date', 'expected_completion', 'actual_completion',
  'planned_duration', 'elapsed_months', 'status', 'location',
]

export default function CSVAnalyzerPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>(1)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [file, setFile] = useState<File | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [uploadMeta, setUploadMeta] = useState<{
    filename: string; file_size: number; row_count: number; column_count: number; columns: string[]; auto_mapping: Record<string, string | null>
  } | null>(null)

  // Step 2 - preview
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, string>[] } | null>(null)

  // Step 3 - mapping
  const [mapping, setMapping] = useState<Record<string, string | null>>({})

  // Step 4 - validation
  const [validation, setValidation] = useState<{
    total_rows: number; valid_rows: number; data_quality_score: number; completeness_pct: number;
    issues: { type: string; field: string; message: string; count: number }[];
    warnings: { type: string; field: string; message: string; count: number }[];
  } | null>(null)

  // Step 8 - results
  const [resultDatasetId, setResultDatasetId] = useState<number | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.csv')) {
      setError('Only .csv files are supported.')
      return
    }
    setFile(f)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (!f.name.endsWith('.csv')) { setError('Only .csv files are supported.'); return }
    setFile(f)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const res = await csvApi.upload(file)
      setUploadMeta(res)
      setSessionId(res.session_id)
      setMapping(res.auto_mapping || {})
      setStep(2)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handlePreview = async () => {
    if (!sessionId) return
    try {
      const data = await csvApi.preview(sessionId, 10)
      setPreviewData(data)
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { if (step === 2) handlePreview() }, [step])

  const handleValidate = async () => {
    if (!sessionId) return
    try {
      const res = await csvApi.validate(sessionId, mapping)
      setValidation(res as typeof validation)
      setStep(4)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  const handleAnalyze = async () => {
    if (!sessionId) return
    setAnalyzing(true)
    setError(null)
    try {
      // Steps 5, 6, 7 happen server-side
      setStep(5)
      await new Promise(r => setTimeout(r, 600))
      setStep(6)
      const res = await csvApi.analyze(sessionId)
      setStep(7)
      await new Promise(r => setTimeout(r, 400))
      setResultDatasetId(res.dataset_id)
      setStep(8)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const loadDemo = async () => {
    setUploading(true)
    try {
      const res = await csvApi.loadDemo()
      setResultDatasetId(res.dataset_id)
      setStep(8)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const resetWorkflow = () => {
    setStep(1); setFile(null); setSessionId(null); setUploadMeta(null)
    setPreviewData(null); setMapping({}); setValidation(null); setResultDatasetId(null); setError(null)
  }

  return (
    <div className="container py-6 sm:py-10 max-w-4xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">INGESTION & RISK ENGINE PIPELINE</p>
        <h1 className="font-heading-3 text-ink">CSV Analyzer</h1>
        <p className="text-muted text-sm sm:text-base mt-1">
          Upload and process your MPLADS dataset to automatically validate, map fields, and generate explainable risk scores.
        </p>
      </div>

      {/* Step Progress Bar - Mobile Friendly */}
      <div className="card-soft !p-3 sm:!p-4 mb-6 sm:mb-8">
        {/* Mobile View: Step indicator text + progress bar */}
        <div className="sm:hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="font-label text-ink font-bold uppercase text-[11px]">
              Step {step} of 8: <span className="text-muted font-normal">{STEP_LABELS[step - 1]}</span>
            </span>
            <span className="font-bold text-xs text-ink">{Math.round((step / 8) * 100)}%</span>
          </div>
          <ProgressBar value={step} max={8} color="#141414" height={6} />
        </div>

        {/* Tablet / Desktop View: Full horizontal steps */}
        <div className="hidden sm:flex items-center justify-between overflow-x-auto no-scrollbar py-1">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step
            const done = step > n
            const active = step === n
            return (
              <div key={label} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-1">
                  <div className={`step-dot ${done ? 'bg-ink text-white' : active ? 'bg-ink text-white shadow-sm' : 'bg-white text-muted border border-hairline'}`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`font-label whitespace-nowrap text-[10px] ${active ? 'text-ink font-bold' : 'text-faint'}`}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`step-line mx-2 ${done ? 'done' : ''}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-risk-high-bg border border-red-200 rounded-2xl p-4 text-risk-high text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* ─── Step 1: Upload ──────────────────────────────── */}
      {step === 1 && (
        <div className="card !p-4 sm:!p-6">
          <div
            className="border-2 border-dashed border-hairline rounded-2xl p-6 sm:p-12 text-center cursor-pointer hover:border-ink hover:bg-canvas-soft/50 transition-all"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <div className="w-12 h-12 rounded-full bg-canvas-soft flex items-center justify-center mx-auto mb-3 text-ink">
              <Upload size={24} />
            </div>
            <p className="font-bold text-[15px] sm:text-[17px] text-ink mb-1.5">{file ? file.name : 'Choose or drop your CSV file'}</p>
            {file ? (
              <p className="text-muted text-xs sm:text-sm">{(file.size / 1024).toFixed(1)} KB · Ready to upload</p>
            ) : (
              <p className="text-muted text-xs sm:text-sm">Standard comma-separated .csv format · Max 50MB</p>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            {file && (
              <button onClick={handleUpload} disabled={uploading} className="btn-primary btn-lg w-full sm:w-auto flex-1">
                {uploading ? 'Uploading…' : 'Upload & Preview'} <ArrowRight size={16} />
              </button>
            )}
            <button onClick={loadDemo} disabled={uploading} className="btn-soft btn-lg w-full sm:w-auto">
              {uploading ? 'Loading…' : 'Load Built-in Demo Dataset'}
            </button>
          </div>

          <p className="font-caption text-muted mt-4 text-[11px] leading-relaxed">
            🔒 Privacy guarantee: Dataset processing runs strictly inside your local instance. No data is sent to external third parties.
          </p>
        </div>
      )}

      {/* ─── Step 2: Preview ─────────────────────────────── */}
      {step === 2 && (
        <div className="card !p-4 sm:!p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-bold text-[16px]">Dataset Preview</p>
              <p className="font-caption text-muted">{uploadMeta?.filename} · {uploadMeta?.row_count} rows · {uploadMeta?.column_count} columns</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(1)} className="btn-soft btn-sm gap-1"><ArrowLeft size={14} /> Back</button>
              <button onClick={() => setStep(3)} className="btn-primary btn-sm gap-1">Map Columns <ArrowRight size={14} /></button>
            </div>
          </div>
          {previewData ? (
            <div className="table-scroll-wrapper">
              <table className="data-table text-[12px]">
                <thead>
                  <tr>{previewData.columns.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, i) => (
                    <tr key={i}>{previewData.columns.map(c => <td key={c}>{row[c] || '—'}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <LoadingState label="Loading table preview…" />}
        </div>
      )}

      {/* ─── Step 3: Column Mapping ──────────────────────── */}
      {step === 3 && (
        <div className="card !p-4 sm:!p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-bold text-[16px]">Column Mapping</p>
              <p className="font-caption text-muted">Confirm mappings between your CSV headers and HARBINGER fields.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(2)} className="btn-soft btn-sm gap-1"><ArrowLeft size={14} /> Back</button>
              <button onClick={handleValidate} className="btn-primary btn-sm gap-1">Validate <ArrowRight size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {EXPECTED_FIELDS.map(field => (
              <div key={field} className="p-3 bg-canvas-soft rounded-2xl flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <label className="font-label text-muted block mb-1 text-[10px] uppercase truncate">{field.replace(/_/g, ' ')}</label>
                  <select
                    className="select text-xs sm:text-sm !bg-white"
                    value={mapping[field] || ''}
                    onChange={e => setMapping(m => ({ ...m, [field]: e.target.value || null }))}
                  >
                    <option value="">— Unmapped —</option>
                    {(uploadMeta?.columns || []).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex-shrink-0">
                  {mapping[field]
                    ? <CheckCircle2 size={18} className="text-emerald-600" />
                    : <div className="w-4 h-4 rounded-full border border-hairline" />}
                </div>
              </div>
            ))}
          </div>
          <p className="font-caption text-muted mt-4 text-[12px]">
            {Object.values(mapping).filter(Boolean).length} of {EXPECTED_FIELDS.length} expected fields mapped.
          </p>
        </div>
      )}

      {/* ─── Step 4: Validation ──────────────────────────── */}
      {step === 4 && validation && (
        <div className="card !p-4 sm:!p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <p className="font-bold text-[16px]">Data Quality Validation</p>
              <p className="font-caption text-muted">{validation.total_rows} records examined</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(3)} className="btn-soft btn-sm gap-1"><ArrowLeft size={14} /> Back</button>
              <button onClick={handleAnalyze} className="btn-primary btn-sm gap-1">Run Analysis <ArrowRight size={14} /></button>
            </div>
          </div>

          {/* Quality score box */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6 p-4 sm:p-5 bg-canvas-soft rounded-2xl mb-6">
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%',
                border: `3px solid ${validation.data_quality_score >= 80 ? '#15803d' : validation.data_quality_score >= 60 ? '#c2410c' : '#b30000'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: validation.data_quality_score >= 80 ? '#15803d' : '#c2410c',
                fontSize: 20, fontWeight: 700, flexShrink: 0
              }}
            >
              {validation.data_quality_score.toFixed(0)}%
            </div>
            <div>
              <p className="font-bold text-[17px] text-ink">Data Quality Rating</p>
              <p className="text-muted text-xs sm:text-sm mt-0.5">
                Completeness: {validation.completeness_pct}% · Valid rows: {validation.valid_rows} / {validation.total_rows}
              </p>
            </div>
          </div>

          {/* Issues */}
          {validation.issues.length > 0 && (
            <div className="mb-4">
              <p className="font-label text-muted mb-2 uppercase text-[11px]">ISSUES IDENTIFIED</p>
              {validation.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 mb-2 bg-risk-high-bg rounded-xl px-3 py-2 border border-red-200/50">
                  <AlertCircle size={14} className="text-risk-high mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] sm:text-[13px] text-risk-high">{issue.message}</p>
                </div>
              ))}
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div>
              <p className="font-label text-muted mb-2 uppercase text-[11px]">WARNINGS</p>
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 mb-2 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200/50">
                  <Info size={14} className="text-amber-700 mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] sm:text-[13px] text-amber-800">{w.message}</p>
                </div>
              ))}
            </div>
          )}
          {validation.issues.length === 0 && validation.warnings.length === 0 && (
            <div className="flex items-center gap-2 text-emerald-700 p-3 bg-emerald-50 rounded-xl">
              <CheckCircle2 size={16} /> <span className="font-semibold text-xs sm:text-sm">All validation rules passed with 100% integrity.</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Steps 5–7: Processing ────────────────────────── */}
      {(step === 5 || step === 6 || step === 7) && (
        <div className="card !p-8 text-center">
          <LoadingState label={
            step === 5 ? 'Normalising data & formatting dates…' :
            step === 6 ? 'Executing 4-signal risk analysis…' :
            'Generating explainable AI narratives…'
          } />
          <p className="font-caption text-muted mt-4">
            Stage {step} of 8: Processing signals in real time…
          </p>
        </div>
      )}

      {/* ─── Step 8: Results ─────────────────────────────── */}
      {step === 8 && (
        <div className="card !p-6 sm:!p-10 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4 text-emerald-700">
            <CheckCircle2 size={30} />
          </div>
          <h2 className="font-bold text-[20px] sm:text-[24px] text-ink mb-1.5">Analysis Complete</h2>
          <p className="text-muted text-xs sm:text-sm mb-6 sm:mb-8 max-w-md mx-auto">
            Your dataset has been ingested, validated, and analysed. All anomaly scores and evidence reasons are ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <button onClick={() => navigate('/dashboard')} className="btn-primary btn-lg w-full sm:w-auto">
              Open Dashboard <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/risk-queue')} className="btn-outline btn-lg w-full sm:w-auto">
              View Risk Queue
            </button>
            <button onClick={resetWorkflow} className="btn-soft btn-lg w-full sm:w-auto">
              <RefreshCw size={14} /> Analyze Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
