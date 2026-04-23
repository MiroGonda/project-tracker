# CLAUDE.md — Phobos Requests Tracker

Primary briefing for any agent operating on this repository. Read this end-to-end before making changes. The project has evolved significantly from its original "Ares Dashboard" form — parts of the file tree, package name, and legacy references still say "ares-dashboard" for historical reasons, but the product is now **Phobos Requests Tracker**.

---

## 1. One-line Project Identity

A **React + Vite single-page app** hosted on GitHub Pages that provides per-board project dashboards, a rich request-tracking tab, a timeline/calendar view, and admin-controlled access for a Frost Design design/production pipeline. Cards are sourced from either the **Phobos/Ares API** (consumed Trello mirror) or directly from the **Trello REST API** through a **Firebase Cloud Function** (manual boards). Shared configuration and per-user preferences live in **Firestore**.

- **Live site:** `https://mirogonda.github.io/project-tracker/` — must stay live.
- **Browser title:** `Phobos Requests Tracker` ([index.html:7](index.html#L7)).
- **Package name (legacy):** `ares-dashboard` in [package.json](package.json) — do not rename unless you also change the GitHub Pages deploy pipeline.
- **Firebase project:** `phobos-9246e` (hardcoded in [src/firebase.js](src/firebase.js)).

---

## 2. Keep It Online — Deploy / CI

- **Trigger:** Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): `npm install → npm run build → upload dist/ → deploy to GitHub Pages`.
- **Verify before pushing:** `npm run build` must succeed. A broken build breaks the live dashboard for every user.
- **GitHub Pages base path:** `base: '/project-tracker/'` in [vite.config.js:22](vite.config.js#L22) and `basename: '/project-tracker'` in [src/App.jsx:49](src/App.jsx#L49). These two MUST stay in sync or the site 404s after deploy.
- **SPA fallback:** The Vite build plugin in [vite.config.js:13-20](vite.config.js#L13-L20) copies `dist/index.html` → `dist/404.html` so GitHub Pages serves the SPA for deep links. Do not remove.
- **Firebase deploys are separate** — see §12 (Cloud Functions).

---

## 3. High-level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React SPA served by GitHub Pages)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  AccessProvider (Firebase Auth + config/access doc)    │  │
│  │  ThemeProvider                                         │  │
│  │  <Sidebar /> │ <BoardPage /> / <Settings /> / <Admin /> │  │
│  └────────────────────────────────────────────────────────┘  │
└────┬──────────────┬────────────────┬───────────────┬────────┘
     │              │                │               │
     │              │                │               │
     ▼              ▼                ▼               ▼
┌─────────┐   ┌───────────┐    ┌───────────┐   ┌──────────────┐
│ Phobos/ │   │ Trello    │    │ Firestore │   │ Cloud        │
│ Ares    │   │ REST API  │    │ (phobos-  │   │ Functions    │
│ API     │   │           │    │  9246e)   │   │ (manual sync)│
└─────────┘   └───────────┘    └───────────┘   └──────────────┘
(Ares        (manual boards   (config/access,   (Trello→cache/
 boards)      + custom         requests,         manual_{id})
              fields)          userPrefs,
                               cache)
```

**Board "source" drives data flow** — each board in `config/access.boards[boardId]` has a `source` field:

| Source | Card/movement data | Cycle time | Refresh |
|---|---|---|---|
| `ares` | Phobos `/boards/:id/cards` + `/movements` (live) | `cycleTime()` Phobos endpoint | `loadData(true)` |
| `manual` | Cloud-Functions-populated Firestore cache at `cache/manual_{boardId}` | Pre-computed `cycleDays` map | `triggerManualSync()` calls the HTTP function |

---

## 4. Tech Stack

| Layer | Choice | Version (package.json) |
|---|---|---|
| Frontend | React + Vite | React 18.2, Vite 5.1 |
| Routing | react-router-dom (data router) | 6.22 |
| Styling | Tailwind CSS v3 + CSS tokens | 3.4 |
| Charts | recharts | 2.12 |
| Icons | lucide-react | 0.344 |
| HTTP | axios (Phobos/Ares + Raintool) + fetch (Trello) | 1.6 |
| Auth | **Firebase Auth** (Google provider, `signInWithPopup`) | firebase 12.12 |
| Persistence | **Firestore** + localStorage (seeded from Firestore on login) | firebase 12.12 |
| Background | **Firebase Cloud Functions (v2)** — Node.js | `functions/index.js` |
| Hosting | GitHub Pages (via GitHub Actions) | — |

> **Clarification on auth:** older docs (including reference materials) mention "Google Identity Services (GIS)" with a manually-entered `google_client_id`. That is **out of date**. Today auth is 100% Firebase Auth — no client ID is entered anywhere. See [src/api/google.js](src/api/google.js) and [src/firebase.js](src/firebase.js).

---

## 5. Full File Structure

```
project-tracker/
├── .github/workflows/deploy.yml      # GitHub Pages deploy
├── .referenceMaterials/              # API + design references (see §14)
├── functions/
│   ├── index.js                      # Cloud Functions: syncBoardHttp + syncAllBoards
│   └── package.json
├── public/
│   └── access-config.json            # LEGACY — no longer the source of truth
├── src/
│   ├── api/
│   │   ├── access.js                 # config/access Firestore doc helpers + role functions
│   │   ├── google.js                 # Firebase Auth wrapper (signInWithPopup / signOut)
│   │   ├── phobos.js                 # Phobos/Ares API axios client + Raintool list
│   │   ├── requests.js               # boards/{id}/requests Firestore CRUD + subscribeRequests
│   │   ├── trello.js                 # Trello REST API (labels, custom fields, cards, actions)
│   │   └── userPrefs.js              # userPrefs/{email} Firestore get/set
│   ├── components/
│   │   ├── Sidebar.jsx               # Nav + board list (reactive to hidden_board_ids)
│   │   ├── Spinner.jsx               # 12-line spinner primitive
│   │   └── Toast.jsx                 # Toast notification container
│   ├── context/
│   │   ├── AccessContext.jsx         # Auth state + config/access subscription + hiddenIds
│   │   └── ThemeContext.jsx          # isDark toggle, syncs .light class on <html>
│   ├── hooks/
│   │   └── useToast.js               # Toast queue hook
│   ├── pages/
│   │   ├── Admin.jsx                 # Access + service config (admins only)
│   │   ├── Ares.jsx                  # ⚠️ LEGACY / UNROUTED — safe to archive
│   │   ├── BoardPage.jsx             # Main work surface — 3 tabs: Request/Dashboard/Timeline
│   │   ├── LoginPage.jsx             # Google sign-in screen
│   │   └── Settings.jsx              # Per-user settings + board configuration modal
│   ├── App.jsx                       # Router + providers + auth gating
│   ├── firebase.js                   # Firebase app init (projectId: phobos-9246e)
│   ├── index.css                     # Tailwind imports + theme tokens + component classes
│   └── main.jsx                      # ReactDOM.createRoot
├── firebase.json                     # functions: ./functions, firestore: firestore.rules
├── firestore.rules                   # Security rules (see §11)
├── index.html                        # Vite entry — <title>Phobos Requests Tracker</title>
├── package.json                      # name: "ares-dashboard" (legacy)
├── postcss.config.js                 # Tailwind + autoprefixer
├── tailwind.config.js                # Theme extension (accent, bg, surface, text-*, border)
└── vite.config.js                    # base: '/project-tracker/' + 404.html copy plugin
```

**Files to know cold:**
- [src/pages/BoardPage.jsx](src/pages/BoardPage.jsx) — ~5,500 lines, by far the heaviest file. Houses the three tabs plus a dozen nested components (RequestTab, RequestVolumeSection, TimelineTab, CustomColumnsModal, CustomFieldCell, ThroughputKpiPanel, PipelineDistribution, SectionCard, FilterPicker, SortTh, CycleTimeSummary, RequestVolumeSection, KpiTile, and more).
- [src/pages/Settings.jsx](src/pages/Settings.jsx) — Per-user settings + the `BoardConfigModal` that consolidates Dates/SLA/Passes/External-users per board.
- [src/pages/Admin.jsx](src/pages/Admin.jsx) — Shared service credentials + admin list + per-board source and user assignments.

---

## 6. Data Model

### 6.1 Firestore collections

| Path | Purpose | Writer(s) | Reader(s) |
|---|---|---|---|
| `config/access` | Single document holding the whole access + board config. See §6.2. | Admins through `Admin.jsx` + `Settings.jsx` `BoardConfigModal` | All authenticated users via `onSnapshot` |
| `boards/{boardId}/requests/{requestId}` | Request cards (the Request tab data) | Any authenticated user | Any authenticated user |
| `userPrefs/{userEmail}` | Per-user preferences (`hiddenBoardIds`, `passTracking`) | The user themself only | The user themself only |
| `cache/manual_{boardId}` | Pre-computed Trello data for manual boards | Cloud Functions (Admin SDK) only | All authenticated users |

### 6.2 `config/access` document shape

```jsonc
{
  "admins": ["alice@frost.com", "bob@frost.com"],          // bootstrap: if empty, any signed-in user is admin
  "services": {                                             // shared credentials (admin-managed)
    "phobosHost":    "https://ares.frostdesigngroup.com",
    "phobosApiKey":  "…",                                   // X-API-Key for Phobos/Ares
    "raintoolHost":  "https://hailstorm.frostdesigngroup.com",
    "trelloApiKey":  "…",                                   // Trello REST API key
    "trelloToken":   "…"                                    // Trello user token
  },
  "boards": {
    "hLL7WW2V": {
      "name":           "GCash: Design Support 2026",
      "source":         "ares",                              // "ares" or "manual"
      "trelloShortId":  "hLL7WW2V",                          // required for manual source
      "frostUsers":     ["designer@frost.com"],              // full access
      "externalUsers":  ["client@partner.com"],              // view-only (external roles)
      "users":          [],                                  // LEGACY — '*' means all-hands; still honored
      "startDate":      "2026-01-05",                        // Timeline duration breakdown
      "endDate":        "2026-06-30",                        //   "
      "slaDays":        14,                                  // SLA-based pass coloring in Request tab
      "customColumns":  [                                    // §9.4 Custom columns
        { "id": "col_1712...", "name": "Notes",    "type": "text" },
        { "id": "col_1713...", "name": "Priority", "type": "select",
          "options": ["Low", "Medium", "High"] }
      ]
    }
  }
}
```

### 6.3 `boards/{boardId}/requests/{requestId}` shape

```jsonc
{
  "id":               "req_1712345678901",
  "item":             12,                                 // sequential display number
  "mc":               "MC-42",                            // display code
  "date":             "2026-03-15",                       // filed date (YYYY-MM-DD)
  "name":             "Homepage hero banner",
  "brief":            "…markdown allowed…",
  "deadline":         "2026-04-01",
  "spoc":             "Jane Doe",
  "status":           "open",                             // "open" | "on-hold" | "closed"
  "attachedCardIds":  ["660a...", "660b..."],             // Trello card IDs
  "customFields":     { "col_1712...": "High-priority" } // keyed by customColumns[].id
}
```

Firestore rules enforce `id == requestId` and `status in ['open','on-hold','closed']` on writes ([firestore.rules:14-16](firestore.rules#L14-L16)).

### 6.4 `userPrefs/{email}` shape

```jsonc
{
  "hiddenBoardIds": ["hLL7WW2V"],                        // hidden from the user's sidebar
  "passTracking": {                                      // which boards have pass tracking enabled
    "hLL7WW2V": {
      "enabled": true,
      "fieldIds": {                                      // Trello custom-field IDs created by Settings
        "first":  "65abc…",
        "second": "65def…",
        "third":  "65ghi…"
      }
    }
  }
}
```

### 6.5 `cache/manual_{boardId}` shape (populated by Cloud Functions)

```jsonc
{
  "activeCards":     [ /* normalized card objects */ ],
  "doneCards":       [ /* normalized card objects */ ],
  "completionDates": { "cardId": "2026-03-12T…" },        // last move INTO a Done lane
  "activatedDates":  { "cardId": "2026-02-01T…" },        // first move OUT of a Pending lane
  "cycleDays":       { "cardId": 39.5 },                  // completion − activation in days
  "lastActionDate":  "2026-03-18T08:00:00.000Z",          // incremental sync cursor
  "updatedAt":       <Firestore timestamp>,
  "boardId":         "hLL7WW2V",
  "trelloShortId":   "hLL7WW2V"
}
```

### 6.6 localStorage keys (seeded from Firestore on login)

| Key | Source | Used by |
|---|---|---|
| `phobos_host`, `phobos_api_key` | `config.services.phobosHost/ApiKey` (falls back to legacy `aresHost`/`aresApiKey`) | [src/api/phobos.js](src/api/phobos.js) |
| `raintool_host` | `config.services.raintoolHost` | `rtClient()` in [phobos.js:23](src/api/phobos.js#L23) |
| `trello_api_key`, `trello_token` | `config.services.trelloApiKey/Token` | [src/api/trello.js](src/api/trello.js) |
| `hidden_board_ids` | `userPrefs[email].hiddenBoardIds` | Sidebar + Settings |
| `pass_tracking` | `userPrefs[email].passTracking` | BoardPage + Settings |
| `ppms_theme` | not seeded; user toggle | ThemeContext |
| `requests_{boardId}` | legacy local-only request store | migrated once to Firestore by [api/requests.js:34](src/api/requests.js#L34) then deleted |
| `req_targets_{boardId}` | local-only Request Volume targets | `ReqTargetsPanel` (BoardPage) |
| `targets_{boardId}` | local-only cycle-time targets | Dashboard KPIs |
| `rt_project_{boardId}` | local-only — Raintool project for cycle time (Ares boards) | (Integrations section has been removed from Settings UI but the lookup still happens in BoardPage) |

> The `config.services.*` → localStorage seeding happens in [AccessContext.jsx:13-22](src/context/AccessContext.jsx#L13-L22) on every snapshot tick. Legacy `aresHost`/`aresApiKey` fields are still read for backwards compat.

---

## 7. Authentication Flow

1. User hits the site → [src/App.jsx](src/App.jsx) renders `<AppShell />`.
2. `AccessProvider` ([src/context/AccessContext.jsx](src/context/AccessContext.jsx)) runs two effects:
   - `onAuthStateChanged(auth, …)` — sets `email`, fetches `userPrefs/{email}`, seeds `hiddenIds` and `pass_tracking` in localStorage.
   - `onSnapshot(ACCESS_DOC, …)` — subscribes to `config/access`, seeds all `services.*` credentials into localStorage, keeps `config` state live.
3. If `!email && !isSettings` → `<LoginPage />` is shown; Google sign-in uses `signInWithPopup` ([src/api/google.js:24-33](src/api/google.js#L24-L33)).
4. The `/admin` route is gated by `canAdmin` (bootstrap-friendly: if `admins[]` is empty, any signed-in user gets through).

### Critical timing fix

In incognito sessions, `onSnapshot` on `config/access` was firing before Firebase Auth resolved, failing with permission-denied, and the error handler was zeroing out the config — which in turn made `canAdminister({ admins: [] }, email)` return `true` and the non-admin saw the Admin tab. The fix (commit `33be9d2`): the `onSnapshot` listener is now gated on `authUser` state, re-subscribing after auth resolves. Do not regress this.

---

## 8. Access Control Model

Three roles (derived in [src/api/access.js](src/api/access.js)):

| Role | Where stored | Capabilities |
|---|---|---|
| **Admin** | `config.admins[]` | Everything: `/admin`, all boards, all configuration |
| **Frost** | `boards[id].frostUsers[]` (or legacy `users[]` incl. `'*'`) | Can view boards assigned + configure them (Passes, SLA, Dates, External Users, Custom Columns) |
| **External** | `boards[id].externalUsers[]` | Read-only access to their assigned boards; cannot access Settings configuration |

**Bootstrap:** if `admins[]` is empty, `canAdminister(config, email)` returns `true` for any signed-in user — this is the intended first-run flow. As soon as the first admin is saved, the door closes.

**Important:** do NOT treat `public/access-config.json` as the source of truth. It is legacy and unused at runtime. All access reads happen against Firestore `config/access`.

**Per-board role helpers:**
- `isAdmin(config, email)` → boolean
- `canAdminister(config, email)` → boolean (bootstrap-aware)
- `getAccessibleBoardIds(config, email)` → `Set<boardId>`
- `getUserBoardRole(config, email, boardId)` → `'admin' | 'frost' | 'external' | null`
- `canConfigureBoard(config, email, boardId)` → boolean (admin or frost)

---

## 9. Pages & Features

### 9.1 Sidebar — [src/components/Sidebar.jsx](src/components/Sidebar.jsx)

- Lists boards the user can access (admin → all, frost/external → assigned). Hidden boards (from `hiddenIds` context) are filtered out.
- Merges **Phobos `listBoards()`** (5-minute localStorage cache) with **manual boards** read from `config.boards` that don't appear in the Phobos list.
- Static nav: Settings (all signed-in users) + Admin (only when `canAdmin`).
- Re-fetches `listBoards()` after `configLoading` flips to false so API keys seeded by AccessContext are actually used.

### 9.2 Login — [src/pages/LoginPage.jsx](src/pages/LoginPage.jsx)

Plain Google sign-in button. `isGoogleConfigured()` currently always returns `true` ([src/api/google.js:4](src/api/google.js#L4)) — Firebase handles it internally, no client ID required.

### 9.3 Settings — [src/pages/Settings.jsx](src/pages/Settings.jsx)

Per-user settings surface. Sections (gated by role):
1. **Google Account** — connect/disconnect + show signed-in email.
2. **Board Configuration** — one compact row per board the user can configure:
   - Status chips: Dates / SLA / Passes / Hidden
   - **Configure** button → opens `BoardConfigModal` containing:
     - **Project Dates** (admin) — start/end date pickers saved to `config.boards[id].startDate|endDate`. Powers Timeline duration breakdown.
     - **SLA** (admin) — numeric days input saved to `config.boards[id].slaDays`. Powers pass-column coloring in Request tab.
     - **Pass Tracking** (admin) — creates three Trello date custom fields ("1st Pass", "2nd Pass", "3rd Pass") via [src/api/trello.js](src/api/trello.js) and stores the IDs in `userPrefs[email].passTracking[boardId]`.
     - **External User Invitations** (admin + frost) — tag-style editor for `externalUsers[]`.
   - Hide/show toggle (admin only) — writes to `userPrefs.hiddenBoardIds` via `toggleBoardHidden` in AccessContext.
3. **Appearance** — theme toggle (isDark).

### 9.4 Admin — [src/pages/Admin.jsx](src/pages/Admin.jsx) (admins only)

1. **Backend Services** — shared Phobos host/API key, Raintool host, Trello key/token. Includes JSON import/export.
2. **Google Account** — (mirror of Settings).
3. **Appearance** — theme toggle.
4. **Admins** — email list editor for `config.admins[]`.
5. **Project Access** — searchable per-board list:
   - Source toggle: `ares` vs `manual`. Manual requires a `trelloShortId` (entered inline).
   - Per-board Frost users and External users.
   - Expandable rows reveal user assignment forms.
   - New manual board creation (for projects the Phobos API doesn't know about).
6. **Raw JSON** — collapsible debug view of the full `config` doc.
7. **Unsaved changes guard** — `useBlocker` from `react-router-dom` data-router; this is why [src/App.jsx:46](src/App.jsx#L46) uses `createBrowserRouter`.

### 9.5 BoardPage — [src/pages/BoardPage.jsx](src/pages/BoardPage.jsx)

The main work surface, split into **three tabs** (`activeTab` state, defined at [BoardPage.jsx:4916-4920](src/pages/BoardPage.jsx#L4916-L4920)):

#### 9.5.1 Request tab (default landing tab)

The Request tracking system — the single most feature-dense surface in the app.

- **Request Volume section** (top, ~220px) with **3-way view toggle**: Summary (default) / Chart / Table.
  - **Summary view:** KPI tiles (Total, Open, On Hold, Closed, **Overdue**, **Unassigned**), Stage Breakdown stacked bar (colored by `STATUS_COLOR`), and Pass Pipeline panel (Awaiting 1st/2nd/3rd + Complete + SLA health bar) — or Overall Progress panel when pass tracking is off.
  - **Chart view:** recharts `ComposedChart` with stacked open/on-hold/closed bars + optional target Area overlay, weekly/monthly.
  - **Table view:** per-period rows with Open/On Hold/Closed/Total columns + optional Target + vs-Target %.
- **Request table** below with column groups visually separated:
  - **Request** (core): #, MC, Status (dropdown), Filed, Name/Brief, Stage, Progress, Deadline, SPOC.
    - Stage color = `STATUS_COLOR[stage]` (plain text).
    - Deadline red when `overdue`.
    - Progress = weighted sum across attached cards using `STATUS_WEIGHT` (Pending 0 → Ongoing .2 → For Review .5 → Revising .6 → For Approval .85 → Done 1.0) divided by denominator (target-for-period OR srcCards count).
  - **Passes** (cyan group tint, only when pass tracking enabled): 1st / 2nd / 3rd Pass. Earlier filled passes → muted grey; latest pass on an **open** request → SLA-graded color (healthy green → amber → orange → red); closed/on-hold → all muted.
  - **Custom** (accent tint): configured `customColumns[]`. Each cell is editable inline (text, date, checkbox, dropdown) via `CustomFieldCell`.
- **Columns** button (admin + frost only) opens `CustomColumnsModal`: add/delete/rename columns, pick type, edit dropdown options with tag UI. Column definitions persist to `config.boards[id].customColumns`; per-request values persist to `request.customFields[colId]`.
- **Edit panel** (right side, 560px, when a row is clicked):
  - **Details tab** — fields + **For Ops** auto-generated copy field (`"MC-# - MonthName - Name"`) with clipboard button + **Custom columns** section + **Brief** markdown editor with preview.
  - **Cards tab** — view/edit split. **View mode** shows attached cards with type badge, status, and P1/P2/P3 dates (if enabled). **Edit mode** opens the full card picker with MC filter, name search, "Hide done cards" toggle; Process cards sort before Work cards.

#### 9.5.2 Dashboard tab

The original analytics surface. Renders only when `config` has loaded and the board is not in a configMissing state.

- **Top controls:** date-range presets (7/30/custom picker), refresh button, manual-sync button for manual boards.
- **Throughput section** ([src/pages/BoardPage.jsx](src/pages/BoardPage.jsx) `Throughput`): recharts stacked bar of done cards over time, period toggle (Daily/Weekly/Monthly), Easy/Medium/Hard difficulty split for Work + a Process lane. Chart and table view + CSV/PNG export. Click a bar → drilldown.
- **Throughput KPI panel** — **"Done (85p)"** (85th-percentile cycle time of cutoff-filtered Done cards) + **"WIP (85p)"** (85th-percentile *age* of Ongoing/For Review/Revising/For Approval pipeline cards; uses movement activation dates for Ares boards, `ongoingCycleMap` for manual). Difficulty breakdown below.
- **Pipeline Distribution** — 3 tabs (Category / Type / Labels) of active-card histograms.
- **Pipeline table** — MC# rows × lane-category columns. Supports drilldown by cell click. Filters: include/exclude MC, hide done.
- **Filters** (lifted state): listFilter, labelFilter, typeFilter (Work/Process/all), mcFilter — affect KPI counts, throughput, and pipeline simultaneously.
- **Drilldowns** — done-KPI drilldown replaces pipeline with Done Cards view (emerald-tinted); throughput-bucket drilldown; table-cell drilldown.

**Data sources:**
- Ares boards: `boardCards(boardId)` + `boardMovements(boardId)` + optional `cycleTime(rtProjectId)` (requires a Raintool project ID in `rt_project_{boardId}` localStorage).
- Manual boards: read directly from `cache/manual_{boardId}` Firestore doc populated by Cloud Functions.

#### 9.5.3 Timeline tab

- **Project Duration** panel (top, only when Dates are configured) — large progress %, stacked KPI tiles (Remaining: days/weeks/biz-days, Elapsed), colored by overdue state.
- **Calendar** — month grid showing requests deadlines (purple chips) and **PH public holidays** (rose tint). Weekends muted. Navigates month.
- **Gantt Chart** — bars from filed-date → deadline, today-line overlay, adaptive week/month labels. Toggle: **Active** vs **Closed**.

---

## 10. Key Concepts & Conventions

### 10.1 LANE_MAP

The single biggest shared constant — a flat object mapping Trello list names → `{ type, category, status }`. Used to:
- Classify cards as Pending / Ongoing / For Review / Revising / For Approval / Done / Discarded.
- Distinguish Work Lane vs Process Lane vs Misc.
- Compute Cloud-Functions cycle time (first move out of Pending → last move into Done).

Defined in [src/pages/BoardPage.jsx:86](src/pages/BoardPage.jsx#L86) AND mirrored in [functions/index.js:32](functions/index.js#L32). **Both copies must stay in sync** — if you add a list name to BoardPage, add it to the Cloud Function too.

### 10.2 Cycle time & completion date

- **Completion date** = last move into a Done lane (from movements). If the board has no movement data at all, falls back to `dateLastActivity`.
- **First activation** = earliest move *out of* a Pending lane. Cards created directly in an active lane will not have this.
- **Cycle days** = completion − activation (days, one decimal).

For manual boards this is computed server-side in [functions/index.js:300-307](functions/index.js#L300-L307). For Ares boards this comes from Phobos `cycleTime()` (requires Raintool project ID).

### 10.3 Card type — Work vs Process

`getCardType(card)` returns `'Process'` if any label name matches `/main card/i`, otherwise `'Work'`. Drives the purple/indigo Process/Work badges throughout the UI.

### 10.4 Pass Tracking

- Enabling on a board creates three date-type Trello custom fields (`1st Pass`, `2nd Pass`, `3rd Pass`) via [src/api/trello.js:75-87](src/api/trello.js#L75-L87).
- Field IDs stored in `userPrefs[email].passTracking[boardId].fieldIds`.
- On BoardPage load, `fetchBoardCardsWithFields` populates `passMap: Map<cardId, {first, second, third}>`.
- Per-request pass date = **earliest** pass date across attached cards (`getRequestPassDate`).
- Coloring rules (request-level): only the *latest* filled pass on an **open** request gets SLA coloring; earlier passes are muted (fulfilled).

### 10.5 SLA coloring

When `config.boards[id].slaDays` is set AND pass tracking is enabled:
- `daysSince = today − passDate`; `ratio = daysSince / slaDays`.
- Ratio < 0.5 → emerald (healthy); 0.5–0.75 → amber; 0.75–1.0 → orange; ≥ 1.0 → red (breached).
- Closed / on-hold requests show all passes muted grey.

### 10.6 Custom columns

Fully described in §9.5.1 Request tab. Key file locations: `CustomColumnsModal` + `CustomFieldCell` in [src/pages/BoardPage.jsx](src/pages/BoardPage.jsx). Column deletion preserves per-request data (soft-delete) — re-creating a column with the same ID restores it.

### 10.7 Request progress

`computeRequestProgress(req, cards, doneCards, targets)`:
1. Pick `srcCards` — all Process cards if any attached, else all attached cards (Work + Process mixed).
2. For each card, weight by `STATUS_WEIGHT[lane.status]` (Done=1.0). Sum.
3. Denominator = period target (if `targets` contains a matching date window) OR `srcCards.length`.
4. Return `{ pct, done, total, vsTarget }`.

### 10.8 Three-way toggle convention

Buttons live inline in the section header: Summary | Chart | Table (or View/Edit in the Cards tab). Tailwind pattern: `flex border border-border rounded-lg overflow-hidden` with `bg-accent/20 text-accent` active state.

---

## 11. Firestore Security Rules

File: [firestore.rules](firestore.rules). Summary:

| Path | Read | Write |
|---|---|---|
| `config/access` | any authenticated user | any authenticated user (UI enforces admin gating) |
| `boards/{id}/requests/{reqId}` | any authenticated user | any authenticated user, provided `id == requestId` and `status ∈ {open, on-hold, closed}` |
| `cache/{doc}` | any authenticated user | denied (only Cloud Functions via Admin SDK can write) |
| `userPrefs/{email}` | only the owning user | only the owning user (`request.auth.token.email == userEmail`) |

> **Note on `config/access` write permissions:** the rule is permissive (any auth'd user can write). This is intentional for bootstrap but means UI-level role gating is the only barrier for non-admins. The custom-columns feature relies on this for frost-user writes.

Deploy rules with: `firebase deploy --only firestore:rules`.

---

## 12. Cloud Functions — [functions/index.js](functions/index.js)

Two exports, both under `us-central1`:

### `syncBoardHttp` (onRequest)

- URL: `https://us-central1-phobos-9246e.cloudfunctions.net/syncBoardHttp?boardId=<id>`
- Called by the frontend refresh button on **manual** boards (`triggerManualSync()` in BoardPage).
- Validates board exists, has `source: 'manual'`, has a `trelloShortId`, and that Trello credentials are configured.
- Delegates to `syncBoard()`.

### `syncAllBoards` (onSchedule, every 60 min)

- Scans all manual boards in `config/access` and syncs each in parallel.
- Reads Trello credentials from `config.services.trelloApiKey/Token`.

### `syncBoard(boardId, trelloShortId, key, token)` — core routine

1. Load existing `cache/manual_{boardId}` — gets `lastActionDate` for incremental cursor.
2. Fetch **all cards** from Trello (always full — we need current state).
3. Fetch **actions** from Trello since `lastActionDate` (or full history on first run).
4. Split cards by `LANE_MAP` into active (not Done, not Discarded) and done.
5. Seed `completionMap` + `firstActivatedAt` from existing cache; layer in new actions.
6. Compute `cycleDays`.
7. Write `cache/manual_{boardId}` with all of this plus the new cursor.

**Secrets:** `TRELLO_KEY` / `TRELLO_TOKEN` are legacy env vars — current implementation reads from `config.services.*` instead. The docstring at the top of the file mentions `firebase functions:secrets:set` — that's no longer the pattern.

**Deploy functions:** `firebase deploy --only functions` (separate from the GitHub Pages SPA deploy).

---

## 13. Design System

### 13.1 CSS tokens ([src/index.css](src/index.css))

```css
:root {                         /* dark (default) */
  --color-bg:           15 15 15;
  --color-surface:      28 28 30;
  --color-text-primary: 232 232 232;
  --color-text-muted:   107 114 128;
  --color-border:       42 42 46;
}
html.light { /* lighter palette */ }
```

Tokens are exposed to Tailwind via `rgb(var(--color-bg) / <alpha-value>)` syntax in [tailwind.config.js:6-13](tailwind.config.js#L6-L13). Accent is fixed at `#6366f1` (indigo).

### 13.2 Component primitives (in `src/index.css` @layer components)

- `.input` — full-width form input with rounded border, focus ring.
- `.btn-primary` — accent background, rounded.
- `.btn-secondary` — border-only, hover tint.

### 13.3 Shared page components

- `<SectionCard>` — rounded surface with title, optional `headerRight` slot, `drilldown`/`done` border colors, `slim` padding variant.
- `<SortTh>` — header cell with active sort indicator (`ChevronUp`/`Down`).
- `<FilterPicker>` — include/exclude (click vs right-click) multi-select popover with search.
- `<ConfigSection>` (Settings) — icon + title + description + body, unified look for each modal section.
- `<KpiTile>` (Request Volume Summary) — compact KPI box.

### 13.4 Typography

Single font: **Inter** (loaded from Google Fonts in [index.html:8-10](index.html#L8-L10)). Typical text sizes: `text-[10px]` for uppercase micro labels, `text-[11px]` for muted metadata, `text-xs` for body, `text-sm` for headers.

### 13.5 Colors semantic meaning

| Color | Meaning |
|---|---|
| accent (indigo #6366f1) | Interactive / primary |
| emerald-400/500 | Done / healthy / success / closed |
| blue-400 | Open / neutral-active |
| amber-400 | Warning / waiting / on-hold-ish / amber SLA |
| orange-400/500 | Elevated warning / SLA 75-100 / on-hold |
| red-400/500 | Overdue / SLA breached / danger |
| cyan-400 | Dates group / business metric |
| purple-300, indigo-300 | Process / MC / Request chips |
| text-muted / text-muted/25-60 | Secondary / tertiary text |

---

## 14. Reference Materials

Located in [.referenceMaterials/](.referenceMaterials/). These are authoritative for API contracts and some legacy design decisions — consult them when touching the respective areas.

| File | Covers | When to read |
|---|---|---|
| [ares-api-guide.md](.referenceMaterials/ares-api-guide.md) | Phobos/Ares REST API: endpoints, auth, pagination, error codes | Before making any change to [src/api/phobos.js](src/api/phobos.js) or when debugging data mismatches |
| [ares-pipeline-cycle-time.md](.referenceMaterials/ares-pipeline-cycle-time.md) | Original pipeline + cycle-time rebuild spec | Cycle-time-related bugs |
| [ares-dashboard-claude.md](.referenceMaterials/ares-dashboard-claude.md) | Original rebuild reference for the Ares dashboard | Historical context for the Dashboard tab |
| [throughput-implementation.md](.referenceMaterials/throughput-implementation.md) | Throughput chart spec | Throughput section changes |
| [raintool-api-guide.md](.referenceMaterials/raintool-api-guide.md) | Raintool REST (for cycle-time project selection) | Raintool integration changes |
| [runn-api-docs.md](.referenceMaterials/runn-api-docs.md) | Runn.io API (for Utilization) | **HISTORICAL** — Utilization tab is not currently implemented; see §15 |
| [utilization-feature.md](.referenceMaterials/utilization-feature.md) + [utilization-rebuild.md](.referenceMaterials/utilization-rebuild.md) | Planned Utilization backend spec | See §15 |
| [task-queue.md](.referenceMaterials/task-queue.md) | Historical task queue | Low-priority context |
| [.referenceMaterials/CLAUDE.md](.referenceMaterials/CLAUDE.md) | **Old** top-level CLAUDE.md (pre-Phobos rename) | Historical only — **this file supersedes it** |

Also review the project cheat sheet: [.referenceMaterials/OPS_ CAPS - Miro's PPMS Cheat Sheet.csv](.referenceMaterials/OPS_%20CAPS%20-%20Miro's%20PPMS%20Cheat%20Sheet.csv).

---

## 15. Legacy / Known-Obsolete Surface

Before you touch anything in these areas, know that current docs or files may contradict live code. Ask before relying on them:

- **`public/access-config.json`** — used to be the source of truth; now ignored at runtime. Firestore `config/access` is authoritative.
- **`src/pages/Ares.jsx`** — **not routed** in [src/App.jsx](src/App.jsx). It is a prototype of the Dashboard tab from before the multi-tab refactor. Safe to archive / delete. Do not add routing for it without explicit user approval.
- **"Google Identity Services / google_client_id"** — mentioned in the old CLAUDE.md and some reference materials. Auth is Firebase only.
- **Utilization tab** — documented in reference materials but **does not exist in the code**. The backend proxy was never deployed. There is no `UtilizationTab.jsx` file, no `/api/runn.js`. Ignore references to it until the user decides to build it.
- **Integrations (Raintool project picker) in Settings** — was removed from the Settings Board Configuration modal. The `rt_project_{boardId}` localStorage key is still consulted by the Dashboard cycle time code, but there is no UI to set it today.
- **Old `ares_host` / `ares_api_key` localStorage keys** — legacy; `phobos_host` / `phobos_api_key` are the current names. Reads fall back to the old keys for backwards compat.
- **`migrateLocalRequests()`** in [src/api/requests.js:34](src/api/requests.js#L34) — one-time migration of localStorage requests into Firestore. Still fires on load; harmless after migration since it removes the localStorage key first.

---

## 16. Common Tasks — Where to Look

| Task | Start here |
|---|---|
| Change how cards are classified (Work vs Process, status per lane) | Both `LANE_MAP`s: [src/pages/BoardPage.jsx:86](src/pages/BoardPage.jsx#L86) AND [functions/index.js:32](functions/index.js#L32) |
| Add a new tab to BoardPage | `TABS` const at [src/pages/BoardPage.jsx:4916](src/pages/BoardPage.jsx#L4916) + `activeTab === 'yourId'` render branches |
| Adjust Request tab KPIs / Summary view | `RequestVolumeSection` in [src/pages/BoardPage.jsx](src/pages/BoardPage.jsx) (search for `function RequestVolumeSection`) |
| Add a new column to the Request table | Header `<thead>` block + per-row `<tr>` in the main RequestTab render |
| Add a new custom column type | `CustomFieldCell` + `COL_TYPES` array in `CustomColumnsModal` |
| Change who can configure a board | `canManageColumns` in BoardPage's RequestTab invocation + `admin || isFrost` checks in Settings's `BoardConfigModal` |
| Change access rules | [src/api/access.js](src/api/access.js) helpers + [firestore.rules](firestore.rules) |
| Add a new per-board config field | Extend `config.boards[id].*` in Firestore (via `updateConfig`) + consume it wherever needed. Firestore rules don't validate board-level fields. |
| Change the Cloud Function sync schedule | `onSchedule({ schedule: '...' })` in [functions/index.js:371](functions/index.js#L371). Deploy with `firebase deploy --only functions`. |
| Change the sync behavior for a new lane | Update BOTH `LANE_MAP`s AND consider whether existing cached data in `cache/manual_{id}` needs clearing |
| Add a new theme color | Add CSS token to [src/index.css](src/index.css) `:root` + `html.light` blocks, map in [tailwind.config.js](tailwind.config.js) |
| Add a new reference material | Drop it in [.referenceMaterials/](.referenceMaterials/) and add an entry to §14 |
| Debug "I'm admin but UI shows me as non-admin" | Check the incognito timing fix (§7) — the `onSnapshot` must re-fire after auth. |

---

## 17. Important Rules of Engagement

- **Never push a broken build to `main`** — see §2. Always run `npm run build` locally first.
- **Never overwrite [public/access-config.json](public/access-config.json) with dummy data** — while it's not used at runtime, dropping it would remove a fallback artifact for future migrations.
- **Do not skip Git hooks or CI** — the GitHub Pages deploy is the only check between a push and a live regression.
- **When changing the `config/access` shape**, account for the `onSnapshot` subscribers in every page. A malformed doc will blank out the whole app.
- **When changing `LANE_MAP`**, update BOTH copies (BoardPage + Cloud Function) or cached manual-board data will diverge from live view.
- **Do not re-introduce the pill-style Stage/Deadline UI** — the convention is plain text with a conditional color. Pills belong on MC badges, type (Work/Process) badges, and section status chips only.
- **Coordinate changes that touch Firestore rules + code** — deploy rules (`firebase deploy --only firestore:rules`) BEFORE the frontend that depends on them.

---

## 18. Current Browser Title & Git Remote

- **Title:** `Phobos Requests Tracker` ([index.html:7](index.html#L7)).
- **Main branch:** `main`.
- **GitHub:** `https://github.com/MiroGonda/project-tracker.git`.
- **Primary user/maintainer:** `miro.gonda@gmail.com`.
