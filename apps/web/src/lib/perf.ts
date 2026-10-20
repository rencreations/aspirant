/**
 * Performance level of this device. Three levels, and every heavy thing on the site reads it:
 *
 *   full      everything: the biggest picture the display and the device can use, all effects
 *   balanced  a smaller picture (at most 1080), fewer effects
 *   lite      the smallest picture at half the frame rate, and only the effects that cost nothing
 *
 * The level is set in three steps:
 *
 *  1. At the start, from the device: does it decode video in hardware, how many cores and how
 *     much memory, is data saving on. A level remembered from an earlier visit replaces this
 *     (a level the governor chose is trusted for one day, any other for five), and
 *     `?quality=full|balanced|lite` overrides everything (`auto` forgets it).
 *  2. `startGovernor` watches the real frame rate while the page plays and steps the level down,
 *     one step at a time, when it stays low. It ignores the first seconds, hidden tabs, and
 *     anything while the page is loading, so one bad moment does not pin a device at a low level.
 *     When a device sits below what its hardware suggests and plays smoothly for half a minute,
 *     it tries one step up. If that step is bad it goes back down and does not try again until
 *     the memory expires, so a device is never stuck low because of one busy moment.
 *  3. The level is written to `<html data-perf>` for the CSS and kept for the next visit.
 */
export type PerfLevel = "full" | "balanced" | "lite";

const LEVELS: readonly PerfLevel[] = ["lite", "balanced", "full"];
const STORE_KEY = "aspirants:perf";
/** A remembered level is trusted this long, then the device is measured again. */
const KEEP_MS = 5 * 24 * 60 * 60 * 1000;
/** A level the governor chose (a step down or up) is trusted for a day only. */
const GOVERNED_KEEP_MS = 24 * 60 * 60 * 1000;

export interface DeviceInfo {
  /** The browser decodes video in hardware (mediaCapabilities `powerEfficient`). */
  hardwareDecode: boolean | null;
  cores: number | null;
  memory: number | null;
  saveData: boolean;
}

/** The level a device starts at, before anything is measured. */
export function levelFor(d: DeviceInfo): PerfLevel {
  if (d.saveData) return "lite";
  if (d.memory !== null && d.memory <= 2) return "lite";
  const cores = d.cores ?? 4;
  // Without hardware decoding every frame is decoded by the processor, and a stream the size of
  // the page's picture needs most of a core on a fast one. Few cores: the smallest picture.
  if (d.hardwareDecode === false) {
    if (cores < 6) return "lite";
    if (cores < 12) return "balanced";
    return "full";
  }
  if (cores <= 2 || (d.memory !== null && d.memory <= 4 && cores <= 4)) return "balanced";
  return "full";
}

/** One step up. The biggest stays. */
export function raiseLevel(level: PerfLevel): PerfLevel {
  return LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + 1)] ?? "full";
}

/** One step down. The smallest stays. */
export function lowerLevel(level: PerfLevel): PerfLevel {
  return LEVELS[Math.max(0, LEVELS.indexOf(level) - 1)] ?? "lite";
}

/** What one stretch of frames says about the device. */
export interface FrameWindow {
  /** Time between frames, in ms. */
  deltas: readonly number[];
  /** Video frames dropped and shown in the same stretch, when known. */
  video?: { dropped: number; total: number } | null;
}

/**
 * Is a stretch of frames bad enough to count? It is when, for a stretch long enough to mean
 * something, one frame in five is slower than 33 ms (30 fps), or the slow tenth is slower than 45
 * ms, or the video drops more than one frame in eight.
 */
export function isBad(w: FrameWindow): boolean {
  // Gaps over a quarter of a second are a hidden tab or a stall in the browser, not the page.
  const d = w.deltas.filter((x) => x < 250);
  if (d.length < 8) return false;
  const sorted = [...d].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const slow = d.filter((x) => x > 33).length / d.length;
  const dropped = w.video && w.video.total >= 30 ? w.video.dropped / w.video.total : 0;
  return slow > 0.2 || p90 > 45 || dropped > 0.125;
}

