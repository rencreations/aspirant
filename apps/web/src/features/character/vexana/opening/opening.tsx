"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { expectReady } from "@/lib/page-ready";
import { onPerfLevel, perfLevel } from "@/lib/perf";

import { FIGURES, videoFile, videoPoster } from "../media";
import { BACKGROUNDS, type BackgroundId } from "./backgrounds/registry";
import { BackgroundPicker } from "./bg-picker";
import { useBackground } from "./bg-store";
import { MARQUEE, STATEMENT, STATEMENT_PLAIN, type Part } from "./copy";
import type { FigureGL } from "./figure-gl";
import { easeOut, faceOf, openingState, seg, type Measure } from "./opening-math";
import styles from "./opening.module.css";
import { SignatureSvg } from "./signature";
import { useSignature } from "./use-signature";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const TOKENS = {
  "--vx-primary": "#7a4fd6",
  "--vx-pink": "#ff6ac8",
  "--vx-lav": "#b89cff",
  "--vx-ink": "#140e26",
  "--vx-paper": "#f8f5fc",
  "--vx-bone": "#efe9ff",
} as CSSProperties;

interface Props {
  /** The background to start on. Visitors can change it, and the choice is remembered. */
  background?: BackgroundId;
}

/** Writes a style only when it changed, so a scroll frame touches only what moved. */
const written = new WeakMap<HTMLElement, Record<string, string>>();
function put(el: HTMLElement | null, prop: "transform" | "opacity" | "visibility", v: string) {
  if (!el) return;
  const seen = written.get(el) ?? {};
  if (seen[prop] === v) return;
  seen[prop] = v;
  written.set(el, seen);
  el.style[prop] = v;
}

