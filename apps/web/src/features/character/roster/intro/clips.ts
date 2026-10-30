import type { Slug } from "@/content/types";

/**
 * The welcome clips of the intro, cut from the game's recordings by `scripts/roster-intro/build.py`
 * (1600 by 720, 60 fps, no sound). `focus` is where the interesting part of the picture is, as
 * fractions, so the clip can be cropped into a slanted panel.
 */
export interface IntroClip {
  slug: Slug;
  src: string;
  from: number;
  duration: number;
  width: 1600;
  height: 720;
  focus: { x: number; y: number };
}

const clip = (slug: Slug, focus = { x: 0.5, y: 0.42 }): IntroClip => ({
  slug,
  src: `/video/roster-intro/${slug}.mp4`,
  from: 0,
  duration: 1.5,
  width: 1600,
  height: 720,
  focus,
});

export const INTRO_CLIPS: Record<Slug, IntroClip> = {
  fanny: clip("fanny"),
  layla: clip("layla"),
  ruby: clip("ruby"),
  angela: clip("angela"),
  lesley: clip("lesley"),
  change: clip("change"),
  guinevere: clip("guinevere"),
  vexana: clip("vexana"),
  obsidia: clip("obsidia"),
  selena: clip("selena"),
};
