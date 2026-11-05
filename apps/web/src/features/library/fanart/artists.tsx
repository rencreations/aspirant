"use client";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";
import { TLink } from "@/components/transition/t-link";

import { canonLabel, formatDate, type ArtistGroup, type PostGroup } from "./model";
import type { FanItem } from "./types";
import styles from "./artists.module.css";
import { VideoEntry } from "./video-row";

interface Props {
  artists: readonly ArtistGroup[];
  posts: readonly PostGroup[];
  official: readonly FanItem[];
  unnamed: readonly FanItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
}

function Thumb({
  item,
  active,
  onOpen,
}: {
  item: FanItem;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  if (item.kind === "video") {
    return (
      <li className={`${styles.thumb} ${styles.videoThumb}`}>
        <VideoEntry item={item} />
      </li>
    );
  }
  return (
    <li className={styles.thumb}>
      <button
        type="button"
        className={styles.pic}
        data-active={active ? "true" : undefined}
        style={{ backgroundColor: item.img.c }}
        aria-label={`${item.title}. Open`}
        onClick={() => {
          audio.blip("click");
          onOpen(item.id);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={libUrl(item.img.t)} alt="" loading="lazy" decoding="async" draggable={false} />
        {item.kind === "cosplay" ? <span className={styles.tag}>Cosplay</span> : null}
      </button>
    </li>
  );
}

function Strip({
  items,
  activeId,
  onOpen,
}: {
  items: readonly FanItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className={styles.strip}>
      {items.map((it) => (
        <Thumb key={it.id} item={it} active={it.id === activeId} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function Counts({ creative, animated }: { creative: number; animated: number }) {
  return (
    <p className={`${styles.counts} hud-label`}>
      <span>
        <b>{creative}</b> creative
      </span>
      <span>
        <b>{animated}</b> animated
      </span>
    </p>
  );
}

function Block({
  id,
  colour,
  title,
  sub,
  counts,
  link,
  children,
}: {
  id: string;
  colour: string;
  title: string;
  sub?: string | null;
  counts: { creative: number; animated: number };
  link?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.block} style={{ ["--c" as string]: colour }} aria-labelledby={id}>
      <header className={styles.head}>
        <div className={styles.who}>
          <h3 id={id} className={`${styles.name} display`}>
            {title}
          </h3>
          {sub ? <p className={`${styles.sub} hud-label`}>{sub}</p> : null}
        </div>
        <Counts {...counts} />
        {link ? (
          <TLink href={link as `https://${string}`} className="link">
            View the original
          </TLink>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function tally(items: readonly FanItem[]) {
  const animated = items.filter((i) => i.kind === "video").length;
  return { creative: items.length - animated, animated };
}

/** The By artist view: pieces under the artist who made them, with counts. */
export function Artists({ artists, posts, official, unnamed, activeId, onOpen }: Props) {
  return (
    <div className={`shell ${styles.wrap}`}>
      {artists.map((a, n) => (
        <Block
          key={a.key}
          id={`artist-${n}`}
          colour={a.items[0]?.img.c ?? "#888888"}
          title={a.name}
          sub={a.platform}
          counts={{ creative: a.creative, animated: a.animated }}
        >
          <Strip items={a.items} activeId={activeId} onOpen={onOpen} />
        </Block>
      ))}

      {posts.length > 0 ? (
        <h2 className={`${styles.part} display`}>Group posts, several artists</h2>
      ) : null}
      {posts.map((p, n) => (
        <Block
          key={p.key}
          id={`post-${n}`}
          colour={p.items[0]?.img.c ?? "#888888"}
          title={`Group post${p.date ? `, ${formatDate(p.date) ?? ""}` : ""}`}
          sub={
            p.artists.length > 0
              ? `Named in the post: ${p.artists.join(", ")}`
              : (p.platform ?? undefined)
          }
          counts={tally(p.items)}
          link={p.key.startsWith("https://") ? p.key : null}
        >
          <Strip items={p.items} activeId={activeId} onOpen={onOpen} />
        </Block>
      ))}

      {official.length > 0 ? (
        <Block
          id="official"
          colour={official[0]?.img.c ?? "#888888"}
          title="Mobile Legends: Bang Bang"
          sub={canonLabel(official[0]!)}
          counts={tally(official)}
        >
          <Strip items={official} activeId={activeId} onOpen={onOpen} />
        </Block>
      ) : null}

      {unnamed.length > 0 ? (
        <Block
          id="unnamed"
          colour={unnamed[0]?.img.c ?? "#888888"}
          title="Artist not named"
          sub="The sources do not say who made these"
          counts={tally(unnamed)}
        >
          <Strip items={unnamed} activeId={activeId} onOpen={onOpen} />
        </Block>
      ) : null}
    </div>
  );
}