function Words({ parts }: { parts: readonly Part[] }) {
  return parts.map((p, i) =>
    p.mark ? (
      <em key={i} className={styles.mark}>
        {p.text}
      </em>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  );
}

function HeroFigures({ ender }: { ender: boolean }) {
  return (
    <div className={styles.dFigure} data-ender={ender}>
      {/* Plain <img>: static export. The scene replaces these when it is up. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.dNormal} src={asset(FIGURES.normalFront)} alt="" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.dEnder} src={asset(FIGURES.enderFront)} alt="" draggable={false} />
    </div>
  );
}

function NameCard({ ender }: { ender: boolean }) {
  return (
    <div className={styles.nameCard}>
      <span className={styles.eyebrow}>Aspirant of Selrick Academy</span>
      <h1 className={styles.name}>
        Vexana
        <small>Twilight Star</small>
      </h1>
      <span className={styles.form} aria-hidden="true">
        <i className={styles.formDot} data-ender={ender} />
        Form {ender ? "02" : "01"}
        <b>{ender ? "Ender" : "Normal"}</b>
      </span>
    </div>
  );
}

function Statement({ setLine }: { setLine?: (i: number) => (el: HTMLElement | null) => void }) {
  return (
    <div className={styles.statement}>
      <p className={styles.srOnly}>{STATEMENT_PLAIN}</p>
      <div aria-hidden="true">
        {STATEMENT.map((parts, i) => (
          <span key={i} className={styles.line}>
            <span ref={setLine?.(i)} className={styles.lineIn}>
              <Words parts={parts} />
              {i === STATEMENT.length - 1 ? <i className={styles.caret} /> : null}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MarqueeRows({ setRow }: { setRow?: (i: number) => (el: HTMLElement | null) => void }) {
  return (
    <div className={styles.marquee} aria-hidden="true">
      {MARQUEE.map((parts, i) => (
        <div key={i} ref={setRow?.(i)} className={styles.row}>
          {[0, 1, 2].map((n) => (
            <span key={n} className={styles.rowItem}>
              <Words parts={parts} />
              <StarGlyph className={styles.rowStar} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The opening of Vexana's page: the hero (her normal form, with the Ender form coming through),
 * the hand-over (the screen closes into a card and the page goes dark), and the signature with
 * her message. One tall track holds a sticky screen; the scroll position drives everything with
 * transforms and opacity only. See `opening-math.ts` for the timeline.
 *
 * With reduced motion the same pieces are laid out in a plain column, nothing pinned.
 */
export function Opening({ background }: Props) {
  const reduced = useReducedMotion();
  const [bg, chooseBackground] = useBackground(background);
  const [ender, setEnder] = useState(false);
  const [gl, setGl] = useState(false);
  const [lite, setLite] = useState(false);

  const glRef = useRef<FigureGL | null>(null);
  const bgRef = useRef(bg);
  const toneRef = useRef(0);
  const activeRef = useRef(true);

  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const glHostRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const domDarkRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const rows = useRef<Array<HTMLElement | null>>([]);
  const lines = useRef<Array<HTMLElement | null>>([]);
  const statementRef = useRef<HTMLDivElement>(null);
  const signature = useSignature();

  const setRow = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      rows.current[i] = el;
    },
    [],
  );
  const setLine = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      lines.current[i] = el;
    },
    [],
  );

  useEffect(() => {
    bgRef.current = bg;
    glRef.current?.setBackground(bg);
  }, [bg]);

  // A device that falls to the lowest level drops the scene and keeps the flat version.
  useEffect(
    () =>
      onPerfLevel((level) => {
        if (level === "lite") setLite(true);
      }),
    [],
  );

  // The scene. Built after mount, from a canvas made here (a lost context cannot be reused).
  useEffect(() => {
    const host = glHostRef.current;
    if (reduced || lite || !host) return;
    const level = perfLevel();
    if (level === "lite") return;
    const mark = expectReady("opening");
    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas ?? "";
    host.appendChild(canvas);
    let cancelled = false;
    let scene: FigureGL | null = null;
    void (async () => {
      try {
        const { createFigureGL } = await import("./figure-gl");
        const made = await createFigureGL(canvas, {
          normalUrl: asset(FIGURES.normalFront),
          enderUrl: asset(FIGURES.enderFront),
          background: bgRef.current,
          quality: level === "full" ? "full" : "balanced",
        });
        if (cancelled) {
          made.dispose();
          return;
        }
        scene = made;
        glRef.current = made;
        made.onForm(setEnder);
        made.setTone(toneRef.current);
        made.setActive(activeRef.current);
        setGl(true);
      } catch {
        // No WebGL, or the pictures failed: the flat version stays.
      } finally {
        mark();
      }
    })();
    return () => {
      cancelled = true;
      mark();
      glRef.current = null;
      setGl(false);
      scene?.dispose();
      canvas.remove();
    };
  }, [reduced, lite]);

  // The flat version moves too: the Ender form shows while the pointer is on the hero, and now
  // and then by itself.
  const [flatEnder, setFlatEnder] = useState(false);
  useEffect(() => {
    if (gl || reduced) return;
    let timer = 0;
    let off = 0;
    const loop = () => {
      setFlatEnder(true);
      off = window.setTimeout(() => {
        setFlatEnder(false);
      }, 1800);
      timer = window.setTimeout(loop, 6500);
    };
    timer = window.setTimeout(loop, 3000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(off);
    };
  }, [gl, reduced]);
  const shownEnder = gl ? ender : flatEnder;

  // The scroll: one trigger over the whole track.
  useEffect(() => {
    const track = trackRef.current;
    const pin = pinRef.current;
    const card = cardRef.current;
    if (reduced || !track || !pin || !card) return;
    const measure: Measure = { vw: 1, vh: 1, cardW: 1, cardH: 1 };
    let signed = false;
    let videoSrc = false;
    let progress = 0;

    const read = () => {
      measure.vw = pin.clientWidth;
      measure.vh = pin.clientHeight;
      measure.cardW = card.offsetWidth;
      measure.cardH = card.offsetHeight;
      const face = faceOf(measure.vw, measure.vh);
      if (innerRef.current) {
        innerRef.current.style.transformOrigin = `${face.x * 100}% ${face.y * 100}%`;
      }
    };

    const apply = (p: number) => {
      progress = p;
      const s = openingState(p, measure);
      put(frameRef.current, "transform", `scale(${s.frameSx},${s.frameSy})`);
      put(frameRef.current, "opacity", String(s.frameOpacity));
      put(frameRef.current, "visibility", s.frameOpacity < 0.01 ? "hidden" : "visible");
      put(
        innerRef.current,
        "transform",
        `translate(${s.innerTx}px,${s.innerTy}px) scale(${s.innerSx},${s.innerSy})`,
      );
      put(tintRef.current, "opacity", String(Math.min(1, s.tone * 1.4)));
      put(domDarkRef.current, "opacity", String(s.tone));
      put(uiRef.current, "opacity", String(s.uiOpacity));
      put(uiRef.current, "visibility", s.uiOpacity < 0.02 ? "hidden" : "visible");

      put(cardRef.current, "opacity", String(s.cardOpacity));
      put(cardRef.current, "visibility", s.cardOpacity < 0.01 ? "hidden" : "visible");
      put(labelRef.current, "opacity", String(s.cardOpacity));
      put(marqueeRef.current, "opacity", String(s.marqueeOpacity));
      put(marqueeRef.current, "visibility", s.marqueeOpacity < 0.01 ? "hidden" : "visible");
      rows.current.forEach((row, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        const x = (0.45 - s.marqueeT * 1.55) * measure.vw * dir - (dir < 0 ? measure.vw * 0.3 : 0);
        put(row, "transform", `translate3d(${x}px,0,0)`);
      });

      const visible = s.statement > 0.001;
      put(statementRef.current, "visibility", visible ? "visible" : "hidden");
      lines.current.forEach((line, i) => {
        const t = easeOut(seg(s.statement, i * 0.12, i * 0.12 + 0.32));
        put(line, "transform", `translate3d(0,${(1 - t) * 112}%,0)`);
      });

      toneRef.current = s.tone;
      activeRef.current = s.glActive;
      glRef.current?.setTone(s.tone);
      glRef.current?.setActive(s.glActive);

      const video = videoRef.current;
      if (video) {
        if (!videoSrc && p > 0.1) {
          videoSrc = true;
          video.src = asset(videoFile("splash-short"));
        }
        if (s.videoOn && video.paused && videoSrc) void video.play().catch(() => undefined);
        else if (!s.videoOn && !video.paused) video.pause();
      }

      if (s.signed && !signed) {
        signed = true;
        signature.play();
      } else if (!s.signed && signed && p < 0.34) {
        signed = false;
        signature.reset();
      }
    };

    const trigger = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        apply(self.progress);
      },
      onRefresh: (self) => {
        read();
        apply(self.progress);
      },
    });
    read();
    apply(trigger.progress);
    const onResize = () => {
      read();
      apply(progress);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
      signature.reset();
    };
  }, [reduced, signature]);

  const backgroundCss = BACKGROUNDS[bg].css;
  const flat = (
    <>
      <div className={styles.dBg} style={{ background: backgroundCss.light }} />
      <div
        ref={domDarkRef}
        className={styles.dBg}
        style={{ background: backgroundCss.dark, opacity: 0 }}
      />
      <HeroFigures ender={shownEnder} />
    </>
  );

  if (reduced) {
    return (
      <section id="opening" className={styles.opening} style={TOKENS} data-static="true">
        <div className={styles.staticHero}>
          <div className={styles.dBg} style={{ background: backgroundCss.light }} />
          <div
            className={styles.staticFigure}
            onPointerEnter={() => {
              setEnder(true);
            }}
            onPointerLeave={() => {
              setEnder(false);
            }}
          >
            <HeroFigures ender={ender} />
          </div>
          <NameCard ender={ender} />
          <BackgroundPicker value={bg} onChange={chooseBackground} />
        </div>
        <div className={styles.staticSign}>
          <p className={styles.label}>
            <StarGlyph className={styles.labelStar} /> A message from Sana
          </p>
          <div className={styles.staticCard}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(videoPoster("splash-short"))} alt="" />
            <SignatureSvg done />
          </div>
          <Statement />
        </div>
      </section>
    );
  }

  return (
    <section id="opening" className={styles.opening} style={TOKENS}>
      <div ref={trackRef} className={styles.track}>
        <div ref={pinRef} className={styles.pin}>
          <div ref={tintRef} className={styles.tint} />

          <div ref={marqueeRef} className={styles.marqueeWrap}>
            <MarqueeRows setRow={setRow} />
          </div>

          <div ref={frameRef} className={styles.frame}>
            <div ref={innerRef} className={styles.inner} data-gl={gl}>
              <div className={styles.flat}>{flat}</div>
              <div ref={glHostRef} className={styles.glHost} data-on={gl} />
            </div>
          </div>

          <div ref={cardRef} className={styles.card}>
            <video
              ref={videoRef}
              className={styles.cardVideo}
              poster={asset(videoPoster("splash-short"))}
              muted
              loop
              playsInline
              preload="none"
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className={styles.cardShade} />
          </div>
          <div ref={labelRef} className={styles.labelWrap}>
            <p className={styles.label}>
              <StarGlyph className={styles.labelStar} /> A message from Sana
            </p>
            <div className={styles.signWrap}>
              <SignatureSvg setStroke={signature.set} />
            </div>
          </div>

          <div ref={statementRef} className={styles.statementWrap}>
            <Statement setLine={setLine} />
          </div>

          <div ref={uiRef} className={styles.ui}>
            <NameCard ender={shownEnder} />
            <div className={styles.jp} aria-hidden="true">
              <StarGlyph className={styles.jpStar} />
              <span lang="ja">サナ</span>
            </div>
            <div className={styles.cue} aria-hidden="true">
              <span>Scroll</span>
              <i />
            </div>
            <BackgroundPicker value={bg} onChange={chooseBackground} />
          </div>
        </div>
      </div>
    </section>
  );
}
