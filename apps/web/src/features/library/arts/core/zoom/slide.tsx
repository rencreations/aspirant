"use client";

/**
 * One picture of the viewer: the layers of its window, its scroller and the picture itself in three
 * qualities. The thumbnail (the tile's own file, already in the cache) is there at once. The preview
 * is drawn over it when it has decoded, and the full size over that, again only when decoded
 * (`decode()` first, so a swap never janks). The moves are in `run.ts`.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

import { useIsoLayoutEffect } from "@/lib/hooks";
import { libUrl } from "@/lib/library";

import { startRun } from "./run";
import type { RunHandle, ZoomPhase, ZoomPicture, ZoomView } from "./types";
import styles from "./viewer.module.css";

export interface SlideStatus {
  /** The preview has decoded. */
  p: boolean;
  /** The full size has decoded (or is the preview). */
  f: boolean;
  /** Neither could be loaded: the thumbnail stays. */
  failed: boolean;
}

export interface SlideEvents {
  status: (seq: number, status: SlideStatus) => void;
  phase: (seq: number, phase: ZoomPhase) => void;
  closeStart: (seq: number) => void;
  closed: (seq: number) => void;
  scrolled: (seq: number, progress: number) => void;
  handle: (seq: number, handle: RunHandle | null) => void;
}

interface SlideProps {
  view: ZoomView;
  /** A neighbour has taken its place: it fades out and goes. */
  leaving: boolean;
  backdrop: RefObject<HTMLDivElement | null>;
  /** A new value loads the pictures again (after a failure). */
  retry: number;
  events: SlideEvents;
}

export function Slide({ view, leaving, backdrop, retry, events }: SlideProps) {
  const { picture, seq } = view;
  const drag = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLImageElement>(null);
  const run = useRef<ReturnType<typeof startRun> | null>(null);
  const latest = useRef({ events, view });

  useIsoLayoutEffect(() => {
    latest.current = { events, view };
  });

  // The moves.
  useIsoLayoutEffect(() => {
    const els = {
      // The viewer's own box is the parent: its ref is attached after this effect runs.
      root: drag.current?.parentElement,
      drag: drag.current,
      outer: outer.current,
      inner: inner.current,
      counter: counter.current,
      scroller: scroller.current,
      content: content.current,
    };
    if (
      !els.root ||
      !els.drag ||
      !els.outer ||
      !els.inner ||
      !els.counter ||
      !els.scroller ||
      !els.content
    )
      return;
    const ev = () => latest.current.events;
    const started = startRun(
      latest.current.view,
      {
        root: els.root,
        drag: els.drag,
        outer: els.outer,
        inner: els.inner,
        counter: els.counter,
        scroller: els.scroller,
        content: els.content,
        backdrop: backdrop.current,
        thumb: () => thumb.current,
      },
      {
        phase: (p) => {
          ev().phase(seq, p);
        },
        closeStart: () => {
          ev().closeStart(seq);
        },
        closed: () => {
          ev().closed(seq);
        },
        scrolled: (progress) => {
          ev().scrolled(seq, progress);
        },
      },
    );
    run.current = started;
    ev().handle(seq, started.handle);
    return () => {
      ev().handle(seq, null);
      started.dispose();
      run.current = null;
    };
  }, [backdrop, seq]);

  useEffect(() => {
    if (leaving) run.current?.fadeOut();
  }, [leaving]);

  return (
    <div ref={drag} className={styles.drag} data-leaving={leaving ? "true" : undefined}>
      <div ref={outer} className={styles.outer}>
        <div ref={inner} className={styles.inner}>
          <div ref={counter} className={styles.counter}>
            <div ref={scroller} className={styles.scroller} data-zoom="out" data-scroll="false">
              <div ref={content} className={styles.content} data-zoom="out" aria-hidden="true">
                <Faces
                  key={retry}
                  picture={picture}
                  thumb={thumb}
                  onStatus={(next) => {
                    latest.current.events.status(seq, next);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The three qualities of the picture, one over the other. The thumbnail is the tile's file and is
 * drawn at once. The preview is rendered with the thumbnail and shown (a fade of its opacity) when
 * it has decoded. The full size is requested after the preview is settled and shown the same way.
 * A picture that is its own full size (a comic strip) has no third layer.
 */
function Faces({
  picture,
  thumb,
  onStatus,
}: {
  picture: ZoomPicture;
  thumb: RefObject<HTMLImageElement | null>;
  onStatus: (status: SlideStatus) => void;
}) {
  const img = picture.img;
  const sameFile = img.f === img.p;
  const preview = useRef<HTMLImageElement>(null);
  const full = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<SlideStatus>({ p: false, f: false, failed: false });
  const [previewSettled, setPreviewSettled] = useState(false);
  const report = useRef(onStatus);
  useIsoLayoutEffect(() => {
    report.current = onStatus;
  });

  useEffect(() => {
    let alive = true;
    const el = preview.current;
    if (!el) return;
    el.decode().then(
      () => {
        if (!alive) return;
        setStatus((s) => ({ ...s, p: true, f: s.f || sameFile }));
        setPreviewSettled(true);
      },
      () => {
        if (!alive) return;
        setStatus((s) => ({ ...s, failed: sameFile }));
        setPreviewSettled(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [sameFile]);

  useEffect(() => {
    if (!previewSettled || sameFile) return;
    let alive = true;
    const el = full.current;
    if (!el) return;
    el.decode().then(
      () => {
        if (alive) setStatus((s) => ({ ...s, f: true }));
      },
      () => {
        if (alive) setStatus((s) => ({ ...s, failed: !s.p }));
      },
    );
    return () => {
      alive = false;
    };
  }, [previewSettled, sameFile]);

  useEffect(() => {
    report.current(status);
  }, [status]);

  return (
    <>
      {/* Plain <img>: static export, and the library lives on another origin. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={thumb}
        className={styles.face}
        data-in="true"
        src={libUrl(img.t)}
        alt=""
        decoding="sync"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={preview}
        className={styles.face}
        data-in={status.p}
        src={libUrl(img.p)}
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable={false}
      />
      {previewSettled && !sameFile ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={full}
          className={styles.face}
          data-in={status.f}
          src={libUrl(img.f)}
          alt=""
          decoding="async"
          draggable={false}
        />
      ) : null}
    </>
  );
}
