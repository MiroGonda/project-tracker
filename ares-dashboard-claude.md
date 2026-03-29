# CLAUDE.md — Ares Dashboard (GitHub Pages Edition)

This file is the authoritative build reference for a lightweight, static-hosted version of the Ares project dashboard. Read it fully before writing any code. All architectural decisions are final — do not deviate without flagging it explicitly.

---

## Project Overview

A **pure frontend SPA** hosted on GitHub Pages that provides:

1. **Ares page** — full project board analytics dashboard (throughput, pipeline, cycle time)
2. **Settings page** — API credentials, Google account, theme toggle

No local backend. No local LLMs. All data is fetched directly from external APIs in the browser. All state is stored in `localStorage`.

This is a direct port of `frontend/src/pages/Project.jsx` from the PPMS project, adapted for static hosting.

---

## Tech Stack (Finalized)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | Same as PPMS |
| Styling | Tailwind CSS v3 | Same design tokens as PPMS |
| Charts | recharts | Same charting library as PPMS |
| Icons | lucide-react | Same icon set as PPMS |
| HTTP client | axios | Direct browser→API calls |
| Google OAuth | Google Identity Services (GIS) | Browser-only OAuth — no backend needed |
| Persistence | localStorage only | No database |
| Hosting | GitHub Pages | Static files only |

---

## Project Structure

```
ares-dashboard/
├── public/
│   └── favicon.ico
├── src/
│   ├── pages/
│   │   ├── Ares.jsx          # Full project dashboard (ported from PPMS Project.jsx)
│   │   └── Settings.jsx      # API config, Google account, theme
│   ├── components/
│   │   ├── Sidebar.jsx       # 2-item nav: Ares + Settings
│   │   ├── Spinner.jsx       # Loading spinner
│   │   └── Toast.jsx         # Toast notification
│   ├── context/
│   │   └── ThemeContext.jsx  # Dark/light mode via localStorage
│   ├── hooks/
│   │   └── useToast.js       # Toast state hook
│   ├── api/
│   │   ├── ares.js           # Direct Ares API client (reads config from localStorage)
│   │   └── google.js         # Google Identity Services OAuth wrapper
│   ├── App.jsx               # Router + layout
│   └── index.css             # Tailwind + design tokens
├── index.html
├── package.json
├── vite.config.js            # Must set base path for GitHub Pages
└── tailwind.config.js
```

---

## Fresh Installation

### Prerequisites
- Node.js 18+
- Git

### Steps

```bash
# 1. Create project
npm create vite@latest ares-dashboard -- --template react
cd ares-dashboard

# 2. Install dependencies
npm install
npm install react-router-dom axios recharts lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 3. Initialize git and push to GitHub
git init
git add .
git commit -m "Initial scaffold"
git remote add origin https://github.com/{username}/ares-dashboard.git
git push -u origin main
```

### GitHub Pages Setup

1. Go to repo → Settings → Pages → Source: `GitHub Actions`
2. Create `.github/workflows/deploy.yml` (see Build & Deploy section)
3. Set your repo name in `vite.config.js` (critical — see below)

---

## Configuration Files

### `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ares-dashboard/',  // ← MUST match your GitHub repo name exactly
})
```

> If your repo is `https://github.com/user/my-board`, set `base: '/my-board/'`

### `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:             'rgb(var(--color-bg) / <alpha-value>)',
        surface:        'rgb(var(--color-surface) / <alpha-value>)',
        accent:         '#6366f1',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-muted':   'rgb(var(--color-text-muted) / <alpha-value>)',
        border:         'rgb(var(--color-border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Theme tokens ─────────────────────────────────────────────────── */
/* Values are bare RGB channels so Tailwind's opacity modifiers work  */

:root {
  /* Dark mode — default */
  --color-bg:           15 15 15;       /* #0f0f0f */
  --color-surface:      28 28 30;       /* #1c1c1e */
  --color-text-primary: 232 232 232;    /* #e8e8e8 */
  --color-text-muted:   107 114 128;    /* #6b7280 */
  --color-border:       42 42 46;       /* #2a2a2e */
}

