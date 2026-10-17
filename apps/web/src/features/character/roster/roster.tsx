"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { TLink } from "@/components/transition/t-link";
import type { PairId, Slug } from "@/content/types";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { prefersReducedMotion } from "@/lib/hooks";
import { clamp, damp } from "@/lib/math";
import { characterRoute } from "@/lib/site";

import type { RosterCharacter, RosterPair } from "./entries";
import styles from "./roster.module.css";

type Filter = "all" | PairId | "daybreak" | "storm";

const pad = (n: number) => String(n).padStart(2, "0");

/** Hover intent before a voice line plays, so sweeping across the roster stays quiet. */
const VOICE_DELAY = 240;
const PREVIEW_W = 340;
const PREVIEW_H = 460;
const PREVIEW_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 68.75em)";

export interface RosterProps {
  characters: readonly RosterCharacter[];
  pairs: readonly RosterPair[];
}

/**
 * The ten as a constellation of framed cards, grouped by pair with a tether that lights when
 * either member is hovered or focused. Filters are toggle buttons; hover and keyboard focus
 * play the character's signature line; on wide pointer screens a preview panel follows the
 * pointer (decorative: every card carries the same text).
 */
export function Roster({ characters, pairs }: RosterProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<Slug | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const follow = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0, last: 0, shown: false });
  const voiceTimer = useRef(0);
  const hideTimer = useRef(0);

  const bySlug = new Map(characters.map((c) => [c.slug, c]));
  const visible = (c: RosterCharacter) =>
    filter === "all" || c.pair === filter || c.side === filter;
  const shownCount = characters.filter(visible).length;
  const activeChar = active ? bySlug.get(active) : undefined;

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All ten" },
    ...pairs.map((p) => ({ id: p.id, label: p.names })),
    { id: "daybreak", label: "Daybreak" },
    { id: "storm", label: "Storm" },
  ];

  useEffect(() => {
    const f = follow.current;
    const timers = { voice: voiceTimer, hide: hideTimer };
    return () => {
      cancelAnimationFrame(f.raf);
      window.clearTimeout(timers.voice.current);
      window.clearTimeout(timers.hide.current);
    };
  }, []);

  const place = () => {
    const el = previewRef.current;
    const f = follow.current;
    if (!el) return;
    el.style.transform = `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 0)`;
  };

  const run = () => {
    const f = follow.current;
    if (f.raf) return;
    f.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - f.last) / 1000);
      f.last = now;
      f.x = damp(f.x, f.tx, 9, dt);
      f.y = damp(f.y, f.ty, 9, dt);
      place();
      if (Math.abs(f.x - f.tx) + Math.abs(f.y - f.ty) < 0.3 || !f.shown) {
        f.raf = 0;
        return;
      }
      f.raf = requestAnimationFrame(frame);
    };
    f.raf = requestAnimationFrame(frame);
  };

  /** Aim the preview beside a point, flipping sides near the right edge. */
  const aim = (x: number, y: number, snap: boolean) => {
    const f = follow.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    f.tx = x + 32 + PREVIEW_W > vw - 16 ? x - 32 - PREVIEW_W : x + 32;
    f.ty = clamp(y - PREVIEW_H * 0.45, 72, Math.max(72, vh - PREVIEW_H - 16));
    if (snap || prefersReducedMotion()) {
      f.x = f.tx;
      f.y = f.ty;
      place();
    } else run();
  };

  const previewOn = () => window.matchMedia(PREVIEW_QUERY).matches;

  const engage = (c: RosterCharacter) => {
    setActive(c.slug);
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(voiceTimer.current);
    if (!c.voice) return;
    const src = asset(c.voice.src);
    audio.preloadVoice(src);
    voiceTimer.current = window.setTimeout(() => void audio.playVoice(src), VOICE_DELAY);
  };

  // A short grace period, so moving from card to card glides instead of blinking.
  const release = () => {
    window.clearTimeout(voiceTimer.current);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      follow.current.shown = false;
      setPreviewing(false);
      setActive(null);
    }, 140);
  };

  const onEnter = (c: RosterCharacter, e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "mouse") return;
    audio.blip("hover");
    engage(c);
    if (previewOn()) {
      const wasShown = follow.current.shown;
      follow.current.shown = true;
      setPreviewing(true);
      aim(e.clientX, e.clientY, !wasShown);
    }
  };

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || !follow.current.shown) return;
    aim(e.clientX, e.clientY, false);
  };

  const onFocus = (c: RosterCharacter, e: FocusEvent<HTMLAnchorElement>) => {
    if (!e.currentTarget.matches(":focus-visible")) return;
    engage(c);
    if (previewOn()) {
      const r = e.currentTarget.getBoundingClientRect();
      follow.current.shown = true;
      setPreviewing(true);
      aim(r.right - 24, r.top + r.height / 2, true);
    }
  };

  const choose = (id: Filter) => {
    audio.blip("click");
    setFilter(id);
  };

  return (
    <div className={styles.root} onPointerMove={onMove}>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Filter the roster" className={styles.filters}>
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={styles.filter}
              aria-pressed={filter === f.id}
              data-kind={f.id === "daybreak" || f.id === "storm" ? f.id : undefined}
              onClick={() => choose(f.id)}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") audio.blip("hover");
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className={`${styles.count} hud-label`} aria-hidden="true">
          Queue order <span className={styles.countValue}>{pad(shownCount)}</span> / 10
        </p>
        <p className="sr-only" aria-live="polite">
          {`Showing ${shownCount} of 10.`}
        </p>
      </div>

      <ol className={styles.constellation}>
        {pairs.map((pair, gi) => {
          const members = pair.members
            .map((slug) => bySlug.get(slug))
            .filter((c): c is RosterCharacter => c !== undefined)
            .sort((a, b) => a.order - b.order);
          const shown = members.filter(visible);
          const [a, b] = members;
          const groupStyle = {
            "--pa": a?.colour,
            "--pb": b?.colour,
          } as CSSProperties;
          const lit = active !== null && pair.members.includes(active);
          return (
            <li
              key={pair.id}
              className={styles.group}
              hidden={shown.length === 0}
              data-lit={lit}
              data-single={shown.length === 1}
              style={groupStyle}
            >
              <div className={styles.groupHead}>
                <p className={`${styles.groupCode} hud-label`}>
                  Pair {pad(gi + 1)} /{" "}
                  {pair.kind === "partners" ? "Partners" : "Creator and creation"}
                </p>
                <h2 className={styles.groupTitle}>{pair.names}</h2>
                <p className={styles.groupLine}>{pair.tagline}</p>
              </div>
              <ul className={styles.members}>
                {members.map((c, mi) => (
                  <li
                    key={c.slug}
                    className={styles.member}
                    data-pos={mi === 0 ? "a" : "b"}
                    hidden={!visible(c)}
                  >
                    <RosterCard
                      character={c}
                      active={active === c.slug}
                      onEnter={onEnter}
                      onLeave={release}
                      onFocus={onFocus}
                    />
                  </li>
                ))}
                <li className={styles.tether} aria-hidden="true">
                  <span className={styles.tetherLine} />
                  <span className={styles.tetherNode} />
                </li>
              </ul>
            </li>
          );
        })}
      </ol>

      <div
        ref={previewRef}
        className={styles.preview}
        aria-hidden="true"
        data-visible={activeChar !== undefined && previewing}
        style={activeChar?.vars}
      >
        {activeChar && <Preview character={activeChar} />}
      </div>
    </div>
  );
}

