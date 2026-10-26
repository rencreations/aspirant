"use client";

import { Menu, MenuButton } from "./menu";
import styles from "./menus.module.css";
import type { DramaLine } from "./drama.generated";

export type PausePanel = "pause" | "logs" | "tutorial";

interface PauseMenuProps {
  panel: PausePanel;
  onPanel: (panel: PausePanel) => void;
  onResume: () => void;
  onLevels: () => void;
  onQuit: () => void;
  /** The answers given in this run: the chapter and the tag of each. */
  route: ReadonlyArray<{ chapter: number; tag: string }>;
  /** The title of the episode being played, and its lines said so far. */
  episode: string;
  said: readonly DramaLine[];
}

const KEYS: ReadonlyArray<readonly [string, string]> = [
  ["Space or click", "Next line"],
  ["Left or Right", "Back one line, or on to the next"],
  ["Up, Down, 1, 2", "Move between the two answers"],
  ["Enter", "Pick the answer you are on"],
  ["Esc or the pause button", "Pause"],
  ["F", "Full screen"],
];

/**
 * What opens when the game is paused: a menu of five, and its two pages. The game does not wait
 * for you to press anything: if you only watch, the film goes on and the answers come up at the end.
 */
export function PauseMenu({
  panel,
  onPanel,
  onResume,
  onLevels,
  onQuit,
  route,
  episode,
  said,
}: PauseMenuProps) {
  if (panel === "logs") {
    return (
      <div className={styles.page}>
        <h3 className={styles.heading}>Logs</h3>
        <div className={styles.scroll} tabIndex={0} role="region" aria-label="Logs">
          <h4 className={styles.sub}>Your answers</h4>
          {route.length === 0 ? (
            <p className={styles.none}>None yet.</p>
          ) : (
            <ol className={styles.log}>
              {route.map((r, i) => (
                <li key={`${String(i)}-${r.tag}`}>
                  <b>Chapter {r.chapter}</b>
                  <span>{r.tag}</span>
                </li>
              ))}
            </ol>
          )}
          <h4 className={styles.sub}>{episode}</h4>
          {said.length === 0 ? (
            <p className={styles.none}>Nobody has spoken yet.</p>
          ) : (
            <ul className={styles.log}>
              {said.map((l) => (
                <li key={l.t}>
                  <b>{l.who || "..."}</b>
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Menu label="Logs" autoFocus={false}>
          <MenuButton
            onPress={() => {
              onPanel("pause");
            }}
          >
            Back
          </MenuButton>
        </Menu>
      </div>
    );
  }

  if (panel === "tutorial") {
    return (
      <div className={styles.page}>
        <h3 className={styles.heading}>Tutorial</h3>
        <p className={styles.lead}>
          Watch, and the story goes on by itself. At the end of each chapter you choose between two
          answers, and your choice decides what comes next.
        </p>
        <dl className={styles.keys}>
          {KEYS.map(([key, what]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <Menu label="Tutorial">
          <MenuButton
            onPress={() => {
              onPanel("pause");
            }}
          >
            Back
          </MenuButton>
        </Menu>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h3 className={styles.heading}>Paused</h3>
      <Menu label="Pause menu">
        <MenuButton onPress={onResume}>Resume</MenuButton>
        <MenuButton onPress={onLevels}>Level Select</MenuButton>
        <MenuButton
          onPress={() => {
            onPanel("logs");
          }}
        >
          Logs
        </MenuButton>
        <MenuButton
          onPress={() => {
            onPanel("tutorial");
          }}
        >
          Tutorial
        </MenuButton>
        <MenuButton onPress={onQuit}>Quit to Title</MenuButton>
      </Menu>
    </div>
  );
}
