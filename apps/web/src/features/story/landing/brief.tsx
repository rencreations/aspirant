import { storyIndex } from "@/content/story";

import s from "./landing.module.css";

const fmt = new Intl.NumberFormat("en-GB");

/**
 * A short description of the story with nothing in it that gives the story away: where it is, who
 * it follows, and how it is told. The facts under it come from the story's own index.
 */
export function Brief() {
  const { stats } = storyIndex;
  const hours = Math.round(stats.words / 230 / 60);
  return (
    <section className={`${s.section} ${s.brief}`} aria-labelledby="brief-title">
      <div className={s.wrap}>
        <p className={s.kicker}>About the story</p>
        <h2 id="brief-title" className={s.heading}>
          Ten Aspirants under one sky
        </h2>
        <div className={s.briefText}>
          <p className={s.lead}>
            Selrick Academy stands in Terrinia, a city kept under a pale web of light. Ten students
            train there as Aspirants, and each of them is looking for something.
          </p>
          <p className={s.text}>
            An old skipping rhyme from Dawnbreak says that when the towers grow high, the sky will
            break and the Enders will come. The story follows the Aspirants who live under that sky.
          </p>
          <p className={s.text}>
            It begins on an ordinary morning and grows wider with every part. Some chapters go back
            in time, and each one says so at the top.
          </p>
        </div>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>Parts</dt>
            <dd>{stats.parts}</dd>
          </div>
          <div className={s.fact}>
            <dt>Chapters</dt>
            <dd>{stats.chapters}</dd>
          </div>
          <div className={s.fact}>
            <dt>Interludes</dt>
            <dd>{stats.interludes}</dd>
          </div>
          <div className={s.fact}>
            <dt>Words</dt>
            <dd>{fmt.format(stats.words)}</dd>
          </div>
          <div className={s.fact}>
            <dt>Reading time, about</dt>
            <dd>{hours} hours</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
