import { TLink } from "@/components/transition/t-link";
import { characters } from "@/content/characters";
import { asset } from "@/lib/asset";
import { characterRoute } from "@/lib/site";

import { portraitFor } from "../reader/portraits";
import s from "./landing.module.css";

/**
 * The ten Aspirants, each with a line that gives nothing away. A card opens the character's own
 * page. The pictures are small and far down the page, so they load in the background.
 */
export function Characters() {
  return (
    <section className={s.characters} aria-labelledby="characters-title">
      <div className={s.wrap} data-wide="true">
        <p className={s.kicker}>The Aspirants</p>
        <h2 id="characters-title" className={s.heading}>
          Meet the ten
        </h2>
        <p className={s.charLead}>Each Aspirant has a page of their own. Choose one to open it.</p>
        <ul className={s.cards}>
          {characters.map((c) => {
            const art = portraitFor(c.slug);
            return (
              <li key={c.slug}>
                <TLink
                  href={characterRoute(c.slug)}
                  transitionLabel={c.name}
                  className={s.card}
                  aria-label={`${c.name}, ${c.aspirantName}. ${c.tagline}`}
                >
                  <span className={s.cardArt} aria-hidden="true">
                    {art && (
                      // Decorative: the name sits right under it.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset(art.src)}
                        alt=""
                        width={800}
                        height={450}
                        loading="lazy"
                        decoding="async"
                        style={{ objectPosition: art.position }}
                      />
                    )}
                  </span>
                  <span className={s.cardName} aria-hidden="true">
                    {c.name}
                  </span>
                  <span className={s.cardAka} aria-hidden="true">
                    {c.aspirantName}
                  </span>
                  <span className={s.cardLine} aria-hidden="true">
                    {c.tagline}
                  </span>
                </TLink>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
