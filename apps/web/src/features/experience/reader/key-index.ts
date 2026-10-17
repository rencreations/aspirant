/** Lookups over the key lines (server and client safe). */
import { KEY_LINES, type KeyLine } from "./key-lines";

export const keyLineById: ReadonlyMap<string, KeyLine> = new Map(
  KEY_LINES.map((line) => [line.id, line]),
);

/** Key lines in a chapter, for the height estimate. */
export function keyLineCount(chapterId: string): number {
  let n = 0;
  for (const line of KEY_LINES) if (line.id.startsWith(`${chapterId}-p`)) n += 1;
  return n;
}
