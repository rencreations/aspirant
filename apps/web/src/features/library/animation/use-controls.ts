"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { StageState } from "@/features/character/stage/director";
import type { StageApi } from "@/features/character/stage/stage";
import type { SceneName } from "@/features/character/stage/timeline";

import type { StageBundle } from "./bundle";

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

export interface Controls {
  state: StageState;
  onState: (state: StageState) => void;
  /** The scene pressed while the welcome still played: it starts when the idle loop is up. */
  wanted: SceneName | null;
  play: (scene: SceneName) => void;
  warm: (scene: SceneName) => void;
  /** A new stage begins (the welcome again, or another character): forget the old state. */
  reset: () => void;
}

/**
 * What the buttons of the full screen view do to the stage: a press asks for a clip, a second press
 * on a pose that holds takes it back to idle, a press during the welcome waits for its end, and a
 * pose goes back to idle by itself after one loop, so the character always comes back to rest.
 */
export function useControls(
  stage: RefObject<StageApi | null>,
  bundle: StageBundle | null,
): Controls {
  const [state, setState] = useState<StageState>(BOOT);
  const [wanted, setWanted] = useState<SceneName | null>(null);
  const stateRef = useRef<StageState>(BOOT);
  const wantedRef = useRef<SceneName | null>(null);

  const setWantedBoth = useCallback((scene: SceneName | null) => {
    wantedRef.current = scene;
    setWanted(scene);
  }, []);

  const onState = useCallback(
    (next: StageState) => {
      stateRef.current = next;
      setState(next);
      const scene = wantedRef.current;
      if (scene && next.mode === "idle" && next.ui) {
        setWantedBoth(null);
        window.setTimeout(() => {
          stage.current?.request(scene);
        }, 0);
      }
    },
    [setWantedBoth, stage],
  );

  const reset = useCallback(() => {
    stateRef.current = BOOT;
    setState(BOOT);
    setWantedBoth(null);
  }, [setWantedBoth]);

  const play = useCallback(
    (scene: SceneName) => {
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
        setWantedBoth(wantedRef.current === scene ? null : scene);
        return;
      }
      api?.request(scene);
    },
    [setWantedBoth, stage],
  );

  const warm = useCallback(
    (scene: SceneName) => {
      stage.current?.warm(scene);
    },
    [stage],
  );

  // A pose is a page of the engine and holds until it is left: it is left after one loop.
  useEffect(() => {
    if (state.mode !== "page" || !state.scene || !bundle) return;
    const page = bundle.timeline.pages[state.scene as keyof typeof bundle.timeline.pages];
    if (!page) return;
    const timer = window.setTimeout(
      () => {
        stage.current?.leave();
      },
      (page.loop.frames / bundle.timeline.fps) * 1000,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.mode, state.scene, bundle, stage]);

  return { state, onState, wanted, play, warm, reset };
}
