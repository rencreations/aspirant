import styles from "./music-credit.module.css";

/** The credit of her theme, at the foot of her page. */
export function MusicCredit() {
  return (
    <aside className={styles.credit} aria-label="Music credit">
      <p className={styles.eyebrow}>Her theme</p>
      <p className={styles.title}>CROSSxCREDO: Vexana Version</p>
      <dl className={styles.roles}>
        <div>
          <dt>Composer and arranger</dt>
          <dd>Nika Lenz</dd>
        </div>
        <div>
          <dt>Lyricist</dt>
          <dd>Konomi Fujimura</dd>
        </div>
        <div>
          <dt>Vocal</dt>
          <dd>WaMi</dd>
        </div>
      </dl>
    </aside>
  );
}
