import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import '../pwa';
import {
  type Grid, type Tile, COLS, ROWS,
  canExtend, createGrid, formatExp, hasMoves, maxTileExp, mergedExp, pathValue, settle,
} from './board';
import { formatScore, scoreParts, toScore } from './score';
import { loadStats, recordProgress, recordStart } from './stats';
import { addHistory, averageScore, bestLoggedScore, loadHistory } from './history';

// ---------- State ----------

interface Game {
  grid: Grid;
  score: bigint; // exact: tiles have no ceiling, so neither does the score
  merges: number;
  maxExp: number; // highest tile made this game
  status: 'playing' | 'over';
  startedAt?: number; // epoch ms of the first merge
}

const SAVE_KEY = '2248.current';
const GAP = 3; // matches the grid lines of the Minesweeper board
const MIN_TILE = 36;
const MAX_TILE = 64;
const MERGE_MS = 200;

let game: Game | null = loadGame();
let path: Tile[] = [];
let dragging = false;
let dragPointer = -1; // the finger or mouse that started the drag; other pointers are ignored until it lifts
let busy = false; // while a merge animates, input waits
let tileSize = 56;

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const gridEl = $('grid');
const boardWrap = $('board-wrap');
const pathLine = document.getElementById('path-line')!;
const pathSum = $('path-sum');
const endDialog = $<HTMLDialogElement>('end-dialog');
const confirmDialog = $<HTMLDialogElement>('confirm-dialog');

let tileEls = new Map<number, HTMLDivElement>();
const cellEls: HTMLDivElement[] = [];
for (let i = 0; i < ROWS * COLS; i++) {
  const bg = document.createElement('div');
  bg.className = 'cell-bg';
  gridEl.append(bg);
  cellEls.push(bg);
}


$('continue-btn').addEventListener('click', () => game && showGame());
$('new-btn').addEventListener('click', askNewGame);
$('back-btn').addEventListener('click', showHome);
$('history-btn').addEventListener('click', showHistory);
$('history-back-btn').addEventListener('click', showHome);
$('restart-btn').addEventListener('click', askNewGame);
$('end-menu').addEventListener('click', () => { endDialog.close(); showHome(); });
$('end-again').addEventListener('click', () => { endDialog.close(); newGame(); });
$('confirm-keep').addEventListener('click', () => confirmDialog.close());
$('confirm-new').addEventListener('click', () => { confirmDialog.close(); newGame(); });

// ---------- Screens ----------

function showHome() {
  cancelDrag();
  saveGame();
  gameEl.hidden = true;
  historyEl.hidden = true;
  homeEl.hidden = false;
  renderHome();
}

function showGame() {
  if (!game) return;
  homeEl.hidden = true;
  gameEl.hidden = false;
  buildTiles();
  layout();
  render();
}

/** Whether there is a board worth keeping: one that has been played and isn't over. */
function hasLiveGame(): boolean {
  return !!game && game.status === 'playing' && !!game.startedAt;
}

/** New board, after asking first if it would throw away a game in progress. */
function askNewGame() {
  if (!hasLiveGame()) { newGame(); return; }
  cancelDrag();
  $('confirm-summary').textContent =
    `You can't come back to this board once it's gone. Its score of ${formatScore(game!.score)} goes into your history as unfinished.`;
  confirmDialog.showModal();
}

function newGame() {
  // A started game being replaced goes into the history as unfinished.
  if (hasLiveGame()) logGame(game!, 'unfinished');
  game = { grid: createGrid(), score: 0n, merges: 0, maxExp: 1, status: 'playing' };
  game.maxExp = maxTileExp(game.grid);
  path = [];
  busy = false; // a merge still animating belongs to the old board, and stops itself when it sees the new one
  saveGame();
  showGame();
}

function renderHome() {
  const cont = $('continue-btn');
  if (game && hasLiveGame()) {
    cont.hidden = false;
    $('continue-meta').textContent = `Score ${formatScore(game.score)} · ${formatExp(game.maxExp)}`;
  } else {
    cont.hidden = true;
  }
}

function showHistory() {
  homeEl.hidden = true;
  historyEl.hidden = false;
  window.scrollTo(0, 0);
  renderHistory();
}

