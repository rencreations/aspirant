import type { CharacterSlug } from "@/lib/slugs";

import { SplashArt } from "./art";
import { NO_COSPLAY, PEOPLE_LINE } from "./model";
import styles from "./cosplay.module.css";

/**
 * Her official splash art, with one plain line beside it. On a page with photos the art is a
 * medium picture and the line says that the photos show real people, credited, and where to ask
 * for a removal. On a page with none the art is large and the line is the calm one. `photos` is
 * null while the data is still arriving: the art stands and the line waits.
 */
export function Feature({
  slug,
  name,
  photos,
}: {
  slug: CharacterSlug;
  name: string;
  photos: boolean | null;
}) {
  return (
    <div
      className={styles.feature}
      data-size={photos === false ? "large" : "medium"}
      data-cosplay-feature=""
    >
      <figure className={styles.figure}>
        <div className={styles.art}>
          <SplashArt slug={slug} alt={`${name}, official splash art.`} className={styles.artImg} />
        </div>
        <figcaption className={styles.cap}>Official art</figcaption>
      </figure>
      <div className={styles.side}>
        {photos === false ? (
          <p className={styles.calm} data-cosplay-empty="">
            {NO_COSPLAY}
          </p>
        ) : photos ? (
          <p className={styles.people} data-cosplay-people="">
            {PEOPLE_LINE}
          </p>
        ) : null}
      </div>
    </div>
  );
}
