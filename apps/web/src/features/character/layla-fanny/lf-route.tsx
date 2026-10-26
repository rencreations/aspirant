import { nextCharacter } from "@/content/characters";
import { ART } from "@/features/character/art";
import { fanArtFor } from "@/features/character/media";
import { characterVars, readable } from "@/features/character/theme";
import { characterRoute } from "@/lib/site";
import { LfPage } from "./lf-page";
import type { Who } from "./media";

/** The server side of a page of the pair: it reads the build-time lists and hands slim props on. */
export function LfRoute({ who }: { who: Who }) {
  const next = nextCharacter(who);
  const art = ART[next.slug];
  const fanart = fanArtFor(who).map((f) => ({
    id: f.id,
    title: f.title,
    credit: f.credit,
    url: f.url,
    src: f.src,
    srcSm: f.srcSm,
    width: f.width,
    height: f.height,
  }));
  return (
    <LfPage
      who={who}
      fanart={fanart}
      next={{
        slug: next.slug,
        name: next.name,
        aspirantName: next.aspirantName,
        tagline: next.tagline,
        order: next.order,
        href: characterRoute(next.slug),
        image: `/img/char/${next.slug}/splash.webp`,
        accent: readable(next.palette[art.accent.accent], "daybreak"),
        vars: characterVars(next.palette, "daybreak", art.accent),
      }}
    />
  );
}
