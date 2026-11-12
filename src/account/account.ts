import { $, run, showMessage } from './ui';
import {
  type DeviceSession, changePassword, deleteAccount, getAccount, listSessions, revokeSession, setDisplayName, setLeaderboardOptOut, signOut,
} from '../shared/sync/api';
import { clearSession, isSignedIn, loadSession } from '../shared/sync/session';
import { clearLocalProgress, lastSyncAt, stopSync, syncNow, syncStatus } from '../shared/sync/engine';

if (!isSignedIn()) location.replace('/signin/index.html');
addEventListener('games:auth', () => { if (!isSignedIn()) location.replace('/signin/index.html'); });

const ago = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function since(ms: number): string {
  const s = Math.round((ms - Date.now()) / 1000);
  if (Math.abs(s) < 60) return 'just now';
  if (Math.abs(s) < 3600) return ago.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return ago.format(Math.round(s / 3600), 'hour');
  return ago.format(Math.round(s / 86400), 'day');
}

// ---------- Profile ----------

const me = loadSession()?.user;
if (me) { $('email').textContent = me.email; $<HTMLInputElement>('name').value = me.displayName; }

void getAccount().then((r) => {
  $('email').textContent = r.user.email;
  $<HTMLInputElement>('name').value = r.user.displayName;
}).catch(() => { /* offline: the saved profile above stays */ });

$('name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('name-msg');
  void run($<HTMLButtonElement>('name-save'), msg, async () => {
    const u = await setDisplayName($<HTMLInputElement>('name').value.trim());
    $<HTMLInputElement>('name').value = u.displayName;
    showMessage(msg, 'Saved.');
  });
});

// ---------- Leaderboards ----------

const optin = $<HTMLInputElement>('lb-optin');
optin.checked = !loadSession()?.user.leaderboardOptOut;
void getAccount().then((r) => { optin.checked = !r.user.leaderboardOptOut; }).catch(() => { /* offline: the saved choice stays */ });
optin.addEventListener('change', () => {
  const msg = $('lb-msg');
  const on = optin.checked;
  optin.disabled = true;
  setLeaderboardOptOut(!on).then(() => {
    showMessage(msg, on ? 'You are on the leaderboards.' : 'You were removed from the leaderboards.');
    if (on) dispatchEvent(new Event('games:leaderboard')); // send every best again
  }).catch((e: unknown) => {
    optin.checked = !on;
    showMessage(msg, e instanceof Error ? e.message : 'Something went wrong. Please try again.');
  }).finally(() => { optin.disabled = false; });
});

// ---------- Sync ----------

function renderSync() {
  const last = lastSyncAt();
  const status = syncStatus();
  const line = $('sync-line');
  if (status === 'syncing') line.textContent = 'Syncing…';
  else if (status === 'offline') line.textContent = "You're offline. Your progress is saved here and will sync when you're back online.";
  else if (status === 'error') line.textContent = "Couldn't sync just now. We'll try again shortly.";
  else line.textContent = last ? `Your progress is in sync. Last synced ${since(last)}.` : 'Your progress will sync in a moment.';
  $<HTMLButtonElement>('sync-now').disabled = status === 'syncing';
}
addEventListener('games:syncstatus', renderSync);
addEventListener('games:synced', renderSync);
renderSync();
setInterval(renderSync, 30_000);
$('sync-now').addEventListener('click', () => void syncNow());
void syncNow();

// ---------- Devices ----------

function renderDevices(list: DeviceSession[]) {
  const ul = $('devices');
  ul.replaceChildren();
  for (const d of list) {
    const li = document.createElement('li');
    li.className = 'device';
    const text = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = d.current ? `${d.device} (this device)` : d.device;
    const when = document.createElement('span');
    when.className = 'muted';
    when.textContent = d.current ? 'Active now' : `Last active ${since(Date.parse(d.lastSeenAt.replace(' ', 'T') + 'Z'))}`;
    text.append(name, when);
    li.append(text);
    if (!d.current) {
      const out = document.createElement('button');
      out.className = 'btn btn-quiet';
      out.type = 'button';
      out.textContent = 'Sign out';
      out.addEventListener('click', () => void run(out, $('page-error'), async () => { await revokeSession(d.id); void loadDevices(); }));
      li.append(out);
    }
    ul.append(li);
  }
}
async function loadDevices() {
  try { renderDevices((await listSessions()).sessions); } catch { $('devices').textContent = ''; }
}
void loadDevices();

// ---------- Dialogs ----------

const dlg = (id: string) => $<HTMLDialogElement>(id);
function wireDialog(d: HTMLDialogElement) {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}
['signout-dialog', 'password-dialog', 'delete-dialog'].forEach((id) => wireDialog(dlg(id)));

// Sign out
$('signout').addEventListener('click', () => dlg('signout-dialog').showModal());
$('signout-cancel').addEventListener('click', () => dlg('signout-dialog').close());
async function leave(clear: boolean) {
  await signOut();
  stopSync();
  if (clear) clearLocalProgress();
  location.href = '/';
}
$('signout-keep').addEventListener('click', () => void run($<HTMLButtonElement>('signout-keep'), null, () => leave(false)));
$('signout-clear').addEventListener('click', () => void run($<HTMLButtonElement>('signout-clear'), null, () => leave(true)));

// Change password
$('change-password').addEventListener('click', () => {
  showMessage($('password-error'), null);
  ($('password-form') as HTMLFormElement).reset();
  dlg('password-dialog').showModal();
});
$('password-cancel').addEventListener('click', () => dlg('password-dialog').close());
$('password-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('password-error');
  const next = $<HTMLInputElement>('new-password').value;
  if (next.length < 8) return showMessage(err, 'Use at least 8 characters for the new password.');
  void run($<HTMLButtonElement>('password-submit'), err, async () => {
    await changePassword($<HTMLInputElement>('current-password').value, next);
    dlg('password-dialog').close();
    void loadDevices();
  });
});

// Delete account
$('delete').addEventListener('click', () => {
  showMessage($('delete-error'), null);
  ($('delete-form') as HTMLFormElement).reset();
  dlg('delete-dialog').showModal();
});
$('delete-cancel').addEventListener('click', () => dlg('delete-dialog').close());
$('delete-form').addEventListener('submit', (e) => {
  e.preventDefault();
  void run($<HTMLButtonElement>('delete-submit'), $('delete-error'), async () => {
    await deleteAccount($<HTMLInputElement>('delete-password').value);
    clearSession();
    stopSync();
    location.href = '/';
  });
});
