# DIRECTIVE.md — Phobos Requests Tracker Frontend Redesign

> **Standing context for Code.** Re-paste this alongside any handoff prompt this week. CLAUDE.md is the source of truth for the project; this file is the source of truth for the *redesign initiative*. When the two conflict, ask before acting.

**Last updated:** 2026-04-28 (Day 1 — Late Night, v2.6)
**Maintainer:** miro.gonda@gmail.com (the Overseer)
**Planning lead:** separate Claude session (the Project Driver)
**Implementation:** Claude Code (you)

---

## 1. Mission

Complete the frontend visual redesign described in **CLAUDE.md §19**, plus a stability + backend-cache hardening track that landed mid-week (Phases 0c and 0d). Phase 0d also retires Raintool entirely and introduces an 18-month done-cards retention cap to live within Firestore's 1 MiB document limit.

**Working order (locked):** tokens → primitives → shared components → pages → micro-interactions → ship.

**Two tracks running this week:**

- **Track A (Overseer + Stitch):** Visual designs in Google Stitch. Brief: `DESIGN.md`. Output: `docs/stitch/<date>/`.
- **Track B (You):** Phase 0a audit (done), Phase 0c stability (done — committed), Phase 0d (Tasks 1–3 done; Task 3.5 + retention-cap fix + Task 4 deploy + Task 5 verification cleared to proceed).

---

## 2. Phase Tracker

| Phase | What | Status |
|---|---|---|
| 0a | Visual audit (read-only) | **Complete** |
| 0b | DESIGN.md + Stitch mockups | DESIGN.md done; mockups in progress |
| 0c | Stability hardening | **Complete — committed** |
| **0d** | **Backend cache refactor + Raintool removal + done-cards retention cap** | **Tasks 1–3 implemented; Task 3.5 + retention-cap fix + Task 4 (deploy + seed) + Task 5 (verification) cleared; single commit at end** |
| 1 | Token system rewrite | Not started — gated on Track A |
| 2 | Component primitives + shared components | Not started |
| 3 | Page-layer polish + improved data viz | Not started |
| 4 | Micro-interactions + final ship | Not started |

---

## 3. Roles & Communication

- **Overseer** is the bridge.
- **Project Driver** is the planning lead.
- **You (Code)** execute.

After Task 3.5 + retention-cap edits build green, proceed directly into Task 4 step 1 — no extra pause. Continue one-line status updates between numbered Task 4 steps.

---

## 4. Hard Constraints

- **CLAUDE.md §19.2 — AMENDED for Phase 0d only.** See §10. Reverts after Phase 0d ships.
- **`npm run build` must pass before every push to `main`.**
- **Both dark and light themes must work after every visual change.**
- **Token-first, then components, then pages** — for the visual phases.
- **No partial migrations** (bug/layout fixes exempt).
- **No new dependencies without raising for approval.**
- **CLAUDE.md §17 still applies** — no-pill Stage/Deadline.
- **Both `LANE_MAP` copies stay in lockstep.** `syncAresBoard()` shares the existing `LANE_MAP`.
- **Never commit secrets.**
- **Phobos request behavior:** post-Phase 0d, frontend reads cache only. No direct Phobos calls for board data.
- **Raintool retired.** No new Raintool references in code, config, or UI.
- **Cache size discipline.** `doneCards` in `cache/{source}_{boardId}` is capped by `DONE_CARDS_RETENTION_DAYS` (548 days = 18 months) — applied symmetrically to manual and Ares syncs to stay under Firestore's 1 MiB doc limit. `doneCardsTotalAvailable` in the cache reflects the uncapped count.
- **Multi-deploy sequencing for Phase 0d Task 4:** Cloud Functions deploy → seed every Ares board's cache → THEN frontend deploy. Do not invert.

---

## 5. Skills to Use

If available: `frontend-design` for component-level work in Phases 2–3; `file-reading` for reference materials or design exports.

---

## 6. Active Task: Phase 0d — Backend Cache Refactor + Raintool Removal + Retention Cap

### 6.1 Task 1 — Cloud Functions extension ✅ (with retention-cap addendum)

Implemented earlier today: `syncAresBoard`, `syncBoard` refactor, health fields, 45-min schedule, 1.5s inter-board delay, `syncBoardHttp` source dispatch.