html.light {
  --color-bg:           245 245 247;    /* #f5f5f7 */
  --color-surface:      255 255 255;    /* #ffffff */
  --color-text-primary: 17 19 24;       /* #111318 */
  --color-text-muted:   107 114 128;    /* same */
  --color-border:       228 228 231;    /* #e4e4e7 */
}

body {
  background-color: rgb(var(--color-bg));
  color: rgb(var(--color-text-primary));
  font-family: 'Inter', sans-serif;
  margin: 0;
}

html.light .bg-white\/5               { background-color: rgba(0,0,0,0.04); }
html.light .bg-white\/10              { background-color: rgba(0,0,0,0.06); }
html.light .hover\:bg-white\/5:hover  { background-color: rgba(0,0,0,0.04); }

* { box-sizing: border-box; }

@layer components {
  .input {
    @apply w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary
           placeholder:text-text-muted/50 focus:outline-none focus:border-accent/60 transition-colors;
  }
  .btn-primary {
    @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white
           text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors;
  }
  .btn-secondary {
    @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
           text-sm font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors;
  }
}
```

### `index.html`

Add Inter font from Google Fonts in the `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## localStorage Schema

All persistence uses `localStorage`. Key names:

| Key | Type | Description |
|---|---|---|
| `ares_host` | string | e.g. `https://my-ares-server.com` |
| `ares_api_key` | string | API key for Ares |
| `raintool_host` | string | Default: `https://hailstorm.frostdesigngroup.com` |
| `selected_board_id` | string | Last-selected board ID |
| `targets_{boardId}` | JSON string | Array of `{id, startDate, endDate, value}` for throughput targets |
| `ppms_theme` | `'dark'` \| `'light'` | Theme preference |
| `google_access_token` | string | Google OAuth access token (expires) |
| `google_token_expiry` | string | ISO timestamp of token expiry |
| `google_user_email` | string | Connected Google account email |

---

## API Client — `src/api/ares.js`

All Ares and Raintool API calls are made directly from the browser. The `ARES_HOST` and `ARES_API_KEY` are read from `localStorage` at call time.

**Critical requirement:** The Ares server must have `Access-Control-Allow-Origin: *` (or the GitHub Pages origin) set in its CORS headers. Without this, browsers will block the requests. Confirm this before testing.

```js
import axios from 'axios'

function getConfig() {
  return {
    host:    localStorage.getItem('ares_host')    || '',
    apiKey:  localStorage.getItem('ares_api_key') || '',
    rtHost:  localStorage.getItem('raintool_host') || 'https://hailstorm.frostdesigngroup.com',
  }
}

function aresClient() {
  const { host, apiKey } = getConfig()
  return axios.create({
    baseURL: `${host}/api/v1/trello`,
    headers: { 'X-API-Key': apiKey },
    timeout: 20000,
  })
}

function rtClient() {
  const { rtHost } = getConfig()
  return axios.create({
    baseURL: `${rtHost}/public/api`,
    timeout: 20000,
  })
}

export const listBoards = () =>
  aresClient().get('/boards').then(r => {
    const data = r.data?.data
    return (data?.boards ?? data) || []
  })

export const boardSummary = (boardId) =>
  aresClient().get(`/boards/${boardId}/summary`).then(r => r.data?.data)

export const boardCards = (boardId, params = {}) =>
  aresClient().get(`/boards/${boardId}/cards`, { params })
    .then(r => ({ data: r.data?.data, meta: r.data?.meta || {} }))

export const boardMovements = (boardId, params = {}) =>
  aresClient().get(`/boards/${boardId}/movements`, { params })
    .then(r => ({ data: r.data?.data, meta: r.data?.meta || {} }))

export const cycleTime = (rtProjectId, params = {}) =>
  aresClient().get('/cycle-time', { params: { rtProjectId, ...params } })
    .then(r => ({ data: r.data?.data, meta: r.data?.meta || {} }))

export const listRaintoolProjects = () =>
  rtClient().get('/project/list-active-projects')
    .then(r => (r.data?.projects || []).map(p => ({ id: p.ProjectID, name: p.name })))
```

Wrap every call in a try/catch in the component. If `ares_host` is empty, show a prompt to configure it in Settings.

