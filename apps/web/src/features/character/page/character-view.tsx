/**
 * One character page, composed on the server. Reads the content layer and the build-time
 * media lists, then hands slim props to the client islands.
 */
import { NextFooter } from "@/components/next-footer/next-footer";
import {
  getCharacter,
  keyVoiceLines,
  nextCharacter,
  pairOf,
  partnerOf,
} from "@/content/characters";
import { chapterLabel, getChapterMeta, getPart } from "@/content/story";
import type { ChapterId, Slug } from "@/content/types";
import { characterRoute } from "@/lib/site";

import { ART, PAIR_ART, splashOf } from "../art";
import { experienceHref } from "../links";
import { fanArtFor, videosFor, voiceDurations } from "../media";
import { characterVars, readable } from "../theme";
import styles from "./character-view.module.css";
import { Hero } from "./hero";
import { InStory, type ChapterChip } from "./in-story";
import { MediaSection } from "./media-section";
import { Profile } from "./profile";
import { Relationships, type RelationshipCard } from "./relationships";
import type { SpoilerFact } from "./spoilers";
import { Stats } from "./stats";
import { VoiceWall } from "./voice-wall";

/** Comic side characters the canon rules keep out of relationship sections. */
const EXCLUDED = new Set(["Roger", "Professor Joe"]);

const pad = (n: number) => String(n).padStart(2, "0");

function chapterInfo(id: ChapterId) {
  const meta = getChapterMeta(id);
  return {
    label: meta ? chapterLabel(meta) : "Chapter",
    number: meta?.number == null ? "Interlude" : pad(meta.number),
    title: meta?.title ?? id,
    part: meta ? (getPart(meta.part)?.label ?? "") : "",
  };
}

export function CharacterView({ slug }: { slug: Slug }) {
  const c = getCharacter(slug);
  const art = ART[slug];
  const pair = pairOf(slug);
  const partner = partnerOf(slug);
  const otherSlug = pair.members.find((m) => m !== slug) ?? null;
  const other = otherSlug ? getCharacter(otherSlug) : null;
  const vars = characterVars(c.palette, "daybreak", art.accent);
  const lead = c.palette[art.accent.accent];
  const colours = {
    lead,
    second: c.palette[art.accent.accent2],
    glow: c.palette.glow,
  };
  const signatureLine = keyVoiceLines(slug)[0] ?? c.voice[0];
  const durations = voiceDurations(slug);

  const forms =
    art.forms && c.forms
      ? {
          normal: { text: c.forms.normal, art: art.forms.normal },
          ender: { text: c.forms.ender, art: art.forms.ender },
        }
      : null;

  const later: SpoilerFact[] = c.laterInStory.map((fact) => {
    const info = chapterInfo(fact.chapterId);
    return {
      text: fact.text,
      href: experienceHref(fact.chapterId),
      label: info.label,
      title: info.title,
    };
  });

  const relationships: RelationshipCard[] = c.sections.relationships
    .filter((r) => !EXCLUDED.has(r.name))
    .map((r, i) => {
      if (!r.slug) return { key: `p${i}`, name: r.name, text: r.text, link: null };
      const rc = getCharacter(r.slug);
      const ra = ART[r.slug];
      return {
        key: r.slug,
        name: r.name,
        text: r.text,
        link: {
          slug: r.slug,
          aspirantName: rc.aspirantName,
          focus: `${ra.focus.x}% ${ra.focus.y}%`,
          colour: rc.palette[ra.accent.accent],
          partner: r.slug === c.partnerSlug,
        },
      };
    })
    // The partner leads the list.
    .sort((a, b) => Number(b.link?.partner ?? false) - Number(a.link?.partner ?? false));

  const official = [
    { ...splashOf(slug, c.name), caption: "Official splash art" },
    ...art.extras.map((e) => ({ ...e, caption: "Official art" })),
    ...PAIR_ART[c.pair].map((p) => ({ ...p, caption: `${pair.names}, official art` })),
  ];

  const chapters: ChapterChip[] = c.inStory.chapterIds.map((id) => {
    const info = chapterInfo(id);
    return {
      id,
      href: experienceHref(id),
      number: info.number,
      title: info.title,
      part: info.part,
    };
  });

  const next = nextCharacter(slug);
  const nextArt = ART[next.slug];
  const nextVars = characterVars(next.palette, "daybreak", nextArt.accent);
  const nextAccent = readable(next.palette[nextArt.accent.accent], "daybreak");

  return (
    <div data-theme="daybreak" className={styles.page} style={vars}>
      <Hero
        name={c.name}
        aspirantName={c.aspirantName}
        jp={c.jp}
        tagline={c.tagline}
        unit={pad(c.order)}
        groupLabel={pair.kind === "partners" ? pair.names : `${pair.names}, creator and creation`}
        side={c.side}
        splash={splashOf(slug, c.name)}
        cutout={art.cutout}
        cutoutAligned={art.cutoutAligned}
        focus={art.focus}
        shape={art.shape}
        signature={art.signature}
        signatureLabel={art.signatureLabel}
        colours={colours}
        line={
          signatureLine
            ? {
                src: `/${signatureLine.file}`,
                n: signatureLine.n,
                jp: signatureLine.jpTitle,
                en: signatureLine.en,
              }
            : null
        }
        forms={forms}
        stats={
          <Stats
            character={c}
            partner={partner ? { slug: partner.slug, name: partner.name } : null}
            grouped={!partner && other ? { slug: other.slug, name: other.name } : null}
          />
        }
      />
      <Profile character={c} focus={art.focus} later={later} />
      <Relationships name={c.name} cards={relationships} />
      <VoiceWall
        name={c.name}
        lines={c.voice.map((l) => ({
          n: l.n,
          jp: l.jpTitle,
          en: l.en,
          src: `/${l.file}`,
          duration: durations[l.n] ?? null,
          ...(l.note ? { note: l.note } : {}),
        }))}
      />
      <div
        data-theme="daybreak"
        className={styles.cinemaZone}
        style={characterVars(c.palette, "daybreak", art.accent)}
      >
        <MediaSection
          name={c.name}
          official={official}
          fanart={fanArtFor(slug)}
          videos={videosFor(c.pair, slug)}
        />
      </div>
      <InStory name={c.name} chapters={chapters} />
      <div data-theme="daybreak" className={styles.nextZone} style={nextVars}>
        <NextFooter
          eyebrow="Next in queue"
          label={next.name}
          sublabel={`${next.aspirantName}. Unit ${pad(next.order)} of 10. ${next.tagline}`}
          href={characterRoute(next.slug)}
          image={`/img/char/${next.slug}/splash.webp`}
          accent={nextAccent}
        />
      </div>
    </div>
  );
}
