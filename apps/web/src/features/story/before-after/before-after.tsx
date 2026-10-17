import { ThemeZone } from "@/components/theme-zone";
import { contrasts } from "@/content/world";

import { SectionHead } from "../section-head";
import type { CalmMode, StormTone } from "./ambient-scenes";
import { ContrastTrack } from "./contrast-track";
import { Rhyme } from "./rhyme";

/** The scene and the Storm colour for each contrast, by id. */
const LOOKS: Readonly<Record<string, { mode: CalmMode; tone: StormTone }>> = {
  "dawnbreak-978": { mode: "skyline", tone: "violet" },
  "first-light": { mode: "lanterns", tone: "violet" },
  oro: { mode: "lamps", tone: "amber" },
  "oro-sky": { mode: "sky", tone: "amber" },
  graduation: { mode: "morning", tone: "violet" },
};

/**
 * The centrepiece. Each contrast is a pinned track: a calm statement, a line struck through it
 * as the colour drains, then the opposite statement as the Storm takes the screen. All of the
 * words come from `contrasts`, with the chapter each one is told in.
 */
export function BeforeAfter() {
  return (
    <section aria-labelledby="before-after-title">
      <ThemeZone theme="daybreak" className="pt-sp-2xl pb-sp-l">
        <div className="shell">
          <HeadWithLead />
        </div>
      </ThemeZone>
      {contrasts.map((contrast, i) => {
        const look = LOOKS[contrast.id] ?? { mode: "sky" as const, tone: "violet" as const };
        return (
          <ContrastTrack
            key={contrast.id}
            contrast={contrast}
            index={i + 1}
            total={contrasts.length}
            mode={look.mode}
            tone={look.tone}
          />
        );
      })}
      <Rhyme />
    </section>
  );
}

function HeadWithLead() {
  return (
    <SectionHead
      id="before-after-title"
      code="02 / Before and after"
      title="That was before"
      lead="Dawnbreak in 978, and Oro. Each calm claim stands until the story crosses it out. Scroll, drag the slider, or hold the button to look back."
    />
  );
}
