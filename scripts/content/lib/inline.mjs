// Inline markdown for the story: `*italic*` and `**bold**` only, as `short-v2.md` uses.
// Produces flat segments: { t: "text", text, em?, strong? }.

/**
 * @param {string} source one line (or paragraph) of markdown
 * @param {string} where location for error messages
 */
export function parseInline(source, where) {
  const segments = [];
  let em = false;
  let strong = false;
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const segment = { t: "text", text: buffer };
    if (em) segment.em = true;
    if (strong) segment.strong = true;
    segments.push(segment);
    buffer = "";
  };
  for (let i = 0; i < source.length; i += 1) {
    if (source.startsWith("**", i)) {
      flush();
      strong = !strong;
      i += 1;
    } else if (source[i] === "*") {
      flush();
      em = !em;
    } else {
      buffer += source[i];
    }
  }
  flush();
  if (em || strong) throw new Error(`Unbalanced * or ** at ${where}: ${source}`);
  return mergeSegments(segments);
}

/** Join neighbours that carry the same marks (and the same entity). */
export function mergeSegments(segments) {
  const out = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const last = out.at(-1);
    if (
      last &&
      last.t === "text" &&
      segment.t === "text" &&
      Boolean(last.em) === Boolean(segment.em) &&
      Boolean(last.strong) === Boolean(segment.strong)
    ) {
      out[out.length - 1] = { ...last, text: last.text + segment.text };
    } else {
      out.push(segment);
    }
  }
  return out;
}

/** The visible text of a segment list. */
export function plainText(segments) {
  return segments.map((segment) => segment.text).join("");
}

/** Strip the inline markers from markdown. */
export function stripMarkers(source) {
  return source.replaceAll("*", "");
}

export function countWords(text) {
  return text.split(/\s+/u).filter(Boolean).length;
}
