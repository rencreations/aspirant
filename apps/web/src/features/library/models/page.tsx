"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { audio } from "@/lib/audio";
import { isTypingTarget, useMediaQuery } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { cancelDeferred } from "@/lib/preload";

import { useLibraryData } from "../data";
import { getCollection } from "../registry";
import { BackToCollection, useTransparentNav } from "../shell/room-chrome";
import { TAKEDOWN_URL } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { Controls } from "./controls";
import { Details } from "./details";
import { indexOfId, pad2, stepIndex, whoOf } from "./logic";
import { MODELS_GROUP, releaseModels } from "./model-bundle";
import styles from "./models.module.css";
import { Rail } from "./rail";
import type { ModelItem } from "./types";
import { useViewer } from "./use-viewer";

/** At this width and below the facts and layers are a sheet and the room is laid out for a phone. */
const NARROW = "(max-width: 991px)";

/**
 * The 3D Models room (`/collection/models`, shelf slot 05): the nine game client models of the
 * Aspirants on a turntable that fills the screen. Pick one in the row at the foot, drag to turn it,
 * scroll or pinch to come closer, switch its body, weapon and robot, and change the robot's face
 * (Fanny and Layla). The top bar has no background and the one way out is the Collection button.
 * The room does not scroll. Without WebGL, or when a model will not load, the stage shows the
 * model's picture instead.
 *
 * Keys: the arrows turn the model, plus and minus zoom, zero or Home resets, Space starts and stops
 * the turn, N and P change model, Escape closes the details on a narrow screen.
 */
