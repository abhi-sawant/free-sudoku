# Seven new themes

## Intent

The theme picker has six looks: Mist (default), Linen, Sage, Graph Paper, Block Party and Pocket. The owner wants more
choice, and wants every new theme to feel like a genuinely different place, not a recolour. "Different" has to be
measured, not asserted, because the easy failure here is seven themes that sit too close to the six already shipped or to
each other.

## Goals

- Add seven themes: **Neo-brutalist, Blueprint, Terminal, Felt & Wood, Midnight, Claymorphism, Newsprint**.
- Each is a whole design, as the existing six are: tokens, plus a character file with the layout, border, type, texture and
  board rules a token can't carry. A game never names a theme (see "Themes" in DESIGN.md).
- Each passes the distinctness gate below before the next is started.
- Everything still works offline, themed on first paint, on every page and every game board.

## Non-goals

- No change to Mist or the six existing themes' looks, apart from anything the gate shows needs fixing in a new theme.
- No per-game theming, no new game components, no change to how a theme is stored (`games.theme`).
- No theme is a colour-palette swap of another.

## Anti-goals (a failure even if it technically works)

- A new theme whose screens could be mistaken for an existing one at a glance.
- A theme that is only readable on some boards: every board state (selected, wrong, hint, solved, paused, empty) must be
  legible in every theme.
- Accents below 4.5:1 on `--paper`, or `--on-ink` below 4.5:1 on an accent (DESIGN.md).

## Constraints

- Follow "To add a theme" in DESIGN.md: a token block (light, and dark in the media query), a character file, an entry in
  `THEMES` in `src/theme.ts`, an import in `src/themes/index.css`. Tokens live in `src/themes/tokens.css`.
- Fonts are self-hosted OFL faces in `src/fonts/` with their licence alongside, and only the active theme's faces are
  fetched. At most two families per theme. Keep each new face small (Latin subset).
- Themes restyle the shared classes (`.board`, `.cell` states, `.pad-btn`, `.card`, `.slot`, `.die`, `.btn`, `.tool`,
  `.dialog`, `.timer`, `.icon-btn`, the home cards and the new rules dialog `.guide-dialog`). If a board has a state of its
  own, check it in the new theme.
- The picker (a dialog on the home page, `src/main.ts`) draws each option in its own colours with the `.theme-opt` half of
  each selector, and must hold 13 options.
- Do not bump the version in `package.json`.

## Decided

- **Always dark:** Midnight, Terminal and Blueprint have no light variant; both colour-scheme forms use the same dark
  tokens, because a light version would resemble other themes. The other four have light and dark forms.
- **Terminal is amber on black**, not green, so it can't be confused with Pocket.
- Order of work: Midnight, then Neo-brutalist, Terminal, Blueprint, Claymorphism, Felt & Wood, Newsprint (the riskiest
  last, and the one to drop if it measures too close to Linen).
- One theme per commit; the distinctness gate runs after each.

### Each theme's identity and what keeps it apart

| Theme | Identity | Nearest existing neighbour and the separator |
|---|---|---|
| Midnight | True-black ground, neutral greys, white ink, one vivid accent per family. Tiles are outlined, not filled, with a glow ring on the selected or active state. | Mist dark (navy, soft shadows): Midnight is pure black, hairline-outlined, glow instead of shadow. |
| Neo-brutalist | Cream paper, thick black borders, hard offset shadows with no blur, saturated flat fills, buttons that press down into their shadow, chunky grotesque type. | Block Party (flat primaries, bold lines): Block Party has no shadows at all; this has hard offset shadows, cream ground and a different type voice. |
| Terminal | Near-black, amber phosphor, monospace, scanlines, bracketed `[ ]` buttons, a blinking cursor on the selected thing; families told apart by a text tag or glyph, not hue. | Pocket (mono, green, pixel): amber on black, smooth monospace, scanlines and brackets, not pixel steps or dither. |
| Blueprint | Light lines on deep blue, a fine technical grid, precise (no wobble), uppercase mono labels, dimension ticks and corner brackets on boards. | Graph Paper (grid, blue lines): inverted (light on blue), exact, mono, not dark ink on white by hand. |
| Claymorphism | Inflated pastel "candy" tiles with an inset highlight and an inset shade plus a soft outer shadow, very large radii, a fat rounded face. | Mist and Sage (soft, round): the inset-bevel inflation, saturated pastel per family, bigger radii and a rounder face. |
| Felt & Wood | A dark green felt table with grain, wooden tiles and bevels, cream cards, tactile embossed shadows. | Sage (greens): felt texture, wood-grain surfaces and bevel depth, a darker and more skeuomorphic look than any existing theme. |
| Newsprint | Grey newsprint, black ink, halftone-dot tints, double column rules, uppercase small labels, a high-contrast display serif. | Linen (serif, ruled): strictly grey (no warm cream), halftone and double rules, a different serif. Closest pair; drop if it measures too close. |

## The distinctness gate

Run after each theme; a theme that fails is reworked before the next begins.

1. **Axes.** Score every theme, existing and new, on eight axes: ground (light/dark/hue), edges (none/hairline/outline/
   hard), depth (flat/soft shadow/hard shadow/bevel/glow), corners (square/stepped/soft/pill/puffy), type voice
   (sans/serif/mono/pixel/hand/rounded/grotesque), texture (none/grid/halftone/scanline/grain), home layout, and how
   families are told apart. The new theme must differ from every other theme on at least 4 axes and hold a value no
   other theme has on at least 2.
2. **Measured.** With Playwright, capture the same screens in every theme at phone width: home, a puzzle (Sudoku), a
   two-player board (Chess), a card game (Klondike), 2248 and the rules dialog. Compute a pairwise difference score per
   screen (for example a downscaled-pixel and colour-histogram distance). The threshold is the smallest score between
   any two of the six existing themes; a new theme closer than that to any other theme fails. Produce a contact sheet
   for the owner to look at.
3. **Legibility.** Check the board states in 1 for the new theme, and the two contrast ratios in anti-goals.

## Left to the builder

- Exact colours, radii and shadow values, within the identities above and the contrast rules.
- Which OFL faces to use, and the difference score's exact formula.
- How the 13-option picker lays out.
- The `THEMES` one-line note for each theme.
- Updating DESIGN.md's Themes table and the README line that lists the themes.
