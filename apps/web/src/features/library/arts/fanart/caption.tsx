import type { ReactNode } from "react";

import { CanonBadge, CreditLine } from "../../shell/credit";
import styles from "./caption.module.css";
import { canonLabel, formatDate } from "./model";
import type { FanItem } from "./types";

/**
 * The label of a piece. Fan work is "Fan work". The official account's reels keep their own words
 * ("Official reel, not story"): they are not a parody and not the maker's work.
 */
export function CanonMark({ item }: { item: FanItem }) {
  if (item.canon === "fan") return <CanonBadge canon="fan" />;
  return <span className={`${styles.reel} hud-label`}>{canonLabel(item)}</span>;
}

/**
 * What the zoom shows under a picture: the label, the day it was posted, who made it with the link
 * to the post, and the note of the credit (a group post names its artists there). The title is in
 * the viewer's own bar. A module constant, so the rows do not draw again.
 */
export function fanCaption(item: FanItem): ReactNode {
  const date = formatDate(item.date);
  return (
    <div className={styles.caption} data-fan-caption="">
      <p className={styles.marks}>
        <CanonMark item={item} />
        {date ? <span className="hud-label">{date}</span> : null}
      </p>
      <CreditLine credit={item.credit} canon={item.canon} />
      {item.credit?.note ? <p className={styles.note}>{item.credit.note}</p> : null}
    </div>
  );
}
