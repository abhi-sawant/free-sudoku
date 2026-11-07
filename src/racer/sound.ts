import { loadJSON, saveJSON } from '../shared/store';

// Road Racer's sound, made on the spot with the Web Audio API so there are no files to download or cache: an
// engine hum that rises with the speed, a swish for each lane change and a crash. Nothing plays until the
// player's first tap (browsers insist on that), and the mute choice is kept on the device.

const KEY = 'racer.muted';
let muted = loadJSON<boolean>(KEY, false);
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let hum: { osc: OscillatorNode; gain: GainNode } | null = null;
let noise: AudioBuffer | null = null;

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  saveJSON(KEY, m);
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.02);
}

/** Creates the audio context (from a tap) and wakes it if the browser suspended it. */
export function unlock() {
  if (!ac) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ac = new Ctor();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') void ac.resume();
}

function burst(freq: number, q: number, seconds: number, volume: number) {
  if (!ac || !master || !noise) return;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  const t = ac.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + seconds);
}

/** Starts the engine hum, or retunes it: `speed` is the road speed in world units per second. */
export function engine(speed: number) {
  if (!ac || !master) return;
  if (!hum) {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(lp).connect(gain).connect(master);
    osc.start();
    hum = { osc, gain };
  }
  const t = ac.currentTime;
  hum.osc.frequency.setTargetAtTime(55 + speed * 0.22, t, 0.08);
  hum.gain.gain.setTargetAtTime(0.06, t, 0.05);
}

export function hush() {
  if (ac && hum) hum.gain.gain.setTargetAtTime(0, ac.currentTime, 0.04);
}

export function swish() { burst(1800, 1.2, 0.14, 0.25); }

export function crash() {
  hush();
  burst(500, 0.6, 0.7, 0.9);
  if (!ac || !master) return;
  const osc = ac.createOscillator();
  osc.type = 'square';
  const gain = ac.createGain();
  const t = ac.currentTime;
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.5);
}
