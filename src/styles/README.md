# Bacaloria Design System

**Aesthetic:** Contemporary Arabic Manuscript Desk  
دافئ • أكاديمي • ملموس — دفتر دراسة مطبوع مرتفع الجودة.

## Structure

```
src/styles/
├── tokens.css          # Colors, fonts, spacing, radii, shadows, motion
├── base.css            # Reset, body, background, global motion
├── components/
│   ├── entry-cards.css # Word / entry cards (high-visibility)
│   └── buttons.css     # Button system
├── overrides.css       # Final cascade overrides (wins over legacy)
└── README.md
```

## How it loads

`src/main.jsx` imports in this order:

1. tokens
2. base
3. entry-cards + buttons
4. original `index.css` (legacy compatibility)
5. overrides (final authority)

## Key tokens

| Token | Purpose |
|-------|---------|
| `--paper` / `--card` | Background & surfaces |
| `--ink` / `--muted` | Text hierarchy |
| `--accent-1` | Primary (clay) |
| `--accent-2` | Secondary (ochre) |
| `--meaning` | Arabic meaning green |
| `--font-display` | Fraunces (EN titles) |
| `--font-arabic` | Amiri |
| `--shadow-card` / `--shadow-elevated` | Soft paper elevation |
| `--ease-out` | Default motion curve |

## Text on accent-colored backgrounds (dark theme pitfall)

`--accent-1` / `--accent-2` are **not** the same color in light vs. dark
theme — dark theme deliberately brightens them (e.g. `--accent-1` goes
from a deep clay red `#A84328` to a light warm orange `#D97B4F`) so they
still pop against the near-black paper. That means a fixed `color: #fff`
on top of an accent-filled chip/badge/button is fine in light theme but
becomes low/no-contrast in dark theme.

**Rule:** any element whose background is `var(--accent-1)`, `var(--accent-2)`,
`var(--c)` (a per-instance accent passed via inline `style`), or another
themeable/bright fill, must set its text color with
`color: var(--on-accent, #fff);` — never a hardcoded `#fff`/`white`.
`--on-accent` is redefined per theme (see `tokens.css` and `index.css`)
specifically so it flips to a dark ink when the accent itself is light.
Hardcoded hex text colors are only safe on backgrounds that are also
fixed hex values unaffected by theme (e.g. a fixed-red notification
badge), never on a CSS variable that changes with the theme.

Before adding a new accent-filled pill/chip/badge, search the codebase
for `var(--on-accent` for existing examples, and grep for
`color: #fff` / `color: white` in your new CSS to make sure none of
them sit on a themed background.

## Next steps (Phase C completion)

- Move remaining large blocks from `index.css` into dedicated component files (toolbar, modals, timer, quiz, todo…).
- Remove duplicated `:root` from the legacy file once migration is complete.
- Add optional `data-texture="grain"` for subtle paper grain.
