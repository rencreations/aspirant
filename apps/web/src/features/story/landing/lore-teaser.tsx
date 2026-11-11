import { TLink } from "@/components/transition/t-link";
import { StarButton } from "@/components/ui/star-button";
import { collectionRoute } from "@/lib/site";

import s from "./landing.module.css";
import t from "./lore-teaser.module.css";

interface Sample {
  readonly label: string;
  /** The entry of the codex it opens: `/collection/lore/<slug>/`. */
  readonly slug: string;
}

interface Group {
  readonly label: string;
  readonly line: string;
  readonly samples: readonly Sample[];
}

/** What the lore room holds, with names a reader already met on this page or in the prologue. */
const GROUPS: readonly Group[] = [
  {
    label: "Places",
    line: "Every place in the story, from the past to the present.",
    samples: [
      { label: "Selrick Academy", slug: "selrick-academy" },
      { label: "The Gardens", slug: "gardens" },
      { label: "Oro", slug: "oro" },
      { label: "Terrinia", slug: "terrinia" },
    ],
  },
  {
    label: "People",
    line: "Everyone who matters, family and strangers, and how they are tied.",
    samples: [
      { label: "Karina", slug: "karina" },
      { label: "Chang'e's parents", slug: "changes-parents" },
      { label: "Roger", slug: "roger" },
      { label: "Ruby's father", slug: "rubys-father" },
    ],
  },
  {
    label: "Things",
    line: "Machines, weapons, drones and ideas, with what the book says of each.",
    samples: [
      { label: "Tetra", slug: "tetra" },
      { label: "Guinevere's drones", slug: "guineveres-drones" },
      { label: "Aspirant power", slug: "aspirant-power" },
      { label: "The Enders", slug: "enders" },
    ],
  },
];

/**
 * The way into the lore room of the collection: everything the story names, kept in one place,
 * with a page for each. The end of the white page, and the last thing before the page starts over.
 */
export function LoreTeaser() {
  return (
    <section className={`${s.section} ${t.lore}`} aria-labelledby="lore-title">
      <div className={s.wrap} data-wide="true">
        <p className={s.kicker}>The lore</p>
        <h2 id="lore-title" className={s.heading}>
          Everything the story names
        </h2>
        <p className={s.charLead}>
          The collection keeps a page for every place, person and thing that is part of the lore,
          with what the story says about it and how it ties to the rest. Open it when a name needs
          more than the book gives.
        </p>

        <ul className={t.groups}>
          {GROUPS.map((g) => (
            <li key={g.label} className={t.group}>
              <h3 className={t.label}>{g.label}</h3>
              <p className={t.line}>{g.line}</p>
              <ul className={t.samples} aria-label={`Examples of ${g.label.toLowerCase()}`}>
                {g.samples.map((x) => (
                  <li key={x.slug}>
                    <TLink
                      href={collectionRoute(`lore/${x.slug}`)}
                      transitionLabel={x.label}
                      className={t.sample}
                    >
                      {x.label}
                    </TLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className={t.cta}>
          <StarButton pulse size="lg" href={collectionRoute("lore")} transitionLabel="The lore">
            Open the lore
          </StarButton>
          <p className={t.note}>It lives in the collection, at /collection/lore.</p>
        </div>
      </div>
    </section>
  );
}
