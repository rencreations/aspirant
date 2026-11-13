"use client";

import { useEffect, useMemo, useSyncExternalStore, type CSSProperties } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { ThemeZone } from "@/components/theme-zone";
import { withBase } from "@/lib/asset";
import { useNavLock } from "@/lib/nav-lock";

import { useLibraryData } from "../data";
import { getCollection } from "../registry";
import { LibraryFooter } from "../shell/library-shell";
import { BackToCollection } from "../shell/room-chrome";
import styles from "./page.module.css";
import { parseSnapshot, progressSnapshot, subscribeProgress } from "./progress";
import { AsStage } from "./room/as-stage";
import { FanGallery } from "./room/gallery";
import { ComicHero } from "./room/hero";
import { OfficialSection } from "./room/official";
import { VgStage } from "./room/vg-stage";
import { comicPath } from "./route";
import type { ComicFile, ComicItem } from "./types";

const ROOM = getCollection("comic");

/**
 * The comic room. One whole screen for each of: the big COMIC, The Aspirant, Guinevere and Vexana
 * (each with its own button to the comic's page), then a pinboard of the fan comics and a foot with
 * one way back. Every comic is a page of its own, `/collection/comic/<slug>/`.
 */
export default function ComicPage() {
  const { data } = useLibraryData<ComicItem>("comic");
  const file = data as ComicFile | null;
  const { scrollTo } = useLenis();

  // The top bar is bare over the first three screens, and takes its plate (it fades in) once the wall
  // of fan comics reaches it, so the wall never slides under the menu buttons.
  useEffect(() => {
    let raf = 0;
    let plated: boolean | null = null;
    const apply = () => {
      raf = 0;
      const wall = document.getElementById("fan-comics");
      const navH =
        document.querySelector("header[data-overlay='nav']")?.getBoundingClientRect().height ?? 64;
      const over = wall ? wall.getBoundingClientRect().top <= navH : false;
      if (over === plated) return;
      plated = over;
      useNavLock.setState({ theme: "daybreak", bare: !over, fade: true, away: false });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      useNavLock.setState({ theme: null, bare: false, fade: false, away: false });
    };
  }, [file]);

  const comics = useMemo(() => file?.items ?? [], [file]);
  const official = useMemo(() => comics.filter((c) => c.kind === "official"), [comics]);
  const fans = useMemo(() => comics.filter((c) => c.kind === "fan"), [comics]);
  const aspirant = official.find((c) => c.slug === "the-aspirant");
  const guinevere = official.find((c) => c.slug === "guinevere-and-vexana");

  // The place of every comic. It follows the saves made by the reader, and other tabs.
  const ids = useMemo(() => comics.map((c) => c.id), [comics]);
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    () => progressSnapshot(ids),
    () => "",
  );
  const saved = useMemo(() => parseSnapshot(snapshot), [snapshot]);

  // An old link, `/collection/comic/?i=<id>&p=<page>`, goes to the page of the comic.
  useEffect(() => {
    if (!file) return;
    const params = new URLSearchParams(window.location.search);
    const found = file.items.find((c) => c.id === params.get("i"));
    if (!found) return;
    const p = params.get("p");
    window.location.replace(withBase(comicPath(found.slug)) + (p ? `?p=${p}` : ""));
  }, [file]);

  const toFirstComic = () => {
    const el = document.getElementById("the-aspirant");
    if (el) scrollTo(el.getBoundingClientRect().top + window.scrollY, { duration: 1.3 });
  };

  if (!file) return null;

  return (
    <ThemeZone
      theme="daybreak"
      as="div"
      className={styles.room}
      style={{ "--lib-colour": ROOM.colour, "--lib-ink": ROOM.ink } as CSSProperties}
    >
      <BackToCollection tone="dark" className={styles.back} />
      <ComicHero
        stage={file.stage}
        official={official.length}
        fans={fans.length}
        onCue={toFirstComic}
      />
      {aspirant ? (
        <OfficialSection
          id="the-aspirant"
          comic={aspirant}
          tone="as"
          first={file.stage.panels["as-first"]}
        >
          <AsStage stage={file.stage} />
        </OfficialSection>
      ) : null}
      {guinevere ? (
        <OfficialSection
          id="guinevere-and-vexana"
          comic={guinevere}
          tone="vg"
          first={file.stage.panels["gv-first"]}
        >
          <VgStage stage={file.stage} />
        </OfficialSection>
      ) : null}
      <FanGallery fans={fans} saved={saved} />
      <LibraryFooter slug="comic" variant="back" />
    </ThemeZone>
  );
}
