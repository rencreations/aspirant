import type { CodexEntry, CodexFact, CodexRel, RelType } from "./types";

/** The slug of the page of a relationship: the two slugs in alphabetical order, joined by `--`. */
export function pairSlug(a: string, b: string): string {
  return a < b ? `${a}--${b}` : `${b}--${a}`;
}

/** A slug of the codex is an entry (`storm-citadel`) or a pair (`fanny--layla`). */
export function splitPairSlug(slug: string): [string, string] | null {
  const i = slug.indexOf("--");
  if (i <= 0 || i >= slug.length - 2) return null;
  return [slug.slice(0, i), slug.slice(i + 2)];
}

/** The slug in `/collection/lore/<slug>/`, or "" for the room itself. */
export function slugFromPath(pathname: string): string {
  const m = /^\/collection\/lore\/([a-z0-9-]+)\/?$/u.exec(pathname);
  return m?.[1] ?? "";
}

export const lorePath = (slug: string): string =>
  slug ? `/collection/lore/${slug}/` : "/collection/lore/";

// ---- relation types ----------------------------------------------------------------------------

type RelFamily = "kin" | "bond" | "power" | "make" | "foe";

interface RelMeta {
  out: string;
  in: string;
  family: RelFamily;
}

/** How each type reads from the side it describes (`out`) and from the other side (`in`). */
export const REL_META: Readonly<Record<RelType, RelMeta>> = {
  family: { out: "Family", in: "Family", family: "kin" },
  partner: { out: "Partner", in: "Partner", family: "bond" },
  friend: { out: "Friend", in: "Friend", family: "bond" },
  ally: { out: "Ally", in: "Ally", family: "bond" },
  guardian: { out: "Guards", in: "Guarded by", family: "bond" },
  ward: { out: "Guarded by", in: "Guards", family: "bond" },
  found: { out: "Found", in: "Found by", family: "bond" },
  teacher: { out: "Teaches", in: "Taught by", family: "power" },
  student: { out: "Taught by", in: "Teaches", family: "power" },
  leader: { out: "Leads", in: "Led by", family: "power" },
  serves: { out: "Serves", in: "Served by", family: "power" },
  member: { out: "Member of", in: "Has as member", family: "power" },
  maker: { out: "Made", in: "Made by", family: "make" },
  creation: { out: "Made by", in: "Made", family: "make" },
  owns: { out: "Owns", in: "Owned by", family: "make" },
  part: { out: "Part of", in: "Has as part", family: "make" },
  lives: { out: "Lives in", in: "Home of", family: "make" },
  rival: { out: "Rival", in: "Rival", family: "foe" },
  enemy: { out: "Enemy", in: "Enemy", family: "foe" },
};

export const relLabel = (type: RelType, dir: "out" | "in"): string => REL_META[type][dir];

// ---- the reader's reach (spoilers) -------------------------------------------------------------

/** What is shown of an entry to a reader who has reached chapter `reach` (Infinity: everything). */
export function visibleFacts(entry: CodexEntry, reach: number): CodexFact[] {
  return reach >= entry.last ? entry.facts : entry.facts.filter((f) => f.n <= reach);
}

/** True when the reader has not met the entry yet: its first chapter is ahead of them. */
export const isUnmet = (entry: CodexEntry, reach: number): boolean => entry.first > reach;

/** How many of an entry's facts are beyond the reader. */
export function hiddenFactCount(entry: CodexEntry, reach: number): number {
  return reach >= entry.last ? 0 : entry.facts.filter((f) => f.n > reach).length;
}

// ---- search ------------------------------------------------------------------------------------

export function parseTerms(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/’/gu, "'")
    .split(/[^a-z0-9']+/u)
    .filter((t) => t.length > 0);
}

/** A lower-case haystack of the words that name an entry, for the list search. */
export function haystack(entry: CodexEntry): { name: string; aka: string; rest: string } {
  const lower = (s: string) => s.toLowerCase().replace(/’/gu, "'");
  return {
    name: lower(entry.name),
    aka: lower(entry.aka.join(" ")),
    rest: lower(`${entry.sub} ${entry.line} ${entry.summary}`),
  };
}

/** The score of an entry for the terms: 0 when a term is missing anywhere in it. */
export function scoreEntry(h: ReturnType<typeof haystack>, terms: readonly string[]): number {
  let score = 0;
  for (const t of terms) {
    let s = 0;
    if (h.name.startsWith(t)) s = 12;
    else if (h.name.includes(` ${t}`)) s = 10;
    else if (h.name.includes(t)) s = 8;
    else if (h.aka.includes(t)) s = 6;
    else if (h.rest.includes(t)) s = 2;
    if (s === 0) return 0;
    score += s;
  }
  return score;
}

// ---- relations of one entry --------------------------------------------------------------------

export interface Neighbour {
  slug: string;
  /** The ties to this neighbour, as they read from the entry's side, earliest first. */
  ties: CodexRel[];
  /** The first chapter that shows the tie. */
  first: number;
}

/** The entries tied to `entry` (within the reader's reach), the most tied first, the ten first. */
export function neighbours(
  entry: CodexEntry,
  reach: number,
  weight: (slug: string) => number,
): Neighbour[] {
  const by = new Map<string, CodexRel[]>();
  for (const r of entry.rel) {
    if (r.n > reach || r.to === entry.slug) continue;
    const list = by.get(r.to) ?? [];
    list.push(r);
    by.set(r.to, list);
  }
  const out: Neighbour[] = [];
  for (const [slug, ties] of by) {
    ties.sort((a, b) => a.n - b.n || a.p - b.p);
    out.push({ slug, ties, first: ties[0]?.n ?? 0 });
  }
  return out.sort((a, b) => weight(b.slug) - weight(a.slug) || b.ties.length - a.ties.length);
}

// ---- the diagram -------------------------------------------------------------------------------

export interface HubPoint {
  x: number;
  y: number;
}

/**
 * Where `count` neighbours sit around a hub in a box of `w` by `h`: on an ellipse, the first at the
 * top and then clockwise, so the most important sit at the top of the picture.
 */
export function hubPoints(count: number, w: number, h: number): HubPoint[] {
  const rx = w / 2 - 78;
  const ry = h / 2 - 34;
  const cx = w / 2;
  const cy = h / 2;
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, count)) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}
