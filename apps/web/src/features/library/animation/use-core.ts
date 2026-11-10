"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadMedia, mediaUrl, promoteMedia, releaseMedia } from "@/lib/media-store";
import { cancelDeferred } from "@/lib/preload";
import type { CharacterSlug } from "@/lib/slugs";

import { CORE_FILES, fileBytes, loadCoreFiles, type StageBundle } from "./bundle";
import { loadBundle, ORDER } from "./characters";

export interface CoreLoad {
  /** 0 to 1. */
  fraction: number;
  received: number;
  total: number;
}

export type CorePhase = "loading" | "ready" | "missing";

/** The last part of a character's video folder: the group its background items carry. */
const groupOf = (bundle: StageBundle) => bundle.media.dir.split("/").pop() ?? "";

/**
 * The character in front: its stage data, and its welcome and idle loop held in memory, with the
 * real bytes received while they arrive. The stage is mounted only when both are in, so it never
 * starts on a file that is still streaming.
 */
export function useCore(slug: CharacterSlug | null): {
  bundle: StageBundle | null;
  phase: CorePhase;
  load: CoreLoad | null;
} {
  const [state, setState] = useState<{
    slug: CharacterSlug | null;
    bundle: StageBundle | null;
    phase: CorePhase;
    load: CoreLoad | null;
  }>({ slug: null, bundle: null, phase: "loading", load: null });

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    let timer = 0;
    let done = false;
    let latest: CoreLoad | null = null;
    void (async () => {
      const bundle = await loadBundle(slug);
      if (!alive) return;
      if (!bundle) {
        setState({ slug, bundle: null, phase: "missing", load: null });
        return;
      }
      const tier = await bundle.media.tierReady();
      // Wanted now: if a warm up already queued them in the background, they go first.
      for (const file of CORE_FILES) promoteMedia(bundle.media.path(tier, file));
      await loadCoreFiles(bundle, {
        onFraction: (fraction, bytes) => {
          latest = { fraction, received: bytes?.received ?? 0, total: bytes?.total ?? 0 };
          // The panel's bar needs a few updates a second, not one per chunk.
          if (timer || done || !alive) return;
          timer = window.setTimeout(() => {
            timer = 0;
            // A report that comes after the files are in must not take the stage away again.
            if (alive && !done) setState({ slug, bundle, phase: "loading", load: latest });
          }, 120);
        },
      });
      done = true;
      window.clearTimeout(timer);
      if (alive) setState({ slug, bundle, phase: "ready", load: null });
    })();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [slug]);

  if (state.slug !== slug) return { bundle: null, phase: "loading", load: null };
  return { bundle: state.bundle, phase: state.phase, load: state.load };
}

/** A character a ring distance away from `index`. */
const around = (index: number, step: number) =>
  ORDER[(((index + step) % ORDER.length) + ORDER.length) % ORDER.length]!;

/** Let go of a character: what is queued for it, and what it holds in memory. */
async function releaseAll(slug: CharacterSlug) {
  const b = await loadBundle(slug);
  if (!b) return;
  cancelDeferred(groupOf(b));
  cancelDeferred(slug);
  for (const prefix of b.media.release ?? [`${b.media.dir}/`]) releaseMedia(prefix);
}

/** Let go of a character's clips, and keep its welcome and idle loop. */
async function releaseClips(slug: CharacterSlug) {
  const b = await loadBundle(slug);
  if (!b) return;
  const tier = b.media.tier();
  for (const file of Object.keys(b.bytes[tier] ?? {})) {
    if (!(CORE_FILES as readonly string[]).includes(file)) releaseMedia(b.media.path(tier, file));
  }
}

const RELEASE_DELAY_MS = 1600;

/**
 * What is kept in memory as the ring turns: the character in front whole, the welcome and idle loop
 * of the two beside it (warmed in the background, the next first, since the ring drifts to it), and
 * nothing else. A character that moves further away is let go a moment later, unless the ring has
 * come back to it. Leaving the room lets go of everything.
 */
