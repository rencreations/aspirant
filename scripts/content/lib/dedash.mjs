// Replaces em-dashes (U+2014) and en-dashes (U+2013) by fixed rules, and logs each change.
//
// Rules, applied in this order:
//   1. number range        "15<en>17"            -> "15 to 17"
//   2. cut-off speech      `mean<em>"`           -> `mean..."` (the book's own mark for broken-off speech)
//   3. pause between words "world<em>and"        -> "world, and"
//   4. spaced pause        "you <em> I'm"        -> "you, I'm" (or a per-line override)
//   5. joined words        "a<en>b"              -> "a-b"
//   6. anything left       -> ", " and marked "fallback" in the report
//
// The dash characters are written as escapes so that this file passes the text scan.

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const DASH = new RegExp(`[${EM}${EN}]`, "u");

const RULES = [
  { name: "number range", re: new RegExp(`(\\d)\\s*${EN}\\s*(\\d)`, "gu"), to: "$1 to $2" },
  { name: "cut-off speech", re: new RegExp(`\\s*${EM}(?=["\\u201D])`, "gu"), to: "..." },
  {
    name: "pause between words",
    re: new RegExp(`([\\p{L}\\p{N}])${EM}([\\p{L}\\p{N}])`, "gu"),
    to: "$1, $2",
  },
  { name: "spaced pause", re: new RegExp(`\\s+${EM}\\s+`, "gu"), to: ", " },
  { name: "joined words", re: new RegExp(`([\\p{L}])${EN}([\\p{L}])`, "gu"), to: "$1-$2" },
  { name: "fallback", re: new RegExp(`\\s*[${EM}${EN}]\\s*`, "gu"), to: ", " },
];

/** Show a dash as a code point, so logs and reports never contain the character. */
export function visibleDashes(text) {
  return text.replaceAll(EM, "<U+2014>").replaceAll(EN, "<U+2013>");
}

export function hasDash(text) {
  return DASH.test(text);
}

/**
 * @param {string} text
 * @param {{ where: string, log?: Array<object>, override?: string }} options
 *   `override` replaces every spaced pause in this text (for example ": ").
 * @returns {string}
 */
export function dedash(text, { where, log, override } = { where: "" }) {
  if (!hasDash(text)) return text;
  let out = text;
  for (const rule of RULES) {
    const replacement = rule.name === "spaced pause" && override ? override : rule.to;
    out = out.replace(rule.re, (match, ...rest) => {
      const offset = rest.find((value) => typeof value === "number");
      const groups = rest.filter((value) => typeof value === "string");
      const after = replacement.replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] ?? "");
      if (log) {
        const start = Math.max(0, offset - 30);
        const end = Math.min(out.length, offset + match.length + 30);
        log.push({
          where,
          rule:
            rule.name === "spaced pause" && override
              ? `spaced pause (override "${override}")`
              : rule.name,
          before: visibleDashes(out.slice(start, end)),
          after: visibleDashes(
            out.slice(start, offset) + after + out.slice(offset + match.length, end),
          ),
        });
      }
      return after;
    });
  }
  if (hasDash(out)) throw new Error(`Dash left after dedash at ${where}: ${visibleDashes(out)}`);
  return out;
}