export default function ModelsPage() {
  useTransparentNav("daybreak");
  const meta = getCollection("models");
  const { data, failed } = useLibraryData<ModelItem>("models");
  const items = useMemo(() => data?.items ?? [], [data]);
  const [openId, setOpenId] = useQueryState("i");
  const index = indexOfId(items, openId);
  const model = items[index];
  const hostRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const azRef = useRef<HTMLSpanElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const viewer = useViewer(model, {
    host: hostRef,
    layout: layoutRef,
    az: azRef,
    zoom: zoomRef,
  });
  const narrow = useMediaQuery(NARROW);
  const [sheet, setSheet] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // What the model files hold in memory belongs to this room: it is let go when the visitor leaves.
  useEffect(
    () => () => {
      cancelDeferred(MODELS_GROUP);
      releaseModels();
    },
    [],
  );

  const select = useCallback(
    (step: number) => {
      const next = items[stepIndex(index, step, items.length)];
      if (!next || next.id === model?.id) return;
      audio.blip("click");
      setOpenId(next.id);
    },
    [items, index, model?.id, setOpenId],
  );

  const closeSheet = useCallback(() => {
    setSheet(false);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[aria-controls="model-details"]')?.focus();
    });
  }, []);

  // A sheet that is open takes the focus. It is only a sheet on a narrow screen.
  useEffect(() => {
    if (sheet && narrow) closeRef.current?.focus({ preventScroll: true });
  }, [sheet, narrow]);

  // The keys. The latest state is read through a ref so the listener is bound once.
  const latest = useRef({ viewer, select, sheet, closeSheet });
  useEffect(() => {
    latest.current = { viewer, select, sheet, closeSheet };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) {
        return;
      }
      const { viewer: v, select: pick, sheet: open, closeSheet: close } = latest.current;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const onControl =
        !!el &&
        (["BUTTON", "A", "SUMMARY"].includes(el.tagName) || el.getAttribute("role") === "switch");
      switch (e.key) {
        case "Escape":
          if (!open) return;
          close();
          break;
        case "n":
        case "N":
          pick(1);
          break;
        case "p":
        case "P":
          pick(-1);
          break;
        case "ArrowLeft":
          if (v.status !== "ready") return;
          v.turn(-1, 0);
          break;
        case "ArrowRight":
          if (v.status !== "ready") return;
          v.turn(1, 0);
          break;
        case "ArrowUp":
          if (v.status !== "ready") return;
          v.turn(0, -1);
          break;
        case "ArrowDown":
          if (v.status !== "ready") return;
          v.turn(0, 1);
          break;
        case "+":
        case "=":
          if (v.status !== "ready") return;
          v.zoomBy(0.85);
          break;
        case "-":
          if (v.status !== "ready") return;
          v.zoomBy(1.18);
          break;
        case "0":
        case "Home":
          if (v.status !== "ready") return;
          v.reset();
          break;
        case " ":
          // On a button Space presses the button.
          if (onControl || v.status !== "ready") return;
          v.toggleSpin();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const vars = { "--lib-colour": meta.colour, "--lib-ink": meta.ink } as CSSProperties;
  const name = model ? whoOf(model) : "";
  const showPicture = viewer.status === "nogl" || viewer.status === "failed";
  const sheetOpen = sheet && narrow;

  return (
    <ThemeZone
      theme="daybreak"
      as="div"
      className={styles.root}
      style={vars}
      data-status={viewer.status}
      data-sheet={sheetOpen ? "open" : "closed"}
      data-models={model ? "live" : failed ? "failed" : "pending"}
    >
      <BackToCollection tone="dark" />

      <div className={styles.stage} data-testid="model-stage" data-status={viewer.status}>
        {model ? (
          <p
            key={model.id}
            className={`${styles.ghost} display`}
            style={{ "--chars": name.length } as CSSProperties}
            aria-hidden="true"
          >
            {name}
          </p>
        ) : null}

        <div
          className={styles.host}
          ref={hostRef}
          role={model ? "img" : undefined}
          aria-label={model ? `3D model of ${model.title}` : undefined}
        />

        {model && showPicture ? (
          <div className={styles.fallback}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={model.id}
              src={libUrl(model.img.p)}
              alt={`${model.title}, the 3D model`}
              width={model.img.w}
              height={model.img.h}
              crossOrigin="anonymous"
            />
            <p className={styles.fallbackNote} role="status">
              {viewer.status === "nogl"
                ? "This browser cannot draw 3D, so here is a picture of the model."
                : "The model could not be shown."}
            </p>
            {viewer.status === "failed" ? (
              <button type="button" className={styles.btn} onClick={viewer.retry}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        <p
          className={`${styles.loading} hud-label`}
          role="status"
          data-on={viewer.status === "loading"}
        >
          <span>
            Loading the model <span className={styles.percent}>{viewer.percent}%</span>
          </span>
          <span className={styles.loadBar} aria-hidden="true">
            <span style={{ transform: `scaleX(${viewer.percent / 100})` }} />
          </span>
        </p>

        <div className={styles.layout} ref={layoutRef}>
          <header className={styles.info}>
            <div className={styles.kickerRow}>
              <h1 className={`${styles.kicker} hud-label`}>3D Models</h1>
              <span className={`${styles.counter} hud-label`}>
                {model ? `${pad2(index + 1)} / ${pad2(items.length)}` : "..."}
              </span>
            </div>
            {model ? (
              <div key={model.id} className={styles.heading}>
                <h2 className={`${styles.name} display`}>{name}</h2>
                <p className={styles.skin}>{model.skin ?? "Game client model"}</p>
              </div>
            ) : failed ? (
              <p className={styles.skin}>
                The models could not be read. Reload the page to try again.
              </p>
            ) : null}
          </header>

          {model ? (
            <Details
              ref={closeRef}
              model={model}
              viewer={viewer}
              open={sheetOpen}
              inert={narrow && !sheetOpen}
              onClose={closeSheet}
            />
          ) : null}
        </div>

        <p className={`${styles.read} hud-label`} aria-hidden="true" hidden={showPicture}>
          Az <span ref={azRef}>000</span>
          {"°"} / Zoom <span ref={zoomRef}>1.0</span>x
        </p>
        <p className={`${styles.hint} hud-label`} hidden={showPicture}>
          Drag to turn. Scroll or pinch to come closer.
          <span className="sr-only">
            {" "}
            Arrow keys turn it, plus and minus zoom, zero resets, N and P change model.
          </span>
        </p>
      </div>

      <div className={styles.dock}>
        <Controls
          viewer={viewer}
          sheetOpen={sheetOpen}
          onDetails={() => {
            if (sheet) closeSheet();
            else setSheet(true);
          }}
        />
        <Rail models={items} selected={model?.id ?? ""} onSelect={setOpenId} />
        <p className={styles.takedown}>
          A fan made archive. The models belong to Moonton. To ask for a takedown,{" "}
          <a href={TAKEDOWN_URL} target="_blank" rel="noopener noreferrer">
            open an issue
          </a>
          .
        </p>
      </div>
    </ThemeZone>
  );
}
