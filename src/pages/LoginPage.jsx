import { useState } from 'react'
import { Settings } from 'lucide-react'
import { connectGoogle, isGoogleConfigured } from '../api/google'
import Spinner from '../components/Spinner'

export default function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const configured = isGoogleConfigured()

  function handleSignIn() {
    setError(null)
    setLoading(true)
    connectGoogle({
      onSuccess: () => { setLoading(false); onLogin() },
      onError:   msg => { setLoading(false); setError(msg) },
    })
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg gap-8 px-4">
      {/* Brand */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.35" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Project Tracker</h1>
        <p className="text-sm text-text-muted max-w-xs">
          Sign in to access your project dashboards.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
        {!configured ? (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
              A Google Client ID must be configured before signing in.
            </p>
            <a
              href="settings"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-border text-sm text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors"
            >
              <Settings size={14} /> Go to Settings
            </a>
          </div>
        ) : (
          <>
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="flex items-center justify-center gap-3 w-full py-2.5 rounded-lg bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-60 shadow-sm"
            >
              {loading ? (
                <Spinner size={16} className="text-gray-500" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
                </svg>
              )}
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </button>

            {error && (
              <p className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-text-muted/50 text-center max-w-xs">
        Access is managed by your admin. Contact them if you need to be added.
      </p>
    </div>
  )
}
