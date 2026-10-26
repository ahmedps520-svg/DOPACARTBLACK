/**
 * Synthesised UI sounds and a generative ambient music bed (Web Audio only,
 * no audio files). Everything respects the Sound / Music settings.
 */
export type SoundId = 'buy' | 'sell' | 'error' | 'notify' | 'click' | 'level' | 'coin';

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicNodes: AudioNode[] = [];

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
  const c = audio();
  if (!c || !sfxGain) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(sfxGain);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export function playSound(id: SoundId, volume: number) {
  const c = audio();
  if (!c || !sfxGain || volume <= 0) return;
  sfxGain.gain.value = volume * 0.6;
  switch (id) {
    case 'click':
      tone(1200, 0, 0.04, 'square', 0.05);
      break;
    case 'buy':
      tone(523.25, 0, 0.12, 'triangle', 0.25);
      tone(783.99, 0.07, 0.18, 'triangle', 0.22);
      break;
    case 'sell':
    case 'coin':
      tone(987.77, 0, 0.08, 'square', 0.12);
      tone(1318.5, 0.06, 0.28, 'square', 0.12);
      break;
    case 'error':
      tone(196, 0, 0.18, 'sawtooth', 0.12);
      tone(155.56, 0.1, 0.22, 'sawtooth', 0.1);
      break;
    case 'notify':
      tone(880, 0, 0.12, 'sine', 0.18);
      tone(1174.66, 0.09, 0.2, 'sine', 0.14);
      break;
    case 'level':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.2));
      break;
  }
}

// Minor-key pad progression: Am – F – C – G (voiced low and wide).
const CHORDS = [
  [110, 164.81, 220, 261.63],
  [87.31, 130.81, 174.61, 220],
  [65.41, 130.81, 196, 261.63],
  [98, 146.83, 196, 246.94],
];

function playChord(index: number) {
  const c = audio();
  if (!c || !musicGain) return;
  const now = c.currentTime;
  const len = 8;
  for (const f of CHORDS[index % CHORDS.length]) {
    const o = c.createOscillator();
    const g = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 12;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.05, now + 2.5);
    g.gain.linearRampToValueAtTime(0.0001, now + len + 1.5);
    o.connect(filter).connect(g).connect(musicGain);
    o.start(now);
    o.stop(now + len + 2);
    musicNodes.push(o);
  }
  musicNodes = musicNodes.slice(-16);
}

export function setMusic(enabled: boolean, volume: number) {
  const c = audio();
  if (!c || !musicGain) return;
  musicGain.gain.setTargetAtTime(enabled ? volume * 0.5 : 0, c.currentTime, 0.4);
  if (enabled && musicTimer === null) {
    let i = 0;
    playChord(i++);
    musicTimer = window.setInterval(() => playChord(i++), 8000);
  } else if (!enabled && musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}
