// The colour theme: one of the looks in src/themes.css, kept in localStorage and set on <html> as data-theme.
// Every page also sets it from an inline script in its <head> so the first paint is already in the chosen theme;
// this module keeps the browser's theme-color in step and gives the home page's picker its list.

export const THEMES = [
  { id: 'mist', name: 'Mist', note: 'Cool and airy, white tiles on blue-grey' },
  { id: 'linen', name: 'Linen', note: 'Warm cream paper and serif titles' },
  { id: 'sage', name: 'Sage', note: 'Muted greens, pill shapes, no shadows' },
  { id: 'graph', name: 'Graph Paper', note: 'A printed grid and ballpoint blue' },
  { id: 'block', name: 'Block Party', note: 'Flat primaries and bold ink lines' },
  { id: 'pocket', name: 'Pocket', note: 'A handheld LCD in four greens' },
  { id: 'midnight', name: 'Midnight', note: 'True black with glowing accents' },
  { id: 'brutal', name: 'Neo-brutalist', note: 'Black borders and hard shadows on cream' },
  { id: 'terminal', name: 'Terminal', note: 'Amber phosphor on black, in monospace' },
  { id: 'blueprint', name: 'Blueprint', note: 'White lines on drafting blue' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'mist';
const KEY = 'games.theme';

const isTheme = (id: unknown): id is ThemeId => THEMES.some((t) => t.id === id);

export function getTheme(): ThemeId {
  try {
    const id = localStorage.getItem(KEY);
    if (isTheme(id)) return id;
  } catch { /* storage unavailable: the default */ }
  return DEFAULT_THEME;
}

/** Points the browser's chrome (the address bar, the Android status bar) at the theme's paper. */
function syncThemeColor() {
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  if (!paper) return;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = paper;
}

/** Graph Paper draws its pen outlines through this displacement filter (see src/themes/graph.css). */
function syncRoughFilter(id: ThemeId) {
  const have = document.getElementById('rough-filter');
  if (id !== 'graph') return have?.remove();
  if (have) return;
  const wrap = document.createElement('div');
  wrap.id = 'rough-filter';
  wrap.hidden = true;
  wrap.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
  document.body.append(wrap);
}

export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  syncRoughFilter(id);
  try { localStorage.setItem(KEY, id); } catch { /* the choice just isn't remembered */ }
  syncThemeColor();
}

document.documentElement.dataset.theme = getTheme();
syncRoughFilter(getTheme());
syncThemeColor();
// The paper changes with the system's light and dark setting.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);
