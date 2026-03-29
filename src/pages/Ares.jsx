import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart, Area,
} from 'recharts'
import {
  LayoutDashboard, RefreshCw, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, Users, Tag, ChevronDown, ChevronUp, Circle, AlertCircle,
  X, Calendar, Download, Check, Minimize2, Target,
} from 'lucide-react'
import {
  listBoards, boardCards, boardMovements, boardSummary,
  cycleTime, listRaintoolProjects,
} from '../api/ares'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'
import useToast from '../hooks/useToast'

// ─── Constants ────────────────────────────────────────────────────────────────

const LANE_MAP = {
  // Backlog
  'Backlog':                        { type: 'backlog',    category: 'Backlog',      status: 'Backlog' },
  'Icebox':                         { type: 'backlog',    category: 'Backlog',      status: 'Icebox' },
  'Ideas':                          { type: 'backlog',    category: 'Backlog',      status: 'Ideas' },
  // Ready
  'Ready':                          { type: 'ready',      category: 'Ready',        status: 'Ready' },
  'Ready for Dev':                  { type: 'ready',      category: 'Ready',        status: 'Ready for Dev' },
  'Ready for Development':          { type: 'ready',      category: 'Ready',        status: 'Ready for Development' },
  'Next Up':                        { type: 'ready',      category: 'Ready',        status: 'Next Up' },
  'Prioritized':                    { type: 'ready',      category: 'Ready',        status: 'Prioritized' },
  // In Progress
  'In Progress':                    { type: 'wip',        category: 'In Progress',  status: 'In Progress' },
  'In Development':                 { type: 'wip',        category: 'In Progress',  status: 'In Development' },
  'Development':                    { type: 'wip',        category: 'In Progress',  status: 'Development' },
  'Working On':                     { type: 'wip',        category: 'In Progress',  status: 'Working On' },
  'Active':                         { type: 'wip',        category: 'In Progress',  status: 'Active' },
  // Review
  'Review':                         { type: 'review',     category: 'Review',       status: 'Review' },
  'In Review':                      { type: 'review',     category: 'Review',       status: 'In Review' },
  'Code Review':                    { type: 'review',     category: 'Review',       status: 'Code Review' },
  'PR Review':                      { type: 'review',     category: 'Review',       status: 'PR Review' },
  'QA':                             { type: 'review',     category: 'Review',       status: 'QA' },
  'QA Review':                      { type: 'review',     category: 'Review',       status: 'QA Review' },
  'Testing':                        { type: 'review',     category: 'Review',       status: 'Testing' },
  'UAT':                            { type: 'review',     category: 'Review',       status: 'UAT' },
  // Blocked
  'Blocked':                        { type: 'blocked',    category: 'Blocked',      status: 'Blocked' },
  'On Hold':                        { type: 'blocked',    category: 'Blocked',      status: 'On Hold' },
  'Waiting':                        { type: 'blocked',    category: 'Blocked',      status: 'Waiting' },
  'Waiting for Feedback':           { type: 'blocked',    category: 'Blocked',      status: 'Waiting for Feedback' },
  // Done
  'Done':                           { type: 'done',       category: 'Done',         status: 'Done' },
  'Completed':                      { type: 'done',       category: 'Done',         status: 'Completed' },
  'Finished':                       { type: 'done',       category: 'Done',         status: 'Finished' },
  'Closed':                         { type: 'done',       category: 'Done',         status: 'Closed' },
  'Released':                       { type: 'done',       category: 'Done',         status: 'Released' },
  'Deployed':                       { type: 'done',       category: 'Done',         status: 'Deployed' },
  'Done - This Week':               { type: 'done',       category: 'Done',         status: 'Done - This Week' },
  'Done - Last Week':               { type: 'done',       category: 'Done',         status: 'Done - Last Week' },
  'Done - This Month':              { type: 'done',       category: 'Done',         status: 'Done - This Month' },
  // Archived
  'Archive':                        { type: 'archived',   category: 'Archived',     status: 'Archived' },
  'Archived':                       { type: 'archived',   category: 'Archived',     status: 'Archived' },
  'Won\'t Do':                      { type: 'archived',   category: 'Archived',     status: "Won't Do" },
  'Cancelled':                      { type: 'archived',   category: 'Archived',     status: 'Cancelled' },
}

