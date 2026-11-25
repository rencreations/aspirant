"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { ReportLink } from "@/features/legal/takedown/report-link";
import { audio } from "@/lib/audio";
import { isTypingTarget, useMediaQuery } from "@/lib/hooks";
import { libUrl } from "@/lib/library";
import { cancelDeferred } from "@/lib/preload";

import { useLibraryData } from "../data";
import { getCollection } from "../registry";
import { BackToCollection, useTransparentNav } from "../shell/room-chrome";
import { TAKEDOWN_URL } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { ClipsPanel } from "./clips-panel";
import { placeOf, stepIndex } from "./logic";
import styles from "./models.module.css";
import { Picker } from "./picker";
import type { Insets } from "./scene-kit";
import { Timeline } from "./timeline";
import type { ModelEntry } from "./types";
import { useStage, type TickSink } from "./use-stage";
import { MODELS_GROUP, releaseViewFiles } from "./view-files";

/** At this width and below the list and the animations are sheets, and the room is laid out for a phone. */
const NARROW = "(max-width: 991px)";
/** One press of an arrow key turns this far (a fraction of the stage's height). */
const KEY_TURN = 0.05;

type Sheet = "models" | "clips" | null;

const NO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * The 3D Models room (`/collection/models`, shelf slot 05): one model at a time on a stage that fills
 * the screen. The list on the left picks a character or a companion and, under it, one of its views
 * (Selena: In Game, Entrance, Phone). Drag to turn, scroll or pinch to zoom. A view with animations
 * has them on the right and a timeline at the foot. The only words are the name and, for an
 * Aspirant, her title.
 *
 * Keys: Space plays and pauses, comma and full stop step one key, the arrows turn the model, plus and
 * minus zoom, R (or 0, Home) brings the camera back, N and P change the entry, Escape closes a sheet.
 */
