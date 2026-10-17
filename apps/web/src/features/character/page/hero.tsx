"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

import { Waveform } from "@/components/audio/waveform";
import { EmberField } from "@/components/ember-field";
import { FRAME_CLIP_PATHS, FRAME_SHAPES, type FrameShape } from "@/components/frame/frame-shapes";
import { ScatterText } from "@/components/text/scatter-text";
import { HudPanel } from "@/components/ui/hud-panel";
import { StarButton } from "@/components/ui/star-button";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import {
  prefersReducedMotion,
  useInView,
  usePointer,
  useReducedMotion,
  useVoiceState,
} from "@/lib/hooks";

import type { ArtImage, FormArt, SignatureKind } from "../art";
import styles from "./hero.module.css";
import { createSignature, type SignatureFx } from "./signature";

interface HeroLine {
  readonly src: string;
  readonly n: number;
  readonly jp: string;
  readonly en: string;
}

interface HeroForms {
  readonly normal: { readonly text: string; readonly art: FormArt };
  readonly ender: { readonly text: string; readonly art: FormArt };
}

export interface HeroProps {
  readonly name: string;
  readonly aspirantName: string;
  readonly jp: { readonly script: string; readonly romaji: string | null };
  readonly tagline: string;
  readonly unit: string;
  readonly groupLabel: string;
  readonly side: "daybreak" | "storm";
  readonly splash: ArtImage;
  readonly cutout: ArtImage | null;
  readonly cutoutAligned: boolean;
  readonly focus: { readonly x: number; readonly y: number };
  readonly shape: FrameShape;
  readonly signature: SignatureKind;
  readonly signatureLabel: string;
  readonly colours: { readonly lead: string; readonly second: string; readonly glow: string };
  readonly line: HeroLine | null;
  readonly forms: HeroForms | null;
  /** The HUD stat block, rendered on the server. */
  readonly stats: ReactNode;
}

type Form = "normal" | "ender";

