"use client";

import type { Route } from "next";
import {
  forwardRef,
  useRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { STAR_PATH, StarGlyph } from "@/components/star-glyph";
import { TLink } from "@/components/transition/t-link";
import { audio, type BlipKind } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";

import styles from "./star-button.module.css";

export interface StarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  /** "solid" (filled, default) or "ghost" (outlined, fills on hover). */
  variant?: "solid" | "ghost";
  /** "sm" 44 px, "md" 52 px (default), "lg" 64 px. */
  size?: "sm" | "md" | "lg";
  /** Icon-only diamond button. Needs `aria-label`. */
  emblem?: boolean;
  /** Breathing star and radiating ring, for the one primary action on screen. */
  pulse?: boolean;
  /** Show a trailing arrow. Default true for links, false for buttons. */
  arrow?: boolean;
  /** Render as an internal link (through the page transition) instead of a button. */
  href?: Route;
  /** Label for the transition cover when `href` is set. */
  transitionLabel?: string;
  /** Sound on click. Default "confirm" for solid, "click" for ghost. */
  blip?: BlipKind | false;
  type?: "button" | "submit" | "reset";
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M1 7h11M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * The primary action: a chamfered button with a four-pointed star core. Hover rotates the
 * star and sweeps the fill, click drops a star ripple and plays a blip. Pass `href` to make it
 * a transition link.
 *
 * <StarButton pulse onClick={enter}>Enter the archive</StarButton>
 */
export const StarButton = forwardRef<HTMLButtonElement, StarButtonProps>(function StarButton(
  {
    children,
    variant = "solid",
    size = "md",
    emblem = false,
    pulse = false,
    arrow,
    href,
    transitionLabel,
    blip,
    className,
    onClick,
    onPointerEnter,
    style,
    type = "button",
    ...rest
  },
  ref,
) {
  const hostRef = useRef<HTMLElement | null>(null);
  const classes = cn(
    styles.button,
    styles[variant],
    size !== "md" && styles[size],
    emblem && styles.emblem,
    pulse && styles.pulse,
    className,
  );
  const sound: BlipKind | false = blip ?? (variant === "solid" ? "confirm" : "click");
  const showArrow = !emblem && (arrow ?? Boolean(href));

  const ripple = (e: MouseEvent<HTMLElement>) => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;
    const r = host.getBoundingClientRect();
    const keyboard = e.detail === 0;
    const x = keyboard ? r.width / 2 : e.clientX - r.left;
    const y = keyboard ? r.height / 2 : e.clientY - r.top;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", styles.ripple ?? "");
    svg.style.left = `${x}px`;
    svg.style.top = `${y}px`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", STAR_PATH);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    host.appendChild(svg);
    window.setTimeout(() => svg.remove(), 700);
  };

  const content = (
    <>
      <span className={styles.core} aria-hidden="true">
        <StarGlyph className={styles.star} />
      </span>
      {children != null && !emblem && <span className={styles.label}>{children}</span>}
      {showArrow && <Arrow />}
    </>
  );

  const hover = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") audio.blip("hover");
  };

  if (href) {
    return (
      <TLink
        ref={(el) => {
          hostRef.current = el;
        }}
        href={href}
        className={classes}
        style={style}
        transitionLabel={transitionLabel ?? (typeof children === "string" ? children : undefined)}
        blip={false}
        aria-label={rest["aria-label"]}
        onPointerEnter={hover}
        onClick={(e) => {
          ripple(e);
          if (sound) audio.blip(sound);
        }}
      >
        {content}
      </TLink>
    );
  }

  return (
    <button
      ref={(el) => {
        hostRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      type={type}
      className={classes}
      style={style}
      onPointerEnter={(e) => {
        hover(e);
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        ripple(e);
        if (sound) audio.blip(sound);
        onClick?.(e);
      }}
      {...rest}
    >
      {content}
    </button>
  );
});
