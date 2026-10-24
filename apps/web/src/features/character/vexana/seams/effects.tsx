"use client";

import { useMemo, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { easeInOut, easeOut, lerp, put, seg, toStage, useSeam, type SeamTier } from "./seam-kit";
import styles from "./seams.module.css";

/** The anchor and its stage. The effect's own elements are only built when the seam runs. */
function Shell({
  anchor,
  tier,
  children,
}: {
  anchor: RefObject<HTMLDivElement | null>;
  tier: SeamTier;
  children: ReactNode;
}) {
  return (
    <div ref={anchor} className={styles.anchor} aria-hidden="true">
      <div className={styles.stage}>{tier === "off" ? null : children}</div>
    </div>
  );
}

const FILL: CSSProperties = { position: "absolute", inset: 0 };

/** A small seeded random, so every effect looks the same on every visit and in every render. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------------------------------------
 * About to the film: a light iris opens from the join and floods the screen.
 * ---------------------------------------------------------------------------------------------- */
export function Iris() {
  const disc = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q, f) => {
    const k = (2 * Math.hypot(f.vw / 2, f.vh * 0.85)) / 800;
    const s = easeInOut(seg(q, 0.02, 0.5)) * k;
    put(disc.current, "transform", `scale(${s})`);
    put(disc.current, "opacity", String(1 - seg(q, 0.56, 0.76)));
    put(ring.current, "transform", `scale(${s * 1.012})`);
    put(ring.current, "opacity", String(1 - seg(q, 0.4, 0.5)));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={ring} className={styles.ring} />
      <div ref={disc} className={styles.disc} />
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The film to the craft: shutter blinds close one after another, in the colour of the craft.
 * ---------------------------------------------------------------------------------------------- */
export function Blinds() {
  const bars = useRef<Array<HTMLDivElement | null>>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q) => {
    const n = bars.current.length;
    bars.current.forEach((bar, i) => {
      const start = (0.24 / (n - 1)) * i;
      const t = easeOut(seg(q, start, start + 0.26));
      put(bar, "transform", `scaleY(${t * 1.06})`);
    });
    put(wrap.current, "opacity", String(1 - seg(q, 0.56, 0.76)));
  });
  const n = tier === "balanced" ? 5 : 9;
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={wrap} style={FILL}>
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              bars.current[i] = el;
            }}
            className={styles.slat}
            style={{
              top: `${(i * 100) / n}%`,
              height: `calc(${100 / n}% + 1px)`,
              transform: "scaleY(0)",
            }}
          />
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The craft to the pair: a violet slab and a pale slab sweep across at a slant, then leave.
 * ---------------------------------------------------------------------------------------------- */
