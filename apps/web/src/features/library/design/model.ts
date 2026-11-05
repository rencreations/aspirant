import type { PairId, Slug } from "@/content/types";

import type { LibImage } from "../types";
import type { DesignCampaign, DesignPost, DesignVideo, Swatch } from "./types";

/** The members of each pair, so a mixed post (all ten, or four) still answers a pair filter. */
const PAIR_MEMBERS: Readonly<Record<PairId, readonly Slug[]>> = {
  "fanny-layla": ["fanny", "layla"],
  "ruby-angela": ["ruby", "angela"],
  "lesley-change": ["lesley", "change"],
  "guinevere-vexana": ["guinevere", "vexana"],
  "selena-obsidia": ["selena", "obsidia"],
};

const PAIR_IDS = Object.keys(PAIR_MEMBERS) as PairId[];

/** Every pair that one of the post's characters belongs to. */
export function pairsOf(post: Pick<DesignPost, "chars">): PairId[] {
  return PAIR_IDS.filter((id) => PAIR_MEMBERS[id].some((c) => post.chars.includes(c)));
}

// ---------------------------------------------------------------------------------------------
// What a post is made of
// ---------------------------------------------------------------------------------------------

/** The picture that stands for the post on the wall: the first slide, or the cover of a reel. */
export function coverOf(post: DesignPost): LibImage {
  const img = post.kind === "reel" ? post.video?.cover : post.slides?.[0]?.img;
  if (!img) throw new Error(`${post.id} has no picture`);
  return img;
}

export function paletteOf(post: DesignPost): Swatch[] {
  return (post.kind === "reel" ? post.video?.pal : post.slides?.[0]?.pal) ?? [];
}

/** Width and height of the piece as posted (the cover of a reel, the first slide otherwise). */
export function sizeOf(post: DesignPost): { w: number; h: number } {
  const c = coverOf(post);
  return { w: c.w, h: c.h };
}

export function aspectOf(post: DesignPost): number {
  const { w, h } = sizeOf(post);
  return w / h;
}

export function weightOf(post: DesignPost): number {
  if (post.kind === "reel") return post.video?.kb ?? 0;
  return (post.slides ?? []).reduce((sum, s) => sum + s.kb, 0);
}

const COMMON_RATIOS: ReadonlyArray<[number, number]> = [
  [1, 1],
  [4, 5],
  [5, 4],
  [3, 4],
  [4, 3],
  [2, 3],
  [3, 2],
  [9, 16],
  [16, 9],
  [191, 100],
  [1, 2],
  [2, 1],
];

/** `1080 x 1350` as `4:5`. Falls back to `1.78:1`. */
export function ratioLabel(w: number, h: number): string {
  const r = w / h;
  for (const [a, b] of COMMON_RATIOS) {
    if (Math.abs(r - a / b) / (a / b) < 0.012) return b === 100 ? "1.91:1" : `${a}:${b}`;
  }
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

/** `312 KB`, `1.4 MB`. */
export function sizeLabel(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB` : `${Math.round(kb)} KB`;
}

export function kindLabel(post: Pick<DesignPost, "kind" | "slides">): string {
  if (post.kind === "reel") return "Reel";
  if (post.kind === "carousel") return `Carousel, ${post.slides?.length ?? 0} slides`;
  return "Poster";
}

/** `1:04` from seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------------
// Dates (no Date object: a day is a day in every time zone)
// ---------------------------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

/** `2024-07-31` as `31 Jul 2024`. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}

/** `2024-07-31` as `31 Jul`. */
function dayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""}`;
}

/** The span of a campaign: `10 to 29 Jan 2022`, `24 Sep to 22 Oct 2022`, `22 Dec 2022 to 11 Jan 2023`. */
export function spanLabel(from: string, to: string): string {
  if (from === to) return formatDate(from);
  const sameYear = yearOf(from) === yearOf(to);
  const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
  if (sameMonth) return `${Number(from.slice(8))} to ${formatDate(to)}`;
  if (sameYear) return `${dayMonth(from)} to ${formatDate(to)}`;
  return `${formatDate(from)} to ${formatDate(to)}`;
}

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export interface Filters {
  q: string;
  pair: string;
  who: string;
  year: string;
  fmt: string;
  canon: string;
  topic: string;
}

export const NO_FILTERS: Filters = {
  q: "",
  pair: "",
  who: "",
  year: "",
  fmt: "",
  canon: "",
  topic: "",
};

export type FacetKey = Exclude<keyof Filters, "q">;

/** Words a search looks in: the title, the caption, the campaign, the tags and the account. */
export function haystack(post: DesignPost, campaign: DesignCampaign | undefined): string {
  return [
    post.title,
    post.caption,
    campaign?.title ?? "",
    post.tags.join(" "),
    post.account,
    post.kind,
  ]
    .join(" ")
    .toLowerCase();
}

/** Every word of the query must be somewhere in the text. */
export function matchesQuery(text: string, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => text.includes(w));
}

