// Small helpers shared by the account pages (sign in, sign up, forgot password, account).

import '../pwa';
import { ApiError } from '../shared/sync/api';
import { isSignedIn } from '../shared/sync/session';
import { startSyncAfterSignIn } from '../shared/sync/engine';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const param = (name: string) => new URLSearchParams(location.search).get(name);

export function showMessage(el: HTMLElement, text: string | null) {
  el.hidden = !text;
  el.textContent = text ?? '';
}

/** Runs a form action: disables the button while it works and shows any error under the form instead of throwing. */
export async function run(button: HTMLButtonElement, errorEl: HTMLElement | null, action: () => Promise<void>) {
  if (errorEl) showMessage(errorEl, null);
  button.disabled = true;
  try {
    await action();
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
    if (errorEl) showMessage(errorEl, msg); else alert(msg);
  } finally {
    button.disabled = false;
  }
}

/** Already signed in? These pages have nothing to do: go to the account. */
export function leaveIfSignedIn() {
  if (isSignedIn()) location.replace('/account/index.html');
}

/** After a new sign-in on this device: upload what's here, fetch what's there, and show the account. */
export function finishSignIn() {
  startSyncAfterSignIn();
  location.href = '/account/index.html';
}

export const emailOk = (v: string) => /^\S+@\S+\.\S+$/.test(v);

/** Keeps a code box to digits only. */
export function digitsOnly(input: HTMLInputElement) {
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
}

/** Disables a "send again" button for a while after it's used, counting down in its label. */
export function cooldown(button: HTMLButtonElement, label: string, seconds = 30) {
  let left = seconds;
  button.disabled = true;
  const tick = () => {
    if (left <= 0) { button.disabled = false; button.textContent = label; return; }
    button.textContent = `${label} (${left}s)`;
    left--;
    setTimeout(tick, 1000);
  };
  tick();
}
