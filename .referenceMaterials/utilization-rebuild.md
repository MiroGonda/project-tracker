# Resource Utilization — Rebuild Reference

This document is the implementation guide for recreating the Resource Utilization feature. It covers data sources, API calls, computation logic, backend response shape, and frontend layout — everything needed to rebuild from scratch.

---

## 1. What the Feature Does

Displays a per-person utilization report for any selected date range. For each active person, it shows:

- **Capacity** — total available working hours in the period
- **Scheduled** — hours planned via Runn assignments
- **Actual** — hours logged via timesheets
- **Utilization %** — both scheduled and actual as a percentage of capacity
- **Projects** — which projects the person is assigned to or has logged time against

At the top: four summary KPI cards (headcount, avg scheduled %, avg actual %, over-capacity count).

---

## 2. Data Sources

### Primary: Runn API

All data flows through Runn. The base URL is `https://api.runn.io` (EU) or `https://api.us.runn.io` (US) — configure via `RUNN_HOST` env var. Every request requires:

```
Authorization: Bearer <RUNN_API_KEY>
accept-version: 1.0.0
```

Store `RUNN_API_KEY` in `.env`. Never hardcode.

### Allocations (Scheduled Hours) → Runn

Planned resource allocations live in Runn natively: `/assignments/` stores day-by-day scheduled work, and `/people/contracts/current` stores each person's working capacity (`minutesPerDay`).

### Actuals (Logged Hours) → Runn (via Raintool integration)

Raintool is the timesheet tool staff use to log actual hours. These entries are synced into Runn via an integration, making them available at Runn's `/actuals/` endpoint (`billableMinutes` + `nonbillableMinutes` per entry).

**Best practice:** Always fetch actuals from Runn's `/actuals/` endpoint — it is the single source of truth for both scheduled and actual data in one place. If actuals are missing for some people (e.g. the period hasn't ended yet or timesheets haven't been submitted), the feature degrades gracefully by showing scheduled-only mode for those people rather than failing.

---

## 3. Runn API Pagination

All Runn list endpoints use cursor-based pagination:

```json
{
  "values": [...],
  "nextCursor": "string | null"
}
```

Fetch all pages with this pattern:

```python
async def _fetch_all(client, path, params=None, limit=200):
    results = []
    p = {**(params or {}), "limit": limit}
    cursor = None
    while True:
        if cursor:
            p["cursor"] = cursor
        resp = await client.get(f"{RUNN_BASE}{path}", headers=headers(), params=p)
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("values", []))
        cursor = data.get("nextCursor")
        if not cursor:
            break
    return results
```

---

## 4. The Six API Calls

All six run in parallel via `asyncio.gather`. All use `_fetch_all` for automatic pagination.

| Call | Endpoint | Key Parameters | Used For |
|---|---|---|---|
| People | `GET /people/` | `sortBy=id` | Person names, IDs, archived flag |
| Contracts | `GET /people/contracts/current` | `limit=500` | `minutesPerDay` (capacity) + `roleId` per person |
| Assignments | `GET /assignments/` | `startDate`, `endDate`, `limit=500` | Scheduled hours per assignment |
| Actuals | `GET /actuals/` | `minDate`, `maxDate`, `limit=500` | Logged hours per person |
| Roles | `GET /roles/` | `sortBy=id` | Role name lookup by ID |
| Projects | `GET /projects/` | `sortBy=id`, `includeArchived=false`, `limit=200` | Project name lookup by ID |

```python
people, contracts, assignments, actuals, roles, projects = await asyncio.gather(
    _fetch_all(client, "/people/",                  {"sortBy": "id"}),
    _fetch_all(client, "/people/contracts/current", {"limit": 500}),
    _fetch_all(client, "/assignments/",             {"startDate": start_date, "endDate": end_date, "limit": 500}),
    _fetch_all(client, "/actuals/",                 {"minDate": start_date, "maxDate": end_date, "limit": 500}),
    _fetch_all(client, "/roles/",                   {"sortBy": "id"}),
    _fetch_all(client, "/projects/",                {"sortBy": "id", "includeArchived": False, "limit": 200}),
)
```

---

## 5. Key Fields From Each Endpoint

### `/people/` response object
```json
{
  "id": 123,
  "firstName": "Jane",
  "lastName": "Doe",
  "isArchived": false
}
```
Skip any person where `isArchived === true`.

