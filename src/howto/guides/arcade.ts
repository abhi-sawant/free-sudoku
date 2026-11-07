import type { Guide } from '../guides';
import { grid } from '../art';

export const arcade: Record<string, Guide> = {
  qubo: {
    name: 'Qubo',
    ink: 'cocoa',
    goal: 'Time your jumps from tower to tower for as long as you can.',
    steps: [
      'The cube stands on a tower that slowly tips toward the next one, faster and faster.',
      'Tap to throw the cube off the top, the way the tower is leaning. Land on the next tower for <b>1 point</b>.',
      'Tap too early and it falls short; too late and the tower goes over with the cube. Hitting the side of a tower ends the run too.',
      'Each new tower tips a little faster, and the towers get narrower. Your best score is saved.',
    ],
    controls: [
      '<b>Tap</b>, click or press <b>Space</b> to jump. The first tap only starts the tower tipping.',
    ],
    tips: [
      'The more the tower leans when you tap, the farther the cube flies. Wide gaps need a later tap.',
      'The cube also keeps the speed the tower is tipping at, so a late tap throws it farther than the lean alone.',
    ],
    example: {
      html: grid(5, ['cube|on small', '', '', '', 'tower|small'], 44),
      caption: 'Tap when the tower leans enough to reach the next one.',
    },
  },
  crazycat: {
    name: 'Crazy Cat',
    ink: 'cocoa',
    goal: 'Run as far as you can, jumping the obstacles and catching fish, until you hit one.',
    steps: [
      'The cat runs by itself. You only decide when to jump.',
      'Clear a crate to score <b>1 point</b>, and catch a fish for <b>2 points</b>.',
      'Tap again in the air for a higher jump.',
      'Running into an obstacle ends the run. Your best score is saved for each speed.',
    ],
    controls: [
      '<b>Tap</b>, click or press <b>Space</b> to jump. Do it again in the air to jump higher.',
      'Choose Kitten, Tabby or Crazy to set the speed.',
    ],
    tips: [
      'Jump a little early. A tap is not instant, so give the cat time to rise.',
      'Use the second jump to clear tall obstacles or to reach a fish up high.',
    ],
    example: {
      html: grid(5, ['cat|on small round', '', 'crate|coral small', 'fish|yellow small round', ''], 44),
      caption: 'Jump over the crate for a point, and catch the fish for two.',
    },
  },
};
