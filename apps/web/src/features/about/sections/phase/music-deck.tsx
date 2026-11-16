"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { TLink } from "@/components/transition/t-link";
import { asset } from "@/lib/asset";

import { DiscView } from "./disc-view";
import styles from "./music-deck.module.css";
import { hasMark, PlatformMark } from "./music-marks";
import { usePreview } from "./music-preview";
import { deckElement, joinDecks, pauseForVideo, toggleTrack, useDeckPlayer } from "./music-store";
import { clock, elapsed, lengthOf } from "./music-time";
import { PhasePlayer } from "./phase-player";
import type { PhaseTrack, PhaseVideo } from "./types";

interface MusicDeckProps {
  phase: number;
  /** One track, or two for the phases whose EP has two. */
  tracks: readonly PhaseTrack[];
  /** The first phase's song has a music video. */
  musicVideo?: PhaseVideo;
  flip: boolean;
}

const i = (n: number) => ({ "--i": n }) as CSSProperties;

function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      {playing ? (
        <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor" />
      ) : (
        <path
          d="M4.2 2.3v11.4c0 .6.7 1 1.2.6l8.4-5.7c.5-.3.5-1 0-1.3L5.4 1.7c-.5-.4-1.2 0-1.2.6Z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

/** An arrow that turns back: the way from the music video to the record. */
function TurnGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <path
        d="M6.2 3.2 2.6 6.8l3.6 3.6M2.9 6.8h6.6a3.4 3.4 0 0 1 0 6.8H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * The length of a track, and while it is the one in the player how much of it has run. The time
 * is read from the audio element when it reports it (a few times a second), not per frame.
 */
function TrackTime({ track, active }: { track: PhaseTrack; active: boolean }) {
  const [at, setAt] = useState<{ time: number; length: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = deckElement();
    if (!el) return;
    const read = () => {
      setAt({ time: el.currentTime, length: lengthOf(el.duration, track.duration) });
    };
    read();
    el.addEventListener("timeupdate", read);
    el.addEventListener("seeked", read);
    el.addEventListener("durationchange", read);
    return () => {
      el.removeEventListener("timeupdate", read);
      el.removeEventListener("seeked", read);
      el.removeEventListener("durationchange", read);
    };
  }, [active, track.duration]);

  if (!active || !at) return <>{clock(track.duration)}</>;
  return (
    <>
      <span className={styles.ran}>{elapsed(at.time)}</span>
      <span aria-hidden="true"> / </span>
      <span className="sr-only"> of </span>
      {clock(at.length)}
    </>
  );
}

interface UnitProps {
  track: PhaseTrack;
  /** Its place among the phase's tracks. */
  slot: number;
  /** How many tracks the phase has. */
  count: number;
  /** The disc stands on this side of its details. */
  side: "left" | "right";
  musicVideo?: PhaseVideo;
}

interface SleeveProps {
  video: PhaseVideo;
  /** The title of the song. */
  title: string;
  /** It is out in the middle: a press plays it with sound. In, a press brings it out. */
  out: boolean;
  /** The site's player is showing it: the preview waits. */
  hold: boolean;
  /** The stage it lies on, which never moves: what the preview watches. */
  stage: RefObject<HTMLElement | null>;
  /** The picture itself, for the player to open out of. */
  picture: RefObject<HTMLButtonElement | null>;
  onBring: () => void;
  onPlay: () => void;
  onBack: () => void;
}

/**
 * The music video of the first phase's song: its picture, which plays by itself as a small muted
 * preview, with its name and its length on it. Behind the record it is the insert of a sleeve and
 * a press brings it out. Out, a press plays it with sound in the site's player, and a round mark
 * on its corner puts the record back.
 */
function Sleeve({ video, title, out, hold, stage, picture, onBring, onPlay, onBack }: SleeveProps) {
  const film = useRef<HTMLVideoElement>(null);
  const drawn = usePreview(film, stage, video.player.sources[0]?.src ?? "", hold);
  return (
    <div className={styles.sleeveIn}>
      <button
        ref={picture}
        type="button"
        className={styles.sleeve}
        data-cursor={out ? "PLAY" : "WATCH"}
        aria-label={
          out
            ? `Play the music video of ${title} with sound, ${clock(video.duration)}`
            : `The music video of ${title}: bring it out`
        }
        onClick={out ? onPlay : onBring}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the poster of the video, a file of the collection */}
        <img
          className={styles.poster}
          src={asset(video.poster)}
          width={1280}
          height={720}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <video
          ref={film}
          className={styles.preview}
          data-drawn={drawn}
          muted
          playsInline
          preload="none"
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden="true"
        />
        <span className={`${styles.plate} ${styles.plateKind}`}>
          <span className={styles.dot} aria-hidden="true" />
          Music video
        </span>
        <span className={`${styles.plate} ${styles.plateTime}`}>{clock(video.duration)}</span>
        <span className={styles.peek} aria-hidden="true">
          <PlayGlyph playing={false} />
        </span>
        <span className={styles.playMark} aria-hidden="true">
          <PlayGlyph playing={false} />
          <span>Play with sound</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.closeMark}
        disabled={!out}
        data-cursor="BACK"
        aria-label="Back to the record"
        onClick={onBack}
      >
        <CloseGlyph />
      </button>
    </div>
  );
}

