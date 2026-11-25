"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { expectReady } from "@/lib/page-ready";

import type { ClipView } from "./behaviours";
import type { Insets } from "./scene-kit";
import type { ModelStage } from "./stage";
import type { ModelView } from "./types";
import { loadViewFile } from "./view-files";

type StageStatus = "loading" | "ready" | "nogl" | "failed";

const noopSubscribe = () => () => undefined;

export interface StageApi {
  status: StageStatus;
  /** 0 to 100: the bytes of the view on stage that have arrived. */
  percent: number;
  clip: ClipView | null;
  /** The camera has left its default place. */
  moved: boolean;
  /** The engine, once it is up (null without WebGL). */
  stage: () => ModelStage | null;
  retry: () => void;
}

/** What the timeline writes into on every frame, without React. */
export interface TickSink {
  current: ((time: number, duration: number) => void) | null;
}

/**
 * The stage's life: its engine (three, in its own chunk), the view on show, and what the panels
 * read from it. The curtain of a page change waits only until the first view is drawn.
 */
export function useStage(
  host: RefObject<HTMLDivElement | null>,
  view: ModelView | null,
  insets: Insets,
  tick: TickSink,
): StageApi {
  const stageRef = useRef<ModelStage | null>(null);
  const markRef = useRef<(() => void) | null>(null);
  const supported = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  const [state, setState] = useState<StageStatus>("loading");
  const [engineNo, setEngineNo] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [percent, setPercent] = useState(0);
  const [clip, setClip] = useState<ClipView | null>(null);
  const [moved, setMoved] = useState(false);
  const status: StageStatus = supported ? state : "nogl";

  // The engine and its canvas.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const mark = expectReady("library-models-stage");
    markRef.current = mark;
    if (!supported) {
      mark();
      return mark;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { ModelStage: Stage } = await import("./stage");
        if (cancelled) return;
        const stage = new Stage(el, {
          onClip: (v) => {
            setClip(v);
          },
          onTick: (time, duration) => {
            tick.current?.(time, duration);
          },
          onMoved: (m) => {
            setMoved(m);
          },
        });
        stage.canvas.setAttribute("data-cursor", "Drag");
        stageRef.current = stage;
        setEngineNo((n) => n + 1);
      } catch {
        if (!cancelled) setState("nogl");
        mark();
      }
    })();
    return () => {
      cancelled = true;
      stageRef.current?.dispose();
      stageRef.current = null;
      mark();
    };
  }, [host, supported, tick]);

  // The panels move: the model is framed in the space they leave.
  useEffect(() => {
    stageRef.current?.setInsets(insets);
  }, [insets, engineNo]);

  // The view on show.
  useEffect(() => {
    const stage = stageRef.current;
    if (!view || !stage) return;
    let live = true;
    setState("loading");
    setPercent(0);
    setClip(null);
    void loadViewFile(view, {
      onProgress: (fraction) => {
        if (live) setPercent(Math.round(fraction * 100));
      },
    })
      .then(async (bytes) => {
        if (!live) return;
        await stage.show(view, bytes);
        if (!live) return;
        setState("ready");
        setPercent(100);
        // The first frame is drawn on the next animation frame.
        requestAnimationFrame(() => {
          markRef.current?.();
        });
      })
      .catch(() => {
        if (!live) return;
        setState("failed");
        markRef.current?.();
      });
    return () => {
      live = false;
    };
  }, [view, engineNo, attempt]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);
  const get = useCallback(() => stageRef.current, []);

  return { status, percent, clip, moved, stage: get, retry };
}