const DIST_COLORS = {
  backlog:  '#6b7280',
  ready:    '#3b82f6',
  wip:      '#a855f7',
  review:   '#f59e0b',
  blocked:  '#ef4444',
  done:     '#10b981',
  archived: '#374151',
}

const STATUS_ORDER  = ['backlog', 'ready', 'wip', 'review', 'blocked', 'done', 'archived']
const STATUS_ABBREV = { backlog: 'BL', ready: 'RD', wip: 'WIP', review: 'REV', blocked: 'BLK', done: 'DN', archived: 'ARC' }
const STATUS_COLOR  = DIST_COLORS

const PROCESS_COL_GROUPS = ['wip', 'review', 'blocked']
const WORK_COL_GROUPS    = ['backlog', 'ready', 'wip', 'review', 'blocked']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(period) {
  const now  = new Date()
  const end  = now.toISOString().split('T')[0]
  let start
  if      (period === '7d')  { const d = new Date(now); d.setDate(d.getDate() - 7);   start = d.toISOString().split('T')[0] }
  else if (period === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30);  start = d.toISOString().split('T')[0] }
  else if (period === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90);  start = d.toISOString().split('T')[0] }
  else if (period === '6m')  { const d = new Date(now); d.setMonth(d.getMonth() - 6); start = d.toISOString().split('T')[0] }
  else if (period === '1y')  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); start = d.toISOString().split('T')[0] }
  else start = '2020-01-01'
  return { start, end }
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function extractDate(card, field = 'due') {
  return card?.[field] ? card[field].split('T')[0] : null
}

function extractList(card) {
  return card?.list_name || card?.listName || card?.list || ''
}

