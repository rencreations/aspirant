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
import { OffscreenPause } from "./seams/offscreen-pause";
import { Guinevere } from "./guinevere/guinevere";
import { MusicVideo } from "./music/music-video";
import { Opening } from "./opening/opening";
import { Process } from "./process/process";
import { Reel } from "./reel/reel";
import { Room, type NextCharacter } from "./room/room";
import { comicStreamHooks, interludeComicHooks } from "./seams/comic-link";
import { DoorGate } from "./seams/door-gate";
import { FilmArrive, GuinevereArrive } from "./seams/film-arrive";
import { Gate } from "./seams/gate";
import { HeartCover } from "./seams/heart-cover";
import { Hold } from "./seams/hold";
import { Liquid } from "./seams/liquid";
import { HOLD_SCREENS, UP_SCREENS } from "./seams/liquid-math";
import { Paper, Veil } from "./seams/paper";
import { Rise } from "./seams/rise";
import { RoomHeart } from "./seams/room-heart";
import { CrtScene } from "./seams/scenes/crt";
import { PixelScene } from "./seams/scenes/pixel";
import { storyHooks } from "./seams/story-link";
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
 * The craft to the story and back: the screens the craft's last screen is held for going down, and
 * the screens the pair's first screen is held for going back up, and the share of each at which the
 * doors start by themselves.
 */
const STORY_HOLD = 0.8;
const STORY_AT = 0.72;

/**
 * The interlude to the comic and the comic to the livestream, both with doors that play by time and
 * both ways: the screens the last screen of the section before is held for (going down), the screens
 * the first screen of the section after is held for (going back up), and the share of each at which
 * the doors start by themselves.
 */
const COMIC_HOLD = 0.8;
const COMIC_AT = 0.72;

/**
 * The film waits under the held screen of the registry, in place for the last stretch of the hold:
 * the screens the black liquid rises over when the visitor goes back up (`seams/liquid-math.ts`).
 * Going down the page jumps over that stretch while the white liquid has the screen covered.
 */
const FILM_OPEN = UP_SCREENS;

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
 *   Registry to the film  the dark voices are held, a white liquid rises over the scroll; when it
 *                         has covered the screen the scroll is locked, the page goes to the film
 *                         (waiting under it in place, `Under`), the liquid drains by time and the
 *                         film fades in by itself (`FilmArrive`); the scroll comes back when all of
 *                         it is in view. Back up from the film a BLACK liquid rises the same way, the
 *                         page goes to the voices, the black drains and the scroll comes back. Both
 *                         snap after a second of quiet (`seams/liquid.tsx`)
 *   the film to the craft the craft is laid over the held film like a sheet of paper (no snap)
 *   the craft to the pair white doors (`seams/door-gate.tsx`, TIME based, both ways): a little
 *                         scrolling on the held craft starts them; the scroll is LOCKED, they close,
 *                         the page goes to the pair, they open while the pair arrives from both sides,
 *                         and the scroll comes back when both halves can be pressed. Back up from the
 *                         pair, past its own threshold: the figures leave to the two sides, the ground
 *                         is plain, the doors open on the craft. A stop snaps after a second
 *   the pair to the interlude   the interlude rises over the held pair, narrow at first with a padding
 *                         at both sides that fills as it comes, its corners sharpening slowly then
 *                         quickly (square from 60 percent); the pair steps back (its ground stays whole)
 *   the interlude to the comic  dark doors (`seams/door-gate.tsx`, TIME based, both ways): a little
 *                         scrolling on the held interlude starts them; the scroll is LOCKED, they close,
 *                         the page goes to the comic, they open while its words, its disc and its
 *                         sticker come in, and the scroll comes back when Read and Watch can be
 *                         pressed. Back up from the comic, past its own threshold, the same doors
 *                         close on the comic and open on the interlude. A stop snaps after a second
 *   the comic to the stream     the comic's own halves are the doors (`seams/comic-link.ts`, the same
 *                         gate with clear doors, TIME based, both ways): the stage is pinned to the
 *                         screen, the page goes to the stream under it and the Watch half slides out
 *                         to the left with the whole disc while the Read half slides out to the
 *                         right. Back up from the stream they slide in over it and meet, the page goes
 *                         to the comic, and its words and sticker come in by time
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
      <OffscreenPause />
      <Opening />
      <Hold
        hold={HOLD_SCREENS}
        enabled={on}
        overlay={<Liquid />}
        className={on ? styles.aboutHold : undefined}
        style={on ? { zIndex: 3 } : undefined}
      >
        <About covers={false} />
      </Hold>
      <Under open={FILM_OPEN} enabled={on}>
        <Hold hold={1} shift={FILM_OPEN} enabled={on} overlay={<Veil />}>
          <FilmArrive>
            <Reel />
          </FilmArrive>
        </Hold>
      </Under>
      <Paper overlap={1} enabled={on}>
        <DoorGate
          id="craft-story"
          hold={STORY_HOLD}
          at={STORY_AT}
          closing={{ up: "instant" }}
          hooks={storyHooks}
          enabled={on}
        >
          <Skills />
        </DoorGate>
      </Paper>
      <UpZone id="craft-story" hold={STORY_HOLD} at={STORY_AT} idleMs={1000} enabled={on}>
        <Faces gated={on} />
      </UpZone>
      <DoorGate
        id="interlude-comic"
        hold={COMIC_HOLD}
        at={COMIC_AT}
        tone="comic"
        hooks={interludeComicHooks}
        enabled={on}
        className={on ? styles.coverGate : undefined}
        style={on ? { marginTop: "calc(var(--lvh) * -1)" } : undefined}
      >
        <Cover />
      </DoorGate>
      <UpZone id="interlude-comic" hold={COMIC_HOLD} at={COMIC_AT} idleMs={1000} enabled={on}>
        <DoorGate
          id="comic-stream"
          hold={COMIC_HOLD}
          at={COMIC_AT}
          tone="clear"
          closing={{ down: "instant", up: "instant" }}
          hooks={comicStreamHooks}
          enabled={on}
        >
          <Comics />
        </DoorGate>
      </UpZone>
      <UpZone id="comic-stream" hold={COMIC_HOLD} at={COMIC_AT} idleMs={1000} enabled={on}>
        <Gate id="stream-drama" enabled={on} hold={HOLD} at={AT} scene={PixelScene}>
          <Stream />
        </Gate>
      </UpZone>
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
