import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import { ToastContainer } from './components/UI'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import RiskQueuePage from './pages/RiskQueuePage'
import ProjectInvestigationPage from './pages/ProjectInvestigationPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ReviewsPage from './pages/ReviewsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'

// Lazy stub pages for non-critical pages
const ReportsPage = () => (
  <div className="container py-20 text-center">
    <p className="font-heading-3 text-ink mb-4">Reports</p>
    <p className="text-muted mb-6">Report generation coming soon. Use CSV export for now.</p>
    <a href="/api/export/projects" className="btn-primary">Export Full Dataset</a>
  </div>
)

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
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
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <ToastContainer />
      </div>
    </BrowserRouter>
  )
}

export default App
