import type { Route } from "next";

/**
 * The way back. A page that sends the visitor into another page (the About page into a room of the
 * collection, the Music room into a film) can ask that page to lead back to it: the link carries
 * `from=<key>` and, for a long page, `at=<place>` (the part of that page the visitor left). The page
 * that is opened reads it (`useReturnTo` in `lib/use-return-to.ts`), and its way out says the name
 * of the page the visitor came from and goes there, instead of to its own parent.
 *
 * This file is the pure part: the table of pages that may be named, how a link says it and how an
 * address is read. Add a key to the table before using it in a link. Nothing from the address is
 * ever put into a link as it came: a key or a place that is not in the table is ignored.
 */

/** The places of the About page a visitor can be sent back to (`at=`). */
const ABOUT_PLACES = [
  "statement",
  "phases",
  "phase-1",
  "phase-2",
  "phase-3",
  "phase-4",
  "phase-5",
  "ledger",
  "label",
] as const;

export type AboutPlace = (typeof ABOUT_PLACES)[number];

interface ReturnRoute {
  readonly href: string;
  /** The name the way out shows, and the one the page transition says. */
  readonly label: string;
  /** The places of that page a link may name. A page without them is opened at its top. */
  readonly places?: readonly string[];
}

const RETURN_ROUTES = {
  music: { href: "/collection/music", label: "Music" },
  voicelines: { href: "/collection/voicelines", label: "Voicelines" },
  arts: { href: "/collection/arts", label: "Arts" },
  about: { href: "/about", label: "About", places: ABOUT_PLACES },
} as const satisfies Record<string, ReturnRoute>;

export type ReturnKey = keyof typeof RETURN_ROUTES;

function isReturnKey(value: string): value is ReturnKey {
  return Object.prototype.hasOwnProperty.call(RETURN_ROUTES, value);
}

/** The place, when the page named by `key` has it. */
function placeOf(key: ReturnKey, at: string | null | undefined): string | undefined {
  const route: ReturnRoute = RETURN_ROUTES[key];
  return at && route.places?.includes(at) ? at : undefined;
}

export interface ReturnTarget {
  key: ReturnKey;
  /** Where the way out goes: the page, and the place in it when the link named one. */
  href: Route;
  label: string;
  /** The place the visitor left, when the link named one the page has. */
  at?: string;
  /** `from=<key>` and `at=<place>` as they are written in an address, with no `?`. */
  query: string;
}

/** Where the visitor came from, read from a query string (`?from=about&at=phase-4`), or null. */
export function returnOf(search: string): ReturnTarget | null {
  const params = new URLSearchParams(search);
  const from = params.get("from") ?? "";
  if (!isReturnKey(from)) return null;
  const { href, label } = RETURN_ROUTES[from];
  const at = placeOf(from, params.get("at"));
  return {
    key: from,
    href: (at ? `${href}?at=${at}` : href) as Route,
    label,
    ...(at ? { at } : {}),
    query: at ? `from=${from}&at=${at}` : `from=${from}`,
  };
}

/**
 * The way back of an address as one short string (`from=about&at=phase-4`), or "" when it has
 * none. A hook can hold it as its snapshot: it changes only when the way back changes.
 */
export function returnQuery(search: string): string {
  return returnOf(search)?.query ?? "";
}

/** Add a query (`a=b&c=d`, no `?`) to an address, before its hash. */
function addQuery(href: string, query: string): string {
  if (!query) return href;
  const cut = href.indexOf("#");
  const path = cut < 0 ? href : href.slice(0, cut);
  const hash = cut < 0 ? "" : href.slice(cut);
  return `${path}${path.includes("?") ? "&" : "?"}${query}${hash}`;
}

/**
 * A link that leads back here: `href` with `from=<key>` and, when the page has that place,
 * `at=<place>`. Use it for a link that opens another page from the page named by `key`.
 */
export function withReturn(href: string, key: ReturnKey, at?: string): Route {
  const place = placeOf(key, at);
  return addQuery(href, place ? `from=${key}&at=${place}` : `from=${key}`) as Route;
}

/**
 * An address inside the room the visitor is in (another track, a window over the room, the next
 * comic), with the way back of the address they are on (`search`) carried along. A room that
 * writes a new address by hand uses it, so the way back is not lost on the way.
 */
export function keepReturn(href: string, search: string): string {
  return addQuery(href, returnQuery(search));
}

/** The place of the About page an address names (`?at=phase-4`), or null. */
export function aboutPlaceOf(search: string): AboutPlace | null {
  const at = new URLSearchParams(search).get("at") ?? "";
  return (ABOUT_PLACES as readonly string[]).includes(at) ? (at as AboutPlace) : null;
}
