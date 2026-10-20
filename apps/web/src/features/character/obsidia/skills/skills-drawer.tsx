"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PlayerOverlay } from "@/components/video-player/player-overlay";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";
import { perfLevel } from "@/lib/perf";

import base from "../about/about.module.css";
import { ObsidiaDrawer, type DrawerTab } from "../drawer/drawer";
import { TRAILER_SKIN } from "../media";
import { SKILL_CLIPS } from "./clips.generated";
import styles from "./skills.module.css";
import {
  CLIP_LABEL,
  EXTRAS,
  HOW_IT_FLOWS,
  levelHead,
  OVERVIEW,
  RATINGS,
  SKILLS,
  STAT_NOTES,
  STATS,
  type ClipId,
  type Skill,
} from "./skills-data";
import { skillClipPath, skillIconPath, skillPosterPath, skillSmallPath } from "./skills-media";

function SkillCard({
  skill,
  open,
  onSelect,
}: {
  skill: Skill;
  open: boolean;
  onSelect: () => void;
}) {
  const head = levelHead(skill.scaling[0]?.values.length ?? 6);
  return (
    <li className={styles.skill} data-open={open}>
      <button
        type="button"
        className={styles.skillButton}
        aria-expanded={open}
        aria-controls={`obsidia-skill-${skill.id}`}
        onClick={onSelect}
        onPointerEnter={() => {
          audio.blip("hover");
        }}
      >
        {/* Plain <img>: static export, a 100 px icon. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.icon}
          src={asset(skillIconPath(skill.icon))}
          alt=""
          width={52}
          height={52}
          draggable={false}
        />
        <span className={styles.skillHead}>
          <span className={styles.slot}>{skill.slot}</span>
          <span className={styles.skillName}>{skill.name}</span>
          <span className={styles.tags}>
            {skill.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      <div id={`obsidia-skill-${skill.id}`} className={styles.detail} hidden={!open}>
        {skill.text.map((t) => (
          <p key={t}>{t}</p>
        ))}
        {skill.scaling.length > 0 ? (
          <table className={styles.table}>
            <caption className="sr-only">{skill.name}, by skill level</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Property</span>
                </th>
                {head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skill.scaling.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {skill.altIcon ? (
          <p className={styles.alt}>
            {/* Plain <img>: static export, a 100 px icon. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset(skillIconPath(skill.altIcon.file))}
              alt=""
              width={32}
              height={32}
              draggable={false}
            />
            <span>{skill.altIcon.label} icon</span>
          </p>
        ) : null}
        {skill.notes.length > 0 ? (
          <ul className={styles.notes}>
            {skill.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function SkillsBody({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <>
      <header className={styles.head}>
        <p className={base.kicker}>Skills</p>
        <h2 className={base.name}>Four skills, one hunt</h2>
        <p className={styles.lead}>
          A passive and three skills. Press one to read it. Its clip plays in the corner.
        </p>
      </header>

      <dl className={styles.overview}>
        {OVERVIEW.map((o) => (
          <div key={o.label}>
            <dt>{o.label}</dt>
            <dd>{o.value}</dd>
          </div>
        ))}
      </dl>

      <ul className={styles.ratings} aria-label="Ratings out of 10">
        {RATINGS.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <span
              className={styles.meter}
              role="img"
              aria-label={`${r.label}: ${r.value} out of 10`}
              style={{ ["--v" as string]: r.value / 10 }}
            />
            <b>{r.value}</b>
          </li>
        ))}
      </ul>

      <ul className={styles.list}>
        {SKILLS.map((s) => (
          <SkillCard
            key={s.id}
            skill={s}
            open={selected === s.id}
            onSelect={() => {
              onSelect(s.id);
              audio.blip("click");
            }}
          />
        ))}
      </ul>

      <section className={styles.flow}>
        <h3>How they work together</h3>
        <ul>
          {HOW_IT_FLOWS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className={styles.flow}>
        <h3>Stats</h3>
        <table className={styles.table}>
          <caption className="sr-only">Base stats at level 1 and level 15</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Stat</span>
              </th>
              <th scope="col">Level 1</th>
              <th scope="col">Level 15</th>
              <th scope="col">Growth</th>
            </tr>
          </thead>
          <tbody>
            {STATS.map((s) => (
              <tr key={s.label}>
                <th scope="row">{s.label}</th>
                <td>{s.first}</td>
                <td>{s.fifteenth}</td>
                <td>{s.growth}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {STAT_NOTES.map((n) => (
          <p key={n} className={styles.source}>
            {n}
          </p>
        ))}
      </section>

      <p className={styles.source}>
        Skill numbers are from the game, and this is how it plays in Mobile Legends: Bang Bang. They
        are not part of the story.
      </p>
    </>
  );
}

function ShowcaseBody({ clip, onClip }: { clip: ClipId; onClip: (c: ClipId) => void }) {
  return (
    <>
      <header className={styles.head}>
        <p className={base.kicker}>Skin showcase</p>
        <h2 className={base.name}>Imperatrix Arashi</h2>
        <p className={styles.lead}>
          Clips from the official skin showcase. They show Obsidia only. Press one to play it in the
          corner.
        </p>
      </header>
      <ul className={styles.more}>
        {EXTRAS.map((e) => (
          <li key={e.clip}>
            <button
              type="button"
              aria-pressed={clip === e.clip}
              onClick={() => {
                onClip(e.clip);
                audio.blip("click");
              }}
            >
              {/* Plain <img>: static export, a poster of the clip. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(skillPosterPath(e.clip))}
                alt=""
                width={e.clip === "idle" || e.clip === "interactive" ? 54 : 96}
                height={54}
                loading="lazy"
                draggable={false}
              />
              <span>
                <strong>{e.title}</strong>
                <em>{e.note}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The clip in the corner: a small silent loop, with a button that pauses it and one that opens the
 * same clip with sound, full page, in the custom player in her colours.
 */
function ClipDock({ clip, note }: { clip: ClipId; note?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  // The light level does not start it by itself (a second video to decode beside the picture).
  const [playing, setPlaying] = useState(!reduced && perfLevel() !== "lite");
  const [inView, setInView] = useState(false);
  const [big, setBig] = useState(false);
  const meta = SKILL_CLIPS[clip];
  const label = CLIP_LABEL[clip];

  // The clip decodes only while it can be seen: not while the drawer is still off screen.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting ?? false);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (playing && inView) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, inView, clip]);

  const getOrigin = useCallback(() => frame.current?.getBoundingClientRect() ?? null, []);

  return (
    <figure className={styles.demo}>
      <div
        ref={frame}
        className={styles.screen}
        data-portrait={meta.portrait}
        style={{ ["--ratio" as string]: meta.portrait ? "960 / 920" : "16 / 9" }}
      >
        <video
          key={clip}
          ref={ref}
          className={styles.clip}
          src={mediaUrl(skillSmallPath(clip))}
          poster={asset(skillPosterPath(clip))}
          muted
          loop
          playsInline
          aria-label={`${label}, demonstration without sound`}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-label={playing ? "Pause the clip" : "Play the clip"}
          aria-pressed={playing}
          onClick={() => {
            setPlaying((p) => !p);
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            {playing ? (
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
            ) : (
              <path d="M8 5v14l11-7z" fill="currentColor" />
            )}
          </svg>
        </button>
      </div>
      <figcaption>
        <strong>{label}</strong>
        {note ? <span>{note}</span> : null}
        <button
          type="button"
          className={styles.big}
          onClick={() => {
            setBig(true);
          }}
        >
          Watch with sound
        </button>
      </figcaption>
      {big
        ? createPortal(
            <PlayerOverlay
              video={{
                sources: [{ label: "1080p", height: 1080, src: skillClipPath(clip) }],
                poster: skillPosterPath(clip),
                title: label,
                skin: TRAILER_SKIN,
              }}
              getOrigin={getOrigin}
              onClosed={() => {
                setBig(false);
              }}
            />,
            document.body,
          )
        : null}
    </figure>
  );
}

interface Props {
  present: boolean;
  shown: boolean;
  /** Draw the content now, still off screen (see ObsidiaDrawer). */
  warm?: boolean;
}

/**
 * The Skills page. The skills are on the left, each one opening to its numbers, and the clip that
 * shows the chosen skill plays small in the bottom right corner. She stays visible between them.
 */
export function SkillsDrawer({ present, shown, warm }: Props) {
  const [selected, setSelected] = useState("abyssal-bone-needle");
  const [clipOverride, setClipOverride] = useState<ClipId | null>(null);
  const skill = SKILLS.find((s) => s.id === selected) ?? SKILLS[1]!;
  const clip = clipOverride ?? skill.clip;

  const tabs = useMemo<readonly DrawerTab[]>(
    () => [
      {
        id: "skills",
        label: "Skills",
        render: () => (
          <SkillsBody
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setClipOverride(null);
            }}
          />
        ),
      },
      {
        id: "showcase",
        label: "Showcase",
        render: () => <ShowcaseBody clip={clip} onClip={setClipOverride} />,
      },
    ],
    [selected, clip],
  );

  return (
    <ObsidiaDrawer
      present={present}
      shown={shown}
      warm={warm}
      label="Obsidia's skills"
      tabs={tabs}
      dock={<ClipDock clip={clip} note={clipOverride === null ? skill.clipNote : undefined} />}
    />
  );
}
