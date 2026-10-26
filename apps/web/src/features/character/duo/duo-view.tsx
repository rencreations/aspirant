/**
 * The page of Ruby or Angela, composed on the server from the content layer. The two pages share
 * this view and its sections; each has its own colours and its own hero (see `duo-data.ts`).
 */
import type { Route } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { ThemeZone } from "@/components/theme-zone";
import { getCharacter, partnerOf } from "@/content/characters";
import { chapterLabel, getChapterMeta, getPart } from "@/content/story";
import type { ChapterId } from "@/content/types";
import { characterRoute } from "@/lib/site";

import { ART } from "../art";
import { experienceHref } from "../links";
import { videosFor, voiceDurations } from "../media";
import type { SpoilerFact } from "../page/spoilers";
import { Contacts, type ChapterLink, type Contact } from "./contacts/contacts";
import { Banner } from "./banner/banner";
import { COPY, PARTNER, TETRA_LINES, type Who } from "./duo-data";
import styles from "./duo-page.module.css";
import { Duet } from "./duet/duet";
import { Film } from "./film/film";
import { Gallery } from "./gallery/gallery";
import { Hero } from "./hero/hero";
import { Log, type LogEntry } from "./log/log";
import { Spec } from "./spec/spec";
import { Switch } from "./switch/switch";
import { VoiceBank } from "./voice/voice-bank";

/** What the page needs to say about the next character (the footer at the very end). */
export interface NextCharacter {
  slug: string;
  name: string;
  aspirantName: string;
  tagline: string;
  order: number;
  href: Route;
  /** Public path of the splash art, for the footer. */
  image: string;
  /** Her accent colour, readable on the page. */
  accent: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Comic side characters the canon rules keep out of relationship sections. */
const EXCLUDED = new Set(["Roger", "Professor Joe"]);

function chapterInfo(id: ChapterId) {
  const meta = getChapterMeta(id);
  return {
    label: meta ? chapterLabel(meta) : "Chapter",
    number: meta?.number == null ? "Interlude" : pad(meta.number),
    title: meta?.title ?? id,
    part: meta ? (getPart(meta.part)?.label ?? "") : "",
  };
}

export function DuoView({ who, next }: { who: Who; next: NextCharacter }) {
  const c = getCharacter(who);
  const partner = partnerOf(who) ?? getCharacter(PARTNER[who]);
  const copy = COPY[who];
  const durations = voiceDurations(who);

  const tetra = TETRA_LINES.flatMap((n) => {
    const line = c.voice.find((l) => l.n === n);
    return line ? [{ n, en: line.en, src: `/${line.file}` }] : [];
  });

  const entries: LogEntry[] = [
    { key: "personality", label: "Personality", lines: c.sections.personality },
    { key: "appearance", label: "Appearance", lines: c.sections.appearance },
    { key: "fighting", label: "Fighting", lines: c.sections.fighting },
    { key: "motivation", label: "What she wants", lines: c.sections.motivation },
    { key: "flaws", label: "Where she is weak", lines: c.sections.flaws },
  ];

  const later: SpoilerFact[] = c.laterInStory.map((fact) => {
    const info = chapterInfo(fact.chapterId);
    return {
      text: fact.text,
      href: experienceHref(fact.chapterId),
      label: info.label,
      title: info.title,
    };
  });

  const contacts: Contact[] = c.sections.relationships
    .filter((r) => !EXCLUDED.has(r.name))
    .map((r, i): Contact => {
      if (!r.slug) return { key: `p${i}`, name: r.name, text: r.text, link: null };
      const rc = getCharacter(r.slug);
      const ra = ART[r.slug];
      return {
        key: r.slug,
        name: r.name,
        text: r.text,
        link: {
          href: characterRoute(r.slug),
          slug: r.slug,
          aspirantName: rc.aspirantName,
          focus: `${ra.focus.x}% ${ra.focus.y}%`,
          partner: r.slug === c.partnerSlug,
        },
      };
    })
    .sort((a, b) => Number(b.link?.partner ?? false) - Number(a.link?.partner ?? false));

  const chapters: ChapterLink[] = c.inStory.chapterIds.map((id) => {
    const info = chapterInfo(id);
    return {
      id,
      href: experienceHref(id),
      number: info.number,
      title: info.title,
      part: info.part,
    };
  });

  const lines = c.voice.map((l) => ({
    n: l.n,
    jp: l.jpTitle,
    en: l.en,
    src: `/${l.file}`,
    duration: durations[l.n] ?? null,
  }));

  const film = (
    <Film who={who} name={c.name} label={copy.filmLabel} videos={videosFor(c.pair, who)} />
  );

  return (
    <ThemeZone
      theme={who === "ruby" ? "storm" : "daybreak"}
      as="div"
      surface={false}
      className={styles.page}
      data-who={who}
      data-duo={who}
    >
      <Hero
        who={who}
        name={c.name}
        aspirantName={c.aspirantName}
        jp={c.jp}
        tagline={c.tagline}
        role={c.role}
        hint={copy.hint}
        layerName={copy.layerName}
        hintTouch={copy.hintTouch}
        tetra={who === "angela" ? tetra : []}
      />
      <Banner who={who} text={copy.mood} />
      <Spec
        who={who}
        name={c.name}
        aspirantName={c.aspirantName}
        jp={c.jp}
        ageText={c.ageText}
        birthday={c.birthday}
        mbti={c.mbti}
        role={c.role}
        weapon={c.weapon}
        partnerName={partner.name}
        summary={c.summary}
      />
      <Log
        who={who}
        name={c.name}
        label={copy.logLabel}
        entries={entries}
        background={c.sections.background}
        later={later}
      />
      {who === "angela" ? (
        <ThemeZone theme="storm" as="div" surface={false}>
          {film}
        </ThemeZone>
      ) : (
        film
      )}
      <VoiceBank
        who={who}
        name={c.name}
        label={copy.voiceLabel}
        idle={copy.voiceIdle}
        lines={lines}
      />
      <Duet who={who} />
      <Contacts who={who} name={c.name} contacts={contacts} chapters={chapters} />
      <Gallery who={who} />
      <Switch who={who} href={characterRoute(PARTNER[who])} />
      <ThemeZone theme="daybreak" as="div" className="flow-root">
        <NextFooter
          eyebrow="Next in queue"
          label={next.name}
          sublabel={`${next.aspirantName}. Unit ${pad(next.order)} of 10. ${next.tagline}`}
          href={next.href}
          image={next.image}
          accent={next.accent}
        />
      </ThemeZone>
    </ThemeZone>
  );
}
