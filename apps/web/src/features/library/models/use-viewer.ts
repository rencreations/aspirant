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
import { audio } from "@/lib/audio";
import { usePageVisible } from "@/lib/hooks";
import { expectReady } from "@/lib/page-ready";

import type { Insets, ModelViewer } from "./engine";
import { azimuthDegrees } from "./logic";
import { loadBundle, type ModelBundle } from "./model-bundle";
import type { ModelItem, ModelLayer } from "./types";

type ViewerStatus = "loading" | "ready" | "nogl" | "failed";

/** The material of the robot's face screen: the sheet the model came with. */
const ROBOT_FACE = "jiqirenbiaoqing_skin09_d";
const ALL_ON: Record<ModelLayer, boolean> = { body: true, weapon: true, robot: true };
/** One step of an arrow key, in radians. */
const TURN_STEP = 0.17;
const TILT_STEP = 0.1;

const noopSubscribe = () => () => undefined;

/**
 * The side columns of the layout grid, as the strips of the stage they cover. On a narrow screen
 * the layout is not a grid and nothing covers the sides.
 */
function insetsOf(layout: HTMLElement | null): Insets {
  if (!layout) return { left: 0, right: 0 };
  const style = getComputedStyle(layout);
  const columns = style.gridTemplateColumns.split(" ").map(parseFloat);
  if (style.display !== "grid" || columns.length < 3) return { left: 0, right: 0 };
  const gap = parseFloat(style.columnGap) || 0;
  return {
    left: parseFloat(style.paddingLeft) + (columns[0] ?? 0) + gap / 2,
    right: parseFloat(style.paddingRight) + (columns[2] ?? 0) + gap / 2,
  };
}

/** The three elements the viewer writes into. The page makes the refs and puts them on its elements. */
export interface ViewerRefs {
  /** The box the canvas lives in. The canvas is made by the hook. */
  host: RefObject<HTMLDivElement | null>;
  /** The grid of words laid over the stage: the model is framed between its side columns. */
  layout: RefObject<HTMLDivElement | null>;
  /** The two readouts (degrees round the model, and the zoom) are written straight into these. */
  az: RefObject<HTMLSpanElement | null>;
  zoom: RefObject<HTMLSpanElement | null>;
}

export interface ViewerApi {
  status: ViewerStatus;
  /** 0 to 100, the bytes of the model on stage that have arrived. */
  percent: number;
  layers: Record<ModelLayer, boolean>;
  /** The sheet on the robot's face: -1 is the one the model came with. */
  face: number;
  spin: boolean;
  all: boolean;
  /** The address of an expression sheet, or undefined until the model is loaded. */
  faceUrl: (index: number) => string | undefined;
  toggleLayer: (layer: ModelLayer) => void;
  pickFace: (index: number) => void;
  reset: () => void;
  toggleSpin: () => void;
  toggleAll: () => void;
  zoomBy: (factor: number) => void;
  /** An arrow key: -1, 0 or 1 on each side. */
  turn: (dx: number, dy: number) => void;
  retry: () => void;
}

/**
 * The viewer's life: its canvas and engine (three, in its own chunk), the model on stage, and the
 * switches. The page never waits on it: the curtain waits only until the first model is drawn.
 */
