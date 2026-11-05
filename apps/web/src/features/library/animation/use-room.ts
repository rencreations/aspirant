"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import type { StageState } from "@/features/character/stage/director";
import type { StageApi } from "@/features/character/stage/stage";
import type { SceneName } from "@/features/character/stage/timeline";
import { mediaUrl, promoteMedia, releaseMedia } from "@/lib/media-store";
import { cancelDeferred, runPreload, type PreloadItem } from "@/lib/preload";
import { isCharacterSlug, type CharacterSlug } from "@/lib/slugs";

import { CORE_FILES, loadCoreFiles, type StageBundle } from "./bundle";
import { firstReady, loadBundle } from "./characters";
import { sceneSeconds, type RoomPhase } from "./room-math";
import type { AnimClip } from "./types";

/** The shutter takes this long to close before the picture is swapped under it. */
const CLOSE_MS = 320;
/** A character that was left is let go after this, unless the visitor is back on it. */
const RELEASE_DELAY_MS = 1600;
/** A tab is warmed after the pointer has rested on it this long. */
const WARM_DELAY_MS = 140;

const BOOT: StageState = {
  mode: "boot",
  scene: null,
  loading: false,
  ui: false,
  next: null,
  leaving: false,
  fast: false,
  wait: null,
};

/** The address never tells the room anything new while it is open. */
const subscribeNothing = () => () => undefined;

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** The last part of a character's video folder, which the engine uses to drop what is queued. */
const groupOf = (bundle: StageBundle) => bundle.media.dir.split("/").pop() ?? "";

/** True when a file of the bundle is in memory (`mediaUrl` gives an in-memory address only then). */
const inMemory = (bundle: StageBundle, file: string) =>
  mediaUrl(bundle.media.path(bundle.media.tier(), file)).startsWith("blob:");

interface LoadInfo {
  /** 0 to 1. */
  fraction: number;
  received: number;
  total: number;
}

export interface Room {
  /** The tab that is chosen. */
  selected: CharacterSlug | null;
  /** The character whose stage is on screen, or loading. */
  shown: CharacterSlug | null;
  phase: RoomPhase;
  bundle: StageBundle | null;
  /** Changes when the stage has to be built again (a new character, or the welcome again). */
  stageKey: string;
  /** The shutter over the stage. */
  closed: boolean;
  state: StageState;
  onState: (state: StageState) => void;
  load: LoadInfo | null;
  /** The scene the visitor pressed while the welcome was still playing. */
  wanted: SceneName | null;
  /** How much of a file of the shown character has arrived, 0 to 1. */
  fractionOf: (file: string) => number;
  isLoaded: (file: string) => boolean;
  /** The clock of the idle loop, so the ruler can start where the loop is. */
  idleClock: () => { time: number } | null;
  /** The stage is scrolled out of view (stop decoding), or back. */
  setHidden: (hidden: boolean) => void;
  pick: (slug: CharacterSlug) => void;
  warmTab: (slug: CharacterSlug) => void;
  welcome: () => void;
  idle: () => void;
  play: (scene: SceneName) => void;
  warmScene: (scene: SceneName) => void;
}

interface Options {
  clips: readonly AnimClip[];
}

/**
 * Everything that makes the room work, kept out of the markup: which character is up, the load of
 * its first two videos (with the real bytes), the shutter that hides every cut, the buttons that
 * call the stage, what is released when a character is left, and the warm up of the tab the pointer
 * rests on.
 */
