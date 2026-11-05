/** Small line icons for the audio rooms. They take the colour of the text. */
export type IconName =
  | "play"
  | "pause"
  | "next"
  | "prev"
  | "shuffle"
  | "download"
  | "close"
  | "volume"
  | "queue"
  | "plus"
  | "film"
  | "stop";

const PATHS: Record<IconName, { d: string; stroke?: boolean }> = {
  play: { d: "M5 3l10 6-10 6z" },
  pause: { d: "M4 3h3.4v12H4zM10.6 3H14v12h-3.4z" },
  stop: { d: "M4 4h10v10H4z" },
  next: { d: "M12 3h2v12h-2zM3 3l8 6-8 6z" },
  prev: { d: "M4 3h2v12H4zM15 3v12L7 9z" },
  shuffle: {
    d: "M2 5h3.5c3 0 3.5 8 7 8H16M2 13h3.5c1 0 1.8-1 2.5-2.2M10 6.8C10.6 5.8 11.4 5 12.5 5H16M14 3l2 2-2 2M14 11l2 2-2 2",
    stroke: true,
  },
  download: { d: "M9 2v9M5 8l4 4 4-4M3 15h12", stroke: true },
  close: { d: "M3 3l12 12M15 3L3 15", stroke: true },
  volume: { d: "M2 7h3l4-3v10l-4-3H2zM12 6.5a3.5 3.5 0 010 5M14 4.5a6 6 0 010 9", stroke: true },
  queue: { d: "M2 4h10M2 9h10M2 14h6M14 11v5M12 13.5l2-2.5 2 2.5", stroke: true },
  plus: { d: "M9 3v12M3 9h12", stroke: true },
  film: { d: "M2 3h14v12H2zM2 7h14M2 11h14M6 3v12M12 3v12", stroke: true },
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const { d, stroke } = PATHS[name];
  return (
    <svg
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
      className={className}
      width="18"
      height="18"
    >
      <path
        d={d}
        fill={stroke ? "none" : "currentColor"}
        stroke={stroke ? "currentColor" : "none"}
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
