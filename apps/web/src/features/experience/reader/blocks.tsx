/**
 * Renders story blocks: paragraphs with inline marks and entity triggers, dialogue with a
 * speaker hint, key lines split into words for the narrator's reveal, the poem and the scene
 * break. No hooks, so server components (the front matter) and client components (chapter
 * bodies) share it. Entity triggers are plain buttons; one delegated controller opens the card.
 */
import type { ReactNode } from "react";

import { cn } from "@aspirant/ui/lib/utils";

import hc from "@/components/ui/hover-card.module.css";
import type { ParagraphBlock, PoemBlock, Segment } from "@/content/story-types";
import { CHARACTER_NAMES, isCharacterSlug } from "@/lib/slugs";

import type { KeyLine } from "./key-lines";
import s from "./reader.module.css";
import {
  dropCapLength,
  findRanges,
  groupPieces,
  markRanges,
  plainText,
  splitAt,
  toPieces,
  type Piece,
} from "./rich-text";

interface RenderOptions {
  /** Split text into word spans (key lines). */
  words?: boolean;
  /** Set the first letter as a drop cap. */
  dropCap?: boolean;
}

function splitWords(text: string, key: string): ReactNode[] {
  return text.split(/(\s+)/u).map((part, i) =>
    part.trim() === "" ? (
      part
    ) : (
      <span key={`${key}-${i}`} className={s.w}>
        {part}
      </span>
    ),
  );
}

function marks(piece: Piece, node: ReactNode): ReactNode {
  let out = node;
  if (piece.hi) out = <span className={s.hi}>{out}</span>;
  if (piece.em) out = <em>{out}</em>;
  if (piece.strong) out = <strong>{out}</strong>;
  return out;
}

function pieceNode(piece: Piece, words: boolean): ReactNode {
  return marks(piece, words ? splitWords(piece.text, `w${piece.start}`) : piece.text);
}

/** An entity trigger: a real button with its name; the shared card does the rest. */
function EntityButton({
  id,
  label,
  children,
}: {
  id: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className={cn(hc.trigger, s.ent)} data-ent={id} aria-label={label}>
      {children}
    </button>
  );
}

function renderGroups(pieces: readonly Piece[], { words = false, dropCap = false }: RenderOptions) {
  let list = pieces;
  let cap: ReactNode = null;
  let capEntity: { id: string; label: string } | null = null;
  const first = list[0];
  if (dropCap && first) {
    const len = dropCapLength(first.text);
    if (len > 0) {
      const [head, ...rest] = splitAt(list, [first.start + len]);
      if (head) {
        if (head.ent !== undefined) {
          const label = list
            .filter((p) => p.seg === head.seg)
            .map((p) => p.text)
            .join("");
          capEntity = { id: head.ent, label };
          cap = (
            <span key="cap" className={s.dropcap} aria-hidden="true" data-ent={head.ent}>
              {head.text}
            </span>
          );
        } else {
          cap = (
            <span key="cap" className={s.dropcap}>
              {marks(head, head.text)}
            </span>
          );
        }
        list = rest;
      }
    }
  }

  const out: ReactNode[] = cap ? [cap] : [];
  groupPieces(list).forEach((group, gi) => {
    const lead = group[0];
    if (!lead) return;
    if (lead.ent !== undefined) {
      const label =
        capEntity && gi === 0 && capEntity.id === lead.ent ? capEntity.label : undefined;
      out.push(
        <EntityButton key={`e${lead.start}`} id={lead.ent} label={label}>
          {group.map((piece) => (
            <span key={piece.start} className={s.seg}>
              {pieceNode(piece, words)}
            </span>
          ))}
        </EntityButton>,
      );
    } else {
      out.push(<span key={`t${lead.start}`}>{pieceNode(lead, words)}</span>);
    }
  });
  return out;
}

/** Inline content of a segment list (front matter, poem lines, people cards). */
export function Segments({ segments }: { segments: readonly Segment[] }) {
  return <>{renderGroups(toPieces(segments), {})}</>;
}

/** A speaker's short name: the Aspirant's name, the name as written, or the id in words. */
function speakerName(block: ParagraphBlock, id: string): string {
  if (isCharacterSlug(id)) return CHARACTER_NAMES[id];
  const named = block.segments.find((seg) => seg.t === "ent" && seg.id === id);
  if (named) return named.text;
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function SpeakerHint({ block }: { block: ParagraphBlock }) {
  if (!block.speaker) return null;
  return (
    <span className={s.speaker} aria-hidden="true">
      {speakerName(block, block.speaker)}
    </span>
  );
}

export function Paragraph({
  block,
  keyLine,
  dropCap = false,
}: {
  block: ParagraphBlock;
  keyLine?: KeyLine;
  dropCap?: boolean;
}) {
  const text = plainText(block.segments);
  const emphasis = keyLine?.emphasis ? findRanges(text, keyLine.emphasis) : [];
  const excerpt = keyLine?.excerpt ? findRanges(text, [keyLine.excerpt])[0] : undefined;
  const cuts = [...emphasis.flat(), ...(excerpt ?? [])];
  const pieces = markRanges(splitAt(toPieces(block.segments), cuts), emphasis);
  const dialogue = block.dialogue === true;

  // A short key line: the whole paragraph is set large and lit word by word.
  if (keyLine && !excerpt) {
    return (
      <p
        id={block.id}
        data-p=""
        data-key=""
        data-state="idle"
        data-speaker={block.speaker}
        className={cn(s.p, s.key, dialogue && s.keyDialogue)}
      >
        {renderGroups(pieces, { words: true })}
      </p>
    );
  }

  // A long paragraph with one sentence that breaks out large in place.
  if (excerpt) {
    const [a, b] = excerpt;
    const before = pieces.filter((p) => p.start < a);
    const inside = pieces.filter((p) => p.start >= a && p.start < b);
    const after = pieces.filter((p) => p.start >= b);
    return (
      <p
        id={block.id}
        data-p=""
        data-speaker={block.speaker}
        className={cn(s.p, dialogue && s.dlg)}
      >
        {renderGroups(before, { dropCap })}
        <span className={s.keyInline} data-key="" data-state="idle">
          {renderGroups(inside, { words: true })}
        </span>
        {renderGroups(after, {})}
      </p>
    );
  }

  return (
    <p
      id={block.id}
      data-p=""
      data-speaker={block.speaker}
      className={cn(s.p, dialogue && s.dlg, dropCap && s.opening)}
    >
      {dialogue && <SpeakerHint block={block} />}
      {renderGroups(pieces, { dropCap })}
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
