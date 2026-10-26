"use client";

import { useEffect, useRef } from "react";

import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";
import { CONFIG } from "./config";
import styles from "./hero.module.css";
import { coverPoint, HERO, parsePosition, SPOTS } from "./media";

/** How much the lens magnifies the picture. */
const ZOOM = 2.4;
/** How long a hold must last before her breath is steady. */
const STEADY_MS = 450;
/** The most marks alive at once, so a storm of presses stays cheap. */
const MAX_LIVE = 12;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Lesley's first screen: her splash art with a scope on it. The scope follows the pointer and
 * magnifies what is under it. Hold to steady her breath, let go to fire a thread of blue light
 * from her rifle to the point you aimed at. A quick press is a rushed shot and lands a little
 * wide. By itself the scope drifts to a new point every few seconds and takes a clean shot.
 * Everything that moves is a transform or an opacity.
 */
export function ScopeHero() {
  const c = getCharacter("lesley");
  const cfg = CONFIG.lesley;
  const art = HERO.lesley;
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const scope = useRef<HTMLDivElement>(null);
  const zoom = useRef<HTMLSpanElement>(null);
  const read = useRef<HTMLSpanElement>(null);
  const artWrap = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLElement>(null);
  const shoot = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = root.current;
    const box0 = layer.current;
    const sc = scope.current;
    const zm = zoom.current;
    const rd = read.current;
    if (!el || !box0 || !sc || !zm || !rd) return;
    const posImg = parsePosition(art.position);
    const pic = { w: art.width, h: art.height };
    let w = 1;
    let h = 1;
    let size = 200;
    // The scope's centre, as a share of the box, so a resize keeps it on the same part of the art.
    // It rests on her eye until the first move.
    let at: { x: number; y: number } = { x: 0.5, y: 0.5 };
    let rested = false;
    let lastInput = performance.now();
    let visible = true;
    let frame = 0;
    let holdAt = 0;
    let steadyTimer = 0;
    let shots = 0;
    let lastRead = "";
    let anims: Animation[] = [];
    const live: HTMLElement[] = [];
    const timers = new Set<number>();

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
    };

    const styleAt = (x: number, y: number) => ({
      scope: `translate3d(${x - size / 2}px, ${y - size / 2}px, 0)`,
      zoom: `translate3d(${size / 2 - ZOOM * x}px, ${size / 2 - ZOOM * y}px, 0) scale(${ZOOM})`,
    });

    const stopGlide = () => {
      anims.forEach((a) => {
        a.cancel();
      });
      anims = [];
    };

    const label = (x: number, y: number) => {
      const steady = sc.getAttribute("data-steady") === "true";
      const hold = sc.getAttribute("data-hold") === "true";
      const text = `X ${(x / w).toFixed(2)}  Y ${(y / h).toFixed(2)}  ${steady ? "STEADY" : hold ? "BREATHE" : "READY"}`;
      if (text !== lastRead) {
        lastRead = text;
        rd.textContent = text;
      }
    };

    const place = () => {
      const x = at.x * w;
      const y = at.y * h;
      const s = styleAt(x, y);
      sc.style.transform = s.scope;
      zm.style.transform = s.zoom;
      label(x, y);
    };

    const measure = () => {
      const b = el.getBoundingClientRect();
      w = Math.max(1, b.width);
      h = Math.max(1, b.height);
      size = sc.offsetWidth || 200;
      if (!rested) {
        rested = true;
        const p = coverPoint(SPOTS.eye.x, SPOTS.eye.y, { w, h }, pic, posImg);
        at = { x: p.x / w, y: p.y / h };
      }
      el.style.setProperty("--hw", `${w}px`);
      el.style.setProperty("--hh", `${h}px`);
      stopGlide();
      place();
    };

    const keep = (n: HTMLElement) => {
      live.push(n);
      while (live.length > MAX_LIVE) live.shift()?.remove();
    };

    const muzzle = () => {
      const p = coverPoint(SPOTS.muzzle.x, SPOTS.muzzle.y, { w, h }, pic, posImg);
      return { x: Math.min(w - 10, Math.max(10, p.x)), y: Math.min(h - 10, Math.max(10, p.y)) };
    };

    const fire = (steady: boolean) => {
      const x = at.x * w;
      const y = at.y * h;
      const spread = steady ? 0 : size * 0.1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const tx = x + Math.cos(a) * r;
      const ty = y + Math.sin(a) * r;
      const m = muzzle();
      const dx = tx - m.x;
      const dy = ty - m.y;
      const len = Math.max(24, Math.hypot(dx, dy));
      const base = `translate3d(${m.x}px, ${m.y}px, 0) rotate(${Math.atan2(dy, dx)}rad)`;
      const from = reduced ? 1 : 0;

      const tracer = document.createElement("span");
      tracer.className = styles.tracer ?? "";
      tracer.style.width = `${len}px`;
      tracer.style.transform = `${base} scaleX(${from})`;
      box0.appendChild(tracer);
      keep(tracer);
      const ta = tracer.animate(
        [
          { transform: `${base} scaleX(${from})`, opacity: 1 },
          { transform: `${base} scaleX(1)`, opacity: 1, offset: 0.2 },
          { transform: `${base} scaleX(1)`, opacity: 0 },
        ],
        { duration: 620, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      );
      void ta.finished.then(
        () => {
          tracer.remove();
        },
        () => undefined,
      );

      const flash = document.createElement("span");
      flash.className = styles.flash ?? "";
      flash.style.transform = `translate3d(${m.x}px, ${m.y}px, 0) scale(0.2)`;
      box0.appendChild(flash);
      keep(flash);
      const fa = flash.animate(
        [
          { transform: `translate3d(${m.x}px, ${m.y}px, 0) scale(0.3)`, opacity: 1 },
          { transform: `translate3d(${m.x}px, ${m.y}px, 0) scale(1.3)`, opacity: 0 },
        ],
        { duration: 260, easing: "ease-out" },
      );
      void fa.finished.then(
        () => {
          flash.remove();
        },
        () => undefined,
      );

      const hit = document.createElement("span");
      hit.className = `${styles.hit ?? ""} ${steady ? (styles.hitClean ?? "") : ""}`;
      const pos = `translate3d(${tx}px, ${ty}px, 0)`;
      hit.style.transform = `${pos} scale(0.2)`;
      box0.appendChild(hit);
      keep(hit);
      const ha = hit.animate(
        [
          { transform: `${pos} scale(${reduced ? 1 : 0.2})`, opacity: 1 },
          { transform: `${pos} scale(1)`, opacity: 1, offset: 0.3 },
          { transform: `${pos} scale(1)`, opacity: 1, offset: 0.75 },
          { transform: `${pos} scale(1.15)`, opacity: 0 },
        ],
        { duration: 1900, delay: reduced ? 0 : 120, fill: "backwards" },
      );
      void ha.finished.then(
        () => {
          hit.remove();
        },
        () => undefined,
      );

      shots += 1;
      if (count.current) count.current.textContent = pad(shots % 100);

      if (!reduced && artWrap.current) {
        artWrap.current.animate(
          [
            { transform: "translate3d(0, 0, 0) scale(1.01)" },
            { transform: "translate3d(-0.35%, 0.25%, 0) scale(1.01)", offset: 0.25 },
            { transform: "translate3d(0, 0, 0) scale(1.01)" },
          ],
          { duration: 420, easing: "cubic-bezier(0.3, 0, 0.2, 1)" },
        );
      }
    };

    const setHold = (on: boolean) => {
      window.clearTimeout(steadyTimer);
      sc.setAttribute("data-hold", String(on));
      sc.setAttribute("data-steady", "false");
      if (on) {
        steadyTimer = window.setTimeout(() => {
          sc.setAttribute("data-steady", "true");
          label(at.x * w, at.y * h);
        }, STEADY_MS);
      }
      label(at.x * w, at.y * h);
    };

    const moveTo = (clientX: number, clientY: number) => {
      const b = el.getBoundingClientRect();
      at = {
        x: Math.min(1, Math.max(0, (clientX - b.left) / w)),
        y: Math.min(1, Math.max(0, (clientY - b.top) / h)),
      };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          place();
        });
    };

    const glide = (nx: number, ny: number, ms: number, done: () => void) => {
      stopGlide();
      if (reduced) {
        at = { x: nx, y: ny };
        place();
        done();
        return;
      }
      const a = styleAt(at.x * w, at.y * h);
      const b = styleAt(nx * w, ny * h);
      const opts = {
        duration: ms,
        easing: "cubic-bezier(0.5, 0, 0.2, 1)",
        fill: "forwards",
      } as const;
      const s = sc.animate([{ transform: a.scope }, { transform: b.scope }], opts);
      const z = zm.animate([{ transform: a.zoom }, { transform: b.zoom }], opts);
      anims = [s, z];
      void s.finished.then(
        () => {
          if (anims[0] !== s) return;
          anims.forEach((x) => {
            x.cancel();
          });
          anims = [];
          at = { x: nx, y: ny };
          place();
          done();
        },
        () => undefined,
      );
    };

    const clean = () => {
      setHold(true);
      sc.setAttribute("data-steady", "true");
      later(() => {
        fire(true);
        setHold(false);
      }, 340);
    };

    const randomPoint = () => ({ x: 0.3 + Math.random() * 0.5, y: 0.22 + Math.random() * 0.46 });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      lastInput = performance.now();
      stopGlide();
      moveTo(e.clientX, e.clientY);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      lastInput = performance.now();
      stopGlide();
      moveTo(e.clientX, e.clientY);
      holdAt = performance.now();
      setHold(true);
    };

    const onUp = () => {
      if (!holdAt) return;
      const steady = performance.now() - holdAt >= STEADY_MS;
      holdAt = 0;
      lastInput = performance.now();
      setHold(false);
      fire(steady);
    };

    const onCancel = () => {
      holdAt = 0;
      setHold(false);
    };

    shoot.current = () => {
      lastInput = performance.now();
      const p = randomPoint();
      glide(p.x, p.y, 700, clean);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);

    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? false;
    });
    io.observe(el);

    // By itself: the scope drifts to a new point every few seconds and takes a clean shot.
    const idle = reduced
      ? 0
      : window.setInterval(() => {
          if (!visible || document.hidden || holdAt || performance.now() - lastInput < 3400) return;
          const p = randomPoint();
          glide(p.x, p.y, 1100, clean);
        }, 5600);

    return () => {
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.clearInterval(idle);
      window.clearTimeout(steadyTimer);
      timers.forEach((t) => {
        window.clearTimeout(t);
      });
      if (frame) cancelAnimationFrame(frame);
      stopGlide();
      live.splice(0).forEach((n) => {
        n.remove();
      });
      shoot.current = null;
    };
  }, [reduced, art.height, art.position, art.width]);

  return (
    <section
      ref={root}
      id="top"
      className={styles.hero}
      data-who="lesley"
      data-cursor={cfg.cursor}
      aria-labelledby="lc-name"
    >
      <div ref={artWrap} className={styles.artWrap}>
        {/* Plain <img>: static export, art already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.art}
          src={asset(art.src)}
          alt={art.alt}
          width={art.width}
          height={art.height}
          style={{ objectPosition: art.position }}
          draggable={false}
          fetchPriority="high"
        />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.ticks} aria-hidden="true" />

      <div ref={layer} className={styles.layer} aria-hidden="true">
        <div ref={scope} className={styles.scope} data-hold="false" data-steady="false">
          <span className={styles.lens}>
            <span ref={zoom} className={styles.zoom}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(art.src)}
                alt=""
                width={art.width}
                height={art.height}
                style={{ objectPosition: art.position }}
                draggable={false}
              />
            </span>
          </span>
          <span className={styles.reticle}>
            <i />
            <i />
          </span>
          <span ref={read} className={styles.read}>
            READY
          </span>
        </div>
      </div>

      <div className={styles.title}>
        <p className={styles.kicker}>
          <span>{c.aspirantName}</span>
          <span lang="ja">{c.jp.script}</span>
        </p>
        <h1 id="lc-name" className={styles.name}>
          {c.name}
        </h1>
      </div>

      <div className={styles.foot}>
        <p className={styles.tagline}>{c.tagline}</p>
        <p className={styles.hint}>{cfg.hint}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              shoot.current?.();
            }}
          >
            {cfg.action}
          </button>
          <p className={styles.counter} aria-hidden="true">
            Shots <b ref={count}>00</b>
          </p>
        </div>
        <p className={styles.cue} aria-hidden="true">
          <span>Scroll</span>
          <i />
        </p>
      </div>
    </section>
  );
}
