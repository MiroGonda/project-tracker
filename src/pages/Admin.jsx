import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, Plus, Trash2, LayoutDashboard,
  Download, Upload, RefreshCw, AlertTriangle, Check, X, AlertCircle,
  Key, Save, Sun, Moon, CheckCircle2, Circle, UserCheck, UserX,
} from 'lucide-react'
import { useAccess } from '../context/AccessContext'
import { useTheme } from '../context/ThemeContext'
import { listBoards } from '../api/ares'
import {
  isGoogleConfigured, isGoogleConnected, getGoogleEmail,
  connectGoogle, disconnectGoogle,
} from '../api/google'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import Spinner from '../components/Spinner'

function Section({ title, description, children }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-text-primary mb-1">{title}</h2>
      {description && <p className="text-xs text-text-muted mb-4">{description}</p>}
      {children}
    </section>
  )
}

function Divider() { return <div className="border-t border-border my-6" /> }

function Tag({ label, role, onRemove }) {
  const roleStyle = role === 'frost'
    ? 'bg-indigo-500/10 text-indigo-400'
    : role === 'external'
      ? 'bg-amber-500/10 text-amber-400'
      : 'bg-accent/10 text-accent'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${roleStyle}`}>
      {label}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-400 transition-colors"><X size={10} /></button>
      )}
    </span>
  )
}

function AddEmailInput({ onAdd, placeholder = 'user@example.com' }) {
  const [val, setVal] = useState('')
  function submit() {
    const v = val.trim().toLowerCase()
    if (!v || !v.includes('@')) return
    onAdd(v); setVal('')
  }
  return (
    <div className="flex gap-2 mt-2">
      <input className="input text-xs py-1 flex-1" placeholder={placeholder} value={val}
        onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      <button className="btn-primary py-1" onClick={submit}><Plus size={12} /> Add</button>
    </div>
  )
}

export default function Admin() {
  const { config, updateConfig, canAdmin, email, reload } = useAccess()
  const { isDark, toggleTheme } = useTheme()
  const { toasts, toast, dismiss } = useToast()

  // Backend API config state (moved from Settings)
  const [raintoolHost, setRaintoolHost] = useState(() => localStorage.getItem('raintool_host') || 'https://hailstorm.frostdesigngroup.com')
  const [trelloApiKey, setTrelloApiKey] = useState(() => localStorage.getItem('trello_api_key') || '')
  const [trelloToken,  setTrelloToken]  = useState(() => localStorage.getItem('trello_token')   || '')
  const [runnApiKey,   setRunnApiKey]   = useState(() => localStorage.getItem('runn_api_key')   || '')
  const [utilApiUrl,   setUtilApiUrl]   = useState(() => localStorage.getItem('util_api_url')   || '')

  // Google auth state
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected)
  const [googleEmail2,    setGoogleEmail2]    = useState(getGoogleEmail)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  // Access config
  const [apiBoards,     setApiBoards]     = useState([])
  const [boardsLoading, setBoardsLoading] = useState(false)
  const [boardsError,   setBoardsError]   = useState(null)
  const [showRaw,       setShowRaw]       = useState(false)
  const [importText,    setImportText]    = useState('')
  const [showImport,    setShowImport]    = useState(false)
  const [draft,         setDraft]         = useState(null)

  useEffect(() => {
    if (config) setDraft(JSON.parse(JSON.stringify(config)))
  }, [config])

  const fetchBoards = useCallback(() => {
    const host = localStorage.getItem('ares_host')
    const key  = localStorage.getItem('ares_api_key')
    if (!host || !key) {
      setBoardsError('Ares Host and API Key are not set. Go to Settings and save them first.')
      return
    }
    setBoardsLoading(true)
    setBoardsError(null)
    listBoards()
      .then(boards => { setApiBoards(boards); setBoardsError(null) })
      .catch(err => {
        const msg = err?.response
          ? `API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
          : err?.message || 'Unknown error'
        setBoardsError(msg)
      })
      .finally(() => setBoardsLoading(false))
  }, [])

  useEffect(() => { fetchBoards() }, [fetchBoards])

  if (!canAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <ShieldCheck size={32} />
        <p className="text-sm">Access denied. Admin accounts only.</p>
      </div>
    )
  }

  if (!draft) return null

  const isBootstrap = !draft.admins?.length

  // ── Access config actions ──────────────────────────────────────────────────

  function save() {
    updateConfig(draft)
    toast.success('Access config saved.')
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'access-config.json'; a.click()
    toast.info('Downloaded access-config.json — commit it to public/ to make changes permanent.')
  }

  function importJson() {
    try {
      const parsed = JSON.parse(importText)
      if (!parsed.admins || !parsed.boards) throw new Error('Missing "admins" or "boards" keys')
      setDraft(parsed); setImportText(''); setShowImport(false)
      toast.success('Config imported. Click Save to apply.')
    } catch (e) { toast.error(`Invalid JSON: ${e.message}`) }
  }

  function addAdmin(addr) {
    if (draft.admins.includes(addr)) return
    setDraft(d => ({ ...d, admins: [...d.admins, addr] }))
  }
  function removeAdmin(addr) {
    setDraft(d => ({ ...d, admins: d.admins.filter(a => a !== addr) }))
  }

  function ensureBoard(id, name) {
    if (!draft.boards[id])
      setDraft(d => ({ ...d, boards: { ...d.boards, [id]: { name, frostUsers: [], externalUsers: [] } } }))
  }

  function addFrostUser(id, name, addr) {
    ensureBoard(id, name)
    setDraft(d => {
      const frost = d.boards[id]?.frostUsers ?? []
      if (frost.includes(addr)) return d
      const ext = (d.boards[id]?.externalUsers ?? []).filter(u => u !== addr)
      return { ...d, boards: { ...d.boards, [id]: { ...d.boards[id], name, frostUsers: [...frost, addr], externalUsers: ext } } }
    })
  }
  function removeFrostUser(id, addr) {
    setDraft(d => ({
      ...d, boards: { ...d.boards, [id]: { ...d.boards[id], frostUsers: (d.boards[id]?.frostUsers ?? []).filter(u => u !== addr) } }
    }))
  }

  function addExternalUser(id, name, addr) {
    ensureBoard(id, name)
    setDraft(d => {
      const ext = d.boards[id]?.externalUsers ?? []
      if (ext.includes(addr)) return d
      const frost = (d.boards[id]?.frostUsers ?? []).filter(u => u !== addr)
      return { ...d, boards: { ...d.boards, [id]: { ...d.boards[id], name, externalUsers: [...ext, addr], frostUsers: frost } } }
    })
  }
  function removeExternalUser(id, addr) {
    setDraft(d => ({
      ...d, boards: { ...d.boards, [id]: { ...d.boards[id], externalUsers: (d.boards[id]?.externalUsers ?? []).filter(u => u !== addr) } }
    }))
  }

  function removeBoard(id) {
    setDraft(d => { const next = { ...d.boards }; delete next[id]; return { ...d, boards: next } })
  }

  // ── Backend API config actions ─────────────────────────────────────────────

  function saveBackendConfig() {
    localStorage.setItem('raintool_host',  raintoolHost.trim())
    localStorage.setItem('trello_api_key', trelloApiKey.trim())
    localStorage.setItem('trello_token',   trelloToken.trim())
    localStorage.setItem('runn_api_key',   runnApiKey.trim())
    localStorage.setItem('util_api_url',   utilApiUrl.trim())
    toast.success('Backend configuration saved.')
  }

  function handleConnect() {
    setGoogleLoading(true)
    connectGoogle({
      onSuccess: ({ email: e }) => {
        setGoogleConnected(true); setGoogleEmail2(e); setGoogleLoading(false)
        toast.success(`Connected as ${e || 'Google account'}`)
      },
      onError: (msg) => { setGoogleLoading(false); toast.error(msg) },
    })
  }
  function handleDisconnect() {
    disconnectGoogle(); setGoogleConnected(false); setGoogleEmail2(null)
    toast.info('Google account disconnected.')
  }

  // ── Board list ─────────────────────────────────────────────────────────────

  const seen   = new Set()
  const apiIds = new Set()
  for (const b of apiBoards) { if (b.id) apiIds.add(b.id) }
  const allBoards = [
    ...apiBoards
      .filter(b => { if (!b.id || seen.has(b.id)) return false; seen.add(b.id); return true })
      .map(b => ({ id: b.id, name: b.name })),
    ...Object.entries(draft.boards)
      .filter(([id]) => !apiIds.has(id) && !seen.has(id))
      .map(([id, v]) => ({ id, name: v.name || id })),
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" /> Admin
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Logged in as <span className="text-text-primary">{email}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary py-1" onClick={() => setShowImport(v => !v)}>
              <Upload size={13} /> Import
            </button>
            <button className="btn-secondary py-1" onClick={exportJson}>
              <Download size={13} /> Export JSON
            </button>
          </div>
        </div>

        {isBootstrap && (
          <div className="mb-6 p-3 bg-amber-400/10 border border-amber-400/30 rounded-lg flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Bootstrap mode:</strong> Add yourself as admin below and click Save to lock down access.
            </span>
          </div>
        )}

        {showImport && (
          <div className="mb-6 p-4 bg-surface border border-border rounded-xl">
            <p className="text-xs text-text-muted mb-2">Paste a valid <code>access-config.json</code>:</p>
            <textarea className="input font-mono text-xs h-32 resize-y" value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='{"admins": [], "boards": {}}' />
            <div className="flex gap-2 mt-2">
              <button className="btn-primary" onClick={importJson}><Check size={13} /> Apply</button>
              <button className="btn-secondary" onClick={() => { setShowImport(false); setImportText('') }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Backend Services ── */}
        <Section title="Backend Services"
          description="Integration credentials stored locally in your browser. Required for Utilization and Pass Tracking features.">
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Raintool Host</label>
              <input className="input" placeholder="https://hailstorm.frostdesigngroup.com"
                value={raintoolHost} onChange={e => setRaintoolHost(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1"><Key size={11} /> Trello API Key</label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={trelloApiKey} onChange={e => setTrelloApiKey(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1"><Key size={11} /> Trello Token</label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={trelloToken} onChange={e => setTrelloToken(e.target.value)} />
              <p className="text-xs text-text-muted mt-1">
                Generate at: <code className="text-accent">trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=YOUR_KEY</code>
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1"><Key size={11} /> Runn API Key</label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={runnApiKey} onChange={e => setRunnApiKey(e.target.value)} />
              <p className="text-xs text-text-muted mt-1">
                Found under <strong>Settings → API</strong> in your Runn app.
                Forwarded as <code className="text-accent">X-Runn-Api-Key</code> to the backend.
              </p>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Utilization API URL</label>
              <input className="input" placeholder="https://your-backend.railway.app"
                value={utilApiUrl} onChange={e => setUtilApiUrl(e.target.value)} />
              <p className="text-xs text-text-muted mt-1">
                Base URL of the utilization backend (proxies Runn + Ares cycle-time calls).
              </p>
            </div>
            <button className="btn-primary w-fit" onClick={saveBackendConfig}>
              <Save size={13} /> Save
            </button>
          </div>
        </Section>

        <Divider />

        {/* ── Google Account ── */}
        <Section title="Google Account"
          description="Connect a Google account for authentication.">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {googleConnected
                ? <CheckCircle2 size={14} className="text-emerald-400" />
                : <Circle       size={14} className="text-text-muted" />
              }
              <span className="text-xs text-text-muted">
                {googleConnected ? `Connected${googleEmail2 ? ` as ${googleEmail2}` : ''}` : 'Not connected'}
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
          </div>
        </Section>

        <Divider />

        {/* ── Appearance ── */}
        <Section title="Appearance" description="Color scheme preference.">
          <button className="btn-secondary" onClick={toggleTheme}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </Section>

        <Divider />

        {/* ── Admins ── */}
        <Section title="Admins"
          description="Admins have full access to all boards, settings, and user management.">
          <div className="flex flex-wrap gap-2">
            {draft.admins.length === 0
              ? <p className="text-xs text-text-muted italic">No admins configured.</p>
              : draft.admins.map(a => <Tag key={a} label={a} onRemove={() => removeAdmin(a)} />)
            }
          </div>
          <AddEmailInput onAdd={addAdmin} placeholder="admin@example.com" />
          {email && !draft.admins.includes(email) && (
            <button className="btn-secondary mt-2 text-xs py-1" onClick={() => addAdmin(email)}>
              <Plus size={11} /> Add myself ({email})
            </button>
          )}
        </Section>

        <Divider />

        {/* ── Project Access ── */}
        <Section title="Project Access"
          description="Assign Frost Users (full board access) and External Users (no Utilization tab) per board.">

          {boardsLoading && (
            <div className="flex items-center gap-2 text-text-muted text-xs mb-3">
              <Spinner size={12} /> Loading boards from Ares API…
            </div>
          )}

          {boardsError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2 text-xs text-red-400 mb-2">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span className="break-all">{boardsError}</span>
              </div>
              <button className="btn-secondary py-1 text-xs" onClick={fetchBoards}>
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {!boardsLoading && !boardsError && allBoards.length === 0 && (
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs text-text-muted italic flex-1">No boards returned from the API.</p>
              <button className="btn-secondary py-1 text-xs" onClick={fetchBoards}>
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {!boardsLoading && !boardsError && allBoards.length > 0 && (
            <button className="btn-secondary py-1 text-xs mb-4" onClick={fetchBoards}>
              <RefreshCw size={11} /> Refresh boards
            </button>
          )}

          <div className="flex flex-col gap-4">
            {allBoards.map(({ id, name }) => {
              const boardCfg    = draft.boards[id] || { frostUsers: [], externalUsers: [] }
              const frostUsers  = boardCfg.frostUsers    ?? []
              const extUsers    = boardCfg.externalUsers ?? []
              return (
                <div key={id} className="p-4 bg-surface border border-border rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <LayoutDashboard size={13} className="text-accent shrink-0" />
                    <span className="text-sm font-medium text-text-primary">{name}</span>
                    <span className="text-xs text-text-muted font-mono">{id}</span>
                    <div className="flex-1" />
                    {draft.boards[id] && (
                      <button onClick={() => removeBoard(id)}
                        className="text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Frost Users */}
                  <div className="mb-3">
                    <p className="text-[10px] font-medium text-indigo-400 flex items-center gap-1 mb-1.5">
                      <UserCheck size={10} /> Frost Users
                      <span className="text-text-muted font-normal ml-1">— full board access, can configure integrations</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {frostUsers.length === 0
                        ? <p className="text-xs text-text-muted italic">None assigned.</p>
                        : frostUsers.map(u => <Tag key={u} label={u} role="frost" onRemove={() => removeFrostUser(id, u)} />)
                      }
                    </div>
                    <AddEmailInput onAdd={addr => addFrostUser(id, name, addr)} placeholder="frost@example.com" />
                  </div>

                  {/* External Users */}
                  <div>
                    <p className="text-[10px] font-medium text-amber-400 flex items-center gap-1 mb-1.5">
                      <UserX size={10} /> External Users
                      <span className="text-text-muted font-normal ml-1">— board access, no Utilization tab</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {extUsers.length === 0
                        ? <p className="text-xs text-text-muted italic">None assigned.</p>
                        : extUsers.map(u => <Tag key={u} label={u} role="external" onRemove={() => removeExternalUser(id, u)} />)
                      }
                    </div>
                    <AddEmailInput onAdd={addr => addExternalUser(id, name, addr)} placeholder="external@example.com" />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Divider />

        <div className="flex items-center justify-between mb-2">
          <button className="text-xs text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setShowRaw(v => !v)}>
            {showRaw ? 'Hide' : 'Show'} raw JSON
          </button>
        </div>
        {showRaw && (
          <pre className="bg-surface border border-border rounded-xl p-4 text-xs text-text-muted font-mono overflow-x-auto mb-6">
            {JSON.stringify(draft, null, 2)}
          </pre>
        )}

        <div className="sticky bottom-4 flex justify-end">
          <button className="btn-primary shadow-lg" onClick={save}>
            <Check size={14} /> Save changes
          </button>
        </div>

      </div>
      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
