"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";

import { Flag } from "./flags";
import { LANGUAGES, type LangId } from "./languages";
import styles from "./character.module.css";

interface RailProps {
  current: LangId;
  /** How many lines each language has (null while the file is arriving). */
  counts: Readonly<Record<LangId, number>> | null;
  name: string;
  onPick: (id: LangId) => void;
}

/**
 * The eight languages of the page, beside the lines on a wide screen and above them (a row that
 * slides sideways) on a narrow one. Each is a real link to `?lang=<id>`, so it can be opened in
 * another tab; a plain press changes the language on this page without a new history entry (the
 * browser's Back goes to the room). Up and down (left and right on a row) move between them.
 */
export function LanguageRail({ current, counts, name, onPick }: RailProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // A row that slides sideways keeps the open language in view (no scrollIntoView: it would move the page too).
  useEffect(() => {
    const list = listRef.current;
    const here = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !here || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = Math.max(0, here.offsetLeft - (list.clientWidth - here.offsetWidth) / 2);
  }, [current]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"];
    if (!keys.includes(event.key)) return;
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (at === -1) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    links[(at + step + links.length) % links.length]?.focus();
  };

  return (
    <nav className={styles.rail} aria-label={`${name}, languages`} data-voicelines-rail="">
      <p className={`${styles.railLabel} hud-label`}>Language</p>
      <ul className={styles.railList} ref={listRef} onKeyDown={onKeyDown}>
        {LANGUAGES.map((lang) => (
          <li key={lang.id}>
            <a
              href={`?lang=${lang.id}`}
              className={styles.pick}
              aria-current={lang.id === current ? "true" : undefined}
              aria-label={`${lang.english}${counts ? `, ${counts[lang.id]} lines` : ""}`}
              data-lang={lang.id}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                // A modified press or a middle click opens the link the way the browser does.
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                )
                  return;
                event.preventDefault();
                onPick(lang.id);
              }}
            >
              <Flag id={lang.flag} className={styles.flag} />
              <span className={styles.pickText}>
                <span className={styles.pickName} lang={lang.html} dir={lang.dir}>
                  {lang.name}
                </span>
                {lang.name !== lang.english ? (
                  <span className={styles.pickEnglish}>{lang.english}</span>
                ) : null}
              </span>
              {counts ? <span className={styles.pickCount}>{counts[lang.id]}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
