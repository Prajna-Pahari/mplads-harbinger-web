import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, ChevronRight, CheckCircle2, AlertTriangle, BarChart2, Users } from 'lucide-react'
import Footer from '../components/Footer'

const STEPS = [
  { num: '01', label: 'DATA INGESTION', desc: 'Project data enters via official records, eSAKSHI integration, or batch sync.' },
  { num: '02', label: 'NORMALISATION', desc: 'Columns are mapped, validated, cleaned, and scored for data quality.' },
  { num: '03', label: '4-SIGNAL CHECKS', desc: 'Schedule deviation · Financial utilisation · Peer outlier · Divergence (DIV-001).' },
  { num: '04', label: 'RISK SCORING', desc: 'Transparent 0–100 composite risk score calculated with configurable weights.' },
  { num: '05', label: 'HUMAN REVIEW', desc: 'Officials verify evidence and record actions with complete audit trails.' },
]

const PRINCIPLES = [
  {
    icon: <BarChart2 size={18} />,
    title: 'Multi-Signal',
    desc: 'Combines schedule, financial, peer outlier, and divergence signals into one weighted risk score.',
  },
  {
    icon: <Users size={18} />,
    title: 'Context-Aware',
    desc: 'Compares each project with similar works in the same category and region.',
  },
  {
    icon: <CheckCircle2 size={18} />,
    title: 'Explainable',
    desc: 'Shows evidence, calculations, and reasons behind every flag — no black boxes.',
  },
  {
    icon: <Shield size={18} />,
    title: 'Human-in-the-Loop',
    desc: 'AI prioritises. Officials decide. The system never confirms fraud automatically.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="overflow-hidden">
      {/* ─── Hero ──────────────────────────────────────────────── */}
      <section className="section-lg !pt-8 sm:!pt-16">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-canvas-soft text-muted text-[11px] font-semibold tracking-widest uppercase mb-4 sm:mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-ink" />
                MPLADS RISK INTELLIGENCE
              </div>
              <h1 className="font-heading-1 text-ink mb-4 sm:mb-6">
                MPLADS<br className="hidden sm:inline" /> HARBINGER.
              </h1>
              <p className="font-body-lg text-muted mb-6 sm:mb-8 max-w-lg">
                Combine project data, rule-based checks, and anomaly detection to identify unusual works,
                prioritise risk, and explain why a case needs attention.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full sm:w-auto">
                <button onClick={() => navigate('/dashboard')} className="btn-primary btn-lg w-full sm:w-auto">
                  Open Dashboard <ArrowRight size={16} />
                </button>
                <button onClick={() => navigate('/risk-queue')} className="btn-outline btn-lg w-full sm:w-auto">
                  <AlertTriangle size={16} /> Explore Risk Queue
                </button>
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="btn-soft btn-lg w-full sm:w-auto"
                >
                  How HARBINGER Works
                </button>
              </div>
            </div>

            {/* Right — Product card */}
            <div className="relative mt-4 lg:mt-0">
              <div className="card-soft p-4 sm:p-6 rounded-[20px] sm:rounded-[24px]" style={{ background: '#141414' }}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="font-label text-white/40 uppercase tracking-widest mb-1 text-[10px] sm:text-[11px]">SAMPLE PROJECT</p>
                    <p className="font-semibold text-white text-[14px] sm:text-[16px] truncate">Road Construction — Ajmer</p>
                    <p className="text-white/40 text-[11px] sm:text-[12px] mt-0.5">MPLADS-RJ-001 · Rajasthan</p>
                  </div>
                  <div
                    className="flex-shrink-0"
                    style={{
                      width: 48, height: 48, borderRadius: '50%',
                      border: '2.5px solid #b30000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#b30000', fontSize: 18, fontWeight: 700
                    }}
                  >
                    76
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <span className="badge" style={{ background: 'rgba(179,0,0,0.18)', color: '#ff6b6b', fontSize: 11 }}>HIGH RISK</span>
                </div>

                <div className="border-t border-white/10 pt-3 mb-4">
                  <p className="font-label text-white/40 uppercase tracking-widest mb-2.5 text-[10px] sm:text-[11px]">Signals Triggered</p>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {[
                      { label: 'Schedule Deviation (6 mo. delay)', active: true },
                      { label: 'Financial Utilisation (Slow absorption)', active: true },
                      { label: 'Peer Group Outlier (Z = +2.4σ)', active: true },
                      { label: 'Financial–Physical Divergence (DIV-001: 37 pp gap)', active: true },
                    ].map(sig => (
                      <div key={sig.label} className="flex items-center gap-2">
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#b30000', flexShrink: 0 }} />
                        <span className="text-white/75 text-[12px] sm:text-[13px]">{sig.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-[14px] sm:rounded-[16px] p-3 sm:p-4">
                  <p className="font-label text-white/40 uppercase tracking-widest mb-2 text-[10px] sm:text-[11px]">WHY FLAGGED?</p>
                  <div className="flex flex-col gap-2">
                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      <span className="text-white font-semibold">01</span> — Project has exceeded its planned duration by 6 months.
                    </p>
                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      <span className="text-white font-semibold">02</span> — Disproportionately low fund absorption against elapsed timeline.
                    </p>
                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      <span className="text-white font-semibold">03</span> — Differs significantly from comparable road works in region (peer median: 48%).
                    </p>
                    <p className="text-white/70 text-[12px] sm:text-[13px] leading-relaxed">
                      <span className="text-white font-semibold">04</span> — Financial utilisation (92%) substantially outpaces physical progress (55%) with a 37 pp divergence gap (DIV-001).
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/10">
                    <p className="text-white/35 text-[10px] sm:text-[11px] italic">
                      Unusual pattern detected · Requires human review
                    </p>
                  </div>
                </div>
              </div>

              {/* Label */}
              <p className="font-caption text-muted text-center mt-2 text-[11px]">
                ILLUSTRATIVE EXAMPLE — Synthetic demo data
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How HARBINGER Works ─────────────────────────────────── */}
      <section id="how-it-works" className="section" style={{ background: '#071829' }}>
        <div className="container">
          <div className="text-center mb-8 sm:mb-14">
            <p className="font-label uppercase tracking-widest mb-2 sm:mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              METHODOLOGY
            </p>
            <h2 className="font-heading-2 text-white">How HARBINGER Works.</h2>
          </div>

          {/* Desktop horizontal / Mobile vertical step flow */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-2 relative">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative flex md:flex-col items-start md:items-center text-left md:text-center gap-4 md:gap-0 px-2 sm:px-3">
                {/* Desktop connector line */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[60%] w-[80%] h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
                )}

                {/* Step dot */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 md:mb-4 relative z-10"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <span className="text-white/80 text-[12px] font-bold">{step.num}</span>
                </div>

                <div>
                  <p className="font-semibold text-white text-[13px] mb-1 tracking-wide">{step.label}</p>
                  <p className="text-[12px] sm:text-[13px]" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.45 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Core Principles ─────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="mb-8 sm:mb-12">
            <p className="font-label text-muted uppercase tracking-widest mb-2">CAPABILITIES</p>
            <h2 className="font-heading-2 text-ink">Built on four principles.</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {PRINCIPLES.map(p => (
              <div key={p.title} className="card border-t-2 border-t-ink !p-5 sm:!p-6">
                <div className="w-8 h-8 rounded-[12px] bg-canvas-soft flex items-center justify-center mb-3 text-ink">
                  {p.icon}
                </div>
                <h3 className="font-bold text-[15px] sm:text-[16px] text-ink mb-1.5">{p.title}</h3>
                <p className="text-[13px] sm:text-[14px] text-muted leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Impact ──────────────────────────────────────────────── */}
      <section className="section" style={{ background: '#003C33' }}>
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <p className="font-label uppercase tracking-widest mb-2 sm:mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                IMPACT
              </p>
              <h2 className="font-heading-2 text-white mb-6 sm:mb-8">From reactive to proactive.</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <p className="font-semibold text-white/50 text-[10px] sm:text-[11px] uppercase tracking-widest mb-2.5">BEFORE</p>
                  {['Manual sampling', 'Reactive oversight', 'Fragmented data', 'Delayed detection'].map(t => (
                    <div key={t} className="flex items-center gap-2 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                      <span className="text-white/50 text-[13px]">{t}</span>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                  <p className="font-semibold text-emerald-300 text-[10px] sm:text-[11px] uppercase tracking-widest mb-2.5">AFTER HARBINGER</p>
                  {['AI-assisted analysis', 'Proactive prioritisation', 'Unified risk queue', 'Transparent evidence'].map(t => (
                    <div key={t} className="flex items-center gap-2 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-white text-[13px] font-medium">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: 'BETTER GOVERNANCE', desc: 'Transparent, evidence-backed oversight across departments.' },
                { label: 'FINANCIAL ACCOUNTABILITY', desc: 'Spot unusual expenditure mismatches before completion.' },
                { label: 'ADMINISTRATIVE EFFICIENCY', desc: 'Direct reviewer attention to top-priority anomalies.' },
                { label: 'PUBLIC BENEFIT', desc: 'Ensure public funds reach designated community works.' },
              ].map(item => (
                <div key={item.label} className="p-4 sm:p-5 rounded-[16px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <p className="font-bold text-white text-[12px] sm:text-[13px] mb-1.5">{item.label}</p>
                  <p className="text-white/60 text-[12px] sm:text-[13px] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────── */}
      <section className="section text-center">
        <div className="container">
          <p className="font-label text-muted uppercase tracking-widest mb-2">OPERATIONAL TRIAGE</p>
          <h2 className="font-heading-2 text-ink mb-4 sm:mb-6">Operational Risk Intelligence</h2>
          <p className="font-body-lg text-muted mb-6 sm:mb-8 max-w-lg mx-auto text-sm sm:text-base">
            Monitor prioritized risk signals, investigate flagged works, and record human governance reviews across MPLADS projects.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <button onClick={() => navigate('/risk-queue')} className="btn-primary btn-lg w-full sm:w-auto">
              <AlertTriangle size={16} /> Explore Risk Queue
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn-outline btn-lg w-full sm:w-auto">
              View Dashboard <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
