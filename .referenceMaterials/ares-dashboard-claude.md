# Ares Dashboard — Exact Rebuild Reference

This document is the authoritative, exhaustive specification for recreating the Ares project dashboard exactly as it appears in `frontend/src/pages/Project.jsx`. Every section, sub-component, KPI card, filter, drilldown, chart, table, and export behaviour is documented here in enough detail to rebuild from scratch.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React (Vite) |
| Styling | Tailwind CSS (dark theme) |
| Charts | `recharts` — `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `CartesianGrid`, `ComposedChart`, `Area` |
| Icons | `lucide-react` |
| HTTP | Axios (via thin wrappers in `api/project.js`) |

---

## 2. Design Tokens

Apply these via Tailwind config or CSS variables. The page uses `bg-surface`, `bg-bg`, `border-border`, `text-text-primary`, `text-text-muted`, `text-accent` — map them as follows:

| Token | Dark value |
|---|---|
| `bg` | `#0f0f0f` |
| `surface` | `#1c1c1e` |
| `border` | `#2a2a2e` |
| `text-primary` | `#e8e8e8` |
| `text-muted` | `#6b7280` |
| `accent` | `#6366f1` (indigo) |

Font: `Inter`. All body text is `text-sm`; labels and secondary text are `text-xs` or `text-[10px]`.

---

## 3. Color Constants

### `TRELLO_COLORS` — label badge colors

```js
const TRELLO_COLORS = {
  red:     { bg: 'bg-red-500/20',     text: 'text-red-400',     dot: '#ef4444' },
  orange:  { bg: 'bg-orange-500/20',  text: 'text-orange-400',  dot: '#f97316' },
  yellow:  { bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  dot: '#eab308' },
  green:   { bg: 'bg-green-500/20',   text: 'text-green-400',   dot: '#22c55e' },
  blue:    { bg: 'bg-blue-500/20',    text: 'text-blue-400',    dot: '#3b82f6' },
  purple:  { bg: 'bg-purple-500/20',  text: 'text-purple-400',  dot: '#a855f7' },
  pink:    { bg: 'bg-pink-500/20',    text: 'text-pink-400',    dot: '#ec4899' },
  sky:     { bg: 'bg-sky-500/20',     text: 'text-sky-400',     dot: '#0ea5e9' },
  lime:    { bg: 'bg-lime-500/20',    text: 'text-lime-400',    dot: '#84cc16' },
  default: { bg: 'bg-white/10',       text: 'text-text-muted',  dot: '#6b7280' },
}
function labelStyle(color) {
  return TRELLO_COLORS[color?.toLowerCase()] || TRELLO_COLORS.default
}
```

### `DIST_COLORS` — bar chart / distribution bar colors

```js
const DIST_COLORS = {
  'Work Lane':    '#6366f1',
  'Process Lane': '#a855f7',
  'Misc':         '#6b7280',
  'OPS':          '#0ea5e9',
  'Backlog':      '#6b7280',
  'Content':      '#f59e0b',
  'Design':       '#ec4899',
  'Dev':          '#22c55e',
  'Screens':      '#3b82f6',
  'Assets':       '#f97316',
  'Motion':       '#8b5cf6',
  'Discarded':    '#4b5563',
  'Pending':      '#3b82f6',
  'Ongoing':      '#eab308',
  'Done':         '#22c55e',
  'For Review':   '#f97316',
  'Revising':     '#ef4444',
  'For Approval': '#a855f7',
}
```

### `STATUS_COLOR` — pipeline table cell badge colors

```js
const STATUS_COLOR = {
  'Pending':      '#3b82f6',
  'Ongoing':      '#eab308',
  'For Review':   '#f97316',
  'Revising':     '#ef4444',
  'For Approval': '#a855f7',
  'Done':         '#22c55e',
}
```

### `STATUS_ABBREV` — pipeline table column headers

```js
const STATUS_ABBREV = {
  'Pending':      'Pnd',
  'Ongoing':      'Ong',
  'For Review':   'Rev',
  'Revising':     'Rvs',
  'For Approval': 'App',
  'Done':         'Done',
}
```

### `STATUS_ORDER` — canonical ordering

```js
const STATUS_ORDER = ['Pending', 'Ongoing', 'For Review', 'Revising', 'For Approval', 'Done']
```

---

## 4. `LANE_MAP` — Full Board Taxonomy

The `LANE_MAP` maps every Ares board list name to `{ type, category, status }`. This is the most critical constant — it drives KPI counts, the pipeline table, throughput chart coloring, and the distribution panel.

**Structure per entry:** `'List Name': { type: 'Work Lane'|'Process Lane'|'Misc', category: string, status: string }`

Copy verbatim from `Project.jsx` lines 866–1017. Key excerpts:

**Work Lane categories:** OPS, Backlog, Content, Design, Dev  
**Process Lane categories:** Backlog, Content, Screens, Assets, Motion, Dev  
**Misc:** Discarded Work, Unused Work → `{ type: 'Misc', category: 'Discarded', status: 'Discarded' }`

Work Lane status values: `Pending | Ongoing | Done`  
Process Lane status values: `Pending | Ongoing | For Review | Revising | For Approval | Done`

---

## 5. Pipeline Column Group Definitions

These define the column structure for the Pipeline Table's two modes:

