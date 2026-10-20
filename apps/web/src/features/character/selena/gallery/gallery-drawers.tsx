"use client";

import { useState, type CSSProperties } from "react";

import { ImageViewer } from "@/components/image-viewer/image-viewer";
import { VideoCard } from "@/components/video-player/video-card";
import { getCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import { DrawerShell } from "../about/drawer-shell";
import { VoiceCard } from "../about/voice-card";
import { TRAILER } from "../media";
import {
  FAN_ART,
  galleryPosterPath,
  galleryThumbPath,
  galleryVideoPath,
  JLEN_HANDLE,
  JLEN_POSTS,
  JLEN_PROFILE,
  OFFICIAL,
  TIKTOKS,
  viewerIndex,
  VIEWER_IMAGES,
  linesFor,
  type ArtGroup,
  type Credit,
  type VoiceForm,
} from "./gallery-data";
import { DAY_OF_ENDERS } from "./gallery-media";
import { GALLERY_IMAGES, GALLERY_VIDEOS } from "./gallery-media.generated";
import styles from "./gallery.module.css";

const LINE_NUMBERS = getCharacter("selena").voice.map((l) => l.n);

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.block}>
      <h3 className={styles.h3}>{title}</h3>
      {note ? <p className={styles.note}>{note}</p> : null}
      {children}
    </section>
  );
}

