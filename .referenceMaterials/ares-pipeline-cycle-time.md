# Ares Dashboard — Pipeline Table View & Cycle Time Implementation Guide

This document is the precise implementation reference for:

1. **The Pipeline Table View** — its structure rules, lane taxonomy, column organization, row ordering, cell computation, and drilldown wiring.
2. **The Cycle Time Section** — the 2×2 stats panel, stat formulas, and per-card integration.

Read this fully before writing any code. All logic must match exactly.

---

## Part 1: Board Taxonomy — The Foundation of Everything

The entire pipeline table is built on a fixed lane taxonomy sourced from `OPS_ CAPS - Miro's PPMS Cheat Sheet.csv`. Every board list name maps to exactly one `{ Type, Category, Status }` triplet. This mapping is the `LANE_MAP` constant in the code.

### 1.1 The Four Columns of the Taxonomy

| CSV Column | Values | Role |
|---|---|---|
| **Type** | `WORK LANE`, `PROCESS LANE`, `MISC` | Determines which table (Process or Work) the card appears in |
| **Category** | OPS, BACKLOG, CONTENT, DESIGN, DEV, SCREENS, ASSETS, MOTION, Discarded | Becomes a column group in the table |
| **Status** | Pending, Ongoing, For Review, Revising, For Approval, Done, Discarded | Becomes a sub-column within each category group |
| **Lane** | The exact Ares board list name (e.g. `"➜ Screen: Working on it"`) | The lookup key in `LANE_MAP` |

### 1.2 Full Taxonomy Table

This is the complete mapping. Every Ares board list name must match a row here to appear in the pipeline table. Unrecognized list names are silently excluded.

**WORK LANE**

| Category | Status | Board List Name |
|---|---|---|
| OPS | Pending | Operations Backlog |
| OPS | Ongoing | Working on Ops Work |
| OPS | Ongoing | Ready for Ops Review |
| OPS | Ongoing | Reviewing Ops Work |
| OPS | Done | Ops Work Complete |
| BACKLOG | Pending | Production Backlog |
| CONTENT | Pending | Content Backlog |
| CONTENT | Ongoing | Ready for Content |
| CONTENT | Ongoing | Working on Content |
| CONTENT | Ongoing | Ready for Content Peer Review |
| CONTENT | Ongoing | Working on Content Peer Review |
| CONTENT | Ongoing | Ready for Content Review |
| CONTENT | Ongoing | Working on Content Review |
| CONTENT | Ongoing | Ready for Content Refinement |
| CONTENT | Ongoing | Working on Content Refinement |
| CONTENT | Ongoing | Ready for Content Checks |
| CONTENT | Ongoing | Working on Content Checks |
| CONTENT | Done | Content Complete |
| DESIGN | Pending | Design Backlog |
| DESIGN | Pending | Backlog: Screens |
| DESIGN | Pending | Backlog: Components |
| DESIGN | Pending | Backlog: Normalization |
| DESIGN | Pending | Backlog: Assets |
| DESIGN | Pending | Backlog: Sketch Revisions |
| DESIGN | Pending | Backlog: Render Revisions |
| DESIGN | Pending | Backlog: UI Revisions |
| DESIGN | Pending | Backlog: Icons |
| DESIGN | Pending | Backlog: Motion |
| DESIGN | Ongoing | Ready for Design |
| DESIGN | Ongoing | Working on Design |
| DESIGN | Ongoing | Ready for Peer Review |
| DESIGN | Ongoing | Working on Peer Review |
| DESIGN | Ongoing | Ready for Design Review |
| DESIGN | Ongoing | Working on Design Review |
| DESIGN | Done | Design Complete |
| DEV | Pending | Development Backlog |
| DEV | Pending | Backlog: Bugs and Fixes |
| DEV | Ongoing | Ready for Development |
| DEV | Ongoing | Working on Development |
| DEV | Ongoing | Ready for Dev Peer Review |
| DEV | Ongoing | Working on Dev Peer Review |
| DEV | Ongoing | Ready for Code Review |
| DEV | Ongoing | Working on Code Review |
| DEV | Ongoing | Ready for Design and Content QA |
| DEV | Ongoing | Working on Design and Content QA |
| DEV | Ongoing | Working on Bugs and Fixes |
| DEV | Ongoing | Ready for QA Validation |
| DEV | Ongoing | Validating Bugs and Fixes |
| DEV | Ongoing | Passed QA |
| DEV | Done | Development Complete |

