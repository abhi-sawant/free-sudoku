# Theme distinctness gate

Run after adding or changing a theme (spec: `docs/superpowers/specs/2026-11-07-new-themes-design.md`). Needs `npm run dev`
and Chromium (`export PLAYWRIGHT_CHROMIUM=/path/to/chrome`, or let playwright-core find its own).

```bash
node --test "scripts/theme-gate/*.test.mjs"             # the axes rule's own tests, including axes.json
node scripts/theme-gate/axes-check.mjs <id>              # >= 4 axes differ from every theme, >= 2 values of its own
node scripts/theme-gate/theme-check.mjs <id> --paper '#hex' [--paper-dark '#hex']   # first paint, scheme, theme-color, picker swatch
node scripts/theme-gate/capture.mjs --out /tmp/shots     # screenshots + contrast; --themes a,b to limit; --scheme dark
node scripts/theme-gate/distance.mjs /tmp/shots --check <id>   # pairwise distance; fails if closer than baseline.json's min (--scheme dark for a dark capture)
node scripts/theme-gate/primary.mjs <id>                 # the primary button keeps its own fill (watch :is() specificity)
node scripts/theme-gate/picker.mjs                       # the picker scrolls and Done stays on screen at 320x568
```

Theme-specific checks: `brutal.mjs` (a press moves into the shadow), `terminal.mjs` (amber contrast, cursor blink off
under reduced motion), `blueprint.mjs` (the grid never takes a click), `clay.mjs` (a pressed key flips its shading),
`felt.mjs` (cream card faces at 4.5:1), `news.mjs` (strictly neutral greys).

## Results (2026-11-07, all 13 themes)

Each new theme's nearest neighbour; floors are light 0.0995 (Graph Paper / Mist), dark 0.2134 (Linen / Sage).

| Theme | Light: nearest | Dark: nearest |
|---|---|---|
| Midnight (dark only) | Terminal 0.491 | Linen 0.284 |
| Neo-brutalist | Linen 0.358 | Linen 0.237 |
| Terminal (dark only) | Midnight 0.491 | Linen 0.391 |
| Blueprint (dark only) | Felt & Wood 0.585 | Claymorphism 0.571 |
| Claymorphism | Mist 0.164 | Mist 0.450 |
| Felt & Wood | Terminal 0.563 | Pocket 0.432 |
| Newsprint | Sage 0.128 | Sage 0.412 |

No new contrast gaps; every theme passes the axes rule. Two first attempts failed and were reworked: Terminal on
near-black measured 0.139 from Midnight (the ground was lifted to dark amber-brown), and dark Newsprint on near-black
measured 0.193 from Linen (the stock became mid-grey).

- `axes.json`: every theme scored on eight axes. Describe what the CSS really does; a new theme adds its own row.
- `baseline.json`: the smallest distance between two of the original six themes, one value per colour scheme (light: Graph Paper / Mist; dark: Linen / Sage). Capture and check in BOTH schemes. A new theme must be at
  least this far from every other theme. Rework the theme, never the baseline.
- `contrast-known.json`: contrast gaps that existed before the gate (Mist's orange, lilac, sky and cocoa on its paper are just
  under 4.5:1). New gaps still fail.
- The distance is a coarse measure (downscaled pixels plus a colour histogram), so also look at the screenshots.
