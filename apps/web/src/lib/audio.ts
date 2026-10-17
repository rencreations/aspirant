/**
 * AudioEngine: one Web Audio graph for the whole site.
 *
 *   blips (synthesised) ─┐
 *   voice (decoded) ─ analyser ─┼─ master ─ destination
 *   music (media element) ─┘
 *
 * Rules: call `audio.unlock()` synchronously inside the first user gesture (the loader's
 * Enter button does this). Nothing here throws; every method is a safe no-op on the server,
 * before unlock, or when Web Audio is missing. Voice and music files are AAC .m4a.
 */

export type BlipKind = "hover" | "click" | "confirm" | "whoosh" | "star" | "error";

/** @public */
export interface VoiceOptions {
  /** Called when the line finishes or is stopped. */
  onEnd?: () => void;
  /** 0 to 1. Default 1. */
  volume?: number;
}

/** @public */
export interface MusicOptions {
  loop?: boolean;
  /** 0 to 1. Default 0.5. */
  volume?: number;
  /** Fade-in time. Default 1200 ms. */
  fadeMs?: number;
}

export interface VoiceState {
  /** URL of the line that is playing, or null. */
  url: string | null;
  playing: boolean;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

interface MusicSlot {
  el: HTMLAudioElement;
  gain: GainNode | null;
  source: MediaElementAudioSourceNode | null;
  url: string | null;
}

// A 0.05 s silent WAV, used to unlock HTMLMediaElement playback on iOS inside the gesture.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

const BLIP_GAP_MS: Record<BlipKind, number> = {
  hover: 55,
  click: 40,
  confirm: 120,
  whoosh: 200,
  star: 250,
  error: 150,
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private musicAnalyser: AnalyserNode | null = null;
  private noise: AudioBuffer | null = null;

  private voiceSource: AudioBufferSourceNode | null = null;
  private voiceGain: GainNode | null = null;
  private voiceEnd: (() => void) | undefined;
  private voiceToken = 0;
  private voiceState: VoiceState = { url: null, playing: false };
  private readonly voiceListeners = new Set<(s: VoiceState) => void>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  private readonly music: MusicSlot[] = [];
  private activeMusic = -1;

  private muted = false;
  private unlockedFlag = false;
  private readonly lastBlip: Partial<Record<BlipKind, number>> = {};

  /** True once `unlock()` ran inside a user gesture and the context is running. */
  get unlocked(): boolean {
    return this.unlockedFlag && this.ctx?.state === "running";
  }

  /** Create or resume the context. Call synchronously inside a click, tap or key handler. */
  unlock(): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
      // iOS: play a one-sample buffer inside the gesture.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      // iOS: prime the media elements used for music inside the gesture.
      for (let i = 0; i < 2; i++) {
        const slot = this.musicSlot(i);
        if (slot && !slot.url) {
          slot.el.src = SILENT_WAV;
          void slot.el
            .play()
            .then(() => slot.el.pause())
            .catch(() => undefined);
        }
      }
      this.unlockedFlag = true;
    } catch {
      /* Web Audio unavailable */
    }
  }

  /** Mute or unmute everything (ramped, no clicks). */
  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      const ctx = this.ctx;
      if (ctx && this.master) {
        const now = ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.04);
      }
      for (const slot of this.music) slot.el.muted = muted && !slot.gain;
    } catch {
      /* ignore */
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Short synthesised UI sound. Rate limited per kind; silent when muted or locked. */
  blip(kind: BlipKind): void {
    if (this.muted || !this.unlocked) return;
    const nowMs = performance.now();
    const last = this.lastBlip[kind] ?? 0;
    if (nowMs - last < BLIP_GAP_MS[kind]) return;
    this.lastBlip[kind] = nowMs;
    try {
      const ctx = this.ctx;
      const out = this.sfx;
      if (!ctx || !out) return;
      const t = ctx.currentTime + 0.005;
      switch (kind) {
        case "hover":
          this.tone(out, t, { type: "sine", from: 2350, to: 2100, dur: 0.045, gain: 0.035 });
          break;
        case "click":
          this.tone(out, t, { type: "triangle", from: 1250, to: 820, dur: 0.07, gain: 0.07 });
          this.tone(out, t + 0.012, { type: "sine", from: 2500, to: 2500, dur: 0.04, gain: 0.03 });
          break;
        case "confirm":
          [784, 1046.5, 1318.5].forEach((f, i) =>
            this.tone(out, t + i * 0.065, { type: "sine", from: f, to: f, dur: 0.32, gain: 0.06 }),
          );
          break;
        case "whoosh":
          this.whoosh(out, t);
          break;
        case "star":
          this.chime(out, t);
          break;
        case "error":
          this.tone(out, t, { type: "square", from: 220, to: 200, dur: 0.12, gain: 0.03 });
          this.tone(out, t + 0.13, { type: "square", from: 165, to: 150, dur: 0.16, gain: 0.03 });
          break;
      }
    } catch {
      /* ignore */
    }
  }

  /** Decode a voice line ahead of time so hover playback starts instantly (after unlock). */
  preloadVoice(url: string): void {
    if (this.ctx) void this.loadBuffer(url);
  }

  /**
   * Play one voice line through the shared analyser. Stops the previous line and ducks music.
   * Resolves true when playback started.
   */
  async playVoice(url: string, options: VoiceOptions = {}): Promise<boolean> {
    this.stopVoice();
    const token = ++this.voiceToken;
    this.voiceEnd = options.onEnd;
    this.emitVoice({ url, playing: true });
    try {
      const ctx = this.ensureContext();
      if (!ctx || !this.voiceBus) throw new Error("no audio");
      const buffer = await this.loadBuffer(url);
      if (!buffer || token !== this.voiceToken) {
        if (token === this.voiceToken) this.finishVoice();
        return false;
      }
      if (ctx.state !== "running") await ctx.resume().catch(() => undefined);
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = options.volume ?? 1;
      src.buffer = buffer;
      src.connect(gain).connect(this.voiceBus);
      src.onended = () => {
        if (this.voiceSource === src) this.finishVoice();
      };
      this.voiceSource = src;
      this.voiceGain = gain;
      this.duckMusic(true);
      src.start();
      return true;
    } catch {
      if (token === this.voiceToken) this.finishVoice();
      return false;
    }
  }

  /** Stop the current voice line (calls its onEnd). */
  stopVoice(): void {
    if (!this.voiceSource && !this.voiceState.playing) return;
    this.voiceToken++;
    try {
      const src = this.voiceSource;
      const gain = this.voiceGain;
      const ctx = this.ctx;
      if (src && gain && ctx) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
        src.onended = null;
        src.stop(ctx.currentTime + 0.08);
      }
    } catch {
      /* already stopped */
    }
    this.finishVoice();
  }

  /** The analyser that voice playback runs through (for waveforms). Null before unlock. */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** Current voice line state. */
  getVoiceState(): VoiceState {
    return this.voiceState;
  }

  /** Subscribe to voice start and end. Returns an unsubscribe function. */
  onVoiceChange(listener: (state: VoiceState) => void): () => void {
    this.voiceListeners.add(listener);
    return () => this.voiceListeners.delete(listener);
  }

  /** Start (or crossfade to) a music track. Same URL again only adjusts the volume. */
  playMusic(url: string, options: MusicOptions = {}): void {
    const { loop = true, volume = 0.5, fadeMs = 1200 } = options;
    try {
      const current = this.music[this.activeMusic];
      if (current?.url === url) {
        this.fadeSlot(current, volume, fadeMs);
        return;
      }
      if (current) this.stopSlot(current, fadeMs);
      const next = this.activeMusic === 0 ? 1 : 0;
      const slot = this.musicSlot(next);
      if (!slot) return;
      this.activeMusic = next;
      slot.url = url;
      slot.el.loop = loop;
      slot.el.src = url;
      slot.el.muted = this.muted && !slot.gain;
      if (slot.gain && this.ctx) slot.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      else slot.el.volume = 0;
      void slot.el.play().catch(() => undefined);
      this.fadeSlot(slot, volume, fadeMs);
    } catch {
      /* ignore */
    }
  }

  /** The media element of the active music track, or null. Use it to read time and seek. */
  getMusicElement(): HTMLAudioElement | null {
    return this.music[this.activeMusic]?.el ?? null;
  }

  /**
   * Analyser tapped off the music bus (null before unlock). Separate from the voice analyser,
   * so voice waveforms never draw the music.
   */
  getMusicAnalyser(): AnalyserNode | null {
    return this.musicAnalyser;
  }

  /** Pause the active music track without fading. `resumeMusic` continues it. */
  pauseMusic(): void {
    this.getMusicElement()?.pause();
  }

  /** Continue a paused music track. Call inside a user gesture the first time. */
  resumeMusic(): void {
    void this.getMusicElement()
      ?.play()
      .catch(() => undefined);
  }

  /** Set the level of the active music track (0 to 1) with a short ramp. */
  setMusicVolume(volume: number): void {
    const slot = this.music[this.activeMusic];
    if (slot) this.fadeSlot(slot, Math.min(1, Math.max(0, volume)), 80);
  }

  /** Fade out and stop the music. */
  stopMusic(fadeMs = 800): void {
    const slot = this.music[this.activeMusic];
    if (slot) this.stopSlot(slot, fadeMs);
    this.activeMusic = -1;
  }

  // Internals ----------------------------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    try {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor({ latencyHint: "interactive" });
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      master.connect(comp).connect(ctx.destination);
      const sfx = ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.78;
      const voiceBus = ctx.createGain();
      voiceBus.connect(analyser).connect(master);
      const musicBus = ctx.createGain();
      musicBus.connect(master);
      const musicAnalyser = ctx.createAnalyser();
      musicAnalyser.fftSize = 1024;
      musicAnalyser.smoothingTimeConstant = 0.82;
      musicBus.connect(musicAnalyser);
      this.musicAnalyser = musicAnalyser;
      this.ctx = ctx;
      this.master = master;
      this.sfx = sfx;
      this.analyser = analyser;
      this.voiceBus = voiceBus;
      this.musicBus = musicBus;
      return ctx;
    } catch {
      return null;
    }
  }

  private musicSlot(index: number): MusicSlot | null {
    const existing = this.music[index];
    if (existing) return existing;
    if (typeof window === "undefined") return null;
    try {
      const el = new Audio();
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      let gain: GainNode | null = null;
      let source: MediaElementAudioSourceNode | null = null;
      const ctx = this.ensureContext();
      if (ctx && this.musicBus) {
        source = ctx.createMediaElementSource(el);
        gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(this.musicBus);
      }
      const slot: MusicSlot = { el, gain, source, url: null };
      this.music[index] = slot;
      return slot;
    } catch {
      return null;
    }
  }

  private fadeSlot(slot: MusicSlot, volume: number, fadeMs: number): void {
    const ctx = this.ctx;
    if (slot.gain && ctx) {
      const now = ctx.currentTime;
      slot.gain.gain.cancelScheduledValues(now);
      slot.gain.gain.setValueAtTime(slot.gain.gain.value, now);
      slot.gain.gain.linearRampToValueAtTime(volume, now + fadeMs / 1000);
      return;
    }
    // Fallback without Web Audio: step the element volume.
    const start = slot.el.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / Math.max(1, fadeMs));
      slot.el.volume = start + (volume - start) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private stopSlot(slot: MusicSlot, fadeMs: number): void {
    this.fadeSlot(slot, 0, fadeMs);
    const url = slot.url;
    window.setTimeout(() => {
      if (slot.url === url && this.music[this.activeMusic] !== slot) {
        slot.el.pause();
        slot.url = null;
      }
    }, fadeMs + 50);
  }

  private duckMusic(duck: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(duck ? 0.35 : 1, ctx.currentTime, duck ? 0.08 : 0.4);
  }

  private finishVoice(): void {
    this.voiceSource = null;
    this.voiceGain = null;
    this.duckMusic(false);
    const end = this.voiceEnd;
    this.voiceEnd = undefined;
    this.emitVoice({ url: null, playing: false });
    try {
      end?.();
    } catch {
      /* listener errors stay local */
    }
  }

  private emitVoice(state: VoiceState): void {
    this.voiceState = state;
    for (const listener of this.voiceListeners) {
      try {
        listener(state);
      } catch {
        /* ignore */
      }
    }
  }

  private loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve(null);
    const promise = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => {
        this.buffers.delete(url);
        return null;
      });
    this.buffers.set(url, promise);
    // Keep the cache small.
    if (this.buffers.size > 40) {
      const first = this.buffers.keys().next().value;
      if (first !== undefined) this.buffers.delete(first);
    }
    return promise;
  }

  private tone(
    out: AudioNode,
    t: number,
    o: { type: OscillatorType; from: number; to: number; dur: number; gain: number },
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.from, t);
    if (o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + Math.min(0.012, o.dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
    osc.onended = () => g.disconnect();
  }

  private chime(out: AudioNode, t: number): void {
    // A soft bell: inharmonic partials with staggered decays, plus a gentle second note.
    const notes: Array<[number, number]> = [
      [1046.5, 0],
      [1567.98, 0.09],
    ];
    for (const [f, delay] of notes) {
      for (const [ratio, gain, decay] of [
        [1, 0.07, 1.4],
        [2.76, 0.022, 0.7],
        [5.4, 0.01, 0.35],
      ] as const) {
        this.tone(out, t + delay, {
          type: "sine",
          from: f * ratio,
          to: f * ratio,
          dur: decay,
          gain,
        });
      }
    }
  }

  private whoosh(out: AudioNode, t: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 0.6);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(380, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.5);
    src.onended = () => g.disconnect();
  }
}

/** The site-wide audio engine. */
export const audio = new AudioEngine();
