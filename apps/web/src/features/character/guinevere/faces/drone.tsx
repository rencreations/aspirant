"use client";

import { useRef, type MouseEvent, type Ref } from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { WEB } from "../media";
import styles from "./faces.module.css";

const SRC = { 1: WEB.drone1, 2: WEB.drone2 } as const;

/** Where a drone is told about the pointer: a small hop on a touch or hover, a spin on a press. */
interface Props {
  n: 1 | 2;
  /** The element the section's pointer loop moves (the parallax). */
  parRef?: Ref<HTMLSpanElement>;
  reduced: boolean;
}

const HEARTS = 6;

/**
 * One of her two cat-eared drones. They float beside her all the time (a slow bob, a little
 * different for each), and answer a visitor:
 *   - hover or touch: the drone hops up and settles with a small squash, and tilts like a cat that
 *     was spoken to;
 *   - a press: it spins once on its axis and a few hearts float up out of it (the press does not
 *     follow the link of the half it floats over);
 *   - the section's pointer loop moves it a little, so it sits in front of or behind her with depth.
 * Four layers, one kind of movement each (parallax, bob, hop, spin), so the movements add up.
 */
export function Drone({ n, parRef, reduced }: Props) {
  const hop = useRef<HTMLSpanElement>(null);
  const spin = useRef<HTMLSpanElement>(null);
  const hearts = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  const hover = (e: { pointerType?: string }) => {
    if (reduced || busy.current) return;
    if (e.pointerType === "touch") return;
    const el = hop.current;
    if (!el) return;
    busy.current = true;
    audio.blip("hover");
    const a = el.animate(
      [
        { transform: "translate3d(0,0,0) scale(1,1) rotate(0deg)" },
        { transform: "translate3d(0,-9%,0) scale(0.96,1.06) rotate(-7deg)", offset: 0.35 },
        { transform: "translate3d(0,0,0) scale(1.08,0.92) rotate(5deg)", offset: 0.62 },
        { transform: "translate3d(0,-2%,0) scale(0.99,1.02) rotate(-2deg)", offset: 0.82 },
        { transform: "translate3d(0,0,0) scale(1,1) rotate(0deg)" },
      ],
      { duration: 640, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)" },
    );
    a.onfinish = () => {
      busy.current = false;
    };
  };

  const press = (e: MouseEvent) => {
    // The drone floats over a link: pressing it plays with it and does not open the story.
    e.preventDefault();
    e.stopPropagation();
    audio.blip("click");
    if (reduced) return;
    spin.current?.animate(
      [
        { transform: "rotateY(0deg) scale(1)" },
        { transform: "rotateY(180deg) scale(1.12)", offset: 0.5 },
        { transform: "rotateY(360deg) scale(1)" },
      ],
      { duration: 720, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
    const box = hearts.current;
    if (!box) return;
    for (let i = 0; i < HEARTS; i += 1) {
      const h = document.createElement("i");
      h.className = styles.heart ?? "";
      const dx = (Math.random() - 0.5) * 120;
      const rise = 70 + Math.random() * 90;
      h.style.left = `${35 + Math.random() * 30}%`;
      box.appendChild(h);
      const a = h.animate(
        [
          { transform: "translate3d(0,0,0) scale(0)", opacity: 0 },
          {
            transform: `translate3d(${dx * 0.4}px,${-rise * 0.4}px,0) scale(1)`,
            opacity: 1,
            offset: 0.3,
          },
          { transform: `translate3d(${dx}px,${-rise}px,0) scale(0.6)`, opacity: 0 },
        ],
        {
          duration: 1100 + Math.random() * 500,
          delay: i * 70,
          easing: "ease-out",
          fill: "backwards",
        },
      );
      a.onfinish = () => {
        h.remove();
      };
    }
  };

  return (
    <span ref={parRef} className={styles.drone} data-n={n} aria-hidden="true">
      <span className={styles.droneBob}>
        <span
          ref={hop}
          className={styles.droneHop}
          onPointerEnter={hover}
          onClick={press}
          data-cursor="PLAY"
        >
          <span ref={spin} className={styles.droneSpin}>
            {/* Plain <img>: static export, a transparent cut-out. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(SRC[n])}
              alt=""
              width={1254}
              height={1254}
              draggable={false}
              decoding="async"
            />
          </span>
        </span>
      </span>
      <span ref={hearts} className={styles.hearts} />
    </span>
  );
}
