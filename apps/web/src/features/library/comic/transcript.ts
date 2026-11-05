import type { ComicItem, ComicPage, SequenceEntry, TranscriptBlock, TranscriptLine } from "./types";

/** The blocks of a transcript that cover page `n`. A page can be in two blocks (the source overlaps once). */
export function blocksForPage(
  blocks: readonly TranscriptBlock[] | undefined,
  n: number,
): Array<{ index: number; block: TranscriptBlock }> {
  if (!blocks) return [];
  const out: Array<{ index: number; block: TranscriptBlock }> = [];
  blocks.forEach((block, index) => {
    if (block.from <= n && n <= block.to) out.push({ index, block });
  });
  return out;
}

/** "Page 4" or "Pages 5 to 10". */
export function rangeLabel(from: number, to: number): string {
  return from === to ? `Page ${from}` : `Pages ${from} to ${to}`;
}

/** The reading order: every page, with a gap entry for each page number the source lacks. */
export function sequenceOf(comic: Pick<ComicItem, "pages" | "missing">): SequenceEntry[] {
  const byN = new Map<number, ComicPage>(comic.pages.map((p) => [p.n, p]));
  const numbers = [...comic.pages.map((p) => p.n), ...comic.missing].sort((a, b) => a - b);
  return numbers.map((n): SequenceEntry => {
    const page = byN.get(n);
    return page ? { kind: "page", n, page } : { kind: "missing", n };
  });
}

/** A short list of numbers for a sentence: "3", "3 and 23", "3, 23 and 40". */
export function listNumbers(numbers: readonly number[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

/** The pages a transcript covers, as the first and the last page it has text for. */
export function transcriptSpan(
  blocks: readonly TranscriptBlock[] | undefined,
): { from: number; to: number } | null {
  if (!blocks || blocks.length === 0) return null;
  return {
    from: Math.min(...blocks.map((b) => b.from)),
    to: Math.max(...blocks.map((b) => b.to)),
  };
}

/** Lines of a block grouped so one speaker's run of lines shows the name once. */
export interface LineGroup {
  kind: TranscriptLine["k"];
  who: string | null;
  lines: string[];
}

export function groupLines(lines: readonly TranscriptLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    const who = line.k === "say" ? (line.who ?? null) : null;
    if (last?.kind === line.k && last.who === who && line.k === "say") {
      last.lines.push(line.t);
    } else {
      groups.push({ kind: line.k, who, lines: [line.t] });
    }
  }
  return groups;
}
