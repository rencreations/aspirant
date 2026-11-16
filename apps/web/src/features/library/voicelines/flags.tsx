import { useId, type ReactNode } from "react";

import type { FlagId } from "./languages";

/**
 * The eight flags of the language shortcuts, drawn as SVG (a browser on Windows draws no flag
 * emoji). They are flat and simple, in one 3 by 2 box. The Arabic shortcut carries the flag of the
 * United Arab Emirates, the Portuguese one Brazil's (the voice lines are in the Brazilian way of
 * speaking), the English one the United Kingdom's.
 */
function shapes(flag: FlagId, clipId: string): ReactNode {
  switch (flag) {
    case "gb":
      return (
        <g transform="scale(0.5 0.6667)">
          <clipPath id={clipId}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path
            d="M0,0 L60,30 M60,0 L0,30"
            clipPath={`url(#${clipId})`}
            stroke="#c8102e"
            strokeWidth="4"
          />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
        </g>
      );
    case "id":
      return (
        <>
          <rect width="30" height="10" fill="#e70011" />
          <rect y="10" width="30" height="10" fill="#fff" />
        </>
      );
    case "jp":
      return (
        <>
          <rect width="30" height="20" fill="#fff" />
          <circle cx="15" cy="10" r="6" fill="#bc002d" />
        </>
      );
    case "ae":
      return (
        <>
          <rect width="30" height="6.67" fill="#00732f" />
          <rect y="6.67" width="30" height="6.67" fill="#fff" />
          <rect y="13.33" width="30" height="6.67" fill="#000" />
          <rect width="7.5" height="20" fill="#ff0000" />
        </>
      );
    case "es":
      return (
        <>
          <rect width="30" height="20" fill="#aa151b" />
          <rect y="5" width="30" height="10" fill="#f1bf00" />
        </>
      );
    case "br":
      return (
        <>
          <rect width="30" height="20" fill="#009b3a" />
          <path d="M15,2.2 L27.4,10 L15,17.8 L2.6,10 Z" fill="#fedf00" />
          <circle cx="15" cy="10" r="4.6" fill="#002776" />
          <path d="M10.6,9.4 Q15,7.6 19.4,10.8" fill="none" stroke="#fff" strokeWidth="0.9" />
        </>
      );
    case "tr":
      return (
        <>
          <rect width="30" height="20" fill="#e30a17" />
          <circle cx="11.2" cy="10" r="5" fill="#fff" />
          <circle cx="12.6" cy="10" r="4" fill="#e30a17" />
          <path
            d="M18.4,7.3 L19.2,9.3 L21.3,9.4 L19.6,10.7 L20.2,12.8 L18.4,11.6 L16.6,12.8 L17.2,10.7 L15.5,9.4 L17.6,9.3 Z"
            fill="#fff"
          />
        </>
      );
    case "ru":
      return (
        <>
          <rect width="30" height="6.67" fill="#fff" />
          <rect y="6.67" width="30" height="6.67" fill="#0039a6" />
          <rect y="13.33" width="30" height="6.67" fill="#d52b1e" />
        </>
      );
  }
}

/** A flag, decorative: the language it stands beside is always named in words. */
export function Flag({ id, className }: { id: FlagId; className?: string }) {
  const clipId = useId();
  return (
    <svg
      viewBox="0 0 30 20"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-flag={id}
    >
      {shapes(id, clipId)}
      <rect width="30" height="20" fill="none" stroke="rgb(0 0 0 / 0.22)" strokeWidth="1" />
    </svg>
  );
}
