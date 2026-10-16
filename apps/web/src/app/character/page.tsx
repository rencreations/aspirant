import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { PageIntro } from "@/components/page-intro";
import { TLink } from "@/components/transition/t-link";
import { characterRoute, routes } from "@/lib/site";
import { CHARACTER_NAMES, CHARACTER_SLUGS } from "@/lib/slugs";

export const metadata: Metadata = {
  title: "Characters",
  description: "The ten Aspirants of Selrick Academy, their partners and their sides.",
};

export default function CharactersPage() {
  return (
    <>
      <PageIntro
        code="04 / Characters"
        title="Characters"
        lead="The ten Aspirants, in queue order. Pick one to meet her."
      />
      <section aria-labelledby="roster-title" className="shell pb-sp-xl">
        <h2 id="roster-title" className="mb-sp-s hud-label">
          Roster
        </h2>
        <ol className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {CHARACTER_SLUGS.map((slug, i) => (
            <li key={slug} className="bg-bg">
              <TLink
                href={characterRoute(slug)}
                transitionLabel={CHARACTER_NAMES[slug]}
                className="group flex min-h-24 items-end justify-between gap-4 p-sp-s text-text-dim no-underline transition-colors hover:bg-bg-2 hover:text-text"
              >
                <span className="display text-step-3">{CHARACTER_NAMES[slug]}</span>
                <span className="mono text-step--2 text-text-faint group-hover:text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </TLink>
            </li>
          ))}
        </ol>
      </section>
      <NextFooter
        label="Collection"
        sublabel="Every film, song, comic and drawing in one archive."
        href={routes.collection}
        image="/img/hero-stills/guinevere-vexana-01.webp"
      />
    </>
  );
}
