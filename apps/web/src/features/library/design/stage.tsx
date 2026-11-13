"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { useFreshStart } from "@/features/character/vexana/seams/fresh-start";
import { put } from "@/features/character/vexana/seams/scroll-kit";
import { useScrollSnap, type SnapRange } from "@/features/character/vexana/seams/snap";
import { libUrl } from "@/lib/library";
import { loadMedia, releaseMedia } from "@/lib/media-store";
import { useNavLock } from "@/lib/nav-lock";
import { expectReady } from "@/lib/page-ready";

import { getCollection } from "../registry";
import { BackToCollection } from "../shell/room-chrome";
import { heroFilmUrl } from "./hero-media";
import styles from "./stage.module.css";
import type { DesignHero } from "./types";

const ROOM = getCollection("design");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface StageProps {
  hero: DesignHero;
  /** The number of contents, the only figure the first screen shows. */
  total: number;
  /** A post is open over the room: the film rests. */
  paused: boolean;
  /** The bar, the wall and the foot: the page that rises over the film. */
  children: ReactNode;
}

/**
 * The first screen of the Design room and the join to the wall.
 *
 * A film (the design team's own recording, muted, in a loop) is ONE fixed layer behind the page.
 * In front of it are a screen of nothing and the page: its top is a rounded lip and the bar with
 * the search and the choices, which rests at the foot of the first screen and shows the way in.
 * Plain scrolling brings the page up over the film. While it does, the film comes a little closer
 * and goes dark, and the title lifts away and fades. When the bar reaches the top bar it docks, and
 * the top bar, bare over the film until then, takes its plate (it fades in). Only transform and
 * opacity are written, on four elements, and nothing is written on the document.
 *
 * Nobody is left standing in the join: a stop inside it settles after a second, forward from the
 * half and back before it. Once the page covers the screen the film stops and the layer is hidden.
 */
export function DesignStage({ hero, total, paused, children }: StageProps) {
  useFreshStart();
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLElement>(null);
  const film = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const lip = useRef<HTMLDivElement>(null);
  const range = useRef<SnapRange | null>(null);
  const [covered, setCovered] = useState(false);
  const [hidden, setHidden] = useState(false);

  useScrollSnap("design-rise", () => range.current, { idleMs: 1000 });

  // The top bar: bare over the film, its plate fades in when the bar docks (see below).
  useEffect(() => {
    useNavLock.setState({ theme: "storm", bare: true, fade: true });
    return () => {
      useNavLock.setState({ theme: null, bare: false, fade: false });
    };
  }, []);

  // The join: written from the scroll, one frame at a time, on four elements.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let restTop = 1;
    let dockY = 1;
    let docked: boolean | null = null;
    let isCovered = false;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      const p = clamp01(y / dockY);
      put(
        film.current,
        "transform",
        `translate3d(0, ${(-p * 4).toFixed(2)}%, 0) scale(${(1 + 0.07 * p).toFixed(4)})`,
      );
      put(dim.current, "opacity", String(Number((0.68 * p).toFixed(3))));
      put(copy.current, "transform", `translate3d(0, ${(-p * 7).toFixed(2)}vh, 0)`);
      put(copy.current, "opacity", String(Number((1 - clamp01(p * 1.5)).toFixed(3))));
      put(back.current, "opacity", String(Number((1 - clamp01(p * 2.2)).toFixed(3))));

      const nowDocked = y >= dockY - 1;
      if (nowDocked !== docked) {
        docked = nowDocked;
        useNavLock.setState(
          nowDocked
            ? { theme: "daybreak", bare: false, fade: true }
            : { theme: "storm", bare: true, fade: true },
        );
      }
      // The page covers the whole screen: the film is of no use until it is uncovered.
      const nowCovered = y >= restTop + 2;
      if (nowCovered !== isCovered) {
        isCovered = nowCovered;
        setCovered(nowCovered);
        if (layer.current) layer.current.inert = nowCovered;
        setHidden(nowCovered);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const measure = () => {
      restTop = Math.max(1, spacer.current?.offsetHeight ?? 1);
      const lipH = lip.current?.offsetHeight ?? 0;
      const bar = root.querySelector<HTMLElement>("[data-design-bar]");
      const navH = bar ? parseFloat(getComputedStyle(bar).top) || 64 : 64;
      // The bar docks when its top reaches the foot of the top bar: the lip is above it.
      dockY = Math.max(1, restTop + lipH - navH);
      range.current = { start: 0, end: dockY };
      apply();
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (spacer.current) ro.observe(spacer.current);
    const bar = root.querySelector("[data-design-bar]");
    if (bar) ro.observe(bar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      range.current = null;
    };
  }, []);

  return (
    <div
      ref={stage}
      className={styles.stage}
      style={{ "--lib-colour": ROOM.colour, "--lib-ink": ROOM.ink } as CSSProperties}
      data-design-room=""
    >
      <section
        ref={layer}
        className={styles.layer}
        data-theme="storm"
        data-hidden={hidden ? "true" : undefined}
        aria-label="Design"
      >
        <div ref={film} className={styles.film} aria-hidden="true">
          <Film hero={hero} resting={covered || paused} />
        </div>
        <div className={styles.shade} aria-hidden="true" />
        <div ref={dim} className={styles.dim} aria-hidden="true" />

        <div ref={back} className={styles.back}>
          <BackToCollection tone="light" />
        </div>

        <div ref={copy} className={styles.copy}>
          <h1 className={`${styles.title} display`}>Design</h1>
          <p className={styles.line}>{ROOM.tagline}</p>
          <p className={`${styles.count} hud-label`}>
            {total.toLocaleString("en-US")} {total === 1 ? "content" : "contents"}
          </p>
        </div>
      </section>

      <div ref={spacer} className={styles.spacer} aria-hidden="true" />

      <ThemeZone theme="daybreak" as="div" surface={false} className={styles.sheet}>
        <div ref={lip} className={styles.lip} aria-hidden="true" />
        <div className={styles.body}>{children}</div>
      </ThemeZone>
    </div>
  );
}

