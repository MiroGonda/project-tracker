/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy aliases — values now resolve to Carbon palette via index.css.
        // Phase 2 will migrate component class lists to consume `cds-*` directly.
        bg:             'rgb(var(--color-bg) / <alpha-value>)',
        surface:        'rgb(var(--color-surface) / <alpha-value>)',
        accent:         'rgb(var(--cds-interactive) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-muted':   'rgb(var(--color-text-muted) / <alpha-value>)',
        border:         'rgb(var(--color-border) / <alpha-value>)',

        // Carbon-canonical tokens (Phase 2+ targets).
        'cds-background':         'rgb(var(--cds-background) / <alpha-value>)',
        'cds-layer-01':           'rgb(var(--cds-layer-01) / <alpha-value>)',
        'cds-layer-02':           'rgb(var(--cds-layer-02) / <alpha-value>)',
        'cds-layer-selected':     'rgb(var(--cds-layer-selected) / <alpha-value>)',
        'cds-layer-hover':        'rgb(var(--cds-layer-hover) / <alpha-value>)',
        'cds-border-subtle':      'rgb(var(--cds-border-subtle) / <alpha-value>)',
        'cds-border-strong':      'rgb(var(--cds-border-strong) / <alpha-value>)',
        'cds-text-primary':       'rgb(var(--cds-text-primary) / <alpha-value>)',
        'cds-text-secondary':     'rgb(var(--cds-text-secondary) / <alpha-value>)',
        'cds-text-helper':        'rgb(var(--cds-text-helper) / <alpha-value>)',
        'cds-text-disabled':      'rgb(var(--cds-text-disabled) / <alpha-value>)',
        'cds-text-on-color':      'rgb(var(--cds-text-on-color) / <alpha-value>)',
        'cds-interactive':        'rgb(var(--cds-interactive) / <alpha-value>)',
        'cds-interactive-hover':  'rgb(var(--cds-interactive-hover) / <alpha-value>)',
        'cds-interactive-active': 'rgb(var(--cds-interactive-active) / <alpha-value>)',
        'cds-link-primary':       'rgb(var(--cds-link-primary) / <alpha-value>)',
        'cds-link-primary-hover': 'rgb(var(--cds-link-primary-hover) / <alpha-value>)',
        'cds-focus':              'rgb(var(--cds-focus) / <alpha-value>)',
        'cds-focus-inset':        'rgb(var(--cds-focus-inset) / <alpha-value>)',
        'cds-support-error':      'rgb(var(--cds-support-error) / <alpha-value>)',
        'cds-support-success':    'rgb(var(--cds-support-success) / <alpha-value>)',
        'cds-support-warning':    'rgb(var(--cds-support-warning) / <alpha-value>)',
        'cds-support-info':       'rgb(var(--cds-support-info) / <alpha-value>)',
        'cds-sla-healthy':        'rgb(var(--cds-sla-healthy) / <alpha-value>)',
        'cds-sla-mid':            'rgb(var(--cds-sla-mid) / <alpha-value>)',
        'cds-sla-high':           'rgb(var(--cds-sla-high) / <alpha-value>)',
        'cds-sla-breached':       'rgb(var(--cds-sla-breached) / <alpha-value>)',
      },
      fontFamily: {
        // IBM Plex Sans / Mono — loaded via Google Fonts in index.html.
        // Helvetica Neue is the visual-shape fallback during the brief load window.
        sans: ['IBM Plex Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Menlo', 'Courier', 'monospace'],
      },
      fontSize: {
        // Carbon type scale — mirror of the --type-*-* CSS variables in index.css.
        // Standard Tailwind sizes (text-xs/sm/base/lg/xl) remain available for
        // Phase 2-pending consumers; these named tokens are the migration target.
        'caption':    ['0.75rem',  { lineHeight: '1.33', letterSpacing: '0.32px', fontWeight: '400' }],
        'body-short': ['0.875rem', { lineHeight: '1.29', letterSpacing: '0.16px', fontWeight: '400' }],
        'body':       ['1rem',     { lineHeight: '1.5',  letterSpacing: '0',      fontWeight: '400' }],
        'heading-03': ['1.5rem',   { lineHeight: '1.33', letterSpacing: '0',      fontWeight: '400' }],
        'heading-02': ['2rem',     { lineHeight: '1.25', letterSpacing: '0',      fontWeight: '400' }],
        'heading-01': ['2.625rem', { lineHeight: '1.19', letterSpacing: '0',      fontWeight: '300' }],
        'display-02': ['3rem',     { lineHeight: '1.17', letterSpacing: '0',      fontWeight: '300' }],
        'display-01': ['3.75rem',  { lineHeight: '1.17', letterSpacing: '0',      fontWeight: '300' }],
      },
      spacing: {
        // Carbon-canonical 8px grid keys, alongside Tailwind's default scale.
        // Use these (`p-05`, `gap-06`) for new code; Phase 2 will migrate
        // existing px-3/py-2/etc. usages where the Carbon spec calls for them.
        '01': '0.125rem', // 2px
        '02': '0.25rem',  // 4px
        '03': '0.5rem',   // 8px
        '04': '0.75rem',  // 12px
        '05': '1rem',     // 16px
        '06': '1.5rem',   // 24px
        '07': '2rem',     // 32px
        '08': '2.5rem',   // 40px
        '09': '3rem',     // 48px
        '10': '4rem',     // 64px
      },
      borderRadius: {
        // Phase 2 — Carbon adoption is total: every default rounded-* utility
        // resolves to 0px. Bulk override so existing rounded-sm/md/lg/xl/etc.
        // usages migrate in a single shot without per-file JSX edits.
        DEFAULT: '0px',
        none:    '0px',
        sm:      '0px',
        md:      '0px',
        lg:      '0px',
        xl:      '0px',
        '2xl':   '0px',
        '3xl':   '0px',
        // 'full' intentionally NOT overridden — Tailwind's default 9999px is
        // the correct pill/circle behavior (caps at min(w,h)/2). Setting it to
        // 50% would turn rectangular pill chips into ellipses. Use Tailwind's
        // rounded-full for both circles and pill-shaped chips.
        '01':    '2px',
        tag:     '24px',  // explicit Carbon pill — §17 contexts (Phase 2/3 migration target)
      },
      boxShadow: {
        // Carbon is shadow-averse — only floating overlays use elevation shadows.
        floating: '0 2px 6px rgba(0, 0, 0, 0.3)',
        overlay:  '0 2px 6px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