**PROCESS LANE**

| Category | Status | Board List Name |
|---|---|---|
| BACKLOG | Pending | ➜ Process Lane |
| BACKLOG | Pending | Backlog: Process Lane |
| CONTENT | Ongoing | ➜ Ready for Content |
| CONTENT | Ongoing | ➜ Content: Writing Content |
| CONTENT | For Review | ➜ Content: Ready for Client Review |
| CONTENT | For Review | ➜ Content: Sent for Client Review |
| CONTENT | Revising | ➜ Content: With Revision |
| CONTENT | Revising | ➜ Content: Working on Revision |
| CONTENT | For Approval | ➜ Content: Ready for Client Approval |
| CONTENT | For Approval | ➜ Content: Sent for Client Approval |
| CONTENT | Done | ➜ Content: Done |
| SCREENS | Ongoing | ➜ Ready for Screen Design |
| SCREENS | Ongoing | ➜ Screen: Working on it |
| SCREENS | For Review | ➜ Screen: Ready for Client Review |
| SCREENS | For Review | ➜ Screen: Sent for Client Review |
| SCREENS | Revising | ➜ Screen: With Revision |
| SCREENS | Revising | ➜ Screen: Working on Revision |
| SCREENS | For Approval | ➜ Screen: Ready for Client Approval |
| SCREENS | For Approval | ➜ Screen: Sent for Client Approval |
| SCREENS | Done | ➜ Screen: Done |
| SCREENS | Ongoing | ➜ Ready for Componentization |
| SCREENS | Ongoing | ➜ Component: Working on it |
| SCREENS | For Review | ➜ Component: Ready for Client Review |
| SCREENS | For Review | ➜ Component: Sent for Client Review |
| SCREENS | Revising | ➜ Component: With Revision |
| SCREENS | Revising | ➜ Component: Working on Revision |
| SCREENS | For Approval | ➜ Component: Ready for Client Approval |
| SCREENS | For Approval | ➜ Component: Sent for Client Approval |
| SCREENS | Done | ➜ Component: Done |
| ASSETS | Ongoing | ➜ Ready for Sketch |
| ASSETS | Ongoing | ➜ Sketch: Working on it |
| ASSETS | For Review | ➜ Sketch: Ready for Client Review |
| ASSETS | For Review | ➜ Sketch: Sent for Client Review |
| ASSETS | Revising | ➜ Sketch: With Revision |
| ASSETS | Revising | ➜ Sketch: Working on Revision |
| ASSETS | For Approval | ➜ Sketch: Ready for Client Approval |
| ASSETS | For Approval | ➜ Sketch: Sent for Client Approval |
| ASSETS | Ongoing | ➜ Ready for Render |
| ASSETS | Ongoing | ➜ Render: Working on it |
| ASSETS | For Review | ➜ Render: Ready for Client Review |
| ASSETS | For Review | ➜ Render: Sent for Client Review |
| ASSETS | Revising | ➜ Render: With Revision |
| ASSETS | Revising | ➜ Render: Working on Revision |
| ASSETS | For Approval | ➜ Render: Ready for Client Approval |
| ASSETS | For Approval | -> Render: Sent for Client Approval |
| ASSETS | Done | ➜ Render: Done |
| ASSETS | Ongoing | ➜ Ready for CRM Review |
| ASSETS | Ongoing | ➜ Sent for CRM Review |
| ASSETS | Ongoing | ➜ Ready for Brand Review |
| ASSETS | Ongoing | ➜ Sent for Brand Review |
| MOTION | Ongoing | ➜ Ready for Rough Animation |
| MOTION | Ongoing | ➜ Rough Animation: Working on it |
| MOTION | For Review | ➜ Rough Animation: Ready for Client Review |
| MOTION | For Review | ➜ Rough Animation: Sent For Client Review |
| MOTION | Revising | ➜ Rough Animation: With Revision |
| MOTION | Revising | ➜ Rough Animation: Working on Revision |
| MOTION | For Approval | ➜ Rough Animation: Ready for Client Approval |
| MOTION | For Approval | ➜ Rough Animation: Sent For Client Approval |
| MOTION | Ongoing | ➜ Ready for Final Animation |
| MOTION | Ongoing | ➜ Final Animation: Working on it |
| MOTION | For Review | ➜ Final Animation: Ready for Client Review |
| MOTION | For Review | ➜ Final Animation: Sent for Client Review |
| MOTION | Revising | ➜ Final Animation: With Revision |
| MOTION | Revising | ➜ Final Animation: Working on Revision |
| MOTION | For Approval | ➜ Final Animation: Ready for Client Approval |
| MOTION | For Approval | ➜ Final Animation: Sent for Client Approval |
| MOTION | Done | ➜ Final Animation: Done |
| DEV | Ongoing | ➜ Ready for Development |
| DEV | Ongoing | ➜ Development: Working on it |
| DEV | Ongoing | ➜ Ready for DQA |
| DEV | Ongoing | ➜ DQA: Working on it |
| DEV | Ongoing | ➜ Ready for CQA |
| DEV | Ongoing | ➜ CQA: Working on it |
| DEV | For Review | ➜ Ready for Integration |
| DEV | For Review | ➜ Sent for Integration |
| DEV | Ongoing | ➜ Integration: Ongoing |
| DEV | For Approval | ➜ Development: Ready for UAT |
| DEV | For Approval | ➜ Development: Sent for UAT |
| DEV | Revising | ➜ UAT: Ongoing |
| DEV | Revising | ➜ UAT: With Issues |
| DEV | Done | ➜ UAT: Done |
| DEV | Ongoing | ➜ Development: Ready for Release |
| DEV | Ongoing | ➜ Development: Pushed to Production |
| DEV | Ongoing | ➜ Development: Completed |
| DEV | Ongoing | ➜ Development: Released |
| DEV | Done | ➜ Development: Done |

