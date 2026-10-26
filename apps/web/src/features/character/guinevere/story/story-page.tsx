"use client";

import type { Route } from "next";
import type { CSSProperties } from "react";

import { NextFooter } from "@/components/next-footer/next-footer";
import { ThemeZone } from "@/components/theme-zone";

import { WEB } from "../media";
import { AloneStory } from "./alone/alone-story";
import { PartnerStory } from "./partner/partner-story";
import { StoryBar } from "./story-bar";

export type StorySide = "alone" | "partner";

/** Her coral and gold for the first half and her red and amber for the second. */
const ACCENT: Record<StorySide, CSSProperties> = {
  alone: { "--accent": "#d9532a", "--accent-2": "#f2b63d" } as CSSProperties,
  partner: { "--accent": "#ff6a5f", "--accent-2": "#ffc24d" } as CSSProperties,
};

/**
 * One half of Guinevere's story. The page is the story itself, so a spoiler note sits at the top of
 * each half. The footer leads to the other half: from the stair into the years with a partner, or
 * back to the house with two hundred and forty windows.
 */
export function StoryPage({ side }: { side: StorySide }) {
  const alone = side === "alone";
  return (
    <>
      <ThemeZone
        theme={alone ? "daybreak" : "storm"}
        as="div"
        surface={false}
        data-story={side}
        style={ACCENT[side]}
      >
        <StoryBar side={side} />
        <div id="story">{alone ? <AloneStory /> : <PartnerStory />}</div>
      </ThemeZone>
      {/* The footer is in the other world: night after the first half, morning after the second. */}
      <ThemeZone
        theme={alone ? "storm" : "daybreak"}
        as="div"
        className="flow-root"
        style={ACCENT[alone ? "partner" : "alone"]}
      >
        <NextFooter
          eyebrow={alone ? "Part two" : "Part one"}
          label={alone ? "Partner" : "Alone"}
          sublabel={
            alone
              ? "A cupboard, a doughnut, a gold star and a hand she would not let go."
              : "Read it from the house with two hundred and forty windows."
          }
          href={`/character/guinevere/story/${alone ? "partner" : "alone"}` as Route}
          image={alone ? WEB.right : WEB.left}
          accent={alone ? "#ff6a5f" : "#d9532a"}
        />
      </ThemeZone>
    </>
  );
}
