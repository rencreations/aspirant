"use client";

import { useMemo, type CSSProperties } from "react";

import { ImageViewer, type ViewerImage } from "@/components/image-viewer/image-viewer";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { CanonBadge, CreditLine } from "../shell/credit";
import { siteBySet } from "./filters";
import styles from "./sections.module.css";
import type { SiteItem } from "./types";

interface SiteArtProps {
  items: readonly SiteItem[];
  /** The id of the open picture (`?i=`), or an empty string. */
  openId: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

/** Art made for this site, in sets. Every picture opens in the zoom viewer. */
export function SiteArt({ items, openId, onOpen, onClose }: SiteArtProps) {
  const sets = useMemo(() => siteBySet(items), [items]);
  const flat = useMemo(() => sets.flatMap((s) => s.items), [sets]);
  const viewerItems = useMemo<ViewerImage[]>(
    () =>
      flat.map((it) => ({
        src: libUrl(it.img.f),
        thumb: libUrl(it.img.t),
        alt: it.title,
        width: it.img.w,
        height: it.img.h,
        title: it.title,
        set: it.set,
        setLabel: it.setLabel,
        credit: { name: "Art supplied by the site's owner", platform: "made for this site" },
        report: true,
      })),
    [flat],
  );
  const open = openId ? flat.findIndex((i) => i.id === openId) : -1;
  let n = 0;
  const credit = items[0]?.credit;

  return (
    <>
      <p className={styles.note}>
        This art was made for this site or is used to build it. It is not official art, and the
        pictures have clear backgrounds, so a checkerboard shows through.
      </p>
      {credit ? (
        <div className={styles.credit}>
          <CanonBadge canon="fan" />
          <CreditLine credit={credit} canon="fan" />
        </div>
      ) : null}
      {sets.map((set) => {
        const wide = set.set === "logo";
        return (
          <div key={set.set} className={styles.setBlock}>
            <p className={styles.setHead}>
              <span className={styles.setTitle}>{set.label}</span>
              <span className="hud-label">{set.items.length}</span>
            </p>
            <ul className={`${styles.art} ${wide ? styles.artWide : ""}`}>
              {set.items.map((it) => {
                const i = n++;
                return (
                  <li
                    key={it.id}
                    id={it.id}
                    className={styles.item}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.artBtn}
                      aria-label={`Open ${it.title}`}
                      aria-haspopup="dialog"
                      onClick={() => {
                        audio.blip("click");
                        onOpen(it.id);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={libUrl(it.img.t)}
                        alt=""
                        width={it.img.w}
                        height={it.img.h}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                      <span className={styles.artCap}>{it.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <ImageViewer
        items={viewerItems}
        index={open >= 0 ? open : null}
        onIndexChange={(next) => {
          const target = next === null ? undefined : flat[next];
          if (target) onOpen(target.id);
          else onClose();
        }}
        label="Made for this site"
      />
    </>
  );
}
