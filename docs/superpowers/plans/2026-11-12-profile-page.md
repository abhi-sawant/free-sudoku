# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/profile/` page for every player (overview, personality title, badges strip, settings), per-game leaderboard buttons, a trimmed stats page, and the home top bar reduced to the profile icon, all themed in 13 themes.

**Architecture:** Pure title rules in `src/shared/titles.ts` (node-tested) feed a new `src/profile/` page that reuses the stats page's overview code (moved), the home page's theme picker and install code (moved into `src/shared/`), and the account page's code (moved). Per-game leaderboards follow the `src/shared/sync/othergame.ts` pattern: a module loaded from `pwa.ts` that adds a button to every game menu and opens a dialog. A new shared `.panel` surface is added to each theme's surface rules.

**Tech Stack:** TypeScript (type-stripped `node --test` for pure modules), Vite multi-page build, plain DOM, CSS with per-theme character files, playwright-core for browser checks (`scripts/theme-gate/`).

**Spec:** `docs/superpowers/specs/2026-11-12-profile-page-design.md`

## Global Constraints

- Branch: `feat/profile` (from `dev`); merge back into `dev` with `--no-ff`. Never commit `vite.config.ts`'s `server.proxy` block or `.env.local` (the local dev proxy): stage `vite.config.ts` hunks with `git add -p` and leave the proxy hunk out.
- Mist design language (DESIGN.md); tokens and components from `src/base.css`; no new colours, fonts, borders or shadows. Profile, stats, badges and account pages use the blue ink (`ink-blue`, `data-family="blue"`).
- A page never names a theme; new components get rules in `src/themes/*.css`.
- Works offline; signed out nothing leaves the device. Every page imports `src/pwa.ts` before reading storage.
- Phone first: one column below 720px; the wide layout from 720px up, page max width `960px`.
- Copy is exact where the spec gives it: "Sign in to sync your progress across devices", "Play a few games and your stats appear here", "Open your full stats", "Open the badges page", "Pick for me", "The Fresh Newcomer".
- Pure modules imported by tests use `import type` for anything from modules that node can't load (imports without `.ts` extensions), and `.ts` extensions for runtime imports (as `merge.ts` does).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A brand-new player (no saves at all)**: every share and median divides by zero. Expect title "The Fresh Newcomer", the empty-state message, zeros in the banner, no `NaN`/`Infinity` anywhere. Test: Task 1 `brand-new player`.
2. **A stored title that is malformed, from an older version, or names a word the player no longer qualifies for**: malformed → automatic title; valid but no longer earned → still shown and still offered in the picker. Tests: Task 2 `parseTitle rejects junk`, Task 1 `current pick stays offered`.
3. **The games list can't be fetched (offline on a page not yet cached)**: `loadCatalog()` throws. The profile must still show the name, settings and account section, with the overview replaced by "Stats need the games list, which could not be loaded. Try again online." Check: Task 5 step 6.
4. **The title changes on another device while the profile is open**: after `games:synced` the banner shows the synced title. Check: Task 6 step 5.
5. **The leaderboard API fails, the board is empty, or the player opted out**: the dialog shows a status line, never an empty table or an exception. Check: Task 4 step 6.

---

### Task 1: Title rules

**Files:**
- Create: `src/shared/titles.ts`
- Test: `tests/titles.test.ts`

**Interfaces:**
- Consumes (types only): `GameStats`, `GameInfo` from `src/shared/gamestats.ts`.
- Produces:
  ```ts
  export interface TitleInput {
    games: GameStats[];          // every game in the catalog, played or not
    longestStreak: number;       // from streaks()
    bestDay: number;             // most games finished in one day
    earned: Record<string, number>; // badge id -> epoch ms (loadEarned())
    badgeTotal: number;          // allBadges(catalog).length
    theme: string;               // getTheme() id
  }
  export interface Title { adj: string; noun: string }
  export function titleWords(input: TitleInput, current?: Title | null): { adjectives: string[]; nouns: string[] } // in priority order, each unique; `current`'s words always included
  export function autoTitle(input: TitleInput): Title
  export const formatTitle = (t: Title) => `The ${t.adj} ${t.noun}`;
  ```