function CreditLink({ credit }: { credit: Credit }) {
  if (!credit.href) {
    return (
      <span className={styles.credit}>
        {credit.name}, {credit.platform}
      </span>
    );
  }
  return (
    <a className={styles.credit} href={credit.href} target="_blank" rel="noopener noreferrer">
      {credit.name}
      <span> on {credit.platform}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** The left drawer: the two trailers and her voice lines, in her normal form and in her mecha form. */
function WatchBody() {
  const [form, setForm] = useState<VoiceForm>("normal");
  const lines = linesFor(LINE_NUMBERS, form);
  return (
    <>
      <header className={styles.head}>
        <p className={styles.kicker}>Gallery</p>
        <h2 className={styles.title}>Watch and listen</h2>
      </header>

      <Section title="Trailers">
        <div className={styles.trailers}>
          <figure className={styles.trailer}>
            <VideoCard
              video={{
                sources: TRAILER.sources.map(({ label, height, src }) => ({ label, height, src })),
                poster: TRAILER.poster,
                title: "The Pawn's Gambit, Selena's trailer",
              }}
              duration={TRAILER.duration}
              tag="Trailer"
            />
            <figcaption>
              <strong>The Pawn&apos;s Gambit</strong>
              <span>Her own trailer.</span>
            </figcaption>
          </figure>
          <figure className={styles.trailer}>
            <VideoCard
              video={{
                sources: DAY_OF_ENDERS.sources.map(({ label, height, src }) => ({
                  label,
                  height,
                  src,
                })),
                poster: DAY_OF_ENDERS.poster,
                title: DAY_OF_ENDERS.title,
                captions: DAY_OF_ENDERS.captions,
              }}
              duration={DAY_OF_ENDERS.duration}
              tag="Trailer"
            />
            <figcaption>
              <strong>Day of Enders</strong>
              <span>Selena and Obsidia. It has captions.</span>
            </figcaption>
          </figure>
        </div>
      </Section>

      <Section title="Her voice">
        <p className={styles.note}>
          Her lines change with her form. Pick one and press play. Each line comes with the Japanese
          and the translation.
        </p>
        <div className={styles.switch} role="group" aria-label="Form of the voice lines">
          {(["normal", "mecha"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={form === f}
              onClick={() => {
                setForm(f);
                audio.blip("click");
              }}
            >
              {f === "normal" ? "Normal" : "Mecha"}
            </button>
          ))}
        </div>
        <p className={styles.count} role="status">
          {lines.length} {form === "normal" ? "normal" : "mecha"} lines
        </p>
        <div className={styles.voices}>
          {lines.map((l) => (
            <VoiceCard key={`${l.n}${l.part?.name ?? ""}`} n={l.n} part={l.part} />
          ))}
        </div>
      </Section>
    </>
  );
}

/** One picture in the grid: a thumbnail that opens the viewer, and its credit. */
function Tile({
  group,
  piece,
  onOpen,
}: {
  group: ArtGroup;
  piece: ArtGroup["pieces"][number];
  onOpen: (id: string) => void;
}) {
  const meta = GALLERY_IMAGES[piece.id];
  return (
    <figure className={styles.tile}>
      <button
        type="button"
        className={styles.thumb}
        style={{ aspectRatio: `${meta.tw} / ${meta.th}` }}
        data-cursor="VIEW"
        onPointerEnter={() => {
          audio.blip("hover");
        }}
        onClick={() => {
          audio.blip("click");
          onOpen(piece.id);
        }}
      >
        <span className="sr-only">View larger: </span>
        {/* Plain <img>: static export, art already sized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(galleryThumbPath(piece.id))}
          alt={piece.alt}
          width={meta.tw}
          height={meta.th}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </button>
      <figcaption>
        <span className={styles.pieceTitle}>{piece.title}</span>
        <CreditLink credit={group.credit} />
      </figcaption>
    </figure>
  );
}

/** A carousel: the first picture with a stack behind it and the count. It opens at the first step. */
function Carousel({ group, onOpen }: { group: ArtGroup; onOpen: (id: string) => void }) {
  const first = group.pieces[0]!;
  const meta = GALLERY_IMAGES[first.id];
  return (
    <figure className={`${styles.tile} ${styles.carousel}`}>
      <button
        type="button"
        className={styles.thumb}
        style={{ aspectRatio: `${meta.tw} / ${meta.th}` }}
        data-cursor="VIEW"
        onPointerEnter={() => {
          audio.blip("hover");
        }}
        onClick={() => {
          audio.blip("click");
          onOpen(first.id);
        }}
      >
        <span className="sr-only">
          View larger: the drawing process, {group.pieces.length} pictures.{" "}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset(galleryThumbPath(first.id))}
          alt={first.alt}
          width={meta.tw}
          height={meta.th}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <span className={styles.badge} aria-hidden="true">
          {group.pieces.length} pictures
        </span>
      </button>
      <figcaption>
        <span className={styles.pieceTitle}>The drawing process, step by step</span>
        <CreditLink credit={group.credit} />
      </figcaption>
    </figure>
  );
}

function TikTokTile({ id }: { id: (typeof TIKTOKS)[number]["id"] }) {
  const tiktok = TIKTOKS.find((t) => t.id === id)!;
  const meta = GALLERY_VIDEOS[id];
  const tall = meta.h > meta.w;
  return (
    <figure className={styles.tile} data-tall={tall}>
      <div className={styles.video} style={{ "--ar": `${meta.w} / ${meta.h}` } as CSSProperties}>
        <VideoCard
          video={{
            sources: [{ label: `${meta.h}p`, height: meta.h, src: galleryVideoPath(id) }],
            poster: galleryPosterPath(id),
            title: tiktok.title,
          }}
          duration={Math.round(meta.seconds)}
          tag="TikTok"
        />
      </div>
      <figcaption>
        <span className={styles.pieceTitle}>{tiktok.title}</span>
        <CreditLink credit={tiktok.credit} />
      </figcaption>
    </figure>
  );
}

/** The right drawer: the official art, then the fan art, with the TikToks. */
function ArtBody({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <>
      <header className={styles.head}>
        <p className={styles.kicker}>Gallery</p>
        <h2 className={styles.title}>Art</h2>
        <p className={styles.lead}>
          Press a picture to look closer. You can zoom in, move around and read who made it.
        </p>
      </header>

      <Section title="Official art" note="Made by Moonton for Mobile Legends: Bang Bang.">
        <div className={styles.grid}>
          {OFFICIAL.pieces.map((p) => (
            <Tile key={p.id} group={OFFICIAL} piece={p} onOpen={onOpen} />
          ))}
        </div>
      </Section>

      <Section
        title="Fan art"
        note="Made by fans. Each piece links to the artist. Please visit them and say thanks."
      >
        <div className={styles.grid}>
          {FAN_ART.map((g) => (
            <Tile key={g.id} group={g} piece={g.pieces[0]!} onOpen={onOpen} />
          ))}
        </div>

        <div className={styles.artist}>
          <h4 className={styles.h4}>
            <a href={JLEN_PROFILE.href} target="_blank" rel="noopener noreferrer">
              {JLEN_HANDLE}
              <span className="sr-only"> on Instagram (opens in a new tab)</span>
            </a>
            <span>{JLEN_POSTS.length} posts</span>
          </h4>
          <div className={styles.grid}>
            {JLEN_POSTS.map((g) =>
              g.process ? (
                <Carousel key={g.id} group={g} onOpen={onOpen} />
              ) : (
                <Tile key={g.id} group={g} piece={g.pieces[0]!} onOpen={onOpen} />
              ),
            )}
          </div>
        </div>

        <h4 className={styles.h4}>
          <span>Videos</span>
          <span>TikTok</span>
        </h4>
        <div className={styles.grid}>
          {TIKTOKS.map((t) => (
            <TikTokTile key={t.id} id={t.id} />
          ))}
        </div>
      </Section>
    </>
  );
}

interface Props {
  present: boolean;
  shown: boolean;
  /** Draw the content now, still off screen (see DrawerShell). */
  warm?: boolean;
}

/**
 * The Gallery page. On the left she is heard and seen: the two trailers and her voice lines in
 * both forms. On the right are the pictures, the official art first and then the fan art. A
 * picture opens in the viewer, which zooms and moves.
 */
export function GalleryDrawers({ present, shown, warm }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <DrawerShell
        present={present}
        shown={shown}
        warm={warm}
        label="Selena's gallery"
        left={{
          title: "Watch and listen",
          aria: "Trailers and voice lines",
          region: "Trailers and voice lines, scrollable",
          width: "clamp(21rem, 30vw, 32rem)",
          render: () => <WatchBody />,
        }}
        right={{
          title: "Art",
          aria: "Official art and fan art",
          region: "Art, scrollable",
          width: "clamp(21rem, 34vw, 38rem)",
          render: () => (
            <ArtBody
              onOpen={(id) => {
                setOpen(viewerIndex(id));
              }}
            />
          ),
        }}
      />
      <ImageViewer
        items={VIEWER_IMAGES}
        index={open}
        onIndexChange={setOpen}
        label="Selena's art"
      />
    </>
  );
}
