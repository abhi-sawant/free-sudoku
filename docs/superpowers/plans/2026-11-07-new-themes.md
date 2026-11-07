# New Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven themes (Midnight, Neo-brutalist, Terminal, Blueprint, Claymorphism, Felt & Wood, Newsprint) to the picker, each passing a measured distinctness gate against the six existing themes and each other.

**Architecture:** A theme is a token block in `src/themes/tokens.css`, a character file `src/themes/<id>.css`, an entry in `THEMES` (`src/theme.ts`) and an import in `src/themes/index.css`. A small gate toolkit in `scripts/theme-gate/` (axes rule, contrast, screenshot distance) is built first and run after every theme. Themes are built one per task, in the order below.

**Tech Stack:** Vite 8, TypeScript 7, plain CSS custom properties, `node:test` for the gate's unit test, `playwright-core` (new devDependency) for screenshots, run against `vite` dev on `http://localhost:5173`.

**Spec:** `docs/superpowers/specs/2026-11-07-new-themes-design.md`

## Global Constraints

- Do not bump `version` in `package.json` (currently 4.1.0).
- A game never names a theme; restyle only shared classes (`.board`, `.cell` states, `.pad-btn`, `.card`, `.slot`, `.die`, `.btn`, `.tool`, `.dialog`, `.timer`, `.icon-btn`, home `.family`/`.game-card`, `.guide-dialog`).
- Every accent is at least 4.5:1 on `--paper`; `--on-ink` is at least 4.5:1 on each accent.
- Fonts: self-hosted OFL, Latin subset, in `src/fonts/` with the licence file alongside, at most two families per theme, loaded only by that theme's `@font-face`.
- Midnight, Terminal and Blueprint are dark only (same dark tokens whatever the OS scheme). Terminal is amber, not green. Newsprint is built last and dropped if it fails the gate against Linen.
- Gate per theme: differs from every other theme on at least 4 of 8 axes, holds a value no other theme has on at least 2; pairwise screenshot distance to every other theme is at least the baseline minimum among the six existing themes; board states legible; contrast rules above.
- One theme per commit. Mist and the six existing themes' looks are unchanged.

## Review Focus

- A dark-only theme chosen while the OS is in **light** mode must still use its dark tokens, and the browser's `theme-color` must follow its `--paper`. (Task 3 test.)
- The picker holding 13 options must stay usable at 320x568: the Done button reachable, the list scrollable. (Task 2 test.)
- The theme swatch in the picker draws each option in its own tokens through the `.theme-opt` half of every selector. (Task 3 test.)
- Every board state (selected, same-value, wrong, hint, solved, paused, empty) stays legible in each new theme, including ones the shared classes don't cover. (Gate step in every theme task.)
- First paint is themed: with `games.theme` set in `localStorage`, `<html data-theme>` is the new id before any script module runs. (Task 3 test.)

---

### Task 1: The distinctness gate toolkit

**Files:**
- Create: `scripts/theme-gate/axes.json`, `scripts/theme-gate/axes-check.mjs`, `scripts/theme-gate/axes-check.test.mjs`, `scripts/theme-gate/capture.mjs`, `scripts/theme-gate/distance.mjs`, `scripts/theme-gate/baseline.json`, `scripts/theme-gate/README.md`
- Modify: `package.json` (devDependency `playwright-core` only; no version bump)

