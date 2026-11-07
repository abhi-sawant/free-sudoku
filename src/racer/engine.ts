// Road Racer rules, free of any drawing. The world is a fixed 360×420 box: a straight road with lanes, the
// player's car near the bottom and traffic coming down. A tap changes lane; hitting a car ends the run.

export const W = 360;
export const H = 420;
export const ROAD_X = 30;
export const ROAD_W = 300;
export const CAR_Y = 330; // top edge of the player's car
export const CAR_H = 52;

export type Level = 'country' | 'highway' | 'city' | 'night';
export const LEVELS: Level[] = ['country', 'highway', 'city', 'night'];

interface LevelSpec {
  lanes: number;
  base: number; // starting speed, world units per second
  max: number;
  boost: number; // speed gained at each speed-up
  gap: number; // fewest seconds between rows of traffic
  fill: number; // chance that each lane other than the safe one gets a car in a row
}

export const SPECS: Record<Level, LevelSpec> = {
  country: { lanes: 3, base: 170, max: 290, boost: 20, gap: 1.1, fill: 0.35 },
  highway: { lanes: 4, base: 200, max: 340, boost: 24, gap: 0.9, fill: 0.4 },
  city: { lanes: 4, base: 230, max: 390, boost: 28, gap: 0.75, fill: 0.5 },
  night: { lanes: 5, base: 260, max: 440, boost: 32, gap: 0.65, fill: 0.5 },
};

const BOOST_EVERY = 8; // seconds between speed-ups
const EASE = 45; // how fast the road eases up to a new speed, (units per second, each second)
const STEER_SPEED = 900; // how fast the car slides to its lane
const SCORE_PER = 100; // world units of road for one point

export interface Traffic { lane: number; y: number; w: number; h: number; truck: boolean }

export interface World {
  level: Level;
  lanes: number;
  lane: number; // the lane the car is moving to
  x: number; // centre of the car
  speed: number;
  target: number; // the speed the road is easing toward
  time: number;
  boosts: number; // how many speed-ups so far
  distance: number;
  offset: number; // how far the road markings have scrolled
  traffic: Traffic[];
  safe: number; // a lane left free in the latest row, so every row can be passed
  sinceRow: number;
  nextRow: number;
  score: number;
  over: boolean;
}

export const laneWidth = (lanes: number) => ROAD_W / lanes;
export const laneX = (lanes: number, lane: number) => ROAD_X + laneWidth(lanes) * (lane + 0.5);
export const carWidth = (lanes: number) => Math.min(34, laneWidth(lanes) * 0.6);

export function createWorld(level: Level): World {
  const s = SPECS[level];
  const lane = Math.floor(s.lanes / 2);
  return {
    level, lanes: s.lanes, lane, x: laneX(s.lanes, lane), speed: s.base, target: s.base, time: 0, boosts: 0, distance: 0, offset: 0,
    traffic: [], safe: lane, sinceRow: 0, nextRow: 140, score: 0, over: false,
  };
}

/** Move one lane left (-1) or right (1). */
export function steer(w: World, dir: -1 | 1) {
  if (w.over) return;
  w.lane = Math.max(0, Math.min(w.lanes - 1, w.lane + dir));
}

function addRow(w: World, rng: () => number) {
  const s = SPECS[w.level];
  // The safe lane drifts at most one lane a row, which is always reachable with one tap.
  const drift = Math.floor(rng() * 3) - 1;
  w.safe = Math.max(0, Math.min(w.lanes - 1, w.safe + drift));
  const cw = carWidth(w.lanes);
  for (let lane = 0; lane < w.lanes; lane++) {
    if (lane === w.safe || rng() > s.fill) continue;
    const truck = rng() < 0.2;
    w.traffic.push({ lane, y: -90, w: cw, h: truck ? 80 : CAR_H, truck });
  }
}

export function step(w: World, dt: number, rng: () => number = Math.random) {
  if (w.over) return;
  const s = SPECS[w.level];
  // Every few seconds the road gets a little faster, easing up to the new speed rather than jumping.
  w.time += dt;
  if (w.time >= (w.boosts + 1) * BOOST_EVERY && w.target < s.max) {
    w.boosts++;
    w.target = Math.min(s.max, w.target + s.boost);
  }
  w.speed = Math.min(w.target, w.speed + EASE * dt);
  const dy = w.speed * dt;
  w.distance += dy;
  w.offset += dy;
  w.score = Math.floor(w.distance / SCORE_PER);

  const target = laneX(w.lanes, w.lane);
  const dx = target - w.x;
  const move = STEER_SPEED * dt;
  w.x = Math.abs(dx) <= move ? target : w.x + Math.sign(dx) * move;

  for (const t of w.traffic) t.y += dy;
  w.traffic = w.traffic.filter((t) => t.y < H + 10);

  w.sinceRow += dy;
  if (w.sinceRow >= w.nextRow) {
    addRow(w, rng);
    w.sinceRow = 0;
    w.nextRow = w.speed * s.gap * (1 + rng() * 0.6);
  }

  const cw = carWidth(w.lanes);
  for (const t of w.traffic) {
    const tx = laneX(w.lanes, t.lane);
    if (Math.abs(tx - w.x) < (cw + t.w) / 2 - 3 && t.y < CAR_Y + CAR_H - 4 && t.y + t.h > CAR_Y + 4) {
      w.over = true;
      return;
    }
  }
}
