/**
 * Renders story blocks: paragraphs with inline marks and entity triggers, the poem and the scene
 * break. Plain text on the page: no effect follows the reader. No hooks, so server components
 * (the chapters, the front matter) and client components share it. Entity triggers are plain
 * buttons; one delegated controller opens the card.
 */
import type { ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import hc from "@/components/ui/hover-card.module.css";
import type { ParagraphBlock, PoemBlock, Segment } from "@/content/story-types";

import s from "./reader.module.css";
import { groupPieces, toPieces, type Piece } from "./rich-text";

function marks(piece: Piece, node: ReactNode): ReactNode {
  let out = node;
  if (piece.em) out = <em>{out}</em>;
  if (piece.strong) out = <strong>{out}</strong>;
  return out;
}

/** An entity trigger: a real button with its name; the shared card does the rest. */
function EntityButton({ id, children }: { id: string; children: ReactNode }) {
  return (
    <button type="button" className={cn(hc.trigger, s.ent)} data-ent={id}>
      {children}
    </button>
  );
}

function renderGroups(pieces: readonly Piece[]) {
  return groupPieces(pieces).map((group) => {
    const lead = group[0];
    if (!lead) return null;
    if (lead.ent !== undefined) {
      return (
        <EntityButton key={`e${lead.start}`} id={lead.ent}>
          {group.map((piece) => (
            <span key={piece.start} className={s.seg}>
              {marks(piece, piece.text)}
            </span>
          ))}
        </EntityButton>
      );
    }
    return <span key={`t${lead.start}`}>{marks(lead, lead.text)}</span>;
  });
}

/** Inline content of a segment list (front matter, poem lines, people cards). */
export function Segments({ segments }: { segments: readonly Segment[] }) {
  return <>{renderGroups(toPieces(segments))}</>;
}

export function Paragraph({ block }: { block: ParagraphBlock }) {
  return (
    <p id={block.id} data-p="" className={s.p}>
      {renderGroups(toPieces(block.segments))}
    </p>
  );
}

export function Poem({ block }: { block: PoemBlock }) {
  return (
    <p id={block.id} data-p="" className={cn(s.p, s.poem)}>
      {block.lines.map((line, i) => (
        <span key={i} className={s.poemLine}>
          <Segments segments={line} />
          {i < block.lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

export function SceneBreak() {
  return <hr className={s.sceneBreak} />;
}
