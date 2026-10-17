"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { ThemeZone } from "@/components/theme-zone";
import { hierarchy } from "@/content/world";
import { audio } from "@/lib/audio";
import { usePointer, useMediaQuery, useReducedMotion } from "@/lib/hooks";

import { ChapterLink, ChapterLinks } from "../chapter-link";
import { SectionHead } from "../section-head";
import { LayerGlyph } from "./hierarchy-glyphs";
import styles from "./hierarchy.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

const COLOURS: Readonly<Record<string, string>> = {
  will: "var(--violet)",
  matrix: "var(--cyan)",
  obsidia: "var(--crimson)",
  enders: "var(--amber)",
  core: "var(--gold)",
};

const DEPTH = [22, 14, 7, 0, -9];

/**
 * The hierarchy as five stacked plates. Pointer movement slides each plate by a different
 * amount, so the stack has depth. Select a plate (hover on a wide screen, click, tap, Enter)
 * and its text opens: beside the stack on a wide screen, under the plate on a phone. The
 * Ender Control Core is drawn as a device, apart from the beings above it.
 */
export function Hierarchy() {
  const rootRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("will");
  const wide = useMediaQuery("(min-width: 62em)");
  const reduced = useReducedMotion();
  const pointer = usePointer();

  // Depth: plates shift against the pointer by layer.
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || reduced || !wide) return;
    return pointer.subscribe((p) => {
      stack.style.setProperty("--px", p.x.toFixed(3));
      stack.style.setProperty("--py", p.y.toFixed(3));
    });
  }, [pointer, reduced, wide]);

  useGSAP(
    () => {
      const stack = stackRef.current;
      if (!stack || reduced) return;
      const plates = Array.from(stack.querySelectorAll<HTMLElement>("[data-plate]"));
      gsap.fromTo(
        plates,
        { yPercent: (i) => -i * 70, opacity: 0.2, scale: 0.94 },
        {
          yPercent: 0,
          opacity: 1,
          scale: 1,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: { trigger: stack, start: "top 85%", end: "top 35%", scrub: 0.7 },
        },
      );
    },
    { scope: rootRef, dependencies: [reduced] },
  );

  return (
    <ThemeZone theme="storm" aria-labelledby="hierarchy-title" className={styles.section}>
      <div className={`${styles.void} grid-hex fade-edges`} aria-hidden="true" />
      <section ref={rootRef} className="relative shell">
        <SectionHead
          id="hierarchy-title"
          code="04 / The hierarchy"
          title="Who gives the orders"
          lead="A mind, a body, a commander, the hands, and one device. Pick a layer."
        />
        <div ref={stackRef} className={styles.stack} data-wide={wide}>
          {hierarchy.map((layer, i) => {
            const on = active === layer.id;
            const device = layer.id === "core";
            const colour = COLOURS[layer.id] ?? "var(--accent)";
            const style = {
              "--row": i + 1,
              "--i": i,
              "--depth": DEPTH[i] ?? 0,
              "--c": colour,
            } as CSSProperties;
            return (
              <div
                key={layer.id}
                className={styles.item}
                data-on={on}
                data-device={device}
                style={style}
              >
                <button
                  type="button"
                  id={`layer-${layer.id}`}
                  data-plate=""
                  className={styles.plate}
                  aria-expanded={on}
                  aria-controls={`layer-detail-${layer.id}`}
                  data-cursor={device ? "DEVICE" : "OPEN"}
                  onClick={() => {
                    setActive(layer.id);
                    audio.blip("click");
                  }}
                  onPointerEnter={(e) => {
                    if (!wide || e.pointerType !== "mouse" || on) return;
                    setActive(layer.id);
                    audio.blip("hover");
                  }}
                >
                  <span className={styles.idx}>{String(i + 1).padStart(2, "0")}</span>
                  <LayerGlyph id={layer.id} className={styles.glyph} />
                  <span className={styles.titles}>
                    <span className={styles.title}>{layer.title}</span>
                    <span className={styles.role}>
                      {device ? "A device, not a being" : layer.role}
                    </span>
                  </span>
                  <span className={styles.chev} aria-hidden="true" />
                </button>

                <div
                  id={`layer-detail-${layer.id}`}
                  role="region"
                  aria-labelledby={`layer-${layer.id}`}
                  className={styles.detail}
                >
                  <div className={styles.detailInner}>
                    <p className={`${styles.kicker} hud-label`}>
                      {device
                        ? "Device / not a being"
                        : `Layer ${i + 1} of ${hierarchy.length} / ${layer.role}`}
                    </p>
                    <h3 className={`${styles.dTitle} display`}>{layer.title}</h3>
                    <p className={styles.text}>{layer.text}</p>
                    {layer.kinds && (
                      <ul className={styles.kinds}>
                        {layer.kinds.map((k) => (
                          <li key={k.name} className={styles.kind}>
                            <span className={styles.kindName}>{k.name}</span>
                            <span className={styles.kindText}>{k.text}</span>
                            <ChapterLink id={k.chapterId} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {layer.note && <p className={styles.note}>{layer.note}</p>}
                    <ChapterLinks ids={layer.chapterIds} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </ThemeZone>
  );
}
