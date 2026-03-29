import { useState, useEffect } from 'react'
import { Sun, Moon, CheckCircle2, Circle, Save } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import {
  isGoogleConfigured,
  isGoogleConnected,
  getGoogleEmail,
  connectGoogle,
  disconnectGoogle,
} from '../api/google'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'

function Section({ title, description, children }) {
  return (
    <section className="mb-0">
      <h2 className="text-sm font-semibold text-text-primary mb-1">{title}</h2>
      <p className="text-xs text-text-muted mb-4">{description}</p>
      {children}
    </section>
  )
}

function Divider() {
  return <div className="border-t border-border my-6" />
}

export default function Settings() {
  const { isDark, toggleTheme } = useTheme()
  const { toasts, toast, dismiss } = useToast()

  // Ares config
  const [aresHost,    setAresHost]    = useState(() => localStorage.getItem('ares_host')     || '')
  const [aresApiKey,  setAresApiKey]  = useState(() => localStorage.getItem('ares_api_key')  || '')
  const [raintoolHost, setRaintoolHost] = useState(
    () => localStorage.getItem('raintool_host') || 'https://hailstorm.frostdesigngroup.com'
  )

  // Google config
  const [googleClientId, setGoogleClientId] = useState(
    () => localStorage.getItem('google_client_id') || ''
  )
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected)
  const [googleEmail,     setGoogleEmail]     = useState(getGoogleEmail)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  // Refresh Google status whenever localStorage might change
  useEffect(() => {
    setGoogleConnected(isGoogleConnected())
    setGoogleEmail(getGoogleEmail())
  }, [])

  function saveAresConfig() {
    localStorage.setItem('ares_host',     aresHost.trim())
    localStorage.setItem('ares_api_key',  aresApiKey.trim())
    localStorage.setItem('raintool_host', raintoolHost.trim())
    toast.success('Ares configuration saved.')
  }

  function saveGoogleClientId() {
    localStorage.setItem('google_client_id', googleClientId.trim())
    toast.success('Google Client ID saved.')
  }

  function handleConnect() {
    setGoogleLoading(true)
    connectGoogle({
      onSuccess: ({ email }) => {
        setGoogleConnected(true)
        setGoogleEmail(email)
        setGoogleLoading(false)
        toast.success(`Connected as ${email || 'Google account'}`)
      },
      onError: (msg) => {
        setGoogleLoading(false)
        toast.error(msg)
      },
    })
  }

  function handleDisconnect() {
    disconnectGoogle()
    setGoogleConnected(false)
    setGoogleEmail(null)
    toast.info('Google account disconnected.')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-base font-semibold text-text-primary mb-6">Settings</h1>

        {/* ── Ares API ───────────────────────────────────────────────── */}
        <Section
          title="Ares API Configuration"
          description="Connect to your Ares server. All credentials are stored locally in your browser."
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Ares Host</label>
              <input
                className="input"
                placeholder="https://my-ares.example.com"
                value={aresHost}
                onChange={e => setAresHost(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Ares API Key</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••••••"
                value={aresApiKey}
                onChange={e => setAresApiKey(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Raintool Host</label>
              <input
                className="input"
                placeholder="https://hailstorm.frostdesigngroup.com"
                value={raintoolHost}
                onChange={e => setRaintoolHost(e.target.value)}
              />
            </div>
            <div className="flex items-start gap-2 mt-1">
              <button className="btn-primary" onClick={saveAresConfig}>
                <Save size={13} /> Save
              </button>
            </div>
            <p className="text-xs text-amber-400/80 mt-1">
              The Ares server must have CORS enabled (Access-Control-Allow-Origin) for browser
              requests to work.
            </p>
          </div>
        </Section>

        <Divider />

        {/* ── Google Account ─────────────────────────────────────────── */}
        <Section
          title="Google Account"
          description="Connect a Google account to enable Gmail and Drive integration (for future use)."
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Google Client ID</label>
              <input
                className="input"
                placeholder="123456789-abc.apps.googleusercontent.com"
                value={googleClientId}
                onChange={e => setGoogleClientId(e.target.value)}
              />
              <button className="btn-secondary mt-2" onClick={saveGoogleClientId}>
                <Save size={13} /> Save Client ID
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 mt-1">
              {googleConnected
                ? <CheckCircle2 size={14} className="text-emerald-400" />
                : <Circle       size={14} className="text-text-muted" />
              }
              <span className="text-xs text-text-muted">
                {googleConnected
                  ? `Connected${googleEmail ? ` as ${googleEmail}` : ''}`
                  : 'Not connected'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={handleConnect}
                disabled={googleLoading || !isGoogleConfigured()}
              >
                {googleLoading ? 'Connecting…' : googleConnected ? 'Reconnect' : 'Connect'}
              </button>
              {googleConnected && (
                <button className="btn-secondary" onClick={handleDisconnect}>
                  Disconnect
                </button>
              )}
            </div>

            <p className="text-xs text-text-muted">
              Access tokens expire after ~1 hour. You'll be asked to reconnect periodically.
            </p>
          </div>
        </Section>

        <Divider />

        {/* ── Theme ──────────────────────────────────────────────────── */}
        <Section
          title="Appearance"
          description="Choose your preferred color scheme."
        >
          <button className="btn-secondary" onClick={toggleTheme}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </Section>
      </div>

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
