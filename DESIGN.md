# Design: Graph Paper

Games looks like a puzzle notebook: a printed grid, clues in black type, your entries in ballpoint, pencil notes, a red pen for mistakes and a highlighter for the cursor. It replaced the Riso look on 2026-11-03. Every game, current and future, uses this one language. A family of games is told apart only by its **pen colour**.

All tokens and shared components live in [`src/base.css`](src/base.css). Game stylesheets import it and add only what their board needs. Candidate prototypes from the redesign are in [`design-candidates/`](design-candidates).

## Paper and pens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#fbfcff` | `#10151f` | Page ground, printed with a 20px grid (`--grid`) |
| `--sheet` | `#ffffff` | `#151b28` | Boards, keys, cards, dialogs |
| `--sunk` | `#eaf0f8` | `#0c1019` | Empty or finished cells |
| `--ink` | `#14171f` | `#e9edf6` | Printed text and every pen outline |
| `--ink-2` | `#555d70` | `#a0a9bf` | Pencil: secondary text and notes |
| `--rule` | `#b9cadd` | `#34445f` | Hairlines inside a board |
| `--on-ink` | `#ffffff` | `#10151f` | Text on a solid pen stroke |
| `--note` | yellow 62% on paper | yellow 22% on paper | Sticky-note fill: Continue, game of the day, a switched-on tool |

## Families

Each family writes in one pen (`--c`); no game picks its own. A new game joins the family that fits, or a new family gets a new pen first.

| Family | Pen | Games |
|---|---|---|
| Number puzzles | `--blue` (ballpoint) | Sudoku, Killer Sudoku, Kakuro, Calcudoku, Futoshiki, Skyscrapers, Jigsaw Sudoku, Sudoku X |
| Logic puzzles | `--orange` | Minesweeper, Nonograms, Takuzu, Nurikabe, Hitori, Star Battle, Lights Out, Tents, Light Up, Heyawake, LITS, Slitherlink, Masyu, Bridges, Flow, Water Sort |
| Number tiles | `--lilac` | 2248, 2048, Threes, 15-puzzle, Sokoban, Rush Hour, Peg Solitaire |
| Play the computer | `--sky` | Tic-tac-toe, Dots and Boxes, Connect Four, Reversi, Gomoku, Nine Men's Morris, Checkers, Mancala, Ultimate Tic-tac-toe, Hex, Go, Chess, Backgammon, Battleship |
| Cards | `--olive` | Klondike, FreeCell, Spider, Yukon, Canfield, Forty Thieves, Pyramid, TriPeaks, Golf |
| Word games | `--berry` | Word Guess, Word Search, Letter Wheel |
| Dice games | `--plum` | Yacht, Farkle, Pig |
| Arcade | `--cocoa` | Crazy Cat |

Shared pens: `--coral` is the red pen (mistakes, the other side in two-player games), `--yellow` the highlighter, `--teal` and `--mint` accents. Light pens meet 4.5:1 on paper; dark-mode pens are light enough for `--on-ink`.

## The rules

1. **Outlines are pen strokes.** Buttons, keys, tiles, dialogs and cards are drawn with a 2px `--ink` outline (`box-shadow: inset 0 0 0 2px`) and slightly uneven corners (`--wob`). Boards use a plain 3px ink rule. No drop shadows.
2. **What you write is handwriting.** Entries, pencil notes, pad digits, status lines, counts and margin notes are Caveat (`--pen-font`, `.pen`). Printed clues and UI are Hanken Grotesk.
3. **Highlighter marks state.** The cursor, a switched-on tool and Continue are yellow (`--note`). Headings are underlined with a swipe of the family's pen (`--swipe`). Row, column and box overprint in Sudoku is blue multiplied (screened at night).
4. **The red pen is for mistakes.** A wrong entry is circled in `--coral`, never filled.
5. **Hatching, not fills.** Discs and card backs are shaded with 45-degree pen hatching in the side's or family's pen.

## Type

Self-hosted from [`src/fonts/`](src/fonts) (Latin, OFL licences alongside): **Hanken Grotesk** (400-800) for UI, titles and printed clues; **Caveat** (400-700) for the pen layer. Section labels are sentence case at weight 800. Timers and counts use `.mono` (tabular figures).

## Shape and depth

Radii: `--r-card` 14px, `--r-board` 6px, `--r-tile` 12px, `--r-key` 8px; pills 999px for the timer and chips; `--wob` for hand-drawn buttons and tiles. Touch targets are at least 44px. `--shadow` is a no-op kept so old rules still parse; use no elevation, except a card being dragged.

## Components (in `base.css`)

Same markup as before: `h1.logo`, `a.back-link`, `button.btn.btn-primary.continue`, `div.levels > button.btn.level`, `header.topbar` with `button.timer`, `div.tools > button.tool`, `table.summary`, `dialog.dialog`. Only the skin changed.

## Boards

Boards sit on `--sheet` with a plain ink rule, hairlines in `--rule`. Printed givens are ink; entries are ballpoint in `--c`; pencil notes are `--ink-2`. Card games print cards white with an ink outline, red suits in `--coral`, backs cross-hatched in the family's pen, empty piles as dashed outlines. Value scales (2248, 2048) and per-game accents are unchanged for now and will be moved onto this language family by family.

## Motion

Quick and physical: presses scale to 0.98 in 80ms. Everything respects `prefers-reduced-motion`.

## Adding a new game

1. **Pick a family** and use its pen. A new family needs a pen in `:root` and the dark block of `base.css`, a row above, an `.ink-<name>` class in `src/style.css` and a `section.family.ink-<name>` on the home page.
2. **Stylesheet.** `src/<game>/style.css` starts with `@import '../base.css';` and `:root { --c: var(--<pen>); }`, then only the board's own styles. Entries use `var(--pen-font)`.
3. **Page.** Copy `minesweeper/index.html`. `theme-color` metas are `#fbfcff` and `#10151f`; link the stylesheet from `<head>`.
4. **Home card.** Copy a `.game-card` into the family's section and draw its `.game-icon` as a 3x3 printed board.
5. **Check both themes** on a phone-sized screen.

## Rollout status

Every family now uses Graph Paper: base, home page and icons, and all game boards (number puzzles, logic puzzles, number tiles, play the computer, cards, word games, dice, arcade, how to play). Known leftovers:

- 2248 tile digits stay Hanken because `main.ts` sizes them inline; its hairline cells also show a ragged edge from the `--tile` sizing.
- Dots and Boxes claimed boxes and Battleship hulls need `.ts` classes to be hatched or outlined as one piece.
- Nonograms' heavier every-fifth-cell rules need a `.ts` class.
- Android launcher and splash icons still carry the old navy and blue palette.