Rules (from the spec's tables; values here are the contract):

- "Finished games" = every history entry across games (`g.history`); counts per game use `g.played` (includes archive).
- Category share = sum of `played` of games in a family / total `played`. Family → nouns: `blue` Number Cruncher·Numerist·Grid Sage; `orange` Puzzler·Logician·Mastermind; `lilac` Tile Pusher·Merger·Tile Tycoon; `sky` Challenger·Tactician·Strategist; `olive` Card Player·Card Shark·Dealer; `berry` Word Nerd·Wordsmith·Lexicographer; `plum` Dice Roller·High Roller·Dice Whisperer; `cocoa` Button Masher·Arcade Ace·Speedrunner. A family qualifies at share ≥ 0.15 and ≥ 10 games in it; tiers at 10 / 100 / 500 games, all tiers up to the reached one unlocked.
- One game: share ≥ 0.40 with ≥ 10 games → `${info.name} Fan`, ≥ 100 `Devotee`, ≥ 500 `Legend`.
- A bit of everything: no family share > 0.35, and tried ≥ 10 → Wanderer, ≥ 20 All-Rounder, all catalog games → Polymath. Newcomer always.
- Times use local hours of `endedAt`: Night-Owl·Midnight·Moonlit share ≥ 0.40 in hours 22–23 or 0–3; Early-Bird·Sunrise ≥ 0.30 in 5–8; Lunch-Break ≥ 0.30 in 12–13; Weekend ≥ 0.60 on Sat/Sun. Each needs ≥ 10 finished games.
- Daily longestStreak ≥ 7; Relentless ≥ 30; Marathon·Binge bestDay ≥ 20.
- Median game length = median of `activeMs ?? elapsed` over entries that have one: Bite-Sized < 180 000 ms with ≥ 50 entries; Patient·Deep-Focus > 900 000 ms with ≥ 20 entries.
- Lightning: badge `quick`. Swift: median `elapsed` of history entries with `result === 'won'` in games where `g.bestTime !== undefined` < 180 000 ms, ≥ 20 such wins. Giant-Slaying: badge `giant-slayer`. Big-Number: any of badges `2048`, `2248-million`, `halo-2048`. High-Scoring: not implemented (spec allows leaving it out).
- Ruthless: across games with `versus`, won / (won+drawn+lost) ≥ 0.70 with ≥ 20 such games.
- Hardcore: across non-versus games, plays on levels named `expert` (or `hard` in a game with no `expert` level) / all level plays ≥ 0.30, with ≥ 20 level plays.
- Stubborn·Never-Say-Die: across games where `versus || bestTime !== undefined`, won / played < 0.40 with played ≥ 50.
- Curious tried ≥ 20; Well-Rounded tried = catalog size; Loyal one game share ≥ 0.40 with ≥ 20 total games.
- Decorated earned ≥ half of badgeTotal; Gilded ≥ 0.9; Sneaky both `found-stats` and `found-badges` earned.
- Seasoned total `timeMs` ≥ 36 000 000; Veteran total played ≥ 500; Legendary ≥ 1000. Fresh always.
- Theme word by id: mist Breezy, linen Cosy, sage Zen, graph Doodling, block Bold, pocket Retro, midnight Nocturnal, brutal Brutal, terminal Hacker, blueprint Blueprinted, clay Squishy, felt Parlour, news Headline.
- Adjective priority (auto pick = first qualifying; also the picker's order): Legendary, Relentless, Gilded, Giant-Slaying, Ruthless, Lightning, Big-Number, Well-Rounded, Veteran, Hardcore, Night-Owl, Early-Bird, Marathon, Decorated, Swift, Stubborn, Bite-Sized, Patient, Daily, Loyal, Curious, Weekend, Lunch-Break, Sneaky, Seasoned, Midnight, Moonlit, Sunrise, Binge, Deep-Focus, Never-Say-Die, *theme word*, Fresh.
- Auto noun: one-game noun (highest tier) if any; else the top family's highest tier if it qualifies; else the highest "bit of everything" tier; else Newcomer.

- [ ] **Step 1: Write the failing tests** in `tests/titles.test.ts`, building `GameStats` fixtures with a small helper `game(slug, family, { played, won, drawn, lost, versus, bestTime, levels, history, timeMs })`:
  - `brand-new player`: all games `played: 0`, empty earned → `autoTitle` = `{ adj: 'Fresh', noun: 'Newcomer' }`, `formatTitle` = `'The Fresh Newcomer'`; `titleWords` adjectives end with `['Breezy', 'Fresh']` for theme `mist`; no `NaN` in any computed word list (lists contain only strings).
  - `family tiers`: 120 of 200 games in `sky` → nouns include `Challenger` and `Tactician`, not `Strategist`; auto noun `Tactician`.
  - `one game wins the noun`: sudoku 90 of 200 games (sudoku also in `blue` at 45%) → auto noun `Sudoku Fan`; nouns also include `Number Cruncher`.
  - `bit of everything`: 25 games tried, no family above 35%, top family below 15% → auto noun `All-Rounder`.
  - `night owl`: 30 history entries, 15 ending at 23:00 local → adjectives include `Night-Owl`, `Midnight`, `Moonlit`; auto adj `Night-Owl` when nothing above it qualifies.
  - `priority`: earned `giant-slayer` plus night-owl history → auto adj `Giant-Slaying`.
  - `stubborn`: 60 versus games, 10 won → `Stubborn` and `Never-Say-Die` offered.
  - `theme word follows the theme`: theme `clay` → adjectives include `Squishy`, not `Breezy`.
  - `current pick stays offered`: player no longer qualifies for `Night-Owl`, `titleWords(input, { adj: 'Night-Owl', noun: 'Strategist' })` includes both words.

- [ ] **Step 2: Run to verify they fail**

  Run: `node --test tests/titles.test.ts`
  Expected: FAIL (cannot find module `src/shared/titles.ts`).

- [ ] **Step 3: Implement `titleWords`, `autoTitle`, `formatTitle` in `src/shared/titles.ts`** per the rules above. Compute shared facts once (totals, shares per family/game, hour/day shares, medians) in a private `facts(input)`; every ratio guards a zero denominator by treating the rule as not met.

- [ ] **Step 4: Run to verify they pass**

  Run: `node --test tests/titles.test.ts && npm test`
  Expected: PASS, and the existing suites still pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/shared/titles.ts tests/titles.test.ts
  git commit -m "feat(profile): personality title rules"
  ```

---

### Task 2: Storing and syncing the title

**Files:**
- Modify: `src/shared/sync/merge.ts` (`Kind`, `kindOf`, `mergeItem`)
- Modify: `src/shared/titles.ts` (add parse/serialise)
- Create: `src/shared/title-store.ts`
- Test: `tests/merge.test.ts`, `tests/titles.test.ts`

**Interfaces:**
- Consumes: `Title`, `formatTitle` (Task 1).
- Produces:
  ```ts
  // titles.ts (pure)
  export type StoredTitle = ({ auto: true } | { adj: string; noun: string }) & { at: number };
  export function parseTitle(raw: string | null): StoredTitle | null
  // title-store.ts (storage)
  export const TITLE_KEY = 'games.title';
  export function loadTitle(): StoredTitle | null
  export function saveTitle(t: Title | 'auto'): void   // writes { ..., at: Date.now() } through localStorage, so sync queues it
  ```

- [ ] **Step 1: Write the failing tests**
  - `tests/merge.test.ts`: `which keys sync` gains `'games.title'` (its `kindOf` is `'title'`); new test `title: the later pick wins, either order` — `merge('games.title', {adj:'A',noun:'B',at:5}, {auto:true,at:9})` → `{auto:true,at:9}`, swapped arguments give the same; equal `at` with different values gives the same result both ways; `merge(x, x)` is `x`.
  - `tests/titles.test.ts`: `parseTitle rejects junk` — `null`, `'oops'`, `'{"adj":1,"noun":"x","at":1}'`, `'{"auto":true}'` (no `at`) → `null`; `'{"adj":"Zen","noun":"Puzzler","at":3}'` and `'{"auto":true,"at":3}'` parse.

- [ ] **Step 2: Run to verify they fail**

  Run: `npm test`
  Expected: FAIL in the two new tests and `which keys sync`.

- [ ] **Step 3: Implement**
  - `merge.ts`: add `'title'` to `Kind`; `kindOf('games.title')` → `'title'` (checked before the generic pattern, like `games.badges`); merge rule: larger numeric `at` wins; on a tie the value whose `canon()` sorts higher wins. Update the header comment's rule list (`title  the later pick`).
  - `titles.ts`: `parseTitle` validates shape (strings non-empty, `at` finite number).
  - `title-store.ts`: thin wrapper over `localStorage` with `parseTitle`.

- [ ] **Step 4: Run to verify they pass**

  Run: `npm test`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/shared/sync/merge.ts src/shared/titles.ts src/shared/title-store.ts tests/merge.test.ts tests/titles.test.ts
  git commit -m "feat(profile): store the chosen title and sync it"
  ```

---

### Task 3: Move the theme picker and install button out of the home page

**Files:**
- Create: `src/shared/themepicker.ts`, `src/shared/install.ts`
- Modify: `src/main.ts` (remove `setupInstallButton`, `setupThemePicker` and their calls), `index.html` (remove `#install-btn`, `#theme-btn`, `#theme-dialog`; person icon `href="/profile/index.html"`)
- Modify: `scripts/theme-gate/picker.mjs` (check the profile's inline grid instead of the home dialog: every swatch reachable by scrolling at 320×568)

**Interfaces:**
- Produces:
  ```ts
  export function mountThemePicker(grid: HTMLElement): void  // fills `grid` with the .theme-opt radios (same markup, classes and aria as today), applies a pick at once
  export function setupInstallButton(btn: HTMLButtonElement): void // today's behaviour, moved; leaves btn hidden when standalone or on native
  ```

- [ ] **Step 1: Move the code** into the two modules unchanged in behaviour; `mountThemePicker` no longer knows about a dialog. Keep `.theme-grid`/`.theme-opt` styles in `src/style.css` (themes' `tokens.css` keys off `.theme-opt`).
- [ ] **Step 2: Remove the home top bar's Install and Theme buttons and the theme dialog**; the person icon's `aria-label` becomes "Profile".
- [ ] **Step 3: Verify**

  Run: `npx tsc --noEmit -p . && npm test`, then open `http://localhost:5173/` in each of Mist, Terminal and Pocket (set `localStorage['games.theme']`).
  Expected: type check clean, tests pass, the top bar shows only the person icon, no console errors. (`picker.mjs` is run in Task 8 once the profile exists.)
- [ ] **Step 4: Commit**

  ```bash
  git add src/shared/themepicker.ts src/shared/install.ts src/main.ts index.html scripts/theme-gate/picker.mjs
  git commit -m "refactor(home): theme picker and install move to shared modules"
  ```

---

### Task 4: Per-game leaderboards

**Files:**
- Create: `src/shared/leaderboard/board.ts` (rendering + loading, moved from `src/leaderboard/main.ts`), `src/shared/leaderboard/button.ts`
- Modify: `src/pwa.ts` (signed-in branch also imports `./shared/leaderboard/button` → `initLeaderboardButton()`), `src/base.css` (the `.lb-*` table, variant and status styles move here from `src/leaderboard/style.css`, without the page-only rules)
- Replace: `leaderboard/index.html` with a redirect page (see Task 7's redirect markup) to `/profile/index.html`; delete `src/leaderboard/main.ts` and `src/leaderboard/style.css`
- Create: `scripts/check-leaderboard.mjs`

**Interfaces:**
- Consumes: `getBoard`, `ApiError`, `Board` (`src/shared/sync/api.ts`); `hasBoard`, `formatValue` (`src/shared/leaderboard/games.ts`).
- Produces:
  ```ts
  // board.ts
  export function openBoard(game: string): void // opens (creating once) a dialog.dialog.lb-dialog with variant buttons, the top-50 .summary.lb-table, the "you" row, own rank line, status line, and a Done button
  // button.ts
  export function initLeaderboardButton(): void // on a game page whose slug hasBoard(): inserts <button class="btn history-link lb-btn"><span>Leaderboard</span></button> after #history-btn, or after the How to play link (a.history-link[href^="/howto/"]) when there is no #history-btn; click → openBoard(slug)
  ```

- [ ] **Step 1: Write the browser check** `scripts/check-leaderboard.mjs` (playwright-core, `PLAYWRIGHT_CHROMIUM`, dev server URL as in `scripts/theme-gate/capture.mjs`; API routed to a stub per case). Assertions:
  - signed out on `/sudoku/`: no `.lb-btn`.
  - signed in on `/sudoku/`: `.lb-btn` right after `#history-btn`; click → dialog open, table has the stub's 3 rows, the `you` row has class `you`, variant buttons show the stub's variants.
  - signed in on `/qubo/`: `.lb-btn` right after the How to play link.
  - signed in on `/chess/` (no board): no `.lb-btn`.
  - stub returns 500 → dialog shows a status line, table hidden; stub returns `entries: []` → "No one is on this board yet. Play a game while signed in to take the first place."
- [ ] **Step 2: Run it to verify it fails**

  Run: `node scripts/check-leaderboard.mjs`
  Expected: FAIL (no `.lb-btn`).
- [ ] **Step 3: Implement** `board.ts` (rendering and the request-token guard moved from `src/leaderboard/main.ts`, inside a dialog built in JS, families' ink from the page) and `button.ts`; wire `pwa.ts`; move styles; replace the leaderboard page with the redirect; update links: `stats/index.html` footer and the profile's account copy (Task 7) say "each game's leaderboard" without a link.
- [ ] **Step 4: Run to verify it passes**

  Run: `node scripts/check-leaderboard.mjs && npx tsc --noEmit -p .`
  Expected: all assertions pass; type check clean.
- [ ] **Step 5: Commit**

  ```bash
  git add src/shared/leaderboard src/pwa.ts src/base.css leaderboard/index.html scripts/check-leaderboard.mjs stats/index.html
  git rm src/leaderboard/main.ts src/leaderboard/style.css
  git commit -m "feat(leaderboard): a Leaderboard button on each game's menu"
  ```
- [ ] **Step 6: Review-focus check (5)**: in the same script, also stub an opted-out caller (`me: null`, the player absent from entries) → the board renders without an own-rank line and without errors. Run again; expected PASS.

---

### Task 5: The profile page, overview and badges strip

**Files:**
- Create: `profile/index.html`, `src/profile/main.ts`, `src/profile/overview.ts`, `src/profile/style.css`
- Modify: `vite.config.ts` (add `'profile'` to `games`; stage without the proxy hunk), `src/stats/main.ts` + `stats/index.html` + `src/stats/style.css` (remove totals, `#activity` and its renderers; back button → `/profile/index.html`; footer → "Back to your profile"), `badges/index.html` + `src/badges/main.ts` (back → profile; drop "hidden" comments and copy), `src/shared/badges.ts` (`found-stats` desc "Open your full stats", `found-badges` desc "Open the badges page", both without `secret`; header comment updated), `src/stats/main.ts` and `src/badges/main.ts` header comments.
- Create: `scripts/check-profile.mjs`

**Interfaces:**
- Consumes: `loadCatalog`, `collectGame`, `gamesPerDay`, `streaks`, `byHour` (`gamestats.ts`); `allBadges`, `catalog`, `checkBadges`, `loadEarned`, `buildCtx` (`badges.ts`); `medal` (`celebrate.ts`).
- Produces:
  ```ts
  // overview.ts (moved from src/stats/main.ts, same output)
  export function renderCalendar(el: HTMLElement, perDay: Map<string, number>, weeks: number): void
  export function renderHours(el: HTMLElement, all: GameStats[]): void
  export function renderTop(el: HTMLElement, all: GameStats[]): void
  export function renderHighlights(el: HTMLElement, all: GameStats[], longest: number): void
  export function duration(ms: number): string
  // main.ts exports nothing; it builds the page and keeps `all: GameStats[]` and the TitleInput for Task 6
  ```
- Page structure (ids the later tasks use): `main.screen.profile.ink-blue` > `header.topbar` ("Profile") > `section#banner.panel.profile-banner` (`.profile-avatar`, `#profile-name`, `#profile-title` button, `.stat-tiles` with `#tile-games`, `#tile-time`, `#tile-streak`, `#tile-badges`) > `div#overview.profile-grid` (`.panel` cards: `#calendar`, `#hours`, `#top`, `#highlights`, `#badge-strip` with "All badges" → `/badges/`, a "Full stats" link → `/stats/`) > `p#overview-empty` (hidden) > `p#overview-error` (hidden) > `div#settings` (Task 7).

- [ ] **Step 1: Write the browser check** `scripts/check-profile.mjs` (same setup as Task 4's script; seeds saves through the page with `localStorage.setItem` so they are sealed). Assertions for this task:
  - fresh device: banner tiles read `0`, `#overview-empty` visible with "Play a few games and your stats appear here", no `NaN` in `document.body.innerText`.
  - seeded 40 sudoku history entries: `#calendar` has cells with levels, `#top` lists Sudoku, `#tile-games` reads `40`.
  - `/stats/` has no `#calendar`, `#hours`, `#top`, `#highlights` and still lists every game.
  - `/badges/` has no "Secrets" heading; Snoop reads "Open your full stats".
  - width 1280: `#overview` lays out in ≥ 2 columns (two `.panel` children share a `top`); width 360: one column, no horizontal scroll (`scrollWidth <= innerWidth`).
- [ ] **Step 2: Run it to verify it fails**

  Run: `node scripts/check-profile.mjs`
  Expected: FAIL (404 on `/profile/`).
- [ ] **Step 3: Implement** the page: move the four renderers and `duration`/`clock` helpers into `overview.ts` (stats page keeps only what `renderGames`/`showGame` use); the calendar shows 17 weeks below 720px and 26 from 720px; badges strip = up to 6 newest earned medals then up to 4 locked ones in `allBadges` order; `.panel` defined in `src/base.css` as the shared static surface (`background: var(--sheet); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 14px 16px`). `profile/style.css` imports `'../style.css'` (theme picker and game-card styles) and holds the layout: `.profile` `max-width: 960px`, `.profile-grid` CSS grid one column, `repeat(2, 1fr)` from 720px with the calendar spanning both.
- [ ] **Step 4: Run to verify it passes**

  Run: `node scripts/check-profile.mjs && npx tsc --noEmit -p . && npm test`
  Expected: PASS.
- [ ] **Step 5: Commit**

  ```bash
  git add profile src/profile scripts/check-profile.mjs src/base.css src/stats stats badges src/badges src/shared/badges.ts
  git add -p vite.config.ts   # the 'profile' entry only, not server.proxy
  git commit -m "feat(profile): profile page with the stats overview and badges"
  ```
- [ ] **Step 6: Review-focus check (3)**: add to `check-profile.mjs`: route `**/index.html` (the catalog fetch from `loadCatalog`) to fail after the page loads → `#overview-error` reads "Stats need the games list, which could not be loaded. Try again online." and `#settings` is still present. Run; expected PASS. Commit with the script.

---

### Task 6: The title in the banner and its picker

**Files:**
- Create: `src/profile/title.ts`
- Modify: `src/profile/main.ts`, `profile/index.html` (the picker `dialog.dialog#title-dialog`), `src/profile/style.css`, `scripts/check-profile.mjs`

**Interfaces:**
- Consumes: `titleWords`, `autoTitle`, `formatTitle`, `TitleInput`, `Title` (Task 1); `loadTitle`, `saveTitle` (Task 2); `buildCtx`, `loadEarned`, `allBadges` (badges.ts); `getTheme` (theme.ts).
- Produces: `export function initTitle(button: HTMLButtonElement, getInput: () => TitleInput): void` — renders `formatTitle(stored ?? auto)`, opens the picker on click, re-renders on `games:synced`.

- [ ] **Step 1: Add assertions** to `check-profile.mjs`: fresh device title "The Fresh Newcomer"; click `#profile-title` → dialog lists adjective and noun chips (`button[aria-pressed]`), choosing `Breezy` + `Newcomer` updates the live preview and, after Done, the banner; `localStorage['games.title']` parses with `adj: 'Breezy'`; "Pick for me" stores `{ auto: true }`.
- [ ] **Step 2: Run to verify it fails**

  Run: `node scripts/check-profile.mjs`
  Expected: FAIL at the title assertions.
- [ ] **Step 3: Implement** `title.ts`: the picker shows a live preview heading, two chip groups (adjectives, nouns) from `titleWords(input, current)`, "Pick for me", Done. Chips reuse `.btn` with `aria-pressed` (as the leaderboard variant buttons do). Saving calls `saveTitle`.
- [ ] **Step 4: Run to verify it passes**

  Run: `node scripts/check-profile.mjs && npx tsc --noEmit -p .`
  Expected: PASS.
- [ ] **Step 5: Review-focus check (4)**: in `check-profile.mjs`, signed in with the fake sync server, put `games.title` = `{adj:'Zen',noun:'Puzzler',at:<now+1000>}` on the server, dispatch `online` → banner reads "The Zen Puzzler" without a reload. Run; expected PASS.
- [ ] **Step 6: Commit**

  ```bash
  git add src/profile profile scripts/check-profile.mjs
  git commit -m "feat(profile): personality title and picker"
  ```

---

### Task 7: Settings: appearance, install and account

**Files:**
- Create: `src/profile/account.ts` (moved from `src/account/account.ts`)
- Modify: `profile/index.html` (`#settings`: `section#appearance` with `div#theme-grid.theme-grid`; `section#install` with `button#install-btn.btn.btn-primary`; `section#account-in` = today's account cards and three dialogs; `section#account-out` = one `.panel` with "Sign in to sync your progress across devices", links `.btn.btn-primary` "Sign in" → `/signin/index.html`, `.btn` "Create account" → `/signup/index.html`), `src/profile/main.ts`, `src/profile/style.css` (the account card and field styles it needs move from `src/account/style.css`; sign-in pages keep theirs)
- Replace: `account/index.html` with the redirect page; delete `src/account/account.ts`
- Modify: `src/account/ui.ts` (`leaveIfSignedIn` and `finishSignIn` go to `/profile/index.html`), `vite.config.ts` page list unchanged (`account` stays as the redirect page)
- Modify: `scripts/check-profile.mjs`

Redirect page markup (also used by Task 4), the whole `<body>` being:
```html
<script>location.replace('/profile/index.html' + location.search)</script>
<p><a href="/profile/index.html">Your profile</a></p>
```
with the usual `<head>` (charset, viewport, `noindex`, `<meta http-equiv="refresh" content="0; url=/profile/index.html">`).

**Interfaces:**
- Consumes: `mountThemePicker`, `setupInstallButton` (Task 3); `isSignedIn` (`sync/session.ts`).
- Produces: `export function initAccount(): void` — today's account behaviour bound to the same element ids, minus the signed-out redirect; on `games:auth` sign-out the page swaps to `#account-out` instead of redirecting.

- [ ] **Step 1: Add assertions** to `check-profile.mjs`: signed out → `#account-out` visible, `#account-in` hidden, sign-in link present; signed in (stub `/account` and `/account/sessions`) → email, name field, sync line, "Show me on leaderboards", devices, the three security buttons; `#theme-grid` has 13 `.theme-opt` and clicking Terminal sets `document.documentElement.dataset.theme === 'terminal'`; `/account/index.html` lands on `/profile/index.html`; `/leaderboard/index.html` lands on `/profile/index.html`.
- [ ] **Step 2: Run to verify it fails**

  Run: `node scripts/check-profile.mjs`
  Expected: FAIL at the settings assertions.
- [ ] **Step 3: Implement**; the banner name uses `loadSession()?.user.displayName`; whenever it's known it is also kept in `localStorage['games.name']` (not a sync key), so after signing out with "Keep progress" the banner still shows it; with neither, "You". "Remove it" on sign-out also removes `games.name`. Add an assertion for both cases to `check-profile.mjs`.
- [ ] **Step 4: Run to verify it passes**

  Run: `node scripts/check-profile.mjs && node scripts/check-leaderboard.mjs && npx tsc --noEmit -p . && npm test`
  Expected: PASS.
- [ ] **Step 5: Commit**

  ```bash
  git add profile src/profile src/account account scripts/check-profile.mjs
  git rm src/account/account.ts
  git commit -m "feat(profile): appearance, install and account settings"
  ```

---

### Task 8: Theme every new piece in all 13 themes

**Files:**
- Modify: `src/themes/{linen,sage,graph,block,pocket,midnight,brutal,terminal,blueprint,clay,felt,news}.css`, `src/themes/lists.css` if a list theme needs it
- Modify: `scripts/theme-gate/capture.mjs` (add screens `profile` signed out, `profile-in` signed in with seeded saves, `stats`, a game menu with the Leaderboard button; add `--width` defaulting to the current phone width, and run at `1280` too)

- [ ] **Step 1: Capture the baseline**

  Run: `node scripts/theme-gate/capture.mjs --out /tmp/profile-shots --themes mist,linen,sage,graph,block,pocket,midnight,brutal,terminal,blueprint,clay,felt,news` then again with `--width 1280` and with `--scheme dark`.
  Expected: screenshots for every theme; the contrast check passes for the new screens or lists failures.
- [ ] **Step 2: Add rules** so the new pieces take each theme's character: put `.panel` everywhere a theme styles `.summary` or `.gotd-card` as a surface (border, radius, shadow, texture, background), and style `.profile-banner`, `.stat-tiles`, `.profile-avatar`, `#profile-title` (a chip), `.calendar`/`.hours` cells, `.badge-strip`, the title picker chips and `.lb-dialog` where the theme's tokens alone don't match its other pieces (Terminal's brackets and monospace boxes, Pocket's stepped corners, Blueprint's outlines, Newsprint's rules and halftone, Brutal's black borders and hard shadows, Graph Paper's pen outlines, Felt's card stock, Block Party's flat fields).
- [ ] **Step 3: Re-capture and compare** every theme's profile, stats and game-menu screenshots with its home screenshot at both widths, light and dark.
  Expected: in each theme the profile's cards look like that theme's home tiles and dialogs (same edges, corners, depth and type); no unstyled white boxes; no contrast failures.
- [ ] **Step 4: Run the existing gate checks**

  Run: `node --test "scripts/theme-gate/*.test.mjs" && node scripts/theme-gate/picker.mjs && node scripts/theme-gate/primary.mjs terminal && node scripts/theme-gate/brutal.mjs && node scripts/theme-gate/terminal.mjs`
  Expected: PASS (picker.mjs now checks the profile's inline grid).
- [ ] **Step 5: Commit**

  ```bash
  git add src/themes scripts/theme-gate
  git commit -m "feat(themes): theme the profile, title picker and leaderboard dialog"
  ```

---

### Task 9: Docs and final verification

**Files:**
- Modify: `DESIGN.md` ("Account pages" → "Profile and account pages": the profile layout, `.panel`, banner, title chip and picker, leaderboard button and dialog; "Themes": the picker lives on the profile), `README.md` (page list: profile; leaderboard and account are redirects; stats and badges are linked, not hidden), `CHANGELOG.md` (Unreleased → Added: profile page, personality titles, per-game leaderboards; Changed: stats overview moved, stats and badges no longer secret, Install and Theme moved to the profile, leaderboards need an account)

- [ ] **Step 1: Write the docs** above.
- [ ] **Step 2: Full verification**

  Run: `npx tsc --noEmit -p . && npm test && npm run build && node scripts/check-profile.mjs && node scripts/check-leaderboard.mjs`, then the two sync browser checks from the sync fix still pass (open a game on two signed-in contexts; the "Continue from other device" button still appears under Continue).
  Expected: everything passes; the build lists `profile` and no `src/leaderboard` chunk.
- [ ] **Step 3: Commit and merge into dev**

  ```bash
  git add DESIGN.md README.md CHANGELOG.md
  git commit -m "docs: profile page, titles and per-game leaderboards"
  git checkout dev && git merge --no-ff feat/profile
  ```
