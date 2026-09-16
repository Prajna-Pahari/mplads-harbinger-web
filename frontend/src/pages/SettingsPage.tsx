import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { LoadingState, ErrorState } from '../components/UI'
import type { Settings } from '../types'
import { Check, Sliders, Shield } from 'lucide-react'

const SETTING_LABELS: Record<string, { label: string; description: string; type: 'number' | 'percent' }> = {
  risk_low_threshold: { label: 'Low Risk Threshold', description: 'Scores below this value are classified as LOW risk (default: 40)', type: 'number' },
  risk_medium_threshold: { label: 'Medium Risk Threshold', description: 'Scores between low and medium threshold are MEDIUM risk (default: 70)', type: 'number' },
  schedule_weight: { label: 'Schedule Deviation Weight', description: 'Relative weight for project timeline overrun score (default: 0.35)', type: 'percent' },
  financial_weight: { label: 'Financial-Progress Weight', description: 'Relative weight for expenditure vs physical progress mismatch (default: 0.40)', type: 'percent' },
  peer_weight: { label: 'Peer Outlier Weight', description: 'Relative weight for statistical Z-score outlier comparison (default: 0.25)', type: 'percent' },
  peer_min_group_size: { label: 'Minimum Peer Group Size', description: 'Minimum number of comparable works in category required for peer score (default: 3)', type: 'number' },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.settings.get()
      .then(s => { setSettings(s); setEdited(s) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.settings.update(edited)
      setSettings(edited)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="container py-12 sm:py-20"><LoadingState label="Loading risk configuration settings…" /></div>

  const totalWeight = (
    parseFloat(edited.schedule_weight || '0') +
    parseFloat(edited.financial_weight || '0') +
    parseFloat(edited.peer_weight || '0')
  )
  const weightsValid = Math.abs(totalWeight - 1) < 0.01

  return (
    <div className="container py-6 sm:py-10 max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <p className="font-label text-muted uppercase tracking-widest mb-1 sm:mb-2">CONFIGURATION & THRESHOLDS</p>
        <h1 className="font-heading-3 text-ink">Risk Engine Settings</h1>
        <p className="text-muted text-[13px] sm:text-[14px] mt-1">Configure scoring weights, categorization boundaries, and peer parameters.</p>
      </div>

      {error && <p className="text-risk-high text-xs sm:text-sm mb-4 p-3 bg-risk-high-bg rounded-xl">{error}</p>}

      {/* Risk Thresholds */}
      <div className="card !p-4 sm:!p-6 mb-5 sm:mb-6">
        <p className="font-bold text-[15px] sm:text-[16px] text-ink mb-0.5">Risk Level Classification</p>
        <p className="font-caption text-muted mb-5">Define boundary cutoffs for risk tiers.</p>
        <div className="flex flex-col gap-4 sm:gap-5">
          {['risk_low_threshold', 'risk_medium_threshold'].map(key => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline-soft pb-3 last:border-0">
              <div>
                <label className="font-label text-ink block mb-0.5 text-xs">{SETTING_LABELS[key].label}</label>
                <p className="font-caption text-muted text-[11px] max-w-sm">{SETTING_LABELS[key].description}</p>
              </div>
              <input
                type="number"
                className="input w-full sm:w-28 text-center"
                value={edited[key] || ''}
                onChange={e => setEdited(prev => ({ ...prev, [key]: e.target.value }))}
                min={0} max={100}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-canvas-soft rounded-2xl border border-hairline-soft">
          <p className="font-caption text-muted text-[11px] sm:text-xs">
            🟢 LOW: &lt; {edited.risk_low_threshold} · 🟠 MEDIUM: {edited.risk_low_threshold}–{edited.risk_medium_threshold} · 🔴 HIGH: ≥ {edited.risk_medium_threshold}
          </p>
        </div>
      </div>

      {/* Risk Weights */}
      <div className="card !p-4 sm:!p-6 mb-5 sm:mb-6">
        <p className="font-bold text-[15px] sm:text-[16px] text-ink mb-0.5">Scoring Model Weights</p>
        <p className="font-caption text-muted mb-5">Combined total must sum to exactly 1.0 (100%).</p>
        <div className="flex flex-col gap-4 sm:gap-5">
          {['schedule_weight', 'financial_weight', 'peer_weight'].map(key => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline-soft pb-3 last:border-0">
              <div>
                <label className="font-label text-ink block mb-0.5 text-xs">{SETTING_LABELS[key].label}</label>
                <p className="font-caption text-muted text-[11px] max-w-sm">{SETTING_LABELS[key].description}</p>
              </div>
              <input
                type="number"
                className="input w-full sm:w-28 text-center"
                value={edited[key] || ''}
                onChange={e => setEdited(prev => ({ ...prev, [key]: e.target.value }))}
                min={0} max={1} step={0.05}
              />
            </div>
          ))}
        </div>
        <div className={`mt-4 p-3 rounded-2xl border ${weightsValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-risk-high-bg border-red-200 text-risk-high'}`}>
          <p className="font-caption text-xs font-semibold">
            Total Weight: {totalWeight.toFixed(2)} {weightsValid ? '✓ Valid (100%)' : '✕ Weights must sum to 1.0'}
          </p>
        </div>
      </div>

      {/* Peer Settings */}
      <div className="card !p-4 sm:!p-6 mb-6 sm:mb-8">
        <p className="font-bold text-[15px] sm:text-[16px] text-ink mb-0.5">Peer Group Parameters</p>
        <p className="font-caption text-muted mb-4">Minimum cohort size needed before applying peer z-score checks.</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="font-label text-ink block mb-0.5 text-xs">{SETTING_LABELS['peer_min_group_size'].label}</label>
            <p className="font-caption text-muted text-[11px] max-w-sm">{SETTING_LABELS['peer_min_group_size'].description}</p>
          </div>
          <input
            type="number"
            className="input w-full sm:w-28 text-center"
            value={edited['peer_min_group_size'] || ''}
            onChange={e => setEdited(prev => ({ ...prev, peer_min_group_size: e.target.value }))}
            min={2} max={20}
          />
        </div>
      </div>

      {/* Save Button Group */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !weightsValid}
          className="btn-primary btn-lg w-full sm:w-auto"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button onClick={() => setEdited(settings)} className="btn-soft btn-lg w-full sm:w-auto">
          Reset Defaults
        </button>
        {saved && (
          <span className="text-emerald-700 text-xs sm:text-sm font-semibold flex items-center gap-1">
            <Check size={16} /> Saved successfully
          </span>
        )}
      </div>

      <p className="font-caption text-muted mt-6 text-[11px]">
        Note: New settings will take effect immediately for subsequent data analyses.
      </p>
    </div>
  )
}
