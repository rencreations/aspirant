"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { withBase } from "@/lib/asset";

import { characterOptions, Chips } from "../shell/controls";
import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { comicPath } from "./route";
import { parseSnapshot, progressSnapshot, subscribeProgress } from "./progress";
import { FanCard, OfficialCard } from "./shelf";
import styles from "./page.module.css";
import type { ComicItem } from "./types";

/**
 * The comic room: a shelf (the two official webtoons, then the fan comics under a plain "not
 * canon" heading). Each comic is a page of its own, `/collection/comic/<slug>/`.
 */
export default function ComicPage() {
  const { data } = useLibraryData<ComicItem>("comic");
  const [who, setWho] = useQueryState("who");

  const comics = useMemo(() => data?.items ?? [], [data]);

  // An old link, `/collection/comic/?i=<id>&p=<page>`, goes to the page of the comic.
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const found = data.items.find((c) => c.id === params.get("i"));
    if (!found) return;
    const p = params.get("p");
    window.location.replace(withBase(comicPath(found.slug)) + (p ? `?p=${p}` : ""));
  }, [data]);
  const official = useMemo(() => comics.filter((c) => c.kind === "official"), [comics]);
  const fan = useMemo(() => comics.filter((c) => c.kind === "fan"), [comics]);

  // The place of every comic. It follows the saves made by the reader, and other tabs.
  const ids = useMemo(() => comics.map((c) => c.id), [comics]);
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    () => progressSnapshot(ids),
    () => "",
  );
  const saved = useMemo(() => parseSnapshot(snapshot), [snapshot]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of fan) for (const w of c.chars) out[w] = (out[w] ?? 0) + 1;
    return out;
  }, [fan]);
  const shownFan = who ? fan.filter((c) => c.chars.some((w) => w === who)) : fan;
  const options = characterOptions(counts).filter((o) => (o.count ?? 0) > 0);

  const totalPages = comics.reduce((n, c) => n + c.pages.length, 0);

  return (
    <LibraryShell
      slug="comic"
      count={data ? comics.length : null}
      stat={data ? `${totalPages} pages, ${official.length} official` : undefined}
    >
      <div className="shell">
        <section className={styles.section} aria-labelledby="comic-official">
          <header className={styles.head}>
            <p className="hud-label">Official</p>
            <h2 id="comic-official" className={`${styles.h} display`}>
              The two webtoons
            </h2>
            <p className={styles.lede}>
              Both are part of the story. Read them as one long scroll, with the text beside the
              page.
            </p>
          </header>
          <div className={styles.officialGrid}>
            {official.map((c, i) => (
              <OfficialCard key={c.id} comic={c} index={i} resume={saved[c.id] ?? null} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="comic-fan">
          <header className={styles.head}>
            <p className="hud-label">Made by fans</p>
            <h2 id="comic-fan" className={`${styles.h} display`}>
              Fan comics (not canon)
            </h2>
            <p className={styles.lede}>
              Jokes and parodies by readers, posted by the MGL creator programme. None of it happens
              in the story. Every comic names its artist and links to the post.
            </p>
          </header>
          {options.length > 1 ? (
            <div className={styles.filter}>
              <Chips
                label="Character"
                options={options}
                value={who}
                onChange={setWho}
                all={`All ${fan.length}`}
              />
            </div>
          ) : null}
          <p className={`${styles.status} hud-label`} role="status" aria-live="polite">
            {data ? `${shownFan.length} of ${fan.length} fan comics` : "Loading the fan comics"}
          </p>
          <div className={styles.fanGrid}>
            {shownFan.map((c, i) => (
              <FanCard key={c.id} comic={c} index={i} resume={saved[c.id] ?? null} />
            ))}
          </div>
        </section>
      </div>
    </LibraryShell>
  );
}
