import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info, ChevronUp, ChevronDown, Users } from 'lucide-react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { getUtilization, isUtilApiConfigured } from '../api/runn'
import { getRaintoolProjectTasks } from '../api/ares'
import Spinner from '../components/Spinner'

// ─── localStorage helpers ─────────────────────────────────────────────────────

function cacheKey(boardId)      { return `util_cache_${boardId}` }
function roleMappingKey(boardId){ return `util_rt_mapping_${boardId}` }

function loadBoardProject(key, boardId) {
  try { return JSON.parse(localStorage.getItem(`${key}_${boardId}`) || 'null') } catch { return null }
}

const UTIL_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function loadCache(boardId) {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(boardId)) || 'null')
    if (!raw) return null
    if (Date.now() - (raw.cachedAt || 0) > UTIL_CACHE_TTL) return null
    return raw
  } catch { return null }
}
function saveCache(boardId, payload) {
  try { localStorage.setItem(cacheKey(boardId), JSON.stringify({ ...payload, cachedAt: Date.now() })) } catch { /* storage full */ }
}
function loadStored(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function saveStored(key, value) {
  try {
    if (value != null) localStorage.setItem(key, JSON.stringify(value))
    else               localStorage.removeItem(key)
  } catch { /* storage full */ }
}

// ─── Period label helper ──────────────────────────────────────────────────────

function formatPeriodSub(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return 'selected period'
  const a   = new Date(dateFrom + 'T00:00:00')
  const b   = new Date(dateTo   + 'T00:00:00')
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(a)} – ${fmt(b)}`
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function utilBarColor(pct, hasActuals) {
  if (!hasActuals) return 'bg-accent/40'
  if (pct > 100)   return 'bg-red-500'
  if (pct >= 80)   return 'bg-green-500'
  if (pct >= 50)   return 'bg-yellow-500'
  return 'bg-gray-500'
}
function utilTextColor(pct, hasActuals) {
  if (!hasActuals) return 'text-accent'
  if (pct > 100)   return 'text-red-400'
  if (pct >= 80)   return 'text-green-400'
  if (pct >= 50)   return 'text-yellow-400'
  return 'text-text-muted'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UtilBar({ pct, hasActuals }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${utilBarColor(pct, hasActuals)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-12 text-right tabular-nums ${utilTextColor(pct, hasActuals)}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function SummaryCard({ label, value, sub, valueClass }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="text-[10px] uppercase tracking-wider text-text-muted/60 mb-1">{label}</p>
      <p className={`text-2xl font-bold text-text-primary ${valueClass || ''}`}>{value}</p>
      <p className="text-xs text-text-muted mt-0.5">{sub}</p>
    </div>
  )
}

function SortTh({ col, sort, onSort, children, className = '' }) {
  const active = sort.col === col
  return (
    <th
      className={`py-2 px-3 cursor-pointer select-none hover:text-text-primary transition-colors whitespace-nowrap ${active ? 'text-text-primary' : 'text-text-muted'} ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active
          ? sort.asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
          : <ChevronDown size={11} className="opacity-20" />}
      </span>
    </th>
  )
}

// ─── Resource multi-select (portal-rendered to avoid table overflow clipping) ─

