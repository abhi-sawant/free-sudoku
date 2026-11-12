// What this device remembers about the account: who is signed in, the tokens, and where syncing has got to. All of it
// lives in localStorage under `sync.*` keys, which are never synced themselves (see merge.ts).

export interface User { id: number; email: string; displayName: string; createdAt?: string }
export interface Session {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  accessExpiresAt: number;
  user: User;
}

const SESSION = 'sync.session';
const DEVICE = 'sync.device';

function read<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null; } catch { return null; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or unavailable */ }
}

export const loadSession = (): Session | null => {
  const s = read<Session>(SESSION);
  return s && typeof s.accessToken === 'string' && typeof s.refreshToken === 'string' ? s : null;
};
export const saveSession = (s: Session) => write(SESSION, s);
export function clearSession() {
  try { localStorage.removeItem(SESSION); } catch { /* ignore */ }
  dispatchEvent(new Event('games:auth'));
}
export const isSignedIn = () => loadSession() !== null;

/** A random id for this browser or app install, so the server can list "your devices". */
export function deviceId(): string {
  let id = '';
  try { id = localStorage.getItem(DEVICE) ?? ''; } catch { /* ignore */ }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(DEVICE, id); } catch { /* ignore */ }
  }
  return id;
}

/** "Chrome on macOS": a human name for this device in the account's device list. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/Capacitor|; wv\)/.test(ua) || (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) return 'Android app';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${os}`;
}

// ---------- Sync progress ----------

export interface SyncState {
  /** The server's newest revision this device has pulled. */
  rev: number;
  /** The server revision each key had when this device last saw it. */
  revs: Record<string, number>;
  /** Keys changed here since they were last pushed, with the time of the change (epoch ms). */
  dirty: Record<string, number>;
  /** Whether this device's existing saves have been queued for upload after sign-in. */
  scanned: boolean;
  lastSyncAt: number;
}

const STATE = 'sync.state';
export const emptyState = (): SyncState => ({ rev: 0, revs: {}, dirty: {}, scanned: false, lastSyncAt: 0 });

export function loadState(): SyncState {
  const s = read<Partial<SyncState>>(STATE) ?? {};
  return {
    rev: Number(s.rev) || 0,
    revs: s.revs && typeof s.revs === 'object' ? s.revs : {},
    dirty: s.dirty && typeof s.dirty === 'object' ? s.dirty : {},
    scanned: !!s.scanned,
    lastSyncAt: Number(s.lastSyncAt) || 0,
  };
}
export const saveState = (s: SyncState) => write(STATE, s);
export function resetState() { try { localStorage.removeItem(STATE); } catch { /* ignore */ } }