### `/people/contracts/current` response object
```json
{
  "personId": 123,
  "minutesPerDay": 480,
  "roleId": 7
}
```
`minutesPerDay` is the daily working capacity (480 = 8h day). If missing, default to `480`. Take the first contract found per `personId` — `contracts/current` returns the active contract.

### `/assignments/` response object
```json
{
  "personId": 123,
  "projectId": 45,
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "minutesPerDay": 240,
  "isPlaceholder": false
}
```
Only use assignments where `isPlaceholder === false`. Assignments with `isPlaceholder: true` are resource placeholders, not real people.

### `/actuals/` response object
```json
{
  "personId": 123,
  "projectId": 45,
  "date": "2026-03-15",
  "billableMinutes": 300,
  "nonbillableMinutes": 60
}
```
Actual hours = `billableMinutes + nonbillableMinutes` per entry. Sum across all entries for a person within the date range.

### `/roles/` response object
```json
{
  "id": 7,
  "name": "Senior Designer"
}
```

### `/projects/` response object
```json
{
  "id": 45,
  "name": "GCash: Design Support 2026"
}
```

---

## 6. Lookup Maps (build before per-person loop)

```python
# role_map: roleId → role name string
role_map = {r["id"]: r.get("name") or "Unknown" for r in roles}

# project_map: projectId → project name string
project_map = {p["id"]: p.get("name") or f"Project {p['id']}" for p in projects}

# contract_map: personId → { minutes_per_day, role_id }
# Take only the first contract found per person (current contract)
contract_map = {}
for c in contracts:
    pid = c["personId"]
    if pid not in contract_map:
        contract_map[pid] = {
            "minutes_per_day": c.get("minutesPerDay") or 480,
            "role_id":         c.get("roleId"),
        }

# person_assignments: personId → [assignment list]  (no placeholders)
person_assignments = defaultdict(list)
for a in assignments:
    if not a.get("isPlaceholder"):
        person_assignments[a["personId"]].append(a)

# person_actual_min: personId → total logged minutes
person_actual_min = defaultdict(int)
for act in actuals:
    person_actual_min[act["personId"]] += (
        (act.get("billableMinutes") or 0) + (act.get("nonbillableMinutes") or 0)
    )

# person_projects: personId → set of projectIds (from both assignments and actuals)
person_projects = defaultdict(set)
for a in assignments:
    if a.get("projectId") and not a.get("isPlaceholder"):
        person_projects[a["personId"]].add(a["projectId"])
for act in actuals:
    if act.get("projectId"):
        person_projects[act["personId"]].add(act["projectId"])
```

---

## 7. Working Days Helper

Capacity is based on Mon–Fri working days only. Weekends are excluded.

```python
def _working_days(start: date, end: date) -> int:
    """Count Mon–Fri days between start and end, inclusive."""
    if end < start:
        return 0
    total_days = (end - start).days + 1
    full_weeks, rem = divmod(total_days, 7)
    count = full_weeks * 5
    start_wd = start.weekday()   # 0=Mon, 6=Sun
    for i in range(rem):
        if (start_wd + i) % 7 < 5:
            count += 1
    return count
```

This does NOT account for public holidays — those are not factored in.

---

## 8. Per-Person Computation

For each non-archived person:

```python
working_days = _working_days(start, end)

for person in people:
    if person.get("isArchived"):
        continue

    pid      = person["id"]
    contract = contract_map.get(pid)
    mpd      = contract["minutes_per_day"] if contract else 480
    role_id  = contract["role_id"]          if contract else None

    # Capacity: full working days × minutes per day
    capacity_min = mpd * working_days

    # Scheduled: sum minutesPerDay × working-day overlap for each assignment
    scheduled_min = 0
    for a in person_assignments[pid]:
        a_start  = date.fromisoformat(a["startDate"])
        a_end    = date.fromisoformat(a["endDate"])
        ov_start = max(a_start, start)
        ov_end   = min(a_end,   end)
        if ov_end >= ov_start:
            overlap        = _working_days(ov_start, ov_end)
            scheduled_min += (a.get("minutesPerDay") or 0) * overlap

    # Actual: total logged minutes from actuals endpoint
    actual_min = person_actual_min[pid]

    # Convert to hours (1 decimal)
    cap_h   = round(capacity_min  / 60, 1)
    sched_h = round(scheduled_min / 60, 1)
    act_h   = round(actual_min    / 60, 1)

    # Utilization percentages
    util_sched  = round(scheduled_min / capacity_min * 100, 1) if capacity_min > 0 else 0.0
    util_actual = round(actual_min    / capacity_min * 100, 1) if capacity_min > 0 else 0.0

    # Project names (sorted, from both assignments and actuals)
    proj_names = sorted(
        project_map.get(pid2, f"Project {pid2}")
        for pid2 in person_projects[pid]
    )
```

