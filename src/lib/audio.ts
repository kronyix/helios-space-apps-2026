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
