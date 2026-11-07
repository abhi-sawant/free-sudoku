import { $, Screens, dateFormat, onVisibility } from '../shared/screens';
import { createHistory, loadJSON, saveJSON } from '../shared/store';
import {
  CAR_H, CAR_Y, H, LEVELS, ROAD_W, ROAD_X, W, carWidth, createWorld, laneWidth, laneX, steer, step,
  type Level, type World,
} from './engine';
import { crash, engine, hush, isMuted, setMuted, swish, unlock } from './sound';

// Road Racer: tap the left or right half of the board (or use the arrow keys / A and D) to change lane and
// dodge the traffic. The road speeds up as you go; score is the distance. Only finished runs are saved, in the
// history and in each level's best score.

const NAMES: Record<Level, string> = { country: 'Country Road', highway: 'Highway', city: 'City Rush', night: 'Night Rally' };
const MAX_DT = 1 / 30; // a long frame (a busy tab) never lets the car skip through traffic

interface HistoryEntry { endedAt: number; level: Level; score: number; best: boolean }
interface LevelStats { runs: number; best: number }

const history = createHistory<HistoryEntry>('racer.history');
const STATS_KEY = 'racer.stats';
const loadStats = () => loadJSON<Partial<Record<Level, LevelStats>>>(STATS_KEY, {});

type Phase = 'ready' | 'running' | 'paused' | 'over';
let world: World = createWorld('country');
let phase: Phase = 'ready';
let raf = 0;
let last = 0;
let shownBoosts = 0; // speed-ups already announced

const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const endDialog = $<HTMLDialogElement>('end-dialog');
const numberFormat = new Intl.NumberFormat();

const screens = new Screens({
  leaveGame: stopLoop,
  renderHistory,
});

document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) =>
  btn.addEventListener('click', () => start(btn.dataset.level as Level)));
$('end-again').addEventListener('click', () => { endDialog.close(); start(world.level); });
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });

// The first tap starts the run, and a tap while paused carries on; after that the side tapped sets the lane.
const frame = canvas.parentElement!;
frame.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const r = frame.getBoundingClientRect();
  tap(e.clientX < r.left + r.width / 2 ? -1 : 1);
});
// Buttons under the board for touch screens, so a thumb never has to cover the road.
$('left-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(-1); });
$('right-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(1); });
document.addEventListener('keydown', (e) => {
  if (!screens.is('game') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const dir = k === 'arrowleft' || k === 'a' ? -1 : k === 'arrowright' || k === 'd' ? 1 : 0;
  if (dir) {
    e.preventDefault();
    if (!e.repeat) tap(dir);
  } else if (k === ' ') {
    e.preventDefault();
    if (phase === 'ready' || phase === 'paused') tap(0);
  }
});
onVisibility(pause, () => {});
// The rules dialog (src/help.ts) pauses the run while it is open.
document.addEventListener('guide:open', pause);
new ResizeObserver(resize).observe(frame);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette = readPalette(); draw(); });

// ---------- Run ----------

function start(level: Level) {
  if (endDialog.open) endDialog.close();
  world = createWorld(level);
  shownBoosts = 0;
  phase = 'ready';
  screens.show('game');
  $('level-label').textContent = NAMES[level];
  $('best').textContent = String(loadStats()[level]?.best ?? 0);
  setScore();
  setStatus('Tap to start', 'Tap left or right, or use the arrow keys, to change lane');
  resize();
  startLoop();
}

function tap(dir: -1 | 0 | 1) {
  unlock(); // a tap is the gesture the browser needs before it allows sound
  if (phase === 'ready' || phase === 'paused') {
    phase = 'running';
    setStatus('');
    last = performance.now();
    return;
  }
  if (phase === 'running' && dir) {
    const before = world.lane;
    steer(world, dir);
    if (world.lane !== before) swish();
  }
}

// The speaker button in the top bar mutes and unmutes.
const soundBtn = $<HTMLButtonElement>('sound-btn');
function showMute() {
  soundBtn.setAttribute('aria-pressed', String(isMuted()));
  soundBtn.setAttribute('aria-label', isMuted() ? 'Turn sound on' : 'Turn sound off');
  soundBtn.classList.toggle('is-off', isMuted());
}
soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation()); // the board steers on a tap; this button must not
soundBtn.addEventListener('click', () => { unlock(); setMuted(!isMuted()); showMute(); });
showMute();

function pause() {
  if (phase !== 'running') return;
  hush();
  phase = 'paused';
  setStatus('Paused', 'Tap to carry on');
}

function finish() {
  phase = 'over';
  crash();
  const level = world.level;
  const stats = loadStats();
  const s = (stats[level] ??= { runs: 0, best: 0 });
  const best = world.score > s.best;
  s.runs++;
  if (best) s.best = world.score;
  saveJSON(STATS_KEY, stats);
  history.add({ endedAt: Date.now(), level, score: world.score, best });
  $('best').textContent = String(s.best);

  $('end-summary').textContent = `${numberFormat.format(world.score)} points`
    + (best && world.score > 0 ? '. A new best!' : `. Your best on ${NAMES[level]} is ${numberFormat.format(s.best)}.`);
  // A moment for the last tap to stop, so it can't dismiss the dialog by accident.
  setTimeout(() => { if (phase === 'over' && screens.is('game')) { endDialog.showModal(); $('end-again').focus(); } }, 450);
}

