import type { SectionMarkup } from "../../kernel/types";

/** The angled rows carry no words and no decoration of their own, so the plain page has nothing to show for them. */
export function view(): SectionMarkup {
  return { text: null };
}
