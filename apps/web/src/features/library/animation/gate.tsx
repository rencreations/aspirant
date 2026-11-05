"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { TLink } from "@/components/transition/t-link";
import { CharacterStage, type StageApi } from "@/features/character/stage/stage";
import { asset } from "@/lib/asset";
import { characterRoute } from "@/lib/site";

import styles from "./gate.module.css";
import { formatMegabytes, onColour } from "./room-math";
import type { Room } from "./use-room";
import { useParallax } from "./use-parallax";
import type { AnimChar } from "./types";

interface Props {
  room: Room;
  /** The stage's handle, which the room calls. */
  stage: RefObject<StageApi | null>;
  char: AnimChar;
  /** The colour the gate is drawn with on its ink. */
  accent: string;
  /** The line in the lower left of the picture: what is on screen. */
  now: string | null;
  /** The next clip and how long until it starts, when one is queued. */
  waiting: { label: string; ms: number | null; at: number } | null;
  /** Position in the picker, for the number. */
  index: number;
  /** The deck, drawn on the same plate under the aperture. */
  children: ReactNode;
}

/**
 * The film gate: a dark plate around one big stage. The picture sits in an aperture with corner
 * marks. A shutter of two blades closes over it at every cut (a new character, the welcome again, a
 * jump back to idle) so no swap is ever seen, and opens when the next picture is moving.
 */
export function Gate({ room, stage, char, accent, now, waiting, index, children }: Props) {
  const { phase, bundle, state, setHidden, stageKey } = room;
  const root = useRef<HTMLElement>(null);
  const aperture = useRef<HTMLDivElement>(null);
  const visible = useRef(true);

  // The picture moves a little against the pointer, the labels a little with it.
  useParallax(aperture);

  // A stage that is scrolled out of view stops decoding, and carries on when it comes back.
  useEffect(() => {
    const el = aperture.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry?.isIntersecting ?? true;
        setHidden(!visible.current);
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [setHidden]);
  useEffect(() => {
    if (state.mode !== "boot" && !visible.current) setHidden(true);
  }, [state.mode, stageKey, setHidden]);

  const vars = {
    "--ink": char.palette.ink,
    "--accent": accent,
    "--on-accent": onColour(accent),
    "--on-plate": "#f3f0ea",
    "--focus": `${char.focus}% 50%`,
  } as CSSProperties;

  const stillSrc =
    phase === "preparing"
      ? asset(`/img/char/${char.slug}/splash.webp`)
      : bundle
        ? asset(`${bundle.media.dir}/still.webp`)
        : asset(`/img/char/${char.slug}/splash-sm.webp`);
  const showStage = phase === "ready" && bundle !== null;
  const loading = phase === "loading" && room.load !== null && room.load.total > 0;

  return (
    <section
      ref={root}
      id="anim-stage"
      role="tabpanel"
      aria-labelledby={`anim-tab-${char.slug}`}
      className={styles.gate}
      data-phase={phase}
      style={vars}
    >
      <header className={styles.rail}>
        <span className="hud-label">Film gate 2.22 : 1</span>
        <span className={styles.holes} aria-hidden="true" />
        <span className="hud-label">In-game showcase</span>
      </header>

      <div ref={aperture} className={styles.aperture}>
        <div className={styles.slide} data-depth="-7" data-scale="1.014">
          {showStage && bundle ? (
            <CharacterStage
              key={room.stageKey}
              ref={stage}
              timeline={bundle.timeline}
              media={bundle.media}
              skip={bundle.skip}
              onState={room.onState}
              welcome
              onBegin={noop}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.still} src={stillSrc} alt="" draggable={false} />
          )}
        </div>

        {(["tl", "tr", "bl", "br"] as const).map((c) => (
          <i key={c} className={styles.corner} data-c={c} aria-hidden="true" />
        ))}

        <div className={`${styles.hud} ${styles.hudA}`} data-depth="5">
          <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
          <span className={`${styles.name} display`}>{char.name}</span>
        </div>

        <div className={`${styles.hud} ${styles.hudB}`} data-depth="5">
          <TLink
            href={characterRoute(char.slug)}
            transitionLabel={char.name}
            className={styles.page}
          >
            <span>Open {char.name}&apos;s page</span>
            <i aria-hidden="true" />
          </TLink>
        </div>

        <div className={`${styles.hud} ${styles.hudC}`} data-depth="5">
          {state.mode === "welcome" ? (
            <button type="button" className={styles.skip} onClick={room.idle}>
              Skip the welcome
            </button>
          ) : null}
          {now ? <span className={styles.now}>{now}</span> : null}
        </div>

        {waiting ? (
          <div className={styles.wait} role="presentation">
            <span>{waiting.label}</span>
            <span className={styles.waitRail}>
              {waiting.ms === null ? null : (
                <i
                  key={waiting.at}
                  style={{ "--wait": `${Math.max(waiting.ms, 300)}ms` } as CSSProperties}
                />
              )}
            </span>
          </div>
        ) : null}

        {phase === "preparing" ? (
          <div className={styles.prep}>
            <span className="hud-label">Preparing</span>
            <p>
              The animation of {char.name} is not ready yet. The other characters play now, and this
              one appears here as soon as it is.
            </p>
          </div>
        ) : null}

        <div className={styles.shutter} data-closed={room.closed} aria-hidden="true">
          <i className={`${styles.blade} ${styles.top}`} />
          <i className={`${styles.blade} ${styles.bottom}`} />
          <div className={styles.core} data-show={room.closed && phase === "loading"}>
            <span className={styles.coreName}>{char.name}</span>
            <span className={`${styles.coreLine} hud-label`}>
              {loading && room.load
                ? `${formatMegabytes(room.load.received)} of ${formatMegabytes(room.load.total)}`
                : "Loading"}
            </span>
            <span className={styles.coreRail}>
              <i style={{ transform: `scaleX(${room.load?.fraction ?? 0})` }} />
            </span>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function noop() {
  /* The room has no music to start. */
}
