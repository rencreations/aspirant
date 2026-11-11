import type { CSSProperties } from "react";

import { asset } from "@/lib/asset";
import type { CharacterSlug } from "@/lib/slugs";

import { splashFor } from "../../animation/splash";

/** The CSS `object-position` that keeps the face of the splash art in view when the frame crops it. */
function splashPosition(slug: CharacterSlug): CSSProperties["objectPosition"] {
  const { focus } = splashFor(slug);
  return `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`;
}

/**
 * An Aspirant's official splash art, filling its frame (the frame gives it a size). It is the same
 * file the Animation room uses, so it is in the browser's cache already.
 */
export function SplashArt({
  slug,
  alt,
  className,
}: {
  slug: CharacterSlug;
  /** Empty when a link or a caption around it already says who it is. */
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={asset(splashFor(slug).src)}
      alt={alt}
      decoding="async"
      draggable={false}
      style={{ objectPosition: splashPosition(slug) }}
    />
  );
}
