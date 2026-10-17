"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { ScatterText } from "@/components/text/scatter-text";
import { ThemeZone } from "@/components/theme-zone";
import { whereYouAre } from "@/content/world";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import { ChapterLinks } from "../chapter-link";
import styles from "./intro.module.css";
import { calloutAt, type Layout, type SceneFocus } from "./sphere-layout";
import type { SceneApi, SceneControl } from "./sphere-scene";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const SphereScene = dynamic(() => import("./sphere-scene").then((m) => m.SphereScene), {
  ssr: false,
  loading: () => <div className={styles.sceneFallback} aria-hidden="true" />,
});

const IDS: readonly SceneFocus[] = ["dawnbreak", "terrinia", "selrick-academy", "defence-sphere"];

function isFocus(id: string): id is SceneFocus {
  return (IDS as readonly string[]).includes(id);
}

/**
 * Opening of /story: the h1, a scene of Dawnbreak, Terrinia, the Academy tower and the
 * Defence Sphere (a hex dome that ripples where you point), and four readout cards that light
 * the part of the scene they describe. Hover, focus or tap a card to light it; press it to send
 * a ripple through the Sphere.
 */
export function Intro() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const control = useRef<SceneControl>({ focus: null });
  const reduced = useReducedMotion();
  const [active, setActive] = useState<SceneFocus | null>(null);
  const hover = useRef<SceneFocus | null>(null);
  const api = useRef<SceneApi | null>(null);

  const apply = useCallback((nextActive: SceneFocus | null) => {
    control.current.focus = hover.current ?? nextActive;
  }, []);

  const select = (id: SceneFocus) => {
    const next = active === id ? null : id;
    setActive(next);
    apply(next);
    audio.blip("click");
    const stage = stageRef.current;
    if (!stage) return;
    const layout = layoutRef.current;
    if (next && layout) {
      const at = calloutAt(layout, id);
      api.current?.ripple(at.x / 100, at.y / 100, id === "defence-sphere" ? 1.6 : 1);
    }
  };

  const layoutRef = useRef<Layout | null>(null);
  const onLayout = useCallback((layout: Layout) => {
    layoutRef.current = layout;
    const stage = stageRef.current;
    if (!stage) return;
    for (const id of IDS) {
      const at = calloutAt(layout, id);
      stage.style.setProperty(`--${id}-x`, `${at.x.toFixed(2)}%`);
      stage.style.setProperty(`--${id}-y`, `${at.y.toFixed(2)}%`);
    }
  }, []);

  // Scroll: the scene drifts slower than the page and settles in as it arrives.
  useGSAP(
    () => {
      const inner = innerRef.current;
      const stage = stageRef.current;
      if (!inner || !stage || reduced) return;
      gsap.fromTo(
        inner,
        { yPercent: 0, scale: 1.0 },
        {
          yPercent: -7,
          scale: 1.07,
          ease: "none",
          scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );
    },
    { scope: rootRef, dependencies: [reduced] },
  );

  return (
    <ThemeZone theme="daybreak" className={styles.intro} aria-labelledby="story-title">
      <div className={`${styles.hexes} grid-hex fade-edges`} aria-hidden="true" />
      <div className="relative shell">
        <div className={styles.top}>
          <div>
            <p className={`${styles.eyebrow} hud-label`}>
              <StarGlyph />
              03 / Story, the world
            </p>
            <ScatterText
              as="h1"
              text="Dawnbreak"
              className={`${styles.h1} display`}
              radius={110}
              strength={0.9}
            />
          </div>
          <p className={styles.lead}>
            A young green planet. A city built round a lake. A roof of glass hexagons over it, and a
            school under the roof. This is where the story happens.
          </p>
        </div>

        <section ref={rootRef} aria-labelledby="where-title" className={styles.where}>
          <h2 id="where-title" className={styles.srOnly}>
            Where you are
          </h2>
          <div ref={stageRef} className={styles.stage} data-active={active ?? "none"}>
            <div ref={innerRef} className={styles.stageInner}>
              <SphereScene
                control={control}
                className={styles.scene}
                onLayout={onLayout}
                onReady={(a) => {
                  api.current = a;
                }}
              />
            </div>
            <div className={styles.hud} aria-hidden="true">
              <span className={`${styles.brk} ${styles.tl}`} />
              <span className={`${styles.brk} ${styles.tr}`} />
              <span className={`${styles.brk} ${styles.bl}`} />
              <span className={`${styles.brk} ${styles.br}`} />
              <span className={`${styles.readout} hud-label`}>Live view / Terrinia</span>
              <span className={`${styles.readoutR} hud-label`}>Sphere online</span>
              {whereYouAre.map((p, i) =>
                isFocus(p.entityId) ? (
                  <span
                    key={p.entityId}
                    className={styles.marker}
                    data-id={p.entityId}
                    data-lit={active === p.entityId}
                    style={{
                      left: `var(--${p.entityId}-x, 50%)`,
                      top: `var(--${p.entityId}-y, 50%)`,
                    }}
                  >
                    <span className={styles.markerNum}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={styles.markerName}>{p.name}</span>
                  </span>
                ) : null,
              )}
            </div>
            <p className={`${styles.hint} hud-label`}>Move across the Sphere</p>
          </div>

          <ul className={styles.cards}>
            {whereYouAre.map((p, i) => {
              const id = p.entityId;
              if (!isFocus(id)) return null;
              const on = active === id;
              return (
                <li key={id} className={styles.card} data-on={on}>
                  <button
                    type="button"
                    className={styles.cardBtn}
                    aria-pressed={on}
                    data-cursor="LIGHT"
                    onClick={() => select(id)}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "mouse") return;
                      hover.current = id;
                      apply(active);
                      audio.blip("hover");
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType !== "mouse") return;
                      hover.current = null;
                      apply(active);
                    }}
                    onFocus={() => {
                      hover.current = id;
                      apply(active);
                    }}
                    onBlur={() => {
                      hover.current = null;
                      apply(active);
                    }}
                  >
                    <span className={styles.cardNum}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={styles.cardName}>{p.name}</span>
                  </button>
                  <p className={styles.cardLine}>{p.line}</p>
                  <ChapterLinks ids={p.chapterIds} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </ThemeZone>
  );
}
