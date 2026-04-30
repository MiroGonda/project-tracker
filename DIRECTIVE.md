# DIRECTIVE.md — Phobos Requests Tracker Frontend Redesign

> **Standing context for Code.** Re-paste alongside any handoff prompt this week. CLAUDE.md is the source of truth for the project; this file is the source of truth for the *redesign initiative*. When the two conflict, ask before acting.

**Last updated:** 2026-04-29 (Day 3 — Afternoon, v3.1)
**Maintainer:** miro.gonda@gmail.com (the Overseer)
**Planning lead:** separate Claude session (the Project Driver)
**Implementation:** Claude Code (you)

---

## 1. Mission

Complete the frontend visual redesign of Phobos Requests Tracker by end of week. Phases 0c and 0d (with hotfix) shipped Day 1–2. **Day 3 pivot: Stitch onboarding deprecated; visual redesign now anchored on IBM Carbon Design System.** The Carbon spec lives in the repo at `docs/design/DESIGN-ibm.md`.

**Design-translation framing:** Code translates `docs/design/DESIGN-ibm.md` into the Phobos visual layer using its own judgment. Driver evaluates Code's translation per phase; if results drift from intent, Driver may supplement with generated reference screens. `DESIGN.md` (Phobos-specific Carbon translation) exists as a fallback reference but is NOT the active spec — Code reads the IBM md directly.

Working order (locked):
1. Phase 0e cleanup batch (Items 2, 5, 3 — closing functional cleanup)
2. Phase 1 — Carbon token system rewrite + IBM Plex font load
3. Phase 2 — Component primitives (buttons, inputs, cards, tags, etc.)
4. Phase 3 — Page-layer migration (per-surface)
5. Phase 4 — Micro-interactions, focus states, theme toggle polish
6. Final pass — Cross-theme verification, ship

**No skipping. No partial migrations across files within a phase.**

---

## 2. Phase Tracker

| Phase | What | Status |
|---|---|---|
| 0a | Visual audit (read-only) | **Complete** |
| 0c | Stability hardening | **Complete — committed** |
| 0d | Backend cache refactor + Raintool removal + retention cap | **Complete — committed `fc0e433` + hotfix** |
| 0e Item 1 | LANE_MAP diagnostic + typo fix | **Complete — committed + pushed** |
| 0e Item 2 | Retention cap normalization fix | **Closed as no-op (2026-04-30) — diagnostic confirmed all four target boards already capped at 1000; current `applyDoneCardsCap` is correctly applied on full doneCards array on every write in both `syncManualBoard` and `syncAresBoard`. Stale 1468/1500 numbers were from before Phase 0d Task 4's redeploy. Diagnostic script `functions/scripts/diagnose-cache-sizes.js` retained.** |
| 0e Item 5 | ArYIZvEC stale Trello shortLink investigation | **Closed as no-op (2026-04-30) — shortLink not stale. Trello `/boards/ArYIZvEC` returns 200 (board live, `closed: false`); manual cache healthy (`lastSyncStatus: success`, 13 active / 343 done). Day 1 404 was the expected GitHub Pages SPA-fallback (CLAUDE.md §2), not a board issue. Cosmetic name drift between config (`Sunlife: EDM - Campaigns Q2 2026`) and Trello (`Sunlife: EDM Campaigns (2026)`) flagged to Driver for optional Admin UI alignment. Diagnostic script `functions/scripts/diagnose-stale-shortlink.js` retained.** |
| **0e Item 3** | **listBoards call deduplication** | **Active — next** |
| 1 | Carbon token system rewrite + IBM Plex font load | Queued (handoff drafted at Phase 0e close) |
| 2 | Component primitives (Carbon-aligned) | Not started |
| 3 | Page-layer migration | Not started |
| 4 | Micro-interactions + theme toggle polish | Not started |
| Ship | Final pass + cross-theme verification | Not started |

---

## 3. Roles & Communication

- **Overseer** is the bridge.
- **Project Driver** is the planning lead.
- **You (Code)** execute.

**Operating mode for remaining Phase 0e:** standard authority; per-item review; one commit per logical fix; pause for Overseer approval before push.

**Operating mode for Phase 1 onward:** standard authority; per-phase or per-primitive-group review; pause for Overseer approval before push. Phase 3 may break into per-surface commits to keep diffs reviewable.