**Addendum (added 2026-04-28 late-night during Task 4 deploy):**
- Single named constant `DONE_CARDS_RETENTION_DAYS = 548` near the top of `functions/index.js` with an inline comment about Firestore's 1 MiB doc limit.
- BOTH `syncBoard` and `syncAresBoard` filter `doneCards` by `dateLastActivity` within the retention window before writing to cache. Same logic, same constant, applied symmetrically.
- Cache shape gains `doneCardsTotalAvailable: number` (uncapped count of done cards in the source) and `doneCardsCutoffMs: number` (Unix ms timestamp of the oldest retained done card, or the cutoff threshold — whichever is more useful at write time; Code's call on naming).

### 6.2 Task 2 — Firestore rules check ✅

Existing `cache/{document}` rule covers `cache/ares_*`. No deploy needed.

### 6.3 Task 3 — Frontend rewire ✅

Implemented. See v2.4 §6.3 for full detail.

### 6.4 Task 3.5 — Raintool removal

Driver decision: discontinue Raintool entirely. Ares cycle time empty (renders "—"). Manual cycle time stays.

- `functions/index.js`: in `syncAresBoard`, set `cycleDays: {}`. Keep `activatedDates` and `completionDates` populated. `syncBoard` (manual) UNCHANGED — manual cycleDays still computed.
- `src/api/phobos.js`: remove `cycleTime()` and `rtClient()` entirely.
- `src/context/AccessContext.jsx`: remove `raintool_host` localStorage seeding.
- `src/pages/Admin.jsx`: remove "Raintool Host" input from Backend Services.
- `src/pages/BoardPage.jsx` Dashboard: Done (85p) tile, difficulty breakdown rows, Done Cards drilldown cycle column → render "—" with `text-muted` style for Ares (cycleDays empty). Don't hide tiles. WIP (85p) UNAFFECTED.
- Cleanup grep: `rg 'rt_project_' src/`, `rg -i 'raintool' src/ functions/`, `rg 'cycleTime\b' src/`. Remove code references.
- Firestore data: `config.services.raintoolHost` field can stay (inert).
- CLAUDE.md updates: §6.6 (drop raintool rows), §9.4 (drop Raintool from Backend Services), §10.2 (rewrite — Manual only), §15 (rewrite Raintool entry as fully removed).

### 6.5 Task 4 — Deploy + seed (CRITICAL ORDER)

One-line status update between each numbered step.

1. `firebase deploy --only functions` — Cloud Functions ship FIRST.
2. List Ares board IDs. Manually invoke `syncBoardHttp` for ONE Ares board first; paste the resulting `cache/ares_{boardId}` doc fields (health fields + `cycleDays: {}` + `doneCardsTotalAvailable` + `doneCardsCutoffMs`) for Overseer spot-check before proceeding.
3. Seed every remaining Ares board: serial, ≥3-second delays. On any 4xx/5xx, stop and surface the error.
4. Verify `cache/ares_*` exists for every Ares board AND `cache/manual_*` docs have new health fields + retention-cap fields.
5. `npm run build` green AGAIN immediately before push.
6. Single commit covering all of Phase 0d (Tasks 1–3, 3.5, retention-cap, 4). Push to main.

### 6.6 Task 5 — Verification

- `npm run build` green post-push.
- Load an Ares board: data instant, no direct `ares.frostdesigngroup.com` calls in Network tab.
- Manual refresh: toast, `cache.updatedAt` advances, indicator resets.
- Both themes render loading toast, hard-stop banner, AND Done (85p) "—" rendering on Ares boards.
- Compare `cache/ares_{boardId}` against prior direct-fetch path on one busy Ares board (active card counts within tolerance; structural diffs not OK; confirm `cycleDays: {}`; confirm done cards retained match the 18-month window).
- `rg -i 'raintool|rtclient' dist/` should be empty.

### 6.7 Out of scope for Phase 0d

LANE_MAP, access control, role helpers, login flow, tabs, layouts, visual styling, Sidebar's `listBoards` path, subcollection refactor (Option 3 — future work if retention cap proves insufficient).

---

## 7. Completed Tasks

### 7.1 Phase 0a — Visual Audit (2026-04-28) — `AUDIT_PHASE_0A.md`

### 7.2 Phase 0c — Stability hardening (2026-04-28, committed)

---

## 8. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-28 | Track A tool: Google Stitch (Claude Design fallback) | Claude Design access issue on Max plan. |
| 2026-04-28 | Stitch exports → `docs/stitch/<YYYY-MM-DD>/<surface>/` | Date-stamped iteration. |
| 2026-04-28 | Archive `src/pages/Ares.jsx` → `docs/archive/legacy-pages/` | Removes duplicated component shapes. |
| 2026-04-28 | Status dropdown shape — defer | Design-track question. |
| 2026-04-28 | Phobos rate-limit hardening — three layers | Production 429s. |
| 2026-04-28 | Phase 0c.6.3a (pagination throttling) — skipped | Already sequential. |
| 2026-04-28 | CLAUDE.md edits by Code accepted | §5/§15 Ares archive paths. |
| 2026-04-28 | Request table compactness — fix now | Layout-bug fix. |
| 2026-04-28 | §19.2 scope amended for Phase 0d | Rate-limit problem unsolvable without backend refactor. |
| 2026-04-28 | Cross-user coordination via backend cache | Cloud Functions = single fetcher. |
| 2026-04-28 | Sync schedule: every 45 minutes (both sources) | User-specified. |
| 2026-04-28 | On persistent fetch error: drop cursor, full fetch next run | User-specified. |
| 2026-04-28 | Hard-stop UI: `consecutiveFailures >= 3` OR cache age > 135 min | 3× sync interval. |
| 2026-04-28 | ~~Cycle-time semantic shift on Ares: accept~~ — **SUPERSEDED** | See next row. |
| 2026-04-28 | **Raintool removed entirely; Ares cycle time empty.** Manual unchanged. | Driver overrode prior lean. Eliminates half-deprecated dependency. |
| 2026-04-28 | Period Activity KPI reading 0 on Ares — accept | Cosmetic. |
| 2026-04-28 | 90-day movement lookback on first/recovery sync — accept default | Tune per-board only if needed. |
| 2026-04-28 | Vestigial state vars — defer cleanup to Phase 3 | Natural during component redesign. |
| 2026-04-28 | **Done-cards retention cap: 18 months (548 days), applied symmetrically to manual + Ares syncs.** New cache fields `doneCardsTotalAvailable` and `doneCardsCutoffMs`. UI disclosure deferred to Phase 3. | Mid-deploy blocker: JFC Chowking Ares board exceeded Firestore's 1 MiB doc limit (~2,000 done cards over multi-year history). Option 1 chosen over count-based cap (less semantic) and subcollection refactor (out of week's scope; would require symmetric manual migration). 18 months covers actual usage patterns at Frost (most projects close within 12 months); single named constant in `functions/index.js` is tunable. Older done cards remain in source systems and can be surfaced later via subcollection refactor if needed. |

