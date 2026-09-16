import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, AlertTriangle, BarChart2,
  FileCheck, Search, Settings, Menu, X, Shield, ChevronRight
} from 'lucide-react'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/risk-queue', label: 'Risk Queue', icon: AlertTriangle },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/reviews', label: 'Reviews', icon: FileCheck },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/projects?search=${encodeURIComponent(search.trim())}`)
      setSearch('')
      setSearchOpen(false)
      setMobileOpen(false)
    }
  }

  return (
    <>
      {/* Announcement bar */}
      <div className="announcement-bar">
        <span>MPLADS HARBINGER · EXPLAINABLE RISK INTELLIGENCE</span>
        <span className="hidden sm:inline mx-2 opacity-40">·</span>
        <span className="hidden sm:inline opacity-70">PROTOTYPE</span>
      </div>

      {/* Main nav */}
      <nav className="top-nav">
        <div className="container-wide flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 no-underline flex-shrink-0 py-1">
            <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center flex-shrink-0 text-white">
              <Shield size={16} />
            </div>
            <span className="font-bold text-ink text-[14px] sm:text-[15px] tracking-tight">
              MPLADS HARBINGER
            </span>
          </NavLink>

          {/* Center nav links (Desktop) */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-colors no-underline
                   ${isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-canvas-soft'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          {/* Right zone */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop / Tablet Search */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-1.5">
                <input
                  autoFocus
                  className="input text-xs sm:text-sm h-8 sm:h-9 w-36 sm:w-48 !py-1 !px-3"
                  placeholder="Search works…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ borderRadius: '9999px' }}
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="btn-soft !p-0 w-8 h-8 rounded-full flex items-center justify-center"
                  aria-label="Close search"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="btn-soft btn-sm gap-1 !px-2.5 sm:!px-3"
                aria-label="Open search"
              >
                <Search size={14} />
                <span className="hidden md:inline">Search</span>
              </button>
            )}

            <NavLink to="/settings" className="hidden lg:flex btn-soft btn-sm !px-2.5" aria-label="Settings">
              <Settings size={14} />
            </NavLink>

            {/* Mobile menu toggle button */}
            <button
              className="lg:hidden btn-soft btn-sm !px-2.5 w-9 h-9 flex items-center justify-center rounded-full"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl z-10 flex flex-col overflow-y-auto animate-slide-up">
            {/* Drawer Header */}
            <div className="p-4 border-b border-hairline-soft flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-ink" />
                <span className="font-bold text-ink text-sm">MPLADS HARBINGER</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="btn-soft btn-sm !p-0 w-8 h-8 rounded-full flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mobile Search Bar */}
            <div className="p-4 border-b border-hairline-soft">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    className="input text-sm h-10 w-full pl-9 pr-3"
                    placeholder="Search projects, IDs, states…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ borderRadius: '12px' }}
                  />
                  <Search size={15} className="absolute left-3 top-3 text-muted pointer-events-none" />
                </div>
                <button type="submit" className="btn-primary btn-sm h-10 px-4">
                  Go
                </button>
              </form>
            </div>

            {/* Navigation links */}
            <div className="p-4 flex-1 flex flex-col gap-1.5">
              <p className="font-label text-muted uppercase tracking-wider px-3 mb-1">Navigation</p>
              {NAV_LINKS.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-3 rounded-2xl text-[14px] font-semibold no-underline transition-all
                     ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-canvas-soft'}`
                  }
                >
                  <div className="flex items-center gap-3">
                    <link.icon size={18} />
                    <span>{link.label}</span>
                  </div>
                  <ChevronRight size={15} className="opacity-40" />
                </NavLink>
              ))}

              <div className="my-2 border-t border-hairline-soft" />

              <p className="font-label text-muted uppercase tracking-wider px-3 mb-1">Tools & Config</p>
              <NavLink
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-3 rounded-2xl text-[14px] font-semibold no-underline
                   ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-canvas-soft'}`
                }
              >
                <div className="flex items-center gap-3">
                  <Settings size={18} />
                  <span>Settings & Weights</span>
                </div>
                <ChevronRight size={15} className="opacity-40" />
              </NavLink>
            </div>

            {/* Drawer Footer Notice */}
            <div className="p-4 bg-canvas-soft m-4 rounded-2xl border border-hairline-soft text-center">
              <p className="text-[11px] font-semibold text-ink">Smart India Hackathon 2026</p>
              <p className="text-[10px] text-muted mt-0.5">Team XYLOQ · Problem SIH26102</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
