"use client";

import gsap from "gsap";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";

import { asset } from "@/lib/asset";

import { ART_NAMES, FANART_COUNT, artThumb, fanartThumb } from "../../media";
import type { SceneHandle } from "../gate";
import styles from "./scenes.module.css";

/** Where each frame hangs, in percent of the screen (the width of a print is its width only), and how it sits. */
interface Frame {
  x: number;
  y: number;
  w: number;
  /** Height in percent of the screen. A print has none: it keeps the 4 to 5 shape of its picture. */
  h?: number;
  r: number;
  /** Which part of its picture it shows. */
  pos: string;
}

interface FallConfig {
  frames: readonly Frame[];
  /** The picture of frame `i`. */
  src: (i: number) => string;
  /** The colour behind the frames: what the screen is while the page changes under them. */
  back: string;
  /** The tone of the corner of the screen while the frames cover it (the nav text follows it). */
  tone: "dark" | "light";
  /** `wall`: gold frames on wires that are lifted off; `print`: pinned prints that fall on down. */
  kind: "wall" | "print";
}

const ART: FallConfig = {
  kind: "wall",
  back: "#0b0716",
  tone: "dark",
  src: (i) => artThumb(ART_NAMES[i % ART_NAMES.length] ?? "vexana-splash-art"),
  frames: [
    { x: 5, y: 14, w: 19, h: 34, r: -4, pos: "30% 40%" },
    { x: 27, y: 7, w: 14, h: 21, r: 3, pos: "70% 30%" },
    { x: 44, y: 20, w: 22, h: 30, r: -2, pos: "50% 60%" },
    { x: 70, y: 9, w: 15, h: 25, r: 4, pos: "20% 50%" },
    { x: 76, y: 43, w: 18, h: 30, r: -3, pos: "80% 55%" },
    { x: 12, y: 55, w: 24, h: 28, r: 2, pos: "60% 25%" },
    { x: 42, y: 57, w: 17, h: 26, r: -5, pos: "40% 70%" },
  ],
};

const FANART: FallConfig = {
  kind: "print",
  back: "#ece6f8",
  tone: "light",
  src: (i) => fanartThumb((i % FANART_COUNT) + 1),
  frames: [
    { x: 4, y: 9, w: 15, r: -5, pos: "50% 30%" },
    { x: 21, y: 3, w: 12, r: 4, pos: "50% 40%" },
    { x: 36, y: 13, w: 16, r: -3, pos: "50% 35%" },
    { x: 55, y: 5, w: 13, r: 5, pos: "50% 30%" },
    { x: 71, y: 11, w: 16, r: -4, pos: "50% 38%" },
    { x: 11, y: 53, w: 14, r: 3, pos: "50% 30%" },
    { x: 31, y: 56, w: 12, r: -6, pos: "50% 36%" },
  ],
};

/**
 * Pictures that come down over the screen while the page changes under them, made from a list of
 * frames and the pictures in them:
 *
 *  - the 3D process to Our Artwork (`WallScene`): the workspace turns away on its side and fades,
 *    and gold frames holding the official artwork drop in on their wires, each swinging to rest.
 *    The page jumps to the gallery behind the wall, and the frames are lifted off again one
 *    after the other to show it.
 *  - Our Artwork to Fans Creations (`FanScene`): the gallery draws back and the fan prints fall in
 *    from the top, pinned and swinging, over a board in the colour of the fanart section. The page
 *    jumps under them, and the prints keep falling out of the bottom of the screen.
 */
