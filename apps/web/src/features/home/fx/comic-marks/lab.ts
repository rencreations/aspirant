import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

import { getCast } from "../../actors/shared/cast";
import type { ActorCtx } from "../../actors/shared/types";
import { makePixelPerspectiveCamera } from "../../kernel/stage";
import type { Actor } from "../../kernel/types";
import { ensureTrails, type TrailsActor } from "../trail";
import type { TrailHandle, TrailOptions } from "../trail/system";
import { ensureMarks } from "./index";
import { KIND_INFO, MARK_KINDS, type MarkKind } from "./kinds";
import type { MarksActor } from "./marks";
import type { EmitOptions, SustainHandle, SustainOptions } from "./system";

export interface GalleryOptions {
  /** Seconds the marks have lived when the picture is taken. */
  age: number;
  /** Read `age` as a fraction of each kind's own duration instead of seconds (0.4 is the middle of every life). */
  fraction?: boolean;
  /** Mark size in pixels. Default: the kind's own. */
  size?: number;
  kinds?: readonly MarkKind[];
  columns?: number;
  /** The distance between two marks. Default: 1.7 times the largest size, at least 150. */
  cell?: number;
  seed?: number;
  /** Where the middle of the grid is (stage pixels). */
  center?: { x: number; y: number };
  color?: EmitOptions["color"];
  /** Run the kinds that can loop as loops (`sustain`) for `age` seconds instead of one `emit`. */
  loops?: boolean;
}

export interface GalleryCell {
  kind: MarkKind;
  /** The middle of the cell in the stage's pixels (origin in the middle, y up). */
  x: number;
  y: number;
  /** The same in client pixels (for a label). */
  cx: number;
  cy: number;
}

export interface BenchResult {
  live: number;
  frames: number;
  /** Milliseconds a step of the simulation and the upload take. */
  stepMs: number;
  /** Milliseconds a whole `stage.draw` takes with the GPU waited for (`finish`). */
  drawMs: number;
  /** The same draw with nothing alive, for the difference. */
  drawIdleMs: number;
}

/**
 * What `window.__home.lab("marks")` gives back: the marks and the trails, put on the lab object so a
 * Playwright script has one thing to call. Freeze the scene first (`__home.freeze(true)`): the marks
 * then stand where `advance` left them. `hold` keeps a trail tracked while the scene is frozen.
 */
export interface MarksLab extends Actor {
  readonly marks: MarksActor;
  readonly trails: TrailsActor;
  emit(kind: MarkKind, options: EmitOptions): void;
  sustain(kind: MarkKind, options?: SustainOptions): SustainHandle;
  trail(options?: TrailOptions): TrailHandle;
  /** Every kind on a grid at one age: a frame sheet. Returns where each kind is, in stage and client pixels. */
  gallery(options: GalleryOptions): GalleryCell[];
  /**
   * Trails drawn along paths (`path(t)`, `t` in seconds) for `seconds` all at once, then held where
   * they ended: each head stays tracked every frame until `release`. A path may stop early (`until`).
   */
  trailDemos(
    demos: ReadonlyArray<{
      path: (t: number) => { x: number; y: number };
      options?: TrailOptions;
      until?: number;
    }>,
    seconds: number,
  ): TrailHandle[];
  /**
   * The cast camera check. A blue square stands in the cast at (200, -100) and a sparkle loop and a
   * trail follow it, while the cast is drawn through a camera moved `shift` pixels to the right (what
   * the fall does). The sparkle must stay on the square. `castDemo(false)` takes it all away.
   */
  castDemo(on: boolean, shift?: number): void;
  /** Stop everything the lab started (the trail demos, the cast demo, the loops) and clear it. */
  release(): void;
  /** `n` long lived marks, timed. The scene must not be frozen for the draw numbers to mean anything. */
  bench(n: number, frames: number): BenchResult;
  /** `n` trails (up to 12) on circles, each tracked every frame, timed: the step and the whole draw. */
  benchTrails(n: number, frames: number): { stepMs: number; drawMs: number };
}

