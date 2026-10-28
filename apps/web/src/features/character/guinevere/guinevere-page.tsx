"use client";

import type { Route } from "next";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/hooks";

import { Comics } from "../vexana/comics/comics";
import { Drama } from "../vexana/drama/drama";
import { Process } from "../vexana/process/process";
import { Reel } from "../vexana/reel/reel";
import { comicStreamHooks, interludeComicHooks } from "../vexana/seams/comic-link";
import { DoorGate } from "../vexana/seams/door-gate";
import { FilmArrive, GuinevereArrive } from "../vexana/seams/film-arrive";
import { HeartCover } from "../vexana/seams/heart-cover";
import { Hold } from "../vexana/seams/hold";
import { Liquid } from "../vexana/seams/liquid";
import { HOLD_SCREENS, UP_SCREENS } from "../vexana/seams/liquid-math";
import { OffscreenPause } from "../vexana/seams/offscreen-pause";
import { Paper, Veil } from "../vexana/seams/paper";
import { Rise } from "../vexana/seams/rise";
import { storyHooks } from "../vexana/seams/story-link";
import { Under } from "../vexana/seams/under";
import { UpZone } from "../vexana/seams/up";
import { useFreshStart } from "../vexana/seams/fresh-start";
import { useBackScale } from "../vexana/seams/use-back-scale";
import { About } from "./about/about";
import { ArtShowcase } from "./art/art";
import { Cover } from "./cover/cover";
import { Faces } from "./faces/faces";
import { Fanart } from "./fanart/fanart";
import { Friend } from "./friend/friend";
import styles from "./guinevere-page.module.css";
import { NavTone } from "./nav-tone";
import { BareScrollbar } from "../vexana/shared/bare-scrollbar";
import { MusicVideo } from "./music/music-video";
import { Opening } from "./opening/opening";
import { REEL_COPY, REEL_TITLE, REEL_TONE } from "./reel-copy";
import { Room } from "./room/room";
import { RoomHeart } from "./room/room-heart";
import { Skills } from "./skills/skills";
import { Stream } from "./stream/stream";

/** The craft to the story and back (see `vexana-page.tsx`, the joins are the same). */
const STORY_HOLD = 0.8;
const STORY_AT = 0.72;

/** The interlude to the comic and the comic to the livestream, both with doors that play by time. */
const COMIC_HOLD = 0.8;
const COMIC_AT = 0.72;

/** The film waits under the held screen of the registry (the screens the black liquid rises over). */
const FILM_OPEN = UP_SCREENS;

/** Her theme to her best friend: the hold of the music film, and the screens his section waits under it. */
const MUSIC_HOLD = 1.5;
const FRIEND_OPEN = 0.45;

/** The screens her best friend's last screen is held for while the heart of ink closes on it. */
const ROOM_HOLD = 1;

/** What the page needs to say about the next character (the room at the very end carries it). */
export interface NextCharacter {
  slug: string;
  name: string;
  aspirantName: string;
  tagline: string;
  order: number;
  href: Route;
  /** Public path of the splash art, for the footer. */
  image: string;
  /** Her accent colour, readable on the page. */
  accent: string;
}

/**
 * Guinevere's page: the same long scroll and the same joins as Vexana's (`../vexana/vexana-page.tsx`
 * lists them one by one, and `../vexana/seams/` makes them), with every section her own: the
 * opening with one photo of her, 01 the registry, 02 the film, 03 the craft, the pair of Alone and
 * Partner with her drones, the interlude, the comic, the livestream, the game, the 3D process, the
 * art with hers first, the fanart, her theme, her best friend (Vexana) and, at the very bottom, her
 * interactive room (the same idea as Vexana's), which also leads on to the next character. The comic, the interactive drama and the 3D process are Vexana's own
 * sections, unchanged, since the story in them belongs to both.
 */
export function GuinevereRoot({ next }: { next: NextCharacter }) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  useFreshStart();
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
    <div ref={root} data-vexana data-guinevere className={styles.page}>
      <NavTone />
      <BareScrollbar />
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
            <Reel copy={REEL_COPY} title={REEL_TITLE} tone={REEL_TONE} />
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
        <Stream />
      </UpZone>
      <Drama />
      <Process />
      <ArtShowcase />
      <Hold hold={1} enabled={on}>
        <Fanart />
      </Hold>
      <Rise id="fanart-music" enabled={on}>
        <Hold hold={MUSIC_HOLD} enabled={on} overlay={<HeartCover tone="ink" />}>
          <MusicVideo />
        </Hold>
      </Rise>
      <Under open={FRIEND_OPEN} enabled={on}>
        <Hold hold={ROOM_HOLD} shift={FRIEND_OPEN} enabled={on} overlay={<RoomHeart />}>
          <GuinevereArrive>
            <Friend />
          </GuinevereArrive>
        </Hold>
      </Under>
      <Room next={next} />
    </div>
  );
}
