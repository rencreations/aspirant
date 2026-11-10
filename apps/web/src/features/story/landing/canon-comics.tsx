"use client";

import type { Route } from "next";

import { StarButton } from "@/components/ui/star-button";
import { PlayerButton, videoFor } from "@/features/character/vexana/shared/player-button";
import { asset } from "@/lib/asset";
import { collectionRoute } from "@/lib/site";

import s from "./landing.module.css";
import c from "./canon-comics.module.css";

const readRoute = (id: string): Route => `${collectionRoute("comic")}?i=${id}` as Route;

/**
 * Two official comics that are canon to the story, the first page of each as its cover. The
 * second also has the film of the comic, voiced in Japanese, which plays in the site's player.
 * It tells a part of the story that comes late in the book, and says so.
 */
export function CanonComics() {
  return (
    <section className={`${s.section} ${c.comics}`} aria-labelledby="comics-title">
      <div className={s.wrap} data-wide="true">
        <p className={s.kicker}>Official comics</p>
        <h2 id="comics-title" className={s.heading}>
          The comics are canon
        </h2>
        <p className={s.charLead}>
          Two official webtoons belong to this story. What happens in them happened in this world,
          and the book keeps to it.
        </p>

        <ul className={c.cards}>
          <li className={c.card}>
            <span className={c.cover}>
              {/* Decorative: the title is right beside it. Plain <img>: static export. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset("/img/comic/aspirant/01.webp")}
                alt=""
                width={1000}
                height={4950}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span className={c.stamp}>Canon</span>
            </span>
            <div className={c.body}>
              <p className={c.who}>Layla and Fanny</p>
              <h3 className={c.title}>The Aspirant</h3>
              <p className={c.line}>
                Two rivals at Selrick Academy fight side by side against the Enders of Terrinia for
                the first time.
              </p>
              <div className={c.actions}>
                <StarButton
                  variant="ghost"
                  size="sm"
                  href={readRoute("comic-the-aspirant")}
                  transitionLabel="The Aspirant"
                >
                  Read the comic
                </StarButton>
              </div>
            </div>
          </li>

          <li className={c.card}>
            <span className={c.cover}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset("/img/comic/guinevere-vexana/01.webp")}
                alt=""
                width={1000}
                height={1758}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              <span className={c.stamp}>Canon</span>
            </span>
            <div className={c.body}>
              <p className={c.who}>Guinevere and Vexana</p>
              <h3 className={c.title}>Guinevere and Vexana</h3>
              <p className={c.line}>
                The official webtoon about the two of them. It tells a part of the story that comes
                late in the book, so it holds spoilers.
              </p>
              <div className={c.actions}>
                <StarButton
                  variant="ghost"
                  size="sm"
                  href={readRoute("comic-guinevere-vexana")}
                  transitionLabel="Guinevere and Vexana"
                >
                  Read the comic
                </StarButton>
                <PlayerButton
                  className={c.watch}
                  label="Watch the comic film, voiced in Japanese"
                  video={videoFor("comic-jp", "Guinevere and Vexana, the comic")}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                  <span>Watch, voiced in Japanese</span>
                </PlayerButton>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
