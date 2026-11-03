/**
 * The pictures set into the text, server rendered: a wide still (plate), an establishing shot
 * with the name of the place, a strip of comic panels, and the card that introduces an Aspirant.
 * Images are lazy and sized in their markup so nothing jumps. Motion is CSS only (transform and
 * opacity, scroll-linked where the browser supports it).
 */
import type { CSSProperties } from "react";

import { characters } from "@/content/characters";
import { mediaList } from "@/content/story";
import type { ImageMedia, InsertBlock, Media } from "@/content/story-types";
import { asset } from "@/lib/asset";

import { Clip } from "./Clip";
import { Credit } from "./Credit";
import { VoiceLine } from "./VoiceLine";
import { ZoomImage } from "./viewer";
import { FilmInsert } from "./FilmInsert";
import { PORTRAIT_LINES } from "./portrait-copy";
import { ASPIRANT_NAMES, portraitFor } from "./portraits";
import s from "./reader.module.css";

function Img({ media, eager = false }: { media: ImageMedia; eager?: boolean }) {
  return <ZoomImage media={media} eager={eager} />;
}

function asImage(media: Media | readonly Media[] | undefined): ImageMedia | null {
  const one = mediaList(media)[0];
  return one?.kind === "image" ? one : null;
}

function Plate({ block }: { block: InsertBlock }) {
  const media = asImage(block.media);
  if (!media) return null;
  const ratio = media.w / media.h;
  return (
    <figure
      className={s.plate}
      data-shape={ratio >= 1.45 ? "wide" : "tall"}
      style={
        {
          "--ar": `${media.w} / ${media.h}`,
          "--ratio": ratio.toFixed(3),
          "--tint": media.color,
        } as CSSProperties
      }
    >
      <div className={s.frame}>
        <Img media={media} />
      </div>
      <Credit caption={block.caption} credit={media.credit} />
    </figure>
  );
}

function Place({ block }: { block: InsertBlock }) {
  const media = asImage(block.media);
  if (!media) return null;
  return (
    <figure className={s.place} style={{ "--tint": media.color } as CSSProperties}>
      <div className={s.placeFrame}>
        <Img media={media} />
        <p className={s.placeName}>
          <span className={s.placeKicker}>The place</span>
          <span className={s.placeLabel}>{block.label}</span>
        </p>
      </div>
      <Credit caption={block.caption} credit={media.credit} />
    </figure>
  );
}

function Panels({ block }: { block: InsertBlock }) {
  const list = mediaList(block.media).filter((m): m is ImageMedia => m.kind === "image");
  if (!list.length) return null;
  // The panels of a row share one height (each is as wide as its own shape asks), so a short panel
  // never sits beside a tall one. The row is as wide as its height allows, and stacks on a phone.
  const sum = list.reduce((total, m) => total + m.w / m.h, 0);
  return (
    <figure
      className={s.panels}
      data-count={list.length}
      style={{ "--sum": sum.toFixed(3) } as CSSProperties}
    >
      <div className={s.panelRow}>
        {list.map((m) => (
          <div
            key={m.src}
            className={s.panel}
            style={
              {
                "--ar": `${m.w} / ${m.h}`,
                "--ratio": (m.w / m.h).toFixed(3),
              } as CSSProperties
            }
          >
            <Img media={m} />
          </div>
        ))}
      </div>
      <Credit caption={block.caption} credit={list[0]?.credit ?? "Official comic"} />
    </figure>
  );
}

function Portrait({ block }: { block: InsertBlock }) {
  const slug = block.character ?? "";
  const person = characters.find((c) => c.slug === slug);
  if (!person) return null;
  const override = asImage(block.media);
  const face = portraitFor(slug);
  const src = override ? override.src : face?.src;
  if (!src) return null;
  const accent = person.palette.primary;
  return (
    <div
      role="group"
      className={s.portrait}
      style={{ "--accent": accent, "--glow": person.palette.glow } as CSSProperties}
      aria-label={`Meet ${person.name}`}
    >
      <div className={s.portraitArt}>
        {/* Plain <img>: static export. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={override ? asset(`/${src}`) : asset(src)}
          alt={override?.alt ?? `${person.name}, official art`}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={override ? undefined : { objectPosition: face?.position }}
        />
      </div>
      <div className={s.portraitText}>
        <p className={s.portraitKicker}>Meet</p>
        <p className={s.portraitName}>{person.name}</p>
        <p className={s.portraitAka}>{ASPIRANT_NAMES[slug] ?? person.aspirantName}</p>
        <p className={s.portraitLine}>{PORTRAIT_LINES[slug] ?? person.tagline}</p>
      </div>
    </div>
  );
}

/** One insert of a chapter, by kind. */
export function Insert({ block }: { block: InsertBlock }) {
  switch (block.kind) {
    case "plate":
      return <Plate block={block} />;
    case "place":
      return <Place block={block} />;
    case "panels":
      return <Panels block={block} />;
    case "portrait":
      return <Portrait block={block} />;
    case "film":
      return <FilmInsert block={block} />;
    case "clip": {
      const m = mediaList(block.media)[0];
      return m?.kind === "clip" ? (
        <Clip media={m} caption={block.caption} overlay={block.overlay} />
      ) : null;
    }
    case "voice": {
      return block.voice ? <VoiceLine voice={block.voice} /> : null;
    }
    default:
      return null;
  }
}
