"use client";

import { useEffect, useMemo, useRef } from "react";

import { useLibraryData } from "../data";
import { Chips, ControlBar, type ChipOption } from "../shell/controls";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { EmoteWall } from "./emote-wall";
import {
  humanBytes,
  isSection,
  itemsByGroup,
  SECTION_CHIP_LABEL,
  SECTION_ORDER,
  visibleSections,
} from "./filters";
import { GameplayGrid } from "./gameplay-grid";
import { ModelStage } from "./model-stage";
import { Section } from "./section";
import styles from "./sections.module.css";
import { SiteArt } from "./site-art";
import { SkillGrid } from "./skill-grid";
import type {
  EmoteItem,
  GameplayItem,
  LinkItem,
  ModelItem,
  OthersFile,
  OthersGroup,
  OthersGroupId,
  OthersItem,
  SiteItem,
  SkillItem,
} from "./types";
import { WorldLinks } from "./world-links";

const REVEAL = {
  models: "stage",
  emotes: "pop",
  gameplay: "rise",
  skills: "scale",
  site: "slide",
  more: "fade",
} as const;

/** The others room: the 3D models, the emotes, the gameplay clips, the skill icons, the art made for the site, and the way out. */
export default function OthersPage() {
  const { data } = useLibraryData<OthersItem>("others");
  const file = data as OthersFile | null;
  const [section, setSection] = useQueryState("s");
  const [query, setQuery] = useQueryState("q");
  const [openId, setOpenId] = useQueryState("i");

  const items = useMemo(() => file?.items ?? [], [file]);
  const groups = useMemo(() => {
    const map = new Map<OthersGroupId, OthersGroup>();
    file?.groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [file]);
  const by = useMemo(() => itemsByGroup(items, query), [items, query]);
  const active = isSection(section) ? section : "";
  const visible = visibleSections(by, active, query);

  const models = by.models as ModelItem[];
  const selectedModel = models.some((m) => m.id === openId) ? openId : (models[0]?.id ?? "");

  const shown = visible.reduce((sum, id) => sum + by[id].length, 0);
  const stat = useMemo(() => {
    let bytes = 0;
    for (const it of items) {
      if (it.kind === "model") bytes += it.model.totalBytes;
      if (it.kind === "emote" || it.kind === "gameplay") bytes += it.video.bytes;
    }
    return bytes ? `${humanBytes(bytes)} of models and clips` : undefined;
  }, [items]);

  const chipOptions: ChipOption[] = SECTION_ORDER.map((id) => ({
    value: id,
    label: SECTION_CHIP_LABEL[id],
    count: by[id].length,
  }));

  // A link to one item (`?i=<id>`) brings that item into view. The 3D models and the art open in
  // their own viewers instead.
  const scrolled = useRef("");
  useEffect(() => {
    if (!openId || scrolled.current === openId || items.length === 0) return;
    const item = items.find((i) => i.id === openId);
    if (!item || item.kind === "model" || item.kind === "site") return;
    scrolled.current = openId;
    const t = window.setTimeout(() => {
      document.getElementById(openId)?.scrollIntoView({ block: "center" });
    }, 400);
    return () => {
      window.clearTimeout(t);
    };
  }, [openId, items]);

  const summary = file
    ? shown === items.length
      ? `All ${items.length} items in ${visible.length} sections`
      : `${shown} of ${items.length} items in ${visible.length} ${visible.length === 1 ? "section" : "sections"}`
    : "Loading";

  const body = (id: OthersGroupId) => {
    const group = groups.get(id);
    if (!group) return null;
    const list = by[id];
    let content = null;
    switch (id) {
      case "models":
        content = (
          <ModelStage
            models={models}
            selected={selectedModel}
            onSelect={(next) => {
              setOpenId(next === models[0]?.id ? "" : next);
            }}
          />
        );
        break;
      case "emotes":
        content = <EmoteWall items={list as EmoteItem[]} />;
        break;
      case "gameplay":
        content = <GameplayGrid items={list as GameplayItem[]} />;
        break;
      case "skills":
        content = <SkillGrid items={list as SkillItem[]} />;
        break;
      case "site":
        content = (
          <SiteArt
            items={list as SiteItem[]}
            openId={openId}
            onOpen={setOpenId}
            onClose={() => {
              setOpenId("");
            }}
          />
        );
        break;
      case "more":
        content = <WorldLinks items={list as LinkItem[]} />;
        break;
    }
    if (list.length === 0 && id !== "models") {
      content = <p className={styles.empty}>Nothing here matches.</p>;
    }
    if (id === "models" && list.length === 0) {
      content = <p className={styles.empty}>Nothing here matches.</p>;
    }
    return (
      <Section key={id} group={group} count={list.length} reveal={REVEAL[id]}>
        {content}
      </Section>
    );
  };

  return (
    <LibraryShell
      slug="others"
      count={file ? items.length : null}
      {...(stat ? { stat } : {})}
      controls={
        <ControlBar
          query={query}
          onQuery={setQuery}
          placeholder="Search the 3D models, stickers, clips and icons"
          summary={summary}
        >
          <Chips
            label="Section"
            all="All"
            options={chipOptions}
            value={active}
            onChange={setSection}
          />
        </ControlBar>
      }
    >
      <div className="shell">
        {file ? visible.map(body) : null}
        {file && visible.length === 0 ? (
          <p className={styles.empty}>Nothing matches that search. Try another word.</p>
        ) : null}
      </div>
    </LibraryShell>
  );
}
