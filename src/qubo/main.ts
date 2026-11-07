import { $, Screens, onVisibility } from '../shared/screens';
import { loadJSON, saveJSON } from '../shared/store';
import { CUBE, H, W, type World, createWorld, launch, pivotX, step, towerLen } from './engine';

const rad = (d: number) => (d * Math.PI) / 180;

// Qubo: the tower tips over toward the next one; tap at the right moment to throw the cube onto it. Only the best score is saved.

const BEST_KEY = 'qubo.best';
const MAX_DT = 1 / 30;
const numberFormat = new Intl.NumberFormat();

let world: World = createWorld();
let raf = 0;
let last = 0;
let paused = false;
let started = false;
let best = loadJSON<number>(BEST_KEY, 0);

const canvas = $<HTMLCanvasElement>('stage');
const ctx = canvas.getContext('2d')!;
const frame = canvas.parentElement!;
const endDialog = $<HTMLDialogElement>('end-dialog');

const screens = new Screens({ leaveGame: stopLoop, renderHome });

$('play-btn').addEventListener('click', start);
$('end-again').addEventListener('click', () => { endDialog.close(); start(); });
$('end-menu').addEventListener('click', () => { endDialog.close(); screens.home(); });

for (const el of [frame, $('hold-btn')]) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
}
// Space starts a game from the menu, and plays again from the end dialog.
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (endDialog.open) { e.preventDefault(); endDialog.close(); start(); }
  else if (screens.is('home') && !document.querySelector('dialog[open]')) { e.preventDefault(); start(); }
});
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || !screens.is('game') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); if (!e.repeat) down(); }
});
onVisibility(pause, () => {});
document.addEventListener('guide:open', pause);
new ResizeObserver(resize).observe(frame);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette = readPalette(); draw(); });

renderHome();

function renderHome() {
  $('home-best').textContent = best ? `Best ${numberFormat.format(best)}` : '';
}

function start() {
  if (endDialog.open) endDialog.close();
  world = createWorld();
  paused = false;
  started = false;
  screens.show('game');
  $('best').textContent = String(best);
  setScore();
  setStatus('Tap to start', 'Time the tap: throw the cube while the tower leans, before it falls');
  resize();
  cancelAnimationFrame(raf);
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

function down() {
  if (paused) { paused = false; setStatus(''); last = performance.now(); return; }
  if (!started) { started = true; setStatus(''); last = performance.now(); return; } // the first tap only starts the tower tipping
  launch(world);
}

function pause() {
  if (!screens.is('game') || world.over || paused || !started) return;
  paused = true;
  setStatus('Paused', 'Tap to carry on');
}

function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

function finish() {
  const isBest = world.score > best;
  if (isBest) { best = world.score; saveJSON(BEST_KEY, best); }
  $('best').textContent = String(best);
  $('end-summary').textContent = `${numberFormat.format(world.score)} ${world.score === 1 ? 'tower' : 'towers'} crossed`
    + (isBest && world.score > 0 ? '. A new best!' : `. Your best is ${numberFormat.format(best)}.`);
  setTimeout(() => { if (world.over && screens.is('game')) { endDialog.showModal(); $('end-again').focus(); } }, 450);
}

function setScore() { $('score').textContent = numberFormat.format(world.score); }
function setStatus(title: string, hint = '') {
  $('status').innerHTML = title ? `${title}${hint ? `<small>${hint}</small>` : ''}` : '';
}

function loop(now: number) {
  const dt = Math.min(MAX_DT, (now - last) / 1000);
  last = now;
  if (started && !paused) {
    const was = world.over;
    step(world, dt);
    setScore();
    if (world.over && !was) finish();
  }
  draw();
  raf = requestAnimationFrame(loop);
}

// ---------- Drawing ----------

interface Palette { cube: string; sheet: string; tint: string; ink: string; paper: string }
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  return { cube: v('--c'), sheet: v('--sheet'), tint: v('--tint'), ink: v('--ink'), paper: v('--paper') };
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
  const s = canvas.width / W;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = p.sheet;
  ctx.fillRect(0, 0, W, H);

  // Far clouds drift with the camera, slower than the towers.
  ctx.fillStyle = p.tint;
  for (let i = -1; i < 5; i++) {
    const x = i * 120 - ((world.cam * 0.3) % 120);
    ctx.beginPath();
    ctx.ellipse(x + 60, 120 + (i & 1) * 40, 46, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(-world.cam, 0);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.sheet;
  // The tower the cube stands on tips over from the middle of its base; the next one stands still.
  world.towers.forEach((t, i) => {
    if (i === 0 && world.phase !== 'wait') return; // once the cube has left, that tower is drawn toppling below
    ctx.save();
    ctx.translate(pivotX(t), H);
    if (i === 0) ctx.rotate((world.angle * Math.PI) / 180);
    drawTower(t.w, towerLen(t));
    ctx.restore();
  });

  for (const f of world.fallen) {
    ctx.save();
    ctx.translate(f.pivot, H);
    ctx.rotate(rad(f.angle));
    drawTower(f.w, f.len);
    ctx.restore();
  }

  drawCube(world.cubeX, world.cubeY, world.cubeAngle);
  ctx.restore();
}

/** A lattice tower standing up from the origin: crossed braces in each square bay. */
function drawTower(w: number, len: number) {
  ctx.fillRect(-w / 2, -len, w, len + 40);
  ctx.beginPath();
  ctx.rect(-w / 2, -len, w, len + 40);
  let flip = false;
  for (let y = -len; y < 0; y += w * 0.8) {
    const e = Math.min(y + w * 0.8, 0);
    ctx.moveTo(flip ? w / 2 : -w / 2, y); ctx.lineTo(flip ? -w / 2 : w / 2, e);
    ctx.moveTo(-w / 2, e); ctx.lineTo(w / 2, e);
    flip = !flip;
  }
  ctx.stroke();
}

/** The cube, with a pair of eyes looking ahead. */
function drawCube(x: number, bottom: number, tilt: number) {
  const p = palette;
  ctx.save();
  ctx.translate(x + CUBE / 2, bottom); // tilts about the middle of its base, so it sits on the tower's tip
  ctx.rotate(rad(tilt));
  ctx.fillStyle = p.cube;
  ctx.beginPath();
  ctx.roundRect(-CUBE / 2, -CUBE, CUBE, CUBE, 5);
  ctx.fill();
  ctx.fillStyle = p.paper;
  for (const ex of [CUBE / 2 - 16, CUBE / 2 - 7]) {
    ctx.beginPath();
    ctx.arc(ex, -CUBE + 11, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