```js
const PROCESS_COL_GROUPS = [
  { category: 'Backlog', color: '#6b7280', statuses: ['Pending'] },
  { category: 'Content', color: '#f59e0b', statuses: ['Ongoing','For Review','Revising','For Approval','Done'] },
  { category: 'Screens', color: '#3b82f6', statuses: ['Ongoing','For Review','Revising','For Approval','Done'] },
  { category: 'Assets',  color: '#f97316', statuses: ['Ongoing','For Review','Revising','For Approval','Done'] },
  { category: 'Motion',  color: '#8b5cf6', statuses: ['Ongoing','For Review','Revising','For Approval','Done'] },
  { category: 'Dev',     color: '#22c55e', statuses: ['Ongoing','For Review','Revising','For Approval','Done'] },
]

const WORK_COL_GROUPS = [
  { category: 'Backlog', color: '#6b7280', statuses: ['Pending'] },
  { category: 'Content', color: '#f59e0b', statuses: ['Pending','Ongoing','Done'] },
  { category: 'Design',  color: '#ec4899', statuses: ['Pending','Ongoing','Done'] },
  { category: 'Dev',     color: '#22c55e', statuses: ['Pending','Ongoing','Done'] },
]
```

---

## 6. Helper Functions

### Date utilities

```js
function getDateRange(days) {
  // Returns { dateFrom: 'YYYY-MM-DD', dateTo: 'YYYY-MM-DD' }
  // dateTo = today, dateFrom = today minus `days`
}

function isOverdue(due) {
  // Returns true if due is a non-null date in the past
}

function fmtDate(iso) {
  // "Mar 19, 2026" format (month short, day, year). Returns '—' if null.
}

function fmtDateShort(iso) {
  // "Mar 19" format. Returns '' if null.
}
```

### Throughput aggregation

```js
function extractDate(m) {
  // Tries movedAt, date, timestamp, createdAt, dateLastActivity, at, occurredAt,
  // eventDate, action_date, moved_at, created_at — returns Date or null
}

function extractList(m) {
  // Tries toList, listAfter, list, listName, currentList, destinationList, to
}

function getPeriodKey(d, period) {
  // 'daily'   → 'YYYY-MM-DD'
  // 'weekly'  → ISO week start Sunday 'YYYY-MM-DD'
  // 'monthly' → 'YYYY-MM'
}

function formatPeriodLabel(key, period) {
  // 'daily'   → 'M/D'     (e.g. "3/19")
  // 'weekly'  → 'Mon D'   (e.g. "Mar 19")
  // 'monthly' → 'Mon YY'  (e.g. "Mar 26")
}

function aggregateThroughput(doneCards, period, cutoff) {
  // Buckets done cards by dateLastActivity. Cards before cutoff (Date) are excluded.
  // Each bucket: { key, label, work, process, total, cards[] }
  // 'work' = LANE_MAP type 'Work Lane', 'process' = 'Process Lane'
  // Returns array sorted ascending by key.
}
```

### Throughput target helpers

```js
function computeTargetForPeriod(periodKey, period, targets) {
  // Proportionally scales a target's total value to the overlap with the given period.
  // Each target: { id, startDate, endDate, value }
  // Returns a rounded number (1 decimal) or null.
}
```

### MC number extractor

```js
function extractMcNumber(name) {
  // Regex: /mc-(\d+)/i → returns 'MC-123' or null
}
```

### Cycle time helpers

```js
function extractCycleDays(record) {
  // Tries cycleTimeDays, cycleDays, days, cycleTime first.
  // Falls back to cycleHours / 24.
  // Returns a number or null.
}

function extractCardKey(record) {
  // Tries cardId, id, trelloId, name
}
```

---

## 7. Sub-Component Catalog

### 7.1 `KpiCard`

**Purpose:** Renders a single metric tile in the top KPI row.

**Props:**
| Prop | Type | Notes |
|---|---|---|
| `icon` | LucideIcon | Rendered at 14px, top-right of card |
| `label` | string | Uppercase, `text-xs`, `text-text-muted` |
| `value` | string\|number | Large `text-3xl font-bold`, or a pulse skeleton if `loading` |
| `sub` | string | Secondary label below value, `text-xs text-text-muted` |
| `accent` | string | Tailwind class for icon color |
| `loading` | bool | Shows `h-8 w-16 bg-white/5 animate-pulse` skeleton if true |
| `footer` | ReactNode | Rendered below `sub` — used for `StatusDistBar` or type breakdown |
| `onClick` | function\|undefined | If set, card gets `cursor-pointer hover:border-green-500/40 hover:bg-green-500/5` |

**Layout:**
```
┌──────────────────────────────┐
│ LABEL                  icon  │
│ 3xl bold value               │
│ sub text                     │
│ [footer]                     │
└──────────────────────────────┘
```
Container: `bg-surface border border-border rounded-xl p-4 flex flex-col gap-1`

---

### 7.2 `StatusDistBar`

**Purpose:** Horizontal segmented bar showing active card distribution across pipeline statuses. Rendered as the `footer` of the Active Cards KPI.

**Props:** `{ cards }` — the raw active cards array.

**Behavior:**
- Groups cards by `LANE_MAP[card.currentList]?.status`
- Renders a `h-2 w-full rounded-full overflow-hidden` flex bar
- Each status gets a colored segment proportional to its count, using `DIST_COLORS[status]`
- Below the bar: a row of `text-[10px]` legend dots: `StatusName · XX%`
- Status order: `STATUS_ORDER` = `['Pending','Ongoing','For Review','Revising','For Approval','Done']`
- Segments with zero count are skipped

---

### 7.3 `SectionCard`

