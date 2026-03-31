import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart, Area,
} from 'recharts'
import {
  LayoutDashboard, RefreshCw, AlertTriangle, AlertCircle,
  TrendingUp, Users, Tag, Download, Check, Target, X,
} from 'lucide-react'
import {
  boardCards, boardMovements, boardSummary,
} from '../api/ares'
import { useAccess } from '../context/AccessContext'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'

// ─── Constants ───────────────────────────────────────────────────────────────

const LANE_MAP = {
  'Backlog':               { type: 'backlog',  status: 'Backlog' },
  'Icebox':                { type: 'backlog',  status: 'Icebox' },
  'Ideas':                 { type: 'backlog',  status: 'Ideas' },
  'Ready':                 { type: 'ready',    status: 'Ready' },
  'Ready for Dev':         { type: 'ready',    status: 'Ready for Dev' },
  'Ready for Development': { type: 'ready',    status: 'Ready for Development' },
  'Next Up':               { type: 'ready',    status: 'Next Up' },
  'Prioritized':           { type: 'ready',    status: 'Prioritized' },
  'In Progress':           { type: 'wip',      status: 'In Progress' },
  'In Development':        { type: 'wip',      status: 'In Development' },
  'Development':           { type: 'wip',      status: 'Development' },
  'Working On':            { type: 'wip',      status: 'Working On' },
  'Active':                { type: 'wip',      status: 'Active' },
  'Review':                { type: 'review',   status: 'Review' },
  'In Review':             { type: 'review',   status: 'In Review' },
  'Code Review':           { type: 'review',   status: 'Code Review' },
  'PR Review':             { type: 'review',   status: 'PR Review' },
  'QA':                    { type: 'review',   status: 'QA' },
  'QA Review':             { type: 'review',   status: 'QA Review' },
  'Testing':               { type: 'review',   status: 'Testing' },
  'UAT':                   { type: 'review',   status: 'UAT' },
  'Blocked':               { type: 'blocked',  status: 'Blocked' },
  'On Hold':               { type: 'blocked',  status: 'On Hold' },
  'Waiting':               { type: 'blocked',  status: 'Waiting' },
  'Waiting for Feedback':  { type: 'blocked',  status: 'Waiting for Feedback' },
  'Done':                  { type: 'done',     status: 'Done' },
  'Completed':             { type: 'done',     status: 'Completed' },
  'Finished':              { type: 'done',     status: 'Finished' },
  'Closed':                { type: 'done',     status: 'Closed' },
  'Released':              { type: 'done',     status: 'Released' },
  'Deployed':              { type: 'done',     status: 'Deployed' },
  'Done - This Week':      { type: 'done',     status: 'Done - This Week' },
  'Done - Last Week':      { type: 'done',     status: 'Done - Last Week' },
  'Done - This Month':     { type: 'done',     status: 'Done - This Month' },
  'Archive':               { type: 'archived', status: 'Archived' },
  'Archived':              { type: 'archived', status: 'Archived' },
  "Won't Do":              { type: 'archived', status: "Won't Do" },
  'Cancelled':             { type: 'archived', status: 'Cancelled' },
}

const DIST_COLORS = {
  backlog: '#6b7280', ready: '#3b82f6', wip: '#a855f7',
  review:  '#f59e0b', blocked: '#ef4444', done: '#10b981', archived: '#374151',
}
const STATUS_ORDER       = ['backlog', 'ready', 'wip', 'review', 'blocked', 'done', 'archived']
const PROCESS_COL_GROUPS = ['wip', 'review', 'blocked']

// ─── Pagination helper ────────────────────────────────────────────────────────

