# Phase 1 — Carbon Token Migration Map

**Date:** 2026-04-30
**Source spec:** [docs/design/DESIGN-ibm.md](design/DESIGN-ibm.md) (IBM Carbon Design System adoption)
**Affected files:** `src/index.css`, `tailwind.config.js`, `index.html`
**Out of scope (Phase 1):** all `src/components/*` and `src/pages/*` JSX. Component primitives in `src/index.css @layer components` are held verbatim for Phase 2 rewrite.

---

## 1. Old → New token map

The legacy `--color-*` CSS variables now resolve transitively to the Carbon `--cds-*` tokens via `var(--cds-...)` indirection (see `src/index.css`). Existing consumers (`bg-bg`, `text-text-primary`, `border-border`, …) get the Carbon palette without any JSX edits — that is the Phase 1 deliverable.

### Color tokens (RGB triplets, used through Tailwind alpha syntax)

| Legacy var          | Old (light)     | Old (dark)      | Carbon var          | New (light)     | New (dark)      | Notes |
|---------------------|-----------------|-----------------|---------------------|-----------------|-----------------|-------|
| `--color-bg`        | `245 245 247`   | `15 15 15`      | `--cds-background`  | `255 255 255`   | `22 22 22`      | Light gets pure white; dark gets Gray 100 (not pure black per Carbon). |
| `--color-surface`   | `255 255 255`   | `28 28 30`      | `--cds-layer-01`    | `244 244 244`   | `38 38 38`      | **Semantic shift:** old "surface" was *brighter* than bg in light theme (white card on near-white page). Carbon Layer 01 is *darker* than bg in light theme — this is the inversion that drives Carbon's "depth via background-color layering" model. Components rendering as cards on `surface` will look meaningfully different now: dark theme cards are slightly lighter than the page (correct), light theme cards are slightly darker than the page (also correct, but inverts the prior visual). |
| `--color-text-primary` | `17 19 24`   | `232 232 232`   | `--cds-text-primary`| `22 22 22`      | `244 244 244`   | Light = Gray 100; dark = Gray 10. Both hit ~16:1 contrast on their respective backgrounds. |
| `--color-text-muted`| `107 114 128`   | `107 114 128`   | `--cds-text-secondary` | `82 82 82`   | `198 198 198`   | **Semantic shift:** old `text-muted` was the same gray (`#6b7280`) in both themes — barely AA-compliant on dark. Carbon splits: Gray 70 on light (~7.8:1), Gray 30 on dark (~10.5:1). Dark-theme muted text becomes more legible. |
| `--color-border`    | `228 228 231`   | `42 42 46`      | `--cds-border-subtle` | `198 198 198` | `57 57 57`      | Slightly darker borders in both themes — Carbon's Gray 30 on light is more visible than the prior Zinc 200; Gray 80 on dark is similar tone. |

### Accent — the most visible Phase 1 change

| Token name | Old           | New                      | Notes |
|------------|---------------|--------------------------|-------|
| `accent`   | `#6366f1` (Indigo 500) | `rgb(var(--cds-interactive))` → Blue 60 (`#0f62fe`) light / Blue 40 (`#78a9ff`) dark | Every `bg-accent`, `text-accent`, `border-accent` class instantly switches to Carbon Blue. This is the "dramatic visible change" the directive flags as expected. |

### New Carbon tokens (no legacy equivalent)

