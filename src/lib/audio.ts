/**
 * Tiny synthesized audio layer (no audio files): an ambient "deep space"
 * drone and UI blips. Everything is off until the user enables sound.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let drone: { stop: () => void } | null = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
  }
  return { ctx: ctx!, master: master! };
}

export function setSoundEnabled(on: boolean) {
  try {
    const { ctx, master } = ensure();
    if (on) {
      void ctx.resume();
      master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
      if (!drone) drone = startDrone(ctx, master);
    } else {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      const d = drone;
      drone = null;
      window.setTimeout(() => d?.stop(), 600);
    }
  } catch {
    /* audio unavailable: silently ignore */
  }
}

function startDrone(ctx: AudioContext, out: GainNode) {
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const oscs = [55, 82.5, 110.3].map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    o.detune.value = i * 4;
    o.connect(lp);
    o.start();
    return o;
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  lp.connect(g).connect(out);
  return {
    stop: () => {
      oscs.forEach((o) => o.stop());
      lfo.stop();
      g.disconnect();
    },
  };
}

export function blip(kind: 'tick' | 'ok' | 'bad' | 'lock' = 'tick') {
  if (!ctx || !master || master.gain.value < 0.01) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = { tick: 880, ok: 1320, bad: 196, lock: 1046 }[kind];
  o.type = kind === 'bad' ? 'sawtooth' : 'sine';
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(kind === 'bad' ? 0.08 : 0.12, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'ok' ? 0.4 : 0.14));
  o.connect(g).connect(master);
  o.start();
  o.stop(ctx.currentTime + 0.5);
}

/** Quiet paper-turn rustle (filtered noise). Three variants so it never repeats exactly. */
let noise: AudioBuffer | null = null;
export function pageTurnSound() {
  if (!ctx || !master || master.gain.value < 0.01) return;
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const v = [
    { f: 2400, q: 0.7, len: 0.42 },
    { f: 3200, q: 0.9, len: 0.36 },
    { f: 1800, q: 0.6, len: 0.5 },
  ][Math.floor(Math.random() * 3)];
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = v.f;
  bp.Q.value = v.q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.03, t + v.len * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + v.len);
  bp.frequency.exponentialRampToValueAtTime(v.f * 0.55, t + v.len);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 0.1);
  src.stop(t + v.len + 0.05);
}

// ---------------------------------------------------------------------------
// Signal Delay (rover drive) sounds. All respect the master mute.

const audible = () => !!ctx && !!master && master.gain.value >= 0.01;

function noiseBuffer(c: AudioContext) {
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Crackly radio static for the uplink countdown. Returns a stop function. */
export function uplinkStatic(): () => void {
  if (!audible()) return () => {};
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = 0.025;
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = 7;
  lg.gain.value = 0.015;
  lfo.connect(lg).connect(g.gain);
  src.connect(bp).connect(g).connect(master!);
  src.start();
  lfo.start();
  return () => {
    try {
      g.gain.setTargetAtTime(0, c.currentTime, 0.05);
      src.stop(c.currentTime + 0.3);
      lfo.stop(c.currentTime + 0.3);
    } catch {
      /* already stopped */
    }
  };
}

/** Low electric motor hum while the rover drives. Returns a stop function. */
export function motorHum(): () => void {
  if (!audible()) return () => {};
  const c = ctx!;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  o.type = 'sawtooth';
  o2.type = 'square';
  o.frequency.value = 92;
  o2.frequency.value = 138;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 0.3);
  o.connect(lp);
  o2.connect(lp);
  lp.connect(g).connect(master!);
  o.start();
  o2.start();
  return () => {
    try {
      g.gain.setTargetAtTime(0.0001, c.currentTime, 0.12);
      o.stop(c.currentTime + 0.6);
      o2.stop(c.currentTime + 0.6);
    } catch {
      /* already stopped */
    }
  };
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
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 1);
  });
}
