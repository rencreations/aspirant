"use client";

import { useMemo, type ReactNode } from "react";

import { CHARACTER_NAMES, isCharacterSlug, type CharacterSlug } from "@/lib/slugs";

import { CanonBadge, CreditLine } from "../../shell/credit";
import { ArtsBack, ArtsTakedown, useArtsBar } from "../core/chrome";
import { useArtsData } from "../core/data";
import { FlowRoom } from "../core/flow";
import type { Facet } from "../core/types";
import { Feature } from "./feature";
import {
  cosplaySearchOf,
  dateWords,
  noFacets,
  photosOf,
  rosterOf,
  type CosplayHead,
  type CosplayItem,
} from "./model";
import { Switcher } from "./switcher";
import styles from "./cosplay.module.css";

/** No filter: a page of one Aspirant holds a few photos. A module constant, so the flow keeps its index. */
const NO_CHIPS: readonly Facet[] = [];

/** What the zoom says under a photo: its title, that it is fan work, who made it, and when it was posted. */
function photoCaption(item: CosplayItem): ReactNode {
  const when = dateWords(item.credit?.date ?? item.date);
  return (
    <span className={styles.caption} data-cosplay-caption="">
      <span>{item.title}</span>
      <CanonBadge canon={item.canon} />
      <CreditLine credit={item.credit} canon={item.canon} />
      {when ? <span className={styles.when}>Posted {when}</span> : null}
    </span>
  );
}

/**
 * The cosplay of one Aspirant (`/collection/arts/cosplay/<slug>`). With photos it is the flow of
 * Scene and Fanart (rows that slide with the scroll, the zoom, the credit in its caption) under her
 * official art. With none it is the same page without the rows: her art large and one calm line,
 * so every Aspirant has a page.
 */
export default function CosplayCharacterPage({ character }: { character: string }) {
  const slug: CharacterSlug = isCharacterSlug(character) ? character : "fanny";
  const { data, failed } = useArtsData<CosplayItem, CosplayHead>("cosplay");
  const items = data?.items ?? null;
  const photos = useMemo(() => (items ? photosOf(items, slug) : null), [items, slug]);
  const roster = useMemo(() => rosterOf(items), [items]);

  if (photos?.length === 0) return <EmptyPage slug={slug} roster={roster} />;
  return <PhotosPage slug={slug} photos={photos} failed={failed} roster={roster} />;
}

function PhotosPage({
  slug,
  photos,
  failed,
  roster,
}: {
  slug: CharacterSlug;
  photos: readonly CosplayItem[] | null;
  failed: boolean;
  roster: ReturnType<typeof rosterOf>;
}) {
  const name = CHARACTER_NAMES[slug];
  const header = useMemo(
    () => (
      <>
        <Switcher current={slug} roster={roster} />
        <Feature slug={slug} name={name} photos={photos ? true : null} />
      </>
    ),
    [slug, roster, name, photos],
  );
  return (
    <FlowRoom
      room="cosplay"
      title={name}
      items={photos}
      failed={failed}
      facets={NO_CHIPS}
      facetOf={noFacets}
      searchOf={cosplaySearchOf}
      nouns={["photo", "photos"]}
      searchLabel="Search photos"
      header={header}
      caption={photoCaption}
    />
  );
}

/** An Aspirant with no photo: the page stands all the same, with her art large and one calm line. */
function EmptyPage({ slug, roster }: { slug: CharacterSlug; roster: ReturnType<typeof rosterOf> }) {
  useArtsBar("daybreak");
  const name = CHARACTER_NAMES[slug];
  return (
    <main className={styles.room} data-cosplay-character={slug} data-cosplay-empty-page="">
      <ArtsBack />
      <header className={styles.head}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{name}</h1>
          <p className={styles.count}>0 photos</p>
        </div>
        <Switcher current={slug} roster={roster} />
        <Feature slug={slug} name={name} photos={false} />
      </header>
      <ArtsTakedown />
    </main>
  );
}