These are net-new; Phase 2 components will consume them directly:

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--cds-layer-02` | Gray 20 `#e0e0e0` | Gray 80 `#393939` | Elevated panels within Layer-01 (modals over cards, popovers). |
| `--cds-layer-selected` | Gray 30 | Gray 70 | Selected row, active list item background. |
| `--cds-layer-hover` | Gray 10 hover `#e8e8e8` | Gray 80 | Hover state for Layer-01 surfaces. |
| `--cds-border-strong` | Gray 50 | Gray 30 | Strong dividers, focused field bottom-border. |
| `--cds-text-helper` | Gray 60 | Gray 50 | Form helper text, tertiary metadata. |
| `--cds-text-disabled` | Gray 50 | Gray 60 | Disabled text. |
| `--cds-text-on-color` | White | White | Text rendered on a colored fill (button text on Blue 60). |
| `--cds-interactive-hover` / `-active` | Blue 70 / Blue 80 | Blue 30 / Blue 20 | Button hover/active states. |
| `--cds-link-primary` / `-hover` | Blue 60 / Blue 70 | Blue 40 / Blue 30 | Anchor links. |
| `--cds-focus` | Blue 60 | White | Focus ring color. White on dark is canonical Carbon. |
| `--cds-focus-inset` | White | Gray 100 | Inner ring of the focus indicator. |
| `--cds-support-error` / `-success` / `-warning` / `-info` | Red 60 / Green 50 / Yellow 30 / Blue 60 | Red 50 / Green 40 / Yellow 30 / Blue 40 | Semantic status colors. Yellow 30 is uniform across themes per Carbon convention. |
| `--cds-sla-healthy` / `-mid` / `-high` / `-breached` | Green 50 / Yellow 30 / `#ff832b` / Red 60 | Green 40 / Yellow 30 / `#ff832b` / Red 50 | 4-step SLA gradient mapped to Carbon. See judgment call #1 for the orange. |
| `--chart-01` … `--chart-08` | Carbon "5-color" expanded to 8 (Purple 70 / Cyan 50 / Teal 70 / Magenta 70 / Red 50 / Green 60 / Blue 80 / Yellow 60) | Carbon dark equivalents (Purple 60 / Cyan 40 / Teal 60 / Magenta 40 / Red 50 / Green 30 / Blue 50 / Purple 30) | recharts categorical palette. Phase 2/3 will route the chart components to read these via CSS. |

### Typography tokens (CSS variables, fontSize utilities)

Old: a single `font-family: 'Inter', sans-serif` in body; sizes inline as Tailwind utilities (`text-xs`, `text-sm`, `text-[10px]`, `text-[11px]`, etc.). No size variables.

New: full Carbon type scale exposed as both CSS variables (`--type-*-size/-weight/-lh/-track`) and Tailwind named font-sizes (`text-caption`, `text-body-short`, `text-body`, `text-heading-{01,02,03}`, `text-display-{01,02}`). Tailwind's standard `text-xs/sm/base/lg/xl` utilities remain functional from defaults for unmigrated consumers.

| Carbon role | Size | Weight | Line-height | Tracking |
|-------------|------|--------|-------------|----------|
| Display 01 | 60px | 300 | 1.17 | 0 |
| Display 02 | 48px | 300 | 1.17 | 0 |
| Heading 01 | 42px | 300 | 1.19 | 0 |
| Heading 02 | 32px | 400 | 1.25 | 0 |
| Heading 03 | 24px | 400 | 1.33 | 0 |
| Body 01 | 16px | 400 | 1.50 | 0 |
| Body emphasis | 16px | 600 | 1.50 | 0 |
| Body short 01 | 14px | 400 | 1.29 | **0.16px** |
| Body short 02 | 14px | 600 | 1.29 | **0.16px** |
| Caption | 12px | 400 | 1.33 | **0.32px** |
| Code | 14px (mono) | 400 | 1.43 | 0.16px |

Letter-spacing only at 14px and below (Carbon convention). No weight 700 — type scale stops at 600 (Semibold).

### Spacing — Carbon 8px grid

| Token | Value | px |
|-------|-------|----|
| `--spacing-01` / `space-01` | `0.125rem` | 2 |
| `--spacing-02` / `space-02` | `0.25rem`  | 4 |
| `--spacing-03` / `space-03` | `0.5rem`   | 8 |
| `--spacing-04` / `space-04` | `0.75rem`  | 12 |
| `--spacing-05` / `space-05` | `1rem`     | 16 |
| `--spacing-06` / `space-06` | `1.5rem`   | 24 |
| `--spacing-07` / `space-07` | `2rem`     | 32 |
| `--spacing-08` / `space-08` | `2.5rem`   | 40 |
| `--spacing-09` / `space-09` | `3rem`     | 48 |
| `--spacing-10` / `space-10` | `4rem`     | 64 |

These are exposed as Tailwind `p-05`, `gap-06`, etc. Standard Tailwind spacing (`p-3`, `gap-4`) remains available so existing components don't break — Phase 2 will migrate where the Carbon spec calls for canonical scale values.

### Radii

| Token | Value | Use |
|-------|-------|-----|
| `--radius-00` / `rounded-none` | `0` | Default per Carbon — buttons, inputs, cards, tiles. |
| `--radius-01` / `rounded-01` | `2px` | Occasional small interactive elements. |
| `--radius-tag` / `rounded-tag` | `24px` | Pill exception — only inside CLAUDE.md §17 contexts (MC badges, type Work/Process, status chips). |
| `--radius-circle` / `rounded-full` | `50%` | Avatars, icon circles. |

Tailwind defaults `rounded-sm/md/lg` are intentionally NOT overridden in Phase 1 — see Section 2.

### Shadows

