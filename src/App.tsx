import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import { SearchPage } from './pages/SearchPage'
import { ResearchPage } from './pages/ResearchPage'
import { PipelinePage } from './pages/PipelinePage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { track } from './lib/analytics'

function PageTracker() {
  const location = useLocation()
  useEffect(() => {
    track('page_viewed', { path: location.pathname })
  }, [location.pathname])
  return null
}

function App() {
  return (
    <ErrorBoundary>
      <PageTracker />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<ErrorBoundary fallbackTitle="Search encountered an error"><SearchPage /></ErrorBoundary>} />
          <Route path="/research" element={<ErrorBoundary fallbackTitle="Research encountered an error"><ResearchPage /></ErrorBoundary>} />
          <Route path="/pipeline" element={<ErrorBoundary fallbackTitle="Pipeline encountered an error"><PipelinePage /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary fallbackTitle="Settings encountered an error"><SettingsPage /></ErrorBoundary>} />
        </Route>
        <Route path="/profile/:id" element={<ErrorBoundary fallbackTitle="Profile encountered an error"><ProfilePage /></ErrorBoundary>} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
