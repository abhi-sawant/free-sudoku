# Design: Mist

Games is cool and airy: white tiles float on a pale blue-grey ground, with soft diffuse shadows, generous radii and no outlines. Text is blue-charcoal, never black. It replaced Graph Paper on 2026-11-03 after feedback that the black outlines, near-black-on-white text, printed grid and hatching were too harsh on the eyes. Every game, current and future, uses this one language; a family of games is told apart only by its **accent colour**.

All tokens and shared components live in [`src/base.css`](src/base.css). Game stylesheets import it and add only what their board needs. The prototypes (Linen, Mist, Sage) are in [`design-candidates/`](design-candidates).

## Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#eef2f7` | `#121825` | Page ground |
| `--sheet` | `#ffffff` | `#1a2233` | Tiles, boards, keys, dialogs |
| `--sunk` | `#e3e9f1` | `#0e1420` | Empty or finished cells |
| `--ink` | `#1f2a3a` | `#e6ebf5` | Text and printed marks |
| `--ink-2` | `#5a687c` | `#a2aec3` | Secondary text and notes |
| `--rule` | `#dbe2ed` | `#2b3650` | Hairlines inside a board |
| `--rule-2` | `#a3b0c4` | `#5b6a88` | Board frames and box lines (Sudoku 3x3) |
| `--note` | accent 14% on sheet | accent 22% on sheet | Selected state: cursor, Continue, a switched-on tool |
| `--shadow` | soft two-layer | soft lift | Buttons, tiles, keys, dialogs |

Body text is 11.6-14.8:1 on its ground, secondary text at least 5:1.

## Families

Each family has one accent (`--c`); no game picks its own. A new game joins the family that fits, or a new family gets an accent first.

| Family | Accent | Games |
|---|---|---|
| Number puzzles | `--blue` | Sudoku, Killer Sudoku, Kakuro, Calcudoku, Futoshiki, Skyscrapers, Jigsaw Sudoku, Sudoku X |
| Logic puzzles | `--orange` | Minesweeper, Nonograms, Takuzu, Nurikabe, Hitori, Star Battle, Lights Out, Tents, Light Up, Heyawake, LITS, Slitherlink, Masyu, Bridges, Flow, Water Sort |
| Number tiles | `--lilac` (indigo) | 2248, 2048, Threes, 15-puzzle, Sokoban, Rush Hour, Peg Solitaire |
| Play the computer | `--sky` (teal) | Tic-tac-toe, Dots and Boxes, Connect Four, Reversi, Gomoku, Nine Men's Morris, Checkers, Mancala, Ultimate Tic-tac-toe, Hex, Go, Chess, Backgammon, Battleship |
| Cards | `--olive` (green) | Klondike, FreeCell, Spider, Yukon, Canfield, Forty Thieves, Pyramid, TriPeaks, Golf |
| Word games | `--berry` (pink) | Word Guess, Word Search, Letter Wheel |
| Dice games | `--plum` (orchid) | Yacht, Farkle, Pig |
| Arcade | `--cocoa` | Crazy Cat |

Shared: `--coral` marks mistakes and the other side in two-player games, `--yellow` is the hint colour, `--teal` and `--mint` are accents. Light accents meet 4.5:1 on paper; dark-mode accents are light enough for `--on-ink`.

## The rules

1. **Tone, not lines.** Surfaces are told apart by tone and a soft shadow. No black outlines. The only strokes are hairlines in `--rule`, board frames in `--rule-2`, and a 1.5px ring in the accent for a switched-on tool or a focused cell.
2. **Soft fills, not hatching.** Pieces, discs and card backs are a tint of the family accent (about 42-60% over the surface), never 45-degree hatching.
3. **The accent marks state.** The cursor, a switched-on tool and Continue are the family accent at 14-24%. Section headings carry a small accent dot.
4. **Mistakes are coral.** A wrong entry is coral text on a faint coral tint.
5. **No tilt.** Nothing is rotated for charm; the page is straight.

## Type

Self-hosted from [`src/fonts/`](src/fonts) (Latin, OFL licence alongside): **Nunito** (variable, 200-1000) for everything. Titles and section labels are 800, body 500. Entries and counts are the same face at weight 700, in the family accent where one is set (`--pen-font` is now an alias of the UI face, kept so old rules parse; `.pen` just sets the weight). Timers and counts use `.mono` (tabular figures).

## Shape and depth

Radii: `--r-card` 22px, `--r-board` 14px, `--r-tile` 14px, `--r-key` 12px, `--wob` 16px (a plain radius now); pills 999px for the timer and chips. Touch targets are at least 44px. Elevation is `--shadow` only.

## Components (in `base.css`)

`h1.logo`, `a.back-link`, `button.btn.btn-primary.continue`, `div.levels > button.btn.level`, `header.topbar` with `button.timer`, `div.tools > button.tool`, `table.summary`, `dialog.dialog`. Buttons and tools are white tiles with `--shadow`; a switched-on tool takes `--note` and an accent ring.

## Boards

Boards sit on `--sheet` with a `--rule-2` frame and `--rule` hairlines. Printed givens are `--ink` at weight 700; entries are weight 600 in `--c`; notes are `--ink-2`. Card games print cards white with a `--rule-2` hairline, red suits in `--coral`, backs a plain accent tint with a white inner border, empty piles as dashed outlines. Value scales (2248, 2048) and per-game accents have not been retuned and may still be more saturated than the rest.

## Motion

Quick and physical: presses scale to 0.98 in 80ms. Everything respects `prefers-reduced-motion`.

## Adding a new game

1. **Pick a family** and use its accent. A new family needs an accent in `:root` and the dark block of `base.css`, a row above, an `.ink-<name>` class in `src/style.css` and a `section.family.ink-<name>` on the home page.
2. **Stylesheet.** `src/<game>/style.css` starts with `@import '../base.css';` and `:root { --c: var(--<accent>); }`, then only the board's own styles.
3. **Page.** Copy `minesweeper/index.html`. `theme-color` metas are `#eef2f7` and `#121825`; link the stylesheet from `<head>`.
4. **Home card.** Copy a `.game-card` into the family's section and draw its `.game-icon` as a 3x3 board.
5. **Check both themes** on a phone-sized screen.

## Rollout status

Every page uses Mist: base, home page and icons, and all game boards. Known leftovers:

- Game icons and some boards were converted mechanically from Graph Paper (hatching became tints, outlines became hairlines); individual boards may still need hand-tuning.
- 2248 tile digits are sized inline by `main.ts`; its hairline cells show a ragged edge from the `--tile` sizing.
- Dots and Boxes claimed boxes and Battleship hulls need `.ts` classes to be tinted as one piece.
