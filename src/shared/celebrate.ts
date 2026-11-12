// The badge unlock moment: confetti over the page and a small popup naming the badge. It never links anywhere, so the
// hidden badges page stays a secret. Loaded on demand by pwa.ts, which checks badges after a page loads and whenever a
// game logs a finished game (the history writers send `games:progress`).

import { type Badge, checkBadges } from './badges';

const SHOW_MS = 4200;

/** Puts an element in the top layer, above any open dialog (a game-over dialog usually opens just before a badge
 *  unlocks). Browsers without popovers get it as a plain fixed element. */
function lift(el: HTMLElement) {
  document.body.append(el);
  if (typeof el.showPopover === 'function') {
    el.popover = 'manual';
    try { el.showPopover(); } catch { /* already shown */ }
  }
}
const queue: Badge[][] = [];
let showing = false;

/** Confetti in the page's own inks, falling for about two seconds. Skipped when the player asks for less motion. */
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const css = getComputedStyle(document.documentElement);
  const colours = ['--yellow', '--coral', '--teal', '--blue', '--lilac', '--orange']
    .map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  lift(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const bits = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.4,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 11 - 4,
    w: 5 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colours[Math.floor(Math.random() * colours.length)] || '#888',
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 2400);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (t < 2400) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

const inkClass = (b: Badge) => (b.ink ? ` ink-${b.ink}` : '');

/** A medallion for a badge: its mark in a circle, in its ink. Shared with the badges page. */
export function medal(b: Badge, locked = false): HTMLElement {
  const el = document.createElement('span');
  el.className = `badge-medal${inkClass(b)}${locked ? ' locked' : ''}`;
  el.textContent = locked && b.secret ? '?' : b.mark;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function show(batch: Badge[]) {
  showing = true;
  confetti();
  const toast = document.createElement('div');
  toast.className = 'badge-toast';
  toast.setAttribute('role', 'status');
  const text = document.createElement('div');
  text.className = 'badge-toast-text';
  const title = document.createElement('b');
  const sub = document.createElement('span');
  if (batch.length === 1) {
    const [b] = batch;
    toast.append(medal(b));
    title.textContent = `Badge unlocked: ${b.name}`;
    sub.textContent = b.desc;
  } else {
    toast.append(medal({ id: 'many', name: '', desc: '', mark: String(batch.length), earned: () => true }));
    title.textContent = `${batch.length} badges unlocked`;
    sub.textContent = batch.slice(0, 3).map((b) => b.name).join(', ') + (batch.length > 3 ? ' and more' : '');
  }
  text.append(title, sub);
  toast.append(text);
  lift(toast);
  requestAnimationFrame(() => toast.classList.add('in'));
  const close = () => {
    toast.classList.remove('in');
    setTimeout(() => { toast.remove(); showing = false; next(); }, 250);
  };
  const timer = setTimeout(close, SHOW_MS);
  toast.addEventListener('click', () => { clearTimeout(timer); close(); });
}

function next() {
  if (showing) return;
  const batch = queue.shift();
  if (batch) show(batch);
}

/** Up to two new badges get a popup each; more at once (say, everything earned before badges existed) share one. */
function announce(fresh: Badge[]) {
  if (!fresh.length) return;
  dispatchEvent(new Event('games:badges')); // pages showing badges (the profile) redraw
  if (fresh.length <= 2) for (const b of fresh) queue.push([b]);
  else queue.push(fresh);
  next();
}

let timer = 0;
/** Checks badges a moment after something changed, so the game has finished writing its stats too. */
export function scheduleCheck(delay = 700) {
  clearTimeout(timer);
  timer = window.setTimeout(() => { void checkBadges().then(announce).catch(() => { /* no game list offline: try later */ }); }, delay);
}

export function startBadges() {
  addEventListener('games:progress', () => scheduleCheck());
  scheduleCheck(1200);
}
