"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { perfLevel } from "@/lib/perf";

import styles from "./door-gate.module.css";
import { DOOR_LOCK_MS, DOOR_TIMES, sideOf, speedFor, type Side } from "./door-math";
import { Doors, type DoorsApi } from "./doors";
import { boundary, toneHint, type Dir } from "./gates";
import { Hold, useHold, useHoldProgress } from "./hold";
import { useScrollLock } from "./scroll-lock";
import { useScrollSnap } from "./snap";

/**
 * DoorGate: a two-way, TIME-BASED join between a section A (above) and a section B (below), made
 * with a pair of automatic doors.
 *
 * Use it as the pair `DoorGate` (around A) and `UpZone` (around B), with the same `id`:
 *
 *   <DoorGate id="x" hold={0.8} at={0.72} hooks={hooks}> <A /> </DoorGate>
 *   <UpZone id="x" hold={0.8} at={0.72} idleMs={1000}> <B /> </UpZone>
 *
 * Going DOWN, A's last screen is held for `hold` screens. The visitor scrolls on a little; at `at`
 * of the hold (or after a stop of a second inside it, from the half on) the scroll is LOCKED and the
 * scene plays by itself, whatever the visitor does: the doors close, the page goes to B while the
 * screen is covered, the doors open on B. The scroll is given back only when everything that
 * arrived is in view and can be used (`arrival`), so a visitor who keeps scrolling cannot carry the
 * page past B's heading. Going UP out of B has its own threshold (`UpZone`) and plays the same
 * scene the other way: B leaves (`leave`), the doors are shut over what is left, the page goes to
 * A's last screen, the doors open on it. There is no threshold at the far side of either way.
 * A stop in a threshold snaps after `idleMs` (half or more goes on, less goes back).
 *
 * The scene does not know the sections: they speak through `hooks`, every one optional. Each gets
 * the direction the page crosses the boundary in (`dir`).
 *   leave    The section being left plays an exit. Resolve when it is gone (waited for at most
 *            `DOOR_TIMES.leaveMax`).
 *   covered  The screen is covered and the page has just gone to the other section: put it into
 *            its starting state, start its entrance. Called once, synchronously.
 *   ready    Resolve when the section that is arriving can be shown (pictures decoded). Waited for
 *            at most `DOOR_TIMES.readyMax`.
 *   arrival  Resolve when everything that arrived is on screen AND can be used. The doors open
 *            at the same time and the scroll is given back when both are done (at most
 *            `DOOR_TIMES.arrivalMax`).
 *   settle   The page is at rest on one side with nothing played (it was opened part way down, or
 *            flung past the doors): put the sections into the resting state of that side.
 * `closing` says how the doors shut in each direction: "doors" (they close, default) or "instant"
 * (they are shut at once after `leave`: the section that left had made the ground plain, so there
 * is nothing to see). `tone` is the colour of the doors ("paper" is pale, "comic" is dark, "clear"
 * has no colour at all: the doors are invisible and only their timing is used, for a join whose
 * sections draw the scene themselves, like the comic's halves that open on the livestream) and the
 * nav text follows it while it is in the corner ("clear" leaves the nav to the sections' hooks).
 *
 * Reduced motion (`enabled` false): the sections are shown as they are, with no hold and no scene.
 * A weak device plays the scene a third shorter. Only `transform` and `opacity` move.
 */
export interface DoorHooks {
  leave?: (dir: Dir) => Promise<void> | void;
  covered?: (dir: Dir) => void;
  ready?: (dir: Dir) => Promise<void> | void;
  arrival?: (dir: Dir) => Promise<void> | void;
  settle?: (side: Side) => void;
}

export interface DoorGateProps {
  /** The boundary: the section after it passes the same id to `UpZone`. */
  id: string;
  /** Screens of scrolling A's last screen is held for (the threshold is part of it). */
  hold: number;
  /** The share of the hold at which the scene starts by itself. */
  at: number;
  /** The doors' look. Default "paper". */
  tone?: "paper" | "comic" | "clear";
  closing?: Partial<Record<Dir, "doors" | "instant">>;
  hooks?: DoorHooks;
  /** False (reduced motion): plain joint. */
  enabled?: boolean;
  /** For the wrapper (a negative margin that lets the section overlap the one before it). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** A hook's answer, or a short wait if it does not come. */
function within(answer: Promise<void> | void, seconds: number): Promise<void> {
  return Promise.race([
    Promise.resolve(answer).catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, seconds * 1000)),
  ]);
}

