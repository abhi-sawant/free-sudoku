// Keeps this device's progress and the account's copy in step, quietly. Signed out, none of this runs and nothing
// leaves the device. Signed in, every save of a synced key (see merge.ts: history, stats, badges, ...) is queued and
// pushed a few seconds later, and the server's changes are pulled when the page opens, regains focus or comes back
// online. Offline, changes simply wait in the queue. A failure never reaches the player; it just tries again later.
//
// The server only stores values and a revision number per key. A push names the revision this device last saw, and
// the server refuses it if another device got there first; this device then merges the newer copy with its own
// (merge.ts) and pushes again. Merging is order-independent, so devices always settle on the same result.

import { archiveKey, loadArchive } from '../archive';
import { foldOverflow, isSyncKey, kindOf, mergeItem, sameValue } from './merge';
import { otherKey, resolveCurrent } from './current';
import { ApiError, KEEPALIVE_MAX, pullItems, pushItems, pushOnClose } from './api';
import { type SyncState, emptyState, loadSession, loadState, resetState, saveState } from './session';

/** The open game page's game in progress (`sudoku.current` on /sudoku/), or '' on other pages. */
const pageKey = (() => {
  const parts = location.pathname.slice(import.meta.env.BASE_URL.length).split('/');
  return parts.length > 1 && /^[a-z0-9]+$/.test(parts[0]) ? `${parts[0]}.current` : '';
})();
/** Synced keys this page has changed since it loaded. */
const touched = new Set<string>();
let reloadPage = false; // a newer game arrived for the open, unplayed page: reload once this sync is done
let reloading = false; // reloading: the page's last save on the way out would be its old game, so it is dropped
let otherChanged = false; // this run changed a game kept from the other device

let applying = false; // true while sync itself writes a key, so that write isn't queued as a change
let state: SyncState = emptyState();
let running = false;
let rerun = false;
let timer: number | undefined;
let retryTimer: number | undefined;
let failures = 0;
let started = false;
let active = false; // signed in on this device, so changes are queued
let changed = false; // this run wrote a merged value into storage

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
let status: SyncStatus = 'idle';
export const syncStatus = () => status;
export const lastSyncAt = () => loadState().lastSyncAt;
function setStatus(s: SyncStatus) {
  if (s !== status) { status = s; dispatchEvent(new Event('games:syncstatus')); }
}

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };

function write(key: string, value: string | null) {
  applying = true;
  try {
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* storage full or unavailable */ } finally { applying = false; }
}

// ---------- Change tracking ----------

let saveTimer: number | undefined;
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveState(state), 1000);
}

function markDirty(key: string) {
  if (!active) return;
  state.dirty[key] = Date.now();
  persistSoon();
  schedule(4000);
}

/**
 * Wraps localStorage writes so a changed synced key is queued. The seal layer underneath is untouched. Writing back
 * exactly what is already there is not a change: otherwise a page re-saving the old game it loaded would look newer
 * than a game that just arrived from the other device.
 */
function watchStorage() {
  const proto = Storage.prototype;
  const set = proto.setItem, remove = proto.removeItem;
  const changedBy = (s: Storage, k: string, v: string | null) => {
    if (applying || s !== localStorage || !isSyncKey(k) || s.getItem(k) === v) return false;
    touched.add(k);
    return true;
  };
  proto.setItem = function (this: Storage, k: string, v: string) {
    if (reloading && this === localStorage && k === pageKey) return;
    const changed = changedBy(this, k, String(v));
    set.call(this, k, v);
    if (changed) markDirty(k);
  };
  proto.removeItem = function (this: Storage, k: string) {
    if (reloading && this === localStorage && k === pageKey) return;
    const changed = changedBy(this, k, null);
    remove.call(this, k);
    if (changed) markDirty(k);
  };
}

/** Right after signing in: queue everything already on this device so it reaches the account. */
function queueExistingSaves() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSyncKey(k) && state.revs[k] === undefined && !state.dirty[k]) state.dirty[k] = Date.now();
  }
  state.scanned = true;
}

// ---------- Merging one key ----------

