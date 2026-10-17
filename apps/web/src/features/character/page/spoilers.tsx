"use client";

import type { Route } from "next";
import { useId, useState } from "react";

import { TLink } from "@/components/transition/t-link";
import { audio } from "@/lib/audio";

import styles from "./spoilers.module.css";

export interface SpoilerFact {
  readonly text: string;
  readonly href: Route;
  /** "Chapter 47" or "Interlude". */
  readonly label: string;
  readonly title: string;
}

interface SpoilersProps {
  name: string;
  background: readonly string[];
  later: readonly SpoilerFact[];
}

/**
 * Her story so far and what happens later, sealed by default. The content is not rendered
 * (so not read out) until the visitor opens it.
 */
export function Spoilers({ name, background, later }: SpoilersProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = () => {
    audio.blip(open ? "click" : "confirm");
    setOpen((v) => !v);
  };
  return (
    <div className={styles.root} data-open={open}>
      <div className={styles.seal}>
        <div className={styles.sealText}>
          <p className={`${styles.code} hud-label`}>Sealed record / Spoilers</p>
          <h3 className={styles.title}>{name}&rsquo;s story</h3>
          <p className={styles.explain}>
            Her past and what happens to her later in the story. It gives away turns you meet when
            you read. Open it if you have read the story or do not mind knowing.
          </p>
        </div>
        <button
          type="button"
          className={styles.button}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className={styles.buttonIcon} aria-hidden="true" />
          {open ? "Seal the record" : "Show spoilers"}
        </button>
      </div>
      <div id={panelId} className={styles.panel} hidden={!open}>
        {open && (
          <div className={styles.columns}>
            <div>
              <h4 className={`${styles.subhead} hud-label`}>Her story so far</h4>
              <ol className={styles.record}>
                {background.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
            {later.length > 0 && (
              <div>
                <h4 className={`${styles.subhead} hud-label`}>Later in the story</h4>
                <ol className={styles.later}>
                  {later.map((fact) => (
                    <li key={fact.text}>
                      <p>{fact.text}</p>
                      <TLink
                        href={fact.href}
                        className={styles.chapter}
                        transitionLabel={fact.label}
                      >
                        {fact.label}: {fact.title}
                      </TLink>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
