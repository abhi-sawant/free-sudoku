import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import '../pwa';
import {
  type Piece, type SavedPiece, CAP,
  canPlace, hasMove, loadPiece, maxExpIn, nextPiece, placeResult, savePiece, startRing,
} from './board';
import { formatExp, formatScore, scoreParts, toScore } from '../shared/tilescore';
import { loadStats, recordProgress, recordStart } from './stats';
import { addHistory, averageScore, bestLoggedScore, loadHistory } from './history';

// ---------- State ----------

interface Game {
  ring: Piece[]; // clockwise from the top
  hand: Piece;
  fromRing: boolean; // the hand holds a tile a take piece lifted, so the next turn deals nothing new
  score: bigint;
  moves: number;
  maxExp: number; // highest tile made this game
  sincePlus: number; // pieces dealt since the last merge piece
  status: 'playing' | 'over';
  startedAt?: number; // epoch ms of the first move
}

const SAVE_KEY = 'halo.current';
const MIN_SIZE = 240;
const MAX_SIZE = 440;
const STEP_MS = 230;

let game: Game | null = loadGame();
let busy = false; // while a move animates, input waits
let aim: number | null = null; // the gap (or, for a take piece, the tile) the pointer or keys point at
let pressing = -1; // the pointer pressed on the ring, or -1
let size = 320, tile = 42, radius = 130;

// ---------- DOM ----------

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const homeEl = $('home');
const gameEl = $('game');
const historyEl = $('history');
const boardEl = $('board');
const frameEl = boardEl.parentElement!;
const boardWrap = $('board-wrap');
const markerEl = $('marker');
const hintEl = $('hint');
const endDialog = $<HTMLDialogElement>('end-dialog');
const confirmDialog = $<HTMLDialogElement>('confirm-dialog');

let pieceEls = new Map<number, HTMLDivElement>();

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
  setAim(null);
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
  buildPieces();
  layout();
  render();
}

/** Whether there is a ring worth keeping: one that has been played and isn't over. */
function hasLiveGame(): boolean {
  return !!game && game.status === 'playing' && !!game.startedAt;
}

/** New ring, after asking first if it would throw away a game in progress. */
function askNewGame() {
  if (!game || !hasLiveGame()) { newGame(); return; }
  setAim(null);
  $('confirm-summary').textContent =
    `You can't come back to this ring once it's gone. Its score of ${formatScore(game.score)} goes into your history as unfinished.`;
  confirmDialog.showModal();
}

