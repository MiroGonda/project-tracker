# AUDIT_PHASE_0A.md — Visual Audit (Read-Only)

**Date:** 2026-04-28
**Phase:** 0a (Visual Audit)
**Author:** Claude Code (Implementation)
**Scope:** Per DIRECTIVE.md §6 — read-only inventory of the current visual layer to inform DESIGN.md (Track A) and the Phase 1 token rewrite (Track B).

**Method:** Grep + targeted reads across `src/` (excluding `src/pages/Ares.jsx`, which is the unrouted legacy prototype noted in CLAUDE.md §15 — flagged in Observations but not in the active inventory).

---

## 1. Token Usage Map

### 1.1 CSS variables — `src/index.css`

| Token | `:root` (dark default) | `html.light` | Format |
|---|---|---|---|
| `--color-bg` | `15 15 15` | `245 245 247` | RGB triplets (Tailwind alpha-friendly) |
| `--color-surface` | `28 28 30` | `255 255 255` | RGB triplets |
| `--color-text-primary` | `232 232 232` | `17 19 24` | RGB triplets |
| `--color-text-muted` | `107 114 128` | `107 114 128` | **Same in both themes** ⚠️ |
| `--color-border` | `42 42 46` | `228 228 231` | RGB triplets |

> ⚠️ `--color-text-muted` is **identical in dark and light** (Tailwind `gray-500`). Combined with light-theme bg `245 245 247`, contrast is borderline for tertiary `text-muted/60` and `text-muted/40` usage. Worth flagging for the Driver — likely a Phase 1 fix.

### 1.2 Tailwind theme — `tailwind.config.js`

```js
content: ['./index.html', './src/**/*.{js,jsx}'],
theme: {
  extend: {
    colors: {
      bg:             'rgb(var(--color-bg) / <alpha-value>)',
      surface:        'rgb(var(--color-surface) / <alpha-value>)',
      accent:         '#6366f1',                // ← hardcoded indigo, NOT tokenized
      'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
      'text-muted':   'rgb(var(--color-text-muted) / <alpha-value>)',
      border:         'rgb(var(--color-border) / <alpha-value>)',
    },
    fontFamily: { sans: ['Inter', 'sans-serif'] },
  },
},
plugins: [],
```

