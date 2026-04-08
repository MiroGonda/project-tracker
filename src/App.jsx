import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AccessProvider, useAccess } from './context/AccessContext'
import Sidebar from './components/Sidebar'
import BoardPage from './pages/BoardPage'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import LoginPage from './pages/LoginPage'

function AppShell() {
  const { email, refreshEmail } = useAccess()
  const location = useLocation()

  // Settings is always reachable — needed to configure the Google Client ID
  // before a user can sign in for the first time.
  const isSettings = location.pathname === '/settings'

  if (!email && !isSettings) {
    return <LoginPage onLogin={refreshEmail} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden">
        <Routes>
          <Route path="/board/:boardId" element={<BoardPage />} />
          <Route path="/settings"       element={<Settings />} />
          <Route path="/admin"          element={<Admin />} />
          <Route path="*"               element={<Navigate to="/settings" replace />} />
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
