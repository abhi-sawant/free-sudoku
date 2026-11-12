// The theme picker: one radio per look in src/theme.ts, each swatch drawn in its own colours (src/themes/tokens.css keys
// off .theme-opt). Picking one applies it at once, on every page. Lives on the profile page.

import { THEMES, getTheme, setTheme } from '../theme';

export function mountThemePicker(grid: HTMLElement): void {
  grid.setAttribute('role', 'radiogroup');
  const options = THEMES.map((t) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-opt';
    btn.dataset.theme = t.id;
    btn.setAttribute('role', 'radio');
    btn.innerHTML = `<span class="theme-chip" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="theme-name"></span><span class="theme-note"></span>`;
    btn.querySelector('.theme-name')!.textContent = t.name;
    btn.querySelector('.theme-note')!.textContent = t.note;
    btn.addEventListener('click', () => {
      setTheme(t.id);
      mark();
      grid.dispatchEvent(new Event('change', { bubbles: true }));
    });
    grid.append(btn);
    return btn;
  });
  const mark = () => {
    const current = getTheme();
    for (const btn of options) btn.setAttribute('aria-checked', String(btn.dataset.theme === current));
  };
  mark();
}
