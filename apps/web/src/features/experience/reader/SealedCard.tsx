"use client";

import { useId, useState } from "react";

import { audio } from "@/lib/audio";

import s from "./reader.module.css";

/**
 * A sealed archive file. Hover, tap or Enter breaks the seal and shows what the story says;
 * the status never changes from Open, because the story never answers.
 */
export function SealedCard({
  index,
  question,
  answer,
}: {
  index: number;
  question: string;
  answer: string;
}) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  const bodyId = useId();
  const code = String(index).padStart(2, "0");
  return (
    <article
      className={s.file}
      data-open={open ? "true" : "false"}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          setHover(true);
          audio.blip("hover");
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHover(false);
      }}
    >
      <p className={s.fileCode} aria-hidden="true">
        <span>File {code}</span>
        <span>Status: open</span>
      </p>
      <h3 className={s.fileQuestion}>{question}</h3>
      <button
        type="button"
        className={s.fileSeal}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setPinned((v) => !v);
          audio.blip("click");
        }}
      >
        <span className={s.fileSealMark} aria-hidden="true" />
        {open ? "Seal the file" : "Break the seal"}
      </button>
      <div id={bodyId} className={s.fileBody} hidden={!open}>
        <p>{answer}</p>
        <p className={s.fileStatus}>Unresolved. The story leaves it open.</p>
      </div>
    </article>
  );
}
