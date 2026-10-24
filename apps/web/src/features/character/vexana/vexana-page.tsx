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
import { NavTone } from "./nav-tone";
import { Guinevere } from "./guinevere/guinevere";
import { Opening } from "./opening/opening";
import { Process } from "./process/process";
import { Reel } from "./reel/reel";
import { CraftDoors } from "./seams/doors";
import { Hold } from "./seams/hold";
import { Liquid } from "./seams/liquid";
import { Paper, Veil } from "./seams/paper";
import { Under } from "./seams/under";
import { useBackScale } from "./seams/use-back-scale";
import { Skills } from "./skills/skills";
import { Stream } from "./stream/stream";
import styles from "./vexana-page.module.css";

/**
 * Vexana's page: one long scroll, every section its own design (see
 * docs/superpowers/specs/2026-10-24-vexana-page-design.md). The order here is the order on screen:
 * Opening, 01 Registry (About), 02 The film (Reel), 03 Craft (Skills), Faces, the interlude
 * (Cover), the comic, the livestream, the game, the 3D process, Guinevere, the art and the fanart.
 *
 * The joins are made by the layout, not by anything laid over a section (`seams/`):
 *   Opening to Registry   the registry rises over the held signature screen
 *   Registry to the film  the dark voices are held, a liquid rises, then the page goes on by itself
 *   the film to the craft the craft is laid over the held film like a sheet of paper
 *   the craft to the pair white doors close on the held craft, the pair arrives from both sides
 *   the pair to the interlude   the interlude rises over the held pair, its corners sharpening
 *   the interlude to the comic  the held interlude, dark doors close and open on the comic
 *   the comic to the stream     the two halves of the comic open like doors on the stream
 * Every other join is a plain butt joint.
 */
export function VexanaPage() {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useBackScale(reduced);

  // The joins read the position of the sections, so they are measured again when the page grows
  // or shrinks (pictures arriving, a drawer opening).
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

  const on = !reduced;
  return (
    <div ref={root} data-vexana className={styles.page}>
      <NavTone />
      <Opening />
      <Hold
        hold={1.7}
        enabled={on}
        overlay={<Liquid />}
        className={on ? styles.aboutHold : undefined}
        style={on ? { zIndex: 3 } : undefined}
      >
        <About covers={false} />
      </Hold>
      <Hold hold={1} enabled={on} overlay={<Veil />}>
        <Reel />
      </Hold>
      <Paper overlap={1} enabled={on}>
        <Hold hold={2.4} enabled={on} overlay={<CraftDoors />}>
          <Skills />
        </Hold>
      </Paper>
      <div className={on ? styles.facesUnder : undefined}>
        <Faces gated={on} />
      </div>
      <Cover />
      <Comics />
      <Under open={1} enabled={on}>
        <Stream />
      </Under>
      <Drama />
      <Process />
      <Guinevere />
      <ArtShowcase />
      <Fanart />
    </div>
  );
}
