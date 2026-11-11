"use client";

import type { Facet } from "../core/types";
import styles from "./design.module.css";
import type { DesignView } from "./model";

interface ChipProps {
  group: "kind" | "who";
  facet: Facet;
  /** What the chip would show if it were chosen. */
  count: number;
  chosen: boolean;
  onPick: (id: string) => void;
}

function Chip({ group, facet, count, chosen, onPick }: ChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={chosen}
      // A chip that would show nothing is there but cannot be pressed, so the row never jumps.
      disabled={count === 0 && !chosen}
      data-design-chip={`${group}:${facet.id}`}
      onClick={() => {
        onPick(chosen ? "" : facet.id);
      }}
    >
      <span>{facet.name}</span>
      <span className={styles.num}>{count}</span>
    </button>
  );
}

interface FinderProps {
  kinds: readonly Facet[];
  who: readonly Facet[];
  view: DesignView;
  chosenKind: string;
  chosenWho: string;
  onKind: (id: string) => void;
  onWho: (id: string) => void;
  onAll: () => void;
}

/**
 * The quiet filter: "All", the kinds of sheet, and the Aspirants that have one. Both groups can
 * be on at once. A press on the chip that is on turns it off. The counts follow the search and the
 * other group, and a chip that would show nothing is dimmed, not removed.
 */
export function Finder({
  kinds,
  who,
  view,
  chosenKind,
  chosenWho,
  onKind,
  onWho,
  onAll,
}: FinderProps) {
  const none = chosenKind === "" && chosenWho === "";
  return (
    <div className={styles.filters} data-design-filter="">
      <div className={styles.group} role="group" aria-label="Kind of sheet">
        <button
          type="button"
          className={styles.chip}
          aria-pressed={none}
          data-design-chip="all"
          onClick={onAll}
        >
          <span>All</span>
          <span className={styles.num}>{view.searched}</span>
        </button>
        {kinds.map((facet) => (
          <Chip
            key={facet.id}
            group="kind"
            facet={facet}
            count={view.kinds.get(facet.id) ?? 0}
            chosen={facet.id === chosenKind}
            onPick={onKind}
          />
        ))}
      </div>
      {who.length > 0 ? (
        <div className={styles.group} role="group" aria-label="Aspirant">
          <span className={styles.groupLabel} aria-hidden="true">
            Aspirant
          </span>
          {who.map((facet) => (
            <Chip
              key={facet.id}
              group="who"
              facet={facet}
              count={view.who.get(facet.id) ?? 0}
              chosen={facet.id === chosenWho}
              onPick={onWho}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
