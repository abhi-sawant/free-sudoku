// The Install button (on the profile): installs the PWA when the browser offers it, otherwise (Safari, Firefox, or no
// prompt available) sends the player to the latest release to download the Android app. Hidden once installed, and in
// the Android app itself.

import { Capacitor } from '@capacitor/core';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Shows `btn` and wires it up, unless this is already the installed app. Returns whether it is shown. */
export function setupInstallButton(btn: HTMLButtonElement): boolean {
  if (Capacitor.isNativePlatform() || matchMedia('(display-mode: standalone)').matches) return false;
  let deferred: InstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    btn.dispatchEvent(new Event('installed', { bubbles: true }));
    deferred = null;
  });
  btn.addEventListener('click', async () => {
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      await prompt.prompt();
    } else {
      window.open('https://github.com/abhi-sawant/games/releases/latest', '_blank', 'noopener');
    }
  });
  btn.hidden = false;
  return true;
}
