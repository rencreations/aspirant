"use client";

import { useEffect, useRef, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useMediaQuery } from "@/lib/hooks";
import { experienceHref } from "@/features/character/links";

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

type Form = "normal" | "mecha";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.block}>
      <h3 className={styles.h3}>{title}</h3>
      {children}
    </section>
  );
}

/** The resume: who she is in short, with a picture that switches between her two forms. */
function ProfileBody() {
  const [form, setForm] = useState<Form>("normal");
  const c = getCharacter("selena");
  return (
    <>
      <header className={styles.who}>
        <div className={styles.portrait} data-form={form}>
          {(["normal", "mecha"] as const).map((f) => (
            // Plain <img>: static export, art already cropped.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f}
              className={styles.portraitImg}
              data-for={f}
              src={asset(aboutImagePath(`profile-${f}`))}
              alt={
                f === "normal"
                  ? "Concept art of Selena in her normal form, with her dragon above her"
                  : "Concept art of Selena in her mecha form, in white and blue armour with blade-wings"
              }
              width={242}
              height={484}
              draggable={false}
            />
          ))}
          <div className={styles.switch} role="group" aria-label="Form shown in the picture">
            {(["normal", "mecha"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={form === f}
                onClick={() => {
                  setForm(f);
                  audio.blip("click");
                }}
              >
                {f === "normal" ? "Normal" : "Mecha"}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.names}>
          <p className={styles.kicker}>Profile</p>
          <h2 className={styles.name}>Selena</h2>
          <p className={styles.jp} lang="ja">
            {c.jp.script}
            <span> {c.jp.romaji}</span>
          </p>
          <p className={styles.aka}>Silverbolt Raiko</p>
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

      <Section title="Personality">
        <ul className={styles.plain}>
          {c.sections.personality.map((p) => (
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
    <figure className={styles.shot} data-wide={block.wide ? "true" : "false"}>
      {/* Plain <img>: static export, a still taken from the official video. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(aboutImagePath(block.name))}
        alt={block.alt}
        width={block.wide ? 1440 : 1280}
        height={block.wide ? 608 : 720}
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

/** Her whole story, section by section, with a numbered index along the top. */
function StoryBody({ scroller }: { scroller: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLElement | null>>([]);

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
    const target = refs.current[i];
    if (!el || !target) return;
    el.scrollTo({ top: target.offsetTop - 52, behavior: "smooth" });
    audio.blip("click");
  };

  return (
    <>
      <header className={styles.storyHead}>
        <p className={styles.kicker}>Her story</p>
        <h2 className={styles.name}>From the storm to the lightning</h2>
        <p className={styles.summary}>
          Everything that happens to Selena, in the order it happens. Names in blue open a short
          note. Press play on a voice line to hear her.
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
          id={`selena-${s.id}`}
          className={styles.chapter}
          aria-labelledby={`selena-${s.id}-title`}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <header className={styles.chapterHead}>
            <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 id={`selena-${s.id}-title`}>{s.title}</h3>
              {s.when ? <p className={styles.when}>{s.when}</p> : null}
            </div>
          </header>
          {s.blocks.map((b, k) => (
            <Block key={k} block={b} />
          ))}
          {s.chapters.length > 0 ? (
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
                    chapter {Number(id.slice(1))}
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

interface Props {
  /** The drawers are mounted. They stay mounted while they slide away. */
  present: boolean;
  /** The drawers are open. */
  shown: boolean;
}

/**
 * The About page. Her profile slides in from the left and her story from the right, and she stays
 * visible between them. Each drawer scrolls on its own and has a tab that folds it away. On a
 * narrow screen they become one sheet at the bottom with two tabs.
 */
export function AboutDrawers({ present, shown }: Props) {
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [tab, setTab] = useState<"profile" | "story">("profile");
  const storyRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  // On a narrow screen the drawers are one sheet and cannot be folded.
  const narrow = useMediaQuery("(max-width: 56em), (max-aspect-ratio: 1/1)");
  if (!present) return null;
  return (
    <div className={styles.drawers} data-shown={shown} data-tab={tab} data-theme="daybreak">
      <div className={styles.tabs} role="tablist" aria-label="About Selena">
        {(["profile", "story"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              audio.blip("click");
            }}
          >
            {t === "profile" ? "Profile" : "Story"}
          </button>
        ))}
      </div>

      <aside
        className={styles.drawer}
        data-side="left"
        data-open={left}
        aria-label="Selena's profile"
      >
        <button
          type="button"
          className={styles.handle}
          aria-expanded={left}
          onClick={() => {
            setLeft((o) => !o);
            audio.blip("click");
          }}
        >
          <span>{left ? "Hide" : "Profile"}</span>
        </button>
        <div
          ref={profileRef}
          className={styles.scroll}
          tabIndex={0}
          data-lenis-prevent
          role="region"
          aria-label="Profile, scrollable"
          inert={!shown || (!left && !narrow)}
        >
          <ProfileBody />
        </div>
      </aside>

      <aside
        className={styles.drawer}
        data-side="right"
        data-open={right}
        aria-label="Selena's story"
      >
        <button
          type="button"
          className={styles.handle}
          aria-expanded={right}
          onClick={() => {
            setRight((o) => !o);
            audio.blip("click");
          }}
        >
          <span>{right ? "Hide" : "Story"}</span>
        </button>
        <div
          ref={storyRef}
          className={styles.scroll}
          tabIndex={0}
          data-lenis-prevent
          role="region"
          aria-label="Story, scrollable"
          inert={!shown || (!right && !narrow)}
        >
          <StoryBody scroller={storyRef} />
        </div>
      </aside>
    </div>
  );
}
