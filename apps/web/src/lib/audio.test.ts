import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/media-store", () => ({
  cachedFetch: vi.fn(() =>
    Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
  ),
}));

/** The nodes of a Web Audio graph, reduced to what the voice path touches. */
class FakeNode {
  gain = { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
  threshold = { value: 0 };
  ratio = { value: 0 };
  fftSize = 0;
  smoothingTimeConstant = 0;
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect<T>(next: T): T {
    return next;
  }
  start = vi.fn();
  stop = vi.fn();
}

const created: FakeNode[] = [];

class FakeContext {
  state = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = new FakeNode();
  resume = () => Promise.resolve();
  decodeAudioData = () => Promise.resolve({});
  createBuffer = () => ({});
  private node(): FakeNode {
    const n = new FakeNode();
    created.push(n);
    return n;
  }
  createGain = () => this.node();
  createDynamicsCompressor = () => this.node();
  createAnalyser = () => this.node();
  createBufferSource = () => this.node();
}

describe("playVoice", () => {
  beforeEach(() => {
    created.length = 0;
    vi.resetModules();
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  });
  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  async function play(options: { volume?: number; gainDb?: number }): Promise<FakeNode> {
    const { audio } = await import("./audio");
    const before = created.length;
    // The engine builds its graph on the first call: master, compressor, sfx, analyser, voice bus, music bus, analyser.
    const started = await audio.playVoice("https://example.test/line.m4a", options);
    expect(started).toBe(true);
    const made = created.slice(before);
    // The source and its own gain are the last two nodes made for the line.
    const gain = made[made.length - 1];
    if (!gain) throw new Error("no gain node");
    return gain;
  }

  it("plays a line at unit gain when it has no baked gain", async () => {
    const gain = await play({});
    expect(gain.gain.value).toBe(1);
  });

  it("applies the baked gain of the record as a linear factor", async () => {
    const gain = await play({ gainDb: 20 });
    expect(gain.gain.value).toBeCloseTo(10, 10);
    const quiet = await play({ gainDb: -6.0206 });
    expect(quiet.gain.value).toBeCloseTo(0.5, 3);
  });

  it("multiplies the baked gain by the caller's factor", async () => {
    const gain = await play({ gainDb: 20, volume: 0.5 });
    expect(gain.gain.value).toBeCloseTo(5, 10);
  });

  it("lifts every line by the fixed voice bus the pipeline assumes", async () => {
    await play({});
    // The voice bus is the third gain node of the graph (master, sfx, voice bus).
    const gains = created.filter((n) => n.gain.value !== undefined);
    expect(gains.some((n) => Math.abs(n.gain.value - 1.9) < 1e-9)).toBe(true);
  });
});