// Fetches all pages from a paginated endpoint, returning a flat array of all items.
// apiFn must match the signature (boardId, params) => Promise<{ data, meta }>
async function fetchAllPages(apiFn, boardId, baseParams = {}) {
  let page = 1
  const allData = []
  while (true) {
    const result = await apiFn(boardId, { ...baseParams, page, pageSize: 200 })
    const batch = Array.isArray(result?.data) ? result.data : []
    allData.push(...batch)
    const pg = result?.meta?.pagination
    if (!pg || page >= pg.totalPages) break
    page++
  }
  return allData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(period) {
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  let start
  if      (period === '7d')  { const d = new Date(now); d.setDate(d.getDate() - 7);          start = d.toISOString().split('T')[0] }
  else if (period === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30);         start = d.toISOString().split('T')[0] }
  else if (period === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90);         start = d.toISOString().split('T')[0] }
  else if (period === '6m')  { const d = new Date(now); d.setMonth(d.getMonth() - 6);        start = d.toISOString().split('T')[0] }
  else if (period === '1y')  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1);  start = d.toISOString().split('T')[0] }
  else start = '2020-01-01'
  return { start, end }
}

function fmtDateShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// API returns currentList as the list field name
function extractList(card) {
  return card?.currentList || card?.list_name || card?.listName || card?.list || ''
}

function extractDate(card) {
  const d = card?.due || card?.dueDate
  return d ? d.split('T')[0] : null
}

