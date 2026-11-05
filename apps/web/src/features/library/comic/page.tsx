"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import { characterOptions, Chips } from "../shell/controls";
import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import {
  parsePage,
  parseSnapshot,
  progressSnapshot,
  readProgress,
  subscribeProgress,
} from "./progress";
import { Reader } from "./reader";
import { FanCard, OfficialCard } from "./shelf";
import styles from "./page.module.css";
import type { ComicItem } from "./types";

/**
 * The comic room: a shelf (the two official webtoons, then the fan comics under a plain "not
 * canon" heading) and a reader that opens over it. `?i=<comic id>&p=<page>` opens the reader.
 */
export default function ComicPage() {
  const { data } = useLibraryData<ComicItem>("comic");
  const [openId, setOpenId] = useQueryState("i");
  const [pageParam, setPageParam] = useQueryState("p");
  const [who, setWho] = useQueryState("who");
  const openerRef = useRef<HTMLElement | null>(null);

  const comics = useMemo(() => data?.items ?? [], [data]);
  const official = useMemo(() => comics.filter((c) => c.kind === "official"), [comics]);
  const fan = useMemo(() => comics.filter((c) => c.kind === "fan"), [comics]);
  const open = comics.find((c) => c.id === openId) ?? null;

  // The place of every comic. It follows the saves made by the reader, and other tabs.
  const ids = useMemo(() => comics.map((c) => c.id), [comics]);
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    () => progressSnapshot(ids),
    () => "",
  );
  const saved = useMemo(() => parseSnapshot(snapshot), [snapshot]);

  const openComic = useCallback(
    (id: string) => {
      if (!openerRef.current && document.activeElement instanceof HTMLElement) {
        openerRef.current = document.activeElement;
      }
      setPageParam("");
      setOpenId(id);
    },
    [setOpenId, setPageParam],
  );

  const closeReader = useCallback(() => {
    setOpenId("");
    setPageParam("");
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  }, [setOpenId, setPageParam]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of fan) for (const w of c.chars) out[w] = (out[w] ?? 0) + 1;
    return out;
  }, [fan]);
  const shownFan = who ? fan.filter((c) => c.chars.some((w) => w === who)) : fan;
  const options = characterOptions(counts).filter((o) => (o.count ?? 0) > 0);

  const index = open ? comics.findIndex((c) => c.id === open.id) : -1;
  const prev = index > 0 ? (comics[index - 1] ?? null) : null;
  const next = index >= 0 && index < comics.length - 1 ? (comics[index + 1] ?? null) : null;
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
              <OfficialCard
                key={c.id}
                comic={c}
                index={i}
                resume={saved[c.id] ?? null}
                onOpen={openComic}
              />
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
              <FanCard
                key={c.id}
                comic={c}
                index={i}
                resume={saved[c.id] ?? null}
                onOpen={openComic}
              />
            ))}
          </div>
        </section>
      </div>

      {open ? (
        <Reader
          key={open.id}
          comic={open}
          prev={prev}
          next={next}
          startPage={parsePage(pageParam) ?? readProgress(open.id)}
          onClose={closeReader}
          onOpenComic={openComic}
          onPage={(n) => {
            setPageParam(String(n));
          }}
        />
      ) : null}
    </LibraryShell>
  );
}
