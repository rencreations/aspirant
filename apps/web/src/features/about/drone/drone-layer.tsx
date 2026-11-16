"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { useLenis } from "@/components/smooth-scroll";
import { asset } from "@/lib/asset";
import { usePointer } from "@/lib/hooks";
import { expectReady } from "@/lib/page-ready";
import { untilItArrives } from "@/lib/retry";

import { LAYER } from "../layout";
import { DRONE_STILL } from "../media";
import { useAboutStage } from "../stage-bus";

import { createDirector, type Director } from "./director";
import styles from "./drone-layer.module.css";
import type { DroneScene } from "./drone-scene";
import { BODY_METRES, STILL } from "./model";

/** A lost context that has not come back after this long is replaced by a new scene. */
const LOST_WAIT_MS = 1500;
/** How many times a scene is built again after the browser took its context away. */
const REBUILDS = 3;

/** After this many failed tries the still picture stands in while the script is still asked for. */
const STILL_AFTER_TRIES = 3;

/**
 * The scene's script (three, the loader, the model's reader). On a poor connection it can fail to
 * arrive. It is asked for again for as long as it takes, a little later each time and only while
 * the connection is up, as every other file of the site is (`lib/retry.ts`): the loading screen
 * waits for this same script, and the page must not settle for less than the drone while it does.
 * After a few failures `onSlow` is called, so a visit with no loading screen is not left looking
 * at an empty first screen: the still picture stands in until the scene arrives.
 */
async function loadScene(stopped: () => boolean, onSlow: () => void) {
  return untilItArrives(async (n) => {
    if (stopped()) return null;
    if (n === STILL_AFTER_TRIES) onSlow();
    return import("./drone-scene");
  });
}

/**
 * The drone's layer: one fixed canvas over the page's text and under the film, and the director
 * that flies the drone on it (`director.ts`). This shell is not lazy: it holds the curtain until
 * the drone is drawn (`expectReady`), asks for the scene's script, and stands the still picture in
 * the drone's place when the scene cannot be drawn (no WebGL, a model that is gone, a context that
 * is taken away for good) or while its script keeps failing to arrive. That is a failure handled,
 * not a version.
 *
 * The canvas takes no pointer. One round, empty button follows the drone by transform, for the
 * pointer, a press and the keyboard.
 */
export function DroneLayer() {
  const layer = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const director = useRef<Director | null>(null);
  /** Where the still goes, kept for the moment the picture is mounted. */
  const stillAt = useRef("");
  const rebuilds = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const { getLenis } = useLenis();
  const pointer = usePointer();
  const noScene = useAboutStage((s) => s.engine === "none");

  // The director: one for the life of the page.
  useEffect(() => {
    const host = layer.current;
    const root = host?.closest<HTMLElement>("[data-about]");
    if (!host || !root || !probe.current || !button.current) return;
    const made = createDirector({
      layer: host,
      root,
      probe: probe.current,
      button: button.current,
      getLenis,
      pointer: pointer.ref,
      onStill: (place) => {
        // The hero's place is given in the document. The picture is laid out in the page's root.
        const box = root.getBoundingClientRect();
        const width = (place.size * STILL.metresAcross) / BODY_METRES;
        const height = (width * STILL.height) / STILL.width;
        const x = place.x - width / 2 - (box.left + window.scrollX);
        const y = place.y - height / 2 - (box.top + window.scrollY);
        stillAt.current = `--layer:${LAYER.drone};width:${width.toFixed(1)}px;translate:${x.toFixed(1)}px ${y.toFixed(1)}px`;
        if (still.current) still.current.style.cssText = stillAt.current;
      },
    });
    director.current = made;
    return () => {
      made.dispose();
      director.current = null;
    };
  }, [getLenis, pointer.ref]);

  // The scene. Built after mount on a canvas made here (a lost context cannot be used again), and
  // built again if the browser takes the context away and does not give it back.
  useEffect(() => {
    const host = layer.current;
    const d = director.current;
    if (!host || !d) return;
    const mark = expectReady("about-drone");
    let cancelled = false;
    let scene: DroneScene | null = null;
    let timer = 0;

    const giveUp = () => {
      d.setScene(null);
      d.setEngine("none");
      mark();
    };

    if (!hasWebGL()) {
      giveUp();
      return mark;
    }

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);

    const rebuild = () => {
      if (cancelled) return;
      if (rebuilds.current >= REBUILDS) {
        scene?.dispose();
        scene = null;
        canvas.remove();
        giveUp();
        return;
      }
      rebuilds.current += 1;
      setAttempt((n) => n + 1);
    };

    void (async () => {
      // While the script keeps failing the still stands in. The scene takes over when it comes.
      const loaded = await loadScene(
        () => cancelled,
        () => {
          if (!cancelled) giveUp();
        },
      );
      if (cancelled || !loaded) return;
      try {
        const made = await loaded.createDroneScene(canvas, {
          onLost: () => {
            timer = window.setTimeout(rebuild, LOST_WAIT_MS);
          },
          onRestored: () => {
            window.clearTimeout(timer);
          },
        });
        if (cancelled) {
          made.dispose();
          return;
        }
        scene = made;
        d.setScene(made);
        d.setEngine("ready");
        // Two frames on, the drone (or the empty air it will fly into) has really been drawn.
        requestAnimationFrame(() => {
          requestAnimationFrame(mark);
        });
      } catch {
        if (!cancelled) giveUp();
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      mark();
      d.setScene(null);
      scene?.dispose();
      canvas.remove();
    };
  }, [attempt]);

  // The still is mounted after its place was worked out: give it that place.
  useEffect(() => {
    if (noScene && still.current) still.current.style.cssText = stillAt.current;
  }, [noScene]);

  return (
    <>
      <div
        ref={layer}
        className={styles.layer}
        data-about-drone=""
        style={{ "--layer": LAYER.drone } as CSSProperties}
      >
        <div ref={probe} className={styles.probe} aria-hidden="true" />
        <button
          ref={button}
          type="button"
          className={styles.button}
          aria-label="The drone. Press to say hello."
          data-cursor="HELLO"
          data-off=""
          onClick={() => director.current?.press()}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") director.current?.hover(true);
          }}
          onPointerLeave={() => director.current?.hover(false)}
        />
      </div>
      {noScene ? (
        // eslint-disable-next-line @next/next/no-img-element -- a plain picture laid by transform
        <img
          ref={still}
          className={styles.still}
          src={asset(DRONE_STILL)}
          alt=""
          width={STILL.width}
          height={STILL.height}
          decoding="async"
          draggable={false}
        />
      ) : null}
    </>
  );
}
