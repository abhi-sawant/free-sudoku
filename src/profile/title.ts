// The personality title in the profile's banner, and the picker it opens: one chip per unlocked adjective and noun, a
// live preview, "Pick for me" to go back to the automatic title. The choice is saved in `games.title`, which syncs, so
// a title picked on one device shows on every device; the page redraws it whenever its numbers change.

import { type Title, type TitleInput, autoTitle, formatTitle, titleWords } from '../shared/titles';
import { loadTitle, saveTitle } from '../shared/title-store';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** The title to show: the player's pick, or the automatic one. */
function current(inp: TitleInput): { title: Title; picked: boolean } {
  const s = loadTitle();
  return s && !('auto' in s) ? { title: { adj: s.adj, noun: s.noun }, picked: true } : { title: autoTitle(inp), picked: false };
}

/** Wires the banner's title and its picker. Returns the redraw, which the page calls whenever its numbers change. */
export function initTitle(button: HTMLButtonElement, getInput: () => TitleInput): () => void {
  const dialog = $<HTMLDialogElement>('title-dialog');
  let draft: Title = current(getInput()).title;

  const render = () => { button.textContent = formatTitle(current(getInput()).title); };

  function chips(el: HTMLElement, words: string[], key: keyof Title) {
    el.replaceChildren(...words.map((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = w;
      b.setAttribute('aria-pressed', String(draft[key] === w));
      b.addEventListener('click', () => {
        draft = { ...draft, [key]: w };
        for (const other of el.children) other.setAttribute('aria-pressed', String(other === b));
        $('title-preview').textContent = formatTitle(draft);
      });
      return b;
    }));
  }

  button.addEventListener('click', () => {
    const inp = getInput();
    draft = current(inp).title;
    const words = titleWords(inp, draft);
    chips($('title-adjs'), words.adjectives, 'adj');
    chips($('title-nouns'), words.nouns, 'noun');
    $('title-preview').textContent = formatTitle(draft);
    dialog.showModal();
  });
  $('title-done').addEventListener('click', () => {
    const was = current(getInput());
    // Leaving the automatic title as it was keeps it automatic, so it goes on following how you play.
    if (was.picked || draft.adj !== was.title.adj || draft.noun !== was.title.noun) saveTitle(draft);
    dialog.close();
    render();
  });
  $('title-auto').addEventListener('click', () => {
    saveTitle('auto');
    dialog.close();
    render();
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  render();
  return render;
}

/** Without the games list there are no numbers to work a title out from: show the player's own pick, or nothing. */
export function showStoredTitle(button: HTMLButtonElement): void {
  const s = loadTitle();
  if (s && !('auto' in s)) button.textContent = formatTitle({ adj: s.adj, noun: s.noun });
  else button.hidden = true;
}
