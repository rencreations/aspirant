import type { SectionMarkup } from "../../kernel/types";
import { Stub } from "../../ui";

/** The angled rows carry no words, so the plain page has nothing to show for them. */
export function view(): SectionMarkup {
  return {
    below: <Stub id="rows" note="angled rows and the small video" />,
    text: null,
  };
}