const LOOP_KINDS: readonly MarkKind[] = MARK_KINDS.filter(
  (k) => KIND_INFO[k].sustain !== undefined || k === "dizzy",
);

/** Build the lab object. Imported lazily by `kernel/lab.ts`; no section uses it. */
export async function ensureMarksLab(ctx: ActorCtx): Promise<MarksLab> {
  const marks = await ensureMarks(ctx);
  const trails = await ensureTrails(ctx);
  const holds: Array<{ handle: TrailHandle; x: number; y: number }> = [];
  let raf = 0;
  const hold = (): void => {
    for (const h of holds) h.handle.track({ x: h.x, y: h.y });
    raf = holds.length > 0 ? requestAnimationFrame(hold) : 0;
  };
  const loops: SustainHandle[] = [];
  let demo: { stop(): void } | null = null;

  const lab: MarksLab = {
    name: marks.name,
    get visible() {
      return marks.visible;
    },
    set visible(v: boolean) {
      marks.visible = v;
    },
    marks,
    trails,
    emit: (kind, options) => {
      marks.emit(kind, options);
    },
    sustain: (kind, options) => marks.sustain(kind, options),
    trail: (options) => trails.create(options),
    gallery(options) {
      const kinds = options.kinds ?? (options.loops ? LOOP_KINDS : MARK_KINDS);
      const { stage } = ctx;
      const columns = options.columns ?? 5;
      const rows = Math.ceil(kinds.length / columns);
      const largest = Math.max(options.size ?? 0, ...kinds.map((k) => KIND_INFO[k].size));
      const cell =
        options.cell ??
        Math.min(
          Math.max(150, largest * 1.7),
          (stage.width - 40) / columns,
          (stage.height - 40) / rows,
        );
      const cx = options.center?.x ?? 0;
      const cy = options.center?.y ?? 0;
      // With `fraction`, a kind that lives a short time is made later, so every kind is the same
      // part of the way through its life when the picture is taken.
      const longest = Math.max(...kinds.map((k) => KIND_INFO[k].duration));
      const total = options.fraction ? options.age * longest : options.age;
      marks.clear();
      for (const l of loops) l.stop();
      loops.length = 0;
      const cells: GalleryCell[] = [];
      const handles: Array<{ handle: SustainHandle; x: number; y: number }> = [];
      kinds.forEach((kind, i) => {
        const c = i % columns;
        const r = Math.floor(i / columns);
        const x = cx + (c - (columns - 1) / 2) * cell;
        const y = cy + ((rows - 1) / 2 - r) * cell;
        cells.push({ kind, x, y, cx: x + stage.width / 2, cy: stage.height / 2 - y });
        const seed = (options.seed ?? 3) + i;
        if (options.loops) {
          const handle = marks.sustain(kind, {
            at: { x, y },
            size: options.size,
            color: options.color,
            seed,
          });
          handles.push({ handle, x, y });
          loops.push(handle);
        } else {
          const delay = options.fraction ? total - options.age * KIND_INFO[kind].duration : 0;
          marks.emit(kind, {
            at: { x, y },
            size: options.size,
            seed,
            color: options.color,
            delay,
          });
        }
      });
      marks.advance(total, () => {
        for (const h of handles) h.handle.update({ x: h.x, y: h.y }, 1);
      });
      // The loops are left running with their last position, set once more so a frozen frame keeps them.
      for (const h of handles) h.handle.update({ x: h.x, y: h.y }, 1);
      return cells;
    },
    trailDemos(demos, seconds) {
      const handles = demos.map((d) => trails.create(d.options));
      let t = 0;
      trails.advance(seconds, (dt) => {
        t += dt;
        demos.forEach((d, i) => {
          handles[i]!.track(d.path(Math.min(t, d.until ?? seconds)));
        });
      });
      demos.forEach((d, i) => {
        const end = d.path(Math.min(seconds, d.until ?? seconds));
        holds.push({ handle: handles[i]!, x: end.x, y: end.y });
      });
      if (!raf) raf = requestAnimationFrame(hold);
      return handles;
    },
    castDemo(on, shift = 150) {
      demo?.stop();
      demo = null;
      if (!on) return;
      const { stage } = ctx;
      const cast = getCast(stage);
      const mesh = new Mesh(
        new PlaneGeometry(60, 60),
        new MeshBasicMaterial({ color: 0x2d7aff, depthTest: false }),
      );
      mesh.position.set(200, -100, 0);
      cast.add(mesh);
      const camera = makePixelPerspectiveCamera(stage.width, stage.height);
      camera.position.x = shift;
      camera.updateMatrixWorld();
      const sparkle = marks.sustain("sparkle", { at: mesh, size: 70 });
      const ribbon = trails.create({ colors: ["sky", "white"], width: 14 });
      let frame = 0;
      let live = true;
      const tick = (): void => {
        if (!live) return;
        cast.setCamera(camera);
        mesh.position.y = -100 + 60 * Math.sin(frame++ * 0.08);
        sparkle.update(mesh, 1);
        ribbon.track(mesh);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      demo = {
        stop() {
          live = false;
          sparkle.stop();
          mesh.removeFromParent();
          mesh.geometry.dispose();
          mesh.material.dispose();
        },
      };
    },
    release() {
      demo?.stop();
      demo = null;
      holds.length = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      trails.clear();
      marks.clear();
      for (const l of loops) l.stop();
      loops.length = 0;
    },
    benchTrails(n, frames) {
      const { stage } = ctx;
      const info = {
        time: 0,
        dt: 1 / 60,
        S: 0,
        raw: 0,
        velocity: 0,
        viewport: { w: stage.width, h: stage.height, dpr: stage.dpr },
        frame: 0,
        input: { wheel: 0 },
      };
      const gl = stage.renderer.getContext();
      const handles = Array.from({ length: n }, () => trails.create({ width: 20 }));
      let f = 0;
      const drive = (): void => {
        const t = f++ / 60;
        handles.forEach((h, i) => {
          h.track({ x: 300 * Math.cos(t * 3 + i), y: 200 * Math.sin(t * 3 + i * 0.7) });
        });
      };
      for (let i = 0; i < 60; i++) {
        drive();
        trails.system.step(1 / 60);
      }
      let start = performance.now();
      for (let i = 0; i < frames; i++) {
        drive();
        trails.system.step(1 / 60);
      }
      const stepMs = (performance.now() - start) / frames;
      start = performance.now();
      for (let i = 0; i < frames; i++) {
        drive();
        stage.draw(info);
      }
      gl.finish();
      const drawMs = (performance.now() - start) / frames;
      trails.clear();
      return { stepMs, drawMs };
    },
    bench(n, frames) {
      const { stage } = ctx;
      const info = {
        time: 0,
        dt: 1 / 60,
        S: 0,
        raw: 0,
        velocity: 0,
        viewport: { w: stage.width, h: stage.height, dpr: stage.dpr },
        frame: 0,
        input: { wheel: 0 },
      };
      const gl = stage.renderer.getContext();
      const time = (run: () => void): number => {
        const start = performance.now();
        for (let i = 0; i < frames; i++) run();
        gl.finish();
        return (performance.now() - start) / frames;
      };
      marks.clear();
      const drawIdleMs = time(() => {
        stage.draw(info);
      });
      const kinds: readonly MarkKind[] = ["bang", "starburst", "heart", "note", "sweat", "spark"];
      for (let i = 0; i < n; i++) {
        marks.emit(kinds[i % kinds.length]!, {
          at: {
            x: ((i * 97) % stage.width) - stage.width / 2,
            y: ((i * 53) % stage.height) - stage.height / 2,
          },
          size: 40 + (i % 5) * 10,
          duration: 600,
          seed: i + 1,
        });
      }
      marks.advance(0.5);
      const live = marks.drawn;
      const stepMs = time(() => {
        marks.system.step(1 / 60);
      });
      const drawMs = time(() => {
        stage.draw(info);
      });
      marks.clear();
      return { live, frames, stepMs, drawMs, drawIdleMs };
    },
  };
  return lab;
}
