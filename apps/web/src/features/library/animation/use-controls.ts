"use client";

import { useCallback, useRef, useState, type RefObject } from "react";

import type { StageState } from "@/features/character/stage/director";
import type { StageApi } from "@/features/character/stage/stage";
import { isPage, type SceneName } from "@/features/character/stage/timeline";

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
  /** A scene pressed before its files were in memory: it starts when they are. */
  held: SceneName | null;
  /**
   * An option is pressed. A scene whose files are not in memory is held until they are, a second
   * press on a scene that waits lets it go, and a press on the pose that plays leaves it.
   */
  press: (scene: SceneName, ready: boolean) => void;
  /** The held scene's files are in: the stage plays it. */
  release: () => void;
  /** Back to idle from a pose. */
  leave: () => void;
  /** Leave whatever is pressed, waiting or posed (the view closes): she goes back to rest. */
  settle: () => void;
  warm: (scene: SceneName) => void;
  /** A new stage begins (the welcome again, or another character): forget the old state. */
  reset: () => void;
}

/** The stage takes a new scene now: she idles, or she is back in her idle pose while she hands back. */
const accepts = (s: StageState) => s.mode === "idle" || s.mode === "queued" || s.ui;

/**
 * What the buttons of the full screen view do to the stage. A pose loops until the visitor takes
 * her back to idle; an action plays once and hands back by itself.
 */
export function useControls(stage: RefObject<StageApi | null>): Controls {
  const [state, setState] = useState<StageState>(BOOT);
  const [held, setHeld] = useState<SceneName | null>(null);
  const stateRef = useRef<StageState>(BOOT);
  const heldRef = useRef<SceneName | null>(null);
  /** Back to idle was pressed while the entrance handed over to the loop: it leaves once posed. */
  const leaveAsked = useRef(false);

  const setHeldBoth = useCallback((scene: SceneName | null) => {
    heldRef.current = scene;
    setHeld(scene);
  }, []);

  const onState = useCallback(
    (next: StageState) => {
      stateRef.current = next;
      setState(next);
      if (leaveAsked.current && next.mode === "page") {
        leaveAsked.current = false;
        window.setTimeout(() => {
          stage.current?.leave();
        }, 0);
      }
    },
    [stage],
  );

  const reset = useCallback(() => {
    stateRef.current = BOOT;
    setState(BOOT);
    setHeldBoth(null);
    leaveAsked.current = false;
  }, [setHeldBoth]);

  const leave = useCallback(() => {
    const s = stateRef.current;
    if (!s.scene || !isPage(s.scene)) return;
    if (s.mode === "intro" || s.mode === "page") stage.current?.leave();
    else if (s.mode === "returning" && !s.leaving && !s.ui) leaveAsked.current = true;
  }, [stage]);

  const press = useCallback(
    (scene: SceneName, ready: boolean) => {
      const api = stage.current;
      const s = stateRef.current;
      if (heldRef.current === scene) {
        setHeldBoth(null);
        return;
      }
      if ((s.scene === scene && s.mode === "queued") || s.next === scene) {
        api?.cancel();
        return;
      }
      const posed = s.mode === "page" || s.mode === "intro" || (s.mode === "returning" && !s.ui);
      if (s.scene === scene && isPage(scene) && !s.leaving && posed) {
        leave();
        return;
      }
      if (!ready) {
        setHeldBoth(scene);
        return;
      }
      if (accepts(s)) api?.request(scene);
    },
    [leave, setHeldBoth, stage],
  );

  const release = useCallback(() => {
    const scene = heldRef.current;
    if (!scene || !accepts(stateRef.current)) return;
    setHeldBoth(null);
    stage.current?.request(scene);
  }, [setHeldBoth, stage]);

  const settle = useCallback(() => {
    const s = stateRef.current;
    setHeldBoth(null);
    if (s.mode === "queued" || s.next) stage.current?.cancel();
    leave();
  }, [leave, setHeldBoth, stage]);

  const warm = useCallback(
    (scene: SceneName) => {
      stage.current?.warm(scene);
    },
    [stage],
  );

  return { state, onState, held, press, release, leave, settle, warm, reset };
}
