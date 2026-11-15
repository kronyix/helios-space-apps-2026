/**
 * Tiny synthesized Web Audio mixer (no runtime audio files):
 * - master -> ambientBus (space drone + optional Mars wind bed, -8 dB ducked during narration)
 * - master -> sfxBus (UI blips, page turns, uplink static/chirp, rover drive motor + sand grit, hazards, scan, outcomes)
 * Everything is silent until a user gesture and sound is enabled.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let drone: { stop: () => void } | null = null;
let marsWind: { stop: () => void } | null = null;

// Tracked explicitly: AudioParam.value doesn't reflect scheduled ramps across all browsers.
let enabled = false;
let narrationDucked = false;
let masterVolume = 0.7;
let roverAmbientRequested = false;

const MASTER_MAX_GAIN = 0.65;
const AMBIENT_BASE_GAIN = 1.0;
// -8 dB amplitude ratio = 10^(-8/20) ≈ 0.3981
const AMBIENT_DUCKED_GAIN = 0.3981;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    ambientBus = ctx.createGain();
    ambientBus.gain.value = narrationDucked ? AMBIENT_DUCKED_GAIN : AMBIENT_BASE_GAIN;
    ambientBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.0;
    sfxBus.connect(master);
  }
  return { ctx: ctx!, master: master!, ambient: ambientBus!, sfx: sfxBus! };
}

const audible = () => !!ctx && !!master && !!sfxBus && enabled;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.7));
}

export function setMasterVolume(vol: number) {
  masterVolume = clamp01(vol);
  if (!ctx || !master || !enabled) return;
  try {
    master.gain.setTargetAtTime(MASTER_MAX_GAIN * masterVolume, ctx.currentTime, 0.08);
  } catch {
    /* ignore */
  }
}

/**
 * Lowers ambient bus gain by ~8 dB over 300ms while narration plays, and restores it after.
 */
export function setNarrationDucking(ducked: boolean, reduced = false) {
  narrationDucked = ducked;
  if (!ctx || !ambientBus || !enabled) return;
  try {
    const now = ctx.currentTime;
    const rampSec = reduced ? 0.04 : 0.3;
    const target = ducked ? AMBIENT_DUCKED_GAIN : AMBIENT_BASE_GAIN;
    ambientBus.gain.cancelScheduledValues(now);
    ambientBus.gain.setValueAtTime(ambientBus.gain.value, now);
    ambientBus.gain.linearRampToValueAtTime(target, now + rampSec);
  } catch {
    /* ignore */
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    const { ctx, master, ambient } = ensure();
    enabled = on;
    if (on) {
      void ctx.resume();
      master.gain.setTargetAtTime(MASTER_MAX_GAIN * masterVolume, ctx.currentTime, 0.35);
      if (!drone) drone = startDrone(ctx, ambient);
      if (roverAmbientRequested && !marsWind) marsWind = startMarsWind(ctx, ambient);
    } else {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      const d = drone;
      const w = marsWind;
      drone = null;
      marsWind = null;
      window.setTimeout(() => {
        d?.stop();
        w?.stop();
      }, 600);
    }
  } catch {
    /* audio unavailable: silently ignore */
  }
}

/** Enables or stops the subtle filtered Martian wind bed while the rover game is active. */
export function setRoverAmbientActive(active: boolean) {
  roverAmbientRequested = active;
  if (!ctx || !ambientBus) return;
  if (active && enabled && !marsWind) {
    marsWind = startMarsWind(ctx, ambientBus);
  } else if (!active && marsWind) {
    const w = marsWind;
    marsWind = null;
    window.setTimeout(() => w.stop(), 350);
  }
}

function startDrone(c: AudioContext, out: GainNode) {
  const g = c.createGain();
  g.gain.value = 0.05;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const oscs = [55, 82.5, 110.3].map((f, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    o.detune.value = i * 4;
    o.connect(lp);
    o.start();
    return o;
  });
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  lp.connect(g).connect(out);
  return {
    stop: () => {
      try {
        oscs.forEach((o) => o.stop());
        lfo.stop();
        g.disconnect();
      } catch {
        /* already stopped */
      }
    },
  };
}