export function useRoom({ clips }: Options): { room: Room; stage: RefObject<StageApi | null> } {
  const stage = useRef<StageApi>(null);
  // The address names the first character (`?c=selena`, or a clip `?i=animation-selena-badge`). It
  // is read from the browser without a state change, and the visitor's own choice wins after that.
  const search = useSyncExternalStore(
    subscribeNothing,
    () => window.location.search,
    () => "",
  );
  const fromAddress = useMemo(() => {
    const params = new URLSearchParams(search);
    const clip = clips.find((c) => c.id === params.get("i"));
    const asked = params.get("c") ?? "";
    return clip?.chars[0] ?? (isCharacterSlug(asked) ? asked : firstReady());
  }, [search, clips]);
  const [picked, setPicked] = useState<CharacterSlug | null>(null);
  const selected = clips.length === 0 ? null : (picked ?? fromAddress);
  const [shown, setShown] = useState<CharacterSlug | null>(null);
  const [phase, setPhase] = useState<RoomPhase>("loading");
  const [bundle, setBundle] = useState<StageBundle | null>(null);
  const [nonce, setNonce] = useState(0);
  const [closed, setClosed] = useState(true);
  const [state, setState] = useState<StageState>(BOOT);
  const [load, setLoad] = useState<LoadInfo | null>(null);
  const [wanted, setWanted] = useState<SceneName | null>(null);
  const [, bump] = useState(0);

  const selectedRef = useRef<CharacterSlug | null>(null);
  const shownRef = useRef<CharacterSlug | null>(null);
  const phaseRef = useRef<RoomPhase>("loading");
  const stateRef = useRef<StageState>(BOOT);
  const bundleRef = useRef<StageBundle | null>(null);
  const cutting = useRef(false);
  /** The shutter stays shut until the next stage has begun, so no swap is ever seen. */
  const holdShut = useRef(true);
  const wantedRef = useRef<SceneName | null>(null);
  const fractions = useRef(new Map<string, number>());
  const releaseTimers = useRef(new Map<CharacterSlug, number>());
  const warmed = useRef<CharacterSlug | null>(null);
  const warmTimer = useRef(0);
  const bumpTimer = useRef(0);

  const setWantedBoth = useCallback((scene: SceneName | null) => {
    wantedRef.current = scene;
    setWanted(scene);
  }, []);

  const setPhaseBoth = useCallback((next: RoomPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Tell the page that a file has more of it in memory (at most a few times a second). */
  const noteFile = useCallback((slug: CharacterSlug, file: string, fraction: number) => {
    fractions.current.set(`${slug}/${file}`, fraction);
    if (selectedRef.current !== slug || bumpTimer.current) return;
    bumpTimer.current = window.setTimeout(() => {
      bumpTimer.current = 0;
      bump((n) => n + 1);
    }, 120);
  }, []);

  /** Let go of a character: what is queued for it, and what it holds in memory. */
  const releaseCharacter = useCallback(async (slug: CharacterSlug) => {
    const b = await loadBundle(slug);
    if (!b) return;
    cancelDeferred(groupOf(b));
    for (const prefix of b.media.release ?? [`${b.media.dir}/`]) releaseMedia(prefix);
    for (const key of Array.from(fractions.current.keys())) {
      if (key.startsWith(`${slug}/`)) fractions.current.delete(key);
    }
  }, []);

  /**
   * The stage releases a character when it unmounts, but its timer is cancelled by the next stage
   * that mounts, which is another character's. So the room does it, a moment after the switch.
   * Downloads that are already running cannot be stopped; their files are let go when they arrive.
   */
  const scheduleRelease = useCallback(
    (slug: CharacterSlug) => {
      window.clearTimeout(releaseTimers.current.get(slug));
      releaseTimers.current.set(
        slug,
        window.setTimeout(() => {
          releaseTimers.current.delete(slug);
          if (selectedRef.current === slug || warmed.current === slug) return;
          void releaseCharacter(slug);
        }, RELEASE_DELAY_MS),
      );
    },
    [releaseCharacter],
  );

  const cancelRelease = useCallback((slug: CharacterSlug) => {
    window.clearTimeout(releaseTimers.current.get(slug));
    releaseTimers.current.delete(slug);
  }, []);

  /** The loading items of a character, with the arrival of each file reported to the room. */
  const trackedItems = useCallback(
    (b: StageBundle): PreloadItem[] =>
      b.media.items().map((item) => {
        const file = item.id.slice(item.id.lastIndexOf(":") + 1);
        return {
          ...item,
          run: async (report, context) => {
            let step = -1;
            try {
              const result = await item.run((fraction, bytes) => {
                report(fraction, bytes);
                const now = Math.floor(fraction * 20);
                if (now !== step) {
                  step = now;
                  noteFile(b.slug, file, fraction);
                }
              }, context);
              noteFile(b.slug, file, 1);
              return result;
            } finally {
              // A download that ends after the visitor left the character is let go at once.
              if (selectedRef.current !== b.slug && warmed.current !== b.slug) {
                releaseMedia(b.media.path(b.media.tier(), file));
                fractions.current.delete(`${b.slug}/${file}`);
              }
            }
          },
        };
      }),
    [noteFile],
  );

  // Choosing a character: close the shutter, swap, load the first two videos, mount the stage.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    cancelRelease(selected);
    selectedRef.current = selected;
    holdShut.current = true;
    void (async () => {
      setClosed(true);
      if (shownRef.current) await sleep(CLOSE_MS);
      if (!alive) return;
      shownRef.current = selected;
      setShown(selected);
      setBundle(null);
      bundleRef.current = null;
      setLoad(null);
      setState(BOOT);
      stateRef.current = BOOT;
      setPhaseBoth("loading");
      const b = await loadBundle(selected);
      if (!alive) return;
      if (!b) {
        holdShut.current = false;
        setPhaseBoth("preparing");
        setClosed(false);
        return;
      }
      bundleRef.current = b;
      setBundle(b);
      // A tab that was warmed is already downloading: the visitor wants it now.
      const tier = await b.media.tierReady();
      for (const file of CORE_FILES) promoteMedia(b.media.path(tier, file));
      await runPreload(trackedItems(b), (p) => {
        if (!alive) return;
        const total = p.bytes?.total ?? 0;
        setLoad({
          fraction: p.progress,
          received: p.bytes?.received ?? 0,
          total,
        });
      });
      if (!alive) return;
      holdShut.current = false;
      setPhaseBoth("ready");
    })();
    return () => {
      alive = false;
      scheduleRelease(selected);
    };
  }, [selected, cancelRelease, scheduleRelease, setPhaseBoth, trackedItems]);

  // Keep the address in step with the tab, so a view can be shared.
  useEffect(() => {
    if (!selected) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("c") === selected && !url.searchParams.has("i")) return;
    url.searchParams.set("c", selected);
    url.searchParams.delete("i");
    window.history.replaceState(window.history.state, "", url);
  }, [selected]);

  /**
   * The stage reports every change. The shutter opens when it has begun to play, and a clip the
   * visitor pressed during the welcome starts as soon as the loop is up.
   */
  const onState = useCallback(
    (next: StageState) => {
      stateRef.current = next;
      setState(next);
      if (next.mode !== "boot" && !holdShut.current) setClosed(false);
      const scene = wantedRef.current;
      if (scene && next.mode === "idle" && next.ui) {
        setWantedBoth(null);
        window.setTimeout(() => {
          stage.current?.request(scene);
        }, 0);
      }
    },
    [setWantedBoth],
  );

  /** Run `during` with the shutter closed, then open it. */
  const cut = useCallback(async (during: () => Promise<unknown> | void) => {
    if (cutting.current) return;
    cutting.current = true;
    holdShut.current = true;
    setClosed(true);
    await sleep(CLOSE_MS);
    try {
      await during();
    } finally {
      holdShut.current = false;
      setClosed(false);
      cutting.current = false;
    }
  }, []);

  const pick = useCallback(
    (slug: CharacterSlug) => {
      if (selectedRef.current === slug) return;
      setWantedBoth(null);
      selectedRef.current = slug;
      setPicked(slug);
    },
    [setWantedBoth],
  );

  /** Start the first two videos of the tab the pointer rests on, in the background. */
  const warmTab = useCallback(
    (slug: CharacterSlug) => {
      window.clearTimeout(warmTimer.current);
      if (slug === selectedRef.current || warmed.current === slug) return;
      warmTimer.current = window.setTimeout(() => {
        void loadBundle(slug).then((b) => {
          if (!b || slug === selectedRef.current) return;
          const before = warmed.current;
          warmed.current = slug;
          // One warmed character at a time: a sweep over the tabs never piles up downloads.
          if (before && before !== selectedRef.current) scheduleRelease(before);
          void loadCoreFiles(b, { background: true }).then(() => {
            if (selectedRef.current !== slug && warmed.current !== slug)
              void releaseCharacter(slug);
          });
        });
      }, WARM_DELAY_MS);
    },
    [releaseCharacter, scheduleRelease],
  );

  const welcome = useCallback(() => {
    if (phaseRef.current !== "ready" || cutting.current) return;
    setWantedBoth(null);
    cutting.current = true;
    holdShut.current = true;
    setClosed(true);
    void sleep(CLOSE_MS).then(() => {
      // A new stage begins with the welcome. The old state must not open the shutter early.
      stateRef.current = BOOT;
      setState(BOOT);
      holdShut.current = false;
      setNonce((n) => n + 1);
      cutting.current = false;
    });
  }, [setWantedBoth]);

  const idle = useCallback(() => {
    if (phaseRef.current !== "ready") return;
    setWantedBoth(null);
    const api = stage.current;
    const { mode } = stateRef.current;
    if (mode === "page" || mode === "intro") api?.leave();
    else if (mode === "queued") api?.cancel();
    else if (mode === "welcome" || mode === "short") {
      void cut(() => api?.jumpToIdle());
    }
  }, [cut, setWantedBoth]);

  const play = useCallback(
    (scene: SceneName) => {
      if (phaseRef.current !== "ready") return;
      const api = stage.current;
      const s = stateRef.current;
      if (s.scene === scene && (s.mode === "page" || s.mode === "intro")) {
        api?.leave();
        return;
      }
      if (s.scene === scene && s.mode === "queued") {
        api?.cancel();
        return;
      }
      if (s.mode === "boot" || s.mode === "welcome") {
        // The welcome plays to its end first, then this one.
        setWantedBoth(wantedRef.current === scene ? null : scene);
        return;
      }
      api?.request(scene);
    },
    [setWantedBoth],
  );

  const warmScene = useCallback((scene: SceneName) => {
    stage.current?.warm(scene);
  }, []);

  // A pose is a page of the engine and holds until it is left: it is left after one loop.
  useEffect(() => {
    const b = bundleRef.current;
    if (state.mode !== "page" || !state.scene || !b) return;
    const scene = state.scene;
    const page = b.timeline.pages[scene as keyof typeof b.timeline.pages];
    const ms = (page.loop.frames / b.timeline.fps) * 1000;
    const timer = window.setTimeout(() => {
      stage.current?.leave();
    }, ms);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.mode, state.scene]);

  // Leaving the room: nothing keeps running, nothing stays in memory.
  useEffect(() => {
    const timers = releaseTimers.current;
    return () => {
      window.clearTimeout(warmTimer.current);
      window.clearTimeout(bumpTimer.current);
      for (const t of timers.values()) window.clearTimeout(t);
      const slugs = [selectedRef.current, warmed.current].filter(
        (s): s is CharacterSlug => s !== null,
      );
      selectedRef.current = null;
      warmed.current = null;
      for (const slug of slugs) void releaseCharacter(slug);
    };
  }, [releaseCharacter]);

  const fractionOf = useCallback(
    (file: string) => fractions.current.get(`${shownRef.current ?? ""}/${file}`) ?? 0,
    [],
  );
  const idleClock = useCallback(() => stage.current?.idleClock() ?? null, []);
  const setHidden = useCallback((hidden: boolean) => {
    stage.current?.setHidden(hidden);
  }, []);

  const room: Room = {
    selected,
    shown,
    phase,
    bundle,
    stageKey: `${shown ?? "none"}:${nonce}`,
    closed,
    state,
    onState,
    load,
    wanted,
    fractionOf,
    isLoaded: (file) => (bundle ? inMemory(bundle, file) : false),
    idleClock,
    setHidden,
    pick,
    warmTab,
    welcome,
    idle,
    play,
    warmScene,
  };
  return { room, stage };
}

/** Seconds of a clip: the data file's figure, or the timeline's when the data has none yet. */
export function clipSeconds(clip: AnimClip, bundle: StageBundle | null): number | null {
  if (clip.dur !== null) return clip.dur;
  if (!bundle || !clip.scene) return null;
  return sceneSeconds(bundle.timeline, clip.scene);
}