/** Merges a server copy into this device's. Returns whether the merged result still has to be pushed. */
function applyRemote(key: string, remote: string | null, remoteAt: number): boolean {
  const local = read(key);
  const localNewer = (state.dirty[key] ?? 0) > remoteAt;

  if (kindOf(key) === 'current') {
    const c = resolveCurrent(local, remote, localNewer, key !== pageKey ? 'none' : touched.has(key) ? 'touched' : 'untouched');
    const ok = otherKey(key);
    if (!sameValue(read(ok), c.other)) { write(ok, c.other); otherChanged = true; }
    if (!sameValue(c.value, local)) { write(key, c.value); changed = true; }
    if (c.reload) reloadPage = true;
    return !sameValue(c.value, remote);
  }

  const r = mergeItem(key, local, remote, localNewer);

  if (r.overflow?.length) {
    // The merged history is capped at 500; what fell off the end joins the game's archive.
    const ak = archiveKey(key);
    const folded = foldOverflow(loadArchive(key), r.overflow);
    write(ak, JSON.stringify(folded));
    state.dirty[ak] = Date.now();
  }
  if (!sameValue(r.value, local)) {
    write(key, r.value);
    changed = true;
  }
  return !sameValue(r.value, remote);
}

// ---------- One sync ----------

async function pull(): Promise<void> {
  for (;;) {
    const res = await pullItems(state.rev);
    for (const it of res.items) {
      if ((state.revs[it.key] ?? 0) >= it.rev) continue; // already have it (our own push coming back)
      state.revs[it.key] = it.rev;
      if (!isSyncKey(it.key)) continue;
      const at = Date.parse(it.updatedAt.replace(' ', 'T') + 'Z') || 0;
      if (applyRemote(it.key, it.value, at)) state.dirty[it.key] = state.dirty[it.key] ?? Date.now();
      else delete state.dirty[it.key];
    }
    const last = res.items.at(-1)?.rev;
    state.rev = res.more && last ? last : Math.max(state.rev, res.rev);
    if (!res.more) return;
  }
}

async function push(): Promise<void> {
  for (let round = 0; round < 4; round++) {
    const keys = Object.keys(state.dirty).filter(isSyncKey);
    if (!keys.length) return;
    let conflicts = 0;
    for (let i = 0; i < keys.length; i += 50) {
      const batch = keys.slice(i, i + 50);
      const stamped = Object.fromEntries(batch.map((k) => [k, state.dirty[k]]));
      const res = await pushItems(batch.map((k) => ({ key: k, value: read(k), baseRev: state.revs[k] ?? 0 })));
      for (const r of res.results) {
        state.revs[r.key] = r.rev;
        if (r.status === 'ok') {
          // Only clear the flag if the key wasn't changed again while the request was in flight.
          if (state.dirty[r.key] === stamped[r.key]) delete state.dirty[r.key];
        } else {
          conflicts++;
          const stillNeeds = applyRemote(r.key, r.value ?? null, 0);
          if (!stillNeeds) delete state.dirty[r.key];
          else state.dirty[r.key] = Date.now();
        }
      }
    }
    if (!conflicts) return;
  }
}

async function runOnce() {
  state = reconcile(loadState());
  if (!state.scanned) queueExistingSaves();
  changed = false;
  otherChanged = false;
  await pull();
  await push();
  state.lastSyncAt = Date.now();
  saveState(state);
  if (changed) dispatchEvent(new Event('games:synced'));
  if (otherChanged) dispatchEvent(new Event('games:othergame'));
  if (reloadPage) {
    reloading = true;
    location.reload();
  }
}

/** The page is closing: send the games in progress it changed, so the other device can pick them up. */
function pushPendingOnClose() {
  if (!active) return;
  const items: { key: string; value: string | null; baseRev: number }[] = [];
  let size = 0;
  for (const key of Object.keys(state.dirty)) {
    if (kindOf(key) !== 'current') continue;
    const value = read(key);
    size += key.length + (value?.length ?? 0) + 40;
    if (size > KEEPALIVE_MAX) break;
    items.push({ key, value, baseRev: state.revs[key] ?? 0 });
  }
  pushOnClose(items);
}

