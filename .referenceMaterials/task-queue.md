# Task Queue — Ares Project Tracker

Read `CLAUDE.md` and `ares-dashboard-claude.md` for full project and spec context before beginning any task.

---

## How to use this file

1. Open a new session with Claude
2. Say: *"Please read task-queue.md and work on Task N"*
3. Claude reads this file, reads the relevant source files, then implements
4. Mark the task `[x]` when complete

---

## Current project state (as of last session)

- **Stack:** React + Vite + Tailwind CSS v3 + recharts + lucide-react
- **Hosted:** GitHub Pages at `https://mirogonda.github.io/project-tracker/`
- **Auth:** Google OAuth — **currently bypassed for local dev** (see Task 1 before deploying)
- **Key file:** `src/pages/BoardPage.jsx` — full dashboard, recently rebuilt per spec in `ares-dashboard-claude.md`
- **Key file:** `src/components/Sidebar.jsx` — board list with collapsible group support
- **Dev server:** `npm run dev` (stop with Ctrl+C)
- **Deploy:** push to `main` → GitHub Actions auto-deploys

---

## Notes for Claude

- Always run `npm run build` after making changes. Do not mark a task complete if the build fails.
- The dev server (`npm run dev`) hot-reloads — no restart needed after edits.
- Keep the auth bypass comment visible (`// DEV: auth bypassed`) so it's easy to find.
- `ares-dashboard-claude.md` is the authoritative spec. `CLAUDE.md` is the project overview and setup guide.
- Do not push to `main` without the user's explicit instruction.

---

## Tasks

<!-- Tasks are written by the user below. Work through them in order unless told otherwise. -->
1. We'll no longer be proceeding with the grouped projects at the sidebar. You can remove this and default the view to just the project list.
2. Please ensure the Throughput is properly reflected for the Chart. Currently, nothing is being displayed by the chart at all.
3. Rolling off of number 2, please divide the pipeline (done and ongoing cards) into Work and Process cards. Process cards have "Main Card" in their labels. Work cards don't. This is what defines the CARD TYPE. Currently, the value in the column under this is empty in the pipeline.
4. Consider #3 when making #2, and ensure filtering one or the other also filters #2's chart.
5. The Pipeline Distribution also does not display any data. This section is intended to break down the count of cards the falls under the three categories under it: Cateogry (of the cards), Type, and Labels.
6. One of the most important features added to my main service is the capability to ALSO convert the pipeline chart into a table. The columns consist of the lanes, and rows are comprised of the MC-# aggregated, and their values are the aggregates of the COUNT of how much cards are under those lanes. Give me your best effort in implementing this.
