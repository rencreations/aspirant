import { clock, discUrl } from "@/features/library/music/logic";
import { PlatformLinks } from "@/features/library/music/platform-links";
import { videoHref } from "@/features/library/video/links";
import { TLink } from "@/components/transition/t-link";

import type { TrackArt } from "../../actors/records/covers";
import { MUSIC, MUSIC_UI } from "../../content";
import type { SectionMarkup } from "../../kernel/types";
import { Pill } from "../../ui";

import styles from "./music.module.css";

import { releases, tracks } from "./tracks";

function Side({ themes }: { themes: boolean }) {
  const side = themes ? "B" : "A";
  return (
    <section className={styles.side} data-music-side={side} aria-labelledby={`home-side-${side}`}>
      <h3 id={`home-side-${side}`}>
        <small>Side {side}</small>
        {themes ? MUSIC_UI.themes : MUSIC_UI.songs}
      </h3>
      <ul>
        {tracks
          .filter((t) => (t.kind === "theme") === themes)
          .map((track) => (
            <li key={track.id}>
              <Track track={track} />
            </li>
          ))}
      </ul>
    </section>
  );
}

function Track({ track }: { track: TrackArt }) {
  const [title, version] = track.title.split(": ");
  return (
    <button
      type="button"
      className={styles.track}
      data-music-key={track.id}
      data-audio={track.audio}
      data-cover={track.cover}
      data-title={track.title}
      data-seconds={track.dur}
      data-selected={track === tracks[0] ? "1" : "0"}
      aria-pressed="false"
      aria-label={`Play ${track.title}`}
    >
      <span
        className={styles.sleeve}
        aria-hidden="true"
        style={{ backgroundImage: `url("${track.cover}")` }}
      />
      <span className={styles.trackTitle}>
        {title}
        {version && <small>{version}</small>}
      </span>
      <span className={styles.length}>{clock(track.dur)}</span>
    </button>
  );
}

export function view(): SectionMarkup {
  const first = tracks[0];
  return {
    below: <canvas className={styles.field} data-music-field="" aria-hidden="true" />,
    text: (
      <div className={styles.music} data-music="">
        <header className={styles.header}>
          <h2>{MUSIC.title}</h2>
          <Pill href={MUSIC.button.href} label="Music">
            {MUSIC.button.label}
          </Pill>
        </header>
        {first && (
          <div className={styles.deck}>
            <Side themes={false} />
            <div className={styles.center} data-music-center="">
              <button
                type="button"
                className={styles.disc}
                aria-label={`Play ${first.title}`}
                data-music-toggle=""
              >
                <span className={styles.rotor} data-music-rotor="">
                  <span
                    className={styles.label}
                    data-music-label=""
                    aria-hidden="true"
                    style={{ backgroundImage: `url("${discUrl(releases.get(first.id)!)}")` }}
                  />
                </span>
                <span className={styles.spindle} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.transport}
                data-music-toggle=""
                aria-label={`Play ${first.title}`}
              >
                <span className={styles.status} aria-hidden="true" />
                <span className={styles.caption} data-music-caption="" aria-live="polite">
                  {first.title}
                </span>
                <span className={styles.clock} data-music-clock="">
                  0:00 / {clock(first.dur)}
                </span>
              </button>
              <div className={styles.services}>
                {tracks.map((track) => {
                  const item = releases.get(track.id)!;
                  const video = item.films.find(
                    (f) => f.t !== undefined || f.label === "Music video",
                  );
                  return item.links || video ? (
                    <div key={track.id} data-music-services={track.id} hidden={track !== first}>
                      {item.links ? (
                        <PlatformLinks links={item.links} />
                      ) : (
                        video && (
                          <TLink
                            className={styles.videoLink}
                            href={videoHref(video.id, video.t)}
                            transitionLabel="Video"
                          >
                            {video.label}
                          </TLink>
                        )
                      )}
                    </div>
                  ) : null;
                })}
              </div>
              <p className={styles.error} data-music-error="" role="status"></p>
            </div>
            <Side themes />
          </div>
        )}
        <div className={styles.preview} data-music-preview="" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- the hovered sleeve supplies the image */}
          <img alt="" />
        </div>
      </div>
    ),
  };
}
