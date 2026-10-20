"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { ImageViewer } from "@/components/image-viewer/image-viewer";
import { VideoCard } from "@/components/video-player/video-card";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";

import {
  galleryPosterPath as tiktokPosterPath,
  galleryVideoPath as tiktokVideoPath,
  TIKTOKS,
} from "../../selena/gallery/gallery-data";
import { GALLERY_VIDEOS } from "../../selena/gallery/gallery-media.generated";
import { VoiceCard } from "../about/voice-card";
import { ObsidiaDrawer, type DrawerTab } from "../drawer/drawer";
import { TRAILER, TRAILER_SKIN } from "../media";
import {
  FAN_ART,
  galleryThumbPath,
  OFFICIAL,
  viewerIndex,
  VIEWER_IMAGES,
  VOICE_GROUPS,
  type ArtGroup,
  type Credit,
} from "./gallery-data";
import { DAY_OF_ENDERS } from "./gallery-media";
import { GALLERY_IMAGES } from "./gallery-media.generated";
import styles from "./gallery.module.css";

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
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

/** The two films: her trailer and the one she shares with Selena. */
function WatchBody() {
  return (
    <>
      <header className={styles.head}>
        <p className={styles.kicker}>Gallery</p>
        <h2 className={styles.title}>Watch</h2>
        <p className={styles.lead}>
          Two films. Press one and it grows to fill the page, with its own sound. It never starts by
          itself.
        </p>
      </header>

      <Section title="Her trailer">
        <figure className={styles.trailer}>
          <VideoCard
            video={{
              sources: TRAILER.sources.map(({ label, height, src }) => ({ label, height, src })),
              poster: TRAILER.poster,
              title: "Obsidia, The Queen's Endgame (trailer)",
              skin: TRAILER_SKIN,
            }}
            duration={TRAILER.duration}
            tag="Trailer"
            className={styles.card}
          />
          <figcaption>
            <strong>The Queen&apos;s Endgame</strong>
            <span>Her own animated trailer. The words she speaks are on screen.</span>
          </figcaption>
        </figure>
      </Section>

      <Section title="Day of Enders">
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
              skin: TRAILER_SKIN,
            }}
            duration={DAY_OF_ENDERS.duration}
            tag="Trailer"
            className={styles.card}
          />
          <figcaption>
            <strong>Day of Enders</strong>
            <span>Obsidia and Selena, in the cinematic of the new skins. It has captions.</span>
          </figcaption>
        </figure>
      </Section>
    </>
  );
}

/** All 41 of her lines, in groups, each with the Japanese and the translation. */
function VoiceBody() {
  return (
    <>
      <header className={styles.head}>
        <p className={styles.kicker}>Gallery</p>
        <h2 className={styles.title}>Her voice</h2>
        <p className={styles.lead}>
          Forty-one lines, in six groups. Pick one and press play. One plays at a time.
        </p>
      </header>
      {VOICE_GROUPS.map((g) => (
        <Section key={g.id} title={`${g.title} (${g.lines.length})`} note={g.note}>
          <div className={styles.voices}>
            {g.lines.map((n) => (
              <VoiceCard key={n} n={n} />
            ))}
          </div>
        </Section>
      ))}
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

function TikTokTile() {
  const tiktok = TIKTOKS.find((t) => t.id === "tiktok-bomboclau")!;
  const meta = GALLERY_VIDEOS["tiktok-bomboclau"];
  const tall = meta.h > meta.w;
  return (
    <figure className={styles.tile} data-tall={tall}>
      <div className={styles.video} style={{ "--ar": `${meta.w} / ${meta.h}` } as CSSProperties}>
        <VideoCard
          video={{
            sources: [
              { label: `${meta.h}p`, height: meta.h, src: tiktokVideoPath("tiktok-bomboclau") },
            ],
            poster: tiktokPosterPath("tiktok-bomboclau"),
            title: tiktok.title,
            skin: TRAILER_SKIN,
          }}
          duration={Math.round(meta.seconds)}
          tag="TikTok"
          className={styles.card}
        />
      </div>
      <figcaption>
        <span className={styles.pieceTitle}>{tiktok.title}</span>
        <CreditLink credit={tiktok.credit} />
      </figcaption>
    </figure>
  );
}

/** The official art first, then the fan art, with the TikTok. */
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
        note="Made by fans. Each piece links to where it was posted. Please visit the artist and say thanks."
      >
        <div className={styles.grid}>
          {FAN_ART.map((g) => (
            <Tile key={g.id} group={g} piece={g.pieces[0]!} onOpen={onOpen} />
          ))}
        </div>

        <h4 className={styles.h4}>
          <span>Videos</span>
          <span>TikTok</span>
        </h4>
        <div className={styles.grid}>
          <TikTokTile />
        </div>
      </Section>
    </>
  );
}

interface Props {
  present: boolean;
  shown: boolean;
  /** Draw the content now, still off screen (see ObsidiaDrawer). */
  warm?: boolean;
}

/**
 * The Gallery page. Her art, her two films and her voice share one drawer on the left. A picture
 * opens in the viewer, which zooms and moves, in her colours.
 */
export function GalleryDrawer({ present, shown, warm }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const tabs: readonly DrawerTab[] = [
    {
      id: "art",
      label: "Art",
      render: () => (
        <ArtBody
          onOpen={(id) => {
            setOpen(viewerIndex(id));
          }}
        />
      ),
    },
    { id: "watch", label: "Watch", render: () => <WatchBody /> },
    { id: "voice", label: "Voice", render: () => <VoiceBody /> },
  ];
  return (
    <>
      <ObsidiaDrawer
        present={present}
        shown={shown}
        warm={warm}
        label="Obsidia's gallery"
        tabs={tabs}
      />
      <ImageViewer
        items={VIEWER_IMAGES}
        index={open}
        onIndexChange={setOpen}
        label="Obsidia's art"
        skin={{ ground: "#0b0507", keyline: "#e2b04a", accent: "#ff8aa8" }}
      />
    </>
  );
}
