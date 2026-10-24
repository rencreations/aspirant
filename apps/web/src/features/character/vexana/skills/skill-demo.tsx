import type { DemoKind } from "./skill-data";
import styles from "./skill-demo.module.css";

/** Where the Enders stand in every demonstration (x), and the height of their centre (y). */
const E = [230, 290, 350] as const;
const Y = 162;

/** One Ender: a dark diamond. The group gives the place, the path gets the animation. */
function Ender({
  x,
  cls,
  children,
}: {
  x: number;
  cls?: string | undefined;
  children?: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${Y})`}>
      <g className={cls}>
        <path className={styles.ender} d="M0 -34 L14 0 L0 34 L-14 0Z" />
        {children}
      </g>
    </g>
  );
}

const Ice = ({ cls }: { cls: string | undefined }) => (
  <path className={`${styles.ice ?? ""} ${cls ?? ""}`} d="M0 -34 L14 0 L0 34 L-14 0Z" />
);

/** Her orb and crescent staff head, at the left of every scene. */
function Orb({ cls }: { cls?: string | undefined }) {
  return (
    <g>
      <line className={styles.staff} x1="56" y1="166" x2="56" y2="196" />
      <path className={styles.crescent} d="M70 124 A34 34 0 0 0 70 188" />
      <circle className={`${styles.orb ?? ""} ${cls ?? ""}`} cx="56" cy="156" r="12" />
    </g>
  );
}

function Guardian({ cls }: { cls: string | undefined }) {
  return (
    <g transform="translate(176 152)">
      <g className={cls}>
        <path
          className={styles.guard}
          d="M-34 44 L-26 -34 L-48 -78 L-18 -60 L0 -92 L18 -60 L48 -78 L26 -34 L34 44Z"
        />
        <circle className={styles.eye} cx="-9" cy="-30" r="3.2" />
        <circle className={styles.eye} cx="9" cy="-30" r="3.2" />
      </g>
    </g>
  );
}

/**
 * A small drawing of what a skill does, looping while it is on screen. Shapes only: every part
 * moves by transform and opacity from CSS keyframes, so the loop runs off the main thread.
 */
export function SkillDemo({ kind }: { kind: DemoKind }) {
  return (
    <svg
      className={styles.demo}
      data-demo={kind}
      viewBox="0 0 420 240"
      role="img"
      aria-label={`A drawing of the skill: ${kind}`}
    >
      <line className={styles.ground} x1="16" y1="196" x2="404" y2="196" />

      {kind === "passive" ? (
        <>
          <Orb />
          <circle className={styles.pShot} cx="56" cy="156" r="5" />
          <Ender x={E[0]} cls={styles.pE1}>
            <circle className={styles.pMark} r="30" />
          </Ender>
          <circle className={styles.pHit} cx={E[0]} cy={Y} r="12" />
          <circle className={styles.pBurst} cx={E[0]} cy={Y} r="10" />
          <Ender x={E[1]} cls={styles.pE2} />
          <Ender x={E[2]} />
        </>
      ) : null}

      {kind === "note" ? (
        <>
          <Orb />
          <g transform="translate(86 150)">
            <g className={styles.nWave}>
              <path className={styles.nArc} d="M0 -18 A28 28 0 0 1 0 18" />
              <path className={styles.nArc} d="M12 -26 A36 36 0 0 1 12 26" />
              <path className={styles.nArc} d="M24 -34 A44 44 0 0 1 24 34" />
            </g>
          </g>
          <Ender x={E[0]} cls={styles.nE1}>
            <Ice cls={styles.nIce1} />
          </Ender>
          <circle className={styles.nBurst} cx={E[0] + 34} cy={Y} r="10" />
          <Ender x={E[1]}>
            <Ice cls={styles.nIce2} />
          </Ender>
          <Ender x={E[2]} />
        </>
      ) : null}

      {kind === "point" ? (
        <>
          <Orb cls={styles.zOrb} />
          <ellipse className={styles.zRing} cx="320" cy="196" rx="74" ry="15" />
          <circle className={styles.zBead} cx="320" cy="20" r="7" />
          <circle className={styles.zFlash} cx="320" cy={Y} r="10" />
          <Ender x={E[0]} />
          <Ender x={E[1]} cls={styles.zE2} />
          <Ender x={E[2]} cls={styles.zE3} />
        </>
      ) : null}

      {kind === "guardian" ? (
        <>
          <Orb />
          <ellipse className={styles.gWave} cx="176" cy="196" rx="20" ry="5" />
          <Guardian cls={styles.gBody} />
          <path className={styles.gSlash} d="M222 92 A92 92 0 0 1 306 178" />
          <Ender x={E[0]} cls={styles.gE1} />
          <Ender x={E[1]} cls={styles.gE2} />
          <Ender x={E[2]} cls={styles.gE3} />
        </>
      ) : null}

      {kind === "recall" ? (
        <>
          <circle className={styles.rRing} cx="56" cy="156" r="14" />
          <Orb cls={styles.rOrb} />
          <Guardian cls={styles.rBody} />
          <Ender x={E[1]} />
          <Ender x={E[2]} />
        </>
      ) : null}
    </svg>
  );
}