/**
 * Does the post pass the filters? `skip` leaves one facet out, so the counts of that facet's
 * chips show what each choice would give.
 */
export function passes(post: DesignPost, text: string, f: Filters, skip?: FacetKey | "q"): boolean {
  if (skip !== "q" && f.q.trim() && !matchesQuery(text, f.q)) return false;
  if (skip !== "pair" && f.pair && !pairsOf(post).includes(f.pair as PairId)) return false;
  if (skip !== "who" && f.who && !post.chars.includes(f.who as Slug)) return false;
  if (skip !== "year" && f.year && yearOf(post.date) !== f.year) return false;
  if (skip !== "fmt" && f.fmt && post.kind !== f.fmt) return false;
  if (skip !== "canon" && f.canon && post.canon !== f.canon) return false;
  if (skip !== "topic" && f.topic && !post.tags.includes(f.topic)) return false;
  return true;
}

export function activeCount(f: Filters): number {
  return (Object.keys(f) as Array<keyof Filters>).filter((k) => k !== "q" && f[k]).length;
}

// ---------------------------------------------------------------------------------------------
// The wall: rows of equal height that keep every picture's true shape
// ---------------------------------------------------------------------------------------------

interface RowItem {
  index: number;
  w: number;
}
export interface Row {
  h: number;
  items: RowItem[];
}

/**
 * Pack pictures into rows. A row is closed when its pictures, at the target height, fill the
 * width, and its height is then set so they fill it exactly. A last row that does not fill the
 * width keeps the target height and stays on the left. Widths are whole pixels.
 */
export function justify(
  aspects: readonly number[],
  width: number,
  target: number,
  gap: number,
): Row[] {
  const rows: Row[] = [];
  if (width <= 0 || aspects.length === 0) return rows;
  let cur: number[] = [];
  let sum = 0;
  const heightFor = (s: number, n: number) => (width - gap * (n - 1)) / s;
  const close = (indices: number[], s: number, last: boolean) => {
    const natural = heightFor(s, indices.length);
    const h = last && natural > target * 1.25 ? target : natural;
    const rowH = Math.round(h);
    const items = indices.map((index) => ({ index, w: Math.round((aspects[index] ?? 1) * rowH) }));
    if (!(last && natural > target * 1.25)) {
      // Make the row exactly as wide as the container.
      const used = items.reduce((n, it) => n + it.w, 0) + gap * (items.length - 1);
      const lastItem = items[items.length - 1];
      if (lastItem) lastItem.w += width - used;
    }
    rows.push({ h: rowH, items });
  };
  aspects.forEach((a, i) => {
    const ratio = Math.max(0.1, a);
    if (cur.length > 0) {
      const withIt = heightFor(sum + ratio, cur.length + 1);
      const without = heightFor(sum, cur.length);
      // Adding it would drop the row below the target: close the row before or after it,
      // whichever is nearer the target.
      if (withIt < target && Math.abs(withIt - target) > Math.abs(without - target)) {
        close(cur, sum, false);
        cur = [];
        sum = 0;
      }
    }
    cur.push(i);
    sum += ratio;
    if (heightFor(sum, cur.length) <= target) {
      close(cur, sum, false);
      cur = [];
      sum = 0;
    }
  });
  if (cur.length > 0) close(cur, sum, true);
  return rows;
}

