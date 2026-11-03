/**
 * The body of a chapter, server rendered: paragraphs (with the book's italics), the scene break,
 * the voice player under a recorded line, and the pictures set between paragraphs.
 */
import type { ReactNode } from "react";

import type { Block, Chapter, ParagraphBlock, Seg } from "@/content/story-types";

import { Insert } from "./inserts";
import s from "./reader.module.css";
import { VoiceLine } from "./VoiceLine";

function paragraphId(chapterId: string, i: number): string {
  return `${chapterId}-p${String(i).padStart(3, "0")}`;
}

function Inline({ segs }: { segs: readonly Seg[] }): ReactNode {
  return segs.map((seg, i) => (seg.em ? <em key={i}>{seg.t}</em> : <span key={i}>{seg.t}</span>));
}

function Paragraph({ chapterId, block }: { chapterId: string; block: ParagraphBlock }) {
  return (
    <>
      <p id={paragraphId(chapterId, block.i)} data-p="" className={s.p}>
        <Inline segs={block.segs} />
      </p>
      {block.voice && <VoiceLine voice={block.voice} />}
    </>
  );
}

function BlockView({ chapterId, block }: { chapterId: string; block: Block }) {
  switch (block.t) {
    case "p":
      return <Paragraph chapterId={chapterId} block={block} />;
    case "break":
      return <hr className={s.sceneBreak} />;
    case "insert":
      return <Insert block={block} />;
    default:
      return null;
  }
}

export function Blocks({ chapter }: { chapter: Chapter }) {
  return (
    <>
      {chapter.blocks.map((block, i) => (
        <BlockView key={i} chapterId={chapter.id} block={block} />
      ))}
    </>
  );
}
