"use client";

import { Dialog } from "radix-ui";
import { useEffect, useMemo, type CSSProperties } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import styles from "./atlas-detail.module.css";
import { getCollection } from "../registry";
import { GROUP_TITLE, type AtlasItem, type LoreFile } from "./types";

const META = getCollection("lore");
const VARS = { "--lib-colour": META.colour, "--lib-ink": META.ink } as CSSProperties;

export interface AtlasDetailProps {
  lore: LoreFile;
  /** The plates in the order the viewer steps through them. */
  list: readonly AtlasItem[];
  selected: string;
  onSelect: (id: string) => void;
  onOpenText: (id: string, heading?: string) => void;
  onClose: () => void;
}

/**
 * One plate in full: the picture at its own size (never enlarged), the official passage word for
 * word, further passages, and the texts that mention it.
 */
export function AtlasDetail({
  lore,
  list,
  selected,
  onSelect,
  onOpenText,
  onClose,
}: AtlasDetailProps) {
  const { pause, resume } = useLenis();
  const item = useMemo(
    () => lore.atlas.find((a) => a.id === selected) ?? null,
    [lore.atlas, selected],
  );
  const open = item !== null;
  const textById = useMemo(() => new Map(lore.texts.map((t) => [t.id, t] as const)), [lore.texts]);

  useEffect(() => {
    if (!open) return;
    pause();
    return () => {
      resume();
    };
  }, [open, pause, resume]);

  const at = item ? list.findIndex((a) => a.id === item.id) : -1;
  const prev = at > 0 ? list[at - 1] : undefined;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        onSelect(next.id);
      } else if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        onSelect(prev.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, next, prev, onSelect]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          className={styles.sheet}
          style={VARS}
          aria-describedby={undefined}
          data-lenis-prevent
        >
          {item ? (
            <div key={item.id} className={styles.inner}>
              <header className={styles.top}>
                <p className="hud-label">
                  {item.kind === "place" ? "Place" : "Entity"} / {lore.layers[item.layer]}
                </p>
                <Dialog.Close className={styles.close} aria-label="Close">
                  <span aria-hidden="true" />
                </Dialog.Close>
              </header>

              <Dialog.Title className={`${styles.title} display`}>{item.name}</Dialog.Title>

              <div className={styles.grid}>
                <figure className={styles.figure}>
                  <div
                    className={styles.pic}
                    data-alpha={item.alpha ? "1" : "0"}
                    style={
                      {
                        "--ground": item.alpha ? "transparent" : item.img.c,
                        maxWidth: item.img.w,
                      } as CSSProperties
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={libUrl(item.img.f)}
                      width={item.img.w}
                      height={item.img.h}
                      alt={`${item.name}, an official picture.`}
                      decoding="async"
                    />
                  </div>
                  <figcaption className="hud-label">
                    {item.img.w} x {item.img.h} /{" "}
                    <a
                      href={libUrl(item.img.f)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                    >
                      Open the picture alone
                    </a>
                  </figcaption>
                </figure>

                <div className={styles.text}>
                  <section>
                    <p className="hud-label">
                      From{" "}
                      <button
                        type="button"
                        className={styles.src}
                        onClick={() => {
                          onOpenText(item.from, item.hid);
                        }}
                      >
                        {textById.get(item.from)?.title ?? "the official text"}
                      </button>
                    </p>
                    <blockquote className={styles.quote}>{item.text}</blockquote>
                  </section>

                  {item.more.map((m, i) => (
                    <section key={i}>
                      <p className="hud-label">
                        Also in{" "}
                        <button
                          type="button"
                          className={styles.src}
                          onClick={() => {
                            onOpenText(m.from, m.hid);
                          }}
                        >
                          {textById.get(m.from)?.title ?? "the official text"}
                        </button>
                      </p>
                      <blockquote className={`${styles.quote} ${styles.quoteMore}`}>
                        {m.text}
                      </blockquote>
                    </section>
                  ))}

                  <section>
                    <p className="hud-label">
                      Mentioned in {item.texts.length} {item.texts.length === 1 ? "text" : "texts"}
                    </p>
                    <ul className={styles.mentions}>
                      {item.texts.map((id) => {
                        const t = textById.get(id);
                        if (!t) return null;
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              className={styles.mention}
                              onClick={() => {
                                audio.blip("click");
                                onOpenText(id);
                              }}
                            >
                              <span>{t.title}</span>
                              <span className="hud-label">{GROUP_TITLE[t.group]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>
              </div>

              <footer className={styles.pager}>
                <button
                  type="button"
                  className={styles.step}
                  disabled={!prev}
                  onClick={() => {
                    if (prev) onSelect(prev.id);
                  }}
                >
                  <span className="hud-label">Previous plate</span>
                  <span className={styles.stepName}>{prev?.name ?? "The first plate"}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.step} ${styles.stepNext}`}
                  disabled={!next}
                  onClick={() => {
                    if (next) onSelect(next.id);
                  }}
                >
                  <span className="hud-label">Next plate</span>
                  <span className={styles.stepName}>{next?.name ?? "The last plate"}</span>
                </button>
              </footer>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
