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
import { MusicVideo } from "./music/music-video";
import { Opening } from "./opening/opening";
import { Process } from "./process/process";
import { Reel } from "./reel/reel";
import { loadRoomMedia, roomMediaReady } from "./room/room-load";
import { Room, type NextCharacter } from "./room/room";
import { CraftDoors } from "./seams/doors";
import { Gate } from "./seams/gate";
import { Hold } from "./seams/hold";
import { Liquid } from "./seams/liquid";
import { Paper, Veil } from "./seams/paper";
import { CrtScene } from "./seams/scenes/crt";
import { FilmScene } from "./seams/scenes/film";
import { FrameScene } from "./seams/scenes/frame";
import { HeartScene } from "./seams/scenes/heart";
import { IrisScene } from "./seams/scenes/iris";
import { PixelScene } from "./seams/scenes/pixel";
import { WallScene } from "./seams/scenes/wall";
import { Under } from "./seams/under";
import { useBackScale } from "./seams/use-back-scale";
import { Skills } from "./skills/skills";
import { Stream } from "./stream/stream";
import styles from "./vexana-page.module.css";

/** The room's first screen is fetched early (it is large), so the last transition rarely waits. */
const ROOM_WAIT = { ready: roomMediaReady, run: loadRoomMedia };
function warmRoom() {
  void loadRoomMedia(() => undefined);
}

/**
 * Vexana's page: one long scroll, every section its own design (see
 * docs/superpowers/specs/2026-10-24-vexana-page-design.md). The order here is the order on screen:
 * Opening, 01 Registry (About), 02 The film (Reel), 03 Craft (Skills), Faces, the interlude
 * (Cover), the comic, the livestream, the game, the 3D process, the art, the fanart, the music video,
 * Guinevere and, at the very bottom, the interactive room (which also leads on to the next character).
 *
 * The joins are made by the layout, not by anything laid over a section (`seams/`):
 *   Opening to Registry   the registry rises over the held signature screen
 *   Registry to the film  the dark voices are held, a liquid rises, then the page goes on by itself
 *   the film to the craft the craft is laid over the held film like a sheet of paper
 *   the craft to the pair white doors close on the held craft, the pair arrives from both sides
 *   the pair to the interlude   the interlude rises over the held pair, its corners sharpening
 *   the interlude to the comic  the held interlude, dark doors close and open on the comic
 *   the comic to the stream     the two halves of the comic open like doors on the stream
 * From the stream on, each section holds its last screen and shows a meter; a little more scrolling
 * starts a transition of its own that plays by itself (`seams/gate.tsx`, scenes in `seams/scenes/`):
 *   the stream to the game      a mosaic of pixels grows over the stream and goes out on the game
 *   the game to the 3D process  the screen collapses to a line and a dot, the workspace grid is drawn
 *   the 3D process to the art   the workspace turns away, picture frames drop in on wires
 *   the art to the fanart       a frame appears and the screen falls into it
 *   the fanart to her theme     a film panel is pulled across from the right
 *   her theme to her friend     a heart beats twice, swells and fills the screen with cream
 *   her friend to the room      a lens shuts (the room's videos load meanwhile) and opens on the room
 */
export function VexanaPage({ next }: { next: NextCharacter }) {
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
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: Player one"
        tone="dark"
        scene={PixelScene}
      >
        <Under open={1} enabled={on}>
          <Stream />
        </Under>
      </Gate>
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: 3D process"
        tone="dark"
        scene={CrtScene}
      >
        <Drama />
      </Gate>
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: Our artwork"
        tone="dark"
        scene={WallScene}
      >
        <Process />
      </Gate>
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: Fans creations"
        tone="dark"
        scene={FrameScene}
      >
        <ArtShowcase />
      </Gate>
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: Her theme"
        tone="light"
        scene={FilmScene}
        warm={warmRoom}
      >
        <Fanart />
      </Gate>
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: Her best friend"
        tone="dark"
        scene={HeartScene}
      >
        <MusicVideo />
      </Gate>
      <Gate
        enabled={on}
        hold={0.8}
        at={0.72}
        label="Keep scrolling: Her room"
        tone="light"
        scene={IrisScene}
        wait={ROOM_WAIT}
        warm={warmRoom}
      >
        <Guinevere />
      </Gate>
      <Room next={next} />
    </div>
  );
}
