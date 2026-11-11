"use client";

import { Dialog } from "radix-ui";
import { useEffect } from "react";

import { useLenis } from "@/components/smooth-scroll";

import { chapterName } from "./chapters";
import { EntryBody, Unmet } from "./entry-body";
import styles from "./entry-window.module.css";
import { isUnmet } from "./model";
import { PairBody } from "./pair-body";
import type { Reach } from "./reach";
import { KIND_META } from "./types";
import type { Codex } from "./use-codex";

export interface EntryWindowProps {
  codex: Codex | null;
  failed: boolean;
  /** The slug in the address ("" when no window is open). */
  slug: string;
  reach: Reach;
  onOpen: (slug: string) => void;
  onClose: () => void;
}

/**
 * The window of the codex: an entry (or a relationship) over the room, with its own address. The
 * room does not move under it; Esc, the cross and a press outside close it, and Back too.
 */
export function EntryWindow({ codex, failed, slug, reach, onOpen, onClose }: EntryWindowProps) {
  const { pause, resume } = useLenis();
  const open = slug !== "";
  useEffect(() => {
    if (!open) return;
    pause();
    return () => {
      resume();
    };
  }, [open, pause, resume]);

  const entry = codex?.entry.get(slug);
  const pair = codex?.pair.get(slug);
  const a = pair ? codex?.entry.get(pair.a) : undefined;
  const b = pair ? codex?.entry.get(pair.b) : undefined;
  const unmet = entry ? isUnmet(entry, reach.reach) : false;

  const kicker = entry
    ? `${KIND_META[entry.kind].label} / ${entry.sub}`
    : pair
      ? "Relationship"
      : "The lore";
  const title = entry
    ? unmet
      ? "Not met yet"
      : entry.name
    : pair && a && b
      ? `${a.name} and ${b.name}`
      : "The lore";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          className={styles.window}
          data-lenis-prevent
          data-kind={entry?.kind ?? "pair"}
          aria-describedby={undefined}
        >
          <div key={slug} className={styles.inner}>
            <header className={styles.top}>
              <p className="hud-label">
                {unmet && entry ? `${KIND_META[entry.kind].label} / ahead of you` : kicker}
              </p>
              <Dialog.Close className={styles.close} aria-label="Close">
                <span aria-hidden="true" />
              </Dialog.Close>
            </header>

            <Dialog.Title className={`${styles.title} display`}>{title}</Dialog.Title>

            {entry && !unmet && entry.aka.length > 0 ? (
              <p className={styles.aka}>Also called {entry.aka.slice(0, 6).join(", ")}.</p>
            ) : null}
            {entry && !unmet ? (
              <p className={`${styles.first} hud-label`}>First in {chapterName(entry.first)}</p>
            ) : null}

            {!codex ? (
              <p className={styles.note}>
                {failed ? "The lore could not be loaded." : "Reading the lore"}
              </p>
            ) : entry ? (
              unmet ? (
                <Unmet entry={entry} reach={reach} />
              ) : (
                <EntryBody entry={entry} codex={codex} reach={reach} onOpen={onOpen} />
              )
            ) : pair ? (
              <PairBody pair={pair} codex={codex} reach={reach} onOpen={onOpen} />
            ) : (
              <p className={styles.note}>There is nothing in the lore at this address.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
