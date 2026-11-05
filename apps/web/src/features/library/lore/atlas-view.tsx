"use client";

import { useMemo, type CSSProperties } from "react";

import { audio } from "@/lib/audio";
import { libUrl } from "@/lib/library";

import styles from "./atlas-view.module.css";
import { AtlasDetail } from "./atlas-detail";
import { atlasMatches } from "./search";
import { Hl } from "./text-body";
import type { AtlasItem, AtlasLayer, LoreFile } from "./types";

const LAYER_ORDER: readonly AtlasLayer[] = ["worlds", "notes", "settings", "figures"];
const LAYER_CODE: Readonly<Record<AtlasLayer, string>> = {
  worlds: "W",
  notes: "P",
  settings: "S",
  figures: "E",
};
const LAYER_SOURCE: Readonly<Record<AtlasLayer, string>> = {
  worlds: "the Universe A5-01 text",
  notes: "the Places text",
  settings: "the Settings text",
  figures: "the Entities text",
};

export interface AtlasViewProps {
  lore: LoreFile;
  terms: readonly string[];
  layer: string;
  onLayer: (next: string) => void;
  selected: string;
  onSelect: (id: string) => void;
  onOpenText: (id: string, heading?: string) => void;
}

/** Widths of the thumbnail and the preview as the files were made (never upscaled). */
function widths(a: AtlasItem): { t: number; p: number } {
  const long = Math.max(a.img.w, a.img.h);
  const w = (cap: number) => Math.round(a.img.w * Math.min(1, cap / long));
  return { t: w(480), p: w(1280) };
}