**Purpose:** Wrapper for the main content panels (Throughput, Cycle Time, Pipeline Distribution, Pipeline).

**Props:**
| Prop | Type | Notes |
|---|---|---|
| `title` | string | Section header text |
| `children` | ReactNode | Body content |
| `className` | string | Extra classes on the outer container |
| `headerRight` | ReactNode | Controls rendered at the right side of the header |
| `drilldown` | bool | Purple accent mode: `border-fuchsia-500/40`, `bg-fuchsia-500/10`, `text-fuchsia-400` |
| `done` | bool | Green accent mode: `border-green-500/40`, `bg-green-500/10`, `text-green-400` |

**Normal mode:** `border-border`, `text-text-muted` header text.

**Layout:**
```
bg-surface rounded-xl border flex flex-col
  ├── header: px-4 py-3 border-b flex items-center justify-between rounded-t-xl
  │     [title]                           [headerRight]
  └── body: p-4 flex-1 min-h-0
```

---

### 7.4 `ThroughputSection`

**Purpose:** The full throughput chart + table + targets panel, rendered inside the Throughput `SectionCard`.

**Props:**
| Prop | Type | Notes |
|---|---|---|
| `doneCards` | array | Already-filtered done cards (from parent) |
| `loading` | bool | Shows `h-52 bg-white/5 rounded animate-pulse` skeleton |
| `cutoff` | Date | Cards before this are excluded from aggregation |
| `boardName` | string | Used in export filenames and chart title |
| `boardId` | string | Used to persist targets via `getSettings`/`updateSetting` |
| `onBarClick` | function | Called with the bucket object when a bar is clicked; triggers drilldown |
| `onPeriodChange` | function | Called when period toggle changes; clears drilldown in parent |
| `allowedPeriods` | string[] | Subset of `['daily','weekly','monthly']` shown in period toggle |
| `view` | `'chart'|'table'` | Controlled from parent |
| `onViewChange` | function | Not used directly; view state is lifted to parent |
| `exportRef` | ref | Parent stores a `handleExport` function here via `exportRef.current = fn` |

**Internal state:** `period` (default `'daily'`), `showTargetsPanel`, `panelPos`, `targets[]`, refs for chart and targets button.

**Targets persistence:**
- On `boardId` change: reads `settings[targets_${boardId}]` (JSON array) from backend
- On `targets` change: writes back to `settings[targets_${boardId}]` via `updateSetting`

**Chart view:** `ComposedChart` with two stacked `Bar`s (Work=`#6366f1`, Process=`#a855f7`) and an optional `Area` for target line (`#f59e0b` dashed, `fillOpacity=0.08`, `type="stepAfter"`). Both bars are clickable → `onBarClick(bucket)`.

**Table view:** Scrollable table (`max-h-[340px]`), sticky header, columns: Period | Work | Process | Total | [Target] | [vs Target]. Target and vs-Target columns only appear when targets exist. `vs Target` cell is color-coded: `>=100%` green, `>=75%` amber, `<75%` red.

**Controls row (above chart/table):**
- Left: Period toggle pill (`Daily | Weekly | Monthly`), filtered to `allowedPeriods`. Active tab: `bg-accent/20 text-accent`.
- Right: Targets button — amber themed if any targets exist or panel is open, shows count `Targets (N)`. Target icon (bullseye).

**Targets panel:** Floating overlay (`fixed z-50 w-80`) positioned below the Targets button. Closed by clicking a backdrop div. Contains `TargetsPanel` component.

**Legend** (below chart only): Three inline items — Work (indigo square), Process (purple square), Target (amber dashed line — only if targets exist).

---

### 7.5 `TargetsPanel`

**Purpose:** Floating panel for managing throughput targets (add/delete).

**Props:** `{ targets, onAdd, onDelete, onClose }`

**Internal state:** `mode` (`'months'|'range'`), `year`, `selectedMonths` (Set), `value` (string), `rangeStart`, `rangeEnd`.

**Layout:**
```
rounded-xl border border-amber-500/25 bg-surface/70 backdrop-blur-md p-4
  ├── Header row: "THROUGHPUT TARGETS" + X close button
  ├── Existing targets list (if any): each row shows value + date range, X to delete
  ├── Divider (if targets exist)
  ├── Mode tabs: [Month Picker] [Custom Range]
  │   Month Picker:
  │     - Year navigator (‹ YYYY ›, clear button if months selected)
  │     - 6-column month grid (Jan–Dec), selected = amber highlighted
  │     - Warning note if non-contiguous months selected
  │   Custom Range:
  │     - 2-column date pickers: From / To
  ├── Target value row:
  │   [number input "Target total for period"] [≈ X/day preview] [+ Add button]
```

**Add behavior:** For month mode, start = first selected month day 1, end = last selected month last day, contiguous range. For range mode, uses raw dates.

**Rate preview:** Shows `≈ X.X/day` when a valid value and date range are both set.

---

### 7.6 `ThroughputTooltip`

**Purpose:** Custom Recharts tooltip for the throughput chart.

**Renders:**
```
bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-lg
  date label (text-muted)
  Work Lane: N  (colored per bar fill)
  Process Lane: N
  ─────────────
  Total: N
  Target: N  (amber, only if present)
```
Only shows bars with `value > 0`. Filters out the `target` dataKey from bar display, shows it separately.

---

### 7.7 `CycleTimeSummary`

**Purpose:** 2×2 grid of cycle time metrics inside the Cycle Time section.

**Props:** `{ cycleTimeData, loading }`

