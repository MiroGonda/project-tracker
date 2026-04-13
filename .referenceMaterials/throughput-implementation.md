# Throughput Implementation Reference

**Date:** 2026-04-13  
**File:** `src/pages/BoardPage.jsx`  
**Purpose:** Documents the full make, structure, and implementation of the throughput feature for reference before a potential rebuild.

---

## 1. Overview

Throughput measures how many cards were completed per time period. The chart stacks completed cards by difficulty label (Easy / Medium / Hard / unlabelled Work) plus Process cards, with an optional target overlay line.

Three periods are supported: **daily**, **weekly**, **monthly**. The available periods are automatically constrained by the selected date window.

---

## 2. Data Sources

Three Ares API calls feed the system. All are fetched in parallel via `Promise.all` in `loadData`:

| Data | Endpoint | Stored in |
|---|---|---|
| Active cards | `GET /boards/:boardId/cards?status=active` | `cards` state |
| Done cards | `GET /boards/:boardId/cards?status=done` | `doneCards` state |
| Movement events | `GET /boards/:boardId/movements?dateFrom=...&dateTo=...` | `movements` state |

Pagination: `fetchAllPages` loops until `meta.pagination.totalPages` is exhausted, using `pageSize: 200` per request.

The movement window matches the board's selected date range (`dateFrom` / `dateTo`), meaning movements outside the window are not fetched. This is a known limitation — cards completed just outside the window boundary won't appear even if they fall within the cutoff.

---

## 3. Caching

`loadData` caches to `localStorage` under the key `ares_cache_${boardId}_${dateFrom}_${dateTo}`. TTL is **15 minutes**. All three datasets (`activeCards`, `doneCards`, `movements`) are stored together. On a cache hit, no API call is made and cycle time is also loaded from cache.

---

## 4. Date Window & Cutoff

**`dateRange`** — a number of days (7, 14, 30, 60, 90, or 180). Default: 30.  
**`customRange`** — `{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }` when the user picks a custom span.

```js
const throughputCutoff = useMemo(() => {
  if (customRange) return new Date(customRange.from)
  const d = new Date()
  d.setDate(d.getDate() - dateRange)
  return d
}, [customRange, dateRange])
```

`throughputCutoff` is the earliest date a card's completion can fall on and still be counted. Cards with a completion date before this are excluded from all throughput-related counts.

**Allowed periods by window size:**
| Window | Periods |
|---|---|
| 7 days | daily only |
| 14, 30, 60 days | daily, weekly |
| 90, 180 days / custom | daily, weekly, monthly |

---

## 5. Movement Field Extractors

The Ares movements API returns events with inconsistent field names across versions. Three normalisation helpers:

```js
function extractMovementToList(m) {
  // ONLY fields that are semantically "move destination".
  // m.list / m.currentList / m.to are card-state fields present on ALL events
  // (including label changes, edits, etc.) — using them caused false completion dates.
  return m.toList || m.listAfter || m.destinationList || ''
}

function extractMovementCardId(m) {
  return m.cardId || m.card_id || m.cardid || null
}

function extractMovementDate(m) {
  return m.movedAt || m.date || m.timestamp || m.createdAt || m.at ||
         m.occurredAt || m.eventDate || m.action_date || m.moved_at || m.created_at || null
}
```

**Critical design note:** `extractMovementToList` intentionally excludes `m.currentList`, `m.list`, and `m.to`. The Ares API populates those fields on every activity record (not just list moves). When a label is added to a card in a Done list, the event record has `currentList = <Done list name>` — if we read that, the card's completion date updates to today. Only `toList` / `listAfter` / `destinationList` are reliably present only on actual list-move events.

---

## 6. `buildCompletionDateMap`