interface RosterCardProps {
  character: RosterCharacter;
  active: boolean;
  onEnter: (c: RosterCharacter, e: PointerEvent<HTMLAnchorElement>) => void;
  onLeave: () => void;
  onFocus: (c: RosterCharacter, e: FocusEvent<HTMLAnchorElement>) => void;
}

function RosterCard({ character: c, active, onEnter, onLeave, onFocus }: RosterCardProps) {
  return (
    <TLink
      href={characterRoute(c.slug)}
      transitionLabel={c.name}
      className={styles.card}
      style={c.vars}
      data-active={active}
      data-side={c.side}
      data-cursor="OPEN"
      onPointerEnter={(e) => onEnter(c, e)}
      onPointerLeave={onLeave}
      onFocus={(e) => onFocus(c, e)}
      onBlur={onLeave}
    >
      <Frame shape={c.shape} accent="var(--accent)" maxTilt={9} className={styles.frame}>
        <FrameImage
          src={`/img/char/${c.slug}/splash-sm.webp`}
          srcSet={`/img/char/${c.slug}/splash-sm.webp 800w, /img/char/${c.slug}/splash.webp 2048w`}
          sizes="(min-width: 68.75em) 32vw, (min-width: 40em) 60vw, 180vw"
          alt=""
          width={800}
          height={450}
          objectPosition={c.focus}
        />
        <span className={styles.cardShade} aria-hidden="true" />
        <span className={styles.cardUnit} aria-hidden="true">
          {pad(c.order)}
        </span>
        <span className={styles.cardSide} aria-hidden="true">
          {c.side === "storm" ? "Storm" : "Daybreak"}
        </span>
      </Frame>
      <span className={styles.cardText}>
        <span className={styles.cardName}>{c.name}</span>
        <span className={styles.cardAspirant}>{c.aspirantName}</span>
        <span className={styles.cardJp} lang="ja">
          {c.jp}
        </span>
      </span>
    </TLink>
  );
}

function Preview({ character: c }: { character: RosterCharacter }) {
  const art = c.cutout;
  return (
    <div className={styles.previewInner}>
      <div className={styles.previewArt} data-cutout={art !== null}>
        {/* Decorative duplicate of the card under the pointer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(art ? art.src : `/img/char/${c.slug}/splash-sm.webp`)}
          alt=""
          decoding="async"
          style={{ objectPosition: art ? c.cutoutFocus : c.focus }}
        />
      </div>
      <div className={styles.previewText}>
        <p className={styles.previewCode}>
          Unit {pad(c.order)} / 10 <span>{c.side === "storm" ? "Storm" : "Daybreak"}</span>
        </p>
        <p className={styles.previewAspirant}>{c.aspirantName}</p>
        <p className={styles.previewJp}>
          <span lang="ja">{c.jp}</span>
          {c.romaji && <span>{c.romaji}</span>}
        </p>
        <p className={styles.previewTagline}>{c.tagline}</p>
        {c.voice && (
          <p className={styles.previewVoice}>
            {/^["“']/.test(c.voice.en) ? c.voice.en : `“${c.voice.en}”`}
          </p>
        )}
      </div>
    </div>
  );
}
