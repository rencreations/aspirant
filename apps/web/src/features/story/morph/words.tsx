/**
 * A line of text as one span per word (with plain spaces between them), so the chapter morph can
 * move each word from where it sits in the card to where it sits in the title card, whatever the
 * line breaks are on either side. Inline spans change nothing in the layout; `block` makes them
 * inline blocks, which a transform can move (the copy in the morph layer).
 */
import { Fragment } from "react";

import s from "./morph.module.css";

export function Words({ text, block = false }: { text: string; block?: boolean }) {
  const words = text.split(/\s+/u).filter(Boolean);
  return words.map((word, i) => (
    <Fragment key={i}>
      {i > 0 ? " " : null}
      <span className={block ? s.word : undefined} data-w="">
        {word}
      </span>
    </Fragment>
  ));
}
