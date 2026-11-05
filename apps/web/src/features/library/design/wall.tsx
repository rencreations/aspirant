"use client";

import { Fragment, useMemo, type CSSProperties, type PointerEvent } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import { CanonBadge } from "../shell/credit";
import { useSeen, useWidth } from "./hooks";
import {
  aspectOf,
  campaignColours,
  clock,
  coverOf,
  formatDate,
  justify,
  kindLabel,
  paletteOf,
  pickSize,
  ratioLabel,
  sizeLabel,
  sizeOf,
  spanLabel,
  targetHeight,
  weightOf,
  type CampaignGroup,
  type YearGroup,
} from "./model";
import { PaletteStrip } from "./palette";
import type { DesignPost } from "./types";
import styles from "./wall.module.css";

export type View = "posted" | "details";

const GAP = 10;

interface WallProps {
  years: YearGroup[];
  view: View;
  activeId: string;
  onOpen: (id: string) => void;
}

function dpr(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

/** The posts by campaign and year, along a timeline spine. */
export function Wall({ years, view, activeId, onOpen }: WallProps) {
  const [probeRef, width] = useWidth();
  const firstId = years[0]?.campaigns[0]?.campaign.id;
  return (
    <div className={styles.wall} data-view={view}>
      {years.map((y) => (
        <section key={y.year} className={styles.year} aria-label={`Posts that began in ${y.year}`}>
          <div className={styles.rail} aria-hidden="true">
            <span className={`${styles.yearLabel} display`}>{y.year}</span>
          </div>
          <div className={styles.campaigns}>
            {y.campaigns.map((g) => {
              const probe = g.campaign.id === firstId;
              return (
                <Fragment key={g.campaign.id}>
                  {probe ? (
                    <div ref={probeRef} className={styles.probe} aria-hidden="true" />
                  ) : null}
                  <Campaign
                    group={g}
                    view={view}
                    width={width}
                    activeId={activeId}
                    onOpen={onOpen}
                  />
                </Fragment>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Campaign({
  group,
  view,
  width,
  activeId,
  onOpen,
}: {
  group: CampaignGroup;
  view: View;
  width: number;
  activeId: string;
  onOpen: (id: string) => void;
}) {
  const { campaign, posts } = group;
  const [ref, seen] = useSeen<HTMLElement>();
  const colours = useMemo(() => campaignColours(posts), [posts]);
  const rows = useMemo(
    () =>
      view === "posted" && width > 0
        ? justify(posts.map(aspectOf), width, targetHeight(width), GAP)
        : [],
    [posts, view, width],
  );

  return (
    <section
      ref={ref}
      id={`c-${campaign.id}`}
      className={styles.campaign}
      data-seen={seen}
      aria-labelledby={`h-${campaign.id}`}
    >
      <header className={styles.head}>
        <span className={styles.node} aria-hidden="true" />
        <p className={`${styles.span} hud-label`}>
          {spanLabel(campaign.from, campaign.to)}
          <span aria-hidden="true" className={styles.dot} />
          {posts.length} of {campaign.posts.length} {campaign.posts.length === 1 ? "post" : "posts"}
        </p>
        <h2 id={`h-${campaign.id}`} className={`${styles.title} display`}>
          {campaign.title}
        </h2>
        <p className={styles.line}>{campaign.line}</p>
        <ul className={styles.colours} aria-label="One colour from each post">
          {colours.map((c, i) => (
            <li key={`${c}-${i}`} style={{ backgroundColor: c }} />
          ))}
        </ul>
      </header>

      {view === "posted" ? (
        <div className={styles.rows} role="list">
          {rows.map((row, r) => (
            <div key={r} className={styles.row} role="presentation" style={{ height: row.h }}>
              {row.items.map((it) => {
                const post = posts[it.index];
                if (!post) return null;
                return (
                  <Tile
                    key={post.id}
                    post={post}
                    w={it.w}
                    h={row.h}
                    index={it.index}
                    active={activeId === post.id}
                    onOpen={onOpen}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.cards} role="list">
          {posts.map((p, i) => (
            <Card key={p.id} post={p} index={i} active={activeId === p.id} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function Badges({ post }: { post: DesignPost }) {
  const n = post.slides?.length ?? 0;
  return (
    <span className={styles.badges}>
      {post.kind === "reel" ? (
        <span className={`${styles.chip} hud-label`}>Reel {clock(post.video?.dur ?? 0)}</span>
      ) : null}
      {post.kind === "carousel" ? (
        <span className={`${styles.chip} hud-label`}>{n} slides</span>
      ) : null}
      {post.canon !== "official" ? (
        <span className={styles.chip}>
          <CanonBadge canon={post.canon} />
        </span>
      ) : null}
    </span>
  );
}

/** A poster at its true shape. It tilts a little under the pointer and shows its title. */
function Tile({
  post,
  w,
  h,
  index,
  active,
  onOpen,
}: {
  post: DesignPost;
  w: number;
  h: number;
  index: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  const cover = coverOf(post);
  const key = cover[pickSize(w, h, dpr())];

  const tilt = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-4px)`;
  };
  const reset = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "";
  };

  return (
    <div
      role="listitem"
      className={styles.cell}
      style={{ width: w, height: h, "--i": Math.min(index, 10) } as CSSProperties}
    >
      <button
        type="button"
        className={styles.tile}
        data-id={post.id}
        data-active={active}
        aria-haspopup="dialog"
        aria-label={`${post.title}. ${kindLabel(post)}. ${formatDate(post.date)}. Open.`}
        style={{ backgroundColor: cover.c }}
        onClick={() => {
          audio.blip("click");
          onOpen(post.id);
        }}
        onPointerEnter={() => {
          audio.blip("hover");
        }}
        onPointerMove={tilt}
        onPointerLeave={reset}
      >
        {/* Plain <img>: static export, and the library lives on another origin. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={libUrl(key)}
          alt=""
          width={cover.w}
          height={cover.h}
          loading={index < 8 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
        <Badges post={post} />
        <span className={styles.cap}>
          <span className={styles.capTitle}>{post.title}</span>
          <span className={`${styles.capMeta} hud-label`}>{formatDate(post.date)}</span>
        </span>
      </button>
    </div>
  );
}

/** The designer's view: the piece on a mat tinted by its own colour, its palette and its numbers. */
function Card({
  post,
  index,
  active,
  onOpen,
}: {
  post: DesignPost;
  index: number;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  const cover = coverOf(post);
  const pal = paletteOf(post);
  const { w, h } = sizeOf(post);
  const key = cover[pickSize(Math.min(w, 300), Math.min(h, 300), dpr())];
  const dims = post.kind === "reel" && post.video ? { w: post.video.w, h: post.video.h } : { w, h };
  return (
    <article
      role="listitem"
      className={styles.card}
      data-active={active}
      style={{ "--i": Math.min(index, 10), "--mat": pal[0]?.[0] ?? cover.c } as CSSProperties}
    >
      <button
        type="button"
        className={styles.mat}
        data-id={post.id}
        aria-haspopup="dialog"
        aria-label={`${post.title}. Open.`}
        onClick={() => {
          audio.blip("click");
          onOpen(post.id);
        }}
        onPointerEnter={() => {
          audio.blip("hover");
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={libUrl(key)}
          alt=""
          width={w}
          height={h}
          loading={index < 6 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
        <Badges post={post} />
      </button>
      <div className={styles.spec}>
        <PaletteStrip pal={pal} />
        <h3 className={styles.cardTitle}>{post.title}</h3>
        <dl className={styles.facts}>
          <div>
            <dt className="hud-label">Size</dt>
            <dd>
              {dims.w} x {dims.h} px
            </dd>
          </div>
          <div>
            <dt className="hud-label">Ratio</dt>
            <dd>{ratioLabel(dims.w, dims.h)}</dd>
          </div>
          <div>
            <dt className="hud-label">Format</dt>
            <dd>{kindLabel(post)}</dd>
          </div>
          <div>
            <dt className="hud-label">File</dt>
            <dd>{sizeLabel(weightOf(post))}</dd>
          </div>
          <div>
            <dt className="hud-label">Posted</dt>
            <dd>{formatDate(post.date)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
