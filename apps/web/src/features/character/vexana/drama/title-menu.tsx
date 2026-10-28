"use client";

import { useState } from "react";

import { Menu, MenuButton } from "./menu";
import styles from "./menus.module.css";

interface TitleMenuProps {
  canContinue: boolean;
  /** Where Continue would go, for example "Chapter 3, The Bond". Shown under it when it can be pressed. */
  resume: string | null;
  onContinue: () => void;
  onNew: () => void;
  onLevels: () => void;
  /** Focus the first item when the menu appears. Not on the page's first paint: that would pull the page here. */
  autoFocus: boolean;
}

/**
 * The main menu: the three things there are to do, and nothing else. Starting over asks first when
 * there is a run to lose (the episodes and endings already found are kept either way).
 */
export function TitleMenu({
  canContinue,
  resume,
  onContinue,
  onNew,
  onLevels,
  autoFocus,
}: TitleMenuProps) {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <div
        className={styles.title}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setAsking(false);
          }
        }}
      >
        <p className={styles.kicker}>Start over?</p>
        <h3 className={styles.heading}>Your run will be replaced</h3>
        <p className={styles.lead}>
          {resume ? `You are at ${resume}. ` : ""}The episodes and endings you found stay unlocked.
        </p>
        <Menu label="Start over">
          <MenuButton
            onPress={() => {
              setAsking(false);
              onContinue();
            }}
          >
            Keep my run
          </MenuButton>
          <MenuButton onPress={onNew}>Start over</MenuButton>
        </Menu>
      </div>
    );
  }

  return (
    <div className={styles.title}>
      <p className={styles.kicker}>Interactive drama</p>
      <h3 className={styles.logo}>Become the Aspirants</h3>
      <Menu label="Main menu" autoFocus={autoFocus}>
        <MenuButton
          disabled={!canContinue}
          hint={canContinue ? (resume ?? undefined) : undefined}
          onPress={onContinue}
        >
          Continue
        </MenuButton>
        <MenuButton
          onPress={() => {
            if (canContinue) setAsking(true);
            else onNew();
          }}
        >
          Start New
        </MenuButton>
        <MenuButton onPress={onLevels}>Level Select</MenuButton>
      </Menu>
    </div>
  );
}
