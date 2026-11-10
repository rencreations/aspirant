"use client";

import { useEffect, type CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";
import { useNavLock } from "@/lib/nav-lock";
import { routes } from "@/lib/site";

import styles from "./room-chrome.module.css";

/**
 * The redesigned rooms (Music, Films, Others, Animation) are full screen experiences. Their top bar
 * has no background: only the menu, the sound button, the logo and the page name stay. `theme` is
 * the tone of what is behind the bar, `storm` for a dark page (light text) and `daybreak` for a
 * light one. Call it once at the top of the room. It clears itself when the room goes.
 */
export function useTransparentNav(theme: "storm" | "daybreak"): void {
  useEffect(() => {
    useNavLock.setState({ theme, bare: true });
    return () => {
      useNavLock.setState({ theme: null, bare: false });
    };
  }, [theme]);
}

interface BackToCollectionProps {
  /** `dark` for a button over a light page, `light` over a dark one. */
  tone?: "dark" | "light";
  /** Where it goes. The default is the shelf. */
  href?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The one way out of a redesigned room: a plain button back to the shelf (`/collection`). The
 * rooms do not link to each other. It sits under the top bar, on the left.
 */
export function BackToCollection({
  tone = "dark",
  href = routes.collection,
  label = "Collection",
  className,
  style,
}: BackToCollectionProps) {
  return (
    <TLink
      href={href as never}
      transitionLabel={label}
      data-tone={tone}
      data-room-back=""
      className={`${styles.back} ${className ?? ""}`}
      style={style}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className={styles.arrow}>
        <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span>{label}</span>
    </TLink>
  );
}