**MISC** (excluded from both tables — never appear as pipeline rows)

| Category | Status | Board List Name |
|---|---|---|
| Discarded | Discarded | Discarded Work |
| Discarded | Discarded | Unused Work |

---

### 1.3 The `LANE_MAP` Constant

The taxonomy table above is encoded as a JavaScript object where the key is the exact board list name and the value is `{ type, category, status }`. The `type` values use title case: `'Work Lane'`, `'Process Lane'`, `'Misc'`. Category and status values match the CSV exactly (title case).

```js
const LANE_MAP = {
  // WORK LANE — OPS
  'Operations Backlog':              { type: 'Work Lane', category: 'OPS',     status: 'Pending' },
  'Working on Ops Work':             { type: 'Work Lane', category: 'OPS',     status: 'Ongoing' },
  // ... (all entries follow the same pattern)

  // PROCESS LANE — SCREENS
  '➜ Screen: Working on it':        { type: 'Process Lane', category: 'Screens', status: 'Ongoing' },
  // Note: CSV uses uppercase 'SCREENS' but LANE_MAP uses 'Screens' (title case)
  // Note: One ASSETS entry uses '->' instead of '➜': '-> Render: Sent for Client Approval'

  // MISC
  'Discarded Work':                  { type: 'Misc', category: 'Discarded', status: 'Discarded' },
  'Unused Work':                     { type: 'Misc', category: 'Discarded', status: 'Discarded' },
}
```