let noise: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 1.2, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function startMarsWind(c: AudioContext, out: GainNode) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 260;
  bp.Q.value = 1.4;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.14;
  lfoGain.gain.value = 110;
  lfo.connect(lfoGain).connect(bp.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(0.036, c.currentTime + 0.5);
  src.connect(bp).connect(g).connect(out);
  src.start();
  lfo.start();
  return {
    stop: () => {
      try {
        g.gain.setTargetAtTime(0, c.currentTime, 0.12);
        src.stop(c.currentTime + 0.32);
        lfo.stop(c.currentTime + 0.32);
      } catch {
        /* already stopped */
      }
    },
  };
}

export function blip(kind: 'tick' | 'ok' | 'bad' | 'lock' = 'tick') {
  if (!audible()) return;
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  const f = { tick: 880, ok: 1320, bad: 196, lock: 1046 }[kind];
  o.type = kind === 'bad' ? 'sawtooth' : 'sine';
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(kind === 'bad' ? 0.08 : 0.12, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (kind === 'ok' ? 0.4 : 0.14));
  o.connect(g).connect(sfxBus!);
  o.start();
  o.stop(c.currentTime + 0.5);
}

/** Quiet paper-turn rustle (filtered noise). Three variants so it never repeats exactly. */
export function pageTurnSound() {
  if (!audible()) return;
  const c = ctx!;
  const buf = noiseBuffer(c);
  const v = [
    { f: 2400, q: 0.7, len: 0.42 },
    { f: 3200, q: 0.9, len: 0.36 },
    { f: 1800, q: 0.6, len: 0.5 },
  ][Math.floor(Math.random() * 3)];
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = v.f;
  bp.Q.value = v.q;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.03, t + v.len * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + v.len);
  bp.frequency.exponentialRampToValueAtTime(v.f * 0.55, t + v.len);
  src.connect(bp).connect(g).connect(sfxBus!);
  src.start(t, Math.random() * 0.1);
  src.stop(t + v.len + 0.05);
}

// ---------------------------------------------------------------------------
// Signal Delay (rover drive) layered procedural cues

/** Short telemetry chirp bursts paired with crackly radio static for the 5s uplink window. */
export function uplinkStatic(): () => void {
  if (!audible()) return () => {};
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.85;
  const g = c.createGain();
  g.gain.value = 0.022;
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = 7;
  lg.gain.value = 0.012;
  lfo.connect(lg).connect(g.gain);
  src.connect(bp).connect(g).connect(sfxBus!);
  src.start();
  lfo.start();

  // Telemetry carrier data-chirp at uplink start + repeat pulse
  const playChirp = (offsetSec: number) => {
    const t = c.currentTime + offsetSec;
    [980, 1460, 1220, 1740].forEach((freq, i) => {
      const o = c.createOscillator();
      const cg = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + i * 0.055);
      cg.gain.setValueAtTime(0.0001, t + i * 0.055);
      cg.gain.exponentialRampToValueAtTime(0.055, t + i * 0.055 + 0.01);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.055 + 0.048);
      o.connect(cg).connect(sfxBus!);
      o.start(t + i * 0.055);
      o.stop(t + i * 0.055 + 0.055);
    });
  };
  playChirp(0.02);
  const timer = window.setTimeout(() => {
    if (audible()) playChirp(0);
  }, 2400);

  return () => {
    window.clearTimeout(timer);
    try {
      g.gain.setTargetAtTime(0, c.currentTime, 0.05);
      src.stop(c.currentTime + 0.3);
      lfo.stop(c.currentTime + 0.3);
    } catch {
      /* already stopped */
    }
  };
}

export interface MotorDriveHandle {
  update: (speed: number, sand: number) => void;
  stop: () => void;
}

