// Synthesised sound: no audio files, everything is an oscillator or filtered
// noise through the Web Audio API. Engine hum follows the car's speed, the
// siren wails when the police are near, and the radio plays a little two-note
// hook on the beat.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let radioTimer = 0;
  let radioStep = 0;
  let muted = false;
  let radioOn = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || !ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get radioOn() {
      return radioOn;
    },
    toggleRadio() {
      radioOn = !radioOn;
      return radioOn;
    },
    /** Called every frame: engine pitch, siren wail, radio hook. */
    update(dt, speed, maxSpeed, stars, radio) {
      if (!ctx) return;
      if (engineOsc && engineGain) {
        const load = Math.abs(speed) / Math.max(1, maxSpeed);
        engineOsc.frequency.value = 48 + load * 130;
        engineGain.gain.value = speed === 0 ? 0.015 : 0.03 + load * 0.05;
      }
      if (sirenOsc && sirenGain) {
        if (stars > 0) {
          sirenTimer += dt;
          const hi = Math.floor(sirenTimer * 1.6) % 2 === 0;
          sirenOsc.frequency.setTargetAtTime(hi ? 740 : 520, ctx.currentTime, 0.05);
          sirenGain.gain.value = 0.02 + Math.min(0.05, stars * 0.012);
        } else {
          sirenGain.gain.value = 0;
        }
      }
      if (radioOn && radio) {
        radioTimer += dt;
        const beat = 60 / radio.bpm;
        if (radioTimer >= beat) {
          radioTimer -= beat;
          radioStep += 1;
          const scale = [0, 3, 5, 7, 10, 12];
          const note = scale[radioStep % scale.length];
          const freq = radio.root * Math.pow(2, note / 12);
          blip(freq, 0.16, 'triangle', 0.045);
          if (radioStep % 4 === 0) blip(freq / 2, 0.2, 'sine', 0.05);
        }
      }
    },
    gunshot() {
      noise(0.14, 0.5, 1800);
    },
    punch() {
      noise(0.08, 0.35, 700);
    },
    crash(strength) {
      noise(0.25, Math.min(0.6, 0.15 + strength * 0.02), 500);
    },
    pickup() {
      blip(660, 0.1, 'sine', 0.12);
      blip(990, 0.14, 'sine', 0.12, 0.08);
    },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.14);
      blip(659, 0.12, 'triangle', 0.14, 0.1);
      blip(784, 0.22, 'triangle', 0.16, 0.2);
    },
    busted() {
      blip(220, 0.3, 'sawtooth', 0.12);
      blip(165, 0.5, 'sawtooth', 0.12, 0.25);
    },
  };
}
