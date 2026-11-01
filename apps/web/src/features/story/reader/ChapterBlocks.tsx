import type { Chapter } from "@/content/story-types";

import { Paragraph, Poem, SceneBreak } from "./blocks";
import s from "./reader.module.css";

/** The text of one chapter: its paragraphs, poems and scene breaks, as plain server HTML. */
export function ChapterBlocks({ chapter }: { chapter: Chapter }) {
  return (
    <div className={s.body} data-body="">
      {chapter.blocks.map((block) => {
        if (block.type === "scene-break") return <SceneBreak key={block.id} />;
        if (block.type === "poem") return <Poem key={block.id} block={block} />;
        return <Paragraph key={block.id} block={block} />;
      })}
    </div>
  );
}
