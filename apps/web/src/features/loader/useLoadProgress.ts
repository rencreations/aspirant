import { useEffect, useEffectEvent, useState } from "react";

import { asset } from "@/lib/asset";

import { DISPLAY_FALLBACK, FONT_TIMEOUT_MS, HARD_TIMEOUT_MS, MIN_DURATION_MS } from "./constants";
import { stepProgress, targetProgress } from "./progress";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Loads the display, serif and mono faces the title needs. Never rejects, never hangs. */
async function loadFonts(): Promise<void> {
  if (!("fonts" in document)) return;
  const style = getComputedStyle(document.body);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(`${name}-stack`).trim() ||
    style.getPropertyValue(name).trim() ||
    fallback;
  const display = token("--font-display", DISPLAY_FALLBACK);
  const serif = token("--font-serif", '"Instrument Serif"');
  const mono = token("--font-mono", '"JetBrains Mono Variable"');
  const loads = [`900 64px ${display}`, `italic 400 32px ${serif}`, `400 32px ${mono}`].map(
    (font) => document.fonts.load(font, "THE ASPIRANTS 0123456789"),
  );
  await Promise.race([
    Promise.allSettled(loads).then(() => document.fonts.ready),
    wait(FONT_TIMEOUT_MS),
  ]);
}

function decodeImage(src: string): Promise<void> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  if (typeof img.decode !== "function") return Promise.resolve();
  return img.decode().catch(() => undefined);
}

export interface LoadProgressOptions {
  /** Images to decode before the title forms. Paths go through asset() for the base path. */
  preload: readonly string[];
  /** Called every frame with the displayed progress (0 to 1). Write to the DOM here, not to state. */
  onProgress: (progress: number) => void;
  minDurationMs?: number;
  hardTimeoutMs?: number;
}

/**
 * Real loading progress: fonts plus preloaded images, held to a minimum duration and a hard
 * timeout. The eased value is pushed through `onProgress` from a frame loop; React state only
 * changes twice (fonts ready, complete).
 */
export function useLoadProgress({
  preload,
  onProgress,
  minDurationMs = MIN_DURATION_MS,
  hardTimeoutMs = HARD_TIMEOUT_MS,
}: LoadProgressOptions) {
  const [complete, setComplete] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const emit = useEffectEvent(onProgress);
  const key = preload.join("\n");

  useEffect(() => {
    let cancelled = false;
    const urls = key ? key.split("\n") : [];
    const total = urls.length + 1;
    // All timing uses the frame clock, so the first frame is time zero.
    let start = -1;
    let last = 0;
    let done = 0;
    let doneSeen = 0;
    let lastDoneAt = 0;
    let display = 0;
    let raf = 0;

    const finish = () => {
      done += 1;
    };
    void loadFonts().then(() => {
      finish();
      if (!cancelled) setFontsReady(true);
    });
    for (const url of urls) void decodeImage(asset(url)).then(finish);

    const tick = (now: number) => {
      if (cancelled) return;
      if (start < 0) {
        start = now;
        last = now;
        lastDoneAt = now;
      }
      if (done !== doneSeen) {
        doneSeen = done;
        lastDoneAt = now;
      }
      const elapsedMs = now - start;
      const target =
        elapsedMs >= hardTimeoutMs
          ? 1
          : targetProgress({
              done,
              total,
              elapsedMs,
              sinceLastMs: now - lastDoneAt,
              minDurationMs,
            });
      display = stepProgress(display, target, now - last);
      last = now;
      emit(display);
      if (display >= 1) {
        setComplete(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [key, minDurationMs, hardTimeoutMs]);

  return { complete, fontsReady };
}
