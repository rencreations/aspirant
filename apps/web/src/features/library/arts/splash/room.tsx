"use client";

import { useCallback, useMemo, useRef, useState, useEffect, type ReactNode } from "react";

import { useIsoLayoutEffect } from "@/lib/hooks";

import { CanonBadge } from "../../shell/credit";
import { useArtsBar } from "../core/chrome";
import { ZoomProvider, type ZoomPicture } from "../core/zoom";
import type { SplashItem } from "./data";
import { dateLabel, isMade, metaLine, NOT_OFFICIAL } from "./labels";
import { computeLayout, visibleFrame } from "./model";
import { pickSize } from "./pictures";
import { SplashStage, type StageApi, type StageView } from "./stage";
import styles from "./splash.module.css";

/** What the server and the first render of the client draw: a laptop. Measured on mount. */
const DEFAULT_VIEW: StageView = { layout: computeLayout(1440, 900), size: "p", measured: false };

function measure(): StageView {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const layout = computeLayout(w, h);
  return { layout, size: pickSize(layout.pw, window.devicePixelRatio), measured: true };
}

/** The size and the shape of the screen, read before the first paint and again when it changes. */
function useStageView(): StageView {
  const [view, setView] = useState<StageView>(DEFAULT_VIEW);
  useIsoLayoutEffect(() => {
    setView(measure());
  }, []);
  useEffect(() => {
    let raf = 0;
    const again = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = measure();
        setView((prev) =>
          prev.measured &&
          prev.size === next.size &&
          prev.layout.ww === next.layout.ww &&
          prev.layout.wh === next.layout.wh &&
          prev.layout.step === next.layout.step
            ? prev
            : next,
        );
      });
    };
    window.addEventListener("resize", again, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", again);
    };
  }, []);
  return view;
}

/** What the viewer says under the picture: its kind and day, the mark when it is not official, the source. */
function ViewerCaption({ item }: { item: SplashItem }): ReactNode {
  const day = dateLabel(item.facts.date);
  return (
    <span className={styles.viewerCaption}>
      <span>
        {metaLine(item)}
        {day ? `, ${day}` : ""}
      </span>
      {isMade(item) ? (
        <span>
          <CanonBadge canon={item.canon} /> {NOT_OFFICIAL}
        </span>
      ) : null}
      {item.facts.sourceUrl ? (
        <a href={item.facts.sourceUrl} target="_blank" rel="noopener noreferrer">
          The source post
        </a>
      ) : null}
    </span>
  );
}

/**
 * The Splash art room (`/collection/arts`): the stage, the zoom, and the corners. The zoom gets the
 * pictures with the window the stage shows of each (`visibleFrame`), and starts from the file the
 * window already draws, so the first frame of the morph is as sharp as the window.
 */
export function SplashRoom({ items }: { items: readonly SplashItem[] }) {
  useArtsBar("daybreak");
  const view = useStageView();
  const apiRef = useRef<StageApi | null>(null);

  const pictures = useMemo<ZoomPicture[]>(
    () =>
      items.map((item) => {
        // The viewer's first layer is its thumbnail: hand it the stage's own file, never the 480 one.
        const img =
          view.size === "f"
            ? { ...item.img, t: item.img.f, p: item.img.f }
            : { ...item.img, t: item.img.p };
        return {
          id: item.id,
          img,
          alt: item.alt,
          title: item.title,
          frame: visibleFrame(item.frame, view.layout),
          caption: <ViewerCaption item={item} />,
        };
      }),
    [items, view.size, view.layout],
  );

  // The viewer stepped to a neighbour, or the search opened a picture: the stage stands on it, with no sweep.
  const onOpenChange = useCallback(
    (id: string | null) => {
      if (!id) return;
      const at = items.findIndex((item) => item.id === id);
      if (at >= 0) apiRef.current?.jumpTo(at);
    },
    [items],
  );

  return (
    <ZoomProvider pictures={pictures} tone="light" onOpenChange={onOpenChange}>
      <h1 className="sr-only">Splash art</h1>
      <SplashStage items={items} view={view} apiRef={apiRef} />
    </ZoomProvider>
  );
}