```js
function buildCompletionDateMap(movements) {
  const map = new Map()   // Map<cardId, dateStr>
  for (const m of movements) {
    const toList = extractMovementToList(m)
    if (LANE_MAP[toList]?.status !== 'Done') continue  // only moves INTO Done lists
    const cardId  = extractMovementCardId(m)
    const dateStr = extractMovementDate(m)
    if (!cardId || !dateStr) continue
    const existing = map.get(cardId)
    // Keep the most recent move-to-Done (a card may be moved Done, back, Done again)
    if (!existing || new Date(dateStr) > new Date(existing)) {
      map.set(cardId, dateStr)
    }
  }
  return map
}
```

**What it does:** Scans all movement events, keeps only moves into a `LANE_MAP`-recognised Done list, and stores the **most recent** such date per card.

**What it doesn't capture:** Cards that were created directly into a Done list (board imports, setup). Those have no movement records and are intentionally excluded — `dateLastActivity` is not reliable for them.

**Used in:**
- `aggregateThroughput` — chart bucketing
- `cutoffFilteredDoneCards` — which done cards count in the period
- `periodDoneCount` — the Done KPI number
- `filteredDoneForDrilldown` — the Done drilldown card list

---

## 7. `aggregateThroughput`

```js
function aggregateThroughput(doneCards, period, cutoff, completionDateMap = new Map()) {
  const map = {}
  for (const c of doneCards) {
    const cardId = c.id || c.cardId
    const dateStr = completionDateMap.size > 0
      ? completionDateMap.get(cardId)        // movement-confirmed date
      : (c.dateLastActivity || c.updatedAt || c.due)  // fallback when no movement data
    if (!dateStr) continue
    const d = new Date(dateStr)
    if (cutoff && d < cutoff) continue
    const key  = getPeriodKey(dateStr, period)
    const type = getCardType(c)
    if (!map[key]) map[key] = { key, label, work: 0, process: 0, total: 0, easy: 0, medium: 0, hard: 0, unknown: 0, cards: [] }
    if (type === 'Work') {
      map[key].work++
      map[key][difficulty]++   // easy | medium | hard | unknown
    } else {
      map[key].process++
    }
    map[key].total++
    map[key].cards.push(c)
  }
  return Object.keys(map).sort().map(k => map[k])
}
```

**Output shape per bucket:**
```js
{
  key:     'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM',
  label:   'Apr 1' | 'Week of Apr 1' | 'Apr \'26',
  work:    Number,
  process: Number,
  total:   Number,
  easy:    Number,
  medium:  Number,
  hard:    Number,
  unknown: Number,   // Work cards with no difficulty label
  cards:   Card[],
}
```

**Fallback behaviour:** If `completionDateMap` is empty (movements API returned nothing — misconfigured key, network error, etc.), the function falls back to `dateLastActivity`. This is explicitly a last resort; `dateLastActivity` updates on any card edit and is unreliable as a completion signal.

---

## 8. Period Helpers

```js
function getPeriodKey(dateStr, period)
// 'daily'   → 'YYYY-MM-DD'
// 'weekly'  → 'YYYY-MM-DD' (Monday of the ISO week)
// 'monthly' → 'YYYY-MM'

function formatPeriodLabel(key, period)
// 'daily'   → 'Apr 1'
// 'weekly'  → 'Apr 1'
// 'monthly' → "Apr '26"

function getPeriodBounds(key, period)
// Returns [startDate, endDate] for use in target overlap computation
```

---

## 9. `computeTargetForPeriod`

Overlays a throughput target line on the chart. Targets are stored in `localStorage` under `targets_${boardId}` as an array of `{ startDate, endDate, value }` objects.

```js
function computeTargetForPeriod(periodKey, period, targets) {
  const [pStart, pEnd] = getPeriodBounds(periodKey, period)
  let total = 0
  for (const t of targets) {
    const overlapMs = Math.max(0, Math.min(pEnd, tEnd) - Math.max(pStart, tStart))
    if (overlapMs <= 0) continue
    // Pro-rate the target value by what fraction of the target period overlaps this bucket
    total += t.value * (overlapMs / targetMs)
  }
  return total > 0 ? Math.round(total * 10) / 10 : null
}
```

