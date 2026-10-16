"use client";

import type { Route } from "next";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { useTransitionRouter } from "@/components/transition/transition-provider";
import { StarButton } from "@/components/ui/star-button";
import { asset } from "@/lib/asset";
import { useHotkey, useReducedMotion } from "@/lib/hooks";
import { clamp } from "@/lib/math";

import styles from "./next-footer.module.css";

export interface NextFooterProps {
  /** Small label above the title. Default "Next destination". */
  eyebrow?: string;
  /** The destination, set huge. For example "Experience" or "Layla". */
  label: string;
  /** One line under the title. */
  sublabel?: string;
  /** Internal route to go to. */
  href: Route;
  /** Public path of a cutout or art image (passed through asset()). Decorative. */
  image?: string;
  /** Accent colour for this footer (any CSS colour). Defaults to the theme accent. */
  accent?: string;
}

const ARM_AT = 0.98;
const CANCEL_BELOW = 0.94;
const LOCK_MS = 520;

/**
 * The "next destination" footer (after landonorris.com). A tall region with a sticky stage:
 * keep scrolling and the ring fills; at 98 percent it opens the next page once (scroll back
 * to cancel). Wheel, touch and keyboard scrolling all work, and so do the Continue button
 * and the N key. Reduced motion: no auto-advance, the button and N only.
 *
 * <NextFooter label="Experience" sublabel="The story, told by scrolling." href={routes.experience} />
 */
export function NextFooter({
  eyebrow = "Next destination",
  label,
  sublabel,
  href,
  image,
  accent,
}: NextFooterProps) {
  const regionRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const router = useTransitionRouter();
  const reduced = useReducedMotion();
  const titleId = useId();
  const [announce, setAnnounce] = useState("");
  const fired = useRef(false);
  const lockTimer = useRef(0);

  const go = () => {
    if (fired.current) return;
    fired.current = true;
    setAnnounce(`Opening ${label}.`);
    router.push(href, { label });
  };

  useHotkey("n", go);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    fired.current = false;
    let raf = 0;
    let announced = false;
    const cancelLock = () => {
      window.clearTimeout(lockTimer.current);
      lockTimer.current = 0;
      if (region.dataset.state === "locking") region.dataset.state = "idle";
    };
    const read = () => {
      raf = 0;
      const rect = region.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? clamp(-rect.top / travel) : 0;
      region.style.setProperty("--p", p.toFixed(4));
      if (valueRef.current)
        valueRef.current.textContent = String(Math.round(p * 100)).padStart(3, "0");
      if (!announced && rect.top < window.innerHeight * 0.5) {
        announced = true;
        setAnnounce(`Next: ${label}. Press N or use Continue.`);
      }
      if (reduced || fired.current) return;
      if (p >= ARM_AT && !lockTimer.current) {
        region.dataset.state = "locking";
        lockTimer.current = window.setTimeout(() => {
          lockTimer.current = 0;
          const r = region.getBoundingClientRect();
          const t = r.height - window.innerHeight;
          const now = t > 0 ? clamp(-r.top / t) : 0;
          if (now >= CANCEL_BELOW) go();
          else region.dataset.state = "idle";
        }, LOCK_MS);
      } else if (p < CANCEL_BELOW && lockTimer.current) {
        cancelLock();
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      cancelLock();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // `go` reads refs only; re-run when the destination or motion setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, label, reduced]);

  const style = accent ? ({ "--accent": accent, "--glow": accent } as CSSProperties) : undefined;

  return (
    <section
      ref={regionRef}
      className={styles.region}
      data-state="idle"
      aria-labelledby={titleId}
      style={style}
    >
      <div className={styles.stage}>
        <div className={styles.media} aria-hidden="true">
          {image && (
            // Decorative backdrop; the title names the destination.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.image}
              src={asset(image)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <div className={`${styles.grid} grid-hex fade-edges`} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />

        <div className={styles.top}>
          <p className="m-0 hud-label">{eyebrow}</p>
          <div className={styles.ring} aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <circle
                className={styles.ringTicks}
                cx="50"
                cy="50"
                r="47"
                fill="none"
                strokeWidth="3"
                strokeDasharray="0.6 4.32"
              />
              <circle
                className={styles.ringTrack}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="1"
              />
              <circle
                className={styles.ringFill}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="3"
                pathLength={1}
              />
            </svg>
            <span className={styles.ringValue}>
              <span ref={valueRef}>000</span>
              <small>{reduced ? "Sync" : "Scroll"}</small>
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <h2 id={titleId} className={styles.title}>
            <span className="sr-only">Next: </span>
            <span className={styles.titleGhost}>{label}</span>
            <span className={styles.titleFill} aria-hidden="true">
              {label}
            </span>
          </h2>
          {sublabel && <p className={styles.sublabel}>{sublabel}</p>}
          <div className={styles.actions}>
            <StarButton
              size="lg"
              pulse
              onClick={go}
              aria-keyshortcuts="N"
              aria-label={`Continue to ${label}`}
            >
              Continue
            </StarButton>
            <p className={`${styles.hint} hud-label`}>
              {reduced ? "Press N or Continue" : "Keep scrolling or press N"}
            </p>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </section>
  );
}