/** A score for the narrow stats columns: the number, with a big score's name on a smaller line under it. */
function scoreCell(score: bigint): string {
  const { num, unit } = scoreParts(score, true);
  return unit ? `${num}<small class="score-name">${unit}</small>` : num;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function renderHistory() {
  const stats = loadStats();
  const list = loadHistory();
  const avg = averageScore(list);
  const dash = '<span class="muted">–</span>';

  $('history-summary').innerHTML = `<tr>
    <td>${stats.played || dash}</td>
    <td>${stats.bestExp ? formatExp(stats.bestExp) : dash}</td>
    <td>${stats.bestScore ? scoreCell(stats.bestScore) : dash}</td>
    <td>${avg != null ? scoreCell(avg) : dash}</td>
  </tr>`;

  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row is-${e.result}">
      <div>
        <div class="history-level">Best tile ${formatExp(e.maxExp)}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${e.merges} merge${e.merges === 1 ? '' : 's'}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatScore(e.score)}</div>
        <div class="history-status">${e.result === 'over' ? 'Out of moves' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Layout ----------

/**
 * Sizes tiles to fit the space between the top bar and the tools. Pixel positions all come from
 * tileSize and GAP, mirrored into CSS variables, so tiles, cells and the path line agree.
 */
function layout() {
  const frame = gridEl.parentElement!;
  const framePad = frame.offsetWidth - frame.clientWidth + parseFloat(getComputedStyle(frame).paddingLeft) * 2;
  const width = boardWrap.clientWidth - framePad;
  // Measure from the top bar, not the board: the board is centred, so its own position depends on its size.
  const above = gameEl.querySelector('.topbar')!.getBoundingClientRect().bottom + 12;
  const below = $('restart-btn').parentElement!.offsetHeight + pathSum.offsetHeight + 32; // + path-sum margin and screen padding
  const height = window.innerHeight - above - framePad - below;
  const fromWidth = Math.floor((width - (COLS - 1) * GAP) / COLS);
  const fromHeight = Math.floor((height - (ROWS - 1) * GAP) / ROWS);
  tileSize = Math.max(MIN_TILE, Math.min(fromWidth, fromHeight, MAX_TILE));
  gridEl.style.setProperty('--tile', `${tileSize}px`);
  gridEl.style.setProperty('--gap', `${GAP}px`);
  cellEls.forEach((el, i) => place(el, Math.floor(i / COLS), i % COLS));
  for (const t of game?.grid.flat() ?? []) if (t) renderTile(t);
  renderLine();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { if (!gameEl.hidden) layout(); }, 100);
});

function place(el: HTMLElement, r: number, c: number) {
  el.style.translate = `${c * (tileSize + GAP)}px ${r * (tileSize + GAP)}px`;
}

// ---------- Rendering ----------

function fontSize(label: string) {
  const base = tileSize * 0.36;
  const size = label.length === 4 ? base - 3 : label.length > 4 ? base - 6 : base;
  return `${Math.max(9, size).toFixed(1)}px`;
}

function styleTile(el: HTMLElement, exp: number) {
  const label = formatExp(exp);
  el.textContent = label;
  el.style.fontSize = fontSize(label);
  el.dataset.exp = String(((exp - 1) % 12) + 1); // colours repeat every 12 steps
}

function buildTiles() {
  for (const el of tileEls.values()) el.remove();
  tileEls = new Map();
  for (const t of game!.grid.flat()) if (t) addTileEl(t);
}

function addTileEl(t: Tile, fromRow = t.r) {
  const el = document.createElement('div');
  el.className = 'tile pop';
  styleTile(el, t.exp);
  place(el, fromRow, t.c);
  el.addEventListener('animationend', () => el.classList.remove('pop'));
  gridEl.append(el);
  tileEls.set(t.id, el);
  return el;
}

function renderTile(t: Tile) {
  const el = tileEls.get(t.id);
  if (!el) return;
  styleTile(el, t.exp);
  place(el, t.r, t.c);
  el.classList.toggle('selected', path.includes(t));
}

function renderLine() {
  const half = tileSize / 2;
  pathLine.setAttribute('points', path.length < 2 ? '' :
    path.map((t) => `${t.c * (tileSize + GAP) + half},${t.r * (tileSize + GAP) + half}`).join(' '));

  if (path.length >= 2) {
    pathSum.textContent = `Merge into ${formatExp(mergedExp(path))}`;
    pathSum.classList.remove('muted');
  } else {
    pathSum.textContent = game && !game.merges ? 'Drag across matching tiles' : '';
    pathSum.classList.add('muted');
  }
}

function render() {
  if (!game) return;
  const best = Math.max(loadStats().bestExp, game.maxExp);
  $('target').textContent = `Target ${formatExp(game.maxExp + 1)}`;
  $('best').textContent = `Best ${formatExp(best)}`;
  const { num, unit } = scoreParts(game.score);
  $('score').textContent = num;
  $('score').setAttribute('aria-label', `Score ${formatScore(game.score)}`);
  $('score-unit').textContent = unit || 'Score'; // a big score's name takes the label's place, keeping the bar one size
  renderLine();
}

// ---------- Input ----------

/** The tile under a point. Away from the start, only the middle of a tile counts, so diagonal drags don't clip a neighbour. */
function tileAt(x: number, y: number, strict: boolean): Tile | null {
  if (!game) return null;
  const rect = gridEl.getBoundingClientRect();
  const step = tileSize + GAP;
  const lx = x - rect.left, ly = y - rect.top;
  const c = Math.floor(lx / step), r = Math.floor(ly / step);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  const dx = lx - c * step - tileSize / 2, dy = ly - r * step - tileSize / 2;
  const reach = strict ? tileSize * 0.4 : tileSize / 2;
  if (Math.abs(dx) > reach || Math.abs(dy) > reach) return null;
  return game.grid[r][c];
}

gridEl.addEventListener('pointerdown', (e) => {
  if (!game || game.status !== 'playing' || busy || dragging) return;
  const t = tileAt(e.clientX, e.clientY, false);
  if (!t) return;
  e.preventDefault();
  gridEl.setPointerCapture(e.pointerId);
  dragging = true;
  dragPointer = e.pointerId;
  path = [t];
  renderTile(t);
  renderLine();
});

