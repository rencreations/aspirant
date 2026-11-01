/**
 * After Chapter 60: the three questions the story leaves open, word for word, each one a plain
 * disclosure that opens but never resolves; then the end. Server rendered.
 */
import { storyIndex } from "@/content/story";
import { openQuestions } from "@/content/world";

import s from "./reader.module.css";

export function EndMatter() {
  const { title, intro } = storyIndex.backMatter.openQuestions;
  return (
    <section id="the-end" className={s.end} aria-labelledby="open-title" tabIndex={-1}>
      <div className={s.column}>
        <p className={s.frontKicker}>Archive status: open</p>
        <h2 id="open-title" className={s.frontTitle}>
          {title}
        </h2>
        <p className={s.frontText}>{intro}</p>
        <ol className={s.sealed}>
          {openQuestions.map((item) => (
            <li key={item.question}>
              <details className={s.file}>
                <summary className={s.fileQuestion}>{item.question}</summary>
                <p className={s.fileBody}>{item.answer}</p>
                <p className={s.fileStatus}>Unresolved. The story leaves it open.</p>
              </details>
            </li>
          ))}
        </ol>
        <p className={s.theEnd}>{storyIndex.backMatter.closing}</p>
      </div>
    </section>
  );
}
