# CLAUDE.md — Ares Project Tracker

## What This Project Is

A **pure-frontend SPA** that provides per-project dashboards for an Ares/Trello pipeline. Each project board gets its own dedicated page (`/board/:boardId`) with throughput charts, KPI cards, and a filterable card pipeline.

There is **no backend**. All data is fetched directly from the Ares API in the browser. All state is stored in `localStorage`.

---

## Keep It Online

This site **must stay live at all times** — it is the primary dashboard for tracking active design projects. It is hosted on GitHub Pages and deploys automatically on every push to `main` via GitHub Actions. Do not break the build. Always verify the Vite build would succeed before pushing to `main`.

---

## Final Product

A website hosted on **GitHub Pages** at:
```
https://mirogonda.github.io/project-tracker/
```

The site is a React + Vite SPA with:
- Google OAuth login (browser-side, no backend)
- Role-based access control (admin assigns per-user per-board access via `/admin`)
- Per-project dashboard pages at `/board/:boardId`
- Settings page at `/settings`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS v3 + CSS token design system |
| Charts | recharts |
| Icons | lucide-react |
| HTTP | axios |
| Auth | Google Identity Services (GIS), browser-only |
| Persistence | localStorage only |
| Hosting | GitHub Pages (source: GitHub Actions) |
| Deployment | `.github/workflows/deploy.yml` → builds on push to `main` |

---

## Key Files

| File | Purpose |
|---|---|
| `src/pages/BoardPage.jsx` | Per-project dashboard (main work area) |
| `src/pages/Settings.jsx` | API credentials, Google OAuth, theme toggle |
| `src/pages/Admin.jsx` | Access control — assign users to boards |
| `src/components/Sidebar.jsx` | Nav sidebar — lists all boards the user can access |
| `src/api/ares.js` | Ares API client — reads host/key from localStorage |
| `src/api/access.js` | Access config helpers (admin, canAdmin, accessibleIds) |
| `src/api/google.js` | Google GIS OAuth wrapper |
| `src/context/AccessContext.jsx` | Provides role/access state app-wide |
| `public/access-config.json` | Source-of-truth for access config (admins + board assignments) |
| `vite.config.js` | `base: '/project-tracker/'` required for GitHub Pages |

---

## API Notes

- **Base URL:** `https://ares.frostdesigngroup.com/api/v1/trello`
- **Auth:** `X-API-Key` header
- **Pagination:** `page` + `pageSize` (max 200). Always read `meta.pagination.totalPages` and loop until all pages are fetched.
- **Cards:** `GET /boards/:boardId/cards?status=active|done&page=N&pageSize=200`
  - Field: `currentList` (not `list_name` or `listName`)
- **Movements:** `GET /boards/:boardId/movements?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=N&pageSize=200`
- **CORS:** The Ares server must include `Access-Control-Allow-Origin` on ALL responses (including 4xx). The Nginx config must use the `always` flag.

---

## Routing

- `basename="/project-tracker"` in `BrowserRouter`
- `base: '/project-tracker/'` in `vite.config.js`
- `dist/404.html` is a copy of `dist/index.html` (for GitHub Pages SPA routing)

---

## Access Control Bootstrap

If `public/access-config.json` has `"admins": []`, any logged-in Google user can reach `/admin` and assign themselves as admin. This is the intended first-run flow.

---

## Current Development Branch

Active feature branch: `claude/review-project-requirements-s1Dbr`

All dashboard improvements go here first, then merge to `main` to deploy.

---

## Next Steps

The following improvements are pending implementation in `src/pages/BoardPage.jsx`:

1. **Rename "Active Cards" → "Pipeline"**
   The cards section title and section heading should say "Pipeline", not "Active Cards".

2. **Work / Process card categorization**
   Classify each active card as **Work** or **Process** based on its `currentList`:
   - **Work** = lanes where internal production is happening (`wip`, `review` types in `LANE_MAP`)
   - **Process** = lanes in client-facing / external stages (`blocked`, `ready`, `backlog` types)
   Display a colored type pill (e.g. indigo = Work, purple = Process) on each card row in the Pipeline.

3. **Pipeline filters (and filter-driven metrics)**
   Add a filter bar above the Pipeline table:
   - Text search (by card name or list)
   - Multi-select dropdown: filter by **List**
   - Multi-select dropdown: filter by **Label**
   - Toggle buttons: **All / Work / Process**
   All active filters must flow upward and update:
   - WIP count KPI
   - Blocked count KPI
   - Done (period) KPI and Done (total) KPI
   - Throughput chart (use filtered done cards)

4. **Done drilldown panel**
   Clicking either Done KPI card replaces the Pipeline section with a **Done Cards** view:
   - Green-tinted section header/border (`emerald`)
   - Shows done cards in a table (same columns as Pipeline)
   - Has a "← Back to Pipeline" button to dismiss
   The Throughput chart and KPI row remain visible above.

5. **Daily granularity in Throughput chart**
   Add a **Daily** option alongside Weekly and Monthly in the Throughput granularity selector.
   The Throughput chart must use the **filtered done cards** (from step 3 above) so that changing the type/label/list filter updates the chart in real time.
