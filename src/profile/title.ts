// The personality title in the profile's banner. (The picker is added in the next step.)

import { type TitleInput, autoTitle, formatTitle } from '../shared/titles';

export function initTitle(button: HTMLButtonElement, getInput: () => TitleInput): void {
  button.textContent = formatTitle(autoTitle(getInput()));
}
