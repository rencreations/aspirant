import { acts, storyIndex } from "@/content/story";

import s from "./landing.module.css";

const fmt = new Intl.NumberFormat("en-GB");

/**
 * A short description of the story with nothing in it that gives the story away: where it is, who
 * it follows, and how it is told. The facts under it come from the story's own index.
 */
export function Brief() {
  const { stats } = storyIndex;
  const hours = Math.round((stats.minutes / 60) * 2) / 2;
  return (
    <section className={`${s.section} ${s.brief}`} aria-labelledby="brief-title">
      <div className={s.wrap}>
        <p className={s.kicker}>About the story</p>
        <h2 id="brief-title" className={s.heading}>
          Ten Aspirants under one sky
        </h2>
        <div className={s.briefText}>
          <p className={s.lead}>
            Selrick Academy stands in Terrinia, the last human city, kept under a dome of light.
            Students there fly armored suits powered by aspirant power. They fight the Enders,
            living machines that fell from the sky and nearly ended the world.
          </p>
          <p className={s.text}>
            It begins on an ordinary morning, with a student who has always come first and a soldier
            who is two years late. Around them, ten Aspirants are each looking for something.
          </p>
          <p className={s.text}>
            The story is short and plain, and it explains everything as it goes, so you need to know
            nothing first. Every chapter opens with a picture and the place and time. The art, comic
            panels and film clips are from the official releases. Voice lines play where they are
            spoken.
          </p>
        </div>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>Chapters</dt>
            <dd>{stats.chapters}</dd>
          </div>
          <div className={s.fact}>
            <dt>Acts</dt>
            <dd>{acts.length}</dd>
          </div>
          <div className={s.fact}>
            <dt>Words</dt>
            <dd>{fmt.format(Math.round(stats.words / 100) * 100)}</dd>
          </div>
          <div className={s.fact}>
            <dt>Reading time</dt>
            <dd>{`${hours} h`}</dd>
          </div>
          <div className={s.fact}>
            <dt>Pictures</dt>
            <dd>{stats.images}</dd>
          </div>
          <div className={s.fact}>
            <dt>Film clips</dt>
            <dd>{stats.clips}</dd>
          </div>
          <div className={s.fact}>
            <dt>Voice lines</dt>
            <dd>{stats.voices}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
