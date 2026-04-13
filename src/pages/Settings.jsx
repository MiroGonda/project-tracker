import { useState, useEffect } from 'react'
import { Sun, Moon, CheckCircle2, Circle, Eye, EyeOff, Layers, X, Settings as SettingsIcon, Plus, UserX } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAccess } from '../context/AccessContext'
import {
  isGoogleConnected,
  getGoogleEmail,
  connectGoogle,
  disconnectGoogle,
} from '../api/google'
import { listBoards, listRaintoolProjects } from '../api/phobos'
import { fetchBoardCustomFields, createCustomField } from '../api/trello'
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
      {description && <p className="text-xs text-text-muted mb-4">{description}</p>}
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
  const [rtProject, setRtProject] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`rt_project_${board.id}`) || 'null') } catch { return null }
  })
  const [rtProjects, setRtProjects] = useState([])
  const [rtLoading,  setRtLoading]  = useState(true)
  const [rtError,    setRtError]    = useState(null)

  useEffect(() => {
    listRaintoolProjects()
      .then(setRtProjects)
      .catch(e => setRtError(e.message))
      .finally(() => setRtLoading(false))
  }, [])

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
          <p className="text-xs font-medium text-text-primary">Raintool Project</p>
          <p className="text-[11px] text-text-muted">Source for Dashboard cycle time data.</p>
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

// ─── External User management (for Frost Users) ───────────────────────────────

