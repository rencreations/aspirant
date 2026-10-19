"use client";

import { Fragment, type ReactNode } from "react";

import { TLink } from "@/components/transition/t-link";
import { HoverCard } from "@/components/ui/hover-card";
import { entities, type Entity } from "@/content/entities";
import { characterRoute } from "@/lib/site";

import styles from "./about.module.css";

const BY_ID = new Map<string, Entity>(entities.map((e) => [e.id, e]));

const KIND_LABEL: Readonly<Record<Entity["kind"], string>> = {
  character: "Aspirant",
  person: "Person",
  place: "Place",
  term: "Word to know",
  org: "Group",
  object: "Object",
};

const TOKEN = /\{\{([a-z0-9-]+)\|([^}]+)\}\}/g;

/** The ids a piece of text points at, in order. Used by the content tests. */
export function entityIds(text: string): string[] {
  return Array.from(text.matchAll(TOKEN), (m) => m[1]!);
}

/** The card that opens from a name: what it is, in one line, and a link when it has a page. */
function EntityCard({ entity }: { entity: Entity }) {
  const href =
    entity.characterSlug && entity.characterSlug !== "selena"
      ? characterRoute(entity.characterSlug)
      : null;
  return (
    <span className={styles.entCard}>
      <span className={styles.entKind}>{KIND_LABEL[entity.kind]}</span>
      <span className={styles.entName}>{entity.label}</span>
      <span className={styles.entShort}>{entity.short}</span>
      {href ? (
        <TLink href={href} className={styles.entLink} transitionLabel={entity.label}>
          Open {entity.label}'s page
        </TLink>
      ) : null}
    </span>
  );
}

/**
 * Running text with tooltips. `{{entity-id|words}}` becomes the words, underlined, with a card
 * that opens on hover, focus or tap. An unknown id stays as plain words.
 */
export function InlineText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index;
    if (start > last) nodes.push(text.slice(last, start));
    const entity = BY_ID.get(m[1]!);
    const words = m[2]!;
    nodes.push(
      entity ? (
        <HoverCard
          key={start}
          card={<EntityCard entity={entity} />}
          accent="#6c4cf0"
          label={words}
          className={styles.ent}
        >
          {words}
        </HoverCard>
      ) : (
        words
      ),
    );
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <>
      {nodes.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </>
  );
}
