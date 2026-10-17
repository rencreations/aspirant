"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Waveform } from "@/components/audio/waveform";
import { TLink } from "@/components/transition/t-link";
import { StarButton } from "@/components/ui/star-button";
import { ThemeZone } from "@/components/theme-zone";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useMediaQuery } from "@/lib/hooks";
import { characterRoute } from "@/lib/site";

import { SectionHead } from "../section-head";
import styles from "./whos-who.module.css";
import type { WhoPerson } from "./whos-who-data";

/** Where each splash is cropped, so the face stays in the narrow slat. */
const FOCUS: Readonly<Record<string, string>> = {
  fanny: "42% 30%",
  layla: "50% 28%",
  ruby: "50% 25%",
  angela: "50% 25%",
  lesley: "50% 25%",
  change: "50% 25%",
  guinevere: "50% 25%",
  vexana: "50% 25%",
  obsidia: "50% 22%",
  selena: "50% 25%",
};

const HAS_CUTOUT = new Set(["fanny", "layla", "guinevere", "vexana", "selena", "obsidia"]);

/**
 * The ten, as one row of slats. Hover (or focus, or tap) a slat and it opens: the portrait
 * swaps to the cut-out, the voice line plays, and the partner's slat lights up. Selena and
 * Obsidia are grouped as creator and creation, not as partners.
 */
export function WhosWho({
  people,
  also,
}: {
  people: readonly WhoPerson[];
  also: ReadonlyArray<{ readonly name: string; readonly text: string }>;
}) {
  const [active, setActive] = useState(0);
  const wide = useMediaQuery("(min-width: 62em)");
  const hoverTimer = useRef(0);

  const speak = (person: WhoPerson) => {
    if (person.voice) void audio.playVoice(asset(person.voice.file));
  };

  useEffect(() => {
    const t = hoverTimer.current;
    return () => {
      window.clearTimeout(t);
      audio.stopVoice();
    };
  }, []);

  const current = people[active] ?? people[0];
  const partnerSlug = current?.partnerSlug ?? null;
  const currentPairId = current?.pairId ?? null;

  return (
    <ThemeZone theme="daybreak" aria-labelledby="who-title" className={styles.section}>
      <section className="shell">
        <SectionHead
          id="who-title"
          code="07 / Who is who"
          title="The ten"
          lead="Hover or tap a portrait. Each Aspirant says one line, and their partner lights up."
        />

        <ul className={styles.row} aria-label="The ten Aspirants">
          {people.map((c, i) => {
            const on = i === active;
            const isPartner = partnerSlug === c.slug;
            const grouped = !partnerSlug && currentPairId === c.pairId && !on;
            const line = c.voice;
            const style = {
              "--p1": c.pairColours[0],
              "--p2": c.pairColours[1],
              "--c": c.colour,
              "--focus-pos": FOCUS[c.slug] ?? "50% 25%",
            } as CSSProperties;
            return (
              <li
                key={c.slug}
                className={styles.slat}
                data-on={on}
                data-partner={isPartner}
                data-grouped={grouped}
                style={style}
              >
                <button
                  type="button"
                  className={styles.face}
                  aria-expanded={on}
                  aria-controls={`who-${c.slug}`}
                  data-cursor="LISTEN"
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "mouse" || on || !wide) return;
                    window.clearTimeout(hoverTimer.current);
                    hoverTimer.current = window.setTimeout(() => {
                      setActive(i);
                      speak(c);
                      audio.blip("hover");
                    }, 140);
                  }}
                  onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
                  onClick={() => {
                    setActive(i);
                    speak(c);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.splash}
                    src={asset(`/img/char/${c.slug}/splash-sm.webp`)}
                    alt=""
                    width={800}
                    height={450}
                    loading="lazy"
                    decoding="async"
                  />
                  {HAS_CUTOUT.has(c.slug) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.cutout}
                      src={asset(`/img/char/${c.slug}/cutout.webp`)}
                      alt=""
                      width={900}
                      height={500}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span className={styles.stripe} aria-hidden="true" />
                  {(isPartner || grouped) && (
                    <span className={`${styles.tag} hud-label`}>
                      {isPartner ? "Partner" : "Creator and creation"}
                    </span>
                  )}
                  <span className={styles.name}>
                    <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                    {c.name}
                  </span>
                </button>

                <div
                  id={`who-${c.slug}`}
                  role="region"
                  aria-label={`${c.name}`}
                  className={styles.info}
                >
                  <p className={`${styles.aspirant} hud-label`}>{c.title}</p>
                  <h3 className={`${styles.bigName} display`}>{c.name}</h3>
                  <p className={styles.text}>{c.text}</p>
                  <p className={`${styles.pairLine} hud-label`}>
                    {c.pairKind === "partners" ? "Partners" : "Creator and creation"}: {c.pairNames}
                  </p>
                  {line && (
                    <div className={styles.voice}>
                      <StarButton
                        emblem
                        size="sm"
                        aria-label={`Play ${c.name}'s voice line`}
                        onClick={() => speak(c)}
                      />
                      <Waveform url={asset(line.file)} className={styles.wave} bars={28} />
                    </div>
                  )}
                  {line && <p className={styles.quote}>{line.en}</p>}
                  <TLink
                    href={characterRoute(c.slug)}
                    transitionLabel={c.name}
                    className={styles.meet}
                  >
                    Meet {c.name}
                  </TLink>
                </div>
              </li>
            );
          })}
        </ul>

        <h3 className={`${styles.alsoTitle} hud-label`}>Also in the story</h3>
        <ul className={styles.also}>
          {also.map((a) => (
            <li key={a.name} className={styles.alsoItem}>
              <strong>{a.name}</strong>
              <span>{a.text.charAt(0).toUpperCase() + a.text.slice(1)}</span>
            </li>
          ))}
        </ul>
      </section>
    </ThemeZone>
  );
}
