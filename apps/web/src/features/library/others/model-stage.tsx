"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { audio } from "@/lib/audio";
import { usePageVisible } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { expectReady } from "@/lib/page-ready";

import type { Layer, ModelViewer } from "./engine";
import { azimuthDegrees, count, humanBytes } from "./filters";
import { loadBundle, loadFaceSheet } from "./model-bundle";
import styles from "./stage.module.css";
import type { ModelItem } from "./types";
import { useOnScreen } from "./use-in-view";

interface ModelStageProps {
  models: readonly ModelItem[];
  /** The id of the model on the stage. */
  selected: string;
  onSelect: (id: string) => void;
}

type Status = "loading" | "ready" | "nogl" | "failed";

const LAYERS: Array<{ id: Layer; label: string }> = [
  { id: "body", label: "Body, face and hair" },
  { id: "weapon", label: "Weapon" },
  { id: "robot", label: "Robot" },
];

const noopSubscribe = () => () => undefined;
const ROBOT_FACE = "jiqirenbiaoqing_skin09_d";
const pad3 = (n: number) => String(n).padStart(3, "0");

/**
 * The orbit viewer of a game client model. It turns by itself, turns under the pointer, comes
 * closer with the wheel once the stage has been pressed (so the page still scrolls when the
 * pointer only passes over it), and can switch the body, the weapon and the robot on and off and
 * change the robot's face. The rest of the page never waits on it: it tells the curtain when its
 * first frame is drawn.
 */