**Loading state:** 2×2 grid of `h-16 bg-white/5 rounded-lg animate-pulse`.

**Computed stats** (from `cycleTimeData`, using `cycleHours` field):
| Stat | Formula | Color |
|---|---|---|
| Aging Cards | Count of records > p85 hours | `#ef4444` red |
| p85 Cycle Time | 85th percentile in days (hours/24) | `#6366f1` indigo |
| Client Turnaround | Avg days for cards where `currentListName` contains "sent for" | `#f97316` orange |
| Pipeline | Avg days for all other cards | `#22c55e` green |

Each cell:
```
bg-white/5 rounded-lg px-3 py-2.5
  LABEL (10px uppercase muted)
  LARGE VALUE (text-xl font-bold, colored)
  sub label (10px muted/50)
```
Values in `X.Xd` format (1 decimal). "—" if no data.

---

### 7.8 `PipelineDistribution`

**Purpose:** Distribution breakdown of active cards with three tab views, inside the Pipeline Distribution section.

**Props:** `{ cards, loading }`

**Loading state:** 4 shimmer bars.

**Tabs:** `Category | Type | Labels`

**Category tab:** DistBar for each category (e.g. Design, Dev, Content…), using `DIST_COLORS[category]`.

**Type tab:** DistBar for `Work Lane` (indigo) and `Process Lane` (purple).

**Labels tab:** Scrollable list (`max-h-[260px]`), each entry:
- Label badge (colored pill using `labelStyle(color)`) — 144px wide, truncated
- Horizontal bar (proportional to max label count), colored with `labelStyle(color).dot`
- Count on the right

**Tab control:** Pill toggle left-aligned. Badge count shown in tab when active.

If unmapped cards exist (not in `LANE_MAP`), a `text-[10px] text-text-muted/40` note shows the count (only for Category and Type tabs).

---

### 7.9 `DistBar`

**Purpose:** Single labeled horizontal bar for `PipelineDistribution`.

**Props:** `{ label, count, mapped, color }`

```
LABEL                   COUNT · PCT%
████████████░░░░░░░░░░  (h-2 rounded-full)
```

---

### 7.10 `PipelineTableView`

**Purpose:** MC-by-category matrix table for pipeline status overview. Two modes: Process or Work lane. Two density options: Full or Compact.

**Props:**
| Prop | Type | Notes |
|---|---|---|
| `activeCards` | array | Unfiltered active cards |
| `doneCards` | array | Unfiltered done cards |
| `loading` | bool | Shimmer skeleton |
| `compact` | bool | Switches between Full (category+status sub-columns) and Compact (status-only columns) |
| `exportRef` | ref | Parent calls `exportRef.current()` to trigger CSV export |
| `onCellClick` | function | Called with `{ mc, category, status, laneType }` when a non-zero cell is clicked |

**Internal state:** `tableType` — `'process'` or `'work'`.

**Toggle:** Pill button: `[Process] [Work]`. Process tab = `bg-purple-500/20 text-purple-400`. Work tab = `bg-accent/20 text-accent`.

**Row construction:** Combines `activeCards + doneCards`, filters by `laneType`, groups by MC number (`extractMcNumber(card.name)`). Sorts numerically by MC number; cards without MC numbers go last (row label `'—'`).

Each row: `{ mc, counts: { 'Category__Status': N }, total, done }`

**Full view header:**
- Row 1: `MC #` (rowSpan 2, sticky left) + category group headers (`colSpan = statuses.length`) + `Done%` (rowSpan 2, sticky right)
- Row 2: Status sub-headers for each category, colored by `STATUS_COLOR`

**Compact view header:** Single row — `MC #` (sticky) + one column per status in `compactStatuses` + `Done%` (sticky right).

**Cells:** Non-zero count shown as `w-7 h-5 rounded font-bold` badge with `${STATUS_COLOR[s]}22` background and `STATUS_COLOR[s]` text. Zero shown as a muted `·`.

**Done% cell:** Color-coded — `100%` = green `#22c55e`, `>=75%` = lime `#84cc16`, `>=50%` = amber, `>=25%` = orange, else white.

**Clickability:** `onCellClick` fires with the drilldown info when a non-zero cell is clicked. Triggers parent to switch to list view and pre-filter.

**CSV export:** Headers = `['MC#', ...category names, 'Done%']`. Exported as browser download.

---

### 7.11 `CardsTable`

**Purpose:** Paginated, sortable, filterable card list. Used for both Active Pipeline (list view) and Done drilldown.

**Props:**
| Prop | Type | Notes |
|---|---|---|
| `cards` | array | Already-filtered cards to display |
| `loading` | bool | Shimmer |
| `listOptions` | string[] | Options for Lists filter picker |
| `labelOptions` | string[] | Options for Labels filter picker |
| `listFilter` | Set | Controlled from parent |
| `labelFilter` | Set | Controlled from parent |
| `onListToggle` | fn | Parent handler |
| `onLabelToggle` | fn | Parent handler |
| `cycleTimeMap` | object | `{ cardId → days }` lookup |
| `typeFilter` | `'all'|'work'|'process'` | Controlled from parent |
| `onTypeFilterChange` | fn | Parent handler |
| `hideOverdue` | bool | Hides the "Overdue only" toggle (used in Done drilldown) |
| `initialSearch` | string | Pre-populates the search box (used in drilldown from pipeline table) |

**Internal state:** `showOverdue`, `sortKey` (default `'due'`), `sortDir` (default `'asc'`), `page` (default 1), `search`.

