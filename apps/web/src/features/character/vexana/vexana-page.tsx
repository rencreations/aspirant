"use client";

import { About } from "./about/about";
import { ArtShowcase } from "./art/art";
import { Comics } from "./comics/comics";
import { Cover } from "./cover/cover";
import { Faces } from "./faces/faces";
import { Life } from "./life/life";
import { Opening } from "./opening/opening";
import { Reel } from "./reel/reel";
import { Skills } from "./skills/skills";

/**
 * Vexana's page: one long scroll, every section its own design (see
 * docs/superpowers/specs/2026-10-24-vexana-page-design.md). The order here is the order on screen.
 */
export function VexanaPage() {
  return (
    <div data-vexana>
      <Opening />
      <About />
      <Reel />
      <Skills />
      <Faces />
      <Cover />
      <Comics />
      <Life />
      <ArtShowcase />
    </div>
  );
}
