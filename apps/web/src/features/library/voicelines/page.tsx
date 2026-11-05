"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { useVoiceState } from "@/lib/hooks";

import { useLibraryData } from "../data";
import { Chips, ControlBar } from "../shell/controls";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { Icon } from "./icons";
import { groupItems, nextAfter, playOrder, randomFrom, totalLength } from "./logic";
import { CharacterPanel } from "./panel";
import { lineUrl, stopRoom, toggleLine } from "./playback";
import { Rail, railEntries } from "./rail";
import { TrailerPanel } from "./trailer-panel";
import type { VoiceItem, VoiceLang, VoicelinesFile } from "./types";
import styles from "./voicelines.module.css";

const LANG_OPTIONS = [
  { value: "ja", label: "Japanese" },
  { value: "en", label: "English" },
] as const;

function asLang(value: string): VoiceLang {
  return value === "ja" || value === "en" ? value : "";
}

function scrollToId(id: string, block: ScrollLogicalPosition, behavior: ScrollBehavior): void {
  document.getElementById(id)?.scrollIntoView({ behavior, block });
}

/**
 * The voicelines room: one panel for each of the ten Aspirants, with every line in Japanese and
 * English, a play button and a live waveform, the long recording of each, and the sixteen clips
 * of the Ruby and Angela trailer. Search, a language switch, a random line and "play next".
 */