export default function ModelsPage() {
  useTransparentNav("daybreak");
  const meta = getCollection("models");
  const { data, failed } = useLibraryData<ModelEntry>("models");
  const entries = useMemo(() => data?.items ?? [], [data]);
  const [entryId, setEntryId] = useQueryState("i");
  const [viewId, setViewId] = useQueryState("v");
  const place = placeOf(entries, entryId, viewId);
  const entry = entries[place.entry];
  const view = entry?.views[place.view] ?? null;
  const narrow = useMediaQuery(NARROW);
  const [sheet, setSheet] = useState<Sheet>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const tick = useRef<TickSink["current"]>(null) as TickSink;
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  const stage = useStage(hostRef, view, insets, tick);
  const clip = stage.clip;
  const hasClipView = clip !== null;

  // What the room holds in memory belongs to it: it is let go when the visitor leaves.
  useEffect(
    () => () => {
      cancelDeferred(MODELS_GROUP);
      releaseViewFiles();
    },
    [],
  );

  // The model is framed in the part of the screen the panels leave.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const r = host.getBoundingClientRect();
      const nav = parseFloat(getComputedStyle(host).getPropertyValue("--nav-h")) * 16 || 64;
      const left = leftRef.current?.getBoundingClientRect();
      const right = rightRef.current?.getBoundingClientRect();
      const foot = footRef.current?.getBoundingClientRect();
      const next: Insets = narrow
        ? { left: 0, right: 0, top: nav, bottom: foot ? Math.max(0, r.bottom - foot.top) : 0 }
        : {
            left: left ? Math.max(0, left.right - r.left) : 0,
            right: right && right.width > 0 ? Math.max(0, r.right - right.left) : 0,
            top: nav,
            bottom: foot ? Math.max(0, r.bottom - foot.top) : 0,
          };
      setInsets((now) =>
        Math.abs(now.left - next.left) < 2 &&
        Math.abs(now.right - next.right) < 2 &&
        Math.abs(now.top - next.top) < 2 &&
        Math.abs(now.bottom - next.bottom) < 2
          ? now
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [host, leftRef.current, rightRef.current, footRef.current])
      if (el) ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [narrow, hasClipView, entries.length]);

  const pick = useCallback(
    (e: number, v: number) => {
      const next = entries[e];
      const nextView = next?.views[v];
      if (!next || !nextView) return;
      if (next.id === entry?.id && nextView.id === view?.id) return;
      audio.blip("click");
      setEntryId(next.id);
      setViewId(v === 0 ? "" : nextView.id);
      // On a phone the views of an entry are chosen in the dock, so the sheet closes on any pick.
      if (narrow) setSheet(null);
    },
    [entries, entry?.id, view?.id, setEntryId, setViewId, narrow],
  );

  const closeSheet = useCallback(() => {
    setSheet(null);
  }, []);

  // A sheet that opens takes the focus (its chosen row, or its first control), and gives it back to
  // the button that opened it when it shuts.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!narrow) return;
    if (sheet) {
      const panel = document.querySelector<HTMLElement>(`[data-sheet-panel="${sheet}"]`);
      const target =
        panel?.querySelector<HTMLElement>('[aria-current="true"], [aria-pressed="true"]') ??
        panel?.querySelector<HTMLElement>("button");
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
      return;
    }
    const back = opener.current;
    opener.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }, [sheet, narrow]);

  // The keys. The latest state is read through a ref so the listener is bound once.
  const latest = useRef({ stage, pick, place, entries, sheet, closeSheet });
  useEffect(() => {
    latest.current = { stage, pick, place, entries, sheet, closeSheet };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target))
        return;
      const l = latest.current;
      const s = l.stage.stage();
      const el = e.target instanceof HTMLElement ? e.target : null;
      const onControl =
        !!el &&
        (["BUTTON", "A", "SUMMARY"].includes(el.tagName) || el.getAttribute("role") === "slider");
      switch (e.key) {
        case "Escape":
          if (!l.sheet) return;
          l.closeSheet();
          break;
        case " ":
          if (onControl || !s) return;
          s.togglePlay();
          break;
        case ",":
          s?.step(-1);
          break;
        case ".":
          s?.step(1);
          break;
        case "n":
        case "N":
          l.pick(stepIndex(l.place.entry, 1, l.entries.length), 0);
          break;
        case "p":
        case "P":
          l.pick(stepIndex(l.place.entry, -1, l.entries.length), 0);
          break;
        case "ArrowLeft":
          if (onControl || !s) return;
          s.nudge(-KEY_TURN, 0);
          break;
        case "ArrowRight":
          if (onControl || !s) return;
          s.nudge(KEY_TURN, 0);
          break;
        case "ArrowUp":
          if (onControl || !s) return;
          s.nudge(0, -KEY_TURN);
          break;
        case "ArrowDown":
          if (onControl || !s) return;
          s.nudge(0, KEY_TURN);
          break;
        case "+":
        case "=":
          s?.zoomBy(0.85);
          break;
        case "-":
          s?.zoomBy(1.18);
          break;
        case "r":
        case "R":
        case "0":
        case "Home":
          if (e.key === "Home" && onControl) return;
          s?.resetCamera();
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
  const showPicture = stage.status === "nogl" || stage.status === "failed";
  const single = (entry?.views.length ?? 0) <= 1;
  const heading = !entry ? "" : view && !single && view.mode === "item" ? view.label : entry.title;
  const hasClips = !!clip && clip.clips.length > 0;
  const s = stage.stage;

  return (
    <ThemeZone
      theme="daybreak"
      as="div"
      className={styles.root}
      style={vars}
      data-status={stage.status}
      data-sheet={sheet ?? "none"}
      data-clips={hasClips ? "" : undefined}
      data-models={entry ? "live" : failed ? "failed" : "pending"}
    >
      <BackToCollection tone="dark" className={styles.back} />
      <h1 className="sr-only">3D Models</h1>

      <div className={styles.stage} data-testid="model-stage" data-status={stage.status}>
        <div
          ref={hostRef}
          className={styles.host}
          role={view ? "img" : undefined}
          aria-label={view && entry ? `3D model of ${heading}` : undefined}
        />
        {view && showPicture ? (
          <div className={styles.fallback}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={view.id}
              src={libUrl(view.poster.p)}
              alt={`${heading}, the 3D model`}
              width={view.poster.w}
              height={view.poster.h}
              crossOrigin="anonymous"
            />
            <p className={styles.fallbackNote} role="status">
              {stage.status === "nogl"
                ? "This browser cannot draw 3D, so here is a picture of the model."
                : "The model could not be shown."}
            </p>
            {stage.status === "failed" ? (
              <button type="button" className={styles.btn} onClick={stage.retry}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}
        <p
          className={`${styles.loading} hud-label`}
          role="status"
          data-on={stage.status === "loading"}
        >
          <span>
            Loading the model <span className={styles.percent}>{stage.percent}%</span>
          </span>
          <span className={styles.loadBar} aria-hidden="true">
            <span style={{ transform: `scaleX(${stage.percent / 100})` }} />
          </span>
        </p>
      </div>

      <nav
        ref={leftRef}
        className={styles.left}
        aria-label="Models"
        data-sheet-panel="models"
        inert={narrow && sheet !== "models" ? true : undefined}
      >
        <div className={styles.panelHead}>
          <span className="hud-label">3D Models</span>
          {narrow ? (
            <button type="button" className={styles.close} onClick={closeSheet}>
              Close
            </button>
          ) : null}
        </div>
        {entries.length > 0 ? (
          <Picker entries={entries} entry={place.entry} view={place.view} onPick={pick} />
        ) : failed ? (
          <p className={styles.note}>The models could not be read. Reload the page to try again.</p>
        ) : null}
      </nav>

      {hasClips && clip ? (
        <section
          ref={rightRef}
          className={styles.right}
          aria-label="Animation"
          data-sheet-panel="clips"
          inert={narrow && sheet !== "clips" ? true : undefined}
        >
          <div className={styles.panelHead}>
            <span className="hud-label">Animation</span>
            {narrow ? (
              <button type="button" className={styles.close} onClick={closeSheet}>
                Close
              </button>
            ) : null}
          </div>
          <ClipsPanel
            view={clip}
            onPick={(id) => {
              s()?.pickClip(id);
              if (narrow) setSheet(null);
            }}
            onForm={(f) => {
              s()?.setForm(f);
            }}
          />
        </section>
      ) : null}

      <div ref={footRef} className={styles.foot} data-models-foot="">
        <div className={styles.title} data-models-title="">
          {entry ? (
            <>
              <h2 key={`${entry.id}-${heading}`} className={`${styles.name} display`}>
                {heading}
              </h2>
              {entry.aspirant ? <p className={styles.aspirant}>{entry.aspirant}</p> : null}
            </>
          ) : null}
        </div>

        {narrow && entry ? (
          <div className={styles.dock}>
            <button
              type="button"
              className={styles.dockBtn}
              aria-haspopup="dialog"
              aria-expanded={sheet === "models"}
              onClick={(e) => {
                opener.current = e.currentTarget;
                setSheet(sheet === "models" ? null : "models");
              }}
            >
              Models
            </button>
            {entry.views.length > 1 ? (
              <div className={styles.dockViews} role="group" aria-label={`${entry.title}: views`}>
                {entry.views.map((v, k) => (
                  <button
                    key={v.id}
                    type="button"
                    className={styles.viewPill}
                    aria-current={k === place.view ? "true" : undefined}
                    onClick={() => {
                      pick(place.entry, k);
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            ) : null}
            {hasClips ? (
              <button
                type="button"
                className={styles.dockBtn}
                aria-haspopup="dialog"
                aria-expanded={sheet === "clips"}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setSheet(sheet === "clips" ? null : "clips");
                }}
              >
                Animation
              </button>
            ) : null}
          </div>
        ) : null}

        {hasClips && clip ? (
          <Timeline
            view={clip}
            tickRef={tick}
            onPlay={(p) => {
              s()?.setPlaying(p);
            }}
            onSeek={(t) => {
              s()?.seek(t);
            }}
            onStep={(d) => {
              s()?.step(d);
            }}
          />
        ) : null}

        <div className={styles.bar}>
          <p className={`${styles.hint} hud-label`} hidden={showPicture}>
            Drag to turn. Scroll or pinch to zoom.
          </p>
          <button
            type="button"
            className={styles.reset}
            data-model-reset=""
            data-moved={stage.moved ? "" : undefined}
            aria-keyshortcuts="R"
            hidden={showPicture}
            onClick={() => {
              s()?.resetCamera();
            }}
          >
            {clip?.cinematic ? "Default camera" : "Reset view"}
          </button>
          <p className={styles.takedown}>
            A fan made archive. The models belong to Moonton.{" "}
            {entry ? (
              <ReportLink item={{ id: entry.id, title: entry.title }} className={styles.report} />
            ) : (
              <TLink href={TAKEDOWN_URL}>Copyright or takedown</TLink>
            )}
          </p>
        </div>
      </div>

      {narrow && sheet ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close"
          tabIndex={-1}
          onClick={closeSheet}
        />
      ) : null}
    </ThemeZone>
  );
}
