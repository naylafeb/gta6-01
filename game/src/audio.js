// Sound, all synthesised in the browser: two-tone sirens, an engine hum, two radio
// stations sequenced from oscillators, and thuds. No audio files, no network.
// Everything is guarded: if the browser has no audio, the game stays silent.

import { RADIOS } from './config.js';

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let radioIndex = 0;
  let radioTimer = null;
  let step = 0;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gain, when) {
    if (!context || muted) return;
    const t0 = when ?? context.currentTime;
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, gain) {
    if (!context || muted) return;
    const len = Math.floor(context.sampleRate * dur);
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const g = context.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  /** The two-tone wail, called every frame while police are near. */
  let sirenPhase = 0;
  function siren(dt, near) {
    if (!context || muted || !near) return;
    sirenPhase += dt;
    const freq = sirenPhase % 1 < 0.5 ? 660 : 520;
    tone(freq, 0.09, 'sine', 0.05);
  }

  function engine(speedNorm) {
    if (!context || muted) return;
    tone(60 + speedNorm * 140, 0.08, 'sawtooth', 0.02 + speedNorm * 0.02);
  }

  function thud() { noise(0.18, 0.5); }
  function coin() { tone(880, 0.12, 'sine', 0.12); tone(1320, 0.18, 'sine', 0.1, context ? context.currentTime + 0.08 : 0); }
  function missionDone() {
    tone(523, 0.15, 'triangle', 0.15);
    tone(659, 0.15, 'triangle', 0.15);
    tone(784, 0.3, 'triangle', 0.15);
  }
  function busted() {
    tone(220, 0.4, 'sawtooth', 0.2);
    tone(110, 0.7, 'sawtooth', 0.2);
  }

  /** A tiny step sequencer: a bass line and a hat per station, looped. */
  const PATTERNS = [
    [0, 0, 7, 0, 5, 0, 7, 10],
    [0, 3, 5, 3, 0, 3, 10, 7],
  ];
  function radioTick() {
    if (!context || muted) return;
    const radio = RADIOS[radioIndex];
    const pattern = PATTERNS[radioIndex % PATTERNS.length];
    const note = pattern[step % pattern.length];
    const freq = radio.root * Math.pow(2, note / 12);
    tone(freq, 0.22, 'triangle', 0.09);
    if (step % 2 === 0) noise(0.03, 0.04);
    step += 1;
  }

  function startRadio() {
    if (!ensure()) return;
    if (radioTimer) return;
    const radio = RADIOS[radioIndex];
    radioTimer = window.setInterval(radioTick, (60 / radio.bpm / 2) * 1000);
  }

  function nextRadio() {
    radioIndex = (radioIndex + 1) % RADIOS.length;
    step = 0;
    if (radioTimer) {
      window.clearInterval(radioTimer);
      radioTimer = null;
      startRadio();
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return {
    ensure, startRadio, nextRadio, toggleMute, siren, engine, thud, coin,
    missionDone, busted,
    get radioName() { return RADIOS[radioIndex].name; },
    get isMuted() { return muted; },
  };
}
