import { useState, useEffect } from 'react'
import { Sun, Moon, CheckCircle2, Circle, Save, Eye, EyeOff, Key, Layers, X, Settings as SettingsIcon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAccess } from '../context/AccessContext'
import {
  isGoogleConfigured,
  isGoogleConnected,
  getGoogleEmail,
  connectGoogle,
  disconnectGoogle,
} from '../api/google'
import { listBoards, listRaintoolProjects } from '../api/ares'
import { fetchBoardCustomFields, createCustomField } from '../api/trello'
import { getRunnProjects, isUtilApiConfigured } from '../api/runn'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import Spinner from '../components/Spinner'

// ─── Pass Tracking helpers ────────────────────────────────────────────────────

const PASS_STORAGE_KEY = 'pass_tracking'
const PASS_NAMES = { first: 'First Pass', second: 'Second Pass', third: 'Third Pass' }

export function getPassTrackingConfig() {
  try { return JSON.parse(localStorage.getItem(PASS_STORAGE_KEY) || '{}') } catch { return {} }
}

export function getPassConfigForBoard(boardId) {
  return getPassTrackingConfig()[boardId] || null
}

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

// ─── Project picker ───────────────────────────────────────────────────────────

function ProjectPicker({ projects, loading, error, selected, onSelect, onClear, clearLabel }) {
  const [search, setSearch] = useState('')
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="flex flex-col gap-2">
      {selected ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-white/[0.03] text-xs">
          <span className="text-text-primary font-medium truncate">{selected.name}</span>
          <button onClick={onClear} className="ml-2 text-text-muted hover:text-text-primary transition-colors shrink-0">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            className="input text-xs"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-40">
            {loading && <div className="flex items-center gap-2 py-3 text-text-muted text-xs"><Spinner size={12} /> Loading…</div>}
            {error   && <p className="text-xs text-red-400 px-1 py-1">{error}</p>}
            {!loading && !error && (
              <>
                <button onClick={onClear}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-text-muted hover:bg-white/5 transition-colors">
                  {clearLabel}
                </button>
                {filtered.length === 0 && search && (
                  <p className="text-xs text-text-muted/50 px-2 py-1">No matches.</p>
                )}
                {filtered.map(p => (
                  <button key={p.id} onClick={() => onSelect(p)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors">
                    {p.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Per-board integrations modal ─────────────────────────────────────────────

function BoardIntegrationsModal({ board, onClose }) {
  const [runnProject, setRunnProject] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`runn_project_${board.id}`) || 'null') } catch { return null }
  })
  const [rtProject, setRtProject] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`rt_project_${board.id}`) || 'null') } catch { return null }
  })
  const [runnProjects, setRunnProjects] = useState([])
  const [rtProjects,   setRtProjects]   = useState([])
  const [runnLoading,  setRunnLoading]  = useState(true)
  const [rtLoading,    setRtLoading]    = useState(true)
  const [runnError,    setRunnError]    = useState(null)
  const [rtError,      setRtError]      = useState(null)

  useEffect(() => {
    getRunnProjects()
      .then(setRunnProjects)
      .catch(e => setRunnError(e.response?.data?.detail || e.message))
      .finally(() => setRunnLoading(false))
    listRaintoolProjects()
      .then(setRtProjects)
      .catch(e => setRtError(e.message))
      .finally(() => setRtLoading(false))
  }, [])

  function selectRunn(p) {
    setRunnProject(p)
    if (p) localStorage.setItem(`runn_project_${board.id}`, JSON.stringify(p))
    else   localStorage.removeItem(`runn_project_${board.id}`)
  }

  function selectRt(p) {
    setRtProject(p)
    if (p) localStorage.setItem(`rt_project_${board.id}`, JSON.stringify(p))
    else   localStorage.removeItem(`rt_project_${board.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl p-5 w-[460px] flex flex-col gap-5 shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Integrations</h3>
            <p className="text-[11px] text-text-muted mt-0.5 truncate">{board.name || board.id}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors ml-4 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-text-primary">Runn Project</p>
          <p className="text-[11px] text-text-muted">Scopes the Utilization report to this project.</p>
          <ProjectPicker
            projects={runnProjects} loading={runnLoading} error={runnError}
            selected={runnProject} onSelect={selectRunn} onClear={() => selectRunn(null)}
            clearLabel="— All projects (org-wide)"
          />
        </div>

        <div className="border-t border-border/60" />

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-text-primary">Raintool Project</p>
          <p className="text-[11px] text-text-muted">Source for Utilization actuals and Dashboard cycle time.</p>
          <ProjectPicker
            projects={rtProjects} loading={rtLoading} error={rtError}
            selected={rtProject} onSelect={selectRt} onClear={() => selectRt(null)}
            clearLabel="— No project selected"
          />
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { isDark, toggleTheme }   = useTheme()
  const { refreshEmail }          = useAccess()
  const { toasts, toast, dismiss } = useToast()

  // Ares config
  const [aresHost,     setAresHost]     = useState(() => localStorage.getItem('ares_host')     || '')
  const [aresApiKey,   setAresApiKey]   = useState(() => localStorage.getItem('ares_api_key')  || '')
  const [raintoolHost, setRaintoolHost] = useState(
    () => localStorage.getItem('raintool_host') || 'https://hailstorm.frostdesigngroup.com'
  )
  const [trelloApiKey,   setTrelloApiKey]   = useState(() => localStorage.getItem('trello_api_key')   || '')
  const [trelloToken,    setTrelloToken]    = useState(() => localStorage.getItem('trello_token')     || '')
  const [runnApiKey,     setRunnApiKey]     = useState(() => localStorage.getItem('runn_api_key')     || '')
  const [utilApiUrl,     setUtilApiUrl]     = useState(() => localStorage.getItem('util_api_url')     || '')

  // Per-board integrations modal
  const [integrationsFor, setIntegrationsFor] = useState(null) // board object or null

  // Board visibility
  const [allBoards,    setAllBoards]    = useState([])
  const [hiddenIds,    setHiddenIds]    = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hidden_board_ids') || '[]')) }
    catch { return new Set() }
  })

  // Google config
  const [googleClientId,  setGoogleClientId]  = useState(() => localStorage.getItem('google_client_id') || '')
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected)
  const [googleEmail,     setGoogleEmail]     = useState(getGoogleEmail)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  // Pass Tracking
  const [passConfig,       setPassConfig]       = useState(() => getPassTrackingConfig())
  const [passSetupLoading, setPassSetupLoading] = useState(new Set()) // set of boardIds currently setting up

  useEffect(() => {
    setGoogleConnected(isGoogleConnected())
    setGoogleEmail(getGoogleEmail())
  }, [])

  useEffect(() => {
    const host = localStorage.getItem('ares_host')
    const key  = localStorage.getItem('ares_api_key')
    if (!host || !key) return
    listBoards().then(boards => {
      const seen = new Set()
      setAllBoards(boards.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true }))
    }).catch(() => {})
  }, [])

  function toggleBoardHidden(id) {
    setHiddenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem('hidden_board_ids', JSON.stringify([...next]))
      return next
    })
  }

  function saveAresConfig() {
    localStorage.setItem('ares_host',      aresHost.trim())
    localStorage.setItem('ares_api_key',   aresApiKey.trim())
    localStorage.setItem('raintool_host',  raintoolHost.trim())
    localStorage.setItem('trello_api_key', trelloApiKey.trim())
    localStorage.setItem('trello_token',   trelloToken.trim())
    localStorage.setItem('runn_api_key',   runnApiKey.trim())
    localStorage.setItem('util_api_url',   utilApiUrl.trim())
    toast.success('Configuration saved.')
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
        refreshEmail()   // notify AccessContext so board/admin visibility updates
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
    refreshEmail()       // notify AccessContext
    toast.info('Google account disconnected.')
  }

  async function handleSetupPassTracking(boardId) {
    setPassSetupLoading(prev => new Set([...prev, boardId]))
    try {
      const existing = await fetchBoardCustomFields(boardId)
      const fieldIds = {}
      for (const [key, name] of Object.entries(PASS_NAMES)) {
        const found = existing.find(f => f.name === name && f.type === 'date')
        fieldIds[key] = found ? found.id : (await createCustomField(boardId, name)).id
      }
      const next = { ...getPassTrackingConfig(), [boardId]: { enabled: true, fieldIds } }
      localStorage.setItem(PASS_STORAGE_KEY, JSON.stringify(next))
      setPassConfig(next)
      toast.success('Pass tracking enabled.')
    } catch (e) {
      toast.error(`Setup failed: ${e.message}`)
    } finally {
      setPassSetupLoading(prev => { const s = new Set(prev); s.delete(boardId); return s })
    }
  }

  function handleDisablePassTracking(boardId) {
    const next = { ...getPassTrackingConfig() }
    delete next[boardId]
    localStorage.setItem(PASS_STORAGE_KEY, JSON.stringify(next))
    setPassConfig(next)
    toast.info('Pass tracking disabled for board.')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-base font-semibold text-text-primary mb-6">Settings</h1>

        {/* ── Ares API */}
        <Section
          title="Ares API Configuration"
          description="Connect to your Ares server. All credentials are stored locally in your browser."
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Ares Host</label>
              <input className="input" placeholder="https://my-ares.example.com"
                value={aresHost} onChange={e => setAresHost(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Ares API Key</label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={aresApiKey} onChange={e => setAresApiKey(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Raintool Host</label>
              <input className="input" placeholder="https://hailstorm.frostdesigngroup.com"
                value={raintoolHost} onChange={e => setRaintoolHost(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                <Key size={11} /> Trello API Key
              </label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={trelloApiKey} onChange={e => setTrelloApiKey(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                <Key size={11} /> Trello Token
              </label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={trelloToken} onChange={e => setTrelloToken(e.target.value)} />
              <p className="text-xs text-text-muted mt-1">
                Generate at: <code className="text-accent">trello.com/1/authorize?expiration=never&amp;scope=read,write&amp;response_type=token&amp;key=YOUR_KEY</code>
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1">
                <Key size={11} /> Runn API Key
              </label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={runnApiKey} onChange={e => setRunnApiKey(e.target.value)} />
              <p className="text-xs text-text-muted mt-1">
                Found under <strong>Settings → API</strong> in your Runn app (admin only).
                Forwarded to the backend as <code className="text-accent">X-Runn-Api-Key</code> — overrides the server <code className="text-accent">.env</code> value.
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Utilization API URL</label>
              <input className="input" placeholder="http://localhost:8765"
                value={utilApiUrl} onChange={e => setUtilApiUrl(e.target.value)} />
              <p className="text-xs text-text-muted mt-1">
                Base URL of the utilization backend (run <code className="text-accent">uvicorn main:app --port 8765</code> in <code className="text-accent">server/</code>).
              </p>
            </div>
            <button className="btn-primary w-fit" onClick={saveAresConfig}>
              <Save size={13} /> Save
            </button>
            <p className="text-xs text-amber-400/80">
              The Ares server must have CORS enabled for browser requests to work.
            </p>
          </div>
        </Section>

        <Divider />

        {/* ── Google Account */}
        <Section
          title="Google Account"
          description="Connect a Google account to enable Gmail and Drive integration."
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Google Client ID</label>
              <input className="input" placeholder="123456789-abc.apps.googleusercontent.com"
                value={googleClientId} onChange={e => setGoogleClientId(e.target.value)} />
              <button className="btn-secondary mt-2" onClick={saveGoogleClientId}>
                <Save size={13} /> Save Client ID
              </button>
            </div>
            <div className="flex items-center gap-2">
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
              <button className="btn-primary" onClick={handleConnect}
                disabled={googleLoading || !isGoogleConfigured()}>
                {googleLoading ? 'Connecting…' : googleConnected ? 'Reconnect' : 'Connect'}
              </button>
              {googleConnected && (
                <button className="btn-secondary" onClick={handleDisconnect}>Disconnect</button>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Access tokens expire after ~1 hour. You\'ll be asked to reconnect periodically.
            </p>
          </div>
        </Section>

        <Divider />

        {/* ── Board Configuration */}
        {allBoards.length > 0 && (
          <>
            <Divider />
            <Section
              title="Board Configuration"
              description="Per-board settings: visibility and feature toggles."
            >
              <div className="flex flex-col gap-1.5">
                {allBoards.map(b => {
                  const hidden      = hiddenIds.has(b.id)
                  const passEnabled = !!passConfig[b.id]?.enabled
                  const passLoading = passSetupLoading.has(b.id)
                  const canEnablePass = !!(trelloApiKey && trelloToken)
                  const runnProj = (() => { try { return JSON.parse(localStorage.getItem(`runn_project_${b.id}`) || 'null') } catch { return null } })()
                  const rtProj   = (() => { try { return JSON.parse(localStorage.getItem(`rt_project_${b.id}`)   || 'null') } catch { return null } })()
                  const hasIntegrations = !!(runnProj || rtProj)
                  return (
                    <div key={b.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${hidden ? 'border-border/50 opacity-50' : 'border-border bg-white/[0.02]'}`}>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-text-primary truncate">{b.name || b.id}</span>
                        {hidden && <span className="text-[10px] text-text-muted">Hidden</span>}
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        {/* Pass Tracking toggle */}
                        <button
                          disabled={passLoading || (!passEnabled && !canEnablePass)}
                          onClick={() => passEnabled ? handleDisablePassTracking(b.id) : handleSetupPassTracking(b.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                            passEnabled
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10'
                              : 'border-border text-text-muted hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                          title={
                            passLoading ? 'Setting up…'
                            : passEnabled ? 'Disable pass tracking'
                            : canEnablePass ? 'Enable pass tracking'
                            : 'Save Trello credentials first'
                          }
                        >
                          <Layers size={10} />
                          {passLoading ? '…' : 'Passes'}
                        </button>
                        {/* Integrations cog */}
                        {isUtilApiConfigured() && (
                          <button
                            onClick={() => setIntegrationsFor(b)}
                            className={`p-1.5 rounded-lg border text-[10px] transition-colors ${
                              hasIntegrations
                                ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10'
                                : 'border-border text-text-muted hover:bg-white/5'
                            }`}
                            title={hasIntegrations ? 'Edit integrations' : 'Configure integrations'}
                          >
                            <SettingsIcon size={11} />
                          </button>
                        )}
                        {/* Hide toggle */}
                        <button
                          onClick={() => toggleBoardHidden(b.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                            hidden
                              ? 'border-border text-text-muted hover:bg-white/5'
                              : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                          }`}
                          title={hidden ? 'Show in sidebar' : 'Hide from sidebar'}
                        >
                          {hidden ? <Eye size={10} /> : <EyeOff size={10} />}
                          {hidden ? 'Show' : 'Hide'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
        )}

        <Divider />

        {/* ── Theme */}
        <Section title="Appearance" description="Choose your preferred color scheme.">
          <button className="btn-secondary" onClick={toggleTheme}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </Section>
      </div>

      <Toast toasts={toasts} dismiss={dismiss} />

      {integrationsFor && (
        <BoardIntegrationsModal
          board={integrationsFor}
          onClose={() => setIntegrationsFor(null)}
        />
      )}
    </div>
  )
}
