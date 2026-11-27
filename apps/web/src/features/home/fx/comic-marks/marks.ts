import {
  BufferAttribute,
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  NormalBlending,
  ShaderMaterial,
} from "three";

import type { Stage } from "../../kernel/stage";
import type { Actor } from "../../kernel/types";
import { StageProjector } from "./anchor";
import type { MarkKind } from "./kinds";
import { STRIDE } from "./mark";
import { clientToStage } from "./math";
import { addStepPass, type StepPass } from "./pass";
import { FRAGMENT, VERTEX } from "./shader";
import { MarkSystem, type EmitOptions, type SustainHandle, type SustainOptions } from "./system";

/** Where the marks are drawn: above every other pass, in the pixel frame. */
const MARKS_ORDER = 40;
const MARKS_CAPACITY = 512;

/**
 * The comic marks of the home: a bang over a drone, a vein on Silverbolt, notes out of a horn, air
 * streaks past a falling doll. One instanced mesh in the shared `marks` pass (orthographic, order
 * 40, above every actor), one draw call, every shape drawn by one fragment shader (`shader.ts`).
 *
 * The actor is a handle: it is never shown or hidden by the kernel and has no `object`. The pass
 * steps the simulation itself, as the last thing before it draws (`pass.ts`), so an anchor that an
 * actor moved this frame is followed with no lag and the clock of the marks is the clock of the
 * stage (a frozen scene freezes the marks). The pass is drawn only while a mark or a loop is alive,
 * so an idle page pays nothing. Nothing is held outside three's own tracking, so a lost context
 * needs no rebuild.
 */
export class MarksActor implements Actor {
  readonly name = "marks";
  /** Ignored: the pass decides. Kept because every actor has one. */
  visible = false;
  readonly system: MarkSystem;
  private readonly stage: Stage;
  private readonly pass: StepPass;
  private readonly removePass: () => void;
  private readonly mesh: Mesh;
  private readonly geometry: InstancedBufferGeometry;
  private readonly buffer: InstancedInterleavedBuffer;
  private readonly material: ShaderMaterial;
  private disposed = false;

  constructor(stage: Stage) {
    this.stage = stage;
    this.system = new MarkSystem(new StageProjector(stage), MARKS_CAPACITY);

    const geometry = new InstancedBufferGeometry();
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
    );
    const buffer = new InstancedInterleavedBuffer(this.system.data, STRIDE, 1);
    buffer.setUsage(DynamicDrawUsage);
    for (const [i, name] of ["iA", "iB", "iC", "iD", "iE"].entries()) {
      geometry.setAttribute(name, new InterleavedBufferAttribute(buffer, 4, i * 4));
    }
    geometry.instanceCount = 0;
    this.geometry = geometry;
    this.buffer = buffer;

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uDpr: { value: stage.dpr } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = "comic-marks";

    const added = addStepPass(stage, "marks", MARKS_ORDER, {
      live: () => this.system.alive > 0 || this.system.sustains > 0,
      step: (dt) => {
        this.system.step(dt);
        this.upload();
      },
    });
    this.pass = added.pass;
    this.removePass = added.remove;
    this.pass.scene.add(this.mesh);
    // Build the program now, while the section is still being mounted: the first mark of the page
    // (a shock icon over the drone) must not wait for the driver to compile the shader.
    this.mesh.visible = true;
    void stage.renderer.compileAsync(this.pass.scene, this.pass.camera).catch(() => undefined);
    this.mesh.visible = false;
  }

  /** Fire and forget. See `EmitOptions`. */
  emit(kind: MarkKind, options: EmitOptions): void {
    this.system.emit(kind, options);
  }

  /** A loop: set it every frame it should run (`handle.update(anchor, intensity)`), `stop()` it when done. */
  sustain(kind: MarkKind, options?: SustainOptions): SustainHandle {
    return this.system.sustain(kind, options);
  }

  /**
   * A point in the stage's pixel frame (origin in the middle, y up) from client pixels (a pointer
   * position, a DOM rectangle). Use it as `at`.
   */
  atClient(x: number, y: number): { x: number; y: number } {
    const out = { x: 0, y: 0 };
    clientToStage(x, y, this.stage.width, this.stage.height, out);
    return out;
  }

  /** Remove every mark and loop. */
  clear(): void {
    this.system.clear();
    this.upload();
  }

  /**
   * Run the simulation `seconds` forward in steps of a sixtieth, calling `tick` before each step
   * (to keep a loop set). For frame sheets and tests: the stage does this itself while it runs.
   */
  advance(seconds: number, tick?: (dt: number) => void): void {
    const dt = 1 / 60;
    let left = seconds;
    while (left > 1e-6) {
      const step = Math.min(dt, left);
      tick?.(step);
      this.system.step(step);
      left -= step;
    }
    this.upload();
  }

  /** Marks in the buffer (not counting ones that wait for their delay). */
  get drawn(): number {
    return this.system.count;
  }

  private upload(): void {
    const n = this.system.count;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    this.material.uniforms.uDpr!.value = this.stage.dpr;
    this.buffer.clearUpdateRanges();
    this.buffer.addUpdateRange(0, n * STRIDE);
    this.buffer.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removePass();
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.system.clear();
  }
}
