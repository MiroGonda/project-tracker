# Utilization Feature — Complete Reference

This document captures the full make, structure, design, and configuration of the Utilization tab as it existed in this project before removal. Use it to rebuild the feature in another project.

---

## 1. What It Does

An org-wide resource utilization report shown as a tab inside each board page (`/board/:boardId` → Utilization tab). It combines two data sources:

- **Runn** — scheduled (allocated) hours and budget hours per person, grouped by role
- **Raintool** — actual logged hours per resource for the same period

The user maps Runn roles to Raintool resource names to produce a complete allocated vs. actual view.

---

## 2. Architecture

```
Browser
  │
  ├── GET /api/runn/utilization?startDate=…&endDate=…
  │         ↓
  │   Cloudflare Worker (server-side, no CORS)
  │         ↓ (6 parallel calls)
  │   Runn API (https://api.runn.io)
  │         ↓
  │   Pre-computed JSON response
  │
  └── GET /api/raintool/tasks?projectId=…&dateFrom=…&dateTo=…
            ↓
      Cloudflare Worker
            ↓
      Raintool report endpoint
```

**Why a backend:** Both Runn and the internal Raintool report endpoint block browser requests (no CORS headers). All calls must be server-side.

**Frontend config:** Admin → Backend Services
- `util_api_url` (localStorage) — base URL of the Worker, e.g. `https://runn-proxy.workers.dev`
- `runn_api_key` (localStorage) — forwarded to Worker as `X-Runn-Api-Key` header

---

## 3. Files

| File | Role |
|---|---|
| `src/pages/UtilizationTab.jsx` | Main component (entire feature) |
| `src/api/runn.js` | API wrapper — calls Worker endpoints |
| `src/api/ares.js` → `getRaintoolProjectTasks` | Raintool task fetcher (routes through Worker) |
| `src/api/access.js` → `canSeeUtilization` | Role check — admin or frost only |

---

## 4. Configuration

### Backend configuration (Admin → Backend Services)

| localStorage key | What it is |
|---|---|
| `util_api_url` | Worker base URL (e.g. `https://runn-proxy.workers.dev`) |
| `runn_api_key` | Runn API key — forwarded as `X-Runn-Api-Key` to Worker |

### Per-board configuration (Settings → Board → cog icon)

Set via `BoardIntegrationsModal` in Settings.jsx. Stored in localStorage:

| localStorage key | What it is |
|---|---|
| `runn_project_${boardId}` | `{ id, name }` — scopes the Runn report to a specific project. Null = org-wide |
| `rt_project_${boardId}` | `{ id, name }` — the Raintool project to pull actuals from |

### Runtime cache (per board)

| localStorage key | TTL | What it stores |
|---|---|---|
| `util_cache_${boardId}` | 30 minutes | Full `{ data, cachedAt }` from the last Runn fetch |
| `util_rt_mapping_${boardId}` | Permanent | `{ [roleName]: [resourceName, ...] }` — role→resource mapping the user sets in the table |

---

## 5. Access Control

Only users with `admin` or `frost` board role can see the tab:

```js
// src/api/access.js
export function canSeeUtilization(config, email, boardId) {
  const role = getUserBoardRole(config, email, boardId)
  return role === 'admin' || role === 'frost'
}
```

In BoardPage.jsx the tab is hidden for `external` role:
```js
...(boardRole !== 'external' ? [{ id: 'utilization', label: 'Utilization', icon: Users }] : [])
```

---

## 6. UtilizationTab Component

**File:** `src/pages/UtilizationTab.jsx`

**Props:**
```js
UtilizationTab({ boardId, dateFrom, dateTo, forceRefresh = 0 })
```