/** Speed-modulated electric motor hum + gritty sand wheel crunch. */
export function startRoverDriveAudio(): MotorDriveHandle {
  if (!audible()) {
    return { update: () => {}, stop: () => {} };
  }
  const c = ctx!;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  o.type = 'sawtooth';
  o2.type = 'triangle';
  o.frequency.value = 82;
  o2.frequency.value = 123;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 340;
  const motorGain = c.createGain();
  motorGain.gain.setValueAtTime(0.0001, c.currentTime);
  motorGain.gain.exponentialRampToValueAtTime(0.026, c.currentTime + 0.2);
  o.connect(lp);
  o2.connect(lp);
  lp.connect(motorGain).connect(sfxBus!);
  o.start();
  o2.start();

  // Gritty sand crunch noise layer
  const gritSrc = c.createBufferSource();
  gritSrc.buffer = noiseBuffer(c);
  gritSrc.loop = true;
  const gritBp = c.createBiquadFilter();
  gritBp.type = 'bandpass';
  gritBp.frequency.value = 900;
  gritBp.Q.value = 1.6;
  const gritGain = c.createGain();
  gritGain.gain.value = 0.0001;
  gritSrc.connect(gritBp).connect(gritGain).connect(sfxBus!);
  gritSrc.start();

  return {
    update: (speed: number, sand: number) => {
      if (!ctx || !enabled) return;
      const t = c.currentTime;
      const sp = Math.max(0, Math.min(2.5, speed));
      const snd = Math.max(0, Math.min(1, sand));
      const moving = sp > 0.05 ? 1 : 0.15;
      o.frequency.setTargetAtTime(76 + sp * 28, t, 0.06);
      o2.frequency.setTargetAtTime((76 + sp * 28) * 1.5, t, 0.06);
      motorGain.gain.setTargetAtTime(0.028 * moving, t, 0.08);
      gritBp.frequency.setTargetAtTime(650 + sp * 280 + snd * 420, t, 0.08);
      gritGain.gain.setTargetAtTime(moving > 0.5 ? 0.012 + snd * 0.045 : 0.0001, t, 0.08);
    },
    stop: () => {
      try {
        motorGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
        gritGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
        o.stop(c.currentTime + 0.45);
        o2.stop(c.currentTime + 0.45);
        gritSrc.stop(c.currentTime + 0.45);
      } catch {
        /* already stopped */
      }
    },
  };
}

/** Legacy simple motor hum export kept compatible. */
export function motorHum(): () => void {
  const handle = startRoverDriveAudio();
  return handle.stop;
}

/** Low damped thud on rock contact or blocked turn. */
export function rockThunk() {
  if (!audible()) return;
  const c = ctx!;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(145, t);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(sfxBus!);
  o.start(t);
  o.stop(t + 0.25);
}

/** Gentle two-tone warning chime when tilt crosses 20° / 30°. */
export function tiltWarnBeep() {
  if (!audible()) return;
  const c = ctx!;
  [660, 523.25].forEach((freq, i) => {
    const t = c.currentTime + i * 0.11;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(sfxBus!);
    o.start(t);
    o.stop(t + 0.12);
  });
}

/** Crystalline spectrometer scan ping (ascending on success, muted low tone out of range). */
export function scanPing(ok = true) {
  if (!audible()) return;
  const c = ctx!;
  const t = c.currentTime;
  const freqs = ok ? [880, 1174.7] : [440, 311.1];
  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.09 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.28);
    o.connect(g).connect(sfxBus!);
    o.start(t + i * 0.09);
    o.stop(t + i * 0.09 + 0.32);
  });
}

/** Carrier-loss descending tone on mission end/loss. */
export function lostSignalTone() {
  if (!audible()) return;
  const c = ctx!;
  [440, 349.2, 261.6].forEach((f, i) => {
    const t = c.currentTime + i * 0.16;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(sfxBus!);
    o.start(t);
    o.stop(t + 0.42);
  });
}

/** Rising three-note chime for a successful mission. */
export function winChime() {
  if (!audible()) return;
  const c = ctx!;
  [659.3, 830.6, 987.8].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + i * 0.14;
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(sfxBus!);
    o.start(t);
    o.stop(t + 1);
  });
}

/** Optional opt-in device vibration on rock impact or steep tilt stop. */
export function triggerHaptic(kind: 'rock' | 'tilt', hapticsOn: boolean) {
  if (!hapticsOn || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(kind === 'rock' ? [28, 30, 45] : [40, 25, 40]);
  } catch {
    /* ignore */
  }
}
