"use client";

import { useEffect, type HTMLAttributes } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import { useSiteStore, type ThemeName } from "@/lib/stores";

export interface ThemeZoneProps extends HTMLAttributes<HTMLElement> {
  theme: ThemeName;
  /** Element to render. Default "section". */
  as?: keyof HTMLElementTagNameMap;
  /** Paint the theme's background (default true). Set false to inherit what is behind. */
  surface?: boolean;
}

/**
 * Scopes a block to one world: every token inside (colours, accent, focus, ember palette)
 * switches with `data-theme`. Server rendered, so there is no flash. Fixed UI (nav, HUD,
 * cursor) samples the zone under it and follows.
 *
 * <ThemeZone theme="daybreak" aria-labelledby="academy-title">...</ThemeZone>
 */
export function ThemeZone({ theme, as, surface = true, className, ...rest }: ThemeZoneProps) {
  const Tag = (as ?? "section") as "section";
  return (
    <Tag
      data-theme={theme}
      className={cn("relative", surface && "bg-bg text-text", className)}
      {...rest}
    />
  );
}

/**
 * Sets the page-level theme (html[data-theme]) while mounted, for pages that live in one
 * world. Restores Storm on unmount. Prefer <ThemeZone> for sections: it renders on the
 * server, while this switches after hydration.
 * @public
 */
export function PageTheme({ theme }: { theme: ThemeName }) {
  const setTheme = useSiteStore((s) => s.setTheme);
  useEffect(() => {
    setTheme(theme);
    return () => setTheme("storm");
  }, [theme, setTheme]);
  return null;
}