export default function VoicelinesPage() {
  const { data } = useLibraryData<VoiceItem>("voicelines");
  const file = data as VoicelinesFile | null;
  const [q, setQ] = useQueryState("q");
  const [langParam, setLang] = useQueryState("lang");
  const [who, setWho] = useQueryState("who");
  const [target, setTarget] = useQueryState("i");
  const lang = asLang(langParam);
  const voice = useVoiceState();

  const layoutRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);
  const lastPlayed = useRef<string | null>(null);
  const [barH, setBarH] = useState(120);
  const [active, setActive] = useState("fanny");

  const characters = useMemo(() => file?.characters ?? [], [file]);
  const grouped = useMemo(
    () => (file ? groupItems(file.items, file.characters, q) : null),
    [file, q],
  );
  const order = useMemo(
    () => (grouped ? playOrder(grouped, characters) : []),
    [grouped, characters],
  );
  const urlToId = useMemo(
    () => new Map((file?.items ?? []).map((i) => [lineUrl(i), i.id])),
    [file],
  );
  const playingId = voice.playing && voice.url ? (urlToId.get(voice.url) ?? null) : null;
  const searching = q.trim() !== "";

  // The sticky bar's height, so the rail and the scroll stops sit under it.
  useLayoutEffect(() => {
    let el: HTMLElement | null = meterRef.current;
    while (el && getComputedStyle(el).position !== "sticky") el = el.parentElement;
    if (!el) return;
    const bar = el;
    const read = () => {
      setBarH(Math.round(bar.getBoundingClientRect().height));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(bar);
    return () => {
      ro.disconnect();
    };
  }, []);

  // Stop what this room started when the visitor leaves.
  useEffect(
    () => () => {
      stopRoom();
    },
    [],
  );

  // A link to a line (`?i=`) or to a character (`?who=`) scrolls there once the data has drawn.
  const arrived = useRef(false);
  useEffect(() => {
    if (!file || arrived.current) return;
    arrived.current = true;
    const id = target || (who ? `vl-${who}` : "");
    if (!id) return;
    const go = () => {
      scrollToId(id, target ? "center" : "start", "instant");
    };
    requestAnimationFrame(go);
    // Rows far down the page change height as they draw, so the stop is taken again.
    const again = window.setTimeout(go, 350);
    return () => {
      window.clearTimeout(again);
    };
  }, [file, target, who]);

  // Which panel is at the top, for the rail.
  useEffect(() => {
    if (!file) return;
    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-slug]"));
    if (panels.length === 0) return;
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const slug = (e.target as HTMLElement).dataset.slug ?? "";
          if (e.isIntersecting) seen.add(slug);
          else seen.delete(slug);
        }
        const first = panels.find((p) => seen.has(p.dataset.slug ?? ""));
        if (first?.dataset.slug) setActive(first.dataset.slug);
      },
      { rootMargin: `-${barH + 80}px 0px -55% 0px` },
    );
    for (const p of panels) io.observe(p);
    return () => {
      io.disconnect();
    };
  }, [file, grouped, barH]);

  const onToggle = useCallback((item: VoiceItem) => {
    lastPlayed.current = item.id;
    toggleLine(item);
  }, []);

  const playItem = (item: VoiceItem | null) => {
    if (!item) return;
    lastPlayed.current = item.id;
    setTarget(item.id);
    scrollToId(item.id, "center", "smooth");
    toggleLine(item);
  };
  const random = () => {
    playItem(randomFrom(order, playingId ?? lastPlayed.current));
  };
  const next = () => {
    playItem(nextAfter(order, playingId ?? lastPlayed.current));
  };

  const pick = (id: string) => {
    setWho(id);
    setActive(id);
    scrollToId(`vl-${id}`, "start", "smooth");
  };

  // Up and Down move between the play buttons. Enter plays the focused one (a plain button).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(
      layoutRef.current?.querySelectorAll<HTMLElement>("[data-voice-play]") ?? [],
    );
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    e.preventDefault();
    buttons[
      Math.min(buttons.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))
    ]?.focus();
  };

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of characters) out[c.slug] = grouped?.lines[c.slug]?.length ?? 0;
    return out;
  }, [characters, grouped]);
  const matches = order.length;
  const summary = !file
    ? "Loading the voice lines"
    : searching
      ? `${matches} ${matches === 1 ? "line matches" : "lines match"}`
      : `${file.totals.lines} lines, ${file.totals.compilations} recordings, ${file.totals.trailer} trailer clips`;

  // The two buttons and the language switch sit in the sticky bar on wide screens. On a phone the
  // bar would take a third of the screen, so they are drawn once more above the panels instead.
  const actions = (
    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={random} disabled={matches === 0}>
        <Icon name="shuffle" />
        <span>Random line</span>
      </button>
      <button type="button" className={styles.action} onClick={next} disabled={matches === 0}>
        <Icon name="next" />
        <span>Play next</span>
      </button>
    </div>
  );
  const languages = (
    <Chips label="Language" options={LANG_OPTIONS} value={lang} all="Both" onChange={setLang} />
  );

  const controls = (
    <ControlBar
      query={q}
      onQuery={setQ}
      placeholder="Search the Japanese, the English or a name"
      summary={summary}
      trailing={<div className={styles.inBar}>{actions}</div>}
    >
      <span ref={meterRef} className={styles.meter} aria-hidden="true" />
      <div className={styles.inBar}>{languages}</div>
    </ControlBar>
  );

  const stat = file ? `${totalLength(file.totals.seconds)} of audio` : undefined;
  const style = { "--vl-bar-h": `${barH}px` } as CSSProperties;

  return (
    <LibraryShell
      slug="voicelines"
      count={file ? file.items.length : null}
      stat={stat}
      controls={controls}
    >
      <div ref={layoutRef} className={`${styles.layout} shell`} style={style} onKeyDown={onKeyDown}>
        {file && grouped ? (
          <>
            <div className={styles.phoneControls}>
              {actions}
              {languages}
            </div>
            <Rail
              entries={railEntries(characters, counts, grouped.trailer.length)}
              active={active}
              onPick={pick}
            />
            <div className={styles.panels}>
              {matches === 0 ? (
                <p className={styles.empty} role="status">
                  No voice line matches. Try a name, a word of the English or a few characters of
                  the Japanese.
                </p>
              ) : null}
              {characters.map((c, i) => {
                const lines = grouped.lines[c.slug] ?? [];
                if (searching && lines.length === 0) return null;
                return (
                  <CharacterPanel
                    key={c.slug}
                    character={c}
                    index={i}
                    lines={lines}
                    compilation={searching ? undefined : grouped.compilations[c.slug]}
                    lang={lang}
                    playingId={playingId}
                    targetId={target || null}
                    searching={searching}
                    onToggle={onToggle}
                  />
                );
              })}
              {grouped.trailer.length > 0 ? (
                <TrailerPanel
                  clips={grouped.trailer}
                  characters={characters}
                  lang={lang}
                  playingId={playingId}
                  targetId={target || null}
                  onToggle={onToggle}
                />
              ) : null}
            </div>
          </>
        ) : (
          <p className={styles.empty}>Loading the voice lines...</p>
        )}
      </div>
    </LibraryShell>
  );
}