function getPeriodKey(iso, granularity = 'week') {
  const d = new Date(iso)
  if (granularity === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  // ISO week
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function formatPeriodLabel(key, granularity = 'week') {
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
  const [y, w] = key.split('-W')
  // approximate Monday of that ISO week
  const jan4 = new Date(+y, 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (+w - 1) * 7)
  return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function aggregateThroughput(movements, granularity = 'week') {
  const map = {}
  for (const m of movements) {
    const lane = LANE_MAP[m.to_list || m.toList || '']
    if (lane?.type !== 'done') continue
    const date = m.date || m.moved_at || m.movedAt
    if (!date) continue
    const key = getPeriodKey(date, granularity)
    map[key] = (map[key] || 0) + 1
  }
  const keys = Object.keys(map).sort()
  return keys.map(k => ({ period: k, label: formatPeriodLabel(k, granularity), count: map[k] }))
}

function computeTargetForPeriod(targets, periodKey, granularity = 'week') {
  for (const t of targets) {
    const sk = getPeriodKey(t.startDate, granularity)
    const ek = getPeriodKey(t.endDate,   granularity)
    if (periodKey >= sk && periodKey <= ek) return t.value
  }
  return null
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportTableAsCsv(rows, headers, filename = 'export.csv') {
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function exportChartAsPng(ref, filename = 'chart.png') {
  const el = ref?.current
  if (!el) return
  import('html2canvas').then(({ default: html2canvas }) => {
    html2canvas(el).then(canvas => {
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = filename
      a.click()
    })
  }).catch(() => alert('html2canvas is not installed. Run: npm install html2canvas'))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDistBar({ counts }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0)
  if (!total) return null
  return (
    <div className="flex h-2 rounded-full overflow-hidden w-full">
      {STATUS_ORDER.filter(s => counts[s]).map(s => (
        <div
          key={s}
          title={`${s}: ${counts[s]}`}
          style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_COLOR[s] }}
        />
      ))}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color = 'text-text-primary' }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-text-muted text-xs mb-1">
        {Icon && <Icon size={13} />}
        {label}
      </div>
      <div className={`text-2xl font-semibold ${color}`}>{value ?? '—'}</div>
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

  function addTarget() {
    if (!form.startDate || !form.endDate || !form.value) return
    const next = [...targets, { id: Date.now(), ...form, value: +form.value }]
    setTargets(next)
    localStorage.setItem(`targets_${boardId}`, JSON.stringify(next))
    setForm({ startDate: '', endDate: '', value: '' })
  }

  function removeTarget(id) {
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
          <button onClick={() => removeTarget(t.id)} className="ml-auto text-text-muted hover:text-red-400">
            <X size={11} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Start</label>
          <input type="date" className="input text-xs py-1 w-36"
            value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">End</label>
          <input type="date" className="input text-xs py-1 w-36"
            value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Target/period</label>
          <input type="number" min="1" className="input text-xs py-1 w-24"
            value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
        </div>
        <button className="btn-primary py-1" onClick={addTarget}>
          <Check size={12} /> Add
        </button>
      </div>
    </div>
  )
}

function ThroughputSection({ movements, boardId }) {
  const [granularity, setGranularity] = useState('week')
  const [showTargets, setShowTargets] = useState(false)
  const [targets, setTargets] = useState(() => {
    const raw = localStorage.getItem(`targets_${boardId}`)
    return raw ? JSON.parse(raw) : []
  })
  const chartRef = useRef(null)

  // reload targets when board changes
  useEffect(() => {
    const raw = localStorage.getItem(`targets_${boardId}`)
    setTargets(raw ? JSON.parse(raw) : [])
  }, [boardId])

  const data = aggregateThroughput(movements, granularity).map(p => ({
    ...p,
    target: computeTargetForPeriod(targets, p.period, granularity),
  }))

  return (
    <SectionCard
      title="Throughput"
      action={
        <div className="flex items-center gap-2">
          <button className="btn-secondary py-1 text-xs" onClick={() => setShowTargets(v => !v)}>
            <Target size={11} /> Targets
          </button>
          <select
            className="input text-xs py-1 w-24"
            value={granularity}
            onChange={e => setGranularity(e.target.value)}
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
          <button className="btn-secondary py-1" onClick={() => exportChartAsPng(chartRef, 'throughput.png')}>
            <Download size={13} />
          </button>
        </div>
      }
    >
      {showTargets && (
        <div className="mb-4 p-3 bg-bg rounded-lg border border-border">
          <TargetsPanel targets={targets} setTargets={setTargets} boardId={boardId} />
        </div>
      )}
      <div ref={chartRef} className="h-52">
        {data.length === 0
          ? <div className="flex items-center justify-center h-full text-text-muted text-xs">No throughput data</div>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip content={<ThroughputTooltip />} />
                <Bar dataKey="count" name="Completed" fill="#6366f1" radius={[3, 3, 0, 0]} />
                {targets.length > 0 && (
                  <Area
                    dataKey="target"
                    name="Target"
                    fill="rgba(16,185,129,0.1)"
                    stroke="#10b981"
                    strokeDasharray="4 2"
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )
        }
      </div>
    </SectionCard>
  )
}

function DistBar({ label, value, total, color }) {
  const pct = total ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-text-muted truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span className="w-8 text-right text-text-muted">{value}</span>
    </div>
  )
}

function PipelineDistribution({ cards }) {
  const counts = {}
  for (const card of cards) {
    const lane = LANE_MAP[extractList(card)]
    const type = lane?.type || 'backlog'
    counts[type] = (counts[type] || 0) + 1
  }
  const total = Object.values(counts).reduce((s, v) => s + v, 0)

  return (
    <SectionCard title="Pipeline Distribution">
      <StatusDistBar counts={counts} />
      <div className="flex flex-col gap-2 mt-3">
        {STATUS_ORDER.filter(s => counts[s]).map(s => (
          <DistBar
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            value={counts[s]}
            total={total}
            color={DIST_COLORS[s]}
          />
        ))}
      </div>
    </SectionCard>
  )
}

function PipelineTableView({ cards, onExport }) {
  const groups = {}
  for (const card of cards) {
    const list = extractList(card)
    if (!groups[list]) groups[list] = []
    groups[list].push(card)
  }
  const lists = Object.keys(groups).sort()

  return (
    <SectionCard
      title="Pipeline Table"
      action={
        <button className="btn-secondary py-1" onClick={onExport}>
          <Download size={13} /> CSV
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left py-1.5 pr-3">List</th>
              <th className="text-right py-1.5">Count</th>
            </tr>
          </thead>
          <tbody>
            {lists.map(l => (
              <tr key={l} className="border-b border-border/50">
                <td className="py-1.5 pr-3 text-text-primary">{l}</td>
                <td className="py-1.5 text-right text-text-muted">{groups[l].length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

function CardsTable({ cards }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE = 20

  const filtered = cards.filter(c => {
    const q = search.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(q) ||
      extractList(c).toLowerCase().includes(q)
    )
  })
  const total  = filtered.length
  const paged  = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const pages  = Math.ceil(total / PAGE)

  return (
    <SectionCard title={`Cards (${total})`}>
      <input
        className="input mb-3 text-xs"
        placeholder="Search cards…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0) }}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left py-1.5 pr-3">Name</th>
              <th className="text-left py-1.5 pr-3">List</th>
              <th className="text-left py-1.5">Due</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-white/5">
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
          <button className="btn-secondary py-1" disabled={page === 0}         onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page + 1} of {pages}</span>
          <button className="btn-secondary py-1" disabled={page >= pages - 1}  onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </SectionCard>
  )
}

function CycleTimeSection({ boardId, rtProjects }) {
  const [rtProjectId, setRtProjectId] = useState('')
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function load() {
    if (!rtProjectId) return
    setLoading(true); setError(null)
    try {
      const { data: rows } = await cycleTime(rtProjectId)
      setData(rows || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const avg = data.length ? (data.reduce((s, d) => s + (d.cycleTime || d.cycle_time || 0), 0) / data.length).toFixed(1) : null

  return (
    <SectionCard title="Cycle Time">
      <div className="flex gap-2 mb-4 flex-wrap items-end">
        <select className="input text-xs py-1 w-56"
          value={rtProjectId} onChange={e => setRtProjectId(e.target.value)}>
          <option value="">Select Raintool project…</option>
          {rtProjects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn-primary py-1" onClick={load} disabled={!rtProjectId || loading}>
          {loading ? <Spinner size={12} /> : 'Load'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      {avg && <p className="text-xs text-text-muted mb-3">Avg cycle time: <span className="text-text-primary font-medium">{avg} days</span></p>}
      {data.length > 0 && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 40)} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip content={<ThroughputTooltip />} />
              <Bar dataKey="cycleTime" name="Days" fill="#a855f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Ares() {
  const { toasts, toast, dismiss } = useToast()
  const [configMissing, setConfigMissing] = useState(false)
  const [boards, setBoards]         = useState([])
  const [boardId, setBoardId]       = useState(() => localStorage.getItem('selected_board_id') || '')
  const [period, setPeriod]         = useState('30d')
  const [cards, setCards]           = useState([])
  const [movements, setMovements]   = useState([])
  const [summary, setSummary]       = useState(null)
  const [rtProjects, setRtProjects] = useState([])
  const [loading, setLoading]       = useState(false)
  const [loadingBoards, setLoadingBoards] = useState(false)
  const [error, setError]           = useState(null)

  // ── Config guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const host   = localStorage.getItem('ares_host')
    const apiKey = localStorage.getItem('ares_api_key')
    if (!host || !apiKey) {
      setConfigMissing(true)
      return
    }
    setConfigMissing(false)
    loadBoards()
  }, [])

  // ── Load boards ─────────────────────────────────────────────────────────────
  async function loadBoards() {
    setLoadingBoards(true)
    try {
      const b = await listBoards()
      setBoards(b)
      if (!boardId && b.length > 0) {
        const id = b[0].id || b[0].boardId
        setBoardId(id)
        localStorage.setItem('selected_board_id', id)
      }
    } catch (e) {
      toast.error(`Failed to load boards: ${e.message}`)
    } finally {
      setLoadingBoards(false)
    }
  }

  // ── Load board data ──────────────────────────────────────────────────────────
  const loadBoardData = useCallback(async () => {
    if (!boardId) return
    setLoading(true); setError(null)
    const { start, end } = getDateRange(period)
    try {
      const [c, m, s] = await Promise.all([
        boardCards(boardId, { start_date: start, end_date: end }),
        boardMovements(boardId, { start_date: start, end_date: end }),
        boardSummary(boardId).catch(() => null),
      ])
      setCards(c.data || [])
      setMovements(m.data || [])
      setSummary(s)
    } catch (e) {
      setError(e.message)
      toast.error(`Error loading board data: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [boardId, period])

  useEffect(() => {
    if (!configMissing && boardId) loadBoardData()
  }, [boardId, period, configMissing])

  // ── Load Raintool projects ──────────────────────────────────────────────────
  useEffect(() => {
    if (!configMissing) {
      listRaintoolProjects().then(setRtProjects).catch(() => {})
    }
  }, [configMissing])

  // ── Board change ────────────────────────────────────────────────────────────
  function handleBoardChange(id) {
    setBoardId(id)
    localStorage.setItem('selected_board_id', id)
  }

  // ── Derived KPIs ────────────────────────────────────────────────────────────
  const doneCount = movements.filter(m => {
    const lane = LANE_MAP[m.to_list || m.toList || '']
    return lane?.type === 'done'
  }).length

  const wipCount = cards.filter(c => {
    const lane = LANE_MAP[extractList(c)]
    return PROCESS_COL_GROUPS.includes(lane?.type)
  }).length

  const blockedCount = cards.filter(c => {
    const lane = LANE_MAP[extractList(c)]
    return lane?.type === 'blocked'
  }).length

  // ── Pipeline CSV export ─────────────────────────────────────────────────────
  function exportPipeline() {
    exportTableAsCsv(
      cards.map(c => [c.name, extractList(c), extractDate(c), c.id]),
      ['Name', 'List', 'Due', 'ID'],
      'pipeline.csv',
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (configMissing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm">Ares API not configured.</p>
        <Link to="/settings" className="btn-primary">Go to Settings</Link>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-3">
        <LayoutDashboard size={15} className="text-accent" />
        <span className="text-sm font-semibold text-text-primary">Ares</span>
        <div className="flex-1" />

        {/* Board selector */}
        {loadingBoards
          ? <Spinner size={14} className="text-text-muted" />
          : (
            <select
              className="input text-xs py-1 w-48"
              value={boardId}
              onChange={e => handleBoardChange(e.target.value)}
            >
              {boards.length === 0 && <option value="">No boards</option>}
              {boards.map(b => (
                <option key={b.id || b.boardId} value={b.id || b.boardId}>
                  {b.name || b.boardName}
                </option>
              ))}
            </select>
          )
        }

        {/* Period selector */}
        <select
          className="input text-xs py-1 w-24"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
          <option value="6m">6 months</option>
          <option value="1y">1 year</option>
          <option value="all">All time</option>
        </select>

        <button
          className="btn-secondary py-1"
          onClick={loadBoardData}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center gap-2 mt-6 text-text-muted text-sm">
          <Spinner size={16} /> Loading board data…
        </div>
      )}

      {!loading && (
        <div className="p-4 flex flex-col gap-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={TrendingUp} label="Throughput" value={doneCount}
              sub={`completed in period`} color="text-emerald-400" />
            <KpiCard icon={Users}      label="WIP"        value={wipCount}
              sub="in progress / review" color="text-purple-400" />
            <KpiCard icon={AlertTriangle} label="Blocked" value={blockedCount}
              sub="blocked cards"        color={blockedCount > 0 ? 'text-red-400' : 'text-text-primary'} />
            <KpiCard icon={Tag}        label="Total Cards" value={cards.length}
              sub="in selected period" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ThroughputSection movements={movements} boardId={boardId} />
            <PipelineDistribution cards={cards} />
          </div>

          {/* Pipeline table */}
          <PipelineTableView cards={cards} onExport={exportPipeline} />

          {/* Cards table */}
          <CardsTable cards={cards} />

          {/* Cycle time */}
          <CycleTimeSection boardId={boardId} rtProjects={rtProjects} />
        </div>
      )}

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
