import { NavLink } from 'react-router-dom'
import { Shield } from 'lucide-react'

const FOOTER_LINKS = {
  Product: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Projects', to: '/projects' },
    { label: 'Risk Queue', to: '/risk-queue' },
    { label: 'Analytics', to: '/analytics' },
    { label: 'CSV Analyzer', to: '/csv-analyzer' },
    { label: 'Reports', to: '/reports' },
  ],
  Governance: [
    { label: 'Human Review', to: '/reviews' },
    { label: 'Audit Logs', to: '/audit' },
  ],
  References: [
    { label: 'MPLADS / eSAKSHI', to: '#' },
    { label: 'MoSPI Guidelines', to: '#' },
    { label: 'MPLADS Guidelines 2023', to: '#' },
    { label: 'Lok Sabha Portal', to: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-ink rounded-t-[20px] sm:rounded-t-[24px] text-white mt-12 sm:mt-20">
      <div className="container-wide py-10 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white">
                <Shield size={16} />
              </div>
              <span className="font-bold text-[14px] sm:text-[15px] tracking-tight">MPLADS HARBINGER</span>
            </div>
            <p className="text-[13px] text-faint leading-relaxed">
              Explainable Risk Intelligence for MPLADS Monitoring.
            </p>
            <p className="text-[11px] text-faint/80 mt-3 sm:mt-4 leading-relaxed">
              AI prioritises risk signals. Officials verify evidence and make final decisions.
              This system does not automatically confirm fraud.
            </p>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <p className="text-[11px] font-bold text-faint uppercase tracking-widest mb-3 sm:mb-4">{section}</p>
              <ul className="space-y-2 sm:space-y-2.5 list-none p-0 m-0">
                {links.map(link => (
                  <li key={link.label}>
                    <NavLink
                      to={link.to}
                      className="text-[13px] text-faint hover:text-white transition-colors no-underline block py-0.5"
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 mt-10 sm:mt-12 pt-6 sm:pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left sm:text-left">
          <p className="text-[11px] sm:text-[12px] text-faint">
            © 2026 MPLADS HARBINGER · Built by Team XYLOQ · SIH Problem 26102
          </p>
          <p className="text-[11px] sm:text-[12px] text-faint">
            Prototype — Demonstration for Smart India Hackathon
          </p>
        </div>
      </div>
    </footer>
  )
}
