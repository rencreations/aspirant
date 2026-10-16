import type { SVGProps } from "react";

/** SVG path of the four-pointed Emblem star (concave sides) in a 100 x 100 box. */
export const STAR_PATH =
  "M50 0C53.6 33.2 66.8 46.4 100 50C66.8 53.6 53.6 66.8 50 100C46.4 66.8 33.2 53.6 0 50C33.2 46.4 46.4 33.2 50 0Z";

/**
 * The four-pointed star of the Emblem of Hope. Decorative by default (aria-hidden); pass
 * `title` to give it an accessible name.
 */
export function StarGlyph({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      focusable="false"
      {...props}
    >
      <path d={STAR_PATH} />
    </svg>
  );
}