**Filter bar (left to right):**
1. Text search input (144px, `Search cards…` placeholder)
2. `FilterPicker` for Lists
3. `FilterPicker` for Labels
4. Type toggle: `[All] [Work] [Process]` — Work=indigo, Process=purple active styles
5. Overdue toggle (red, alert icon) — hidden if `hideOverdue`
6. Right side: `N cards` count

**Sort:** Clicking column headers for Card, List, Due cycles through asc/desc. Activity is an additional sort key. Sort icon: `ChevronUp` (asc) or `ChevronDown` (desc) next to active column.

**Table columns:**
| Column | Visibility | Notes |
|---|---|---|
| MC # | always | `text-xs font-mono` indigo badge if found, else `—` |
| Card | always | Card name. If overdue: `AlertTriangle` red icon + `text-red-300` text |
| Type | `md+` | `Work` indigo badge or `Process` purple badge |
| List | `md+` | Muted pill badge |
| Labels | `lg+` | Up to 3 colored pills + `+N` overflow |
| Members | `xl+` | Up to 2 names, `+N more` overflow |
| Due | always | Red if overdue, muted otherwise. `—` if no due date |
| Cycle Time | `lg+` | `X.Xd` in purple `#a855f7`. `—` if no data |

**Pagination:** 15 cards per page. Shows `Page N of M` + Prev/Next buttons.

---

### 7.12 `ThroughputDrilldownTable`

**Purpose:** Simplified card table shown when a throughput chart bar is clicked.

**Props:** `{ cards }` — the `cards[]` array from the clicked bucket.

**Columns:** Card | Lane | Type | Labels | Completed

- Type badge: Work (indigo) or Process (purple)
- Lane: muted pill
- Labels: up to 3 colored pills + overflow
- Completed: `fmtDate(card.dateLastActivity)`

**Responsive:** Lane hidden below `md`, Type/Labels hidden below `lg`.

---

### 7.13 `FilterPicker`

**Purpose:** Dropdown filter button with search and multi-select. Used for Lists and Labels filters.

**Props:** `{ label, options, selected (Set), onToggle }`

**Trigger button:** Shows label + count badge if any selected (indigo filled badge). `ChevronDown` icon. Active state: `bg-accent/10 text-accent border-accent/30`.

**Dropdown:**
- Search input (auto-focused)
- Scrollable option list (`max-h-[240px]`): each option has a colored dot + name + `Check` icon if selected
- "Clear all" button at bottom (only if any selected)
- Right-click on an option also toggles it

---

## 8. Export Functions

### `exportChartAsPng(containerEl, filename, { isDark, title })`

Exports the SVG chart inside `containerEl` as a PNG at 2× DPR. Steps:
1. Clone the SVG, inject a background rect
2. Render to canvas via `img.onload`
3. Optionally prepend a 32px title bar with `bold 12px system-ui` text
4. Trigger `<a download>` click

### `exportTableAsPng(data, period, boardName, isDark)`

Exports the throughput table as a canvas-rendered PNG (not a DOM screenshot). Steps:
1. Measure column widths from content using a scratch canvas context
2. Columns: Period | Work | Process | Total | [Target] | [vs Target]
3. Target/vs-Target columns only appear if any row has a target
4. `vs Target` % cell gets green/amber/red coloring
5. 2× DPR, `TITLE_H=32`, `HEADER_H=36`, `ROW_H=30`, `PAD=16`
6. Title: `"Throughput — {Period} | {boardName}"`

### `exportPipelineTableAsCsv(rows, colGroups, tableType, boardName)`

Exports pipeline table as CSV. Headers: `MC# | ...category names | Done%`. Values are totals per category (aggregated across statuses). File: `pipeline_{process|work}_{boardName}.csv`.

---

## 9. Data Fetching

### API calls (from `api/project.js` — thin Axios wrappers)

| Function | What it returns |
|---|---|
| `listBoards()` | `[{ boardId, projectName }]` — all boards |
| `boardCards(boardId, { status, pageSize, page })` | `{ data: [...cards], meta: { pagination } }` |
| `boardMovements(boardId, { dateFrom, dateTo, pageSize, page })` | `{ data: [...movements] }` |
| `boardSummary(boardId)` | Board summary stats object |
| `cycleTime(rtProjectId, { dateFrom, dateTo, status, pageSize, page })` | `{ data: [...cycleRecords] }` |
| `listRaintoolProjects()` | `[{ id, name }]` — Raintool project list |

### Paginator helpers (defined inside the main component)

```js
const fetchAllCards = async (boardId, status) => {
  const pageSize = 200
  let page = 1, all = []
  while (true) {
    const res = await boardCards(boardId, { status, pageSize, page })
    const batch = res.data?.data || []
    all = all.concat(batch)
    if (batch.length < pageSize) break
    page++
  }
  return all
}

const fetchAllMovements = async (boardId, dateFrom, dateTo) => {
  const pageSize = 200
  let page = 1, all = []
  while (true) {
    const res = await boardMovements(boardId, { dateFrom, dateTo, pageSize, page })
    const batch = res.data?.data || []
    all = all.concat(batch)
    if (batch.length < pageSize) break
    page++
  }
  return all
}

const fetchAllCycleTime = async (rtProjectId, dateFrom, dateTo) => {
  const pageSize = 200
  let page = 1, all = []
  while (true) {
    const res = await cycleTime(rtProjectId, { dateFrom, dateTo, status: 'all', pageSize, page })
    const batch = res.data?.data || []
    all = all.concat(batch)
    if (batch.length < pageSize) break
    page++
  }
  return all
}
```

