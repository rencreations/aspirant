"use client";

import { Dialog } from "radix-ui";

import { audio } from "@/lib/audio";
import { answerSound, useSoundPrompt } from "@/lib/sound-prompt";

import styles from "./sound-prompt.module.css";

/**
 * The question asked when something that is only sound is pressed with the sound off (see
 * `lib/sound-prompt.ts`). A small plate over a dimmed page. Focus starts on "Turn sound on", Esc
 * and a click outside keep the sound off, and focus goes back to what was pressed.
 */
export function SoundPrompt() {
  const open = useSoundPrompt((s) => s.open);
  const what = useSoundPrompt((s) => s.what);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) answerSound("off");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} data-cursor-theme="dark">
          <p className={styles.kicker} aria-hidden="true">
            Sound
          </p>
          <Dialog.Title className={styles.title}>The sound is off</Dialog.Title>
          <Dialog.Description className={styles.text}>
            {what} is only sound. Turn the sound on to hear it?
          </Dialog.Description>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              autoFocus
              onPointerEnter={() => {
                audio.blip("hover");
              }}
              onClick={() => {
                answerSound("on");
              }}
            >
              Turn sound on
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                answerSound("off");
              }}
            >
              Keep it off
            </button>
          </div>
          <button
            type="button"
            className={styles.never}
            onClick={() => {
              answerSound("never");
            }}
          >
            Do not ask again
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