type Listener = (level: PerfLevel, reason: string) => void;

let current: PerfLevel | null = null;
const listeners = new Set<Listener>();
let hardwareDecode: boolean | null = null;
/** No step up in this visit (a step down happened, or a step up was tried and failed). */
let noPromote = false;
/** The governor stepped up in this visit and has not been judged on it yet. */
let promoted = false;

interface Stored {
  level: PerfLevel;
  /** A step up was tried from here and failed. */
  failedUp: boolean;
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { level?: string; at?: number; by?: string; failedUp?: boolean };
    if (!v.level || !LEVELS.includes(v.level as PerfLevel)) return null;
    const keep = v.by === "governor" ? GOVERNED_KEEP_MS : KEEP_MS;
    if (typeof v.at !== "number" || Date.now() - v.at > keep) return null;
    return { level: v.level as PerfLevel, failedUp: v.failedUp === true };
  } catch {
    return null;
  }
}

function store(level: PerfLevel | null, failedUp = false) {
  try {
    if (level === null) window.localStorage.removeItem(STORE_KEY);
    else {
      const v = { level, at: Date.now(), by: "governor", failedUp };
      window.localStorage.setItem(STORE_KEY, JSON.stringify(v));
    }
  } catch {
    // Private window: the level is just not remembered.
  }
}

/** `?quality=` from the address: a level, `auto` (forget what was remembered), or nothing. */
function fromAddress(): PerfLevel | "auto" | null {
  try {
    const q = new URLSearchParams(window.location.search).get("quality");
    if (q === "auto") return "auto";
    return LEVELS.includes(q as PerfLevel) ? (q as PerfLevel) : null;
  } catch {
    return null;
  }
}

function device(): DeviceInfo {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    hardwareDecode,
    cores: nav.hardwareConcurrency || null,
    memory: nav.deviceMemory ?? null,
    saveData: nav.connection?.saveData === true,
  };
}

/** `remember`: not at all, as a governor's choice, or as a step up that failed. */
function apply(level: PerfLevel, reason: string, remember: "governor" | "failed-up" | null) {
  if (current === level) return;
  current = level;
  document.documentElement.dataset.perf = level;
  if (remember) store(level, remember === "failed-up");
  for (const l of listeners) l(level, reason);
}

/** The current level. The first call decides it. Server and first paint: `full`. */
export function perfLevel(): PerfLevel {
  if (typeof window === "undefined") return "full";
  if (current === null) {
    const asked = fromAddress();
    if (asked === "auto") store(null);
    const fixed = asked && asked !== "auto" ? asked : null;
    const kept = fixed ? null : readStored();
    if (kept?.failedUp) noPromote = true;
    current = fixed ?? kept?.level ?? levelFor(device());
    document.documentElement.dataset.perf = current;
    if (fixed) locked = true;
    void probeHardware();
  }
  return current;
}

/** The level was set from the address, so nothing changes it. */
let locked = false;
let probed = false;
let probePromise: Promise<void> | null = null;

/**
 * Find out whether the browser decodes video in hardware. It takes a moment, so the level starts
 * from what the cores and the memory say, and is corrected when the answer arrives (only
 * downwards, and only when nothing was remembered or asked for).
 */
async function probeHardware(): Promise<void> {
  if (probed) return probePromise ?? undefined;
  probed = true;
  probePromise = runProbe();
  return probePromise;
}

async function runProbe(): Promise<void> {
  try {
    const caps = navigator.mediaCapabilities;
    if (!caps?.decodingInfo) return;
    const info = await caps.decodingInfo({
      type: "file",
      video: {
        contentType: 'video/mp4; codecs="avc1.64002a"',
        width: 1920,
        height: 864,
        bitrate: 8_000_000,
        framerate: 60,
      },
    });
    hardwareDecode = info.powerEfficient;
    if (locked || readStored() !== null) return;
    const wanted = levelFor(device());
    if (current && LEVELS.indexOf(wanted) < LEVELS.indexOf(current)) apply(wanted, "device", null);
  } catch {
    // No answer: the level stays as it was.
  }
}

