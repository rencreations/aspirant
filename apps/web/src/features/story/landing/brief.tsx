import s from "./landing.module.css";

/**
 * A short description of the story with nothing in it that gives the story away: where it is, who
 * it follows, and what they fight. Nothing else: no counts, no hours.
 */
export function Brief() {
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
        </div>
      </div>
    </section>
  );
}
