import { useState, useEffect, useCallback, useRef } from 'react'
import { useBlocker, useBeforeUnload } from 'react-router-dom'
import {
  ShieldCheck, Plus, Trash2, Zap, PenLine, Hash,
  Download, Upload, RefreshCw, AlertTriangle, Check, X, AlertCircle,
  Key, Sun, Moon, CheckCircle2, Circle, UserCheck, UserX,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import { useAccess } from '../context/AccessContext'
import { useTheme } from '../context/ThemeContext'
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
  const { config, updateConfig, canAdmin, email, reload, loading, refreshApiBoards } = useAccess()
  const { isDark, toggleTheme } = useTheme()
  const { toasts, toast, dismiss } = useToast()

  // Backend API config state — initialised from localStorage (seeded by AccessContext from Firestore)
  const [phobosHost,   setPhobosHost]   = useState(() => localStorage.getItem('phobos_host')    || localStorage.getItem('ares_host')    || '')
  const [phobosApiKey, setPhobosApiKey] = useState(() => localStorage.getItem('phobos_api_key') || localStorage.getItem('ares_api_key') || '')
  const [trelloApiKey, setTrelloApiKey] = useState(() => localStorage.getItem('trello_api_key') || '')
  const [trelloToken,  setTrelloToken]  = useState(() => localStorage.getItem('trello_token')   || '')

  // One-time sync from Firestore once config loads (handles first-time load before localStorage is seeded)
  const svcInitialized = useRef(false)
  useEffect(() => {
    if (svcInitialized.current || !config?.services) return
    svcInitialized.current = true
    const svc = config.services
    if (svc.phobosHost   || svc.aresHost)   setPhobosHost(svc.phobosHost   || svc.aresHost)
    if (svc.phobosApiKey || svc.aresApiKey) setPhobosApiKey(svc.phobosApiKey || svc.aresApiKey)
    if (svc.trelloApiKey) setTrelloApiKey(svc.trelloApiKey)
    if (svc.trelloToken)  setTrelloToken(svc.trelloToken)
  }, [config])

  // Google auth state
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected)
  const [googleEmail2,    setGoogleEmail2]    = useState(getGoogleEmail)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  // Access config
  const [boardsLoading, setBoardsLoading] = useState(false)
  const [boardsError,   setBoardsError]   = useState(null)
  const [boardSearch,   setBoardSearch]   = useState('')
  const [showRaw,       setShowRaw]       = useState(false)
  const [importText,    setImportText]    = useState('')
  const [showImport,    setShowImport]    = useState(false)
  const [draft,         setDraft]         = useState(null)
  const [showNewBoard,    setShowNewBoard]    = useState(false)
  const [newBoardName,    setNewBoardName]    = useState('')
  const [newBoardShortId, setNewBoardShortId] = useState('')
  const [expandedBoards,  setExpandedBoards]  = useState(new Set())

  function toggleExpanded(id) {
    setExpandedBoards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Unsaved-changes guard — must be after draft state
  const isDirty = !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(config)

  const blocker = useBlocker(
    useCallback(({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty])
  )

  useBeforeUnload(
    useCallback(e => { if (isDirty) { e.preventDefault(); e.returnValue = '' } }, [isDirty])
  )

  useEffect(() => {
    if (config) setDraft(JSON.parse(JSON.stringify(config)))
  }, [config])

  const loadAresBoards = useCallback(() => {
    const host = localStorage.getItem('phobos_host')   || localStorage.getItem('ares_host')
    const key  = localStorage.getItem('phobos_api_key') || localStorage.getItem('ares_api_key')
    if (!host || !key) {
      setBoardsError('Phobos Host and API Key are not set. Save them in Backend Services below.')
      return
    }
    setBoardsLoading(true)
    setBoardsError(null)
    refreshApiBoards(true)
      .then(boards => {
        const nextBoards = { ...draft.boards }
        let added = 0
        for (const b of boards) {
          if (!b.id || nextBoards[b.id]) continue   // already present — leave it alone
          nextBoards[b.id] = { name: b.name, source: 'ares', frostUsers: [], externalUsers: [] }
          added++
        }
        const next = { ...draft, boards: nextBoards }
        setDraft(next)
        updateConfig(next)   // persist immediately — board list is global, not per-session
        toast.success(
          added > 0
            ? `Added ${added} Ares board${added !== 1 ? 's' : ''} and saved.`
            : 'All Ares boards are already in your list.'
        )
        setBoardsError(null)
      })
      .catch(err => {
        const msg = err?.response
          ? `API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
          : err?.message || 'Unknown error'
        setBoardsError(msg)
      })
      .finally(() => setBoardsLoading(false))
  }, [draft, updateConfig, toast, refreshApiBoards])

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

  function toggleBoardSource(id, name) {
    const current = draft.boards[id]?.source || 'ares'
    const next = current === 'ares' ? 'manual' : 'ares'
    setDraft(d => ({
      ...d,
      boards: {
        ...d.boards,
        [id]: { frostUsers: [], externalUsers: [], ...(d.boards[id] || {}), name, source: next },
      },
    }))
  }

  function createManualBoard() {
    const name    = newBoardName.trim()
    const shortId = newBoardShortId.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!id) { toast.error('Invalid name.'); return }
    if (draft.boards[id]) { toast.error(`A board with ID "${id}" already exists.`); return }
    if (shortId) {
      const clash = Object.values(draft.boards).find(b => b.trelloShortId === shortId)
      if (clash) { toast.error(`"${clash.name || shortId}" already uses short board ID "${shortId}".`); return }
    }
    setDraft(d => ({
      ...d,
      boards: {
        ...d.boards,
        [id]: { name, source: 'manual', frostUsers: [], externalUsers: [], ...(shortId ? { trelloShortId: shortId } : {}) },
      },
    }))
    setNewBoardName('')
    setNewBoardShortId('')
    setShowNewBoard(false)
  }

  function updateManualBoardField(id, field, value) {
    setDraft(d => ({
      ...d,
      boards: { ...d.boards, [id]: { ...d.boards[id], [field]: value } },
    }))
  }

  // ── Backend API config actions ─────────────────────────────────────────────

  function saveBackendConfig() {
    const services = {
      ...(config?.services || {}),
      phobosHost:   phobosHost.trim(),
      phobosApiKey: phobosApiKey.trim(),
      trelloApiKey: trelloApiKey.trim(),
      trelloToken:  trelloToken.trim(),
    }
    // raintoolHost is intentionally not edited here (Phase 0d Raintool removal),
    // but we preserve any existing value via the spread above so we don't strip
    // it from Firestore on save — admins can clean it up manually if desired.
    updateConfig({ ...config, services })
    // Seed localStorage immediately so the current session works right away
    localStorage.setItem('phobos_host',    services.phobosHost)
    localStorage.setItem('phobos_api_key', services.phobosApiKey)
    localStorage.setItem('trello_api_key', services.trelloApiKey)
    localStorage.setItem('trello_token',   services.trelloToken)
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

  const allBoards = Object.entries(draft.boards)
    .map(([id, v]) => ({ id, name: v.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const q = boardSearch.trim().toLowerCase()
  const filteredBoards = q
    ? allBoards.filter(b => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
    : allBoards

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
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-xs text-amber-400 flex items-center gap-1 shrink-0">
                <AlertTriangle size={12} /> Unsaved
              </span>
            )}
            <button
              className={`btn-primary py-1 transition-all ${isDirty ? 'ring-2 ring-amber-400/40' : ''}`}
              onClick={save}
            >
              <Check size={13} /> Save changes
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

        {/* ── Backend Services ── */}
        <Section title="Backend Services"
          description="Shared credentials saved to Firestore — set once and all users receive them automatically.">
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Ares Host</label>
              <input className="input" placeholder="https://phobos.example.com"
                value={phobosHost} onChange={e => setPhobosHost(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 flex items-center gap-1"><Key size={11} /> Ares API Key</label>
              <input className="input" type="password" placeholder="••••••••••••"
                value={phobosApiKey} onChange={e => setPhobosApiKey(e.target.value)} />
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
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-primary py-1" onClick={saveBackendConfig}>
                <Check size={13} /> Save backend config
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-secondary py-1" onClick={() => setShowImport(v => !v)}>
                <Upload size={13} /> Import JSON
              </button>
              <button className="btn-secondary py-1" onClick={exportJson}>
                <Download size={13} /> Export JSON
              </button>
            </div>
            {showImport && (
              <div className="p-3 bg-white/[0.02] border border-border rounded-lg flex flex-col gap-2">
                <p className="text-xs text-text-muted">Paste a valid <code>access-config.json</code>:</p>
                <textarea className="input font-mono text-xs h-32 resize-y" value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder='{"admins": [], "boards": {}}' />
                <div className="flex gap-2">
                  <button className="btn-primary py-1" onClick={importJson}><Check size={13} /> Apply</button>
                  <button className="btn-secondary py-1" onClick={() => { setShowImport(false); setImportText('') }}>Cancel</button>
                </div>
              </div>
            )}
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
          description="Assign Frost Users (full board access) and External Users (board access only) per board.">

          {/* Toolbar: search + load */}
          <div className="flex gap-2 mb-4">
            <input
              className="input text-xs py-1 flex-1"
              placeholder="Search boards by name or ID…"
              value={boardSearch}
              onChange={e => setBoardSearch(e.target.value)}
            />
            <button
              className="btn-secondary py-1 text-xs shrink-0"
              onClick={loadAresBoards}
              disabled={boardsLoading}
              title="Fetch Ares boards and add any that aren't already in your list"
            >
              {boardsLoading
                ? <><Spinner size={11} /> Loading…</>
                : <><RefreshCw size={11} /> Load Ares boards</>
              }
            </button>
          </div>

          {boardsError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2 text-xs text-red-400 mb-2">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span className="break-all">{boardsError}</span>
              </div>
              <button className="btn-secondary py-1 text-xs" onClick={loadAresBoards}>
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {!boardsLoading && allBoards.length === 0 && (
            <p className="text-xs text-text-muted italic mb-4">
              No boards yet — click "Load Ares boards" or create one manually below.
            </p>
          )}

          {!boardsLoading && allBoards.length > 0 && filteredBoards.length === 0 && (
            <p className="text-xs text-text-muted italic mb-4">No boards match "{boardSearch}".</p>
          )}

          <div className="flex flex-col gap-2">
            {filteredBoards.map(({ id, name }) => {
              const boardCfg   = draft.boards[id] || { frostUsers: [], externalUsers: [] }
              const frostUsers = boardCfg.frostUsers    ?? []
              const extUsers   = boardCfg.externalUsers ?? []
              const source     = boardCfg.source || 'ares'
              const isAres     = source === 'ares'
              const isExpanded = expandedBoards.has(id)
              return (
                <div key={id} className="bg-surface border border-border rounded-xl overflow-hidden">

                  {/* Collapsed row */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    {isAres
                      ? <Zap size={13} className="text-blue-400 shrink-0" />
                      : <PenLine size={13} className="text-emerald-400 shrink-0" />
                    }
                    <span className="text-sm font-medium text-text-primary truncate flex-1">{boardCfg.name || name}</span>
                    <span className="text-xs text-text-muted font-mono shrink-0">{id}</span>

                    {/* User counts */}
                    <span className="flex items-center gap-1 text-xs text-indigo-400 shrink-0" title="Frost users">
                      <UserCheck size={11} /> {frostUsers.length}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0" title="External users">
                      <UserX size={11} /> {extUsers.length}
                    </span>

                    {/* Segmented source toggle */}
                    <div className="inline-flex rounded-lg overflow-hidden border border-border text-[10px] font-medium shrink-0">
                      <button
                        onClick={() => !isAres && toggleBoardSource(id, name)}
                        className={`px-2.5 py-1 transition-colors ${isAres ? 'bg-blue-500/20 text-blue-400' : 'text-text-muted hover:bg-white/5 hover:text-text-primary'}`}
                      >Ares</button>
                      <div className="w-px bg-border" />
                      <button
                        onClick={() => isAres && toggleBoardSource(id, name)}
                        className={`px-2.5 py-1 transition-colors ${!isAres ? 'bg-emerald-500/20 text-emerald-400' : 'text-text-muted hover:bg-white/5 hover:text-text-primary'}`}
                      >Manual</button>
                    </div>

                    {draft.boards[id] && (
                      <button onClick={() => removeBoard(id)} className="text-text-muted hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                    <button onClick={() => toggleExpanded(id)} className="text-text-muted hover:text-text-primary transition-colors shrink-0">
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 pb-4 pt-3 border-t border-border flex flex-col gap-4">

                      {/* Manual-only fields */}
                      {!isAres && (
                        <div className="p-3 bg-white/[0.02] border border-emerald-500/20 rounded-lg flex flex-col gap-3">
                          <div>
                            <label className="text-[10px] font-medium text-emerald-400 block mb-1">Display Name</label>
                            <input className="input text-xs py-1 w-full" value={boardCfg.name || ''}
                              onChange={e => updateManualBoardField(id, 'name', e.target.value)} placeholder="Project display name" />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 mb-1">
                              <Hash size={9} /> Trello Short Board ID
                            </label>
                            <input className="input text-xs py-1 w-full font-mono" value={boardCfg.trelloShortId || ''}
                              onChange={e => updateManualBoardField(id, 'trelloShortId', e.target.value)} placeholder="e.g. aBc1dEfg" />
                            <p className="text-[10px] text-text-muted mt-1">
                              From the board URL: trello.com/b/<span className="text-text-primary font-mono">aBc1dEfg</span>/board-name
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Data tag — all boards */}
                      <div>
                        <label className="text-[10px] font-medium text-text-muted flex items-center gap-1 mb-1">
                          <Hash size={9} /> Data tag
                        </label>
                        <input className="input text-xs py-1 w-full" value={boardCfg.dataTag || ''}
                          onChange={e => updateManualBoardField(id, 'dataTag', e.target.value)} placeholder="Optional tag for this board" />
                      </div>

                      {/* Frost Users */}
                      <div>
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
                  )}
                </div>
              )
            })}

            {/* New Board form */}
            {showNewBoard ? (
              <div className="p-4 bg-surface border border-dashed border-border rounded-xl flex flex-col gap-2">
                <p className="text-xs text-text-muted">New manual board</p>
                <input
                  className="input text-xs py-1"
                  placeholder="Board name, e.g. Client X"
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && (setShowNewBoard(false), setNewBoardName(''), setNewBoardShortId(''))}
                  autoFocus
                />
                <input
                  className="input text-xs py-1 font-mono"
                  placeholder="Trello short board ID (optional, e.g. aBc1dEfg)"
                  value={newBoardShortId}
                  onChange={e => setNewBoardShortId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createManualBoard(); if (e.key === 'Escape') { setShowNewBoard(false); setNewBoardName(''); setNewBoardShortId('') } }}
                />
                <div className="flex gap-2">
                  <button className="btn-primary py-1" onClick={createManualBoard}><Check size={12} /> Create</button>
                  <button className="btn-secondary py-1" onClick={() => { setShowNewBoard(false); setNewBoardName(''); setNewBoardShortId('') }}><X size={12} /></button>
                </div>
              </div>
            ) : (
              <button className="btn-secondary py-1 text-xs w-fit" onClick={() => setShowNewBoard(true)}>
                <Plus size={12} /> New Board
              </button>
            )}
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


      </div>
      <Toast toasts={toasts} dismiss={dismiss} />

      {/* Unsaved-changes navigation blocker */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="bg-surface border border-border rounded-xl p-6 w-[400px] shadow-2xl">
            <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" /> Unsaved changes
            </h3>
            <p className="text-xs text-text-muted mb-5">
              You have unsaved changes. If you leave now, they will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => blocker.reset()}>Stay & keep editing</button>
              <button
                className="btn-primary !bg-red-500/15 !text-red-400 !border-red-500/30 hover:!bg-red-500/25"
                onClick={() => blocker.proceed()}
              >Leave without saving</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
