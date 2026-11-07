import type { Guide } from './guides';

/** The body of a game's rules: its example, then the steps, controls and tips. The how-to page and the in-game
 *  rules dialog both draw this, so the two always match. */
export function guideBody(g: Guide) {
  const items = (list: string[]) => list.map((s) => `<li>${s}</li>`).join('');
  return [
    g.example
      ? `<figure class="example"><div class="example-art">${g.example.html}</div><figcaption>${g.example.caption}</figcaption></figure>`
      : '',
    '<h2 class="section-label">How it works</h2>',
    `<ol class="steps">${items(g.steps)}</ol>`,
    '<h2 class="section-label">Controls</h2>',
    `<ul class="guide-notes">${items(g.controls)}</ul>`,
    g.tips.length ? `<h2 class="section-label">Tips</h2><ul class="guide-notes">${items(g.tips)}</ul>` : '',
  ].join('');
}
