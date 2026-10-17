"use client";

import { memo, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import type { Chapter } from "@/content/story-types";

import { SET_PIECE_ANCHORS } from "../scenes/setpieces";
import { Paragraph, Poem, SceneBreak } from "./blocks";
import { ensurePart, useBook } from "./book-store";
import { keyLineById } from "./key-index";
import { observeKeyLines, observePlaceholder } from "./observers";
import s from "./reader.module.css";
import { SetPieceHost } from "./SetPieceHost";

const anchorsAfter = new Map<string, Array<(typeof SET_PIECE_ANCHORS)[number]>>();
for (const anchor of SET_PIECE_ANCHORS) {
  const list = anchorsAfter.get(anchor.after) ?? [];
  list.push(anchor);
  anchorsAfter.set(anchor.after, list);
}

const Blocks = memo(function Blocks({ chapter }: { chapter: Chapter }) {
  const interlude = chapter.kind === "interlude";
  const firstP = chapter.blocks.findIndex((block) => block.type === "p");
  return (
    <>
      {chapter.blocks.map((block, i) => {
        if (block.type === "scene-break") return <SceneBreak key={block.id} />;
        if (block.type === "poem") return <Poem key={block.id} block={block} />;
        const keyLine = keyLineById.get(block.id);
        const pieces = anchorsAfter.get(block.id);
        return (
          <PieceSlot key={block.id} anchors={pieces}>
            <Paragraph
              block={block}
              keyLine={keyLine}
              dropCap={!interlude && i === firstP && (!keyLine || keyLine.excerpt !== undefined)}
            />
          </PieceSlot>
        );
      })}
    </>
  );
});

function PieceSlot({
  anchors,
  children,
}: {
  anchors: Array<(typeof SET_PIECE_ANCHORS)[number]> | undefined;
  children: ReactNode;
}) {
  if (!anchors) return children;
  return (
    <>
      {children}
      {anchors.map((anchor) => (
        <SetPieceHost key={anchor.id} anchor={anchor} />
      ))}
    </>
  );
}

function Placeholder({ part, failed }: { part: number; failed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observePlaceholder(el, part);
  }, [part]);
  return (
    <div ref={ref} className={s.placeholder} data-part={part}>
      {failed ? (
        <p className={s.loadError}>
          This chapter did not load.{" "}
          <button
            type="button"
            className={s.retry}
            onClick={() => void ensurePart(part, { all: true })}
          >
            Try again
          </button>
        </p>
      ) : (
        <p className="sr-only" role="status">
          Loading this chapter.
        </p>
      )}
      <div className={s.skeleton} aria-hidden="true" />
    </div>
  );
}

/**
 * The text of one chapter. Shows a skeleton of the estimated height until its Part is loaded
 * and its turn to mount comes; then renders the blocks once (memoised) and watches its key lines.
 */
export function ChapterBody({
  part,
  index,
  words,
  paragraphs,
  keys,
}: {
  part: number;
  index: number;
  words: number;
  paragraphs: number;
  keys: number;
}) {
  const chapter = useBook((st) => st.files[part]?.chapters[index]);
  const mounted = useBook((st) => (st.mounted[part] ?? 0) > index);
  const failed = useBook((st) => st.failed[part] === true);
  const ref = useRef<HTMLDivElement>(null);
  const ready = Boolean(chapter && mounted);

  useEffect(() => {
    const el = ref.current;
    if (!ready || !el) return;
    return observeKeyLines(el);
  }, [ready]);

  const style = { "--w": words, "--p": paragraphs, "--k": keys } as CSSProperties;
  return (
    <div
      ref={ref}
      className={ready ? s.body : s.bodyPending}
      style={style}
      data-body={ready ? "" : undefined}
    >
      {chapter && mounted ? (
        <Blocks chapter={chapter} />
      ) : (
        <Placeholder part={part} failed={failed} />
      )}
    </div>
  );
}
