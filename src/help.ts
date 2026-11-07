// The ? button in a game's top bar, just before the timer (or the tally or score), and the dialog it opens
// with that game's rules. Opening it pauses the game; closing it carries on. Every game page loads this through
// pwa.ts, so a game needs no markup of its own. The rules themselves load on the first tap, not with the page.

const bar = document.querySelector<HTMLElement>('#game .topbar');
const slug = location.pathname.slice(import.meta.env.BASE_URL.length).split('/')[0];

if (bar && slug && slug !== 'howto') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn help-btn';
  button.setAttribute('aria-label', 'How to play');
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 9.2a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.1M12 17.6v.01" /></svg>';
  bar.insertBefore(button, bar.lastElementChild);
  button.addEventListener('click', () => void open());

  let dialog: HTMLDialogElement | null = null;

  async function open() {
    if (!dialog) {
      const [{ GUIDES }, { guideBody }] = await Promise.all([
        import('./howto/guides'),
        import('./howto/render'),
        import('./howto/guide.css'),
      ]);
      const guide = Object.hasOwn(GUIDES, slug) ? GUIDES[slug] : null;
      if (!guide) return;
      dialog = document.createElement('dialog');
      dialog.className = 'dialog guide-dialog';
      dialog.setAttribute('aria-labelledby', 'guide-title');
      dialog.innerHTML = `
        <header class="guide-head">
          <h2 id="guide-title">${guide.name}</h2>
          <button type="button" class="icon-btn guide-close" aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div class="guide-scroll">
          <p class="guide-goal">${guide.goal}</p>
          ${guideBody(guide)}
        </div>`;
      document.body.append(dialog);
      dialog.querySelector('.guide-close')!.addEventListener('click', () => dialog!.close());
      // A tap on the backdrop (the dialog element itself, outside its box) closes it too.
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog!.close(); });
      dialog.addEventListener('close', resume);
    }
    if (dialog.open) return;
    pause();
    dialog.showModal();
    dialog.querySelector('.guide-scroll')!.scrollTop = 0;
  }

  // Pause by pressing the game's own timer, which only counts as ours if it was running and the press stopped it.
  // A game with no timer is told with an event instead (Crazy Cat listens for it).
  const timer = document.getElementById('timer');
  let paused = false;

  function pause() {
    if (timer?.getAttribute('aria-label') === 'Pause') {
      timer.click();
      paused = timer.getAttribute('aria-label') === 'Resume';
    }
    document.dispatchEvent(new CustomEvent('guide:open'));
  }

  function resume() {
    if (paused && timer?.getAttribute('aria-label') === 'Resume') timer.click();
    paused = false;
  }
}