Target values are pro-rated when a target period partially overlaps a chart bucket (e.g., a target starting mid-week).

---

## 10. Derived State in `BoardPage`

All throughput-related values derive from `movements`, `doneCards`, and `throughputCutoff`:

```
movements
  └── completionDateMap = buildCompletionDateMap(movements)        [useMemo]

filteredDoneCards = applyActiveFilters(doneCards)                  [useMemo]
  └── cutoffFilteredDoneCards — filteredDoneCards where completionDate >= cutoff
  └── periodDoneCount — .length of cutoffFilteredDoneCards

filteredDoneForDrilldown — doneCards (unfiltered by active filters)
  where completionDate >= cutoff AND matches done-specific filters
  (typeFilter, doneListFilter, doneLabelFilter)
```

**`cutoffFilteredDoneCards`** feeds the Done KPI card and the difficulty breakdown counts.  
**`periodDoneCount`** is the headline Done count shown in the KPI row.  
**`filteredDoneForDrilldown`** is the card list shown in the Done drilldown panel.  
**`completionDateMap`** is passed down to `ThroughputSection` for chart rendering.

---

## 11. `ThroughputSection` Component

```
ThroughputSection({
  doneCards,          // filtered done cards (cutoff already NOT applied — aggregateThroughput applies it internally)
  allDoneCards,       // unfiltered done cards — used for yMax scaling
  boardId,
  cutoff,             // throughputCutoff Date
  onBarClick,         // (bucketData) => opens drilldown
  allowedPeriods,     // ['daily'] | ['daily','weekly'] | ['daily','weekly','monthly']
  view,               // 'chart' | 'table'
  onViewChange,
  completionDateMap,
})
```

**Internal state:**
- `period` — currently selected granularity ('daily' | 'weekly' | 'monthly')
- `showTgt` — whether the targets panel overlay is open
- `targets` — loaded from `localStorage['targets_${boardId}']`

**Chart:** Recharts `ComposedChart` — stacked `Bar` for each difficulty tier + process, with an `Area` for the target overlay. `yMax` is computed from the full (unfiltered) done card set to keep the Y axis stable when filters change.

**Table view:** A simple `<table>` with one row per bucket showing period label, total, work, process, and difficulty breakdown.

**Bar click:** `onBarClick` receives the bucket object (including `.cards[]`). BoardPage uses this to open the throughput drilldown panel showing cards in that period.

---

## 12. Known Limitations & Design Issues

| Issue | Root Cause | Status |
|---|---|---|
| Cards not in LANE_MAP have no completion date | Movement filter requires `LANE_MAP[toList].status === 'Done'`; non-standard list names are silently skipped | Known — LANE_MAP must stay current with board lists |
| Movement window = date range window | `loadData` fetches movements for `dateFrom..dateTo` only; movements outside window are missing | Known — extending beyond range would require a wider API call |
| Cards created directly in Done (imports) are excluded | No movement records exist; `dateLastActivity` is intentionally skipped to avoid false dates | By design |
| `dateLastActivity` fallback is unreliable | Used only when `completionDateMap.size === 0`; reflects any card edit, not just completion | Acceptable fallback — should not appear in normal operation |
| `currentList` / `m.list` fields present on non-move events | Ares API logs all card activity, not just list moves; ambiguous fields must not be used as destination | Fixed — only `toList / listAfter / destinationList` are used |

---

## 13. Summary of Data Flow

```
Ares API
  ├── /boards/:id/cards?status=done      → doneCards[]
  └── /boards/:id/movements?dateFrom=... → movements[]
         │
         ▼
  buildCompletionDateMap(movements)
         │
         ▼
  Map<cardId, completionDateStr>
         │
  ┌──────┴──────────────────────────────────────────────┐
  │                                                     │
  ▼                                                     ▼
aggregateThroughput()                      cutoffFilteredDoneCards
  → chart buckets                          periodDoneCount
  → ThroughputSection                      filteredDoneForDrilldown
    → ComposedChart (recharts)             KPI cards / drilldown panel
```
