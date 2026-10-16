import type { CSSProperties, ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import styles from "./hud-panel.module.css";

export interface HudPanelProps {
  children?: ReactNode;
  /** Mono label in the header, for example "Unit 07 / Twilight Star". */
  label?: string;
  /** Short code on the right of the header, for example "SYNC 1.62". */
  code?: string;
  /** A slow light band sweeps down the panel (off under reduced motion). */
  scan?: boolean;
  /** Accent colour for ticks, label dot and code (any CSS colour). Default: theme accent. */
  accent?: string;
  /** "solid" panel fill (default) or "glass" (translucent, blurred). */
  tone?: "solid" | "glass";
  /** Element to render. Default "div". Use "section" or "article" with a heading inside. */
  as?: keyof HTMLElementTagNameMap;
  className?: string;
  /** Class for the body wrapper (padding lives here). */
  bodyClassName?: string;
  style?: CSSProperties;
}

/**
 * The terminal's basic surface: a chamfered panel with a hairline gradient border, corner
 * ticks, an optional mono header (label left, code right) and an optional scan band.
 * Server component friendly (no client JS).
 *
 * <HudPanel label="Unit 07 / Twilight Star" code="SYNC 1.62" scan>...</HudPanel>
 */
export function HudPanel({
  children,
  label,
  code,
  scan = false,
  accent,
  tone = "solid",
  as,
  className,
  bodyClassName,
  style,
}: HudPanelProps) {
  // Typed as a single intrinsic tag (HTMLElement props): an ElementType union breaks once
  // @react-three/fiber augments JSX.IntrinsicElements.
  const Tag = (as ?? "div") as "span";
  const vars = accent ? ({ "--hp-accent": accent } as CSSProperties) : undefined;
  return (
    <Tag
      className={cn(styles.panel, tone === "glass" && styles.glass, className)}
      style={{ ...vars, ...style }}
    >
      {scan && <span className={styles.scanTrack} aria-hidden="true" />}
      <span className={cn(styles.tick, styles.tl)} aria-hidden="true" />
      <span className={cn(styles.tick, styles.tr)} aria-hidden="true" />
      <span className={cn(styles.tick, styles.bl)} aria-hidden="true" />
      <span className={cn(styles.tick, styles.br)} aria-hidden="true" />
      {(label ?? code) && (
        <div className={styles.head}>
          {label && <span className={styles.label}>{label}</span>}
          {code && <span className={styles.code}>{code}</span>}
        </div>
      )}
      <div className={cn(styles.body, bodyClassName)}>{children}</div>
    </Tag>
  );
}