function ResourceMultiSelect({ resources, selected, onChange, disabled }) {
  const [open,    setOpen]   = useState(false)
  const [search,  setSearch] = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 240 })
  const btnRef  = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (dropRef.current  && !dropRef.current.contains(e.target) &&
          btnRef.current   && !btnRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen() {
    if (disabled) return
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) })
    }
    setOpen(v => !v)
  }

  const selectedSet = new Set(selected)
  const filtered = resources.filter(r => r.toLowerCase().includes(search.toLowerCase()))

  function toggle(r) {
    const next = new Set(selectedSet)
    next.has(r) ? next.delete(r) : next.add(r)
    onChange([...next])
  }

  const label = selected.length === 0 ? null
    : selected.length <= 2 ? selected.join(', ')
    : `${selected.length} resources`

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={disabled}
        className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 w-full max-w-[220px] text-left transition-colors ${
          disabled ? 'opacity-40 cursor-default' :
          open     ? 'bg-white/10 text-text-primary' : 'hover:bg-white/5'
        }`}
      >
        <span className="truncate flex-1">
          {label
            ? <span className="text-text-primary">{label}</span>
            : <span className="text-text-muted/40 italic">Assign resources…</span>}
        </span>
        <ChevronDown size={9} className="shrink-0 text-text-muted/40" />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-surface border border-border rounded-xl shadow-2xl flex flex-col"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: 260 }}
        >
          <div className="p-2 pb-1.5 border-b border-border/40">
            <input
              className="input text-xs w-full"
              placeholder="Search resources…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filtered.length === 0 && (
              <p className="text-xs text-text-muted/50 px-2 py-2">No resources match.</p>
            )}
            {filtered.map(r => (
              <label key={r} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.has(r)}
                  onChange={() => toggle(r)}
                  className="rounded accent-current"
                />
                <span className={`text-xs ${selectedSet.has(r) ? 'text-text-primary' : 'text-text-muted'}`}>{r}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="p-1 border-t border-border/40">
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full text-left text-xs px-2 py-1.5 text-text-muted hover:text-text-primary hover:bg-white/5 rounded transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Utilization chart ────────────────────────────────────────────────────────

const AREA_COLOR = '#a855f7' // purple-500

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-text-primary mb-1.5">{label}</p>
      {payload.map(p => {
        // Area uses a gradient fill URL — fall back to stroke for the swatch color
        const swatchColor = typeof p.fill === 'string' && p.fill.startsWith('url')
          ? (p.stroke || AREA_COLOR)
          : (p.fill || p.color)
        return (
          <div key={p.name} className="flex items-center gap-2 text-text-muted">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: swatchColor }} />
            <span>{p.name}:</span>
            <span className="font-medium text-text-primary">{Number(p.value).toFixed(1)}h</span>
          </div>
        )
      })}
    </div>
  )
}

function UtilChart({ rows, roleMapping, rtHoursMap }) {
  const [chartMode, setChartMode] = useState('allocated') // 'allocated' | 'budget'

  const areaLabel = chartMode === 'allocated' ? 'Allocated' : 'Budget'

  const data = rows.map(row => {
    const selected = roleMapping[row.role] || []
    const actualHours = selected.reduce((s, r) => s + (rtHoursMap[r] || 0), 0)
    return {
      role: row.role,
      Allocated: parseFloat(row.allocated_hours.toFixed(1)),
      Budget:    parseFloat(row.budget_hours.toFixed(1)),
      Actual:    parseFloat(actualHours.toFixed(1)),
    }
  })

  const areaVals = data.map(d => chartMode === 'allocated' ? d.Allocated : d.Budget)
  const maxVal   = Math.ceil(Math.max(...areaVals, ...data.map(d => d.Actual), 1) * 1.15)
  const chartHeight = Math.max(220, data.length * 52 + 60)

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      {/* Chart header with mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-wider text-text-muted/60">
          {areaLabel} vs Actual — by Role
        </p>
        <div className="flex items-center bg-white/5 rounded-lg p-0.5 gap-0.5">
          {['allocated', 'budget'].map(mode => (
            <button
              key={mode}
              onClick={() => setChartMode(mode)}
              className={`text-[11px] px-2.5 py-0.5 rounded-md transition-colors capitalize ${
                chartMode === mode
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {mode === 'allocated' ? 'Allocated' : 'Budget'}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }} barCategoryGap="32%">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={AREA_COLOR} stopOpacity={0.35} />
              <stop offset="100%" stopColor={AREA_COLOR} stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#4ade80" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f87171" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
            <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#818cf8" />
              <stop offset="100%" stopColor="#3730a3" />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="role"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={v => `${v}h`}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, maxVal]}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

          <Legend content={() => (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 14, fontSize: 10, color: '#9ca3af', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 12, height: 7, borderRadius: 2, background: AREA_COLOR, opacity: 0.8, display: 'inline-block' }} />
                {areaLabel}
              </span>
              {[
                ['#22c55e', 'Actual ≥ 80%'],
                ['#eab308', 'Actual 50–79%'],
                ['#ef4444', 'Over allocated'],
                ['rgba(255,255,255,0.15)', 'No actuals'],
                ['#6b7280', 'Actual < 50%'],
              ].map(([color, label]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 7, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
            </div>
          )} />

          <Area
            key={areaLabel}
            dataKey={areaLabel}
            type="step"
            fill="url(#areaGrad)"
            stroke={AREA_COLOR}
            strokeWidth={2.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Bar dataKey="Actual" radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((entry, i) => {
              const areaVal = chartMode === 'allocated' ? entry.Allocated : entry.Budget
              const pct = areaVal > 0 ? (entry.Actual / areaVal) * 100 : 0
              const hasActuals = entry.Actual > 0
              const fill = !hasActuals ? 'rgba(255,255,255,0.10)'
                : pct > 100           ? 'url(#barRed)'
                : pct >= 80           ? 'url(#barGreen)'
                : pct >= 50           ? 'url(#barAmber)'
                : 'url(#barBlue)'
              return <Cell key={i} fill={fill} />
            })}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UtilizationTab({ boardId, dateFrom, dateTo, forceRefresh = 0 }) {
  const configured = isUtilApiConfigured()

  const [runnProject] = useState(() => loadBoardProject('runn_project', boardId))
  const [rtProject]   = useState(() => loadBoardProject('rt_project', boardId))

  // Runn data
  const [runnData,    setRunnData]    = useState(() => loadCache(boardId)?.data ?? null)
  const [runnLoading, setRunnLoading] = useState(false)
  const [runnError,   setRunnError]   = useState(null)

  // Raintool tasks → { resource: totalHours }
  const [rtHoursMap,  setRtHoursMap]  = useState({})
  const [rtResources, setRtResources] = useState([])
  const [rtLoading,   setRtLoading]   = useState(false)
  const [rtError,     setRtError]     = useState(null)

  // Role → resource mapping, persisted per board
  const [roleMapping, setRoleMapping] = useState(() => loadStored(roleMappingKey(boardId)) || {})

  const [sort, setSort] = useState({ col: 'actual_hours', asc: false })
  const handleSort = col => setSort(prev => ({ col, asc: prev.col === col ? !prev.asc : false }))

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadRunn = useCallback(async (proj = runnProject, force = false) => {
    if (!configured) return
    setRunnLoading(true); setRunnError(null)
    try {
      const result = await getUtilization(dateFrom, dateTo, proj?.id ?? null, force)
      setRunnData(result)
      saveCache(boardId, { data: result })
    } catch (e) {
      setRunnError(e.response?.data?.detail || e.message || 'Failed to load Runn data.')
    } finally {
      setRunnLoading(false)
    }
  }, [dateFrom, dateTo, runnProject, configured, boardId])

  const loadRt = useCallback(async (proj = rtProject) => {
    if (!proj) { setRtHoursMap({}); setRtResources([]); return }
    setRtLoading(true); setRtError(null)
    try {
      const tasks = await getRaintoolProjectTasks(proj.id, dateFrom, dateTo)
      const map = {}
      for (const t of tasks) {
        const r = t.resource
        map[r] = (map[r] || 0) + (t.timeSpent?.hours || 0)
      }
      setRtHoursMap(map)
      setRtResources(Object.keys(map).sort())
    } catch (e) {
      setRtError(e.message || 'Failed to load Raintool data.')
    } finally {
      setRtLoading(false)
    }
  }, [dateFrom, dateTo, rtProject])

  // Auto-load on mount — use cache if fresh, otherwise fetch
  useEffect(() => {
    if (configured && !runnData) loadRunn()
    loadRt()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Triggered when parent's Refresh button is clicked (forceRefresh counter increments)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (forceRefresh > 0) { loadRunn(runnProject, true); loadRt() }
  }, [forceRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMappingChange(role, resources) {
    const next = { ...roleMapping, [role]: resources }
    setRoleMapping(next)
    saveStored(roleMappingKey(boardId), next)
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  // Group Runn people by role, sum allocated + budget hours
  const roleRows = useMemo(() => {
    if (!runnData?.people) return []
    const map = {}
    for (const p of runnData.people) {
      const role = p.role || 'Unknown'
      if (!map[role]) map[role] = { role, allocated_hours: 0, budget_hours: 0 }
      map[role].allocated_hours += p.allocated_hours || 0
      map[role].budget_hours    += p.budget_hours    || 0
    }
    return Object.values(map)
  }, [runnData])

  const sortedRows = useMemo(() => {
    return [...roleRows].sort((a, b) => {
      const getVal = row => {
        if (sort.col === 'role')            return row.role
        if (sort.col === 'allocated_hours') return row.allocated_hours
        if (sort.col === 'budget_hours')    return row.budget_hours
        if (sort.col === 'actual_hours') {
          const sel = roleMapping[row.role] || []
          return sel.reduce((s, r) => s + (rtHoursMap[r] || 0), 0)
        }
        return 0
      }
      const av = getVal(a), bv = getVal(b)
      if (typeof av === 'string') return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sort.asc ? av - bv : bv - av
    })
  }, [roleRows, sort, roleMapping, rtHoursMap])

  const totalAllocated = useMemo(() =>
    roleRows.reduce((s, r) => s + r.allocated_hours, 0).toFixed(1)
  , [roleRows])

  const totalBudget = useMemo(() =>
    roleRows.reduce((s, r) => s + r.budget_hours, 0).toFixed(1)
  , [roleRows])

  const totalActual = useMemo(() => {
    const allSelected = new Set(Object.values(roleMapping).flat())
    return [...allSelected].reduce((s, r) => s + (rtHoursMap[r] || 0), 0).toFixed(1)
  }, [roleMapping, rtHoursMap])

  const loading = runnLoading || rtLoading

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Users size={16} className="text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">Utilization Report</h2>
        <span className="text-xs text-text-muted ml-1">Runn · Allocated vs Actual</span>
      </div>

      {/* Not configured — API URL missing */}
      {!configured && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-border text-text-muted text-xs">
          <Info size={13} className="shrink-0" />
          Set the <strong className="text-text-primary mx-0.5">Utilization API URL</strong> in Settings to load data.
        </div>
      )}

      {/* Not configured — projects missing */}
      {configured && (!runnProject || !rtProject) && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <Info size={13} className="shrink-0" />
          {!runnProject && !rtProject
            ? 'No Runn or Raintool project configured.'
            : !runnProject
            ? 'No Runn project configured.'
            : 'No Raintool project configured.'}
          {' '}Go to <strong className="mx-0.5">Settings → Board Configuration</strong> and click the cog for this board.
        </div>
      )}

      {/* Runn error */}
      {runnError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Runn: {runnError}
        </div>
      )}

      {/* Raintool error */}
      {rtError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Raintool: {rtError}
        </div>
      )}

      {/* First load spinner */}
      {loading && !runnData && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
          <Spinner size={28} />
          <p className="text-sm">Fetching data…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !runnData && !runnError && configured && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
          <Users size={40} className="text-text-muted/20" />
          <p className="text-sm font-medium">No data loaded</p>
          <p className="text-xs">Data will load automatically on next page refresh.</p>
        </div>
      )}

      {/* Data */}
      {runnData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard
              label="People"
              value={runnData.summary.headcount}
              sub={`${runnData.period.working_days} working days`}
            />
            <SummaryCard
              label="Allocated"
              value={`${totalAllocated}h`}
              sub="full project lifetime"
              valueClass="text-accent"
            />
            <SummaryCard
              label="Budget"
              value={`${totalBudget}h`}
              sub={formatPeriodSub(dateFrom, dateTo)}
            />
            <SummaryCard
              label="Actual"
              value={`${totalActual}h`}
              sub={parseFloat(totalActual) === 0 ? 'no assignments yet' : 'from Raintool'}
            />
          </div>

          {/* Chart */}
          {sortedRows.length > 0 && (
            <UtilChart rows={sortedRows} roleMapping={roleMapping} rtHoursMap={rtHoursMap} />
          )}

          {/* Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface border-b border-border">
                <tr className="text-[10px] uppercase tracking-wider">
                  <SortTh col="role"            sort={sort} onSort={handleSort} className="text-left pl-4">Role</SortTh>
                  <th className="py-2 px-3 text-left text-text-muted whitespace-nowrap">
                    Resources
                    {!rtProject && <span className="ml-1 font-normal text-text-muted/40 normal-case">(configure in Settings → Integrations)</span>}
                    {rtLoading  && <span className="ml-1 font-normal text-text-muted/40 normal-case">Loading…</span>}
                  </th>
                  <SortTh col="allocated_hours" sort={sort} onSort={handleSort} className="text-right">Allocated</SortTh>
                  <SortTh col="budget_hours"    sort={sort} onSort={handleSort} className="text-right">Budget</SortTh>
                  <SortTh col="actual_hours"    sort={sort} onSort={handleSort} className="text-right">Actual</SortTh>
                  <th className="py-2 px-3 text-left text-text-muted w-52 whitespace-nowrap">Util</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => {
                  const selected = roleMapping[row.role] || []
                  const actualHours = selected.reduce((s, r) => s + (rtHoursMap[r] || 0), 0)
                  const hasActuals  = selected.length > 0 && actualHours > 0
                  const utilPct     = row.allocated_hours > 0
                    ? (actualHours / row.allocated_hours) * 100
                    : 0
                  return (
                    <tr key={row.role} className="border-b border-border/40 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 pl-4 font-medium text-text-primary whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {hasActuals && utilPct > 100 && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                          {row.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <ResourceMultiSelect
                          resources={rtResources}
                          selected={selected}
                          onChange={res => handleMappingChange(row.role, res)}
                          disabled={!rtProject || rtLoading}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-primary tabular-nums">{row.allocated_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-3 text-right text-text-muted tabular-nums">{row.budget_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {hasActuals
                          ? <span className="text-text-primary">{actualHours.toFixed(1)}h</span>
                          : <span className="text-text-muted/40">—</span>}
                      </td>
                      <td className="py-2.5 px-3 w-52">
                        <UtilBar pct={utilPct} hasActuals={hasActuals} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sortedRows.length === 0 && !loading && (
              <div className="py-10 text-center text-text-muted text-xs">No roles in this period.</div>
            )}
          </div>

          {/* Period note */}
          <p className="text-right text-[10px] text-text-muted/50">
            {runnProject && <span className="mr-2">Runn: {runnProject.name} ·</span>}
            {rtProject   && <span className="mr-2">Raintool: {rtProject.name} ·</span>}
            Period: {runnData.period.start} → {runnData.period.end} · {runnData.period.working_days} working days
          </p>
        </>
      )}

    </div>
  )
}
