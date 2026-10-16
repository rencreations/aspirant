import type { CSSProperties } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import styles from "./meter.module.css";

export interface MeterProps {
  /** Current value, between 0 and `max`. */
  value: number;
  /** Maximum value. Default 1. */
  max?: number;
  /** Number of segments. Default 20. */
  segments?: number;
  /** Visible label and accessible name, for example "Coupling". */
  label: string;
  /** Show the formatted value next to the label. Default true. */
  showValue?: boolean;
  /** Format the value for display and for assistive tech. Default: two decimals. */
  format?: (value: number) => string;
  /** "horizontal" (default) or "vertical" (fills bottom to top). */
  orientation?: "horizontal" | "vertical";
  /** Accent colour for lit segments (any CSS colour). Default: theme accent. */
  accent?: string;
  className?: string;
}

const defaultFormat = (v: number) => v.toFixed(2);

/**
 * Segmented coupling meter (role="meter"). Segments light up to the value, the lit edge
 * glows, and changes animate with a short stagger (static under reduced motion).
 *
 * <Meter label="Coupling" value={1.62} max={2.5} />
 */
export function Meter({
  value,
  max = 1,
  segments = 20,
  label,
  showValue = true,
  format = defaultFormat,
  orientation = "horizontal",
  accent,
  className,
}: MeterProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const lit = Math.round((clamped / (max || 1)) * segments);
  const text = format(clamped);
  const style = accent ? ({ "--m-accent": accent } as CSSProperties) : undefined;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={text}
      className={cn(styles.meter, orientation === "vertical" && styles.vertical, className)}
      style={style}
    >
      <div className={styles.head} aria-hidden="true">
        <span className={styles.label}>{label}</span>
        {showValue && <span className={styles.value}>{text}</span>}
      </div>
      <div className={styles.track} aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={styles.segment}
            data-lit={i < lit}
            data-edge={i === lit - 1}
            style={{ transitionDelay: `${i * 14}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