function newGame() {
  // A started game being replaced goes into the history as unfinished.
  if (game && hasLiveGame()) logGame(game, 'unfinished');
  const ring = startRing();
  const maxExp = maxExpIn(ring);
  const hand = nextPiece(maxExp, 0, ring.length);
  game = { ring, hand, fromRing: false, score: 0n, moves: 0, maxExp, sincePlus: hand.kind === 'plus' ? 0 : 1, status: 'playing' };
  busy = false; // a move still animating belongs to the old ring, and stops itself when it sees the new one
  aim = null;
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
        <div class="history-date">${dateFormat.format(e.endedAt)} · ${e.moves} move${e.moves === 1 ? '' : 's'}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${formatScore(e.score)}</div>
        <div class="history-status">${e.result === 'over' ? 'Ring full' : 'Unfinished'}</div>
      </div>
    </li>`).join('');
}

// ---------- Layout ----------

/** Sizes the ring to the space between the top bar and the tools. A tile is sized so a full ring of CAP fits. */
function layout() {
  const framePad = frameEl.offsetWidth - frameEl.clientWidth + parseFloat(getComputedStyle(frameEl).paddingLeft) * 2;
  const width = boardWrap.clientWidth - framePad;
  const above = gameEl.querySelector('.topbar')!.getBoundingClientRect().bottom + 12;
  const below = $('restart-btn').parentElement!.offsetHeight + hintEl.offsetHeight + 32;
  const height = window.innerHeight - above - framePad - below;
  size = Math.floor(Math.max(MIN_SIZE, Math.min(width, height, MAX_SIZE)));
  // Tiles fill most of their share of the circle: t = k * (s/2 - 8 - t/2), solved for t.
  const k = (0.86 * 2 * Math.PI) / CAP;
  tile = Math.floor((k * (size / 2 - 8)) / (1 + k / 2));
  radius = size / 2 - 8 - tile / 2;
  boardEl.style.setProperty('--s', `${size}px`);
  boardEl.style.setProperty('--t', `${tile}px`);
  boardEl.style.setProperty('--r', `${radius}px`);
  placeAll();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { if (!gameEl.hidden) layout(); }, 100);
});

/** The angle of slot `i` in a ring of `n`, clockwise from the top. */
const slotAngle = (i: number, n: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
/** The angle of gap `g` (just before slot g) in a ring of `n`. */
const gapAngle = (g: number, n: number) => slotAngle(g - 0.5, n);
const at = (a: number, r = radius) => [size / 2 + r * Math.cos(a), size / 2 + r * Math.sin(a)];

function place(el: HTMLElement, x: number, y: number) {
  el.style.translate = `${x - tile / 2}px ${y - tile / 2}px`;
}

// ---------- Rendering ----------

function fontSize(label: string) {
  const base = tile * 0.38;
  const size = label.length === 3 ? base - 2 : label.length === 4 ? base - 4 : label.length > 4 ? base - 6 : base;
  return `${Math.max(8, size).toFixed(1)}px`;
}

function stylePiece(el: HTMLElement, p: Piece) {
  el.classList.toggle('plus', p.kind === 'plus');
  el.classList.toggle('minus', p.kind === 'minus');
  if (p.kind === 'num') {
    const label = formatExp(p.exp);
    el.textContent = label;
    el.style.fontSize = fontSize(label);
    el.dataset.exp = String(((p.exp - 1) % 12) + 1); // colours repeat every 12 steps
    el.setAttribute('aria-label', label);
  } else {
    el.textContent = p.kind === 'plus' ? '+' : '−';
    el.style.fontSize = '';
    delete el.dataset.exp;
    el.setAttribute('aria-label', p.kind === 'plus' ? 'merge piece' : 'take piece');
  }
}

function addPieceEl(p: Piece) {
  const el = document.createElement('div');
  el.className = 'piece pop';
  el.addEventListener('animationend', () => el.classList.remove('pop'));
  stylePiece(el, p);
  place(el, size / 2, size / 2);
  boardEl.append(el);
  pieceEls.set(p.id, el);
  return el;
}

function buildPieces() {
  for (const el of pieceEls.values()) el.remove();
  pieceEls = new Map();
  for (const p of game!.ring) addPieceEl(p);
  addPieceEl(game!.hand);
}

/** Puts every piece where it belongs: the ring round the circle, the hand in the middle. */
function placeAll(ring = game?.ring ?? []) {
  if (!game) return;
  ring.forEach((p, i) => {
    const el = pieceEls.get(p.id);
    if (!el) return;
    el.classList.remove('in-hand');
    const [x, y] = at(slotAngle(i, ring.length));
    place(el, x, y);
  });
  const hand = pieceEls.get(game.hand.id);
  if (hand && !ring.includes(game.hand)) {
    hand.classList.add('in-hand');
    place(hand, size / 2, size / 2);
  }
  renderAim();
}

function renderAim() {
  for (const el of pieceEls.values()) el.classList.remove('aim');
  if (!game || aim === null || busy || game.status !== 'playing') { markerEl.hidden = true; return; }
  const n = game.ring.length;
  if (game.hand.kind === 'minus') {
    markerEl.hidden = true;
    const p = game.ring[aim];
    if (p) pieceEls.get(p.id)?.classList.add('aim');
    return;
  }
  markerEl.hidden = false;
  const [x, y] = n ? at(gapAngle(aim, n)) : at(-Math.PI / 2);
  markerEl.style.translate = `${x}px ${y}px`;
}

function render() {
  if (!game) return;
  const best = Math.max(loadStats().bestExp, game.maxExp);
  $('count').textContent = `${game.ring.length}/${CAP} spaces`;
  $('best').textContent = `Best ${formatExp(best)}`;
  const { num, unit } = scoreParts(game.score);
  $('score').textContent = num;
  $('score').setAttribute('aria-label', `Score ${formatScore(game.score)}`);
  $('score-unit').textContent = unit || 'Score';
  renderHint();
}

function renderHint() {
  if (!game) return;
  let text = '';
  if (game.status === 'playing') {
    if (game.hand.kind === 'plus') text = 'Place + between a pair';
    else if (game.hand.kind === 'minus') text = 'Tap a tile to pick it up';
    else if (game.fromRing) text = 'Place your tile anywhere';
    else if (!game.moves) text = 'Tap a gap to place your tile';
    else if (game.ring.length >= CAP - 2) text = game.ring.length >= CAP ? 'The ring is full' : `${CAP - game.ring.length} space${CAP - game.ring.length === 1 ? '' : 's'} left`;
  }
  hintEl.textContent = text;
  hintEl.classList.toggle('muted', game.hand.kind === 'num' && !game.fromRing);
}

// ---------- Input ----------

/** The gap (or, for a take piece, the tile) nearest a point, or null in the middle of the ring. */
function targetAt(x: number, y: number): number | null {
  if (!game) return null;
  const rect = boardEl.getBoundingClientRect();
  const dx = x - rect.left - size / 2, dy = y - rect.top - size / 2;
  if (Math.hypot(dx, dy) < tile * 0.9) return null; // the middle holds your piece
  const n = game.ring.length;
  if (!n) return 0;
  const step = (2 * Math.PI) / n;
  let a = Math.atan2(dy, dx) + Math.PI / 2; // 0 at the top, clockwise
  if (a < 0) a += 2 * Math.PI;
  return game.hand.kind === 'minus' ? Math.round(a / step) % n : Math.round(a / step + 0.5) % n;
}

function setAim(t: number | null) {
  aim = t;
  renderAim();
}

const canPlay = () => !!game && game.status === 'playing' && !busy;

boardEl.addEventListener('pointerdown', (e) => {
  if (!canPlay() || pressing !== -1) return;
  e.preventDefault();
  boardEl.setPointerCapture(e.pointerId);
  pressing = e.pointerId;
  setAim(targetAt(e.clientX, e.clientY));
});

boardEl.addEventListener('pointermove', (e) => {
  if (!canPlay()) return;
  // A mouse previews the gap it hovers; a finger only aims while pressed.
  if (pressing === e.pointerId || (pressing === -1 && e.pointerType === 'mouse')) setAim(targetAt(e.clientX, e.clientY));
});

boardEl.addEventListener('pointerup', (e) => {
  if (pressing !== e.pointerId) return; // a second finger lifting doesn't place
  pressing = -1;
  const t = targetAt(e.clientX, e.clientY);
  if (t === null) { setAim(null); return; }
  void play(t);
});

boardEl.addEventListener('pointercancel', (e) => {
  if (pressing !== e.pointerId) return;
  pressing = -1;
  setAim(null);
});

boardEl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && pressing === -1) setAim(null); });

boardEl.addEventListener('keydown', (e) => {
  if (!canPlay() || !game) return;
  const n = Math.max(1, game.ring.length);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setAim(aim === null ? 0 : (aim + 1) % n);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setAim(aim === null ? 0 : (aim - 1 + n) % n);
  else if ((e.key === 'Enter' || e.key === ' ') && aim !== null) void play(aim);
  else return;
  e.preventDefault();
});

// ---------- Playing ----------

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

function shake() {
  frameEl.classList.remove('shake');
  void frameEl.offsetWidth;
  frameEl.classList.add('shake');
}

/** One turn: place the hand's piece at gap `t`, or lift tile `t` with a take piece. */
async function play(t: number) {
  if (!game || !canPlay()) return;
  const g = game;
  if (!canPlace(g.ring, t, g.hand)) { shake(); setAim(null); return; }
  busy = true;
  aim = null;
  renderAim();
  if (!g.startedAt) {
    g.startedAt = Date.now();
    recordStart();
  }
  g.moves++;

  if (g.hand.kind === 'minus') {
    // The take piece lifts the tile into the hand and is used up.
    const taken = g.ring[t];
    const minusEl = pieceEls.get(g.hand.id);
    if (minusEl) { minusEl.style.opacity = '0'; minusEl.style.scale = '0.4'; setTimeout(() => minusEl.remove(), STEP_MS); }
    pieceEls.delete(g.hand.id);
    g.ring = g.ring.filter((_, i) => i !== t);
    g.hand = taken;
    g.fromRing = true;
    placeAll();
    render();
    await wait(STEP_MS);
    if (game !== g) return;
    finishTurn(g);
    return;
  }

  const res = placeResult(g.ring, t, g.hand);
  g.ring = res.placed;
  placeAll();
  render();
  await wait(STEP_MS);

  for (const f of res.fusions) {
    if (game !== g) return; // a new ring was started meanwhile
    const intoEl = pieceEls.get(f.into);
    const [ix, iy] = intoEl ? intoEl.style.translate.split(' ').map((v) => parseFloat(v) + tile / 2) : [size / 2, size / 2];
    for (const id of f.absorbed) {
      const el = pieceEls.get(id);
      if (!el) continue;
      place(el, ix, iy);
      el.style.opacity = '0';
      pieceEls.delete(id);
      setTimeout(() => el.remove(), STEP_MS);
    }
    await wait(STEP_MS * 0.6);
    if (game !== g) return;
    const into = f.ring.find((p) => p.id === f.into)!;
    if (intoEl) {
      stylePiece(intoEl, into);
      intoEl.classList.remove('pop');
      void intoEl.offsetWidth;
      intoEl.classList.add('pop');
    }
    g.score += f.points;
    g.ring = f.ring;
    g.maxExp = Math.max(g.maxExp, maxExpIn(g.ring));
    placeAll();
    render();
    await wait(STEP_MS);
  }
  if (game !== g) return;

  // Deal the next piece into the middle.
  const dealt = nextPiece(g.maxExp, g.sincePlus, g.ring.length);
  g.sincePlus = dealt.kind === 'plus' ? 0 : g.sincePlus + 1;
  g.hand = dealt;
  g.fromRing = false;
  addPieceEl(dealt).classList.add('in-hand');
  finishTurn(g);
}

function finishTurn(g: Game) {
  g.maxExp = Math.max(g.maxExp, maxExpIn(g.ring), g.hand.kind === 'num' ? g.hand.exp : 0);
  recordProgress(g.maxExp, g.score);
  if (!hasMove(g.ring, g.hand)) gameOver();
  busy = false;
  saveGame();
  placeAll();
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
    `No space is left for your piece. Best tile ${formatExp(game.maxExp)}, score ${formatScore(game.score)}${best}.`;
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

interface Saved {
  ring: SavedPiece[];
  hand: SavedPiece;
  fromRing: boolean;
  score: string;
  moves: number;
  maxExp: number;
  sincePlus: number;
  status: 'playing' | 'over';
  startedAt?: number;
}

/** Saves the ring. Not mid-move: the move saves when it is done. */
function saveGame() {
  if (!game || busy) return;
  const { ring, hand, score, ...rest } = game;
  const saved: Saved = { ...rest, ring: ring.map(savePiece), hand: savePiece(hand), score: score.toString() };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch { /* ignore */ }
}

function loadGame(): Game | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null;
    if (!s || !Array.isArray(s.ring) || s.ring.length > CAP + 1) return null;
    const ring = s.ring.map(loadPiece);
    const hand = loadPiece(s.hand);
    if (!hand || ring.some((p) => !p)) return null;
    return {
      ring: ring as Piece[],
      hand,
      fromRing: !!s.fromRing,
      score: toScore(s.score),
      moves: Number(s.moves) || 0,
      maxExp: Number(s.maxExp) || maxExpIn(ring as Piece[]),
      sincePlus: Number(s.sincePlus) || 0,
      status: s.status === 'over' ? 'over' : 'playing',
      startedAt: s.startedAt,
    };
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
    moves: g.moves,
    result,
  });
}

// ---------- Start ----------

renderHome();
