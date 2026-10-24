"use client";

import type { Route } from "next";
import type { CSSProperties } from "react";

import { NextFooter } from "@/components/next-footer/next-footer";
import { ThemeZone } from "@/components/theme-zone";

import { FIGURES } from "../media";
import { AcademicStory } from "./academic/academic-story";
import { EnderStory } from "./ender/ender-story";
import { StoryBar } from "./story-bar";

export type StorySide = "academic" | "ender";

/** Her violet for the Academic half and her magenta for the Ender half. */
const ACCENT: Record<StorySide, CSSProperties> = {
  academic: { "--accent": "#7a4fd6", "--accent-2": "#e040a0" } as CSSProperties,
  ender: { "--accent": "#ff4fb8", "--accent-2": "#9b72ff" } as CSSProperties,
};

/**
 * One half of Vexana's story. The page is the story itself, so a spoiler note sits at the top of
 * each half. The footer leads to the other half: from the black gate into the void, or back to the
 * morning it began.
 */
export function StoryPage({ side }: { side: StorySide }) {
  const academic = side === "academic";
  return (
    <>
      <ThemeZone
        theme={academic ? "daybreak" : "storm"}
        as="div"
        surface={false}
        data-story={side}
        style={ACCENT[side]}
      >
        <StoryBar side={side} />
        <div id="story">{academic ? <AcademicStory /> : <EnderStory />}</div>
      </ThemeZone>
      {/* The footer is in the other world: night after the first half, morning after the second. */}
      <ThemeZone
        theme={academic ? "storm" : "daybreak"}
        as="div"
        className="flow-root"
        style={ACCENT[academic ? "ender" : "academic"]}
      >
        <NextFooter
          eyebrow={academic ? "Part two" : "Part one"}
          label={academic ? "Ender" : "Academic"}
          sublabel={
            academic
              ? "What she did after the black gate."
              : "Read it from the north gate, in the morning."
          }
          href={`/character/vexana/story/${academic ? "ender" : "academic"}` as Route}
          image={academic ? FIGURES.enderSide : FIGURES.normalSide}
          accent={academic ? "#ff4fb8" : "#7a4fd6"}
        />
      </ThemeZone>
    </>
  );
}
