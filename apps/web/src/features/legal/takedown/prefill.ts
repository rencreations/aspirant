import type { Route } from "next";

import { LEGAL_ROUTES } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

/**
 * What a "Copyright or takedown" link tells the takedown page about the item it was pressed on:
 * its title, its ID and the page it is on. Only these three travel in the address. Nothing the
 * visitor types does.
 */
export interface ReportTarget {
  /** The item's ID in the data file, when it has one (`?i=<id>` opens it). */
  id?: string;
  title: string;
}

const MAX_TITLE = 160;
const MAX_ID = 120;
const MAX_PAGE = 220;

/** A path of this site, with at most a query. Anything else is dropped. */
export function cleanPage(raw: string | null | undefined): string {
  if (!raw) return "";
  const page = raw.slice(0, MAX_PAGE);
  if (!page.startsWith("/") || page.startsWith("//")) return "";
  return /^[A-Za-z0-9/_\-.~?=&%+]*$/.test(page) ? page : "";
}

/** Plain text: control characters become spaces, then it is trimmed and cut. */
function cleanText(raw: string | null | undefined, max: number): string {
  let out = "";
  for (const ch of raw ?? "") {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 32 || code === 127 ? " " : ch;
  }
  return out.trim().slice(0, max);
}

/** The address of the takedown page for an item. `pathname` is the page the link is on. */
export function takedownHref(target: ReportTarget, pathname: string): Route {
  const params = new URLSearchParams();
  const id = cleanText(target.id, MAX_ID);
  if (id) params.set("item", id);
  const title = cleanText(target.title, MAX_TITLE);
  if (title) params.set("title", title);
  const page = cleanPage(id ? `${pathname}?i=${encodeURIComponent(id)}` : pathname);
  if (page) params.set("page", page);
  const query = params.toString();
  return query ? `${LEGAL_ROUTES.takedown}?${query}` : LEGAL_ROUTES.takedown;
}

/** The "what to take down" text for the form, from the address of the takedown page. Empty when it carries nothing. */
export function itemsFromParams(get: (key: string) => string | null): string {
  const title = cleanText(get("title"), MAX_TITLE);
  const id = cleanText(get("item"), MAX_ID);
  const page = cleanPage(get("page"));
  const lines: string[] = [];
  if (title) lines.push(id ? `${title} (item ${id})` : title);
  else if (id) lines.push(`Item ${id}`);
  if (page) lines.push(`${siteConfig.url}${page}`);
  return lines.join("\n");
}
