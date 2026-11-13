"use client";

import { useMemo, type CSSProperties } from "react";

import { pairs } from "@/content/pairs";

import { characterOptions, Chips } from "../../shell/controls";
import { useQueryState } from "../../use-query-state";
import { FanCard } from "../shelf";
import type { ComicItem } from "../types";
import styles from "./gallery.module.css";

interface Props {
  fans: readonly ComicItem[];
  /** The place each comic was left at, for "resume". */
  saved: Readonly<Record<string, number>>;
}

/**
 * The comics made by fans: a pinboard. Each card is a little tilted print with a strip of tape, under
 * the pair it is about; hover straightens it and lifts it. Who is in them can be chosen.
 */
export function FanGallery({ fans, saved }: Props) {
  const [who, setWho] = useQueryState("who");
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of fans) for (const w of c.chars) out[w] = (out[w] ?? 0) + 1;
    return out;
  }, [fans]);
  const options = characterOptions(counts).filter((o) => (o.count ?? 0) > 0);
  const shown = who ? fans.filter((c) => c.chars.some((w) => w === who)) : fans;

  // Under the pair they are about, each comic under one pair only: the pair the data names, else the
  // pair of the first person in it (a comic with people of two pairs is not shown twice).
  const groups = useMemo(() => {
    const byPair = new Map<string, ComicItem[]>();
    for (const c of shown) {
      const home =
        pairs.find((p) => p.id === c.pair)?.id ??
        pairs.find((p) => c.chars[0] !== undefined && p.members.includes(c.chars[0]))?.id ??
        pairs.find((p) => c.chars.some((w) => p.members.includes(w)))?.id;
      if (!home) continue;
      byPair.set(home, [...(byPair.get(home) ?? []), c]);
    }
    return pairs
      .filter((p) => byPair.has(p.id))
      .map((p) => ({ id: p.id, names: p.names, comics: byPair.get(p.id) ?? [] }));
  }, [shown]);

  return (
    <section id="fan-comics" className={styles.section} aria-labelledby="fan-comics-title">
      <header className={styles.head}>
        <p className="hud-label">Made by fans</p>
        <h2 id="fan-comics-title" className={`${styles.title} display`}>
          Fan comics
        </h2>
        <p className={styles.lede}>
          Jokes and parodies by readers, posted by the MGL creator programme. None of it happens in
          the story. Every comic names its artist and links to the post.
        </p>
      </header>

      {options.length > 1 ? (
        <div className={styles.filter}>
          <Chips
            label="Character"
            options={options}
            value={who}
            onChange={setWho}
            all={`All ${fans.length}`}
          />
        </div>
      ) : null}
      <p className={`${styles.status} hud-label`} role="status" aria-live="polite">
        {`${shown.length} of ${fans.length} fan comics`}
      </p>

      {groups.map((g) => (
        <div key={g.id} className={styles.group}>
          <h3 className={`${styles.pair} display`}>{g.names}</h3>
          <div className={styles.board}>
            {g.comics.map((c, i) => (
              <div
                key={c.id}
                className={styles.pin}
                style={
                  {
                    "--t": `${(i % 2 === 0 ? -1 : 1) * (0.7 + (i % 3) * 0.45)}deg`,
                  } as CSSProperties
                }
              >
                <span className={styles.tape} aria-hidden="true" />
                <FanCard comic={c} index={i} resume={saved[c.id] ?? null} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
