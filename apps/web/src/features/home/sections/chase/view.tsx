import type { Route } from "next";

import { TLink } from "@/components/transition/t-link";

import { CHASE } from "../../content";
import styles from "../../home.module.css";
import { Pill } from "../../ui";
import type { SectionMarkup } from "../../kernel/types";

import own from "./chase.module.css";
import { coverUrl, type CoverSide } from "./covers";

const CARDS: ReadonlyArray<{ side: CoverSide; item: { label: string; href: Route } }> = [
  { side: "left", item: CHASE.left },
  { side: "right", item: CHASE.right },
];

/**
 * What the server draws for the section. The giant word COMIC is a picture behind Tetra (the `below`
 * layer, hidden from readers); the real heading, the two comics and the button are in the text layer,
 * in reading order: the heading, the two covers as links to their pages, then the button. In the
 * stage the two covers stand left and right of Tetra and the heading is for screen readers only.
 */
export function view(): SectionMarkup {
  return {
    below: (
      <div className={own.wordWrap} aria-hidden="true">
        <span className={own.word} data-chase-word="">
          {CHASE.title}
        </span>
      </div>
    ),
    text: (
      <div className={own.stage}>
        <h2 className={`${styles.title} ${own.heading}`}>{CHASE.title}</h2>
        <ul className={own.cards}>
          {CARDS.map(({ side, item }) => (
            <li key={side} className={`${own.card} ${own[side]}`} data-chase-card={side}>
              <TLink
                href={item.href}
                className={own.cover}
                transitionLabel="Comic"
                data-chase-link={side}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain img */}
                <img
                  className={own.picture}
                  src={coverUrl(side)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
                <span className={own.name}>{item.label}</span>
              </TLink>
            </li>
          ))}
        </ul>
        <div className={own.cta} data-chase-cta="">
          <Pill href={CHASE.button.href} label="Comic">
            {CHASE.button.label}
          </Pill>
        </div>
      </div>
    ),
  };
}
