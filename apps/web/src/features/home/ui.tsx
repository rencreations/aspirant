import type { Route } from "next";
import type { ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";

import styles from "./home.module.css";

/** A pill button that is a real link. The look of the site's buttons (see the About page). */
export function Pill({
  href,
  children,
  label,
}: {
  href: Route;
  children: ReactNode;
  /** The destination's name in the page change's loading state. */
  label?: string;
}) {
  return (
    <TLink href={href} className={styles.pill} transitionLabel={label}>
      {children}
    </TLink>
  );
}

/**
 * A labelled box that stands where a section's real picture will be. Part of the walking skeleton:
 * the owner of a section deletes it when the section's own visual is there.
 */
export function Stub({ id, note }: { id: string; note: string }) {
  return (
    <div className={styles.stub} aria-hidden="true" data-stub={id}>
      <b>{id}</b>
      <span>{note}</span>
    </div>
  );
}