> ⚠️ `accent` is a hex literal (`#6366f1` = indigo-500), not a CSS variable. It does not adapt between themes, and it cannot use Tailwind alpha-modifier syntax with itself the same way the token-backed colors do (Tailwind handles `bg-accent/20` against a hex via runtime alpha synthesis, which works, but the value can't be palette-shifted without editing config). For a dual-theme redesign this is the highest-leverage token to lift into the CSS-variable system.

### 1.3 Light-theme shim rules

```css
html.light .bg-white\/5               { background-color: rgba(0,0,0,0.04); }
html.light .bg-white\/10              { background-color: rgba(0,0,0,0.06); }
html.light .hover\:bg-white\/5:hover  { background-color: rgba(0,0,0,0.04); }
```

Three hand-written overrides to flip Tailwind's white-alpha utilities into low-alpha black for light backgrounds. **Coverage is incomplete** — `bg-white/[0.04]`, `bg-white/20`, `border-white/40`, etc. are used elsewhere and have no light-theme override (see §2 below).

### 1.4 Component primitives — `src/index.css` `@layer components`

```css
.input         { w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                 placeholder:text-text-muted/50 focus:outline-none focus:border-accent/60 transition-colors }
.btn-primary   { inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white
                 text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors }
.btn-secondary { inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
                 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors }
```

No additional `@layer components` rules. No CSS variables for radius, spacing, or shadow — all those are inlined as Tailwind utilities.

### 1.5 What's missing from the token system

The following design dimensions are **not** tokenized and are scattered across the codebase as ad-hoc Tailwind utilities:

- Radius (`rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`) — used inconsistently for the same UI role across files.
- Shadow (`shadow-sm`, `shadow-lg`, `shadow-xl`, `shadow-2xl`) — hand-picked at each site.
- Spacing scale — relies on Tailwind defaults; no project-level rhythm definition.
- Surface elevation — `bg-bg`, `bg-surface`, plus literal `bg-white/5`, `bg-white/[0.04]`, `bg-black/30`, `bg-black/40`, `bg-black/60` overlays. No semantic naming.
- Status palette (open / on-hold / closed / done / overdue / SLA tiers) — encoded as Tailwind `red/orange/amber/emerald/blue/cyan` 400/500 with hand-tuned alphas (`/10`, `/15`, `/20`, `/30`).

---

## 2. Hardcoded Color Audit

### 2.1 Hex literals (`#xxxxxx` / `#xxx`) in `src/`

**Total: ~80+ hex codes outside `tailwind.config.js`.** Grouped by file:

#### `src/pages/BoardPage.jsx` (the heavy concentration)
| Lines | Constant / role | Notes |
|---|---|---|
| 28-38 | `TRELLO_COLORS` map | Pairs Tailwind classes with hex `dot` values for label dots. 11 entries (`red/orange/yellow/green/blue/purple/pink/sky/lime/default`). |
| 44-50 | `STATUS_COLOR` map | `Pending #3b82f6`, `Ongoing #eab308`, `For Review #f97316`, `Revising #ef4444`, `For Approval #a855f7`, `Done #22c55e`. **Single source of truth for stage color** — referenced 8+ times throughout the file. |
| 65-82 | Lane / category color constants | `Work Lane #6366f1`, `Process Lane #a855f7`, plus duplicated stage colors (lines 77-82 mirror the STATUS_COLOR entries). **The duplicate set is a bug-risk: divergence is silent.** |
| 253-265 | `DIST_CATS_*` (work / process) | Per-category histogram colors — partially overlaps STATUS_COLOR semantics. |
| 408 | `DIFF_COLORS` (Easy/Medium/Hard) | `#5a9e78 / #b8893a / #b85c5c / #6b7280` — desaturated, distinct palette from the rest. |
| 557, 703, 705, 858, 859, 865, 867, 878, 879, 892, 894, 909, 998, 1005, 1051, 1110, 1119, 1216-1220, 1290, 1328, 1406-1409, 1580, 1636, 1687, 1907, 2015-2019, 2396, 2515-2527, 2536, 3139, 3500, 3503, 3613, 4727, 5082, 5083 | Inline hex usage at render sites | Includes recharts `fill`, inline `style={{ color, background }}`, fallback `'#6b7280'`, gradient backgrounds, "MC pill" tints. |
| 1216-1220, 2015-2019 | `progressColor(pct)` | **Defined twice** (`progressColor` appears at lines 1216 and 2015). Same threshold logic, same hex values: `#22c55e / #84cc16 / #eab308 / #f97316 / #e8e8e8`. Copy-paste duplication. |

#### `src/pages/LoginPage.jsx`
| Lines | Hex | Notes |
|---|---|---|
| 63-66 | `#4285F4 / #34A853 / #FBBC05 / #EA4335` | Inside the inline Google logo SVG. **Brand-mandated** — these are correct as hex (Google brand guidelines). Document as "intentional brand hex, do not redesign." |

#### `src/pages/Ares.jsx` (legacy, unrouted)
| Lines | Notes |
|---|---|
| 71-77, 360-371, 562-564 | A second hex palette duplicating BoardPage's constants. **Confirmed dead code per CLAUDE.md §15.** Excluded from the redesign scope by virtue of being unrouted. |

### 2.2 Inconsistencies found

1. **Same color expressed two different ways** — `#6366f1` (accent indigo) appears as a literal at `BoardPage.jsx:1119` and `BoardPage.jsx:1407` and `BoardPage.jsx:5082`, while `accent` (also `#6366f1`) is used everywhere else via Tailwind. **Action for Phase 1:** these literal hex usages should resolve through the token, not hardcode the value.
2. **Status color duplication** — `STATUS_COLOR` (BoardPage:44-50) and the inline status-label map (BoardPage:77-82) repeat `Pending/Ongoing/For Review/Revising/For Approval/Done` with the **same** hex values today, but nothing enforces that. Consolidate to one map.
3. **Two `progressColor` functions** — see above.
4. **Trello label colors as hex** — `TRELLO_COLORS[*].dot` is hex even though the matching `bg`/`text` is Tailwind class strings. Could be fully Tailwind-class-driven.
5. **`STATUS_COLOR` fallbacks vary** — sometimes `'#6b7280'`, sometimes `'#888'` (line 1907).

### 2.3 `rgb()` / `rgba()` literals

| File:line | Usage |
|---|---|
| `index.css:23-24` | `body { background-color: rgb(var(--color-bg)); color: rgb(var(--color-text-primary)) }` — token-driven. ✅ |
| `index.css:29-31` | Light-theme alpha shims (see §1.3). |
| `BoardPage.jsx:860` | `cursor={{ fill: 'rgba(255,255,255,0.05)' }}` (recharts) |
| `BoardPage.jsx:1290, 1328` | Inline `borderLeft` rgba — group separators in pipeline table. |
| `BoardPage.jsx:2519-2520` | recharts tooltip `contentStyle: 'var(--color-surface,#1f2937)'`, border `rgba(255,255,255,0.1)`, cursor `rgba(255,255,255,0.04)`. |
| `Ares.jsx:360-369, 560` | recharts in legacy file. |

> Note: `rgba(255,255,255,*)` literals will not invert under `html.light`. Recharts surfaces (tooltips, cursors, grid lines) are light-mode-broken in spots — Phase 3 polish work.

### 2.4 Tailwind alpha utilities — `bg-white/N` / `bg-black/N`

**`bg-white/N` and `hover:bg-white/N` — most prevalent.** Roughly 100+ occurrences in `BoardPage.jsx` alone (most as `hover:bg-white/5` for muted hover states). Other files: `Settings.jsx` ~5, `Admin.jsx` ~3, `Sidebar.jsx` 2, `LoginPage.jsx` 1.

Variants used: `bg-white/5`, `bg-white/10`, `bg-white/20`, `bg-white/[0.04]`, `bg-white/40` (used at `BoardPage.jsx:4057` for a Gantt marker border).

**`bg-black/N`** — modal/scrim overlays only:
- `bg-black/20` (`BoardPage.jsx:1285`) — pipeline table sub-header.
- `bg-black/30` (`BoardPage.jsx:1273, 1299`) — pipeline table headers.
- `bg-black/40` (`BoardPage.jsx:846, 2507`) — request-volume target popover backdrop.
- `bg-black/60` (`Settings.jsx:75`, `BoardPage.jsx:1873, 2680, 5430, 5462`, `Admin.jsx:713`) — modal scrims (most common modal overlay alpha in the app).

> ⚠️ `bg-white/[0.04]`, `bg-white/20`, `bg-white/40` and **all `bg-black/N`** have no `html.light` shim → broken or near-broken in light mode. Most modals on light still render readable backgrounds because the surface inside is `bg-surface` solid, but the scrim is awkwardly dark on dark. Worth a Phase 1 token-with-shim consolidation: a single `bg-overlay` semantic class keyed off a `--color-overlay` token.

### 2.5 Arbitrary-value color utilities (`text-[#xxx]`, `bg-[#xxx]`, `border-[#xxx]`)

Five occurrences, all in `BoardPage.jsx`:
- `BoardPage.jsx:878` — `bg-[#a855f7]` (Process legend swatch).
- `BoardPage.jsx:879, 2536` — `border-[#f59e0b]` (Target dashed legend stroke).
- `BoardPage.jsx:5082` — `bg-[#6366f1]` (Work legend swatch — should use token).
- `BoardPage.jsx:5083` — `bg-[#a855f7]` (Process legend swatch — duplicate of 878).

All are tiny color swatches in chart legends. Cheap to consolidate against the central palette.

---

## 3. Hardcoded Typography Audit

### 3.1 Arbitrary text sizes

**Total ~150+ `text-[Npx]` occurrences** (caps at the grep limit). Distribution:

| Size | Where used | Approx count | Role |
|---|---|---|---|
| `text-[8px]` | `BoardPage.jsx` only | 2 | Tiny calendar holiday labels, gantt bar status pills |
| `text-[9px]` | `BoardPage.jsx`, `Settings.jsx` | ~12 | "Status chip" pills, edge-case captions |
| `text-[10px]` | All pages | **dominant — ~100+** | Uppercase micro-labels ("CYCLE TIME", "DIFFICULTY", etc.), badge text, secondary metadata |
| `text-[11px]` | All pages | ~30 | Body copy in dense tables, modal subtitles, timeline ticks |

`text-[Npx]` is used **far more than the Tailwind built-in scale (`text-xs` = 12px, `text-sm` = 14px)** in BoardPage. It produces a custom 8/9/10/11/12/14 ladder.

### 3.2 Other arbitrary typography utilities

- `tracking-wider` and `tracking-widest` are used heavily for uppercase labels — consistent.
- No `leading-[Npx]` arbitrary line-heights found.
- No `font-[<weight>]` arbitrary font weights found.
- `font-medium`, `font-semibold`, `font-bold`, `font-mono` used; **no `font-thin/light/extralight/extrabold/black`**.

### 3.3 Pattern observation

The system de facto uses these typographic roles, all hardcoded:

| Role | Pattern | Example sites |
|---|---|---|
| Uppercase micro-label | `text-[10px] font-medium uppercase tracking-wider text-text-muted` | BoardPage.jsx:532, 727, 993, 1017, 1424, 2375, 2424, 2452, 2479, 2722, 3055, 3276... |
| Chip / pill text | `text-[10px] font-semibold` or `text-[9px] font-semibold` | All Pill/Status/MC chips |
| Compact metadata | `text-[11px] text-text-muted` | Captions, table sub-rows |
| Body in dense tables | `text-xs` | Most table cells |
| Body / inputs | `text-sm` | `.input`, headings |
| Headings | `text-sm font-semibold` (h2) | Settings/Admin Sections |

> A 6-step typographic scale is a Phase 1 win — replacing `text-[10px]` patterns with a `text-micro` / `text-caption` semantic.

---

## 4. Component Primitives Inventory

### 4.1 `.input` (defined `index.css:36-39`)

Total occurrences of token `input` in className strings: **~49 across `src/`**.
- Some are bare `className="input"`; others use it inside template literals with extra utilities (`className={\`input ${error ? 'border-red-500/40' : ''}\`}`).
- Found in: `Settings.jsx`, `Admin.jsx`, `BoardPage.jsx`, plus the legacy `Ares.jsx` (excluded).

### 4.2 `.btn-primary` (defined `index.css:40-42`)

Total: **~23 occurrences** across `Settings.jsx`, `Admin.jsx`, `BoardPage.jsx`, `Ares.jsx`. Used for save/confirm/CTA buttons.

### 4.3 `.btn-secondary` (defined `index.css:44-46`)

Total: **~34 occurrences** across the same set of files. Used for cancel, dismiss, neutral actions.

### 4.4 Where the primitives **aren't** used

A large amount of button/input markup in `BoardPage.jsx` is hand-rolled rather than using these classes — examples:

- `BoardPage.jsx:614-616, 822, 4954, 4966, 5481` — toggle buttons in segmented controls (3-way view toggles). All copy-paste the same `border border-border text-text-muted hover:bg-white/5` block.
- `BoardPage.jsx:809, 1100, 2316, 2340, 2344, 2348, 3378, 4000, 5230, 5234` — segmented-control inner buttons with `bg-accent/20 text-accent` active state. Roughly 12 sites repeating the same pattern.
- `BoardPage.jsx:3015, 3320, 5222` — small icon+text "outline" buttons, hand-rolled.

The "three-way toggle" CSS pattern documented in CLAUDE.md §10.8 (`flex border border-border rounded-lg overflow-hidden` with `bg-accent/20 text-accent` active) is **literally re-typed in 12+ places**. Strong candidate for a `<SegmentedControl>` shared component in Phase 2.

---

## 5. Shared Component Inventory

| Component | File:line | Render sites (approx) | Props surface | Notes |
|---|---|---|---|---|
| `Sidebar` | `src/components/Sidebar.jsx:13` | 1 (App shell) | none | Self-contained, talks to `useAccess`. |
| `Spinner` | `src/components/Spinner.jsx:1` | ~10 (Settings, BoardPage, Sidebar, LoginPage, Admin) | `size`, `className` | Pure SVG, currentColor — already token-friendly. |
| `Toast` | `src/components/Toast.jsx:10` | 4 (Settings, Admin, BoardPage, useToast hook driver) | `toasts[]`, `dismiss` | Defines `ICONS` map locally; 3 types (success/error/info). |
| `<SectionCard>` | `BoardPage.jsx:572` | ~10 (Throughput, Pipeline Distribution, KPIs, Cycle Time Summary, Request Volume, etc.) | `title`, `children`, `className`, `headerRight`, `drilldown`, `done`, `slim`, `headerColor` | **Defined inside BoardPage.jsx** — not extracted to `src/components/`. There's a second `SectionCard` in `Ares.jsx:228` with **different props** (`{ title, action, children }`) — name collision in legacy. |
| `<KpiTile>` | `BoardPage.jsx:2176` | 1 component def, called inside `RequestVolumeSection` (~6 KPI tiles) | `label`, `value`, `color`, `highlight` | Local to BoardPage. |
| `<FilterPicker>` | `BoardPage.jsx:593` | ~3 (Dashboard tab — list/label/type filters) | `label`, `options`, `selected`, `mode`, `onToggleInclude`, `onToggleExclude`, `onClear` | Local to BoardPage. |
| `<ConfigSection>` | `Settings.jsx:47` | 4 (inside `BoardConfigModal` — Dates, SLA, Passes, External Users) | `icon`, `title`, `description`, `accent`, `children` | Local to Settings; **shape duplicates `<Section>` and `<Tag>` patterns** in Admin.jsx. |
| `<SortTh>` | `BoardPage.jsx:2101` | ~10 inside the Request table `<thead>` and Dashboard tables | `colKey`, `sortKey`, `sortDir`, `onSort`, `children`, `className` | Local to BoardPage. |
| `<RequestVolumeSection>` | `BoardPage.jsx:2185` | 1 (Request tab top) | `requests`, `boardId`, `cards`, `doneCards`, `passMap`, `slaDays` | The summary/chart/table section. |
| `<RequestTab>` | `BoardPage.jsx:2764` | 1 | `boardId, cards, doneCards, requests, requestsLoading, onSaveRequest, onDeleteRequest, passMap, slaDays, customColumns, canManageColumns, onUpdateColumns` | Largest sub-component. |
| `<TimelineTab>` | `BoardPage.jsx:3693` | 1 | `boardId, cards, loading, requests, boardCfg` | |
| `<CustomColumnsModal>` | `BoardPage.jsx:2643` | 1 (Request tab → Columns button) | `columns`, `onChange`, `onClose` | |
| `<CustomFieldCell>` | `BoardPage.jsx:2579` | N (per cell × column) | `column`, `request`, `onSaveRequest` | |
| `<ThroughputSection>` | `BoardPage.jsx:766` | 1 (Dashboard) | many | |
| `<ThroughputKpiPanel>` | `BoardPage.jsx:972` | 1 | `p85Days`, `wipP85`, `diffCounts` | |
| `<PipelineDistribution>` | `BoardPage.jsx:1057` | 1 | `cards`, `loading` | Has a duplicate in `Ares.jsx:397`. |
| `<DistBar>` | `BoardPage.jsx:1042` | many (rows of histograms) | `label`, `count`, `total`, `color` | Also duplicated in `Ares.jsx:384`. |
| `<CycleTimeSummary>` | `BoardPage.jsx:1376` | 1 | `cycleTimeData`, `loading` | |
| `<ThroughputTooltip>` | `BoardPage.jsx:689` | recharts custom tooltip | `active`, `payload`, `label` | Duplicated in `Ares.jsx:240`. |

### Ad-hoc / near-duplicate variants

1. **Two `<Section>` components** — `Settings.jsx:31` and `Admin.jsx:20`. Identical signatures, identical render output (`<h2 className="text-sm font-semibold text-text-primary mb-1">…<p className="text-xs text-text-muted mb-4">…</p>`). Direct copy.
2. **Two `<Divider>` components** — `Settings.jsx:41` and `Admin.jsx:30`. Both `<div className="border-t border-border my-6" />`. Direct copy.
3. **Three `<Tag>`-style chips** — `Admin.jsx:32` (`<Tag>`), `Settings.jsx:255-265` (inline `<span>` for external user emails), `BoardPage.jsx:2725-2728` (inline `<span>` for custom-column options). All use `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs|[11px] bg-X/10 text-X-400`. Five+ visual variants, no shared component.
4. **Modal frame** — at least 6 sites using `fixed inset-0 z-50 flex items-center justify-center bg-black/60` + an inner `bg-surface border border-border rounded-xl|2xl shadow-xl|2xl` panel. No shared `<Modal>` component.
5. **Three-way segmented toggle** — see §4 — repeated 12+ times.

---

## 6. Page-Level Density Notes

### 6.1 LoginPage (`src/pages/LoginPage.jsx`)

- Centered layout, `gap-8`, brand mark + card panel + footer line.
- Visual density: low and clean. Card uses `rounded-2xl shadow-xl` — the only `2xl` shadow in the app, which makes it feel disconnected from the rest of the UI.
- Accent color is used in the brand grid (`bg-accent/10 border border-accent/20`) — sets up the indigo identity well.
- Conditional "Google Client ID required" branch (lines 40-51) is **dead code** — `isGoogleConfigured()` always returns true (per CLAUDE.md §9.2). Keeping it adds visual variants in the file that won't render but cost mental tax.
- "Sign in with Google" button is **white** (`bg-white text-gray-800`) — works well in dark mode, looks awkward against light-theme `bg-bg`. The Google logo SVG is fixed-color and non-themed (intended; brand-mandated).

### 6.2 Sidebar (`src/components/Sidebar.jsx`)

- Width toggles `w-14 ↔ w-56` with `transition-all duration-200`. Logo is a single capital `P` in accent color.
- Nav items: small (`text-sm`, `py-2`), rounded-lg highlight on active.
- "PROJECTS" label uses the canonical `text-[10px] uppercase tracking-wider` micro-label pattern.
- Source icons (Zap blue for ares, PenLine emerald for manual) at `size={13}` — slightly small, can be hard to spot.
- No empty-state illustration for "no boards" — a one-liner italic.
- Bottom collapse button has only an icon, no label even when expanded. Tiny tap target.

### 6.3 Settings page (`src/pages/Settings.jsx`)

- Uses `<Section>` + `<Divider>` for vertical rhythm.
- Board configuration list (lines ~440+): per-board row with status chips (Dates / SLA / Passes / Hidden) using `text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400`. The chips are tiny and lean on alpha tints — readability under light theme is questionable (text-cyan-400 on bg-cyan-500/10 against light bg).
- "Configure" button per row opens `BoardConfigModal` — modal is `w-[560px] max-h-[90vh] flex flex-col`, fixed width regardless of viewport.
- Pass Tracking section: shows Trello field IDs verbatim; not the prettiest.
- Generally feels **dense and utilitarian** — not unfriendly, but lots of small text and tight spacing.

### 6.4 Admin page (`src/pages/Admin.jsx`)

- Uses `<Section>` + `<Divider>`. Project Access section dominates: searchable per-board list, expandable rows for user assignments.
- Source toggle (`isAres`) is a 2-way segmented control mid-row (`Admin.jsx:570-580`). Custom hand-rolled (yet another instance of the §4 pattern).
- New manual board creation form (lines ~600+) is multi-section with `<label>` micro-labels.
- "Raw JSON" debug at the bottom is `<pre>` — useful for debugging, looks alien against the rest.
- Modal at line 713 (`bg-black/60 backdrop-blur-[2px]`) is a hand-rolled confirm dialog.
- Consistency with Settings is good — same `<Section>`, same `<Divider>`. Visual identity matches.

### 6.5 BoardPage — Request tab (default landing tab)

- **Highest density surface in the app.** Top: Request Volume Section (Summary/Chart/Table 3-way toggle). Bottom: Request table with column groups (Request / Passes / Custom).
- Summary view KPI tiles (`text-3xl tabular-nums` for value, `text-[10px] uppercase` for label) — strong visual hierarchy.
- Stage Breakdown stacked bar uses `bg-white/[0.04]` track — that alpha tint has no light-theme shim → visible inconsistency in light mode.
- Pass Pipeline panel (when SLA configured) uses cyan-accented column headers; the SLA Health bar is `h-1.5` — quite thin.
- Request table rows: `py-3 px-3` cells, dense with chips. **MC pill** (`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20`) is per-row.
- Status (open/on-hold/closed) is a `<select>` styled as a `rounded-full` pill (lines 3114-3117, 3247) — see §8 for §17-rule analysis.
- Stage column uses **plain text** — `<span style={{ color: STATUS_COLOR[stage] }}>` (line 3139). ✅ §17-compliant.
- Deadline column uses **plain text** — `text-xs font-medium ${overdue ? 'text-red-400' : 'text-text-muted'}` (line 3164). ✅ §17-compliant.
- Edit panel (when row clicked): 560px right pane, multi-tab Details / Cards. Heavy use of `text-[10px] uppercase tracking-wider` micro-labels — feels dense but legible.

### 6.6 BoardPage — Dashboard tab

- Three vertical sections: filter bar → Throughput section → Pipeline Distribution + Cycle Time Summary + Pipeline table (drilldown-aware).
- Throughput KPI panel "Done (85p) / WIP (85p)" is large numerals (`text-lg font-bold`, color-tinted) — clear.
- Pipeline table is **the most visually busy widget** — many columns, many cells, tight `text-xs`. `border-l border-border/20` between cells. Drilldowns swap the rendered content.
- recharts customization: `tick={{ fontSize: 10, fill: '#6b7280' }}` — hardcoded; will not theme-flip.
- Lots of `bg-black/30` / `bg-black/20` table headers — light-theme broken.
- `progressColor` thresholds (lines 1216, 2015) are duplicated.

### 6.7 BoardPage — Timeline tab

- Top: Project Duration panel (large progress bar `h-3 w-full bg-white/5 rounded-full`).
- Calendar (month grid) with PH holidays in rose tint. Holiday labels at `text-[8px]` — extremely small.
- Gantt section: bars from filed-date → deadline. Adaptive labels `text-[9px] text-text-muted/60`. Tiny and hard to read in light mode (color flips poorly).
- Active/Closed segmented toggle — yet another instance of the §4 pattern.
- **Density**: feels emptier than Dashboard but tighter than Settings. The Gantt "no-deadline marker" (`w-3 h-3 rounded-full bg-white/20 border-2 border-white/40`) at line 4057 has no light-mode shim — invisible on light bg.

### 6.8 BoardPage — global chrome

- Tab bar (Request / Dashboard / Timeline) uses the `bg-accent/20 text-accent` active pattern.
- "Syncing…" pill: `fixed top-4 left-1/2 -translate-x-1/2 z-50 ... rounded-full bg-surface border border-border shadow-lg` (line 4926) — clean toast-like indicator.
- Refresh and "Manual sync" buttons hand-rolled.

---

## 7. Font and Icon Survey

### 7.1 Fonts

- **Inter** is the only font, loaded from Google Fonts in `index.html:8-10`:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  ```
- Weights pulled: 400, 500, 600, 700 (covers `font-normal/medium/semibold/bold`). `font-mono` falls back to the browser's default monospace — there's no Google-Fonts mono.
- `tailwind.config.js:14-16` extends `fontFamily.sans` to `['Inter', 'sans-serif']`.

> **Recommendation for Phase 1:** if redesign uses weight 800 or 300, update both `index.html` and `tailwind.config.js`. If a custom mono is desired (`JetBrains Mono`, etc.), needs a new `@import` and a `fontFamily.mono` extension.

### 7.2 Lucide icons

`lucide-react` is the only icon library. **Unique icons used across live (non-`Ares`) source: ~47.**

By file:

| File | Icons imported |
|---|---|
| `Sidebar.jsx` | `Settings`, `ShieldCheck`, `ChevronLeft`, `ChevronRight`, `Zap`, `PenLine` |
| `Toast.jsx` | `CheckCircle2`, `AlertCircle`, `X` |
| `LoginPage.jsx` | `Settings` |
| `Settings.jsx` | `Sun`, `Moon`, `CheckCircle2`, `Circle`, `Eye`, `EyeOff`, `Layers`, `X`, `Settings as SettingsIcon`, `Plus`, `UserX`, `Calendar`, `Clock` |
| `Admin.jsx` | `ShieldCheck`, `Plus`, `Trash2`, `Zap`, `PenLine`, `Hash`, `Download`, `Upload`, `RefreshCw`, `AlertTriangle`, `Check`, `X`, `AlertCircle`, `Key`, `Sun`, `Moon`, `CheckCircle2`, `Circle`, `UserCheck`, `UserX`, `ChevronDown`, `ChevronRight` |
| `BoardPage.jsx` | `LayoutDashboard`, `RefreshCw`, `AlertTriangle`, `AlertCircle`, `TrendingUp`, `Download`, `Check`, `Target`, `X`, `ChevronDown`, `ChevronUp`, `Circle`, `CheckCircle2`, `Calendar`, `Search`, `Minimize2`, `Settings2`, `Layers`, `Inbox`, `GanttChart`, `CalendarDays`, `ChevronLeft`, `ChevronRight`, `Plus`, `Link2`, `Eye`, `FileText`, `ImagePlus`, `Users`, `BarChart2`, `Table2`, `LayoutList`, `Pencil`, `ClipboardCopy`, `Trash2`, `Columns3`, `Type as TypeIcon` |

Common sizes: `size={8}`, `size={11}`, `size={13}`, `size={14}`, `size={16}` — no system, picked at each site. Defaults to `currentColor`, so theming is icon-by-icon based on the parent's text color.

> Phase 1 win: define a small set of icon sizes (e.g. `xs=12`, `sm=14`, `md=16`, `lg=20`) — either as a wrapper component or a documented convention.

---

## 8. Pill / Chip / Badge Inventory

CLAUDE.md §17 reserves pills for:
1. **MC badges**
2. **Type (Work/Process) badges**
3. **Section status chips**

**And explicitly forbids pill-style Stage and Deadline UI.**

### 8.1 Compliant pill usages

#### MC badges
- `BoardPage.jsx:1615` — Pipeline table row MC: `text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded`.
- `BoardPage.jsx:1624` — Compact request reference: `text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300`.
- `BoardPage.jsx:3102` — Request row MC: `text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20`.
- `BoardPage.jsx:3495, 3605` — MC inside attached-card list: same pattern as 1615.

#### Type (Work/Process) badges
- `BoardPage.jsx:948-949` — Card list: `bg-indigo-500/20 text-indigo-300` (Work), `bg-purple-500/20 text-purple-300` (Process).
- `BoardPage.jsx:1648-1649` — Pipeline table row: same.
- `BoardPage.jsx:3491, 3592` — Card-picker rows: same.

#### Section status chips
- Settings board-config rows: `Dates`, `SLA`, `Passes`, `Hidden` chips at `Settings.jsx:456-459` — `text-[9px] px-1.5 py-0.5 rounded-full bg-X-500/10 text-X-400`.
- "New" chip in Edit panel header: `BoardPage.jsx:3240`.
- Modal sub-headers and the Process/Target legend swatches in chart header rows.
- Custom-column option tags: `BoardPage.jsx:2726`.
- External user tags: `Settings.jsx:260`, `Admin.jsx:39` (`<Tag>` component).

### 8.2 Stage and Deadline — confirmed compliant (plain text)

- **Stage column** (`BoardPage.jsx:3139`) — `<span className="text-xs font-medium" style={{ color: STATUS_COLOR[stage] }}>{stage}</span>`. ✅ Plain text, conditional color.
- **Deadline column** (`BoardPage.jsx:3164`) — `<span className={\`text-xs font-medium ${overdue ? 'text-red-400' : 'text-text-muted'}\`}>{fmtFiled(r.deadline)}</span>`. ✅ Plain text, red when overdue.

(Recent commit `dfae0b5` is `style: stage column now uses plain text with status color` — the rule fix was made at that point.)

### 8.3 Edge case — Status (open / on-hold / closed) `<select>`

- `BoardPage.jsx:3114-3117` (Request table row) and `BoardPage.jsx:3247` (Edit panel header) render the **Status** field as a `<select>` styled `rounded-full` with status-tinted bg/text.
- This is the **Status field** (the `req.status` data column with values `open|on-hold|closed`), **not the Stage column** (the derived lane status from attached cards).
- §17 rule names "Stage/Deadline" specifically — Status is not in scope. **Treat as compliant**, but worth flagging to the Driver in case the redesign wants to pick a different visual shape for the dropdown.

### 8.4 Edge case — Done card status pills inside attached-card list

- `BoardPage.jsx:3500, 3502-3503, 3613` — small status chips inside the attached-card view (e.g. "Done", "For Review") with inline `style={{ background: STATUS_COLOR[s] + '22', color: STATUS_COLOR[s] }}`.
- These describe **Trello card status**, not the Request's Stage. Closer to "type/status badge on a card item" — interpreted as Section status chips (allowed).

### 8.5 Edge case — Pipeline table "active/closed" tiny chips

- `BoardPage.jsx:4039` (Gantt list row) — `text-[8px] px-1 rounded-full ${closed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}` "Active/Closed" chip.
- Tiny and uses `rounded-full` — chip-shaped. Could read as a row-status chip (allowed) or as a "stage-like" pill (borderline). Worth raising.

### 8.6 No violations of the Stage/Deadline rule found

After full review of the Request table and the Edit panel, **no Stage or Deadline pill exists in the codebase today.** The §17 rule is upheld. ✅

---

## Observations (non-action — for the Driver)

These are things noticed while auditing that go beyond the eight-section spec. **Not acted on.**

1. **Code duplication of substantive components** — `<SectionCard>`, `<DistBar>`, `<PipelineDistribution>`, `<ThroughputTooltip>`, `<Section>`, `<Divider>` all exist in two places (live page + `Ares.jsx` legacy). Once `Ares.jsx` is archived, half this duplication evaporates. Per CLAUDE.md §15, `Ares.jsx` is "safe to archive / delete" — worth confirming with the Driver before redesign work touches the same surface.

2. **`progressColor()` is defined twice** — `BoardPage.jsx:1216` and `BoardPage.jsx:2015`. Same logic, same hex values today, but nothing enforces parity. Trivial to extract.

3. **Status-color map is duplicated within `BoardPage.jsx`** — `STATUS_COLOR` (lines 44-50) and an unnamed inline map (lines 77-82) hold the same six entries with the same hex values. Consolidation is safe.

4. **Hand-rolled "three-way segmented toggle" repeats 12+ times.** Strong candidate for a `<SegmentedControl>` shared component in Phase 2. Already documented in CLAUDE.md §10.8 as a convention; the shared component is the natural next step.

5. **Hand-rolled modal frame repeats 6+ times.** A `<Modal>` shared component (with header/body/footer slots) is a Phase 2 win.

6. **Light-theme coverage is partial.** `bg-white/[0.04]`, `bg-white/20`, `bg-white/40`, all `bg-black/N`, and recharts `rgba(255,255,255,*)` literals don't have `html.light` shims. The current light theme works well in places but breaks in chart tooltips, modal scrims, and several progress-bar backgrounds.

7. **Recharts theming is hardcoded.** Tick fills (`#6b7280`), grid strokes (`#2a2a2e`), tooltip backgrounds (`var(--color-surface, #1f2937)`), cursor fills (`rgba(255,255,255,0.04)`) — none of this token-flips. Phase 3 polish will likely need a small `chartTheme()` helper that reads the active theme and returns recharts-compatible color objects.

8. **`.input` and the button primitives are under-used.** Many input/button sites in BoardPage hand-roll the same Tailwind chains rather than using the @layer-defined classes. Consolidating could be done before redesign or rolled into Phase 2.

9. **Dead code paths in LoginPage** — the `!configured` branch (lines 40-51) cannot fire today because `isGoogleConfigured()` always returns true. Removing it would make the file 12 lines shorter and one fewer visual variant to redesign.

10. **The `accent` color is the highest-leverage token to redesign.** Today it's the literal hex `#6366f1` in `tailwind.config.js`, and at least 4 sites in BoardPage repeat the literal hex instead of using `bg-accent`. Lifting it into `--color-accent: 99 102 241` (and 4-site cleanup) would make the entire redesign trivially re-paletteable.

11. **`--color-text-muted` is identical in dark and light themes.** Combined with the literal `#6b7280` in some recharts ticks and progress fallbacks, this works against contrast accessibility in light mode. Worth a Driver-side decision on whether to differentiate.

12. **Tailwind config has `plugins: []`.** No `@tailwindcss/forms` or `@tailwindcss/typography`. Worth flagging: if the redesign wants polished form controls or markdown-rendered briefs (current implementation is a hand-rolled `.replace()` chain at `BoardPage.jsx:1990`), `@tailwindcss/typography` would be a candidate dependency. Per DIRECTIVE.md §4, **flag, do not add**.

---

*End of AUDIT_PHASE_0A.md*
