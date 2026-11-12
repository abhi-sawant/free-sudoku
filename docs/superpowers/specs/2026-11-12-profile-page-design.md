# Profile page, personality titles and per-game leaderboards

## Intent

Accounts (5.0.0) added an `account/` page that is only a settings page, only reachable signed in, and drawn in the
480px phone column on every screen size. Stats and badges live on two "hidden" pages that nothing links to, and the
leaderboards are one page where you first pick a game.

The owner wants one place that is about *you*: how you play, what you've earned, and a fun title that describes your
play style, with settings underneath. It should be there for everyone, signed in or not, look right on desktop, and
look like it belongs in whichever of the 13 themes the player uses.

The title is the playful centre: a generated "The [how you play] [what you play]" that the player can change, and that
follows them to every device once synced.

## Goals

1. A **profile page** at `/profile/`, opened from the person icon on the home page, for signed-in and signed-out
   players alike.
2. **Personality titles** from the player's own data, chosen automatically, changeable by the player, synced.
3. The stats overview moves from the stats page to the profile; the stats page keeps the per-game list.
4. Stats and badges stop being secret: the profile links to both.
5. **Leaderboards per game**: a Leaderboard button on each game's menu (next to How to play and History & stats) that
   shows that game's board directly. Shown only when signed in, and only for games that have a board. The standalone
   `/leaderboard/` page and its game picker go away.
6. The **Install** and **Theme** buttons move from the home page's top bar to the profile.
7. Everything new is themed in all 13 themes, not just recoloured.

## Non-goals

