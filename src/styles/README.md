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

## Next steps (Phase C completion)

- Move remaining large blocks from `index.css` into dedicated component files (toolbar, modals, timer, quiz, todo…).
- Remove duplicated `:root` from the legacy file once migration is complete.
- Add optional `data-texture="grain"` for subtle paper grain.