/** Resolves once the first answer about the device is in (or there is none to wait for). */
export function perfReady(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  perfLevel();
  return probePromise ?? Promise.resolve();
}

/** Be told when the level changes. Returns a function that stops it. */
export function onPerfLevel(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Step the level down once (the governor, or a test). Returns the new level. */
export function lowerPerf(reason: string): PerfLevel {
  const next = lowerLevel(perfLevel());
  // Down right after a step up means the step up was wrong. Remember that, so it is not tried
  // again until the memory expires.
  const failedUp = promoted;
  promoted = false;
  noPromote = true;
  if (!locked) apply(next, reason, failedUp ? "failed-up" : "governor");
  return current ?? next;
}

/**
 * Step the level up once, when the device is below what its hardware suggests and nothing in this
 * visit or in the memory says it failed. Returns whether it stepped.
 */
function raisePerf(reason: string): boolean {
  const now = perfLevel();
  if (locked || noPromote) return false;
  const ceiling = levelFor(device());
  if (LEVELS.indexOf(now) >= LEVELS.indexOf(ceiling)) return false;
  promoted = true;
  apply(raiseLevel(now), reason, "governor");
  return true;
}

interface GovernorOptions {
  /** Video frames dropped and shown so far by the picture on top (counters that only grow). */
  video?: () => { dropped: number; total: number } | null;
  /** The page is busy loading or changing and must not be judged. */
  paused?: () => boolean;
}

const WINDOW_MS = 2000;
/** The first seconds after a start are the page getting going, not the device. */
const WARM_MS = 4000;
/** Two bad stretches in a row. One is a hiccup. */
const BAD_NEEDED = 2;
/** After stepping down, give the new level time before judging it. */
const COOL_MS = 6000;
/** Smooth stretches in a row (half a minute) before a device that sits low tries a step up. */
const GOOD_NEEDED = 12;

/**
 * Watch the frame rate and step the level down when it stays low. Counts frames only while the
 * page is visible and `paused` is false. Returns a function that stops it.
 */
export function startGovernor(options: GovernorOptions = {}): () => void {
  if (typeof window === "undefined" || locked) return () => undefined;
  perfLevel();
  let raf = 0;
  let last = 0;
  let deltas: number[] = [];
  let windowStart = performance.now();
  let blockedUntil = windowStart + WARM_MS;
  let bad = 0;
  let good = 0;
  let videoBefore = options.video?.() ?? null;

  const reset = (now: number, wait = 0) => {
    deltas = [];
    windowStart = now;
    last = 0;
    bad = wait > 0 ? 0 : bad;
    blockedUntil = Math.max(blockedUntil, now + wait);
    videoBefore = options.video?.() ?? null;
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (document.hidden || options.paused?.() || now < blockedUntil) {
      reset(now);
      return;
    }
    if (last) deltas.push(now - last);
    last = now;
    if (now - windowStart < WINDOW_MS) return;
    const after = options.video?.() ?? null;
    const video =
      videoBefore && after && after.total >= videoBefore.total
        ? { dropped: after.dropped - videoBefore.dropped, total: after.total - videoBefore.total }
        : null;
    const wasBad = isBad({ deltas, video });
    bad = wasBad ? bad + 1 : 0;
    good = wasBad ? 0 : good + 1;
    // A step up is judged strictly: one bad stretch sends it back down. Two good ones keep it.
    if (promoted && good >= BAD_NEEDED) promoted = false;
    if (bad >= BAD_NEEDED || (promoted && wasBad)) {
      bad = 0;
      good = 0;
      lowerPerf("frame rate");
      reset(now, COOL_MS);
      return;
    }
    if (good >= GOOD_NEEDED && raisePerf("smooth")) {
      good = 0;
      reset(now, COOL_MS);
      return;
    }
    reset(now);
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
  };
}

/** For tests: forget everything decided so far. */
export function resetPerfForTests(): void {
  current = null;
  locked = false;
  probed = false;
  probePromise = null;
  hardwareDecode = null;
  noPromote = false;
  promoted = false;
  listeners.clear();
}