function Plate({
  item,
  code,
  index,
  terms,
  onSelect,
}: {
  item: AtlasItem;
  code: string;
  index: number;
  terms: readonly string[];
  onSelect: (id: string) => void;
}) {
  const w = widths(item);
  const ratio = item.img.w / item.img.h;
  return (
    <li className={styles.cell} style={{ "--i": index } as CSSProperties}>
      <button
        type="button"
        className={styles.plate}
        data-alpha={item.alpha ? "1" : "0"}
        aria-label={`${item.name}, plate ${code}. Open the full entry.`}
        onClick={() => {
          audio.blip("click");
          onSelect(item.id);
        }}
      >
        <span className={`${styles.code} hud-label`}>{code}</span>
        <span
          className={styles.frame}
          style={{ "--ground": item.alpha ? "transparent" : item.img.c } as CSSProperties}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={libUrl(item.img.t)}
            srcSet={`${libUrl(item.img.t)} ${w.t}w, ${libUrl(item.img.p)} ${w.p}w`}
            sizes="(min-width: 64em) 22rem, 46vw"
            width={Math.round(480 * Math.min(1, ratio))}
            height={Math.round(480 / Math.max(1, ratio))}
            alt=""
            loading="lazy"
            decoding="async"
            className={styles.pic}
          />
          <span className={styles.passage} aria-hidden="true">
            <span className={styles.passageText}>{item.text}</span>
            <span className={`${styles.passageHint} hud-label`}>Press to open</span>
          </span>
        </span>
        <span className={styles.nameRow}>
          <span className={`${styles.name} display`}>
            <Hl text={item.name} terms={terms} />
          </span>
          <span className={`${styles.kind} hud-label`}>
            {item.kind === "place" ? "Place" : "Entity"}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The atlas: every place and entity of the official texts as a numbered plate on one survey
 * sheet. The sheet only indexes. The sources give no positions, so nothing here is a map.
 */
export function AtlasView({
  lore,
  terms,
  layer,
  onLayer,
  selected,
  onSelect,
  onOpenText,
}: AtlasViewProps) {
  const layers = useMemo(() => {
    const keep = new Set(atlasMatches(lore.atlas, layer, terms).map((a) => a.id));
    return LAYER_ORDER.map((id) => {
      const all = lore.atlas.filter((a) => a.layer === id);
      return { id, all: all.length, shown: all.filter((a) => keep.has(a.id)) };
    });
  }, [lore.atlas, layer, terms]);

  const total = layers.reduce((n, l) => n + l.shown.length, 0);
  const places = lore.atlas.filter((a) => a.kind === "place").length;
  const entities = lore.atlas.length - places;
  const list = layers.flatMap((l) => l.shown);
  let running = 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.sheet}>
        <span className={`${styles.reg} ${styles.regA}`} aria-hidden="true" />
        <span className={`${styles.reg} ${styles.regB}`} aria-hidden="true" />
        <span className={`${styles.reg} ${styles.regC}`} aria-hidden="true" />
        <span className={`${styles.reg} ${styles.regD}`} aria-hidden="true" />
        <span className={styles.rulerTop} aria-hidden="true" />
        <span className={styles.rulerLeft} aria-hidden="true" />

        <header className={styles.head}>
          <div>
            <p className="hud-label">Survey sheet LORE-A5 / {lore.atlas.length} plates</p>
            <h2 className={`${styles.title} display`}>Atlas</h2>
            <p className={styles.lead}>
              {places} places and {entities} entities, each with its official picture and the
              passage that describes it. Rest on a plate to read it. Press it to open.
            </p>
          </div>
          <div className={styles.layers} role="group" aria-label="Layers of the sheet">
            <span className="hud-label">Layers</span>
            <button
              type="button"
              className={styles.layerBtn}
              aria-pressed={layer === ""}
              onClick={() => {
                audio.blip("click");
                onLayer("");
              }}
            >
              All <span>{lore.atlas.length}</span>
            </button>
            {layers.map((l) => (
              <button
                key={l.id}
                type="button"
                className={styles.layerBtn}
                aria-pressed={layer === l.id}
                onClick={() => {
                  audio.blip("click");
                  onLayer(layer === l.id ? "" : l.id);
                }}
              >
                {lore.layers[l.id]} <span>{l.all}</span>
              </button>
            ))}
          </div>
        </header>

        {total === 0 ? (
          <p className={styles.empty}>No plate has all of these words.</p>
        ) : (
          layers
            .filter((l) => l.shown.length > 0)
            .map((l, li) => (
              <section key={l.id} className={styles.layer} aria-labelledby={`lore-layer-${l.id}`}>
                <h3 id={`lore-layer-${l.id}`} className={`${styles.layerHead} hud-label`}>
                  <span>Layer {String(LAYER_ORDER.indexOf(l.id) + 1).padStart(2, "0")}</span>
                  <span className={styles.layerName}>{lore.layers[l.id]}</span>
                  <span className={styles.layerFrom}>From {LAYER_SOURCE[l.id]}</span>
                  <span className={styles.layerRule} aria-hidden="true" />
                  <span>{l.shown.length}</span>
                </h3>
                <ul className={styles.grid} data-layer={li}>
                  {l.shown.map((a) => {
                    const idx = running;
                    running += 1;
                    const n = lore.atlas.filter((x) => x.layer === a.layer).indexOf(a) + 1;
                    return (
                      <Plate
                        key={a.id}
                        item={a}
                        code={`${LAYER_CODE[a.layer]}-${String(n).padStart(2, "0")}`}
                        index={idx}
                        terms={terms}
                        onSelect={onSelect}
                      />
                    );
                  })}
                </ul>
              </section>
            ))
        )}

        <footer className={styles.titleBlock}>
          <dl>
            <div>
              <dt className="hud-label">Sheet</dt>
              <dd>Lore atlas</dd>
            </div>
            <div>
              <dt className="hud-label">Plates shown</dt>
              <dd>
                {total} of {lore.atlas.length}
              </dd>
            </div>
            <div>
              <dt className="hud-label">Source</dt>
              <dd>The official texts</dd>
            </div>
            <div>
              <dt className="hud-label">Scale</dt>
              <dd>Not a map. No positions are given.</dd>
            </div>
          </dl>
        </footer>
      </div>

      <AtlasDetail
        lore={lore}
        list={list.length > 0 ? list : lore.atlas}
        selected={selected}
        onSelect={onSelect}
        onOpenText={onOpenText}
        onClose={() => {
          onSelect("");
        }}
      />
    </div>
  );
}