function getPeriodKey(iso, granularity) {
  const d = new Date(iso)
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  // ISO week
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  const wn = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${tmp.getFullYear()}-W${String(wn).padStart(2, '0')}`
}

function formatPeriodLabel(key, granularity) {
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  const [y, w] = key.split('-W')
  const jan4 = new Date(+y, 0, 4)
  const mon  = new Date(jan4)
  mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (+w - 1) * 7)
  return mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Buckets done cards by dateLastActivity within the optional [dateFrom, dateTo] window.
function aggregateThroughput(doneCards, granularity, dateFrom, dateTo) {
  const from = dateFrom ? new Date(dateFrom) : null
  const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null
  const map  = {}
  for (const c of doneCards) {
    const dateStr = c.dateLastActivity || c.updatedAt || c.due
    if (!dateStr) continue
    const d = new Date(dateStr)
    if (from && d < from) continue
    if (to   && d > to)   continue
    const key = getPeriodKey(dateStr, granularity)
    map[key] = (map[key] || 0) + 1
  }
  return Object.keys(map).sort().map(k => ({ period: k, label: formatPeriodLabel(k, granularity), count: map[k] }))
}

function computeTargetForPeriod(targets, periodKey, granularity) {
  for (const t of targets) {
    if (periodKey >= getPeriodKey(t.startDate, granularity) &&
        periodKey <= getPeriodKey(t.endDate,   granularity)) return t.value
  }
  return null
}

function exportTableAsCsv(rows, headers, filename) {
  const lines = [headers.join(',')]
  for (const row of rows)
    lines.push(row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = filename
  a.click()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = 'text-text-primary', loading }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
        {Icon && <Icon size={13} />}{label}
      </div>
      {loading
        ? <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
        : <div className={`text-2xl font-semibold ${color}`}>{value ?? '—'}</div>
      }
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
    </div>
  )
}

function SectionCard({ title, action, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function ThroughputTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="text-text-muted mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function TargetsPanel({ targets, setTargets, boardId }) {
  const [form, setForm] = useState({ startDate: '', endDate: '', value: '' })
  function add() {
    if (!form.startDate || !form.endDate || !form.value) return
    const next = [...targets, { id: Date.now(), ...form, value: +form.value }]
    setTargets(next)
    localStorage.setItem(`targets_${boardId}`, JSON.stringify(next))
    setForm({ startDate: '', endDate: '', value: '' })
  }
  function remove(id) {
    const next = targets.filter(t => t.id !== id)
    setTargets(next)
    localStorage.setItem(`targets_${boardId}`, JSON.stringify(next))
  }
  return (
    <div className="flex flex-col gap-3">
      {targets.map(t => (
        <div key={t.id} className="flex items-center gap-2 text-xs text-text-muted">
          <Target size={11} className="text-accent" />
          <span>{fmtDateShort(t.startDate)} – {fmtDateShort(t.endDate)}</span>
          <span className="text-text-primary font-medium">{t.value}/period</span>
          <button onClick={() => remove(t.id)} className="ml-auto text-text-muted hover:text-red-400"><X size={11} /></button>
        </div>
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Start</label>
          <input type="date" className="input text-xs py-1 w-36" value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">End</label>
          <input type="date" className="input text-xs py-1 w-36" value={form.endDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Target/period</label>
          <input type="number" min="1" className="input text-xs py-1 w-24" value={form.value}
            onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
        </div>
        <button className="btn-primary py-1" onClick={add}><Check size={12} /> Add</button>
      </div>
    </div>
  )
}

function ThroughputSection({ doneCards, boardId, dateFrom, dateTo }) {
  const [gran,    setGran]    = useState('week')
  const [showTgt, setShowTgt] = useState(false)
  const [targets, setTargets] = useState(() => {
    const raw = localStorage.getItem(`targets_${boardId}`)
    return raw ? JSON.parse(raw) : []
  })

  useEffect(() => {
    const raw = localStorage.getItem(`targets_${boardId}`)
    setTargets(raw ? JSON.parse(raw) : [])
  }, [boardId])

  const data = aggregateThroughput(doneCards, gran, dateFrom, dateTo).map(p => ({
    ...p,
    target: computeTargetForPeriod(targets, p.period, gran),
  }))

  return (
    <SectionCard
      title="Throughput"
      action={
        <div className="flex items-center gap-2">
          <button className="btn-secondary py-1 text-xs" onClick={() => setShowTgt(v => !v)}>
            <Target size={11} /> Targets
          </button>
          <select className="input text-xs py-1 w-24" value={gran} onChange={e => setGran(e.target.value)}>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      }
    >
      {showTgt && (
        <div className="mb-4 p-3 bg-bg rounded-lg border border-border">
          <TargetsPanel targets={targets} setTargets={setTargets} boardId={boardId} />
        </div>
      )}
      <div className="h-52">
        {data.length === 0
          ? <div className="flex items-center justify-center h-full text-text-muted text-xs">No throughput data for this period</div>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip content={<ThroughputTooltip />} />
                <Bar dataKey="count" name="Completed" fill="#6366f1" radius={[3, 3, 0, 0]} />
                {targets.length > 0 && (
                  <Area dataKey="target" name="Target" fill="rgba(16,185,129,0.1)"
                    stroke="#10b981" strokeDasharray="4 2" connectNulls />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
      </div>
    </SectionCard>
  )
}

function CardsTable({ cards }) {
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(0)
  const PAGE = 20
  const filtered = cards.filter(c => {
    const q = search.toLowerCase()
    return (c.name || '').toLowerCase().includes(q) || extractList(c).toLowerCase().includes(q)
  })
  const paged = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.ceil(filtered.length / PAGE)
  return (
    <SectionCard title={`Active Cards (${filtered.length})`}>
      <input className="input mb-3 text-xs" placeholder="Search cards…" value={search}
        onChange={e => { setSearch(e.target.value); setPage(0) }} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-text-muted border-b border-border">
            <th className="text-left py-1.5 pr-3">Name</th>
            <th className="text-left py-1.5 pr-3">List</th>
            <th className="text-left py-1.5">Due</th>
          </tr></thead>
          <tbody>
            {paged.map((c, i) => (
              <tr key={c.id || i} className="border-b border-border/50 hover:bg-white/5">
                <td className="py-1.5 pr-3 text-text-primary max-w-xs truncate">{c.name}</td>
                <td className="py-1.5 pr-3 text-text-muted">{extractList(c)}</td>
                <td className="py-1.5 text-text-muted">{fmtDateShort(extractDate(c))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
          <button className="btn-secondary py-1" disabled={page === 0}        onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page + 1} of {pages}</span>
          <button className="btn-secondary py-1" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoardPage() {
  const { boardId }                                         = useParams()
  const { admin, accessibleIds, config, loading: accessLoading } = useAccess()
  const { toasts, toast, dismiss }                          = useToast()

  const [configMissing, setConfigMissing] = useState(false)
  const [boardName,  setBoardName]  = useState(() => config?.boards?.[boardId]?.name || '')
  const [period,     setPeriod]     = useState('30d')
  const [cards,      setCards]      = useState([])      // active cards
  const [doneCards,  setDoneCards]  = useState([])      // done cards (all time)
  const [movements,  setMovements]  = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    const host   = localStorage.getItem('ares_host')
    const apiKey = localStorage.getItem('ares_api_key')
    setConfigMissing(!host || !apiKey)
  }, [])

  useEffect(() => {
    if (config?.boards?.[boardId]?.name) setBoardName(config.boards[boardId].name)
  }, [config, boardId])

  const loadData = useCallback(async () => {
    if (configMissing || !boardId) return
    setLoading(true); setError(null)
    const { start, end } = getDateRange(period)
    try {
      const [activeCards, doneFetched, movs, s] = await Promise.all([
        // Active cards: paginate all pages
        fetchAllPages(boardCards, boardId, { status: 'active' }),
        // Done cards: paginate all pages
        fetchAllPages(boardCards, boardId, { status: 'done' }),
        // Movements: paginate within the selected date range
        fetchAllPages(boardMovements, boardId, { dateFrom: start, dateTo: end }),
        boardSummary(boardId).catch(() => null),
      ])
      setCards(activeCards)
      setDoneCards(doneFetched)
      setMovements(movs)
      if (s) {
        const name = s.projectName || s.name || s.boardName || s.board_name
        if (name) setBoardName(name)
      }
    } catch (e) {
      setError(e.message)
      toast.error(`Error: ${e.message}`)
    } finally { setLoading(false) }
  }, [boardId, period, configMissing])

  useEffect(() => { if (!configMissing) loadData() }, [boardId, period, configMissing])

  const hasAccess = admin || accessibleIds.has(boardId)

  // Derived KPIs from done cards + active cards
  const { start: periodStart, end: periodEnd } = getDateRange(period)
  const doneInPeriod = doneCards.filter(c => {
    const d = c.dateLastActivity || c.updatedAt || c.due
    if (!d) return false
    return d >= periodStart && d <= periodEnd + 'T23:59:59'
  })
  const wipCount     = cards.filter(c => PROCESS_COL_GROUPS.includes(LANE_MAP[extractList(c)]?.type)).length
  const blockedCount = cards.filter(c => LANE_MAP[extractList(c)]?.type === 'blocked').length

  function exportPipeline() {
    exportTableAsCsv(
      cards.map(c => [c.name, extractList(c), extractDate(c), c.boardId || boardId]),
      ['Name', 'List', 'Due', 'Board ID'],
      `pipeline-${boardId}.csv`,
    )
  }

  // ── Render guards ────────────────────────────────────────────────────────────
  if (configMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm">Ares API not configured.</p>
        <Link to="/settings" className="btn-primary">Go to Settings</Link>
      </div>
    )
  }

  if (!accessLoading && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm">You don't have access to this project.</p>
        <Link to="/settings" className="btn-secondary">Back to Settings</Link>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-3">
        <LayoutDashboard size={15} className="text-accent" />
        <span className="text-sm font-semibold text-text-primary truncate max-w-[240px]">
          {boardName || boardId}
        </span>
        <div className="flex-1" />
        <select className="input text-xs py-1 w-28" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
          <option value="6m">6 months</option>
          <option value="1y">1 year</option>
          <option value="all">All time</option>
        </select>
        <button className="btn-secondary py-1" onClick={loadData} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {loading
        ? <div className="flex items-center justify-center gap-2 mt-6 text-text-muted text-sm"><Spinner size={16} /> Loading…</div>
        : (
          <div className="p-4 flex flex-col gap-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard icon={TrendingUp}    label="Done (period)"  value={doneInPeriod.length}  sub={`last ${period}`}              color="text-emerald-400" />
              <KpiCard icon={Tag}           label="Done (total)"   value={doneCards.length}     sub="all time"                       color="text-emerald-300" />
              <KpiCard icon={Users}         label="WIP"            value={wipCount}              sub="in progress / review"          color="text-purple-400" />
              <KpiCard icon={AlertTriangle} label="Blocked"        value={blockedCount}          sub="blocked cards"
                color={blockedCount > 0 ? 'text-red-400' : 'text-text-primary'} />
            </div>

            {/* Throughput (driven by done cards, filtered to selected period) */}
            <ThroughputSection
              doneCards={doneCards}
              boardId={boardId}
              dateFrom={periodStart}
              dateTo={periodEnd}
            />

            {/* Active cards table */}
            <CardsTable cards={cards} />
          </div>
        )
      }

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
