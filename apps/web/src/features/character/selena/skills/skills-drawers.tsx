"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { PlayerOverlay } from "@/components/video-player/player-overlay";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { DrawerShell } from "../about/drawer-shell";
import styles from "./skills.module.css";
import { SKILL_CLIPS } from "./clips.generated";
import {
  CLIP_LABEL,
  EXTRAS,
  HOW_IT_FLOWS,
  LEVEL_HEAD,
  OVERVIEW,
  RATINGS,
  SKILLS,
  type ClipId,
  type FormId,
  type Skill,
} from "./skills-data";
import { skillClipPath, skillIconPath, skillPosterPath, skillSmallPath } from "./skills-media";

const FORM_NAME: Record<FormId, string> = { elven: "Elven Form", abyssal: "Abyssal Form" };

const bySlot = (form: FormId) => SKILLS.filter((s) => s.form === "both" || s.form === form);

function SkillCard({
  skill,
  open,
  onSelect,
}: {
  skill: Skill;
  open: boolean;
  onSelect: () => void;
}) {
  const head = LEVEL_HEAD[skill.scaling[0]?.values.length === 4 ? "four" : "six"];
  return (
    <li className={styles.skill} data-open={open}>
      <button
        type="button"
        className={styles.skillButton}
        aria-expanded={open}
        aria-controls={`skill-${skill.id}`}
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
      <div id={`skill-${skill.id}`} className={styles.detail} hidden={!open}>
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

function SkillsBody({
  form,
  onForm,
  selected,
  onSelect,
}: {
  form: FormId;
  onForm: (f: FormId) => void;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <header className={styles.head}>
        <p className={styles.kicker}>Skills</p>
        <h2 className={styles.title}>Two forms, one switch</h2>
        <p className={styles.lead}>
          Selena has two sets of skills. The ultimate swaps one set for the other. Press a skill to
          read it. Its clip plays in the demo.
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

      <div className={styles.forms} role="group" aria-label="Form">
        {(["elven", "abyssal"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={form === f}
            onClick={() => {
              onForm(f);
              audio.blip("click");
            }}
          >
            {FORM_NAME[f]}
          </button>
        ))}
      </div>

      <ul className={styles.list}>
        {bySlot(form).map((s) => (
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
        <h3>How the forms work together</h3>
        <ul>
          {HOW_IT_FLOWS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <p className={styles.source}>
        Skill numbers are from the game, and this is how it plays in Mobile Legends: Bang Bang. They
        are not part of the story.
      </p>
    </>
  );
}

/** A clip that loops quietly. A button below it opens the same clip with sound, full page. */
function Demo({ clip, note, children }: { clip: ClipId; note?: string; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(!reduced);
  const [inView, setInView] = useState(false);
  const [big, setBig] = useState(false);
  const meta = SKILL_CLIPS[clip];
  const label = CLIP_LABEL[clip];

  // The clip decodes only while it can be seen: not while the drawer is still off screen or
  // folded away, and not in a hidden tab.
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
      {children}
      {big
        ? createPortal(
            <PlayerOverlay
              video={{
                sources: [{ label: "1080p", height: 1080, src: skillClipPath(clip) }],
                poster: skillPosterPath(clip),
                title: label,
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

/** The form switch and the skill icons of that form. Pressing an icon picks the skill. */
function Picker({
  form,
  onForm,
  selected,
  onPick,
}: {
  form: FormId;
  onForm: (f: FormId) => void;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className={styles.picker}>
      <div className={styles.pickForms} role="group" aria-label="Form of the skills shown">
        {(["elven", "abyssal"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={form === f}
            onClick={() => {
              onForm(f);
              audio.blip("click");
            }}
          >
            {FORM_NAME[f]}
          </button>
        ))}
      </div>
      <ul className={styles.icons} aria-label="Skills">
        {bySlot(form).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={selected === s.id}
              aria-label={`${s.slot}: ${s.name}`}
              title={s.name}
              onPointerEnter={() => {
                audio.blip("hover");
              }}
              onClick={() => {
                onPick(s.id);
                audio.blip("click");
              }}
            >
              {/* Plain <img>: static export, a 100 px icon. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(skillIconPath(s.icon))}
                alt=""
                width={48}
                height={48}
                draggable={false}
              />
              <span>{s.slot}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoBody({
  skill,
  clip,
  onClip,
  form,
  onForm,
  onPick,
}: {
  skill: Skill;
  clip: ClipId;
  onClip: (c: ClipId) => void;
  form: FormId;
  onForm: (f: FormId) => void;
  onPick: (id: string) => void;
}) {
  const own = clip === skill.clip;
  return (
    <>
      <header className={styles.head}>
        <p className={styles.kicker}>Demonstration</p>
        <h2 className={styles.title}>{skill.name}</h2>
        <p className={styles.lead}>
          {skill.slot}
          {skill.form === "both" ? "" : `, ${FORM_NAME[skill.form]}`}. Clips come from the official
          skin showcase and show Selena only.
        </p>
      </header>

      <Demo clip={clip} note={own ? skill.clipNote : undefined}>
        <Picker form={form} onForm={onForm} selected={own ? skill.id : null} onPick={onPick} />
      </Demo>

      <section className={styles.more}>
        <h3>More from the skin showcase</h3>
        <ul>
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
                  width={96}
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
      </section>
    </>
  );
}

interface Props {
  present: boolean;
  shown: boolean;
}

/**
 * The Skills page. The skills sit on the left, in two forms, each one opening to its numbers. The
 * clip that shows the chosen skill plays on the right. She stays visible between them.
 */
export function SkillsDrawers({ present, shown }: Props) {
  const [form, setForm] = useState<FormId>("elven");
  const [selected, setSelected] = useState("abyssal-trap");
  const [clipOverride, setClipOverride] = useState<ClipId | null>(null);
  const skill = SKILLS.find((s) => s.id === selected) ?? SKILLS[1]!;
  const clip = clipOverride ?? skill.clip;

  const pick = (id: string) => {
    setSelected(id);
    setClipOverride(null);
  };

  const changeForm = (f: FormId) => {
    setForm(f);
    // Keep the open skill if it exists in the other form, otherwise open the first.
    const same = SKILLS.find((s) => s.slot === skill.slot && (s.form === f || s.form === "both"));
    pick((same ?? bySlot(f)[1]!).id);
  };

  return (
    <DrawerShell
      present={present}
      shown={shown}
      label="Selena's skills"
      left={{
        title: "Skills",
        aria: "Selena's skills",
        region: "Skills, scrollable",
        width: "clamp(21rem, 30vw, 32rem)",
        render: () => (
          <SkillsBody form={form} onForm={changeForm} selected={selected} onSelect={pick} />
        ),
      }}
      right={{
        title: "Demo",
        aria: "Skill demonstration",
        region: "Demonstration, scrollable",
        width: "clamp(21rem, 30vw, 32rem)",
        render: () => (
          <DemoBody
            skill={skill}
            clip={clip}
            onClip={setClipOverride}
            form={form}
            onForm={changeForm}
            onPick={pick}
          />
        ),
      }}
    />
  );
}
