import type { ReactNode } from "react";

import { HomeStage } from "./home-stage";
import styles from "./home.module.css";
import { flowScreens, layoutSections, trackScreens } from "./kernel/layout";
import { SECTIONS } from "./kernel/sections";
import { VIEWS } from "./views";

/**
 * The home page as the server draws it: every section's real copy and links in the page's HTML (so
 * crawlers and visitors without scripts get all of it), put into the layers of `HomeStage`. Each
 * section has a slot in the decorative layer and one in the text layer; the last section's text
 * sits in the page's flow after the scroll room. See `docs/design/home/kernel.md`.
 */
export function HomePage() {
  const layout = layoutSections(SECTIONS);
  const below: ReactNode[] = [];
  const text: ReactNode[] = [];
  let flow: ReactNode = null;

  for (const p of layout.placed) {
    const markup = VIEWS[p.id]();
    below.push(
      <div
        key={p.id}
        className={`${styles.slot} ${styles.slotBelow}`}
        data-home-below={p.id}
        data-theme={p.def.nav.theme}
        data-on="0"
      >
        {markup.below}
      </div>,
    );
    if (p.def.dom === "flow") {
      flow = (
        <section
          className={styles.flowStage}
          data-home-section={p.id}
          data-home-text={p.id}
          data-theme={p.def.nav.theme}
        >
          {markup.text}
        </section>
      );
      continue;
    }
    const empty = markup.text === null;
    text.push(
      <section
        key={p.id}
        className={`${styles.slot} ${styles.slotText}${empty ? ` ${styles.slotEmpty}` : ""}`}
        data-home-section={p.id}
        data-home-text={p.id}
        data-theme={p.def.nav.theme}
        data-on="0"
      >
        <div className={styles.content} data-home-content="">
          {markup.text}
        </div>
      </section>,
    );
  }

  return (
    <HomeStage
      trackScreens={trackScreens(layout)}
      flowScreens={flowScreens(layout)}
      below={below}
      text={text}
      flow={flow}
    />
  );
}
