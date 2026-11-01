"use client";

/**
 * The lab's hum: two soft tones that beat against each other while the crystals are apart and
 * settle into one note as they meet, with a fifth and an octave joining at the thresholds.
 * It runs on its own Web Audio context, created inside the first drag or press (a user
 * gesture), and it stops at once when sound is muted.
 */
import { audio } from "@/lib/audio";
import { useSiteStore } from "@/lib/stores";

const BASE = 196;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export interface Hum {
  /** Create or resume the context. Call inside a gesture. */
  wake: () => void;
  /** Update the hum: `closeness` 0 to 1, `stage` 0 to 3. Pass `on` false to fade out. */
  set: (closeness: number, stage: number, on: boolean) => void;
  stop: () => void;
}

export function createHum(): Hum {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let a: OscillatorNode | null = null;
  let b: OscillatorNode | null = null;
  let fifth: GainNode | null = null;
  let octave: GainNode | null = null;
  let unsub: (() => void) | null = null;

  const silent = () => useSiteStore.getState().muted || audio.isMuted;

  const build = () => {
    if (ctx) return;
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    a = ctx.createOscillator();
    b = ctx.createOscillator();
    a.type = "sine";
    b.type = "sine";
    a.frequency.value = BASE;
    b.frequency.value = BASE * 1.1;
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    a.connect(mix);
    b.connect(mix);
    mix.connect(master);
    const f = ctx.createOscillator();
    f.type = "sine";
    f.frequency.value = BASE * 1.5;
    fifth = ctx.createGain();
    fifth.gain.value = 0;
    f.connect(fifth).connect(master);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = BASE * 2;
    octave = ctx.createGain();
    octave.gain.value = 0;
    o.connect(octave).connect(master);
    for (const osc of [a, b, f, o]) osc.start();
    unsub = useSiteStore.subscribe((s, prev) => {
      if (s.muted && !prev.muted) hum.set(0, 0, false);
    });
  };

  const hum: Hum = {
    wake() {
      if (silent()) return;
      try {
        build();
        if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
      } catch {
        /* Web Audio unavailable */
      }
    },
    set(closeness, stage, on) {
      try {
        if (!ctx || !master || !a || !b || !fifth || !octave) return;
        const t = ctx.currentTime;
        const level = on && !silent() ? 0.02 + closeness * 0.1 : 0;
        master.gain.setTargetAtTime(level, t, on ? 0.12 : 0.35);
        // Apart, the second tone sits a little sharp and beats; together it is the same note.
        b.frequency.setTargetAtTime(BASE * (1 + 0.1 * (1 - closeness) ** 1.5), t, 0.1);
        fifth.gain.setTargetAtTime(stage >= 2 ? 0.45 : 0, t, 0.2);
        octave.gain.setTargetAtTime(stage >= 3 ? 0.4 : 0, t, 0.2);
      } catch {
        /* ignore */
      }
    },
    stop() {
      unsub?.();
      unsub = null;
      try {
        void ctx?.close();
      } catch {
        /* ignore */
      }
      ctx = null;
      master = null;
    },
  };
  return hum;
}
