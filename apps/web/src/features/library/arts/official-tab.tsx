"use client";

import type { ReactNode } from "react";

import { Gallery, Lightbox, type LightboxParam } from "../shared/gallery";
import styles from "./arts.module.css";
import { charName } from "./filter";
import { Odometer } from "./odometer";
import type { ArtItem } from "./types";
import type { ArtView } from "./use-art-filters";

interface Props {
  all: readonly ArtItem[];
  shown: readonly ArtItem[];
  view: ArtView;
  lightbox: LightboxParam<ArtItem>;
  filtered: boolean;
  onClear: () => void;
  /** The kind and pair chips. They sit under the tally and scroll away with it. */
  filterRows: ReactNode;
}

/** The content of the official tab: the tally, the grid, the viewer. The filters are in the bar above. */
export function OfficialTab({ all, shown, view, lightbox, filtered, onClear, filterRows }: Props) {
  const wall = view === "wall";
  return (
    <>
      <div className="shell">
        <div className={styles.tally}>
          <p className={styles.showing}>
            <Odometer value={shown.length} className={styles.showingNumber} />
            <span className="hud-label">
              {filtered ? `of ${all.length} pictures` : "pictures, full quality"}
            </span>
          </p>
        </div>
        <div className={styles.moreFilters}>{filterRows}</div>
      </div>

      {shown.length === 0 ? (
        <div className="shell">
          <div className={styles.empty}>
            <p className={`${styles.emptyTitle} display`}>Nothing matches.</p>
            <p>Try fewer words, or another character, kind or pair.</p>
            <button type="button" className={styles.clear} onClick={onClear}>
              Clear the filters
            </button>
          </div>
        </div>
      ) : (
        <div className={wall ? styles.bleed : "shell"}>
          <Gallery
            label="Official art"
            items={shown}
            layout={wall ? "justified" : "masonry"}
            size={wall ? 250 : 340}
            gap={wall ? 4 : 14}
            activeId={lightbox.id || null}
            onOpen={(item) => {
              lightbox.open(item.id);
            }}
            renderCaption={(item) => (
              <>
                <span className={`${styles.capName} display`}>{item.title}</span>
                <span className={`${styles.capMeta} hud-label`}>
                  {item.chars.map(charName).join(", ")}
                </span>
              </>
            )}
          />
        </div>
      )}

      <Lightbox
        items={lightbox.list}
        index={lightbox.index}
        onIndexChange={lightbox.setIndex}
        label="Official art"
      />
    </>
  );
}