**Interfaces:**
- Produces: `axes.json` maps a theme id to an object with the eight keys `ground, edges, depth, corners, type, texture, home, families` (string values).
- Produces: `checkAxes(axes: Record<string, Record<string,string>>, id: string): { ok: boolean; failures: string[] }` exported from `axes-check.mjs`. Rule: against every other theme, at least 4 keys differ; and at least 2 keys hold a value no other theme has.
- Produces: `node scripts/theme-gate/capture.mjs --base <url> --out <dir> [--themes a,b]` writes `<dir>/<theme>/<screen>.png` for screens `home, sudoku, chess, klondike, 2248, rules` at 390x800, then prints each theme's contrast table and exits 1 if any accent is under 4.5:1 on `--paper` or `--on-ink` under 4.5:1 on an accent.
- Produces: `node scripts/theme-gate/distance.mjs <dir> [--check <id>]` prints the pairwise distance matrix (0 to 1; the mean of a 24x40 downscaled-pixel distance and a colour-histogram distance, measured in a page canvas) and, with `--check`, exits 1 if `<id>` is closer than `baseline.json`'s `min` to any other theme.
- Produces: `baseline.json` is `{ "min": number, "pair": [string, string] }`, the smallest distance among the six existing themes.

- [ ] **Step 1: Write the failing test** in `axes-check.test.mjs` using `node:test`: (a) `checkAxes` fails a theme identical to another on 5 keys (only 3 differ); (b) passes a theme differing on 4 keys with 2 unique values; (c) fails a theme with 4 differing keys but no unique value; (d) the real `axes.json` holds the six existing themes and each passes against the others.
- [ ] **Step 2:** Run `node --test scripts/theme-gate`. Expected: FAIL, `axes-check.mjs` missing.
- [ ] **Step 3:** Write `axes.json` for the six existing themes, judged from their CSS: mist (light-cool, none, soft-shadow, soft, sans-humanist, none, tile-grid, hue), linen (light-warm, hairline, flat, soft-small, serif, none, ruled-list, hue), sage (light-green, none, flat, pill, sans-geometric, none, pill-rows, tint-lozenge), graph (light-white, outline-hand, flat, soft-small, hand, grid, ruled-list, highlighter), block (light-offwhite, outline-hard, flat, square, sans-heavy-lower, none, colour-bands, fill-field), pocket (light-lcd-green, outline-hard, stepped, stepped, pixel, dot-grid, tile-grid, dither). Implement `checkAxes` in `axes-check.mjs`, with a CLI `node scripts/theme-gate/axes-check.mjs <id>` that reads `axes.json`.
- [ ] **Step 4:** Run `node --test scripts/theme-gate`. Expected: PASS. If a real pair fails the rule, correct that entry's axis values (the axes describe what the CSS really does) and say so in the commit message.
- [ ] **Step 5:** `npm i -D playwright-core`. Implement `capture.mjs` (launch Chromium via `PLAYWRIGHT_CHROMIUM` env path or Playwright's default, set `games.theme` through an init script, start a game by clicking the first visible level button, and for `rules` open the `.help-btn` dialog). Implement `distance.mjs` (load PNGs into a blank page, draw to a 24x40 canvas, read `getImageData`).
- [ ] **Step 6:** With `npm run dev` serving, run `capture.mjs --out <scratch>/shots --themes mist,linen,sage,graph,block,pocket`, then `distance.mjs <scratch>/shots`. Write the smallest pair's distance to `baseline.json`. Expected: capture exits 0 with no contrast failures for the six; if an existing theme fails contrast, record it in `README.md` as a known pre-existing gap and exclude it from the exit code.
- [ ] **Step 7:** Commit `feat(themes): distinctness gate toolkit`.

### Task 2: A picker that holds 13 options

**Files:**
- Modify: `src/style.css` (the `.theme-dialog` / `.theme-grid` block near line 500)
- Test: `scripts/theme-gate/picker.mjs` (a small Playwright check, run by hand)

**Interfaces:**
- Consumes: the existing `#theme-dialog`, `#theme-grid`, `#theme-close` in `index.html` and `src/main.ts`.
- Produces: `.theme-grid` scrolls within the dialog so `#theme-close` is always visible.

- [ ] **Step 1: Write the failing check.** `picker.mjs` opens the home page at 320x568, appends seven extra `.theme-opt` buttons cloned from the first to `#theme-grid`, opens the dialog, and asserts `#theme-close` is fully inside the viewport and `#theme-grid`'s `scrollHeight > clientHeight`.
- [ ] **Step 2:** Run it. Expected: FAIL (the Done button is pushed below the viewport).
- [ ] **Step 3:** Give `.theme-dialog` a `max-height: calc(100dvh - 32px)` flex column and `.theme-grid` `overflow-y: auto; overscroll-behavior: contain` with the title and Done button pinned.
- [ ] **Step 4:** Run it. Expected: PASS. Also open the picker with the real six options: layout unchanged on a 390px screen.
- [ ] **Step 5:** Commit `fix(themes): picker scrolls so Done stays reachable`.

### Task 3: Midnight (the pattern for every theme task)

**Files:**
- Modify: `src/themes/tokens.css` (one always-dark block), `src/themes/index.css` (import), `src/theme.ts` (`THEMES` entry), `scripts/theme-gate/axes.json`, `DESIGN.md` (Themes table row), `README.md` (the Themes line)
- Create: `src/themes/midnight.css`

**Interfaces:**
- Consumes: Task 1's `axes-check.mjs`, `capture.mjs`, `distance.mjs`; Task 2's scrolling picker.
- Produces: `{ id: 'midnight', name: 'Midnight', note: ... }` in `THEMES`; `data-theme='midnight'` and `.theme-opt[data-theme='midnight']` selectors; axes entry `midnight`.

- [ ] **Step 1: Write the failing axes entry first.** Add `midnight` to `axes.json` (ground black, edges hairline, depth glow, corners soft, type sans-system, texture none, home tile-grid, families hue) and run `node scripts/theme-gate/axes-check.mjs midnight`. Expected: PASS (this pins the identity before any CSS).
- [ ] **Step 2: Write the failing theme checks** as `scripts/theme-gate/midnight.mjs`: with `games.theme=midnight` and the browser emulating a light OS scheme, load `sudoku/index.html` and assert `getComputedStyle(documentElement).getPropertyValue('--paper')` is `#000000`, `html[data-theme]` is `midnight` before module scripts run (read it from an early `evaluateOnNewDocument` probe), and the `theme-color` meta equals `#000000` after load. Run it. Expected: FAIL (no such theme).
- [ ] **Step 3: Tokens.** One `:root[data-theme='midnight'], .theme-opt[data-theme='midnight']` block with `color-scheme: dark` and no media-query form: `--paper #000000; --sheet #08090b; --sunk #000000; --ink #f2f4f8; --ink-2 #9aa0ad; --rule #1c1f26; --rule-2 #3a3f4b; --on-ink #000000;` accents `--blue #6ea0ff --teal #3fd0e0 --coral #ff6b7d --yellow #ffd24a --lilac #a08bff --mint #4be0a8 --orange #ff9a3d --sky #33d6c4 --olive #9be15a --berry #ff6fae --plum #d27bff --cocoa #d6b28a`; `--shadow: 0 0 0 1px var(--rule)`; radii 20/12/12/12/14; system font stack for `--font-ui` and `--font-display`. Add `midnight` to `THEMES` and import `midnight.css` from `index.css`.
- [ ] **Step 4: Character file `midnight.css`.** Tiles and buttons are outlined by the hairline `--shadow`, not filled; selected or active things (a switched-on `.tool`, `.cell.selected`, `.btn-primary`, `.continue`, focus) take a glow ring `0 0 0 1.5px var(--c), 0 0 18px -2px color-mix(in srgb, var(--c) 55%, transparent)`; each home `.game-card` is hairline-outlined with its family-coloured dot; `.dialog` and `.guide-dialog` outlined; a `prefers-reduced-motion` rule drops any glow animation. Check each board class listed in Global Constraints and the states in Review Focus.
- [ ] **Step 5:** Run `midnight.mjs`. Expected: PASS. Run `node scripts/theme-gate/axes-check.mjs midnight`. Expected: PASS.
- [ ] **Step 6: Gate.** With the dev server up, run `capture.mjs --themes mist,linen,sage,graph,block,pocket,midnight`, then `distance.mjs <dir> --check midnight`. Expected: no contrast failure, exit 0 (Midnight further from every theme than `baseline.min`). Look at the contact sheet of Midnight against Mist-dark. If it fails, rework the character file, not the threshold.
- [ ] **Step 7: Docs.** Add the Midnight row to the Themes table in `DESIGN.md` and update the README Themes line to include it.
- [ ] **Step 8:** Commit `feat(themes): Midnight`.

### Tasks 4 to 9: Neo-brutalist, Terminal, Blueprint, Claymorphism, Felt & Wood, Newsprint

Each is Task 3's eight steps with its own identity from the spec's table, in this order. Each task's own deliverables are its axes entry, token block, `src/themes/<id>.css`, `THEMES` entry, `index.css` import, DESIGN.md row, README line, and one commit `feat(themes): <Name>`. Each adds a `<id>.mjs` check for what is specific to it. All use the Task 3 gate.

- **Task 4, Neo-brutalist (`brutal`):** cream paper, 3px black borders, hard offset shadows with no blur (`--shadow: 4px 4px 0 var(--ink)`), buttons that press down by moving into their shadow, saturated flat fills, one chunky grotesque face. Specific check: `.btn:active` translates by the shadow offset. Axes: light-cream, outline-hard, hard-shadow, soft-small, sans-grotesque, none, tile-grid, fill-field.
- **Task 5, Terminal (`terminal`):** dark only, amber on near-black, monospace, scanline overlay on `body`, bracketed `[ ]` buttons, a blinking cursor on `.cell.selected`, families told apart by a text tag. Specific check: the amber accent is at least 4.5:1 on `--paper`, and the blink is off under `prefers-reduced-motion`. Axes: dark-amber, hairline, flat, square, mono, scanline, ruled-list, text-tag.
- **Task 6, Blueprint (`blueprint`):** dark only, deep blue, light lines, a fine grid, precise strokes, uppercase mono labels, dimension ticks and corner brackets on boards. Specific check: the grid layer doesn't intercept clicks. Axes: dark-blue, outline-fine, flat, square, mono-upper, grid, ruled-list, line-weight.
- **Task 7, Claymorphism (`clay`):** pastel candy tiles, inset highlight plus inset shade plus a soft outer shadow, radii 28 or more, a fat rounded face. Specific check: a pressed `.pad-btn` flips its inset shading. Axes: light-pastel, none, bevel-soft, puffy, sans-rounded-fat, none, tile-grid, pastel-fill.
- **Task 8, Felt & Wood (`felt`):** dark green felt with grain, wooden tiles, bevels, cream cards. Specific check: card faces stay cream with 4.5:1 ink in dark and light. Axes: dark-green-felt, bevel, bevel, soft-small, serif-slab, grain, tile-grid, wood-tint.
- **Task 9, Newsprint (`news`):** grey newsprint, black ink, halftone tints, double column rules, uppercase small labels, a high-contrast display serif that is not Fraunces. Specific check: strictly neutral grey (no warm cast) in `--paper`, `--sheet`, `--sunk`. If its distance to Linen is under the baseline, drop it: remove its files, and record why in `DESIGN.md`.

### Task 10: Whole-set gate and handoff

**Files:**
- Modify: `scripts/theme-gate/baseline.json` (unchanged value), `scripts/theme-gate/README.md`
- Produce: a contact sheet and the full pairwise matrix for all kept themes.

- [ ] **Step 1:** Run `capture.mjs` for all kept themes, `distance.mjs <dir>` for the full matrix, and `node --test scripts/theme-gate`. Expected: every pair at or above the baseline, every test passing.
- [ ] **Step 2:** Run `npm run build`. Expected: exit 0.
- [ ] **Step 3:** Show the owner the contact sheet and matrix; commit any README updates `docs(themes): gate results`.