---

## 9. Open Questions / Blockers

- **Track A:** Stitch onboarding in progress. Phase 1 token rewrite gated on first design pass.
- **Phase 0d Task 4 deploy** highest-risk step of the week. Rollback: `firebase functions:delete` for CF; `git revert HEAD && git push` for frontend.
- **Future watch:** if any board ever approaches the 1 MiB doc limit even with the 18-month retention cap, the next architectural step is a subcollection refactor (Option 3 from the mid-deploy blocker). Not in this initiative's scope; would warrant its own planning phase.

---

## 10. §19.2 Scope Amendment (one-time, this initiative only)

CLAUDE.md §19.2 originally locked the data model, Firestore rules, and Cloud Functions out of scope. On 2026-04-28 the Overseer amended this for **Phase 0d only** to allow:

- **Cloud Functions:** added `syncAresBoard()`; updated `syncAllBoards` schedule and dispatch; extended `syncBoardHttp` to accept Ares boards; in Task 3.5, dropped `cycleDays` computation in `syncAresBoard`; added `DONE_CARDS_RETENTION_DAYS` cap symmetrically to `syncBoard` and `syncAresBoard`.
- **Firestore data model:** added `cache/ares_{boardId}` (mirror of `cache/manual_{boardId}` shape); added health fields to BOTH cache shapes; added `doneCardsTotalAvailable` and `doneCardsCutoffMs` to BOTH cache shapes.
- **Firestore rules:** verified only — no change.
- **`config.services` shape:** allowed to remove `raintoolHost` field consumption (field can remain in Firestore inert). localStorage seeding for `raintool_host` removed.

The amendment **does not** extend to:

- LANE_MAP (use existing; do not fork).
- Access control or role helpers.
- localStorage seeding behavior beyond the single `raintool_host` removal.
- Deploy config (GitHub Pages basename, vite base path, 404.html plugin).
- Firebase project ID.
- Subcollection refactors of cache structure (deferred future work).

After Phase 0d ships, §19.2 reverts to its original scope for Phases 1–4.
