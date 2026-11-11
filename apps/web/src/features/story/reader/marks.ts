import raw from "@/content/marks.json";
import type { Seg } from "@/content/story-types";

/**
 * A mark: a phrase of one paragraph that explains itself. Where a reader first needs a name or a
 * term explained (or needs a reminder of it), the phrase is set apart and opens a few words about
 * it, with a way to the full page in the lore room of the collection. The text is never changed:
 * a mark only wraps the words that were already there. They are chosen by hand (see
 * `scripts/library/lore/codex/`), are few, and never repeat close together.
 */
export interface Mark {
  /** The paragraph number in the chapter (`c15-p022` is 22). */
  p: number;
  /** The words, exactly as they are in the paragraph, in one piece of it (not across an italic). */
  phrase: string;
  /** The entry of the codex it opens. */
  slug: string;
  name: string;
  kind: string;
  /** What it says, at most two sentences, safe to read at this point of the story. */
  tip: string;
}

const MARKS = raw as unknown as Readonly<Record<string, readonly Mark[]>>;

/** The marks of a chapter by paragraph number. */
export function marksOf(chapterId: string): ReadonlyMap<number, readonly Mark[]> {
  const out = new Map<number, Mark[]>();
  for (const m of MARKS[chapterId] ?? []) {
    const list = out.get(m.p) ?? [];
    list.push(m);
    out.set(m.p, list);
  }
  return out;
}

/** A piece of a paragraph: plain text, or the words of a mark. */
export interface Piece {
  t: string;
  em: boolean;
  mark?: Mark;
}

/**
 * Cuts the segments of a paragraph at the marked words. The pieces put back together are the
 * paragraph, letter for letter. A mark whose words are not in one segment is ignored here (the
 * checker `marks.test.ts` fails on it, so it never ships).
 */
export function splitSegs(segs: readonly Seg[], marks: readonly Mark[]): Piece[] {
  const out: Piece[] = [];
  const pending = [...marks];
  for (const seg of segs) {
    let rest = seg.t;
    const em = Boolean(seg.em);
    for (;;) {
      let at = -1;
      let hit: Mark | undefined;
      for (const m of pending) {
        const i = rest.indexOf(m.phrase);
        if (i >= 0 && (at < 0 || i < at)) {
          at = i;
          hit = m;
        }
      }
      if (!hit || at < 0) break;
      if (at > 0) out.push({ t: rest.slice(0, at), em });
      out.push({ t: hit.phrase, em, mark: hit });
      pending.splice(pending.indexOf(hit), 1);
      rest = rest.slice(at + hit.phrase.length);
    }
    if (rest.length > 0) out.push({ t: rest, em });
  }
  return out;
}