Carbon is shadow-averse. Only floating overlays elevate.

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-00` | `none` | Default. Cards/tiles get NO shadow. |
| `--shadow-floating` / `shadow-floating` | `0 2px 6px rgba(0,0,0,0.3)` | Dropdowns, tooltips, popovers. |
| `--shadow-overlay` / `shadow-overlay` | `0 2px 6px rgba(0,0,0,0.3)` | Modal dialogs, side panels. |
| `--shadow-focus` | inset 2px focus + 1px inset | Keyboard focus indicator. |

---

## 2. Tailwind class implications (Phase 2/3 migration targets)

The Carbon adoption is total per DIRECTIVE.md §4. Several heavily-used Tailwind utility classes are now visually inconsistent with Carbon. They are **intentionally left functional** in Phase 1 so consumers don't break before Phase 2 rewrites them.

| Utility used today | Carbon expectation | Phase 2/3 action |
|--------------------|-------------------|------------------|
| `rounded-lg` (used heavily on cards, modals, buttons, inputs) | `rounded-none` (0px) | Replace with `rounded-none` or remove. Buttons/inputs/cards/tiles ALL go to 0px in the Carbon migration. |
| `rounded-md` / `rounded` (occasional) | `rounded-none` | Same as above. Pill contexts (`rounded-full` chips) keep `rounded-tag` only when the §17 exemption applies. |
| `border` on input fields | bottom-border only (`border-b-2`) | Inputs become bottom-border (`border-x-0 border-t-0 border-b-2`). Background shifts to Layer-01 (`bg-cds-layer-01`). |
| `shadow-*` on cards / tiles / sections | none | Strip shadow utilities from card/tile/section components. Use background-color layering for depth. |
| `bg-white/5`, `hover:bg-white/5` (alpha overlay surfaces) | Layer tokens (`bg-cds-layer-01`, `hover:bg-cds-layer-hover`) | Replace alpha-on-white pattern with explicit Carbon layer tokens. The light-theme legacy overrides in `index.css` keep these visually plausible until migrated. |
| `font-medium` (500) | Carbon weight scale stops at 300/400/600 | Audit: `font-medium` becomes `font-normal` (400) in body contexts or `font-semibold` (600) for emphasis. No weight 500 in Carbon. |
| `font-bold` (700) | Carbon explicitly omits 700 | Replace with `font-semibold` (600). |
| `text-xs` (12px), `text-sm` (14px), `text-[10px]`, `text-[11px]` | Carbon Caption (12px / 0.32px tracking) and Body Short (14px / 0.16px tracking) | Replace with `text-caption` and `text-body-short` so tracking lands. The `text-[10px]` and `text-[11px]` micro-labels have no Carbon equivalent — Phase 2 picks: round up to `text-caption` (12px) or keep one-off arbitrary value. |
| `accent` (now Blue 60/40) | Same | No migration — the rename to `cds-interactive` is optional cosmetic. |

**Phase 1 visual reality:** until Phase 2 component rewrite ships, the app will look "half-Carbon" — colors and font are Carbon, but rounded corners, button heights, input borders, weight 500, and shadow usage all still reflect the prior system. This is the directive's expected mid-migration state ("Components will look broken or half-styled because they still use the OLD class structures and Phase 2 hasn't run yet").

---

## 3. Decisions made during translation

This is the design-translation experiment per DIRECTIVE.md §3. Driver evaluates and may supplement with reference screens if results drift.

1. **SLA "high" step uses Orange `#ff832b`.** Carbon's core palette is monochromatic + Blue + Red + Green + Yellow; orange is not a core token. The Carbon DataViz palette includes Orange 70 (`#ff832b`), so I borrowed from there. The four-step gradient (Green 40/50 → Yellow 30 → `#ff832b` → Red 50/60) preserves the visual "warming" intent of the prior Emerald → Amber → Orange → Red gradient and stays readable on both themes.

2. **`--color-surface` semantic inversion.** The prior dark-theme convention placed `surface` (cards) *brighter* than `bg` (page). In light theme, this meant white cards on a near-white page — depth came from a hairline border. Carbon Layer-01 in light theme is *darker* than the page (Gray 10 on White). Mapped `--color-surface` to `--cds-layer-01` directly per the Carbon model; the light theme will visually invert ("cards now subtly recede from the page instead of subtly rising"). This is correct Carbon behavior — depth via background layering — but is the most surprising visual change for anyone used to the prior light theme.

