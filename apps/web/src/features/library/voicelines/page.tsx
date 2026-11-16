"use client";

import { useEffect, useMemo } from "react";

import { asset } from "@/lib/asset";
import { isCharacterSlug } from "@/lib/slugs";

import { ArtsTakedown } from "../arts/core/chrome";
import { targetOfId } from "./model";
import { Roster } from "./roster";
import styles from "./room.module.css";
import { VoiceStage } from "./stage";
import { useVoiceIndex } from "./voice-data";

/**
 * The Voicelines room (`/collection/voicelines`): a film behind the title, then the ten Aspirants
 * with a shortcut to each of the eight languages. The page of one Aspirant is
 * `/collection/voicelines/<slug>`, and the language is a parameter of that page.
 *
 * An address of the first version of the room (`?who=<slug>`, or `?i=<id>` of a line, a recording
 * or a trailer clip, which a search result also uses) is sent to the page of that Aspirant.
 */
export default function VoicelinesPage() {
  const { data } = useVoiceIndex();

  const figures = useMemo(
    () =>
      data
        ? `${data.characters.length} Aspirants, ${data.totals.languages} languages, ${data.totals.lines.toLocaleString("en-US")} lines`
        : "10 Aspirants, 8 languages",
    [data],
  );

  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("i");
    const who = params.get("who");
    let slug: string | null = null;
    let query = "";
    if (id) {
      const target = targetOfId(
        id,
        (wanted) => data.items.find((i) => i.id === wanted)?.slug ?? null,
      );
      if (target) {
        slug = target.slug;
        query = `?lang=${target.lang}${target.line ? `&i=${String(target.line).padStart(2, "0")}` : ""}`;
      }
    } else if (who && isCharacterSlug(who)) {
      slug = who;
    }
    if (slug) window.location.replace(`${asset(`/collection/voicelines/${slug}/`)}${query}`);
  }, [data]);

  return (
    <main className={styles.room} data-voicelines-roster="">
      <VoiceStage hero={data?.hero} figures={figures}>
        <header className={styles.head}>
          <p className={`${styles.kicker} hud-label`}>Choose an Aspirant</p>
          <p className={styles.lede}>
            Pick a language under her picture, or open her page and switch language there.
          </p>
        </header>
        <Roster characters={data?.characters ?? null} />
        <ArtsTakedown />
      </VoiceStage>
    </main>
  );
}