/** Joins the saved state with changes made in this page that haven't been saved to it yet. */
function reconcile(disk: SyncState): SyncState {
  for (const [k, t] of Object.entries(state.dirty)) if (!((disk.dirty[k] ?? 0) > t)) disk.dirty[k] = t;
  return disk;
}

/** Syncs now. One at a time; a request that arrives mid-sync runs once more afterwards. */
export async function syncNow(): Promise<void> {
  if (!loadSession()) return;
  if (running) { rerun = true; return; }
  running = true;
  setStatus('syncing');
  try {
    const locks = navigator.locks;
    if (locks) await locks.request('games-sync', runOnce); else await runOnce();
    failures = 0;
    setStatus('idle');
  } catch (e) {
    failures++;
    setStatus(e instanceof ApiError && e.offline ? 'offline' : 'error');
    saveState(state);
    clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => void syncNow(), Math.min(30_000 * 2 ** (failures - 1), 15 * 60_000));
  } finally {
    running = false;
    if (rerun) { rerun = false; schedule(500); }
  }
}

let due = 0; // when the scheduled sync runs (epoch ms), 0 for none

/** Syncs in `ms`, unless one is already due sooner: a save on the page must never push back the pull it opened with. */
function schedule(ms: number) {
  const at = Date.now() + ms;
  if (due && due <= at) return;
  clearTimeout(timer);
  due = at;
  timer = window.setTimeout(() => { due = 0; void syncNow(); }, ms);
}

// ---------- Start and stop ----------

function start() {
  active = true;
  if (started) return;
  started = true;
  watchStorage();
  addEventListener('games:progress', () => schedule(3000));
  addEventListener('online', () => schedule(500));
  addEventListener('pagehide', () => { saveState(state); pushPendingOnClose(); });
  // Hidden (tab switched, app sent to the background, screen off): send changes now rather than in a few seconds,
  // as the page may never come back. A game's own save on hiding runs first (it was registered earlier).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { schedule(500); return; }
    saveState(state);
    if (!reloading && Object.keys(state.dirty).length) void syncNow();
  });
  setInterval(() => { if (!document.hidden) void syncNow(); }, 2 * 60_000);
  addEventListener('games:auth', () => { if (!loadSession()) stopSync(); });
}

/** Starts syncing if this device is signed in. Safe to call on every page; later calls do nothing. */
export function initSync() {
  if (active || !loadSession()) return;
  state = loadState();
  start();
  schedule(1500);
}

/** Called right after signing in on this device: starts watching and does the first sync. */
export function startSyncAfterSignIn() {
  resetState();
  state = emptyState();
  start();
  void syncNow();
}

/** Signed out: stop queueing changes. Progress stays on the device. */
export function stopSync() {
  active = false;
  clearTimeout(timer);
  due = 0;
  clearTimeout(retryTimer);
  state = emptyState();
  resetState();
  setStatus('idle');
}

// ---------- The game from the other device ----------

/** The open game page's game kept from the other device (see current.ts), or null. */
export const otherGame = (): string | null => (pageKey ? read(otherKey(pageKey)) : null);
/** Whether the open game page has a game in progress of its own. */
export const hasOwnGame = (): boolean => !!pageKey && read(pageKey) !== null;

/** Puts the game from the other device in place of this one's, queued for upload, and reloads the page to show it. */
export function takeOtherGame(): void {
  const other = otherGame();
  if (other === null) return;
  localStorage.setItem(pageKey, other); // through the watcher: a change like a move, so it is uploaded
  write(otherKey(pageKey), null);
  saveState(state);
  reloading = true;
  location.reload();
}

/** Removes every synced save from this device (for signing out on a shared device). The account keeps its copy. */
export function clearLocalProgress() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (isSyncKey(k) || (k.endsWith('.other') && kindOf(k.slice(0, -6)) === 'current'))) keys.push(k);
  }
  applying = true;
  try { for (const k of keys) localStorage.removeItem(k); } finally { applying = false; }
}
