/**
 * The body of a chapter, server rendered: paragraphs (with the book's italics), the scene break,
 * the voice player under a recorded line, and the pictures set between paragraphs.
 */
import type { ReactNode } from "react";

import type { Block, Chapter, ParagraphBlock, Seg } from "@/content/story-types";

import { Insert } from "./inserts";
import { marksOf, splitSegs, type Mark } from "./marks";
import s from "./reader.module.css";
import { VoiceLine } from "./VoiceLine";

function paragraphId(chapterId: string, i: number): string {
  return `${chapterId}-p${String(i).padStart(3, "0")}`;
}

function Inline({ segs, marks }: { segs: readonly Seg[]; marks?: readonly Mark[] }): ReactNode {
  if (!marks || marks.length === 0) {
    return segs.map((seg, i) => (seg.em ? <em key={i}>{seg.t}</em> : <span key={i}>{seg.t}</span>));
  }
  // The same words, with the marked ones set apart (the text itself is never changed).
  return splitSegs(segs, marks).map((piece, i) => {
    const inner = piece.mark ? (
      <span
        className={s.mark}
        data-mark={piece.mark.slug}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded="false"
      >
        {piece.t}
      </span>
    ) : (
      piece.t
    );
    return piece.em ? <em key={i}>{inner}</em> : <span key={i}>{inner}</span>;
  });
}

function Paragraph({
  chapterId,
  block,
  marks,
}: {
  chapterId: string;
  block: ParagraphBlock;
  marks?: readonly Mark[];
}) {
  return (
    <>
      <p id={paragraphId(chapterId, block.i)} data-p="" className={s.p}>
        <Inline segs={block.segs} marks={marks} />
      </p>
      {block.voice && <VoiceLine voice={block.voice} />}
    </>
  );
}

function BlockView({
  chapterId,
  block,
  marks,
}: {
  chapterId: string;
  block: Block;
  marks: ReadonlyMap<number, readonly Mark[]>;
}) {
  switch (block.t) {
    case "p":
      return <Paragraph chapterId={chapterId} block={block} marks={marks.get(block.i)} />;
    case "break":
      return <hr className={s.sceneBreak} />;
    case "insert":
      return <Insert block={block} />;
    default:
      return null;
  }
}

export function Blocks({ chapter }: { chapter: Chapter }) {
  const marks = marksOf(chapter.id);
  return (
    <>
      {chapter.blocks.map((block, i) => (
        <BlockView key={i} chapterId={chapter.id} block={block} marks={marks} />
      ))}
    </>
  );
}
