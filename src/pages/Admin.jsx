import { useState, useEffect } from 'react'
import {
  ShieldCheck, Plus, Trash2, Users, LayoutDashboard,
  Download, Upload, RefreshCw, AlertTriangle, Check, X,
} from 'lucide-react'
import { useAccess } from '../context/AccessContext'
import { clearAccessOverride, hasOverride } from '../api/access'
import { listBoards } from '../api/ares'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'
import Spinner from '../components/Spinner'

// ─── Small helpers ───────────────────────────────────────────────────────────

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

function Tag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-400 transition-colors">
          <X size={10} />
        </button>
      )}
    </span>
  )
}

function AddEmailInput({ onAdd, placeholder = 'user@example.com' }) {
  const [val, setVal] = useState('')
  function submit() {
    const v = val.trim().toLowerCase()
    if (!v || !v.includes('@')) return
    onAdd(v)
    setVal('')
  }
  return (
    <div className="flex gap-2 mt-2">
      <input
        className="input text-xs py-1 flex-1"
        placeholder={placeholder}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <button className="btn-primary py-1" onClick={submit}><Plus size={12} /> Add</button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Admin() {
  const { config, updateConfig, canAdmin, email, reload } = useAccess()
  const { toasts, toast, dismiss } = useToast()

  const [apiBoards,     setApiBoards]     = useState([])
  const [boardsLoading, setBoardsLoading] = useState(false)
  const [showRaw,       setShowRaw]       = useState(false)
  const [importText,    setImportText]    = useState('')
  const [showImport,    setShowImport]    = useState(false)

  // Local working copy of the config (editable before saving)
  const [draft, setDraft] = useState(null)

  // Sync draft whenever config loads or changes
  useEffect(() => {
    if (config) setDraft(JSON.parse(JSON.stringify(config)))
  }, [config])

  // Fetch boards from API
  useEffect(() => {
    const host = localStorage.getItem('ares_host')
    const key  = localStorage.getItem('ares_api_key')
    if (!host || !key) return
    setBoardsLoading(true)
    listBoards().then(setApiBoards).catch(() => {}).finally(() => setBoardsLoading(false))
  }, [])

  // ── Access guard ────────────────────────────────────────────────────────────
  if (!canAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <ShieldCheck size={32} className="text-text-muted" />
        <p className="text-sm">Access denied. Admin accounts only.</p>
      </div>
    )
  }

  if (!draft) return null

  // ── Draft helpers ───────────────────────────────────────────────────────────
  const isBootstrap = !draft.admins?.length

  function save() {
    updateConfig(draft)
    toast.success('Access config saved locally. Export JSON to make it permanent.')
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = 'access-config.json'
    a.click()
    toast.info('Downloaded access-config.json — commit it to public/ to make changes permanent.')
  }

  function importJson() {
    try {
      const parsed = JSON.parse(importText)
      if (!parsed.admins || !parsed.boards) throw new Error('Missing "admins" or "boards" keys')
      setDraft(parsed)
      setImportText('')
      setShowImport(false)
      toast.success('Config imported. Click Save to apply.')
    } catch (e) {
      toast.error(`Invalid JSON: ${e.message}`)
    }
  }

  function revertToFile() {
    clearAccessOverride()
    reload()
    toast.info('Override cleared — reverted to committed access-config.json.')
  }

  // ── Admin list ───────────────────────────────────────────────────────────────────
  function addAdmin(addr) {
    if (draft.admins.includes(addr)) return
    setDraft(d => ({ ...d, admins: [...d.admins, addr] }))
  }
  function removeAdmin(addr) {
    setDraft(d => ({ ...d, admins: d.admins.filter(a => a !== addr) }))
  }

  // ── Board access ─────────────────────────────────────────────────────────────────
  function ensureBoard(id, name) {
    if (!draft.boards[id]) {
      setDraft(d => ({ ...d, boards: { ...d.boards, [id]: { name, users: [] } } }))
    }
  }
  function toggleOpenAccess(id, name) {
    ensureBoard(id, name)
    setDraft(d => {
      const current = d.boards[id]?.users ?? []
      const next    = current.includes('*')
        ? current.filter(u => u !== '*')
        : ['*', ...current]
      return { ...d, boards: { ...d.boards, [id]: { ...d.boards[id], name, users: next } } }
    })
  }
  function addUserToBoard(id, name, addr) {
    ensureBoard(id, name)
    setDraft(d => {
      const current = d.boards[id]?.users ?? []
      if (current.includes(addr)) return d
      return { ...d, boards: { ...d.boards, [id]: { ...d.boards[id], name, users: [...current, addr] } } }
    })
  }
  function removeUserFromBoard(id, addr) {
    setDraft(d => {
      const current = d.boards[id]?.users ?? []
      return { ...d, boards: { ...d.boards, [id]: { ...d.boards[id], users: current.filter(u => u !== addr) } } }
    })
  }
  function removeBoard(id) {
    setDraft(d => {
      const next = { ...d.boards }
      delete next[id]
      return { ...d, boards: next }
    })
  }

  // All known boards: union of API boards + config boards
  const apiIds = new Set(apiBoards.map(b => b.id || b.boardId))
  const allBoards = [
    ...apiBoards.map(b => ({ id: b.id || b.boardId, name: b.name || b.boardName })),
    ...Object.entries(draft.boards)
      .filter(([id]) => !apiIds.has(id))
      .map(([id, v]) => ({ id, name: v.name || id })),
  ]

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" /> Access Control
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
            {hasOverride() && (
              <button className="btn-secondary py-1 text-amber-400 border-amber-400/30" onClick={revertToFile}>
                <RefreshCw size={13} /> Revert to file
              </button>
            )}
          </div>
        </div>

        {/* Bootstrap banner */}
        {isBootstrap && (
          <div className="mb-6 p-3 bg-amber-400/10 border border-amber-400/30 rounded-lg flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Bootstrap mode:</strong> No admins are configured yet. Add yourself as an admin below,
              click Save, then Export JSON and commit <code>public/access-config.json</code> to lock down access.
            </span>
          </div>
        )}

        {/* Override banner */}
        {hasOverride() && (
          <div className="mb-6 p-3 bg-accent/10 border border-accent/30 rounded-lg text-xs text-accent">
            You have unsaved local overrides. Export JSON and commit to <code>public/access-config.json</code> to make them permanent.
          </div>
        )}

        {/* Import panel */}
        {showImport && (
          <div className="mb-6 p-4 bg-surface border border-border rounded-xl">
            <p className="text-xs text-text-muted mb-2">Paste a valid <code>access-config.json</code> below:</p>
            <textarea
              className="input font-mono text-xs h-32 resize-y"
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder='{"admins": [], "boards": {}}'
            />
            <div className="flex gap-2 mt-2">
              <button className="btn-primary" onClick={importJson}><Check size={13} /> Apply</button>
              <button className="btn-secondary" onClick={() => { setShowImport(false); setImportText('') }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Admins ────────────────────────────────────────────────────────── */}
        <Section
          title="Admins"
          description="Admins can see all boards and manage access. The first admin must be added in bootstrap mode."
        >
          <div className="flex flex-wrap gap-2">
            {draft.admins.length === 0
              ? <p className="text-xs text-text-muted italic">No admins configured.</p>
              : draft.admins.map(a => (
                  <Tag key={a} label={a} onRemove={() => removeAdmin(a)} />
                ))
            }
          </div>
          <AddEmailInput onAdd={addAdmin} placeholder="admin@example.com" />
          {email && !draft.admins.includes(email) && (
            <button
              className="btn-secondary mt-2 text-xs py-1"
              onClick={() => addAdmin(email)}
            >
              <Plus size={11} /> Add myself ({email})
            </button>
          )}
        </Section>

        <Divider />

        {/* ── Board Access ─────────────────────────────────────────────────── */}
        <Section
          title="Project Access"
          description="Control which users can see each project board. Admins always see everything."
        >
          {boardsLoading && (
            <div className="flex items-center gap-2 text-text-muted text-xs">
              <Spinner size={12} /> Loading boards from API…
            </div>
          )}

          {!boardsLoading && allBoards.length === 0 && (
            <p className="text-xs text-text-muted italic">
              No boards found. Make sure your Ares API is configured in Settings.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {allBoards.map(({ id, name }) => {
              const boardCfg  = draft.boards[id] || { users: [] }
              const users     = boardCfg.users || []
              const openAccess = users.includes('*')
              const namedUsers = users.filter(u => u !== '*')

              return (
                <div key={id} className="p-4 bg-surface border border-border rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <LayoutDashboard size={13} className="text-accent shrink-0" />
                    <span className="text-sm font-medium text-text-primary">{name}</span>
                    <span className="text-xs text-text-muted font-mono">{id}</span>
                    <div className="flex-1" />
                    {/* Open access toggle */}
                    <button
                      onClick={() => toggleOpenAccess(id, name)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                        openAccess
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                          : 'border-border text-text-muted hover:border-emerald-500/40 hover:text-emerald-400'
                      }`}
                      title={openAccess ? 'All authenticated users can see this board. Click to restrict.' : 'Click to allow all authenticated users'}
                    >
                      <Users size={10} />
                      {openAccess ? 'All users' : 'Restricted'}
                    </button>
                    {/* Remove board from config */}
                    {draft.boards[id] && (
                      <button
                        onClick={() => removeBoard(id)}
                        className="text-text-muted hover:text-red-400 transition-colors"
                        title="Remove from access config"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Named users */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {namedUsers.length === 0 && !openAccess && (
                      <p className="text-xs text-text-muted italic">No users assigned — only admins can see this.</p>
                    )}
                    {namedUsers.map(u => (
                      <Tag key={u} label={u} onRemove={() => removeUserFromBoard(id, u)} />
                    ))}
                  </div>

                  <AddEmailInput
                    onAdd={addr => addUserToBoard(id, name, addr)}
                    placeholder="user@example.com"
                  />
                </div>
              )
            })}
          </div>
        </Section>

        <Divider />

        {/* ── Raw JSON preview ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <button
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setShowRaw(v => !v)}
          >
            {showRaw ? 'Hide' : 'Show'} raw JSON
          </button>
        </div>
        {showRaw && (
          <pre className="bg-surface border border-border rounded-xl p-4 text-xs text-text-muted font-mono overflow-x-auto mb-6">
            {JSON.stringify(draft, null, 2)}
          </pre>
        )}

        {/* Save bar */}
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