| Prop | Type | Description |
|---|---|---|
| `boardId` | string | Current board ID |
| `dateFrom` | string YYYY-MM-DD | Start of date range (from parent's date range selector) |
| `dateTo` | string YYYY-MM-DD | End of date range |
| `forceRefresh` | number | Counter — increments from parent Refresh button to force re-fetch |

**State:**
```js
const [runnData,    setRunnData]    = useState(loadCache(boardId)?.data ?? null)
const [runnLoading, setRunnLoading] = useState(false)
const [runnError,   setRunnError]   = useState(null)
const [rtHoursMap,  setRtHoursMap]  = useState({})     // { resourceName: totalHours }
const [rtResources, setRtResources] = useState([])     // sorted resource name list
const [rtLoading,   setRtLoading]   = useState(false)
const [rtError,     setRtError]     = useState(null)
const [roleMapping, setRoleMapping] = useState(loadStored(roleMappingKey(boardId)) || {})
                                      // { roleName: [resourceName, ...] }
const [sort, setSort] = useState({ col: 'actual_hours', asc: false })
```

**Data derivation:**
```js
// Group Runn people by role, summing allocated + budget hours
const roleRows = useMemo(() => {
  const map = {}
  for (const p of runnData.people) {
    const role = p.role || 'Unknown'
    if (!map[role]) map[role] = { role, allocated_hours: 0, budget_hours: 0 }
    map[role].allocated_hours += p.allocated_hours || 0
    map[role].budget_hours    += p.budget_hours    || 0
  }
  return Object.values(map)
}, [runnData])
```

Note: The Runn backend returns `allocated_hours` and `budget_hours` per person (distinct from the `capacity_hours`/`scheduled_hours` naming in the rebuild spec — the UtilizationTab used these names).

---

## 7. Sub-components

### `UtilBar`
```jsx
<UtilBar pct={utilPct} hasActuals={hasActuals} />
```
- Progress bar capped at 100% width (overcapacity still shows real % text)
- Color: red >100%, green ≥80%, yellow ≥50%, gray <50%, dim accent if no actuals

### `SummaryCard`
```jsx
<SummaryCard label="People" value={12} sub="21 working days" valueClass="text-accent" />
```
- `rounded-xl border border-border bg-surface px-5 py-4`
- Label: `text-[10px] uppercase tracking-wider text-text-muted/60`
- Value: `text-2xl font-bold text-text-primary`

### `SortTh`
```jsx
<SortTh col="role" sort={sort} onSort={handleSort}>Role</SortTh>
```
Sortable table header that shows ChevronUp/Down icon when active.

### `ResourceMultiSelect`
Portal-rendered multi-select dropdown for assigning Raintool resources to a Runn role.
- Renders into `document.body` via `createPortal` to escape table overflow clipping
- Tracks dropdown position via `getBoundingClientRect` on open
- Props: `{ resources, selected, onChange, disabled }`

### `UtilChart`
Bar + Area composed chart (recharts) showing Actual hours vs. Allocated or Budget, by role.
- Toggle: `Allocated` | `Budget` mode
- Area: purple-500 with gradient fill for the reference line
- Bar colors: green ≥80%, amber 50–79%, red >100%, white/10 if no actuals, blue <50%
- Bar uses gradient fills (SVG `<defs>` with linearGradient)
- Height: `Math.max(220, data.length * 52 + 60)`

### `CustomTooltip`
Recharts custom tooltip with dark surface styling matching the app theme.

---

## 8. API Layer

### `src/api/runn.js`

```js
// Base URL from localStorage
function getUtilApiBase() {
  return (localStorage.getItem('util_api_url') || '').replace(/\/$/, '')
}

// Runn key forwarded to Worker
function getRunnApiKey() {
  return localStorage.getItem('runn_api_key') || ''
}

// Main utilization fetch
export async function getUtilization(startDate, endDate, projectId = null, force = false)
// → GET ${base}/api/runn/utilization?startDate=…&endDate=…[&projectId=…][&force=true]
// → Headers: X-Runn-Api-Key

// Fetch project list (for per-board config modal)
export async function getRunnProjects()
// → GET ${base}/api/runn/projects

// Connectivity check
export async function checkUtilizationApi()
// → GET ${base}/api/runn/me

export function isUtilApiConfigured() { return !!getUtilApiBase() }
```

### `src/api/ares.js` → `getRaintoolProjectTasks`

```js
export const getRaintoolProjectTasks = (projectId, dateFrom, dateTo) => {
  const utilBase = (localStorage.getItem('util_api_url') || '').replace(/\/$/, '')
  if (!utilBase) throw new Error('Utilization API URL is not configured.')
  return axios.get(`${utilBase}/api/raintool/tasks`, {
    params: { projectId, dateFrom, dateTo },
    timeout: 30000,
  }).then(r => Array.isArray(r.data) ? r.data : [])
}
```

Returns: `[{ date, resource, taskId, projectId, projectName, activity, timeSpent: { hours, seconds } }]`

---

## 9. Runn Backend Response Shape

See `.referenceMaterials/utilization-rebuild.md` § 9 for the full backend response shape and computation spec (working days, assignments overlap, actuals summation, per-person loop, summary cards).

Key fields per person in `response.people[]`:

| Field | Type | Description |
|---|---|---|
| `id` | number | Runn person ID |
| `name` | string | Full name |
| `role` | string | Role name from Runn |
| `capacity_hours` | number | Total available hours (minutesPerDay × workingDays / 60) |
| `scheduled_hours` | number | Planned hours from assignments |
| `actual_hours` | number | Logged hours from actuals endpoint |
| `util_scheduled_pct` | number | scheduled / capacity × 100 |
| `util_actual_pct` | number | actual / capacity × 100 |
| `projects` | string[] | Project names (sorted) |
| `has_actuals` | boolean | true if actual_hours > 0 |

Note: The live UtilizationTab referenced `allocated_hours` and `budget_hours` per role row (grouped from Runn people). The Worker/backend must be adapted to return or map to these fields, or the frontend aggregation logic updated to use the rebuild spec field names.

---

## 10. Raintool Backend Endpoint

The Worker exposes:
```
GET /api/raintool/tasks?projectId=…&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
```

Proxies to: `https://hailstorm.frostdesigngroup.com/public/api/project/list-active-projects` and the Raintool report endpoint. The exact Raintool API paths are documented in `.referenceMaterials/raintool-api-guide.md`.

Returns: array of task objects — `{ date, resource, taskId, projectId, projectName, activity, timeSpent: { hours, seconds } }`

The frontend groups these by `resource` to build `rtHoursMap`:
```js
const map = {}
for (const t of tasks) {
  map[t.resource] = (map[t.resource] || 0) + (t.timeSpent?.hours || 0)
}
```

---

## 11. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER: "Utilization Report" · "Runn · Allocated vs Actual"  │
├──────────────────────────────────────────────────────────────┤
│ SUMMARY CARDS (grid-cols-4)                                   │
│  People | Allocated (total)h | Budget h | Actual h           │
├──────────────────────────────────────────────────────────────┤
│ CHART (UtilChart) — Allocated/Budget vs Actual by Role        │
├──────────────────────────────────────────────────────────────┤
│ TABLE (sortable)                                              │
│  Role | Resources (multiselect) | Allocated | Budget |       │
│  Actual | Util bar                                            │
├──────────────────────────────────────────────────────────────┤
│ PERIOD NOTE (right-aligned, text-[10px] text-text-muted/50)  │
└──────────────────────────────────────────────────────────────┘
```

- Outer container: `p-6 space-y-5`
- Summary grid: `grid grid-cols-4 gap-3`
- Table: `bg-surface border border-border rounded-xl overflow-hidden`
- Table header: `sticky top-0 bg-surface border-b border-border`, `text-[10px] uppercase tracking-wider`

---

## 12. Color / Design Tokens

```js
// Util bar colors
function utilBarColor(pct, hasActuals) {
  if (!hasActuals) return 'bg-accent/40'   // dim indigo — no timesheet yet
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

// Chart area line color
const AREA_COLOR = '#a855f7' // purple-500

// Chart bar fills (SVG gradients)
barGreen:  #4ade80 → #15803d
barAmber:  #fbbf24 → #b45309
barRed:    #f87171 → #b91c1c
barBlue:   #818cf8 → #3730a3
noActuals: rgba(255,255,255,0.10)
```

---

## 13. Loading & Empty States

| State | UI |
|---|---|
| `loading && !runnData` | Centered `<Spinner size={28} />` + "Fetching data…" |
| `!loading && !runnData && !runnError && configured` | Users icon (40px, muted/20) + "No data loaded" + "Data will load automatically on next page refresh." |
| `!configured` | Info banner: "Set the Utilization API URL in Settings to load data." |
| `configured && !runnProject \|\| !rtProject` | Amber warning banner pointing to Board Configuration |
| `runnError` | Red error banner with AlertTriangle icon |
| `rtError` | Orange error banner |
| `loading && runnData` | Table stays visible; only load button shows spinner (no full-page flash) |

---

## 14. Cloudflare Worker Endpoints Required

The Worker (`/tmp/runn-proxy/src/index.js`) exposes:

| Endpoint | Used by |
|---|---|
| `GET /api/runn/me` | Connectivity check |
| `GET /api/runn/projects` | Project picker in Settings modal |
| `GET /api/runn/utilization?startDate=…&endDate=…[&projectId=…]` | Main utilization data |
| `GET /api/raintool/tasks?projectId=…&dateFrom=…&dateTo=…` | Raintool actuals |

Worker secret: `RUNN_API_KEY` (set via `wrangler secret put RUNN_API_KEY`).

The full Worker code is at `/tmp/runn-proxy/src/index.js`. The `raintool/tasks` endpoint was not yet implemented in that file — it needs to be added using the Raintool API docs at `.referenceMaterials/raintool-api-guide.md`.

---

## 15. Integration Points Removed From This Repo

When the feature was removed, the following were deleted or cleaned up:

- `src/pages/UtilizationTab.jsx` — deleted
- `src/api/runn.js` — deleted
- `src/api/ares.js` → `getRaintoolProjectTasks` — removed; `cycleTime` reverted to direct Ares call
- `src/pages/BoardPage.jsx` → Utilization tab entry, `utilRefresh` state, `UtilizationTab` render
- `src/pages/Admin.jsx` → Runn API Key field, Utilization API URL field, Backend Services section
- `src/pages/Settings.jsx` → `BoardIntegrationsModal` simplified to Raintool-only; `getRunnProjects`/`isUtilApiConfigured` imports removed
- `src/api/access.js` → `canSeeUtilization` — removed