**Important implementation notes:**
- Category names in `LANE_MAP` use title case (not the CSV's ALL CAPS): `OPS`, `Backlog`, `Content`, `Design`, `Dev`, `Screens`, `Assets`, `Motion`, `Discarded`
- One entry deliberately uses `'->'` instead of `'➜'`: `'-> Render: Sent for Client Approval'` — this matches a known Ares data inconsistency
- The `LANE_MAP` key must exactly match the `card.currentList` field returned by the Ares API — any mismatch silently excludes the card

---

## Part 2: Pipeline Table Column Structure Rules

The table has two modes — **Process** and **Work** — each with its own fixed column order. Column order is not dynamic; it is hardcoded in the two column group definitions.

### 2.1 Column Ordering Rules

**Left-to-right category order:**

| Position | Process Table | Work Table |
|---|---|---|
| 1st | Backlog | Backlog |
| 2nd | Content | Content |
| 3rd | Screens | Design |
| 4th | Assets | Dev |
| 5th | Motion | — |
| 6th | Dev | — |
| Last (always sticky-right) | Done% | Done% |

The category order reflects a production pipeline flow: backlog → content → visual/design output → development. This ordering is intentional and must be preserved exactly.

**Within each category — status sub-column order:**

Status sub-columns follow `STATUS_ORDER` which is always:
```
Pending → Ongoing → For Review → Revising → For Approval → Done
```

However, not every category uses all statuses. The statuses shown per category are fixed in the column group definitions:

| Table | Category | Statuses Shown |
|---|---|---|
| Process | Backlog | Pending only |
| Process | Content | Ongoing, For Review, Revising, For Approval, Done |
| Process | Screens | Ongoing, For Review, Revising, For Approval, Done |
| Process | Assets | Ongoing, For Review, Revising, For Approval, Done |
| Process | Motion | Ongoing, For Review, Revising, For Approval, Done |
| Process | Dev | Ongoing, For Review, Revising, For Approval, Done |
| Work | Backlog | Pending only |
| Work | Content | Pending, Ongoing, Done |
| Work | Design | Pending, Ongoing, Done |
| Work | Dev | Pending, Ongoing, Done |

**Why Backlog only shows Pending:** By definition, all cards in backlog lanes are `Pending` status — there are no Backlog lanes mapped to any other status in the taxonomy.

**Why Work Lane categories only show Pending/Ongoing/Done:** The Work Lane taxonomy does not include For Review, Revising, or For Approval statuses. The full client review/approval cycle exists only in the Process Lane.

### 2.2 Column Group Definitions (verbatim)

```js
const PROCESS_COL_GROUPS = [
  { category: 'Backlog', color: '#6b7280', statuses: ['Pending'] },
  { category: 'Content', color: '#f59e0b', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Screens', color: '#3b82f6', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Assets',  color: '#f97316', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Motion',  color: '#8b5cf6', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
  { category: 'Dev',     color: '#22c55e', statuses: ['Ongoing', 'For Review', 'Revising', 'For Approval', 'Done'] },
]

const WORK_COL_GROUPS = [
  { category: 'Backlog', color: '#6b7280', statuses: ['Pending'] },
  { category: 'Content', color: '#f59e0b', statuses: ['Pending', 'Ongoing', 'Done'] },
  { category: 'Design',  color: '#ec4899', statuses: ['Pending', 'Ongoing', 'Done'] },
  { category: 'Dev',     color: '#22c55e', statuses: ['Pending', 'Ongoing', 'Done'] },
]
```

### 2.3 Status Color and Abbreviation Constants

These are used for column header colors and cell badge colors. They must match exactly:

```js
const STATUS_ORDER = ['Pending', 'Ongoing', 'For Review', 'Revising', 'For Approval', 'Done']

const STATUS_ABBREV = {
  'Pending':      'Pnd',
  'Ongoing':      'Ong',
  'For Review':   'Rev',
  'Revising':     'Rvs',
  'For Approval': 'App',
  'Done':         'Done',
}

const STATUS_COLOR = {
  'Pending':      '#3b82f6',  // blue
  'Ongoing':      '#eab308',  // yellow
  'For Review':   '#f97316',  // orange
  'Revising':     '#ef4444',  // red
  'For Approval': '#a855f7',  // purple
  'Done':         '#22c55e',  // green
}
```

---

## Part 3: Pipeline Table Row Structure and Ordering

### 3.1 Row = MC Number

Every row represents one MC (Milestone Card) number, extracted from the card name using:

```js
function extractMcNumber(name) {
  const m = (name || '').match(/mc-(\d+)/i)
  return m ? `MC-${m[1]}` : null
}
```

Cards without `MC-NNN` in their name are grouped into a single `'—'` row.

### 3.2 Row Sort Order (Top-to-Bottom Prioritization)

Rows are ordered **numerically ascending by MC number**, top to bottom:

```
MC-1   ← first row
MC-2
MC-3
...
MC-99  ← last numbered row
—      ← unmapped cards always at the bottom
```

```js
return Object.values(mcMap).sort((a, b) => {
  if (a.mc === '—') return 1   // push '—' to bottom
  if (b.mc === '—') return -1
  const na = parseInt(a.mc.replace('MC-', '')) || 0
  const nb = parseInt(b.mc.replace('MC-', '')) || 0
  return na - nb               // ascending numeric order
})
```

This rule is absolute — there is no secondary sort, no alphabetical fallback, and the `'—'` row always appears last regardless of its card count.

### 3.3 Row Data Structure

Each row is built by iterating all cards (active + done combined) that belong to the current lane type:

```js
const allCards = [...activeCards, ...doneCards]
  .filter(c => LANE_MAP[c.currentList]?.type === laneType)

const mcMap = {}
for (const card of allCards) {
  const mc   = extractMcNumber(card.name) || '—'
  const meta = LANE_MAP[card.currentList]
  if (!meta) continue

  if (!mcMap[mc]) mcMap[mc] = { mc, counts: {}, total: 0, done: 0 }

  const key = `${meta.category}__${meta.status}`   // e.g. 'Design__Ongoing'
  mcMap[mc].counts[key] = (mcMap[mc].counts[key] || 0) + 1
  mcMap[mc].total++
  if (meta.status === 'Done') mcMap[mc].done++
}
```

**The `counts` key format is always `'Category__Status'`** (double underscore separator). Every cell lookup uses this pattern.

**`total`** = all cards for this MC number in this lane (active + done).  
**`done`** = only cards whose `meta.status === 'Done'`.

---

## Part 4: Cell Value Computation

### 4.1 Full View Cell

In the full view, each cell represents one specific `Category × Status` intersection:

```js
const count = row.counts[`${g.category}__${s}`] || 0
```

If `count > 0`, render a badge. If `count === 0`, render a `·` placeholder.

### 4.2 Compact View Cell

In compact view, the status columns are aggregated across ALL categories — each column shows the total count for that status regardless of which category the cards belong to:

```js
const total = colGroups.reduce(
  (sum, g) => sum + (row.counts[`${g.category}__${s}`] || 0),
  0
)
```

### 4.3 Done% Computation

Always based on the row's `total` and `done` values:

```js
const donePct  = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
```

Color thresholds (applied to the Done% cell text color):

```js
const pctColor = donePct === 100 ? '#22c55e'   // green — complete
               : donePct >= 75  ? '#84cc16'    // lime — nearly done
               : donePct >= 50  ? '#eab308'    // amber — over half
               : donePct >= 25  ? '#f97316'    // orange — some progress
               : '#e8e8e8'                     // white — early stage
```

---

## Part 5: Table Visual Structure

### 5.1 Full View Header (2 rows)

```
Row 1: [MC #]  [  BACKLOG  ] [     CONTENT      ] [     SCREENS      ] ... [Done%]
            ↑rowSpan=2      ↑colSpan=N per group                           ↑rowSpan=2
Row 2:         [Pnd]  [Ong] [Rev] [Rvs] [App] [Done] [Ong] [Rev] ...
```

- `MC #` header: `sticky left-0 bg-bg z-10 min-w-[72px]`, spans 2 rows
- Category headers: colored with `g.color`, `colSpan={g.statuses.length}`, `border-b border-l border-border/60`
- Status sub-headers: colored with `STATUS_COLOR[s]`, `title="{category} – {status}"`, `min-w-[36px]`
- `Done%` header: `sticky right-0 bg-bg z-10 min-w-[56px] text-green-400`, spans 2 rows

Header background: Row 1 = `bg-black/30`, Row 2 = `bg-black/20 border-b border-border`

### 5.2 Compact View Header (1 row)

```
[MC #]  [Pnd] [Ong] [Rev] [Rvs] [App] [Done]  [Done%]
```

All status columns are de-duplicated across categories and ordered by `STATUS_ORDER`. This is computed as:

```js
const compactStatuses = STATUS_ORDER.filter(s => colGroups.some(g => g.statuses.includes(s)))
```

For Process table, all 5 statuses appear (Pending through Done, since all are present in at least one group). For Work table, only Pending, Ongoing, Done appear.

Header background: `bg-black/30 border-b border-border`

### 5.3 Body Row Styling

```js
// Alternating row background
className={`border-b border-border last:border-0 hover:bg-white/[0.025] ${ri % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}
```

- `MC #` cell: `sticky left-0 bg-surface z-10 border-r border-border/30 font-mono font-bold text-accent`
- `Done%` cell: `sticky right-0 bg-surface z-10 border-l border-border font-bold tabular-nums`, colored by `pctColor`
- Data cells: `border-l border-border/20 tabular-nums`, `cursor-pointer hover:bg-white/5` if count > 0 and `onCellClick` provided

### 5.4 Cell Badge Appearance

Non-zero counts render as colored inline badges:

```jsx
<span
  className="inline-flex items-center justify-center rounded font-bold text-[11px]"
  style={{
    background: `${STATUS_COLOR[s]}22`,   // hex color + '22' = ~13% opacity
    color: STATUS_COLOR[s],
    // Full view: w-6 h-5
    // Compact view: w-7 h-5
  }}
>
  {count}
</span>
```

Zero counts render as: `<span className="text-border/60 select-none">·</span>`

### 5.5 Type Toggle (above the table)

```
[ Process ]  [ Work ]    24 MCs
```

- Process active: `bg-purple-500/20 text-purple-400`
- Work active: `bg-accent/20 text-accent`
- Inactive: `text-text-muted hover:text-text-primary hover:bg-white/5`
- MC count: `text-xs text-text-muted`

---

## Part 6: Cell Click Drilldown

Clicking any non-zero cell triggers `onCellClick` with:

```js
// Full view
onCellClick({ mc: row.mc, category: g.category, status: s, laneType })

// Compact view — category is null because the count is aggregated
onCellClick({ mc: row.mc, category: null, status: s, laneType })
```

The parent handles this with `handlePipelineTableDrilldown`:

```js
const handlePipelineTableDrilldown = ({ mc, category, status, laneType }) => {
  // Find all board list names that match the clicked cell's criteria
  const matchingLists = Object.entries(LANE_MAP)
    .filter(([, v]) =>
      v.type === laneType &&
      (category ? v.category === category : true) &&  // compact: match any category
      v.status === status
    )
    .map(([k]) => k)

  // Pre-fill the card list search with the MC number (empty if '—' row)
  const searchTerm = mc !== '—' ? mc : ''
  setDrilldownSearch(searchTerm)

  if (status === 'Done') {
    // Route to Done drilldown (green header)
    setDoneListFilter(new Set(matchingLists))
    setThroughputDrilldown(null)
    setDoneDrilldown(true)
  } else {
    // Route to list view, filtered to matching board lists
    setListFilter(new Set(matchingLists))
    setPipelineView('list')
  }
}
```

**What this achieves:** Clicking `MC-5 | Screens | For Review` in the full process table opens the list view showing only MC-5 cards that are currently in any Screens "For Review" board list (i.e. `➜ Screen: Ready for Client Review`, `➜ Screen: Sent for Client Review`, `➜ Component: Ready for Client Review`, `➜ Component: Sent for Client Review`), with `"MC-5"` pre-filled in the search box.

---

## Part 7: CSV Export

Triggered by the Download button in the Pipeline section header (only visible in Table view).

```js
function exportPipelineTableAsCsv(rows, colGroups, tableType, boardName) {
  // Columns: MC# | one column per category | Done%
  const headers = ['MC#', ...colGroups.map(g => g.category), 'Done%']
  const lines = [headers.join(',')]

  for (const row of rows) {
    const values = [
      row.mc,
      // Each category column = sum of ALL its statuses (not per-status breakdown)
      ...colGroups.map(g => {
        const total = g.statuses.reduce(
          (s, st) => s + (row.counts[`${g.category}__${st}`] || 0), 0
        )
        return total || ''   // blank if zero
      }),
      `${row.total > 0 ? Math.round((row.done / row.total) * 100) : 0}%`,
    ]
    lines.push(values.join(','))
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pipeline_${tableType}_${(boardName || 'board').replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
```

The CSV collapses sub-status columns into a single per-category total — it does not export the individual status breakdown. Row order matches the on-screen sort (MC ascending, `'—'` last).

---

## Part 8: Parent State Required for the Table

```js
// View controls
const [pipelineView, setPipelineView]       = useState('list')   // 'list' | 'table'
const [pipelineCompact, setPipelineCompact] = useState(false)

// Drilldown states (mutually exclusive)
const [throughputDrilldown, setThroughputDrilldown] = useState(null)
const [doneDrilldown, setDoneDrilldown]             = useState(false)

// Active card filters (shared between list view and drilldown source)
const [listFilter,  setListFilter]  = useState(new Set())
const [labelFilter, setLabelFilter] = useState(new Set())
const [typeFilter,  setTypeFilter]  = useState('all')

// Done card filters (separate — only active during Done drilldown)
const [doneListFilter,  setDoneListFilter]  = useState(new Set())
const [doneLabelFilter, setDoneLabelFilter] = useState(new Set())

// Pre-fills search when entering list view from a table cell click
const [drilldownSearch, setDrilldownSearch] = useState('')

// Export ref — table writes its export function here on each render
const pipelineExportRef = useRef(null)
```

All of the above (except `pipelineView` and `pipelineCompact`) are reset every time `loadBoardData` runs:

```js
setThroughputDrilldown(null)
setDoneDrilldown(false)
setTypeFilter('all')
setDoneListFilter(new Set())
setDoneLabelFilter(new Set())
setDrilldownSearch('')
// listFilter and labelFilter intentionally NOT reset — they persist across board changes
```

---

## Part 9: Cycle Time Section

The Cycle Time section is a `SectionCard` occupying 2 of 8 grid columns, between Throughput and Pipeline Distribution.

### 9.1 Data Source

`cycleTimeData` comes from `fetchAllCycleTime`, which paginates `GET /api/project/cycle-time` with `status: 'all'`. The data is scoped to the selected date range (`dateFrom`/`dateTo`) and the board's resolved Raintool project ID.

Each record must have:
- `cycleHours` — hours the card has spent in-flight (primary computation field)
- `currentListName` — the board list name at the time of measurement (used to classify client-facing vs internal)
- `cardId`, `id`, `trelloId`, or `name` — identifier for cross-referencing with `cycleTimeMap`

### 9.2 Stat Computation

```js
const stats = useMemo(() => {
  const records = cycleTimeData.filter(r => r.cycleHours != null && !isNaN(Number(r.cycleHours)))
  if (!records.length) return null

  // p85 — 85th percentile of cycleHours
  const sorted   = [...records].sort((a, b) => Number(a.cycleHours) - Number(b.cycleHours))
  const p85Idx   = Math.min(Math.floor(0.85 * sorted.length), sorted.length - 1)
  const p85Hours = Number(sorted[p85Idx].cycleHours)
  const p85Days  = p85Hours / 24

  // Aging Cards — count strictly exceeding p85
  const agingCount = records.filter(r => Number(r.cycleHours) > p85Hours).length

  // Client Turnaround — avg days for "sent for" list names
  const sentFor = records.filter(r => r.currentListName?.toLowerCase().includes('sent for'))
  const clientTurnaround = sentFor.length > 0
    ? (sentFor.reduce((s, r) => s + Number(r.cycleHours), 0) / sentFor.length) / 24
    : null

  // Pipeline — avg days for everything else (internal cycle time)
  const pipeline = records.filter(r => !r.currentListName?.toLowerCase().includes('sent for'))
  const pipelineDays = pipeline.length > 0
    ? (pipeline.reduce((s, r) => s + Number(r.cycleHours), 0) / pipeline.length) / 24
    : null

  return { p85Days, agingCount, clientTurnaround, pipelineDays }
}, [cycleTimeData])
```

### 9.3 The 2×2 Display

```
┌──────────────┐ ┌──────────────┐
│ AGING CARDS  │ │ P85 CYCLE    │
│      7       │ │   12.3d      │
│    > p85     │ │  85th pct    │
├──────────────┤ ├──────────────┤
│ CLIENT T/A   │ │ PIPELINE     │
│    4.2d      │ │    8.1d      │
│  sent for    │ │  internal    │
└──────────────┘ └──────────────┘
```

| Stat | Color | Value format | Sub-label |
|---|---|---|---|
| Aging Cards | `#ef4444` red | Integer (count) | `> p85` |
| p85 Cycle Time | `#6366f1` indigo | `X.Xd` | `85th pct` |
| Client Turnaround | `#f97316` orange | `X.Xd` | `sent for` |
| Pipeline | `#22c55e` green | `X.Xd` | `internal` |

`null` values display as `—`. Format function: `days => days != null ? `${days.toFixed(1)}d` : '—'`.

Each cell: `bg-white/5 rounded-lg px-3 py-2.5`. Label: `text-[10px] text-text-muted uppercase tracking-wider`. Value: `text-xl font-bold tabular-nums mt-1`. Sub: `text-[10px] text-text-muted/50 mt-0.5`.

### 9.4 Per-Card Cycle Time Column

`cycleTimeMap` is built from `cycleTimeData` in the parent:

```js
const cycleTimeMap = useMemo(() => {
  const map = {}
  for (const record of cycleTimeData) {
    const key  = record.cardId ?? record.id ?? record.trelloId ?? record.name ?? null
    const days = extractCycleDays(record)   // tries cycleTimeDays/cycleDays/days/cycleTime, falls back to cycleHours/24
    if (key != null && days != null) map[key] = days
  }
  return map
}, [cycleTimeData])
```

In `CardsTable`, the rightmost column (visible at `lg+`) looks up each card:

```js
const key  = card.cardId ?? card.id ?? card.name
const days = key != null ? cycleTimeMap[key] : null
// Renders: X.Xd in purple #a855f7, or — if not found
```

---

## Part 10: Build Order

1. Constants: `LANE_MAP` (from taxonomy table), `STATUS_ORDER`, `STATUS_ABBREV`, `STATUS_COLOR`, `PROCESS_COL_GROUPS`, `WORK_COL_GROUPS`
2. Helpers: `extractMcNumber()`, `extractCycleDays()`, `isOverdue()`, `fmtDate()`, `labelStyle()` + `TRELLO_COLORS`
3. Export: `exportPipelineTableAsCsv()`
4. `FilterPicker` component
5. `CardsTable` component
6. `PipelineTableView` component
7. `CycleTimeSummary` component
8. Parent: state, filter handlers, `handlePipelineTableDrilldown`, derived data (`filteredActiveCards`, `filteredDoneCards`, `filteredDoneForDrilldown`, `cycleTimeMap`, list/label options)
9. Pipeline `SectionCard` render tree