/**
 * One track: its disc, and beside it its details in hairline rows and its controls. A press on
 * the disc or on Play plays it through the site's own sound.
 *
 * The first phase's song has a music video, and its way in is the record's own: the video's
 * picture waits behind the disc like the insert of a sleeve, playing without sound, with its name
 * on it. A press slides it out to the middle while the record rolls off to its corner and grows
 * small. There the record is the way back, and says so: "Back to the record", with an arrow that
 * turns back. A press on the picture plays it with sound in the site's player.
 */
function Unit({ track, slot, count, side, musicVideo }: UnitProps) {
  const active = useDeckPlayer((s) => s.id === track.id);
  const playing = useDeckPlayer((s) => s.id === track.id && s.playing);
  const waiting = useDeckPlayer((s) => s.id === track.id && s.waiting);
  const [out, setOut] = useState(false);
  const [watching, setWatching] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const sleeve = useRef<HTMLButtonElement>(null);

  const play = useCallback(() => {
    toggleTrack(track);
  }, [track]);
  const watch = useCallback(() => {
    // The video is the same song: the track stops for it and does not come back by itself.
    pauseForVideo();
    setWatching(true);
  }, []);
  const bring = useCallback(() => {
    setOut(true);
  }, []);
  const back = useCallback(() => {
    setOut(false);
  }, []);
  const getOrigin = useCallback(() => sleeve.current?.getBoundingClientRect() ?? null, []);
  const onClosed = useCallback(() => {
    setWatching(false);
  }, []);

  // Escape puts the record back.
  useEffect(() => {
    if (!out || watching) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOut(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [out, watching]);

  const state = waiting ? "Loading" : playing ? "Pause" : "Play";
  const rows = [
    ...track.credits.map((credit) => ({ label: credit.role, value: credit.name })),
    { label: "Released", value: track.released },
  ];

  return (
    <article
      className={styles.unit}
      data-in="false"
      data-in-at="16"
      data-side={side}
      data-slot={slot}
      data-active={active}
      data-playing={playing}
      data-video={musicVideo ? (out ? "out" : "in") : undefined}
      aria-label={track.title}
    >
      <div ref={stage} className={styles.stage}>
        {musicVideo ? (
          <Sleeve
            video={musicVideo}
            title={track.title}
            out={out}
            hold={watching}
            stage={stage}
            picture={sleeve}
            onBring={bring}
            onPlay={watch}
            onBack={back}
          />
        ) : null}
        <div className={styles.place}>
          <div className={styles.arrive}>
            <DiscView
              track={track}
              slot={slot}
              active={active}
              playing={playing}
              label={
                musicVideo && out
                  ? "Back to the record"
                  : `${playing ? "Pause" : "Play"} ${track.title}`
              }
              cursor={musicVideo && out ? "BACK" : playing ? "PAUSE" : "PLAY"}
              onPress={musicVideo && out ? back : play}
            >
              {musicVideo ? (
                <span className={styles.badge} aria-hidden="true">
                  <TurnGlyph />
                </span>
              ) : null}
            </DiscView>
          </div>
        </div>
        {musicVideo ? (
          <button
            type="button"
            className={styles.backTag}
            disabled={!out}
            data-cursor="BACK"
            onClick={back}
          >
            <TurnGlyph />
            Back to the record
          </button>
        ) : null}
      </div>

      <div className={styles.details}>
        <p className={styles.ep}>
          <b>{track.ep}</b>
          <span className={styles.epRule} aria-hidden="true" />
          <span>{count > 1 ? `Track ${slot + 1} of ${count}` : "One track"}</span>
        </p>
        <h4 className={`display ${styles.title}`}>
          <span className={styles.titleIn}>{track.title}</span>
        </h4>
        <dl className={styles.rows}>
          {rows.map((row, k) => (
            <div key={row.label} className={styles.row} style={i(k)}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          <div className={styles.row} style={i(rows.length)}>
            <dt>Length</dt>
            <dd>
              <TrackTime track={track} active={active} />
            </dd>
          </div>
        </dl>
        <div className={styles.pills}>
          <button
            type="button"
            className={styles.pill}
            data-primary=""
            data-state={state}
            style={i(0)}
            aria-label={`${state === "Loading" ? "Loading" : state} ${track.title}`}
            onClick={play}
          >
            <span className={styles.pillIcon}>
              <PlayGlyph playing={playing || waiting} />
            </span>
            {state}
          </button>
          {musicVideo ? (
            <button
              type="button"
              className={styles.pill}
              data-video=""
              style={i(1)}
              aria-pressed={out}
              onClick={() => {
                setOut((was) => !was);
              }}
            >
              {out ? <TurnGlyph /> : <span className={styles.dot} aria-hidden="true" />}
              {out ? "Back to the record" : "Watch the music video"}
            </button>
          ) : null}
          {track.links.map((link, k) => (
            <TLink
              key={link.href}
              href={link.href as `https://${string}`}
              className={styles.mark}
              style={i(k + 2)}
              aria-label={`${track.title} on ${link.label}, in a new tab`}
            >
              {hasMark(link.label) ? <PlatformMark name={link.label} /> : link.label.slice(0, 2)}
              <span className={styles.markName} aria-hidden="true">
                {link.label}
              </span>
            </TLink>
          ))}
          <TLink
            href={track.href}
            className={styles.pill}
            style={i(track.links.length + 2)}
            transitionLabel="Music"
          >
            Open in the Music room
            <Arrow />
          </TLink>
        </div>
      </div>

      {watching && musicVideo
        ? createPortal(
            <PhasePlayer video={musicVideo.player} getOrigin={getOrigin} onClosed={onClosed} />,
            document.body,
          )
        : null}
    </article>
  );
}

/**
 * The music of a phase: the Music room's disc for each track, facing the visitor, with the
 * track's details beside it. A phase with two tracks shows its two discs as a pair that leans on
 * each other, each with its own details on its outer side.
 *
 * Each phase's discs arrive in their own way: the first rolls in from the side, the second drops
 * and bounces, the third spins up from a line, the fourth pair parts from one stack, the fifth
 * pair stands up from lying flat. The stylesheet has them, keyed on the phase.
 */
export function MusicDeck({ phase, tracks, musicVideo, flip }: MusicDeckProps) {
  // The player belongs to the decks: it stops when the page is left.
  useEffect(() => joinDecks(), []);

  if (tracks.length === 0) return null;
  const pair = tracks.length > 1;

  return (
    <section
      className={styles.deck}
      data-phase-part="music"
      data-phase={phase}
      data-count={tracks.length}
      aria-label={pair ? "The music of this phase, two tracks" : "The music of this phase"}
    >
      <p className={styles.head} data-in="false">
        <b>Music</b>
        <span className={styles.headRule} aria-hidden="true" />
        <span>Official soundtrack</span>
      </p>
      <div className={styles.units}>
        {tracks.map((track, slot) => (
          <Unit
            key={track.id}
            track={track}
            slot={slot}
            count={tracks.length}
            // A pair stands back to back in the middle. A single disc takes the side the phase's
            // art is not on.
            side={pair ? (slot === 0 ? "right" : "left") : flip ? "right" : "left"}
            {...(musicVideo && slot === 0 ? { musicVideo } : {})}
          />
        ))}
      </div>
    </section>
  );
}
