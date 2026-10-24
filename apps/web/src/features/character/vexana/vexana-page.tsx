"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";

import { About } from "./about/about";
import { ArtShowcase } from "./art/art";
import { Comics } from "./comics/comics";
import { Cover } from "./cover/cover";
import { Drama } from "./drama/drama";
import { Faces } from "./faces/faces";
import { Fanart } from "./fanart/fanart";
import { Guinevere } from "./guinevere/guinevere";
import { Opening } from "./opening/opening";
import { Process } from "./process/process";
import { Reel } from "./reel/reel";
import { Seam } from "./seams/seam";
import { Skills } from "./skills/skills";
import { Stream } from "./stream/stream";
import { useBackScale } from "./seams/use-back-scale";

/**
 * Vexana's page: one long scroll, every section its own design (see
 * docs/superpowers/specs/2026-10-24-vexana-page-design.md). The order here is the order on screen:
 * Opening, 01 Registry (About), 02 The film (Reel), 03 Craft (Skills), Faces, the interlude
 * (Cover), the comic, the livestream, the game, the 3D process, Guinevere, the art and the fanart.
 * Between two sections there is a seam (`seams/seam.tsx`), each its own; About rises over the
 * stuck Opening and the interlude over the stuck Faces.
 */
export function VexanaPage() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useBackScale(reduced);

  // The seams read the position of the joins, so they are measured again when the page grows or
  // shrinks (pictures arriving, a drawer opening).
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timer = 0;
    let height = el.offsetHeight;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.offsetHeight - height) < 2) return;
      height = el.offsetHeight;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 250);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={root} data-vexana style={{ overflowX: "clip" }}>
      <Opening />
      <About covers={!reduced} />
      <Seam kind="iris" />
      <Reel />
      <Seam kind="blinds" />
      <Skills />
      <Seam kind="slab" />
      <Faces />
      <Cover />
      <Seam kind="curtain" />
      <Comics />
      <Seam kind="crt" />
      <Stream />
      <Seam kind="pixels" />
      <Drama />
      <Seam kind="scan" />
      <Process />
      <Seam kind="heart" />
      <Guinevere />
      <Seam kind="wave" />
      <ArtShowcase />
      <Seam kind="paper" />
      <Fanart />
    </div>
  );
}