export function useWarmth(index: number | null): void {
  const touched = useRef(new Set<CharacterSlug>());
  const timers = useRef(new Map<CharacterSlug, number>());
  const front = useRef<CharacterSlug | null>(null);

  useEffect(() => {
    if (index === null) return;
    const active = around(index, 0);
    const keep = new Set([active, around(index, 1), around(index, -1)]);
    // The one that was in front keeps its welcome and idle loop only.
    const was = front.current;
    if (was && was !== active) void releaseClips(was);
    front.current = active;
    for (const slug of keep) {
      window.clearTimeout(timers.current.get(slug));
      timers.current.delete(slug);
      touched.current.add(slug);
    }
    for (const slug of touched.current) {
      if (keep.has(slug) || timers.current.has(slug)) continue;
      timers.current.set(
        slug,
        window.setTimeout(() => {
          timers.current.delete(slug);
          touched.current.delete(slug);
          void releaseAll(slug);
        }, RELEASE_DELAY_MS),
      );
    }
    // Warm the next, then the one before (the background slots take two at a time).
    for (const slug of [around(index, 1), around(index, -1)]) {
      void loadBundle(slug).then((b) => {
        if (b) void loadCoreFiles(b, { background: true });
      });
    }
  }, [index]);

  useEffect(() => {
    const all = timers.current;
    const seen = touched.current;
    return () => {
      for (const t of all.values()) window.clearTimeout(t);
      all.clear();
      const slugs = Array.from(seen);
      seen.clear();
      // A moment later, so a quick remount (React's development double mount) keeps them.
      window.setTimeout(() => {
        for (const slug of slugs) void releaseAll(slug);
      }, RELEASE_DELAY_MS);
    };
  }, []);
}

/** The clips of the character in full screen: their load, file by file. */
export interface Clips {
  /** How much of a file has arrived, 0 to 1. */
  fractionOf: (file: string) => number;
  isLoaded: (file: string) => boolean;
  /** The visitor points at a button: its files go first. */
  promote: (files: readonly string[]) => void;
}

/**
 * Load every clip of a character in the background while its full screen view is open, smallest
 * wait first (the entrances and the shorts before the loops and the exits), and report each file's
 * progress a few times a second so the buttons can show it.
 */
export function useClips(bundle: StageBundle | null, enabled: boolean): Clips {
  const fractions = useRef(new Map<string, number>());
  const [, bump] = useState(0);

  useEffect(() => {
    if (!bundle || !enabled) return;
    let alive = true;
    let timer = 0;
    // The file names are the same for every character: start a new count for this one.
    fractions.current = new Map();
    const tier = bundle.media.tier();
    const order = (file: string) =>
      file.endsWith("-loop.mp4") ? 2 : file.endsWith("-out.mp4") ? 3 : 1;
    const files = Object.keys(bundle.bytes[tier] ?? {})
      .filter((f) => !(CORE_FILES as readonly string[]).includes(f))
      .sort((a, b) => order(a) - order(b));
    for (const file of files) {
      void loadMedia(bundle.media.path(tier, file), {
        type: "video/mp4",
        expectedBytes: fileBytes(bundle, file),
        background: true,
        onFraction: (fraction) => {
          fractions.current.set(file, fraction);
          if (timer || !alive) return;
          timer = window.setTimeout(() => {
            timer = 0;
            if (alive) bump((n) => n + 1);
          }, 150);
        },
      }).then(() => {
        fractions.current.set(file, 1);
        if (alive) bump((n) => n + 1);
      });
    }
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [bundle, enabled]);

  const isLoaded = useCallback(
    (file: string) =>
      bundle ? mediaUrl(bundle.media.path(bundle.media.tier(), file)).startsWith("blob:") : false,
    [bundle],
  );
  const fractionOf = useCallback(
    (file: string) => (isLoaded(file) ? 1 : (fractions.current.get(file) ?? 0)),
    [isLoaded],
  );
  const promote = useCallback(
    (files: readonly string[]) => {
      if (!bundle) return;
      for (const f of files) promoteMedia(bundle.media.path(bundle.media.tier(), f));
    },
    [bundle],
  );
  return { fractionOf, isLoaded, promote };
}
