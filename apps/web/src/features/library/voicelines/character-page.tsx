"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { ThemeZone } from "@/components/theme-zone";
import { audio } from "@/lib/audio";
import { useVoiceState } from "@/lib/hooks";
import { CHARACTER_NAMES, type CharacterSlug } from "@/lib/slugs";

import { SplashArt } from "../arts/cosplay/art";
import { ArtsTakedown } from "../arts/core/chrome";
import { BackToCollection } from "../shell/room-chrome";
import { useQueryState } from "../use-query-state";
import { downloadAll } from "./download-all";
import { Icon } from "./icons";
import { LanguageRail } from "./language-rail";
import { LineRow } from "./line-row";
import { langInfo, parseLang, type LangId } from "./languages";
import {
  VOICELINES_ROUTE,
  defaultTranslation,
  filterLines,
  lineAudioUrl,
  lineOriginal,
  lineParam,
  pad,
  parseTranslation,
  totalLength,
  translationOf,
  translationOptions,
} from "./model";
import { stopRoom, toggleLine } from "./playback";
import { Recording, TrailerClips } from "./recording";
import type { VoiceLine } from "./types";
import { useCharacterFile } from "./voice-data";
import styles from "./character.module.css";

/** A file name for inside a zip: the number and the first words of the line. */
function zipEntryName(line: VoiceLine, ext: string): string {
  const words = line.t
    .replace(/[\\/:*?"<>|\n\r]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 60);
  return `${pad(line.n)} ${words}.${ext}`.trim();
}

interface Progress {
  done: number;
  total: number;
  failed: number | null;
}

/**
 * The voice lines of one Aspirant (`/collection/voicelines/<slug>`), in eight languages.
 *
 * The language is a parameter of this page (`?lang=jp`, Japanese when there is none), never another
 * page: the rail on the side changes it in place and writes the address without adding to the
 * history, so the browser's Back and the button at the top both go to the room. The same goes for
 * the translation under each line (`?tr=`), the search (`?q=`) and the line an address points at
 * (`?i=`).
 */
export default function CharacterPage({ character }: { character: CharacterSlug }) {
  const name = CHARACTER_NAMES[character];
  const { data, failed } = useCharacterFile(character);
  const [langParam, setLangParam] = useQueryState("lang");
  const [trParam, setTrParam] = useQueryState("tr");
  const [iParam, setIParam] = useQueryState("i");
  const [q, setQ] = useQueryState("q");
  const lang = parseLang(langParam);
  const info = langInfo(lang);
  const into = parseTranslation(trParam, lang);
  const options = translationOptions(lang);
  const voice = useVoiceState();
  const playingUrl = voice.playing ? voice.url : null;

  const [playOn, setPlayOn] = useState(false);
  const [saving, setSaving] = useState<Progress | null>(null);
  const abort = useRef<AbortController | null>(null);

  const all = data?.langs[lang] ?? null;
  // The compiler memoizes these; a lookup in a few dozen lines is cheap either way.
  const shown = all
    ? filterLines(all, q, (line) =>
        data ? (translationOf(data, lang, line, into)?.text ?? "") : "",
      )
    : [];
  const counts = data
    ? (Object.fromEntries(
        Object.entries(data.langs).map(([id, list]) => [id, list.length]),
      ) as Record<LangId, number>)
    : null;
  const seconds = (all ?? []).reduce((sum, l) => sum + (l.d ?? 0), 0);

  // Refs the end of a line reads (it is called by the audio engine, outside React).
  const shownRef = useRef(shown);
  const langRef = useRef(lang);
  const playOnRef = useRef(playOn);
  const playRef = useRef<(line: VoiceLine, url: string) => void>(() => undefined);
  useEffect(() => {
    shownRef.current = shown;
    langRef.current = lang;
    playOnRef.current = playOn;
  });

  const scrollToLine = useCallback((n: number) => {
    document
      .getElementById(`line-${pad(n)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const play = useCallback(
    (line: VoiceLine, url: string) => {
      const startedAt = performance.now();
      const main = url === lineAudioUrl(character, langRef.current, line.n);
      toggleLine(url, () => {
        // A line that was stopped by hand (or by another press) does not start the next one.
        const natural = performance.now() - startedAt >= (line.d ?? 0) * 1000 - 600;
        if (!main || !natural || !playOnRef.current) return;
        const list = shownRef.current;
        const at = list.findIndex((l) => l.n === line.n);
        const next = list.slice(at + 1).find((l) => l.d !== undefined);
        if (!next) {
          setPlayOn(false);
          return;
        }
        window.setTimeout(() => {
          if (!playOnRef.current) return;
          scrollToLine(next.n);
          playRef.current(next, lineAudioUrl(character, langRef.current, next.n));
        }, 320);
      });
    },
    [character, scrollToLine],
  );
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const playAll = () => {
    if (playOn) {
      setPlayOn(false);
      audio.stopVoice();
      return;
    }
    const first = shown.find((l) => l.d !== undefined);
    if (!first) return;
    setPlayOn(true);
    playOnRef.current = true;
    scrollToLine(first.n);
    play(first, lineAudioUrl(character, lang, first.n));
  };

  // What this room started stops when the visitor leaves.
  useEffect(
    () => () => {
      stopRoom();
      abort.current?.abort();
    },
    [],
  );

  const pickLang = (id: LangId) => {
    if (id === lang) return;
    audio.stopVoice();
    setPlayOn(false);
    setLangParam(id);
    // A translation that the new language cannot offer is dropped; a line number means another line in another list.
    if (trParam && trParam !== "off" && parseTranslation(trParam, id) !== trParam.toLowerCase())
      setTrParam("");
    setIParam("");
  };

  const pickTranslation = (value: string) => {
    if (value === "off") setTrParam(defaultTranslation(lang) === "" ? "" : "off");
    else setTrParam(value === defaultTranslation(lang) ? "" : value);
  };

  // A link to a line (`?i=05`) or a trailer clip (`?i=voice-trailer-01`) scrolls there once the data has drawn,
  // and again when a search result in this same page names another one.
  const scrolled = useRef("");
  useEffect(() => {
    if (!iParam) {
      scrolled.current = "";
      return;
    }
    if (!data || scrolled.current === iParam) return;
    scrolled.current = iParam;
    const id = /^\d+$/u.test(iParam) ? `line-${pad(Number(iParam))}` : iParam;
    const go = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "center" });
    };
    requestAnimationFrame(go);
    // Rows far down the page change height as they draw, so the stop is taken again.
    const again = window.setTimeout(go, 350);
    return () => {
      window.clearTimeout(again);
    };
  }, [data, iParam]);

  const pickLine = (n: number) => {
    scrolled.current = pad(n); // the row is already where the visitor pressed: no scroll
    setIParam(pad(n));
  };

  // Up and down move between the play buttons. Enter plays the focused one (a plain button).
  const listRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-voice-play]:not(:disabled)") ?? [],
    );
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;
    event.preventDefault();
    buttons[
      Math.min(buttons.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))
    ]?.focus();
  };

  const saveAll = () => {
    if (!all || saving) return;
    const files = all
      .filter((l) => l.d !== undefined)
      .map((line) => {
        const original = lineOriginal(character, lang, line);
        return { url: original.url, name: zipEntryName(line, original.ext) };
      });
    const controller = new AbortController();
    abort.current = controller;
    setSaving({ done: 0, total: files.length, failed: null });
    downloadAll(
      files,
      `${name} - ${info.english}.zip`,
      (done, total) => {
        setSaving({ done, total, failed: null });
      },
      controller.signal,
    ).then(
      (failedCount) => {
        setSaving({ done: files.length, total: files.length, failed: failedCount });
        window.setTimeout(() => {
          setSaving(null);
        }, 4000);
      },
      () => {
        setSaving(null);
      },
    );
  };

  const card = data?.card;
  const style = card ? ({ "--accent": card.palette.primary } as CSSProperties) : undefined;
  const figures = all
    ? q.trim()
      ? `${shown.length} of ${all.length} lines`
      : `${all.length} lines, ${totalLength(seconds)}`
    : "Loading the voice lines";

  return (
    <ThemeZone
      theme="daybreak"
      as="main"
      className={styles.page}
      style={style}
      data-voicelines-character={character}
      data-lang={lang}
    >
      <BackToCollection href={VOICELINES_ROUTE} label="Voicelines" />
      <header className={styles.head}>
        <div className={styles.heading}>
          <p className={`${styles.kicker} hud-label`}>Voicelines</p>
          <h1 className={`${styles.title} display`}>{name}</h1>
          {card ? (
            <p className={styles.sub}>
              {card.aspirant}
              {card.jp ? (
                <>
                  {" "}
                  <span lang="ja" className={styles.subJp}>
                    {card.jp}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          <p className={`${styles.figures} hud-label`} data-voicelines-figures="">
            {figures}
          </p>
        </div>
        <figure className={styles.art}>
          <SplashArt
            slug={character}
            alt={`${name}, official splash art.`}
            className={styles.artImg}
          />
        </figure>
      </header>

      <div className={styles.layout}>
        <LanguageRail current={lang} counts={counts} name={name} onPick={pickLang} />

        <div className={styles.content} ref={listRef} onKeyDown={onKeyDown}>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <span className={styles.srOnly}>Search the lines of {name}</span>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <input
                type="search"
                value={q}
                placeholder="Search the lines"
                autoComplete="off"
                onChange={(e) => {
                  setQ(e.target.value);
                }}
              />
            </label>
            <label className={styles.select}>
              <span className={`${styles.selectLabel} hud-label`}>Translate</span>
              <select
                value={into === "" ? "off" : into}
                onChange={(e) => {
                  pickTranslation(e.target.value);
                }}
              >
                <option value="off">Off</option>
                {options.map((id) => (
                  <option key={id} value={id} lang={langInfo(id).html}>
                    {langInfo(id).name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.action}
              aria-pressed={playOn}
              onClick={playAll}
              disabled={!all || shown.every((l) => l.d === undefined)}
            >
              <Icon name={playOn ? "stop" : "play"} />
              <span>{playOn ? "Stop" : "Play all"}</span>
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={saveAll}
              disabled={!all || saving !== null}
              data-voicelines-save-all=""
            >
              <Icon name="download" />
              <span>
                {saving
                  ? saving.failed === null
                    ? `Saving ${saving.done} of ${saving.total}`
                    : saving.failed === 0
                      ? "Saved"
                      : `Saved, ${saving.failed} failed`
                  : "Download all"}
              </span>
            </button>
          </div>

          {lang === "jp" && data ? (
            <Recording recording={data.full} name={name} lines={data.langs.jp.length} />
          ) : null}

          {failed ? (
            <p className={styles.empty} role="status">
              The voice lines could not be loaded. Reload the page to try again.
            </p>
          ) : null}

          <h2 className={styles.srOnly}>
            {name}, {info.english}
          </h2>
          <ol className={styles.lines} lang={info.html} data-voicelines-lines="">
            {shown.map((line) => (
              <LineRow
                key={line.n}
                slug={character}
                name={name}
                lang={lang}
                line={line}
                translation={data ? translationOf(data, lang, line, into) : null}
                playingUrl={playingUrl}
                target={iParam !== "" && lineParam(iParam) === line.n}
                onPlay={play}
                onPick={pickLine}
              />
            ))}
          </ol>
          {all && shown.length === 0 ? (
            <p className={styles.empty} role="status">
              No line matches. Try a word or a number.
            </p>
          ) : null}

          {lang === "jp" && data?.trailer?.length ? (
            <TrailerClips
              clips={data.trailer}
              playingUrl={playingUrl}
              onPlay={(url) => {
                toggleLine(url);
              }}
            />
          ) : null}
        </div>
      </div>
      <ArtsTakedown />
    </ThemeZone>
  );
}
