import type { CSSProperties, ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

export interface TagProps {
  children: ReactNode;
  /** "outline" (default), "solid" (accent fill) or "warn" (crimson, for notices). */
  variant?: "outline" | "solid" | "warn";
  /** Accent colour (any CSS colour). Default: theme accent. Ignored by "warn". */
  accent?: string;
  className?: string;
}

const VARIANTS = {
  outline: "border-(--tag-accent) text-text",
  solid: "border-(--tag-accent) bg-(--tag-accent) text-on-accent",
  warn: "border-crimson bg-[color-mix(in_srgb,var(--crimson)_12%,transparent)] text-crimson",
} as const;

/**
 * Small mono chip with a diamond dot: categories, sides, parts-list captions and notices
 * ("Non-canon parody"). Text, not a control.
 *
 * <Tag>Daybreak</Tag> <Tag variant="solid" accent="var(--violet)">Storm</Tag>
 */
export function Tag({ children, variant = "outline", accent, className }: TagProps) {
  const style = { "--tag-accent": accent ?? "var(--accent)" } as CSSProperties;
  return (
    <span
      style={style}
      className={cn(
        "inline-flex min-h-6 items-center gap-2 border px-2 py-0.5 mono text-[0.6875rem] leading-none font-medium tracking-[0.16em] whitespace-nowrap uppercase",
        VARIANTS[variant],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-[5px] flex-none rotate-45",
          variant === "solid"
            ? "bg-on-accent"
            : variant === "warn"
              ? "bg-crimson"
              : "bg-(--tag-accent)",
        )}
      />
      {children}
    </span>
  );
}