function setScore() { $('score').textContent = numberFormat.format(world.score); }

function setStatus(title: string, hint = '') {
  $('status').innerHTML = title ? `${title}${hint ? `<small>${hint}</small>` : ''}` : '';
}

// ---------- Loop ----------

function startLoop() {
  cancelAnimationFrame(raf);
  last = performance.now();
  raf = requestAnimationFrame(frameLoop);
}

function stopLoop() {
  cancelAnimationFrame(raf);
  raf = 0;
  hush();
  if (phase === 'running') phase = 'paused';
}

function frameLoop(now: number) {
  const dt = Math.min(MAX_DT, (now - last) / 1000);
  last = now;
  if (phase === 'running') {
    step(world, dt);
    if (!world.over) engine(world.speed);
    if (world.boosts !== shownBoosts) {
      shownBoosts = world.boosts;
      if (shownBoosts) { setStatus('Faster!'); setTimeout(() => { if (phase === 'running') setStatus(''); }, 900); }
    }
    setScore();
    if (world.over) finish();
  }
  draw();
  raf = requestAnimationFrame(frameLoop);
}

// ---------- Drawing ----------

interface Palette { car: string; sheet: string; road: string; ink: string; ink2: string; rival: string; rival2: string }

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    car: v('--c'), sheet: v('--sheet'), road: v('--sunk'), ink: v('--ink'), ink2: v('--ink-2'),
    rival: v('--coral'), rival2: v('--teal'),
  };
}
let palette = readPalette();

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = frame.clientWidth;
  if (!width) return;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round((width * H / W) * dpr);
  draw();
}

function draw() {
  if (!canvas.width) return;
  const p = palette;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = p.sheet;
  ctx.fillRect(0, 0, W, H);

  // The road, with an edge line each side and dashed lane markings that slide down at full speed.
  ctx.fillStyle = p.road;
  ctx.fillRect(ROAD_X, 0, ROAD_W, H);
  ctx.fillStyle = p.ink;
  ctx.fillRect(ROAD_X - 3, 0, 3, H);
  ctx.fillRect(ROAD_X + ROAD_W, 0, 3, H);
  ctx.fillStyle = p.ink2;
  ctx.globalAlpha = 0.5;
  const lw = laneWidth(world.lanes);
  const period = 60;
  for (let i = 1; i < world.lanes; i++) {
    for (let y = -period + (world.offset % period); y < H; y += period) ctx.fillRect(ROAD_X + lw * i - 1.5, y, 3, 30);
  }
  ctx.globalAlpha = 1;

  const cw = carWidth(world.lanes);
  for (const t of world.traffic) drawCar(laneX(world.lanes, t.lane), t.y, cw, t.h, t.truck ? p.rival2 : p.rival);
  drawCar(world.x, CAR_Y, cw, CAR_H, p.car);
}

/** A car seen from above: a body in the given colour, a windscreen, and two wheels either side. */
function drawCar(cx: number, y: number, w: number, h: number, color: string) {
  const p = palette;
  ctx.fillStyle = p.ink;
  ctx.fillRect(cx - w / 2 - 3, y + h * 0.14, 4, h * 0.2);
  ctx.fillRect(cx + w / 2 - 1, y + h * 0.14, 4, h * 0.2);
  ctx.fillRect(cx - w / 2 - 3, y + h * 0.66, 4, h * 0.2);
  ctx.fillRect(cx + w / 2 - 1, y + h * 0.66, 4, h * 0.2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, h, 7);
  ctx.fill();
  ctx.fillStyle = p.sheet;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 4, y + h * 0.2, w - 8, h * 0.22, 3);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- History ----------

function renderHistory() {
  const stats = loadStats();
  const list = history.load();
  const dash = '<span class="muted">–</span>';
  $('history-summary').innerHTML = LEVELS.map((l) => `<tr>
    <th scope="row">${NAMES[l]}</th><td>${stats[l]?.runs || dash}</td><td>${stats[l]?.best ? numberFormat.format(stats[l]!.best) : dash}</td>
  </tr>`).join('');
  $('history-empty').hidden = list.length > 0;
  $('history-list').innerHTML = list.map((e) => `<li class="history-row ${e.best ? 'is-run' : ''}">
      <div>
        <div class="history-level">${NAMES[e.level]}</div>
        <div class="history-date">${dateFormat.format(e.endedAt)}</div>
      </div>
      <div class="history-result">
        <div class="history-time">${numberFormat.format(e.score)}</div>
        <div class="history-status">${e.best ? 'New best' : ''}</div>
      </div>
    </li>`).join('');
}
