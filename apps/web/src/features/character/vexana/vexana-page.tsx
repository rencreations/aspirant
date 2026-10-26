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
import { Room, type NextCharacter } from "./room/room";
import { CraftDoors } from "./seams/doors";
import { FilmArrive, GuinevereArrive } from "./seams/film-arrive";
import { Gate } from "./seams/gate";
import { HeartCover } from "./seams/heart-cover";
import { Hold } from "./seams/hold";
import { Liquid } from "./seams/liquid";
import { Paper, Veil } from "./seams/paper";
import { Rise } from "./seams/rise";
import { RoomHeart } from "./seams/room-heart";
import { CrtScene } from "./seams/scenes/crt";
import { PixelScene } from "./seams/scenes/pixel";
import { FanScene, WallScene } from "./seams/scenes/fall";
import { Under } from "./seams/under";
import { UpZone } from "./seams/up";
import { useBackScale } from "./seams/use-back-scale";
import { Skills } from "./skills/skills";
import { Stream } from "./stream/stream";
import styles from "./vexana-page.module.css";

/** Screens of scrolling a boundary of the lower page holds a screen for, and the share of it at which the scene starts. */
const HOLD = 0.8;
const AT = 0.72;

/**
 * The film waits under the held screen of the registry, in place for the last stretch of the liquid
 * (the screens of the hold left after the liquid has covered it: 1.7 * (1 - 0.8)), so it needs no
 * scrolling to be seen once the liquid has drained.
 */
const FILM_OPEN = 0.34;

/**
 * Her theme to her best friend: the screens of the hold of the music film, and the screens her
 * section waits under it (the part of the hold after the cream heart has shut, 1.5 * (1 - 0.7)).
 */
const MUSIC_HOLD = 1.5;
const GUINEVERE_OPEN = 0.45;
/** Her best friend to the room: the screens her last screen is held for (the black heart closes over them). */
const ROOM_HOLD = 1;

/**
 * Vexana's page: one long scroll, every section its own design (see
 * docs/superpowers/specs/2026-10-24-vexana-page-design.md). The order here is the order on screen:
 * Opening, 01 Registry (About), 02 The film (Reel), 03 Craft (Skills), Faces, the interlude
 * (Cover), the comic, the livestream, the game, the 3D process, the art, the fanart, the music video,
 * Guinevere and, at the very bottom, the interactive room (which also leads on to the next character).
 *
 * The joins are made by the layout, not by anything laid over a section (`seams/`). The ones that
 * follow the scroll (all but the first and the third) can never be left half way: stop in one and,
 * after a moment (`seams/snap.ts`), the page goes on by itself from the half on and goes back
 * before it, in both directions, with the progress in the one bar at the left of the screen:
 *   Opening to Registry   the registry rises over the held signature screen (no snap)
 *   Registry to the film  the dark voices are held, a liquid rises; when it has covered the screen
 *                         the registry is hidden, the liquid drains by time and the film, waiting
 *                         under it in place (`Under`), fades in by itself (`FilmArrive`)
 *   the film to the craft the craft is laid over the held film like a sheet of paper (no snap)
 *   the craft to the pair white doors close on the held craft; once they have met the pair arrives
 *                         from both sides by time and can be pressed at once (`facesUnder`)
 *   the pair to the interlude   the interlude rises over the held pair, full width, its corners
 *                         sharpening slowly then quickly (square from 60 percent)
 *   the interlude to the comic  dark doors close on the held interlude; once they have met they open
 *                         by themselves on the comic, which waits in place under them
 *   the comic to the stream     the two halves of the comic open like doors on the stream
 * From the stream to Our Artwork's end (`seams/gate.tsx` and `seams/up.tsx`, scenes in `seams/scenes/`),
 * each join is a boundary that works both ways. Going down, the section holds its last screen and a
 * little more scrolling starts a transition that plays by itself; the section after it has no
 * threshold at its top. Going up from its top there is a threshold, the same scene plays again and
 * lands on the last screen of the section before, with no threshold above it. A stop inside a
 * threshold snaps after a moment (`seams/snap.ts`): from the half on it goes on, before it goes back:
 *   the stream to the game      a mosaic of pixels grows over the stream and goes out on the game
 *   the game to the 3D process  the screen collapses to a line and a dot, the workspace grid is drawn
 *   the 3D process to the art   the workspace turns away, gold frames of the official artwork drop in
 *   the art to the fanart       the fan prints fall in over the gallery and on out of the screen
 * Then three joins that follow the scroll, with no threshold and no overlay left standing:
 *   the fanart to her theme     her theme rises over the held fanart like a page (`seams/rise.tsx`)
 *   her theme to her friend     cream with a heart cut out of it closes on the held film from all the
 *                               sides (`seams/heart-cover.tsx`); when it has shut, her section (waiting
 *                               in place under it) fades in by itself and the cream fades away
 *   her friend to the room      black with a heart cut out of it closes on her held last screen
 *                               (`seams/room-heart.tsx`); under the black the page waits, with a real
 *                               line of progress, for the room's videos, jumps to the room, and the
 *                               black fades out as its welcome begins. Back (in the room) plays the
 *                               heart the other way
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
      <Under open={FILM_OPEN} enabled={on}>
        <Hold hold={1} enabled={on} overlay={<Veil />}>
          <FilmArrive>
            <Reel />
          </FilmArrive>
        </Hold>
      </Under>
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
      <Gate id="stream-drama" enabled={on} hold={HOLD} at={AT} scene={PixelScene}>
        <Under open={1} enabled={on}>
          <Stream />
        </Under>
      </Gate>
      <UpZone id="stream-drama" enabled={on} hold={HOLD} at={AT}>
        <Gate id="drama-process" enabled={on} hold={HOLD} at={AT} scene={CrtScene}>
          <Drama />
        </Gate>
      </UpZone>
      <UpZone id="drama-process" enabled={on} hold={HOLD} at={AT}>
        <Gate id="process-art" enabled={on} hold={HOLD} at={AT} scene={WallScene}>
          <Process />
        </Gate>
      </UpZone>
      <UpZone id="process-art" enabled={on} hold={HOLD} at={AT}>
        <Gate id="art-fanart" enabled={on} hold={HOLD} at={AT} scene={FanScene}>
          <ArtShowcase />
        </Gate>
      </UpZone>
      <UpZone id="art-fanart" enabled={on} hold={HOLD} at={AT}>
        <Hold hold={1} enabled={on}>
          <Fanart />
        </Hold>
      </UpZone>
      <Rise id="fanart-music" enabled={on}>
        <Hold hold={MUSIC_HOLD} enabled={on} overlay={<HeartCover />}>
          <MusicVideo />
        </Hold>
      </Rise>
      <Under open={GUINEVERE_OPEN} enabled={on}>
        <Hold hold={ROOM_HOLD} shift={GUINEVERE_OPEN} enabled={on} overlay={<RoomHeart />}>
          <GuinevereArrive>
            <Guinevere />
          </GuinevereArrive>
        </Hold>
      </Under>
      <Room next={next} />
    </div>
  );
}
