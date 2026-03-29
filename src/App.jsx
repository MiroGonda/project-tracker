import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import Ares from './pages/Ares'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/project-tracker">
        <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-hidden">
            <Routes>
              <Route path="/"         element={<Ares />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