---

## ThemeContext — `src/context/ThemeContext.jsx`

Identical to PPMS. Copy exactly:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('ppms_theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDark)
    localStorage.setItem('ppms_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(v => !v) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

---

## Google OAuth — `src/api/google.js`

### Approach

GitHub Pages has no server to store the `client_secret`. Use **Google Identity Services (GIS)**, which handles browser-side OAuth 2.0 using access tokens directly. No client secret is exposed.

This is the standard approach for SPAs and is fully supported by Google.

**Scopes to request:**
```
openid
email
profile
https://mail.google.com/
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/calendar.readonly
```

Pre-requesting all scopes means the user won't be re-prompted when features are added later.

### Google Cloud Console Setup (one-time, done by user)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or reuse existing)
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
4. Application type: **Web application**
5. Authorized JavaScript origins: add your GitHub Pages URL, e.g. `https://yourusername.github.io`
6. Authorized redirect URIs: add `https://yourusername.github.io/ares-dashboard/settings` (the Settings page URL where the callback is handled)
7. Copy the **Client ID** (NOT the client secret — it is not used here)
8. In the app's Settings page, paste the Client ID into the "Google Client ID" field

The Client ID is stored in `localStorage` as `google_client_id`. It is not a secret.

### GIS Library Loading

Add to `index.html` before `</body>`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### `src/api/google.js`

```js
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')

export function isGoogleConfigured() {
  return !!localStorage.getItem('google_client_id')
}

export function isGoogleConnected() {
  const token  = localStorage.getItem('google_access_token')
  const expiry = localStorage.getItem('google_token_expiry')
  if (!token || !expiry) return false
  return new Date(expiry) > new Date()
}

export function getGoogleEmail() {
  return localStorage.getItem('google_user_email') || null
}

export function disconnectGoogle() {
  localStorage.removeItem('google_access_token')
  localStorage.removeItem('google_token_expiry')
  localStorage.removeItem('google_user_email')
}

/**
 * Initiates a GIS token request popup. Calls onSuccess({ access_token, email })
 * or onError(message) when done.
 *
 * Must be called from a user gesture (button click).
 */
export function connectGoogle({ onSuccess, onError }) {
  const clientId = localStorage.getItem('google_client_id')
  if (!clientId) {
    onError('No Google Client ID configured. Add it in Settings.')
    return
  }
  if (!window.google?.accounts?.oauth2) {
    onError('Google Identity Services library not loaded. Check your internet connection.')
    return
  }

  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        onError(tokenResponse.error_description || tokenResponse.error)
        return
      }
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      localStorage.setItem('google_access_token', tokenResponse.access_token)
      localStorage.setItem('google_token_expiry', expiresAt)

      // Fetch user email from Google userinfo endpoint
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const info = await res.json()
        localStorage.setItem('google_user_email', info.email || '')
        onSuccess({ access_token: tokenResponse.access_token, email: info.email })
      } catch {
        onSuccess({ access_token: tokenResponse.access_token, email: '' })
      }
    },
  })
  client.requestAccessToken({ prompt: 'consent' })
}
```

> **Note on access tokens:** GIS browser-side tokens expire (typically 1 hour). The `isGoogleConnected()` check uses the stored expiry time. The user will need to reconnect periodically. This is normal for browser-only OAuth apps.

---

## Settings Page — `src/pages/Settings.jsx`

Sections to implement:

### 1. Ares API Configuration
- Text input: **Ares Host** (e.g. `https://my-ares.example.com`) → saved to `localStorage.ares_host`
- Text input: **Ares API Key** → saved to `localStorage.ares_api_key`
- Text input: **Raintool Host** → saved to `localStorage.raintool_host`, pre-filled with `https://hailstorm.frostdesigngroup.com`
- "Save" button for each (or a single Save for all three)
- Show a warning notice: "The Ares server must have CORS enabled for browser requests to work."

### 2. Google Account
- Text input: **Google Client ID** → saved to `localStorage.google_client_id`
- Connection status indicator (green dot = connected, gray = not connected)
- If connected, show the connected email address
- "Connect" / "Reconnect" button — calls `connectGoogle()` from `src/api/google.js`
- "Disconnect" button (when connected) — calls `disconnectGoogle()`
- Note about token expiry: "Access tokens expire after ~1 hour. You'll be asked to reconnect periodically."

### 3. Theme
- Dark/light mode toggle button using `useTheme()` — same as PPMS Settings

### Section layout pattern (reuse from PPMS):
```jsx
function Section({ title, description, children }) {
  return (
    <section className="mb-0">
      <h2 className="text-sm font-semibold text-text-primary mb-1">{title}</h2>
      <p className="text-xs text-text-muted mb-4">{description}</p>
      {children}
    </section>
  )
}

function Divider() {
  return <div className="border-t border-border my-6" />
}
```

---

## Ares Page — `src/pages/Ares.jsx`

This is a direct port of `frontend/src/pages/Project.jsx` from PPMS. The logic is identical. The only changes needed are:

### 1. Replace backend API calls with direct calls

**Before (PPMS):**
```js
import { listBoards, boardCards, boardMovements, boardSummary, cycleTime, listRaintoolProjects } from '../api/project'
import { getSettings, updateSetting } from '../api/settings'
```

**After (Ares Dashboard):**
```js
import { listBoards, boardCards, boardMovements, boardSummary, cycleTime, listRaintoolProjects } from '../api/ares'
```

### 2. Replace settings persistence with localStorage

In PPMS, throughput targets are saved/loaded via `getSettings()` / `updateSetting()` API calls. In this project, replace those with direct localStorage reads/writes:

**Before:**
```js
// Load targets
getSettings().then(r => {
  const raw = r.data[`targets_${boardId}`]
  setTargets(raw ? JSON.parse(raw) : [])
})
// Save targets
updateSetting(`targets_${boardId}`, JSON.stringify(targets))
```

**After:**
```js
// Load targets
const raw = localStorage.getItem(`targets_${boardId}`)
setTargets(raw ? JSON.parse(raw) : [])
// Save targets
localStorage.setItem(`targets_${boardId}`, JSON.stringify(targets))
```

### 3. Replace board persistence

**Before (PPMS):** Board selection persisted via `getSettings()` / `updateSetting('selected_board_id', ...)`

**After:** Use `localStorage.getItem('selected_board_id')` / `localStorage.setItem('selected_board_id', boardId)`

### 4. Add a config-not-set guard

At the top of the Ares component's data-loading effect, check if the API is configured:

```js
useEffect(() => {
  const host   = localStorage.getItem('ares_host')
  const apiKey = localStorage.getItem('ares_api_key')
  if (!host || !apiKey) {
    setConfigMissing(true)
    return
  }
  setConfigMissing(false)
  // ... existing fetch logic
}, [])
```

If `configMissing` is true, render a prompt:
```jsx
{configMissing && (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-text-muted">
    <AlertTriangle size={32} className="text-amber-400" />
    <p className="text-sm">Ares API not configured.</p>
    <Link to="/settings" className="btn-primary">Go to Settings</Link>
  </div>
)}
```

### 5. Everything else is identical

Copy the entire content of `Project.jsx` from PPMS verbatim:
- All helper functions (`getDateRange`, `isOverdue`, `fmtDate`, `fmtDateShort`, `extractDate`, `extractList`, `getPeriodKey`, `formatPeriodLabel`, `aggregateThroughput`, `computeTargetForPeriod`)
- The full `LANE_MAP` constant (100+ entries mapping Trello list names to `{type, category, status}`)
- `DIST_COLORS`, `TRELLO_COLORS`, `STATUS_ORDER`, `STATUS_ABBREV`, `STATUS_COLOR`, `PROCESS_COL_GROUPS`, `WORK_COL_GROUPS`
- All sub-components: `StatusDistBar`, `KpiCard`, `SectionCard`, `ThroughputTooltip`, `TargetsPanel`, `ThroughputSection`, `DistBar`, `PipelineDistribution`, `PipelineTableView`, `CardsTable`, `CycleTimeSection`
- Export helpers: `exportChartAsPng`, `exportTableAsPng`, `exportPipelineTableAsCsv`
- The main `Project` / `Ares` component function

**Note on imports:** The Ares page uses these libraries. Ensure all are installed:
```
recharts                   (BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Area)
lucide-react               (LayoutDashboard, RefreshCw, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, Tag, ChevronDown, ChevronUp, Circle, AlertCircle, X, Calendar, Download, Check, Minimize2, Target)
react-router-dom           (Link — used in the config-missing guard only)
```

---

## Sidebar — `src/components/Sidebar.jsx`

Two-item navigation only:

```
[App Name / Logo]
────────────────
  Ares          → /
  Settings      → /settings
```

Keep the same visual style as PPMS Sidebar but strip it down. No Google/LLM status indicators. Use `LayoutDashboard` icon for Ares and `Settings` icon for Settings. Collapse toggle is optional.

Active link styling: `text-text-primary bg-accent/10` when route matches.

---

## App.jsx

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import Ares from './pages/Ares'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename="/ares-dashboard">
        <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-hidden">
            <Routes>
              <Route path="/"         element={<Ares />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
```

> `basename` in BrowserRouter must match the `base` in `vite.config.js`.

---

## Spinner Component — `src/components/Spinner.jsx`

```jsx
export default function Spinner({ size = 16, className = '' }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
```

## Toast Component — `src/components/Toast.jsx`

Port directly from PPMS `frontend/src/components/Toast.jsx`.

## useToast Hook — `src/hooks/useToast.js`

Port directly from PPMS `frontend/src/hooks/useToast.js`.

---

## Build & Deploy

### GitHub Actions Workflow — `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### SPA Routing Fix for GitHub Pages

GitHub Pages returns 404 for unknown paths (React Router routes). Fix this by copying `index.html` to `404.html` in the build output. Add to `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-index-to-404',
      closeBundle() {
        fs.copyFileSync(
          resolve(__dirname, 'dist/index.html'),
          resolve(__dirname, 'dist/404.html')
        )
      },
    },
  ],
  base: '/ares-dashboard/',
})
```

### Local Development

```bash
npm run dev
```

The app runs at `http://localhost:5173/ares-dashboard/`.

---

## Build Order

Build in this exact sequence. Each step should work before moving on.

1. **Scaffold** — `npm create vite`, install deps, set up Tailwind, verify `Hello World` renders with correct dark background
2. **Design system** — Apply `index.css` tokens, `tailwind.config.js`, verify accent color and `bg-surface` render correctly
3. **ThemeContext** — Port from PPMS, verify dark/light toggle persists
4. **App shell** — Sidebar + React Router, verify navigation between `/` and `/settings`
5. **Ares API client** — Implement `src/api/ares.js`, test with a known `ARES_HOST` in localStorage, verify `listBoards()` returns data
6. **Settings page** — Ares config inputs, Google Client ID input, theme toggle — all saving to localStorage
7. **Google OAuth** — Add GIS script tag, implement `src/api/google.js`, wire up Connect button in Settings, verify token is stored after auth
8. **Ares page** — Port full `Project.jsx`, replacing API imports and localStorage calls, verify boards load and data renders
9. **Config guard** — Add missing-config check to Ares page, verify redirect to Settings when unconfigured
10. **Export features** — Verify PNG chart export and CSV pipeline export work in browser
11. **GitHub Actions** — Set up deploy workflow, push to main, verify live site at `https://{user}.github.io/ares-dashboard/`

---

## CORS Requirement

This is the most common failure point. Since the app runs in the browser and calls the Ares API directly, **the Ares server must send these response headers:**

```
Access-Control-Allow-Origin: https://yourusername.github.io
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: X-API-Key, Content-Type
```

Or use `*` for all origins during development.

If the Ares server doesn't support CORS, browser requests will be blocked. This cannot be worked around from the frontend. The Ares server configuration must be updated.

---

## Out of Scope

Do not build these:
- Any backend server or API proxy
- Meeting minutes, document library, email, or other PPMS pages
- Document generation or templates
- Quick-fill contact manager
- Local LLM / Ollama integration
- Google Drive file browser
- Google Calendar integration (OAuth is pre-scoped for future use only)