function ExternalUserManager({ boardId, config, updateConfig }) {
  const [val, setVal] = useState('')
  const board = config?.boards?.[boardId]
  const extUsers = board?.externalUsers ?? []

  function add() {
    const v = val.trim().toLowerCase()
    if (!v || !v.includes('@') || extUsers.includes(v)) return
    const next = {
      ...config,
      boards: {
        ...config.boards,
        [boardId]: {
          ...board,
          externalUsers: [...extUsers, v],
          frostUsers: (board?.frostUsers ?? []).filter(u => u !== v),
        },
      },
    }
    updateConfig(next)
    setVal('')
  }

  function remove(addr) {
    const next = {
      ...config,
      boards: {
        ...config.boards,
        [boardId]: { ...board, externalUsers: extUsers.filter(u => u !== addr) },
      },
    }
    updateConfig(next)
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-[10px] font-medium text-amber-400 flex items-center gap-1 mb-2">
        <UserX size={10} /> External Users
        <span className="text-text-muted font-normal ml-1">— board access only</span>
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {extUsers.length === 0
          ? <p className="text-xs text-text-muted italic">None assigned.</p>
          : extUsers.map(u => (
              <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400">
                {u}
                <button onClick={() => remove(u)} className="hover:text-red-400 transition-colors"><X size={10} /></button>
              </span>
            ))
        }
      </div>
      <div className="flex gap-2">
        <input className="input text-xs py-1 flex-1" placeholder="external@example.com" value={val}
          onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn-secondary py-1 text-xs" onClick={add}><Plus size={11} /> Add</button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { isDark, toggleTheme }    = useTheme()
  const { refreshEmail, admin, getBoardRole, accessibleIds, config, updateConfig, email, loading: configLoading } = useAccess()
  const { toasts, toast, dismiss } = useToast()

  // Google auth
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected)
  const [googleEmail,     setGoogleEmail]     = useState(getGoogleEmail)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  // Per-board integrations modal
  const [integrationsFor, setIntegrationsFor] = useState(null)

  // Board visibility
  const [allBoards, setAllBoards] = useState([])
  const [hiddenIds, setHiddenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hidden_board_ids') || '[]')) }
    catch { return new Set() }
  })

  // Pass Tracking
  const [passConfig,       setPassConfig]       = useState(() => getPassTrackingConfig())
  const [passSetupLoading, setPassSetupLoading] = useState(new Set())

  // Trello credentials (needed for Pass Tracking setup — read from storage, editable here)
  const trelloApiKey = localStorage.getItem('trello_api_key') || ''
  const trelloToken  = localStorage.getItem('trello_token')   || ''

  useEffect(() => {
    setGoogleConnected(isGoogleConnected())
    setGoogleEmail(getGoogleEmail())
  }, [])

  useEffect(() => {
    if (configLoading) return
    const host = localStorage.getItem('phobos_host')   || localStorage.getItem('ares_host')
    const key  = localStorage.getItem('phobos_api_key') || localStorage.getItem('ares_api_key')
    if (!host || !key) return
    listBoards().then(boards => {
      const seen = new Set()
      setAllBoards(boards.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true }))
    }).catch(() => {})
  }, [configLoading])

  // Boards this user can configure (admin sees all, frost sees their boards)
  const configurableBoards = admin
    ? allBoards
    : allBoards.filter(b => { const r = getBoardRole(b.id); return r === 'frost' || r === 'admin' })

  // External Users can't access Settings at all — they have no role that allows it
  const hasSettingsAccess = !email   // unauthenticated (bootstrap)
    || admin
    || [...accessibleIds].some(id => { const r = getBoardRole(id); return r === 'frost' || r === 'admin' })

  function toggleBoardHidden(id) {
    setHiddenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem('hidden_board_ids', JSON.stringify([...next]))
      return next
    })
  }

  function handleConnect() {
    setGoogleLoading(true)
    connectGoogle({
      onSuccess: ({ email: e }) => {
        setGoogleConnected(true); setGoogleEmail(e); setGoogleLoading(false)
        refreshEmail()
        toast.success(`Connected as ${e || 'Google account'}`)
      },
      onError: (msg) => { setGoogleLoading(false); toast.error(msg) },
    })
  }

  function handleDisconnect() {
    disconnectGoogle(); setGoogleConnected(false); setGoogleEmail(null)
    refreshEmail()
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

  // Wait for config to load before checking access
  if (configLoading) return null

  if (email && !hasSettingsAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
        <p className="text-sm">Settings are not available for your account.</p>
        <p className="text-xs">Contact your admin if you need access.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-base font-semibold text-text-primary mb-6">Settings</h1>

        {/* ── Google Auth ── */}
        <Section
          title="Google Account"
          description="Sign in with Google to access your boards."
        >
          <div className="flex flex-col gap-3">
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
                disabled={googleLoading}>
                {googleLoading ? 'Connecting…' : googleConnected ? 'Reconnect' : 'Connect'}
              </button>
              {googleConnected && (
                <button className="btn-secondary" onClick={handleDisconnect}>Disconnect</button>
              )}
            </div>
          </div>
        </Section>

        <Divider />

        {/* ── Board Configuration ── */}
        <Section
          title="Board Configuration"
          description={admin
            ? "Per-board settings, visibility, and integrations."
            : "Configure integrations for your assigned boards."
          }
        >
          {configurableBoards.length === 0 ? (
            <p className="text-xs text-text-muted italic">
              {allBoards.length === 0
                ? 'No boards found. Check your Phobos connection in Admin.'
                : 'No boards assigned to your account.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {configurableBoards.map(b => {
                const hidden      = hiddenIds.has(b.id)
                const passEnabled = !!passConfig[b.id]?.enabled
                const passLoading = passSetupLoading.has(b.id)
                const canEnablePass = !!(trelloApiKey && trelloToken)
                const rtProj   = (() => { try { return JSON.parse(localStorage.getItem(`rt_project_${b.id}`) || 'null') } catch { return null } })()
                const hasIntegrations = !!rtProj
                const isFrost = !admin && getBoardRole(b.id) === 'frost'
                return (
                  <div key={b.id} className={`rounded-lg border transition-colors ${hidden ? 'border-border/50 opacity-50' : 'border-border bg-white/[0.02]'}`}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-text-primary truncate">{b.name || b.id}</span>
                        {hidden && <span className="text-[10px] text-text-muted">Hidden</span>}
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        {/* Pass Tracking — admin only (requires Trello credentials) */}
                        {admin && (
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
                              : 'Save Trello credentials in Admin first'
                            }
                          >
                            <Layers size={10} />
                            {passLoading ? '…' : 'Passes'}
                          </button>
                        )}
                        {/* Integrations cog */}
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
                        {/* Hide toggle — admin only */}
                        {admin && (
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
                        )}
                      </div>
                    </div>
                    {/* Frost User: External User management */}
                    {isFrost && config && (
                      <div className="px-3 pb-3">
                        <ExternalUserManager boardId={b.id} config={config} updateConfig={updateConfig} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        <Divider />

        {/* ── Appearance ── */}
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