---

## 9. Backend Response Shape

```json
{
  "people": [
    {
      "id": 123,
      "name": "Jane Doe",
      "role": "Senior Designer",
      "capacity_hours": 168.0,
      "scheduled_hours": 120.0,
      "actual_hours": 98.5,
      "util_scheduled_pct": 71.4,
      "util_actual_pct": 58.6,
      "projects": ["GCash: Design Support 2026", "Internal"],
      "has_actuals": true
    }
  ],
  "period": {
    "start": "2026-03-01",
    "end": "2026-03-31",
    "working_days": 21
  },
  "summary": {
    "headcount": 12,
    "avg_util_scheduled": 74.2,
    "avg_util_actual": 61.8,
    "over_capacity_count": 2
  }
}
```

**`has_actuals`**: `true` if `actual_min > 0`. Controls display mode — if false, the util bar shows scheduled % in dim indigo instead of the actual %.

**Default sort** (backend): descending by `util_actual_pct`, falling back to `util_scheduled_pct` for people with no actuals:
```python
result_people.sort(
    key=lambda p: (p["util_actual_pct"] or p["util_scheduled_pct"]),
    reverse=True,
)
```

**Summary `over_capacity_count`**: person is over capacity if `util_actual_pct > 100`, OR if they have no actuals and `util_scheduled_pct > 100`:
```python
over_cap = sum(
    1 for p in with_cap
    if (p["util_actual_pct"] > 100) or
       (p["util_actual_pct"] == 0 and p["util_scheduled_pct"] > 100)
)
```

---

## 10. API Endpoint (Backend)

```
GET /api/runn/utilization?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

Also expose a connectivity check:
```
GET /api/runn/me   → proxies Runn's /me/ endpoint, useful for verifying the API key
```

---

## 11. Frontend — Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│ 👤 Utilization Report         [from] → [to]  [Load button]  │
│    Runn · Scheduled vs Actual                                │
├─────────────────────────────────────────────────────────────┤
│ SUMMARY CARDS (grid 2 cols mobile / 4 cols desktop)          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ Active   │ │ Avg      │ │ Avg      │ │ Over     │        │
│ │ People   │ │ Scheduled│ │ Actual   │ │ Capacity │        │
│ │ 12       │ │ 74.2%    │ │ 61.8%    │ │ 2        │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────────────────┤
│ LEGEND (color key for the util bar)                          │
├─────────────────────────────────────────────────────────────┤
│ TABLE (sortable)                                             │
│ Name | Role | Capacity | Scheduled | Actual | Sched% | Bar  │
│ [rows…]                                                      │
├─────────────────────────────────────────────────────────────┤
│ Period note (right-aligned, small)                           │
└─────────────────────────────────────────────────────────────┘
```

Default date range: current calendar month (first day → last day of month).

---

## 12. Frontend State

```js
const range = currentMonthRange()   // { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
const [startDate, setStartDate] = useState(range.start)
const [endDate,   setEndDate]   = useState(range.end)
const [data,      setData]      = useState(null)
const [loading,   setLoading]   = useState(false)
const [sort,      setSort]      = useState({ col: 'util_actual_pct', asc: false })
```

`currentMonthRange()`:
```js
function currentMonthRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt   = (d) => d.toISOString().split('T')[0]
  return { start: fmt(start), end: fmt(end) }
}
```

Load is triggered manually (Load button click) after the initial mount auto-load.

---

## 13. Sorting

Client-side. Clicking any column header toggles asc/desc; clicking a different column defaults to descending.

```js
const handleSort = (col) => {
  setSort(prev => ({ col, asc: prev.col === col ? !prev.asc : false }))
}

const sorted = data?.people
  ? [...data.people].sort((a, b) => {
      const av = a[sort.col] ?? 0
      const bv = b[sort.col] ?? 0
      if (typeof av === 'string') return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av)
      return sort.asc ? av - bv : bv - av
    })
  : []
```

Sortable columns: `name`, `role`, `capacity_hours`, `scheduled_hours`, `actual_hours`, `util_scheduled_pct`, `util_actual_pct`. Default: `util_actual_pct` descending.

---

## 14. Util Bar and Color Logic

