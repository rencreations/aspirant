// Entity annotation: turns names, places and terms in text segments into
// { t: "ent", id, text } segments, using the aliases from `entities.ts`.
//
// Matching is case-sensitive and whole-word (letters, digits and hyphens count as word
// characters, so "Ender-stuff" and "Guinevere" do not match "Ender" or "Guin").
// The longest alias wins where two overlap ("Gantry Square" before "gantry").

const WORD = "[\\p{L}\\p{N}-]";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {ReadonlyArray<{ id: string, aliases: readonly string[] }>} entities
 */
export function buildMatcher(entities) {
  const aliases = [];
  const seen = new Map();
  for (const entity of entities) {
    for (const alias of entity.aliases) {
      if (seen.has(alias) && seen.get(alias) !== entity.id) {
        throw new Error(`Alias "${alias}" is used by both ${seen.get(alias)} and ${entity.id}`);
      }
      seen.set(alias, entity.id);
      aliases.push({ alias, id: entity.id });
    }
  }
  aliases.sort((a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias));
  const pattern = aliases.map(({ alias }) => escapeRegExp(alias)).join("|");
  const re = new RegExp(`(?<!${WORD})(?:${pattern})(?!${WORD})`, "gu");
  const idOf = new Map(aliases.map(({ alias, id }) => [alias, id]));
  return { re, idOf };
}

/** Every alias match in a string, as { start, end, text, id }. */
export function findMatches(matcher, text) {
  const out = [];
  matcher.re.lastIndex = 0;
  for (const match of text.matchAll(matcher.re)) {
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      id: matcher.idOf.get(match[0]),
    });
  }
  return out;
}

/**
 * Annotate a segment list.
 *
 * @param {Array<object>} segments flat text segments
 * @param {object} matcher from buildMatcher
 * @param {(id: string) => boolean} shouldAnnotate decides each match in order; it may keep state
 */
export function annotateSegments(segments, matcher, shouldAnnotate) {
  const out = [];
  for (const segment of segments) {
    if (segment.t !== "text") {
      out.push(segment);
      continue;
    }
    const marks = {};
    if (segment.em) marks.em = true;
    if (segment.strong) marks.strong = true;
    let cursor = 0;
    for (const match of findMatches(matcher, segment.text)) {
      if (!shouldAnnotate(match.id)) continue;
      if (match.start > cursor) {
        out.push({ t: "text", text: segment.text.slice(cursor, match.start), ...marks });
      }
      out.push({ t: "ent", id: match.id, text: match.text, ...marks });
      cursor = match.end;
    }
    if (cursor < segment.text.length) {
      out.push({ t: "text", text: segment.text.slice(cursor), ...marks });
    }
  }
  return out;
}
