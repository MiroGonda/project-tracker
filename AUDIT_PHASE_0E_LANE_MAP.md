# Phase 0e Item 1 — LANE_MAP Diagnostic on hLL7WW2V (read-only)

**Date:** 2026-04-29
**Source:** `cache/ares_hLL7WW2V` (Firestore)
**Method:** Live Firestore read via `functions/scripts/diagnose-hLL7WW2V.js` (uses ADC + `LANE_MAP` extracted from `functions/index.js`).
**Action taken:** Typo fix applied (see §8 below). 4 unknown lanes pending Driver classification in a follow-up.

---

## TL;DR

`activeCount: 441` is **mostly a real backlog**, not a LANE_MAP misclassification. Current snapshot is 435 active cards across 32 unique lanes; the bulk live in legitimate Pending lanes (`Backlog: Icons` 134, `Backlog: Process Lane` 65, `Backlog: Assets` 28) and `➜ Render: Working on it` 68. Together those four lanes account for **295 of 435 (68%)** active cards.

**However**, the diagnostic surfaced **5 lanes (26 cards) currently missing from `LANE_MAP`**, plus one likely **typo bug** that's causing 1 card to fall through to "no map" classification.

---

## 1. LANE_MAP sync check

Both copies (`src/pages/BoardPage.jsx:87` and `functions/index.js:43`) are **identical** at the key/value level. The diagnostic script extracted LANE_MAP from `functions/index.js`; cross-checked against `BoardPage.jsx` separately. No drift.

## 2. Active-card snapshot

- `activeCards`: 435
- `doneCards` (capped): 1000
- `doneCardsTotalAvailable`: 1470 (uncapped Phobos total — relevant to Item 2)
- Unique lanes in active set: 32

Top lanes by count:

| Rank | Lane                                     | Count | In LANE_MAP? | Status     |
|-----:|------------------------------------------|------:|--------------|------------|
| 1    | `Backlog: Icons`                         |   134 | yes          | Pending    |
| 2    | `➜ Render: Working on it`                |    68 | yes          | Ongoing    |
| 3    | `Backlog: Process Lane`                  |    65 | yes          | Pending    |
| 4    | `Backlog: Assets`                        |    28 | yes          | Pending    |
| 5    | `➜ Ready for Render`                     |    18 | yes          | Ongoing    |
| 6    | `➜ Sketch: Sent for Client Approval`     |    17 | yes          | For Approval |
| 7    | `Working on Ops Work`                    |    11 | yes          | Ongoing    |
| 8    | `Working on Design`                      |     9 | yes          | Ongoing    |
| 9    | `➜ Sketch: Working on it`                |     8 | yes          | Ongoing    |
| 10   | **`Backlog: Pending Art Direction`**     |     8 | **NO**       | (unmapped) |

Full table is in the script output (`node functions/scripts/diagnose-hLL7WW2V.js`).

## 3. Findings — lanes missing from LANE_MAP

**5 lanes / 26 cards / 6.0% of active set** are not classified by LANE_MAP. Currently treated as "no lane" by `extractList → LANE_MAP[…]` lookups, which means they fall through to `null`/`undefined` in classification logic — counted in raw active cards but not in any category bucket, type bucket, or status bucket.

| Lane                                  | Cards | Likely intent                                                  |
|---------------------------------------|------:|----------------------------------------------------------------|
| `Backlog: Pending Art Direction`      |     8 | Pending — Design backlog variant (specific to GCash workflow)  |
| `Backlog: For Pushback`               |     6 | Pending — Design or Process backlog variant                    |
| `Backlog: For Cascade`                |     6 | Pending — Design or Process backlog variant                    |
| `NOTE`                                |     5 | **Non-card lane** — Trello "NOTE" lanes are typically informational column markers, not actual work cards. Could be intentionally excluded, or could be classified as `Misc`/`Discarded`. |
| `➜ Render: Sent for Client Approval`  |     1 | **Bug**: existing key in LANE_MAP is `'-> Render: Sent for Client Approval'` (ASCII `->` instead of arrow `➜`) at `BoardPage.jsx:199` and `functions/index.js:155`. The actual lane name on Trello uses the arrow character. The typo means cards in this real lane never match. |

## 4. Findings — lanes that "sound like Done" but mapped non-Done

**None.** Every lane currently in the active set with semantics implying completion (`Complete`, `Done`, `Approved`, `Delivered`, `Closed`, `Archive`, `Released`) is correctly mapped to `status: 'Done'` and would have been moved to `doneCards` server-side.

## 5. Findings — completion-field signal

**0 active cards** carry `completedAt`, `dateCompleted`, or `dueComplete: true`. Phobos's normalized card shape doesn't surface these for active cards, so this signal is null in practice on Ares boards.

## 6. Recommendations

1. **Typo fix — applied this commit.** See §8 below.
2. **Pending Driver classification:** all 4 unknown lanes (`Backlog: Pending Art Direction`, `Backlog: For Pushback`, `Backlog: For Cascade`, `NOTE`) are unique to the GCash workflow. Three look like Design-Backlog variants (`Pending` status seems right). `NOTE` is likely a Trello informational column — depends on whether you want notes counted at all. Driver to confirm intent per-lane before either LANE_MAP copy is edited; not in this commit.
3. **`activeCount: 441` is real backlog.** No further investigation needed there. The board legitimately carries a large `Backlog: Icons` queue (134) which dominates the count.

## 7. Diagnostic script

Committed at `functions/scripts/diagnose-hLL7WW2V.js`. Run-once, read-only. Re-runnable any time:

```
cd functions
node scripts/diagnose-hLL7WW2V.js
```

Requires ADC. Script includes the LANE_MAP cross-check inline so it stays in sync with whatever ships in `functions/index.js`.

---

## 8. Action Taken (2026-04-30)

**Typo fix shipped this commit.** `LANE_MAP` key `'-> Render: Sent for Client Approval'` (ASCII `->`) corrected to `'➜ Render: Sent for Client Approval'` (arrow `➜`) in both copies (`src/pages/BoardPage.jsx` and `functions/index.js`) — verified lockstep post-edit. See commit message for details.

**Not in this commit, pending Driver classification:** the 4 unknown lanes (`Backlog: Pending Art Direction`, `Backlog: For Pushback`, `Backlog: For Cascade`, `NOTE`) representing 25 cards / 5.7% of hLL7WW2V's active set. Surface to Driver for status/category/type assignment before next LANE_MAP edit.
