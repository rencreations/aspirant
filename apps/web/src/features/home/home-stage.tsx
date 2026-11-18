"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useGLReady } from "@/components/gl/use-gl-ready";
import { useLenis } from "@/components/smooth-scroll";
import { useFreshStart } from "@/features/character/vexana/seams/fresh-start";
import { useScrollLock } from "@/features/character/vexana/seams/scroll-lock";
import { BareScrollbar } from "@/features/character/vexana/shared/bare-scrollbar";
import { selectIsOpen, useHomeFlow } from "@/lib/home-flow";
import { useNavLock } from "@/lib/nav-lock";
import { expectReady } from "@/lib/page-ready";

import styles from "./home.module.css";
import { focusScreens } from "./kernel/focus";
import { bindHold } from "./kernel/hold";
import { layoutSections } from "./kernel/layout";
import { SECTIONS } from "./kernel/sections";
import type { HomeMode } from "./kernel/types";

export interface HomeStageProps {
  /** The scroll room of the fixed sections, in screens. */
  trackScreens: number;
  /** The height of the last section's block in the page's flow, in screens. */
  flowScreens: number;
  /** Every section's decorative part, drawn by the server (the layer under the canvas). */
  below: ReactNode;
  /** Every fixed section's text (the layer over the canvas). */
  text: ReactNode;
  /** The last section's text, in the page's flow. */
  flow: ReactNode;
}

/**
 * The thin shell of the home page. It lays out the four layers and the scroll room around the
 * server's markup, decides the mode (`data-gl`: the stage, or a plain readable page when WebGL is
 * missing), keeps the top bar bare and the browser's scrollbar hidden, binds the scroll hold, and
 * starts the engine (a lazy chunk) when the stage can run. Everything that moves is the engine's.
 *
 * Hydration: the markup never depends on the opening's phase or on WebGL (both are read after the
 * first render, through effects and a store), so the server's HTML and the first client render agree.
 */
export function HomeStage({ trackScreens, flowScreens, below, text, flow }: HomeStageProps) {
  useFreshStart();
  const { supported } = useGLReady();
  const [failed, setFailed] = useState(false);
  const mode: HomeMode = supported === null ? "pending" : supported && !failed ? "on" : "off";

  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLDivElement>(null);
  const stormRef = useRef<HTMLDivElement>(null);
  const colourRef = useRef<HTMLDivElement>(null);

  const { scrollTo } = useLenis();
  const { lock } = useScrollLock();

  useEffect(() => bindHold(lock), [lock]);

  // The bar is bare over the stage (a canvas is under it). On the plain page it is left to follow
  // what is under it, like any page. Home-only fields of the bar are not touched here: the opening
  // owns them (and the bar clears them on every path change, see `lib/nav-lock.ts`).
  useEffect(() => {
    useNavLock.setState(
      mode === "off"
        ? // The plain page has no big logo to morph: the bar keeps its own (the opening hid it).
          { theme: null, bare: false, fade: false, away: false, hideLogo: false }
        : { theme: "daybreak", bare: true, fade: false, away: false },
    );
  }, [mode]);

  // The bar is given back to the next page whole.
  useEffect(() => {
    return () => {
      useNavLock.setState(useNavLock.getInitialState());
    };
  }, []);

  // Nothing of the page shows until the opening has ended (`data-open`), however it ended.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const apply = () => {
      root.dataset.open = selectIsOpen(useHomeFlow.getState()) ? "1" : "0";
    };
    apply();
    return useHomeFlow.subscribe(apply);
  }, []);

  // The engine runs only on the stage (WebGL available). The loading screen and the page change
  // wait for its first drawn frame, and are released on every way out.
  useEffect(() => {
    if (mode !== "on") return;
    const root = rootRef.current;
    const host = hostRef.current;
    const day = dayRef.current;
    const storm = stormRef.current;
    const colour = colourRef.current;
    if (!root || !host || !day || !storm || !colour) return;
    const ready = expectReady("home-stage");
    let cancelled = false;
    let engine: { dispose(): void } | null = null;
    void import("./kernel/engine").then(
      (m) => {
        if (cancelled) {
          ready();
          return;
        }
        engine = m.startEngine({
          root,
          host,
          grounds: { daybreak: day, storm, colour },
          sections: SECTIONS,
          scrollTo: (y, options) => {
            scrollTo(y, options);
          },
          onFailed: () => {
            ready();
            setFailed(true);
          },
          onFirstFrame: ready,
        });
        if (!engine) {
          ready();
          setFailed(true);
        }
      },
      () => {
        ready();
        setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      ready();
      engine?.dispose();
    };
  }, [mode, scrollTo]);

  // A control of a section the page is not at (the keyboard got there): move the page to it.
  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    if (!root || !host || mode !== "on") return;
    const layout = layoutSections(SECTIONS);
    const onFocus = (e: FocusEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const slot = target?.closest<HTMLElement>("[data-home-text]");
      if (!slot || slot.dataset.on === "1") return;
      const placed = layout.placed.find((p) => p.id === slot.dataset.homeText);
      if (!placed || placed.def.dom === "flow") return;
      const unit = host.getBoundingClientRect().height;
      const at = focusScreens(
        placed.def.screens,
        placed.def.focus,
        target?.closest<HTMLElement>("[data-home-focus-at]")?.dataset.homeFocusAt,
      );
      scrollTo((placed.start + at) * unit, { immediate: true });
    };
    root.addEventListener("focusin", onFocus);
    return () => {
      root.removeEventListener("focusin", onFocus);
    };
  }, [mode, scrollTo]);

  return (
    <div ref={rootRef} className={styles.root} data-home="" data-gl={mode}>
      <BareScrollbar />
      <div className={styles.grounds} aria-hidden="true">
        <div ref={dayRef} className={`${styles.ground} ${styles.groundDaybreak}`} />
        <div ref={stormRef} className={`${styles.ground} ${styles.groundStorm}`} />
        <div ref={colourRef} className={`${styles.ground} ${styles.groundColour}`} />
      </div>
      <div className={styles.below} aria-hidden="true">
        {below}
      </div>
      <div ref={hostRef} className={styles.canvasHost} aria-hidden="true" />
      <div className={styles.text}>{text}</div>
      <div
        className={styles.track}
        style={{ "--track": trackScreens } as CSSProperties}
        aria-hidden="true"
      />
      <div className={styles.flow} style={{ "--flow": flowScreens } as CSSProperties}>
        {flow}
      </div>
    </div>
  );
}
