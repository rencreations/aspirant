import type { AtlasItem, Block, LoreText } from "./types";

/** A piece of a line of text, marked when it matches the search. */
export interface Part {
  text: string;
  hit: boolean;
}

/** A matching passage of a text, with the heading it sits under (for a deep link). */
export interface Snippet {
  headingId: string | null;
  heading: string | null;
  text: string;
}

export interface Result {
  text: LoreText;
  score: number;
  titleHit: boolean;
  /** How many times the words occur in the body. */
  hits: number;
  snippets: Snippet[];
}

/** The lines of text a block holds (a list gives one per item). */
export function blockStrings(b: Block): string[] {
  switch (b.t) {
    case "h":
    case "p":
    case "q":
    case "sub":
    case "note":
      return [b.x];
    case "ul":
    case "ol":
      return b.i;
    case "kv":
      return b.rows.map(([k, v]) => `${k}: ${v}`);
    case "tb":
      return [b.head.join(" "), ...b.rows.map((r) => r.join(" "))];
    case "rel":
      return [b.x, ...b.rows.map((r) => `${r.w} ${r.r}`)];
    case "chart":
      return b.rows.map((r) => `${r.a} ${r.l} ${r.b}`);
    case "hr":
      return [];
  }
}

/** The words of a search box: lower case, no punctuation, no repeats, at most six. */
export function parseTerms(q: string): string[] {
  const words = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .split(" ")
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
  return [...new Set(words)].slice(0, 6);
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split a line into plain and matching parts. */
export function highlight(text: string, terms: readonly string[]): Part[] {
  if (terms.length === 0 || !text) return [{ text, hit: false }];
  const alt = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(escapeRx)
    .join("|");
  const rx = new RegExp(alt, "gi");
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(rx)) {
    if (m[0] === "") continue;
    if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length > 0 ? parts : [{ text, hit: false }];
}

/** A window of `text` around the first match, cut at word edges. */
export function windowAround(
  text: string,
  terms: readonly string[],
  before = 70,
  after = 120,
): string {
  const lower = text.toLowerCase();
  let at = -1;
  let len = 0;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) {
      at = i;
      len = t.length;
    }
  }
  if (at === -1 || text.length <= before + after) return text;
  let start = Math.max(0, at - before);
  let end = Math.min(text.length, at + len + after);
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp !== -1 && sp < at) start = sp + 1;
  }
  if (end < text.length) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > at + len) end = sp;
  }
  return `${start > 0 ? "..." : ""}${text.slice(start, end).trim()}${end < text.length ? "..." : ""}`;
}

interface Prepared {
  title: string;
  body: string;
}

const prepared = new WeakMap<LoreText, Prepared>();

function prepare(t: LoreText): Prepared {
  let p = prepared.get(t);
  if (!p) {
    p = {
      title: t.title.toLowerCase(),
      body: t.blocks.flatMap(blockStrings).join("\n").toLowerCase(),
    };
    prepared.set(t, p);
  }
  return p;
}

function countOf(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/** Every text that holds all the words, title or body, best first. */
export function searchTexts(texts: readonly LoreText[], q: string, maxSnippets = 3): Result[] {
  const terms = parseTerms(q);
  if (terms.length === 0) return [];
  const out: Result[] = [];
  texts.forEach((text, order) => {
    const p = prepare(text);
    let hits = 0;
    let titleHits = 0;
    for (const t of terms) {
      const inTitle = p.title.includes(t);
      const inBody = countOf(p.body, t);
      if (!inTitle && inBody === 0) return;
      if (inTitle) titleHits += 1;
      hits += inBody;
    }
    const titleHit = titleHits > 0;
    out.push({
      text,
      score: titleHits * 40 + Math.min(hits, 30) - order * 0.001,
      titleHit,
      hits,
      snippets: snippetsOf(text, terms, maxSnippets),
    });
  });
  return out.sort((a, b) => b.score - a.score);
}

/** The best few passages of a text for the words, in reading order. */
export function snippetsOf(text: LoreText, terms: readonly string[], max = 3): Snippet[] {
  interface Cand {
    at: number;
    score: number;
    str: string;
    headingId: string | null;
    heading: string | null;
  }
  const cands: Cand[] = [];
  let headingId: string | null = null;
  let heading: string | null = null;
  let at = 0;
  for (const b of text.blocks) {
    if (b.t === "h") {
      headingId = b.id;
      heading = b.x;
    }
    for (const str of blockStrings(b)) {
      at += 1;
      if (b.t === "h") continue;
      const low = str.toLowerCase();
      const score = terms.filter((t) => low.includes(t)).length;
      if (score > 0) cands.push({ at, score, str, headingId, heading });
    }
  }
  return cands
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, max)
    .sort((a, b) => a.at - b.at)
    .map((c) => ({ headingId: c.headingId, heading: c.heading, text: windowAround(c.str, terms) }));
}

/** The headings of a text, for the contents list. */
export function outline(
  blocks: readonly Block[],
): Array<{ id: string; text: string; level: 2 | 3 | 4 }> {
  const out: Array<{ id: string; text: string; level: 2 | 3 | 4 }> = [];
  for (const b of blocks) if (b.t === "h") out.push({ id: b.id, text: b.x, level: b.l });
  return out;
}

/** Does an atlas item (or any record) match every word, in its name or passage? */
export function matchesAll(haystack: string, terms: readonly string[]): boolean {
  const low = haystack.toLowerCase();
  return terms.every((t) => low.includes(t));
}

/** The atlas plates that sit in the chosen layer (or all) and hold every word in their name or passages. */
export function atlasMatches(
  atlas: readonly AtlasItem[],
  layer: string,
  terms: readonly string[],
): AtlasItem[] {
  return atlas.filter(
    (a) =>
      (layer === "" || a.layer === layer) &&
      (terms.length === 0 ||
        matchesAll([a.name, a.text, ...a.more.map((m) => m.text)].join(" "), terms)),
  );
}
