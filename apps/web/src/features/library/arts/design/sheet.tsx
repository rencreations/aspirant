"use client";

import { memo, useCallback, useId, useState, type CSSProperties, type SyntheticEvent } from "react";

import { libUrl } from "@/lib/library";

import { CanonBadge, CreditLine } from "../../shell/credit";
import { useZoomTile } from "../core/zoom";
import styles from "./design.module.css";
import { aspirantName, formatDate, kindOne, sheetNumber } from "./model";
import type { DesignItem } from "./types";

export interface SheetProps {
  item: DesignItem;
  /** The place of the sheet in the whole room, from 1. */
  place: number;
  /** The number of sheets in the whole room. */
  total: number;
  /** The key of the file to draw: the preview, or the full size on a sharp screen. */
  fileKey: string;
  /** One of the first sheets: its picture is asked for at once and the curtain waits for it. */
  first: boolean;
  /** A wide sheet with writing: tell a visitor on an upright phone to turn it. */
  turnHint: boolean;
  /** Called once when the picture has arrived (or has failed), for the sheets the curtain waits for. */
  onSettled: ((id: string) => void) | undefined;
}

/**
 * One section of the room: a sheet on its plate, and its name and notes beside it (above and
 * below it on a narrow screen). The tile is the sheet itself, the exact shape of the picture, so
 * the zoom grows out of it and goes back into it with nothing cut. The width comes from CSS
 * (`--ar` and `--nat` are the sheet's shape and its own pixels), so nothing moves when the picture
 * arrives.
 */
export const Sheet = memo(function Sheet({
  item,
  place,
  total,
  fileKey,
  first,
  turnHint,
  onSettled,
}: SheetProps) {
  const zoom = useZoomTile(item.id, "light");
  const uid = useId();
  const [failed, setFailed] = useState(false);
  const { img } = item;
  const names = item.chars.map(aspirantName);
  const no = sheetNumber(place);

  const settle = useCallback(() => {
    onSettled?.(item.id);
  }, [onSettled, item.id]);

  // A picture that is in the cache by the time its tile stands shows at once, with no fade.
  const ref = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) {
        el.dataset.instant = "";
        el.dataset.ready = "";
        settle();
      }
    },
    [settle],
  );
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.dataset.ready = "";
    setFailed(false);
    settle();
  };
  const onError = () => {
    setFailed(true);
    settle();
  };

  const style = { "--ar": img.w / img.h, "--nat": `${img.w}px` } as CSSProperties;

  return (
    <section
      className={styles.section}
      data-design-section=""
      data-id={item.id}
      data-first={first ? "" : undefined}
      aria-labelledby={`${uid}-name`}
    >
      <div className={styles.id}>
        <p className={styles.no}>
          <span>No. {no}</span>
          <span>of {total}</span>
        </p>
        <h2 className={styles.name} id={`${uid}-name`}>
          {item.title}
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>Kind</dt>
            <dd>{kindOne(item.what)}</dd>
          </div>
          {names.length > 0 ? (
            <div>
              <dt>{names.length > 1 ? "Aspirants" : "Aspirant"}</dt>
              <dd>{names.join(", ")}</dd>
            </div>
          ) : null}
          <div>
            <dt>Size</dt>
            <dd>
              {img.w} x {img.h} px
            </dd>
          </div>
        </dl>
        <CanonBadge canon={item.canon} />
      </div>

      <div className={styles.stage}>
        <button
          type="button"
          {...zoom}
          className={`${zoom.className} ${styles.sheet}`}
          style={style}
          aria-label={`${item.title}. Open the whole sheet.`}
          aria-describedby={`${uid}-note`}
          data-design-sheet=""
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={ref}
            className={styles.pic}
            src={libUrl(fileKey)}
            alt=""
            width={img.w}
            height={img.h}
            loading={first ? "eager" : "lazy"}
            fetchPriority={first ? "high" : "auto"}
            decoding="async"
            draggable={false}
            onLoad={onLoad}
            onError={onError}
          />
          {failed ? (
            <span className={styles.failed} role="status">
              This picture could not be loaded.
            </span>
          ) : null}
        </button>
      </div>

      <div className={styles.notes}>
        <p className={styles.note} id={`${uid}-note`}>
          {item.alt}
        </p>
        {turnHint ? (
          <p className={styles.hint}>Open it and turn the phone sideways to see it larger.</p>
        ) : null}
        {item.credit ? (
          <div className={styles.source}>
            <CreditLine credit={item.credit} canon={item.canon} />
            {item.credit.date || item.credit.note ? (
              <p className={styles.small}>
                {item.credit.date ? `Posted ${formatDate(item.credit.date)}. ` : ""}
                {item.credit.note ?? ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
});