/** The row height to aim for at a given content width. */
export function targetHeight(width: number): number {
  if (width < 520) return 190;
  if (width < 900) return 230;
  return Math.min(340, Math.max(250, Math.round(width / 4.1)));
}

/** The thumbnail is enough up to 480 device pixels on the long side; past that the preview. */
export function pickSize(w: number, h: number, dpr: number): "t" | "p" {
  return Math.max(w, h) * Math.max(1, dpr) > 480 ? "p" : "t";
}

// ---------------------------------------------------------------------------------------------
// The campaigns on the timeline
// ---------------------------------------------------------------------------------------------

export interface CampaignGroup {
  campaign: DesignCampaign;
  posts: DesignPost[];
}
export interface YearGroup {
  year: string;
  campaigns: CampaignGroup[];
}

/** The visible posts, grouped by the campaign and the year it began in, in the chosen order. */
export function groupByYear(
  campaigns: readonly DesignCampaign[],
  byId: ReadonlyMap<string, DesignPost>,
  visible: ReadonlySet<string>,
  newestFirst: boolean,
): YearGroup[] {
  const groups: CampaignGroup[] = [];
  for (const campaign of campaigns) {
    const posts = campaign.posts
      .filter((id) => visible.has(id))
      .map((id) => byId.get(id))
      .filter((p): p is DesignPost => Boolean(p));
    if (posts.length === 0) continue;
    groups.push({ campaign, posts: newestFirst ? [...posts].reverse() : posts });
  }
  groups.sort(
    (a, b) =>
      a.campaign.from.localeCompare(b.campaign.from) || a.campaign.id.localeCompare(b.campaign.id),
  );
  if (newestFirst) groups.reverse();
  const years: YearGroup[] = [];
  for (const g of groups) {
    const year = yearOf(g.campaign.from);
    const last = years[years.length - 1];
    if (last?.year === year) last.campaigns.push(g);
    else years.push({ year, campaigns: [g] });
  }
  return years;
}

/** One colour per post, for the strip under a campaign's name: each post's largest colour. */
export function campaignColours(posts: readonly DesignPost[], max = 14): string[] {
  return posts
    .map((p) => paletteOf(p)[0]?.[0])
    .filter((c): c is string => Boolean(c))
    .slice(0, max);
}

// ---------------------------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------------------------

export interface TextPart {
  text: string;
  href?: string;
}

/** A caption's paragraphs, with the web addresses in it marked as links. */
export function captionParts(caption: string): TextPart[][] {
  return caption.split(/\n+/).map((para) => {
    const parts: TextPart[] = [];
    let rest = para;
    for (;;) {
      const m = /https?:\/\/[^\s]+/.exec(rest);
      if (!m) break;
      const url = m[0].replace(/[.,;:!?)]+$/, "");
      if (m.index > 0) parts.push({ text: rest.slice(0, m.index) });
      parts.push({ text: url, href: url });
      rest = rest.slice(m.index + url.length);
    }
    if (rest) parts.push({ text: rest });
    return parts;
  });
}

// ---------------------------------------------------------------------------------------------
// The reel player
// ---------------------------------------------------------------------------------------------

export function videoSources(v: DesignVideo, libUrl: (key: string) => string) {
  return [{ label: `${v.h}p`, height: v.h > v.w ? v.w : v.h, src: libUrl(v.src) }];
}

/** Black text or white text, whichever reads better on the colour. */
export function inkOn(hex: string): "#0b0b0e" | "#ffffff" {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.58 ? "#0b0b0e" : "#ffffff";
}