function makeFall(cfg: FallConfig): ForwardRefExoticComponent<RefAttributes<SceneHandle>> {
  return forwardRef<SceneHandle>(function FallScene(_, ref) {
    const box = useRef<HTMLDivElement>(null);
    const bg = useRef<HTMLDivElement>(null);
    const frames = useRef<Array<HTMLDivElement | null>>([]);
    const pictures = useRef<Array<HTMLImageElement | null>>([]);

    // The pictures are decoded ahead, so the first frame of the scene never waits for one.
    useEffect(() => {
      for (const img of pictures.current) void img?.decode().catch(() => undefined);
    }, []);

    useImperativeHandle(
      ref,
      (): SceneHandle => ({
        build(ctx) {
          const k = ctx.level === "lite" ? 0.7 : 1;
          const fr = frames.current.filter((el): el is HTMLDivElement => !!el);
          const tl = ctx.tl;
          if (ctx.backdrop) ctx.backdrop.style.background = cfg.back;
          gsap.set(box.current, { opacity: 1 });
          gsap.set(bg.current, { opacity: 0 });
          if (cfg.kind === "wall") {
            if (ctx.held) {
              tl.set(ctx.held, { transformOrigin: ctx.pivot(), transformPerspective: 1100 }, 0);
              tl.to(
                ctx.held,
                {
                  rotationY: -30,
                  x: -ctx.vw * 0.1,
                  scale: 0.86,
                  opacity: 0,
                  duration: 0.7 * k,
                  ease: "power2.in",
                },
                0,
              );
            }
            fr.forEach((el, i) => {
              const f = cfg.frames[i];
              if (!f) return;
              const start = (0.22 + i * 0.07) * k;
              gsap.set(el, { y: -ctx.vh * 1.4, rotation: i % 2 ? 9 : -9 });
              tl.to(el, { y: 0, duration: 0.62 * k, ease: "power3.out" }, start);
              tl.to(el, { rotation: f.r, duration: 1.0 * k, ease: "elastic.out(1, 0.35)" }, start);
              tl.to(
                el,
                { y: -ctx.vh * 1.4, duration: 0.45 * k, ease: "power2.in" },
                (1.0 + i * 0.04) * k,
              );
            });
            tl.to(bg.current, { opacity: 1, duration: 0.15 * k }, 0.68 * k);
            ctx.hint(0, cfg.tone);
            ctx.swapAt(0.92 * k);
            tl.to(bg.current, { opacity: 0, duration: 0.35 * k, ease: "power1.out" }, 1.25 * k);
            return;
          }
          // The prints: the gallery draws back, the prints fall in from the top, pinned and
          // swinging, the board fills in behind them, and after the jump they fall on, out of the
          // bottom, one after another from the left.
          if (ctx.held) {
            tl.set(ctx.held, { transformOrigin: ctx.pivot() }, 0);
            tl.to(
              ctx.held,
              { scale: 0.92, y: -ctx.vh * 0.04, opacity: 0, duration: 0.8 * k, ease: "power2.in" },
              0,
            );
          }
          fr.forEach((el, i) => {
            const f = cfg.frames[i];
            if (!f) return;
            const start = (0.12 + i * 0.09) * k;
            gsap.set(el, { y: -ctx.vh * 1.3, rotation: f.r * 2.4, transformOrigin: "50% 0" });
            tl.to(el, { y: 0, duration: 0.75 * k, ease: "power2.out" }, start);
            tl.to(el, { rotation: f.r, duration: 1.1 * k, ease: "elastic.out(1, 0.28)" }, start);
            tl.to(
              el,
              {
                y: ctx.vh * 1.4,
                rotation: f.r * 3.2,
                duration: 0.7 * k,
                ease: "power2.in",
              },
              (1.1 + i * 0.07) * k,
            );
          });
          tl.to(bg.current, { opacity: 1, duration: 0.22 * k }, 0.55 * k);
          ctx.hint(0.6 * k, cfg.tone);
          ctx.swapAt(0.98 * k);
          tl.to(bg.current, { opacity: 0, duration: 0.5 * k, ease: "power1.out" }, 1.4 * k);
        },
        reset() {
          gsap.set(box.current, { opacity: 0 });
        },
      }),
      [],
    );

    return (
      <div ref={box} className={styles.wall}>
        <div ref={bg} className={styles.wallBg} style={{ background: cfg.back }} />
        {cfg.frames.map((f, i) => (
          <div
            key={i}
            ref={(el) => {
              frames.current[i] = el;
            }}
            className={cfg.kind === "wall" ? styles.wallFrame : styles.printFrame}
            style={{
              left: `${String(f.x)}%`,
              top: `${String(f.y)}%`,
              width: `${String(f.w)}%`,
              ...(f.h === undefined ? null : { height: `${String(f.h)}%` }),
            }}
          >
            {/* Plain <img>: static export, art already sized. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={(el) => {
                pictures.current[i] = el;
              }}
              src={asset(cfg.src(i))}
              alt=""
              draggable={false}
              loading="eager"
              decoding="async"
              style={{ objectPosition: f.pos }}
            />
          </div>
        ))}
      </div>
    );
  });
}

/** The 3D process to Our Artwork: gold frames of the official artwork drop in on wires. */
export const WallScene = makeFall(ART);

/** Our Artwork to Fans Creations: the fan prints fall in and on out of the screen. */
export const FanScene = makeFall(FANART);