3. **`--color-text-muted` is now theme-asymmetric.** The prior token used the same Tailwind Gray 500 (`#6b7280`) in both themes. Carbon splits text-secondary by theme (Gray 70 on light, Gray 30 on dark) for AA contrast. Dark-theme muted text becomes notably more legible — the prior contrast on dark was at the AA edge.

4. **Focus ring color is theme-asymmetric.** Light theme uses Blue 60 (`#0f62fe`) for the focus ring per Carbon convention. Dark theme uses **white** (per the spec's `--cds-focus-inset: #ffffff` note) so the ring stays visible against the Blue 40 interactive color, which would camouflage a Blue 60 ring. This is the only theme-specific choice that diverges from "use the same hue both themes" — the spec's own dark guidance drove it.

5. **Categorical chart palette differs across themes.** Carbon publishes separate light/dark recommended categorical palettes (the dark variant uses lighter / more saturated hues so they read on Gray 100). Used the canonical 5-color set and expanded to 8 per the directive, picking the Carbon-published dark equivalents where they exist (Purple 60 not 70, Cyan 40 not 50, etc.). Phase 2/3 will route recharts to consume these tokens via `var(--chart-01)` etc. so theme switches re-color the charts automatically.

6. **Did NOT override `borderRadius.DEFAULT`.** Setting `theme.extend.borderRadius.DEFAULT = '0'` would change every bare `rounded` utility to 0px immediately — but the codebase uses `rounded-lg` (and to a lesser extent `rounded-md`) far more often, and those keep their non-zero defaults. Forcing `rounded` to 0 alone creates an inconsistent state (some-rounded, some-not). Cleaner to leave the Tailwind defaults functional and migrate ALL rounded utilities together in Phase 2. The Carbon `rounded-tag` (24px) and `rounded-full` (50%) names are added for Phase 2 to consume.

7. **Component primitives held verbatim.** `.input`, `.btn-primary`, `.btn-secondary` in `src/index.css @layer components` still reference `bg-accent` / `border-border` / `rounded-lg` / `bg-white/5`. These will get the Carbon palette automatically (because `accent` and the other tokens now resolve to Carbon values), but the structural shape (rounded buttons, fully-bordered inputs, etc.) will not be Carbon-correct until Phase 2 rewrites these primitives. Held verbatim because rewriting them in Phase 1 would have rippled visual changes through every screen — Phase 1 is a clean token swap, not a structural change.

8. **`Helvetica Neue` as the load-window fallback.** IBM Plex Sans loads asynchronously via Google Fonts CDN. During the brief font-load window the browser falls back to the next entry in the stack. Picked Helvetica Neue (then Arial, then `sans-serif`) because it's visually closer to Plex's geometric humanist proportions than the prior Inter fallback chain. On Windows the user will see Arial during the load window; on macOS Helvetica Neue. After load, IBM Plex Sans wins.

9. **Spacing tokens use 2-digit string keys (`'01'` … `'10'`).** Numeric keys would conflict with Tailwind's default scale (which already exposes `p-1`, `p-2`, etc. as `0.25rem`, `0.5rem`). Using `'01'` … `'10'` matches Carbon's own naming convention (`spacing-01`) and namespaces them away from Tailwind defaults. Consumers write `p-05`, `gap-06`, etc.

---

## 4. Verification record

- `npm run build`: green (1,348 KB JS, 38 KB CSS — chunk size unchanged ±2 KB).
- Both themes render in `npm run dev` without console errors.
- IBM Plex Sans loads from Google Fonts CDN; computed-styles confirm `font-family: "IBM Plex Sans"` on `body`.
- No undefined CSS variable warnings.
- Existing functional behavior (data loading, manual refresh, navigation) unaffected.

---

## 5. Phase 2/3 priorities surfaced by this migration

1. **Component primitives** (`.input`, `.btn-primary`, `.btn-secondary`) — rewrite with bottom-border inputs, 0px radii, 48px button height, asymmetric padding, Blue focus ring.
2. **`SectionCard`** — strip shadow, switch to background-layering depth.
3. **All `rounded-lg` usages** — bulk migration to `rounded-none`, with §17-exempted contexts going to `rounded-tag`.
4. **`bg-white/5` pattern** — replace with explicit `bg-cds-layer-01` / `hover:bg-cds-layer-hover`.
5. **Weight 500 (`font-medium`) and 700 (`font-bold`) audits** — round to 400 or 600 per Carbon's three-weight rule.
6. **Type-size utilities** — migrate `text-xs/sm` to `text-caption/body-short` to pick up letter-spacing.
7. **Chart components (`recharts`)** — route fill/stroke to `var(--chart-NN)` so theme switches re-color the charts.
