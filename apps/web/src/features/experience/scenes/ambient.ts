import type { Mood } from "../contract";
import type { AmbientKey } from "./parts";

/**
 * Procedural ambient beds in Web Audio, no files. Two pads, crossfaded by mood:
 * - daybreak: warm and airy (detuned triangles through a soft lowpass, a breath of noise);
 * - storm: a low drone with a slow filter sweep and a rumble.
 * Each Part varies the root, the chord and the brightness. Volumes stay low; the bed ducks
 * under voice lines. Connect it to the site's master bus (mute and compressor apply).
 */

interface Voicing {
  root: number;
  chord: [number, number, number, number];
  bright: number;
}

const VOICINGS: Record<AmbientKey, Voicing> = {
  "dawn-air": { root: 220, chord: [0, 4, 7, 11], bright: 1800 },
  "twin-light": { root: 196, chord: [0, 7, 12, 16], bright: 1500 },
  "lantern-water": { root: 174.61, chord: [0, 3, 7, 10], bright: 1300 },
  "ash-wind": { root: 146.83, chord: [0, 3, 7, 12], bright: 900 },
  "void-deep": { root: 110, chord: [0, 7, 12, 19], bright: 700 },
  "machine-hum": { root: 130.81, chord: [0, 5, 7, 12], bright: 1000 },
  "golden-cage": { root: 164.81, chord: [0, 4, 8, 12], bright: 1200 },
  "sunset-fire": { root: 207.65, chord: [0, 4, 7, 9], bright: 1700 },
  "repair-water": { root: 246.94, chord: [0, 4, 7, 11], bright: 2000 },
  "glass-hum": { root: 185, chord: [0, 5, 10, 15], bright: 1100 },
  "storm-rift": { root: 98, chord: [0, 1, 7, 12], bright: 800 },
  "dawn-sea": { root: 220, chord: [0, 4, 7, 14], bright: 1900 },
};

const BED_DAY = 0.055;
const BED_STORM = 0.065;

function semis(root: number, s: number): number {
  return root * 2 ** (s / 12);
}

export class Ambient {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly day: GainNode;
  private readonly storm: GainNode;
  private readonly dayFilter: BiquadFilterNode;
  private readonly stormFilter: BiquadFilterNode;
  private readonly oscs: OscillatorNode[] = [];
  private readonly dayOscs: OscillatorNode[] = [];
  private readonly stormOscs: OscillatorNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private level = 0;
  private ducked = false;
  private mood: Mood = "daybreak";

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    const now = ctx.currentTime;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);

    // Daybreak pad.
    this.day = ctx.createGain();
    this.day.gain.value = 0;
    this.dayFilter = ctx.createBiquadFilter();
    this.dayFilter.type = "lowpass";
    this.dayFilter.frequency.value = 1600;
    this.dayFilter.Q.value = 0.4;
    this.dayFilter.connect(this.day).connect(this.out);
    for (let i = 0; i < 4; i++) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.18 / (1 + i * 0.4);
        o.connect(g).connect(this.dayFilter);
        o.start(now);
        this.dayOscs.push(o);
        this.oscs.push(o);
      }
    }
    // A slow tremble in the pad's brightness, like air moving.
    const dayLfo = ctx.createOscillator();
    dayLfo.frequency.value = 0.07;
    const dayLfoGain = ctx.createGain();
    dayLfoGain.gain.value = 260;
    dayLfo.connect(dayLfoGain).connect(this.dayFilter.frequency);
    dayLfo.start(now);
    this.sources.push(dayLfo);

    // Storm pad: a low drone, a sawtooth through a sweeping lowpass, a rumble.
    this.storm = ctx.createGain();
    this.storm.gain.value = 0;
    this.stormFilter = ctx.createBiquadFilter();
    this.stormFilter.type = "lowpass";
    this.stormFilter.frequency.value = 500;
    this.stormFilter.Q.value = 3;
    this.stormFilter.connect(this.storm).connect(this.out);
    for (const [type, gain] of [
      ["sine", 0.5],
      ["sawtooth", 0.12],
      ["sawtooth", 0.1],
      ["sine", 0.25],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.stormFilter);
      o.start(now);
      this.stormOscs.push(o);
      this.oscs.push(o);
    }
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.035;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 380;
    sweep.connect(sweepGain).connect(this.stormFilter.frequency);
    sweep.start(now);
    this.sources.push(sweep);

    // Noise: air for daybreak (high band), rumble for storm (low band).
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    for (const [type, freq, gain, bus] of [
      ["bandpass", 3800, 0.05, this.day],
      ["lowpass", 180, 0.35, this.storm],
    ] as const) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(bus);
      src.start(now);
      this.sources.push(src);
    }
  }

  /** Switch the Part's voicing and crossfade toward the mood. */
  set(key: AmbientKey, mood: Mood): void {
    const v = VOICINGS[key];
    const t = this.ctx.currentTime;
    this.mood = mood;
    this.dayOscs.forEach((o, i) => {
      const tone = v.chord[Math.floor(i / 2) % 4] ?? 0;
      o.frequency.setTargetAtTime(semis(v.root, tone), t, 1.2);
    });
    const [s0, s1, s2, s3] = this.stormOscs;
    s0?.frequency.setTargetAtTime(v.root / 4, t, 1.5);
    s1?.frequency.setTargetAtTime(v.root / 2, t, 1.5);
    s2?.frequency.setTargetAtTime(semis(v.root / 2, v.chord[1]) * 1.003, t, 1.5);
    s3?.frequency.setTargetAtTime(semis(v.root / 2, v.chord[2]), t, 1.5);
    this.dayFilter.frequency.setTargetAtTime(v.bright, t, 1.5);
    this.stormFilter.frequency.setTargetAtTime(v.bright * 0.5, t, 1.5);
    this.day.gain.setTargetAtTime(mood === "daybreak" ? BED_DAY : 0, t, 1.4);
    this.storm.gain.setTargetAtTime(mood === "storm" ? BED_STORM : 0, t, 1.8);
  }

  /** Overall level: 1 while reading, 0 before the story or off the page. */
  setLevel(level: number): void {
    this.level = level;
    this.apply(2);
  }

  /** Duck under a voice line. */
  duck(on: boolean): void {
    this.ducked = on;
    this.apply(on ? 0.25 : 1.2);
  }

  /** A soft accent when a key line lands: a bell for daybreak, a low swell for storm. */
  stinger(): void {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const g = ctx.createGain();
    g.connect(this.out);
    const o = ctx.createOscillator();
    if (this.mood === "daybreak") {
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    } else {
      o.type = "triangle";
      o.frequency.value = 73.42;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    }
    o.connect(g);
    o.start(t);
    o.stop(t + 3.4);
    o.onended = () => g.disconnect();
  }

  dispose(): void {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.3);
    window.setTimeout(() => {
      for (const s of [...this.oscs, ...this.sources]) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      this.out.disconnect();
    }, 1500);
  }

  private apply(tau: number): void {
    const target = this.level * (this.ducked ? 0.35 : 1);
    this.out.gain.setTargetAtTime(target, this.ctx.currentTime, tau);
  }
}
