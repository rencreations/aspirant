import { TLink } from "@/components/transition/t-link";

import type { Canon, Credit } from "../types";
import styles from "./credit.module.css";

/** A small label for work that is not official. Official work gets none. */
export function CanonBadge({ canon }: { canon: Canon }) {
  if (canon === "official") return null;
  return (
    <span className={`${styles.badge} ${canon === "fan" ? styles.fan : styles.non} hud-label`}>
      {canon === "fan" ? "Fan work" : "Non-canon parody"}
    </span>
  );
}

/** Who made it and where it came from, with a link to the original post when the sources know it. */
export function CreditLine({ credit, canon }: { credit: Credit | undefined; canon: Canon }) {
  if (canon === "official" && !credit) return null;
  const by = credit?.by ?? "Artist not named";
  const where = credit?.platform ? ` on ${credit.platform}` : "";
  return (
    <p className={styles.credit}>
      <span>
        {by}
        {where}
      </span>
      {credit?.url ? (
        <TLink href={credit.url as `https://${string}`} className="link">
          View the original
        </TLink>
      ) : null}
    </p>
  );
}
