"use client";

import { useEffect, useRef } from "react";

import type { ShortName } from "./director";
import { HOTSPOT_PATHS, HOTSPOT_STEP } from "./hotspots.generated";
import styles from "./hotspots.module.css";
import { SELENA_FPS } from "./timeline.generated";

/** The size of the picture, for the crop maths. */
const PIC_W = 3840;
const PIC_H = 1728;

export type SpotId = keyof typeof HOTSPOT_PATHS;

/**
 * The three touch points on her picture. Each one plays a short animation. The wording is plain
 * on purpose: a button says what it does.
 */
export const SPOTS: ReadonlyArray<{ id: SpotId; short: ShortName; label: string; action: string }> =
  [
    {
      id: "silverbolt",
      short: "short-1",
      label: "Silverbolt",
      action: "Play the Silverbolt animation",
    },
    { id: "badge", short: "short-2", label: "Badge", action: "Play the badge animation" },
    { id: "hand", short: "short-3", label: "Right arm", action: "Play the right arm animation" },
  ];

/** Where a point is on the picture (a fraction of its size) at `frame` of the idle loop. */
export function pathAt(
  path: ReadonlyArray<readonly [number, number]>,
  frame: number,
): [number, number] {
  const n = path.length;
  const f = (((frame / HOTSPOT_STEP) % n) + n) % n;
  const i = Math.floor(f);
  const t = f - i;
  const a = path[i] ?? [0, 0];
  const b = path[(i + 1) % n] ?? a;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Where a point of the picture lands in a box of `w` by `h` when the picture covers the box and
 * is cropped around `focus` (the same maths as `object-fit: cover; object-position`).
 */
export function coverPoint(
  nx: number,
  ny: number,
  w: number,
  h: number,
  focus: readonly [number, number],
): [number, number] {
  const scale = Math.max(w / PIC_W, h / PIC_H);
  const dw = PIC_W * scale;
  const dh = PIC_H * scale;
  return [(w - dw) * focus[0] + nx * dw, (h - dh) * focus[1] + ny * dh];
}

/** How far from the edge of the screen a point that is off screen is held (CSS pixels). */
const DOCK_MARGIN = 34;

/**
 * Keep a point on screen. A phone shows only the middle of the picture, so a point outside it is
 * held at the nearest edge, with an arrow that says where it really is. Returns the new place and
 * the direction (degrees) of the real one, or null when the point is on screen.
 */
export function dock(
  x: number,
  y: number,
  w: number,
  h: number,
  top = DOCK_MARGIN,
  bottom = DOCK_MARGIN,
): { x: number; y: number; angle: number | null } {
  const cx = Math.min(Math.max(x, DOCK_MARGIN), Math.max(DOCK_MARGIN, w - DOCK_MARGIN));
  const cy = Math.min(Math.max(y, top), Math.max(top, h - bottom));
  if (cx === x && cy === y) return { x, y, angle: null };
  return { x: cx, y: cy, angle: (Math.atan2(y - cy, x - cx) * 180) / Math.PI };
}

function percent(text: string | undefined): number {
  const v = Number.parseFloat(text ?? "");
  return Number.isFinite(v) ? v / 100 : 0.5;
}

interface Props {
  /** The clock of the idle loop, so the points follow its picture. Null while it cannot play. */
  idleClock: () => { time: number; playing: boolean } | null;
  /** The panel shows, so the points do. */
  visible: boolean;
  /** The short that was chosen and is waiting for its frame. */
  chosen: ShortName | null;
  /** The chosen one is still loading, so its wait has no length yet. */
  loading: boolean;
  waitMs: number | null;
  waitKey: number;
  /** Something else was chosen: the points step away. */
  away: boolean;
  onPick: (short: ShortName) => void;
  onCancel: () => void;
  onWarm: (short: ShortName) => void;
  onHover: () => void;
}

/** The ring that fills for the length of the wait, or turns while the clip is loading. */
function Progress({ ms, k }: { ms: number | null; k: number }) {
  return (
    <svg
      key={k}
      className={styles.progress}
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
      data-mode={ms === null ? "sweep" : "run"}
      style={
        ms === null ? undefined : ({ "--wait": `${Math.max(ms, 120)}ms` } as React.CSSProperties)
      }
    >
      <circle cx="18" cy="18" r="16" pathLength="100" />
    </svg>
  );
}

/**
 * Faint white circles on the picture that tell the visitor where to touch. Each follows its spot
 * through the idle loop (`hotspots.generated.ts`, from `scripts/selena/track.py`), so it never
 * slides off the Silverbolt, the badge or the hand. The circles breathe, ripple and drift softly.
 * Hovering one grows it, pressing one pulls it in, and a chosen one runs a ring for the wait.
 * The cursor snaps to a circle (`data-snap`, see the lantern cursor).
 */
export function Hotspots({
  idleClock,
  visible,
  chosen,
  loading,
  waitMs,
  waitKey,
  away,
  onPick,
  onCancel,
  onWarm,
  onHover,
}: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const spots = useRef<Partial<Record<SpotId, HTMLButtonElement | null>>>({});

  // What the loop below reads: the latest values, without restarting it.
  const live = useRef({ visible, idleClock });
  useEffect(() => {
    live.current = { visible, idleClock };
  }, [visible, idleClock]);

  useEffect(() => {
    const root = layer.current;
    if (!root) return;
    const loopMs = ((HOTSPOT_PATHS.silverbolt.length * HOTSPOT_STEP) / SELENA_FPS) * 1000;
    let w = 0;
    let h = 0;
    let focus: [number, number] = [0.5, 0.5];
    let top = DOCK_MARGIN;
    const animations = new Map<SpotId, Animation>();

    const measure = () => {
      w = root.clientWidth;
      h = root.clientHeight;
      const f = getComputedStyle(root).getPropertyValue("--focus").trim().split(/\s+/);
      focus = [percent(f[0]), percent(f[1])];
      // A docked point stays below the navigation bar.
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const nav =
        (Number.parseFloat(getComputedStyle(root).getPropertyValue("--nav-h")) || 4) * rem;
      top = nav + DOCK_MARGIN / 2;
    };

    /**
     * Each circle moves along its tracked path as a Web Animation of `transform`, which the
     * browser runs on its compositor: no script and no style work on any frame. (Moving it from
     * script on every frame restyled the circle and everything animated inside it, about 180
     * times a second.) The animation's clock is set from the idle video a few times a second.
     */
    const build = () => {
      measure();
      for (const spot of SPOTS) {
        const el = spots.current[spot.id];
        if (!el) continue;
        const path = HOTSPOT_PATHS[spot.id];
        const place = (nx: number, ny: number) => {
          const [px, py] = coverPoint(nx, ny, w, h, focus);
          return dock(px, py, w, h, top);
        };
        const frames: Keyframe[] = [...path, path[0]!].map(([nx, ny]) => {
          const { x, y } = place(nx, ny);
          return { transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` };
        });
        const known = animations.get(spot.id);
        if (known && known.effect instanceof KeyframeEffect) {
          known.effect.setKeyframes(frames);
        } else if (typeof el.animate === "function") {
          const a = el.animate(frames, {
            duration: loopMs,
            iterations: Infinity,
            easing: "linear",
          });
          a.pause();
          animations.set(spot.id, a);
        } else {
          el.style.transform = frames[0]!.transform as string;
        }
        // Docking and the side of the name follow the middle of the path.
        const mean = path.reduce(
          (m, [nx, ny]) => [m[0] + nx / path.length, m[1] + ny / path.length],
          [0, 0],
        );
        const mid = place(mean[0], mean[1]);
        el.dataset.docked = String(mid.angle !== null);
        el.dataset.side = mid.x > w / 2 ? "left" : "right";
        if (mid.angle !== null) el.style.setProperty("--a", `${mid.angle.toFixed(0)}deg`);
      }
    };

    /** Set each animation's clock from the idle video, and run or pause it with the video. */
    const sync = () => {
      const { visible: on, idleClock: clock } = live.current;
      const c = clock();
      const playing = on && !document.hidden && c?.playing === true;
      const t = ((((c?.time ?? 0) * 1000) % loopMs) + loopMs) % loopMs;
      for (const a of animations.values()) {
        if (!playing) {
          if (a.playState === "running") a.pause();
          a.currentTime = t;
          continue;
        }
        const now = (((Number(a.currentTime) || 0) % loopMs) + loopMs) % loopMs;
        const gap = Math.abs(now - t);
        if (Math.min(gap, loopMs - gap) > 45) a.currentTime = t;
        if (a.playState !== "running") a.play();
      }
    };

    build();
    sync();
    const ro = new ResizeObserver(() => {
      build();
      sync();
    });
    ro.observe(root);
    const timer = window.setInterval(sync, 250);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      for (const a of animations.values()) a.cancel();
    };
  }, []);

  return (
    <div
      ref={layer}
      className={styles.layer}
      data-on={visible}
      role="group"
      aria-label="Touch points"
    >
      {SPOTS.map((spot, i) => {
        const mine = chosen === spot.short;
        const gone = away && !mine;
        return (
          <button
            key={spot.id}
            ref={(el) => {
              spots.current[spot.id] = el;
            }}
            type="button"
            className={styles.spot}
            style={{ ["--i" as string]: i }}
            data-snap=""
            data-mine={mine}
            data-away={gone}
            aria-pressed={mine}
            aria-label={spot.action}
            disabled={gone}
            tabIndex={visible ? 0 : -1}
            onPointerEnter={() => {
              onHover();
              onWarm(spot.short);
            }}
            onFocus={() => {
              onWarm(spot.short);
            }}
            onClick={() => {
              if (mine) onCancel();
              else onPick(spot.short);
            }}
          >
            <span className={styles.float} aria-hidden="true">
              <span className={styles.halo} />
              <span className={styles.ring} />
              <span className={styles.dot} />
              {mine ? <Progress ms={loading ? null : waitMs} k={waitKey} /> : null}
            </span>
            <span className={styles.arrow} aria-hidden="true" />
            <span className={styles.tag} aria-hidden="true">
              {spot.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