/** Wrap a line in curly quotes, unless it already opens with a quotation of its own. */
function quoted(text: string): string {
  return /^["“']/.test(text) ? text : `“${text}”`;
}

/**
 * The frame shape drawn inside margins of the box (percent). The splash is clipped to it
 * while the aligned cut-out keeps the full box, so the figure spills over the frame.
 */
function insetShape(shape: FrameShape, mx: number, my: number): string {
  const coord = (p: number, o: number, m: number) => {
    const pct = (m + (p * (100 - 2 * m)) / 100).toFixed(3);
    return o ? `calc(${pct}% ${o < 0 ? "-" : "+"} ${Math.abs(o)}px)` : `${pct}%`;
  };
  const points = FRAME_SHAPES[shape].map(
    ([xp, xo, yp, yo]) => `${coord(xp, xo, mx)} ${coord(yp, yo, my)}`,
  );
  return `polygon(${points.join(", ")})`;
}

/**
 * Character hero: a blurred backdrop, the splash in a custom frame, the cut-out (or a detail
 * lens on the splash when no cut-out exists) floating over it with pointer parallax, embers
 * in the palette and the character's signature effect. Huge name, Aspirant name, Japanese
 * name, tagline, the signature voice line with a live waveform, and for Vexana, Selena and
 * Obsidia a form toggle. Reduced motion: no parallax, effects or particles.
 */
export function Hero(props: HeroProps) {
  const {
    name,
    aspirantName,
    jp,
    tagline,
    unit,
    groupLabel,
    side,
    splash,
    cutout,
    cutoutAligned,
    focus,
    shape,
    signature,
    signatureLabel,
    colours,
    line,
    forms,
    stats,
  } = props;
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<SignatureFx | null>(null);
  const loop = useRef({ raf: 0, last: 0 });
  const reduced = useReducedMotion();
  const inView = useInView(rootRef, { rootMargin: "80px" });
  const { subscribe } = usePointer();
  const voice = useVoiceState();
  const [form, setForm] = useState<Form>("normal");
  const titleId = useId();
  const lineSrc = line ? asset(line.src) : "";
  const playing = voice.playing && voice.url === lineSrc;

  // Pointer parallax: one CSS variable pair, written only while the shared pointer moves.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced || !inView) return;
    return subscribe((p) => {
      root.style.setProperty("--px", p.x.toFixed(4));
      root.style.setProperty("--py", p.y.toFixed(4));
    });
  }, [subscribe, reduced, inView]);

  // The signature canvas: created once per mount, sized with the hero, drawn on demand.
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !root || !ctx || reduced) return;
    const fx = createSignature(signature, ctx, colours, side === "daybreak");
    fxRef.current = fx;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      fx.resize(w, h, dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const l = loop.current;
    return () => {
      ro.disconnect();
      cancelAnimationFrame(l.raf);
      l.raf = 0;
      fxRef.current = null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [signature, colours, side, reduced]);

  useEffect(() => {
    if (!inView) {
      cancelAnimationFrame(loop.current.raf);
      loop.current.raf = 0;
    }
  }, [inView]);

  const wake = () => {
    const l = loop.current;
    if (l.raf || !fxRef.current || document.hidden) return;
    l.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - l.last) / 1000);
      l.last = now;
      const busy = fxRef.current?.step(dt, now / 1000) ?? false;
      l.raf = busy ? requestAnimationFrame(frame) : 0;
    };
    l.raf = requestAnimationFrame(frame);
  };

  const local = (e: PointerEvent<HTMLElement>) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
  };

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const fx = fxRef.current;
    const p = local(e);
    if (!fx || !p) return;
    fx.move(p.x, p.y);
    wake();
  };

  const onDown = (e: PointerEvent<HTMLElement>) => {
    const fx = fxRef.current;
    const p = local(e);
    if (!fx || !p) return;
    if ((e.target as HTMLElement).closest("a, button, [role='group']")) return;
    fx.move(p.x, p.y);
    fx.fire(p.x, p.y);
    wake();
  };

  /** Fire the effect at the art (keyboard and button equivalent of a click). */
  const fireAtArt = () => {
    const fx = fxRef.current;
    const canvas = canvasRef.current;
    if (!fx || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const x = w * (w > 1100 ? 0.68 : 0.55);
    const y = h * (w > 1100 ? 0.42 : 0.3);
    fx.move(x, y);
    fx.fire(x, y);
    wake();
    window.setTimeout(() => fx.leave(), 900);
  };

  const play = () => {
    if (!line) return;
    audio.unlock();
    if (playing) {
      audio.stopVoice();
      return;
    }
    void audio.playVoice(lineSrc);
    fireAtArt();
  };

  const choose = (next: Form) => {
    if (next === form) return;
    audio.blip(next === "ender" ? "whoosh" : "star");
    setForm(next);
    if (next === "ender" && !prefersReducedMotion()) fireAtArt();
  };

  const style = {
    "--len": Math.max(4, name.length),
    "--focus-x": `${focus.x}%`,
    "--focus-y": `${focus.y}%`,
    "--shape": FRAME_CLIP_PATHS[shape],
    ...(cutout && cutoutAligned ? { "--inset-shape": insetShape(shape, 6, 9) } : {}),
  } as CSSProperties;

  const embers: [string, string] =
    form === "ender" ? [colours.second, colours.glow] : [colours.lead, colours.glow];
  const current = forms ? forms[form] : null;

  return (
    <section
      ref={rootRef}
      className={styles.hero}
      aria-labelledby={titleId}
      data-form={form}
      data-cutout={cutout ? (cutoutAligned ? "aligned" : "figure") : "none"}
      style={style}
      onPointerMove={onMove}
      onPointerDown={onDown}
      onPointerLeave={() => fxRef.current?.leave()}
    >
      <div className={styles.backdrop} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(`${splash.src.replace("splash.webp", "splash-sm.webp")}`)} alt="" />
      </div>
      <div className={`${styles.grid} grid-hex fade-edges`} aria-hidden="true" />
      <EmberField contained colors={embers} density={0.55} className={styles.embers} />

      <div className={styles.stage}>
        <div className={styles.echo} aria-hidden="true" />
        <div className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.splash}
            src={asset(splash.src)}
            alt={splash.alt}
            width={splash.width}
            height={splash.height}
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
          <span className={styles.frameShade} aria-hidden="true" />
        </div>
        {cutout ? (
          // The cut-out repeats the splash figure; the splash carries the description.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.cutout}
            src={asset(cutout.src)}
            alt=""
            width={cutout.width}
            height={cutout.height}
            decoding="async"
            draggable={false}
            aria-hidden="true"
          />
        ) : (
          <div className={styles.lens} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(splash.src)} alt="" decoding="async" draggable={false} />
            <span className={styles.lensRing} />
          </div>
        )}
        <p className={styles.figLabel} aria-hidden="true">
          <span>Fig. {unit}</span>
          <span>{signatureLabel}</span>
        </p>
      </div>

      <canvas ref={canvasRef} className={styles.fx} aria-hidden="true" />

      <div className={`${styles.content} shell`}>
        <p className={`${styles.eyebrow} hud-label`}>
          <span>Unit {unit} / 10</span>
          <span aria-hidden="true" className={styles.dot} />
          <span>{groupLabel}</span>
        </p>
        <h1 id={titleId} className={styles.name}>
          <ScatterText text={name} radius={120} strength={1.1} />
        </h1>
        <div className={styles.ids}>
          <p className={styles.aspirant}>
            <span className="hud-label">Aspirant name</span>
            <span className={styles.aspirantValue}>{aspirantName}</span>
          </p>
          <p className={styles.jp}>
            <span className="hud-label">Japanese name</span>
            <span className={styles.jpValue}>
              <span lang="ja">{jp.script}</span>
              {jp.romaji && <span className={styles.romaji}>{jp.romaji}</span>}
            </span>
          </p>
        </div>
        <p className={styles.tagline}>{tagline}</p>

        {line && (
          <div className={styles.voice}>
            <StarButton
              emblem
              size="lg"
              aria-label={`${playing ? "Stop" : "Play"} her signature line: ${line.en}`}
              aria-pressed={playing}
              blip={false}
              onClick={play}
              data-cursor={playing ? "STOP" : "PLAY"}
            />
            <div className={styles.voiceText}>
              <p className={styles.voiceMeta}>
                <span className="hud-label">Voice {String(line.n).padStart(2, "0")}</span>
                <Waveform url={lineSrc} bars={36} className={styles.wave} />
              </p>
              <p className={styles.voiceEn}>{quoted(line.en)}</p>
              <p className={styles.voiceJp} lang="ja">
                {line.jp}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={`${styles.dock} shell`} data-forms={forms ? "" : undefined}>
        <div className={styles.stats}>{stats}</div>
        {forms && current && (
          <HudPanel
            tone="glass"
            label="Form"
            code={form === "ender" ? "Ender form" : "Normal form"}
            className={styles.formPanel}
            bodyClassName={styles.formBody}
          >
            <div role="group" aria-label={`${name}'s form`} className={styles.formToggle}>
              <button
                type="button"
                aria-pressed={form === "normal"}
                onClick={() => choose("normal")}
                className={styles.formButton}
              >
                Normal form
              </button>
              <button
                type="button"
                aria-pressed={form === "ender"}
                onClick={() => choose("ender")}
                className={styles.formButton}
                data-ender=""
              >
                Ender form
              </button>
            </div>
            <div className={styles.formView} key={form}>
              <figure className={styles.formFigure} data-empty={current.art.image === null}>
                {current.art.image ? (
                  <span className={styles.formArt}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset(current.art.image.src)}
                      alt={current.art.image.alt}
                      width={current.art.image.width}
                      height={current.art.image.height}
                      style={{
                        objectPosition: current.art.position,
                        ...(current.art.zoom ? { scale: String(current.art.zoom) } : {}),
                      }}
                      decoding="async"
                    />
                  </span>
                ) : (
                  <span className={styles.formEmpty} aria-hidden="true">
                    No art on file
                  </span>
                )}
                <figcaption className={styles.formSource}>{current.art.source}</figcaption>
              </figure>
              <p className={styles.formText}>{current.text}</p>
            </div>
          </HudPanel>
        )}
      </div>
    </section>
  );
}
