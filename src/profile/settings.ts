// The profile's settings: Appearance (the theme picker), Install (web only, until installed) and Account (the
// account's settings when signed in, one sign-in card when not). Also keeps the banner's name: the account's display
// name, remembered on this device as `games.name` so it stays after signing out with "Keep progress".

import { mountThemePicker } from '../shared/themepicker';
import { setupInstallButton } from '../shared/install';
import { isSignedIn, loadSession } from '../shared/sync/session';
import { initAccount } from './account';

const NAME = 'games.name'; // not a sync key: just this device's memory of the name
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function showName(name: string | null) {
  try {
    if (name) localStorage.setItem(NAME, name); else if (name === null && !isSignedIn()) localStorage.removeItem(NAME);
  } catch { /* storage unavailable */ }
  let shown = loadSession()?.user.displayName || '';
  try { shown ||= localStorage.getItem(NAME) ?? ''; } catch { /* ignore */ }
  shown ||= 'You';
  $('profile-name').textContent = shown;
  $('profile-avatar').textContent = shown.trim().charAt(0).toUpperCase() || 'Y';
}

export function initSettings(): void {
  mountThemePicker($('theme-grid'));
  $('install').hidden = !setupInstallButton($<HTMLButtonElement>('install-btn'));
  $('install-btn').addEventListener('installed', () => { $('install').hidden = true; });

  const signedIn = isSignedIn();
  $('account-in').hidden = !signedIn;
  $('account-out').hidden = signedIn;
  showName(loadSession()?.user.displayName ?? '');
  if (signedIn) initAccount(showName);
  // Signed out elsewhere (another tab, or the session expired): swap to the sign-in card.
  addEventListener('games:auth', () => {
    if (isSignedIn()) return;
    $('account-in').hidden = true;
    $('account-out').hidden = false;
    showName('');
  });
}
