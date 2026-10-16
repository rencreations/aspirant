import type { Route } from "next";

import { type CharacterSlug } from "./slugs";

/** Site identity. Our copy: plain, warm, no dashes. */
export const siteConfig = {
  name: "The Aspirants",
  shortName: "Aspirants",
  tagline: "Someone is always waiting.",
  description:
    "The Aspirants is a fan-made archive for Aspirant, a story series set in an alternate universe of Mobile Legends: Bang Bang. Read the whole story, meet the ten Aspirants and browse every film, song and drawing. Not affiliated with Moonton.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
} as const;

/** Top level routes. Use these instead of string literals. */
export const routes = {
  home: "/",
  experience: "/experience",
  story: "/story",
  characters: "/character",
  collection: "/collection",
} as const satisfies Record<string, Route>;

/** An absolute external URL (opens in a new tab when used with <TLink>). */
export type ExternalHref = `https://${string}` | `http://${string}` | `mailto:${string}`;

/** Route for one character page. */
export function characterRoute(slug: CharacterSlug): Route {
  return `/character/${slug}` as Route;
}

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  /** Short code shown in the HUD, for example "01". */
  readonly index: string;
}

/** The five main destinations, in nav order. */
export const navItems: readonly NavItem[] = [
  { href: routes.home, label: "Home", index: "01" },
  { href: routes.experience, label: "Experience", index: "02" },
  { href: routes.story, label: "Story", index: "03" },
  { href: routes.characters, label: "Characters", index: "04" },
  { href: routes.collection, label: "Collection", index: "05" },
];

/** True when `pathname` is inside the section that `href` names. */
export function isActiveRoute(pathname: string, href: string): boolean {
  const strip = (p: string) => p.replace(/\/+$/, "") || "/";
  const path = strip(pathname);
  const target = strip(href);
  if (target === "/") return path === "/";
  return path === target || path.startsWith(`${target}/`);
}