/**
 * A gate that sits inside the way back of the join before it (the comic: the section after the
 * doors of the interlude and the section before the livestream) lives inside that way back's own
 * stacking context, and a z-index raised on the gate's wrapper can never lift it above the section
 * that follows (the page jumps to it): the stage would be under it. So while a scene plays the
 * isolated boxes around the wrapper are raised too, up to the page, and put back after.
 */
function liftAround(el: HTMLElement, on: boolean) {
  const stop = el.closest("[data-vexana]");
  let a = el.parentElement;
  while (a && a !== stop) {
    const cs = getComputedStyle(a);
    if (cs.isolation === "isolate" && cs.position !== "static") a.style.zIndex = on ? "44" : "";
    a = a.parentElement;
  }
}

/** Resolves after `n` painted frames. */
function frames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

function DoorOverlay({
  id,
  at,
  tone,
  closing,
  hooks,
}: Pick<DoorGateProps, "id" | "at" | "tone" | "closing" | "hooks">) {
  const { root, range } = useHold();
  const lenis = useLenis();
  const { lock } = useScrollLock();
  const layer = useRef<HTMLDivElement>(null);
  const doors = useRef<DoorsApi>(null);
  const live = useRef({ lenis, range, lock, hooks, closing });
  const tick = useRef<(p: number) => void>(() => undefined);
  const playRef = useRef<(dir: Dir) => void>(() => undefined);
  const hint = tone === "comic" ? "dark" : tone === "clear" ? null : "light";

  useEffect(() => {
    live.current = { lenis, range, lock, hooks, closing };
  });

  useEffect(() => {
    const r = root.current;
    const l = layer.current;
    if (!r || !l) return;
    const b = boundary(id);
    const s = {
      armed: true,
      last: 0,
      session: 0,
      v: 0,
      dir: "down" as Dir,
      jumped: false,
      side: null as Side | null,
      tween: null as gsap.core.Tween | null,
      unlock: null as (() => void) | null,
    };

    const draw = () => {
      doors.current?.set(s.v);
      // The doors are over the corner (where the nav text is) once they have closed a little.
      if (hint) toneHint.set(s.v >= 0.2 ? hint : null);
    };

    /** Where the page goes while the screen is covered. */
    const targetOf = (dir: Dir): number => {
      if (dir === "down") {
        // B's real start: where its up threshold ends (or where this wrapper ends).
        const up = b.up?.range();
        return up ? up.end : r.getBoundingClientRect().bottom + window.scrollY;
      }
      // Back up: A's last screen, with the hold below it (so there is no threshold above).
      const own = live.current.range();
      return own ? own.start : r.getBoundingClientRect().top + window.scrollY;
    };

    const jump = (dir: Dir) => {
      live.current.lenis.scrollTo(targetOf(dir), { immediate: true });
      s.jumped = true;
    };

    const sideNow = (): Side => sideOf(window.scrollY, b.up?.range()?.start ?? null);

    /** The scene is over (or was cut short): leave everything at rest and give the scroll back. */
    const finish = (dir: Dir) => {
      s.session += 1;
      s.tween?.kill();
      s.tween = null;
      s.v = 0;
      draw();
      l.style.visibility = "hidden";
      l.style.pointerEvents = "none";
      r.style.zIndex = "";
      liftAround(r, false);
      toneHint.set(null);
      // If the layout moved while the page was covered (a resize, pictures arriving), the place it
      // jumped to is no longer the start of the section: go to the right place now.
      const want = targetOf(dir);
      if (Math.abs(window.scrollY - want) > 2) {
        live.current.lenis.scrollTo(want, { immediate: true });
      }
      s.side = dir === "down" ? "after" : "before";
      b.busy = false;
      const un = s.unlock;
      s.unlock = null;
      un?.();
    };

    const play = (dir: Dir) => {
      if (b.busy) return;
      b.busy = true;
      s.armed = false;
      s.dir = dir;
      s.jumped = false;
      s.session += 1;
      const token = s.session;
      const alive = () => s.session === token;
      const speed = speedFor(perfLevel());
      const to = (v: number, seconds: number, ease: string) =>
        new Promise<void>((resolve) => {
          s.tween?.kill();
          s.tween = gsap.to(s, {
            v,
            duration: seconds * speed,
            ease,
            onUpdate: draw,
            onComplete: () => {
              resolve();
            },
          });
        });
      const { hooks: h, closing: how } = live.current;

      s.unlock = live.current.lock(DOOR_LOCK_MS);
      r.style.zIndex = "44";
      liftAround(r, true);
      l.style.visibility = "visible";
      l.style.pointerEvents = "auto";
      s.v = 0;
      draw();

      void (async () => {
        try {
          // 1. The section being left plays its exit.
          await within(h?.leave?.(dir), DOOR_TIMES.leaveMax);
          if (!alive()) return;
          // 2. The doors shut over what is left.
          if ((how?.[dir] ?? "doors") === "doors") {
            await to(1, DOOR_TIMES.close, "power2.inOut");
          } else {
            s.tween?.kill();
            s.v = 1;
            draw();
          }
          if (!alive()) return;
          // 3. The page goes to the other section while the screen is covered.
          jump(dir);
          h?.covered?.(dir);
          await within(h?.ready?.(dir), DOOR_TIMES.readyMax);
          await frames(2);
          if (!alive()) return;
          // 4. The doors open, and the arrival plays at the same time.
          const arrival = within(h?.arrival?.(dir), DOOR_TIMES.arrivalMax);
          await Promise.all([to(0, DOOR_TIMES.open, "power1.inOut"), arrival]);
          if (!alive()) return;
          finish(dir);
        } catch {
          if (alive()) finish(dir);
        }
      })();
    };

    playRef.current = play;
    b.play = play;

    tick.current = (p) => {
      if (p < at - 0.2) s.armed = true;
      if (p >= at && p < 0.995 && p > s.last && s.armed && !b.busy) play("down");
      s.last = p;
    };

    // The page at rest on a side (opened part way down, or taken past the doors by a fling): the
    // sections are put into the resting state of that side, with nothing played.
    const settle = () => {
      if (b.busy) return;
      const side = sideNow();
      if (side === s.side) return;
      s.side = side;
      live.current.hooks?.settle?.(side);
    };
    window.addEventListener("scroll", settle, { passive: true });
    ScrollTrigger.addEventListener("refresh", settle);
    const first = requestAnimationFrame(() => {
      requestAnimationFrame(settle);
    });

    // A tab that is hidden does not play its animations: finish at once, whole, so nothing is left
    // locked or half done when it comes back.
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !b.busy) return;
      const dir = s.dir;
      s.session += 1;
      s.tween?.kill();
      if (!s.jumped) jump(dir);
      live.current.hooks?.settle?.(dir === "down" ? "after" : "before");
      finish(dir);
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      tick.current = () => undefined;
      playRef.current = () => undefined;
      if (b.play === play) b.play = null;
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", settle);
      ScrollTrigger.removeEventListener("refresh", settle);
      document.removeEventListener("visibilitychange", onHidden);
      s.session += 1;
      s.tween?.kill();
      const un = s.unlock;
      s.unlock = null;
      un?.();
      b.busy = false;
      toneHint.set(null);
      r.style.zIndex = "";
      liftAround(r, false);
    };
  }, [id, root, at, hint]);

  useHoldProgress((p) => {
    tick.current(p);
  });

  // A stop inside the threshold: after a second of quiet, from the half on the scene plays by
  // itself, before it the page goes back to the start of the hold.
  useScrollSnap(`${id}:down`, () => (boundary(id).busy ? null : live.current.range()), {
    idleMs: 1000,
    onSnap: (side) => {
      if (side !== "end") return false;
      playRef.current("down");
      return true;
    },
  });

  return (
    <div ref={layer} className={styles.layer} aria-hidden="true">
      <Doors ref={doors} tone={tone ?? "paper"} />
    </div>
  );
}

/** The section above a door boundary. See the notes at the top of this file. */
export function DoorGate({
  id,
  hold,
  at,
  tone = "paper",
  closing,
  hooks,
  enabled = true,
  className,
  style,
  children,
}: DoorGateProps) {
  if (!enabled) return <>{children}</>;
  return (
    <Hold
      hold={hold}
      className={className}
      style={style}
      overlay={<DoorOverlay id={id} at={at} tone={tone} closing={closing} hooks={hooks} />}
    >
      {children}
    </Hold>
  );
}
