import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import { ToastContainer, LoadingState } from './components/UI'
import LandingPage from './pages/LandingPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const RiskQueuePage = lazy(() => import('./pages/RiskQueuePage'))
const ProjectInvestigationPage = lazy(() => import('./pages/ProjectInvestigationPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CSVAnalyzerPage = lazy(() => import('./pages/CSVAnalyzerPage'))

// Lazy stub pages for non-critical pages
const ReportsPage = () => (
  <div className="container py-20 text-center max-w-lg mx-auto">
    <p className="font-heading-3 text-ink mb-3">Reports & Data Export</p>
    <p className="text-muted text-sm sm:text-base mb-6 leading-relaxed">
      Automated executive briefing and summary report generation is currently in development. Full operational project records, risk levels, and component scores are available for immediate CSV export.
    </p>
    <a href="/api/export/projects" className="btn-primary inline-flex items-center gap-2" download>
      Export Project Dataset (CSV)
    </a>
  </div>
)

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Suspense fallback={<div className="container py-20"><LoadingState label="Loading page…" /></div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/risk-queue" element={<RiskQueuePage />} />
              <Route path="/project/:id" element={<ProjectInvestigationPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/audit" element={<AuditLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/csv-analyzer" element={<CSVAnalyzerPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <ToastContainer />
      </div>
    </BrowserRouter>
  )
}

export default App
