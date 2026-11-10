import { ThemeZone } from "@/components/theme-zone";
import { TLink } from "@/components/transition/t-link";
import { siteCopy } from "@/content/site-copy";
import { asset } from "@/lib/asset";
import { routes } from "@/lib/site";

import styles from "./doors.module.css";

const DOORS = [
  {
    href: routes.story,
    code: "07 / Door A",
    label: "Story",
    title: siteCopy.home.doors.story,
    line: "Eighty-seven chapters in six acts, one chapter to a page.",
    image: "/img/hero-stills/fanny-layla-02.webp",
    tone: "daybreak",
  },
  {
    href: routes.collection,
    code: "07 / Door B",
    label: "Collection",
    title: siteCopy.home.doors.collection,
    line: "Films, music, comics, art, fan art and every voice line.",
    image: "/img/hero-stills/guinevere-vexana-04.webp",
    tone: "storm",
  },
] as const;

/** Two doors: big portal links to the Story and the Collection, with a hover reveal. */
export function TwoDoors() {
  return (
    <ThemeZone theme="daybreak" aria-labelledby="doors-title" className={styles.section}>
      <h2 id="doors-title" className="sr-only">
        Where to go next
      </h2>
      <ul className={`${styles.doors} shell`}>
        {DOORS.map((door) => (
          <li key={door.label} className={styles.item} data-tone={door.tone}>
            <TLink
              href={door.href}
              transitionLabel={door.label}
              className={styles.door}
              data-cursor="ENTER"
            >
              <span className={styles.media} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
                <img
                  src={asset(door.image)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={1280}
                  height={720}
                />
              </span>
              <span className={styles.ring} aria-hidden="true" />
              <span className={styles.body}>
                <span className={styles.code}>{door.code}</span>
                <span className={styles.label}>{door.label}</span>
                <span className={styles.title}>{door.title}</span>
                <span className={styles.line}>{door.line}</span>
              </span>
              <span className={styles.arrow} aria-hidden="true">
                &rarr;
              </span>
            </TLink>
          </li>
        ))}
      </ul>
    </ThemeZone>
  );
}