/**
 * The film. The still shows until the film can show a picture (and for good if it can never play).
 * It holds the curtain until it has a frame. It plays while it is on screen, the tab is shown and no
 * post is open over it.
 */
function Film({ hero, resting }: { hero: DesignHero; resting: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    const el = video.current;
    const picked = heroFilmUrl(hero);
    if (!el || !picked) return;
    el.defaultMuted = true;
    el.muted = true;
    const mark = expectReady("library-design-hero");
    const done = () => {
      setReady(true);
      // One frame later, so the curtain opens on a drawn picture.
      requestAnimationFrame(() => {
        requestAnimationFrame(mark);
      });
    };
    const failed = () => {
      mark();
    };
    // The loading list holds the film whole in memory, and it may still be arriving when the room
    // mounts (behind the curtain). The film takes the in-memory copy once it is in: the same
    // download, shared by address, so one copy is fetched and nothing is streamed beside it. A film
    // that can never arrive plays from its address.
    let live = true;
    void loadMedia(picked.url, { type: "video/mp4", expectedBytes: picked.bytes }).then(
      (src) => {
        if (live) el.src = src;
      },
      () => {
        if (live) el.src = picked.url;
      },
    );
    if (el.readyState >= 2) done();
    el.addEventListener("loadeddata", done);
    el.addEventListener("error", failed);
    return () => {
      live = false;
      el.removeEventListener("loadeddata", done);
      el.removeEventListener("error", failed);
      mark();
      el.pause();
      // The film is held whole in memory (see `preload.ts`); it is let go when the room is left.
      releaseMedia(picked.url);
    };
  }, [hero]);

  useEffect(() => {
    const onVisibility = () => {
      setShown(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (ready && shown && !resting) void el.play().catch(() => undefined);
    else el.pause();
  }, [ready, shown, resting]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.still}
        src={libUrl(hero.poster)}
        alt=""
        width={hero.pw}
        height={hero.ph}
        decoding="async"
        fetchPriority="high"
        style={{ backgroundColor: hero.c }}
      />
      <video
        ref={video}
        className={styles.video}
        data-ready={ready ? "true" : undefined}
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
      />
    </>
  );
}
