import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AccessProvider, useAccess } from './context/AccessContext'
import Sidebar from './components/Sidebar'
import BoardPage from './pages/BoardPage'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import LoginPage from './pages/LoginPage'

function AppShell() {
  const { email, refreshEmail, admin, canAdmin, getBoardRole, accessibleIds, loading } = useAccess()
  const location = useLocation()

  const isSettings = location.pathname === '/settings'

  // Wait for Firebase Auth + Firestore config to resolve before rendering
  if (loading) return null

  if (!email && !isSettings) {
    return <LoginPage onLogin={refreshEmail} />
  }

  // Default redirect: go to settings if logged in, otherwise first accessible board
  const defaultRedirect = email
    ? '/settings'
    : accessibleIds.size > 0 ? `/board/${[...accessibleIds][0]}` : '/settings'

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/board/:boardId" element={<BoardPage />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="/admin"          element={canAdmin ? <Admin /> : <Navigate to={defaultRedirect} replace />} />
          <Route path="*"               element={<Navigate to={defaultRedirect} replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AccessProvider>
        <BrowserRouter basename="/project-tracker" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppShell />
        </BrowserRouter>
      </AccessProvider>
    </ThemeProvider>
  )
}