export function useViewer(model: ModelItem | undefined, refs: ViewerRefs): ViewerApi {
  const { host: hostRef, layout: layoutRef, az: azRef, zoom: zoomRef } = refs;
  const viewerRef = useRef<ModelViewer | null>(null);
  const markRef = useRef<(() => void) | null>(null);
  const layersRef = useRef<Record<ModelLayer, boolean>>({ ...ALL_ON });

  const supported = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  const [state, setStatus] = useState<ViewerStatus>("loading");
  const status: ViewerStatus = supported ? state : "nogl";
  // Counts the engines that have come up. The model is put on stage each time a new one is ready (a
  // flag that went false and true again inside one batch would change nothing and be missed).
  const [engineNo, setEngineNo] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [layers, setLayers] = useState<Record<ModelLayer, boolean>>({ ...ALL_ON });
  const [percent, setPercent] = useState(0);
  const [face, setFace] = useState(-1);
  const [spin, setSpin] = useState(true);
  const [all, setAll] = useState(false);
  const [bundle, setBundle] = useState<ModelBundle | null>(null);
  const visible = usePageVisible();

  // The engine and its canvas. The canvas is made here, not in the JSX, so a new engine always
  // gets a fresh one (a lost context cannot be reused).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mark = expectReady("library-models-stage");
    markRef.current = mark;
    if (!supported) {
      mark();
      return mark;
    }
    let cancelled = false;
    let viewer: ModelViewer | null = null;
    let observer: ResizeObserver | null = null;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-cursor", "Drag");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    void (async () => {
      try {
        const { ModelViewer: Viewer } = await import("./engine");
        if (cancelled) return;
        viewer = new Viewer(canvas, {
          onView: (az, zoom) => {
            if (azRef.current)
              azRef.current.textContent = String(azimuthDegrees(az)).padStart(3, "0");
            if (zoomRef.current) zoomRef.current.textContent = zoom.toFixed(1);
          },
          onLost: () => {
            setStatus("failed");
          },
        });
        viewerRef.current = viewer;
        const fit = () => {
          viewer?.resize(host.clientWidth, host.clientHeight, insetsOf(layoutRef.current));
        };
        observer = new ResizeObserver(fit);
        observer.observe(host);
        if (layoutRef.current) observer.observe(layoutRef.current);
        fit();
        setEngineNo((n) => n + 1);
      } catch (error) {
        console.error("The 3D viewer could not start.", error);
        setStatus("failed");
        mark();
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      viewer?.dispose();
      viewerRef.current = null;
      canvas.remove();
      mark();
    };
    // The refs never change.
  }, [supported, attempt, hostRef, layoutRef, azRef, zoomRef]);

  // Put the chosen model on the stage.
  const modelId = model?.id;
  useEffect(() => {
    const viewer = viewerRef.current;
    if (engineNo === 0 || !viewer || !model) return;
    let live = true;
    setStatus("loading");
    setFace(-1);
    setPercent(0);
    setBundle(null);
    layersRef.current = { ...ALL_ON };
    setLayers({ ...ALL_ON });
    loadBundle(model, {
      onProgress: (fraction) => {
        if (live) setPercent(Math.round(fraction * 100));
      },
    })
      .then(async (loaded) => {
        await viewer.show(loaded, model.model);
        if (!live) return;
        (Object.keys(layersRef.current) as ModelLayer[]).forEach((l) => {
          viewer.setLayer(l, layersRef.current[l]);
        });
        viewer.setFrameAll(false);
        setAll(false);
        setBundle(loaded);
        setStatus("ready");
        // One frame later, so the curtain opens on a drawn model.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => markRef.current?.());
        });
      })
      .catch((error: unknown) => {
        // A model that was replaced, or a room that was left, is not a failure.
        if (!live) return;
        console.error("The 3D model could not be shown.", error);
        setStatus("failed");
        markRef.current?.();
      });
    return () => {
      live = false;
    };
    // `model` follows `modelId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineNo, modelId]);

  // The loop runs while the model is shown and the tab is in front.
  useEffect(() => {
    viewerRef.current?.setRunning(status === "ready" && visible);
  }, [status, visible]);

  const toggleLayer = useCallback((layer: ModelLayer) => {
    audio.blip("click");
    setLayers((prev) => {
      const next = { ...prev, [layer]: !prev[layer] };
      layersRef.current = next;
      viewerRef.current?.setLayer(layer, next[layer]);
      return next;
    });
  }, []);

  const faceUrl = useCallback(
    (index: number): string | undefined => {
      if (!bundle) return undefined;
      const url = index < 0 ? bundle.maps.get(ROBOT_FACE) : bundle.faces[index];
      return url === "" ? undefined : url;
    },
    [bundle],
  );

  const pickFace = useCallback(
    (index: number) => {
      audio.blip("click");
      setFace(index);
      void viewerRef.current?.setFace(index, index < 0 ? null : (faceUrl(index) ?? null));
    },
    [faceUrl],
  );

  const reset = useCallback(() => {
    audio.blip("click");
    setSpin(true);
    setAll(false);
    viewerRef.current?.setFrameAll(false);
    viewerRef.current?.resetView();
  }, []);

  const toggleSpin = useCallback(() => {
    audio.blip("click");
    setSpin((on) => {
      viewerRef.current?.setAutoRotate(!on);
      return !on;
    });
  }, []);

  const toggleAll = useCallback(() => {
    audio.blip("click");
    setAll((on) => {
      viewerRef.current?.setFrameAll(!on);
      return !on;
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    viewerRef.current?.zoomBy(factor);
  }, []);

  const turn = useCallback((dx: number, dy: number) => {
    viewerRef.current?.orbitBy(dx * TURN_STEP, dy * TILT_STEP);
  }, []);

  const retry = useCallback(() => {
    audio.blip("click");
    setStatus("loading");
    setAttempt((a) => a + 1);
  }, []);

  return {
    status,
    percent,
    layers,
    face,
    spin,
    all,
    faceUrl,
    toggleLayer,
    pickFace,
    reset,
    toggleSpin,
    toggleAll,
    zoomBy,
    turn,
    retry,
  };
}
