/**
 * After Chapter 60: the three questions the story leaves open, word for word, as sealed files
 * that open but never resolve; then THE END. Server rendered; only the cards are interactive.
 */
import { cn } from "@aspirant/ui/lib/utils";

import { StarGlyph } from "@/components/star-glyph";
import { storyIndex } from "@/content/story";
import { openQuestions } from "@/content/world";

import s from "./reader.module.css";
import { SealedCard } from "./SealedCard";

export function EndMatter() {
  const { title, intro } = storyIndex.backMatter.openQuestions;
  return (
    <section
      id="the-end"
      className={s.end}
      data-unit="end"
      data-part={12}
      data-chapter="c60"
      data-mood="storm"
      data-theme="storm"
      aria-labelledby="open-title"
      tabIndex={-1}
    >
      <div className={s.endHead}>
        <p className="hud-label">Archive status / open</p>
        <h2 id="open-title" className={s.endTitle}>
          {title}
        </h2>
        <p className={s.endIntro}>{intro}</p>
      </div>
      <ol className={s.sealed}>
        {openQuestions.map((item, i) => (
          <li key={item.question}>
            <SealedCard index={i + 1} question={item.question} answer={item.answer} />
          </li>
        ))}
      </ol>
      <div className={s.theEnd}>
        <StarGlyph className={s.theEndStar} />
        <p className={s.theEndWord}>{storyIndex.backMatter.closing}</p>
        <p className={cn(s.theEndNote, "hud-label")}>The lamp is on.</p>
      </div>
    </section>
  );
}
