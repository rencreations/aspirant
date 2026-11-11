"use client";

import { useEffect, useRef, type RefObject } from "react";

import { planRest, restAt, restEasing, TURN, type RestPlan } from "./spin";

/** The small disc turns once in three seconds while its track plays. */
const TURN_MS = 3000;
const SPEED = TURN / (TURN_MS / 1000);

interface Run {
  anim: Animation;
  /** `turn`: turning from `from` (radians); `rest`: slowing onto a whole turn along `plan`. */
  kind: "turn" | "rest";
  from: number;
  plan: RestPlan | null;
}

/** Where the disc is now (radians, clockwise), from the animation that runs on it. */
function angleOf(run: Run | null): number {
  if (!run) return 0;
  const ms = Number(run.anim.currentTime ?? 0);
  if (run.kind === "turn") return (run.from + (ms / 1000) * SPEED) % TURN;
  return run.plan ? restAt(run.plan, ms / 1000).angle % TURN : 0;
}

function rotate(angle: number): Keyframe {
  return { transform: `rotate(${((angle * 180) / Math.PI).toFixed(3)}deg)` };
}

/**
 * The small disc of the player bar: it turns while the track plays, and when the track pauses it
 * slows down onto a whole turn (the plan of `spin.ts`), so its picture comes to rest upright. Web
 * Animations of `transform`, so the compositor runs them.
 */
export function useRecordSpin(ref: RefObject<HTMLElement | null>, playing: boolean): void {
  const run = useRef<Run | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    const now = run.current;
    const angle = angleOf(now);
    if (playing) {
      if (now?.kind === "turn") return;
      now?.anim.cancel();
      const anim = el.animate([rotate(angle), rotate(angle + TURN)], {
        duration: TURN_MS,
        iterations: Infinity,
        easing: "linear",
      });
      run.current = { anim, kind: "turn", from: angle, plan: null };
      return;
    }
    if (!now || now.kind === "rest") return;
    now.anim.cancel();
    const plan = planRest(angle, SPEED);
    if (plan.dur <= 0) {
      run.current = null;
      return;
    }
    const anim = el.animate([rotate(plan.from), rotate(plan.to)], {
      duration: plan.dur * 1000,
      easing: restEasing(plan),
      fill: "forwards",
    });
    const mine: Run = { anim, kind: "rest", from: plan.from, plan };
    run.current = mine;
    anim.finished.then(
      () => {
        // At a whole turn the disc looks as it does with no animation at all.
        if (run.current !== mine) return;
        anim.cancel();
        run.current = null;
      },
      () => undefined,
    );
  }, [playing, ref]);

  useEffect(
    () => () => {
      run.current?.anim.cancel();
      run.current = null;
    },
    [],
  );
}
