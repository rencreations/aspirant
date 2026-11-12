"use client";

import type { CSSProperties } from "react";

import { TLink } from "@/components/transition/t-link";

import { BackToCollection, useTransparentNav } from "../../shell/room-chrome";
import { TAKEDOWN_URL } from "../../shell/library-shell";
import styles from "./chrome.module.css";
import { ARTS_SHELF_HREF, OFFICIAL_NAV, type OfficialRoom } from "./routes";

/** Call once at the top of an Arts room: the top bar has no background. `tone` is the tone of what is behind it. */
export function useArtsBar(tone: "storm" | "daybreak"): void {
  useTransparentNav(tone);
}

/**
 * The one way out of an Arts room: back to the shelf with the Arts cover open (the three rooms), so
 * the browser's Back and this button land where the visitor chose. It sits under the top bar, on
 * the left (`BackToCollection`).
 */
export function ArtsBack({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return <BackToCollection tone={tone} href={ARTS_SHELF_HREF} label="Collection" />;
}

interface ArtsSubNavProps {
  /** The sub-page that is open. */
  room: OfficialRoom;
  /** `dark` text over a light page, `light` over a dark one. */
  tone?: "dark" | "light";
  className?: string;
  style?: CSSProperties;
}

/**
 * The buttons to the six sub-pages of Official. A plain row of words with the open one marked,
 * fixed at the foot of the screen in the middle by default (a room may place it itself with
 * `className`). On a narrow screen the row slides sideways. Real links, so it works before the
 * scripts have run.
 */
export function ArtsSubNav({ room, tone = "dark", className, style }: ArtsSubNavProps) {
  return (
    <nav
      aria-label="Official art"
      data-tone={tone}
      data-arts-subnav=""
      className={`${styles.subnav} ${className ?? ""}`}
      style={style}
    >
      <ul className={styles.list}>
        {OFFICIAL_NAV.map((item) => (
          <li key={item.room}>
            <TLink
              href={item.href}
              transitionLabel={item.label}
              className={styles.item}
              aria-current={item.room === room ? "page" : undefined}
            >
              {item.label}
            </TLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The takedown line every Arts room ends with. `variant="fixed"` is for a page with no end (Splash art). */
export function ArtsTakedown({
  variant = "inline",
  tone = "dark",
}: {
  variant?: "inline" | "fixed";
  tone?: "dark" | "light";
}) {
  return (
    <p className={styles.takedown} data-variant={variant} data-tone={tone}>
      Fan made archive, not affiliated with Moonton. To ask for something to be taken down, use the{" "}
      <TLink href={TAKEDOWN_URL} className="link">
        takedown page
      </TLink>
      .
    </p>
  );
}
