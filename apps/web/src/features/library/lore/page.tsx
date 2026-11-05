"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";

import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { AtlasView } from "./atlas-view";
import { LoreBar } from "./lore-bar";
import styles from "./lore-page.module.css";
import { atlasMatches, parseTerms, searchTexts } from "./search";
import { TextsView } from "./texts-view";
import { isLoreView, type AtlasLayer, type LoreView } from "./types";
import { useLore } from "./use-lore";
import { WhoView } from "./who-view";

const LAYERS: readonly AtlasLayer[] = ["worlds", "notes", "settings", "figures"];

/** Drop the `#heading` part of the address, or set it. */
function setHash(heading: string): void {
  const url = new URL(window.location.href);
  url.hash = heading;
  window.history.replaceState(window.history.state, "", url);
}

/**
 * The lore room: every official text to read, an atlas of the places and the Enders, and a
 * who-is-who of the ten. The address keeps the view (`?view=`), the search (`?q=`), the open text
 * (`?i=` and `#heading`), the open plate (`?a=`), the layer (`?layer=`) and the person (`?c=`).
 */
export default function LorePage() {
  const { lore, failed } = useLore();
  const [viewParam, setViewParam] = useQueryState("view", "texts");
  const [q, setQ] = useQueryState("q", "");
  const [openId, setOpenId] = useQueryState("i", "");
  const [plate, setPlate] = useQueryState("a", "");
  const [layerParam, setLayer] = useQueryState("layer", "");
  const [who, setWho] = useQueryState("c", "");
  const [barH, setBarH] = useState(84);

  const view: LoreView = isLoreView(viewParam) ? viewParam : "texts";
  const layer = (LAYERS as readonly string[]).includes(layerParam) ? layerParam : "";
  const terms = useMemo(() => parseTerms(q), [q]);

  const openText = useCallback(
    (id: string, heading = "") => {
      setHash(heading);
      setPlate("");
      setViewParam("texts");
      setOpenId(id);
    },
    [setOpenId, setPlate, setViewParam],
  );

  const closeText = useCallback(() => {
    setHash("");
    setOpenId("");
  }, [setOpenId]);

  const openPlace = useCallback(
    (id: string) => {
      setHash("");
      setOpenId("");
      setViewParam("atlas");
      setPlate(id);
    },
    [setOpenId, setPlate, setViewParam],
  );

  const changeView = useCallback(
    (next: LoreView) => {
      setPlate("");
      setViewParam(next);
    },
    [setPlate, setViewParam],
  );

  const changeQuery = useCallback(
    (next: string) => {
      // Typing while reading goes back to the list, so the results show.
      if (openId && next !== q) {
        setHash("");
        setOpenId("");
      }
      setQ(next);
    },
    [openId, q, setOpenId, setQ],
  );

  const summary = useMemo(() => {
    if (!lore) return "Reading the lore";
    if (view === "texts") {
      const open = openId ? lore.texts.find((t) => t.id === openId) : undefined;
      if (open) return `Reading ${open.title}, ${open.minutes} min`;
      if (terms.length > 0) {
        const n = searchTexts(lore.texts, q).length;
        return `${n} ${n === 1 ? "text matches" : "texts match"}`;
      }
      const minutes = lore.texts.reduce((sum, t) => sum + t.minutes, 0);
      return `${lore.texts.length} texts, ${minutes} min of reading`;
    }
    if (view === "atlas") {
      const n = atlasMatches(lore.atlas, layer, terms).length;
      return `${n} of ${lore.atlas.length} plates`;
    }
    return "The ten Aspirants";
  }, [lore, view, openId, terms, q, layer]);

  const places = lore ? lore.atlas.filter((a) => a.kind === "place").length : 0;
  const entities = lore ? lore.atlas.length - places : 0;

  return (
    <LibraryShell
      slug="lore"
      count={lore ? lore.texts.length : null}
      stat={lore ? `${places} places, ${entities} entities` : undefined}
      controls={
        <LoreBar
          view={view}
          onView={changeView}
          q={q}
          onQuery={changeQuery}
          summary={summary}
          onHeight={setBarH}
        />
      }
    >
      <div className="shell" style={{ "--lore-bar-h": `${barH}px` } as CSSProperties}>
        <div
          id="lore-panel"
          role="tabpanel"
          aria-label={view === "texts" ? "Texts" : view === "atlas" ? "Atlas" : "Who is who"}
          className={styles.panel}
          key={view}
        >
          {failed ? (
            <p className={styles.note}>
              The lore could not be loaded. Check the connection and reload the page.
            </p>
          ) : !lore ? (
            <p className={`${styles.note} hud-label`}>Reading the lore</p>
          ) : view === "texts" ? (
            <TextsView
              lore={lore}
              q={q}
              terms={terms}
              openId={openId}
              onOpen={openText}
              onClose={closeText}
              onPlace={openPlace}
            />
          ) : view === "atlas" ? (
            <AtlasView
              lore={lore}
              terms={terms}
              layer={layer}
              onLayer={setLayer}
              selected={plate}
              onSelect={setPlate}
              onOpenText={openText}
            />
          ) : (
            <WhoView lore={lore} terms={terms} who={who} onWho={setWho} onOpenText={openText} />
          )}
        </div>
      </div>
    </LibraryShell>
  );
}