- No overall / cross-game leaderboard or XP system (there's no shared score across games).
- No title on the leaderboards or anywhere outside the profile.
- No change to how stats, badges or bests are counted, or to the badge list (apart from the two discovery badges, below).
- No change to the backend apart from what syncing the title needs (it needs nothing: see "Syncing the title").
- No change to sign in, sign up, forgot password, or the sync engine beyond adding the title's merge rule.

## Anti-goals (a failure even if it technically works)

- A profile that only looks designed in Mist: any theme where the new parts look like an unstyled page dropped into a
  themed site (the current stats page's sheets are the example to avoid).
- Titles that read as mean or try-hard. "Stubborn" is the limit of teasing.
- Signed-out players seeing account settings, or a profile that nags them to sign in. One quiet card is enough.
- A desktop profile that is still a 480px strip in the middle of the screen.
- Losing a badge someone already earned.

## Starting point

The "Continue from other device" sync fix (uncommitted at the time of writing: `src/shared/sync/current.ts`,
`othergame.ts`, `tests/current.test.ts` and edits to `engine.ts`, `api.ts`, `pwa.ts`, `base.css`, `DESIGN.md`) is
committed first, on its own. This work starts from that base, and `othergame.ts` is the pattern for the leaderboard
button.

## Constraints

- Mist design language (DESIGN.md); shared tokens and components from `src/base.css`; no new colours, fonts, borders or
  shadows. The profile, stats, badges and account pages use the blue ink and have no category (as "Account pages" in
  DESIGN.md).
- Themes restyle shared components; a page never names a theme. New components get per-theme rules in each theme's
  character file (`src/themes/*.css`), the same way the home and game components do.
- Works offline. Signed out, nothing leaves the device.
- Every page loads `src/pwa.ts` (seal layer) before reading storage.
- Phone first: one column on narrow screens; the wider layout applies from tablet width up.

## The profile page

### Layout (option C from the mockups, the owner said any layout works)

Top to bottom:

1. **Top bar**: back to all games, title "Profile".
2. **Banner**: an initial in a circle, the player's name, their **title** (tap to change), and headline numbers: games
   played, time played, current streak, badges earned (n of N).
   - Signed out, the name is "You" (or the name they last had on this device if they signed out keeping progress).
3. **Card grid** (the overview that moves off the stats page):
   - Activity calendar (the current stats page's "Last 17 weeks"; on desktop it may show more weeks to fill the width).
   - Time of day.
   - Top games.
   - Highlights.
   - Badges strip: recently earned medals and the next few to earn, "All badges" → `/badges/`.
   - "Full stats" → `/stats/` (the per-game list).
   - Empty state when nothing has been played yet: the current stats page's "Play a few games and your stats appear
     here" message, and the title "The Fresh Newcomer".
4. **Settings**:
   - **Appearance**: the theme picker drawn inline on the page (the same swatches the home dialog draws today), not in
     a dialog.
   - **Install**: the current Install button and behaviour (`setupInstallButton` in `src/main.ts`), web only, hidden
     once installed.
   - **Account**, signed in: everything the current account page has, unchanged in behaviour: email and name, sync
     status and Sync now, "Show me on leaderboards", signed-in devices, change password, sign out, delete account, and
     their dialogs.
   - **Account**, signed out: one card, "Sign in to sync your progress across devices", with Sign in and Create account.

On narrow screens everything is one column. On wide screens the page is wider than the 480px column (around 960px) and
the card grid uses two or three columns; settings sit below the grid, also in columns where it helps.

### Routes and links

- New page `profile/index.html` + `src/profile/` (main script and stylesheet importing `base.css`).
- The home page's person icon links to `/profile/`.
- `/account/` stays as a URL and redirects to `/profile/` (bookmarks, the Android app, and `leaveIfSignedIn` /
  `finishSignIn` in `src/account/ui.ts`, which should now go to `/profile/`).
- Sign-in, sign-up and forgot pages are unchanged apart from where they send you afterwards.
- Add `profile` to the page list in `vite.config.ts` (and drop `account` and `leaderboard` once they are gone or
  redirect-only; a redirect page can stay a tiny HTML file).

### Home page

- Remove `#install-btn` and `#theme-btn` (and the theme dialog) from the home top bar. Only the person icon stays.
- Theme-picking code moves to (or is shared with) the profile.

## Stats and badges pages

- **Stats page** loses totals, activity calendar, time of day, top games and highlights (they are on the profile). It
  keeps the list of every game and the per-game dialog. Its title stays "Your stats"; its back button goes to the
  profile. Its footer links to the profile instead of the leaderboard page.
- **Badges page**: unchanged apart from its back button going to the profile and the "hidden page" copy being dropped.
- Both lose `<meta name="robots" content="noindex">`'s "hidden" comment (they're linked now; keeping `noindex` is fine).
- **The two discovery badges** stay, so nobody loses one, but are no longer secret and get plain descriptions:
  - `found-stats` ("Snoop"): description becomes "Open your full stats".
  - `found-badges` ("Badge hunter"): description becomes "Open the badges page".
  - Ids and names stay, so earned badges keep showing as earned.
  - Remove `secret: true` from both. The badges page's "Secrets" group then disappears (it's empty).

## Personality titles

A title is **"The [adjective] [noun]"**. Adjectives say how you play; nouns say what you play. Each word unlocks from
data the device already has (`gamestats.ts`, `badges.ts`, `games.theme`, bests). The full lists below were approved by
the owner.

### Nouns: what you play

Shares are of finished games, across all games, from the merged history.

| Category | Nouns at 10 / 100 / 500 games in that category | Unlocks when |
|---|---|---|
| Number puzzles | Number Cruncher · Numerist · Grid Sage | 15%+ of your games |
| Logic puzzles | Puzzler · Logician · Mastermind | 15%+ |
| Number tiles | Tile Pusher · Merger · Tile Tycoon | 15%+ |
| Play the computer | Challenger · Tactician · Strategist | 15%+ |
| Cards | Card Player · Card Shark · Dealer | 15%+ |
| Word games | Word Nerd · Wordsmith · Lexicographer | 15%+ |
| Dice games | Dice Roller · High Roller · Dice Whisperer | 15%+ |
| Arcade | Button Masher · Arcade Ace · Speedrunner | 15%+ |
| One game | [Game] Fan · [Game] Devotee · [Game] Legend (game's home name) | That game is 40%+ of your games |
| A bit of everything | Wanderer · All-Rounder · Polymath | No category above 35%, and 10 / 20 / every game tried |
| Just starting | Newcomer | Always available |

A category noun unlocks only its highest reached tier (10 games → first word, 100 → second, 500 → third); lower tiers
of the same category stay available too.

### Adjectives: how you play

| Adjectives | Group | Unlocks when |
|---|---|---|
| Night-Owl · Midnight · Moonlit | Time | 40%+ of games finished 10pm–4am (local time) |
| Early-Bird · Sunrise | Time | 30%+ finished 5–9am |
| Lunch-Break | Time | 30%+ finished 12–2pm |
| Weekend | Time | 60%+ finished on Saturday or Sunday |
| Daily | Habit | A 7-day streak, now or ever |
| Relentless | Habit | A 30-day streak |
| Marathon · Binge | Habit | 20+ games finished in one day |
| Bite-Sized | Habit | Median game under 3 minutes, 50+ games |
| Patient · Deep-Focus | Habit | Median game over 15 minutes, 20+ games |
| Lightning | Skill | A timed puzzle solved in under a minute (the `quick` badge's rule) |
| Swift | Skill | Median puzzle win time in the fastest third of that level's times *(builder: if there is no fair baseline, use "median timed win under 3 minutes, 20+ timed wins")* |
| Ruthless | Skill | 70%+ wins against the computer, 20+ versus games |
| Giant-Slaying | Skill | Beat the computer on Hard (the `giant-slayer` badge) |
| Hardcore | Skill | 30%+ of puzzles played on a game's top level |
| Stubborn · Never-Say-Die | Skill | Under 40% wins with 50+ games that have a result |
| Big-Number | Score | 2048 in 2048, 1M in 2248, or 2K in Halo (any of those badges) |
| High-Scoring | Score | Signed in, and in the top 50 of any leaderboard (only if known without extra requests; otherwise leave it out) |
| Curious | Variety | 20+ different games tried |
| Well-Rounded | Variety | Every game tried |
| Loyal | Variety | One game is 40%+ of your games |
| Decorated · Gilded | Badges | Half / 90% of badges earned |
| Sneaky | Badges | Both discovery badges earned (they replace "every secret badge", since there are no secret badges left) |
| Seasoned · Veteran · Legendary | Volume | 10 hours / 500 games / 1,000 games |
| Fresh | Volume | Always available |
| Breezy · Cosy · Zen · Doodling · Bold · Retro · Nocturnal · Brutal · Hacker · Blueprinted · Squishy · Parlour · Headline | Theme | Using Mist · Linen · Sage · Graph Paper · Block Party · Pocket · Midnight · Neo-brutalist · Terminal · Blueprint · Claymorphism · Felt & Wood · Newsprint |

### Picking automatically

- The **noun** defaults to the strongest: a one-game noun if one game is 40%+; else the top category's highest tier;
  else "A bit of everything" if it qualifies; else Newcomer.
- The **adjective** defaults to the rarest qualifying one, by a fixed priority order the builder defines (roughly:
  Legendary/Relentless/Gilded first, theme words and Fresh last), so the auto title reflects what's most distinctive.
- Recomputed whenever the profile opens, so it keeps up with play until the player picks their own.

### Changing it

- Tapping the title opens a picker (a `dialog.dialog`) with two lists: unlocked adjectives and unlocked nouns, the
  current title previewed live at the top, plus "Pick for me" to go back to automatic.
- The options are the words the player qualifies for now, plus their current pick (a chosen word never disappears just
  because the player stopped qualifying). Locked words are not shown.

### Syncing the title

- Stored in a new key, `games.title`: `{ "adj": "Night-Owl", "noun": "Strategist", "at": <epoch ms> }`, or
  `{ "auto": true, "at": ... }` for automatic.
- It's a synced key: add a `title` kind to `kindOf` in `src/shared/sync/merge.ts`, merged as "the larger `at` wins"
  (commutative and idempotent, like the rest), with tests in `tests/merge.test.ts`. The server already accepts any key
  matching its pattern, so no backend change.
- Signed out it stays on the device, like everything else.

## Per-game leaderboards

- A shared module (same approach as `src/shared/sync/othergame.ts`) adds a **Leaderboard** button after the game
  menu's "History & stats" button (`#history-btn`), styled like its neighbours (`.btn.history-link`), when the player is
  signed in and the game has a board (`hasBoard` in `src/shared/leaderboard/games.ts`). Signed out, or a game with no
  board: no button. Loaded from `pwa.ts` in the signed-in branch, next to the sync engine.
- Games whose menu has no `#history-btn` (Qubo today) get the button after their How to play link instead *(builder's
  call, settled during review)*.
- **This is a deliberate change**: boards are public today and `/leaderboard/` works signed out. The owner asked for the
  button to show only with an account linked, so signed-out players no longer see any board. The API stays public.
- Tapping it opens that game's board on the game page, without leaving it: the level buttons, top 50, the player's own
  row highlighted and their rank, reusing the rendering in `src/leaderboard/main.ts` (moved into a shared module).
  Presentation (dialog vs the game's history screen) is the builder's call; a `dialog.dialog` matches how the stats
  page shows a game.
- Remove `leaderboard/index.html` and `src/leaderboard/` once the shared version works; `/leaderboard/` redirects to
  `/profile/` or the home page. Update the links in the account copy ("each game's leaderboard") and the stats footer.
- The "Show me on leaderboards" switch stays in the profile's Account section.

## Theming

- Use the shared components wherever they fit, so existing theme rules apply: `.topbar`, `.btn`, `.btn-primary`,
  `.section-label`, `.dialog`, `.continue`-style tinted cards, `.history-link`, the home's game tiles on the stats page.
- New pieces (banner, stat tiles, the card grid's cards, calendar, time-of-day bars, badge strip, title chip, title
  picker, inline theme grid) get rules in each of the 12 character files where the theme changes shape, border, shadow
  or texture (Mist is `base.css`). Examples of what "themed" means: Neo-brutalist's black 2px borders and hard offset
  shadows; Terminal's bracketed, monospace, square boxes; Pocket's stepped corners; Blueprint's outline-only drafting
  look; Newsprint's rules and halftone tints; Felt & Wood's card stock.
- The existing account cards and stats sheets aren't themed today; anything of theirs that survives on the profile
  gets themed too.
- Check each theme, light and dark where it has both, at phone and desktop width, signed in and signed out, by
  screenshot.

## Docs

- DESIGN.md: replace "Account pages" with a "Profile and account pages" section covering the profile's components and
  the leaderboard button; note in "Themes" that the profile's components are themed; update "Themes" where it says the
  palette button is on the home page.
- README: the page list.
- CHANGELOG: the user-visible changes.

## Left to the builder

- Exact breakpoints, column counts and spacing within the Mist rules.
- Adjective priority order for the automatic pick.
- Whether the leaderboard opens in a dialog or a screen on the game page.
- How the theme picker code is shared between home (removed) and profile.
- Calendar length on desktop.