### `loadBoardData(boardId, dateFrom, dateTo, rtProjectId, boardName)`

Runs these 5 fetches in parallel via `Promise.all`:
1. `boardSummary(boardId)` → `summary`
2. `fetchAllCards(boardId, 'active')` → `activeCards`
3. `fetchAllCards(boardId, 'done')` → `doneCards`
4. `fetchAllMovements(boardId, dateFrom, dateTo)` → `movements`
5. `fetchAllCycleTime(rtProjectId, dateFrom, dateTo)` → `cycleTimeData`

On success: sets all state, calls `saveProjectSnapshot`.  
On error: sets `error` string.  
`boardSummary` and `fetchAllMovements` and `fetchAllCycleTime` are wrapped with `.catch(() => ...)` so a failure of one does not abort the others.

### Board list fuzzy matching

`resolveRtProjectId(boardName, rtProjects)` — fuzzy matches a board name to a Raintool project ID using word-overlap scoring. Score threshold: 0.3. Returns `null` if no match above threshold.

---

## 10. Main Page State

```js
// Board selection
const [boards, setBoards]               = useState([])
const [selectedBoard, setSelectedBoard] = useState(null)
const [dateRange, setDateRange]         = useState(30)     // 7 or 30
const [rtProjectMap, setRtProjectMap]   = useState({})     // boardId → rtProjectId

// Board data
const [summary, setSummary]             = useState(null)
const [activeCards, setActiveCards]     = useState([])
const [doneCards, setDoneCards]         = useState([])
const [movements, setMovements]         = useState([])
const [cycleTimeData, setCycleTimeData] = useState([])

// UI state
const [loadingBoards, setLoadingBoards] = useState(true)
const [loadingBoard, setLoadingBoard]   = useState(false)
const [error, setError]                 = useState(null)
const [lastRefreshed, setLastRefreshed] = useState(null)

// Drilldown modes (mutually exclusive)
const [throughputDrilldown, setThroughputDrilldown] = useState(null)   // null or bucket object
const [doneDrilldown, setDoneDrilldown]             = useState(false)

// Pipeline view options
const [pipelineView, setPipelineView]       = useState('list')    // 'list' | 'table'
const [pipelineCompact, setPipelineCompact] = useState(false)
const [throughputView, setThroughputView]   = useState('chart')   // 'chart' | 'table'

// Filters
const [typeFilter, setTypeFilter]       = useState('all')         // 'all' | 'work' | 'process'
const [listFilter, setListFilter]       = useState(new Set())     // active cards lists
const [labelFilter, setLabelFilter]     = useState(new Set())     // active cards labels
const [doneListFilter, setDoneListFilter]   = useState(new Set()) // done cards lists
const [doneLabelFilter, setDoneLabelFilter] = useState(new Set()) // done cards labels
const [drilldownSearch, setDrilldownSearch] = useState('')        // pre-fill search in list

// Custom date range
const [customRange, setCustomRange]     = useState(null)    // { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } or null
const [showCalendar, setShowCalendar]   = useState(false)
const [pendingFrom, setPendingFrom]     = useState(`${new Date().getFullYear()}-01-01`)
const [pendingTo, setPendingTo]         = useState(today)

// Export refs
const throughputExportRef = useRef(null)
const pipelineExportRef   = useRef(null)
```

---

## 11. Derived Data (`useMemo`)

| Variable | Derivation |
|---|---|
| `overdueCount` | Active cards past due, filtered by `typeFilter` |
| `periodActiveCount` | Active cards with `dateLastActivity >= throughputCutoff`, filtered by `typeFilter` |
| `periodDoneCount` | Done cards with `dateLastActivity >= throughputCutoff`, filtered by `typeFilter` |
| `periodLabel` | `"last 30d"` or `"MM/DD – MM/DD"` for custom |
| `listOptions` | Unique non-null `currentList` values from `activeCards`, sorted |
| `labelOptions` | Unique non-null label names from `activeCards.labels`, sorted |
| `doneListOptions` | Same from `doneCards` |
| `doneLabelOptions` | Same from `doneCards` |
| `cycleTimeMap` | `{ cardId → days }` built from `cycleTimeData` |
| `filteredActiveCards` | `activeCards` filtered by `listFilter`, `labelFilter`, `typeFilter` |
| `filteredDoneCards` | `doneCards` filtered by `listFilter`, `labelFilter`, `typeFilter` |
| `filteredDoneForDrilldown` | `doneCards` filtered by `typeFilter`, `doneListFilter`, `doneLabelFilter` |
| `doneTypeBreakdown` | `{ work: N, process: N }` counts from `doneCards` |
| `throughputCutoff` | If `customRange`: Date from `customRange.from`. Else: today minus `dateRange` days. |
| `allowedPeriods` | `customRange` → all three; `dateRange=7` → `['daily']`; `dateRange=30` → `['daily','weekly']` |
| `boardMeta` | `boards.find(b => b.boardId === selectedBoard?.boardId) || selectedBoard` |

---

## 12. Snapshot Infrastructure

Snapshots record weekly board state to `localStorage` for period-over-period tracking. Called automatically on every successful `loadBoardData`.

### Storage schema

- **Snapshot:** `localStorage["ppms_snapshot_{boardId}_{weekKey}"]` → JSON
- **Index:** `localStorage["ppms_snapshot_index_{boardId}"]` → JSON array of week keys