```js
function utilColor(pct, hasActuals) {
  if (!hasActuals) return 'bg-accent/40'   // no timesheet yet — dim indigo
  if (pct > 100)   return 'bg-red-500'     // over capacity
  if (pct >= 80)   return 'bg-green-500'   // healthy utilization
  if (pct >= 50)   return 'bg-yellow-500'  // moderate
  return 'bg-gray-500'                     // underutilized
}

function utilTextColor(pct, hasActuals) {
  if (!hasActuals) return 'text-accent'
  if (pct > 100)   return 'text-red-400'
  if (pct >= 80)   return 'text-green-400'
  if (pct >= 50)   return 'text-yellow-400'
  return 'text-text-muted'
}
```

The bar displays `util_actual_pct` when `has_actuals` is true, otherwise falls back to `util_scheduled_pct`. Bar width is capped at 100% visually (a person at 120% fills the bar fully; the % text still shows 120%).

```js
function UtilBar({ pct, hasActuals }) {
  // pct can exceed 100 — cap bar width at 100%, show real value in text
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${utilColor(pct, hasActuals)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-12 text-right tabular-nums ${utilTextColor(pct, hasActuals)}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}
```

---

## 15. Table Columns

| Column | Data key | Alignment | Notes |
|---|---|---|---|
| Name | `name` | left | `AlertTriangle` red icon if `util_actual_pct > 100` |
| Role | `role` | left | `text-xs text-text-muted` |
| Capacity | `capacity_hours` | right | `{value}h`, `text-text-muted` |
| Scheduled | `scheduled_hours` | right | `{value}h`, `text-text-primary` |
| Actual | `actual_hours` | right | `{value}h` if `has_actuals`, else `—` in `text-text-muted/40` |
| Sched % | `util_scheduled_pct` | right | `{value}%` in `text-accent` |
| Actual Util | — | left, `w-52` | `UtilBar` component |
| Projects | `projects` | left | `person.projects.join(', ')`, or `Unassigned` in muted/30 |

---

## 16. Summary Cards

Four cards in a `grid-cols-2 md:grid-cols-4` grid:

| Card | Value | Sub |
|---|---|---|
| Active People | `data.summary.headcount` | `{working_days} working days` |
| Avg Scheduled | `{data.summary.avg_util_scheduled}%` | `"of capacity planned"` |
| Avg Actual | `{data.summary.avg_util_actual}%` | `"from timesheets"` or `"no timesheets yet"` if 0 |
| Over Capacity | `data.summary.over_capacity_count` | `"need attention"` or `"none at risk"` |

Card layout:
```
rounded-xl border border-border bg-surface px-5 py-4
  LABEL (10px uppercase muted/60)
  VALUE (2xl bold — accent color if "Avg Scheduled", text-primary otherwise)
  sub (xs muted)
```

---

## 17. Legend

```
Util bar:   [■] Actual ≥ 80%   [■] Actual 50–79%   [■] Over capacity   [■] Scheduled only   [■] Actual < 50%
```

Each swatch: `w-3 h-2 rounded-sm inline-block` with the respective bar color. Text: `text-[11px] text-text-muted`.

---

## 18. Loading and Empty States

**Loading (no data yet):** Centered column — `<Spinner size={28} />` + `"Fetching Runn data…"`.

**Empty (not loaded, not loading):** Centered column — large `Users` icon (40px, muted/20), `"No data loaded"` heading, `"Select a date range and click Load."` subtext.

**Loading with existing data:** The table stays visible while reloading (only the load button shows a spinner). This avoids a full-page flash on refresh.

---

## 19. `.env` Requirements

```
RUNN_API_KEY=your_token_here
RUNN_HOST=https://api.runn.io        # or https://api.us.runn.io for US region
```

If `RUNN_API_KEY` is not set, the backend returns `503` with a clear message instructing the user to add it. The frontend shows this message as a toast error.

---

## 20. Build Order

1. Backend helpers: `_fetch_all()` (cursor paginator), `_working_days()`, `_check_config()`
2. Backend: `GET /api/runn/me` connectivity check endpoint
3. Backend: `GET /api/runn/utilization` — the six parallel fetches, lookup maps, per-person loop, summary
4. Frontend API wrapper: `getUtilization(startDate, endDate)` → `GET /api/runn/utilization?startDate=…&endDate=…`
5. Frontend helpers: `currentMonthRange()`, `utilColor()`, `utilTextColor()`
6. Frontend components: `UtilBar`, `SummaryCard`, `ColHeader`
7. Frontend: `Utilization` page — state, `load()`, sort logic, full render tree
