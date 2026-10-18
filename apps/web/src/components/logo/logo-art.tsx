import { LOGO } from "./logo-data.generated";

/** Brand colours of the logo artwork. They stay the same in both themes. */
const LOGO_COLORS = {
  orange: "#f2b04c",
  ink: "#0b0b0e",
  pink: "#ff2e90",
  accent: "#6f6f6f",
  bevel: "#8d8d8d",
  letter: "#ffffff",
} as const;

const [EX0, EY0, EX1, EY1] = LOGO.mascotGeo.eyes;

/**
 * The layers of the Aspirant logo, traced from the bitmap into vector paths so every part can
 * move on its own: outline, plate, mascot (head, ring, ear pods, two antennae, a blink lid) and
 * twelve letters. Parts carry `data-part` so `queryLogoParts` can find them.
 *
 * The plate and outline never cover the letters, so the letters can become windows: with
 * `data-part="letters"` hidden, whatever is behind the logo shows through them.
 *
 * `uid` keeps clip and gradient ids unique when several logos are on a page.
 */
export function LogoLayers({ uid }: { uid: string }) {
  const pink = LOGO_COLORS.pink;
  return (
    <>
      <defs>
        <clipPath id={`${uid}-letters`}>
          {LOGO.letters.map((l) => (
            <path key={l.i} d={l.d} clipRule="evenodd" />
          ))}
        </clipPath>
        <linearGradient id={`${uid}-shine`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5ec8ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#5ec8ff" stopOpacity="0.62" />
          <stop offset="1" stopColor="#5ec8ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path data-part="outline" fill={LOGO_COLORS.orange} fillRule="evenodd" d={LOGO.outline} />
      <path data-part="plate" fill={LOGO_COLORS.ink} fillRule="evenodd" d={LOGO.plate} />
      <path
        data-part="accent"
        fill={LOGO_COLORS.accent}
        fillRule="evenodd"
        d={LOGO.mascot.accent}
      />
      <path
        data-part="energy"
        d={LOGO.silhouette}
        pathLength={1000}
        fill="none"
        stroke="#fff3c9"
        strokeWidth={7}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="70 930"
        opacity={0}
      />
      <g data-part="mascot">
        <g data-part="head">
          <g data-part="antL">
            <path fill={pink} fillRule="evenodd" d={LOGO.mascot.antL} />
          </g>
          <g data-part="antR">
            <path fill={pink} fillRule="evenodd" d={LOGO.mascot.antR} />
          </g>
          <path fill={pink} fillRule="evenodd" d={LOGO.mascot.ring} />
          {LOGO.mascot.pods.map((d, i) => (
            <path key={i} fill={pink} fillRule="evenodd" d={d} />
          ))}
          <path fill={pink} fillRule="evenodd" d={LOGO.mascot.disc} />
          <rect
            data-part="lid"
            x={EX0}
            y={EY0}
            width={EX1 - EX0}
            height={EY1 - EY0}
            fill={pink}
            transform="scale(1 0)"
          />
        </g>
      </g>
      <g data-part="letters">
        {LOGO.letters.map((l) => (
          <g key={l.i} data-part="letter" data-i={l.i}>
            <path fill={LOGO_COLORS.letter} fillRule="evenodd" d={l.d} />
          </g>
        ))}
        <path fill={LOGO_COLORS.bevel} fillRule="evenodd" d={LOGO.bevel} />
        <g clipPath={`url(#${uid}-letters)`}>
          <rect
            data-part="shine"
            x={-700}
            y={0}
            width={520}
            height={LOGO.viewBox[3]}
            fill={`url(#${uid}-shine)`}
            opacity={0}
          />
        </g>
      </g>
    </>
  );
}