### `getISOWeekKey(date)` → `"YYYY-Www"` (e.g. `"2026-W12"`)

### `saveProjectSnapshot(boardId, boardName, activeCards, doneCards)`

Saves:
```js
{
  timestamp, weekKey, boardId, boardName,
  metrics: {
    activeCount, doneCount, overdueCount,
    processActive, workActive,
    throughputLast7, throughputLast30,
    laneBreakdown: { 'Work Lane': { status: count }, 'Process Lane': { ... } }
  }
}
```
Maintains sorted index per board, max 52 weeks (oldest pruned).

### Exported functions

```js
export function getProjectSnapshot(boardId, weekKey)   // → snapshot or null
export function getPreviousProjectSnapshot(boardId)    // → most recent snapshot before current week
export function getSnapshotIndex(boardId)              // → sorted array of saved week keys
```

---

## 13. Page Layout

The root renders a full-height scrollable div with `p-6 space-y-5`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: "Project Dashboard" (h1)    [Board selector ▼] [7d][30d][📅] [↻] │
│ "Updated HH:MM AM"                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ [Error banner — only if error exists and boards are loaded]              │
├─────────────────────────────────────────────────────────────────────────┤
│ KPI ROW (grid-cols-2 lg:grid-cols-4, gap-3)                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│ │ Active  │ │  Done   │ │Overdue  │ │Activity │                         │
│ │ Cards   │ │ Cards   │ │         │ │(moves)  │                         │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                        │
├─────────────────────────────────────────────────────────────────────────┤
│ SECTION ROW (grid md:4 lg:8 cols, gap-4)                                │
│ ┌────────────────────┐ ┌──────────┐ ┌──────────────────┐               │
│ │   THROUGHPUT       │ │  CYCLE   │ │   PIPELINE       │               │
│ │   (4 cols)         │ │  TIME    │ │   DISTRIBUTION   │               │
│ │   [chart|table]▼  │ │  (2 col) │ │   (2 cols)       │               │
│ │   [Download]       │ │  2x2     │ │   [Cat|Typ|Lbl]  │               │
│ └────────────────────┘ └──────────┘ └──────────────────┘               │
├─────────────────────────────────────────────────────────────────────────┤
│ PIPELINE SECTION (full width)                                            │
│ One of three mutually exclusive states:                                  │
│  A. THROUGHPUT DRILLDOWN — fuchsia header, card list for clicked period  │
│  B. DONE DRILLDOWN — green header, full done cards table with filters    │
│  C. ACTIVE PIPELINE — normal header, [List|Table] toggle                 │
│     List: CardsTable with filters                                        │
│     Table: PipelineTableView (Process|Work toggle, compact toggle, CSV)  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Header Controls

### Board selector
`<select>` styled with `input text-sm py-1.5 h-auto min-w-[200px]`. Options are `boards[]`. On change: stores `ppms_last_board` in localStorage, triggers `loadBoardData`.

On initial mount, restores last-viewed board via `localStorage.getItem('ppms_last_board')`.

### Date range toggle
`[7d][30d]` pill buttons. Active: `bg-accent/20 text-accent`. Selecting clears `customRange`.

### Calendar button
Separate from the 7d/30d group (different border radius). Calendar icon. If `customRange` active: shows the date range inline and uses `bg-accent/20 text-accent border-accent/30`.

**Dropdown (positioned `right-0 top-full mt-1`):**
- "Custom Range" label
- From date input (max = `pendingTo`)
- To date input (min = `pendingFrom`, max = today)
- `[Apply]` button (disabled if either date missing)
- `[Clear]` button (only if `customRange` active)

Apply sets `customRange` and closes the dropdown but does NOT auto-reload data — the user must click Refresh.

### Refresh button
`<RefreshCw>` icon (13px). Spins (`animate-spin`) while `loadingBoard`. Calls `refresh()`.

---

## 15. KPI Cards Detail

### Active Cards
- Icon: `Circle` (accent)
- Value: `periodActiveCount`
- Sub: `"active in last Nd"` or `"active in MM/DD – MM/DD"`
- Footer: `StatusDistBar` (segmented status bar across pipeline statuses)

### Done Cards
- Icon: `CheckCircle2` (green-500)
- Value: `periodDoneCount`
- Sub: `"completed in ..."`
- Clickable (onClick) → sets `doneDrilldown=true`
- Footer: Two colored dots — `Work: N` (indigo `#6366f1`) and `Process: N` (purple `#a855f7`) separated by a `border-t border-border/40`

### Overdue
- Icon: `AlertTriangle`
- Value: `overdueCount`
- Sub: `"past due date"`
- Icon color: `text-red-400` if count > 0, else `text-text-muted/40`

### Period Activity
- Icon: `TrendingUp` (yellow-500)
- Value: `movements.length`
- Sub: `"movements in last Nd"` or `"movements {from} – {to}"`

---

## 16. Throughput Section Detail

### Chart bars
- Work lane: `fill="#6366f1"`, `stackId="a"`, `maxBarSize=40`
- Process lane: `fill="#a855f7"`, `stackId="a"`, `radius=[3,3,0,0]`, `maxBarSize=40`
- Target area: `stroke="#f59e0b"`, `strokeDasharray="5 3"`, `fillOpacity=0.08`, `type="stepAfter"`, `connectNulls`, `isAnimationActive=false`
- Both bars have `cursor: pointer` if `onBarClick` is set
- Chart margins: `{ top: 4, right: 4, left: -20, bottom: 0 }`
- Height: `280px`
- Grid: horizontal only (`vertical={false}`), `stroke` = `chartColors.grid`
- Axes: no axis lines or tick lines

