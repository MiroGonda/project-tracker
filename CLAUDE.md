# CLAUDE.md — Project Tracker

## GitHub Agent Briefing

This document is the primary briefing for any agent operating on this repository. Key facts before you touch anything:

- **Live site:** `https://mirogonda.github.io/project-tracker/` — it must stay live. Never push broken builds to `main`.
- **Deploy trigger:** Every push to `main` runs `.github/workflows/deploy.yml` (Vite build → GitHub Pages). Verify `npm run build` succeeds before pushing.
- **No backend in this repo.** The frontend is a pure SPA. All state is `localStorage`. The only exception is the Utilization tab, which calls an external backend proxy for Runn data (see Utilization section below).
- **Access control bootstrap:** `public/access-config.json` drives role-based access. If `"admins": []`, any authenticated Google user can self-assign as admin via `/admin`. Do not overwrite this file with dummy data.
- **Routing:** `BrowserRouter basename="/project-tracker"` + `vite.config.js base: '/project-tracker/'`. Both must stay in sync or the GitHub Pages deploy will 404.
- **SPA 404 fallback:** `dist/404.html` must be a copy of `dist/index.html`. The Vite config handles this via a build plugin — do not remove it.
- **Auth:** Google Identity Services (GIS), browser-only. The `google_client_id` is entered by the user in Settings and stored in `localStorage`. There is no server-side session.

---

## What This Project Is

A **pure-frontend SPA** that provides per-project dashboards for an Ares/Trello pipeline. Each project board gets its own dedicated page (`/board/:boardId`) with throughput charts, KPI cards, a filterable card pipeline, and a resource utilization tab.

There is **no backend bundled with this repo**. All Ares/Trello data is fetched directly from the Ares API in the browser. All state is stored in `localStorage`. The one exception is the Utilization tab — see below.

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
| `src/pages/UtilizationTab.jsx` | Org-wide resource utilization report (tab inside BoardPage) |
| `src/components/Sidebar.jsx` | Nav sidebar — lists all boards the user can access |
| `src/api/ares.js` | Ares API client — reads host/key from localStorage |
| `src/api/runn.js` | Utilization API wrapper — calls backend proxy, not Runn directly |
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
- **No write access to Ares server** — it is a consumed service, not owned infrastructure.

---

## Utilization Tab — Backend Required

The Utilization tab (`/board/:boardId` → Utilization tab) shows org-wide Runn data: capacity, scheduled hours, and actual (timesheet) hours per person.

**Why a backend is needed:** Runn's API intentionally blocks browser requests (no CORS headers). The frontend cannot call Runn directly.

**Architecture:**
```
Browser → GET /api/runn/utilization?startDate=...&endDate=...
               ↓
         Backend proxy (Cloudflare Worker, Vercel Function, etc.)
               ↓ (server-side, no CORS)
         Runn API — 6 parallel calls
               ↓
         Pre-computed JSON response → frontend renders
```

**Backend endpoint spec:** `.referenceMaterials/utilization-rebuild.md` — full computation logic, API calls, response shape.

**Frontend config:** Settings → "Utilization API URL" — stored in `localStorage` as `util_api_url`. The frontend calls `${util_api_url}/api/runn/utilization?startDate=...&endDate=...`.

**The Runn API key is stored server-side** in the backend's environment variables (`.env`), never in the browser.

---

## Routing

- `basename="/project-tracker"` in `BrowserRouter`
- `base: '/project-tracker/'` in `vite.config.js`
- `dist/404.html` is a copy of `dist/index.html` (for GitHub Pages SPA routing)

---

## Access Control Bootstrap

If `public/access-config.json` has `"admins": []`, any logged-in Google user can reach `/admin` and assign themselves as admin. This is the intended first-run flow.

---

## Next Steps (Pending)

The following improvements are pending implementation in `src/pages/BoardPage.jsx`:

1. **Rename "Active Cards" → "Pipeline"**
2. **Work / Process card categorization** — classify by `currentList` via `LANE_MAP`
3. **Pipeline filters** — text search, multi-select List/Label dropdowns, Work/Process toggles; filters drive WIP/Blocked/Done KPIs and Throughput chart
4. **Done drilldown panel** — clicking Done KPI replaces Pipeline with a Done Cards view
5. **Daily granularity in Throughput chart**

**Utilization backend:** A backend service needs to be deployed (Cloudflare Worker recommended) and the URL entered in Settings before the Utilization tab will load data.
