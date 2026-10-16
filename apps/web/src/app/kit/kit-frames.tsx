"use client";

import { useState } from "react";

import { Frame } from "@/components/frame/frame";
import { FrameImage } from "@/components/frame/frame-image";
import { FRAME_SHAPE_NAMES } from "@/components/frame/frame-shapes";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HoverCard } from "@/components/ui/hover-card";
import { Lightbox, type LightboxItem } from "@/components/ui/lightbox";
import { MagneticButton } from "@/components/ui/magnetic";
import { StarButton } from "@/components/ui/star-button";

import type { KitSectionComponent } from "./kit-body";

const SQUARE = new Set(["circle", "bite", "emblem", "hex"]);

const ART: LightboxItem[] = [
  {
    type: "image",
    src: "/img/char/layla/splash.webp",
    alt: "Layla, official splash art",
    width: 2048,
    height: 1152,
    caption: "Layla. Official splash art.",
    credit: { name: "Moonton" },
  },
  {
    type: "image",
    src: "/img/char/fanny/splash.webp",
    alt: "Fanny, official splash art",
    width: 2048,
    height: 1152,
    caption: "Fanny. Official splash art.",
    credit: { name: "Moonton" },
  },
  {
    type: "image",
    src: "/img/char/vexana/splash.webp",
    alt: "Vexana, official splash art",
    width: 2048,
    height: 1152,
    caption: "Vexana. Official splash art.",
  },
];

/** Frame library section of /kit. */
export function KitFrames({ Section }: { Section: KitSectionComponent }) {
  return (
    <Section
      id="frames"
      title="Frames"
      note="Every shape tilts toward the pointer; hover or focus draws the outline."
    >
      {() => (
        <div className="grid gap-sp-l">
          <div className="grid grid-cols-2 gap-sp-m sm:grid-cols-3 lg:grid-cols-5">
            {FRAME_SHAPE_NAMES.map((shape) => (
              <Frame
                key={shape}
                as="figure"
                shape={shape}
                label={shape}
                className={SQUARE.has(shape) ? "aspect-square" : "aspect-[4/5]"}
              >
                <FrameImage
                  src="/img/char/layla/splash-sm.webp"
                  alt={`Layla in a ${shape} frame`}
                  width={800}
                  height={450}
                  objectPosition="60% 30%"
                />
              </Frame>
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-sp-m">
            <Frame
              shape="chamfer"
              accent="#ff6ac8"
              label="UNIT 07 / DAYBREAK HALO"
              className="aspect-video w-full max-w-xl"
            >
              <FrameImage
                src="/img/char/guinevere/splash-sm.webp"
                alt="Guinevere, official splash art"
                width={800}
                height={450}
                parallax
              />
            </Frame>
            <Frame
              shape="rift"
              tilt={false}
              glow={false}
              label="Static, no glow"
              className="aspect-[3/4] w-64 max-w-full"
            >
              <FrameImage
                src="/img/char/obsidia/splash-sm.webp"
                alt="Obsidia, official splash art"
                width={800}
                height={450}
                parallax={12}
              />
            </Frame>
            <Frame shape="ticket" maxTilt={14} className="aspect-[2/1] w-80 max-w-full">
              <FrameImage
                src="/img/char/change/splash-sm.webp"
                alt="Chang'e, official splash art"
                width={800}
                height={450}
              />
            </Frame>
          </div>
        </div>
      )}
    </Section>
  );
}

/** Hover cards, lightbox and dialog section of /kit. */
export function KitOverlays({ Section }: { Section: KitSectionComponent }) {
  const [shot, setShot] = useState<number | null>(null);
  return (
    <>
      <Section id="overlays" title="Hover cards, lightbox, dialog">
        {() => (
          <div className="grid gap-sp-m">
            <p className="m-0 max-w-[60ch] text-step-1">
              In Tanner&apos;s Row,{" "}
              <HoverCard
                accent="var(--cyan)"
                card={
                  <>
                    <p className="m-0 hud-label">Aspirant</p>
                    <p className="m-0">Layla, Miss Hikari.</p>
                  </>
                }
              >
                Layla
              </HoverCard>{" "}
              waits by the window. A pinned card with a link:{" "}
              <HoverCard
                card={
                  <>
                    <p className="m-0">Fanny, Blade of Kibou.</p>
                    <a href="#overlays-title" className="link">
                      Open profile
                    </a>
                  </>
                }
              >
                Fanny
              </HoverCard>
              .
            </p>
            <div className="flex flex-wrap gap-sp-s">
              <StarButton variant="ghost" onClick={() => setShot(0)}>
                Open lightbox
              </StarButton>
              <Dialog>
                <DialogTrigger asChild>
                  <MagneticButton>Open dialog</MagneticButton>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Terminal notice</DialogTitle>
                  <DialogDescription>
                    A plain dialog with a focus trap. Esc closes it and focus returns.
                  </DialogDescription>
                  <DialogClose asChild>
                    <StarButton size="sm">Close</StarButton>
                  </DialogClose>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </Section>
      <Lightbox items={ART} index={shot} onIndexChange={setShot} label="Kit gallery" />
    </>
  );
}
