"use client";

import type { DramaNode } from "./drama-graph";
import styles from "./menus.module.css";

interface ChoicesProps {
  node: DramaNode;
  /** The answer the keys are on. */
  selected: number;
  onSelect: (index: number) => void;
  onChoose: (index: number) => void;
}

/** The two answers at the end of a chapter, over the picture the film holds. */
export function Choices({ node, selected, onSelect, onChoose }: ChoicesProps) {
  return (
    <div className={styles.choices} role="group" aria-label="Choose your answer">
      {node.choices.map((c, i) => (
        <button
          key={c.tag}
          type="button"
          className={styles.choice}
          data-selected={i === selected}
          onClick={() => {
            onChoose(i);
          }}
          onPointerEnter={() => {
            onSelect(i);
          }}
        >
          <b>
            <i>{i + 1}</i>
            {c.tag}
          </b>
          <span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}
