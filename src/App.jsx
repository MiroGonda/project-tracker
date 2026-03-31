import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AccessProvider } from './context/AccessContext'
import Sidebar from './components/Sidebar'
import BoardPage from './pages/BoardPage'
import Settings from './pages/Settings'
import Admin from './pages/Admin'

export default function App() {
  return (
    <ThemeProvider>
      <AccessProvider>
        <BrowserRouter basename="/project-tracker">
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
        </BrowserRouter>
      </AccessProvider>
    </ThemeProvider>
  )
}
