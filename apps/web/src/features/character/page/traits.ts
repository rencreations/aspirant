/**
 * Trait chips from the personality lines. Each chip is the lead of one line, cut at a
 * natural break, so it is always a verbatim piece of the content; the rest of the line is
 * kept beside it. Nothing is paraphrased.
 */
export interface Trait {
  /** The lead phrase, verbatim. */
  readonly chip: string;
  /** The remainder of the line after the chip, verbatim (may be empty). */
  readonly rest: string;
  /** The whole source line. */
  readonly source: string;
}

const MAX_CHIP = 40;

export function traitOf(line: string): Trait {
  const stop = line.search(/[.:;]/);
  const sentence = stop === -1 ? line : line.slice(0, stop);
  let chip = sentence;
  if (chip.length > MAX_CHIP) {
    const comma = sentence.indexOf(",", 8);
    if (comma !== -1 && comma <= MAX_CHIP + 8) chip = sentence.slice(0, comma);
    else chip = sentence.split(" ").slice(0, 5).join(" ");
  }
  const rest = line
    .slice(chip.length)
    .replace(/^[,.:;]\s*/, "")
    .trim();
  return { chip: chip.trim(), rest, source: line };
}

export function traitsOf(lines: readonly string[]): Trait[] {
  return lines.map(traitOf);
}