### `chartColors` — theme-aware

```js
const chartColors = isDark
  ? { grid: '#2a2a2e', axis: '#6b7280', cursor: 'rgba(255,255,255,0.05)' }
  : { grid: '#e4e4e7', axis: '#9ca3af', cursor: 'rgba(0,0,0,0.04)' }
```

---

## 17. Pipeline Section — Drilldown States

### State A: Throughput Drilldown (fuchsia)
Triggered by clicking a bar in the throughput chart. `SectionCard` with `drilldown` prop active.
- Title: `"Throughput — {label} ({N} cards)"`
- Header right: `X Back to Active Cards` button (fuchsia)
- Body: `ThroughputDrilldownTable` with the bucket's `cards[]`
- Clearing: clicking the X button or changing the throughput period

### State B: Done Drilldown (green)
Triggered by clicking the Done Cards KPI.
- Title: `"Done Cards — N of M"` (or just N if unfiltered)
- Header right: `X Back to Active Cards` button (green)
- Body: `CardsTable` with `filteredDoneForDrilldown`, separate list/label filter state (`doneListFilter`, `doneLabelFilter`), `hideOverdue=true`
- Clearing: clicking the X button

### State C: Active Pipeline (normal)
Default state. `SectionCard` with no accent.
- Title: `"Pipeline (N of M)"` (or just N if no filters active)
- Header right:
  - If `pipelineView === 'table'`: compact toggle (Minimize2 icon) + CSV export button (Download icon)
  - Always: `[List][Table]` view toggle

**List view:** `CardsTable` with `filteredActiveCards`, shared `listFilter`/`labelFilter`/`typeFilter`.

**Table view:** `PipelineTableView` with full unfiltered `activeCards` and `doneCards` (filtering happens via the table's own MC row structure). `compact` prop from `pipelineCompact` state. `onCellClick` = `handlePipelineTableDrilldown`.

---

## 18. Pipeline Cell Drilldown (`handlePipelineTableDrilldown`)

When a cell is clicked in `PipelineTableView`:
```js
// { mc, category, status, laneType }
// 1. Find all LANE_MAP list names matching laneType + (category if full view) + status
// 2. Set drilldownSearch = mc (if not '—')
// 3. If status === 'Done': set doneListFilter, clear throughputDrilldown, set doneDrilldown=true
// 4. Else: set listFilter to matching lists, switch to list view
```

---

## 19. Loading States

### Initial load (boards)
Full-page center: `<Spinner size={24} /> Connecting to Ares…`

### Board load error (no boards loaded)
Full-page center:
- `AlertCircle` red icon (36px, 60% opacity)
- "Could not reach Ares" heading
- Error detail text
- "Retry" button → `window.location.reload()`

### Board load error (boards already loaded)
Non-blocking red banner below header:
`AlertCircle` icon + error message. `bg-red-500/10 border border-red-500/20 text-xs text-red-400`

---

## 20. Interaction Wiring Summary

| User action | What happens |
|---|---|
| Select board from dropdown | `loadBoardData`, save to localStorage |
| Click 7d / 30d | `setDateRange`, clear `customRange` |
| Apply custom range | `setCustomRange`, close calendar |
| Click Refresh | `loadBoardData` with current range |
| Click throughput bar | `setThroughputDrilldown(bucket)` — Pipeline section switches to State A |
| Change throughput period | `setThroughputDrilldown(null)` |
| Click Done Cards KPI | `setDoneDrilldown(true)`, `setThroughputDrilldown(null)` — Pipeline switches to State B |
| Click X in drilldown header | Clear drilldown state, return to State C |
| Click pipeline table cell | `handlePipelineTableDrilldown` — goes to list view or done drilldown |
| Toggle List/Table in Pipeline | `setPipelineView` |
| Toggle compact in Pipeline Table | `setPipelineCompact` |
| Toggle chart/table in Throughput | `setThroughputView` |
| Click Download (Throughput) | `throughputExportRef.current?.()` → PNG |
| Click Download (Pipeline Table) | `pipelineExportRef.current?.()` → CSV |
| Set Targets | Stored in backend settings key `targets_{boardId}` |

---

## 21. Build Order

1. Constants: `LANE_MAP`, `DIST_COLORS`, `STATUS_COLOR`, `STATUS_ABBREV`, `STATUS_ORDER`, `TRELLO_COLORS`, `PROCESS_COL_GROUPS`, `WORK_COL_GROUPS`, `DATE_RANGES`, `PERIOD_OPTS`, `MONTH_NAMES`
2. Pure helpers: all date/aggregation/extract functions
3. Export helpers: `exportChartAsPng`, `exportTableAsPng`, `exportPipelineTableAsCsv`
4. Snapshot infrastructure: `getISOWeekKey`, `saveProjectSnapshot`, exported getters
5. Leaf components: `KpiCard`, `SectionCard`, `StatusDistBar`, `DistBar`
6. Tooltip: `ThroughputTooltip`
7. Filter: `FilterPicker`
8. Panel: `TargetsPanel`
9. Feature components: `ThroughputSection`, `CycleTimeSummary`, `PipelineDistribution`
10. Table components: `ThroughputDrilldownTable`, `PipelineTableView`, `CardsTable`
11. Main `Project` export default with all state, derived data, `loadBoardData`, and render tree