gridEl.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== dragPointer) return;
  const t = tileAt(e.clientX, e.clientY, true);
  if (!t) return;
  const ok = canExtend(path, t);
  if (ok === 'backtrack') {
    renderTile(path.pop()!);
  } else if (ok) {
    path.push(t);
    renderTile(t);
  } else {
    return;
  }
  renderLine();
});

gridEl.addEventListener('pointerup', (e) => {
  if (!dragging || e.pointerId !== dragPointer) return; // a second finger lifting doesn't end the drag
  dragging = false;
  if (path.length >= 2) merge();
  else cancelDrag();
});
gridEl.addEventListener('pointercancel', (e) => { if (e.pointerId === dragPointer) cancelDrag(); });

function cancelDrag() {
  dragging = false;
  const old = path;
  path = [];
  old.forEach(renderTile);
  renderLine();
}

// ---------- Merging ----------

async function merge() {
  if (!game) return;
  const g = game;
  busy = true;
  const merged = path;
  const last = merged[merged.length - 1];
  const exp = mergedExp(merged);

  if (!g.startedAt) {
    g.startedAt = Date.now();
    recordStart();
  }
  g.score += pathValue(merged);
  g.merges++;
  g.maxExp = Math.max(g.maxExp, exp);

  // Slide the other tiles into the last one and fade them out.
  for (const t of merged) {
    if (t === last) continue;
    const el = tileEls.get(t.id)!;
    place(el, last.r, last.c);
    el.style.opacity = '0';
    tileEls.delete(t.id);
    setTimeout(() => el.remove(), MERGE_MS);
    g.grid[t.r][t.c] = null;
  }
  last.exp = exp;
  path = [];
  renderTile(last);
  const lastEl = tileEls.get(last.id)!;
  lastEl.classList.remove('pop');
  void lastEl.offsetWidth; // restart the animation
  lastEl.classList.add('pop');
  render();

  await new Promise((res) => setTimeout(res, MERGE_MS));
  // A new board was started while this merge animated: it is no longer on screen, so it stops here.
  if (game !== g) return;

  const { removed, spawned, spawnedFrom } = settle(g.grid, g.maxExp);
  for (const t of removed) {
    const el = tileEls.get(t.id);
    if (!el) continue; // the tiles were rebuilt meanwhile (left for the menu and came back)
    el.style.opacity = '0';
    el.style.scale = '0';
    tileEls.delete(t.id);
    setTimeout(() => el.remove(), MERGE_MS);
  }
  // New tiles start above the board, then fall into place with everything else.
  for (const t of spawned) addTileEl(t, spawnedFrom.get(t.id));
  void gridEl.offsetWidth;
  for (const t of g.grid.flat()) if (t) renderTile(t);

  recordProgress(g.maxExp, g.score);
  if (!hasMoves(g.grid)) gameOver();
  busy = false;
  saveGame();
  render();
}

function gameOver() {
  if (!game) return;
  game.status = 'over';
  // Stats already hold this game's score, so compare against the games logged before it.
  const previousBest = bestLoggedScore(loadHistory());
  logGame(game, 'over');
  const best = game.score > previousBest ? ' (new best)' : '';
  $('end-summary').textContent =
    `No two touching tiles match. Best tile ${formatExp(game.maxExp)}, score ${formatScore(game.score)}${best}.`;
  setTimeout(() => { if (!gameEl.hidden) endDialog.showModal(); }, 600);
}

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || endDialog.open || confirmDialog.open) return; // Escape closes the dialog itself
  if (!historyEl.hidden || !gameEl.hidden) showHome();
});

// ---------- Android back button ----------

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (endDialog.open) endDialog.close();
    else if (confirmDialog.open) confirmDialog.close();
    else if (!gameEl.hidden || !historyEl.hidden) showHome();
    else location.href = '/';
  });
  CapApp.addListener('pause', saveGame);
}

// ---------- Persistence ----------

/** Saves the board. Not mid-merge: the merged tiles' cells are empty until the refill, and the merge saves when done. */
function saveGame() {
  if (!game || busy) return;
  const { grid, score, ...rest } = game;
  const exps = grid.map((row) => row.map((t) => t?.exp ?? 1));
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...rest, score: score.toString(), exps }));
  } catch { /* ignore */ }
}

function loadGame(): Game | null {
  try {
    const { exps, ...rest } = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') ?? {};
    const valid = Array.isArray(exps) && exps.length === ROWS && exps.every((row: unknown) => Array.isArray(row) && row.length === COLS);
    return valid ? { ...rest, score: toScore(rest.score), grid: createGrid(exps) } : null;
  } catch {
    return null;
  }
}

function logGame(g: Game, result: 'over' | 'unfinished') {
  addHistory({
    startedAt: g.startedAt ?? null,
    endedAt: Date.now(),
    score: g.score,
    maxExp: g.maxExp,
    merges: g.merges,
    result,
  });
}

// ---------- Start ----------

renderHome();
