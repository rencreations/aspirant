"use client";

import { Menu, MenuButton } from "./menu";
import styles from "./menus.module.css";

interface TitleMenuProps {
  canContinue: boolean;
  /** Where Continue would go, for example "Chapter 3, The Bond". Shown under it when it can be pressed. */
  resume: string | null;
  onContinue: () => void;
  onNew: () => void;
  onLevels: () => void;
}

/** The main menu: the three things there are to do, and nothing else. */
export function TitleMenu({ canContinue, resume, onContinue, onNew, onLevels }: TitleMenuProps) {
  return (
    <div className={styles.title}>
      <p className={styles.kicker}>Interactive drama</p>
      <h3 className={styles.logo}>Become the Aspirants</h3>
      <Menu label="Main menu">
        <MenuButton
          disabled={!canContinue}
          hint={canContinue ? (resume ?? undefined) : undefined}
          onPress={onContinue}
        >
          Continue
        </MenuButton>
        <MenuButton onPress={onNew}>Start New</MenuButton>
        <MenuButton onPress={onLevels}>Level Select</MenuButton>
      </Menu>
    </div>
  );
}
