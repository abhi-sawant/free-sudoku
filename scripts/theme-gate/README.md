# Theme distinctness gate

Run after adding or changing a theme (spec: `docs/superpowers/specs/2026-11-07-new-themes-design.md`). Needs `npm run dev`
and Chromium (`export PLAYWRIGHT_CHROMIUM=/path/to/chrome`, or let playwright-core find its own).

```bash
node --test "scripts/theme-gate/*.test.mjs"             # the axes rule's own tests, including axes.json
node scripts/theme-gate/axes-check.mjs <id>              # >= 4 axes differ from every theme, >= 2 values of its own
node scripts/theme-gate/capture.mjs --out /tmp/shots     # screenshots + contrast; --themes a,b to limit
node scripts/theme-gate/distance.mjs /tmp/shots --check <id>   # pairwise distance; fails if closer than baseline.json's min
```

- `axes.json`: every theme scored on eight axes. Describe what the CSS really does; a new theme adds its own row.
- `baseline.json`: the smallest distance between two of the original six themes (Graph Paper / Mist). A new theme must be at
  least this far from every other theme. Rework the theme, never the baseline.
- `contrast-known.json`: contrast gaps that existed before the gate (Mist's orange, lilac, sky and cocoa on its paper are just
  under 4.5:1). New gaps still fail.
- The distance is a coarse measure (downscaled pixels plus a colour histogram), so also look at the screenshots.
