"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { TLink } from "@/components/transition/t-link";
import { VideoCard } from "@/components/video-player/video-card";
import { getCharacter } from "@/content/characters";
import { experienceHref } from "@/features/character/links";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { ObsidiaDrawer, type DrawerTab } from "../drawer/drawer";
import { TRAILER, TRAILER_SKIN } from "../media";
import { aboutImagePath } from "./about-images";
import styles from "./about.module.css";
import { InlineText } from "./inline-text";
import {
  DISLIKES,
  EXPERIENCE,
  LIKES,
  PROFILE_FACTS,
  PROFILE_VOICES,
  PROJECTS,
  SKILLS,
  SUMMARY,
  TIES,
} from "./profile-data";
import { STORY, type StoryBlock } from "./story-data";
import { VoiceCard } from "./voice-card";

/** 1 to 3999 in Roman numerals: her chapters are numbered like a book of state. */
function toRoman(n: number): string {
  const table: ReadonlyArray<readonly [number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let left = n;
  let out = "";
  for (const [value, glyph] of table) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.h3}>{title}</h3>
      {children}
    </section>
  );
}

/** The resume: who she is in short, with her picture in a circle. */
function DetailsBody() {
  const c = getCharacter("obsidia");
  return (
    <>
      <header className={styles.who}>
        <div className={styles.avatar}>
          {/* Plain <img>: static export, a round picture. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset(aboutImagePath("profile"))}
            alt="Obsidia, in her skin Imperatrix Arashi, with a gold crown and one black clawed hand raised"
            width={597}
            height={597}
            draggable={false}
          />
        </div>
        <div>
          <p className={styles.kicker}>Profile</p>
          <h2 className={styles.name}>Obsidia</h2>
          <p className={styles.jp} lang="ja">
            {c.jp.script}
            <span> {c.jp.romaji}</span>
          </p>
          <p className={styles.aka}>Imperatrix Arashi</p>
          <p className={styles.summary}>
            <InlineText text={SUMMARY} />
          </p>
        </div>
      </header>

      <Section title="At a glance">
        <dl className={styles.facts}>
          {PROFILE_FACTS.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>
                <InlineText text={f.value} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Skills">
        <ul className={styles.chips}>
          {SKILLS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section title="Experience">
        <ol className={styles.timeline}>
          {EXPERIENCE.map((e) => (
            <li key={e.role}>
              <strong>{e.role}</strong>
              <span className={styles.place}>
                <InlineText text={e.place} />
              </span>
              <span>
                <InlineText text={e.note} />
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <div className={styles.two}>
        <Section title="Likes">
          <ul className={styles.plain}>
            {LIKES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Section>
        <Section title="Dislikes">
          <ul className={styles.plain}>
            {DISLIKES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Family and ties">
        <ul className={styles.ties}>
          {TIES.map((t) => (
            <li key={t.name}>
              <span className={styles.tieHead}>
                <strong>
                  {t.entity ? <InlineText text={`{{${t.entity}|${t.name}}}`} /> : t.name}
                </strong>
                <em>{t.relation}</em>
              </span>
              <span>
                <InlineText text={t.text} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Projects">
        <dl className={styles.facts}>
          {PROJECTS.map((p) => (
            <div key={p.label}>
              <dt>{p.label}</dt>
              <dd>
                <InlineText text={p.value} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Two forms">
        <dl className={styles.facts}>
          <div>
            <dt>Normal</dt>
            <dd>{c.forms?.normal}</dd>
          </div>
          <div>
            <dt>Ender</dt>
            <dd>{c.forms?.ender}</dd>
          </div>
        </dl>
      </Section>

      <Section title="Appearance">
        <ul className={styles.plain}>
          {c.sections.appearance.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Section>

      <Section title="Personality">
        <ul className={styles.plain}>
          {c.sections.personality.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Section>

      <Section title="Fighting">
        <ul className={styles.plain}>
          {c.sections.fighting.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Section>

      <Section title="Flaws">
        <ul className={styles.plain}>
          {c.sections.flaws.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Section>

      <Section title="Voice">
        <div className={styles.voices}>
          {PROFILE_VOICES.map((v) => (
            <VoiceCard key={v.n} n={v.n} label={v.form} />
          ))}
        </div>
      </Section>
    </>
  );
}

function Picture({ block }: { block: Extract<StoryBlock, { type: "image" }> }) {
  return (
    <figure className={styles.shot}>
      {/* Plain <img>: static export, a still taken from the official video. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(aboutImagePath(block.name))}
        alt={block.alt}
        width={block.wide ? 1440 : 1280}
        height={block.wide ? 810 : 720}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <figcaption>{block.caption}</figcaption>
    </figure>
  );
}

function Block({ block }: { block: StoryBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className={styles.p}>
          <InlineText text={block.text} />
        </p>
      );
    case "quote":
      return (
        <blockquote className={styles.quote}>
          <InlineText text={block.text} />
          {block.who ? <cite> {block.who}</cite> : null}
        </blockquote>
      );
    case "voice":
      return <VoiceCard n={block.n} why={block.why} />;
    case "image":
      return <Picture block={block} />;
  }
}

/** Chapters built when the tab opens, and how many more follow at each step. */
const FIRST_CHAPTERS = 3;
const CHAPTER_STEP = 2;

/** Her whole story, section by section, with a numbered index along the top. */
function StoryBody({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLElement | null>>([]);
  // The story is long. The first few sections are built at once and the rest a few at a time,
  // while the page is idle, so no single frame carries the whole drawer.
  const [built, setBuilt] = useState(FIRST_CHAPTERS);
  useEffect(() => {
    if (built >= STORY.length) return;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        setBuilt((n) => n + CHAPTER_STEP);
      });
    }, 140);
    return () => {
      window.clearTimeout(timer);
    };
  }, [built]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const line = el.scrollTop + 120;
      let at = 0;
      refs.current.forEach((section, i) => {
        if (section && section.offsetTop <= line) at = i;
      });
      setActive(at);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [scroller]);

  const jump = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    audio.blip("click");
    // The sections before the target must be built, or the target is not where it will be.
    if (built <= i) setBuilt(STORY.length);
    const go = () => {
      const target = refs.current[i];
      if (target) el.scrollTo({ top: target.offsetTop - 52, behavior: "smooth" });
    };
    if (built <= i) requestAnimationFrame(() => requestAnimationFrame(go));
    else go();
  };

  return (
    <>
      <header className={styles.storyHead}>
        <p className={styles.kicker}>Her story</p>
        <h2 className={styles.name}>The first question</h2>
        <p className={styles.summary}>
          Everything that happens to Obsidia, told by her, in the order it happens. Underlined names
          open a short note. Press play on a voice line to hear her.
        </p>
      </header>
      <nav className={styles.index} aria-label="Story sections">
        {STORY.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-current={active === i ? "true" : undefined}
            title={s.title}
            onClick={() => {
              jump(i);
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </nav>
      {STORY.map((s, i) => (
        <section
          key={s.id}
          id={`obsidia-${s.id}`}
          className={styles.chapter}
          aria-labelledby={`obsidia-${s.id}-title`}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <header className={styles.chapterHead}>
            <span className={styles.num} aria-hidden="true">
              {toRoman(i + 1)}
            </span>
            <div>
              <h3 id={`obsidia-${s.id}-title`}>{s.title}</h3>
              {s.when ? <p className={styles.when}>{s.when}</p> : null}
            </div>
          </header>
          {i < built ? s.blocks.map((b, k) => <Block key={k} block={b} />) : null}
          {i < built && s.chapters.length > 0 ? (
            <p className={styles.read}>
              Read it in the Experience:{" "}
              {s.chapters.map((id, k) => (
                <span key={id}>
                  {k > 0 ? ", " : ""}
                  <TLink
                    href={experienceHref(id)}
                    className={styles.readLink}
                    transitionLabel="Experience"
                  >
                    {id.startsWith("i-")
                      ? `interlude ${id.slice(-1)}`
                      : `chapter ${Number(id.slice(1))}`}
                  </TLink>
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ))}
    </>
  );
}

const TABS: readonly DrawerTab[] = [
  { id: "details", label: "Details", render: () => <DetailsBody /> },
  { id: "story", label: "Story", render: (scroller) => <StoryBody scroller={scroller} /> },
];

interface Props {
  present: boolean;
  shown: boolean;
  /** Draw the content now, still off screen (see ObsidiaDrawer). */
  warm?: boolean;
}

/**
 * The About page. Her details and her story share one drawer on the left, with a switch on top,
 * and her trailer sits small in the bottom right corner.
 */
export function AboutDrawer({ present, shown, warm }: Props) {
  return (
    <ObsidiaDrawer
      present={present}
      shown={shown}
      warm={warm}
      label="About Obsidia"
      tabs={TABS}
      dock={
        <VideoCard
          video={{
            sources: TRAILER.sources.map(({ label, height, src }) => ({ label, height, src })),
            poster: TRAILER.poster,
            title: TRAILER.title,
            skin: TRAILER_SKIN,
          }}
          duration={TRAILER.duration}
          tag="Trailer"
          className={styles.dockCard}
        />
      }
    />
  );
}