**Design-translation autonomy (Phase 1+):** when Code encounters a Carbon spec detail in `docs/design/DESIGN-ibm.md` whose Phobos-specific application isn't obvious, Code makes a judgment call AND surfaces the call in its commit/status report. Driver reviews. This is intentional — the experiment is to evaluate Code's design-translation ability, not to mediate every micro-decision.

---

## 4. Hard Constraints

- **CLAUDE.md §19.2 reverted to original scope.** Phase 0e Item 2 has a narrow re-amendment for `functions/index.js` only; reverts on commit. Phases 1–4 are visual layer only.
- **`npm run build` must pass before every push to `main`.**
- **Both dark and light themes must work after every visual change.** Single switch is `html.light`; verify both before a phase is considered done.
- **Token-first, then components, then pages.**
- **No partial migrations.** Bug fixes and localized layout fixes are exempt.
- **No new dependencies without raising for approval** (npm sense). Asset loads (e.g., Google Fonts CDN for IBM Plex) are not "dependencies" in this sense.
- **CLAUDE.md §17 still applies in full** — including no-pill Stage/Deadline. Carbon's typography-first approach renders these as colored text naturally; no conflict.
- **Both `LANE_MAP` copies stay in lockstep.**
- **Never commit secrets.**
- **Phobos request behavior:** post-Phase 0d, frontend reads cache only for board card / movement / cycle-time / summary data. `listBoards` (Sidebar) is the intentional exemption — Phase 0e Item 3 fixes its dedup behavior; Phase 0c retry+cache stays.
- **Raintool retired.** No new references.
- **Cache size discipline.** `DONE_CARDS_RETENTION_DAYS = 365` + `DONE_CARDS_HARD_CAP = 1000`. Phase 0e Item 2 ensures these apply on every write.
- **IBM Carbon adoption: total, not partial.** When Carbon and current decisions conflict, **Carbon wins**. This includes:
  - 0px border-radius on buttons, inputs, cards, tiles (current rounded → 0px).
  - Bottom-border inputs (current boxed → bottom-border).
  - Shadow-averse depth via background-color layering (current shadows → background layering).
  - IBM Plex Sans + Mono (current Inter → IBM Plex).
  - Carbon Blue 60 `#0f62fe` accent (current indigo `#6366f1` → Carbon Blue 60).
  - Three weights: 300, 400, 600 (no Bold 700).
  - Letter-spacing only at 14px and below (0.16px) and 12px (0.32px).
  - 8px spacing grid.
- **Carbon adoption exclusions** (Carbon partially diverged from where it adds risk without value):
  - **Icon library stays as `lucide-react`.** Carbon's icon font (`ibm_icons`) is not adopted. `lucide-react` icons render alongside IBM Plex without conflict.
  - **Carbon tags (24px pill component) are NOT broadly adopted.** Pills are still restricted per CLAUDE.md §17 to existing contexts (MC badges, Type Work/Process, section status chips). The Carbon tag style applies inside those existing contexts only.

---

## 5. Skills to Use

- `frontend-design` skill (if available): use during Phase 1–3 component-level work.
- `file-reading` skill (if available): for parsing `docs/design/DESIGN-ibm.md` Carbon spec efficiently.
- Standard tooling for Phase 0e items.

---

## 6. Active Tasks: Phase 0e Items 2, 5, 3

### 6.1 Item 1 — LANE_MAP diagnostic + typo fix ✅ (shipped)

Output: `AUDIT_PHASE_0E_LANE_MAP.md` + `functions/scripts/diagnose-hLL7WW2V.js`. Lane key typo `'-> Render: Sent for Client Approval'` → `'➜ Render: Sent for Client Approval'` fixed in both LANE_MAP copies.

**Pending Driver classification:** 4 lanes / 25 cards (~5.7% of board) on hLL7WW2V remain unclassified — `Backlog: Pending Art Direction` (8), `Backlog: For Pushback` (6), `Backlog: For Cascade` (6), `NOTE` (5). Driver to classify when convenient.

### 6.2 Item 2 — Retention cap normalization fix ✅ (closed as no-op)

Diagnostic on 2026-04-30 read all four target boards and confirmed the symptom (1468/1500 done cards) is stale. Current state via `functions/scripts/diagnose-cache-sizes.js`:

| Board | done | uncapped |
|---|---|---|
| ares_VB5bz5WX | 1000 | 2047 |
| ares_gZxV4FkK | 1000 | 2136 |
| ares_hLL7WW2V | 1000 | 1483 |
| ares_pIgtlPod | 1000 | 3297 |