export function Slab() {
  const violet = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q) => {
    const inA = easeInOut(seg(q, 0, 0.46));
    const inB = easeInOut(seg(q, 0.07, 0.5));
    const outB = easeInOut(seg(q, 0.52, 0.74));
    const outA = easeInOut(seg(q, 0.58, 0.82));
    put(violet.current, "transform", `translateX(${-100 + 100 * inA + 100 * outA}%) skewX(-14deg)`);
    put(light.current, "transform", `translateX(${-100 + 100 * inB + 100 * outB}%) skewX(-14deg)`);
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={violet} className={`${styles.slab} ${styles.slabViolet}`} />
      <div ref={light} className={`${styles.slab} ${styles.slabLight}`} />
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The interlude to the comic: two curtains in the comic's own colours close, then open.
 * ---------------------------------------------------------------------------------------------- */
export function Curtain() {
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q) => {
    const close = easeInOut(seg(q, 0, 0.46));
    const open = easeInOut(seg(q, 0.56, 0.84));
    const x = (1 - close) * 100 + open * 100;
    put(left.current, "transform", `translateX(${-x}%)`);
    put(right.current, "transform", `translateX(${x}%)`);
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div
        ref={left}
        className={`${styles.drape} ${styles.drapeL}`}
        style={{ transform: "translateX(-100%)" }}
      />
      <div
        ref={right}
        className={`${styles.drape} ${styles.drapeR}`}
        style={{ transform: "translateX(100%)" }}
      />
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The comic to the stream: the screen fills with static, then switches off to a line, like a set.
 * ---------------------------------------------------------------------------------------------- */
export function Crt() {
  const veil = useRef<HTMLDivElement>(null);
  const scan = useRef<HTMLDivElement>(null);
  const beam = useRef<HTMLDivElement>(null);
  const splitA = useRef<HTMLDivElement>(null);
  const splitB = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q) => {
    const on = easeOut(seg(q, 0.02, 0.4));
    const shake = seg(q, 0.08, 0.46) * (1 - seg(q, 0.46, 0.52));
    const jit = (Math.sin(q * 173) * 5 + Math.sin(q * 61) * 3) * shake;
    const squash = 1 - 0.992 * easeInOut(seg(q, 0.46, 0.6));
    put(veil.current, "opacity", String(on));
    put(veil.current, "transform", `translateX(${jit}px) scaleY(${squash})`);
    put(scan.current, "opacity", String(on * (1 - seg(q, 0.46, 0.54))));
    put(scan.current, "transform", `translateX(${jit}px)`);
    put(beam.current, "opacity", String(seg(q, 0.5, 0.56) * (1 - seg(q, 0.66, 0.74))));
    put(beam.current, "transform", `scaleX(${1 - easeOut(seg(q, 0.6, 0.74))})`);
    const bars = on * (1 - seg(q, 0.4, 0.5));
    put(splitA.current, "opacity", String(bars));
    put(splitA.current, "transform", `translateX(${Math.sin(q * 90) * 40}px)`);
    put(splitB.current, "opacity", String(bars));
    put(splitB.current, "transform", `translateX(${Math.sin(q * 70 + 2) * -50}px)`);
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={veil} className={styles.veil} style={{ opacity: 0 }} />
      <div ref={scan} className={styles.scan} style={{ opacity: 0 }} />
      <div ref={splitA} className={`${styles.split} ${styles.splitA}`} style={{ opacity: 0 }} />
      <div ref={splitB} className={`${styles.split} ${styles.splitB}`} style={{ opacity: 0 }} />
      <div ref={beam} className={styles.beam} />
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The stream to the game: the screen turns to big pixels, cell by cell, and breaks up again.
 * ---------------------------------------------------------------------------------------------- */
const rgba = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const PALETTE = [
  ...Array.from({ length: 12 }, () => rgba(18, 8, 31)),
  rgba(30, 18, 64),
  rgba(30, 18, 64),
  rgba(42, 26, 92),
  rgba(224, 64, 160),
  rgba(41, 211, 255),
];

interface Cells {
  cols: number;
  rows: number;
  noise: Float32Array;
  colour: Uint32Array;
  image: ImageData;
}

export function Pixels() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cells = useRef<Cells | null>(null);
  const { anchor, tier } = useSeam((q, f) => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const size = Number(cv.dataset.cell) || 36;
    const cols = Math.ceil(f.vw / size);
    const rows = Math.ceil(f.sh / size);
    let c = cells.current;
    if (c?.cols !== cols || c.rows !== rows) {
      const rnd = seeded(20241024);
      const total = cols * rows;
      const noise = new Float32Array(total);
      const colour = new Uint32Array(total);
      for (let i = 0; i < total; i += 1) {
        const x = i % cols;
        const y = Math.floor(i / cols);
        noise[i] = 0.62 * rnd() + 0.38 * ((x / cols + y / rows) / 2);
        colour[i] = PALETTE[Math.floor(rnd() * PALETTE.length)] ?? PALETTE[0]!;
      }
      cv.width = cols;
      cv.height = rows;
      c = { cols, rows, noise, colour, image: ctx.createImageData(cols, rows) };
      cells.current = c;
    }
    const tin = easeInOut(seg(q, 0, 0.5));
    const tout = easeInOut(seg(q, 0.52, 0.86));
    const px = new Uint32Array(c.image.data.buffer);
    for (let i = 0; i < px.length; i += 1) {
      const n = c.noise[i] ?? 0;
      px[i] = n < tin && n >= tout ? (c.colour[i] ?? 0) : 0;
    }
    ctx.putImageData(c.image, 0, 0);
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <canvas ref={canvas} className={styles.pixels} data-cell={tier === "balanced" ? 72 : 36} />
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The game to the 3D work: a laser scans a modeller's grid down over the screen, and back.
 * ---------------------------------------------------------------------------------------------- */
export function Scan() {
  const veil = useRef<HTMLDivElement>(null);
  const laser = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const { anchor, tier } = useSeam((q, f) => {
    const s = easeInOut(seg(q, 0, 0.5));
    put(veil.current, "transform", `scaleY(${s})`);
    put(veil.current, "opacity", String(1 - seg(q, 0.56, 0.8)));
    const second = easeInOut(seg(q, 0.52, 0.8));
    const y = q < 0.5 ? s * f.sh : second * f.sh;
    const a = seg(q, 0, 0.04) * (1 - seg(q, 0.46, 0.5));
    const b = seg(q, 0.52, 0.55) * (1 - seg(q, 0.76, 0.8));
    const o = Math.max(a, b);
    put(laser.current, "transform", `translateY(${y}px)`);
    put(laser.current, "opacity", String(o));
    put(tag.current, "transform", `translateY(${y + 12}px)`);
    put(tag.current, "opacity", String(o * 0.85));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={veil} className={styles.gridVeil} style={{ transform: "scaleY(0)" }} />
      <div ref={laser} className={styles.laser} style={{ opacity: 0 }} />
      <span ref={tag} className={styles.tag} style={{ opacity: 0 }}>
        Viewport 01 · perspective
      </span>
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The 3D work to Guinevere: a heart beats twice and swells until its cream fills the screen.
 * ---------------------------------------------------------------------------------------------- */
const HEART =
  "M50 88C20 62 2 44 2 26 2 11 14 2 27 2c10 0 18 6 23 14 5-8 13-14 23-14 13 0 25 9 25 24 0 18-18 36-48 62Z";

export function Heart() {
  const group = useRef<HTMLDivElement>(null);
  const outer = useRef<SVGSVGElement>(null);
  const inner = useRef<SVGSVGElement>(null);
  const cream = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q, f) => {
    const k = (f.vw * 1.9) / 600;
    const base = easeOut(seg(q, 0.03, 0.5));
    const beat = Math.pow(Math.sin(Math.PI * ((q * 3) % 1)), 10) * (1 - seg(q, 0.35, 0.5));
    const s = k * base * (1 + 0.1 * beat);
    put(outer.current, "transform", `scale(${s})`);
    put(outer.current, "opacity", String(1 - seg(q, 0.34, 0.5)));
    put(inner.current, "transform", `scale(${s * 0.93})`);
    put(cream.current, "opacity", String(seg(q, 0.36, 0.5)));
    put(group.current, "opacity", String(1 - seg(q, 0.56, 0.76)));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={group} style={FILL}>
        <div ref={cream} className={styles.heartCream} style={{ opacity: 0 }} />
        <svg
          ref={outer}
          className={styles.heart}
          viewBox="0 0 100 90"
          style={{ transform: "scale(0)" }}
        >
          <path d={HEART} fill="#ff7aa8" />
        </svg>
        <svg
          ref={inner}
          className={styles.heart}
          viewBox="0 0 100 90"
          style={{ transform: "scale(0)" }}
        >
          <path d={HEART} fill="#fff4e8" />
        </svg>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Guinevere to the art: three tides of dusk ink rise over the cream, each with its own crest.
 * ---------------------------------------------------------------------------------------------- */
const WAVE_PATH = "M0 60Q90 0 180 60T360 60T540 60T720 60T900 60T1080 60T1260 60T1440 60V120H0Z";
const TIDES = ["#34216f", "#1d1240", "#0b0716"] as const;

export function Wave() {
  const layers = useRef<Array<HTMLDivElement | null>>([]);
  const crests = useRef<Array<SVGSVGElement | null>>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q, f) => {
    TIDES.forEach((_, i) => {
      const e = easeInOut(seg(q, i * 0.04, 0.42 + i * 0.04));
      const crestY = f.vh * 1.03 - f.vh * 1.3 * e;
      put(layers.current[i], "transform", `translate3d(0,${toStage(f, crestY)}px,0)`);
      const drift = i % 2 === 0 ? -q * 30 : -50 + q * 30;
      put(crests.current[i], "transform", `translateX(${drift}%)`);
    });
    put(wrap.current, "opacity", String(1 - seg(q, 0.56, 0.76)));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={wrap} style={FILL}>
        {TIDES.map((colour, i) => (
          <div
            key={colour}
            ref={(el) => {
              layers.current[i] = el;
            }}
            className={styles.rise}
            style={{ transform: "translate3d(0,100%,0)" }}
          >
            <svg
              ref={(el) => {
                crests.current[i] = el;
              }}
              className={styles.crest}
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <path d={WAVE_PATH} fill={colour} />
              <path d={WAVE_PATH} fill={colour} transform="translate(1440 0)" />
            </svg>
            <div className={styles.body} style={{ background: colour }} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The art to the fanart: a sheet of paper with a torn top edge, taped, is pulled up over the wall.
 * ---------------------------------------------------------------------------------------------- */
function tearPath(seed: number, lift: number) {
  const rnd = seeded(seed);
  let d = "M0 56";
  for (let x = 0; x <= 1440; x += 18) d += `L${x} ${(14 + rnd() * 24 - lift).toFixed(1)}`;
  return `${d}L1440 56Z`;
}

export function Paper() {
  const sheet = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fibre = useMemo(() => tearPath(7, 6), []);
  const edge = useMemo(() => tearPath(7, 0), []);
  const { anchor, tier } = useSeam((q, f) => {
    const e = easeInOut(seg(q, 0.02, 0.5));
    const crestY = f.vh * 1.03 - f.vh * 1.28 * e;
    put(sheet.current, "transform", `translate3d(0,${toStage(f, crestY)}px,0) rotate(-1.4deg)`);
    put(wrap.current, "opacity", String(1 - seg(q, 0.56, 0.76)));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={wrap} style={FILL}>
        <div ref={sheet} className={styles.paper} style={{ transform: "translate3d(0,100%,0)" }}>
          <svg className={styles.tear} viewBox="0 0 1440 56" preserveAspectRatio="none">
            <path d={fibre} fill="#faf8ff" />
            <path d={edge} fill="#ece6f8" />
          </svg>
          <div className={styles.paperBody} />
          <span className={styles.tape} style={{ left: "18%", transform: "rotate(-6deg)" }} />
          <span className={styles.tape} style={{ left: "71%", transform: "rotate(5deg)" }} />
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The fanart to her theme: evening falls from the top of the screen, with stars and a moon.
 * ---------------------------------------------------------------------------------------------- */
interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

export function Dusk() {
  const sky = useRef<HTMLDivElement>(null);
  const stars = useRef<HTMLDivElement>(null);
  const moon = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const field = useMemo<Star[]>(() => {
    const rnd = seeded(11);
    return Array.from({ length: 34 }, () => ({
      x: rnd() * 100,
      y: rnd() * 70,
      r: 1 + rnd() * 2,
      o: 0.4 + rnd() * 0.6,
    }));
  }, []);
  const { anchor, tier } = useSeam((q, f) => {
    const e = easeInOut(seg(q, 0, 0.5));
    const bottomY = toStage(f, f.vh * (-0.1 + 1.6 * e));
    put(sky.current, "height", `${f.sh}px`);
    put(sky.current, "transform", `translate3d(0,${bottomY - f.sh}px,0)`);
    const show = seg(q, 0.12, 0.4);
    put(stars.current, "opacity", String(show));
    put(stars.current, "transform", `translate3d(0,${-q * 60}px,0)`);
    put(moon.current, "opacity", String(show));
    put(moon.current, "transform", `translate3d(0,${-q * 120}px,0)`);
    put(wrap.current, "opacity", String(1 - seg(q, 0.56, 0.78)));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={wrap} style={FILL}>
        <div ref={sky} className={styles.sky} style={{ transform: "translate3d(0,-100%,0)" }} />
        {tier === "full" ? (
          <>
            <div ref={stars} className={styles.stars}>
              {field.map((s, i) => (
                <span
                  key={i}
                  className={styles.star}
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: s.r,
                    height: s.r,
                    opacity: s.o,
                  }}
                />
              ))}
            </div>
            <svg ref={moon} className={styles.moon} viewBox="0 0 100 100">
              <path d="M62 8A42 42 0 1 0 92 66 34 34 0 0 1 62 8Z" fill="#efe9ff" />
            </svg>
          </>
        ) : null}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Her theme to the next page: a low sun glows on the join, between the dark credit and the day.
 * ---------------------------------------------------------------------------------------------- */
export function Dawn() {
  const sun = useRef<HTMLDivElement>(null);
  const { anchor, tier } = useSeam((q) => {
    const glow = Math.sin(Math.PI * seg(q, 0.04, 0.96));
    put(sun.current, "transform", `scale(${lerp(0.55, 1.45, easeInOut(q))})`);
    put(sun.current, "opacity", String(Math.min(1, glow * 1.15)));
  });
  return (
    <Shell anchor={anchor} tier={tier}>
      <div ref={sun} className={styles.sun} style={{ opacity: 0 }} />
    </Shell>
  );
}
