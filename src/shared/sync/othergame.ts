// "Continue from other device" on a game's menu. When both devices have a game in progress, sync keeps this device's
// (see current.ts) and the other one beside it; this adds a second Continue under the game's own, which swaps it in.
// Every game's menu has the same #continue-btn, so this works for all of them without touching any game.

import { hasOwnGame, otherGame, takeOtherGame } from './engine';
import { notStarted } from './current';

const RESUME = 'sync.resume'; // sessionStorage: open the game straight away after the page reloads with it

let button: HTMLButtonElement | null = null;

function render() {
  const main = document.getElementById('continue-btn');
  if (!main) return;
  const other = otherGame();
  if (other === null || notStarted(other)) { button?.remove(); button = null; return; }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn continue other-game';
    const label = document.createElement('span');
    label.textContent = 'Continue from other device';
    button.append(label, document.createElement('small'));
    button.addEventListener('click', () => {
      try { sessionStorage.setItem(RESUME, location.pathname); } catch { /* opens on the menu instead */ }
      takeOtherGame();
    });
    main.after(button);
  }
  // Only mention replacing a game the player can see: a game's own Continue is hidden for one with no moves yet.
  button.querySelector('small')!.textContent = hasOwnGame() && !main.hidden ? "Replaces this device's game" : '';
}

export function initOtherGame() {
  if (!document.getElementById('continue-btn')) return;
  let resume = false;
  try { resume = sessionStorage.getItem(RESUME) === location.pathname; sessionStorage.removeItem(RESUME); } catch { /* ignore */ }
  if (resume) {
    const main = document.getElementById('continue-btn');
    if (main && !main.hidden) main.click();
  }
  render();
  // The game's own menu shows and hides its Continue as games start and end.
  new MutationObserver(render).observe(document.getElementById('continue-btn')!, { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('games:othergame', render);
  addEventListener('games:synced', render);
}
