import { useState, useEffect } from 'react'
import { Sun, Moon, CheckCircle2, Circle, Eye, EyeOff, Layers, X, Settings as SettingsIcon, Plus, UserX, Calendar, Clock, Link2 } from 'lucide-react'
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
import { saveUserPrefs } from '../api/userPrefs'
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

function ConfigSection({ icon: Icon, title, description, accent = 'text-text-muted', children }) {
  return (
    <div className="rounded-lg border border-border bg-bg/40 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className={accent} />
        <h4 className="text-xs font-semibold text-text-primary">{title}</h4>
      </div>
      {description && <p className="text-[11px] text-text-muted mb-3">{description}</p>}
      <div className={description ? '' : 'mt-2'}>{children}</div>
    </div>
  )
}

function BoardConfigModal({
  board, admin, isFrost, config, updateConfig, onClose,
  passConfig, canEnablePass, passLoading, onSetupPassTracking, onDisablePassTracking,
}) {
  const boardCfg = config?.boards?.[board.id] || {}
  const passEnabled = !!passConfig[board.id]?.enabled

  // Raintool project state
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

  function setBoardField(field, value) {
    if (!config) return
    const boards = { ...config.boards }
    boards[board.id] = { ...boards[board.id], [field]: value }
    updateConfig({ ...config, boards })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl w-[560px] max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-semibold text-text-primary">Board Configuration</h3>
            <p className="text-[11px] text-text-muted mt-0.5 truncate">{board.name || board.id}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">

          {/* ── Project Dates ── */}
          {admin && (
            <ConfigSection
              icon={Calendar}
              title="Project Dates"
              description="Used to compute duration, remaining days, and progress in the Timeline tab."
              accent="text-cyan-400"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
                  Start
                  <input type="date" className="input text-xs py-1 w-36"
                    value={boardCfg.startDate || ''}
                    onChange={e => setBoardField('startDate', e.target.value || null)}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
                  End
                  <input type="date" className="input text-xs py-1 w-36"
                    value={boardCfg.endDate || ''}
                    onChange={e => setBoardField('endDate', e.target.value || null)}
                  />
                </label>
                {(boardCfg.startDate || boardCfg.endDate) && (
                  <button onClick={() => {
                    if (!config) return
                    const boards = { ...config.boards }
                    boards[board.id] = { ...boards[board.id], startDate: null, endDate: null }
                    updateConfig({ ...config, boards })
                  }}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors ml-auto">Clear</button>
                )}
              </div>
            </ConfigSection>
          )}

          {/* ── SLA ── */}
          {admin && (
            <ConfigSection
              icon={Clock}
              title="SLA"
              description="Service-level agreement target, in days."
              accent="text-amber-400"
            >
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" step="1"
                  className="input text-xs py-1 w-24"
                  value={boardCfg.slaDays ?? ''}
                  onChange={e => {
                    const v = e.target.value
                    setBoardField('slaDays', v === '' ? null : Math.max(0, parseInt(v, 10) || 0))
                  }}
                  placeholder="—"
                />
                <span className="text-xs text-text-muted">days</span>
                {boardCfg.slaDays != null && (
                  <button onClick={() => setBoardField('slaDays', null)}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors ml-auto">Clear</button>
                )}
              </div>
            </ConfigSection>
          )}

          {/* ── Pass Tracking ── */}
          {admin && (
            <ConfigSection
              icon={Layers}
              title="Pass Tracking"
              description="Adds 1st / 2nd / 3rd Pass date fields to every card on this board via Trello."
              accent={passEnabled ? 'text-emerald-400' : 'text-text-muted'}
            >
              <div className="flex items-center gap-2">
                <button
                  disabled={passLoading || (!passEnabled && !canEnablePass)}
                  onClick={() => passEnabled ? onDisablePassTracking(board.id) : onSetupPassTracking(board.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                    passEnabled
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'border-border text-text-muted hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {passLoading
                    ? 'Setting up…'
                    : passEnabled
                      ? <><CheckCircle2 size={11} /> Enabled — click to disable</>
                      : <>Enable Pass Tracking</>
                  }
                </button>
                {!passEnabled && !canEnablePass && (
                  <span className="text-[10px] text-text-muted/70 italic">Trello credentials missing</span>
                )}
              </div>
            </ConfigSection>
          )}

          {/* ── Integrations: Raintool ── */}
          <ConfigSection
            icon={Link2}
            title="Integrations"
            description="Raintool project — source for Dashboard cycle time data."
            accent="text-indigo-400"
          >
            <ProjectPicker
              projects={rtProjects} loading={rtLoading} error={rtError}
              selected={rtProject} onSelect={selectRt} onClear={() => selectRt(null)}
              clearLabel="— No project selected"
            />
          </ConfigSection>

          {/* ── External Users (admin + frost) ── */}
          {(admin || isFrost) && config && (
            <ConfigSection
              icon={UserX}
              title="External User Invitations"
              description="Grant view-only access to people outside Frost (e.g. clients)."
              accent="text-amber-400"
            >
              <ExternalUserManager boardId={board.id} config={config} updateConfig={updateConfig} flat />
            </ConfigSection>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="btn-secondary text-xs">Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── External User management (for Frost Users) ───────────────────────────────

function ExternalUserManager({ boardId, config, updateConfig, flat = false }) {
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
    <div className={flat ? '' : 'mt-3 pt-3 border-t border-border/50'}>
      {!flat && (
        <p className="text-[10px] font-medium text-amber-400 flex items-center gap-1 mb-2">
          <UserX size={10} /> External Users
          <span className="text-text-muted font-normal ml-1">— board access only</span>
        </p>
      )}
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
  const { refreshEmail, admin, getBoardRole, accessibleIds, config, updateConfig, email, loading: configLoading, hiddenIds, toggleBoardHidden } = useAccess()
  const { toasts, toast, dismiss } = useToast()

  // Google auth
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected)
  const [googleEmail,     setGoogleEmail]     = useState(getGoogleEmail)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  // Per-board configuration modal
  const [configFor, setConfigFor] = useState(null)

  // Board visibility
  const [allBoards, setAllBoards] = useState([])

  // Pass Tracking
  const [passConfig,       setPassConfig]       = useState(() => getPassTrackingConfig())
  const [passSetupLoading, setPassSetupLoading] = useState(new Set())

  // Trello credentials — read from localStorage (seeded by AccessContext) or directly from config
  const trelloApiKey = localStorage.getItem('trello_api_key') || config?.services?.trelloApiKey || ''
  const trelloToken  = localStorage.getItem('trello_token')   || config?.services?.trelloToken  || ''

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

  // toggleBoardHidden and hiddenIds are provided by AccessContext

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
      saveUserPrefs(email, { passTracking: next }).catch(() => {})
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
    saveUserPrefs(email, { passTracking: next }).catch(() => {})
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
                const bcfg        = config?.boards?.[b.id] || {}
                const hasDates    = !!(bcfg.startDate || bcfg.endDate)
                const hasSla      = bcfg.slaDays != null
                const rtProj      = (() => { try { return JSON.parse(localStorage.getItem(`rt_project_${b.id}`) || 'null') } catch { return null } })()
                const hasIntegrations = !!rtProj
                const isFrost = !admin && getBoardRole(b.id) === 'frost'
                const hasAny = hasDates || hasSla || passEnabled || hasIntegrations
                return (
                  <div key={b.id} className={`rounded-lg border transition-colors ${hidden ? 'border-border/50 opacity-50' : 'border-border bg-white/[0.02] hover:bg-white/[0.03]'}`}>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex flex-col min-w-0 flex-1 pr-3">
                        <span className="text-xs font-medium text-text-primary truncate">{b.name || b.id}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {hasDates       && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center gap-1"><Calendar size={8} /> Dates</span>}
                          {hasSla         && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex items-center gap-1"><Clock size={8} /> SLA {bcfg.slaDays}d</span>}
                          {passEnabled    && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1"><Layers size={8} /> Passes</span>}
                          {hasIntegrations && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center gap-1"><Link2 size={8} /> Raintool</span>}
                          {hidden         && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-text-muted">Hidden</span>}
                          {!hasAny && !hidden && <span className="text-[9px] text-text-muted/40 italic">Not configured</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setConfigFor(b)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                          title="Configure this board"
                        >
                          <SettingsIcon size={11} />
                          Configure
                        </button>
                        {/* Hide toggle — admin only */}
                        {admin && (
                          <button
                            onClick={() => toggleBoardHidden(b.id)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              hidden
                                ? 'border-border text-text-muted hover:bg-white/5'
                                : 'border-border text-text-muted hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5'
                            }`}
                            title={hidden ? 'Show in sidebar' : 'Hide from sidebar'}
                          >
                            {hidden ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>
                        )}
                      </div>
                    </div>
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

      {configFor && (() => {
        const isFrost = !admin && getBoardRole(configFor.id) === 'frost'
        const canEnablePass = !!(trelloApiKey && trelloToken)
        return (
          <BoardConfigModal
            board={configFor}
            admin={admin}
            isFrost={isFrost}
            config={config}
            updateConfig={updateConfig}
            onClose={() => setConfigFor(null)}
            passConfig={passConfig}
            canEnablePass={canEnablePass}
            passLoading={passSetupLoading.has(configFor.id)}
            onSetupPassTracking={handleSetupPassTracking}
            onDisablePassTracking={handleDisablePassTracking}
          />
        )
      })()}
    </div>
  )
}
