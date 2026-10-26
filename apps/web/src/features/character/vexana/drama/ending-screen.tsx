"use client";

import { Menu, MenuButton } from "./menu";
import styles from "./menus.module.css";

interface EndingScreenProps {
  title: string;
  kind: "good" | "hopeful" | undefined;
  /** The tag of each answer given on the way here. */
  recap: ReadonlyArray<{ chapter: number; tag: string }>;
  onAgain: () => void;
  onLevels: () => void;
  onTitle: () => void;
}

/** Shown over the last picture of an ending. The run is over: Continue stays greyed out until a new one starts. */
export function EndingScreen({
  title,
  kind,
  recap,
  onAgain,
  onLevels,
  onTitle,
}: EndingScreenProps) {
  return (
    <div className={styles.page} data-ending={kind}>
      <p className={styles.kicker}>{kind === "good" ? "The good ending" : "Ending"}</p>
      <h3 className={styles.heading}>{title}</h3>
      {recap.length > 0 ? (
        <ol className={styles.recap} aria-label="Your answers">
          {recap.map((r, i) => (
            <li key={`${String(i)}-${r.tag}`}>{r.tag}</li>
          ))}
        </ol>
      ) : null}
      <Menu label="After the ending">
        <MenuButton onPress={onAgain}>Play again</MenuButton>
        <MenuButton onPress={onLevels}>Level Select</MenuButton>
        <MenuButton onPress={onTitle}>Title</MenuButton>
      </Menu>
    </div>
  );
}
