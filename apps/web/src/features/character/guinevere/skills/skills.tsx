"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";
import { mediaUrl } from "@/lib/media-store";

import { mayPlay } from "../../vexana/shared/autoplay";
import { videoFile, videoPoster } from "../media";
import { SKILLS, type Skill } from "./skill-data";
import styles from "./skills.module.css";

const noSubscribe = () => () => undefined;

/**
 * The screen: one video for each skill, stacked, the open one on top. The clips are short pieces
 * of the game's own footage, muted and looping. They run only while the screen is in view and the
 * visitor has not paused them, and they stay still under reduced motion until the button is
 * pressed. A clip is a file of under a megabyte, and the background queue has usually brought it
 * by the time the section is reached.
 */
function Screen({ active, skill }: { active: number; skill: Skill }) {
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);
  const view = useRef({ near: false, seen: false });
  // Whether the clip may start by itself is decided on the client (the server never plays it).
  const auto = useSyncExternalStore(
    noSubscribe,
    () => !reduced && mayPlay(),
    () => false,
  );
  const [pressed, setPressed] = useState<boolean | null>(null);
  const want = pressed ?? auto;

  const apply = useCallback(() => {
    const { near, seen } = view.current;
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active && near && seen && want && document.visibilityState === "visible") {
        if (v.paused) void v.play().catch(() => undefined);
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, [active, want]);

  // The newly opened clip starts from its first frame.
  useEffect(() => {
    const v = videos.current[active];
    if (v && v.currentTime > 0.05) v.currentTime = 0;
  }, [active]);

  useEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const warm = new IntersectionObserver(
      ([e]) => {
        view.current.near = e?.isIntersecting ?? false;
        if (view.current.near) {
          videos.current.forEach((v) => {
            if (v && v.preload !== "auto") v.preload = "auto";
          });
        }
        apply();
      },
      { rootMargin: "80% 0px 80% 0px" },
    );
    const seen = new IntersectionObserver(
      ([e]) => {
        view.current.seen = e?.isIntersecting ?? false;
        apply();
      },
      { threshold: 0.3 },
    );
    warm.observe(frame);
    seen.observe(frame);
    document.addEventListener("visibilitychange", apply);
    return () => {
      warm.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [apply]);

  return (
    <div ref={frameRef} className={styles.screen}>
      {SKILLS.map((s, i) => (
        <video
          key={s.id}
          ref={(el) => {
            videos.current[i] = el;
          }}
          className={styles.clip}
          data-on={i === active}
          src={mediaUrl(videoFile(s.clip))}
          poster={asset(videoPoster(s.clip))}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden="true"
        />
      ))}

      <span className={styles.shade} aria-hidden="true" />
      <span className={styles.corner} data-at="tl" aria-hidden="true" />
      <span className={styles.corner} data-at="tr" aria-hidden="true" />
      <span className={styles.corner} data-at="bl" aria-hidden="true" />
      <span className={styles.corner} data-at="br" aria-hidden="true" />
      <span key={skill.id} className={styles.sweep} aria-hidden="true" />

      <p className={styles.tag}>
        {/* Plain <img>: static export, the icon is 100 px. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(skill.icon)} alt="" width={28} height={28} draggable={false} />
        <span>{skill.slot}</span>
      </p>

      <button
        type="button"
        className={styles.toggle}
        aria-pressed={want}
        onClick={() => {
          setPressed(!want);
        }}
      >
        <span className={styles.toggleIcon} data-on={want} aria-hidden="true" />
        <span>{want ? "Pause clip" : "Play clip"}</span>
      </button>
    </div>
  );
}

/**
 * The detail of the open skill. The plate keeps one height for every skill (the height of the
 * screen and the dock beside it), and its content scrolls inside it, so nothing around it moves
 * when another skill is opened.
 */
function Plate({ skill }: { skill: Skill }) {
  return (
    <div className={styles.plateBox}>
      <article
        key={skill.id}
        id={`vx-skill-panel-${skill.id}`}
        role="tabpanel"
        aria-labelledby={`vx-skill-tab-${skill.id}`}
        className={styles.plate}
        // The panel scrolls, so the keyboard must be able to reach it.
        tabIndex={0}
      >
        <p className={styles.tags}>
          <span className={styles.slot}>{skill.slot}</span>
          {skill.tags.map((t) => (
            <span key={t} className={styles.chip}>
              {t}
            </span>
          ))}
          {skill.ratio ? <span className={styles.chip}>{skill.ratio}</span> : null}
        </p>

        <h3 className={styles.name}>{skill.name}</h3>

        <div className={styles.copy}>
          <p>{skill.description}</p>
        </div>

        {skill.terms.length > 0 ? (
          <dl className={styles.terms}>
            <dt>Skill terms</dt>
            {skill.terms.map((t) => (
              <dd key={t.name}>
                <b>{t.name}</b>
                {t.text ? <span>{t.text}</span> : null}
              </dd>
            ))}
          </dl>
        ) : null}

        {skill.rows.length > 0 ? (
          <>
            <p className={styles.scaling}>{skill.scaling}</p>
            <div
              className={styles.tableWrap}
              role="region"
              tabIndex={0}
              aria-label={`${skill.name}, level table`}
            >
              <table className={styles.table}>
                <caption className="sr-only">
                  {skill.name}, {skill.scaling.toLowerCase()}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{skill.propertyHead}</th>
                    {skill.heads.map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skill.rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {r.values.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {skill.notes.length > 0 ? (
          <>
            <p className={styles.scaling}>Notes</p>
            <ul className={styles.notes}>
              {skill.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        ) : null}
      </article>
    </div>
  );
}

/**
 * Her craft. The screen shows the game's own footage of the skill that is open, the dock under
 * it holds one key for the passive and for each skill, and the plate beside it says how the skill
 * behaves, with the wiki's own text and figures. Any key opens at any time, in any order: nothing
 * steps with the scroll.
 */
export function Skills() {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const skill = SKILLS[active] ?? SKILLS[0]!;

  const choose = useCallback((i: number, focus = false) => {
    setActive(i);
    audio.blip("click");
    if (focus) tabs.current[i]?.focus();
  }, []);

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = SKILLS.length - 1;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % SKILLS.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i + last) % SKILLS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(to, true);
  };

  return (
    <section
      id="skills"
      className={styles.skills}
      data-theme="storm"
      aria-labelledby="skills-title"
      style={{ ["--sk" as string]: skill.tone }}
    >
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowNo}>03</span>
          <span className={styles.eyebrowBar} aria-hidden="true" />
          <span>Craft</span>
        </p>
        <h2 id="skills-title" className={styles.title}>
          In-game
          <br />
          <em>Skills</em>
        </h2>
      </header>

      <div className={styles.console}>
        <div className={styles.left}>
          <Screen active={active} skill={skill} />

          <div className={styles.dock} role="tablist" aria-label="Skills">
            {SKILLS.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`vx-skill-tab-${s.id}`}
                type="button"
                role="tab"
                className={styles.key}
                style={{ ["--tone" as string]: s.tone }}
                aria-selected={i === active}
                aria-controls={`vx-skill-panel-${s.id}`}
                tabIndex={i === active ? 0 : -1}
                data-cursor="SHOW"
                onClick={() => {
                  choose(i);
                }}
                onKeyDown={(e) => {
                  onKey(e, i);
                }}
                onPointerEnter={() => {
                  audio.blip("hover");
                }}
              >
                <span className={styles.keyIcon}>
                  {/* Plain <img>: static export, the icon is 100 px. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(s.icon)} alt="" width={100} height={100} draggable={false} />
                  {s.icon2 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.keyAlt}
                      src={asset(s.icon2)}
                      alt=""
                      width={100}
                      height={100}
                      draggable={false}
                    />
                  ) : null}
                </span>
                <span className={styles.keySlot}>{s.slot}</span>
                <span className={styles.keyName}>{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Plate skill={skill} />
      </div>

      <p className={styles.credit}>
        Names, text and figures: Mobile Legends: Bang Bang Wiki, Guinevere. The clips are the game's
        footage.
      </p>
    </section>
  );
}
