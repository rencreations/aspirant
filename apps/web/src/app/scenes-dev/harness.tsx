"use client";

import { useEffect, useMemo, useState } from "react";

import { useExperience, type PartNumber } from "@/features/experience/contract";
import { CHAPTERS, PARTS, type SceneKey } from "@/features/experience/scenes/parts";
import ScenesLayer from "@/features/experience/scenes/ScenesLayer";

import { PiecesGallery } from "./pieces";

type TextMode = "auto" | "storm" | "daybreak" | "split" | "none";

const SAMPLE = [
  "There was a place at the top of Selrick Academy that was on no map.",
  "A rusty ladder led up the outside of the central tower. At the top was a narrow steel walkway called a gantry. It ran around the tower, seventy metres up. On a clear morning, you could watch the sun rise out of the sea.",
  "Below lay all of Terrinia, under the pale web of the Defence Sphere.",
  "Layla had found it in her first week. It was hers. She had left a green cushion there, and a thermos.",
  "This is my secret base, she thought. Nobody knows. And nobody is going to.",
  "Layla was small, quick and stubborn. She was an Aspirant, one of the Academy's special fighters.",
];

/** First chapter and paragraph that shows each scene key. */
function sceneIndex(): Map<SceneKey, { chapter: string; paragraph: string | null }> {
  const map = new Map<SceneKey, { chapter: string; paragraph: string | null }>();
  for (const [id, ch] of Object.entries(CHAPTERS)) {
    if (!map.has(ch.scene)) map.set(ch.scene, { chapter: id, paragraph: null });
    for (const t of ch.turns ?? [])
      if (!map.has(t.scene)) map.set(t.scene, { chapter: id, paragraph: t.at });
  }
  for (const n of Object.keys(PARTS)) {
    const part = PARTS[Number(n) as PartNumber];
    if (!map.has(part.scene)) map.set(part.scene, { chapter: "", paragraph: null });
  }
  return map;
}

interface GLLike {
  info: {
    memory: { geometries: number; textures: number };
    programs?: unknown[] | null;
    render: { calls: number; triangles: number };
  };
}

export function Harness() {
  const [gallery] = useState(
    () =>
      typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pieces"),
  );
  if (gallery) return <PiecesGallery />;
  return <SceneHarness />;
}

function SceneHarness() {
  const scenes = useMemo(sceneIndex, []);
  const [text, setText] = useState<TextMode>("auto");
  const [stats, setStats] = useState("");
  const [chapter, setChapter] = useState("c01");
  const [paragraph, setParagraph] = useState<string>("");
  const [progress, setProgress] = useState(0.3);

  const apply = (ch: string, para: string | null, prog: number) => {
    const meta = CHAPTERS[ch];
    if (!meta) return;
    const ids = Object.keys(CHAPTERS);
    useExperience.getState().setPosition({
      partNumber: meta.part,
      chapterId: ch,
      paragraphId: para ?? `${ch}-p000`,
      chapterProgress: prog,
      storyProgress: ids.indexOf(ch) / ids.length,
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scene = params.get("scene") as SceneKey | null;
    const t = params.get("text") as TextMode | null;
    if (t) setText(t);
    const prog = params.has("p") ? Number(params.get("p")) : 0.3;
    setProgress(prog);
    if (scene && scenes.has(scene)) {
      const hit = scenes.get(scene)!;
      setChapter(hit.chapter);
      setParagraph(hit.paragraph ?? "");
      apply(hit.chapter, hit.paragraph, prog);
    } else {
      const ch = params.get("chapter") ?? "c01";
      setChapter(ch);
      apply(ch, params.get("para"), prog);
    }
    const harness = {
      scene(key: SceneKey, prog = 0.3) {
        const hit = scenes.get(key);
        if (hit) apply(hit.chapter, hit.paragraph, prog);
        return Boolean(hit);
      },
      at(ch: string, para: string | null, prog = 0.3) {
        apply(ch, para, prog);
      },
      keys: () => [...scenes.keys()],
      pulse: () => useExperience.getState().pulse(),
      info() {
        const gl = (window as unknown as { __scenesGL?: GLLike }).__scenesGL;
        if (!gl) return null;
        return {
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? 0,
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
        };
      },
    };
    (window as unknown as { __harness?: unknown }).__harness = harness;
    const id = window.setInterval(() => {
      const i = harness.info();
      setStats(
        i ? `geo ${i.geometries} tex ${i.textures} prog ${i.programs} calls ${i.calls}` : "no gl",
      );
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = CHAPTERS[chapter];
  const autoTheme = meta?.mood ?? "storm";
  const sections: { theme: "storm" | "daybreak"; key: string }[] =
    text === "split"
      ? [
          { theme: "storm", key: "a" },
          { theme: "daybreak", key: "b" },
        ]
      : text === "none"
        ? []
        : [{ theme: text === "auto" ? autoTheme : text, key: "a" }];

  return (
    <>
      <ScenesLayer />
      <div
        data-harness-controls=""
        style={{
          position: "fixed",
          left: 8,
          bottom: 8,
          zIndex: 60,
          background: "rgb(0 0 0 / 0.75)",
          color: "#fff",
          font: "12px monospace",
          padding: 8,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          maxWidth: "96vw",
        }}
      >
        <select
          aria-label="Chapter"
          value={chapter}
          onChange={(e) => {
            setChapter(e.target.value);
            setParagraph("");
            apply(e.target.value, null, progress);
          }}
        >
          {Object.keys(CHAPTERS).map((id) => (
            <option key={id} value={id}>
              {id} (P{CHAPTERS[id]?.part})
            </option>
          ))}
        </select>
        <select
          aria-label="Turn"
          value={paragraph}
          onChange={(e) => {
            setParagraph(e.target.value);
            apply(chapter, e.target.value || null, progress);
          }}
        >
          <option value="">start: {meta?.scene}</option>
          {(meta?.turns ?? []).map((t) => (
            <option key={t.at} value={t.at}>
              {t.at}: {t.scene}
            </option>
          ))}
        </select>
        <input
          aria-label="Chapter progress"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          onChange={(e) => {
            setProgress(Number(e.target.value));
            useExperience.getState().setPosition({ chapterProgress: Number(e.target.value) });
          }}
        />
        <button type="button" onClick={() => useExperience.getState().pulse()}>
          beat
        </button>
        <select
          aria-label="Text"
          value={text}
          onChange={(e) => setText(e.target.value as TextMode)}
        >
          {["auto", "storm", "daybreak", "split", "none"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <span data-stats="">{stats}</span>
      </div>
      <h1 className="sr-only">Scenes dev</h1>
      {sections.map((s) => (
        <section
          key={s.key}
          data-theme={s.theme}
          data-mock-text=""
          style={{ minHeight: text === "split" ? "100vh" : "300vh", paddingTop: "12vh" }}
        >
          <div className="shell">
            <div style={{ maxWidth: "var(--measure)", marginInline: "auto" }}>
              {Array.from({ length: text === "split" ? 2 : 6 }).flatMap((_, k) =>
                SAMPLE.map((line, i) => (
                  <p key={`${k}-${i}`} className="text-text-dim" style={{ marginBottom: "1.4em" }}>
                    {line}
                  </p>
                )),
              )}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