export function ModelStage({ models, selected, onSelect }: ModelStageProps) {
  const model = models.find((m) => m.id === selected) ?? models[0];
  const hostRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ModelViewer | null>(null);
  const markRef = useRef<(() => void) | null>(null);
  const azRef = useRef<HTMLSpanElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const layersRef = useRef<Record<Layer, boolean>>({ body: true, weapon: true, robot: true });

  const supported = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  const [state, setStatus] = useState<Status>("loading");
  const status: Status = supported ? state : "nogl";
  const [engineReady, setEngineReady] = useState(false);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    body: true,
    weapon: true,
    robot: true,
  });
  const [face, setFace] = useState(-1);
  const [spin, setSpin] = useState(true);
  const [all, setAll] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [onScreenRef, onScreen] = useOnScreen<HTMLDivElement>("120px");
  const visible = usePageVisible();

  // The engine (three, in its own chunk) and its canvas. The canvas is made here, not in the JSX,
  // so a remount always gets a fresh one (a lost context cannot be reused).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mark = expectReady("library-others-stage");
    markRef.current = mark;
    if (!supported) {
      mark();
      return mark;
    }
    let cancelled = false;
    let viewer: ModelViewer | null = null;
    let observer: ResizeObserver | null = null;
    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas ?? "";
    host.appendChild(canvas);
    void (async () => {
      try {
        const { ModelViewer: Viewer } = await import("./engine");
        if (cancelled) return;
        viewer = new Viewer(canvas, {
          onView: (az, zoom) => {
            if (azRef.current) azRef.current.textContent = pad3(azimuthDegrees(az));
            if (zoomRef.current) zoomRef.current.textContent = zoom.toFixed(1);
          },
        });
        viewerRef.current = viewer;
        observer = new ResizeObserver(() => {
          viewer?.resize(host.clientWidth, host.clientHeight);
        });
        observer.observe(host);
        viewer.resize(host.clientWidth, host.clientHeight);
        setEngineReady(true);
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
      setEngineReady(false);
      mark();
    };
  }, [supported]);

  // Put the chosen model on the stage.
  const modelId = model?.id;
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!engineReady || !viewer || !model) return;
    let live = true;
    setStatus("loading");
    setFace(-1);
    loadBundle(model)
      .then(async (bundle) => {
        await viewer.show(bundle, model.model);
        if (!live) return;
        (Object.keys(layersRef.current) as Layer[]).forEach((l) => {
          viewer.setLayer(l, layersRef.current[l]);
        });
        viewer.setFrameAll(false);
        setAll(false);
        setStatus("ready");
        // One frame later, so the curtain opens on a drawn model.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => markRef.current?.());
        });
      })
      .catch((error: unknown) => {
        console.error("The 3D model could not be shown.", error);
        if (live) setStatus("failed");
        markRef.current?.();
      });
    return () => {
      live = false;
    };
    // `model` follows `modelId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, modelId]);

  // The loop runs only while the stage is on screen and the tab is in front.
  useEffect(() => {
    viewerRef.current?.setRunning(status === "ready" && onScreen && visible);
  }, [status, onScreen, visible]);

  const toggleLayer = useCallback((layer: Layer) => {
    audio.blip("click");
    setLayers((prev) => {
      const next = { ...prev, [layer]: !prev[layer] };
      layersRef.current = next;
      viewerRef.current?.setLayer(layer, next[layer]);
      return next;
    });
  }, []);

  const pickFace = useCallback(
    (index: number) => {
      if (!model) return;
      audio.blip("click");
      setFace(index);
      const viewer = viewerRef.current;
      if (!viewer) return;
      if (index < 0) {
        void viewer.setFace(-1, null);
      } else {
        void loadFaceSheet(model, index).then((blob) => viewer.setFace(index, blob));
      }
    },
    [model],
  );

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = viewerRef.current;
    if (!v) return;
    const step = 0.17;
    switch (e.key) {
      case "ArrowLeft":
        v.orbitBy(-step, 0);
        break;
      case "ArrowRight":
        v.orbitBy(step, 0);
        break;
      case "ArrowUp":
        v.orbitBy(0, -0.1);
        break;
      case "ArrowDown":
        v.orbitBy(0, 0.1);
        break;
      case "+":
      case "=":
        v.zoomBy(0.85);
        break;
      case "-":
        v.zoomBy(1.18);
        break;
      case "0":
      case "Home":
        v.resetView();
        setSpin(true);
        break;
      case " ":
        setSpin((s) => {
          v.setAutoRotate(!s);
          return !s;
        });
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  if (!model) return null;
  const m = model.model;
  const ready = status === "ready";
  const faceKey = (i: number) =>
    `${m.dir}/${i < 0 ? (m.maps[ROBOT_FACE] ?? "") : (m.faces[i] ?? "")}`;

  return (
    <div className={styles.deck}>
      <div className={styles.main}>
        <div className={styles.picker} role="group" aria-label="Choose a model">
          {models.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className={styles.pick}
              aria-pressed={it.id === model.id}
              onClick={() => {
                audio.blip("click");
                onSelect(it.id);
              }}
            >
              {it.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.pickImg}
                  src={libUrl(it.img.t)}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : null}
              <span className={styles.pickNo}>0{i + 1}</span>
              <span className={styles.pickName}>{it.title}</span>
              <span className={styles.pickMeta}>{count(it.model.verts)} points</span>
            </button>
          ))}
        </div>

        <div className={styles.frame}>
          <div
            ref={(el) => {
              plateRef.current = el;
              onScreenRef.current = el;
            }}
            className={styles.plate}
            tabIndex={0}
            role="group"
            aria-label={`3D model of ${model.title}. Arrow keys turn it, plus and minus zoom, zero resets.`}
            data-testid="model-stage"
            data-status={status}
            {...(engaged ? { "data-lenis-prevent": "" } : {})}
            onKeyDown={onKey}
            onPointerDown={() => {
              plateRef.current?.focus({ preventScroll: true });
              viewerRef.current?.setWheelZoom(true);
              setEngaged(true);
            }}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget)) return;
              viewerRef.current?.setWheelZoom(false);
              setEngaged(false);
            }}
          >
            <span className={styles.rulerX} aria-hidden="true" />
            <span className={styles.rulerY} aria-hidden="true" />
            <div ref={hostRef} className={styles.host} />
            {status === "nogl" || status === "failed" ? (
              <div className={styles.fallback}>
                {model.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={libUrl(model.img.p)} alt={`${model.title}, the 3D model`} />
                ) : null}
                <p>
                  {status === "nogl"
                    ? "This browser cannot draw 3D, so the model is not shown."
                    : "The model could not be shown. Reload the page to try again."}
                </p>
              </div>
            ) : null}
            <p className={`${styles.tag} hud-label`}>
              Model {String(models.indexOf(model) + 1).padStart(2, "0")} / {model.title}
            </p>
            <p className={`${styles.read} hud-label`} aria-hidden="true">
              Az <span ref={azRef}>000</span>
              {"°"} / Zoom <span ref={zoomRef}>1.0</span>x
            </p>
            <p className={`${styles.hint} hud-label`}>
              {engaged
                ? "Scroll to zoom. Drag to turn."
                : "Drag to turn. Press, then scroll to zoom."}
            </p>
            <p className={`${styles.loading} hud-label`} data-gone={ready || status !== "loading"}>
              Loading the model
            </p>
          </div>
        </div>

        <div className={styles.toolbar} role="toolbar" aria-label="Viewer controls">
          <button
            type="button"
            className={styles.btn}
            disabled={!ready}
            onClick={() => {
              audio.blip("click");
              setSpin(true);
              setAll(false);
              viewerRef.current?.setFrameAll(false);
              viewerRef.current?.resetView();
            }}
          >
            Reset view
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-pressed={spin}
            disabled={!ready}
            onClick={() => {
              audio.blip("click");
              const next = !spin;
              setSpin(next);
              viewerRef.current?.setAutoRotate(next);
            }}
          >
            Auto turn: {spin ? "on" : "off"}
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!ready}
            aria-label="Zoom out"
            onClick={() => {
              viewerRef.current?.zoomBy(1.2);
            }}
          >
            Zoom -
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={!ready}
            aria-label="Zoom in"
            onClick={() => {
              viewerRef.current?.zoomBy(0.83);
            }}
          >
            Zoom +
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-pressed={all}
            disabled={!ready}
            onClick={() => {
              audio.blip("click");
              const next = !all;
              setAll(next);
              viewerRef.current?.setFrameAll(next);
            }}
          >
            Frame every part
          </button>
        </div>
      </div>

      <aside className={styles.panel} aria-label="Model controls and facts">
        <div>
          <p className={`${styles.panelHead} hud-label`}>Layers</p>
          <div className={styles.switches}>
            {LAYERS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="switch"
                aria-checked={layers[l.id]}
                className={styles.switch}
                disabled={!ready}
                onClick={() => {
                  toggleLayer(l.id);
                }}
              >
                <span>{l.label}</span>
                <span className={styles.switchBox} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={`${styles.panelHead} hud-label`}>Robot face, 9 sheets</p>
          <div className={styles.faces} role="group" aria-label="Robot face">
            {[-1, 0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <button
                key={i}
                type="button"
                className={styles.face}
                aria-pressed={face === i}
                aria-label={i < 0 ? "Robot face, original sheet" : `Robot face, sheet ${i + 1}`}
                disabled={!ready}
                onClick={() => {
                  pickFace(i);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={libUrl(faceKey(i))}
                  alt=""
                  crossOrigin="anonymous"
                  loading="lazy"
                  draggable={false}
                />
                <span className={styles.faceNo}>{i + 2}</span>
              </button>
            ))}
          </div>
        </div>

        <dl className={styles.facts}>
          <dt>Points</dt>
          <dd>{count(m.verts)}</dd>
          <dt>Triangles</dt>
          <dd>{count(m.tris)}</dd>
          <dt>Model file</dt>
          <dd>{humanBytes(m.bytes)}</dd>
          <dt>Textures</dt>
          <dd>
            {new Set(Object.values(m.maps)).size} x 512 px, {humanBytes(m.texBytes)}
          </dd>
        </dl>

        <p className={styles.notice}>
          These are 3D models taken from the game client, shown here as a visual reference and not
          as story art. The parts sit as the client file stores them, so the weapon lies beside the
          body.
        </p>
      </aside>
    </div>
  );
}