`applyDoneCardsCap` is already called on the full freshly-fetched `allDoneCards` array on every successful write in both `syncManualBoard` (functions/index.js:464) and `syncAresBoard` (functions/index.js:559). No merge-with-existing path exists for done cards. The 1468/1500 figures predate Phase 0d Task 4's redeploy that lowered the cap from 1500 → 1000.

§19.2 narrow re-amendment closes without exercise — no code change made. Diagnostic script retained for future cache-size audits.

### 6.3 Item 5 — ArYIZvEC stale Trello shortLink investigation ✅ (closed as no-op)

Read-only diagnostic on 2026-04-30 via `functions/scripts/diagnose-stale-shortlink.js`:

- `config.boards.ArYIZvEC` resolves cleanly: source `manual`, `trelloShortId: "ArYIZvEC"`, 3 frostUsers, dates configured, slaDays=7.
- `cache/manual_ArYIZvEC` healthy: `lastSyncStatus: success`, 0 consecutive failures, 13 active / 343 done cards, last successful sync 2026-04-30T05:55Z.
- Trello `GET /boards/ArYIZvEC` → 200 OK; board live, `closed: false`, canonical name `"Sunlife: EDM Campaigns (2026)"`.
- No duplicate `trelloShortId` across `config.boards`.

**Conclusion (outcome c — different cause entirely):** Day 1's `GET .../ArYIZvEC 404` console error was the expected GitHub Pages SPA-fallback 404 (CLAUDE.md §2 — `dist/index.html` copied to `dist/404.html` so deep links land in the SPA shell). Item 4's planned SPA-404 docs note (folded into Phase 1's CLAUDE.md updates) will explain this for future readers.

**Cosmetic note for Driver:** config name `"Sunlife: EDM - Campaigns Q2 2026"` and Trello's canonical `"Sunlife: EDM Campaigns (2026)"` differ. Optional Admin-UI alignment.

### 6.4 Item 3 — listBoards call deduplication

Hoist `listBoards` into `AccessContext` per the Item 3 handoff prompt. Phase 0c retry+cache on `phobos.js` stays as defense-in-depth.

### 6.5 Out of scope for Phase 0e

- Phase 1+ work.
- LANE_MAP modifications beyond the typo fix already shipped (Driver direction required for the 4 unclassified lanes).
- `config.boards` edits from code (Driver edits via Admin UI).
- Any backend changes outside Item 2's narrow scope.

---

## 7. Phase 1 — Carbon Token System (queued; full handoff drafted at Phase 0e close)

Phase 1 starts after Phase 0e closes. Brief outline:

- **Source spec:** `docs/design/DESIGN-ibm.md` (in the repo). Code reads this directly and translates to Phobos's visual layer.
- **Token rewrite:** `src/index.css` `:root` and `html.light` blocks fully replaced with Carbon palette. Typography tokens follow Carbon's scale with Inter → IBM Plex Sans/Mono swap. Spacing → 8px base. Radii → 0px (with documented exceptions: tags 24px, avatars 50%). Shadow tokens → minimal.
- **`tailwind.config.js`:** theme values updated to match Carbon tokens.
- **Font loading:** IBM Plex Sans (300, 400, 600) + IBM Plex Mono (400) via Google Fonts CDN. `index.html` updated. Inter removed.
- **Token mapping document:** `docs/PHASE_1_TOKEN_MAP.md` — maps every old token to Carbon equivalent.
- **CLAUDE.md updates:** §13 (Design System) rewritten to reflect Carbon. §5 (file structure) refreshed if `tailwind.config.js` shape changes meaningfully. SPA-404 documentation note added (Item 4 fold-in: explains direct loads of SPA routes produce expected 404 from GitHub Pages before 404.html redirects into shell).

Single commit at end of Phase 1.

After Phase 1: Phases 2–4 handoffs drafted with Code's Phase 1 translation in hand as reference.

---

## 8. Completed Tasks

### 8.1 Phase 0a — Visual Audit (2026-04-28)
### 8.2 Phase 0c — Stability hardening (2026-04-28, committed)
### 8.3 Phase 0d — Backend cache refactor + Raintool removal + retention cap (2026-04-28, committed `fc0e433`)
### 8.4 Phase 0d-hotfix — Infinite re-render loop fix (2026-04-29, committed + deployed)
### 8.5 Phase 0e Item 1 — LANE_MAP typo fix + diagnostic (2026-04-29, committed + pushed)

---

## 9. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-28 | Track A tool: Stitch (Claude Design fallback) | Claude Design access issue; *deprecated 2026-04-29 in favor of Carbon spec*. |
| 2026-04-28 | Archive `src/pages/Ares.jsx` | Removes duplicated component shapes. |
| 2026-04-28 | Phobos rate-limit hardening (Phase 0c) — three layers | Production 429s. |
| 2026-04-28 | §19.2 amended for Phase 0d | Rate-limit problem unsolvable without backend refactor. Reverted post-ship. |
| 2026-04-28 | Sync schedule: every 45 min (both sources) | User-specified. |
| 2026-04-28 | Hard-stop UI: `consecutiveFailures >= 3` OR cache age > 135 min | 3× sync interval. |
| 2026-04-28 | Raintool removed entirely | Eliminates half-deprecated dependency. |
| 2026-04-28 | Done-cards retention: 365 days + 1000 hard cap | Within Firestore 1 MiB doc limit. |
| 2026-04-28 | Memory/timeout bump to 1 GiB / 540s | OOM on large boards. |
| 2026-04-28 | Phobos card normalization in `syncAresBoard` | Cut doc size 75%. |
| 2026-04-28 | Cloud Function retry/backoff with `Retry-After` | Defensive symmetry with SPA. |
| 2026-04-28 | `INTER_BOARD_DELAY_MS` 1.5s → 3s | Within "slowly" spirit. |
| 2026-04-29 | Hotfix authority granted for re-render loop | Production unusable; standard rules suspended for hotfix only. |
| 2026-04-29 | Correction: WIP (85p) on Ares is also empty/— | Internally consistent post-Raintool removal. |
| 2026-04-29 | LANE_MAP typo fix (Phase 0e Item 1) committed in same diagnostic round | Trivial mechanical fix; ceremony cycle wasn't worth the deferral. |
| 2026-04-29 | Phase 0e expanded to five-item functional cleanup | Bundled validation findings into one batch. |
| 2026-04-29 | Narrow §19.2 re-amendment for Item 2 only | Retention cap symptom is in `functions/index.js`; no frontend workaround. |
| 2026-04-29 | Stitch deprecated; IBM Carbon Design System adopted as redesign spec | Stitch failed to produce usable output by Day 3 afternoon. Carbon is complete and battle-tested. |
| 2026-04-29 | Carbon adoption is total, not partial | Driver mandate: when Carbon and current decisions conflict, Carbon wins. Both themes uniform. |
| 2026-04-29 | Carbon adoption exclusions: `lucide-react` stays; Carbon tag pills not broadly adopted | Icon migration is high-cost, low-impact. §17 stays in force. |
| 2026-04-29 | IBM Plex via Google Fonts CDN; weights 300, 400, 600 | Lower bundle size; broadly cached; rollback-friendly. |
| 2026-04-29 | Item 4 (SPA-404 docs) folded into Phase 1's CLAUDE.md updates | Doesn't warrant its own commit. |
| 2026-04-29 | Phase 0e sequencing: Items 2 → 5 → 3, then Phase 1 | Item 2 fixes a real bug; Item 5 parallel-safe; Item 3 should ship before Phase 1 since AccessContext gets touched in both. |
| **2026-04-29** | **Phase 1 source spec: `docs/design/DESIGN-ibm.md` directly (not Phobos-translated DESIGN.md)** | Driver wants to evaluate Code's design-translation ability against the raw Carbon spec. DESIGN.md retained as fallback reference but not the active source. If Code's translation drifts, Driver may supplement with generated reference screens. |

---

## 10. §19.2 Scope Amendments Log

**2026-04-28: Phase 0d amendment** — Cloud Functions, Firestore data model, Firestore rules in scope for backend cache refactor. Reverted on commit `fc0e433`.

**2026-04-29: Phase 0e Item 2 narrow re-amendment** — `functions/index.js` only, retention-cap logic correction only. Reverts immediately after Item 2 commits and pushes.

**2026-04-30: Item 2 closed as no-op.** Diagnostic confirmed cap already applied correctly on all four target boards. No `functions/index.js` edit made. §19.2 narrow re-amendment closes without exercise.

§19.2 is now back to original scope and stays there for Phases 1–4.
