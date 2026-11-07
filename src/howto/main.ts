import '../pwa';
import { GUIDES } from './guides';
import { guideBody } from './render';

// One page serves every game's guide: /howto/index.html?g=<game>. The game's menu links here, and so does the
// guide's own Play button back, so a new player can read the rules first and then start.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const slug = new URLSearchParams(location.search).get('g') ?? '';
const guide = Object.hasOwn(GUIDES, slug) ? GUIDES[slug] : null;

if (!guide) {
  location.replace('/');
} else {
  const game = `/${slug}/index.html`;
  document.title = `How to play ${guide.name}`;
  document.documentElement.classList.add(`ink-${guide.ink}`);
  $('title').textContent = guide.name;
  $('goal').textContent = guide.goal;
  $<HTMLAnchorElement>('back').href = game;
  $('back-label').textContent = guide.name;
  const play = $<HTMLAnchorElement>('play');
  play.href = game;
  play.textContent = `Play ${guide.name}`;
  $('guide-body').innerHTML = guideBody(guide);
}
